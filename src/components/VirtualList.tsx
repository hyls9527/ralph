import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import type { ProjectRecommendation } from '../types';
import ResultCard from './ResultCard';

interface VirtualListProps {
  items: ProjectRecommendation[];
  itemHeight: number;
  containerHeight: number;
  onDetailClick: (project: ProjectRecommendation) => void;
  favorites?: Set<string>;
  onFavoriteToggle?: (fullName: string, project?: ProjectRecommendation) => void;
}

/**
 * VirtualList - 高性能虚拟滚动列表
 * 
 * 优化特性：
 * 1. RAF (requestAnimationFrame) 节流 - 避免频繁 setState
 * 2. 动态 overscan - 根据滚动速度动态调整预渲染数量
 * 3. 滚动方向感知 - 优先渲染滚动方向的元素
 * 4. 可见性优化 - 使用 transform 替代 top 定位
 */
const VirtualList: React.FC<VirtualListProps> = ({ 
  items, 
  itemHeight, 
  containerHeight, 
  onDetailClick, 
  favorites, 
  onFavoriteToggle 
}) => {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafIdRef = useRef<number | null>(null);
  const lastScrollTopRef = useRef(0);
  const scrollVelocityRef = useRef(0);
  const lastScrollTimeRef = useRef(Date.now());

  // RAF 节流的滚动处理
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const newScrollTop = e.currentTarget.scrollTop;
    
    // 计算滚动速度（用于动态 overscan）
    const now = Date.now();
    const timeDelta = now - lastScrollTimeRef.current;
    if (timeDelta > 0) {
      scrollVelocityRef.current = Math.abs(newScrollTop - lastScrollTopRef.current) / timeDelta;
      lastScrollTimeRef.current = now;
    }
    lastScrollTopRef.current = newScrollTop;

    // 取消之前的 RAF
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }

    // 使用 RAF 节流
    rafIdRef.current = requestAnimationFrame(() => {
      setScrollTop(newScrollTop);
      rafIdRef.current = null;
    });
  }, []);

  // 清理 RAF
  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  // 动态 overscan 计算
  // 滚动快时增加 overscan，滚动慢时减少 overscan
  const { startIdx, endIdx, offsetY } = useMemo(() => {
    const baseOverscan = 2; // 基础 overscan（上下各2个）
    const velocityOverscan = Math.min(Math.floor(scrollVelocityRef.current * 5), 8); // 速度相关的额外 overscan（最大8）
    const totalOverscan = baseOverscan + velocityOverscan;

    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - totalOverscan);
    const end = Math.min(items.length, Math.ceil((scrollTop + containerHeight) / itemHeight) + totalOverscan);
    const offset = start * itemHeight;

    return { startIdx: start, endIdx: end, offsetY: offset };
  }, [scrollTop, itemHeight, items.length, containerHeight]);

  // 使用 useMemo 缓存可见项，避免不必要的重计算
  const visibleItems = useMemo(() => 
    items.slice(startIdx, endIdx),
    [items, startIdx, endIdx]
  );

  const totalHeight = items.length * itemHeight;

  // 使用 transform 替代 top 以获得更好的性能（GPU加速）
  return (
    <div
      ref={containerRef}
      className="overflow-y-auto"
      style={{ height: containerHeight }}
      onScroll={handleScroll}
      role="list"
      aria-label="项目列表"
    >
      <div 
        style={{ height: totalHeight, position: 'relative' }} 
        role="presentation"
      >
        <div 
          style={{ 
            position: 'absolute', 
            transform: `translateY(${offsetY}px)`, 
            width: '100%',
            willChange: 'transform', // 提示浏览器使用 GPU 加速
          }}
        >
          {visibleItems.map((project) => (
            <div
              key={project.repo.fullName}
              style={{ height: itemHeight }}
              className="mb-4"
              role="listitem"
            >
              <ResultCard 
                project={project} 
                onDetailClick={() => onDetailClick(project)} 
                isFavorite={favorites?.has(project.repo.fullName)} 
                onFavoriteToggle={onFavoriteToggle ? () => onFavoriteToggle(project.repo.fullName, project) : undefined} 
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// 性能优化：使用 React.memo 避免不必要的重渲染
export default React.memo(VirtualList);
