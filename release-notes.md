## ✨ 新特性

- **三轨评估模型**: 被忽视项目挖掘 · 高星项目甄别 · 稳态项目评估
- **六维评分系统**: 质量 · 活跃度 · 实用价值 · 文档 · 社区潜力 · 安全健康度（满分 105 分）
- **七层防博弈机制**: 证据门槛 · 贝叶斯修正 · 基础天花板 · 维度交叉校验 · 维度地板 · 异常检测 · OpenSSF 交叉校验
- **置信度分级**: Tier1 核心 · Tier2 扩展 · Tier3 完整
- **决策追踪**: 每一步评分修正都有迹可循

## 🎨 用户体验

- 暗黑/明亮主题，一键切换
- 中英文双语支持
- 键盘快捷键：`/` 搜索 · `←/→` 翻页 · `Esc` 关闭 · `d` 切换主题
- 项目对比矩阵 · PDF 报告导出 · GitHub Trending 探索
- 虚拟滚动 · 骨架屏加载 · 新手引导
- 错误边界 + 用户友好错误提示

## 🔧 技术架构

- 后端: Rust (ralph-core + ralph-tauri + ralph-cli)
- 前端: React 19 + TypeScript + Vite
- 桌面框架: Tauri v2
- 数据库: SQLite (rusqlite)
- E2E 测试: Playwright (13/13 通过)
- Rust 单元测试: 87 passed, 0 failed, 0 warnings

## 📦 安装包

- **Windows**: `Ralph_0.8.0_x64-setup.exe` (NSIS 安装器, x64, 2.5 MB)

## 🚀 快速开始

```bash
# 安装 Windows 桌面应用
下载并运行 Ralph_0.8.0_x64-setup.exe

# CLI 工具
cargo install --path ./src-cli
```
