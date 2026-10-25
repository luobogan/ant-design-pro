/**
 * 表单结构面板（主表 / 明细表 层级与关联关系）。
 *
 * <p>解决的问题（2026-10-10）：
 * ① 层级不清晰——原布局设计器里「主表 ↔ 明细表N」只靠一个蓝底标记格 + 子画布 Modal，
 * 界面上看不出某明细表属于主表、也看不出它包含哪些字段；
 * ② 字段属性状态不可见——只读/编辑/必填只能在「选中单元格 + 右键菜单 / 字段属性按钮」里
 * 逐格切换，无法一眼看全整张表的属性分布；
 * ③ 删除字段没有独立入口——只能靠清空单元格/删行删列，且删除后属性底色残留。
 *
 * <p>本面板以树形结构集中呈现：主表 → 字段、明细表N → 字段，字段行**只读展示**当前属性
 * （彩色标签醒目高亮，只读/编辑/必填，与画布 `fieldMeta.fieldAttr` 1/2/3 一致），
 * 并提供「删除字段」入口（删除后字段还原初始状态：清属性底色 + 回到左侧面板可再次拖入）。
 *
 * <p>属性修改权仍在画布（右键菜单 / 字段属性按钮）——三处入口最终都调用同一个
 * `setFieldAttr(row, col, attr)`，改完本面板会随 layoutData 回流同步刷新，
 * 因此这里的展示与画布实际状态始终一致。
 */
import React, { useMemo, useState } from 'react';
import { App, Button, Empty, Modal, Popconfirm, Space, Switch, Tag, Tooltip } from 'antd';
import {
  ApartmentOutlined,
  DeleteOutlined,
  SettingOutlined,
  TableOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { getModeFormGroup, saveModeFormGroup } from '@/services/formmode/modeFormGroupApi';

/**
 * 明细表组属性（**设计期开关**），取值 1允许 / 0禁止，与后端 ModeFormGroup 字段一致。
 *
 * ⚠️ 与「流程节点级明细权限」(blade-workflow 的 wf:detailTablePerm) 不是同一层：
 * 运行期最终可用 = 设计期开关 AND 节点权限。
 */
interface GroupFormState {
  isadd?: number;
  isedit?: number;
  isdelete?: number;
  iscopy?: number;
  isprintserial?: number;
  allowscroll?: number;
}

/**
 * 字段属性三态元数据（值与 layoutJson `fieldMeta.fieldAttr` 完全一致：1只读/2编辑/3必填）。
 * icon 与画布单元格显示保持一致（🔒 只读 / ⚠️ 必填），便于对照识别。
 */
const ATTR_META: Record<number, { label: string; color: string; icon: string }> = {
  1: { label: '只读', color: 'blue', icon: '🔒' },
  2: { label: '编辑', color: 'green', icon: '✏️' },
  3: { label: '必填', color: 'red', icon: '⚠️' },
};

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
  /** 删除字段（还原初始状态） */
  onDeleteField?: (f: StructField) => void;
  /**
   * 表单ID（明细表组属性的定位维度之一）。
   *
   * 设计器只有 formId（布局按表单归属），拿不到 modeId，故组属性按
   * 「formId + 明细表序号」读写；缺省时「明细表属性」按钮不可用（提示缺少表单ID）。
   */
  formId?: string | number;
}

const LayoutStructurePanel: React.FC<LayoutStructurePanelProps> = ({
  mainLayout,
  detailLayouts,
  detailIndexes,
  editingDetail,
  onOpenDetail,
  onDeleteField,
  formId,
}) => {
  const { message } = App.useApp();

  // ── 明细表组属性（设计期开关）弹窗 ──
  const [groupIdx, setGroupIdx] = useState<number | null>(null);
  const [groupForm, setGroupForm] = useState<GroupFormState>({});
  const [groupSaving, setGroupSaving] = useState(false);

  /** 打开某明细表的属性弹窗：按 formId + 序号加载（后端无配置时返回默认值，不落库） */
  const openGroupProps = async (idx: number) => {
    if (formId == null || formId === '') {
      message.warning('缺少表单ID，无法编辑明细表属性');
      return;
    }
    setGroupIdx(idx);
    try {
      const res: any = await getModeFormGroup(formId, idx);
      const d = res?.data || {};
      setGroupForm({
        isadd: d.isadd ?? 1,
        isedit: d.isedit ?? 1,
        isdelete: d.isdelete ?? 1,
        iscopy: d.iscopy ?? 1,
        isprintserial: d.isprintserial ?? 0,
        allowscroll: d.allowscroll ?? 0,
      });
    } catch (e) {
      // 接口异常时按默认值兜底，保证弹窗可用（与后端默认值一致：增删改复制允许，序号/滚动关闭）
      setGroupForm({
        isadd: 1,
        isedit: 1,
        isdelete: 1,
        iscopy: 1,
        isprintserial: 0,
        allowscroll: 0,
      });
    }
  };

  /** 保存组属性（后端按 formId + dsporder 做 upsert） */
  const saveGroupProps = async () => {
    if (formId == null || formId === '' || groupIdx == null) {
      return;
    }
    setGroupSaving(true);
    try {
      await saveModeFormGroup({
        formId,
        dsporder: groupIdx,
        grouptype: 2, // 2 = 明细表（后端固定）
        ...groupForm,
      });
      message.success('明细表属性已保存');
      setGroupIdx(null);
    } catch (e) {
      message.error('保存失败');
    } finally {
      setGroupSaving(false);
    }
  };

  const mainFields = useMemo(() => parseLayoutFields(mainLayout, 'main'), [mainLayout]);
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

  const allFields = useMemo(
    () => [...mainFields, ...detailNodes.flatMap((n) => n.fields)],
    [mainFields, detailNodes],
  );

  /** 属性分布总览：突出「有多少字段处在哪个状态」 */
  const attrStat = useMemo(() => {
    const s: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
    allFields.forEach((f) => {
      s[f.fieldAttr ?? 2] = (s[f.fieldAttr ?? 2] || 0) + 1;
    });
    return s;
  }, [allFields]);

  /** 字段行：名称 + 当前属性（醒目标签，只读展示）+ 删除 */
  const renderField = (f: StructField) => {
    const attr = f.fieldAttr ?? 2; // 缺省=初始状态「编辑」
    const meta = ATTR_META[attr] || ATTR_META[2];
    return (
      <div
        key={`${f.scope}:${f.row}_${f.col}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '3px 0 3px 8px',
          borderRadius: 4,
        }}
        title={`${f.fieldLabel}（${f.fieldName}）\n当前属性：${meta.label}\n坐标：第 ${f.row + 1} 行 第 ${f.col + 1} 列\n（在画布上右键该格可修改属性）`}
      >
        <UnorderedListOutlined style={{ color: '#bfbfbf', fontSize: 12 }} />
        <span
          style={{
            flex: 1,
            fontSize: 12,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {f.fieldLabel}
        </span>
        {/* 当前属性：彩色+加粗+图标，醒目高亮所选状态 */}
        <Tag
          color={meta.color}
          style={{ marginInlineEnd: 0, fontWeight: 600, fontSize: 11 }}
          icon={<span aria-hidden>{meta.icon}</span>}
        >
          {meta.label}
        </Tag>
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
  };

  /** 分组节点（主表 / 明细表N）：图标 + 名称 + 字段计数 */
  const renderGroup = (
    title: string,
    icon: React.ReactNode,
    count: number,
    active: boolean,
    onClick?: () => void,
    /** 节点右侧额外操作区（如明细表的「属性」按钮） */
    extra?: React.ReactNode,
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
      {extra}
    </div>
  );

  return (
    <div>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>表单结构</div>
      <div style={{ fontSize: 11, color: '#999', marginBottom: 6 }}>
        主表 / 明细表 · 共 {allFields.length} 个字段
      </div>

      {/* 属性分布总览：一眼看清哪些字段是只读 / 编辑 / 必填 */}
      {allFields.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {(
            [
              [1, '只读'],
              [2, '编辑'],
              [3, '必填'],
            ] as [number, string][]
          ).map(([k, label]) => (
            <Tag
              key={k}
              color={ATTR_META[k].color}
              style={{ marginInlineEnd: 0, fontWeight: 600 }}
            >
              {ATTR_META[k].icon} {label} {attrStat[k] || 0}
            </Tag>
          ))}
        </div>
      )}

      {allFields.length === 0 ? (
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
                // 明细表「设计期属性」入口（对齐 ecology modeformgroup）
                <Tooltip title="明细表属性（可新增/编辑/删除/复制、打印序号、横向滚动）">
                  <Button
                    type="text"
                    size="small"
                    icon={<SettingOutlined />}
                    onClick={(e) => {
                      e.stopPropagation(); // 避免触发外层「进入该明细表画布」
                      openGroupProps(idx);
                    }}
                  />
                </Tooltip>,
              )}
              {fields.map(renderField)}
            </div>
          ))}
        </>
      )}

      <div style={{ marginTop: 12, fontSize: 11, color: '#999', lineHeight: 1.6 }}>
        · 字段属性（只读 / 编辑 / 必填）在画布上<b>右键该单元格</b>或用<b>字段属性</b>按钮设置，
        设完这里与画布同步刷新
        <br />· 删除字段会一并清除属性底色，字段回到左侧面板可再次拖入
        <br />· 点击「明细表N」节点可直接进入该明细表画布
        <br />· 点明细表右侧「⚙」可设置该明细表的<b>设计期属性</b>
      </div>

      {/* 明细表组属性弹窗（设计期开关，对齐 ecology modeformgroup） */}
      <Modal
        title={groupIdx != null ? `明细表${groupIdx} 属性` : '明细表属性'}
        open={groupIdx != null}
        onCancel={() => setGroupIdx(null)}
        onOk={saveGroupProps}
        confirmLoading={groupSaving}
        okText="保存"
        cancelText="取消"
        destroyOnHidden
      >
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          {(
            [
              ['isadd', '允许新增行'],
              ['isedit', '允许编辑行'],
              ['isdelete', '允许删除行'],
              ['iscopy', '允许复制行'],
              ['isprintserial', '打印显示序号'],
              ['allowscroll', '允许横向滚动'],
            ] as [keyof GroupFormState, string][]
          ).map(([key, label]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ flex: 1, fontSize: 13 }}>{label}</span>
              <Switch
                checked={(groupForm[key] ?? 0) === 1}
                onChange={(checked) => setGroupForm({ ...groupForm, [key]: checked ? 1 : 0 })}
              />
            </div>
          ))}
        </Space>
        <div style={{ marginTop: 12, fontSize: 11, color: '#999', lineHeight: 1.6 }}>
          说明：以上为<b>设计期开关</b>；运行期还会与「流程节点级明细权限」叠加，
          <b>两者都允许</b>时对应操作才可用。
        </div>
      </Modal>
    </div>
  );
};

export default LayoutStructurePanel;
