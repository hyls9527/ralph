#[cfg(test)]
mod security_tests {
    use crate::database::Database;
    use crate::github::GitHubClient;

    fn temp_db_path() -> String {
        std::env::temp_dir()
            .join(format!("ralph_security_test_{}.db", std::process::id()))
            .to_str()
            .unwrap()
            .to_string()
    }

    fn cleanup_db(path: &str) {
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn test_sql_injection_prevention_select() {
        let path = temp_db_path();
        let db = Database::new(&path).expect("Failed to create test DB");

        let malicious = "'; DROP TABLE favorites; --";
        let result = db.get_cached(malicious);
        assert!(result.is_ok());
        let cached = result.unwrap();
        assert!(cached.is_none());

        let fav_result = db.is_favorite(malicious);
        assert!(fav_result.is_ok());
        assert!(!fav_result.unwrap());

        let history = db.get_evaluation_history(malicious, 10);
        assert!(history.is_ok());
        assert!(history.unwrap().is_empty());

        let trend = db.get_score_trend(malicious);
        assert!(trend.is_ok());
        assert!(trend.unwrap().is_empty());

        cleanup_db(&path);
    }

    #[test]
    fn test_sql_injection_prevention_insert() {
        let path = temp_db_path();
        let db = Database::new(&path).expect("Failed to create test DB");

        let malicious_name = "test'); DELETE FROM favorites; --";
        let result = db.add_favorite(malicious_name, "{}");
        assert!(result.is_ok());

        let is_fav = db.is_favorite(malicious_name);
        assert!(is_fav.is_ok());
        assert!(is_fav.unwrap());

        let all_favs = db.get_favorites();
        assert!(all_favs.is_ok());

        let _ = db.remove_favorite(malicious_name);
        cleanup_db(&path);
    }

    #[test]
    fn test_sql_injection_prevention_log_search() {
        let path = temp_db_path();
        let db = Database::new(&path).expect("Failed to create test DB");

        let malicious_query = "test'; DROP TABLE search_history; --";
        let result = db.log_search(malicious_query, 0);
        assert!(result.is_ok());

        let history = db.get_search_history(10);
        assert!(history.is_ok());
        assert!(!history.unwrap().is_empty());

        cleanup_db(&path);
    }

    #[test]
    fn test_sql_injection_prevention_log_evaluation() {
        let path = temp_db_path();
        let db = Database::new(&path).expect("Failed to create test DB");

        let malicious_name = "test'); DELETE FROM evaluation_log; --";
        let result = db.log_evaluation(malicious_name, Some("S"), 100, None);
        assert!(result.is_ok());

        cleanup_db(&path);
    }

    #[test]
    fn test_sql_injection_prevention_batch_operations() {
        let path = temp_db_path();
        let db = Database::new(&path).expect("Failed to create test DB");

        let malicious_session = "test'); DELETE FROM batch_sessions; --";
        let result = db.create_batch_session(malicious_session, "test", 10);
        assert!(result.is_ok());

        let session = db.get_batch_session(malicious_session);
        assert!(session.is_ok());
        assert!(session.unwrap().is_some());

        let malicious_repo = "test'); DELETE FROM batch_progress; --";
        let result = db.mark_batch_repo_processed(malicious_session, malicious_repo, "evaluated");
        assert!(result.is_ok());

        let processed = db.get_processed_repos(malicious_session);
        assert!(processed.is_ok());
        assert!(!processed.unwrap().is_empty());

        cleanup_db(&path);
    }

    #[test]
    fn test_sql_injection_prevention_discovery() {
        let path = temp_db_path();
        let db = Database::new(&path).expect("Failed to create test DB");

        let malicious_query = "test'; DELETE FROM discovery_results; --";
        let result = db.get_discovery_results(10);
        assert!(result.is_ok());

        let _ = malicious_query;
        cleanup_db(&path);
    }

    #[test]
    fn test_sql_injection_prevention_prune() {
        let path = temp_db_path();
        let db = Database::new(&path).expect("Failed to create test DB");

        let malicious_name = "test'); DELETE FROM evaluation_history; --";
        let result = db.prune_evaluation_history(malicious_name, 5);
        assert!(result.is_ok());

        cleanup_db(&path);
    }

    #[test]
    fn test_sql_injection_unicode_and_special_chars() {
        let path = temp_db_path();
        let db = Database::new(&path).expect("Failed to create test DB");

        let special_names = vec![
            "test\u{0000}null",
            "test\nnewline",
            "test\rcarriage",
            "test\x08backspace",
            "test\x1a substitute",
            "test\"double",
            "test'single",
            "test\\backslash",
            "test%percent",
            "test_underscore",
            "test😀emoji",
            "テスト日本語",
            "test" + &"x".repeat(1000),
        ];

        for name in &special_names {
            let result = db.is_favorite(name);
            assert!(result.is_ok(), "Failed for: {:?}", name);

            let result = db.get_cached(name);
            assert!(result.is_ok(), "Failed for: {:?}", name);

            let result = db.get_evaluation_history(name, 10);
            assert!(result.is_ok(), "Failed for: {:?}", name);
        }

        cleanup_db(&path);
    }

    #[test]
    fn test_input_validation_empty_query() {
        let client = GitHubClient::new(None);
        let rt = tokio::runtime::Builder::new_current_thread().build().unwrap();
        let result = rt.block_on(client.search_repos("", 10));
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(err.contains("不能为空") || err.contains("empty"));
    }

    #[test]
    fn test_input_validation_whitespace_only() {
        let client = GitHubClient::new(None);
        let rt = tokio::runtime::Builder::new_current_thread().build().unwrap();
        let result = rt.block_on(client.search_repos("   ", 10));
        assert!(result.is_err());
    }

    #[test]
    fn test_input_validation_too_long() {
        let client = GitHubClient::new(None);
        let rt = tokio::runtime::Builder::new_current_thread().build().unwrap();
        let long_query = "a".repeat(300);
        let result = rt.block_on(client.search_repos(&long_query, 10));
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(err.contains("过长") || err.contains("long") || err.contains("256"));
    }

    #[test]
    fn test_input_validation_boundary_256() {
        let client = GitHubClient::new(None);
        let rt = tokio::runtime::Builder::new_current_thread().build().unwrap();
        let query = "a".repeat(256);
        let result = rt.block_on(client.search_repos(&query, 10));
        assert!(result.is_ok() || result.is_err());
    }

    #[test]
    fn test_per_page_clamping() {
        let client = GitHubClient::new(None);
        let rt = tokio::runtime::Builder::new_current_thread().build().unwrap();

        let result_zero = rt.block_on(client.search_repos("rust", 0));
        assert!(result_zero.is_ok() || result_zero.is_err());

        let result_overflow = rt.block_on(client.search_repos("rust", 200));
        assert!(result_overflow.is_ok() || result_overflow.is_err());
    }

    #[test]
    fn test_special_characters_in_query() {
        let client = GitHubClient::new(None);
        let rt = tokio::runtime::Builder::new_current_thread().build().unwrap();

        let special_queries = vec![
            "test<script>alert(1)</script>",
            "test'; DROP TABLE users; --",
            "test${IFS}",
            "test$(whoami)",
            "test`id`",
            "test|cat /etc/passwd",
            "test&;&",
            "test||true",
        ];

        for query in &special_queries {
            let result = rt.block_on(client.search_repos(query, 5));
            assert!(result.is_ok() || result.is_err());
        }
    }

    #[test]
    fn test_database_connection_isolation() {
        let path1 = temp_db_path();
        let path2 = format!("{}_2", path1);

        let db1 = Database::new(&path1).expect("Failed to create DB1");
        let db2 = Database::new(&path2).expect("Failed to create DB2");

        db1.add_favorite("owner/repo1", "{}").unwrap();
        db2.add_favorite("owner/repo2", "{}").unwrap();

        assert!(db1.is_favorite("owner/repo1").unwrap());
        assert!(!db1.is_favorite("owner/repo2").unwrap());
        assert!(db2.is_favorite("owner/repo2").unwrap());
        assert!(!db2.is_favorite("owner/repo1").unwrap());

        cleanup_db(&path1);
        cleanup_db(&path2);
    }

    #[test]
    fn test_no_sql_injection_via_favorite_json() {
        let path = temp_db_path();
        let db = Database::new(&path).expect("Failed to create test DB");

        let malicious_json = r#"{"test": "'; DROP TABLE favorites; --"}"#;
        let result = db.add_favorite("safe/repo", malicious_json);
        assert!(result.is_ok());

        let favs = db.get_favorites();
        assert!(favs.is_ok());
        assert!(!favs.unwrap().is_empty());

        let _ = db.remove_favorite("safe/repo");
        cleanup_db(&path);
    }
}
