import type { ElementType, PortalElement, PortalElementSaveData } from '@/services/portal';

/** 设计器内元素状态：临时 id + 后端字段 + 布局信息 */
export interface DesignerElement extends PortalElement {
  /** 前端临时唯一 key（后端 id 为空时用它做 React key / dnd id） */
  uid: string;
  elementType: ElementType;
  elementName?: string;
  showTitle?: number;
  rowNo: number;
  colSpan: number;
  sortOrder: number;
  config?: Record<string, any>;
}

/** 栅格宽度候选项（antd 24 栅格） */
export const COL_SPAN_OPTIONS = [
  { label: '1/4 宽（6）', value: 6 },
  { label: '1/3 宽（8）', value: 8 },
  { label: '1/2 宽（12）', value: 12 },
  { label: '2/3 宽（16）', value: 16 },
  { label: '整行（24）', value: 24 },
];

/** 新建元素时的默认配置（不同类型的默认私有配置） */
export function buildDefaultConfig(type: ElementType): Record<string, any> {
  switch (type) {
    case 'todo':
      return { perPage: 5 };
    case 'notice':
      return { perPage: 5, showContent: false };
    case 'message':
      return { perPage: 8 };
    case 'links':
      return {
        links: [
          { name: '新建流程', icon: '📄', url: '/workflow/create' },
          { name: '消息中心', icon: '💬', url: '/message' },
        ],
      };
    case 'chart':
      return {
        chartType: 'column',
        xField: 'x',
        yField: 'y',
        data: [
          { x: '一月', y: 12 },
          { x: '二月', y: 18 },
          { x: '三月', y: 9 },
        ],
      };
    case 'rich':
      return { html: '<p>请在右侧属性面板配置富文本内容。</p>' };
    default:
      return {};
  }
}

/** 元素默认标题 */
export function defaultElementName(type: ElementType): string {
  const map: Record<ElementType, string> = {
    todo: '我的待办',
    notice: '通知公告',
    message: '消息提醒',
    chart: '统计图表',
    links: '快捷入口',
    rich: '富文本公告',
  };
  return map[type] || '未命名元素';
}

/** 设计器元素 → 后端保存入参 */
export function toSaveData(el: DesignerElement): PortalElementSaveData {
  return {
    elementId: el.id,
    pageId: el.pageId,
    elementType: el.elementType,
    elementName: el.elementName,
    showTitle: el.showTitle,
    rowNo: el.rowNo,
    colSpan: el.colSpan,
    sortOrder: el.sortOrder,
    configJson: el.config ? JSON.stringify(el.config) : undefined,
  };
} 
