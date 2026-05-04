import React from 'react';

interface SkeletonCardProps {
  isLight?: boolean;
  delay?: number;
}

const SkeletonCard: React.FC<SkeletonCardProps> = ({ isLight = false, delay = 0 }) => (
  <div
    className={`rounded-xl border p-5 skeleton-pulse stagger-item ${
      isLight ? 'bg-white border-gray-200' : 'bg-gray-900/60 border-gray-800'
    }`}
    style={{ animationDelay: `${delay}ms` }}
  >
    <div className="flex items-start justify-between mb-3">
      <div className="flex-1">
        <div className={`h-5 rounded w-48 mb-2 ${isLight ? 'bg-gray-200' : 'bg-gray-700'}`} />
        <div className={`h-3 rounded w-80 ${isLight ? 'bg-gray-200' : 'bg-gray-700'}`} />
      </div>
      <div className="flex gap-2 ml-4">
        <div className={`h-5 w-12 rounded ${isLight ? 'bg-gray-200' : 'bg-gray-700'}`} />
        <div className={`h-5 w-10 rounded ${isLight ? 'bg-gray-200' : 'bg-gray-700'}`} />
        <div className={`h-5 w-10 rounded ${isLight ? 'bg-gray-200' : 'bg-gray-700'}`} />
      </div>
    </div>
    <div className={`h-3 rounded w-full mb-2 ${isLight ? 'bg-gray-200' : 'bg-gray-700'}`} />
    <div className={`h-3 rounded w-3/4 mb-4 ${isLight ? 'bg-gray-200' : 'bg-gray-700'}`} />
    <div className="flex gap-4 mb-4">
      <div className={`h-3 rounded w-16 ${isLight ? 'bg-gray-200' : 'bg-gray-700'}`} />
      <div className={`h-3 rounded w-16 ${isLight ? 'bg-gray-200' : 'bg-gray-700'}`} />
      <div className={`h-3 rounded w-16 ${isLight ? 'bg-gray-200' : 'bg-gray-700'}`} />
      <div className={`h-3 rounded w-16 ${isLight ? 'bg-gray-200' : 'bg-gray-700'}`} />
    </div>
    <div className="flex items-center gap-3">
      <div className={`h-8 w-20 rounded-lg ${isLight ? 'bg-gray-200' : 'bg-gray-700'}`} />
      <div className={`h-3 flex-1 rounded ${isLight ? 'bg-gray-200' : 'bg-gray-700'}`} />
    </div>
  </div>
);

interface ResultsSkeletonProps {
  count?: number;
  isLight?: boolean;
}

const ResultsSkeleton: React.FC<ResultsSkeletonProps> = ({ count = 3, isLight = false }) => (
  <div className="space-y-4">
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonCard key={i} isLight={isLight} delay={i * 100} />
    ))}
  </div>
);

export default ResultsSkeleton;
