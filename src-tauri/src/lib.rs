mod badge;

use ralph_core::database::Database;
use ralph_core::deep_analysis::DeepAnalyzer;
use ralph_core::discovery::{DiscoveryAgent, DiscoveryConfig};
use ralph_core::evaluator::Evaluator;
use ralph_core::github::GitHubClient;
use ralph_core::trend_analysis::TrendAnalyzer;
use ralph_core::types::*;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, MutexGuard};
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
fn safe_db_op<F, R>(state: &AppState, op: F) -> Result<R, String>
where
    F: FnOnce(&Database) -> R,
{
    let db = safe_lock(&state.db)?;
    Ok(op(&db))
}

struct AppState {
    github_client: Mutex<GitHubClient>,
    db: Mutex<Database>,
    batch_cancel: AtomicBool,
    discovery_agent: Mutex<Option<Arc<DiscoveryAgent>>>,
    discovery_config: Mutex<DiscoveryConfig>,
}
#[derive(Debug)]
enum EvalStatus {
    Skipped,
    Evaluated(EvaluationReport),
}

async fn evaluate_single_repo(
    github_client: &GitHubClient,
    repo: &RepoInfo,
    total_count: usize,
) -> Result<EvalStatus, String> {
    let recent_commits = github_client
        .get_recent_commits(&repo.owner, &repo.name)
        .await
        .unwrap_or(0);

    let gate_checks = Evaluator::gate_check(repo, recent_commits);
    let g1_passed = gate_checks.first().map(|g| g.passed).unwrap_or(false);
    let g2_passed = gate_checks.get(1).map(|g| g.passed).unwrap_or(false);
    if !g1_passed || !g2_passed {
        return Ok(EvalStatus::Skipped);
    }

    let neglect_index = Evaluator::calc_neglect_index(repo, recent_commits);
    let track = Evaluator::classify_track(repo.stargazers_count, neglect_index);

    let evidence_levels = vec!["L1"; 6];
    let (dimensions, _sub_scores, decision_trail, confidence_tier) =
        Evaluator::run_pipeline(repo, recent_commits, &evidence_levels);
    let raw_total = decision_trail.first().map(|s| s.before).unwrap_or(0.0);

    let (floor_passed, floor_violations) = Evaluator::check_dimension_floors(&dimensions);
    let mut veto_flags = vec![];
    let cred_disqualified = decision_trail.iter().any(|s| {
        s.step.contains("credibility") && s.before - s.after > 5.0
    });
    if cred_disqualified {
        veto_flags.push("credibility disqualified".to_string());
    }
    if !floor_passed {
        for v in &floor_violations {
            veto_flags.push(format!("floor violation: {}", v));
        }
    }

    let anomaly_report = Evaluator::detect_anomalies(&dimensions, repo, recent_commits, total_count);
    if anomaly_report.has_anomaly {
        for a in &anomaly_report.anomaly_types {
            veto_flags.push(format!("anomaly: {}", a));
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

    let total_score: f64 = dimensions.iter().map(|d| d.score).sum();
    let (fraud_detected, fraud_warning) = Evaluator::detect_score_fraud(raw_total, total_score);
    if fraud_detected {
        veto_flags.push("score fraud detected".to_string());
    }
    if let Some(w) = fraud_warning {
        veto_flags.push(w);
    }

    let mut final_score = total_score;

    let openssf_score = github_client
        .get_openssf_scorecard(&repo.owner, &repo.name)
        .await
        .unwrap_or(None);

    if let Some(ss_score) = openssf_score {
        let mut dims_clone = dimensions.clone();
        Evaluator::apply_openssf_calibration(&mut dims_clone, ss_score);
        final_score = dims_clone.iter().map(|d| d.score).sum();
    }

    let grade = Evaluator::determine_grade(final_score, &track);
    let quality_score = dimensions.iter().find(|d| d.dimension.contains("quality")).map(|d| d.score).unwrap_or(0.0);
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

    Ok(EvalStatus::Evaluated(report))
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
        return Err("search query cannot be empty".to_string());
    }
    if query.len() > 256 {
        return Err("search query too long (max 256 chars)".to_string());
    }

    state.batch_cancel.store(false, Ordering::SeqCst);

    let total = count.max(1);
    let session_id = uuid::Uuid::new_v4().to_string();

    let _ = safe_db_op(&state, |db| {
        db.create_batch_session(&session_id, &query, total as usize).ok();
        db.log_search(&query, 0)
        .ok();
    });

    let github_client = {
        let guard = safe_lock(&state.github_client)?;
        guard.clone()
    };
    let repos = github_client.search_repos(&query, total).await?;
    let total_repos = repos.len();

    let concurrency = 5;
    let mut results = Vec::new();
    let mut processed = 0;
    let mut skipped = 0;

    for chunk in repos.chunks(concurrency) {
        if state.batch_cancel.load(Ordering::SeqCst) {
            let _ = safe_db_op(&state, |db| {
                db.update_batch_session(&session_id, processed, results.len(), skipped, "paused")
            });
            return Err("batch cancelled".to_string());
        }

        let mut handles = tokio::task::JoinSet::new();
        for repo in chunk {
            if state.batch_cancel.load(Ordering::SeqCst) {
                break;
            }
            let gh = github_client.clone();
            let r = repo.clone();
            let tc = total_repos;
            handles.spawn(async move { evaluate_single_repo(&gh, &r, tc).await });
        }

        while let Some(task_result) = handles.join_next().await {
            if state.batch_cancel.load(Ordering::SeqCst) {
                handles.abort_all();
                let _ = safe_db_op(&state, |db| {
                    db.update_batch_session(&session_id, processed, results.len(), skipped, "paused")
                });
                return Err("batch cancelled".to_string());
            }

            match task_result {
                Ok(Ok(EvalStatus::Skipped)) => {
                    skipped += 1;
                    processed += 1;
                }
                Ok(Ok(EvalStatus::Evaluated(report))) => {
                    let track_pass = match report.track.as_str() {
                        "neglected" => report.neglect_index >= 5.0,
                        "high-star" => report.value_density.unwrap_or(1.0) >= 0.6,
                        "steady" => report.steady_state.unwrap_or(1.0) >= 0.4,
                        _ => true,
                    };

                    let _ = safe_db_op(&state, |db| db.cache_evaluation(&report));
                    processed += 1;

                    let repo_status = if track_pass && report.total_score >= 73.0 && report.veto_flags.is_empty() {
                        results.push(serde_json::to_value(&report).unwrap_or_default());
                        "evaluated_pass"
                    } else {
                        "evaluated_fail"
                    };

                    let _ = safe_db_op(&state, |db| {
                        db.mark_batch_repo_processed(&session_id, &report.repo.full_name, repo_status).ok();
                        db.update_batch_session(&session_id, processed, results.len(), skipped, "running")
                    });

                    let _ = app_handle.emit("batch_progress", serde_json::json!({
                        "processed": processed,
                        "total": total_repos,
                        "evaluated": results.len(),
                        "skipped": skipped,
                        "currentRepo": report.repo.full_name,
                        "sessionId": session_id,
                    }));
                }
                Ok(Err(e)) => {
                    eprintln!("[batch] eval error: {}", e);
                    processed += 1;
                }
                Err(join_err) => {
                    eprintln!("[batch] task panic: {}", join_err);
                    processed += 1;
                }
            }
        }
    }

    let _ = safe_db_op(&state, |db| {
        db.update_batch_session(&session_id, processed, results.len(), skipped, "completed")
    });

    Ok(serde_json::json!({
        "results": results,
        "meta": {
            "totalProcessed": processed,
            "totalEvaluated": results.len(),
            "totalSkipped": skipped,
            "dataSource": "batch_eval",
            "sessionId": session_id,
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
        return Err("search query cannot be empty".to_string());
    }
    if query.len() > 256 {
        return Err("search query too long (max 256 chars)".to_string());
    }

    let _ = safe_db_op(&state, |db| db.log_search(&query, 0));

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

        let _ = safe_db_op(&state, |db| db.cache_evaluation(&report));
        results.push(serde_json::to_value(&report).unwrap_or_default());
    }

    let _ = safe_db_op(&state, |db| db.log_search(&query, results.len() as i32));

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
    let _ = safe_db_op(&state, |db| db.log_search("trending", 0));

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
fn log_search_history(
    query: String,
    count: i32,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let db = safe_lock(&state.db)?;
    db.log_search(&query, count)
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


#[tauri::command]
async fn resume_batch(
    session_id: String,
    state: tauri::State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<serde_json::Value, String> {
    state.batch_cancel.store(false, Ordering::SeqCst);

    let (query, total_count, processed_count) = {
        let db = safe_lock(&state.db)?;
        let session = db.get_batch_session(&session_id)
            .map_err(|e| format!("session not found: {}", e))?
            .ok_or_else(|| "session not found".to_string())?;
        let query = session["query"].as_str().unwrap_or("").to_string();
        let total_count = session["totalRepos"].as_u64().unwrap_or(0) as usize;
        let processed_count = session["processed"].as_u64().unwrap_or(0) as usize;
        (query, total_count, processed_count)
    };

    let github_client = {
        let guard = safe_lock(&state.github_client)?;
        guard.clone()
    };

    let all_repos = github_client.search_repos(&query, total_count.max(1) as u8).await?;
    let remaining: Vec<_> = all_repos.into_iter().skip(processed_count).collect();
    let total_remaining = remaining.len();

    let concurrency = 5;
    let mut results = Vec::new();
    let mut processed = processed_count;
    let mut skipped = 0;

    for chunk in remaining.chunks(concurrency) {
        if state.batch_cancel.load(Ordering::SeqCst) {
            let _ = safe_db_op(&state, |db| {
                db.update_batch_session(&session_id, processed, results.len(), skipped, "paused")
            });
            return Err("batch cancelled".to_string());
        }

        let mut handles = tokio::task::JoinSet::new();
        for repo in chunk {
            if state.batch_cancel.load(Ordering::SeqCst) {
                break;
            }
            let gh = github_client.clone();
            let r = repo.clone();
            let tc = total_remaining;
            handles.spawn(async move { evaluate_single_repo(&gh, &r, tc).await });
        }

        while let Some(task_result) = handles.join_next().await {
            if state.batch_cancel.load(Ordering::SeqCst) {
                handles.abort_all();
                let _ = safe_db_op(&state, |db| {
                    db.update_batch_session(&session_id, processed, results.len(), skipped, "paused")
                });
                return Err("batch cancelled".to_string());
            }

            match task_result {
                Ok(Ok(EvalStatus::Skipped)) => {
                    skipped += 1;
                    processed += 1;
                }
                Ok(Ok(EvalStatus::Evaluated(report))) => {
                    let track_pass = match report.track.as_str() {
                        "neglected" => report.neglect_index >= 5.0,
                        "high-star" => report.value_density.unwrap_or(1.0) >= 0.6,
                        "steady" => report.steady_state.unwrap_or(1.0) >= 0.4,
                        _ => true,
                    };

                    let _ = safe_db_op(&state, |db| db.cache_evaluation(&report));
                    processed += 1;

                    let repo_status = if track_pass && report.total_score >= 73.0 && report.veto_flags.is_empty() {
                        results.push(serde_json::to_value(&report).unwrap_or_default());
                        "evaluated_pass"
                    } else {
                        "evaluated_fail"
                    };

                    let _ = safe_db_op(&state, |db| {
                        db.mark_batch_repo_processed(&session_id, &report.repo.full_name, repo_status).ok();
                        db.update_batch_session(&session_id, processed, results.len(), skipped, "running")
                    });

                    let _ = app_handle.emit("batch_progress", serde_json::json!({
                        "processed": processed,
                        "total": total_count,
                        "evaluated": results.len(),
                        "skipped": skipped,
                        "currentRepo": report.repo.full_name,
                        "sessionId": session_id,
                    }));
                }
                Ok(Err(e)) => {
                    eprintln!("[resume] eval error: {}", e);
                    processed += 1;
                }
                Err(join_err) => {
                    eprintln!("[resume] task panic: {}", join_err);
                    processed += 1;
                }
            }
        }
    }

    let _ = safe_db_op(&state, |db| {
        db.update_batch_session(&session_id, processed, results.len(), skipped, "completed")
    });

    Ok(serde_json::json!({
        "results": results,
        "meta": {
            "totalProcessed": processed,
            "totalEvaluated": results.len(),
            "totalSkipped": skipped,
            "dataSource": "batch_eval",
            "sessionId": session_id,
        }
    }))
}

#[tauri::command]
fn get_batch_sessions(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<serde_json::Value>, String> {
    let db = safe_lock(&state.db)?;
    db.get_incomplete_batch_sessions()
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_batch_session(
    session_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let db = safe_lock(&state.db)?;
    db.delete_batch_session(&session_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_stats(
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let db = safe_lock(&state.db)?;
    db.get_stats()
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn start_discovery(
    state: tauri::State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let config = {
        let guard = safe_lock(&state.discovery_config)?;
        guard.clone()
    };

    let github_client = {
        let guard = safe_lock(&state.github_client)?;
        guard.clone()
    };

    let agent = DiscoveryAgent::new(github_client, config);
    let agent = Arc::new(agent);
    agent.start();

    {
        let mut guard = safe_lock(&state.discovery_agent)?;
        *guard = Some(agent.clone());
    }

    let agent_clone = agent.clone();
    let app_handle_clone = app_handle.clone();
    tokio::spawn(async move {
        loop {
            if !agent_clone.is_running() {
                break;
            }

            let cached_repos: std::collections::HashSet<String> = std::collections::HashSet::new();
            match agent_clone.run_once(&cached_repos).await {
                Ok(results) => {
                    let _ = app_handle_clone.emit("discovery_results", serde_json::json!({
                        "count": results.len(),
                    }));
                }
                Err(e) => {
                    eprintln!("[discovery] error: {}", e);
                }
            }

            tokio::time::sleep(tokio::time::Duration::from_secs(60)).await;
        }
    });

    Ok(())
}

#[tauri::command]
fn stop_discovery(
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let guard = safe_lock(&state.discovery_agent)?;
    if let Some(agent) = guard.as_ref() {
        agent.stop();
    }
    Ok(())
}

#[tauri::command]
fn get_discovery_status(
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let guard = safe_lock(&state.discovery_agent)?;
    match guard.as_ref() {
        Some(agent) => {
            let status = agent.get_status();
            Ok(serde_json::json!({
                "running": agent.is_running(),
                "discoveriesCount": status.discoveries_count,
                "lastRunAt": status.last_run_at,
                "currentRound": status.current_round,
                "totalEvaluated": status.total_evaluated,
            }))
        }
        None => Ok(serde_json::json!({
            "running": false,
            "discoveriesCount": 0,
            "lastRunAt": null,
            "currentRound": 0,
            "totalEvaluated": 0,
        })),
    }
}

#[tauri::command]
fn get_discovery_results(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<serde_json::Value>, String> {
    let db = safe_lock(&state.db)?;
    db.get_discovery_results(50)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn clear_discovery_results(
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let db = safe_lock(&state.db)?;
    db.clear_discovery_results()
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn update_discovery_config(
    config: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let config: DiscoveryConfig = serde_json::from_str(&config)
        .map_err(|e| format!("invalid config: {}", e))?;
    let mut guard = safe_lock(&state.discovery_config)?;
    *guard = config;
    Ok(())
}

#[tauri::command]
fn get_discovery_config(
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let guard = safe_lock(&state.discovery_config)?;
    serde_json::to_value(&*guard)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn export_discovery_results(
    format: String,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    let db = safe_lock(&state.db)?;
    let results: Vec<serde_json::Value> = db.get_discovery_results(1000)
        .map_err(|e| e.to_string())?;

    match format.as_str() {
        "json" => serde_json::to_string_pretty(&results)
            .map_err(|e| e.to_string()),
        "csv" => {
            let mut csv = String::from("full_name,score,grade,track,stars,language,description
");
            for r in &results {
                let full_name = r["report"]["repo"]["fullName"].as_str().unwrap_or("");
                let score = r["report"]["totalScore"].as_f64().unwrap_or(0.0);
                let grade = r["report"]["grade"].as_str().unwrap_or("");
                let track = r["report"]["track"].as_str().unwrap_or("");
                let stars = r["report"]["repo"]["stargazersCount"].as_u64().unwrap_or(0);
                let lang = r["report"]["repo"]["language"].as_str().unwrap_or("");
                let desc = r["report"]["repo"]["description"].as_str().unwrap_or("").replace(',', ";");
                csv.push_str(&format!(
                    "{},{},{},{},{},{},{}
",
                    full_name, score, grade, track, stars, lang, desc
                ));
            }
            Ok(csv)
        }
        _ => Err(format!("unsupported format: {}", format)),
    }
}

#[tauri::command]
async fn get_trend_analysis(
    repo_full_name: String,
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let github_client = {
        let guard = safe_lock(&state.github_client)?;
        guard.clone()
    };

    let parts: Vec<&str> = repo_full_name.split('/').collect();
    if parts.len() != 2 {
        return Err("invalid repo format, expected owner/name".to_string());
    }

    let star_history = github_client.get_star_history(parts[0], parts[1]).await
        .unwrap_or_default();
    let commit_activity = github_client.get_commit_activity(parts[0], parts[1]).await
        .unwrap_or_default();
    let issue_metrics = github_client.get_issue_stats(parts[0], parts[1]).await
        .unwrap_or_default();

    let analysis = TrendAnalyzer::analyze(
        &repo_full_name,
        &star_history,
        &commit_activity,
        &issue_metrics,
    );

    serde_json::to_value(&analysis)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_deep_analysis(
    repo_full_name: String,
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let github_client = {
        let guard = safe_lock(&state.github_client)?;
        guard.clone()
    };

    let parts: Vec<&str> = repo_full_name.split('/').collect();
    if parts.len() != 2 {
        return Err("invalid repo format, expected owner/name".to_string());
    }

    let file_tree = github_client.get_repo_tree(parts[0], parts[1]).await
        .unwrap_or_default();

    let analysis = DeepAnalyzer::analyze_file_tree(&repo_full_name, &file_tree);

    serde_json::to_value(&analysis)
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
            discovery_agent: Mutex::new(None),
            discovery_config: Mutex::new(DiscoveryConfig::default()),
        })
        .invoke_handler(tauri::generate_handler![
            search_and_evaluate,
            get_cached_projects,
            batch_evaluate,
            cancel_batch,
            resume_batch,
            get_batch_sessions,
            delete_batch_session,
            get_stats,
            start_discovery,
            stop_discovery,
            get_discovery_status,
            get_discovery_results,
            clear_discovery_results,
            update_discovery_config,
            get_discovery_config,
            export_discovery_results,
            get_trend_analysis,
            get_deep_analysis,
            get_search_history,
            log_search_history,
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
