/** Univer 布局类型常量：编码与运行期映射保持一致 */
export const LAYOUT_TYPES = [
  { value: 0, label: '编辑（含新建）' },
  { value: 1, label: '显示' },
  { value: 3, label: '监控' },
  { value: 4, label: '打印' },
] as const;

export type LayoutType = 0 | 1 | 3 | 4;

export const DEFAULT_LAYOUT_TYPE_NAMES: Record<number, string> = {
  0: '编辑（含新建）',
  1: '显示',
  3: '监控',
  4: '打印',
};

export const layoutTypeName = (type?: number, overrides?: Record<number, string>): string =>
  (type != null && overrides?.[type]) || DEFAULT_LAYOUT_TYPE_NAMES[Number(type)] || '未知道具布局';
