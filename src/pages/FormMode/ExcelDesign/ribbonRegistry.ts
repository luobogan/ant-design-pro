/**
 * 把设计器操作挂载到 Univer 原生 Ribbon（紧跟原生「开始」之后）
 *
 * 图标说明：Univer 原生 ribbon 的菜单项 icon 必须是「注册在 ComponentManager 里的字符串 key」
 * （渲染层 componentManager.get(icon) 取组件，见 ui 包 f-menu-builder 附近 ToolbarButton 渲染）。
 * 故这里把 antd 图标统一注册进 window.__univerComponentManager，菜单项只引用字符串 key。
 *
 * 页签顺序：order 0=开始；我们取 0.1~0.5 紧排其后；原生 插入(1)/公式(2)/数据(3)/视图(4)/其他(5) 不变。
 */

import { CommandType } from '@univerjs/core';
import { MenuItemType, ComponentManager } from '@univerjs/ui';
import { BehaviorSubject } from 'rxjs';
import { map } from 'rxjs';

// 已插入主表的明细表序号（用于 ribbon「明细表」页签置灰）；由 ExcelDesign 同步。
// 用 BehaviorSubject 让菜单项的 disabled$ 在「插入/删除标记」时实时生效，无需重注册 ribbon。
const usedDetailIdx$ = new BehaviorSubject<Set<number>>(new Set());
export const setUsedDetailTables = (set: Set<number>) => {
  usedDetailIdx$.next(set && set.size ? new Set(set) : new Set());
};
import {
  SaveOutlined,
  EyeOutlined,
  UploadOutlined,
  DownloadOutlined,
  UndoOutlined,
  RedoOutlined,
  BoldOutlined,
  ItalicOutlined,
  UnderlineOutlined,
  AlignLeftOutlined,
  AlignCenterOutlined,
  AlignRightOutlined,
  FileTextOutlined,
  BgColorsOutlined,
  GroupOutlined,
  UngroupOutlined,
  CodeOutlined,
  PictureOutlined,
  FontSizeOutlined,
  LinkOutlined,
  TranslationOutlined,
  LayoutOutlined,
  CalculatorOutlined,
  ClearOutlined,
  TagsOutlined,
  InfoCircleOutlined,
  BarcodeOutlined,
  ApiOutlined,
  InsertRowBelowOutlined,
  ColumnWidthOutlined,
  DeleteRowOutlined,
  DeleteColumnOutlined,
  LockOutlined,
  EditOutlined,
  StarOutlined,
  TableOutlined,
} from '@ant-design/icons';

export type ElementType =
  | 'text'
  | 'image'
  | 'link'
  | 'code'
  | 'multilang'
  | 'iframe'
  | 'tab'
  | 'note'
  | 'barcode'
  | 'portal';

export interface RegisterRibbonOptions {
  onSave: () => void;
  onPreview: () => void;
  onImport: () => void;
  onExport: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onFieldAttr: (attr: 'readonly' | 'editable' | 'required') => void;
  /** 插入明细表（传明细表序号） */
  onInsertDetail: (idx: number) => void;
  /** 当前表单拥有的明细表序号 */
  detailOptions: { idx: number; count: number }[];
}

/**
 * 最近一次由 ExcelDesign 传入的处理器集合。
 * 原生 ribbon 的命令一经注册，回调就被固化在 Univer 的命令服务里；若直接闭包捕获注册那一刻的
 * handleSave，弹窗关闭重开（组件重挂载）后点的「保存」仍是上一个已卸载实例的处理器 ——
 * 它拿的是旧 ref/旧 unmount 状态，既不保存也不弹提示（表现为「点保存没反应」）。
 * 故所有回调统一走「点击时取最新处理器」。
 */
let latestOpts: RegisterRibbonOptions | null = null;
export const setDesignerRibbonOptions = (opts: RegisterRibbonOptions) => {
  latestOpts = opts;
};
/** 返回一个稳定的转发函数：点击时才从 latestOpts 取真实处理器 */
const callOpt =
  <K extends keyof RegisterRibbonOptions>(key: K) =>
  (...args: any[]) => {
    const fn: any = latestOpts && (latestOpts as any)[key];
    // 诊断：确认原生 ribbon 的点击确实转发到了当前实例的最新处理器
    console.log('[Ribbon] 触发动作:', key, typeof fn === 'function' ? '(已绑定)' : '(未绑定处理器!)');
    if (typeof fn !== 'function') return undefined;
    return fn(...args);
  };

// 图标组件 → 注册成字符串 key（供原生 ribbon 引用）
const DESIGNER_ICONS: Record<string, React.ComponentType> = {
  save: SaveOutlined,
  preview: EyeOutlined,
  import: UploadOutlined,
  export: DownloadOutlined,
  undo: UndoOutlined,
  redo: RedoOutlined,
  bold: BoldOutlined,
  italic: ItalicOutlined,
  underline: UnderlineOutlined,
  alignLeft: AlignLeftOutlined,
  alignCenter: AlignCenterOutlined,
  alignRight: AlignRightOutlined,
  wrap: FileTextOutlined,
  bg: BgColorsOutlined,
  merge: GroupOutlined,
  unmerge: UngroupOutlined,
  code: CodeOutlined,
  image: PictureOutlined,
  text: FontSizeOutlined,
  link: LinkOutlined,
  multilang: TranslationOutlined,
  iframe: LayoutOutlined,
  formula: CalculatorOutlined,
  clearBg: ClearOutlined,
  tab: TagsOutlined,
  note: InfoCircleOutlined,
  barcode: BarcodeOutlined,
  portal: ApiOutlined,
  insRow: InsertRowBelowOutlined,
  insCol: ColumnWidthOutlined,
  rmRow: DeleteRowOutlined,
  rmCol: DeleteColumnOutlined,
  readonly: LockOutlined,
  editable: EditOutlined,
  required: StarOutlined,
  detail: TableOutlined,
};

/**
 * 注册图标。
 * 注意：ComponentManager 的组件表是**实例级**的（new Univer() 会新建 injector → 新的空 ComponentManager）。
 * 组件卸载再进入时（UniverExcelGrid 卸载会 univer.dispose()，重挂载后重新 new Univer），
 * 若仍用「全局 key 集合」判重，新实例里的 designer.* 就永远注册不进去 → ribbon 只剩文字、没有图标。
 * 故这里改为按 ComponentManager 实例判重（WeakSet，不持有强引用）。
 */
const iconRegisteredOn = new WeakSet<object>();
const registerIcons = (cm: any) => {
  if (!cm || typeof cm.register !== 'function') {
    console.warn('[Ribbon] ComponentManager 不可用，原生 ribbon 将不显示图标');
    return;
  }
  if (iconRegisteredOn.has(cm)) return; // 该实例已注册过，避免重复 register 告警
  let ok = 0;
  Object.keys(DESIGNER_ICONS).forEach((key) => {
    const regKey = `designer.${key}`;
    try {
      cm.register(regKey, DESIGNER_ICONS[key]);
      ok += 1;
    } catch (e) {
      console.warn('[Ribbon] 图标注册失败:', regKey, e);
    }
  });
  iconRegisteredOn.add(cm);
  console.log(`[Ribbon] 图标已注册 ${ok}/${Object.keys(DESIGNER_ICONS).length}`);
};

// ── 自定义页签 key（独立 key，避免与原生 RibbonPosition 冲突）──
const TAB = {
  TEMPLATE: 'designerTemplate',
  FORMAT: 'designerFormat',
  INSERT: 'designerInsert',
  FIELD_ATTR: 'designerFieldAttr',
  DETAIL: 'designerDetail',
} as const;

const TAB_META: { key: string; title: string; order: number }[] = [
  { key: TAB.TEMPLATE, title: '模板', order: 0.1 },
  { key: TAB.FORMAT, title: '格式', order: 0.2 },
  { key: TAB.INSERT, title: '插入', order: 0.3 },
  { key: TAB.FIELD_ATTR, title: '字段属性', order: 0.4 },
  { key: TAB.DETAIL, title: '明细表', order: 0.5 },
];

// 调用网格 API（window.univerExcelGrid）
const grid = () => (window as any).univerExcelGrid;

const callGrid = (fn: string, ...args: any[]) => {
  const g = grid();
  if (!g || typeof g[fn] !== 'function') return;
  g[fn](...args);
};

// 上次成功注册所用的服务实例。Univer 实例重建（组件重挂载会 univer.dispose() 后重新 new）
// 后三者都是新对象，此时旧的「已注册」标记会让新实例既拿不到菜单也拿不到图标，必须强制重新注册。
let lastInstances: { mm: any; cmd: any; cm: any } | null = null;

/**
 * 注册设计器 ribbon。可重复调用（幂等：已注册过则跳过）。
 * @returns 是否注册成功（成功 → 隐藏 React 工具条，使用原生 ribbon）
 */
export const registerDesignerRibbon = (opts: RegisterRibbonOptions): boolean => {
  const mm: any = (window as any).__univerMenuManager;
  const cmd: any = (window as any).__univerCommandService;
  const cm: any = (window as any).__univerComponentManager;
  if (!mm || typeof mm.mergeMenu !== 'function' || !cmd || typeof cmd.registerCommand !== 'function') {
    console.warn('[Ribbon] 缺少 menuManager / commandService，回退 React 工具条');
    return false;
  }
  if (
    lastInstances &&
    (lastInstances.mm !== mm || lastInstances.cmd !== cmd || lastInstances.cm !== cm)
  ) {
    // Univer 实例已重建 → 清标记，重新合并菜单并重新注册图标
    (window as any).__designerRibbonRegistered = false;
  }
  lastInstances = { mm, cmd, cm };
  // 无论是否重新注册，都把最新处理器留在模块里：命令回调固定转发到它
  latestOpts = opts;
  if ((window as any).__designerRibbonRegistered) return true;

  // 注册图标（原生 ribbon 的 icon 引用字符串 key）
  registerIcons(cm);

  // 注册动作命令：commandId → handler，返回 commandId 供菜单项引用
  const regAction = (id: string, handler: () => void): string => {
    const commandId = `designer.cmd.${id}`;
    if (!cmd.hasCommand(commandId)) {
      cmd.registerCommand({ id: commandId, type: CommandType.COMMAND, handler });
    }
    return commandId;
  };

  // 打开插入元素参数弹窗（桥接 React ExcelRibbon 的 Modal）；不可用时直接落默认值
  const openInsert = (type: ElementType) => {
    const bridge = (window as any).__designerOpenInsertModal;
    if (typeof bridge === 'function') bridge(type);
    else callGrid('insertElement', type, {});
  };

  // 构建完整 ribbon 结构：{ [tabKey]: { order, title, [group]: { order, [itemId]: { order, menuItemFactory } } } }
  const schema: Record<string, any> = {};
  const ensureTab = (key: string) => {
    if (!schema[key]) {
      const meta = TAB_META.find((t) => t.key === key)!;
      schema[key] = { order: meta.order, title: meta.title };
    }
    return schema[key];
  };
  const ensureGroup = (tab: any, group: string) => {
    if (!tab[group]) tab[group] = { order: 0 };
    return tab[group];
  };
  const addItem = (tabKey: string, group: string, id: string, title: string, action: () => void, tooltip: string, order: number, iconKey?: string, disabled$?: any) => {
    const tab = ensureTab(tabKey);
    const g = ensureGroup(tab, group);
    const commandId = regAction(id, action);
    const item: any = {
      order,
      menuItemFactory: () => ({
        id: `designer.${id}`,
        type: MenuItemType.BUTTON,
        title,
        tooltip,
        commandId,
        // 自定义页签需要图标 + 文字（功能不直观）；原生「开始/公式/数据」页签省略此标记 → 只显示图标
        showTitle: true,
        ...(iconKey ? { icon: `designer.${iconKey}` } : {}),
        ...(disabled$ ? { disabled$: disabled$ } : {}),
      }),
    };
    g[`designer.${id}`] = item;
  };

  // ── 模板 ──（统一走 callOpt：点击时才取最新处理器，避免绑到已卸载的旧实例）
  // 注：「保存」不在原生 ribbon 里挂项——弹窗场景由底部「保存」按钮承担，页签里不再重复放（避免点了没反应）。
  addItem(TAB.TEMPLATE, 'ops', 'tpl.preview', '预览', callOpt('onPreview'), '预览表单', 1, 'preview');
  addItem(TAB.TEMPLATE, 'ops', 'tpl.import', '导入', callOpt('onImport'), '导入布局', 2, 'import');
  addItem(TAB.TEMPLATE, 'ops', 'tpl.export', '导出', callOpt('onExport'), '导出布局', 3, 'export');

  // ── 格式 ──
  addItem(TAB.FORMAT, 'fmt', 'fmt.undo', '撤销', callOpt('onUndo'), '撤销', 0, 'undo');
  addItem(TAB.FORMAT, 'fmt', 'fmt.redo', '重做', callOpt('onRedo'), '重做', 1, 'redo');
  addItem(TAB.FORMAT, 'fmt', 'fmt.bold', '加粗', () => callGrid('applyRangeFormat', 'bold', true), '加粗', 2, 'bold');
  addItem(TAB.FORMAT, 'fmt', 'fmt.italic', '斜体', () => callGrid('applyRangeFormat', 'italic', true), '斜体', 3, 'italic');
  addItem(TAB.FORMAT, 'fmt', 'fmt.underline', '下划线', () => callGrid('applyRangeFormat', 'underline', true), '下划线', 4, 'underline');
  addItem(TAB.FORMAT, 'fmt', 'fmt.alignLeft', '左对齐', () => callGrid('applyRangeFormat', 'align', 'left'), '左对齐', 5, 'alignLeft');
  addItem(TAB.FORMAT, 'fmt', 'fmt.alignCenter', '居中', () => callGrid('applyRangeFormat', 'align', 'center'), '居中', 6, 'alignCenter');
  addItem(TAB.FORMAT, 'fmt', 'fmt.alignRight', '右对齐', () => callGrid('applyRangeFormat', 'align', 'right'), '右对齐', 7, 'alignRight');
  addItem(TAB.FORMAT, 'fmt', 'fmt.wrap', '自动换行', () => callGrid('applyRangeFormat', 'wrap', true), '自动换行', 8, 'wrap');
  addItem(TAB.FORMAT, 'fmt', 'fmt.bgWhite', '清除背景', () => callGrid('applyRangeFormat', 'bg', '#ffffff'), '清除背景', 9, 'bg');
  addItem(TAB.FORMAT, 'fmt', 'fmt.merge', '合并', () => callGrid('mergeSelection'), '合并单元格', 10, 'merge');
  addItem(TAB.FORMAT, 'fmt', 'fmt.unmerge', '取消合并', () => callGrid('unmergeSelection'), '取消合并', 11, 'unmerge');

  // ── 插入 ──（对齐 ecology「扩展控件 ecs[cellid] = {etype, jsonparam}」模型：元素格落位）
  const insertEl = (type: ElementType, label: string, order: number, iconKey: string) =>
    addItem(TAB.INSERT, 'ins', `insert.${type}`, label, () => openInsert(type), `插入${label}`, order, iconKey);
  insertEl('code', '代码块', 0, 'code');
  insertEl('image', '图片', 1, 'image');
  insertEl('text', '文本', 2, 'text');
  insertEl('link', '链接', 3, 'link');
  insertEl('multilang', '多语言标签', 4, 'multilang');
  insertEl('iframe', 'Iframe区域', 5, 'iframe');
  addItem(TAB.INSERT, 'ins', 'insert.formula', '公式', () => callGrid('insertFormula'), '插入公式', 6, 'formula');
  addItem(TAB.INSERT, 'ins', 'insert.clearBg', '清除背景', () => callGrid('applyRangeFormat', 'bg', '#ffffff'), '清除单元格背景', 7, 'clearBg');
  insertEl('tab', '标签页', 8, 'tab');
  insertEl('note', '说明', 9, 'note');
  insertEl('barcode', '二维/条形码', 10, 'barcode');
  insertEl('portal', '门户元素', 11, 'portal');
  addItem(TAB.INSERT, 'ins', 'insert.row', '插入行', () => callGrid('rowColOp', 'insertRow'), '插入行', 12, 'insRow');
  addItem(TAB.INSERT, 'ins', 'insert.col', '插入列', () => callGrid('rowColOp', 'insertCol'), '插入列', 13, 'insCol');
  addItem(TAB.INSERT, 'ins', 'insert.removeRow', '删除行', () => callGrid('rowColOp', 'removeRow'), '删除行', 14, 'rmRow');
  addItem(TAB.INSERT, 'ins', 'insert.removeCol', '删除列', () => callGrid('rowColOp', 'removeCol'), '删除列', 15, 'rmCol');

  // ── 字段属性 ──
  addItem(TAB.FIELD_ATTR, 'attr', 'attr.readonly', '只读', () => callOpt('onFieldAttr')('readonly'), '设置字段为只读', 0, 'readonly');
  addItem(TAB.FIELD_ATTR, 'attr', 'attr.editable', '编辑', () => callOpt('onFieldAttr')('editable'), '设置字段为可编辑', 1, 'editable');
  addItem(TAB.FIELD_ATTR, 'attr', 'attr.required', '必填', () => callOpt('onFieldAttr')('required'), '设置字段为必填', 2, 'required');

  // ── 明细表 ──（已在主表插入的明细表：页签项置灰，避免重复插入）
  if (opts.detailOptions && opts.detailOptions.length > 0) {
    opts.detailOptions.forEach((o, i) => {
      addItem(
        TAB.DETAIL,
        'detail',
        `detail.${o.idx}`,
        `明细表${o.idx}（${o.count} 字段）`,
        () => callOpt('onInsertDetail')(o.idx),
        `插入明细表${o.idx}`,
        i,
        'detail',
        usedDetailIdx$.pipe(map((used) => used.has(o.idx))),
      );
    });
  } else {
    addItem(TAB.DETAIL, 'detail', 'detail.none', '插入明细表', () => undefined, '该表单未定义明细表字段', 0, 'detail');
  }

  mm.mergeMenu({ ribbon: schema });

  // 默认激活「格式」页签（designerFormat），而非原生「开始」
  const ribbonService: any = (window as any).__univerRibbonService;
  if (ribbonService && typeof ribbonService.setActivatedTab === 'function') {
    ribbonService.setActivatedTab(TAB.FORMAT);
  }

  (window as any).__designerRibbonRegistered = true;
  return true;
};

/** 取消注册标记（表单切换 / 重新初始化时调用，便于下次重新注册） */
export const resetDesignerRibbon = () => {
  (window as any).__designerRibbonRegistered = false;
};
