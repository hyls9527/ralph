import React from 'react';
import type { ProjectRecommendation } from '../types';
import { useI18n } from '../i18n';

interface PipelineVisualizationProps {
  project: ProjectRecommendation;
}

const pipelineLayerInfo: Record<string, { icon: string; desc: string; color: string }> = {
  '证据门槛': { icon: '🔬', desc: 'L4声明验证得分上限50%，L5无证据直接归零', color: 'border-amber-500 bg-amber-500/10' },
  '贝叶斯修正': { icon: '📐', desc: '证据不足时向全局均值回归，防止小样本虚高', color: 'border-blue-500 bg-blue-500/10' },
  '基础天花板': { icon: '🏗️', desc: '基础项缺失限制关联维度得分上限', color: 'border-violet-500 bg-violet-500/10' },
  '交叉校验': { icon: '🔗', desc: '多维度交叉验证，增加操纵难度', color: 'border-emerald-500 bg-emerald-500/10' },
  '维度地板': { icon: '⚠️', desc: '任意维度低于地板值触发一票否决（F维度35%）', color: 'border-rose-500 bg-rose-500/10' },
  '异常检测': { icon: '🔍', desc: '评分分布+特征组合+提交模式+Star膨胀综合检测', color: 'border-orange-500 bg-orange-500/10' },
  'OpenSSF校准': { icon: '🛡️', desc: 'F维度得分不得高于Scorecard安全分1.2倍', color: 'border-cyan-500 bg-cyan-500/10' },
};

const PipelineVisualization: React.FC<PipelineVisualizationProps> = ({ project }) => {
  const { t } = useI18n();
  const { decisionTrail } = project;

  if (!decisionTrail || decisionTrail.length === 0) {
    return (
      <div className="text-sm py-8 text-center text-gray-400">
        {t('noPipelineData')}
      </div>
    );
  }

  const maxDelta = Math.max(...decisionTrail.map(s => Math.abs(s.after - s.before)), 1);

  return (
    <div className="space-y-1">
      <div className="text-xs text-gray-500 mb-3 px-1">
        {t('pipelineDesc')}
      </div>

      {decisionTrail.map((step, i) => {
        const info = pipelineLayerInfo[step.step] || {
          icon: '📊',
          desc: '',
          color: 'border-gray-500 bg-gray-500/10',
        };
        const delta = step.after - step.before;
        const isUp = delta > 0;
        const isDown = delta < 0;
        const barWidth = Math.max(Math.abs(delta) / maxDelta * 100, 4);

        return (
          <div key={i} className={`relative rounded-lg border ${info.color} p-4`}>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-sm">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-gray-200">
                    {info.icon} {step.step}
                  </span>
                  <span className="text-xs text-gray-500">{step.action}</span>
                </div>
                {info.desc && (
                  <p className="text-xs text-gray-500 mt-1">{info.desc}</p>
                )}

                <div className="mt-3 flex items-center gap-3">
                  <div className="flex items-center gap-1.5 min-w-[100px]">
                    <span className="text-xs text-gray-500">{step.before.toFixed(1)}</span>
                    <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                    <span className={`text-sm font-semibold ${
                      isUp ? 'text-emerald-400' : isDown ? 'text-rose-400' : 'text-gray-400'
                    }`}>
                      {step.after.toFixed(1)}
                    </span>
                    <span className={`text-xs font-medium ${
                      isUp ? 'text-emerald-400' : isDown ? 'text-rose-400' : 'text-gray-500'
                    }`}>
                      {isUp ? `+${delta.toFixed(1)}` : isDown ? delta.toFixed(1) : '±0'}
                    </span>
                  </div>

                  <div className="flex-1 h-1.5 bg-gray-700/50 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        isUp ? 'bg-emerald-500' : isDown ? 'bg-rose-500' : 'bg-gray-500'
                      }`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>

                <p className="text-xs text-gray-500 mt-2 italic">
                  {step.reason}
                </p>
              </div>
            </div>

            {i < decisionTrail.length - 1 && (
              <div className="absolute left-7 bottom-0 top-full w-px bg-gray-700/50 h-3" />
            )}
          </div>
        );
      })}

      <div className="mt-4 p-3 rounded-lg bg-violet-500/5 border border-violet-500/20">
        <div className="flex items-center gap-2">
          <span className="text-xs text-violet-400 font-medium">{t('pipelineSummary')}</span>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          {t('pipelineSummaryDesc', {
            layers: decisionTrail.length,
            initial: decisionTrail[0]?.before.toFixed(1) ?? '0',
            final: decisionTrail[decisionTrail.length - 1]?.after.toFixed(1) ?? '0',
          })}
        </p>
      </div>
    </div>
  );
};

export default PipelineVisualization;
