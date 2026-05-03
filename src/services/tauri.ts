import { invoke } from '@tauri-apps/api/core';
import type { ProjectRecommendation, StatsData } from '../types';

export interface SearchMeta {
  queryId: string;
  totalCandidates: number;
  evaluatedCount: number;
  dataSource: string;
}

export interface SearchResponse {
  results: ProjectRecommendation[];
  meta?: SearchMeta;
  query?: string;
  count?: number;
}

export interface BadgeInfo {
  grade: string;
  score: number;
  color: string;
  url: string;
  markdown: string;
  html: string;
}

export const tauri = {
  searchAndEvaluate: (query: string) =>
    invoke<SearchResponse>('search_and_evaluate', { query }),

  batchEvaluate: (query: string, count: number) =>
    invoke<SearchResponse>('batch_evaluate', { query, count }),

  cancelBatch: () =>
    invoke('cancel_batch'),

  getFavorites: () =>
    invoke<Array<{ fullName: string; evaluationJson: string }>>('get_favorites'),

  addFavorite: (fullName: string, evaluationJson: string) =>
    invoke('add_favorite', { fullName, evaluationJson }),

  removeFavorite: (fullName: string) =>
    invoke('remove_favorite', { fullName }),

  isFavorite: (fullName: string) =>
    invoke<boolean>('is_favorite', { fullName }),

  getSearchHistory: () =>
    invoke<Array<{ keyword: string; timestamp: number }>>('get_search_history'),

  logSearch: (query: string, count: number) =>
    invoke('log_search_history', { query, count }),

  clearSearchHistory: () =>
    invoke('clear_search_history'),

  getEvaluationHistory: (repoFullName: string) =>
    invoke<Array<{ score: number; grade: string; track: string; evaluatedAt: string }>>('get_evaluation_history', { repoFullName }),

  getTrendingRepos: () =>
    invoke<SearchResponse>('get_trending_repos'),

  clearCache: () =>
    invoke('clear_cache'),

  saveSettings: (token: string) =>
    invoke('save_settings', { token }),

  generateBadge: (grade: string, score: number, repoFullName: string) =>
    invoke<BadgeInfo>('generate_badge', { grade, score, repoFullName }),

  startDiscovery: () =>
    invoke<DiscoveryStatus>('start_discovery'),

  stopDiscovery: () =>
    invoke<DiscoveryStatus>('stop_discovery'),

  getDiscoveryStatus: () =>
    invoke<DiscoveryStatus>('get_discovery_status'),

  getDiscoveryResults: () =>
    invoke<ProjectRecommendation[]>('get_discovery_results'),

  clearDiscoveryResults: () =>
    invoke('clear_discovery_results'),

  updateDiscoveryConfig: (config: DiscoveryConfig) =>
    invoke<DiscoveryConfig>('update_discovery_config', { config }),

  getDiscoveryConfig: () =>
    invoke<DiscoveryConfig>('get_discovery_config'),

  exportDiscoveryResults: (format: 'json' | 'csv') =>
    invoke<string>('export_discovery_results', { format }),

  getStats: () =>
    invoke<StatsData>('get_stats'),

  resumeBatch: (sessionId: string) =>
    invoke<SearchResponse>('resume_batch', { sessionId }),

  getBatchSessions: () =>
    invoke<BatchSession[]>('get_batch_sessions'),

  deleteBatchSession: (sessionId: string) =>
    invoke('delete_batch_session', { sessionId }),
} as const;

export interface DiscoveryStatus {
  running: boolean;
  discoveriesCount: number;
  lastRunAt: string | null;
  nextRunAt: string | null;
  currentRound: number;
  totalEvaluated: number;
}

export interface DiscoveryConfig {
  topics: string[];
  languages: string[];
  minStars: number;
  maxStars: number;
  minScore: number;
  intervalMinutes: number;
  maxPerRound: number;
}

export interface BatchSession {
  sessionId: string;
  query: string;
  totalRepos: number;
  processed: number;
  evaluated: number;
  skipped: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export type TauriService = typeof tauri;
