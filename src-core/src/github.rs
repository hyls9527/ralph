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

    pub fn update_token(&mut self, token: Option<String>) {
        self.token = token;
    }

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
        let query = query.trim();
        if query.is_empty() {
            return Err("search query cannot be empty".to_string());
        }
        if query.len() > 256 {
            return Err("search query too long (max 256 chars)".to_string());
        }
        let per_page = per_page.clamp(1, 100);
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

    pub async fn get_star_history(
        &self,
        owner: &str,
        name: &str,
    ) -> Result<Vec<crate::types::StarHistoryPoint>, String> {
        let mut all_stars: Vec<crate::types::StarHistoryPoint> = Vec::new();
        let mut page = 1;
        let per_page = 100;

        loop {
            let url = format!(
                "{}/repos/{}/{}/stargazers?per_page={}&page={}",
                self.base_url, owner, name, per_page, page
            );

            let resp = self.build_request(&url)
                .header("Accept", "application/vnd.github.v3.star+json")
                .send()
                .await
                .map_err(|e| format!("获取Star历史失败: {}", e))?;

            self.update_rate_limit(resp.headers());

            if !resp.status().is_success() {
                break;
            }

            let json: serde_json::Value = resp
                .json()
                .await
                .map_err(|e| format!("解析Star历史失败: {}", e))?;

            let items = match json.as_array() {
                Some(arr) => arr,
                None => break,
            };

            if items.is_empty() {
                break;
            }

            for item in items {
                if let Some(starred_at) = item.get("starred_at").and_then(|v| v.as_str()) {
                    let date = &starred_at[..10];
                    if let Some(last) = all_stars.last_mut() {
                        if last.date == date {
                            last.count += 1;
                            continue;
                        }
                    }
                    let prev_count = all_stars.last().map(|p| p.count).unwrap_or(0);
                    all_stars.push(crate::types::StarHistoryPoint {
                        date: date.to_string(),
                        count: prev_count + 1,
                    });
                }
            }

            if items.len() < per_page {
                break;
            }

            page += 1;
            sleep(Duration::from_millis(200)).await;
        }

        Ok(all_stars)
    }

    pub async fn get_commit_activity(
        &self,
        owner: &str,
        name: &str,
    ) -> Result<Vec<crate::types::CommitActivityWeek>, String> {
        let url = format!(
            "{}/repos/{}/{}/stats/commit_activity",
            self.base_url, owner, name
        );

        let resp = self.request_with_retry(&url).await?;

        let json: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| format!("解析提交活动失败: {}", e))?;

        let weeks = match json.as_array() {
            Some(arr) => arr,
            None => return Ok(vec![]),
        };

        let activity: Vec<crate::types::CommitActivityWeek> = weeks
            .iter()
            .filter_map(|w| {
                let week_start = w.get("week").and_then(|v| v.as_u64())?;
                let total = w.get("total").and_then(|v| v.as_u64())? as u32;
                let days: Vec<u32> = w
                    .get("days")
                    .and_then(|v| v.as_array())
                    .map(|arr| {
                        arr.iter()
                            .filter_map(|d| d.as_u64().map(|n| n as u32))
                            .collect()
                    })
                    .unwrap_or_default();

                let date = chrono::DateTime::from_timestamp(week_start as i64, 0)
                    .map(|dt| dt.format("%Y-%m-%d").to_string())
                    .unwrap_or_default();

                Some(crate::types::CommitActivityWeek {
                    week_start: date,
                    total,
                    days,
                })
            })
            .collect();

        Ok(activity)
    }

    pub async fn get_issue_stats(
        &self,
        owner: &str,
        name: &str,
    ) -> Result<crate::types::IssueMetrics, String> {
        let open_url = format!(
            "{}/search/issues?q=repo:{}/{}+type:issue+state:open&per_page=1",
            self.base_url, owner, name
        );

        let closed_url = format!(
            "{}/search/issues?q=repo:{}/{}+type:issue+state:closed&per_page=1",
            self.base_url, owner, name
        );

        let stale_url = format!(
            "{}/search/issues?q=repo:{}/{}+type:issue+state:open+created:<{}&per_page=1",
            self.base_url,
            owner,
            name,
            chrono::Utc::now()
                .checked_sub_signed(chrono::Duration::days(180))
                .unwrap()
                .format("%Y-%m-%d")
        );

        let open_resp = self.request_with_retry(&open_url).await?;
        let open_json: serde_json::Value = open_resp.json().await.map_err(|e| format!("解析失败: {}", e))?;
        let open_count = open_json.get("total_count").and_then(|v| v.as_u64()).unwrap_or(0) as u32;

        let closed_resp = self.request_with_retry(&closed_url).await?;
        let closed_json: serde_json::Value = closed_resp.json().await.map_err(|e| format!("解析失败: {}", e))?;
        let closed_count = closed_json.get("total_count").and_then(|v| v.as_u64()).unwrap_or(0) as u32;

        let stale_resp = self.request_with_retry(&stale_url).await?;
        let stale_json: serde_json::Value = stale_resp.json().await.map_err(|e| format!("解析失败: {}", e))?;
        let stale_count = stale_json.get("total_count").and_then(|v| v.as_u64()).unwrap_or(0) as u32;

        let total_issues = open_count + closed_count;
        let resolution_ratio = if total_issues > 0 {
            closed_count as f64 / total_issues as f64
        } else {
            1.0
        };

        let avg_resolution_hours = if resolution_ratio > 0.8 { 48.0 } else if resolution_ratio > 0.5 { 168.0 } else { 720.0 };

        Ok(crate::types::IssueMetrics {
            open_count,
            closed_count,
            avg_resolution_hours,
            stale_count,
        })
    }

    pub async fn get_file_content(
        &self,
        owner: &str,
        name: &str,
        path: &str,
    ) -> Result<Option<String>, String> {
        let url = format!(
            "{}/repos/{}/{}/contents/{}",
            self.base_url, owner, name, path
        );

        let resp = match self.build_request(&url).send().await {
            Ok(r) if r.status().is_success() => r,
            Ok(r) if r.status() == reqwest::StatusCode::NOT_FOUND => return Ok(None),
            Ok(r) => return Err(format!("获取文件失败: HTTP {}", r.status())),
            Err(e) => return Err(format!("请求失败: {}", e)),
        };

        self.update_rate_limit(resp.headers());

        let json: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| format!("解析失败: {}", e))?;

        if let Some(content) = json.get("content").and_then(|v| v.as_str()) {
            let cleaned = content.replace('\n', "").replace('\r', "");
            use base64::Engine;
            let decoded = base64::engine::general_purpose::STANDARD
                .decode(&cleaned)
                .map_err(|e| format!("Base64解码失败: {}", e))?;
            Ok(Some(String::from_utf8_lossy(&decoded).to_string()))
        } else {
            Ok(None)
        }
    }

    pub async fn get_repo_tree(
        &self,
        owner: &str,
        name: &str,
    ) -> Result<Vec<String>, String> {
        let url = format!(
            "{}/repos/{}/{}/git/trees/main?recursive=1",
            self.base_url, owner, name
        );

        let resp = match self.build_request(&url).send().await {
            Ok(r) if r.status().is_success() => r,
            Ok(_) => {
                let fallback_url = format!(
                    "{}/repos/{}/{}/git/trees/master?recursive=1",
                    self.base_url, owner, name
                );
                self.build_request(&fallback_url).send().await
                    .map_err(|e| format!("获取文件树失败: {}", e))?
            }
            Err(e) => return Err(format!("请求失败: {}", e)),
        };

        self.update_rate_limit(resp.headers());

        let json: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| format!("解析文件树失败: {}", e))?;

        let tree = json
            .get("tree")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|item| {
                        item.get("path").and_then(|p| p.as_str().map(|s| s.to_string()))
                    })
                    .collect()
            })
            .unwrap_or_default();

        Ok(tree)
    }

    pub async fn check_file_exists(
        &self,
        owner: &str,
        name: &str,
        path: &str,
    ) -> Result<bool, String> {
        let url = format!(
            "{}/repos/{}/{}/contents/{}",
            self.base_url, owner, name, path
        );

        match self.build_request(&url).send().await {
            Ok(r) => Ok(r.status().is_success()),
            Err(_) => Ok(false),
        }
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
