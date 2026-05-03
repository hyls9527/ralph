# Ralph 全面均衡推进实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Ralph 打造成行业顶尖的 GitHub 项目发现与评估工具，实现功能完备、质量卓越、用户体验一流的全栈应用。

**Architecture:** 采用分层渐进式开发方法论，以 Tauri 2.0 + React 19 + Rust 为技术底座，通过四个层次的递进式开发，实现从前端交互优化到后端评估引擎增强的全面覆盖。

**Tech Stack:** Rust 1.85+ / Tauri 2.0 / React 19 / TypeScript 5.8 / Tailwind CSS 4 / Vitest 4 / Playwright 1.59 / SQLite

---

## 项目现状分析

### 已完成功能 ✅
- 三轨评估模型（被忽视/高星/稳态）
- 六维评分体系（满分105）
- 七层防博弈流水线
- Tauri 桌面应用框架
- React 19 前端界面
- 152 个前端测试用例
- GitHub Actions CI/CD
- 完整文档体系

### 待优化领域 🔧
- 评估引擎性能优化（批量评估并行化）
- 用户体验细节打磨（加载状态、错误处理）
- 数据持久化增强（离线支持、数据同步）
- 国际化完善（i18n 覆盖率）
- 可访问性合规（WCAG 2.1 AA）
- 性能监控与遥测

---

## Layer 1: 核心评估引擎增强

### Task 1.1: 批量评估性能优化

**Files:**
- Modify: `src-tauri/src/lib.rs:200-280`
- Modify: `src-core/src/evaluator.rs`
- Test: `src-core/tests/batch_eval_test.rs`

- [ ] **Step 1: 分析当前批量评估瓶颈**

Run: `cargo bench --bench batch_evaluation`
Expected: 识别串行评估耗时分布

- [ ] **Step 2: 实现 tokio JoinSet 真并行**

```rust
use tokio::task::JoinSet;

pub async fn batch_evaluate_parallel(
    repos: Vec<String>,
    concurrency: usize,
) -> Vec<EvaluationResult> {
    let mut join_set = JoinSet::new();
    let semaphore = Arc::new(Semaphore::new(concurrency));
    
    for repo in repos {
        let permit = semaphore.clone().acquire_owned().await.unwrap();
        join_set.spawn(async move {
            let result = evaluate_single(&repo).await;
            drop(permit);
            result
        });
    }
    
    let mut results = Vec::new();
    while let Some(res) = join_set.join_next().await {
        if let Ok(r) = res {
            results.push(r);
        }
    }
    results
}
```

- [ ] **Step 3: 添加进度回调支持**

```rust
pub async fn batch_evaluate_with_progress<F>(
    repos: Vec<String>,
    progress_callback: F,
) -> Vec<EvaluationResult>
where
    F: Fn(usize, usize) + Send + Sync + 'static,
{
    // Implementation with progress tracking
}
```

- [ ] **Step 4: 编写性能基准测试**

```rust
#[bench]
fn bench_batch_100_repos(b: &mut Bencher) {
    b.iter(|| {
        runtime.block_on(batch_evaluate_parallel(test_repos(100), 5))
    });
}
```

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/lib.rs src-core/src/evaluator.rs
git commit -m "perf: parallelize batch evaluation with tokio JoinSet"
```

### Task 1.2: OpenSSF Scorecard 集成

**Files:**
- Create: `src-core/src/scorecard.rs`
- Modify: `src-core/src/evaluator.rs:150-180`
- Test: `src-core/tests/scorecard_test.rs`

- [ ] **Step 1: 添加 scorecard API 客户端**

```rust
pub struct ScorecardClient {
    client: reqwest::Client,
}

impl ScorecardClient {
    pub async fn get_score(&self, owner: &str, repo: &str) -> Result<ScorecardResult, Error> {
        let url = format!(
            "https://api.securityscorecards.dev/projects/github.com/{}/{}",
            owner, repo
        );
        let resp = self.client.get(&url).send().await?;
        Ok(resp.json().await?)
    }
}
```

- [ ] **Step 2: 实现 F 维度交叉校验**

```rust
fn cross_validate_security(
    f_score: u32,
    scorecard_score: f32,
) -> u32 {
    let max_allowed = (scorecard_score * 10.0 * 1.2) as u32;
    f_score.min(max_allowed)
}
```

- [ ] **Step 3: 添加缓存层**

```rust
pub struct CachedScorecardClient {
    client: ScorecardClient,
    cache: Arc<RwLock<HashMap<String, ScorecardResult>>>,
}
```

- [ ] **Step 4: Commit**

```bash
git add src-core/src/scorecard.rs
git commit -m "feat: integrate OpenSSF Scorecard for security validation"
```

---

## Layer 2: 前端用户体验优化

### Task 2.1: 加载状态与骨架屏优化

**Files:**
- Create: `src/components/skeletons/ResultCardSkeleton.tsx`
- Modify: `src/components/ResultCard.tsx`
- Test: `src/test/components/ResultCardSkeleton.test.tsx`

- [ ] **Step 1: 创建骨架屏组件**

```tsx
export function ResultCardSkeleton() {
  return (
    <div className="animate-pulse bg-gray-800/40 rounded-xl p-4 border border-gray-700/50">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-gray-700" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-700 rounded w-3/4" />
          <div className="h-3 bg-gray-700 rounded w-1/2" />
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <div className="h-6 w-16 bg-gray-700 rounded" />
        <div className="h-6 w-12 bg-gray-700 rounded" />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 添加渐进式加载动画**

```tsx
export function ProgressiveLoader({ stages }: { stages: string[] }) {
  const [currentStage, setCurrentStage] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStage(s => (s + 1) % stages.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div className="flex items-center gap-2">
      <Spinner />
      <span className="text-sm text-gray-400">{stages[currentStage]}</span>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/skeletons/ src/components/ResultCard.tsx
git commit -m "feat: add skeleton loading states for better UX"
```

### Task 2.2: 错误边界与重试机制

**Files:**
- Modify: `src/components/ErrorBoundary.tsx`
- Create: `src/components/RetryableError.tsx`
- Test: `src/test/components/RetryableError.test.tsx`

- [ ] **Step 1: 创建可重试错误组件**

```tsx
interface RetryableErrorProps {
  error: Error;
  onRetry: () => void;
  retryCount?: number;
}

export function RetryableError({ error, onRetry, retryCount = 0 }: RetryableErrorProps) {
  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <ExclamationIcon className="w-12 h-12 text-rose-400" />
      <p className="text-gray-300">{error.message}</p>
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-white"
      >
        {retryCount > 0 ? t('retryAgain') : t('retry')}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: 添加指数退避重试**

```tsx
export function useRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
) {
  const [retryCount, setRetryCount] = useState(0);
  
  const retry = useCallback(async () => {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (e) {
        if (i === maxRetries - 1) throw e;
        await new Promise(r => setTimeout(r, baseDelay * Math.pow(2, i)));
      }
    }
  }, [fn, maxRetries, baseDelay]);
  
  return { retry, retryCount };
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ErrorBoundary.tsx src/components/RetryableError.tsx
git commit -m "feat: add retry mechanism with exponential backoff"
```

---

## Layer 3: 数据持久化与离线支持

### Task 3.1: IndexedDB 离线存储

**Files:**
- Create: `src/lib/offline-storage.ts`
- Create: `src/hooks/useOfflineSync.ts`
- Test: `src/test/lib/offline-storage.test.ts`

- [ ] **Step 1: 实现 IndexedDB 封装**

```typescript
const DB_NAME = 'ralph-offline';
const DB_VERSION = 1;

interface RalphDB extends IDBDatabase {
  createObjectStore(name: string, options?: IDBObjectStoreParameters): IDBObjectStore;
}

export class OfflineStorage {
  private db: IDBDatabase | null = null;
  
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        db.createObjectStore('evaluations', { keyPath: 'repo.fullName' });
        db.createObjectStore('favorites', { keyPath: 'fullName' });
        db.createObjectStore('searchHistory', { keyPath: 'timestamp' });
      };
      
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onerror = () => reject(request.error);
    });
  }
  
  async saveEvaluation(result: ProjectRecommendation): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('evaluations', 'readwrite');
      const store = tx.objectStore('evaluations');
      const request = store.put(result);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}
```

- [ ] **Step 2: 创建同步 Hook**

```typescript
export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSync, setPendingSync] = useState(0);
  
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  return { isOnline, pendingSync };
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/offline-storage.ts src/hooks/useOfflineSync.ts
git commit -m "feat: add IndexedDB offline storage support"
```

### Task 3.2: 数据导出增强

**Files:**
- Modify: `src/components/ExportPanel.tsx`
- Create: `src/lib/export-formats.ts`
- Test: `src/test/lib/export-formats.test.ts`

- [ ] **Step 1: 添加 JSON Lines 格式**

```typescript
export function exportJSONLines(projects: ProjectRecommendation[]): string {
  return projects.map(p => JSON.stringify(p)).join('\n');
}
```

- [ ] **Step 2: 添加 Markdown 表格格式**

```typescript
export function exportMarkdownTable(projects: ProjectRecommendation[]): string {
  const headers = ['Repository', 'Score', 'Grade', 'Track', 'Language'];
  const rows = projects.map(p => [
    `[${p.repo.fullName}](${p.repo.htmlUrl})`,
    p.totalScore.toString(),
    p.grade,
    p.track,
    p.repo.language || '-',
  ]);
  
  return `| ${headers.join(' | ')} |\n| ${headers.map(() => '---').join(' | ')} |\n${
    rows.map(r => `| ${r.join(' | ')} |`).join('\n')
  }`;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/export-formats.ts src/components/ExportPanel.tsx
git commit -m "feat: add JSON Lines and Markdown table export formats"
```

---

## Layer 4: 可访问性与国际化

### Task 4.1: WCAG 2.1 AA 合规

**Files:**
- Modify: `src/components/ResultCard.tsx`
- Modify: `src/components/ProjectDetail.tsx`
- Create: `src/lib/a11y-utils.ts`
- Test: `src/test/a11y/a11y.test.ts`

- [ ] **Step 1: 添加 ARIA 标签**

```tsx
<div
  role="article"
  aria-labelledby={`repo-${repo.fullName}`}
  aria-describedby={`desc-${repo.fullName}`}
>
  <h3 id={`repo-${repo.fullName}`}>{repo.fullName}</h3>
  <p id={`desc-${repo.fullName}`} className="sr-only">
    {t('repoAriaDesc', { score: totalScore, grade })}
  </p>
</div>
```

- [ ] **Step 2: 键盘导航增强**

```tsx
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && e.target === cardRef.current) {
      onOpenDetail();
    }
  };
  
  cardRef.current?.addEventListener('keydown', handleKeyDown);
  return () => cardRef.current?.removeEventListener('keydown', handleKeyDown);
}, [onOpenDetail]);
```

- [ ] **Step 3: 颜色对比度修复**

```css
/* 确保文本对比度 >= 4.5:1 */
.text-gray-400 {
  color: rgb(156, 163, 175); /* 对比度 4.54:1 on gray-900 */
}

/* 聚焦指示器 */
.focus-visible:focus {
  outline: 2px solid #8b5cf6;
  outline-offset: 2px;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/a11y-utils.ts src/components/*.tsx
git commit -m "a11y: improve WCAG 2.1 AA compliance"
```

### Task 4.2: i18n 完整覆盖

**Files:**
- Modify: `src/i18n/index.tsx`
- Create: `src/i18n/locales/ja.json`
- Create: `src/i18n/locales/zh-TW.json`
- Test: `src/test/i18n/i18n.test.ts`

- [ ] **Step 1: 添加日语支持**

```json
{
  "app": {
    "title": "Ralph",
    "subtitle": "3トラックカバー。人気のノイズを突破し、プロジェクトの品質へ。"
  },
  "tracks": {
    "neglected": "見過ごされた",
    "highStar": "高スター",
    "steady": "安定"
  }
}
```

- [ ] **Step 2: 添加繁体中文支持**

```json
{
  "app": {
    "title": "Ralph",
    "subtitle": "三軌覆蓋。穿透熱度噪音，直抵專案品質。"
  }
}
```

- [ ] **Step 3: 动态语言切换**

```tsx
export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();
  
  return (
    <select
      value={locale}
      onChange={(e) => setLocale(e.target.value as Locale)}
      aria-label={t('selectLanguage')}
    >
      <option value="zh">简体中文</option>
      <option value="en">English</option>
      <option value="ja">日本語</option>
      <option value="zh-TW">繁體中文</option>
    </select>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/i18n/
git commit -m "feat: add Japanese and Traditional Chinese i18n support"
```

---

## 质量控制措施

### 测试策略

| 层级 | 覆盖目标 | 工具 |
|------|---------|------|
| 单元测试 | 80%+ | Vitest + cargo test |
| 集成测试 | 关键路径 100% | Playwright |
| E2E 测试 | 用户流程 100% | Playwright |
| 可访问性测试 | WCAG 2.1 AA | axe-core |
| 性能测试 | 无回归 | Lighthouse CI |

### 提交规范

```
feat: 新功能
fix: 修复
perf: 性能优化
refactor: 重构
docs: 文档
test: 测试
chore: 杂项
a11y: 可访问性
i18n: 国际化
```

### 代码审查清单

- [ ] 类型安全（无 `any`）
- [ ] 测试覆盖
- [ ] 文档更新
- [ ] 无硬编码字符串
- [ ] 错误处理完整
- [ ] 可访问性合规

---

## 资源分配策略

### 开发优先级矩阵

| 优先级 | 层级 | 预计工作量 | 依赖关系 |
|--------|------|-----------|---------|
| P0 | Layer 1 | 2 周 | 无 |
| P1 | Layer 2 | 1.5 周 | Layer 1 |
| P2 | Layer 3 | 1 周 | Layer 1 |
| P3 | Layer 4 | 1 周 | Layer 2 |

### 并行开发策略

```
Week 1-2: Layer 1 (核心引擎)
Week 2-3: Layer 2 (前端 UX) - 与 Layer 1 后半段并行
Week 3-4: Layer 3 (数据持久化) - 与 Layer 2 后半段并行
Week 4-5: Layer 4 (可访问性) - 与 Layer 3 后半段并行
```

---

## 迭代改进流程

### 每周迭代

1. **周一**: 规划本周任务，更新看板
2. **周二-周四**: 开发实现
3. **周五**: 代码审查 + 测试 + 文档
4. **周末**: 用户反馈收集 + 下周规划

### 每两周发布

1. 功能冻结
2. 回归测试
3. 文档更新
4. 版本发布
5. 用户通知

### 每月回顾

1. 指标分析（测试覆盖率、性能、用户反馈）
2. 技术债务清理
3. 架构优化评估
4. 下月规划调整

---

## 成功指标

| 指标 | 当前 | 目标 |
|------|------|------|
| Rust 测试覆盖率 | ~60% | 80%+ |
| TypeScript 测试覆盖率 | ~70% | 80%+ |
| Lighthouse 性能分 | ~85 | 95+ |
| WCAG 合规率 | ~70% | 100% |
| i18n 覆盖率 | ~90% | 100% |
| 用户满意度 | - | 4.5/5 |

---

**Plan Complete.** 保存到 `docs/superpowers/plans/2026-05-03-comprehensive-advancement.md`
