use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RepoInfo {
    pub owner: String,
    pub name: String,
    pub full_name: String,
    pub html_url: String,
    pub description: Option<String>,
    pub stargazers_count: u32,
    pub forks_count: u32,
    pub open_issues_count: u32,
    pub language: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub pushed_at: String,
    pub license: Option<LicenseInfo>,
    pub size: u64,
    pub has_wiki: bool,
    pub has_issues_enabled: bool,
    pub topics: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LicenseInfo {
    pub spdx_id: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GateCheckResult {
    pub gate: String,
    pub passed: bool,
    pub reason: Option<String>,
    pub evidence_level: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DimensionScore {
    pub dimension: String,
    pub score: f64,
    pub max_score: f64,
    pub sub_scores: Vec<(String, f64, f64)>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrustBadge {
    pub level: u8,
    pub l1: L1Badge,
    pub l2: Option<L2Badge>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct L1Badge {
    pub status: String,
    pub icon: String,
    pub label: String,
    pub color: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct L2Badge {
    pub gate_checks: Vec<GateCheckResult>,
    pub evidence_summary: String,
    pub key_metrics: KeyMetrics,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeyMetrics {
    pub quality_score: f64,
    pub maintenance_score: f64,
    pub security_status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EvaluationReport {
    pub repo: RepoInfo,
    pub gate_checks: Vec<GateCheckResult>,
    pub track: String,
    pub neglect_index: f64,
    pub value_density: Option<f64>,
    pub steady_state: Option<f64>,
    pub dimensions: Vec<DimensionScore>,
    pub total_score: f64,
    pub grade: String,
    pub one_liner: String,
    pub evidence_level: String,
    pub trust_badge: TrustBadge,
    pub veto_flags: Vec<String>,
    pub recommendation_index: f64,
    pub confidence_tier: String,
    pub decision_trail: Vec<DecisionStep>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DecisionStep {
    pub step: String,
    pub action: String,
    pub before: f64,
    pub after: f64,
    pub reason: String,
}

#[derive(Debug, thiserror::Error)]
#[allow(dead_code)]
pub enum EvalError {
    #[error("仓库未通过入门检查: {0}")]
    GateFailed(String),
    #[error("触发一票否决: {0}")]
    VetoTriggered(String),
    #[error("GitHub API 请求失败: {0}")]
    ApiError(#[from] reqwest::Error),
    #[error("内部错误: {0}")]
    Internal(String),
}
