/**
 * Excel 设计器「插入元素」单一来源。
 *
 * 对齐泛微 E9 `workflow/exceldesign/js/designOperate_wev8.js:3042-3067`（celltype 常量表）
 * 与 `:3070-3119`（保存时 celltype → etype 数字编码）：E9 把扩展控件存为
 * `dataobj.ecs[cellid] = { etype, jsonparam }`；本项目等价为
 * `cellData[r][c].fieldMeta = { cellType:'element', elementType, elementConfig }`。
 *
 * 本文件统一定义：类型清单 / E9 编码 / 设计器图标 / 属性配置项 / 默认值 / 设计态显示值，
 * 供 ExcelRibbon（插入弹窗）、PropertyPanel（选中后编辑）、UniverExcelGrid（落位）、
 * ExcelPreview（运行期渲染）共用，避免四处各写一份导致「插入时能配、选中后不能改」。
 */
import type { CSSProperties } from 'react';
import { REGISTERED_ELEMENT_TYPES } from '@/pages/Portal/components/ElementRegistry';

/** 元素类型：9 类主元素 + 对齐 E9 etype 的 8 类明细周边元素 */
export type ExcelElementType =
  | 'image'
  | 'text'
  | 'link'
  | 'multilang'
  | 'iframe'
  | 'tab'
  | 'note'
  | 'barcode'
  | 'portal'
  | 'detailTitle'
  | 'detailTail'
  | 'detailButtons'
  | 'sumName'
  | 'sumValue'
  | 'checkAll'
  | 'checkSingle'
  | 'serialNum';

export type ElementFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'select'
  | 'upload'
  | 'multiselect'
  | 'switch'
  /** 从「表单字段」中选择（选项由宿主的 fieldOptions 注入；如公式的目标字段 destField） */
  | 'fieldSelect';

export interface ElementFieldDef {
  name: string;
  label: string;
  type: ElementFieldType;
  options?: { label: string; value: any }[];
  placeholder?: string;
  initial?: any;
  rows?: number;
  /** 条件显隐：返回 false 时不渲染该字段（如 iframe 自适应高度时隐藏固定高度输入） */
  showIf?: (vals: Record<string, any>) => boolean;
}

/** E9 etype 数字编码（designOperate_wev8.js:3070-3119），仅用于导入导出兼容与排查 */
export const E9_ETYPE: Record<string, number> = {
  image: 6,
  link: 11,
  tab: 12,
  portal: 15,
  iframe: 16,
  barcode: 17,
  detailTitle: 8,
  detailTail: 9,
  detailButtons: 10,
  sumName: 18,
  sumValue: 19,
  checkAll: 20,
  checkSingle: 21,
  serialNum: 22,
  note: 25,
  multilang: 26,
  text: 1,
};

/** 设计器画布可视化：图标 + 名称（原 ELEMENT_META 从此处取） */
export const ELEMENT_META: Record<string, { icon: string; label: string }> = {
  image: { icon: '🖼️', label: '图片' },
  text: { icon: '📝', label: '文本' },
  link: { icon: '🔗', label: '链接' },
  multilang: { icon: '🌐', label: '多语言标签' },
  iframe: { icon: '🧩', label: 'Iframe区域' },
  tab: { icon: '🗂️', label: '标签页' },
  note: { icon: '📌', label: '说明' },
  barcode: { icon: '📊', label: '二维/条形码' },
  portal: { icon: '🏛️', label: '门户元素' },
  detailTitle: { icon: '▤', label: '明细标题' },
  detailTail: { icon: '▥', label: '明细尾' },
  detailButtons: { icon: '⊞', label: '明细按钮' },
  sumName: { icon: 'Σ', label: '合计标签' },
  sumValue: { icon: 'Σ', label: '合计字段' },
  checkAll: { icon: '☑', label: '明细全选' },
  checkSingle: { icon: '☐', label: '明细单选' },
  serialNum: { icon: '#', label: '明细序号' },
};

const PROTOCOL_OPTIONS = [
  { label: 'http://', value: 'http://' },
  { label: 'https://', value: 'https://' },
  { label: 'ftp://', value: 'ftp://' },
  { label: 'news://', value: 'news://' },
];

/** 门户元素类型下拉：直接复用门户注册表，避免设计器与运行期支持的类型漂移 */
const PORTAL_TYPE_OPTIONS = REGISTERED_ELEMENT_TYPES.map((t) => ({ label: t, value: t }));

/**
 * 标签页样式规格（对齐 E9 `tabpage_wev8.js` 的 `sysDefault` / `sysStyle` style-1~style-6）。
 *
 * <p>E9 的内置样式是「PNG 贴图拼标签头」：`image_bg`（整块底图）、`image_sep`（分隔线）、
 * `sel_bgleft|sel_bgmiddle|sel_bgright`（选中态三段图）、`unsel_bg*`（未选中态三段图），
 * 再由 `getDivStyle_ByStyle`（L89-152）编译成 CSS：文字侧只暴露
 * `sel_color / sel_fontsize / sel_family / sel_bold / sel_italic`（未选中态同理）。</p>
 *
 * <p>本项目不引入 E9 的图片资源，改用**等价的纯 CSS 渐变**近似同一视觉族，
 * 但完整保留真正影响可读性的属性（文字色 / 字号 / 字体 / 粗斜体 / 分隔线 / 圆角），
 * 并额外支持「自定义样式」（对应 E9 `workflow_tabstyle` 自定义样式表）。</p>
 */
export interface TabStyleSpec {
  /** 选中态背景（可写渐变） */
  selBg: string;
  selColor: string;
  selBold: boolean;
  selItalic: boolean;
  selFontSize: number;
  selFamily: string;
  /** 未选中态背景 */
  unselBg: string;
  unselColor: string;
  unselBold: boolean;
  unselItalic: boolean;
  unselFontSize: number;
  unselFamily: string;
  /** 标签圆角 */
  radius: string;
  /** 分隔线（对应 E9 image_sep / image_sepwidth） */
  sepColor: string;
  sepWidth: number;
}

/** 6 套内置样式：id 与 E9 styleid 一一对应（-1 ~ -6） */
export const TAB_STYLE_PRESETS: (TabStyleSpec & { id: number; name: string })[] = [
  {
    id: -1, name: '内置样式 1（经典蓝）',
    selBg: 'linear-gradient(180deg,#4a90e2 0%,#1677ff 100%)', selColor: '#fff', selBold: true, selItalic: false, selFontSize: 13, selFamily: '',
    unselBg: 'linear-gradient(180deg,#ffffff 0%,#f0f0f0 100%)', unselColor: '#555', unselBold: false, unselItalic: false, unselFontSize: 13, unselFamily: '',
    radius: '4px 4px 0 0', sepColor: '#d9d9d9', sepWidth: 1,
  },
  {
    id: -2, name: '内置样式 2（商务深蓝）',
    selBg: 'linear-gradient(180deg,#0a3d91 0%,#002a80 100%)', selColor: '#fff', selBold: true, selItalic: false, selFontSize: 13, selFamily: '',
    unselBg: 'linear-gradient(180deg,#eef2f8 0%,#dde5f1 100%)', unselColor: '#2c3e50', unselBold: false, unselItalic: false, unselFontSize: 13, unselFamily: '',
    radius: '4px 4px 0 0', sepColor: '#b9c6da', sepWidth: 1,
  },
  {
    id: -3, name: '内置样式 3（清新绿）',
    selBg: 'linear-gradient(180deg,#52c41a 0%,#389e0d 100%)', selColor: '#fff', selBold: true, selItalic: false, selFontSize: 13, selFamily: '',
    unselBg: 'linear-gradient(180deg,#f6ffed 0%,#e8f5e0 100%)', unselColor: '#4a7a2a', unselBold: false, unselItalic: false, unselFontSize: 13, unselFamily: '',
    radius: '4px 4px 0 0', sepColor: '#c7e7bd', sepWidth: 1,
  },
  {
    id: -4, name: '内置样式 4（活力橙）',
    selBg: 'linear-gradient(180deg,#ffa940 0%,#fa8c16 100%)', selColor: '#fff', selBold: true, selItalic: false, selFontSize: 13, selFamily: '',
    unselBg: 'linear-gradient(180deg,#fff7e6 0%,#ffe7ba 100%)', unselColor: '#a35b12', unselBold: false, unselItalic: false, unselFontSize: 13, unselFamily: '',
    radius: '4px 4px 0 0', sepColor: '#ffd591', sepWidth: 1,
  },
  {
    id: -5, name: '内置样式 5（雅紫）',
    selBg: 'linear-gradient(180deg,#9254de 0%,#722ed1 100%)', selColor: '#fff', selBold: true, selItalic: false, selFontSize: 13, selFamily: '',
    unselBg: 'linear-gradient(180deg,#f9f0ff 0%,#efdbff 100%)', unselColor: '#5b2a91', unselBold: false, unselItalic: false, unselFontSize: 13, unselFamily: '',
    radius: '4px 4px 0 0', sepColor: '#d3adf7', sepWidth: 1,
  },
  {
    id: -6, name: '内置样式 6（高级灰）',
    selBg: 'linear-gradient(180deg,#5c6b82 0%,#3d4a5c 100%)', selColor: '#fff', selBold: true, selItalic: false, selFontSize: 13, selFamily: '',
    unselBg: 'linear-gradient(180deg,#f5f5f5 0%,#ebebeb 100%)', unselColor: '#555', unselBold: false, unselItalic: false, unselFontSize: 13, unselFamily: '',
    radius: '4px 4px 0 0', sepColor: '#d9d9d9', sepWidth: 1,
  },
];

/** 默认样式（无配置时）：等价 E9 sysDefault 的文字侧默认值 */
export const TAB_DEFAULT_STYLE: TabStyleSpec = {
  selBg: 'linear-gradient(180deg,#4a90e2 0%,#1677ff 100%)', selColor: '#fff', selBold: true, selItalic: false, selFontSize: 13, selFamily: '',
  unselBg: 'linear-gradient(180deg,#ffffff 0%,#f0f0f0 100%)', unselColor: '#555', unselBold: false, unselItalic: false, unselFontSize: 13, unselFamily: '',
  radius: '4px 4px 0 0', sepColor: '#d9d9d9', sepWidth: 1,
};

/** 自定义样式（对齐 E9 workflow_tabstyle 的 styleStr JSON） */
export interface TabCustomStyle {
  selBg?: string;
  selColor?: string;
  selBold?: boolean;
  selItalic?: boolean;
  selFontSize?: number;
  selFamily?: string;
  unselBg?: string;
  unselColor?: string;
  unselBold?: boolean;
  unselItalic?: boolean;
  unselFontSize?: number;
  unselFamily?: string;
  radius?: string;
  sepColor?: string;
  sepWidth?: number;
}

/**
 * 各元素属性项（对齐 E9 各属性面板 JSP）：
 *  图片 excelUploadImg.jsp:180-200 / 链接 excelUploadLink.jsp:36-43
 *  Iframe setIframe.jsp:59-96 / 扫码 setScanCode.jsp:10-12,70-102
 *  标签页 tabStyleDesign.jsp:9-60 / 文本 setCustomAttr.jsp:76-86
 */
export const ELEMENT_FIELDS: Record<string, ElementFieldDef[]> = {
  image: [
    { name: 'src', label: '图片地址', type: 'upload', placeholder: '上传图片或填写 https://... / 相对路径' },
    {
      name: 'srcdtype',
      label: '图片用途',
      type: 'select',
      initial: 1,
      options: [
        { label: '单元格背景图（E9 srcdtype=1）', value: 1 },
        { label: '整表背景图（写入 layoutJson.backgroundImage）', value: 2 },
        { label: '浮动图片（E9 srcdtype=3）', value: 3 },
      ],
    },
    { name: 'width', label: '宽度(px)', type: 'number', initial: 120 },
    { name: 'height', label: '高度(px)', type: 'number', initial: 80 },
    { name: 'alt', label: '替代文字', type: 'text' },
  ],
  text: [
    { name: 'content', label: '文本内容', type: 'textarea', rows: 4, placeholder: '输入文本内容' },
    { name: 'cssClass', label: '自定义 class', type: 'text', placeholder: '对齐 E9 setCustomAttr.jsp' },
    { name: 'style', label: '自定义 style', type: 'text', placeholder: '如 color:#333;text-align:center' },
    { name: 'hide', label: '运行期隐藏', type: 'switch', initial: false },
  ],
  link: [
    { name: 'protocol', label: '协议', type: 'select', initial: 'https://', options: PROTOCOL_OPTIONS },
    { name: 'href', label: '链接地址', type: 'text', placeholder: 'www.example.com 或完整 URL' },
    { name: 'text', label: '显示文字', type: 'text' },
    {
      name: 'target',
      label: '打开方式',
      type: 'select',
      initial: '_blank',
      options: [
        { label: '新窗口', value: '_blank' },
        { label: '当前窗口', value: '_self' },
      ],
    },
  ],
  multilang: [
    { name: 'zh', label: '简体中文 (zh-CN)', type: 'text' },
    { name: 'en', label: 'English (en-US)', type: 'text' },
    { name: 'tw', label: '繁體中文 (zh-TW)', type: 'text' },
  ],
  iframe: [
    { name: 'setId', label: '元素 ID', type: 'text', placeholder: '对齐 E9 set_id' },
    { name: 'setName', label: '元素名称', type: 'text', placeholder: '对齐 E9 set_name' },
    {
      name: 'src',
      label: 'Iframe 地址',
      type: 'text',
      placeholder: '支持 $requestId$ / $workflowid$ / $nodeId$ / $formId$ / $taskId$ 变量（兼容 E9 $requestid$ 等）',
    },
    {
      name: 'heightMode',
      label: '高度模式',
      type: 'select',
      initial: 'fixed',
      options: [
        { label: '固定像素', value: 'fixed' },
        { label: '自适应内容 (auto)', value: 'auto' },
      ],
    },
    { name: 'height', label: '高度(px)', type: 'number', initial: 240, showIf: (v) => v.heightMode !== 'auto' },
    { name: 'style', label: '自定义 style', type: 'text' },
  ],
  tab: [
    // ── E9 口径：标签页容器（tab 对象）+ 每页一张独立 Excel（etables.tab_N）──
    // 页签的增删/排序/设默认在设计器里「双击标签页单元格」后的页签编辑面板完成。
    { name: 'name', label: '容器名称', type: 'text', initial: '标签页' },
    {
      name: 'style',
      label: '标签样式',
      type: 'select',
      initial: -1,
      // 0 = 自定义样式（对齐 E9 workflow_tabstyle：前端存样式 JSON，运行期编译成 CSS）
      options: [
        ...TAB_STYLE_PRESETS.map((p) => ({ label: p.name, value: p.id })),
        { label: '自定义样式', value: 0 },
      ],
    },
    { name: 'defshow', label: '默认选中页(序号，从0开始)', type: 'number', initial: 0 },
    {
      name: 'areaheight',
      label: '内容区高度',
      type: 'text',
      initial: '1',
      placeholder: '1=自适应；2,300=固定 300px 并滚动',
    },
    { name: 'selBg', label: '自定义-选中背景', type: 'text', placeholder: '如 #1677ff 或 linear-gradient(180deg,#4a90e2,#1677ff)' },
    { name: 'selColor', label: '自定义-选中文字色', type: 'text', placeholder: '如 #fff' },
    { name: 'unselBg', label: '自定义-未选中背景', type: 'text', placeholder: '如 #fafafa' },
    { name: 'unselColor', label: '自定义-未选中文字色', type: 'text', placeholder: '如 #666' },
    { name: 'tabFontSize', label: '自定义-标签字号(px)', type: 'number', initial: 13 },
  ],
  note: [
    { name: 'content', label: '说明内容', type: 'textarea', rows: 4, placeholder: '问号提示，支持换行' },
    {
      name: 'placement',
      label: '提示位置',
      type: 'select',
      initial: 'top',
      options: ['top', 'topLeft', 'topRight', 'right', 'bottom', 'left'].map((v) => ({ label: v, value: v })),
    },
  ],
  barcode: [
    {
      name: 'type',
      label: '类型',
      type: 'select',
      initial: 'qrcode',
      options: [
        { label: '二维码 (QR)', value: 'qrcode' },
        { label: '条形码 (Code128)', value: 'barcode' },
      ],
    },
    { name: 'content', label: '编码内容', type: 'text', placeholder: '静态文本或 $字段名$ 变量' },
    { name: 'relatefield', label: '关联文本字段', type: 'multiselect', placeholder: '可多选，对齐 E9 relatefield' },
    { name: 'hidetext', label: '隐藏编码文本', type: 'switch', initial: false },
    { name: 'width', label: '宽度(px)', type: 'number', initial: 100 },
    { name: 'height', label: '高度(px)', type: 'number', initial: 100 },
  ],
  portal: [
    {
      name: 'elementType',
      label: '门户元素类型',
      type: 'select',
      initial: REGISTERED_ELEMENT_TYPES[0] || 'todo',
      options: PORTAL_TYPE_OPTIONS,
    },
    { name: 'hpid', label: '门户ID（兼容旧配置）', type: 'text', placeholder: 'E9 hpid，可选' },
    { name: 'elementId', label: '元素ID', type: 'text', placeholder: 'blade_portal_element.id，可选' },
    { name: 'perPage', label: '每页条数', type: 'number', initial: 5 },
    { name: 'height', label: '高度(px)', type: 'number', initial: 300 },
  ],
  // ↓ E9 明细周边元素：此前只在原生 ribbon 注册、点击无反应，这里补齐最小配置使其可落位
  detailTitle: [{ name: 'content', label: '标题文字', type: 'text', initial: '明细表' }],
  detailTail: [{ name: 'content', label: '尾部文字', type: 'text' }],
  detailButtons: [
    { name: 'buttons', label: '按钮集', type: 'multiselect', placeholder: 'add / copy / delete' },
  ],
  sumName: [{ name: 'content', label: '合计标签', type: 'text', initial: '合计' }],
  sumValue: [{ name: 'field', label: '求和字段', type: 'text' }],
  checkAll: [],
  checkSingle: [],
  serialNum: [{ name: 'content', label: '序号标题', type: 'text', initial: '序号' }],
};

/** 取某类型的属性项；未知类型回落为空（不弹窗，直接插入） */
export const getElementFields = (type: string): ElementFieldDef[] => ELEMENT_FIELDS[type] || [];

/** 按 schema 的 initial 补默认值，保证 elementConfig 结构稳定 */
export const normalizeElementConfig = (
  type: string,
  cfg?: Record<string, any>,
): Record<string, any> => {
  const next: Record<string, any> = { ...(cfg || {}) };
  getElementFields(type).forEach((f) => {
    if (next[f.name] === undefined && f.initial !== undefined) next[f.name] = f.initial;
  });
  return next;
};

/** 设计态单元格显示值：图标 + 名称；部分元素附简短内容便于识别 */
export const elementDisplayValue = (type: string, cfg: Record<string, any> = {}): string => {
  const def = ELEMENT_META[type] || { icon: '📦', label: type };
  // 整表背景图不占单元格内容：设计态给一个明确标记，实际渲染由表格容器负责
  if (type === 'image' && isSheetBackgroundImage(cfg)) {
    return `${def.icon} 整表背景图`;
  }
  const brief =
    type === 'text' || type === 'note' || type === 'detailTitle'
      ? String(cfg.content || '').slice(0, 12)
      : type === 'tab'
        ? (() => {
            // E9 模型：显示页签名列表；旧模型：显示 tabs 文本
            const group = parseTabGroup(cfg);
            if (group) return group.tabs.map((t) => t.name).join('/').slice(0, 12);
            return String(cfg.tabs || '').slice(0, 12);
          })()
        : type === 'multilang'
          ? String(cfg.zh || cfg.en || cfg.tw || '').slice(0, 12)
          : '';
  return brief ? `${def.icon} ${def.label}：${brief}` : `${def.icon} ${def.label}`;
};

/**
 * 整表背景图：对齐 E9 `baseOperate_wev8.js:1954-2006` 的 type=2 分支 `addBgImg()`
 * 与 `designOperate_wev8.js:100-101`（保存时把 sheet 级 backgroundImage 写进 datajson 顶层）。
 * 本项目把它存为 `layoutJson.backgroundImage`（同时镜像到 sheets.sheet1，供预览按 sheet 读取）。
 */
export const SHEET_BACKGROUND_SRCDTYPE = 2;

export const isSheetBackgroundImage = (cfg: Record<string, any>): boolean =>
  Number(cfg?.srcdtype) === SHEET_BACKGROUND_SRCDTYPE;

/** 解析 E9 协议前缀：href 未带协议时补上（对齐 ParseExcelLayout.java:1970-1993 parseHref） */
export const normalizeLinkHref = (cfg: Record<string, any>): string => {
  const raw = String(cfg.href || '').trim();
  if (!raw) return '';
  if (/^(https?|ftp|news):\/\//i.test(raw) || raw.startsWith('/') || raw.startsWith('#')) return raw;
  return `${cfg.protocol || 'https://'}${raw}`;
};

/**
 * Iframe URL 变量插值（SpringBlade 原生字段命名，兼容 E9 迁移布局）：
 *   $requestId$  → 流程实例（SpringBlade requestId；前端运行期上下文记作 instanceId）
 *   $workflowid$ → 流程定义（defId）
 *   $nodeId$     → 审批节点（nodeKey）
 *   $formId$     → 表单ID（workflow_bill.id）
 *   $taskId$     → 待办任务ID
 * 同时识别 E9 历史小写令牌（$requestid$ / $nodeid$ / $formid$ / $taskid$）以兼容存量迁移布局。
 */
export const resolveIframeSrc = (
  src: string,
  ctx: {
    requestId?: any;
    workflowid?: any;
    nodeId?: any;
    formId?: any;
    taskId?: any;
    requestid?: any;
    nodeid?: any;
    formid?: any;
    taskid?: any;
  } = {},
): string => {
  const pick = (k: string): any => {
    switch (k) {
      case 'requestId':
      case 'requestid':
        return ctx.requestId ?? ctx.requestid;
      case 'workflowid':
        return ctx.workflowid;
      case 'nodeId':
      case 'nodeid':
        return ctx.nodeId ?? ctx.nodeid;
      case 'formId':
      case 'formid':
        return ctx.formId ?? ctx.formid;
      case 'taskId':
      case 'taskid':
        return ctx.taskId ?? ctx.taskid;
      default:
        return undefined;
    }
  };
  return String(src || '').replace(
    /\$(requestId|requestid|workflowid|nodeId|nodeid|formId|formid|taskId|taskid)\$/g,
    (_m, key: string) => {
      const v = pick(key);
      return v === undefined || v === null ? '' : String(v);
    },
  );
};

/** 二维码/条码后端图片地址（对齐 E9 `/createQRCode` 与 `/createWfBarCode`） */
export const buildBarcodeUrl = (cfg: Record<string, any>): string => {
  const p = new URLSearchParams();
  p.set('type', cfg.type === 'barcode' ? 'bar' : 'qr');
  p.set('msg', String(cfg.content || ''));
  p.set('width', String(cfg.width || 100));
  p.set('height', String(cfg.height || 100));
  if (cfg.hidetext) p.set('hrp', 'none');
  return `/api/blade-formmode/form-layout/barcode/png?${p.toString()}`;
};

/**
 * 标签页配置解析（对齐 E9 `designOperate_wev8.js:1226-1234` 的
 * `tab={name,defshow,style,areaheight,order_N="tab_N,显示名"}` 与 `ParseExcelLayout.java:488-531`
 * 的「按 tabid 索引独立子表 + display:none 切换」）。
 *
 * 本项目是单 sheet 布局（无 E9 的 etables[tab_N] 子画布），故用**每页绑定的行区间**
 * 做等价的内容联动：切换标签页时只渲染该页行。行号按用户习惯用 1-based，内部转 0-based。
 *
 * 边界统一在这里收敛：空名称 / 重复名 / defaultTab 为 NaN、负数、越界 / 行范围缺失、
 * 非法、倒序、数量不匹配 —— 全部给出安全兜底，渲染层无需再判空。
 */
export interface TabPageConfig {
  name: string;
  startRow: number;
  endRow: number;
}
export interface TabConfig {
  names: string[];
  pages: TabPageConfig[];
  defaultIndex: number;
  /** 样式编号：-1~-6 内置样式；0 = 自定义（见 elementConfig.customStyle） */
  styleId: number;
  /** 自定义样式（styleId=0 时生效） */
  custom: TabCustomStyle;
}

/**
 * 标签页容器（对齐 E9 `tab` 对象 + `etables.tab_N`）
 *
 * E9 数据模型：
 *   主表某个单元格的 ec.tab = {
 *     name: '标签页', style: '-1', defshow: '0', areaheight: '1',
 *     order_1: 'tab_1,页签A', order_2: 'tab_2,页签B'
 *   }
 *   每个页签的内容是一张**独立表** `etables['tab_1']`（与 emaintable 同级并列），
 *   在本项目落为 `layout.tabTables[tabId]`（与 detailTables 同级）。
 */
export interface TabGroupTab {
  /** 页签 id（E9 tab_N）；同时是页签内容表在 layout.tabTables 中的键 */
  id: string;
  /** 页签显示名 */
  name: string;
}

export interface TabGroupConfig {
  /** 容器名（E9 tab.name） */
  containerName: string;
  /** 样式 id：-1~-6 内置；0 = 自定义 */
  styleId: number;
  /** 默认显示的页签序号（0 基） */
  defShow: number;
  /** 内容区高度：'1' = 自适应；'2,300' = 固定 300px */
  areaHeight: string;
  /** 页签列表（E9 order_1..order_N 的解析结果） */
  tabs: TabGroupTab[];
  /** 自定义样式（styleId=0 时生效） */
  custom: TabCustomStyle;
}

/** 从 elementConfig 中取自定义样式字段（行区间方案与页签容器方案共用） */
export const readTabCustomStyle = (cfg: Record<string, any>): TabCustomStyle => ({
  selBg: cfg?.selBg ? String(cfg.selBg) : undefined,
  selColor: cfg?.selColor ? String(cfg.selColor) : undefined,
  unselBg: cfg?.unselBg ? String(cfg.unselBg) : undefined,
  unselColor: cfg?.unselColor ? String(cfg.unselColor) : undefined,
  selFontSize: Number.isFinite(Number(cfg?.tabFontSize)) && Number(cfg?.tabFontSize) > 0 ? Number(cfg.tabFontSize) : undefined,
});

/**
 * 解析 elementConfig → 页签容器配置（E9 风格）。
 * 没有 order_N 时返回 null → 走旧版「行区间划分同一张表」方案（兼容历史布局）。
 */
export const parseTabGroup = (cfg: Record<string, any>): TabGroupConfig | null => {
  const raw = cfg || {};
  const orderKeys = Object.keys(raw)
    .filter((k) => /^order_\d+$/.test(k))
    .sort((a, b) => Number(a.slice(6)) - Number(b.slice(6)));
  if (!orderKeys.length) return null;
  const tabs: TabGroupTab[] = [];
  orderKeys.forEach((k) => {
    const v = String(raw[k] ?? '');
    const i = v.indexOf(',');
    const id = (i >= 0 ? v.slice(0, i) : v).trim();
    const name = (i >= 0 ? v.slice(i + 1) : '').trim();
    if (!id) return;
    tabs.push({ id, name: name || id });
  });
  if (!tabs.length) return null;
  let def = Number(raw.defshow);
  if (!Number.isFinite(def)) def = 0;
  def = Math.trunc(def);
  def = Math.max(0, Math.min(tabs.length - 1, def));
  const styleIdRaw = Number(raw.style);
  const styleId = Number.isFinite(styleIdRaw) ? Math.trunc(styleIdRaw) : -1;
  return {
    containerName: String(raw.name || '标签页'),
    styleId,
    defShow: def,
    areaHeight: String(raw.areaheight || '1'),
    tabs,
    custom: readTabCustomStyle(raw),
  };
};

/** 页签容器配置 → elementConfig（写回单元格的 E9 风格配置） */
export const buildTabGroupConfig = (g: TabGroupConfig): Record<string, any> => {
  const out: Record<string, any> = {
    name: g.containerName,
    style: g.styleId,
    defshow: g.defShow,
    areaheight: g.areaHeight,
  };
  g.tabs.forEach((t, i) => {
    out[`order_${i + 1}`] = `${t.id},${t.name}`;
  });
  if (g.styleId === 0) Object.assign(out, g.custom || {});
  return out;
};

/** 生成新的页签 id（E9 tab_N 命名，递增） */
export const nextTabId = (existing: string[]): string => {
  let max = 0;
  existing.forEach((id) => {
    const m = /^tab_(\d+)$/.exec(id);
    if (m) max = Math.max(max, Number(m[1]));
  });
  return `tab_${max + 1}`;
};

export const parseTabConfig = (cfg: Record<string, any>): TabConfig => {
  const names = String(cfg?.tabs || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const styleIdRaw = Number(cfg?.styleid);
  const styleId = Number.isFinite(styleIdRaw) ? Math.trunc(styleIdRaw) : -1;
  const custom: TabCustomStyle = {
    selBg: cfg?.selBg ? String(cfg.selBg) : undefined,
    selColor: cfg?.selColor ? String(cfg.selColor) : undefined,
    unselBg: cfg?.unselBg ? String(cfg.unselBg) : undefined,
    unselColor: cfg?.unselColor ? String(cfg.unselColor) : undefined,
    selFontSize: Number.isFinite(Number(cfg?.tabFontSize)) && Number(cfg?.tabFontSize) > 0 ? Number(cfg.tabFontSize) : undefined,
  };
  if (!names.length) return { names, pages: [], defaultIndex: 0, styleId, custom };

  const ranges = String(cfg?.tabRows || '')
    .split(',')
    .map((s) => {
      const m = s.trim().match(/^(\d+)\s*[-~:]\s*(\d+)$/);
      if (!m) return null;
      let a = Number(m[1]) - 1;
      let b = Number(m[2]) - 1;
      if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
      if (b < a) [a, b] = [b, a]; // 倒序输入自动纠正
      return { startRow: a, endRow: b };
    });

  const pages: TabPageConfig[] = names.map((name, i) => ({
    name,
    // 缺失/非法的行范围 → 该页显示全部行，避免「切过去一片空白」
    startRow: ranges[i]?.startRow ?? -Infinity,
    endRow: ranges[i]?.endRow ?? Infinity,
  }));

  let d = Number(cfg?.defaultTab);
  if (!Number.isFinite(d)) d = 0;
  d = Math.trunc(d);
  d = Math.max(0, Math.min(names.length - 1, d));

  return { names, pages, defaultIndex: d, styleId, custom };
};

/**
 * 标签头样式 → CSS（对齐 E9 `getDivStyle_ByStyle` 的编译结果）。
 *
 * @param cfg    解析后的标签页配置
 * @param active 是否为选中态
 */
export const tabStyleToCss = (cfg: TabConfig, active: boolean): CSSProperties =>
  tabStyleCss(cfg.styleId, cfg.custom, active);

/** 按样式 id + 自定义样式编译标签头 CSS（行区间方案与页签容器方案共用） */
export const tabStyleCss = (styleId: number, custom: TabCustomStyle, active: boolean): CSSProperties => {
  const preset = TAB_STYLE_PRESETS.find((p) => p.id === styleId);
  const base = preset || TAB_DEFAULT_STYLE;
  const customStyle = styleId === 0 ? custom || {} : {};
  const pick = <T,>(a: T, b: T | undefined): T => (b === undefined || b === null || b === '' ? a : b);
  const bg = active
    ? pick(base.selBg, customStyle.selBg)
    : pick(base.unselBg, customStyle.unselBg);
  const color = active
    ? pick(base.selColor, customStyle.selColor)
    : pick(base.unselColor, customStyle.unselColor);
  const bold = active ? pick(base.selBold, customStyle.selBold) : pick(base.unselBold, customStyle.unselBold);
  const italic = active ? pick(base.selItalic, customStyle.selItalic) : pick(base.unselItalic, customStyle.unselItalic);
  const fontSize = active
    ? pick(base.selFontSize, customStyle.selFontSize)
    : pick(base.unselFontSize, customStyle.unselFontSize);
  const family = active ? pick(base.selFamily, customStyle.selFamily) : pick(base.unselFamily, customStyle.unselFamily);
  const sepColor = pick(base.sepColor, customStyle.sepColor);
  const sepWidth = pick(base.sepWidth, customStyle.sepWidth);
  const radius = pick(base.radius, customStyle.radius);
  return {
    background: bg,
    color,
    fontSize: `${fontSize}px`,
    fontWeight: bold ? 600 : 400,
    fontStyle: italic ? 'italic' : 'normal',
    fontFamily: family || undefined,
    borderRadius: radius,
    border: `${sepWidth}px solid ${sepColor}`,
    // 选中态与内容区「连成一体」：下边框用分隔线色，视觉上与表格贴齐（E9 tab_head/tab_bottom 同理）
    borderBottom: active ? `${sepWidth}px solid ${sepColor}` : 'none',
    boxShadow: active ? '0 -1px 2px rgba(0,0,0,0.04)' : 'none',
  };
};

/**
 * 标签页行区间（1-based，与 elementConfig.tabRows 文本口径一致）。
 * start/end 为 null 表示「未设置」→ 该页显示全部行。
 */
export interface TabRowRange {
  start: number | null;
  end: number | null;
}

/** 解析 tabRows 文本 → 区间数组（与页数一一对应；缺失的补 null） */
export const parseTabRowRanges = (cfg: Record<string, any>, count?: number): TabRowRange[] => {
  const n = count ?? String(cfg?.tabs || '').split(',').filter((s) => s.trim()).length;
  const list: TabRowRange[] = [];
  String(cfg?.tabRows || '')
    .split(',')
    .forEach((s) => {
      const m = s.trim().match(/^(\d+)\s*[-~:]\s*(\d+)$/);
      if (!m) {
        list.push({ start: null, end: null });
        return;
      }
      let a = Number(m[1]);
      let b = Number(m[2]);
      if (b < a) [a, b] = [b, a];
      list.push({ start: a, end: b });
    });
  while (list.length < n) list.push({ start: null, end: null });
  return list.slice(0, Math.max(n, 0));
};

/** 区间数组 → tabRows 文本（未设置的页留空位） */
export const serializeTabRows = (ranges: TabRowRange[]): string =>
  ranges
    .map((r) => (r.start != null && r.end != null ? `${r.start}-${r.end}` : ''))
    .join(',');

/**
 * 标签页操作 → elementConfig 补丁。
 * 增删/排序时 **名称与行区间同步移动**（区间是「页」的属性，不是「位置」的属性），
 * 保证排序后各页内容不串位（对齐 E9 order_N="tab_N,显示名" 的整体搬移语义）。
 */
export const buildTabPatch = (opts: {
  names: string[];
  ranges: TabRowRange[];
  defaultIndex?: number;
  styleId?: number;
  custom?: TabCustomStyle;
}): Record<string, any> => {
  const patch: Record<string, any> = {
    tabs: opts.names.join(','),
    tabRows: serializeTabRows(opts.ranges),
  };
  if (opts.defaultIndex !== undefined) patch.defaultTab = opts.defaultIndex;
  if (opts.styleId !== undefined) patch.styleid = opts.styleId;
  if (opts.custom) {
    if (opts.custom.selBg !== undefined) patch.selBg = opts.custom.selBg;
    if (opts.custom.selColor !== undefined) patch.selColor = opts.custom.selColor;
    if (opts.custom.unselBg !== undefined) patch.unselBg = opts.custom.unselBg;
    if (opts.custom.unselColor !== undefined) patch.unselColor = opts.custom.unselColor;
    if (opts.custom.selFontSize !== undefined) patch.tabFontSize = opts.custom.selFontSize;
  }
  return patch;
};

/** 从整张 sheet 的 cellData 中找出第一个标签页元素格配置（多个时取首个，避免嵌套冲突） */
export const findTabConfig = (
  cellData: Record<string, Record<string, any>> | undefined,
): TabConfig | null => {
  const pos = findTabCellPos(cellData);
  return pos ? pos.config : null;
};

/**
 * 标签页元素格位置：返回首个 tab 元素的解析配置 + 0-based 行/列。
 * 预览需在「单元格原位」渲染标签头（而非表格顶部），故需要行号。
 */
export const findTabCellPos = (
  cellData: Record<string, Record<string, any>> | undefined,
): { config: TabConfig; raw: Record<string, any>; row: number; col: number } | null => {
  for (const [rk, row] of Object.entries(cellData || {})) {
    const r = Number(rk);
    if (!Number.isFinite(r)) continue;
    for (const [ck, cell] of Object.entries(row || {})) {
      const m = cell?.fieldMeta;
      if (m?.cellType === 'element' && m?.elementType === 'tab') {
        const raw = (m.elementConfig || {}) as Record<string, any>;
        const c = parseTabConfig(raw);
        if (c.names.length || parseTabGroup(raw)) return { config: c, raw, row: r, col: Number(ck) };
      }
    }
  }
  return null;
};

/** 多语言标签：按当前 locale 取三语文本，缺失时按 zh → en → tw → 原值回落 */
export const pickMultiLang = (cfg: Record<string, any>, locale?: string): string => {
  const l = String(locale || '').toLowerCase();
  const key = l.startsWith('en') ? 'en' : l.startsWith('tw') || l.includes('hant') ? 'tw' : 'zh';
  return String(cfg[key] || cfg.zh || cfg.en || cfg.tw || '');
};
