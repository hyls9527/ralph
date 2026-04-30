#[cfg(test)]
mod tests {
    use super::super::github::{GitHubClient, RateLimitInfo};

    #[test]
    fn test_rate_limit_info_default() {
        let info = RateLimitInfo::default();
        assert_eq!(info.limit, 60);
        assert_eq!(info.remaining, 60);
        assert_eq!(info.reset_timestamp, 0);
    }

    #[test]
    fn test_github_client_creation_without_token() {
        let client = GitHubClient::new(None);
        // 应该成功创建
        assert_eq!(client.get_rate_limit().limit, 60);
    }

    #[test]
    fn test_github_client_creation_with_token() {
        let client = GitHubClient::new(Some("test_token".to_string()));
        // 应该成功创建
        assert_eq!(client.get_rate_limit().limit, 60);
    }

    // 注意：以下测试需要网络连接和有效的GitHub Token
    // 在实际CI环境中应该使用mock

    #[tokio::test]
    #[ignore] // 默认忽略，需要网络
    async fn test_search_repos() {
        let client = GitHubClient::new(None);
        let result = client.search_repos("rust", 5).await;
        assert!(result.is_ok());
        let repos = result.unwrap();
        assert!(!repos.is_empty());
    }

    #[tokio::test]
    #[ignore] // 默认忽略，需要网络
    async fn test_get_repo() {
        let client = GitHubClient::new(None);
        let result = client.get_repo("rust-lang", "rust").await;
        assert!(result.is_ok());
        let repo = result.unwrap();
        assert_eq!(repo.full_name, "rust-lang/rust");
    }

    #[tokio::test]
    #[ignore] // 默认忽略，需要网络
    async fn test_get_recent_commits() {
        let client = GitHubClient::new(None);
        let result = client.get_recent_commits("rust-lang", "rust").await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    #[ignore] // 默认忽略，需要网络
    async fn test_rate_limit_tracking() {
        let client = GitHubClient::new(None);

        // 初始状态
        let initial = client.get_rate_limit().remaining;

        // 执行一个请求
        let _ = client.search_repos("test", 1).await;

        // 速率限制应该被更新
        let after = client.get_rate_limit().remaining;
        assert!(after <= initial, "剩余请求数应该减少或保持不变");
    }
}
