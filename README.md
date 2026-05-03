<div align="center">

# Ralph

**穿透热度噪音，直抵项目品质**

*Cut through the hype, find the quality.*

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Rust](https://img.shields.io/badge/Rust-1.75+-orange.svg)](https://www.rust-lang.org/)
[![Tauri](https://img.shields.io/badge/Tauri-2.0-blue.svg)](https://tauri.app/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)

三轨覆盖 — 挖掘被忽视的项目，甄别高星项目中的真金，评估稳态项目的品质。

Three-track coverage — unearth neglected gems, verify high-star quality, assess steady-state projects.

</div>

---

## Why Ralph? / 为什么需要 Ralph？

GitHub 有超过 3 亿个仓库。Star 数不等于质量，热度不等于价值。Ralph 不受 Star 数束缚，只看品质本身 — 用六维评分体系和七层防博弈机制，帮你找到真正值得信赖的开源项目。

GitHub has 300M+ repositories. Stars don't equal quality, and hype doesn't equal value. Ralph looks past the numbers — using a six-dimension scoring system and seven-layer anti-gaming pipeline to find projects truly worth your trust.

---

## Core Features / 核心功能

### Three-Track Evaluation / 三轨评估模型

| Track / 轨道 | Target / 目标 | Condition / 条件 |
|---|---|---|
| **Neglected / 被忽视** | Low-star hidden gems / 低星宝藏 | Neglect Index >= 5 & Stars <= 2000 |
| **High-Star / 高星** | Verify hype vs. reality / 验名实相符 | Stars >= 1000 |
| **Steady / 稳态** | Quietly reliable / 稳健可靠 | Neglect < 5 & Stars < 1000 & Age >= 3mo |

### Six-Dimension Scoring / 六维评分（105 points）

| Dimension / 维度 | Max / 满分 | What it measures |
|---|---|---|
| A. Quality & Engineering / 质量与工程 | 20 | Code quality, architecture, engineering standards |
| B. Maintenance Activity / 维护活跃度 | 15 | Commit frequency, maintainer activity, mutation detection |
| C. Practical Value & Originality / 实用与独创 | 25 | Real-world utility, innovation, claim credibility |
| D. Documentation & Discoverability / 文档与可发现性 | 15 | README quality, API docs, examples |
| E. Community & Sustainability / 社区与可持续性 | 10 | Contributors, elephant factor correction |
| F. Security Health / 安全健康度 | 20 | Dependency security, OpenSSF cross-validation |

### Seven-Layer Anti-Gaming / 七层防博弈机制

```
Input ──> [1] Evidence Gate ──> [2] Bayesian Correction ──> [3] Base Ceiling
       ──> [4] Cross-Validation ──> [5] Dimension Floor ──> [6] Anomaly Detection
       ──> [7] OpenSSF Cross-Check ──> Final Score
```

| Layer / 层 | Mechanism / 机制 |
|---|---|
| 1 | Evidence threshold: L4 capped at 50%, L5 = 0 |
| 2 | Bayesian small-sample correction toward global mean |
| 3 | Base deficiency caps related dimension scores |
| 4 | Cross-dimension validation increases manipulation difficulty |
| 5 | Dimension floor: any violation triggers veto |
| 6 | Anomaly detection (enabled at >= 30 projects) |
| 7 | F-dimension cannot exceed OpenSSF Scorecard x 1.2 |

---

## Evaluation Result Preview / 评估结果预览

```
┌─────────────────────────────────────────────────────────────┐
│  Ralph Evaluation Report                                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Project:   tokio-rs/tokio                                  │
│  Track:     High-Star                                       │
│  Grade:     S                                               │
│  Score:     91/105                                          │
│                                                             │
│  ┌─ Dimensions ──────────────────────────────────────────┐  │
│  │  A. Quality     ████████████████████░░░░  17/20       │  │
│  │  B. Maintenance ██████████████░░░░░░░░░░  13/15       │  │
│  │  C. Practical   ████████████████████████  24/25       │  │
│  │  D. Docs        ██████████████░░░░░░░░░░  12/15       │  │
│  │  E. Community   ██████████░░░░░░░░░░░░░░   8/10       │  │
│  │  F. Security    ██████████████████░░░░░░  17/20       │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  Trust Badge:  ★ Recommended (L1)                           │
│  Rec. Index:   0.87                                         │
│  Evidence:     L1 (API Verified)                            │
│  Veto Flags:   None                                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

```
┌─────────────────────────────────────────────────────────────┐
│  Project:   some-user/awesome-lib                           │
│  Track:     Neglected                                       │
│  Grade:     X (Not Recommended)                             │
│  Score:     52/105                                          │
│                                                             │
│  Veto Flags:                                                │
│    ✖ Dimension floor violation: Security (12/20 < 35%)     │
│    ✖ Claim credibility too low → Rule #8 False Promotion    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Screenshots / 截图

> The following placeholders describe planned screenshots for the final release.

| Screenshot | Description |
|---|---|
| `[Search & Results]` | Main search interface with result cards showing grade, score, track, and trust badge |
| `[Project Detail]` | Detailed evaluation view with six-dimension radar chart and decision trail |
| `[Comparison Panel]` | Side-by-side comparison of multiple projects across all dimensions |
| `[Trending Discovery]` | GitHub Trending integration with one-click evaluation |
| `[Dark / Light Theme]` | Seamless theme switching with consistent visual design |
| `[PDF Report]` | Exported evaluation report with professional layout |

---

## Installation / 安装

### Windows

```powershell
# Download from GitHub Releases
winget install ralph

# Or build from source
git clone https://github.com/ralph-project/ralph.git
cd ralph
pnpm install
pnpm tauri build
```

### macOS

```bash
# Download from GitHub Releases
brew install --cask ralph

# Or build from source
git clone https://github.com/ralph-project/ralph.git
cd ralph
pnpm install
pnpm tauri build
```

### Linux

```bash
# Download AppImage from GitHub Releases
# Or build from source
git clone https://github.com/ralph-project/ralph.git
cd ralph
pnpm install
pnpm tauri build
```

### CLI Only

```bash
cargo install --path src-cli
ralph search "rust logging" --count 5
```

---

## Quick Start / 快速开始

### Prerequisites / 前置条件

- [Rust](https://rustup.rs/) 1.75+
- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/)

### Development / 开发模式

```bash
git clone https://github.com/ralph-project/ralph.git
cd ralph
pnpm install
pnpm tauri dev
```

### Build / 构建

```bash
# Desktop app
pnpm tauri build

# CLI tool
cargo build --release -p ralph-cli
```

### CLI Usage / 命令行使用

```bash
# Search and evaluate
ralph search "rust logging" --count 5

# Batch evaluate (enables full anomaly detection at >= 30)
ralph batch "react state management" --count 30 --output report.json

# View cache
ralph cached --limit 10

# Search history
ralph history --limit 20
```

### GitHub Token / 配置 Token

For higher API rate limits, configure a Personal Access Token in Settings, or via environment variable:

```bash
export GITHUB_TOKEN=ghp_your_token_here
```

---

## Tech Stack / 技术栈

| Layer | Technology |
|---|---|
| Backend Core | Rust (ralph-core) |
| Desktop Shell | Tauri v2 |
| Frontend | React 19 + TypeScript + Vite |
| State Management | Zustand |
| Database | SQLite (rusqlite) |
| i18n | Custom (zh/en) |
| E2E Testing | Playwright |
| Build System | Cargo Workspace + pnpm |

---

## Architecture / 架构

```
┌─────────────────────────────────────────────────────────────┐
│                        Ralph Desktop                         │
├──────────────────────┬──────────────────────────────────────┤
│   Frontend (React)   │        Backend (Rust)                │
│                      │                                      │
│  React 19 + TS       │   ralph-core                         │
│  ┌────────────────┐  │   ├── evaluator.rs   (评估引擎)      │
│  │  SearchBar     │  │   ├── github.rs      (GitHub API)   │
│  │  ResultCard    │  │   ├── database.rs    (SQLite 缓存)  │
│  │  ProjectDetail │  │   └── types.rs       (类型定义)     │
│  │  VirtualList   │  │                                      │
│  │  TrendChart    │  │   ralph-tauri                        │
│  │  PDFExport     │  │   ├── lib.rs         (IPC Bridge)   │
│  │  BadgeDisplay  │  │   └── badge.rs       (Badge 生成)   │
│  └────────────────┘  │                                      │
│                      │   ralph-cli                          │
│  i18n (zh/en)       │   └── main.rs         (命令行工具)   │
│  Theme (dark/light) │                                      │
│  Keyboard Shortcuts  │                                      │
└──────────────────────┴──────────────────────────────────────┘
```

---

## Evaluation Model Details / 评估模型详解

### Gate Checks / 入场门槛（G1-G6）

All projects must pass all 6 gates to proceed:

| Gate | Condition / 条件 | On Failure |
|---|---|---|
| G1 | Valid open-source license | Eliminated |
| G2 | Active within 90 days | Eliminated |
| G3 | Core functionality works | Eliminated |
| G4 | Not an empty shell (>= 500 LOC) | Eliminated |
| G5 | Not maliciously forked | Eliminated |
| G6 | Data verified via GitHub API | Eliminated |

### Grade System / 推荐分级

| Grade | Neglected / High-Star | Steady |
|---|---|---|
| **S** | Score >= 84 | — |
| **A** | Score >= 79 | Score >= 79 + Steady >= 0.6 |
| **B** | Score >= 73 | Score >= 73 + Steady >= 0.4 |
| **X** | Below threshold or veto triggered | Below threshold or veto triggered |

### Recommendation Index / 推荐指数

```
Neglected:  Quality × (1 + Neglect/50) × (1 - Mutation Penalty)
High-Star:  Quality × Value Density × Star Quality Factor
Steady:     Quality × Steady Coefficient (Growth Health × Community Resilience × 0.8)
```

### Veto Rules / 一票否决（10 items）

No License | Project Dead | Core Broken | Malicious Code | Prompt Injection Vector | Unvetted Aggregator | Maintainer MIA | False Promotion | Score Fraud | Anomaly Detected

---

## Testing / 测试

```bash
# Rust unit tests
cargo test -p ralph-core

# TypeScript type check
pnpm tsc --noEmit

# E2E tests (requires Tauri dev server)
pnpm tauri dev &
npx playwright test e2e/app.spec.ts
```

| Test Type | Cases | Pass Rate |
|---|---|---|
| Rust Unit Tests | 152 | 152 passed, 4 ignored |
| TypeScript Compile | 1 | 100% |
| E2E System Tests | 13 | 100% |
| Edge Cases | 14 | 100% |

---

## Project Structure / 项目结构

```
ralph/
├── src/                     # React Frontend
│   ├── components/          # UI Components
│   │   ├── BadgeDisplay.tsx # Evaluation Badge
│   │   ├── ConfidenceBadge.tsx
│   │   ├── TrustBadge.tsx
│   │   ├── ResultCard.tsx
│   │   ├── ProjectDetail.tsx
│   │   └── ...
│   ├── hooks/               # Custom Hooks
│   ├── i18n/                # Internationalization (zh/en)
│   ├── stores/              # Zustand State Management
│   ├── services/            # Tauri IPC Bridge
│   └── types.ts             # TypeScript Types
├── src-core/                # Rust Core Library
│   └── src/
│       ├── evaluator.rs     # Evaluation Engine
│       ├── github.rs        # GitHub API Client
│       ├── database.rs      # SQLite Cache
│       └── types.rs         # Rust Types
├── src-tauri/               # Tauri Desktop App
│   └── src/
│       ├── lib.rs           # IPC Bridge + Commands
│       ├── badge.rs         # Badge Generation
│       └── main.rs          # Entry Point
├── src-cli/                 # CLI Tool
│   └── main.rs
├── e2e/                     # E2E Tests
└── Cargo.toml               # Workspace Config
```

---

## Related Projects / 相关项目

- **[Arcane Codex](https://github.com/ralph-project/arcane-codex)** — Knowledge base desktop app built with the same Rust + React + Tauri stack. If you enjoy Ralph's evaluation methodology, Arcane Codex helps you organize and retain the knowledge you discover.

---

## Contributing / 贡献

Contributions are welcome! Whether it's code, bug reports, or suggestions.

1. Fork this repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Standards / 开发规范

- Rust: `cargo fmt && cargo clippy`
- TypeScript: `pnpm lint`
- Commits: Conventional Commits format
- All tests must pass before merge

---

## License / 许可证

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Ralph — 在 GitHub 的星海中，找到真正发光的金子。**

*Finding the gold that truly glows in GitHub's sea of stars.*

</div>
