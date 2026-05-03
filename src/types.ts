export interface ProjectRecommendation {
  repo: {
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
    license: { spdxId: string; name: string } | null;
    size: number;
    hasWiki: boolean;
    hasIssuesEnabled: boolean;
    topics: string[];
  };
  gateChecks: {
    gate: string;
    passed: boolean;
    reason: string | null;
    evidenceLevel: string;
  }[];
  track: 'neglected' | 'high-star' | 'steady';
  neglectIndex: number;
  valueDensity?: number;
  steadyState?: number;
  dimensions: {
    dimension: string;
    score: number;
    maxScore: number;
    subScores: [string, number, number][];
  }[];
  totalScore: number;
  grade: 'S' | 'A' | 'B' | 'X';
  oneLiner: string;
  evidenceLevel: 'L1' | 'L2' | 'L3' | 'L4' | 'L5';
  trustBadge: TrustBadge;
  vetoFlags: string[];
  recommendationIndex: number;
  weightedScore?: number;
  confidenceTier: 'tier1-core' | 'tier2-extended' | 'tier3-full';
  decisionTrail: {
    step: string;
    action: string;
    before: number;
    after: number;
    reason: string;
  }[];
}

export interface TrustBadge {
  level: 1 | 2;
  l1: {
    status: 'recommended' | 'caution' | 'not-recommended';
    icon: string;
    label: string;
    color: 'emerald' | 'amber' | 'rose';
  };
  l2?: {
    gateChecks: GateCheckResult[];
    evidenceSummary: string;
    keyMetrics: {
      qualityScore: number;
      maintenanceScore: number;
      securityStatus: 'passed' | 'warning' | 'failed';
    };
  };
}

export interface GateCheckResult {
  gate: string;
  passed: boolean;
  reason?: string;
}

export interface LoadingState {
  phase: 'idle' | 'searching' | 'evaluating' | 'done' | 'error';
  message: string;
  progress?: number;
  error?: string;
}

export interface DimensionWeights {
  quality: number;
  maintenance: number;
  practical: number;
  documentation: number;
  community: number;
  security: number;
}

export const defaultDimensionWeights: DimensionWeights = {
  quality: 20,
  maintenance: 15,
  practical: 25,
  documentation: 15,
  community: 10,
  security: 20,
};

export interface StatsData {
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
