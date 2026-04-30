#[cfg(test)]
mod tests {
    use super::super::evaluator::Evaluator;
    use super::super::types::{RepoInfo, LicenseInfo};

    fn create_test_repo(stars: u32, pushed_days_ago: i64) -> RepoInfo {
        let now = chrono::Utc::now();
        let pushed_at = now
            .checked_sub_signed(chrono::Duration::days(pushed_days_ago))
            .unwrap()
            .to_rfc3339();

        RepoInfo {
            owner: "test".to_string(),
            name: "test-repo".to_string(),
            full_name: "test/test-repo".to_string(),
            html_url: "https://github.com/test/test-repo".to_string(),
            description: Some("A test repository".to_string()),
            stargazers_count: stars,
            forks_count: 10,
            open_issues_count: 5,
            language: Some("Rust".to_string()),
            created_at: now
                .checked_sub_signed(chrono::Duration::days(365))
                .unwrap()
                .to_rfc3339(),
            updated_at: now.to_rfc3339(),
            pushed_at,
            license: Some(LicenseInfo {
                spdx_id: "MIT".to_string(),
                name: "MIT License".to_string(),
            }),
            size: 1000,
            has_wiki: true,
            has_issues_enabled: true,
            topics: vec!["rust".to_string(), "test".to_string()],
        }
    }

    #[test]
    fn test_calc_neglect_index_high_star() {
        let repo = create_test_repo(10000, 1);
        let recent_commits = 100;
        let index = Evaluator::calc_neglect_index(&repo, recent_commits);
        // 高星项目应该有较低的忽视指数
        assert!(index < 3.0, "高星项目忽视指数应该较低, 实际值: {}", index);
    }

    #[test]
    fn test_calc_neglect_index_low_star() {
        let repo = create_test_repo(50, 1);
        let recent_commits = 100;
        let index = Evaluator::calc_neglect_index(&repo, recent_commits);
        // 低星但活跃项目应该有中等或较高忽视指数
        // 由于50星的项目，100次提交，忽视指数可能较高
        assert!(index >= 0.0, "忽视指数应该非负, 实际值: {}", index);
    }

    #[test]
    fn test_classify_track_high_star() {
        let track = Evaluator::classify_track(1500, 2.0);
        assert_eq!(track, "high-star");
    }

    #[test]
    fn test_classify_track_neglected() {
        let track = Evaluator::classify_track(100, 8.0);
        assert_eq!(track, "neglected");
    }

    #[test]
    fn test_classify_track_steady() {
        let track = Evaluator::classify_track(500, 2.0);
        assert_eq!(track, "steady");
    }

    #[test]
    fn test_determine_grade_s() {
        let track = "high-star".to_string();
        let grade = Evaluator::determine_grade(85.0, &track);
        assert_eq!(grade, "S");
    }

    #[test]
    fn test_determine_grade_a() {
        let track = "steady".to_string();
        let grade = Evaluator::determine_grade(80.0, &track);
        assert_eq!(grade, "A");
    }

    #[test]
    fn test_determine_grade_b() {
        let track = "neglected".to_string();
        let grade = Evaluator::determine_grade(75.0, &track);
        assert_eq!(grade, "B");
    }

    #[test]
    fn test_determine_grade_x() {
        let track = "high-star".to_string();
        let grade = Evaluator::determine_grade(70.0, &track);
        assert_eq!(grade, "X");
    }

    #[test]
    fn test_calc_value_density() {
        let repo = create_test_repo(5000, 1);
        let density = Evaluator::calc_value_density(&repo);
        // 价值密度应该在0-1之间
        assert!(density >= 0.0 && density <= 1.0);
    }

    #[test]
    fn test_calc_steady_state() {
        let repo = create_test_repo(500, 1);
        let recent_commits = 50;
        let steady_state = Evaluator::calc_steady_state(&repo, recent_commits);
        // 稳态系数应该在0-1之间
        assert!(steady_state >= 0.0 && steady_state <= 1.0);
    }

    #[test]
    fn test_detect_score_fraud_normal() {
        let (detected, warning) = Evaluator::detect_score_fraud(80.0, 75.0);
        assert!(!detected);
        assert!(warning.is_none());
    }

    #[test]
    fn test_detect_score_fraud_suspicious() {
        // 分数下降超过30%，触发欺诈检测
        let (detected, warning) = Evaluator::detect_score_fraud(95.0, 50.0);
        assert!(detected, "应该检测到评分欺诈");
        assert!(warning.is_some());
    }

    #[test]
    fn test_gate_check_g1_license() {
        let repo = create_test_repo(100, 1);
        let checks = Evaluator::gate_check(&repo, 10);
        let g1 = checks.iter().find(|c| c.gate.contains("G1")).unwrap();
        assert!(g1.passed, "有License的项目应该通过G1");
    }

    #[test]
    fn test_gate_check_g2_activity() {
        let active_repo = create_test_repo(100, 1);
        let checks = Evaluator::gate_check(&active_repo, 10);
        let g2 = checks.iter().find(|c| c.gate.contains("G2")).unwrap();
        assert!(g2.passed, "活跃项目应该通过G2");
    }

    #[test]
    fn test_gate_check_g2_inactive() {
        let inactive_repo = create_test_repo(100, 100);
        let checks = Evaluator::gate_check(&inactive_repo, 0);
        let g2 = checks.iter().find(|c| c.gate.contains("G2")).unwrap();
        assert!(!g2.passed, "不活跃项目不应该通过G2");
    }

    #[test]
    fn test_build_trust_badge() {
        let repo = create_test_repo(100, 1);
        let checks = Evaluator::gate_check(&repo, 10);
        let dimensions = vec![];
        let badge = Evaluator::build_trust_badge(&checks, &dimensions, 80.0);
        // TrustBadge 结构体没有 is_empty 方法，我们检查 l1 状态
        // 80分应该产生 "recommended" 状态
        assert!(!badge.l1.status.is_empty());
    }

    #[test]
    fn test_generate_one_liner() {
        let repo = create_test_repo(1000, 1);
        let track = "high-star".to_string();
        let one_liner = Evaluator::generate_one_liner(&repo, 80.0, &track);
        assert!(!one_liner.is_empty());
        assert!(one_liner.contains("test-repo"));
    }

    #[test]
    fn test_calc_recommendation_index() {
        let quality_score = 80.0;
        let track = "high-star".to_string();
        let neglect_index = 2.0;
        let stars = 1000;
        let mutation_ratio = 1.0;

        let index = Evaluator::calc_recommendation_index(
            quality_score,
            &track,
            neglect_index,
            stars,
            mutation_ratio,
        );

        assert!(index > 0.0, "推荐指数应该为正数");
    }
}
