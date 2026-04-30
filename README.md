# Ralph — GitHub 高质量项目发现与评估工具

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Rust](https://img.shields.io/badge/Rust-1.75+-orange.svg)](https://www.rust-lang.org/)
[![Tauri](https://img.shields.io/badge/Tauri-2.0-blue.svg)](https://tauri.app/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![Tests](https://img.shields.io/badge/Tests-87%20passing-brightgreen.svg)]()

> **穿透热度噪音，直抵项目品质。**  
> 三轨覆盖，无盲区——挖掘被忽视的宝藏，甄别高星项目中的真金，评估稳态项目的品质。

---

## ✨ 特性

| 特性 | 说明 |
|------|------|
| **三轨评估模型** | 被忽视项目挖掘 · 高星项目甄别 · 稳态项目评估，任何项目都有归属 |
| **六维评分系统** | 质量 · 活跃度 · 实用价值 · 文档 · 社区潜力 · 安全健康度，满分 105 分 |
| **七层防博弈机制** | 证据门槛 · 贝叶斯修正 · 基础天花板 · 维度交叉校验 · 维度地板 · 异常检测 · OpenSSF 交叉校验 |
| **置信度分级** | Tier1 核心 · Tier2 扩展 · Tier3 完整，评估透明度可追溯 |
| **决策追踪** | 每一步评分修正都有迹可循，from/to 值完整记录 |
| **GitHub Trending** | 一键发现热门项目，即时评估 |
| **中英文双语** | 完整的 i18n 支持，一键切换 |
| **暗黑/明亮主题** | 流畅过渡，视觉一致 |
| **键盘快捷键** | `/` 搜索 · `←/→` 翻页 · `Esc` 关闭 · `d` 切换主题 |
| **批量评定** | 单次 ≥30 个项目，启用完整异常检测 |
| **项目对比矩阵** | 多项目并排对比六维评分 |
| **PDF 报告导出** | 精美排版的评定报告 |
| **CLI 工具** | 脱离桌面环境使用，集成 CI/CD 管道 |

---

## 🏗️ 架构

```
┌─────────────────────────────────────────────────────────────┐
│                        Ralph Desktop                         │
├──────────────────────┬──────────────────────────────────────┤
│   Frontend (Tauri)    │        Backend (Rust)               │
│                      │                                      │
│  React 19 + TS       │   ralph-core                         │
│  ┌────────────────┐  │   ├── evaluator.rs   (评估引擎)      │
│  │  SearchBar     │  │   ├── github.rs      (GitHub API)   │
│  │  ResultCard    │  │   ├── database.rs    (SQLite 缓存)  │
│  │  ProjectDetail │  │   └── types.rs       (类型定义)     │
│  │  VirtualList   │  │                                      │
│  │  TrendChart    │  │   ralph-tauri                        │
│  │  PDFExport     │  │   └── lib.rs         (IPC Bridge)   │
│  └────────────────┘  │                                      │
│                      │   ralph-cli                          │
│  i18n (zh/en)       │   └── main.rs         (命令行工具)   │
│  Theme (dark/light) │                                      │
│  Keyboard Shortcuts  │                                      │
└──────────────────────┴──────────────────────────────────────┘
```

### 技术栈

- **后端**: Rust (ralph-core, ralph-tauri, ralph-cli)
- **前端**: React 19 + TypeScript + Vite
- **桌面框架**: Tauri v2
- **数据库**: SQLite (rusqlite)
- **状态管理**: Zustand
- **E2E 测试**: Playwright
- **构建系统**: Cargo Workspace + pnpm

---

## 🚀 快速开始

### 前置条件

- [Rust](https://rustup.rs/) 1.75+
- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/) 或 npm

### 安装

```bash
git clone https://github.com/YOUR_USERNAME/ralph.git
cd ralph

# 安装前端依赖
pnpm install

# 安装 Tauri 依赖
cargo install tauri-cli
```

### 开发模式

```bash
pnpm tauri dev
```

应用将自动启动并打开窗口，Vite dev server 运行在 `http://localhost:1420`。

### 构建 Release

```bash
# 桌面应用
pnpm tauri build

# CLI 工具
cargo build --release -p ralph-cli
```

### CLI 使用

```bash
# 搜索并评估单个项目
ralph search "rust logging" --count 5

# 批量评估 30 个项目
ralph batch "rust logging" --count 30 --output report.json

# 查看缓存
ralph cached --limit 10

# 搜索历史
ralph history --limit 20
```

### 配置 GitHub Token

为获得更高的 API 配额，建议在设置面板中配置 Personal Access Token，或通过环境变量：

```bash
export GITHUB_TOKEN=ghp_your_token_here
```

---

## 📊 评估模型

### 入场门槛（G1-G6）

所有项目必须通过 6 项门控检查：

| Gate | 条件 | 不满足时 |
|------|------|---------|
| G1 | 有效开源协议 | 淘汰 |
| G2 | 近 90 天有提交 | 淘汰 |
| G3 | 核心功能可用 | 淘汰 |
| G4 | 非空壳项目 | 淘汰 |
| G5 | 非恶意搬运 | 淘汰 |
| G6 | 数据真实 | 淘汰 |

### 六维评分（满分 105）

| 维度 | 满分 | 说明 |
|------|------|------|
| A. 质量/工程成熟度 | 20 | 代码质量、架构设计、工程规范 |
| B. 活跃维护度 | 15 | 提交频率、维护者活跃度、突变检测 |
| C. 实用价值与独创性 | 25 | 解决实际问题、创新程度、声明可信度 |
| D. 文档与可发现性 | 15 | README 质量、API 文档、示例完整性 |
| E. 社区潜力与可持续性 | 10 | 贡献者数量、大象因子修正 |
| F. 安全健康度 | 20 | 依赖安全、OpenSSF 交叉校验 |

### 三轨分类

| 轨道 | 条件 | 推荐指数公式 |
|------|------|-------------|
| **被忽视** | 忽视指数 ≥ 5 且 Star ≤ 2000 | 质量 × (1 + 忽视/50) × (1 - 突变) |
| **高星** | Star ≥ 1000 | 质量 × 价值密度 × Star 质量因子 |
| **稳态** | 忽视 < 5 且 Star < 1000 且 年龄 ≥ 3月 | 质量 × 稳态系数 |

### 推荐分级

**被忽视 & 高星**: 🏆 S级(≥84) · 🥇 A级(≥79) · 🥈 B级(≥73) · ❌ 不推荐  
**稳态**: 🥇 A级(≥79+稳态≥0.6) · 🥈 B级(≥73+稳态≥0.4) · ❌ 不推荐

---

## 🧪 测试

### 运行所有测试

```bash
# Rust 单元测试
cargo test -p ralph-core

# TypeScript 类型检查
pnpm tsc --noEmit

# E2E 测试（需要先启动 Tauri dev）
pnpm tauri dev &
npx playwright test e2e/app.spec.ts
```

### 测试结果

| 测试类型 | 用例数 | 通过率 |
|---------|--------|--------|
| Rust 单元测试 | 91 | 87 passed, 4 ignored |
| TypeScript 编译 | 1 | 100% |
| E2E 系统测试 | 13 | 100% |
| 边界场景 | 14 | 100% |

---

## 📁 项目结构

```
ralph/
├── src/                     # React 前端
│   ├── components/          # UI 组件
│   ├── hooks/               # 自定义 Hooks
│   ├── i18n/                # 国际化
│   ├── stores/              # Zustand 状态管理
│   ├── App.tsx              # 主应用
│   └── types.ts             # TypeScript 类型
├── src-core/                # Rust 核心库
│   └── src/
│       ├── evaluator.rs     # 评估引擎
│       ├── github.rs        # GitHub API 客户端
│       ├── database.rs      # SQLite 缓存
│       └── types.rs         # Rust 类型
├── src-tauri/               # Tauri 桌面应用
│   └── src/
│       ├── lib.rs           # IPC Bridge
│       └── main.rs          # 入口点
├── src-cli/                 # 命令行工具
│   └── main.rs              # CLI 实现
├── e2e/                     # E2E 测试
│   ├── app.spec.ts          # 功能测试
│   └── performance.spec.ts  # 性能基准
└── Cargo.toml               # Workspace 配置
```

---

## 🤝 贡献

欢迎贡献代码、报告问题或提出建议！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交变更 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

### 开发规范

- Rust 代码: `cargo fmt && cargo clippy`
- TypeScript: `pnpm lint`
- 提交信息: Conventional Commits 格式
- PR 需要所有测试通过

---

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件。

---

<p align="center">
  <em>Ralph — 在 GitHub 的星海中，找到真正发光的金子。</em>
</p>
