# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- PipelineVisualization component for anti-gaming pipeline display
- StatsDashboard with score/language/evidence distribution charts
- CSV export to ExportPanel
- Confidence tier badge in ResultCard and ProjectDetail
- `.editorconfig`, `.prettierrc`, `.eslintrc.js` for code quality
- Husky pre-commit hooks with lint-staged
- CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md
- Changelog file

### Changed
- Extended backend `get_stats` with scoreDistribution, byLanguage, byEvidence
- Extracted filter-utils from useFilteredResults to eliminate code duplication
- Fixed exaggerated claims in documentation and UI text
- Updated README test data to reflect 152 passing tests

### Fixed
- Rust clippy warnings (string replace pattern, row iteration)
- Missing `Default` trait implementation for `IssueMetrics`
- Test file dimension name mismatch (English → Chinese)
- TypeScript errors across 6 test files

## [0.9.0] - 2026-05-03

### Added
- Infrastructure: editorconfig, prettier, eslint, husky, lint-staged
- VSCode workspace settings with format-on-save
- .env.example template
- Documentation: CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md

### Changed
- Version bump to 0.9.0 (SemVer)
- Removed unverifiable claims from documentation
- Updated test counts in README

## [0.8.0] - 2026-05-02

### Added
- Initial migration from previous repository
- Tauri desktop application with React frontend
- Core evaluation engine in Rust
- CLI binary for batch evaluation
- E2E test suite with Playwright
- Comprehensive test suite (Vitest + React Testing Library)

[Unreleased]: https://github.com/user/ralph/compare/v0.9.0...HEAD
[0.9.0]: https://github.com/user/ralph/releases/tag/v0.9.0
