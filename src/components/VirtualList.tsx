import { useState, useCallback, useRef, useMemo } from 'react';
import type { ProjectRecommendation } from '../types';
import ResultCard from './ResultCard';

interface VirtualListProps {
  items: ProjectRecommendation[];
  itemHeight: number;
  containerHeight: number;
  onDetailClick: (project: ProjectRecommendation) => void;
}

const VirtualList: React.FC<VirtualListProps> = ({ items, itemHeight, containerHeight, onDetailClick }) => {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const { startIdx, endIdx, offsetY } = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - 2);
    const end = Math.min(items.length, Math.ceil((scrollTop + containerHeight) / itemHeight) + 2);
    const offset = start * itemHeight;
    return { startIdx: start, endIdx: end, offsetY: offset };
  }, [scrollTop, itemHeight, items.length, containerHeight]);

  const visibleItems = items.slice(startIdx, endIdx);
  const totalHeight = items.length * itemHeight;

  return (
    <div
      ref={containerRef}
      className="overflow-y-auto"
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ position: 'absolute', top: offsetY, width: '100%' }}>
          {visibleItems.map((project) => (
            <div
              key={project.repo.fullName}
              style={{ height: itemHeight }}
              className="mb-4"
            >
              <ResultCard project={project} onDetailClick={() => onDetailClick(project)} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default VirtualList;
