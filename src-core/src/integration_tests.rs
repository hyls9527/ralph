#[cfg(test)]
mod integration_tests {
    use crate::evaluator::*;
    use crate::types::*;
    use crate::database::Database;

    fn mock_repo() -> RepoInfo {
        tests_helper::mock_repo()
    }

    fn test_db() -> Database {
        Database::new(":memory:").expect("Failed to create in-memory database")
    }

    fn build_mock_report(full_name: &str, score: f64, grade: &str, track: &str) -> EvaluationReport {
        let mut repo = mock_repo();
        repo.full_name = full_name.to_string();
        repo.owner = full_name.split('/').next().unwrap_or("test").to_string();
        repo.name = full_name.split('/').last().unwrap_or("repo").to_string();
        let (dimensions, _, _, _) = Evaluator::run_pipeline(&repo, 10, &["L1"; 6]);
        let gate_checks = Evaluator::gate_check(&repo, 10);
        let trust_badge = Evaluator::build_trust_badge(&gate_checks, &dimensions, score);
        EvaluationReport {
            repo,
            one_liner: format!("{} | {}级", full_name, grade),
            track: track.to_string(),
            grade: grade.to_string(),
            total_score: score,
            recommendation_index: 10.0,
            dimensions,
            gate_checks,
            neglect_index: 5.0,
            value_density: Some(1.0),
            steady_state: Some(0.5),
            trust_badge,
            evidence_level: "L1".to_string(),
            veto_flags: vec![],
            confidence_tier: "tier1-core".to_string(),
            decision_trail: vec![],
        }
    }

    // ===== 边界条件测试 =====

    #[test]
    fn test_max_stars_repo() {
        let mut repo = mock_repo();
        repo.stargazers_count = u32::MAX;
        repo.forks_count = u32::MAX / 2;
        let (dims, _, _, _) = Evaluator::run_pipeline(&repo, 100, &["L1"; 6]);
        let total: f64 = dims.iter().map(|d| d.score).sum();
        assert!(total >= 0.0 && total <= 105.0);
    }

    #[test]
    fn test_empty_description_repo() {
        let mut repo = mock_repo();
        repo.description = None;
        repo.topics = vec![];
        let (dims, _, trail, tier) = Evaluator::run_pipeline(&repo, 5, &["L1"; 6]);
        assert_eq!(tier, ConfidenceTier::Tier3);
        let total: f64 = dims.iter().map(|d| d.score).sum();
        assert!(total >= 0.0);
        assert!(trail.len() >= 5);
    }

    #[test]
    fn test_future_created_date() {
        let mut repo = mock_repo();
        repo.created_at = "2099-01-01T00:00:00Z".to_string();
        let (dims, _, _, _) = Evaluator::run_pipeline(&repo, 5, &["L1"; 6]);
        let total: f64 = dims.iter().map(|d| d.score).sum();
        assert!(total >= 0.0);
    }

    #[test]
    fn test_very_old_repo() {
        let mut repo = mock_repo();
        repo.created_at = "2000-01-01T00:00:00Z".to_string();
        repo.updated_at = "2024-01-01T00:00:00Z".to_string();
        repo.pushed_at = "2024-01-01T00:00:00Z".to_string();
        let (dims, _, _, _) = Evaluator::run_pipeline(&repo, 50, &["L1"; 6]);
        let total: f64 = dims.iter().map(|d| d.score).sum();
        assert!(total >= 0.0);
    }

    #[test]
    fn test_no_language_no_topics() {
        let mut repo = mock_repo();
        repo.language = None;
        repo.topics = vec![];
        repo.description = Some("".to_string());
        let (dims, _, _, _) = Evaluator::run_pipeline(&repo, 5, &["L1"; 6]);
        let total: f64 = dims.iter().map(|d| d.score).sum();
        assert!(total >= 0.0 && total <= 105.0);
    }

    #[test]
    fn test_size_zero_repo() {
        let mut repo = mock_repo();
        repo.size = 0;
        let (dims, _, _, _) = Evaluator::run_pipeline(&repo, 5, &["L1"; 6]);
        let total: f64 = dims.iter().map(|d| d.score).sum();
        assert!(total >= 0.0);
    }

    // ===== 多机制联动测试 =====

    #[test]
    fn test_combined_evidence_and_bayesian() {
        let mut dims = vec![
            DimensionScore { dimension: "质量".to_string(), score: 18.0, max_score: 20.0, sub_scores: vec![] },
            DimensionScore { dimension: "安全".to_string(), score: 16.0, max_score: 20.0, sub_scores: vec![] },
        ];
        let _warnings = Evaluator::apply_evidence_threshold(&mut dims, &["L4"]);
        Evaluator::apply_bayesian_correction(&mut dims, &["L4"]);
        assert!(dims[0].score < 18.0);
        assert!(dims[1].score < 16.0);
    }

    #[test]
    fn test_combined_ceiling_and_cross_validation() {
        let mut dims = vec![
            DimensionScore { dimension: "质量".to_string(), score: 18.0, max_score: 20.0, sub_scores: vec![] },
            DimensionScore { dimension: "实用".to_string(), score: 22.0, max_score: 25.0, sub_scores: vec![] },
            DimensionScore { dimension: "维护".to_string(), score: 12.0, max_score: 15.0, sub_scores: vec![] },
        ];
        let subs = vec![
            vec![("项目结构".to_string(), 4.0, 5.0), ("测试覆盖".to_string(), 0.0, 5.0), ("CI/CD".to_string(), 2.0, 5.0)],
            vec![],
            vec![],
            vec![],
            vec![],
            vec![],
        ];
        Evaluator::apply_ceiling(&mut dims, &subs);
        Evaluator::apply_cross_validation(&mut dims, &subs);
        assert!(dims[1].score <= 10.0);
    }

    #[test]
    fn test_full_pipeline_with_all_anti_gaming() {
        let mut repo = mock_repo();
        repo.stargazers_count = 10000;
        repo.forks_count = 5;
        repo.size = 200;
        let (dims, _, trail, tier) = Evaluator::run_pipeline(&repo, 10, &["L4"; 6]);
        let total: f64 = dims.iter().map(|d| d.score).sum();
        assert!(total >= 0.0 && total <= 105.0);
        assert!(trail.len() >= 5);
        assert_eq!(tier, ConfidenceTier::Tier3);
    }

    // ===== 异常场景测试 =====

    #[test]
    fn test_all_dimensions_zero_score() {
        let mut repo = mock_repo();
        repo.stargazers_count = 0;
        repo.forks_count = 0;
        repo.open_issues_count = 0;
        repo.size = 0;
        repo.language = None;
        repo.license = None;
        repo.topics = vec![];
        repo.description = None;
        let (dims, _, _, _) = Evaluator::run_pipeline(&repo, 0, &["L5"; 6]);
        for dim in &dims {
            assert!(dim.score >= 0.0, "Score should be non-negative for dimension {}", dim.dimension);
        }
    }

    #[test]
    fn test_recommendation_index_extreme_neglect() {
        let mut repo = mock_repo();
        repo.stargazers_count = 1;
        repo.size = 5000;
        let idx = Evaluator::calc_recommendation_index(80.0, "neglected", 100.0, 1, 0.0);
        assert!(idx > 80.0);
    }

    #[test]
    fn test_recommendation_index_zero_score() {
        let idx_neglected = Evaluator::calc_recommendation_index(0.0, "neglected", 10.0, 100, 0.0);
        assert_eq!(idx_neglected, 0.0);
        let idx_high_star = Evaluator::calc_recommendation_index(0.0, "high-star", 0.0, 5000, 0.0);
        assert_eq!(idx_high_star, 0.0);
        let idx_steady = Evaluator::calc_recommendation_index(0.0, "steady", 0.0, 300, 0.0);
        assert_eq!(idx_steady, 0.0);
    }

    #[test]
    fn test_detect_score_fraud_exact_boundary() {
        let (detected, _) = Evaluator::detect_score_fraud(100.0, 70.0);
        assert!(!detected);
        let (detected, _) = Evaluator::detect_score_fraud(100.0, 69.99);
        assert!(detected);
    }

    #[test]
    fn test_score_fraud_with_modification() {
        let (detected, warning) = Evaluator::detect_score_fraud(100.0, 60.0);
        assert!(detected);
        assert!(warning.is_some());
        let w = warning.unwrap();
        assert!(w.contains("评分欺诈"));
        assert!(w.contains("40.0"));
    }

    #[test]
    fn test_openssf_calibration_zero_scorecard() {
        let mut dims = vec![
            DimensionScore { dimension: "安全".to_string(), score: 10.0, max_score: 20.0, sub_scores: vec![] },
        ];
        let warnings = Evaluator::apply_openssf_calibration(&mut dims, 0.0);
        let f_rate = 10.0 / 20.0;
        if f_rate > 0.0 * 1.2 {
            assert!(!warnings.is_empty());
            assert!(dims[0].score < 10.0);
        }
    }

    // ===== 数据库边界条件 =====

    #[test]
    fn test_db_cache_and_retrieve() {
        let db = test_db();
        let report = build_mock_report("test/cache-integration", 82.0, "A", "steady");
        db.cache_evaluation(&report).unwrap();
        let cached = db.get_cached("test/cache-integration").unwrap();
        assert!(cached.is_some());
        assert!((cached.unwrap().total_score - 82.0).abs() < 0.1);
    }

    #[test]
    fn test_db_search_history() {
        let db = test_db();
        db.log_search("", 0).unwrap();
        let history = db.get_search_history(10).unwrap();
        assert_eq!(history.len(), 1);
    }

    #[test]
    fn test_db_favorites_duplicate_add() {
        let db = test_db();
        let report = build_mock_report("test/fav-dup", 75.0, "B", "steady");
        let json = serde_json::to_string(&report).unwrap();
        db.add_favorite("test/fav-dup", &json).unwrap();
        db.add_favorite("test/fav-dup", &json).unwrap();
        assert!(db.is_favorite("test/fav-dup").unwrap());
    }

    #[test]
    fn test_db_evaluation_history_via_cache() {
        let db = test_db();
        for i in 0..10 {
            let mut report = build_mock_report("test/history-multi", 70.0 + i as f64, "A", "steady");
            report.total_score = 70.0 + i as f64;
            db.cache_evaluation(&report).unwrap();
        }
        let history = db.get_evaluation_history("test/history-multi", 100).unwrap();
        assert_eq!(history.len(), 10);
    }

    #[test]
    fn test_db_score_trend_calculation() {
        let db = test_db();
        let trend = db.get_score_trend("test/trend-integration").unwrap();
        assert!(trend.is_empty());

        let r1 = build_mock_report("test/trend-integration", 70.0, "B", "steady");
        db.cache_evaluation(&r1).unwrap();
        let r2 = build_mock_report("test/trend-integration", 75.0, "A", "steady");
        db.cache_evaluation(&r2).unwrap();
        let r3 = build_mock_report("test/trend-integration", 80.0, "S", "steady");
        db.cache_evaluation(&r3).unwrap();

        let trend = db.get_score_trend("test/trend-integration").unwrap();
        assert_eq!(trend.len(), 3);
    }

    // ===== 轨道分类边界 =====

    #[test]
    fn test_track_classification_boundary_neglected() {
        assert_eq!(Evaluator::classify_track(100, 10.0), "neglected");
    }

    #[test]
    fn test_track_classification_boundary_high_star() {
        assert_eq!(Evaluator::classify_track(5000, 2.0), "high-star");
    }

    #[test]
    fn test_track_classification_at_star_boundary() {
        assert_eq!(Evaluator::classify_track(2000, 10.0), "neglected");
        assert_eq!(Evaluator::classify_track(2001, 2.0), "high-star");
    }

    #[test]
    fn test_track_classification_at_neglect_boundary() {
        assert_eq!(Evaluator::classify_track(500, 4.99), "steady");
        assert_eq!(Evaluator::classify_track(500, 5.0), "neglected");
    }

    // ===== 等级判定边界 =====

    #[test]
    fn test_grade_boundary_exact_values() {
        assert_eq!(Evaluator::determine_grade(84.0, "neglected"), "S");
        assert_eq!(Evaluator::determine_grade(83.9, "neglected"), "A");
        assert_eq!(Evaluator::determine_grade(79.0, "neglected"), "A");
        assert_eq!(Evaluator::determine_grade(78.9, "neglected"), "B");
        assert_eq!(Evaluator::determine_grade(73.0, "neglected"), "B");
        assert_eq!(Evaluator::determine_grade(72.9, "neglected"), "X");
    }

    #[test]
    fn test_grade_high_star_boundary() {
        assert_eq!(Evaluator::determine_grade(84.0, "high-star"), "S");
        assert_eq!(Evaluator::determine_grade(83.9, "high-star"), "A");
        assert_eq!(Evaluator::determine_grade(79.0, "high-star"), "A");
        assert_eq!(Evaluator::determine_grade(78.9, "high-star"), "B");
        assert_eq!(Evaluator::determine_grade(73.0, "high-star"), "B");
        assert_eq!(Evaluator::determine_grade(72.9, "high-star"), "X");
    }

    #[test]
    fn test_grade_steady_boundary() {
        assert_eq!(Evaluator::determine_grade(79.0, "steady"), "A");
        assert_eq!(Evaluator::determine_grade(78.9, "steady"), "B");
        assert_eq!(Evaluator::determine_grade(73.0, "steady"), "B");
        assert_eq!(Evaluator::determine_grade(72.9, "steady"), "X");
    }

    // ===== 忽视指数深度测试 =====

    #[test]
    fn test_neglect_index_high_star_low_forks() {
        let mut repo = mock_repo();
        repo.stargazers_count = 1000;
        repo.forks_count = 2;
        let idx = Evaluator::calc_neglect_index(&repo, 10);
        assert!(idx >= 0.0);
    }

    #[test]
    fn test_neglect_index_small_project_active() {
        let mut repo = mock_repo();
        repo.stargazers_count = 50;
        repo.forks_count = 3;
        repo.size = 500;
        let idx = Evaluator::calc_neglect_index(&repo, 20);
        assert!(idx >= 0.0);
    }

    // ===== 价值密度深度测试 =====

    #[test]
    fn test_value_density_very_old_high_star() {
        let mut repo = mock_repo();
        repo.stargazers_count = 100000;
        repo.created_at = "2015-01-01T00:00:00Z".to_string();
        let vd = Evaluator::calc_value_density(&repo);
        assert!(vd > 0.0);
        assert!(vd <= 1.5);
    }

    #[test]
    fn test_value_density_new_low_star() {
        let mut repo = mock_repo();
        repo.stargazers_count = 10;
        repo.created_at = "2024-12-01T00:00:00Z".to_string();
        let vd = Evaluator::calc_value_density(&repo);
        assert!(vd > 0.0);
    }

    // ===== 稳态系数深度测试 =====

    #[test]
    fn test_steady_state_highly_active() {
        let mut repo = mock_repo();
        repo.stargazers_count = 200;
        repo.forks_count = 30;
        let ss = Evaluator::calc_steady_state(&repo, 50);
        assert!(ss > 0.0);
        assert!(ss <= 1.0);
    }

    #[test]
    fn test_steady_state_inactive_medium_star() {
        let mut repo = mock_repo();
        repo.stargazers_count = 300;
        repo.forks_count = 5;
        let ss = Evaluator::calc_steady_state(&repo, 0);
        assert!(ss < 0.1);
    }

    // ===== 异常检测深度测试 =====

    #[test]
    fn test_anomaly_detection_high_star_low_quality() {
        let mut repo = mock_repo();
        repo.stargazers_count = 50000;
        repo.forks_count = 100;
        repo.size = 100;
        let dims = vec![
            DimensionScore { dimension: "质量".to_string(), score: 5.0, max_score: 20.0, sub_scores: vec![] },
            DimensionScore { dimension: "维护".to_string(), score: 3.0, max_score: 15.0, sub_scores: vec![] },
            DimensionScore { dimension: "实用".to_string(), score: 5.0, max_score: 25.0, sub_scores: vec![] },
            DimensionScore { dimension: "文档".to_string(), score: 2.0, max_score: 15.0, sub_scores: vec![] },
            DimensionScore { dimension: "社区".to_string(), score: 3.0, max_score: 10.0, sub_scores: vec![] },
            DimensionScore { dimension: "安全".to_string(), score: 5.0, max_score: 20.0, sub_scores: vec![] },
        ];
        let result = Evaluator::detect_anomalies(&dims, &repo, 5, 100);
        assert!(result.has_anomaly);
    }

    #[test]
    fn test_anomaly_detection_normal_project() {
        let repo = mock_repo();
        let dims = vec![
            DimensionScore { dimension: "质量".to_string(), score: 15.0, max_score: 20.0, sub_scores: vec![] },
            DimensionScore { dimension: "维护".to_string(), score: 10.0, max_score: 15.0, sub_scores: vec![] },
            DimensionScore { dimension: "实用".to_string(), score: 18.0, max_score: 25.0, sub_scores: vec![] },
            DimensionScore { dimension: "文档".to_string(), score: 10.0, max_score: 15.0, sub_scores: vec![] },
            DimensionScore { dimension: "社区".to_string(), score: 6.0, max_score: 10.0, sub_scores: vec![] },
            DimensionScore { dimension: "安全".to_string(), score: 15.0, max_score: 20.0, sub_scores: vec![] },
        ];
        let result = Evaluator::detect_anomalies(&dims, &repo, 20, 5);
        assert!(!result.has_anomaly);
    }

    // ===== 门控检查组合测试 =====

    #[test]
    fn test_gate_check_all_fail() {
        let mut repo = mock_repo();
        repo.license = None;
        repo.size = 10;
        let checks = Evaluator::gate_check(&repo, 0);
        let g1 = checks.iter().find(|c| c.gate == "G1: 有效开源协议").unwrap();
        assert!(!g1.passed);
        let g2 = checks.iter().find(|c| c.gate == "G2: 项目存活").unwrap();
        assert!(!g2.passed);
        let g4 = checks.iter().find(|c| c.gate == "G4: 非空壳").unwrap();
        assert!(!g4.passed);
    }

    #[test]
    fn test_gate_check_partial_pass() {
        let mut repo = mock_repo();
        repo.size = 10;
        let checks = Evaluator::gate_check(&repo, 5);
        let g1 = checks.iter().find(|c| c.gate == "G1: 有效开源协议").unwrap();
        assert!(g1.passed);
        let g2 = checks.iter().find(|c| c.gate == "G2: 项目存活").unwrap();
        assert!(g2.passed);
        let g4 = checks.iter().find(|c| c.gate == "G4: 非空壳").unwrap();
        assert!(!g4.passed);
    }

    // ===== 一句话推荐测试 =====

    #[test]
    fn test_one_liner_high_star_track() {
        let repo = mock_repo();
        let liner = Evaluator::generate_one_liner(&repo, 85.0, "high-star");
        assert!(liner.contains("热门项目"));
    }

    #[test]
    fn test_one_liner_steady_track() {
        let repo = mock_repo();
        let liner = Evaluator::generate_one_liner(&repo, 80.0, "steady");
        assert!(liner.contains("稳态优质"));
    }

    #[test]
    fn test_one_liner_low_score() {
        let repo = mock_repo();
        let liner = Evaluator::generate_one_liner(&repo, 60.0, "steady");
        assert!(liner.contains("不推荐"));
    }

    // ===== 维度评分完整性测试 =====

    #[test]
    fn test_dimension_scores_all_within_bounds() {
        let repo = mock_repo();
        let (dims, _) = Evaluator::score_dimensions(&repo, 10);
        for dim in &dims {
            assert!(dim.score >= 0.0, "{} score should be >= 0", dim.dimension);
            assert!(dim.score <= dim.max_score, "{} score {} should be <= max {}", dim.dimension, dim.score, dim.max_score);
        }
    }

    #[test]
    fn test_dimension_sub_scores_sum_matches() {
        let repo = mock_repo();
        let (dims, sub_scores) = Evaluator::score_dimensions(&repo, 10);
        for (i, dim) in dims.iter().enumerate() {
            let sub_sum: f64 = sub_scores[i].iter().map(|(_, s, _)| *s).sum();
            assert!(
                (dim.score - sub_sum).abs() < 0.01,
                "Dimension {} score {} != sub_scores sum {}",
                dim.dimension, dim.score, sub_sum
            );
        }
    }

    // ===== 数据库批量操作测试 =====

    #[test]
    fn test_db_batch_cache_and_retrieve() {
        let db = test_db();
        for i in 0..50 {
            let mut report = build_mock_report(&format!("test/repo-{}", i), 70.0 + i as f64, "A", "steady");
            report.total_score = 70.0 + i as f64;
            db.cache_evaluation(&report).unwrap();
        }
        let cached = db.get_cached("test/repo-25").unwrap();
        assert!(cached.is_some());
        assert!((cached.unwrap().total_score - 95.0).abs() < 0.1);
    }

    // ===== 搜索历史管理测试 =====

    #[test]
    fn test_db_search_history_ordering() {
        let db = test_db();
        db.log_search("first", 5).unwrap();
        db.log_search("second", 10).unwrap();
        db.log_search("third", 15).unwrap();
        let history = db.get_search_history(10).unwrap();
        assert_eq!(history.len(), 3);
        assert_eq!(history[0]["query"], "third");
    }

    #[test]
    fn test_db_search_history_duplicate_queries() {
        let db = test_db();
        db.log_search("same query", 5).unwrap();
        db.log_search("same query", 10).unwrap();
        let history = db.get_search_history(10).unwrap();
        assert_eq!(history.len(), 2);
    }

    // ===== 评估历史趋势测试 =====

    #[test]
    fn test_db_evaluation_history_trend_direction() {
        let db = test_db();
        let r1 = build_mock_report("test/trend-dir", 60.0, "B", "steady");
        db.cache_evaluation(&r1).unwrap();
        let r2 = build_mock_report("test/trend-dir", 70.0, "B", "steady");
        db.cache_evaluation(&r2).unwrap();
        let r3 = build_mock_report("test/trend-dir", 80.0, "A", "steady");
        db.cache_evaluation(&r3).unwrap();
        let trend = db.get_score_trend("test/trend-dir").unwrap();
        assert_eq!(trend.len(), 3);
    }

    // ===== 虚拟滚动边界测试 =====

    #[test]
    fn test_empty_dimensions_pipeline() {
        let repo = mock_repo();
        let (dims, _, _, _) = Evaluator::run_pipeline(&repo, 0, &["L1"; 6]);
        assert_eq!(dims.len(), 6);
        for dim in &dims {
            assert!(dim.score >= 0.0);
        }
    }

    // ===== 一票否决项边界测试 =====

    #[test]
    fn test_veto_on_dead_project() {
        let repo = mock_repo();
        let checks = Evaluator::gate_check(&repo, 0);
        let g2 = checks.iter().find(|c| c.gate == "G2: 项目存活").unwrap();
        assert!(!g2.passed);
        assert!(g2.reason.is_some());
    }

    #[test]
    fn test_veto_on_no_license() {
        let mut repo = mock_repo();
        repo.license = None;
        let checks = Evaluator::gate_check(&repo, 10);
        let g1 = checks.iter().find(|c| c.gate == "G1: 有效开源协议").unwrap();
        assert!(!g1.passed);
        assert!(g1.reason.is_some());
    }

    // ===== OpenSSF 校准深度测试 =====

    #[test]
    fn test_openssf_calibration_boundary() {
        let mut dims = vec![
            DimensionScore { dimension: "安全".to_string(), score: 16.0, max_score: 20.0, sub_scores: vec![] },
        ];
        let f_rate = 16.0 / 20.0;
        let scorecard_rate = f_rate / 1.2 - 0.01;
        let warnings = Evaluator::apply_openssf_calibration(&mut dims, scorecard_rate);
        assert!(!warnings.is_empty());
        assert!(dims[0].score < 16.0);
    }

    #[test]
    fn test_openssf_calibration_no_security_dim() {
        let mut dims = vec![
            DimensionScore { dimension: "质量".to_string(), score: 15.0, max_score: 20.0, sub_scores: vec![] },
        ];
        let warnings = Evaluator::apply_openssf_calibration(&mut dims, 0.3);
        assert!(warnings.is_empty());
        assert!((dims[0].score - 15.0).abs() < 0.01);
    }

    // ===== 突变检测深度测试 =====

    #[test]
    fn test_mutation_detection_high_ratio() {
        let mut dims = vec![
            DimensionScore { dimension: "维护".to_string(), score: 10.0, max_score: 15.0, sub_scores: vec![] },
        ];
        let warnings = Evaluator::apply_mutation_detection(&mut dims, 200);
        if !warnings.is_empty() {
            assert!(dims[0].score < 10.0);
        }
    }

    #[test]
    fn test_mutation_detection_zero_commits() {
        let mut dims = vec![
            DimensionScore { dimension: "维护".to_string(), score: 10.0, max_score: 15.0, sub_scores: vec![] },
        ];
        let before = dims[0].score;
        let warnings = Evaluator::apply_mutation_detection(&mut dims, 0);
        assert!(warnings.is_empty());
        assert!((dims[0].score - before).abs() < 0.01);
    }

    // ===== 大象因子深度测试 =====

    #[test]
    fn test_elephant_factor_high_concentration() {
        let mut repo = mock_repo();
        repo.stargazers_count = 1000;
        repo.forks_count = 50;
        let mut dims = vec![
            DimensionScore { dimension: "社区".to_string(), score: 8.0, max_score: 10.0, sub_scores: vec![] },
        ];
        let warnings = Evaluator::apply_elephant_factor(&mut dims, &repo, 10);
        if !warnings.is_empty() {
            assert!(dims[0].score < 8.0);
        }
    }

    #[test]
    fn test_elephant_factor_zero_commits() {
        let repo = mock_repo();
        let mut dims = vec![
            DimensionScore { dimension: "社区".to_string(), score: 8.0, max_score: 10.0, sub_scores: vec![] },
        ];
        let before = dims[0].score;
        let warnings = Evaluator::apply_elephant_factor(&mut dims, &repo, 0);
        assert!(warnings.is_empty());
        assert!((dims[0].score - before).abs() < 0.01);
    }

    // ===== 声明可信度深度测试 =====

    #[test]
    fn test_declaration_credibility_no_topics_no_description() {
        let mut repo = mock_repo();
        repo.topics = vec![];
        repo.description = None;
        let mut dims = vec![
            DimensionScore { dimension: "实用".to_string(), score: 20.0, max_score: 25.0, sub_scores: vec![] },
        ];
        let (disqualified, warnings) = Evaluator::apply_declaration_credibility(&mut dims, &repo);
        assert!(disqualified);
        assert!(!warnings.is_empty());
        assert!(dims[0].score < 20.0);
    }

    #[test]
    fn test_declaration_credibility_with_topics_and_description() {
        let repo = mock_repo();
        let mut dims = vec![
            DimensionScore { dimension: "实用".to_string(), score: 20.0, max_score: 25.0, sub_scores: vec![] },
        ];
        let before = dims[0].score;
        let (disqualified, warnings) = Evaluator::apply_declaration_credibility(&mut dims, &repo);
        assert!(!disqualified);
        assert!(warnings.is_empty());
        assert!((dims[0].score - before).abs() < 0.01);
    }

    // ===== 数据库清理测试 =====

    #[test]
    fn test_db_prune_evaluation_history() {
        let db = test_db();
        for i in 0..10 {
            let report = build_mock_report("test/prune-integration", 70.0 + i as f64, "A", "steady");
            db.cache_evaluation(&report).unwrap();
        }
        let before = db.get_evaluation_history("test/prune-integration", 100).unwrap();
        assert_eq!(before.len(), 10);
        db.prune_evaluation_history("test/prune-integration", 3).unwrap();
        let after = db.get_evaluation_history("test/prune-integration", 100).unwrap();
        assert_eq!(after.len(), 3);
    }

    // ===== 搜索历史清理测试 =====

    #[test]
    fn test_db_clear_search_history() {
        let db = test_db();
        db.log_search("query1", 5).unwrap();
        db.log_search("query2", 10).unwrap();
        assert_eq!(db.get_search_history(10).unwrap().len(), 2);
        db.clear_search_history().unwrap();
        assert_eq!(db.get_search_history(10).unwrap().len(), 0);
    }

    // ===== 收藏管理测试 =====

    #[test]
    fn test_db_add_remove_favorite() {
        let db = test_db();
        let report = build_mock_report("test/fav-manage", 80.0, "A", "steady");
        let json = serde_json::to_string(&report).unwrap();
        assert!(!db.is_favorite("test/fav-manage").unwrap());
        db.add_favorite("test/fav-manage", &json).unwrap();
        assert!(db.is_favorite("test/fav-manage").unwrap());
        db.remove_favorite("test/fav-manage").unwrap();
        assert!(!db.is_favorite("test/fav-manage").unwrap());
    }

    // ===== 评分范围全谱测试 =====

    #[test]
    fn test_score_spectrum_all_tracks() {
        let scores = [0.0, 50.0, 72.9, 73.0, 78.9, 79.0, 83.9, 84.0, 100.0, 105.0];
        for &score in &scores {
            let g1 = Evaluator::determine_grade(score, "neglected");
            let g2 = Evaluator::determine_grade(score, "high-star");
            let g3 = Evaluator::determine_grade(score, "steady");
            assert!(["S", "A", "B", "X"].contains(&g1.as_str()));
            assert!(["S", "A", "B", "X"].contains(&g2.as_str()));
            assert!(["A", "B", "X"].contains(&g3.as_str()));
        }
    }

    // ===== 决策链完整性测试 =====

    #[test]
    fn test_decision_trail_completeness_tier3() {
        let mut repo = mock_repo();
        repo.description = None;
        let (_, _, trail, _) = Evaluator::run_pipeline(&repo, 10, &["L1"; 6]);
        let step_names: Vec<&str> = trail.iter().map(|s| s.step.as_str()).collect();
        assert!(step_names.contains(&"证据门槛"));
        assert!(step_names.contains(&"贝叶斯修正"));
        assert!(step_names.contains(&"突变检测"));
        assert!(step_names.contains(&"大象因子"));
        assert!(step_names.contains(&"声明可信度"));
        assert!(step_names.contains(&"基础项天花板"));
        assert!(step_names.contains(&"维度交叉校验"));
    }

    // ===== TrustBadge 构建测试 =====

    #[test]
    fn test_trust_badge_recommended() {
        let repo = mock_repo();
        let (dims, _) = Evaluator::score_dimensions(&repo, 10);
        let gate_checks = Evaluator::gate_check(&repo, 10);
        let badge = Evaluator::build_trust_badge(&gate_checks, &dims, 80.0);
        assert_eq!(badge.l1.status, "recommended");
        assert_eq!(badge.level, 2);
        assert!(badge.l2.is_some());
    }

    #[test]
    fn test_trust_badge_caution() {
        let repo = mock_repo();
        let (dims, _) = Evaluator::score_dimensions(&repo, 10);
        let gate_checks = Evaluator::gate_check(&repo, 10);
        let badge = Evaluator::build_trust_badge(&gate_checks, &dims, 60.0);
        assert_eq!(badge.l1.status, "caution");
    }

    #[test]
    fn test_trust_badge_not_recommended() {
        let repo = mock_repo();
        let (dims, _) = Evaluator::score_dimensions(&repo, 10);
        let gate_checks = Evaluator::gate_check(&repo, 10);
        let badge = Evaluator::build_trust_badge(&gate_checks, &dims, 40.0);
        assert_eq!(badge.l1.status, "not-recommended");
    }
}
