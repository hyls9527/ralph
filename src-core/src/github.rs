use crate::types::{LicenseInfo, RepoInfo};
use reqwest::{Client, Response, StatusCode};
use std::sync::RwLock;
use std::time::Duration;
use tokio::time::sleep;

/// GitHub API 速率限制信息
#[derive(Debug, Clone)]
pub struct RateLimitInfo {
    pub limit: u32,
    pub remaining: u32,
    pub reset_timestamp: u64,
}

impl Default for RateLimitInfo {
    fn default() -> Self {
        Self {
            limit: 60,
            remaining: 60,
            reset_timestamp: 0,
        }
    }
}

#[derive(Clone)]
pub struct GitHubClient {
    client: Client,
    base_url: String,
    token: Option<String>,
    rate_limit: std::sync::Arc<RwLock<RateLimitInfo>>,
}

use std::sync::Arc;

/// 重试配置
const MAX_RETRIES: u32 = 3;
const INITIAL_RETRY_DELAY_MS: u64 = 1000;
const MAX_RETRY_DELAY_MS: u64 = 10000;

impl GitHubClient {
    pub fn new(token: Option<String>) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .expect("Failed to build HTTP client");

        Self {
            client,
            base_url: "https://api.github.com".to_string(),
            token,
            rate_limit: Arc::new(RwLock::new(RateLimitInfo::default())),
        }
    }

    /// 构建带认证的请求
    fn build_request(&self, url: &str) -> reqwest::RequestBuilder {
        let mut request = self
            .client
            .get(url)
            .header("Accept", "application/vnd.github.v3+json")
            .header("User-Agent", "Ralph/0.8.0 (GitHub project evaluator)");

        if let Some(token) = &self.token {
            request = request.header("Authorization", format!("Bearer {}", token));
        }

        request
    }

    /// 检查并更新速率限制
    fn update_rate_limit(&self, headers: &reqwest::header::HeaderMap) {
        if let Ok(mut rate_limit) = self.rate_limit.write() {
            if let Some(limit) = headers.get("x-ratelimit-limit") {
                if let Ok(limit_str) = limit.to_str() {
                    if let Ok(limit_val) = limit_str.parse::<u32>() {
                        rate_limit.limit = limit_val;
                    }
                }
            }

            if let Some(remaining) = headers.get("x-ratelimit-remaining") {
                if let Ok(remaining_str) = remaining.to_str() {
                    if let Ok(remaining_val) = remaining_str.parse::<u32>() {
                        rate_limit.remaining = remaining_val;
                    }
                }
            }

            if let Some(reset) = headers.get("x-ratelimit-reset") {
                if let Ok(reset_str) = reset.to_str() {
                    if let Ok(reset_val) = reset_str.parse::<u64>() {
                        rate_limit.reset_timestamp = reset_val;
                    }
                }
            }
        }
    }

    /// 检查是否需要等待速率限制重置
    fn check_rate_limit(&self) -> Result<(), String> {
        if let Ok(rate_limit) = self.rate_limit.read() {
            if rate_limit.remaining == 0 {
                let now = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_secs();

                if rate_limit.reset_timestamp > now {
                    let wait_secs = rate_limit.reset_timestamp - now;
                    return Err(format!(
                        "GitHub API 速率限制已用完，请在 {} 秒后重试",
                        wait_secs
                    ));
                }
            }
        }
        Ok(())
    }

    /// 带重试机制的请求
    async fn request_with_retry(
        &self,
        url: &str,
    ) -> Result<Response, String> {
        self.check_rate_limit()?;

        let mut last_error = String::new();
        let mut delay_ms = INITIAL_RETRY_DELAY_MS;

        for attempt in 0..MAX_RETRIES {
            match self.build_request(url).send().await {
                Ok(resp) => {
                    // 更新速率限制信息
                    self.update_rate_limit(resp.headers());

                    // 处理特定状态码
                    match resp.status() {
                        StatusCode::OK | StatusCode::CREATED | StatusCode::ACCEPTED => {
                            return Ok(resp);
                        }
                        StatusCode::FORBIDDEN => {
                            // 可能是速率限制或权限问题
                            if let Ok(rate_limit) = self.rate_limit.read() {
                                if rate_limit.remaining == 0 {
                                    return Err(format!(
                                        "GitHub API 速率限制已用完，重置时间: {}",
                                        rate_limit.reset_timestamp
                                    ));
                                }
                            }
                            last_error = format!("访问被禁止: {}", url);
                        }
                        StatusCode::NOT_FOUND => {
                            return Err(format!("资源未找到: {}", url));
                        }
                        StatusCode::UNAUTHORIZED => {
                            return Err("GitHub Token 无效或已过期".to_string());
                        }
                        status if status.is_server_error() => {
                            // 服务器错误，可以重试
                            last_error = format!("服务器错误: {}", status);
                        }
                        status => {
                            return Err(format!("HTTP 错误: {} - {}", status, url));
                        }
                    }
                }
                Err(e) => {
                    last_error = format!("请求失败: {}", e);
                }
            }

            // 如果不是最后一次尝试，则等待后重试
            if attempt < MAX_RETRIES - 1 {
                sleep(Duration::from_millis(delay_ms)).await;
                delay_ms = (delay_ms * 2).min(MAX_RETRY_DELAY_MS); // 指数退避
            }
        }

        Err(format!("请求失败，已重试 {} 次: {}", MAX_RETRIES, last_error))
    }

    pub async fn search_repos(&self, query: &str, per_page: u8) -> Result<Vec<RepoInfo>, String> {
        let url = format!(
            "{}/search/repositories?q={}&sort=stars&order=desc&per_page={}",
            self.base_url,
            urlencoding::encode(query),
            per_page
        );

        let resp = self.request_with_retry(&url).await?;

        let json: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| format!("解析响应失败: {}", e))?;

        let items = json
            .get("items")
            .and_then(|v| v.as_array())
            .ok_or_else(|| "响应格式错误".to_string())?;

        let repos: Vec<RepoInfo> = items
            .iter()
            .filter_map(|item| parse_repo(item).ok())
            .collect();

        Ok(repos)
    }

    #[allow(dead_code)]
    pub async fn get_repo(&self, owner: &str, name: &str) -> Result<RepoInfo, String> {
        let url = format!("{}/repos/{}/{}", self.base_url, owner, name);
        let resp = self.request_with_retry(&url).await?;

        let json: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| format!("解析响应失败: {}", e))?;

        parse_repo(&json)
    }

    pub async fn get_openssf_scorecard(
        &self,
        owner: &str,
        name: &str,
    ) -> Result<Option<f64>, String> {
        let url = format!(
            "https://api.securityscorecards.dev/projects/github.com/{}/{}",
            owner, name
        );

        // Scorecard API 不需要认证，使用简单请求
        match self.client.get(&url).send().await {
            Ok(r) if r.status().is_success() => {
                let json: serde_json::Value = r
                    .json()
                    .await
                    .map_err(|e| format!("解析 Scorecard 响应失败: {}", e))?;

                if let Some(score) = json.get("score").and_then(|v| v.as_f64()) {
                    Ok(Some(score / 10.0))
                } else {
                    Ok(None)
                }
            }
            _ => Ok(None),
        }
    }

    pub async fn get_recent_commits(&self, owner: &str, name: &str) -> Result<usize, String> {
        let since = chrono::Utc::now()
            .checked_sub_signed(chrono::Duration::days(90))
            .unwrap()
            .format("%Y-%m-%d")
            .to_string();

        let url = format!(
            "{}/repos/{}/{}/commits?since={}&per_page=1",
            self.base_url, owner, name, since
        );

        let resp = self.request_with_retry(&url).await?;

        if !resp.status().is_success() {
            return Ok(0);
        }

        let link = resp
            .headers()
            .get("Link")
            .and_then(|h| h.to_str().ok())
            .unwrap_or("");

        let count = extract_total_count_from_link(link);
        Ok(count)
    }

    /// 获取 GitHub Trending 项目（通过搜索近期高 Star 项目模拟）
    pub async fn get_trending_repos(
        &self,
        language: Option<&str>,
        since: &str, // daily, weekly, monthly
    ) -> Result<Vec<RepoInfo>, String> {
        let days = match since {
            "daily" => 1,
            "weekly" => 7,
            "monthly" => 30,
            _ => 7,
        };

        let created_since = chrono::Utc::now()
            .checked_sub_signed(chrono::Duration::days(365))
            .unwrap()
            .format("%Y-%m-%d")
            .to_string();

        let pushed_since = chrono::Utc::now()
            .checked_sub_signed(chrono::Duration::days(days))
            .unwrap()
            .format("%Y-%m-%d")
            .to_string();

        let query = if let Some(lang) = language {
            format!("stars:>100 created:>{created_since} push:>{pushed_since} language:{lang}")
        } else {
            format!("stars:>100 created:>{created_since} push:>{pushed_since}")
        };

        let url = format!(
            "{}/search/repositories?q={}&sort=stars&order=desc&per_page=30",
            self.base_url,
            urlencoding::encode(&query)
        );

        let resp = self.request_with_retry(&url).await?;

        let json: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| format!("解析响应失败: {}", e))?;

        let items = json
            .get("items")
            .and_then(|v| v.as_array())
            .ok_or_else(|| "响应格式错误".to_string())?;

        let repos: Vec<RepoInfo> = items
            .iter()
            .filter_map(|item| parse_repo(item).ok())
            .collect();

        Ok(repos)
    }

    /// 获取当前速率限制信息
    pub fn get_rate_limit(&self) -> RateLimitInfo {
        self.rate_limit.read()
            .map(|r| r.clone())
            .unwrap_or_default()
    }
}

fn parse_repo(json: &serde_json::Value) -> Result<RepoInfo, String> {
    let full_name = json
        .get("full_name")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown/unknown")
        .to_string();

    let parts: Vec<&str> = full_name.splitn(2, '/').collect();
    let owner = parts.first().unwrap_or(&"").to_string();
    let name = parts.get(1).unwrap_or(&"").to_string();

    let license = json.get("license").and_then(|l| {
        let spdx = l
            .get("spdx_id")
            .and_then(|s| s.as_str())
            .unwrap_or("NOASSERTION");
        let license_name = l.get("name").and_then(|s| s.as_str()).unwrap_or("Unknown");
        if spdx == "NOASSERTION" || spdx == "null" {
            None
        } else {
            Some(LicenseInfo {
                spdx_id: spdx.to_string(),
                name: license_name.to_string(),
            })
        }
    });

    Ok(RepoInfo {
        owner,
        name,
        full_name,
        html_url: json
            .get("html_url")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        description: json
            .get("description")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        stargazers_count: json
            .get("stargazers_count")
            .and_then(|v| v.as_u64())
            .unwrap_or(0) as u32,
        forks_count: json
            .get("forks_count")
            .and_then(|v| v.as_u64())
            .unwrap_or(0) as u32,
        open_issues_count: json
            .get("open_issues_count")
            .and_then(|v| v.as_u64())
            .unwrap_or(0) as u32,
        language: json
            .get("language")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        created_at: json
            .get("created_at")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        updated_at: json
            .get("updated_at")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        pushed_at: json
            .get("pushed_at")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        license,
        size: json.get("size").and_then(|v| v.as_u64()).unwrap_or(0),
        has_wiki: json
            .get("has_wiki")
            .and_then(|v| v.as_bool())
            .unwrap_or(false),
        has_issues_enabled: json
            .get("has_issues")
            .and_then(|v| v.as_bool())
            .unwrap_or(false),
        topics: json
            .get("topics")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|t| t.as_str().map(|s| s.to_string()))
                    .collect()
            })
            .unwrap_or_default(),
    })
}

fn extract_total_count_from_link(link: &str) -> usize {
    if link.is_empty() {
        return 0;
    }

    if let Some(last_page) = link.split(',').find(|part| part.contains("rel=\"last\"")) {
        if let Some(start) = last_page.find("page=") {
            let rest = &last_page[start + 5..];
            if let Some(end) = rest.find(|c: char| !c.is_ascii_digit()) {
                if let Ok(n) = rest[..end].parse::<usize>() {
                    return n;
                }
            }
        }
    }
    0
}
