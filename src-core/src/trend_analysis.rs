use crate::types::*;

pub struct TrendAnalyzer;

impl TrendAnalyzer {
    pub fn analyze(
        repo_full_name: &str,
        star_history: &[StarHistoryPoint],
        commit_activity: &[CommitActivityWeek],
        issue_metrics: &IssueMetrics,
    ) -> TrendReport {
        let star_growth_rate = Self::calc_star_growth_rate(star_history);
        let star_trend = Self::classify_star_trend(star_history, star_growth_rate);
        let (commit_frequency_trend, commit_consistency) =
            Self::analyze_commit_trend(commit_activity);
        let issue_health = Self::calc_issue_health(issue_metrics);
        let anomalies = Self::detect_anomalies(star_history, commit_activity, issue_metrics);
        let health_score = Self::calc_health_score(
            star_growth_rate,
            &star_trend,
            commit_consistency,
            issue_health,
            &anomalies,
        );
        let health_label = Self::health_label(health_score);

        TrendReport {
            repo_full_name: repo_full_name.to_string(),
            star_growth_rate,
            star_trend,
            commit_frequency_trend,
            commit_consistency,
            issue_health,
            health_score,
            health_label,
            anomalies,
            star_history: star_history.to_vec(),
            commit_activity: commit_activity.to_vec(),
            issue_metrics: issue_metrics.clone(),
            generated_at: chrono::Utc::now().to_rfc3339(),
        }
    }

    fn calc_star_growth_rate(star_history: &[StarHistoryPoint]) -> f64 {
        if star_history.len() < 2 {
            return 0.0;
        }

        let n = star_history.len() as f64;
        let first_date = &star_history[0].date;
        let last_date = &star_history[star_history.len() - 1].date;

        let _days_span = days_between(first_date, last_date).max(1.0);
        let star_diff = star_history[star_history.len() - 1].count as f64
            - star_history[0].count as f64;

        if star_diff <= 0.0 {
            return 0.0;
        }

        let sum_x: f64 = (0..star_history.len()).map(|i| i as f64).sum();
        let sum_y: f64 = star_history.iter().map(|p| p.count as f64).sum();
        let sum_xy: f64 = star_history
            .iter()
            .enumerate()
            .map(|(i, p)| i as f64 * p.count as f64)
            .sum();
        let sum_x2: f64 = (0..star_history.len()).map(|i| (i as f64).powi(2)).sum();

        let slope = (n * sum_xy - sum_x * sum_y) / (n * sum_x2 - sum_x.powi(2)).max(1e-10);

        let daily_rate = slope.max(0.0);
        daily_rate * 30.0
    }

    fn classify_star_trend(star_history: &[StarHistoryPoint], growth_rate: f64) -> String {
        if star_history.len() < 3 {
            return "insufficient_data".to_string();
        }

        let recent_idx = (star_history.len() as f64 * 0.7) as usize;
        let early_avg: f64 = star_history[..recent_idx.max(1)]
            .iter()
            .map(|p| p.count as f64)
            .sum::<f64>()
            / recent_idx.max(1) as f64;

        let recent_avg: f64 = star_history[recent_idx..]
            .iter()
            .map(|p| p.count as f64)
            .sum::<f64>()
            / (star_history.len() - recent_idx).max(1) as f64;

        let acceleration = if early_avg > 0.0 {
            (recent_avg - early_avg) / early_avg
        } else {
            0.0
        };

        if growth_rate > 50.0 && acceleration > 0.3 {
            "exploding".to_string()
        } else if growth_rate > 20.0 && acceleration > 0.1 {
            "strong_growth".to_string()
        } else if growth_rate > 5.0 {
            "steady_growth".to_string()
        } else if growth_rate > 1.0 {
            "slow_growth".to_string()
        } else if acceleration < -0.2 {
            "declining".to_string()
        } else {
            "stagnant".to_string()
        }
    }

    fn analyze_commit_trend(commit_activity: &[CommitActivityWeek]) -> (String, f64) {
        if commit_activity.len() < 4 {
            return ("insufficient_data".to_string(), 0.0);
        }

        let totals: Vec<f64> = commit_activity.iter().map(|w| w.total as f64).collect();
        let mean = totals.iter().sum::<f64>() / totals.len() as f64;

        let variance: f64 = totals.iter().map(|t| (t - mean).powi(2)).sum::<f64>() / totals.len() as f64;
        let std_dev = variance.sqrt();
        let consistency = if mean > 0.0 {
            (1.0 - (std_dev / mean).min(1.0)).max(0.0)
        } else {
            0.0
        };

        let half = commit_activity.len() / 2;
        let early_avg: f64 = totals[..half].iter().sum::<f64>() / half as f64;
        let recent_avg: f64 = totals[half..].iter().sum::<f64>() / (totals.len() - half) as f64;

        let trend = if early_avg > 0.0 {
            (recent_avg - early_avg) / early_avg
        } else if recent_avg > 0.0 {
            1.0
        } else {
            0.0
        };

        let label = if trend > 0.3 {
            "accelerating".to_string()
        } else if trend > 0.1 {
            "increasing".to_string()
        } else if trend > -0.1 {
            "stable".to_string()
        } else if trend > -0.3 {
            "decreasing".to_string()
        } else {
            "plummeting".to_string()
        };

        (label, consistency)
    }

    fn calc_issue_health(metrics: &IssueMetrics) -> f64 {
        let total = metrics.open_count + metrics.closed_count;
        if total == 0 {
            return 1.0;
        }

        let resolution_score = metrics.closed_count as f64 / total as f64;

        let stale_ratio = if total > 0 {
            metrics.stale_count as f64 / total as f64
        } else {
            0.0
        };
        let freshness_score = (1.0 - stale_ratio).max(0.0);

        let speed_score = if metrics.avg_resolution_hours > 0.0 {
            (1.0 - (metrics.avg_resolution_hours / 720.0).min(1.0)).max(0.0)
        } else {
            1.0
        };

        resolution_score * 0.4 + freshness_score * 0.35 + speed_score * 0.25
    }

    fn detect_anomalies(
        star_history: &[StarHistoryPoint],
        commit_activity: &[CommitActivityWeek],
        issue_metrics: &IssueMetrics,
    ) -> Vec<String> {
        let mut anomalies = Vec::new();

        if star_history.len() >= 4 {
            let counts: Vec<f64> = star_history.iter().map(|p| p.count as f64).collect();
            let mean = counts.iter().sum::<f64>() / counts.len() as f64;
            let variance: f64 =
                counts.iter().map(|c| (c - mean).powi(2)).sum::<f64>() / counts.len() as f64;
            let std_dev = variance.sqrt();

            for i in 1..counts.len() {
                let jump = counts[i] - counts[i - 1];
                if std_dev > 0.0 && jump > std_dev * 3.0 {
                    anomalies.push(format!(
                        "Star异常飙升: {} 单日增长 {} (>{:.0}σ)",
                        star_history[i].date,
                        jump as u32,
                        3.0
                    ));
                }
            }

            let recent_half = &counts[counts.len() / 2..];
            let recent_mean =
                recent_half.iter().sum::<f64>() / recent_half.len() as f64;
            if mean > 0.0 && recent_mean < mean * 0.3 {
                anomalies.push("Star增长近期显著放缓".to_string());
            }
        }

        if commit_activity.len() >= 8 {
            let recent_4: Vec<f64> = commit_activity[commit_activity.len() - 4..]
                .iter()
                .map(|w| w.total as f64)
                .collect();
            let recent_avg = recent_4.iter().sum::<f64>() / 4.0;

            let prev_4: Vec<f64> = commit_activity
                [commit_activity.len() - 8..commit_activity.len() - 4]
                .iter()
                .map(|w| w.total as f64)
                .collect();
            let prev_avg = prev_4.iter().sum::<f64>() / 4.0;

            if prev_avg > 0.0 && recent_avg < prev_avg * 0.2 {
                anomalies.push("提交活跃度骤降 (>80%)".to_string());
            }

            let zero_weeks = commit_activity.iter().filter(|w| w.total == 0).count();
            if zero_weeks >= 4 {
                anomalies.push(format!("近52周中有{}周零提交", zero_weeks));
            }
        }

        let total_issues = issue_metrics.open_count + issue_metrics.closed_count;
        if total_issues > 10 {
            let stale_ratio = issue_metrics.stale_count as f64 / total_issues as f64;
            if stale_ratio > 0.5 {
                anomalies.push(format!(
                    "Issue积压严重: {:.0}%为陈旧Issue (>180天)",
                    stale_ratio * 100.0
                ));
            }
        }

        if issue_metrics.open_count > 50
            && issue_metrics.closed_count > 0
            && issue_metrics.open_count as f64 / issue_metrics.closed_count as f64 > 5.0
        {
            anomalies.push("Issue开/关比严重失衡 (>5:1)".to_string());
        }

        anomalies
    }

    fn calc_health_score(
        star_growth_rate: f64,
        star_trend: &str,
        commit_consistency: f64,
        issue_health: f64,
        anomalies: &[String],
    ) -> f64 {
        let star_score = match star_trend {
            "exploding" => 25.0,
            "strong_growth" => 22.0,
            "steady_growth" => 18.0,
            "slow_growth" => 12.0,
            "declining" => 5.0,
            "stagnant" => 3.0,
            _ => 10.0,
        };

        let growth_bonus = (star_growth_rate / 10.0).min(5.0);

        let commit_score = commit_consistency * 25.0;

        let issue_score = issue_health * 25.0;

        let anomaly_penalty = (anomalies.len() as f64 * 5.0).min(20.0);

        let mut health = star_score + growth_bonus + commit_score + issue_score - anomaly_penalty;
        health = health.max(0.0).min(100.0);

        (health * 10.0).round() / 10.0
    }

    fn health_label(score: f64) -> String {
        if score >= 80.0 {
            "excellent".to_string()
        } else if score >= 65.0 {
            "good".to_string()
        } else if score >= 50.0 {
            "fair".to_string()
        } else if score >= 30.0 {
            "concerning".to_string()
        } else {
            "critical".to_string()
        }
    }
}

fn days_between(start: &str, end: &str) -> f64 {
    let s = chrono::NaiveDate::parse_from_str(start, "%Y-%m-%d");
    let e = chrono::NaiveDate::parse_from_str(end, "%Y-%m-%d");
    match (s, e) {
        (Ok(s), Ok(e)) => (e - s).num_days() as f64,
        _ => 0.0,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_star_history(counts: &[u32]) -> Vec<StarHistoryPoint> {
        counts
            .iter()
            .enumerate()
            .map(|(i, &c)| StarHistoryPoint {
                date: format!("2026-{:02}-{:02}", 1 + (i / 30) as u32, 1 + (i % 30) as u32),
                count: c,
            })
            .collect()
    }

    fn make_commit_activity(totals: &[u32]) -> Vec<CommitActivityWeek> {
        totals
            .iter()
            .enumerate()
            .map(|(i, &t)| CommitActivityWeek {
                week_start: format!("2026-W{:02}", i + 1),
                total: t,
                days: vec![t / 7; 7],
            })
            .collect()
    }

    #[test]
    fn test_star_growth_rate_linear() {
        let history = make_star_history(&[10, 20, 30, 40, 50]);
        let rate = TrendAnalyzer::calc_star_growth_rate(&history);
        assert!(rate > 0.0);
    }

    #[test]
    fn test_star_growth_rate_empty() {
        let rate = TrendAnalyzer::calc_star_growth_rate(&[]);
        assert_eq!(rate, 0.0);
    }

    #[test]
    fn test_classify_star_trend_exploding() {
        let history = make_star_history(&[10, 15, 25, 50, 100, 200]);
        let rate = TrendAnalyzer::calc_star_growth_rate(&history);
        let trend = TrendAnalyzer::classify_star_trend(&history, rate);
        assert!(trend == "exploding" || trend == "strong_growth");
    }

    #[test]
    fn test_classify_star_trend_stagnant() {
        let history = make_star_history(&[100, 100, 100, 100, 100]);
        let rate = TrendAnalyzer::calc_star_growth_rate(&history);
        let trend = TrendAnalyzer::classify_star_trend(&history, rate);
        assert_eq!(trend, "stagnant");
    }

    #[test]
    fn test_commit_trend_stable() {
        let activity = make_commit_activity(&[10, 12, 11, 10, 13, 11, 12, 10]);
        let (trend, consistency) = TrendAnalyzer::analyze_commit_trend(&activity);
        assert_eq!(trend, "stable");
        assert!(consistency > 0.8);
    }

    #[test]
    fn test_commit_trend_accelerating() {
        let activity = make_commit_activity(&[5, 6, 8, 10, 15, 20, 25, 30]);
        let (trend, _) = TrendAnalyzer::analyze_commit_trend(&activity);
        assert_eq!(trend, "accelerating");
    }

    #[test]
    fn test_issue_health_good() {
        let metrics = IssueMetrics {
            open_count: 5,
            closed_count: 95,
            avg_resolution_hours: 24.0,
            stale_count: 2,
        };
        let health = TrendAnalyzer::calc_issue_health(&metrics);
        assert!(health > 0.7);
    }

    #[test]
    fn test_issue_health_bad() {
        let metrics = IssueMetrics {
            open_count: 80,
            closed_count: 20,
            avg_resolution_hours: 500.0,
            stale_count: 40,
        };
        let health = TrendAnalyzer::calc_issue_health(&metrics);
        assert!(health < 0.5);
    }

    #[test]
    fn test_detect_anomalies_star_spike() {
        let history = make_star_history(&[10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 500, 500]);
        let activity = make_commit_activity(&[5; 17]);
        let metrics = IssueMetrics {
            open_count: 5,
            closed_count: 10,
            avg_resolution_hours: 48.0,
            stale_count: 1,
        };
        let anomalies = TrendAnalyzer::detect_anomalies(&history, &activity, &metrics);
        assert!(!anomalies.is_empty());
    }

    #[test]
    fn test_health_score_excellent() {
        let history = make_star_history(&[10, 20, 40, 80, 160]);
        let activity = make_commit_activity(&[20, 22, 25, 28, 30, 32, 35, 38]);
        let metrics = IssueMetrics {
            open_count: 3,
            closed_count: 50,
            avg_resolution_hours: 12.0,
            stale_count: 0,
        };
        let report = TrendAnalyzer::analyze("test/repo", &history, &activity, &metrics);
        assert!(report.health_score > 60.0);
    }

    #[test]
    fn test_full_analysis() {
        let history = make_star_history(&[5, 8, 12, 18, 25, 35, 48, 62]);
        let activity = make_commit_activity(&[8, 10, 9, 11, 12, 10, 11, 13]);
        let metrics = IssueMetrics {
            open_count: 10,
            closed_count: 40,
            avg_resolution_hours: 72.0,
            stale_count: 3,
        };
        let report = TrendAnalyzer::analyze("owner/name", &history, &activity, &metrics);
        assert_eq!(report.repo_full_name, "owner/name");
        assert!(!report.star_trend.is_empty());
        assert!(!report.commit_frequency_trend.is_empty());
        assert!(report.health_score >= 0.0 && report.health_score <= 100.0);
        assert!(!report.health_label.is_empty());
        assert!(!report.generated_at.is_empty());
    }
}
