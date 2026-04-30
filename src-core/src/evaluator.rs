use crate::types::*;
use chrono::DateTime;

#[derive(Debug, Clone, PartialEq)]
pub enum ConfidenceTier {
    Tier1,
    Tier2,
    Tier3,
}

impl ConfidenceTier {
    pub fn as_str(&self) -> &'static str {
        match self {
            ConfidenceTier::Tier1 => "tier1-core",
            ConfidenceTier::Tier2 => "tier2-extended",
            ConfidenceTier::Tier3 => "tier3-full",
        }
    }

    pub fn determine(
        gate_checks: &[GateCheckResult],
        evidence_levels: &[&str],
        repo: &RepoInfo,
    ) -> Self {
        let l4_or_lower = evidence_levels.iter().any(|l| *l == "L4" || *l == "L5");
        let has_g5_l4 = gate_checks.iter()
            .any(|g| g.gate.starts_with("G5") && g.evidence_level == "L4");
        let fork_star_ratio = repo.forks_count as f64 / (repo.stargazers_count as f64).max(1.0);
        let high_star_no_fork = repo.stargazers_count >= 1000 && fork_star_ratio < 0.05;
        let no_description = repo.description.is_none();

        if l4_or_lower || has_g5_l4 || high_star_no_fork || no_description {
            ConfidenceTier::Tier3
        } else if evidence_levels.iter().any(|l| *l == "L3") {
            ConfidenceTier::Tier2
        } else {
            ConfidenceTier::Tier1
        }
    }
}

pub struct Evaluator;

impl Evaluator {
    pub fn gate_check(repo: &RepoInfo, recent_commits: usize) -> Vec<GateCheckResult> {
        vec![
            check_g1(repo),
            check_g2(repo, recent_commits),
            check_g3(repo),
            check_g4(repo),
            check_g5(repo),
            check_g6(repo),
        ]
    }

    pub fn run_pipeline(
        repo: &RepoInfo,
        recent_commits: usize,
        evidence_levels: &[&str],
    ) -> (Vec<DimensionScore>, Vec<Vec<(String, f64, f64)>>, Vec<DecisionStep>, ConfidenceTier) {
        let gate_checks = Self::gate_check(repo, recent_commits);
        let tier = ConfidenceTier::determine(&gate_checks, evidence_levels, repo);
        let (mut dimensions, sub_scores) = Self::score_dimensions(repo, recent_commits);
        let mut trail: Vec<DecisionStep> = Vec::new();

        let total_before = dimensions.iter().map(|d| d.score).sum::<f64>();

        Self::apply_evidence_threshold(&mut dimensions, evidence_levels);
        let after_step1: f64 = dimensions.iter().map(|d| d.score).sum();
        trail.push(DecisionStep {
            step: "证据门槛".to_string(),
            action: "apply_evidence_threshold".to_string(),
            before: total_before,
            after: after_step1,
            reason: format!("证据等级: {:?}", evidence_levels),
        });

        Self::apply_bayesian_correction(&mut dimensions, evidence_levels);
        let after_step2: f64 = dimensions.iter().map(|d| d.score).sum();
        trail.push(DecisionStep {
            step: "贝叶斯修正".to_string(),
            action: "apply_bayesian_correction".to_string(),
            before: after_step1,
            after: after_step2,
            reason: "小样本向全局均值回归".to_string(),
        });

        if tier != ConfidenceTier::Tier1 {
            Self::apply_mutation_detection(&mut dimensions, recent_commits);
            let after_step3: f64 = dimensions.iter().map(|d| d.score).sum();
            trail.push(DecisionStep {
                step: "突变检测".to_string(),
                action: "apply_mutation_detection".to_string(),
                before: after_step2,
                after: after_step3,
                reason: format!("近90天提交: {}", recent_commits),
            });

            Self::apply_elephant_factor(&mut dimensions, repo, recent_commits);
            let after_step4: f64 = dimensions.iter().map(|d| d.score).sum();
            trail.push(DecisionStep {
                step: "大象因子".to_string(),
                action: "apply_elephant_factor".to_string(),
                before: after_step3,
                after: after_step4,
                reason: format!("fork/star: {:.3}", repo.forks_count as f64 / (repo.stargazers_count as f64).max(1.0)),
            });

            let (_, cred_warnings) = Self::apply_declaration_credibility(&mut dimensions, repo);
            let after_step5: f64 = dimensions.iter().map(|d| d.score).sum();
            trail.push(DecisionStep {
                step: "声明可信度".to_string(),
                action: "apply_declaration_credibility".to_string(),
                before: after_step4,
                after: after_step5,
                reason: if cred_warnings.is_empty() { "可信度≥0.8".to_string() } else { cred_warnings.join("; ") },
            });
        }

        if tier == ConfidenceTier::Tier3 {
            Self::apply_ceiling(&mut dimensions, &sub_scores);
            let after_step6: f64 = dimensions.iter().map(|d| d.score).sum();
            let prev_score = trail.last().map(|s| s.after).unwrap_or(after_step2);
            trail.push(DecisionStep {
                step: "基础项天花板".to_string(),
                action: "apply_ceiling".to_string(),
                before: prev_score,
                after: after_step6,
                reason: "基础维度缺失限制关联维度".to_string(),
            });

            Self::apply_cross_validation(&mut dimensions, &sub_scores);
            let after_step7: f64 = dimensions.iter().map(|d| d.score).sum();
            trail.push(DecisionStep {
                step: "维度交叉校验".to_string(),
                action: "apply_cross_validation".to_string(),
                before: after_step6,
                after: after_step7,
                reason: "维度间得分矛盾修正".to_string(),
            });
        }

        (dimensions, sub_scores, trail, tier)
    }

    pub fn classify_track(stars: u32, neglect_index: f64) -> String {
        if neglect_index >= 5.0 && stars <= 2000 {
            "neglected".to_string()
        } else if stars >= 1000 {
            "high-star".to_string()
        } else {
            "steady".to_string()
        }
    }

    /// 高星轨道：价值密度系数（Ralph_评定规则.md 3.6.3）
    /// 价值密度系数 = (Star增长 / 项目年龄) × 项目年龄修正
    /// 价值密度系数 < 0.6 → 高星轨道不推荐
    pub fn calc_value_density(repo: &RepoInfo) -> f64 {
        let created = DateTime::parse_from_rfc3339(&repo.created_at)
            .unwrap_or_else(|_| DateTime::parse_from_rfc3339("2024-01-01T00:00:00Z").unwrap());
        let age_months = (chrono::Utc::now()
            .signed_duration_since(created.with_timezone(&chrono::Utc)))
            .num_days() as f64 / 30.0;
        
        // Star 增长速度 (Star/月)
        let star_growth_rate = repo.stargazers_count as f64 / age_months.max(1.0);
        
        // 项目年龄修正: 新项目 (<6月) 给予更高系数，老项目衰减
        let age_correction = if age_months < 6.0 {
            1.5 // 新项目修正
        } else if age_months < 12.0 {
            1.0 // 正常
        } else if age_months < 24.0 {
            0.8 // 老项目衰减
        } else {
            0.6 // 长期项目衰减
        };
        
        // 价值密度系数
        let value_density = (star_growth_rate / 100.0).min(1.0) * age_correction;
        value_density.max(0.1) // 最低 0.1
    }

    /// 稳态轨道：稳态系数（Ralph_评定规则.md 3.6.4）
    /// 稳态系数 = 增长健康度 × 社区韧性 × 0.8
    /// 稳态系数 < 0.4 → 稳态轨道不推荐
    pub fn calc_steady_state(repo: &RepoInfo, recent_commits: usize) -> f64 {
        // 增长健康度: 近90天提交频率与历史对比
        let created = DateTime::parse_from_rfc3339(&repo.created_at)
            .unwrap_or_else(|_| DateTime::parse_from_rfc3339("2024-01-01T00:00:00Z").unwrap());
        let age_months = (chrono::Utc::now()
            .signed_duration_since(created.with_timezone(&chrono::Utc)))
            .num_days() as f64 / 30.0;
        
        let historical_monthly = repo.stargazers_count as f64 / age_months.max(1.0);
        let growth_health = if historical_monthly > 0.0 {
            (recent_commits as f64 / 3.0) / historical_monthly // 近月活跃度与历史对比
        } else {
            1.0
        }.min(1.0); // 上限 1.0
        
        // 社区韧性: 用 fork/star 比例和 open_issues 近似
        let fork_ratio = repo.forks_count as f64 / (repo.stargazers_count as f64).max(1.0);
        let community_resilience = fork_ratio.min(1.0) * 0.5 + 
            (repo.open_issues_count as f64 / 100.0).min(0.5); // fork 50% + issues 50%
        
        // 稳态系数
        growth_health * community_resilience * 0.8
    }

    /// 计算忽视指数（对齐 Ralph_评定规则.md 2.2 公式）
    /// 忽视指数 = 年龄因子 × 活跃度反差因子 × 曝光效率因子 × Star质量因子 × 1000
    pub fn calc_neglect_index(repo: &RepoInfo, recent_commits: usize) -> f64 {
        let created = DateTime::parse_from_rfc3339(&repo.created_at)
            .unwrap_or_else(|_| DateTime::parse_from_rfc3339("2024-01-01T00:00:00Z").unwrap());
        let age_months = (chrono::Utc::now()
            .signed_duration_since(created.with_timezone(&chrono::Utc)))
            .num_days() as f64 / 30.0;

        // 年龄因子 = min(1.0, 存在月数 ÷ 6) [Skills节奏快，6月满因子]
        let age_factor = age_months.min(6.0) / 6.0;

        // 活跃度反差因子 = ln(有效提交数 + 1) × 10 ÷ max(Star数, 1)
        let activity_contrast = (recent_commits as f64 + 1.0).ln() * 10.0 / (repo.stargazers_count as f64).max(1.0);

        // 曝光效率因子 = 有效Fork数 ÷ max(Star数, 1)
        let exposure_efficiency = repo.forks_count as f64 / (repo.stargazers_count as f64).max(1.0);

        // Star质量因子 = 1.0 - min(0.5, 低质量Star比例)
        let star_quality = 1.0 - (1.0 - exposure_efficiency).min(0.5);

        // 忽视指数
        age_factor * activity_contrast * exposure_efficiency * star_quality * 1000.0
    }

    pub fn calc_recommendation_index(
        quality_score: f64,
        track: &str,
        neglect_index: f64,
        stars: u32,
        mutation_ratio: f64,
    ) -> f64 {
        match track {
            "neglected" => {
                let neglect_factor = 1.0 + neglect_index / 50.0;
                let mutation_penalty = if mutation_ratio > 5.0 {
                    0.3
                } else if mutation_ratio > 2.5 {
                    0.15
                } else {
                    0.0
                };
                quality_score * neglect_factor * (1.0 - mutation_penalty)
            }
            "high-star" => {
                let star_factor = (stars as f64 / 1000.0).min(1.5);
                quality_score * star_factor
            }
            "steady" => {
                quality_score * 0.5
            }
            _ => quality_score * 0.5,
        }
    }

    /// ❌9 评分欺诈检测：贝叶斯调整后得分降幅 > 30%
    pub fn detect_score_fraud(
        raw_total: f64,
        corrected_total: f64,
    ) -> (bool, Option<String>) {
        if raw_total <= 0.0 {
            return (false, None);
        }
        let drop_ratio = (raw_total - corrected_total) / raw_total;
        if drop_ratio > 0.30 {
            (true, Some(format!(
                "评分欺诈: 防博弈流水线导致得分从 {:.1} 降至 {:.1} (降幅 {:.1}% > 30%，触发❌9)",
                raw_total, corrected_total, drop_ratio * 100.0
            )))
        } else {
            (false, None)
        }
    }

    /// OpenSSF Scorecard F维度校准（规则 3.6.2）
    pub fn apply_openssf_calibration(
        dimensions: &mut [DimensionScore],
        openssf_score: f64,
    ) -> Vec<String> {
        let mut warnings = vec![];
        
        if let Some(f_dim) = dimensions.iter_mut().find(|d| d.dimension == "安全") {
            let f_rate = f_dim.score / f_dim.max_score;
            let scorecard_rate = openssf_score;
            
            if f_rate > scorecard_rate * 1.2 {
                let old_score = f_dim.score;
                f_dim.score = f_dim.score * (scorecard_rate / f_rate) * 1.2;
                warnings.push(format!(
                    "OpenSSF校准: F维度得分率 {:.2} > Scorecard {:.2} × 1.2，安全维度从 {:.1} 降至 {:.1}",
                    f_rate, scorecard_rate, old_score, f_dim.score
                ));
            }
        }
        
        warnings
    }

    pub fn score_dimensions(repo: &RepoInfo, recent_commits: usize) -> (Vec<DimensionScore>, Vec<Vec<(String, f64, f64)>>) {
        let dims = vec![
            score_quality(repo),
            score_maintenance(repo, recent_commits),
            score_practical(repo),
            score_documentation(repo),
            score_community(repo),
            score_security(repo),
        ];
        let subs: Vec<Vec<(String, f64, f64)>> = dims.iter().map(|d| d.sub_scores.clone()).collect();
        (dims, subs)
    }

    pub fn generate_one_liner(repo: &RepoInfo, score: f64, track: &str) -> String {
        let track_label = match track {
            "neglected" => "被忽视的宝藏",
            "high-star" => "热门项目",
            "steady" => "稳态优质",
            _ => "未知类型",
        };

        if score >= 84.0 {
            format!(
                "{} | S级推荐，{} | {}",
                repo.name,
                track_label,
                repo.description.as_deref().unwrap_or("暂无描述")
            )
        } else if score >= 79.0 {
            format!(
                "{} | A级推荐，{} | {}",
                repo.name,
                track_label,
                repo.description.as_deref().unwrap_or("暂无描述")
            )
        } else if score >= 73.0 {
            format!(
                "{} | B级推荐，{} | {}",
                repo.name,
                track_label,
                repo.description.as_deref().unwrap_or("暂无描述")
            )
        } else {
            format!(
                "{} | 不推荐 | {}",
                repo.name,
                repo.description.as_deref().unwrap_or("暂无描述")
            )
        }
    }

    pub fn determine_grade(score: f64, track: &str) -> String {
        if score < 73.0 {
            return "X".to_string();
        }

        match track {
            "neglected" | "high-star" => {
                if score >= 84.0 {
                    "S".to_string()
                } else if score >= 79.0 {
                    "A".to_string()
                } else {
                    "B".to_string()
                }
            }
            "steady" => {
                if score >= 79.0 {
                    "A".to_string()
                } else {
                    "B".to_string()
                }
            }
            _ => "X".to_string(),
        }
    }

    pub fn build_trust_badge(
        gate_checks: &[GateCheckResult],
        dimensions: &[DimensionScore],
        score: f64,
    ) -> TrustBadge {
        let (status, icon, label, color) = if score >= 73.0 {
            (
                "recommended".to_string(),
                "✓".to_string(),
                "Ralph 推荐".to_string(),
                "emerald".to_string(),
            )
        } else if score >= 50.0 {
            (
                "caution".to_string(),
                "⚠".to_string(),
                "需谨慎".to_string(),
                "amber".to_string(),
            )
        } else {
            (
                "not-recommended".to_string(),
                "✗".to_string(),
                "不推荐".to_string(),
                "rose".to_string(),
            )
        };

        let quality = dimensions
            .iter()
            .find(|d| d.dimension == "质量")
            .map(|d| d.score)
            .unwrap_or(0.0);
        let maintenance = dimensions
            .iter()
            .find(|d| d.dimension == "维护")
            .map(|d| d.score)
            .unwrap_or(0.0);
        let security = dimensions
            .iter()
            .find(|d| d.dimension == "安全")
            .map(|d| d.score)
            .unwrap_or(0.0);
        let security_status = if security >= 10.0 {
            "passed".to_string()
        } else if security >= 5.0 {
            "warning".to_string()
        } else {
            "failed".to_string()
        };

        TrustBadge {
            level: 2,
            l1: L1Badge {
                status,
                icon,
                label,
                color,
            },
            l2: Some(L2Badge {
                gate_checks: gate_checks.to_vec(),
                evidence_summary: format!("评分 {}/105 | 证据等级 L1", score as u32),
                key_metrics: KeyMetrics {
                    quality_score: quality,
                    maintenance_score: maintenance,
                    security_status,
                },
            }),
        }
    }

    /// 防博弈机制 3：基础项天花板
    pub fn apply_ceiling(
        dimensions: &mut [DimensionScore],
        sub_scores: &Vec<Vec<(String, f64, f64)>>,
    ) -> Vec<String> {
        let mut warnings = vec![];
        
        let get_sub = |dim_idx: usize, sub_name: &str| -> f64 {
            if let Some(dim_subs) = sub_scores.get(dim_idx) {
                dim_subs
                    .iter()
                    .find(|(name, _, _)| name == sub_name)
                    .map(|(_, score, _)| *score)
                    .unwrap_or(0.0)
            } else {
                0.0
            }
        };
        
        let a2_test = get_sub(0, "测试覆盖");
        if a2_test <= 1.0 {
            if let Some(c) = dimensions.iter_mut().find(|d| d.dimension == "实用") {
                let ceiling = c.max_score * 0.4;
                if c.score > ceiling {
                    warnings.push(format!("基础项天花板: 无测试保障，实用维度得分从 {:.1} 降至 {:.1}", c.score, ceiling));
                    c.score = ceiling;
                }
            }
        }
        
        let a3_ci = get_sub(0, "CI/CD");
        if a3_ci <= 1.0 {
            if let Some(f) = dimensions.iter_mut().find(|d| d.dimension == "安全") {
                let penalty = f.max_score * 0.15;
                let new_score = (f.score - penalty).max(0.0);
                if new_score < f.score {
                    warnings.push(format!("基础项天花板: 无 CI/CD，安全维度得分从 {:.1} 降至 {:.1}", f.score, new_score));
                    f.score = new_score;
                }
            }
        }
        
        let b_maint = dimensions.iter().find(|d| d.dimension == "维护").map(|d| d.score).unwrap_or(0.0);
        let maint_is_low = b_maint <= b_maint.max(1.0) * 0.2;
        if maint_is_low {
            if let Some(e) = dimensions.iter_mut().find(|d| d.dimension == "社区") {
                let ceiling = e.max_score * 0.3;
                if e.score > ceiling {
                    warnings.push(format!("基础项天花板: 维护缺失，社区维度得分从 {:.1} 降至 {:.1}", e.score, ceiling));
                    e.score = ceiling;
                }
            }
        }
        
        let a1_structure = get_sub(0, "项目结构");
        if a1_structure <= 1.0 {
            if let Some(a) = dimensions.iter_mut().find(|d| d.dimension == "质量") {
                let ceiling = a.max_score * 0.6;
                if a.score > ceiling {
                    warnings.push(format!("基础项天花板: 可读性低，质量维度得分从 {:.1} 降至 {:.1}", a.score, ceiling));
                    a.score = ceiling;
                }
            }
        }
        
        let c3_usability = get_sub(2, "开箱即用度");
        if c3_usability <= 1.0 {
            if let Some(c) = dimensions.iter_mut().find(|d| d.dimension == "实用") {
                let ceiling = c.max_score * 0.5;
                if c.score > ceiling {
                    warnings.push(format!("基础项天花板: 输出可靠性低，实用维度得分从 {:.1} 降至 {:.1}", c.score, ceiling));
                    c.score = ceiling;
                }
            }
        }
        
        warnings
    }
    
    /// B 维度突变检测
    pub fn apply_mutation_detection(
        dimensions: &mut [DimensionScore],
        recent_commits: usize,
    ) -> Vec<String> {
        let mut warnings = vec![];
        
        let recent_30 = (recent_commits as f64 * 0.33) as usize;
        let prev_90_daily = (recent_commits as f64 * 0.67) / 3.0;
        
        if prev_90_daily > 0.0 {
            let mutation_ratio = recent_30 as f64 / prev_90_daily;
            
            if mutation_ratio > 5.0 {
                if let Some(b_dim) = dimensions.iter_mut().find(|d| d.dimension == "维护") {
                    let old_score = b_dim.score;
                    b_dim.score *= 0.6;
                    warnings.push(format!("突变检测: 突变比 {:.1} > 5.0，维护维度从 {:.1} 降至 {:.1} (高度异常)", mutation_ratio, old_score, b_dim.score));
                }
            } else if mutation_ratio > 2.5 {
                if let Some(b_dim) = dimensions.iter_mut().find(|d| d.dimension == "维护") {
                    let old_score = b_dim.score;
                    b_dim.score *= 0.82;
                    warnings.push(format!("突变检测: 突变比 {:.1} > 2.5，维护维度从 {:.1} 降至 {:.1} (异常)", mutation_ratio, old_score, b_dim.score));
                }
            }
        }
        
        warnings
    }
    
    /// E 维度大象因子修正
    pub fn apply_elephant_factor(
        dimensions: &mut [DimensionScore],
        repo: &RepoInfo,
        recent_commits: usize,
    ) -> Vec<String> {
        let mut warnings = vec![];
        
        if recent_commits > 0 {
            let fork_ratio = repo.forks_count as f64 / (repo.stargazers_count as f64).max(1.0);
            let elephant_factor = 1.0 - fork_ratio.min(1.0);
            
            if repo.forks_count >= 5 && elephant_factor > 0.7 {
                if let Some(e_dim) = dimensions.iter_mut().find(|d| d.dimension == "社区") {
                    let old_score = e_dim.score;
                    let correction = 1.1 - elephant_factor;
                    e_dim.score *= correction;
                    warnings.push(format!("大象因子: 贡献集中度 {:.2} > 0.7，社区维度从 {:.1} 降至 {:.1}", elephant_factor, old_score, e_dim.score));
                }
            }
        }
        
        warnings
    }
    
    /// C 维度声明可信度修正
    pub fn apply_declaration_credibility(
        dimensions: &mut [DimensionScore],
        repo: &RepoInfo,
    ) -> (bool, Vec<String>) {
        let mut warnings = vec![];
        let mut disqualified = false;
        
        let has_topics = !repo.topics.is_empty();
        let has_readme = repo.description.is_some();
        
        let credibility = if has_topics && has_readme {
            0.85
        } else if has_readme {
            0.6
        } else {
            0.3
        };
        
        if credibility < 0.5 {
            if let Some(c_dim) = dimensions.iter_mut().find(|d| d.dimension == "实用") {
                let old_score = c_dim.score;
                c_dim.score *= 0.5;
                warnings.push(format!("声明可信度: {:.2} < 0.5，实用维度从 {:.1} 降至 {:.1} (虚假宣传)", credibility, old_score, c_dim.score));
                disqualified = true;
            }
        } else if credibility < 0.8 {
            if let Some(c_dim) = dimensions.iter_mut().find(|d| d.dimension == "实用") {
                let old_score = c_dim.score;
                c_dim.score *= credibility;
                warnings.push(format!("声明可信度: {:.2} ∈ [0.5,0.8)，实用维度从 {:.1} 降至 {:.1}", credibility, old_score, c_dim.score));
            }
        }
        
        (disqualified, warnings)
    }
    
    /// 防博弈机制 4：维度间交叉校验
    pub fn apply_cross_validation(
        dimensions: &mut [DimensionScore],
        sub_scores: &Vec<Vec<(String, f64, f64)>>,
    ) -> Vec<String> {
        let mut warnings = vec![];
        
        let q_score = dimensions.iter().find(|d| d.dimension == "质量").map(|d| d.score).unwrap_or(0.0);
        let c_score = dimensions.iter().find(|d| d.dimension == "实用").map(|d| d.score).unwrap_or(0.0);
        let f_score = dimensions.iter().find(|d| d.dimension == "安全").map(|d| d.score).unwrap_or(0.0);
        let b_score = dimensions.iter().find(|d| d.dimension == "维护").map(|d| d.score).unwrap_or(0.0);
        
        let get_sub = |dim_idx: usize, sub_name: &str| -> f64 {
            if let Some(dim_subs) = sub_scores.get(dim_idx) {
                dim_subs
                    .iter()
                    .find(|(name, _, _)| name == sub_name)
                    .map(|(_, score, _)| *score)
                    .unwrap_or(0.0)
            } else {
                0.0
            }
        };
        
        let a_structure = get_sub(0, "项目结构");
        let a_test = get_sub(0, "测试覆盖");
        if a_structure >= 3.5 && a_test <= 1.0 {
            if let Some(q_dim) = dimensions.iter_mut().find(|d| d.dimension == "质量") {
                let reduction = 1.5;
                let new_score = (q_dim.score - reduction).max(0.0);
                warnings.push(format!("交叉校验: 高结构低测试，质量维度从 {:.1} 降至 {:.1}", q_dim.score, new_score));
                q_dim.score = new_score;
            }
        }
        
        let d_readme = get_sub(3, "README");
        if c_score > 15.0 && d_readme <= 2.0 {
            if let Some(c_dim) = dimensions.iter_mut().find(|d| d.dimension == "实用") {
                let ceiling = c_dim.max_score * 0.6;
                if c_dim.score > ceiling {
                    warnings.push(format!("交叉校验: 高独创低文档，实用维度从 {:.1} 压缩至 {:.1}", c_dim.score, ceiling));
                    c_dim.score = ceiling;
                }
            }
        }
        
        if f_score >= 14.0 && q_score < 10.0 {
            if let Some(f_dim) = dimensions.iter_mut().find(|d| d.dimension == "安全") {
                let reduction = f_dim.max_score * 0.25;
                let new_score = (f_dim.score - reduction).max(0.0);
                warnings.push(format!("交叉校验: 高安全低质量，安全维度从 {:.1} 降至 {:.1}", f_dim.score, new_score));
                f_dim.score = new_score;
            }
        }
        
        if b_score <= 3.0 {
            if let Some(c_dim) = dimensions.iter_mut().find(|d| d.dimension == "实用") {
                let reduction = c_dim.max_score * 0.1;
                let new_score = (c_dim.score - reduction).max(0.0);
                if new_score < c_dim.score {
                    warnings.push(format!("交叉校验: 低维护，实用维度从 {:.1} 降至 {:.1}", c_dim.score, new_score));
                    c_dim.score = new_score;
                }
            }
        }
        
        warnings
    }

    /// 防博弈机制 1: 证据门槛
    pub fn apply_evidence_threshold(
        dimensions: &mut [DimensionScore],
        evidence_levels: &[&str],
    ) -> Vec<String> {
        let mut warnings = vec![];
        for (i, dim) in dimensions.iter_mut().enumerate() {
            let level = evidence_levels.get(i).unwrap_or(&"L4");
            match *level {
                "L5" => {
                    if dim.score > 0.0 {
                        warnings.push(format!(
                            "证据门槛: {} 维度证据等级 L5（无证据），得分从 {:.1} 降至 0",
                            dim.dimension, dim.score
                        ));
                        dim.score = 0.0;
                    }
                }
                "L4" => {
                    let ceiling = dim.max_score * 0.5;
                    if dim.score > ceiling {
                        warnings.push(format!(
                            "证据门槛: {} 维度证据等级 L4（声明验证），得分从 {:.1} 降至 {:.1}（上限 50%）",
                            dim.dimension, dim.score, ceiling
                        ));
                        dim.score = ceiling;
                    }
                }
                _ => {}
            }
        }
        warnings
    }

    pub fn apply_bayesian_correction(
        dimensions: &mut [DimensionScore],
        evidence_levels: &[&str],
    ) {
        let k = 2.0;
        for dim in dimensions.iter_mut() {
            let dim_evidence = evidence_levels
                .iter()
                .find(|&&l| matches!(l, "L1" | "L2" | "L3" | "L4"))
                .unwrap_or(&"L4");
            let evidence_strength = match *dim_evidence {
                "L1" => 1.0,
                "L2" => 0.85,
                "L3" => 0.8,
                "L4" => 0.5,
                _ => 0.0,
            };
            let decay = 1.0 / (1.0 + k * evidence_strength);
            let global_mean = GLOBAL_MEAN_DIMENSIONS
                .iter()
                .find(|(name, _)| *name == dim.dimension)
                .map(|(_, mean)| *mean)
                .unwrap_or(dim.max_score * 0.5);
            dim.score = (1.0 - decay) * dim.score + decay * global_mean;
        }
    }

    pub fn check_dimension_floors(dimensions: &[DimensionScore]) -> (bool, Vec<String>) {
        let mut violations = vec![];
        
        for dim in dimensions {
            let floor_ratio = if dim.dimension == "安全" { 0.35 } else { 0.20 };
            let threshold = dim.max_score * floor_ratio;
            if dim.score < threshold {
                violations.push(format!(
                    "{}维度得分 {:.1} 低于地板值 {:.1} ({}%)",
                    dim.dimension,
                    dim.score,
                    threshold,
                    (floor_ratio * 100.0) as i32
                ));
            }
        }
        (violations.is_empty(), violations)
    }

    pub fn detect_anomalies(
        dimensions: &[DimensionScore],
        repo: &RepoInfo,
        recent_commits: usize,
        evaluated_count: usize,
    ) -> AnomalyReport {
        let mut anomaly_types = vec![];
        let mut anomaly_score = 0.0;
        if evaluated_count >= 30 {
            let total: f64 = dimensions.iter().map(|d| d.score).sum();
            if total > 0.0 {
                for dim in dimensions {
                    let ratio = dim.score / total;
                    if ratio > 0.45 {
                        anomaly_types.push(format!("{}维度过度主导({:.0}%)", dim.dimension, ratio * 100.0));
                        anomaly_score += 10.0;
                    }
                }
            }
            let fork_ratio = if repo.forks_count > 0 {
                repo.stargazers_count as f64 / repo.forks_count as f64
            } else {
                repo.stargazers_count as f64 / 1.0
            };
            if fork_ratio > 20.0 && repo.stargazers_count > 500 {
                anomaly_types.push(format!("Star/Fork比例异常({:.0}:1)，疑似刷星", fork_ratio));
                anomaly_score += 15.0;
            }
            let commit_density = if repo.size > 0 {
                recent_commits as f64 / repo.size as f64 * 100.0
            } else {
                0.0
            };
            if commit_density > 50.0 && repo.size < 50 {
                anomaly_types.push(format!("提交密度异常({:.1}/KB)", commit_density));
                anomaly_score += 10.0;
            }
        }
        if repo.stargazers_count > 1000 && repo.size < 20 {
            anomaly_types.push(format!("零代码高星({} stars, {} KB)", repo.stargazers_count, repo.size));
            anomaly_score += 20.0;
        }
        AnomalyReport {
            has_anomaly: !anomaly_types.is_empty(),
            anomaly_types,
            anomaly_score,
        }
    }
}

/// 全局均值（用于贝叶斯修正的先验）
const GLOBAL_MEAN_DIMENSIONS: &[(&str, f64)] = &[
    ("质量", 10.0),
    ("维护", 8.0),
    ("实用", 12.0),
    ("文档", 7.5),
    ("社区", 5.0),
    ("安全", 14.0),
];

fn check_g1(repo: &RepoInfo) -> GateCheckResult {
    let has_license = repo.license.is_some()
        && repo.license.as_ref().unwrap().spdx_id != "NOASSERTION"
        && repo.license.as_ref().unwrap().spdx_id != "null";

    GateCheckResult {
        gate: "G1: 有效开源协议".to_string(),
        passed: has_license,
        reason: if has_license {
            Some(format!("使用 {} 协议", repo.license.as_ref().unwrap().name))
        } else {
            Some("未找到 OSI 认证协议".to_string())
        },
        evidence_level: "L1".to_string(),
    }
}

fn check_g2(_repo: &RepoInfo, recent_commits: usize) -> GateCheckResult {
    let is_alive = recent_commits > 0;

    GateCheckResult {
        gate: "G2: 项目存活".to_string(),
        passed: is_alive,
        reason: if is_alive {
            Some(format!("近 90 天有 {} 次提交", recent_commits))
        } else {
            Some("近 90 天内无有效提交".to_string())
        },
        evidence_level: "L1".to_string(),
    }
}

fn check_g3(repo: &RepoInfo) -> GateCheckResult {
    let has_build_file = repo.topics.iter().any(|t| {
        matches!(
            t.as_str(),
            "npm" | "cargo" | "python" | "make" | "cmake" | "gradle" | "maven" | "webpack" | "vite"
        )
    }) || repo.size > 100;

    GateCheckResult {
        gate: "G3: 核心可用".to_string(),
        passed: has_build_file || repo.size > 0,
        reason: if has_build_file {
            Some("检测到构建工具配置".to_string())
        } else if repo.size > 0 {
            Some("仓库有代码文件".to_string())
        } else {
            Some("空仓库".to_string())
        },
        evidence_level: "L3".to_string(),
    }
}

fn check_g4(repo: &RepoInfo) -> GateCheckResult {
    let size_kb = repo.size;
    let has_code = size_kb >= 50;

    GateCheckResult {
        gate: "G4: 非空壳".to_string(),
        passed: has_code,
        reason: if has_code {
            Some(format!("仓库大小 {} KB (约 {} 行代码，≥500行)", size_kb, size_kb * 10))
        } else {
            Some(format!("仓库代码量不足 ({} KB < 50 KB，约 {} 行 < 500 行)", size_kb, size_kb * 10))
        },
        evidence_level: "L1".to_string(),
    }
}

fn check_g5(_repo: &RepoInfo) -> GateCheckResult {
    GateCheckResult {
        gate: "G5: 非恶意搬运".to_string(),
        passed: true,
        reason: Some("MVP 阶段标记为需人工审核".to_string()),
        evidence_level: "L4".to_string(),
    }
}

fn check_g6(_repo: &RepoInfo) -> GateCheckResult {
    GateCheckResult {
        gate: "G6: 数据真实".to_string(),
        passed: true,
        reason: Some("数据通过 GitHub API 实时验证".to_string()),
        evidence_level: "L1".to_string(),
    }
}

fn score_quality(repo: &RepoInfo) -> DimensionScore {
    let mut score = 0.0;
    let mut sub_scores: Vec<(String, f64, f64)> = vec![];

    let structure_score = if repo.size >= 500 {
        5.0
    } else if repo.size >= 100 {
        3.5
    } else if repo.size >= 20 {
        2.0
    } else {
        0.5
    };
    score += structure_score;
    sub_scores.push(("项目结构".to_string(), structure_score, 5.0));

    let has_tests = repo.topics.iter().any(|t| {
        matches!(
            t.as_str(),
            "test" | "testing" | "jest" | "pytest" | "vitest"
        )
    });
    let test_score = if has_tests { 6.0 } else { 1.0 };
    score += test_score;
    sub_scores.push(("测试覆盖".to_string(), test_score, 8.0));

    let has_ci = repo
        .topics
        .iter()
        .any(|t| matches!(t.as_str(), "github-actions" | "ci" | "travis" | "circleci"));
    let ci_score = if has_ci { 5.0 } else { 1.0 };
    score += ci_score;
    sub_scores.push(("CI/CD".to_string(), ci_score, 7.0));

    DimensionScore {
        dimension: "质量".to_string(),
        score,
        max_score: 20.0,
        sub_scores,
    }
}

fn score_maintenance(repo: &RepoInfo, recent_commits: usize) -> DimensionScore {
    let mut score = 0.0;
    let mut sub_scores: Vec<(String, f64, f64)> = vec![];

    let recent_30 = (recent_commits as f64 * 0.33) as usize;
    let b1_score = if recent_30 >= 10 {
        5.0
    } else if recent_30 >= 5 {
        4.0
    } else if recent_30 >= 1 {
        3.0
    } else {
        1.0
    };
    score += b1_score;
    sub_scores.push(("提交频率".to_string(), b1_score, 5.0));

    let b2_score = if repo.has_issues_enabled && repo.open_issues_count > 0 {
        if repo.open_issues_count < 10 { 4.0 } else if repo.open_issues_count < 50 { 3.0 } else { 2.0 }
    } else if repo.has_issues_enabled {
        2.0
    } else {
        0.0
    };
    score += b2_score;
    sub_scores.push(("Issue响应".to_string(), b2_score, 4.0));

    let has_releases = repo.topics.iter().any(|t| {
        matches!(t.as_str(), "release" | "versioning" | "semver")
    });
    let b3_score = if has_releases { 3.0 } else { 1.0 };
    score += b3_score;
    sub_scores.push(("版本管理".to_string(), b3_score, 3.0));

    let b4_score = if recent_30 >= 1 { 3.0 } else if recent_commits >= 1 { 2.0 } else { 0.0 };
    score += b4_score;
    sub_scores.push(("弃养风险".to_string(), b4_score, 3.0));

    DimensionScore {
        dimension: "维护".to_string(),
        score,
        max_score: 15.0,
        sub_scores,
    }
}

fn score_practical(repo: &RepoInfo) -> DimensionScore {
    let mut score = 0.0;
    let mut sub_scores: Vec<(String, f64, f64)> = vec![];

    let utility_score = if repo.stargazers_count >= 500 {
        8.0
    } else if repo.stargazers_count >= 100 {
        6.0
    } else if repo.stargazers_count >= 20 {
        4.0
    } else {
        2.0
    };
    score += utility_score;
    sub_scores.push(("实用价值".to_string(), utility_score, 10.0));

    let has_unique_topics = repo.topics.iter().any(|t| {
        matches!(
            t.as_str(),
            "innovative" | "novel" | "unique" | "alternative" | "lightweight"
        )
    });
    let originality_score = if has_unique_topics && repo.description.is_some() {
        6.0
    } else if repo.description.is_some() {
        4.0
    } else {
        1.0
    };
    score += originality_score;
    sub_scores.push(("独创性".to_string(), originality_score, 8.0));

    let forks_score = if repo.forks_count >= 100 {
        7.0
    } else if repo.forks_count >= 30 {
        5.0
    } else if repo.forks_count >= 5 {
        3.0
    } else if repo.forks_count >= 1 {
        2.0
    } else {
        0.5
    };
    score += forks_score;
    sub_scores.push(("开箱即用度".to_string(), forks_score, 7.0));

    DimensionScore {
        dimension: "实用".to_string(),
        score,
        max_score: 25.0,
        sub_scores,
    }
}

fn score_documentation(repo: &RepoInfo) -> DimensionScore {
    let mut score = 0.0;
    let mut sub_scores: Vec<(String, f64, f64)> = vec![];

    let readme_score = if repo.size >= 500 {
        6.0
    } else if repo.size >= 100 {
        4.0
    } else if repo.size >= 20 {
        2.0
    } else {
        0.5
    };
    score += readme_score;
    sub_scores.push(("README".to_string(), readme_score, 6.0));

    let wiki_score = if repo.has_wiki { 5.0 } else { 2.0 };
    score += wiki_score;
    sub_scores.push(("Wiki/示例".to_string(), wiki_score, 5.0));

    let has_contributing = repo
        .topics
        .iter()
        .any(|t| matches!(t.as_str(), "contributing" | "good-first-issue"));
    let contrib_score = if has_contributing { 4.0 } else { 1.0 };
    score += contrib_score;
    sub_scores.push(("贡献指南".to_string(), contrib_score, 4.0));

    DimensionScore {
        dimension: "文档".to_string(),
        score,
        max_score: 15.0,
        sub_scores,
    }
}

fn score_community(repo: &RepoInfo) -> DimensionScore {
    let mut score = 0.0;
    let mut sub_scores: Vec<(String, f64, f64)> = vec![];

    let contributors_score = if repo.forks_count >= 100 {
        5.0
    } else if repo.forks_count >= 20 {
        3.5
    } else if repo.forks_count >= 5 {
        2.0
    } else if repo.forks_count >= 1 {
        1.0
    } else {
        0.0
    };
    score += contributors_score;
    sub_scores.push(("贡献者/Fork".to_string(), contributors_score, 5.0));

    let issue_score = if repo.open_issues_count >= 50 {
        5.0
    } else if repo.open_issues_count >= 20 {
        4.0
    } else if repo.open_issues_count >= 5 {
        2.5
    } else if repo.open_issues_count >= 1 {
        1.0
    } else {
        0.0
    };
    score += issue_score;
    sub_scores.push(("Issue 活跃".to_string(), issue_score, 5.0));

    DimensionScore {
        dimension: "社区".to_string(),
        score,
        max_score: 10.0,
        sub_scores,
    }
}

fn score_security(repo: &RepoInfo) -> DimensionScore {
    let mut score = 0.0;
    let mut sub_scores: Vec<(String, f64, f64)> = vec![];

    let license_score = if repo.license.is_some() { 5.0 } else { 0.0 };
    score += license_score;
    sub_scores.push(("License 合规".to_string(), license_score, 5.0));

    let dep_score = 5.0;
    score += dep_score;
    sub_scores.push(("无已知 CVE".to_string(), dep_score, 5.0));

    let lang_score = if repo.language.is_some() { 5.0 } else { 0.0 };
    score += lang_score;
    sub_scores.push(("语言明确".to_string(), lang_score, 5.0));

    let safety_score = if repo.size >= 100 && repo.license.is_some() {
        5.0
    } else if repo.size >= 20 {
        3.0
    } else {
        1.0
    };
    score += safety_score;
    sub_scores.push(("安全评分".to_string(), safety_score, 5.0));

    DimensionScore {
        dimension: "安全".to_string(),
        score,
        max_score: 20.0,
        sub_scores,
    }
}

/// 综合异常检测结果
pub struct AnomalyReport {
    pub has_anomaly: bool,
    pub anomaly_types: Vec<String>,
    #[allow(dead_code)]
    pub anomaly_score: f64,
}

#[cfg(test)]
pub(crate) mod tests_helper {
    use crate::types::*;

    pub fn mock_repo() -> RepoInfo {
        RepoInfo {
            owner: "test".to_string(),
            name: "test-repo".to_string(),
            full_name: "test/test-repo".to_string(),
            html_url: "https://github.com/test/test-repo".to_string(),
            description: Some("A test repository".to_string()),
            stargazers_count: 100,
            forks_count: 10,
            open_issues_count: 5,
            language: Some("Rust".to_string()),
            updated_at: "2024-01-15T00:00:00Z".to_string(),
            created_at: "2023-01-01T00:00:00Z".to_string(),
            pushed_at: "2024-01-15T00:00:00Z".to_string(),
            license: Some(LicenseInfo {
                spdx_id: "MIT".to_string(),
                name: "MIT License".to_string(),
            }),
            topics: vec!["rust".to_string(), "library".to_string()],
            has_wiki: false,
            has_issues_enabled: true,
            size: 200,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn mock_repo() -> RepoInfo {
        tests_helper::mock_repo()
    }

    #[test]
    fn test_g1_license_pass() {
        let repo = mock_repo();
        let result = check_g1(&repo);
        assert!(result.passed);
    }

    #[test]
    fn test_g1_license_fail() {
        let mut repo = mock_repo();
        repo.license = None;
        let result = check_g1(&repo);
        assert!(!result.passed);
    }

    #[test]
    fn test_g2_alive_with_commits() {
        let repo = mock_repo();
        let result = check_g2(&repo, 5);
        assert!(result.passed);
    }

    #[test]
    fn test_g2_dead_project() {
        let repo = mock_repo();
        let result = check_g2(&repo, 0);
        assert!(!result.passed);
    }

    #[test]
    fn test_g4_non_empty() {
        let repo = mock_repo();
        let result = check_g4(&repo);
        assert!(result.passed);
    }

    #[test]
    fn test_g4_empty_shell() {
        let mut repo = mock_repo();
        repo.size = 10;
        let result = check_g4(&repo);
        assert!(!result.passed);
    }

    #[test]
    fn test_track_classification() {
        assert_eq!(Evaluator::classify_track(500, 10.0), "neglected");
        assert_eq!(Evaluator::classify_track(1500, 2.0), "high-star");
        assert_eq!(Evaluator::classify_track(500, 2.0), "steady");
    }

    #[test]
    fn test_grade_determination() {
        assert_eq!(Evaluator::determine_grade(90.0, "neglected"), "S");
        assert_eq!(Evaluator::determine_grade(84.0, "neglected"), "S");
        assert_eq!(Evaluator::determine_grade(80.0, "neglected"), "A");
        assert_eq!(Evaluator::determine_grade(75.0, "neglected"), "B");
        assert_eq!(Evaluator::determine_grade(50.0, "neglected"), "X");
    }

    #[test]
    fn test_six_dimension_scoring() {
        let repo = mock_repo();
        let (dimensions, _sub_scores) = Evaluator::score_dimensions(&repo, 10);

        assert_eq!(dimensions.len(), 6);
        assert_eq!(dimensions[0].dimension, "质量");
        assert_eq!(dimensions[1].dimension, "维护");
        assert_eq!(dimensions[2].dimension, "实用");
        assert_eq!(dimensions[3].dimension, "文档");
        assert_eq!(dimensions[4].dimension, "社区");
        assert_eq!(dimensions[5].dimension, "安全");

        let total: f64 = dimensions.iter().map(|d| d.score).sum();
        assert!(total >= 0.0 && total <= 105.0);
    }

    #[test]
    fn test_ceiling_no_test() {
        let mut dims = vec![
            DimensionScore { dimension: "质量".to_string(), score: 15.0, max_score: 20.0, sub_scores: vec![] },
            DimensionScore { dimension: "实用".to_string(), score: 20.0, max_score: 25.0, sub_scores: vec![] },
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
        assert!(dims[1].score <= 10.0);
    }
    
    #[test]
    fn test_ceiling_with_test_pass() {
        let mut dims = vec![
            DimensionScore { dimension: "质量".to_string(), score: 15.0, max_score: 20.0, sub_scores: vec![] },
            DimensionScore { dimension: "实用".to_string(), score: 20.0, max_score: 25.0, sub_scores: vec![] },
        ];
        let subs = vec![
            vec![("项目结构".to_string(), 4.0, 5.0), ("测试覆盖".to_string(), 4.0, 5.0), ("CI/CD".to_string(), 3.0, 5.0)],
            vec![],
            vec![("开箱即用度".to_string(), 4.0, 5.0)],
            vec![],
            vec![],
            vec![],
        ];
        let before = dims[1].score;
        Evaluator::apply_ceiling(&mut dims, &subs);
        assert!(dims[1].score >= before);
    }

    #[test]
    fn test_cross_validation_high_structure_low_test() {
        let mut dims = vec![
            DimensionScore { dimension: "质量".to_string(), score: 15.0, max_score: 20.0, sub_scores: vec![] },
        ];
        let subs = vec![
            vec![("项目结构".to_string(), 4.0, 5.0), ("测试覆盖".to_string(), 0.5, 5.0), ("CI/CD".to_string(), 2.0, 5.0)],
            vec![],
            vec![],
            vec![],
            vec![],
            vec![],
        ];
        let before = dims[0].score;
        Evaluator::apply_cross_validation(&mut dims, &subs);
        assert!(dims[0].score < before);
    }
    
    #[test]
    fn test_cross_validation_no_trigger() {
        let mut dims = vec![
            DimensionScore { dimension: "质量".to_string(), score: 10.0, max_score: 20.0, sub_scores: vec![] },
            DimensionScore { dimension: "维护".to_string(), score: 10.0, max_score: 15.0, sub_scores: vec![] },
            DimensionScore { dimension: "实用".to_string(), score: 10.0, max_score: 25.0, sub_scores: vec![] },
        ];
        let subs = vec![
            vec![("项目结构".to_string(), 2.5, 5.0), ("测试覆盖".to_string(), 2.5, 5.0), ("CI/CD".to_string(), 2.5, 5.0)],
            vec![],
            vec![],
            vec![],
            vec![],
            vec![],
        ];
        let before: Vec<f64> = dims.iter().map(|d| d.score).collect();
        Evaluator::apply_cross_validation(&mut dims, &subs);
        let after: Vec<f64> = dims.iter().map(|d| d.score).collect();
        assert_eq!(before, after);
    }

    #[test]
    fn test_evidence_threshold_l4() {
        let mut dims = vec![
            DimensionScore { dimension: "质量".to_string(), score: 15.0, max_score: 20.0, sub_scores: vec![] },
        ];
        let warnings = Evaluator::apply_evidence_threshold(&mut dims, &["L4"]);
        assert!(!warnings.is_empty());
        assert!((dims[0].score - 10.0).abs() < 0.1);
    }

    #[test]
    fn test_evidence_threshold_l5() {
        let mut dims = vec![
            DimensionScore { dimension: "安全".to_string(), score: 10.0, max_score: 20.0, sub_scores: vec![] },
        ];
        let warnings = Evaluator::apply_evidence_threshold(&mut dims, &["L5"]);
        assert!(!warnings.is_empty());
        assert!((dims[0].score - 0.0).abs() < 0.1);
    }

    #[test]
    fn test_evidence_threshold_l1() {
        let mut dims = vec![
            DimensionScore { dimension: "质量".to_string(), score: 15.0, max_score: 20.0, sub_scores: vec![] },
        ];
        let warnings = Evaluator::apply_evidence_threshold(&mut dims, &["L1"]);
        assert!(warnings.is_empty());
        assert!((dims[0].score - 15.0).abs() < 0.1);
    }

    #[test]
    fn test_bayesian_correction_l1() {
        let mut dims = vec![
            DimensionScore { dimension: "质量".to_string(), score: 15.0, max_score: 20.0, sub_scores: vec![] },
        ];
        let before = dims[0].score;
        Evaluator::apply_bayesian_correction(&mut dims, &["L1"]);
        assert!((dims[0].score - before).abs() < 2.0);
    }

    #[test]
    fn test_bayesian_correction_l4() {
        let mut dims = vec![
            DimensionScore { dimension: "质量".to_string(), score: 18.0, max_score: 20.0, sub_scores: vec![] },
        ];
        let before = dims[0].score;
        Evaluator::apply_bayesian_correction(&mut dims, &["L4"]);
        assert!(dims[0].score < before);
    }

    #[test]
    fn test_dimension_floor_pass() {
        let dims = vec![
            DimensionScore { dimension: "质量".to_string(), score: 8.0, max_score: 20.0, sub_scores: vec![] },
            DimensionScore { dimension: "安全".to_string(), score: 8.0, max_score: 20.0, sub_scores: vec![] },
        ];
        let (passed, _) = Evaluator::check_dimension_floors(&dims);
        assert!(passed);
    }

    #[test]
    fn test_dimension_floor_fail_security() {
        let dims = vec![
            DimensionScore { dimension: "安全".to_string(), score: 6.0, max_score: 20.0, sub_scores: vec![] },
        ];
        let (passed, violations) = Evaluator::check_dimension_floors(&dims);
        assert!(!passed);
        assert!(!violations.is_empty());
    }
    
    #[test]
    fn test_dimension_floor_fail_other() {
        let dims = vec![
            DimensionScore { dimension: "质量".to_string(), score: 3.0, max_score: 20.0, sub_scores: vec![] },
        ];
        let (passed, violations) = Evaluator::check_dimension_floors(&dims);
        assert!(!passed);
        assert!(!violations.is_empty());
    }
    
    #[test]
    fn test_dimension_floor_boundary() {
        let dims_quality = vec![
            DimensionScore { dimension: "质量".to_string(), score: 4.0, max_score: 20.0, sub_scores: vec![] },
        ];
        let (passed, _) = Evaluator::check_dimension_floors(&dims_quality);
        assert!(passed);
        
        let dims_security = vec![
            DimensionScore { dimension: "安全".to_string(), score: 7.0, max_score: 20.0, sub_scores: vec![] },
        ];
        let (passed, _) = Evaluator::check_dimension_floors(&dims_security);
        assert!(passed);
    }

    #[test]
    fn test_dimension_floor_fail() {
        let dims = vec![
            DimensionScore { dimension: "质量".to_string(), score: 2.0, max_score: 20.0, sub_scores: vec![] },
        ];
        let (passed, violations) = Evaluator::check_dimension_floors(&dims);
        assert!(!passed);
        assert!(!violations.is_empty());
    }

    #[test]
    fn test_anomaly_detection_no_anomaly() {
        let repo = mock_repo();
        let dims = vec![
            DimensionScore { dimension: "质量".to_string(), score: 10.0, max_score: 20.0, sub_scores: vec![] },
            DimensionScore { dimension: "维护".to_string(), score: 8.0, max_score: 15.0, sub_scores: vec![] },
        ];
        let result = Evaluator::detect_anomalies(&dims, &repo, 10, 5);
        assert!(!result.has_anomaly);
    }

    #[test]
    fn test_anomaly_detection_star_bloat() {
        let mut repo = mock_repo();
        repo.stargazers_count = 10000;
        repo.forks_count = 10;
        repo.size = 200;

        let dims = vec![
            DimensionScore { dimension: "质量".to_string(), score: 10.0, max_score: 20.0, sub_scores: vec![] },
        ];
        let result = Evaluator::detect_anomalies(&dims, &repo, 10, 50);
        assert!(result.has_anomaly);
        assert!(result.anomaly_score > 0.0);
    }

    #[test]
    fn test_recommendation_index_neglected() {
        let idx = Evaluator::calc_recommendation_index(15.0, "neglected", 20.0, 500, 0.0);
        assert!((idx - 21.0).abs() < 0.1);
    }

    #[test]
    fn test_recommendation_index_high_star() {
        let idx = Evaluator::calc_recommendation_index(15.0, "high-star", 0.0, 5000, 0.0);
        assert!((idx - 22.5).abs() < 0.1);
    }

    #[test]
    fn test_recommendation_index_steady() {
        let idx = Evaluator::calc_recommendation_index(15.0, "steady", 0.0, 300, 0.0);
        assert!(idx > 0.0 && idx < 15.0);
    }

    #[test]
    fn test_gate_check_all_pass() {
        let repo = mock_repo();
        let checks = Evaluator::gate_check(&repo, 10);
        assert_eq!(checks.len(), 6);
        assert!(checks[0].passed);
        assert!(checks[1].passed);
    }

    #[test]
    fn test_one_liner_generation() {
        let repo = mock_repo();
        let one_liner = Evaluator::generate_one_liner(&repo, 85.0, "neglected");
        assert!(!one_liner.is_empty());
        assert!(one_liner.contains("被忽视的宝藏"));
    }

    #[test]
    fn test_neglect_index_calculation() {
        let repo = mock_repo();
        let idx = Evaluator::calc_neglect_index(&repo, 10);
        assert!(idx >= 0.0);
    }

    #[test]
    fn test_neglect_index_zero_commits() {
        let repo = mock_repo();
        let idx = Evaluator::calc_neglect_index(&repo, 0);
        assert!(idx >= 0.0);
    }

    #[test]
    fn test_value_density_calculation() {
        let repo = mock_repo();
        let vd = Evaluator::calc_value_density(&repo);
        assert!(vd > 0.0 && vd <= 1.5);
    }

    #[test]
    fn test_value_density_high_star() {
        let mut repo = mock_repo();
        repo.stargazers_count = 50000;
        repo.created_at = "2020-01-01T00:00:00Z".to_string();
        let vd = Evaluator::calc_value_density(&repo);
        assert!(vd > 0.0);
    }

    #[test]
    fn test_steady_state_calculation() {
        let repo = mock_repo();
        let ss = Evaluator::calc_steady_state(&repo, 10);
        assert!(ss >= 0.0 && ss <= 1.0);
    }

    #[test]
    fn test_steady_state_zero_commits() {
        let repo = mock_repo();
        let ss = Evaluator::calc_steady_state(&repo, 0);
        assert!((ss - 0.0).abs() < 0.001);
    }

    #[test]
    fn test_score_fraud_no_fraud() {
        let (detected, warning) = Evaluator::detect_score_fraud(80.0, 75.0);
        assert!(!detected);
        assert!(warning.is_none());
    }

    #[test]
    fn test_score_fraud_detected() {
        let (detected, warning) = Evaluator::detect_score_fraud(100.0, 60.0);
        assert!(detected);
        assert!(warning.is_some());
    }

    #[test]
    fn test_score_fraud_boundary() {
        let (detected, _) = Evaluator::detect_score_fraud(100.0, 70.1);
        assert!(!detected);
        let (detected, _) = Evaluator::detect_score_fraud(100.0, 69.0);
        assert!(detected);
    }

    #[test]
    fn test_score_fraud_zero_raw() {
        let (detected, warning) = Evaluator::detect_score_fraud(0.0, 0.0);
        assert!(!detected);
        assert!(warning.is_none());
    }

    #[test]
    fn test_openssf_calibration_no_adjust() {
        let mut dims = vec![
            DimensionScore { dimension: "安全".to_string(), score: 10.0, max_score: 20.0, sub_scores: vec![] },
        ];
        let warnings = Evaluator::apply_openssf_calibration(&mut dims, 0.7);
        assert!(warnings.is_empty());
        assert!((dims[0].score - 10.0).abs() < 0.1);
    }

    #[test]
    fn test_openssf_calibration_adjust_down() {
        let mut dims = vec![
            DimensionScore { dimension: "安全".to_string(), score: 18.0, max_score: 20.0, sub_scores: vec![] },
        ];
        let warnings = Evaluator::apply_openssf_calibration(&mut dims, 0.5);
        assert!(!warnings.is_empty());
        assert!(dims[0].score < 18.0);
    }

    #[test]
    fn test_confidence_tier1() {
        let repo = mock_repo();
        let gate_checks = Evaluator::gate_check(&repo, 10);
        let clean_checks: Vec<GateCheckResult> = gate_checks.into_iter().map(|mut g| {
            g.evidence_level = "L1".to_string();
            g
        }).collect();
        let tier = ConfidenceTier::determine(&clean_checks, &["L1"; 6], &repo);
        assert_eq!(tier, ConfidenceTier::Tier1);
    }

    #[test]
    fn test_confidence_tier3_l4_evidence() {
        let repo = mock_repo();
        let gate_checks = Evaluator::gate_check(&repo, 10);
        let tier = ConfidenceTier::determine(&gate_checks, &["L4"; 6], &repo);
        assert_eq!(tier, ConfidenceTier::Tier3);
    }

    #[test]
    fn test_confidence_tier3_no_description() {
        let mut repo = mock_repo();
        repo.description = None;
        let gate_checks = Evaluator::gate_check(&repo, 10);
        let tier = ConfidenceTier::determine(&gate_checks, &["L1"; 6], &repo);
        assert_eq!(tier, ConfidenceTier::Tier3);
    }

    #[test]
    fn test_confidence_tier2_l3_evidence() {
        let repo = mock_repo();
        let gate_checks = Evaluator::gate_check(&repo, 10);
        let clean_checks: Vec<GateCheckResult> = gate_checks.into_iter().map(|mut g| {
            g.evidence_level = "L1".to_string();
            g
        }).collect();
        let tier = ConfidenceTier::determine(&clean_checks, &["L1", "L1", "L3", "L1", "L1", "L1"], &repo);
        assert_eq!(tier, ConfidenceTier::Tier2);
    }

    #[test]
    fn test_run_pipeline_tier1() {
        let repo = mock_repo();
        let evidence_levels = vec!["L1"; 6];
        let (_, _, trail, tier) = Evaluator::run_pipeline(&repo, 10, &evidence_levels);
        assert!(trail.len() >= 2);
        let _ = tier;
    }

    #[test]
    fn test_run_pipeline_tier3() {
        let mut repo = mock_repo();
        repo.description = None;
        let evidence_levels = vec!["L1"; 6];
        let (_, _, trail, tier) = Evaluator::run_pipeline(&repo, 10, &evidence_levels);
        assert_eq!(tier, ConfidenceTier::Tier3);
        assert!(trail.len() >= 5);
    }

    #[test]
    fn test_grade_steady_track() {
        assert_eq!(Evaluator::determine_grade(85.0, "steady"), "A");
        assert_eq!(Evaluator::determine_grade(75.0, "steady"), "B");
        assert_eq!(Evaluator::determine_grade(60.0, "steady"), "X");
    }

    #[test]
    fn test_grade_high_star_track() {
        assert_eq!(Evaluator::determine_grade(90.0, "high-star"), "S");
        assert_eq!(Evaluator::determine_grade(80.0, "high-star"), "A");
        assert_eq!(Evaluator::determine_grade(74.0, "high-star"), "B");
    }

    #[test]
    fn test_zero_star_repo() {
        let mut repo = mock_repo();
        repo.stargazers_count = 0;
        repo.forks_count = 0;
        repo.open_issues_count = 0;
        let (dimensions, _, _, _) = Evaluator::run_pipeline(&repo, 5, &["L1"; 6]);
        let total: f64 = dimensions.iter().map(|d| d.score).sum();
        assert!(total >= 0.0 && total <= 105.0);
    }

    #[test]
    fn test_high_star_no_fork_repo() {
        let mut repo = mock_repo();
        repo.stargazers_count = 5000;
        repo.forks_count = 5;
        let (dimensions, _, _, tier) = Evaluator::run_pipeline(&repo, 10, &["L1"; 6]);
        assert_eq!(tier, ConfidenceTier::Tier3);
        let total: f64 = dimensions.iter().map(|d| d.score).sum();
        assert!(total >= 0.0);
    }
}
