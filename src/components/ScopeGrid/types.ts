import type { ProColumns, ProTableProps } from '@ant-design/pro-components';
import type { Key, ReactNode } from 'react';
import type { FieldPerm } from '@/services/formmode/fieldPermApi';

/**
 * 按钮元数据（与 /menu/buttons 下发结构、BusinessComponents/ToolBar.tsx 的
 * ButtonConfig 对齐）。getPageButtons(pageCode) 返回的就是这个形状。
 */
export interface ScopeGridButton {
  /** 权限码 */
  code: string;
  /** 显示名 */
  name?: string;
  /** 别名，决定默认行为（add / edit / delete / view ...） */
  alias?: string;
  /** 1=工具栏 2=行内 3=两者 */
  action?: number;
  path?: string;
  source?: string;
  [key: string]: any;
}

export interface ScopeGridActionPayload<T> {
  btn: ScopeGridButton;
  keys: Key[];
  rows: T[];
  refresh: () => void;
}

/** isEditable=1 的单元格保存回调载荷 */
export interface ScopeGridCellSavePayload<T> {
  row: T;
  fieldName: string;
  value: string;
  refresh: () => void;
  /**
   * 静默模式：行编辑「保存」批量提交时为 true —— 不弹成功提示、不触发刷新
   * （由行保存统一提示与刷新，避免一改多格就刷 N 次表）。
   */
  silent?: boolean;
}

/** 个人列偏好（localStorage，按 menuId + pageCode 隔离） */
export interface ScopeGridColumnPreference {
  /** 被个人隐藏的列 key */
  hidden?: string[];
  /** 个人列顺序 */
  order?: string[];
}

export interface ScopeGridProps<T extends Record<string, any>> {
  /** 列配置主键（blade_scope_field.menu_id），雪花 ID 请用字符串 */
  menuId?: string | number;
  /** 精确到某条数据权限规则；0 = 菜单级默认 */
  scopeId?: string | number;
  resourceCode?: string;
  /** 按钮权限取数 key（菜单 code），不传则按路由末段推断 */
  pageCode?: string;
  /** 传了才叠加「按当前用户」的字段级权限 */
  formId?: string | number;

  rowKey?: string;
  request?: ProTableProps<T, any>['request'];
  dataSource?: T[];
  /** 无列配置/加载失败时的回退列（fail-open） */
  fallbackColumns?: ProColumns<T>[];
  /** 追加在动态列之后的固定列（如自定义操作列） */
  extraColumns?: ProColumns<T>[];

  renderSearchForm?: (onReset: () => void) => ReactNode;
  renderLeftButton?: () => ReactNode;
  renderRightButton?: () => ReactNode;
  onButtonClick?: (payload: ScopeGridActionPayload<T>) => void;
  /** `blade_scope_field.is_editable=1` 的单元格保存回调；不传则这些列只读 */
  onCellSave?: (payload: ScopeGridCellSavePayload<T>) => void | Promise<void>;
  /**
   * 默认编辑态：打开列表即可编辑单元格常驻输入控件（失焦保存），无需点击。
   * 对应参考实现 EditableProTable 里把 editableKeys 初始化为所有行 id。
   */
  defaultEditable?: boolean;
  /**
   * 编辑形态：
   *
   * <p>- `cell`（默认）：单元格级。`defaultEditable=true` 时可编辑列**常驻**输入控件，失焦即存；
   * 否则点击单元格进入编辑。</p>
   *
   * <p>- `row`：行级。操作列出现「编辑」，点该行进入编辑态（该行可编辑列变输入框），
   * 行尾出现「保存 / 取消」。保存时**只提交该行实际改动的格子**（逐格走单元格级接口），
   * 未改动的字段绝不会被覆盖 —— 业务数据表列多于渲染列时，整行提交会清空未渲染字段，故不可用。</p>
   */
  editMode?: 'cell' | 'row';
  /**
   * 行编辑模式下，行内「编辑 / 保存 / 取消」按钮（默认 true）。
   */
  rowEditButtons?: boolean;
  /**
   * 新增行：回调返回新行数据，组件把它插到列表顶部（仅 request 模式有效）。
   * 返回的行若已落库，需带主键字段（rowKey）。
   */
  onRowAdd?: () =>
    | Promise<Record<string, any> | undefined>
    | Record<string, any>
    | undefined;
  /**
   * 删除行：由页面决定如何删除（组件不直接写库）。
   */
  onRowDelete?: (row: T) => void | Promise<void>;
  /**
   * 自定义行操作，与按钮权限自动生成的行内按钮合并到同一个「操作」列。
   * 即使该 pageCode 在 /menu/buttons 里没有任何按钮，只要传了它就会渲染操作列。
   */
  rowActions?: (record: T, refresh: () => void) => ReactNode[];
  onSelectRow?: (keys: Key[], rows: T[]) => void;
  /** 列配置变化时回调，便于页面做数据补全 / 展示配置摘要 */
  onConfigsChange?: (configs: any[]) => void;
  /** 管理员「保存为默认列」回调，由页面决定如何写库（组件不直接写库） */
  onSaveColumns?: (configs: any[]) => void;

  actionColumnTitle?: string;
  actionColumnWidth?: number;
  /** 是否开启列设置（显隐/排序/恢复默认），默认 true */
  enableColumnSetting?: boolean;
  /**
   * 是否在列头显示「组件字段类型」标签（单行文本 / 人力资源 / 下拉框 / 日期 等，
   * 由 fieldHtmlType + fieldType 经 getFieldTypeLabel 得出，与 formmode/tabledesign 同源）。
   * 默认 false（业务列表保持纯净）；预览页可开启以对照字段类型设计。
   */
  showFieldType?: boolean;
  /**
   * 是否按「组件字段类型」渲染单元格（fieldHtmlType + fieldType，与 formmode/tabledesign 同源）：
   * 人力资源/部门等浏览按钮列按人员/部门组件展示，日期列用日期控件，选择框列不再退化成空 Select。
   *
   * 默认 false：业务列表沿用「按 fieldDbType 推断」的既有行为，不受影响；
   * 列表预览页可开启以对照组件类型设计。
   */
  componentControl?: boolean;
  /**
   * 浏览按钮类字段（人力资源/部门等）是否允许行内编辑。
   *
   * <p>默认 false：浏览按钮类字段在通用列表里没有可用的行内控件（Phase Q 起一律只读展示，
   * 强行渲染会退化成「空 Select」）。开启后点击单元格会弹出人员/部门选择器
   * （`PersonOrgPicker`，与表单预览同一套），选中后回写该格。</p>
   *
   * <p>依赖：需同时提供 {@link ScopeGridProps.onCellSave}，否则仍然只读。</p>
   */
  browserEditable?: boolean;
  /** 外部数据变更后改变此值即可重新拉取列配置 */
  refreshToken?: string | number;
  tableProps?: Partial<ProTableProps<T, any>>;
}

/** 内部解析后的列模型 */
export interface ResolvedColumn<T> extends ProColumns<T> {
  fieldName?: string;
  origin?: 'scope' | 'fallback' | 'extra' | 'action';
  fieldPerm?: FieldPerm;
}
