use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CodeQualityReport {
    pub has_ci: bool,
    pub ci_systems: Vec<String>,
    pub has_tests: bool,
    pub test_frameworks: Vec<String>,
    pub has_linting: bool,
    pub lint_tools: Vec<String>,
    pub has_formatting_config: bool,
    pub has_contributing_guide: bool,
    pub has_code_of_conduct: bool,
    pub has_changelog: bool,
    pub code_organization_score: f64,
    pub overall_quality_score: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DependencyAudit {
    pub has_dependency_file: bool,
    pub dependency_files: Vec<String>,
    pub total_dependencies: u32,
    pub direct_dependencies: u32,
    pub dev_dependencies: u32,
    pub has_lockfile: bool,
    pub dependency_health_score: f64,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeepAnalysisReport {
    pub repo_full_name: String,
    pub code_quality: CodeQualityReport,
    pub dependency_audit: DependencyAudit,
    pub generated_at: String,
}

pub struct DeepAnalyzer;

impl DeepAnalyzer {
    pub fn analyze_file_tree(repo_full_name: &str, tree: &[String]) -> DeepAnalysisReport {
        let code_quality = Self::analyze_code_quality(tree);
        let dependency_audit = Self::audit_dependencies(tree);

        DeepAnalysisReport {
            repo_full_name: repo_full_name.to_string(),
            code_quality,
            dependency_audit,
            generated_at: chrono::Utc::now().to_rfc3339(),
        }
    }

    fn analyze_code_quality(tree: &[String]) -> CodeQualityReport {
        let mut ci_systems = Vec::new();
        let mut test_frameworks = Vec::new();
        let mut lint_tools = Vec::new();

        let mut has_contributing_guide = false;
        let mut has_code_of_conduct = false;
        let mut has_changelog = false;
        let mut has_formatting_config = false;

        for path in tree {
            let lower = path.to_lowercase();

            if lower.contains(".github/workflows/") {
                if !ci_systems.contains(&"GitHub Actions".to_string()) {
                    ci_systems.push("GitHub Actions".to_string());
                }
            }
            if lower.contains("circleci/") || lower.contains(".circleci/") {
                if !ci_systems.contains(&"CircleCI".to_string()) {
                    ci_systems.push("CircleCI".to_string());
                }
            }
            if lower.contains(".travis.yml") {
                if !ci_systems.contains(&"Travis CI".to_string()) {
                    ci_systems.push("Travis CI".to_string());
                }
            }
            if lower.contains("jenkins") {
                if !ci_systems.contains(&"Jenkins".to_string()) {
                    ci_systems.push("Jenkins".to_string());
                }
            }

            if lower.contains("_test.") || lower.contains("_spec.") || lower.contains(".test.") || lower.contains(".spec.") {
                if lower.contains(".rs") && !test_frameworks.contains(&"Rust tests".to_string()) {
                    test_frameworks.push("Rust tests".to_string());
                }
                if (lower.contains(".ts") || lower.contains(".tsx")) && !test_frameworks.contains(&"TypeScript tests".to_string()) {
                    test_frameworks.push("TypeScript tests".to_string());
                }
                if lower.contains(".py") && !test_frameworks.contains(&"Python tests".to_string()) {
                    test_frameworks.push("Python tests".to_string());
                }
                if lower.contains(".go") && !test_frameworks.contains(&"Go tests".to_string()) {
                    test_frameworks.push("Go tests".to_string());
                }
            }

            if lower.contains("test/") || lower.contains("tests/") || lower.contains("__tests__/") || lower.contains("spec/") {
                if !test_frameworks.contains(&"Dedicated test directory".to_string()) {
                    test_frameworks.push("Dedicated test directory".to_string());
                }
            }

            if lower.contains("eslint") && !lint_tools.contains(&"ESLint".to_string()) {
                lint_tools.push("ESLint".to_string());
            }
            if lower.contains("ruff.toml") || lower.contains(".ruff.toml") {
                if !lint_tools.contains(&"Ruff".to_string()) {
                    lint_tools.push("Ruff".to_string());
                }
            }
            if lower.contains("clippy") || lower.contains(".clippy.toml") {
                if !lint_tools.contains(&"Clippy".to_string()) {
                    lint_tools.push("Clippy".to_string());
                }
            }
            if lower.contains("pylint") || lower.contains(".pylintrc") {
                if !lint_tools.contains(&"Pylint".to_string()) {
                    lint_tools.push("Pylint".to_string());
                }
            }
            if lower.contains("biome.json") && !lint_tools.contains(&"Biome".to_string()) {
                lint_tools.push("Biome".to_string());
            }

            if lower.contains(".prettierrc") || lower.contains("prettier.config") {
                has_formatting_config = true;
            }
            if lower.contains(".editorconfig") {
                has_formatting_config = true;
            }

            let filename = path.split('/').last().unwrap_or("").to_lowercase();
            if filename == "contributing.md" || filename == "contributing.rst" {
                has_contributing_guide = true;
            }
            if filename == "code_of_conduct.md" || filename == "code-of-conduct.md" {
                has_code_of_conduct = true;
            }
            if filename == "changelog.md" || filename == "changelog.rst" || filename == "changes.md" {
                has_changelog = true;
            }
        }

        let has_ci = !ci_systems.is_empty();
        let has_tests = !test_frameworks.is_empty();
        let has_linting = !lint_tools.is_empty();

        let ci_score = if has_ci { 25.0 } else { 0.0 };
        let test_score = if has_tests { 30.0 } else { 5.0 };
        let lint_score = if has_linting { 20.0 } else { 5.0 };
        let format_score = if has_formatting_config { 10.0 } else { 2.0 };
        let docs_score = {
            let mut s = 5.0;
            if has_contributing_guide { s += 5.0; }
            if has_code_of_conduct { s += 3.0; }
            if has_changelog { s += 2.0; }
            s
        };

        let code_organization_score = {
            let mut score = 0.0;
            let has_src = tree.iter().any(|p| p.starts_with("src/") || p.starts_with("lib/"));
            let has_docs = tree.iter().any(|p| p.starts_with("docs/") || p.starts_with("doc/"));
            let has_examples = tree.iter().any(|p| p.starts_with("examples/") || p.starts_with("example/"));
            if has_src { score += 5.0; }
            if has_docs { score += 3.0; }
            if has_examples { score += 2.0; }
            score
        };

        let overall_quality_score = ci_score + test_score + lint_score + format_score + docs_score;

        CodeQualityReport {
            has_ci,
            ci_systems,
            has_tests,
            test_frameworks,
            has_linting,
            lint_tools,
            has_formatting_config,
            has_contributing_guide,
            has_code_of_conduct,
            has_changelog,
            code_organization_score,
            overall_quality_score,
        }
    }

    fn audit_dependencies(tree: &[String]) -> DependencyAudit {
        let mut dependency_files = Vec::new();
        let mut has_lockfile = false;
        let mut warnings = Vec::new();

        for path in tree {
            let lower = path.to_lowercase();
            let filename = path.split('/').last().unwrap_or("").to_lowercase();

            if filename == "cargo.toml" && !lower.contains("examples/") {
                dependency_files.push("Cargo.toml".to_string());
            }
            if filename == "package.json" && !lower.contains("node_modules/") {
                dependency_files.push("package.json".to_string());
            }
            if filename == "requirements.txt" || filename == "pyproject.toml" || filename == "setup.py" || filename == "setup.cfg" {
                dependency_files.push(filename.to_string());
            }
            if filename == "go.mod" {
                dependency_files.push("go.mod".to_string());
            }
            if filename == "pom.xml" || filename == "build.gradle" || filename == "build.gradle.kts" {
                dependency_files.push(filename.to_string());
            }
            if filename == "gemfile" {
                dependency_files.push("Gemfile".to_string());
            }

            if filename == "cargo.lock" || filename == "package-lock.json" || filename == "yarn.lock" || filename == "pnpm-lock.yaml" || filename == "go.sum" || filename == "gemfile.lock" || filename == "poetry.lock" || filename == "pipfile.lock" {
                has_lockfile = true;
            }
        }

        let has_dependency_file = !dependency_files.is_empty();

        if !has_lockfile && has_dependency_file {
            warnings.push("缺少依赖锁文件，构建不可复现".to_string());
        }

        if dependency_files.len() > 3 {
            warnings.push(format!("多语言依赖管理 ({} 个文件)，增加维护复杂度", dependency_files.len()));
        }

        let dep_count_score = if dependency_files.len() <= 2 { 25.0 } else if dependency_files.len() <= 4 { 18.0 } else { 10.0 };
        let lockfile_score = if has_lockfile { 25.0 } else { 0.0 };
        let simplicity_score = if warnings.is_empty() { 25.0 } else if warnings.len() == 1 { 15.0 } else { 5.0 };

        let dependency_health_score = dep_count_score + lockfile_score + simplicity_score;

        DependencyAudit {
            has_dependency_file,
            dependency_files,
            total_dependencies: 0,
            direct_dependencies: 0,
            dev_dependencies: 0,
            has_lockfile,
            dependency_health_score,
            warnings,
        }
    }

    pub async fn analyze_dependency_content(
        github_client: &crate::github::GitHubClient,
        owner: &str,
        name: &str,
        audit: &mut DependencyAudit,
    ) {
        for dep_file in &audit.dependency_files.clone() {
            let content = match github_client.get_file_content(owner, name, dep_file).await {
                Ok(Some(c)) => c,
                _ => continue,
            };

            match dep_file.as_str() {
                "Cargo.toml" => {
                    let deps = content.matches("[dependencies").count()
                        + content.matches("[build-dependencies").count();
                    let dev_deps = content.matches("[dev-dependencies").count();
                    audit.direct_dependencies += deps as u32;
                    audit.dev_dependencies += dev_deps as u32;
                }
                "package.json" => {
                    if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                        if let Some(deps) = json.get("dependencies").and_then(|v| v.as_object()) {
                            audit.direct_dependencies += deps.len() as u32;
                        }
                        if let Some(dev_deps) = json.get("devDependencies").and_then(|v| v.as_object()) {
                            audit.dev_dependencies += dev_deps.len() as u32;
                        }
                    }
                }
                "requirements.txt" => {
                    let count = content.lines().filter(|l| !l.trim().is_empty() && !l.trim().starts_with('#')).count();
                    audit.direct_dependencies += count as u32;
                }
                "pyproject.toml" => {
                    let deps = content.matches("dependencies").count();
                    audit.direct_dependencies += deps as u32;
                }
                "go.mod" => {
                    let count = content.lines().filter(|l| l.trim().starts_with("\t")).count();
                    audit.direct_dependencies += count as u32;
                }
                _ => {}
            }
        }

        audit.total_dependencies = audit.direct_dependencies + audit.dev_dependencies;

        if audit.total_dependencies > 100 {
            audit.warnings.push(format!("依赖数量过多 ({} 个)，增加供应链风险", audit.total_dependencies));
        }
        if audit.dev_dependencies > audit.direct_dependencies * 2 {
            audit.warnings.push("开发依赖远超生产依赖，可能存在过度工程化".to_string());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_analyze_code_quality_comprehensive() {
        let tree = vec![
            ".github/workflows/ci.yml".to_string(),
            ".github/workflows/release.yml".to_string(),
            "src/main.rs".to_string(),
            "src/lib.rs".to_string(),
            "tests/integration_test.rs".to_string(),
            "src/models_test.rs".to_string(),
            ".eslintrc.json".to_string(),
            ".prettierrc".to_string(),
            ".editorconfig".to_string(),
            "CONTRIBUTING.md".to_string(),
            "CODE_OF_CONDUCT.md".to_string(),
            "CHANGELOG.md".to_string(),
            "docs/README.md".to_string(),
            "examples/basic.rs".to_string(),
        ];

        let report = DeepAnalyzer::analyze_code_quality(&tree);
        assert!(report.has_ci);
        assert!(report.ci_systems.contains(&"GitHub Actions".to_string()));
        assert!(report.has_tests);
        assert!(report.has_linting);
        assert!(report.has_formatting_config);
        assert!(report.has_contributing_guide);
        assert!(report.has_code_of_conduct);
        assert!(report.has_changelog);
        assert!(report.overall_quality_score > 70.0);
    }

    #[test]
    fn test_analyze_code_quality_minimal() {
        let tree = vec![
            "src/main.rs".to_string(),
            "README.md".to_string(),
        ];

        let report = DeepAnalyzer::analyze_code_quality(&tree);
        assert!(!report.has_ci);
        assert!(!report.has_tests);
        assert!(!report.has_linting);
        assert!(report.overall_quality_score < 30.0);
    }

    #[test]
    fn test_audit_dependencies_rust() {
        let tree = vec![
            "Cargo.toml".to_string(),
            "Cargo.lock".to_string(),
            "src/main.rs".to_string(),
        ];

        let audit = DeepAnalyzer::audit_dependencies(&tree);
        assert!(audit.has_dependency_file);
        assert!(audit.dependency_files.contains(&"Cargo.toml".to_string()));
        assert!(audit.has_lockfile);
        assert!(audit.warnings.is_empty());
    }

    #[test]
    fn test_audit_dependencies_no_lockfile() {
        let tree = vec![
            "package.json".to_string(),
            "src/index.ts".to_string(),
        ];

        let audit = DeepAnalyzer::audit_dependencies(&tree);
        assert!(audit.has_dependency_file);
        assert!(!audit.has_lockfile);
        assert!(!audit.warnings.is_empty());
    }

    #[test]
    fn test_audit_dependencies_multi_lang() {
        let tree = vec![
            "Cargo.toml".to_string(),
            "package.json".to_string(),
            "requirements.txt".to_string(),
            "pyproject.toml".to_string(),
            "go.mod".to_string(),
        ];

        let audit = DeepAnalyzer::audit_dependencies(&tree);
        assert!(audit.dependency_files.len() > 3);
        assert!(!audit.warnings.is_empty());
    }

    #[test]
    fn test_full_analysis() {
        let tree = vec![
            ".github/workflows/ci.yml".to_string(),
            "src/lib.rs".to_string(),
            "tests/test_lib.rs".to_string(),
            "Cargo.toml".to_string(),
            "Cargo.lock".to_string(),
            "CONTRIBUTING.md".to_string(),
            "CHANGELOG.md".to_string(),
        ];

        let report = DeepAnalyzer::analyze_file_tree("owner/repo", &tree);
        assert_eq!(report.repo_full_name, "owner/repo");
        assert!(report.code_quality.has_ci);
        assert!(report.code_quality.has_tests);
        assert!(report.dependency_audit.has_dependency_file);
        assert!(report.dependency_audit.has_lockfile);
        assert!(!report.generated_at.is_empty());
    }
}
