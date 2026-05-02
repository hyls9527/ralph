mod badge;

use ralph_core::database::Database;
use ralph_core::evaluator::Evaluator;
use ralph_core::github::GitHubClient;
use ralph_core::types::*;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, MutexGuard};
use tauri::Emitter;

/// 安全的Mutex锁辅助函数
/// 处理poisoned mutex情况，避免应用崩溃
/// 当其他线程panic导致Mutex被poison时，返回友好错误信息而非崩溃
fn safe_lock<T>(mutex: &Mutex<T>) -> Result<MutexGuard<'_, T>, String> {
    mutex.lock().map_err(|e| {
        eprintln!("⚠️ [Ralph] Mutex poisoned (线程panic导致): {}", e);
        "系统内部状态异常，请重启应用".to_string()
    })
}

/// 安全的数据库操作辅助函数
/// 自动获取锁并执行操作，失败时记录错误但不崩溃
/// 支持返回 Result 的操作和返回 () 的操作
fn safe_db_op<F, R>(state: &AppState, op: F)
where
    F: FnOnce(&Database) -> R,
{
    if let Ok(db) = safe_lock(&state.db) {
        let _ = op(&db); // 忽略结果，错误已由调用者处理或内部处理
    } else {
        eprintln!("⚠️ [Ralph] 数据库操作失败: 无法获取锁");
    }
}

struct AppState {
    github_client: Mutex<GitHubClient>,
    db: Mutex<Database>,
    batch_cancel: AtomicBool,
}

#[tauri::command]
fn cancel_batch(state: tauri::State<'_, AppState>) {
    state.batch_cancel.store(true, Ordering::SeqCst);
}

#[tauri::command]
async fn batch_evaluate(
    query: String,
    count: u8,
    state: tauri::State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<serde_json::Value, String> {
    let query = query.trim().to_string();
    if query.is_empty() {
        return Err("搜索关键词不能为空".to_string());
    }
    if query.len() > 256 {
        return Err("搜索关键词过长（最大 256 字符）".to_string());
    }

    // 重置取消状态
    state.batch_cancel.store(false, Ordering::SeqCst);

    let total = count.max(1);
    safe_db_op(&state, |db| db.log_search(&query, 0));

    let github_client = {
        let guard = safe_lock(&state.github_client)?;
        guard.clone()
    };
    let repos = github_client.search_repos(&query, total).await?;
    let total_repos = repos.len();

    // 并发评估：将 repo 分成多个批次
    let concurrency = 3; // 并发度（避免 GitHub API 限流）
    let mut results = Vec::new();
    let mut processed = 0;
    let mut skipped = 0;

    for chunk in repos.chunks(concurrency) {
        // 检查取消
        if state.batch_cancel.load(Ordering::SeqCst) {
            return Err("批量评定已取消".to_string());
        }

        // 顺序执行以避免 API 限流（更可靠）
        for repo in chunk {
            if state.batch_cancel.load(Ordering::SeqCst) {
                return Err("批量评定已取消".to_string());
            }

            let recent_commits = github_client
                .get_recent_commits(&repo.owner, &repo.name)
                .await
                .unwrap_or(0);

            let gate_checks = Evaluator::gate_check(repo, recent_commits);
            let g1_passed = gate_checks.first().map(|g| g.passed).unwrap_or(false);
            let g2_passed = gate_checks.get(1).map(|g| g.passed).unwrap_or(false);
            if !g1_passed || !g2_passed {
                skipped += 1;
                processed += 1;
                // 发送进度事件
                let _ = app_handle.emit("batch_progress", serde_json::json!({
                    "processed": processed,
                    "total": total_repos,
                    "evaluated": results.len(),
                    "skipped": skipped,
                    "currentRepo": repo.full_name,
                }));
                continue;
            }

            let neglect_index = Evaluator::calc_neglect_index(repo, recent_commits);
            let track = Evaluator::classify_track(repo.stargazers_count, neglect_index);

            let evidence_levels = vec!["L1"; 6];
            let (dimensions, _sub_scores, decision_trail, confidence_tier) =
                Evaluator::run_pipeline(repo, recent_commits, &evidence_levels);
            let raw_total = decision_trail.first().map(|s| s.before).unwrap_or(0.0);

            let (floor_passed, floor_violations) = Evaluator::check_dimension_floors(&dimensions);
            let mut veto_flags = vec![];
            let cred_disqualified = decision_trail.iter().any(|s| s.step == "声明可信度" && s.before - s.after > 5.0);
            if cred_disqualified {
                veto_flags.push("声明可信度过低，触发❌8 虚假宣传".to_string());
            }
            if !floor_passed {
                for v in &floor_violations {
                    veto_flags.push(format!("维度地板违规: {}", v));
                }
            }

            let anomaly_report = Evaluator::detect_anomalies(&dimensions, repo, recent_commits, total as usize);
            if anomaly_report.has_anomaly {
                for a in &anomaly_report.anomaly_types {
                    veto_flags.push(format!("异常检测: {}", a));
                }
            }

            let value_density = if track == "high-star" {
                Evaluator::calc_value_density(repo)
            } else {
                1.0
            };
            let steady_state = if track == "steady" {
                Evaluator::calc_steady_state(repo, recent_commits)
            } else {
                1.0
            };
            let track_pass = match track.as_str() {
                "neglected" => neglect_index >= 5.0,
                "high-star" => value_density >= 0.6,
                "steady" => steady_state >= 0.4,
                _ => true,
            };

            let total_score: f64 = dimensions.iter().map(|d| d.score).sum();
            let (fraud_detected, fraud_warning) = Evaluator::detect_score_fraud(raw_total, total_score);
            if fraud_detected {
                veto_flags.push("评分欺诈检测".to_string());
            }
            if let Some(w) = fraud_warning {
                veto_flags.push(w);
            }

            let final_score = total_score;
            let grade = Evaluator::determine_grade(final_score, &track);
            let quality_score = dimensions.iter().find(|d| d.dimension == "质量").map(|d| d.score).unwrap_or(0.0);
            let mutation_ratio = {
                let recent_30 = (recent_commits as f64 * 0.33) as usize;
                let prev_90_daily = (recent_commits as f64 * 0.67) / 3.0;
                if prev_90_daily > 0.0 { recent_30 as f64 / prev_90_daily } else { 0.0 }
            };
            let recommendation_index = Evaluator::calc_recommendation_index(
                quality_score,
                &track,
                neglect_index,
                repo.stargazers_count,
                mutation_ratio,
            );

            let trust_badge = Evaluator::build_trust_badge(&gate_checks, &dimensions, final_score);
            let one_liner = Evaluator::generate_one_liner(repo, final_score, &track);
            let evidence_level = "L1".to_string();

            let report = EvaluationReport {
                repo: repo.clone(),
                one_liner,
                track: track.clone(),
                grade: grade.clone(),
                total_score: final_score,
                recommendation_index,
                dimensions,
                gate_checks,
                neglect_index,
                value_density: Some(value_density),
                steady_state: Some(steady_state),
                trust_badge,
                evidence_level,
                veto_flags: veto_flags.clone(),
                confidence_tier: confidence_tier.as_str().to_string(),
                decision_trail,
            };

            safe_db_op(&state, |db| db.cache_evaluation(&report));
            processed += 1;

            if track_pass && final_score >= 73.0 && veto_flags.is_empty() {
                results.push(serde_json::to_value(&report).unwrap_or_default());
            }

            // 发送进度事件
            let _ = app_handle.emit("batch_progress", serde_json::json!({
                "processed": processed,
                "total": total_repos,
                "evaluated": results.len(),
                "skipped": skipped,
                "currentRepo": repo.full_name,
            }));
        }
    }

    Ok(serde_json::json!({
        "results": results,
        "meta": {
            "totalProcessed": processed,
            "totalEvaluated": results.len(),
            "totalSkipped": skipped,
            "dataSource": "batch_eval"
        }
    }))
}

#[tauri::command]
async fn search_and_evaluate(
    query: String,
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let query = query.trim().to_string();
    if query.is_empty() {
        return Err("搜索关键词不能为空".to_string());
    }
    if query.len() > 256 {
        return Err("搜索关键词过长（最大 256 字符）".to_string());
    }

    safe_db_op(&state, |db| db.log_search(&query, 0));

    let github_client = {
        let guard = safe_lock(&state.github_client)?;
        guard.clone()
    };
    let repos = github_client.search_repos(&query, 5).await?;

    let mut results = Vec::new();
    for repo in &repos {
        // 安全：使用safe_lock获取数据库访问
        let cached_result = match safe_lock(&state.db) {
            Ok(db) => db.get_cached(&repo.full_name).map_err(|e| e.to_string()),
            Err(e) => Err(e),
        };

        match cached_result {
            Ok(Some(cached)) => {
                results.push(serde_json::to_value(&cached).unwrap_or_default());
                continue;
            }
            Ok(None) => {}
            Err(e) => {
                eprintln!("⚠️ [Ralph] 缓存查询失败: {}", e);
            }
        }

        let recent_commits = github_client
            .get_recent_commits(&repo.owner, &repo.name)
            .await
            .unwrap_or(0);

        let gate_checks = Evaluator::gate_check(repo, recent_commits);

        let g1_passed = gate_checks.first().map(|g| g.passed).unwrap_or(false);
        let g2_passed = gate_checks.get(1).map(|g| g.passed).unwrap_or(false);
        if !g1_passed || !g2_passed {
            continue;
        }

        let neglect_index = Evaluator::calc_neglect_index(repo, recent_commits);
        let track = Evaluator::classify_track(repo.stargazers_count, neglect_index);

        let evidence_levels = vec!["L1"; 6];
        let (mut dimensions, _sub_scores, decision_trail, confidence_tier) =
            Evaluator::run_pipeline(repo, recent_commits, &evidence_levels);
        let raw_total = decision_trail.first().map(|s| s.before).unwrap_or(0.0);

        let cred_disqualified = decision_trail.iter().any(|s| s.step == "声明可信度" && s.before - s.after > 5.0);

        let mut total_score: f64 = dimensions.iter().map(|d| d.score).sum();

        let (floor_passed, floor_violations) = Evaluator::check_dimension_floors(&dimensions);
        let mut veto_flags = vec![];
        if cred_disqualified {
            veto_flags.push("声明可信度过低，触发❌8 虚假宣传".to_string());
        }
        if !floor_passed {
            for v in &floor_violations {
                veto_flags.push(format!("维度地板违规: {}", v));
            }
        }

        let anomaly_report = Evaluator::detect_anomalies(
            &dimensions,
            repo,
            recent_commits,
            results.len() + 1,
        );
        if anomaly_report.has_anomaly {
            for a in &anomaly_report.anomaly_types {
                veto_flags.push(format!("异常检测: {}", a));
            }
        }

        let value_density = if track == "high-star" {
            Evaluator::calc_value_density(repo)
        } else {
            1.0
        };
        let steady_state = if track == "steady" {
            Evaluator::calc_steady_state(repo, recent_commits)
        } else {
            1.0
        };
        let track_pass = match track.as_str() {
            "neglected" => neglect_index >= 5.0,
            "high-star" => value_density >= 0.6,
            "steady" => steady_state >= 0.4,
            _ => true,
        };
        if !track_pass {
            veto_flags.push(format!("轨道指标不达标 ({})", track));
        }

        let (fraud_detected, fraud_warning) = Evaluator::detect_score_fraud(raw_total, total_score);
        if fraud_detected {
            if let Some(warning) = fraud_warning {
                veto_flags.push(warning);
            }
        }

        let grade = if !veto_flags.is_empty() {
            "X".to_string()
        } else {
            Evaluator::determine_grade(total_score, &track)
        };

        let one_liner = Evaluator::generate_one_liner(repo, total_score, &track);
        let trust_badge = Evaluator::build_trust_badge(&gate_checks, &dimensions, total_score);

        let quality_score = dimensions
            .iter()
            .find(|d| d.dimension == "质量")
            .map(|d| d.score)
            .unwrap_or(0.0);

        let mutation_ratio = {
            let recent_30 = (recent_commits as f64 * 0.33) as usize;
            let prev_90_daily = (recent_commits as f64 * 0.67) / 3.0;
            if prev_90_daily > 0.0 { recent_30 as f64 / prev_90_daily } else { 0.0 }
        };

        let openssf_score = github_client
            .get_openssf_scorecard(&repo.owner, &repo.name)
            .await
            .unwrap_or(None);

        if let Some(ss_score) = openssf_score {
            Evaluator::apply_openssf_calibration(&mut dimensions, ss_score);
            total_score = dimensions.iter().map(|d| d.score).sum();
        }

        let recommendation_index = Evaluator::calc_recommendation_index(
            quality_score,
            &track,
            neglect_index,
            repo.stargazers_count,
            mutation_ratio,
        );

        let report = EvaluationReport {
            repo: repo.clone(),
            gate_checks,
            track,
            neglect_index,
            value_density: Some(value_density),
            steady_state: Some(steady_state),
            dimensions,
            total_score,
            grade,
            one_liner,
            evidence_level: "L1".to_string(),
            trust_badge,
            veto_flags,
            recommendation_index,
            confidence_tier: confidence_tier.as_str().to_string(),
            decision_trail,
        };

        safe_db_op(&state, |db| db.cache_evaluation(&report));
        results.push(serde_json::to_value(&report).unwrap_or_default());
    }

    safe_db_op(&state, |db| db.log_search(&query, results.len() as i32));

    let query_id = uuid::Uuid::new_v4().to_string();
    Ok(serde_json::json!({
        "results": results,
        "meta": {
            "queryId": query_id,
            "totalCandidates": repos.len(),
            "evaluatedCount": results.len(),
            "dataSource": "api"
        }
    }))
}

#[tauri::command]
fn get_cached_projects(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<serde_json::Value>, String> {
    let db = safe_lock(&state.db)?;
    let reports = db.get_recent_cached(100).map_err(|e| e.to_string())?;
    
    Ok(reports.into_iter()
        .filter_map(|r| serde_json::to_value(r).ok())
        .collect())
}

#[tauri::command]
fn get_search_history(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<serde_json::Value>, String> {
    let db = safe_lock(&state.db)?;
    db.get_search_history(50)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_trending_repos(
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    safe_db_op(&state, |db| db.log_search("trending", 0));

    let github_client = {
        let guard = safe_lock(&state.github_client)?;
        guard.clone()
    };
    let repos = github_client.get_trending_repos(None, "weekly").await?;
    let results: Vec<serde_json::Value> = repos.into_iter()
        .map(|r| serde_json::to_value(r).unwrap_or_default())
        .collect();
    Ok(serde_json::json!({
        "results": results,
        "meta": { "dataSource": "github_trending" }
    }))
}

#[tauri::command]
fn get_evaluation_history(
    state: tauri::State<'_, AppState>,
    repo_full_name: String,
    limit: Option<usize>,
) -> Result<Vec<serde_json::Value>, String> {
    let db = safe_lock(&state.db)?;
    db.get_evaluation_history(&repo_full_name, limit.unwrap_or(10))
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_score_trend(
    state: tauri::State<'_, AppState>,
    repo_full_name: String,
) -> Result<Vec<serde_json::Value>, String> {
    let db = safe_lock(&state.db)?;
    db.get_score_trend(&repo_full_name)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn clear_search_history(
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let db = safe_lock(&state.db)?;
    db.clear_search_history()
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn add_favorite(
    full_name: String,
    evaluation_json: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let db = safe_lock(&state.db)?;
    db.add_favorite(&full_name, &evaluation_json)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn remove_favorite(
    full_name: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let db = safe_lock(&state.db)?;
    db.remove_favorite(&full_name)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_favorites(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<serde_json::Value>, String> {
    let db = safe_lock(&state.db)?;
    db.get_favorites()
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn is_favorite(
    full_name: String,
    state: tauri::State<'_, AppState>,
) -> Result<bool, String> {
    let db = safe_lock(&state.db)?;
    db.is_favorite(&full_name)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn save_settings(
    token: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let mut client = safe_lock(&state.github_client)?;
    (*client).update_token(token);
    Ok(())
}

#[tauri::command]
fn clear_cache(
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let db = safe_lock(&state.db)?;
    db.clear_search_history()
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn generate_badge(
    grade: String,
    score: f64,
    repo_full_name: String,
) -> Result<serde_json::Value, String> {
    let badge_info = badge::generate_badge(grade, score, repo_full_name);
    Ok(serde_json::to_value(&badge_info).unwrap_or_default())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_data = dirs::data_local_dir()
        .unwrap_or_else(|| std::env::temp_dir())
        .join("ralph");
    std::fs::create_dir_all(&app_data).ok();
    let db_path = app_data.join("ralph.db");
    
    let db = Database::new(db_path.to_str().unwrap()).expect("Failed to initialize database");
    db.init_schema().expect("Failed to create database schema");

    let github_token = std::env::var("GITHUB_TOKEN").ok().filter(|t| !t.is_empty());
    let github_client = GitHubClient::new(github_token);

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState {
            github_client: Mutex::new(github_client),
            db: Mutex::new(db),
            batch_cancel: AtomicBool::new(false),
        })
        .invoke_handler(tauri::generate_handler![
            search_and_evaluate,
            get_cached_projects,
            batch_evaluate,
            cancel_batch,
            get_search_history,
            get_trending_repos,
            get_evaluation_history,
            get_score_trend,
            clear_search_history,
            add_favorite,
            remove_favorite,
            get_favorites,
            is_favorite,
            save_settings,
            clear_cache,
            generate_badge,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri");
}
