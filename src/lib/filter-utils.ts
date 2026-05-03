import type { DimensionWeights, ProjectRecommendation } from '../types';

const DIMENSION_KEY_MAP: Record<string, keyof DimensionWeights> = {
  '质量': 'quality',
  '维护': 'maintenance',
  '实用': 'practical',
  '文档': 'documentation',
  '社区': 'community',
  '安全': 'security',
};

export function applyDimensionWeights(
  results: ProjectRecommendation[],
  dimensionWeights: DimensionWeights,
): ProjectRecommendation[] {
  const totalWeight = Object.values(dimensionWeights).reduce((a, b) => a + b, 0);
  if (totalWeight === 0) return results;

  return results.map(project => {
    const dims = project.dimensions || [];
    const weightedScore = dims.reduce((acc, dim) => {
      const ratio = dim.maxScore > 0 ? dim.score / dim.maxScore : 0;
      const weightKey = DIMENSION_KEY_MAP[dim.dimension];
      return weightKey ? acc + ratio * (dimensionWeights[weightKey] ?? 0) : acc;
    }, 0);

    return {
      ...project,
      weightedScore: Math.round(weightedScore * 10) / 10,
    };
  });
}

export interface FilterCriteria {
  trackFilter: string;
  languageFilter: string;
  minScore: number;
  minStars: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export function filterAndSort(
  results: ProjectRecommendation[],
  criteria: FilterCriteria,
): ProjectRecommendation[] {
  const filtered = results.filter(p => {
    if (criteria.trackFilter !== 'all' && p.track !== criteria.trackFilter) return false;
    if (criteria.languageFilter !== 'all' && p.repo.language !== criteria.languageFilter) return false;
    if (p.totalScore < criteria.minScore) return false;
    if ((p.repo.stargazersCount || 0) < criteria.minStars) return false;
    return true;
  });

  filtered.sort((a, b) => {
    let aVal: number, bVal: number;
    switch (criteria.sortBy) {
      case 'score':
        aVal = a.totalScore;
        bVal = b.totalScore;
        break;
      case 'stars':
        aVal = a.repo.stargazersCount || 0;
        bVal = b.repo.stargazersCount || 0;
        break;
      case 'recommendationIndex':
        aVal = a.recommendationIndex;
        bVal = b.recommendationIndex;
        break;
      case 'updatedAt':
        aVal = new Date(a.repo.updatedAt).getTime();
        bVal = new Date(b.repo.updatedAt).getTime();
        break;
      default:
        aVal = a.totalScore;
        bVal = b.totalScore;
    }
    return criteria.sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
  });

  return filtered;
}

const ITEMS_PER_PAGE = 10;

export function paginate(
  results: ProjectRecommendation[],
  page: number,
  pageSize: number = ITEMS_PER_PAGE,
) {
  const totalPages = Math.max(1, Math.ceil(results.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedResults = results.slice((safePage - 1) * pageSize, safePage * pageSize);

  return {
    paginatedResults,
    totalPages,
    currentPage: safePage,
    totalResults: results.length,
    hasNextPage: safePage < totalPages,
    hasPrevPage: safePage > 1,
  };
}

export function extractLanguages(results: ProjectRecommendation[]): string[] {
  const set = new Set<string>();
  results.forEach(p => { if (p.repo.language) set.add(p.repo.language); });
  return Array.from(set).sort();
}
