use ralph_core::database::Database;
use ralph_core::evaluator::Evaluator;
use ralph_core::github::GitHubClient;
use ralph_core::types::*;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use tauri::Emitter;

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
    // 重置取消状态
    state.batch_cancel.store(false, Ordering::SeqCst);
    
    let total = count.max(30); // 批量评定至少 30 个项目以启用完整异常检测
    state.db.lock().unwrap().log_search(&query, 0).ok();

    let github_client = {
        let guard = state.github_client.lock().unwrap();
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

            state.db.lock().unwrap().cache_evaluation(&report).ok();
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
    state.db.lock().unwrap().log_search(&query, 0).ok();

    // Clone the GitHubClient to avoid holding MutexGuard across await
    let github_client = {
        let guard = state.github_client.lock().unwrap();
        guard.clone()
    };
    let repos = github_client.search_repos(&query, 5).await?;

    let mut results = Vec::new();
    for repo in &repos {
        let recent_commits = github_client
            .get_recent_commits(&repo.owner, &repo.name)
            .await
            .unwrap_or(0);

        let gate_checks = Evaluator::gate_check(repo, recent_commits);

        // G1(license) + G2(recent commits) are hard gates — if they fail, skip
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

        // 重新计算总分（修正后）
        let mut total_score: f64 = dimensions.iter().map(|d| d.score).sum();

        // 步骤 7: 维度地板检查
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

        // 步骤 8: 综合异常检测
        let anomaly_report = Evaluator::detect_anomalies(
            &dimensions,
            repo,
            recent_commits,
            results.len() + 1, // 当前批次序号
        );
        if anomaly_report.has_anomaly {
            for a in &anomaly_report.anomaly_types {
                veto_flags.push(format!("异常检测: {}", a));
            }
        }

        // 轨道指标计算
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

        // ❌9 评分欺诈检测（使用原始总分与修正后总分对比）
        let (fraud_detected, fraud_warning) = Evaluator::detect_score_fraud(raw_total, total_score);
        if fraud_detected {
            if let Some(warning) = fraud_warning {
                veto_flags.push(warning);
            }
        }

        // 如果存在一票否决，标记为 X 级
        if !veto_flags.is_empty() {
            // 继续保留但标记
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

        // 推荐指数：突变比计算
        let mutation_ratio = {
            let recent_30 = (recent_commits as f64 * 0.33) as usize;
            let prev_90_daily = (recent_commits as f64 * 0.67) / 3.0;
            if prev_90_daily > 0.0 { recent_30 as f64 / prev_90_daily } else { 0.0 }
        };

        // OpenSSF Scorecard 交叉校验 + F维度校准
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

        state.db.lock().unwrap().cache_evaluation(&report).ok();
        results.push(serde_json::to_value(&report).unwrap_or_default());
    }

    state
        .db
        .lock()
        .unwrap()
        .log_search(&query, results.len() as i32)
        .ok();

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
    let reports = state.db.lock().unwrap()
        .get_recent_cached(100)
        .map_err(|e| e.to_string())?;
    
    Ok(reports.into_iter()
        .filter_map(|r| serde_json::to_value(r).ok())
        .collect())
}

#[tauri::command]
fn get_search_history(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<serde_json::Value>, String> {
    state.db.lock().unwrap()
        .get_search_history(50)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_trending_repos(
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    state.db.lock().unwrap().log_search("trending", 0).ok();
    let github_client = {
        let guard = state.github_client.lock().unwrap();
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
    state.db.lock().unwrap()
        .get_evaluation_history(&repo_full_name, limit.unwrap_or(10))
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_score_trend(
    state: tauri::State<'_, AppState>,
    repo_full_name: String,
) -> Result<Vec<serde_json::Value>, String> {
    state.db.lock().unwrap()
        .get_score_trend(&repo_full_name)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn clear_search_history(
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    state.db.lock().unwrap()
        .clear_search_history()
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn add_favorite(
    full_name: String,
    evaluation_json: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    state.db.lock().unwrap()
        .add_favorite(&full_name, &evaluation_json)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn remove_favorite(
    full_name: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    state.db.lock().unwrap()
        .remove_favorite(&full_name)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_favorites(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<serde_json::Value>, String> {
    state.db.lock().unwrap()
        .get_favorites()
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn is_favorite(
    full_name: String,
    state: tauri::State<'_, AppState>,
) -> Result<bool, String> {
    state.db.lock().unwrap()
        .is_favorite(&full_name)
        .map_err(|e| e.to_string())
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri");
}
