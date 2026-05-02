/**
 * Ralph Telemetry Core - 生产级用户体验与性能收集系统
 * 
 * 核心能力：
 * 1. 用户行为追踪（点击流、交互路径、停留时间）
 * 2. 性能监控（Core Web Vitals、内存、渲染）
 * 3. 错误收集（JS错误、API失败、操作异常）
 * 4. 满意度反馈（NPS、任务完成率、用户评分）
 * 5. 自迭代闭环（数据分析→问题识别→优化建议）
 * 
 * 隐私优先：本地存储为主，用户完全控制数据
 */

// ==================== 类型定义 ====================

export interface TelemetryEvent {
  id: string;
  timestamp: number;
  type: EventType;
  category: EventCategory;
  data: Record<string, any>;
  sessionId: string;
  userId?: string;
}

export type EventType = 
  | 'click'          // 用户点击
  | 'view'           // 页面/组件视图
  | 'search'         // 搜索操作
  | 'filter'         // 筛选操作
  | 'navigation'     // 导航操作
  | 'error'          // 错误事件
  | 'performance'    // 性能指标
  | 'feedback'       // 用户反馈
  | 'session'        // 会话事件
  | 'custom';        // 自定义事件

export type EventCategory = 
  | 'ux'             // 用户体验
  | 'performance'    // 性能
  | 'error'          // 错误
  | 'business'       // 业务
  | 'system';        // 系统

export interface PerformanceMetrics {
  // Core Web Vitals
  fcp?: number;              // First Contentful Paint (ms)
  lcp?: number;              // Largest Contentful Paint (ms)
  fid?: number;              // First Input Delay (ms)
  cls?: number;              // Cumulative Layout Shift
  ttfb?: number;             // Time to First Byte (ms)
  tti?: number;              // Time to Interactive (ms)
  
  // Custom Metrics
  renderTime?: number;       // 组件渲染时间 (ms)
  memoryUsage?: number;      // 内存使用 (MB)
  apiResponseTime?: number;  // API 响应时间 (ms)
  interactionTime?: number;  // 用户交互响应时间 (ms)
  
  // Ralph Specific
  searchLatency?: number;    // 搜索延迟 (ms)
  evaluationTime?: number;   // 评定耗时 (ms)
  filterApplyTime?: number;  // 筛选应用时间 (ms)
}

export interface UserBehaviorData {
  elementId?: string;
  elementType?: string;
  pageTitle?: string;
  previousPage?: string;
  clickPosition?: { x: number; y: number };
  dwellTime?: number;        // 停留时间 (ms)
  scrollDepth?: number;      // 滚动深度 (%)
  inputType?: string;        // 输入类型
  inputValue?: string;       // 输入值（脱敏）
}

export interface ErrorData {
  errorType: 'js' | 'api' | 'network' | 'validation' | 'unknown';
  message: string;
  stack?: string;
  url?: string;
  lineNumber?: number;
  columnNumber?: number;
  userAgent?: string;
  context?: Record<string, any>;
  severity: 'fatal' | 'error' | 'warning' | 'info';
  recoverable: boolean;
  userAction?: string;       // 用户正在执行的操作
}

export interface FeedbackData {
  type: 'nps' | 'rating' | 'bug' | 'feature' | 'general';
  score?: number;            // 1-10 或 NPS -100~100
  comment?: string;
  page?: string;
  component?: string;
  screenshot?: string;       // Base64 截图（可选）
  reproducible?: boolean;
  email?: string;            // 可选联系邮箱
}

export interface SessionInfo {
  id: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  pageViews: number;
  actions: number;
  errors: number;
  deviceInfo: DeviceInfo;
  userInfo?: UserInfo;
  exitReason?: 'normal' | 'error' | 'timeout' | 'unknown';
}

export interface DeviceInfo {
  screenWidth: number;
  screenHeight: number;
  pixelRatio: number;
  language: string;
  platform: string;
  userAgent: string;
  memory?: number;          // 设备内存 (GB)
  cpuCores?: number;
  connection?: string;      // 网络类型
}

export interface UserInfo {
  id?: string;
  preferences?: Record<string, any>;
  usageLevel: 'new' | 'occasional' | 'regular' | 'power';
  lastVisit?: number;
  totalSessions?: number;
}

export interface TelemetryConfig {
  enabled: boolean;
  sampleRate: number;        // 0-1, 采样率
  maxEventsPerSession: number;
  maxLocalStorageSize: number; // MB
  autoFlushInterval: number;  // ms
  debugMode: boolean;
  privacyMode: 'full' | 'minimal' | 'off';
  remoteEndpoint?: string;   // 可选远程端点
  consentRequired: boolean;
}

export interface AnalyticsReport {
  period: { start: number; end: number };
  summary: {
    totalSessions: number;
    totalUsers: number;
    avgSessionDuration: number | null;
    bounceRate: number | null;
    errorRate: number;
    taskCompletionRate: number | null;
    npsScore: number | null;
  };
  performance: PerformanceMetrics & {
    p50: number;
    p90: number;
    p95: number;
    p99: number;
  };
  topErrors: Array<{ count: number; message: string }>;
  userJourneys: Array<{
    path: string[];
    count: number;
    dropOffPoint?: string;
  }>;
  recommendations: Recommendation[];
}

export interface Recommendation {
  id: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: 'performance' | 'ux' | 'error' | 'accessibility' | 'security';
  title: string;
  description: string;
  impact: string;            // 预期影响
  effort: 'quick' | 'moderate' | 'complex';
  evidence: Array<{
    metric: string;
    currentValue: number;
    targetValue: number;
    severity: 'above' | 'below';
  }>;
  status: 'pending' | 'implementing' | 'completed' | 'dismissed';
  createdAt: number;
}

// ==================== 单例类：TelemetryCore ====================

class TelemetryCore {
  private config: TelemetryConfig;
  private events: TelemetryEvent[] = [];
  private session: SessionInfo;
  private performanceMetrics: PerformanceMetrics[] = [];
  private errors: ErrorData[] = [];
  private feedbacks: FeedbackData[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private isInitialized = false;
  private listeners: Map<string, Set<Function>> = new Map();

  constructor(config?: Partial<TelemetryConfig>) {
    this.config = this.mergeDefaults(config);
    this.session = this.createSession();
    
    if (typeof window !== 'undefined') {
      this.initialize();
    }
  }

  // ==================== 初始化 ====================

  private initialize(): void {
    if (this.isInitialized) return;

    try {
      // 加载持久化配置
      this.loadPersistedConfig();
      
      // 设置性能观察器
      this.setupPerformanceObservers();
      
      // 设置全局错误处理
      this.setupGlobalErrorHandlers();
      
      // 设置会话管理
      this.setupSessionManagement();
      
      // 启动自动刷新
      this.startAutoFlush();
      
      // 监听页面可见性变化
      this.setupVisibilityTracking();
      
      this.isInitialized = true;
      this.log('debug', 'Telemetry initialized', { 
        sessionId: this.session.id,
        config: this.config 
      });
      
      // 发送初始化事件
      this.track('session', 'system', {
        action: 'init',
        deviceInfo: this.session.deviceInfo,
      });
      
    } catch (error) {
      console.error('Telemetry initialization failed:', error);
    }
  }

  private mergeDefaults(config?: Partial<TelemetryConfig>): TelemetryConfig {
    return {
      enabled: config?.enabled ?? true,
      sampleRate: config?.sampleRate ?? 1.0,
      maxEventsPerSession: config?.maxEventsPerSession ?? 1000,
      maxLocalStorageSize: config?.maxLocalStorageSize ?? 10,
      autoFlushInterval: config?.autoFlushInterval ?? 30000, // 30s
      debugMode: config?.debugMode ?? false,
      privacyMode: config?.privacyMode ?? 'full',
      remoteEndpoint: config?.remoteEndpoint,
      consentRequired: config?.consentRequired ?? true,
    };
  }

  private createSession(): SessionInfo {
    const sessionId = this.generateUUID();
    const now = Date.now();
    
    return {
      id: sessionId,
      startTime: now,
      pageViews: 0,
      actions: 0,
      errors: 0,
      deviceInfo: this.collectDeviceInfo(),
    };
  }

  private collectDeviceInfo(): DeviceInfo {
    return {
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      pixelRatio: window.devicePixelRatio,
      language: navigator.language,
      platform: navigator.platform,
      userAgent: navigator.userAgent,
      memory: (navigator as any).deviceMemory,
      cpuCores: (navigator as any).hardwareConcurrency,
      connection: (navigator as any).connection?.effectiveType,
    };
  }

  // ==================== 核心追踪 API ====================

  /**
   * 追踪自定义事件
   */
  track(
    type: EventType,
    category: EventCategory,
    data: Record<string, any> = {}
  ): void {
    if (!this.shouldTrack()) return;

    const event: TelemetryEvent = {
      id: this.generateUUID(),
      timestamp: Date.now(),
      type,
      category,
      data: this.sanitizeData(data),
      sessionId: this.session.id,
    };

    this.events.push(event);
    this.session.actions++;

    this.emit('event', event);
    this.log('debug', 'Event tracked', event);

    // 检查是否需要刷新
    if (this.events.length >= 100) {
      this.flush();
    }
  }

  /**
   * 追踪用户点击
   */
  trackClick(element: HTMLElement, additionalData?: Record<string, any>): void {
    const behaviorData: UserBehaviorData = {
      elementId: element.id || undefined,
      elementType: element.tagName.toLowerCase(),
      clickPosition: { x: 0, y: 0 }, // 将在事件中更新
      ...additionalData,
    };

    this.track('click', 'ux', {
      ...behaviorData,
      textContent: this.truncateText(element.textContent || '', 100),
      href: (element as HTMLAnchorElement).href || undefined,
      ariaLabel: element.getAttribute('aria-label') || undefined,
    });
  }

  /**
   * 追踪页面视图
   */
  trackView(pageName: string, metadata?: Record<string, any>): void {
    this.track('view', 'ux', {
      page: pageName,
      url: window.location.href,
      referrer: document.referrer,
      title: document.title,
      ...metadata,
    });

    this.session.pageViews++;
    this.persistSession();
  }

  /**
   * 追踪搜索操作
   */
  trackSearch(query: string, resultCount: number, latencyMs: number): void {
    this.track('search', 'business', {
      query: this.hashString(query), // 脱敏
      queryLength: query.length,
      resultCount,
      latencyMs,
      timestamp: Date.now(),
    });

    // 更新性能指标
    this.recordPerformanceMetric('searchLatency', latencyMs);
  }

  /**
   * 追踪筛选操作
   */
  trackFilter(filters: Record<string, any>, applyTimeMs: number): void {
    this.track('filter', 'business', {
      filters: Object.keys(filters),
      filterCount: Object.keys(filters).length,
      applyTimeMs,
    });

    this.recordPerformanceMetric('filterApplyTime', applyTimeMs);
  }

  /**
   * 追踪错误
   */
  trackError(errorData: ErrorData): void {
    this.errors.push(errorData);
    this.session.errors++;

    this.track('error', 'error', {
      ...errorData,
      message: this.truncateText(errorData.message, 500),
      stack: this.config.privacyMode === 'full' ? errorData.stack : undefined,
    });

    // 严重错误立即刷新
    if (errorData.severity === 'fatal') {
      this.flush();
    }
  }

  /**
   * 追踪性能指标
   */
  recordPerformanceMetric(metric: keyof PerformanceMetrics, value: number): void {
    const entry: PerformanceMetrics = { [metric]: value } as any;
    this.performanceMetrics.push(entry);

    this.track('performance', 'performance', {
      metric,
      value,
      timestamp: Date.now(),
    });
  }

  /**
   * 追踪用户反馈
   */
  trackFeedback(feedback: FeedbackData): void {
    this.feedbacks.push(feedback);

    this.track('feedback', 'ux', {
      type: feedback.type,
      score: feedback.score,
      hasComment: !!feedback.comment,
      commentLength: feedback.comment?.length || 0,
      page: feedback.page,
      component: feedback.component,
    });

    // 反馈立即刷新
    this.flush();
  }

  // ==================== 性能监控 ====================

  private setupPerformanceObservers(): void {
    if (!('PerformanceObserver' in window)) return;

    // 观察 Core Web Vitals
    try {
      // FCP
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const fcp = entries.find(e => e.name === 'first-contentful-paint');
        if (fcp) {
          this.recordPerformanceMetric('fcp', fcp.startTime);
        }
      }).observe({ type: 'paint', buffered: true });

      // LCP
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        if (lastEntry) {
          this.recordPerformanceMetric('lcp', lastEntry.startTime);
        }
      }).observe({ type: 'largest-contentful-paint', buffered: true });

      // FID
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        for (const entry of entries) {
          const fidEntry = entry as PerformanceEventTiming;
          this.recordPerformanceMetric('fid', (fidEntry.processingStart || 0) - entry.startTime);
        }
      }).observe({ type: 'first-input', buffered: true });

      // CLS
      let clsValue = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value;
          }
        }
        this.recordPerformanceMetric('cls', clsValue);
      }).observe({ type: 'layout-shift', buffered: true });

      // TTFB
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (navigation) {
        this.recordPerformanceMetric('ttfb', navigation.responseStart - navigation.requestStart);
        this.recordPerformanceMetric('tti', navigation.domInteractive - navigation.requestStart);
      }

    } catch (error) {
      this.log('warn', 'Failed to setup performance observers', { error });
    }

    // 内存监控
    this.startMemoryMonitoring();
  }

  private startMemoryMonitoring(): void {
    setInterval(() => {
      const memory = (performance as any).memory;
      if (memory) {
        this.recordPerformanceMetric('memoryUsage', memory.usedJSHeapSize / (1024 * 1024));
      }
    }, 30000); // 每30秒检查一次
  }

  // ==================== 错误处理 ====================

  private setupGlobalErrorHandlers(): void {
    // JavaScript 错误
    window.addEventListener('error', (event) => {
      this.trackError({
        errorType: 'js',
        message: event.message,
        stack: event.error?.stack,
        url: event.filename,
        lineNumber: event.lineno,
        columnNumber: event.colno,
        severity: 'error',
        recoverable: true,
        context: {
          target: (event.target as HTMLElement)?.tagName,
        },
      });
    });

    // Promise 未捕获的拒绝
    window.addEventListener('unhandledrejection', (event) => {
      this.trackError({
        errorType: 'js',
        message: `Unhandled promise rejection: ${event.reason}`,
        severity: 'error',
        recoverable: false,
        context: {
          reason: String(event.reason),
        },
      });
    });

    // 资源加载错误
    window.addEventListener('error', (event) => {
      if (event.target !== window) {
        const target = event.target as HTMLElement;
        this.trackError({
          errorType: 'network',
          message: `Resource load failed: ${target.tagName} ${target.getAttribute('src') || target.getAttribute('href')}`,
          severity: 'warning',
          recoverable: true,
        });
      }
    }, true); // 使用捕获阶段
  }

  // ==================== 会话管理 ====================

  private setupSessionManagement(): void {
    // 页面加载恢复会话
    const savedSession = localStorage.getItem('ralph-telemetry-session');
    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession);
        // 如果会话不超过2小时，继续使用
        if (Date.now() - parsed.startTime < 2 * 60 * 60 * 1000) {
          this.session = parsed;
          this.log('debug', 'Session restored', { sessionId: this.session.id });
        }
      } catch (e) {
        // 忽略解析错误
      }
    }

    // 页面卸载保存会话
    window.addEventListener('beforeunload', () => {
      this.endSession('normal');
    });

    // 页面隐藏/显示
    this.setupVisibilityTracking();
  }

  private setupVisibilityTracking(): void {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.track('session', 'system', {
          action: 'background',
          duration: Date.now() - this.session.startTime,
        });
      } else {
        this.track('session', 'system', {
          action: 'foreground',
        });
      }
    });
  }

  private endSession(reason: SessionInfo['exitReason']): void {
    this.session.endTime = Date.now();
    this.session.duration = this.session.endTime - this.session.startTime;
    this.session.exitReason = reason;

    this.track('session', 'system', {
      action: 'end',
      reason,
      duration: this.session.duration,
      totalActions: this.session.actions,
      totalPageViews: this.session.pageViews,
      totalErrors: this.session.errors,
    });

    this.flush();
    this.persistSession();
  }

  // ==================== 数据刷新与持久化 ====================

  private startAutoFlush(): void {
    if (this.flushTimer) clearInterval(this.flushTimer);

    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.autoFlushInterval);
  }

  /**
   * 刷新数据到存储
   */
  async flush(): Promise<void> {
    if (this.events.length === 0) return;

    try {
      const batch = [...this.events];
      this.events = [];

      // 本地存储
      await this.persistToLocalStorage(batch);

      // 远程发送（如果配置了）
      if (this.config.remoteEndpoint && this.config.enabled) {
        await this.sendToRemote(batch);
      }

      this.log('debug', `Flushed ${batch.length} events`);
      this.emit('flush', { count: batch.length });

    } catch (error) {
      this.log('error', 'Flush failed', { error });
      // 失败的事件重新加入队列
      this.events.unshift(...(await this.getFromLocalStorage() || []));
    }
  }

  private async persistToLocalStorage(events: TelemetryEvent[]): Promise<void> {
    try {
      const existing = JSON.parse(localStorage.getItem('ralph-telemetry-events') || '[]');
      const updated = [...existing, ...events].slice(-this.config.maxEventsPerSession);
      
      // 检查存储大小
      const size = new Blob([JSON.stringify(updated)]).size / (1024 * 1024);
      if (size > this.config.maxLocalStorageSize) {
        // 只保留最近的数据
        updated.splice(0, Math.floor(updated.length / 2));
      }

      localStorage.setItem('ralph-telemetry-events', JSON.stringify(updated));
    } catch (error) {
      this.log('error', 'Failed to persist to localStorage', { error });
    }
  }

  private async getFromLocalStorage(): Promise<TelemetryEvent[] | null> {
    try {
      const data = localStorage.getItem('ralph-telemetry-events');
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  private async sendToRemote(events: TelemetryEvent[]): Promise<void> {
    if (!this.config.remoteEndpoint) return;

    try {
      const response = await fetch(this.config.remoteEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          events,
          session: this.session,
          timestamp: Date.now(),
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      this.log('warn', 'Failed to send to remote endpoint', { error });
    }
  }

  private persistSession(): void {
    try {
      localStorage.setItem('ralph-telemetry-session', JSON.stringify(this.session));
    } catch (error) {
      this.log('error', 'Failed to persist session', { error });
    }
  }

  private loadPersistedConfig(): void {
    try {
      const saved = localStorage.getItem('ralph-telemetry-config');
      if (saved) {
        const parsed = JSON.parse(saved);
        this.config = { ...this.config, ...parsed };
      }
    } catch (error) {
      // 使用默认配置
    }
  }

  // ==================== 分析与报告 ====================

  /**
   * 生成分析报告
   */
  async generateReport(days: number = 7): Promise<AnalyticsReport> {
    const events = await this.getFromLocalStorage() || [];
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const filteredEvents = events.filter(e => e.timestamp >= cutoff);

    // 计算基础指标
    const sessions = new Set(filteredEvents.map(e => e.sessionId));
    const errors = filteredEvents.filter(e => e.type === 'error');
    const performanceEvents = filteredEvents.filter(e => e.type === 'performance');

    // 计算性能百分位数
    const metrics = this.calculatePerformancePercentiles(performanceEvents);

    // 统计 Top 错误
    const topErrors = this.aggregateErrors(errors);

    // 分析用户旅程
    const journeys = this.analyzeUserJourneys(filteredEvents);

    // 生成优化建议
    const recommendations = this.generateRecommendations(metrics, errors, journeys);

    return {
      period: { start: cutoff, end: Date.now() },
      summary: {
        totalSessions: sessions.size,
        totalUsers: sessions.size, // 简化：假设每个会话是一个用户
        avgSessionDuration: this.calculateAverageSessionDuration(filteredEvents),
        bounceRate: this.calculateBounceRate(filteredEvents),
        errorRate: errors.length / filteredEvents.length || 0,
        taskCompletionRate: this.calculateTaskCompletionRate(filteredEvents),
        npsScore: this.calculateNPSScore(filteredEvents),
      },
      performance: metrics,
      topErrors,
      userJourneys: journeys,
      recommendations,
    };
  }

  private calculatePerformancePercentiles(events: TelemetryEvent[]): PerformanceMetrics & { p50: number; p90: number; p95: number; p99: number } {
    const values = events
      .filter(e => e.data.value !== undefined)
      .map(e => e.data.value as number)
      .sort((a, b) => a - b);

    const percentile = (p: number) => {
      const index = Math.ceil(p / 100 * values.length) - 1;
      return values[index] || 0;
    };

    return {
      fcp: this.extractMetric(events, 'fcp'),
      lcp: this.extractMetric(events, 'lcp'),
      fid: this.extractMetric(events, 'fid'),
      cls: this.extractMetric(events, 'cls'),
      ttfb: this.extractMetric(events, 'ttfb'),
      tti: this.extractMetric(events, 'tti'),
      searchLatency: this.extractMetric(events, 'searchLatency'),
      evaluationTime: this.extractMetric(events, 'evaluationTime'),
      p50: percentile(50),
      p90: percentile(90),
      p95: percentile(95),
      p99: percentile(99),
    };
  }

  private extractMetric(events: TelemetryEvent[], metric: string): number | undefined {
    const event = events.find(e => e.data.metric === metric);
    return event?.data.value;
  }

  private aggregateErrors(errors: TelemetryEvent[]): Array<{ count: number; message: string }> {
    const aggregated = new Map<string, number>();
    
    for (const error of errors) {
      const key = error.data.message || 'Unknown error';
      aggregated.set(key, (aggregated.get(key) || 0) + 1);
    }

    return Array.from(aggregated.entries())
      .map(([message, count]) => ({ count, message }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private analyzeUserJourneys(events: TelemetryEvent[]): Array<{ path: string[]; count: number; dropOffPoint?: string }> {
    // 简化实现：提取常见路径
    const paths = new Map<string, number>();

    for (let i = 0; i < events.length - 2; i++) {
      if (events[i].type === 'view') {
        const path = [
          events[i]?.data.page,
          events[i + 1]?.data.page,
          events[i + 2]?.data.page,
        ].filter(Boolean);

        if (path.length >= 2) {
          const key = path.join(' → ');
          paths.set(key, (paths.get(key) || 0) + 1);
        }
      }
    }

    return Array.from(paths.entries())
      .map(([path, count]) => ({ path: path.split(' → '), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  }

  private generateRecommendations(
    metrics: any,
    errors: TelemetryEvent[],
    _journeys: any[]
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // 基于错误的建议
    if (errors.length > 10) {
      recommendations.push({
        id: this.generateUUID(),
        priority: 'high',
        category: 'error',
        title: '错误率过高',
        description: `检测到 ${errors.length} 个错误，需要关注`,
        impact: '降低用户流失率',
        effort: 'moderate',
        evidence: [{
          metric: 'errorRate',
          currentValue: errors.length,
          targetValue: 5,
          severity: 'above',
        }],
        status: 'pending',
        createdAt: Date.now(),
      });
    }

    // 基于性能的建议（仅在数据可用时）
    if (metrics?.lcp !== undefined && metrics.lcp > 2500) {
      recommendations.push({
        id: this.generateUUID(),
        priority: 'medium',
        category: 'performance',
        title: '优化首屏加载',
        description: '考虑代码分割和懒加载以改善 LCP',
        impact: '提升用户留存率',
        effort: 'moderate',
        evidence: [{
          metric: 'lcp',
          currentValue: metrics.lcp,
          targetValue: 2000,
          severity: 'above',
        }],
        status: 'pending',
        createdAt: Date.now(),
      });
    }

    return recommendations;
  }

  // 辅助计算方法
  private calculateAverageSessionDuration(_events: TelemetryEvent[]): number | null {
    const sessionEvents = _events.filter(e => e.type === 'session' && e.data.action === 'end' && e.data.duration);
    if (sessionEvents.length === 0) return null;
    const total = sessionEvents.reduce((sum, e) => sum + (e.data.duration as number), 0);
    return total / sessionEvents.length;
  }

  private calculateBounceRate(_events: TelemetryEvent[]): number | null {
    const sessions = new Set(_events.filter(e => e.type === 'session').map(e => e.sessionId));
    const singlePageSessions = _events.filter(e => e.type === 'view').length;
    if (sessions.size === 0) return null;
    // Simplified: count sessions with only one page view
    return singlePageSessions > 0 ? Math.min(singlePageSessions / sessions.size, 1) : null;
  }

  private calculateTaskCompletionRate(_events: TelemetryEvent[]): number | null {
    const searchEvents = _events.filter(e => e.type === 'search');
    if (searchEvents.length === 0) return null;
    const withResults = searchEvents.filter(e => (e.data.resultCount as number) > 0);
    return withResults.length / searchEvents.length;
  }

  private calculateNPSScore(_events: TelemetryEvent[]): number | null {
    const feedbackEvents = _events.filter(e => e.type === 'feedback' && e.data.score !== undefined);
    if (feedbackEvents.length === 0) return null;
    const promoters = feedbackEvents.filter(e => (e.data.score as number) >= 9).length;
    const detractors = feedbackEvents.filter(e => (e.data.score as number) <= 6).length;
    return ((promoters - detractors) / feedbackEvents.length) * 100;
  }

  // ==================== 工具方法 ====================

  private shouldTrack(): boolean {
    if (!this.config.enabled) return false;
    
    // 采样率检查
    if (Math.random() > this.config.sampleRate) return false;

    // 事件数量限制
    if (this.events.length >= this.config.maxEventsPerSession) {
      this.log('warn', 'Max events per session reached');
      return false;
    }

    return true;
  }

  private sanitizeData(data: Record<string, any>): Record<string, any> {
    if (this.config.privacyMode === 'off') return {};

    const sanitized: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(data)) {
      switch (key) {
        case 'token':
        case 'password':
        case 'apiKey':
        case 'secret':
          sanitized[key] = '[REDACTED]';
          break;
        case 'query':
        case 'search':
        case 'input':
          sanitized[key] = this.hashString(String(value));
          break;
        default:
          sanitized[key] = value;
      }
    }

    return sanitized;
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }

  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  private emit(event: string, data: any): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach(listener => listener(data));
    }
  }

  on(event: string, callback: Function): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    
    // 返回取消订阅函数
    return () => this.listeners.get(event)?.delete(callback);
  }

  private log(level: string, message: string, data?: any): void {
    if (!this.config.debugMode) return;
    
    const prefix = `[Telemetry:${level.toUpperCase()}]`;
    switch (level) {
      case 'error': console.error(prefix, message, data); break;
      case 'warn': console.warn(prefix, message, data); break;
      case 'debug': console.debug(prefix, message, data); break;
      default: console.log(prefix, message, data);
    }
  }

  // ==================== 公共 API ====================

  /**
   * 更新配置
   */
  updateConfig(config: Partial<TelemetryConfig>): void {
    this.config = { ...this.config, ...config };
    localStorage.setItem('ralph-telemetry-config', JSON.stringify(this.config));
    this.log('debug', 'Config updated', config);
  }

  /**
   * 获取当前会话信息
   */
  getSession(): SessionInfo {
    return { ...this.session };
  }

  /**
   * 获取所有收集的错误
   */
  getErrors(): ErrorData[] {
    return [...this.errors];
  }

  /**
   * 获取所有用户反馈
   */
  getFeedbacks(): FeedbackData[] {
    return [...this.feedbacks];
  }

  /**
   * 清除所有本地数据
   */
  clearAllData(): void {
    this.events = [];
    this.performanceMetrics = [];
    this.errors = [];
    this.feedbacks = [];
    localStorage.removeItem('ralph-telemetry-events');
    localStorage.removeItem('ralph-telemetry-session');
    this.log('info', 'All telemetry data cleared');
  }

  /**
   * 导出数据为 JSON
   */
  async exportData(): Promise<string> {
    const events = await this.getFromLocalStorage() || [];
    return JSON.stringify({
      version: '1.0.0',
      exportedAt: Date.now(),
      session: this.session,
      events,
      errors: this.errors,
      feedbacks: this.feedbacks,
      performanceMetrics: this.performanceMetrics,
    }, null, 2);
  }

  /**
   * 销毁实例
   */
  destroy(): void {
    if (this.flushTimer) clearInterval(this.flushTimer);
    this.endSession('normal');
    this.isInitialized = false;
    this.listeners.clear();
    this.log('info', 'Telemetry destroyed');
  }
}

// ==================== 单例导出 ====================

let instance: TelemetryCore | null = null;

export function getTelemetry(config?: Partial<TelemetryConfig>): TelemetryCore {
  if (!instance) {
    instance = new TelemetryCore(config);
  }
  return instance;
}

export function initTelemetry(config?: Partial<TelemetryConfig>): TelemetryCore {
  if (instance) {
    instance.destroy();
  }
  instance = new TelemetryCore(config);
  return instance;
}

// React Hook 封装
export function useTelemetry() {
  const telemetry = getTelemetry();
  
  return {
    track: telemetry.track.bind(telemetry),
    trackClick: telemetry.trackClick.bind(telemetry),
    trackView: telemetry.trackView.bind(telemetry),
    trackSearch: telemetry.trackSearch.bind(telemetry),
    trackFilter: telemetry.trackFilter.bind(telemetry),
    trackError: telemetry.trackError.bind(telemetry),
    trackFeedback: telemetry.trackFeedback.bind(telemetry),
    generateReport: telemetry.generateReport.bind(telemetry),
    getSession: telemetry.getSession.bind(telemetry),
    getErrors: telemetry.getErrors.bind(telemetry),
    exportData: telemetry.exportData.bind(telemetry),
    clearAllData: telemetry.clearAllData.bind(telemetry),
  };
}

export default TelemetryCore;
