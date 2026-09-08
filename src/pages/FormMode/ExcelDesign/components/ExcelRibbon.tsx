import React, { useState, useEffect, useRef } from 'react';
import {
  Tabs,
  Button,
  Space,
  Tooltip,
  Divider,
  Dropdown,
  ColorPicker,
  Select,
  message,
  Modal,
  Input,
  InputNumber,
} from 'antd';
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
  BgColorsOutlined,
  FontSizeOutlined,
  EnterOutlined,
  MergeCellsOutlined,
  SplitCellsOutlined,
  InsertRowAboveOutlined,
  InsertRowLeftOutlined,
  DeleteRowOutlined,
  DeleteColumnOutlined,
  LockOutlined,
  EditOutlined,
  CheckCircleOutlined,
  TableOutlined,
  CodeOutlined,
  PictureOutlined,
  LinkOutlined,
  GlobalOutlined,
  ApiOutlined,
  FunctionOutlined,
  ClearOutlined,
  AppstoreOutlined,
  InfoCircleOutlined,
  BarcodeOutlined,
  DeploymentUnitOutlined,
} from '@ant-design/icons';

/**
 * Excel 设计器顶部工具条（Ribbon）
 *
 * 对齐 ecology exceldesign 的操作区划分：模板 / 格式 / 插入 / 字段属性 / 明细表。
 * 说明：
 *  - 模板、字段属性、明细表 复用 ExcelDesign 既有处理器；
 *  - 格式、插入（行列）通过 window.univerExcelGrid 的 Facade API
 *    （applyRangeFormat / mergeSelection / unmergeSelection / rowColOp）作用到当前选区。
 */

type FieldAttr = 'readonly' | 'editable' | 'required' | null;

interface ExcelRibbonProps {
  saving?: boolean;
  onSave: () => void;
  /** 布局级代码块当前内容（整份表单一份可执行脚本，对齐 ecology 按 layoutid 取 script） */
  layoutScript?: string;
  /** 保存布局级代码块；返回是否成功（弹窗「保存」按钮调用） */
  onSaveLayoutScript?: (script: string) => Promise<boolean> | boolean;
  onPreview: () => void;
  onImport: () => void;
  onExport: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  fieldAttr: FieldAttr;
  fieldAttrDisabled: boolean;
  onFieldAttrChange: (attr: 'readonly' | 'editable' | 'required') => void;
  /** 本表单拥有的明细表序号（用于「插入明细表」下拉） */
  detailTableOptions: { idx: number; count: number }[];
  onInsertDetail: (idx: number) => void;
  /** 是否展示工具条。原生 ribbon 注册成功时由父组件置 false（仅保留 Modal 承载弹窗），避免双工具条 */
  visible?: boolean;
}

const FONT_SIZES = [9, 10, 11, 12, 14, 16, 18, 20, 24, 28];

// ──────────────────────────────────────────────
// 插入菜单（对齐 ecology excelOperatHead.jsp 的 s_insert 分组，共 12 项）
//  - 10 项为「元素格」：写入 cellType='element' + elementType + elementConfig
//    （对应 ecology 扩展控件 dataobj.ecs[cellid] = { etype, jsonparam }）；
//  - 「公式」写入 '=' 交给 Univer 公式引擎编辑；
//  - 「清除背景」把当前选区背景重置为白色。
// ──────────────────────────────────────────────
type InsertFieldDef = {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'select';
  options?: { label: string; value: any }[];
  placeholder?: string;
  initial?: any;
  /** textarea 行数（代码块等需要更大的编辑区） */
  rows?: number;
};

type InsertDef = {
  key: string;
  label: string;
  icon: React.ReactNode;
  /**
   * element=写入元素格；formula=公式；action=立即执行的网格动作；
   * script=布局级代码块（不写单元格，整份表单一份脚本，预览时注入执行）
   */
  mode: 'element' | 'formula' | 'action' | 'script';
  fields?: InsertFieldDef[];
  action?: string;
  actionArgs?: any[];
};

const INSERT_DEFS: InsertDef[] = [
  {
    // 布局级代码块：对齐 ecology「按 layoutid 取整表一份 script、加载时注入执行」，
    // 不占用单元格（ecology 的 InsertCode 弹窗即一个大的 script 编辑区）。
    key: 'code',
    label: '代码块',
    icon: <CodeOutlined />,
    mode: 'script',
    fields: [
      {
        name: 'content',
        label: '代码内容',
        type: 'textarea',
        rows: 14,
        placeholder: '输入 HTML / JS，例如：<script>console.log("hello")</script>',
      },
    ],
  },
  {
    key: 'image',
    label: '图片',
    icon: <PictureOutlined />,
    mode: 'element',
    fields: [
      { name: 'src', label: '图片地址', type: 'text', placeholder: 'https://... 或相对路径' },
      { name: 'width', label: '宽度(px)', type: 'number' },
      { name: 'height', label: '高度(px)', type: 'number' },
      { name: 'alt', label: '替代文字', type: 'text' },
    ],
  },
  {
    key: 'text',
    label: '文本',
    icon: <FontSizeOutlined />,
    mode: 'element',
    fields: [{ name: 'content', label: '文本内容', type: 'textarea', placeholder: '输入文本内容' }],
  },
  {
    key: 'link',
    label: '链接',
    icon: <LinkOutlined />,
    mode: 'element',
    fields: [
      { name: 'href', label: '链接地址', type: 'text', placeholder: 'https://...' },
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
  },
  {
    key: 'multilang',
    label: '多语言标签',
    icon: <GlobalOutlined />,
    mode: 'element',
    fields: [
      { name: 'zh', label: '中文', type: 'text' },
      { name: 'en', label: 'English', type: 'text' },
      { name: 'tw', label: '繁體', type: 'text' },
    ],
  },
  {
    key: 'iframe',
    label: 'Iframe区域',
    icon: <ApiOutlined />,
    mode: 'element',
    fields: [
      { name: 'src', label: 'Iframe 地址', type: 'text', placeholder: 'https://...' },
      { name: 'height', label: '高度(px)', type: 'number', initial: 240 },
    ],
  },
  { key: 'formula', label: '公式', icon: <FunctionOutlined />, mode: 'formula' },
  {
    key: 'clearBg',
    label: '清除背景',
    icon: <ClearOutlined />,
    mode: 'action',
    action: 'applyRangeFormat',
    actionArgs: ['bg', '#ffffff'],
  },
  {
    key: 'tab',
    label: '标签页',
    icon: <AppstoreOutlined />,
    mode: 'element',
    fields: [
      {
        name: 'tabs',
        label: '标签页名称',
        type: 'text',
        placeholder: '多个用逗号分隔，如：基本信息,扩展信息',
      },
    ],
  },
  {
    key: 'note',
    label: '说明',
    icon: <InfoCircleOutlined />,
    mode: 'element',
    fields: [{ name: 'content', label: '说明内容', type: 'textarea' }],
  },
  {
    key: 'barcode',
    label: '二维/条形码',
    icon: <BarcodeOutlined />,
    mode: 'element',
    fields: [
      {
        name: 'type',
        label: '类型',
        type: 'select',
        initial: 'qrcode',
        options: [
          { label: '二维码', value: 'qrcode' },
          { label: '条形码', value: 'barcode' },
        ],
      },
      { name: 'content', label: '编码内容', type: 'text' },
      { name: 'width', label: '宽度(px)', type: 'number', initial: 100 },
      { name: 'height', label: '高度(px)', type: 'number', initial: 100 },
    ],
  },
  {
    key: 'portal',
    label: '门户元素',
    icon: <DeploymentUnitOutlined />,
    mode: 'element',
    fields: [
      { name: 'hpid', label: '门户ID', type: 'text', placeholder: '门户元素 hpid' },
      { name: 'height', label: '高度(px)', type: 'number', initial: 300 },
    ],
  },
];

// 统一的网格 API 调用：实例缺失 / 无选区时给出明确提示
const callGrid = (fn: string, ...args: any[]): boolean => {
  const grid = (window as any).univerExcelGrid;
  if (!grid || typeof grid[fn] !== 'function') {
    message.warning('Excel 组件尚未初始化');
    return false;
  }
  const ok = grid[fn](...args);
  if (ok === false) {
    message.warning('请先在表格中选中单元格');
  }
  return ok !== false;
};

const ExcelRibbon: React.FC<ExcelRibbonProps> = ({
  saving,
  onSave,
  layoutScript = '',
  onSaveLayoutScript,
  onPreview,
  onImport,
  onExport,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  fieldAttr,
  fieldAttrDisabled,
  onFieldAttrChange,
  detailTableOptions,
  onInsertDetail,
  visible = true,
}) => {
  const [activeKey, setActiveKey] = useState<string>('format');
  // 加粗/斜体/下划线为开关态：仅作视觉反馈，实际每次点击都作用于当前选区
  const [toggles, setToggles] = useState<Record<string, boolean>>({ bold: false, italic: false, underline: false });
  // 插入元素：当前正在配置的项 + 其参数值（无参数项直接插入，不弹窗）
  const [insertDef, setInsertDef] = useState<InsertDef | null>(null);
  const [insertVals, setInsertVals] = useState<Record<string, any>>({});

  const toggle = (key: string, action: string) => {
    const next = !toggles[key];
    setToggles((prev) => ({ ...prev, [key]: next }));
    callGrid('applyRangeFormat', action, next);
  };

  // 点击「插入」项：action/formula 立即执行；script=布局级代码块（弹窗编辑并保存）；
  // 其余有参数的元素项先弹窗收集配置
  const openInsert = (def: InsertDef) => {
    if (def.mode === 'action') {
      if (callGrid(def.action as string, ...(def.actionArgs || []))) {
        message.success(`已${def.label}`);
      }
      return;
    }
    if (def.mode === 'formula') {
      if (callGrid('insertFormula')) message.success('已进入公式编辑，输入公式后回车');
      return;
    }
    // 布局级代码块：不写入单元格，直接打开编辑框并回显已保存内容，点「保存」持久化
    if (def.mode === 'script') {
      setInsertVals({ content: layoutScript });
      setInsertDef(def);
      return;
    }
    if (!def.fields || def.fields.length === 0) {
      if (callGrid('insertElement', def.key, {})) message.success(`已插入「${def.label}」`);
      return;
    }
    const init: Record<string, any> = {};
    def.fields.forEach((f) => {
      init[f.name] = f.initial !== undefined ? f.initial : f.type === 'number' ? undefined : '';
    });
    setInsertVals(init);
    setInsertDef(def);
  };

  const submitInsert = async () => {
    if (!insertDef) return;
    // 布局级代码块：保存到布局（后端 layout_config），不写入单元格
    if (insertDef.mode === 'script') {
      const ok = await onSaveLayoutScript?.(String(insertVals.content ?? ''));
      if (ok) message.success('代码块已保存');
      setInsertDef(null);
      return;
    }
    if (callGrid('insertElement', insertDef.key, insertVals)) {
      message.success(`已插入「${insertDef.label}」`);
    }
    setInsertDef(null);
  };

  // 按类型打开插入参数弹窗（供原生 ribbon 的「插入」项桥接调用）
  const openInsertByType = (type: string) => {
    const def = INSERT_DEFS.find((d) => d.key === type);
    if (def) openInsert(def);
  };
  const openInsertByTypeRef = useRef(openInsertByType);
  openInsertByTypeRef.current = openInsertByType;
  // 挂载时把桥接挂到 window；原生 ribbon 的插入按钮点击后调用它打开 React 弹窗
  useEffect(() => {
    (window as any).__designerOpenInsertModal = (type: string) => openInsertByTypeRef.current(type);
    return () => {
      delete (window as any).__designerOpenInsertModal;
    };
  }, []);

  const tabItems = [
    // ── 模板：整体保存 / 预览 / 导入导出 ──
    {
      key: 'template',
      label: '模板',
      children: (
        <Space wrap size={8}>
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={onSave}>
            保存
          </Button>
          <Button icon={<EyeOutlined />} onClick={onPreview}>
            预览
          </Button>
          <Divider type="vertical" />
          <Button icon={<UploadOutlined />} onClick={onImport}>
            导入
          </Button>
          <Button icon={<DownloadOutlined />} onClick={onExport}>
            导出
          </Button>
        </Space>
      ),
    },
    // ── 格式：撤销重做 + 字体 + 对齐 + 背景 + 合并 ──
    {
      key: 'format',
      label: '格式',
      children: (
        <Space wrap size={8}>
          <Tooltip title="撤销">
            <Button icon={<UndoOutlined />} disabled={!canUndo} onClick={onUndo} />
          </Tooltip>
          <Tooltip title="重做">
            <Button icon={<RedoOutlined />} disabled={!canRedo} onClick={onRedo} />
          </Tooltip>
          <Divider type="vertical" />
          <Tooltip title="加粗">
            <Button
              icon={<BoldOutlined />}
              type={toggles.bold ? 'primary' : 'default'}
              onClick={() => toggle('bold', 'bold')}
            />
          </Tooltip>
          <Tooltip title="斜体">
            <Button
              icon={<ItalicOutlined />}
              type={toggles.italic ? 'primary' : 'default'}
              onClick={() => toggle('italic', 'italic')}
            />
          </Tooltip>
          <Tooltip title="下划线">
            <Button
              icon={<UnderlineOutlined />}
              type={toggles.underline ? 'primary' : 'default'}
              onClick={() => toggle('underline', 'underline')}
            />
          </Tooltip>
          <Select
            size="small"
            style={{ width: 90 }}
            placeholder="字号"
            suffixIcon={<FontSizeOutlined />}
            onChange={(v) => callGrid('applyRangeFormat', 'fontSize', v)}
            options={FONT_SIZES.map((s) => ({ label: `${s}`, value: s }))}
          />
          <Divider type="vertical" />
          <Tooltip title="左对齐">
            <Button icon={<AlignLeftOutlined />} onClick={() => callGrid('applyRangeFormat', 'align', 'left')} />
          </Tooltip>
          <Tooltip title="居中">
            <Button icon={<AlignCenterOutlined />} onClick={() => callGrid('applyRangeFormat', 'align', 'center')} />
          </Tooltip>
          <Tooltip title="右对齐">
            <Button icon={<AlignRightOutlined />} onClick={() => callGrid('applyRangeFormat', 'align', 'right')} />
          </Tooltip>
          <Tooltip title="自动换行">
            <Button icon={<EnterOutlined />} onClick={() => callGrid('applyRangeFormat', 'wrap', true)} />
          </Tooltip>
          <Divider type="vertical" />
          <Tooltip title="背景色">
            <span style={{ display: 'inline-block', verticalAlign: 'middle' }}>
              <ColorPicker
                size="small"
                onChange={(_, hex) => callGrid('applyRangeFormat', 'bg', hex)}
              >
                <Button icon={<BgColorsOutlined />} />
              </ColorPicker>
            </span>
          </Tooltip>
          <Divider type="vertical" />
          <Tooltip title="合并单元格">
            <Button icon={<MergeCellsOutlined />} onClick={() => callGrid('mergeSelection')}>
              合并
            </Button>
          </Tooltip>
          <Tooltip title="取消合并">
            <Button icon={<SplitCellsOutlined />} onClick={() => callGrid('unmergeSelection')}>
              取消合并
            </Button>
          </Tooltip>
        </Space>
      ),
    },
    // ── 插入：12 项元素/公式/清除背景（对齐 ecology s_insert） + 行列增删 ──
    {
      key: 'insert',
      label: '插入',
      children: (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {INSERT_DEFS.map((d) => (
              <Tooltip key={d.key} title={d.label}>
                <Button icon={d.icon} onClick={() => openInsert(d)}>
                  {d.label}
                </Button>
              </Tooltip>
            ))}
          </div>
          <Divider style={{ margin: '8px 0' }} />
          <Space wrap size={8}>
            <span style={{ color: '#999', fontSize: 12 }}>行列：</span>
            <Button icon={<InsertRowAboveOutlined />} onClick={() => callGrid('rowColOp', 'insertRow')}>
              插入行
            </Button>
            <Button icon={<InsertRowLeftOutlined />} onClick={() => callGrid('rowColOp', 'insertCol')}>
              插入列
            </Button>
            <Button icon={<DeleteRowOutlined />} onClick={() => callGrid('rowColOp', 'removeRow')}>
              删除行
            </Button>
            <Button icon={<DeleteColumnOutlined />} onClick={() => callGrid('rowColOp', 'removeCol')}>
              删除列
            </Button>
          </Space>
        </>
      ),
    },
    // ── 字段属性：只读 / 可编辑 / 必填（对齐 ecology viewAttr）──
    {
      key: 'fieldAttr',
      label: '字段属性',
      children: (
        <Space wrap size={8}>
          <Tooltip title="设置字段为只读">
            <Button
              icon={<LockOutlined />}
              type={fieldAttr === 'readonly' ? 'primary' : 'default'}
              disabled={fieldAttrDisabled}
              onClick={() => onFieldAttrChange('readonly')}
            >
              只读
            </Button>
          </Tooltip>
          <Tooltip title="设置字段为可编辑">
            <Button
              icon={<EditOutlined />}
              type={fieldAttr === 'editable' ? 'primary' : 'default'}
              disabled={fieldAttrDisabled}
              onClick={() => onFieldAttrChange('editable')}
            >
              编辑
            </Button>
          </Tooltip>
          <Tooltip title="设置字段为必填">
            <Button
              icon={<CheckCircleOutlined />}
              type={fieldAttr === 'required' ? 'primary' : 'default'}
              disabled={fieldAttrDisabled}
              onClick={() => onFieldAttrChange('required')}
            >
              必填
            </Button>
          </Tooltip>
        </Space>
      ),
    },
    // ── 明细表：插入各序号的明细表标记 ──
    {
      key: 'detail',
      label: '明细表',
      children: (
        <Space wrap size={8}>
          <Dropdown
            disabled={detailTableOptions.length === 0}
            menu={{
              disabled: detailTableOptions.length === 0,
              items: detailTableOptions.map((o) => ({
                key: String(o.idx),
                label: `明细表${o.idx}（${o.count} 字段）`,
                onClick: () => onInsertDetail(o.idx),
              })),
            }}
          >
            <Button icon={<TableOutlined />} disabled={detailTableOptions.length === 0}>
              插入明细表
            </Button>
          </Dropdown>
          {detailTableOptions.length === 0 && (
            <span style={{ color: '#999', fontSize: 12 }}>该表单未定义明细表字段</span>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div
      style={{
        display: visible === false ? 'none' : undefined,
        background: '#fafafa',
        border: '1px solid #f0f0f0',
        borderRadius: 6,
        marginBottom: 12,
        padding: '4px 8px',
      }}
    >
      <Tabs size="small" activeKey={activeKey} onChange={setActiveKey} items={tabItems} />

      {/* 参数配置弹窗：script=布局级代码块（保存脚本）；其余元素项按元素类型动态渲染字段，确认后写入活动单元格 */}
      <Modal
        open={!!insertDef}
        title={insertDef ? (insertDef.mode === 'script' ? '代码块' : `插入「${insertDef.label}」`) : ''}
        // 代码块是「保存」到布局（对齐 ecology InsertCode 弹窗的保存按钮），其余元素仍是「插入」到单元格
        okText={insertDef?.mode === 'script' ? '保存' : '插入'}
        cancelText="取消"
        onOk={submitInsert}
        onCancel={() => setInsertDef(null)}
        width={insertDef?.mode === 'script' ? 720 : 520}
        destroyOnClose
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
          {insertDef?.mode === 'script' && (
            <div style={{ color: '#888', fontSize: 12, lineHeight: 1.7 }}>
              <div>
                整份表单仅一份脚本，不占用单元格；预览与表单加载时注入执行，可写 HTML / JS。
              </div>
              <div style={{ marginTop: 8, color: '#666' }}>
                <strong>如何访问字段（DOM id 规范）</strong>：每个字段控件 / 表头均带唯一 id 与
                data-* 属性，脚本里推荐用全局对象 <code>window.ExcelPreview</code> 读写，无需手写选择器。
              </div>
              <pre
                style={{
                  background: '#f6f8fa',
                  padding: 10,
                  borderRadius: 6,
                  fontSize: 12,
                  margin: '6px 0 0',
                  whiteSpace: 'pre-wrap',
                }}
              >{`// id 命名规则：excelp_{scope}_{kind}_{name}[_dup]
//   scope: main | dt{idx}_r{row}   kind: fd=字段控件  lb=表头
// 例：excelp_main_fd_xm / excelp_main_lb_姓名 / excelp_dt1_r0_fd_je

ExcelPreview.get('xm')                      // 读主表「姓名」字段值
ExcelPreview.set('xm', '张三')              // 写值（自动触发 React onChange）
ExcelPreview.set('je', 100, {dt:0, row:0}) // 写明细表1第1行「金额」
ExcelPreview.labelEl('姓名').style.display = 'none' // 操作表头元素
ExcelPreview.list({dt:0, row:0})           // 列出明细表1第1行所有字段
ExcelPreview.rowCount(0)                   // 明细表1 当前行数

// 也可用 data-* 精确选择（避免中文 id 转义问题）：
document.querySelector('[data-excelp-role="field"][data-excelp-scope="main"][data-excelp-field="xm"]')`}</pre>
            </div>
          )}
          {(insertDef?.fields || []).map((f) => (
            <div key={f.name}>
              <div style={{ marginBottom: 4, fontSize: 13 }}>{f.label}</div>
              {f.type === 'text' && (
                <Input
                  value={insertVals[f.name] ?? ''}
                  placeholder={f.placeholder}
                  onChange={(e) => setInsertVals((p) => ({ ...p, [f.name]: e.target.value }))}
                />
              )}
              {f.type === 'textarea' && (
                <Input.TextArea
                  rows={f.rows ?? 4}
                  value={insertVals[f.name] ?? ''}
                  placeholder={f.placeholder}
                  onChange={(e) => setInsertVals((p) => ({ ...p, [f.name]: e.target.value }))}
                />
              )}
              {f.type === 'number' && (
                <InputNumber
                  style={{ width: '100%' }}
                  value={insertVals[f.name]}
                  onChange={(v) => setInsertVals((p) => ({ ...p, [f.name]: v }))}
                />
              )}
              {f.type === 'select' && (
                <Select
                  style={{ width: '100%' }}
                  value={insertVals[f.name]}
                  options={f.options}
                  onChange={(v) => setInsertVals((p) => ({ ...p, [f.name]: v }))}
                />
              )}
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
};

export default ExcelRibbon;
