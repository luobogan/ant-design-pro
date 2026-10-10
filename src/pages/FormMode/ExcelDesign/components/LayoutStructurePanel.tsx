/**
 * 表单结构面板（主表 / 明细表 层级与关联关系）。
 *
 * <p>解决的问题（2026-10-10）：
 * ① 层级不清晰——原布局设计器里「主表 ↔ 明细表N」只靠一个蓝底标记格 + 子画布 Modal，
 * 界面上看不出某明细表属于主表、也看不出它包含哪些字段；
 * ② 字段属性入口分散——只读/编辑/必填只能在「选中单元格 + ribbon」里逐格切换；
 * ③ 删除字段没有独立入口——只能靠清空单元格/删行删列，且删除后属性底色残留。
 *
 * <p>本面板以树形结构集中呈现：主表 → 字段、明细表N → 字段。每个字段行内直接提供
 * 属性三态切换（与 layoutJson `fieldMeta.fieldAttr` 语义一致：1只读/2编辑/3必填）
 * 与删除按钮（删除后字段还原初始状态：清属性底色 + 回到左侧面板可再次拖入）。
 *
 * <p>字段操作作用于「该字段所在画布」：window.univerExcelGrid 指向当前激活画布
 * （主画布或某个明细子画布），故明细表字段操作前需先切换到对应子画布——
 * 由宿主（ExcelDesign）的 ensureActiveCanvas 负责，面板只负责发出意图。
 */
import React, { useMemo } from 'react';
import { App, Button, Empty, Popconfirm, Segmented, Tag, Tooltip } from 'antd';
import {
  ApartmentOutlined,
  DeleteOutlined,
  TableOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';

/** 字段属性三态：值与 layoutJson fieldMeta.fieldAttr 完全一致（1只读/2编辑/3必填） */
export const ATTR_OPTIONS = [
  { label: '只读', value: 1 },
  { label: '编辑', value: 2 },
  { label: '必填', value: 3 },
];

/** 属性 → 中文名（用于结构面板上的紧凑展示） */
const ATTR_LABEL: Record<number, string> = { 1: '只读', 2: '编辑', 3: '必填' };

/** 结构面板里的一个「已放置的字段」 */
export interface StructField {
  /** 归属作用域：'main' 主表 / 'dt{n}' 明细表 n */
  scope: string;
  row: number;
  col: number;
  fieldId: string;
  fieldName: string;
  fieldLabel: string;
  /** 1=只读 2=编辑 3=必填；缺省按 2（初始状态=可编辑） */
  fieldAttr?: number;
}

/**
 * 从一份布局（主表与明细表子画布同构）解析已放置的字段列表。
 * 口径与后端 WfTestServiceImpl#collectLayoutRequired / 前端 setFieldAttr 对齐：
 * 只统计 cellType==='field' 的输入格（label 格仅是说明文字，不重复列出）。
 */
export const parseLayoutFields = (layout: any, scope: string): StructField[] => {
  const out: StructField[] = [];
  if (!layout) return out;
  const sheets: any[] = [];
  if (layout.sheets && typeof layout.sheets === 'object' && !Array.isArray(layout.sheets)) {
    sheets.push(...Object.values(layout.sheets));
  } else if (Array.isArray(layout.sheets)) {
    sheets.push(...layout.sheets);
  } else if (layout.cellData) {
    sheets.push(layout);
  }
  for (const sheet of sheets) {
    const cellData = sheet?.cellData;
    if (!cellData || typeof cellData !== 'object') continue;
    for (const [rowKey, rowObj] of Object.entries<any>(cellData)) {
      if (!rowObj || typeof rowObj !== 'object') continue;
      for (const [colKey, cell] of Object.entries<any>(rowObj)) {
        const fm = cell?.fieldMeta;
        if (!fm || typeof fm !== 'object') continue;
        if (fm.cellType !== 'field') continue;
        const fieldName = String(fm.fieldName ?? '');
        if (!fieldName) continue; // 明细表标记格等无字段名的格不列
        out.push({
          scope,
          row: Number(rowKey),
          col: Number(colKey),
          fieldId: String(fm.fieldId ?? ''),
          fieldName,
          fieldLabel: String(fm.fieldLabel || fm.label || fieldName),
          fieldAttr: fm.fieldAttr == null ? undefined : Number(fm.fieldAttr),
        });
      }
    }
  }
  out.sort((a, b) => a.row - b.row || a.col - b.col);
  return out;
};

export interface LayoutStructurePanelProps {
  /** 主表布局（ExcelDesign 的 layoutData） */
  mainLayout: any;
  /** 明细表子布局：序号 → 布局（ExcelDesign 的 detailLayouts） */
  detailLayouts: Record<number, any>;
  /** 本表单已定义的明细表序号（来自后端字段定义 detailtable>0） */
  detailIndexes: number[];
  /** 当前正在编辑的明细表序号（null=在主画布），用于高亮 */
  editingDetail?: number | null;
  /** 点击明细表节点 → 打开该明细表画布 */
  onOpenDetail?: (idx: number) => void;
  /** 修改字段属性（三态切换） */
  onAttrChange?: (f: StructField, attr: number) => void;
  /** 删除字段（还原初始状态） */
  onDeleteField?: (f: StructField) => void;
}

const LayoutStructurePanel: React.FC<LayoutStructurePanelProps> = ({
  mainLayout,
  detailLayouts,
  detailIndexes,
  editingDetail,
  onOpenDetail,
  onAttrChange,
  onDeleteField,
}) => {
  const { message } = App.useApp();

  const mainFields = useMemo(() => parseLayoutFields(mainLayout, 'main'), [mainLayout]);
  // 只列出「主画布里真有标记」或「后端已定义」的明细表，避免出现空壳分组
  const detailNodes = useMemo(
    () =>
      (detailIndexes || [])
        .slice()
        .sort((a, b) => a - b)
        .map((idx) => ({
          idx,
          fields: parseLayoutFields(detailLayouts?.[idx], `dt${idx}`),
        })),
    [detailIndexes, detailLayouts],
  );

  /** 字段行：名称 + 属性三态 + 删除 */
  const renderField = (f: StructField) => (
    <div
      key={`${f.scope}:${f.row}_${f.col}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 0 3px 8px',
        borderRadius: 4,
      }}
      title={`${f.fieldLabel}（${f.fieldName}）\n坐标：第 ${f.row + 1} 行 第 ${f.col + 1} 列`}
    >
      <UnorderedListOutlined style={{ color: '#bfbfbf', fontSize: 12 }} />
      <span style={{ flex: 1, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {f.fieldLabel}
      </span>
      <Segmented
        size="small"
        value={f.fieldAttr ?? 2}
        options={ATTR_OPTIONS}
        onChange={(v) => {
          const attr = Number(v);
          if (attr === (f.fieldAttr ?? 2)) return;
          onAttrChange?.(f, attr);
        }}
      />
      <Popconfirm
        title="删除该字段？"
        description="字段将从本表移除并还原为初始状态，可重新拖入。"
        okText="删除"
        cancelText="取消"
        onConfirm={() => onDeleteField?.(f)}
      >
        <Tooltip title="删除字段（还原初始状态）">
          <Button size="small" type="text" danger icon={<DeleteOutlined />} />
        </Tooltip>
      </Popconfirm>
    </div>
  );

  /** 分组节点（主表 / 明细表N）：图标 + 名称 + 字段计数 */
  const renderGroup = (
    title: string,
    icon: React.ReactNode,
    count: number,
    active: boolean,
    onClick?: () => void,
  ) => (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        marginTop: 10,
        padding: '4px 6px',
        borderRadius: 4,
        background: active ? '#e6f4ff' : '#fafafa',
        cursor: onClick ? 'pointer' : 'default',
        fontWeight: 500,
        fontSize: 13,
      }}
    >
      {icon}
      <span style={{ flex: 1 }}>{title}</span>
      <Tag style={{ marginInlineEnd: 0, fontSize: 11 }}>{count}</Tag>
    </div>
  );

  const total = mainFields.length + detailNodes.reduce((s, n) => s + n.fields.length, 0);

  return (
    <div>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>表单结构</div>
      <div style={{ fontSize: 11, color: '#999', marginBottom: 6 }}>
        主表 / 明细表 · 共 {total} 个字段
      </div>

      {total === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="尚未放置字段"
          style={{ margin: '12px 0' }}
        />
      ) : (
        <>
          {/* 主表 */}
          {renderGroup(
            '主表',
            <TableOutlined style={{ color: '#1677ff' }} />,
            mainFields.length,
            editingDetail == null,
          )}
          {mainFields.map(renderField)}

          {/* 明细表：缩进 + 可点击打开对应画布，清晰呈现父子层级 */}
          {detailNodes.map(({ idx, fields }) => (
            <div key={`dt${idx}`}>
              {renderGroup(
                `明细表${idx}`,
                <ApartmentOutlined style={{ color: '#13c2c2' }} />,
                fields.length,
                editingDetail === idx,
                () => {
                  if (editingDetail === idx) {
                    message.info(`当前正在「明细表${idx}」画布中`);
                  } else {
                    onOpenDetail?.(idx);
                  }
                },
              )}
              {fields.map(renderField)}
            </div>
          ))}
        </>
      )}

      <div style={{ marginTop: 12, fontSize: 11, color: '#999', lineHeight: 1.6 }}>
        · 属性三态：<b>只读 / 编辑 / 必填</b>，等价于字段的 fieldAttr（保存后随布局落库）
        <br />· 删除字段会一并清除属性底色，字段回到左侧面板可再次拖入
        <br />· 明细表节点可点击，直接进入该明细表画布
      </div>
    </div>
  );
};

export default LayoutStructurePanel;