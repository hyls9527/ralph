use crate::database::Database;
use crate::evaluator::Evaluator;
use crate::github::GitHubClient;
use crate::types::*;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tokio::time::{sleep, Duration};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveryConfig {
    pub topics: Vec<String>,
    pub languages: Vec<String>,
    pub min_stars: u32,
    pub max_stars: u32,
    pub min_score: f64,
    pub interval_minutes: u64,
    pub max_per_round: u8,
}

impl Default for DiscoveryConfig {
    fn default() -> Self {
        Self {
            topics: vec![
                "developer-tools".to_string(),
                "devtools".to_string(),
                "cli".to_string(),
                "rust".to_string(),
                "typescript".to_string(),
                "ai".to_string(),
                "llm".to_string(),
                "agent".to_string(),
                "tool".to_string(),
            ],
            languages: vec!["Rust".to_string(), "TypeScript".to_string(), "Python".to_string(), "Go".to_string()],
            min_stars: 10,
            max_stars: 500,
            min_score: 73.0,
            interval_minutes: 60,
            max_per_round: 5,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveryStatus {
    pub running: bool,
    pub discoveries_count: u32,
    pub last_run_at: Option<String>,
    pub next_run_at: Option<String>,
    pub current_round: u32,
    pub total_evaluated: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveryResult {
    pub report: EvaluationReport,
    pub discovered_at: String,
    pub discovery_query: String,
}

pub struct DiscoveryAgent {
    config: DiscoveryConfig,
    github_client: GitHubClient,
    running: Arc<AtomicBool>,
    status: Arc<std::sync::Mutex<DiscoveryStatus>>,
}

impl DiscoveryAgent {
    pub fn new(github_client: GitHubClient, config: DiscoveryConfig) -> Self {
        Self {
            config,
            github_client,
            running: Arc::new(AtomicBool::new(false)),
            status: Arc::new(std::sync::Mutex::new(DiscoveryStatus {
                running: false,
                discoveries_count: 0,
                last_run_at: None,
                next_run_at: None,
                current_round: 0,
                total_evaluated: 0,
            })),
        }
    }

    pub fn is_running(&self) -> bool {
        self.running.load(Ordering::SeqCst)
    }

    pub fn get_status(&self) -> DiscoveryStatus {
        self.status.lock().unwrap_or_else(|e| e.into_inner()).clone()
    }

    pub fn update_config(&mut self, config: DiscoveryConfig) {
        self.config = config;
    }

    pub fn stop(&self) {
        self.running.store(false, Ordering::SeqCst);
        if let Ok(mut status) = self.status.lock() {
            status.running = false;
        }
    }

    pub fn start(&self) {
        self.running.store(true, Ordering::SeqCst);
        if let Ok(mut status) = self.status.lock() {
            status.running = true;
        }
    }

    fn build_discovery_queries(&self) -> Vec<String> {
        let mut queries = Vec::new();

        for topic in &self.config.topics {
            let query = format!(
                "topic:{} stars:{}-{}",
                topic, self.config.min_stars, self.config.max_stars
            );
            queries.push(query);
        }

        for lang in &self.config.languages {
            let query = format!(
                "language:{} stars:{}-{}",
                lang.to_lowercase(), self.config.min_stars, self.config.max_stars
            );
            queries.push(query);
        }

        queries.push(format!(
            "stars:{}-{} pushed:>2024-01-01",
            self.config.min_stars, self.config.max_stars
        ));

        queries
    }

    pub async fn run_once(
        &self,
        cached_repos: &HashSet<String>,
    ) -> Result<Vec<DiscoveryResult>, String> {
        let queries = self.build_discovery_queries();
        let mut all_results = Vec::new();
        let now = chrono::Utc::now();

        for query in &queries {
            if !self.running.load(Ordering::SeqCst) {
                break;
            }

            let repos = match self.github_client.search_repos(query, self.config.max_per_round).await {
                Ok(r) => r,
                Err(e) => {
                    eprintln!("[Discovery] 搜索失败 ({}): {}", query, e);
                    continue;
                }
            };

            for repo in &repos {
                if !self.running.load(Ordering::SeqCst) {
                    break;
                }

                if cached_repos.contains(&repo.full_name) {
                    continue;
                }

                let recent_commits = self.github_client
                    .get_recent_commits(&repo.owner, &repo.name)
                    .await
                    .unwrap_or(0);

                let gate_checks = Evaluator::gate_check(repo, recent_commits);
                let all_passed = gate_checks.iter().all(|g| g.passed);
                if !all_passed {
                    continue;
                }

                let neglect_index = Evaluator::calc_neglect_index(repo, recent_commits);
                let track = Evaluator::classify_track(repo.stargazers_count, neglect_index);

                let evidence_levels = vec!["L1"; 6];
                let (dimensions, _sub_scores, decision_trail, confidence_tier) =
                    Evaluator::run_pipeline(repo, recent_commits, &evidence_levels);

                let total_score: f64 = dimensions.iter().map(|d| d.score).sum();

                if total_score < self.config.min_score {
                    continue;
                }

                let (floor_passed, _floor_violations) = Evaluator::check_dimension_floors(&dimensions);
                if !floor_passed {
                    continue;
                }

                let grade = Evaluator::determine_grade(total_score, &track);
                let quality_score = dimensions.iter().find(|d| d.dimension == "质量").map(|d| d.score).unwrap_or(0.0);
                let mutation_ratio = {
                    let recent_30 = (recent_commits as f64 * 0.33) as usize;
                    let prev_90_daily = (recent_commits as f64 * 0.67) / 3.0;
                    if prev_90_daily > 0.0 { recent_30 as f64 / prev_90_daily } else { 0.0 }
                };
                let recommendation_index = Evaluator::calc_recommendation_index(
                    quality_score, &track, neglect_index, repo.stargazers_count, mutation_ratio,
                );

                let trust_badge = Evaluator::build_trust_badge(&gate_checks, &dimensions, total_score);
                let one_liner = Evaluator::generate_one_liner(repo, total_score, &track);

                let report = EvaluationReport {
                    repo: repo.clone(),
                    one_liner,
                    track: track.clone(),
                    grade: grade.clone(),
                    total_score,
                    recommendation_index,
                    dimensions,
                    gate_checks,
                    neglect_index,
                    value_density: if track == "high-star" { Some(Evaluator::calc_value_density(repo)) } else { None },
                    steady_state: if track == "steady" { Some(Evaluator::calc_steady_state(repo, recent_commits)) } else { None },
                    trust_badge,
                    evidence_level: "L1".to_string(),
                    veto_flags: vec![],
                    confidence_tier: confidence_tier.as_str().to_string(),
                    decision_trail,
                };

                let _ = ();

                all_results.push(DiscoveryResult {
                    report,
                    discovered_at: now.to_rfc3339(),
                    discovery_query: query.clone(),
                });

                sleep(Duration::from_millis(500)).await;
            }

            sleep(Duration::from_secs(2)).await;
        }

        if let Ok(mut status) = self.status.lock() {
            status.discoveries_count += all_results.len() as u32;
            status.total_evaluated += all_results.len() as u32;
            status.last_run_at = Some(now.to_rfc3339());
            status.current_round += 1;
        }

        Ok(all_results)
    }

    pub async fn start_loop(
        agent: Arc<DiscoveryAgent>,
        db: Arc<std::sync::Mutex<Database>>,
    ) {
        agent.running.store(true, Ordering::SeqCst);
        {
            if let Ok(mut status) = agent.status.lock() {
                status.running = true;
            }
        }

        while agent.running.load(Ordering::SeqCst) {
            let next_run = {
                let cached_repos: HashSet<String> = {
                    let db_guard = db.lock().unwrap_or_else(|e| e.into_inner());
                    db_guard.get_recent_cached(10000)
                        .unwrap_or_default()
                        .into_iter()
                        .map(|r| r.repo.full_name.clone())
                        .collect()
                };

                match agent.run_once(&cached_repos).await {
                    Ok(results) => {
                        eprintln!("[Discovery] 本轮发现 {} 个宝藏项目", results.len());
                        let db_guard = db.lock().unwrap_or_else(|e| e.into_inner());
                        for result in &results {
                            let _ = db_guard.cache_evaluation(&result.report);
                            let _ = db_guard.save_discovery_result(&result.report, &result.discovery_query);
                        }
                    }
                    Err(e) => {
                        eprintln!("[Discovery] 本轮失败: {}", e);
                    }
                }

                let interval = agent.config.interval_minutes;
                let next = chrono::Utc::now() + chrono::Duration::minutes(interval as i64);
                if let Ok(mut status) = agent.status.lock() {
                    status.next_run_at = Some(next.to_rfc3339());
                }
                interval
            };

            sleep(Duration::from_secs(next_run * 60)).await;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_discovery_config_default() {
        let config = DiscoveryConfig::default();
        assert!(!config.topics.is_empty());
        assert!(config.min_stars < config.max_stars);
        assert!(config.min_score > 0.0);
        assert!(config.interval_minutes > 0);
    }

    #[test]
    fn test_build_discovery_queries() {
        let config = DiscoveryConfig {
            topics: vec!["rust".to_string()],
            languages: vec!["Rust".to_string()],
            min_stars: 10,
            max_stars: 100,
            ..Default::default()
        };
        let client = GitHubClient::new(None);
        let agent = DiscoveryAgent::new(client, config);
        let queries = agent.build_discovery_queries();
        assert!(queries.iter().any(|q| q.contains("topic:rust")));
        assert!(queries.iter().any(|q| q.contains("language:rust")));
        assert!(queries.iter().any(|q| q.contains("stars:10-100")));
    }

    #[test]
    fn test_discovery_status_initial() {
        let config = DiscoveryConfig::default();
        let client = GitHubClient::new(None);
        let agent = DiscoveryAgent::new(client, config);
        let status = agent.get_status();
        assert!(!status.running);
        assert_eq!(status.discoveries_count, 0);
        assert_eq!(status.current_round, 0);
    }

    #[test]
    fn test_discovery_stop() {
        let config = DiscoveryConfig::default();
        let client = GitHubClient::new(None);
        let agent = DiscoveryAgent::new(client, config);
        agent.stop();
        assert!(!agent.is_running());
    }
}
