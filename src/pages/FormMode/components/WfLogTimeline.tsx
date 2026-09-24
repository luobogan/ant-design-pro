import React from 'react';
import { Card, Empty, Timeline } from 'antd';

/**
 * 流程日志时间线（测试运行 / 模拟运行 共用）。
 *
 * <p>后端日志行均为「时间戳 + 事件描述」纯文本（例：
 * {@code 2026-09-24 08:26:14 到达节点"开始"，操作者"王维（531）"}）。
 * 本组件把每行渲染成一个 Timeline 节点，按事件关键字着色，并把时间戳与事件拆成
 * 两段（时间戳灰、事件正常）以提升可读性。</p>
 */

/** 时间线节点着色：按事件关键字映射 antd Timeline 颜色（hex 兼容 v6） */
export const logColor = (line?: string): string => {
  if (!line) return '#bfbfbf';
  // 失败 / 异常 / 中断 一律红色
  if (
    line.includes('未通过') ||
    line.includes('异常') ||
    line.includes('中断') ||
    line.includes('中止') ||
    line.includes('校验未通过') ||
    line.includes('无待办')
  ) {
    return '#ff4d4f';
  }
  if (line.includes('生成流程编号')) return '#722ed1';
  if (line.includes('开始自动测试') || line.includes('已真实发起测试实例')) return '#13c2c2';
  if (line.includes('执行出口')) return '#1677ff';
  if (line.includes('通过节点')) return '#52c41a';
  if (line.includes('提交')) return '#52c41a';
  if (line.includes('到达节点')) return '#1677ff';
  if (line.includes('节点前附加操作')) return '#faad14';
  return '#1677ff';
};

/** 把日志行拆成「时间戳（灰）+ 事件（正常）」两段渲染 */
export const renderLogLine = (line: string) => {
  const m = line.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\s+(.*)$/);
  if (m) {
    return (
      <>
        <span style={{ color: '#999', fontFamily: 'monospace' }}>{m[1]}</span>{' '}
        <span>{m[2]}</span>
      </>
    );
  }
  return <span>{line}</span>;
};

interface WfLogTimelineProps {
  /** 日志行（每行形如「时间戳 事件描述」） */
  log?: string[];
  /** 卡片标题 */
  title?: string;
  /** 滚动区域最大高度 */
  maxHeight?: number;
  /** 无日志时的占位提示 */
  emptyText?: string;
}

const WfLogTimeline: React.FC<WfLogTimelineProps> = ({
  log,
  title = '可读流转时间线',
  maxHeight = 360,
  emptyText = '（无日志）',
}) => {
  const lines = log && log.length > 0 ? log : [];
  return (
    <Card size="small" title={title}>
      {lines.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} />
      ) : (
        <div style={{ maxHeight, overflow: 'auto', paddingRight: 8 }}>
          <Timeline
            items={lines.map((line) => ({
              color: logColor(line),
              children: (
                <span style={{ fontSize: 13, lineHeight: '22px' }}>{renderLogLine(line)}</span>
              ),
            }))}
          />
        </div>
      )}
    </Card>
  );
};

export default WfLogTimeline;
