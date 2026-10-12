import { useCallback, useSyncExternalStore } from 'react';

/**
 * 字段控件统一设计令牌（单一来源）
 *
 * ⚠️ 开发规范（与 fieldTypes.ts 的「编码单一来源」并列）：
 *   1. 字段控件的颜色 / 字号 / 触控尺寸**只能**取自本文件，禁止在页面或控件里写魔法值
 *      （历史遗留的 `#d9d9d9` / `#f5f5f5` / `fontSize: 13` 等散落各处，已在此收敛）。
 *   2. 新增字段类型时：编码与标签改 `fieldTypes.ts`，控件实现改
 *      `FieldControl.tsx`（桌面）/ `MobileFieldControl.tsx`（手机），令牌只在本文件维护。
 *   3. 桌面端与手机端**共用同一套 props 契约**（见 FieldControlProps），
 *      仅通过 `variant` 切换外观与交互，保证「一处定义、两端调用」。
 *
 * 为什么要分 variant：
 *   - 桌面端在 Excel 网格单元格里，单元格可能只有 120px 宽，需要 size="small" 的紧凑控件；
 *   - 手机端是整行流式布局，控件需要 ≥40px 的触控高度、≥16px 的字号
 *     （iOS Safari 对 <16px 的输入框聚焦时会自动放大页面，体验很差）。
 *   两套尺寸诉求相反，硬凑一套必然有一端变形，故按 variant 提供两套令牌。
 */

/** 控件外观变体：desktop=紧凑（表格内）｜mobile=触控友好（整行）｜auto=按视口自动 */
export type FieldVariant = 'desktop' | 'mobile' | 'auto';

/** 移动端断点（与 ExcelPreview.detectMobile 的 768px 保持一致） */
export const MOBILE_BREAKPOINT = 768;

/** 字段控件调色板（桌面 / 手机共用，仅语义色，不含尺寸） */
export const FIELD_COLOR = {
  /** 标签文字色 */
  label: '#666',
  /** 取值文字色 */
  value: '#333',
  /** 必填星号 / 校验红框 */
  required: '#ff4d4f',
  /** 控件描边 */
  border: '#d9d9d9',
  /** 只读态底色 / 描边 / 文字 */
  readOnlyBg: '#f5f5f5',
  readOnlyBorder: '#e8e8e8',
  readOnlyText: '#999',
  /** 必填态浅红底 */
  requiredBg: '#fff1f0',
  /** 分区标题底色 / 分隔线 */
  sectionBg: '#fafafa',
  sectionBorder: '#e8e8e8',
  /** 卡片描边 */
  cardBorder: '#f0f0f0',
  /** 占位符 */
  placeholder: '#bfbfbf',
  /** 单元格默认网格线 */
  gridLine: '#e8e8e8',
} as const;

export interface FieldTokens {
  /** 透传给 antd 控件的 size */
  controlSize: 'small' | 'middle' | 'large';
  /** 控件最小高度（px）：保证触控目标足够大 */
  controlMinHeight: number;
  /** 控件取值字号（px）：mobile 取 16，规避 iOS 聚焦自动缩放 */
  controlFontSize: number;
  /** 标签字号（px） */
  labelFontSize: number;
  /** 标签列占比（仅手机端列表化布局使用） */
  labelFlex: string;
  /** 行内边距（px） */
  rowPadding: string;
  /** 单选组排列方向 */
  radioDirection: 'horizontal' | 'vertical';
}

/** 桌面端令牌：紧凑，适配 Excel 单元格（可能仅 120px 宽） */
export const DESKTOP_FIELD_TOKENS: FieldTokens = {
  controlSize: 'small',
  controlMinHeight: 24,
  controlFontSize: 13,
  labelFontSize: 13,
  labelFlex: '38%',
  rowPadding: '10px 12px',
  radioDirection: 'horizontal',
};

/**
 * 手机端令牌：触控优先
 * - 高度 40px（≈ 44px 推荐的最小触控目标，且与 antd middle 的 32px 相比更易点中）
 * - 字号 16px：低于 16px 时 iOS Safari 聚焦输入框会自动放大页面
 * - 单选改为纵向排列：横向排列在窄屏会被挤成多行错位
 */
export const MOBILE_FIELD_TOKENS: FieldTokens = {
  controlSize: 'middle',
  controlMinHeight: 40,
  controlFontSize: 16,
  labelFontSize: 14,
  labelFlex: '32%',
  rowPadding: '12px',
  radioDirection: 'vertical',
};

/** 按 variant 取令牌；'auto' 由调用方先解析为 desktop/mobile 再传入 */
export const getFieldTokens = (variant: Exclude<FieldVariant, 'auto'>): FieldTokens =>
  variant === 'mobile' ? MOBILE_FIELD_TOKENS : DESKTOP_FIELD_TOKENS;

/**
 * 视口是否为手机宽度（响应式单一来源）。
 *
 * <p>此前 ExcelPreview 用 `detectMobile()` 在挂载时算一次 `window.innerWidth <= 768`，
 * 旋转屏幕 / 拖动窗口不会重算；这里改为 matchMedia + useSyncExternalStore，
 * 视口跨断点时**自动重渲染**，从而满足「组件支持响应式、自适应不同屏幕尺寸」。</p>
 */
export function useIsMobileViewport(breakpoint: number = MOBILE_BREAKPOINT): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {};
      const mql = window.matchMedia(`(max-width: ${breakpoint}px)`);
      // 兼容 Safari 14 以下仅支持 addListener 的旧接口
      if (mql.addEventListener) {
        mql.addEventListener('change', onChange);
        return () => mql.removeEventListener('change', onChange);
      }
      mql.addListener(onChange);
      return () => mql.removeListener(onChange);
    },
    [breakpoint],
  );
  const getSnapshot = useCallback(
    () => (typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia(`(max-width: ${breakpoint}px)`).matches
      : false),
    [breakpoint],
  );
  // SSR / 测试环境无 matchMedia 时固定返回 false（= 桌面），保证服务端渲染稳定
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

/**
 * 把 variant 解析为具体外观。
 * 'auto' 交给调用方的 `isMobile`（由 useIsMobileViewport 或设备识别得出）。
 */
export const resolveVariant = (
  variant: FieldVariant | undefined,
  isMobile: boolean,
): 'desktop' | 'mobile' => {
  if (variant === 'mobile') return 'mobile';
  if (variant === 'desktop') return 'desktop';
  return isMobile ? 'mobile' : 'desktop';
};

/**
 * 字段控件的只读态底色（fieldAttr 语义，与设计器保持一致）：
 *   1=只读 → 灰底  2=可编辑 → 不传  3=必填 → 浅红底
 * 桌面端与手机端共用同一套语义色。
 */
export const attrBackground = (fieldAttr?: number): string | undefined => {
  if (fieldAttr === 1) return FIELD_COLOR.readOnlyBg;
  if (fieldAttr === 3) return FIELD_COLOR.requiredBg;
  return undefined;
};