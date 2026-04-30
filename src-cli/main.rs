use clap::{Parser, Subcommand};
use ralph_core::database::Database;
use ralph_core::evaluator::Evaluator;
use ralph_core::github::GitHubClient;
use ralph_core::types::{EvaluationReport, RepoInfo};
use std::fs;

#[derive(Parser)]
#[command(name = "ralph")]
#[command(about = "Ralph - GitHub 高质量项目发现与评估工具")]
#[command(version)]
struct Cli {
    /// GitHub Personal Access Token（可选，可通过 GITHUB_TOKEN 环境变量设置）
    #[arg(long, env = "GITHUB_TOKEN")]
    token: Option<String>,

    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// 搜索并评估 GitHub 项目
    Search {
        /// 搜索关键词（如 "rust logging"）
        query: String,
        /// 返回结果数量
        #[arg(short, long, default_value = "5")]
        count: u8,
        /// 输出格式
        #[arg(short, long, default_value = "table")]
        format: String,
    },
    /// 批量评估项目（≥30 个项目，启用完整异常检测）
    Batch {
        /// 搜索关键词
        query: String,
        /// 评估项目数量（最小 30）
        #[arg(short, long, default_value = "30")]
        count: u8,
        /// 输出文件路径（JSON 格式）
        #[arg(short, long)]
        output: Option<String>,
    },
    /// 查看缓存的项目
    Cached {
        /// 显示数量
        #[arg(short, long, default_value = "10")]
        limit: usize,
    },
    /// 搜索历史记录
    History {
        /// 显示数量
        #[arg(short, long, default_value = "20")]
        limit: usize,
    },
    /// 清理缓存
    Clean,
    /// 版本信息
    Version,
}

/// 评估结果统计
#[derive(Debug, Default)]
struct EvaluationStats {
    total: usize,
    evaluated: usize,
    skipped: usize,
    s_grade: usize,
    a_grade: usize,
    b_grade: usize,
}

impl EvaluationStats {
    fn update(&mut self, report: &EvaluationReport) {
        self.evaluated += 1;
        match report.grade.as_str() {
            "S" => self.s_grade += 1,
            "A" => self.a_grade += 1,
            "B" => self.b_grade += 1,
            _ => {}
        }
    }

    fn print_summary(&self) {
        println!("📊 评估统计");
        println!("   总共处理: {} 个项目", self.total);
        println!("   通过评估: {} 个项目", self.evaluated);
        println!("   已跳过: {} 个项目", self.skipped);
        println!("   S级推荐: {}", self.s_grade);
        println!("   A级推荐: {}", self.a_grade);
        println!("   B级推荐: {}", self.b_grade);
    }
}

/// 获取数据库实例，带错误处理
fn get_db() -> Result<Database, String> {
    let app_data = dirs::data_local_dir()
        .unwrap_or_else(|| std::env::temp_dir())
        .join("ralph");
    
    fs::create_dir_all(&app_data)
        .map_err(|e| format!("创建数据目录失败: {}", e))?;
    
    let db_path = app_data.join("ralph.db");
    let db_path_str = db_path
        .to_str()
        .ok_or("无效的数据库路径")?;
    
    Database::new(db_path_str)
        .map_err(|e| format!("初始化数据库失败: {}", e))
}

/// 评估单个项目
async fn evaluate_repo(
    repo: &RepoInfo,
    github_client: &GitHubClient,
    total_count: usize,
) -> Result<EvaluationReport, String> {
    let recent_commits = github_client
        .get_recent_commits(&repo.owner, &repo.name)
        .await
        .unwrap_or(0);

    let gate_checks = Evaluator::gate_check(repo, recent_commits);
    let g1_passed = gate_checks.first().map(|g| g.passed).unwrap_or(false);
    let g2_passed = gate_checks.get(1).map(|g| g.passed).unwrap_or(false);
    
    if !g1_passed || !g2_passed {
        return Err("未通过入场门槛".to_string());
    }

    let neglect_index = Evaluator::calc_neglect_index(repo, recent_commits);
    let track = Evaluator::classify_track(repo.stargazers_count, neglect_index);

    let evidence_levels = vec!["L1"; 6];
    let (dimensions, _sub_scores, decision_trail, confidence_tier) =
        Evaluator::run_pipeline(repo, recent_commits, &evidence_levels);
    let raw_total = decision_trail.first().map(|s| s.before).unwrap_or(0.0);
    let cred_disqualified = decision_trail.iter()
        .any(|s| s.step == "声明可信度" && s.before - s.after > 5.0);

    let total_score: f64 = dimensions.iter().map(|d| d.score).sum();

    let mut veto_flags = vec![];
    if cred_disqualified {
        veto_flags.push("声明可信度过低，触发❌8 虚假宣传".to_string());
    }

    let (floor_passed, floor_violations) = Evaluator::check_dimension_floors(&dimensions);
    if !floor_passed {
        for v in &floor_violations {
            veto_flags.push(format!("维度地板违规: {}", v));
        }
    }

    let anomaly_report = Evaluator::detect_anomalies(&dimensions, repo, recent_commits, total_count);
    if anomaly_report.has_anomaly {
        for a in &anomaly_report.anomaly_types {
            veto_flags.push(format!("异常检测: {}", a));
        }
    }

    let value_density = if track == "high-star" {
        Evaluator::calc_value_density(repo)
    } else {
        1.0
    };
    let steady_state = if track == "steady" {
        Evaluator::calc_steady_state(repo, recent_commits)
    } else {
        1.0
    };

    let (fraud_detected, fraud_warning) = Evaluator::detect_score_fraud(raw_total, total_score);
    if fraud_detected {
        if let Some(w) = fraud_warning {
            veto_flags.push(w);
        }
    }

    let grade = if !veto_flags.is_empty() {
        "X".to_string()
    } else {
        Evaluator::determine_grade(total_score, &track)
    };

    let quality_score = dimensions.iter()
        .find(|d| d.dimension == "质量")
        .map(|d| d.score)
        .unwrap_or(0.0);
    
    let mutation_ratio = calculate_mutation_ratio(recent_commits);
    let recommendation_index = Evaluator::calc_recommendation_index(
        quality_score, &track, neglect_index, repo.stargazers_count, mutation_ratio,
    );

    let trust_badge = Evaluator::build_trust_badge(&gate_checks, &dimensions, total_score);
    let one_liner = Evaluator::generate_one_liner(repo, total_score, &track);

    Ok(EvaluationReport {
        repo: repo.clone(),
        one_liner,
        track,
        grade,
        total_score,
        recommendation_index,
        dimensions,
        gate_checks,
        neglect_index,
        value_density: Some(value_density),
        steady_state: Some(steady_state),
        trust_badge,
        evidence_level: "L1".to_string(),
        veto_flags,
        confidence_tier: confidence_tier.as_str().to_string(),
        decision_trail,
    })
}

/// 计算突变率
fn calculate_mutation_ratio(recent_commits: usize) -> f64 {
    let recent_30 = (recent_commits as f64 * 0.33) as usize;
    let prev_90_daily = (recent_commits as f64 * 0.67) / 3.0;
    if prev_90_daily > 0.0 {
        recent_30 as f64 / prev_90_daily
    } else {
        0.0
    }
}

/// 批量评估项目
async fn evaluate_repos_batch(
    repos: &[RepoInfo],
    github_client: &GitHubClient,
    show_progress: bool,
) -> (Vec<EvaluationReport>, EvaluationStats) {
    let mut results = Vec::new();
    let mut stats = EvaluationStats {
        total: repos.len(),
        ..Default::default()
    };

    for (i, repo) in repos.iter().enumerate() {
        match evaluate_repo(repo, github_client, repos.len()).await {
            Ok(report) => {
                results.push(report);
                stats.update(&results.last().unwrap());
            }
            Err(_) => {
                stats.skipped += 1;
            }
        }

        if show_progress {
            print!("\r进度: {}/{} (已通过: {}, 已跳过: {})", 
                i + 1, repos.len(), stats.evaluated, stats.skipped);
        }
    }
    
    if show_progress {
        println!();
    }

    (results, stats)
}

/// 保存结果到数据库
fn save_results(db: &Database, query: &str, results: &[EvaluationReport]) -> Result<(), String> {
    db.log_search(query, results.len() as i32)
        .map_err(|e| format!("记录搜索历史失败: {}", e))?;
    
    for report in results {
        db.cache_evaluation(report)
            .map_err(|e| format!("缓存评估结果失败: {}", e))?;
    }
    
    Ok(())
}

/// 输出结果为表格格式
fn output_table(results: &[EvaluationReport]) {
    println!("{:<40} {:>8} {:>10} {:>10} {:>12}", 
        "项目", "⭐ Stars", "评分", "等级", "轨道");
    println!("{}", "-".repeat(85));
    
    for r in results {
        let track_label = match r.track.as_str() {
            "neglected" => "被忽视",
            "high-star" => "高星",
            "steady" => "稳态",
            _ => "未知",
        };
        
        println!("{:<40} {:>8} {:>10.1} {:>10} {:>12}",
            r.repo.full_name,
            r.repo.stargazers_count,
            r.total_score,
            r.grade,
            track_label
        );
    }
    
    println!("\n共评估 {} 个项目", results.len());
}

/// 输出结果为JSON格式
fn output_json(results: &[EvaluationReport]) -> String {
    let json_results: Vec<_> = results.iter()
        .map(|r| serde_json::to_value(r).unwrap_or_default())
        .collect();
    
    serde_json::to_string_pretty(&serde_json::json!({
        "results": json_results,
        "totalEvaluated": results.len()
    }))
    .unwrap_or_default()
}

/// 搜索命令
async fn search(query: &str, count: u8, format: &str, token: Option<&str>) {
    println!("🔍 搜索: {}\n", query);

    let github_client = GitHubClient::new(token.map(|s| s.to_string()));
        let repos = match github_client.search_repos(query, count).await {
            Ok(r) => r,
            Err(e) => {
                eprintln!("❌ 搜索失败: {}", e);
                return;
            }
        };

        println!("找到 {} 个项目\n", repos.len());

        let (results, _) = evaluate_repos_batch(&repos, &github_client, false).await;

    let db = match get_db() {
        Ok(db) => db,
        Err(e) => {
            eprintln!("⚠️ 数据库初始化失败: {}", e);
            return;
        }
    };

    if let Err(e) = save_results(&db, query, &results) {
        eprintln!("⚠️ 保存结果失败: {}", e);
    }

    match format {
        "json" => println!("{}", output_json(&results)),
        _ => output_table(&results),
    }
}

/// 批量命令
async fn batch(query: &str, count: u8, output: Option<&str>, token: Option<&str>) {
    println!("📦 批量评估: {} (count: {})\n", query, count);

    let total = count.max(30);
        let github_client = GitHubClient::new(token.map(|s| s.to_string()));
        
        let repos = match github_client.search_repos(query, total).await {
            Ok(r) => r,
            Err(e) => {
                eprintln!("❌ 搜索失败: {}", e);
                return;
            }
        };

        println!("找到 {} 个项目，开始评估...\n", repos.len());

        let (results, stats) = evaluate_repos_batch(&repos, &github_client, true).await;
    println!();

    let db = match get_db() {
        Ok(db) => db,
        Err(e) => {
            eprintln!("⚠️ 数据库初始化失败: {}", e);
            return;
        }
    };

    if let Err(e) = save_results(&db, query, &results) {
        eprintln!("⚠️ 保存结果失败: {}", e);
    }

    stats.print_summary();

    if let Some(path) = output {
        let output_data = serde_json::json!({
            "results": results.iter().map(|r| serde_json::to_value(r).unwrap_or_default()).collect::<Vec<_>>(),
            "meta": {
                "totalProcessed": repos.len(),
                "totalEvaluated": results.len(),
                "totalSkipped": stats.skipped
            }
        });
        
        match serde_json::to_string_pretty(&output_data) {
            Ok(json) => {
                if let Err(e) = fs::write(path, json) {
                    eprintln!("❌ 写入输出文件失败: {}", e);
                } else {
                    println!("\n💾 结果已保存到: {}", path);
                }
            }
            Err(e) => eprintln!("❌ JSON序列化失败: {}", e),
        }
    }
}

/// 缓存命令
fn cached(limit: usize) {
    println!("📋 最近缓存的项目 (最多 {} 条)\n", limit);

    let db = match get_db() {
        Ok(db) => db,
        Err(e) => {
            eprintln!("❌ 数据库初始化失败: {}", e);
            return;
        }
    };

    let projects = match db.get_recent_cached(limit) {
        Ok(p) => p,
        Err(e) => {
            eprintln!("❌ 获取缓存失败: {}", e);
            return;
        }
    };

    if projects.is_empty() {
        println!("(无缓存数据)");
        return;
    }

    println!("{:<40} {:>8} {:>10} {:>10} {:>20}", 
        "项目", "⭐ Stars", "评分", "等级", "评估时间");
    println!("{}", "-".repeat(95));
    
    for p in &projects {
        println!("{:<40} {:>8} {:>10.1} {:>10} {:>20}",
            p.repo.full_name,
            p.repo.stargazers_count,
            p.total_score,
            p.grade,
            "N/A"
        );
    }
    
    println!("\n共 {} 个缓存项目", projects.len());
}

/// 历史命令
fn history(limit: usize) {
    println!("📜 搜索历史 (最多 {} 条)\n", limit);

    let db = match get_db() {
        Ok(db) => db,
        Err(e) => {
            eprintln!("❌ 数据库初始化失败: {}", e);
            return;
        }
    };

    let history_items = match db.get_search_history(limit) {
        Ok(h) => h,
        Err(e) => {
            eprintln!("❌ 获取历史失败: {}", e);
            return;
        }
    };

    if history_items.is_empty() {
        println!("(无搜索历史)");
        return;
    }

    println!("{:<40} {:>10} {:>25}", "搜索关键词", "结果数", "时间");
    println!("{}", "-".repeat(80));
    
    for item in &history_items {
        let query = item.get("query").and_then(|v| v.as_str()).unwrap_or("unknown");
        let count = item.get("resultCount").and_then(|v| v.as_i64()).unwrap_or(0);
        let timestamp = item.get("timestamp").and_then(|v| v.as_str()).unwrap_or("unknown");
        println!("{:<40} {:>10} {:>25}", query, count, timestamp);
    }
    
    println!("\n共 {} 条搜索历史", history_items.len());
}

/// 清理命令
fn clean() {
    println!("🧹 清理缓存...\n");
    
    let db = match get_db() {
        Ok(db) => db,
        Err(e) => {
            eprintln!("❌ 数据库初始化失败: {}", e);
            return;
        }
    };

    match db.clear_search_history() {
        Ok(_) => println!("✅ 搜索历史已清理"),
        Err(e) => eprintln!("❌ 清理失败: {}", e),
    }
}

#[tokio::main]
async fn main() {
    let cli = Cli::parse();
    
    match cli.command {
        Commands::Search { query, count, format } => {
            search(&query, count, &format, cli.token.as_deref()).await;
        }
        Commands::Batch { query, count, output } => {
            batch(&query, count, output.as_deref(), cli.token.as_deref()).await;
        }
        Commands::Cached { limit } => {
            cached(limit);
        }
        Commands::History { limit } => {
            history(limit);
        }
        Commands::Clean => {
            clean();
        }
        Commands::Version => {
            println!("ralph-cli v{}", env!("CARGO_PKG_VERSION"));
        }
    }
}
