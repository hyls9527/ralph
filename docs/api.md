# Ralph API Reference

## Tauri Commands

All Tauri commands are invoked via the `tauri` service wrapper.

### Search & Evaluate

```typescript
invoke('search_and_evaluate', { query: string }): Promise<SearchResult>
```

Searches GitHub for repositories matching the query and evaluates them using the three-track system.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| query | string | GitHub search query (supports GitHub search syntax) |

**Returns:**
```typescript
interface SearchResult {
  query: string;
  count: number;
  results: ProjectRecommendation[];
}
```

### Batch Evaluate

```typescript
invoke('batch_evaluate', { query: string }): Promise<BatchResult>
```

Evaluates repositories matching the query in parallel using tokio JoinSet.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| query | string | GitHub search query |

**Returns:**
```typescript
interface BatchResult {
  total: number;
  successful: number;
  failed: number;
  duration_ms: number;
}
```

### Get Trending

```typescript
invoke('get_trending', { config: TrendConfig }): Promise<TrendingResult>
```

Discovers neglected or trending projects based on configuration.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| config.languages | string[] | Programming languages to filter |
| config.exclude_languages | string[] | Languages to exclude |
| config.tracks | string[] | Tracks to evaluate: "neglected", "high-star", "steady" |
| config.min_stars | number | Minimum star count filter |
| config.time_window | string | Time window for growth metrics |

**Returns:**
```typescript
interface TrendingResult {
  projects: ProjectRecommendation[];
  discovery_stats: DiscoveryStats;
}
```

### Evaluate Single Repo

```typescript
invoke('evaluate_single', { owner: string, repo: string }): Promise<ProjectRecommendation>
```

Evaluates a single repository.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| owner | string | Repository owner |
| repo | string | Repository name |

### Favorite

```typescript
invoke('toggle_favorite', { repo: string }): Promise<void>
```

Toggles favorite status for a repository.

### Get Stats

```typescript
invoke('get_stats'): Promise<StatsData>
```

Returns evaluation statistics.

**Returns:**
```typescript
interface StatsData {
  total: number;
  byGrade: { grade: string; count: number }[];
  byTrack: { track: string; count: number }[];
  avgScore: number;
  topScore: number;
  favorites: number;
  recent7d: number;
  scoreDistribution: { bucket: string; count: number }[];
  byLanguage: { language: string; count: number }[];
  byEvidence: { evidenceLevel: string; count: number }[];
}
```

### Batch Session Management

```typescript
invoke('get_incomplete_batch_session'): Promise<BatchSession | null>
invoke('resume_batch_session', { session_id: string }): Promise<void>
```

### Search History

```typescript
invoke('get_search_history', { limit: number }): Promise<SearchHistoryEntry[]>
```

## Data Types

### ProjectRecommendation

```typescript
interface ProjectRecommendation {
  repo: Repository;
  gateChecks: GateCheck[];
  track: string;
  neglectIndex: number;
  dimensions: Dimension[];
  totalScore: number;
  grade: string;
  oneLiner: string;
  evidenceLevel: string;
  trustBadge: TrustBadge;
  vetoFlags: string[];
  recommendationIndex: number;
  confidenceTier: string;
  decisionTrail: DecisionStep[];
  valueDensity?: number;
  steadyState?: number;
}
```

### Repository

```typescript
interface Repository {
  owner: string;
  name: string;
  fullName: string;
  htmlUrl: string;
  description: string | null;
  stargazersCount: number;
  forksCount: number;
  openIssuesCount: number;
  language: string | null;
  createdAt: string;
  updatedAt: string;
  pushedAt: string;
  license: string | null;
  size: number;
  hasWiki: boolean;
  hasIssuesEnabled: boolean;
  topics: string[];
}
```

### Dimension

```typescript
interface Dimension {
  dimension: string;
  score: number;
  maxScore: number;
  subScores: SubScore[];
}
```

### GateCheck

```typescript
interface GateCheck {
  name: string;
  passed: boolean;
  evidence: string;
}
```

### TrustBadge

```typescript
interface TrustBadge {
  level: number;
  l1: BadgeLevel;
  l2?: BadgeLevel;
  l3?: BadgeLevel;
  l4?: BadgeLevel;
  l5?: BadgeLevel;
}

interface BadgeLevel {
  status: string;
  icon: string;
  label: string;
  color: string;
}
```

### DecisionStep

```typescript
interface DecisionStep {
  step: string;
  before: number;
  after: number;
  action: string;
  reason: string;
}
```
