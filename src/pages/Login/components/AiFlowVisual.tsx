/**
 * 登录页「AI 流程引擎」视觉图形
 *
 * 纯 SVG + CSS 动画（无第三方依赖、无位图）：
 *   左侧输入节点 → 中央引擎核心 → 右侧输出节点，路径上有流动的数据脉冲，
 *   核心带旋转轨道与呼吸光晕，整体呈现「AI 自动编排流程」的意象。
 *
 * 动画类（.edge / .orbit / .corePulse …）定义在 Login.less 中，
 * 与登录页共用同一份样式模块，保证配色与动效统一。
 */
import React from 'react';
import styles from '../Login.less';

/** 中央引擎核心坐标（与下方路径/节点坐标配套，改动需同步） */
const CX = 280;
const CY = 232;

/** 输入 / 输出节点：[x, y, 文案] */
const INPUT_NODES: [number, number, string][] = [
  [72, 96, '发起'],
  [64, 232, '表单'],
  [96, 366, '数据'],
];
const OUTPUT_NODES: [number, number, string][] = [
  [470, 104, '审批'],
  [486, 232, '归档'],
  [452, 360, '洞察'],
];

/** 节点 → 核心 的连线（贝塞尔曲线，同时用于脉冲的 animateMotion） */
const IN_PATHS = [
  `M96,96 C160,96 176,168 ${CX - 58},${CY - 26}`,
  `M88,232 C160,232 168,232 ${CX - 60},${CY}`,
  `M120,366 C170,366 184,296 ${CX - 56},${CY + 28}`,
];
const OUT_PATHS = [
  `M${CX + 58},${CY - 26} C392,168 408,104 ${446},104`,
  `M${CX + 60},${CY} C392,232 410,232 ${462},232`,
  `M${CX + 56},${CY + 28} C388,296 404,360 ${428},360`,
];

const AiFlowVisual: React.FC = () => (
  <svg
    className={styles.visual}
    viewBox="0 0 560 464"
    role="img"
    aria-label="AI 流程引擎：输入节点经引擎核心自动编排后输出审批、归档与洞察"
  >
    <defs>
      <linearGradient id="aiEdge" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#34E7D6" stopOpacity="0.08" />
        <stop offset="55%" stopColor="#34E7D6" stopOpacity="0.9" />
        <stop offset="100%" stopColor="#4C7DFF" stopOpacity="0.25" />
      </linearGradient>
      <linearGradient id="aiEdgeOut" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#4C7DFF" stopOpacity="0.25" />
        <stop offset="45%" stopColor="#34E7D6" stopOpacity="0.9" />
        <stop offset="100%" stopColor="#FFB347" stopOpacity="0.55" />
      </linearGradient>
      <linearGradient id="aiCoreFill" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#3DF0DC" />
        <stop offset="100%" stopColor="#3B6BFF" />
      </linearGradient>
      <radialGradient id="aiCoreGlow">
        <stop offset="0%" stopColor="#34E7D6" stopOpacity="0.5" />
        <stop offset="100%" stopColor="#34E7D6" stopOpacity="0" />
      </radialGradient>
      <filter id="aiGlow" x="-70%" y="-70%" width="240%" height="240%">
        <feGaussianBlur stdDeviation="5" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>

    {/* 轨道：三层虚线同心环，反向缓慢旋转 */}
    <g className={styles.orbitGroup}>
      <circle className={`${styles.orbit} ${styles.orbit1}`} cx={CX} cy={CY} r={148} />
      <circle className={`${styles.orbit} ${styles.orbit2}`} cx={CX} cy={CY} r={112} />
      <circle className={`${styles.orbit} ${styles.orbit3}`} cx={CX} cy={CY} r={188} />
    </g>

    {/* 连线：输入 → 核心 → 输出 */}
    <g fill="none" strokeLinecap="round">
      {IN_PATHS.map((d) => (
        <path key={`in-${d}`} className={styles.edge} d={d} stroke="url(#aiEdge)" />
      ))}
      {OUT_PATHS.map((d) => (
        <path key={`out-${d}`} className={styles.edge} d={d} stroke="url(#aiEdgeOut)" />
      ))}
    </g>

    {/* 沿连线流动的数据脉冲 */}
    <g>
      {IN_PATHS.map((d, i) => (
        <circle key={`pin-${i}`} className={styles.pulse} r={3.6}>
          <animateMotion dur="2.6s" begin={`${i * 0.35}s`} repeatCount="indefinite" path={d} />
        </circle>
      ))}
      {OUT_PATHS.map((d, i) => (
        <circle key={`pout-${i}`} className={`${styles.pulse} ${styles.pulseWarm}`} r={3.6}>
          <animateMotion dur="2.8s" begin={`${i * 0.4}s`} repeatCount="indefinite" path={d} />
        </circle>
      ))}
    </g>

    {/* 输入节点 */}
    <g>
      {INPUT_NODES.map(([x, y, label]) => (
        <g key={`n-${label}`}>
          <rect
            className={styles.nodeBox}
            x={x - 34}
            y={y - 19}
            width={68}
            height={38}
            rx={12}
          />
          <circle className={styles.nodeDot} cx={x - 18} cy={y} r={4} />
          <text className={styles.nodeLabel} x={x + 22} y={y + 4}>
            {label}
          </text>
        </g>
      ))}
    </g>

    {/* 输出节点 */}
    <g>
      {OUTPUT_NODES.map(([x, y, label]) => (
        <g key={`o-${label}`}>
          <rect
            className={`${styles.nodeBox} ${styles.nodeBoxOut}`}
            x={x - 34}
            y={y - 19}
            width={68}
            height={38}
            rx={12}
          />
          <circle className={`${styles.nodeDot} ${styles.nodeDotOut}`} cx={x - 18} cy={y} r={4} />
          <text className={styles.nodeLabel} x={x + 22} y={y + 4}>
            {label}
          </text>
        </g>
      ))}
    </g>

    {/* 中央引擎核心 */}
    <g>
      <circle cx={CX} cy={CY} r={104} fill="url(#aiCoreGlow)" />
      <g className={styles.coreSpin}>
        <circle
          className={styles.coreRing}
          cx={CX}
          cy={CY}
          r={76}
          fill="none"
          stroke="#34E7D6"
          strokeOpacity="0.55"
          strokeWidth="1.2"
          strokeDasharray="5 9"
        />
        <circle cx={CX + 76} cy={CY} r={3} className={styles.coreSatellite} />
      </g>
      <path
        className={styles.coreHex}
        d={`M${CX},${CY - 52} L${CX + 45},${CY - 26} L${CX + 45},${CY + 26} L${CX},${CY + 52} L${CX - 45},${CY + 26} L${CX - 45},${CY - 26} Z`}
        fill="url(#aiCoreFill)"
        fillOpacity="0.16"
        stroke="url(#aiCoreFill)"
        strokeWidth="1.6"
        filter="url(#aiGlow)"
      />
      {/* 核心内部的「流程链」符号：三个节点由折线串联 */}
      <g stroke="#DFFFF9" strokeWidth="1.6" fill="none" strokeLinecap="round">
        <path d={`M${CX - 22},${CY + 10} L${CX - 8},${CY + 10} L${CX - 8},${CY - 10} L${CX + 8},${CY - 10} L${CX + 8},${CY + 10} L${CX + 22},${CY + 10}`} />
      </g>
      <circle className={styles.coreDot} cx={CX - 22} cy={CY + 10} r={3.4} />
      <circle className={styles.coreDot} cx={CX} cy={CY - 10} r={3.4} />
      <circle className={styles.coreDot} cx={CX + 22} cy={CY + 10} r={3.4} />
      <text className={styles.coreLabel} x={CX} y={CY + 78}>
        AI ENGINE
      </text>
    </g>
  </svg>
);

export default AiFlowVisual;
