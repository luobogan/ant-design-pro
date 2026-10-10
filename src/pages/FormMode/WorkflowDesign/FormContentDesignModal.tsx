import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Switch,
  Tabs,
  Tooltip,
  Typography,
  message,
} from 'antd';
import { PlusOutlined, QuestionCircleOutlined, SearchOutlined } from '@ant-design/icons';
import { WfProcessNode, DetailFilterItem, saveBpmn } from '@/services/workflow';
import { getActiveModeler } from './bpmnModelerHolder';
import { getWfNodeExt, setWfNodeExt, WfDetailFilter, WfDetailTablePerm } from './bpmnExtension';
import { getFormLayout, saveFormLayout } from '@/services/formmode/formLayoutApi';
import {
  FORM_CONTENT_OPTIONS,
  OPINION_TYPE_OPTIONS,
  PRINT_FLOW_COMMENTS,
  PRINT_REMARK_COLUMNS,
  PRINT_SHOW_TYPES,
  PRINT_VIEW_TYPE_OLD,
} from './wfDict';

/**
 * 「表单内容 → 设计」弹框
 *
 * 结构对齐 ecology「设置表单内容」弹框
 * （`pc4backstage/workflow/components/pathSet/nodeSet/formContent/FormContentModal.js` + `ShowTemplate.js`）：
 *   标题「设置表单内容:{节点名}」→ 页签「显示模板 / 打印模板」→ 显示模板页签内为分区：
 *   基本设置（显示模式）/ 显示模板设置（显示模板 + 初始化·设置字段属性·预览 + 表单页边距自定义设置 + 同步节点）/
 *   移动模板设置 / 明细表数据根据操作者筛选显示 → 底部「保存」。
 *
 * 落库位置：`wf_process_node.ext_json.settings.formContent`（沿用既有 schema，不新增后端字段）：
 * {@code
 *   formContent: {
 *     mode,                       // normal(已屏蔽) | custom 节点布局
 *     margin:  { custom, type, top, bottom, left, right },   // 表单页边距自定义设置
 *     mobile:  { templateName, nodeKeys },                   // 移动模板 + 其同步节点
 *     detailFilter: { enabled, rules? },                     // 明细表根据操作者筛选
 *     printSet: {                                           // ★打印内容设置（运行期已消费，见 FormRenderVO.printSet）
 *       flowComment,      // 0 始终不打印 / 1 放入模板时不打印(默认) / 2 始终打印
 *       showType,         // 0 只显示最后一次(默认) / 1 显示全部
 *       remarkColumn,     // 打印意见分栏 1(默认)/2/3
 *       stNull,           // 打印不显示空意见
 *       viewTypes,        // ['oldvalue']=沿用显示模板；或意见类型键列表（approve/reject/...）
 *     },
 *     syncNodeKeys,                                          // 显示模板的「同步节点」目标
 *   }
 * }
 *
 * ⚠️ 说明：「打印内容设置」(printSet) 已接入运行期——由 `WFNodeSettingsUtil.printSet()` 读取，
 *    随 `GET /form/render` 与 `GET /form/preview` 的渲染包下发（FormRenderVO.printSet）。
 *    页边距 / 移动模板 / 明细过滤仍为**持久化配置**（存得住、改得了），渲染端接入见后续批次。
 */
export interface FormContentDesignModalProps {
  open: boolean;
  defId: any;
  node?: WfProcessNode;
  /** 全量节点（「同步节点」选择目标用，排除自身） */
  nodes?: WfProcessNode[];
  formId?: string;
  formName?: string;
  onClose: () => void;
  onPatch?: (nodeKey: string, patch: Partial<WfProcessNode>) => void;
  /** 显示模板 / 初始化：打开现有布局设计器 */
  onEditLayout?: (nodeKey: string) => void;
  /** 设置字段属性：跳到「节点信息 → 字段权限」 */
  onOpenFieldPerm?: (nodeKey: string) => void;
  /** 节点意见：跳到「节点信息 → 节点设置」（复用既有签字意见设置） */
  onOpenNodeSetting?: (nodeKey: string) => void;
  /** 预览：未提供时按钮置灰 */
  onPreview?: (nodeKey: string) => void;
  /** 批量同步完成后的刷新（同步会改其它节点的 extJson） */
  onSynced?: () => void;
}

const NOT_YET = '运行期渲染尚未接入（当前仅持久化配置）';
const MARGIN_TYPES = [
  { value: 0, label: '自定义' },
  { value: 1, label: '继承表单默认' },
];

/** 路线 B：优先取 BPMN `wf:node` 扩展里的 extJson，回退节点行上的值 */
const extJsonOf = (nodeKey?: string, node?: WfProcessNode | null): string | undefined => {
  const modeler = getActiveModeler();
  const element = nodeKey ? modeler?.get('elementRegistry')?.get(nodeKey) : undefined;
  return element ? getWfNodeExt(element)?.extJson : node?.extJson;
};

/** 路线 B：把 extJson 写进目标节点的 BPMN `wf:node` 扩展（画布自动保存落库）；
 * detailFilter / detailTablePerm 传入时一并写对应 `wf:*` 元素（F-T6：明细筛选 / 明细整表权限运行期权威源） */
const writeExtJson = (
  nodeKey: string,
  extJson: string,
  detailFilter?: WfDetailFilter[],
  detailTablePerm?: WfDetailTablePerm[],
): boolean => {
  const modeler = getActiveModeler();
  const element = modeler?.get('elementRegistry')?.get(nodeKey);
  if (!element) return false;
  const ext = getWfNodeExt(element) || {};
  setWfNodeExt(modeler, element, {
    ...ext,
    extJson,
    ...(detailFilter ? { detailFilter } : {}),
    ...(detailTablePerm ? { detailTablePerm } : {}),
  });
  return true;
};

/** wf:detailFilter modeType 口径：1=显示模板 2=打印模板（对齐后端 wf_node_detail_filter.mode_type） */
const MODE_SHOW = '1';
const MODE_PRINT = '2';

/** DetailFilterItem[]（UI 口径，number）→ wf:detailFilter 扩展行（schema 口径，string） */
const toExtFilters = (items: DetailFilterItem[] | undefined, modeType: string): WfDetailFilter[] =>
  (items || []).map((d) => ({
    dtIndex: String(d.dtIndex ?? 1),
    modeType,
    fieldName: d.fieldName || '',
    compareType: String(d.compareType ?? 1),
    compareValue: d.compareValue,
    isRequired: d.isRequired == null ? undefined : String(d.isRequired),
  }));

/** BPMN wf:detailFilter → DetailFilterItem[]（number 化；modeType 过滤） */
const readDetailFilter = (nodeKey?: string, modeType?: string): DetailFilterItem[] => {
  const modeler = getActiveModeler();
  const element = nodeKey ? modeler?.get('elementRegistry')?.get(nodeKey) : undefined;
  if (!element) return [];
  return (getWfNodeExt(element)?.detailFilter || [])
    .filter((d) => (modeType ? d.modeType === modeType : true))
    .map((d) => ({
      dtIndex: parseInt(d.dtIndex ?? '1', 10) || 1,
      fieldName: d.fieldName || '',
      compareType: parseInt(d.compareType ?? '1', 10) || 1,
      compareValue: d.compareValue,
      isRequired: d.isRequired == null ? undefined : parseInt(d.isRequired, 10),
    }));
};

/** BPMN wf:detailTablePerm → WfDetailTablePerm[]（F-T6③：节点级明细表整表权限，按 dtIndex） */
const readDetailTablePerm = (nodeKey?: string): WfDetailTablePerm[] => {
  const modeler = getActiveModeler();
  const element = nodeKey ? modeler?.get('elementRegistry')?.get(nodeKey) : undefined;
  if (!element) return [];
  const ext = getWfNodeExt(element);
  // 优先取 BPMN 扩展 wf:detailTablePerm
  if (ext?.detailTablePerm && ext.detailTablePerm.length) return ext.detailTablePerm;
  // 旧数据回退：曾存于 extJson formContent.detailTablePerm（保证升级无感）
  try {
    const parsed = ext?.extJson ? JSON.parse(ext.extJson) : {};
    const legacy = parsed?.settings?.formContent?.detailTablePerm;
    if (Array.isArray(legacy) && legacy.length) return legacy;
  } catch {
    /* 坏数据按空处理 */
  }
  return [];
};

/** 取节点 ext_json.settings（坏数据按空处理） */
const readSettings = (node?: WfProcessNode): Record<string, any> => {
  try {
    const parsed = node?.extJson ? JSON.parse(node.extJson) : {};
    return parsed?.settings && typeof parsed.settings === 'object' ? parsed.settings : {};
  } catch {
    return {};
  }
};

const modeLabel = (mode?: string) =>
  FORM_CONTENT_OPTIONS.find((o) => o.value === mode)?.label || (mode ? String(mode) : '未设置');

/** E9 形态的「浏览框」：只读输入框 + 放大镜；右侧可挂 + 按钮 */
const BrowserBox: React.FC<{
  value?: string;
  placeholder?: string;
  disabled?: boolean;
  width?: number;
  onClick?: () => void;
  onAdd?: () => void;
  addTooltip?: string;
}> = ({ value, placeholder, disabled, width = 320, onClick, onAdd, addTooltip }) => (
  <Space size={0}>
    <Input
      readOnly
      disabled={disabled}
      value={value}
      placeholder={placeholder}
      onClick={onClick}
      style={{ width, cursor: disabled ? 'not-allowed' : 'pointer' }}
      suffix={
        <SearchOutlined
          style={{ color: disabled ? '#bfbfbf' : '#1677ff', cursor: disabled ? 'not-allowed' : 'pointer' }}
          onClick={onClick}
        />
      }
    />
    <Tooltip title={addTooltip}>
      <Button icon={<PlusOutlined />} disabled={disabled} onClick={onAdd} style={{ marginLeft: -1 }} />
    </Tooltip>
  </Space>
);

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ display: 'flex', alignItems: 'center', margin: '10px 0', paddingLeft: 32 }}>
    <div style={{ width: 150, color: '#333' }}>{label}：</div>
    <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
  </div>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div
    style={{
      background: '#fafafa',
      border: '1px solid #f0f0f0',
      borderRadius: 4,
      padding: '4px 16px 12px',
      marginBottom: 12,
    }}
  >
    <Typography.Text strong style={{ display: 'block', padding: '8px 0 4px' }}>
      {title}
    </Typography.Text>
    {children}
  </div>
);

const DETAIL_COMPARE_TYPES = [
  { value: 1, label: '等于' },
  { value: 2, label: '不等于' },
  { value: 3, label: '包含' },
  { value: 4, label: '不包含' },
];

/** 明细表字段筛选规则编辑器（对齐 ecology「明细表数据根据操作者筛选显示」） */
const DetailFilterEditor: React.FC<{
  title: string;
  value: DetailFilterItem[];
  onChange: (v: DetailFilterItem[]) => void;
}> = ({ title, value, onChange }) => {
  const update = (i: number, patch: Partial<DetailFilterItem>) =>
    onChange(value.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const add = () =>
    onChange([
      ...value,
      { dtIndex: 0, fieldName: '', compareType: 1, compareValue: '', isRequired: 0 },
    ]);
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  return (
    <Section title={title}>
      <div style={{ marginBottom: 8, color: '#888', fontSize: 12 }}>
        多条规则间为「且」关系：仅当明细行满足全部规则时才对该操作者显示 / 打印出来。
      </div>
      {value.map((r, i) => (
        <div
          key={i}
          style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '6px 0', flexWrap: 'wrap' }}
        >
          <span style={{ color: '#666' }}>明细表 dt</span>
          <InputNumber
            size="small"
            min={0}
            style={{ width: 70 }}
            value={r.dtIndex}
            onChange={(v) => update(i, { dtIndex: v ?? 0 })}
          />
          <span style={{ color: '#666' }}>字段</span>
          <Input
            size="small"
            style={{ width: 150 }}
            placeholder="字段名 fieldName"
            value={r.fieldName}
            onChange={(e) => update(i, { fieldName: e.target.value })}
          />
          <Select
            size="small"
            style={{ width: 90 }}
            value={r.compareType}
            options={DETAIL_COMPARE_TYPES}
            onChange={(v) => update(i, { compareType: v })}
          />
          <Input
            size="small"
            style={{ width: 170 }}
            placeholder="比较值（多值逗号分隔）"
            value={r.compareValue}
            onChange={(e) => update(i, { compareValue: e.target.value })}
          />
          <Tooltip title="过滤后要求该明细表至少保留一条">
            <Switch
              size="small"
              checked={!!r.isRequired}
              onChange={(v) => update(i, { isRequired: v ? 1 : 0 })}
            />
          </Tooltip>
          <Button size="small" danger onClick={() => remove(i)}>
            删除
          </Button>
        </div>
      ))}
      <Button size="small" icon={<PlusOutlined />} onClick={add}>
        添加筛选规则
      </Button>
    </Section>
  );
};

/** 明细表整表权限布尔字段元数据（F-T6③：节点级明细表 增/删/改/必填/隐藏空表/打印序号/滚动/分页） */
const DT_PERM_FIELDS: { key: keyof WfDetailTablePerm; label: string }[] = [
  { key: 'canAdd', label: '可新增' },
  { key: 'canEdit', label: '可编辑' },
  { key: 'canDelete', label: '可删除' },
  { key: 'hideEmpty', label: '隐藏空表' },
  { key: 'required', label: '必填' },
  { key: 'printSerial', label: '打印序号' },
  { key: 'allowScroll', label: '允许滚动' },
  { key: 'openPaging', label: '分页' },
];

/** 明细表整表权限编辑器（对齐 ecology「明细表权限设置」：按 dtIndex 控制整表行为，作用于节点操作者） */
const DetailTablePermEditor: React.FC<{
  title: string;
  value: WfDetailTablePerm[];
  onChange: (v: WfDetailTablePerm[]) => void;
}> = ({ title, value, onChange }) => {
  const update = (i: number, patch: Partial<WfDetailTablePerm>) =>
    onChange(value.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const toggle = (i: number, key: keyof WfDetailTablePerm, v: boolean) =>
    update(i, { [key]: v ? '1' : '0' } as Partial<WfDetailTablePerm>);
  const add = () =>
    onChange([
      ...value,
      { dtIndex: String((value.length || 0) + 1), canAdd: '1', canEdit: '1', canDelete: '1' },
    ]);
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  return (
    <Section title={title}>
      <div style={{ marginBottom: 8, color: '#888', fontSize: 12 }}>
        按明细表序号（dtIndex，1 起）分别设置该节点操作者对此明细表的整表行为；留空 / 不配置即沿用表单默认。
      </div>
      {value.map((r, i) => (
        <div
          key={i}
          style={{ border: '1px solid #f0f0f0', borderRadius: 4, padding: 8, margin: '6px 0' }}
        >
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ color: '#666' }}>明细表 dt</span>
            <InputNumber
              size="small"
              min={1}
              style={{ width: 64 }}
              value={parseInt(r.dtIndex ?? '1', 10) || 1}
              onChange={(v) => update(i, { dtIndex: String(v ?? 1) })}
            />
            <span style={{ color: '#666' }}>默认行数</span>
            <InputNumber
              size="small"
              min={0}
              style={{ width: 72 }}
              value={r.defaultRows == null ? undefined : parseInt(r.defaultRows, 10)}
              onChange={(v) => update(i, { defaultRows: v == null ? undefined : String(v) })}
            />
            <Button size="small" danger onClick={() => remove(i)}>
              删除
            </Button>
          </div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 8 }}>
            {DT_PERM_FIELDS.map((f) => (
              <span key={f.key as string} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Switch
                  size="small"
                  checked={r[f.key] === '1'}
                  onChange={(v) => toggle(i, f.key, v)}
                />
                <span style={{ fontSize: 12, color: '#666' }}>{f.label}</span>
              </span>
            ))}
          </div>
        </div>
      ))}
      <Button size="small" icon={<PlusOutlined />} onClick={add}>
        添加明细表权限
      </Button>
    </Section>
  );
};

const FormContentDesignModal: React.FC<FormContentDesignModalProps> = ({
  open,
  defId,
  node,
  nodes,
  formId,
  formName,
  onClose,
  onPatch,
  onEditLayout,
  onOpenFieldPerm,
  onOpenNodeSetting,
  onPreview,
  onSynced,
}) => {
  const nodeKey = node?.nodeKey;
  const canLayout = !!nodeKey && !!formId;

  // 整份 formContent 直接作为受控状态，保存时统一写回
  const [fc, setFc] = useState<Record<string, any>>({});
  // F-T6③：节点级明细表整表权限（独立于 formContent，存于 wf:detailTablePerm）
  const [dtPerm, setDtPerm] = useState<WfDetailTablePerm[]>([]);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [tab, setTab] = useState('show');

  useEffect(() => {
    if (open) {
      const s = readSettings({ ...node, extJson: extJsonOf(nodeKey, node) });
      setFc({ ...(s.formContent || {}) });
      setDtPerm(readDetailTablePerm(nodeKey));
      setTab('show');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, nodeKey]);

  const patch = (p: Record<string, any>) => setFc((prev) => ({ ...prev, ...p }));

  const otherNodes = useMemo(
    () => (nodes || []).filter((n) => n.nodeKey && n.nodeKey !== nodeKey),
    [nodes, nodeKey],
  );
  const nodeOptions = otherNodes.map((n) => ({
    value: n.nodeKey!,
    label: n.nodeName || n.nodeKey!,
  }));

  const margin = fc.margin || {};
  const mobile = fc.mobile || {};
  // 打印内容设置（对齐 ecology printflowcomment / printviewtype / printremarkcolumn / printstnull / printshowtype）
  const pSet = fc.printSet || {};
  // 明细表字段筛选：F-T6 接线后以 BPMN wf:detailFilter 为权威（fc.detailFilterSynced 标记
  // 已迁移过）；旧数据（标记缺失）回退 extJson 既有键，保证升级无感
  const detailFilterShow: DetailFilterItem[] =
    fc.detailFilterSynced === true
      ? readDetailFilter(nodeKey, MODE_SHOW)
      : Array.isArray(fc.detailFilterShow)
        ? fc.detailFilterShow
        : [];
  const detailFilterPrint: DetailFilterItem[] =
    fc.detailFilterSynced === true
      ? readDetailFilter(nodeKey, MODE_PRINT)
      : Array.isArray(fc.detailFilterPrint)
        ? fc.detailFilterPrint
        : [];
  // 签字意见显示设置（屏显口径）
  const od = fc.opinionDisplay || {};

  const design = () => {
    if (canLayout) onEditLayout?.(nodeKey!);
  };

  /** 保存本节点 */
  const save = async () => {
    if (!defId || !nodeKey) return;
    // F-T6：明细筛选双写——extJson 兜底 + wf:detailFilter 元素为运行期权威源（detail-filter-from-bpmn）
    //
    // 【联动】保存表单内容即视为「已采用节点布局」，把 mode 收敛为 custom：
    //   · 「设计布局」与「表单内容=节点布局」原本是两个独立动作，用户常只做前者，
    //     导致 formContent.mode 一直缺失 → 流程测试/模拟运行预校验判「未设置表单内容」失败，
    //     且「节点信息」列表里下拉框一直显示「未设置」，看起来像布局没生效（其实布局已存 form_layout）。
    //   · 「普通模式(normal)」早已屏蔽（选项 disabled、运行期不消费），保留它只会让预校验恒失败，
    //     故此处一并归一为 custom；下拉框仍保留，便于用户查看/手动切换。
    const nextFc = { ...fc, detailFilterSynced: true, mode: 'custom' as const };
    const filters = [...toExtFilters(nextFc.detailFilterShow, MODE_SHOW), ...toExtFilters(nextFc.detailFilterPrint, MODE_PRINT)];
    const settings = readSettings({ ...node, extJson: extJsonOf(nodeKey, node) });
    const extJson = JSON.stringify({ settings: { ...settings, formContent: nextFc } });
    setSaving(true);
    try {
      // F-T6③：wf:detailTablePerm 一并写入（与 detailFilter 同属节点级运行期权威源）
      if (!writeExtJson(nodeKey, extJson, filters, dtPerm)) {
        message.error('画布未就绪，无法保存');
        return;
      }
      // (a) 显式落库：把画布内存（含刚写入的 extJson）序列化写回 wf_process_definition 草稿，
      // 否则仅 onPatch 更新本地 state，关掉/刷新后改动丢失，表现为「改了没生效」。
      // 不依赖 BpmnDesigner 的 700ms 自动保存（弹窗关闭竞态/时序不可靠）。
      const modeler = getActiveModeler();
      if (modeler && defId != null) {
        try {
          const { xml } = await modeler.saveXML({ format: true });
          // ⚠️ defId 是雪花 ID（>2^53），必须原样传，禁止 Number()——否则被double 舍入成不存在的 ID
          const r: any = await saveBpmn(defId, xml);
          if (r && r.success === false) {
            message.warning('已写入画布，但落库返回：' + (r.msg || r.message || '未知'));
          }
        } catch (se) {
          message.warning('已写入画布，但落库失败：' + ((se as any)?.message || se));
        }
      }
      onPatch?.(nodeKey, { extJson });
      message.success('表单内容已保存（已写入 BPMN 并落库）');
      onClose();
    } catch {
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  /**
   * 同步节点。
   *
   * @param targetKeys 目标节点
   * @param label      触发分组（提示文案用）
   * @param withLayout 是否连同**节点布局本体**一起同步（「显示模板设置」专用）。
   *
   * <p>⚠️ 只同步 formContent 是"看不见效果"的：formContent（显示模式/页边距/明细过滤）目前仅持久化配置，
   * 运行期不消费；要让目标节点真正**用上本节点的布局**，必须把 form_layout 里本节点那一份
   * 复制成目标节点自己的行（后端 save 按 formId+layoutType+nodeKey upsert）。</p>
   */
  const syncTo = async (targetKeys: string[], label: string, withLayout = false) => {
    if (!defId || !targetKeys.length) {
      message.warning('请先选择要同步的节点');
      return;
    }
    setSyncing(true);
    try {
      // ① 取本节点的「节点布局」（inherit=false：只认该节点自己的布局，没配过则为空）
      let layout: any = null;
      if (withLayout && formId && nodeKey) {
        try {
          const lr: any = await getFormLayout(String(formId), undefined, nodeKey, false);
          layout = lr?.data || null;
        } catch {
          layout = null;
        }
        if (!layout?.layoutJson) {
          message.warning('本节点还没有自己的节点布局：请先在「显示模板」里进布局设计器保存，本次仅同步配置');
        }
      }

      let layoutOk = 0;
      let cfgOk = 0;
      for (const key of targetKeys) {
        const target = (nodes || []).find((n) => n.nodeKey === key);
        if (!target) continue;

        // ② 复制布局到目标节点：让目标节点拥有与本节点一致的节点级布局 → 表单渲染/设计器都能取到
        if (layout?.layoutJson) {
          try {
            const sr: any = await saveFormLayout({
              formId: String(formId),
              layoutName: `表单${formId}_节点${key}的布局`,
              layoutJson: layout.layoutJson,
              layoutConfig: layout.layoutConfig,
              layoutType: layout.layoutType ?? 0,
              status: 1,
              nodeKey: String(key),
            });
            // 后端 R.fail 同样返回 HTTP 200，必须判 code
            const code = sr?.code;
            if (
              sr?.success !== false &&
              (code === undefined || code === null || Number(code) === 200 || Number(code) === 0)
            ) {
              layoutOk++;
            }
          } catch {
            /* 单个失败不阻断其余 */
          }
        }

        // ③ formContent 配置（显示模式 / 页边距 / 明细过滤等）一并同步
        // 路线 B：目标节点的 settings 也优先读 BPMN 扩展，避免覆盖画布上已有的配置
        const settings = readSettings({ ...target, extJson: extJsonOf(key, target) });
        // 同步过去时清掉各自的「同步目标」自身，避免互相指向；明细筛选随 wf:detailFilter 一并同步
        // 【联动】同 save()：同步（含节点布局本体）意味着目标节点也采用节点布局，故 mode 一并归一为 custom，
        //   否则目标节点会因 formContent.mode 缺失被预校验判「未设置表单内容」。
        const next = {
          ...fc,
          detailFilterSynced: true,
          mode: 'custom' as const,
          syncNodeKeys: undefined,
          mobile: { ...(fc.mobile || {}), nodeKeys: undefined },
        };
        const extJson = JSON.stringify({ settings: { ...settings, formContent: next } });
        const syncFilters = [
          ...toExtFilters(next.detailFilterShow, MODE_SHOW),
          ...toExtFilters(next.detailFilterPrint, MODE_PRINT),
        ];
        try {
          // F-T6③：明细整表权限随节点一并同步（wf:detailTablePerm）
          if (writeExtJson(key, extJson, syncFilters, dtPerm)) cfgOk++;
        } catch {
          /* 单个失败不阻断其余 */
        }
      }

      if (layout?.layoutJson) {
        message.success(`已同步${label}（含节点布局）到 ${layoutOk}/${targetKeys.length} 个节点`);
      } else {
        message.success(`已同步${label}配置到 ${cfgOk}/${targetKeys.length} 个节点`);
      }
      // (a) 落库：同步可能改写多个目标节点的 BPMN 扩展，统一序列化一次写回草稿
      const modeler = getActiveModeler();
      if (modeler && defId != null) {
        try {
          const { xml } = await modeler.saveXML({ format: true });
          // ⚠️ 同上：defId 原样传，禁止 Number()
          await saveBpmn(defId, xml);
        } catch {
          /* 落库失败不阻断同步结果提示 */
        }
      }
      onSynced?.();
    } finally {
      setSyncing(false);
    }
  };

  const showTemplate = (
    <>
      <Section title="基本设置">
        <Row label="显示模式">
          <Select
            style={{ width: 360 }}
            value={fc.mode}
            placeholder="未设置"
            options={FORM_CONTENT_OPTIONS}
            onChange={(v) => patch({ mode: v })}
          />
          <span style={{ marginLeft: 12, color: '#999', fontSize: 12 }}>
            「普通模式」已屏蔽，请选择「节点布局」
          </span>
        </Row>
      </Section>

      <Section title="显示模板设置">
        <Row label="显示模板">
          <Space size={8} wrap>
            <BrowserBox
              value={modeLabel(fc.mode)}
              placeholder="未设置"
              disabled={!canLayout}
              onClick={design}
              onAdd={design}
              addTooltip={canLayout ? '进入节点布局设计器（初始化）' : '请先绑定表单'}
            />
            <a onClick={design} style={{ color: canLayout ? '#1677ff' : '#bfbfbf' }}>
              初始化
            </a>
            {/* 「设置字段属性」入口已下线（2026-10-10）：字段权限唯一入口收敛到布局设计器，
                布局保存自动联动 BPMN 字段权限；原跳转目标（节点详情 perm 页签）已隐藏 */}
            <span style={{ color: '#bfbfbf', fontSize: 12 }}>字段属性在布局中设置</span>
            <Tooltip title={onPreview ? '' : NOT_YET}>
              <a
                onClick={() => onPreview && nodeKey && onPreview(nodeKey)}
                style={{ color: onPreview ? '#1677ff' : '#bfbfbf' }}
              >
                预览
              </a>
            </Tooltip>
          </Space>
        </Row>

        <Row label="表单页边距自定义设置">
          <Space size={8}>
            <Switch
              size="small"
              checked={!!margin.custom}
              onChange={(v) => patch({ margin: { ...margin, custom: v, type: v ? margin.type ?? 0 : 1 } })}
            />
            <Tooltip title="不启用，则采用流程表单默认页边距设置。">
              <QuestionCircleOutlined style={{ color: '#faad14' }} />
            </Tooltip>
          </Space>
        </Row>
        {margin.custom && (
          <>
            <Row label="模式选择">
              <Select
                style={{ width: 200 }}
                value={margin.type ?? 0}
                options={MARGIN_TYPES}
                onChange={(v) => patch({ margin: { ...margin, type: v } })}
              />
            </Row>
            <Row label="页边距(px)">
              <Space size={8} wrap>
                {(['top', 'bottom', 'left', 'right'] as const).map((k, i) => (
                  <span key={k}>
                    <span style={{ color: '#888', marginRight: 4 }}>
                      {['上', '下', '左', '右'][i]}
                    </span>
                    <InputNumber
                      size="small"
                      min={0}
                      style={{ width: 80 }}
                      value={margin[k] ?? 0}
                      onChange={(v) => patch({ margin: { ...margin, [k]: v ?? 0 } })}
                    />
                  </span>
                ))}
                <Tooltip title={NOT_YET}>
                  <QuestionCircleOutlined style={{ color: '#faad14' }} />
                </Tooltip>
              </Space>
            </Row>
          </>
        )}

        <Row label="同步节点">
          <Space size={8} wrap>
            <Select
              mode="multiple"
              allowClear
              style={{ width: 320 }}
              placeholder="选择要同步到的节点"
              value={fc.syncNodeKeys || []}
              options={nodeOptions}
              onChange={(v) => patch({ syncNodeKeys: v })}
            />
            <Button
              size="small"
              loading={syncing}
              disabled={!(fc.syncNodeKeys || []).length}
              onClick={() => syncTo(fc.syncNodeKeys || [], '显示模板设置', true)}
            >
              同步
            </Button>
            <Tooltip title="把本节点的「节点布局」复制到所选节点（目标节点即使用同一份布局），并一并同步「显示模式 / 页边距 / 明细过滤」设置。">
              <QuestionCircleOutlined style={{ color: '#faad14' }} />
            </Tooltip>
          </Space>
        </Row>
      </Section>

      <Section title="移动模板设置">
        <Row label="移动模板">
          <Space size={8}>
            <BrowserBox
              value={mobile.templateName}
              placeholder="未设置"
              disabled={!canLayout}
              onClick={design}
              onAdd={design}
              addTooltip={canLayout ? '进入节点布局设计器（移动端渲染尚未接入）' : '请先绑定表单'}
            />
            <Tooltip title={NOT_YET}>
              <Button size="small" onClick={() => patch({ mobile: { ...mobile, templateName: modeLabel(fc.mode) } })}>
                初始化
              </Button>
            </Tooltip>
          </Space>
        </Row>
        <Row label="同步节点">
          <Space size={8} wrap>
            <Select
              mode="multiple"
              allowClear
              style={{ width: 320 }}
              placeholder="选择要同步到的节点"
              value={mobile.nodeKeys || []}
              options={nodeOptions}
              onChange={(v) => patch({ mobile: { ...mobile, nodeKeys: v } })}
            />
            <Button
              size="small"
              loading={syncing}
              disabled={!(mobile.nodeKeys || []).length}
              onClick={() => syncTo(mobile.nodeKeys || [], '移动模板设置')}
            >
              同步
            </Button>
          </Space>
        </Row>
      </Section>

      <DetailFilterEditor
        title="明细表数据根据操作者筛选显示"
        value={detailFilterShow}
        onChange={(v) => patch({ detailFilterShow: v })}
      />

      <DetailTablePermEditor
        title="明细表整表权限（按操作者，F-T6③）"
        value={dtPerm}
        onChange={setDtPerm}
      />

      <Section title="节点意见">
        <Row label="签字意见设置">
          <Space size={8}>
            <span style={{ color: '#888', fontSize: 12 }}>
              复用「节点设置 → 签字意见设置」（是否必填 / 默认模板）
            </span>
            <a
              onClick={() => nodeKey && onOpenNodeSetting?.(nodeKey)}
              style={{ color: nodeKey ? '#1677ff' : '#bfbfbf' }}
            >
              去设置
            </a>
          </Space>
        </Row>
        <Row label="显示全部意见">
          {/* 未配置 = 显示全部（与后端默认一致）；只有显式关过才是「仅显示最后一次」 */}
          <Switch
            size="small"
            checked={od.viewTypeAll === undefined || od.viewTypeAll === null ? true : !!od.viewTypeAll}
            onChange={(v) => patch({ opinionDisplay: { ...od, viewTypeAll: v ? 1 : 0 } })}
          />
          <span style={{ marginLeft: 8, color: '#999', fontSize: 12 }}>
            关闭则仅显示最后一次签字意见
          </span>
        </Row>
        <Row label="意见分栏">
          <Select
            style={{ width: 200 }}
            value={od.remarkColumn ?? 1}
            options={PRINT_REMARK_COLUMNS}
            onChange={(v) => patch({ opinionDisplay: { ...od, remarkColumn: v } })}
          />
        </Row>
        <Row label="不显示空意见">
          <Switch
            size="small"
            checked={!!od.stNull}
            onChange={(v) => patch({ opinionDisplay: { ...od, stNull: v ? 1 : 0 } })}
          />
        </Row>
        <Row label="意见类型显示">
          <Select
            mode="multiple"
            allowClear
            style={{ width: 460 }}
            placeholder="不选 = 全部类型均显示"
            value={Array.isArray(od.viewTypes) ? od.viewTypes : []}
            options={OPINION_TYPE_OPTIONS}
            optionFilterProp="label"
            onChange={(v) => patch({ opinionDisplay: { ...od, viewTypes: v } })}
          />
        </Row>
      </Section>

      {!formId && (
        <div style={{ color: '#999', fontSize: 12, marginTop: 8 }}>
          该流程尚未绑定表单，无法进入布局设计。
          {formName ? `（当前表单：${formName}）` : ''}
        </div>
      )}
    </>
  );

  const printTemplate = (
    <>
      <Section title="打印模板">
        <Row label="打印模板">
          <span style={{ color: '#999', fontSize: 12 }}>
            打印模板设计器未纳入本次范围：打印输出沿用本节点的显示模板（节点布局）。
            如需更换打印版式，请在「显示模板」页签调整节点布局。
          </span>
        </Row>
      </Section>

      <Section title="打印内容设置">
        <Row label="打印流转意见">
          <Select
            style={{ width: 300 }}
            value={pSet.flowComment ?? 1}
            options={PRINT_FLOW_COMMENTS}
            onChange={(v) => patch({ printSet: { ...pSet, flowComment: v } })}
          />
        </Row>
        <Row label="打印意见显示方式">
          <Select
            style={{ width: 300 }}
            value={pSet.showType ?? 0}
            options={PRINT_SHOW_TYPES}
            onChange={(v) => patch({ printSet: { ...pSet, showType: v } })}
          />
        </Row>
        <Row label="打印意见分栏">
          <Space size={8}>
            <Select
              style={{ width: 300 }}
              value={pSet.remarkColumn ?? 1}
              options={PRINT_REMARK_COLUMNS}
              onChange={(v) => patch({ printSet: { ...pSet, remarkColumn: v } })}
            />
            <Tooltip title="打印时签字意见区分栏展示的列数（对齐 ecology PRINTREMARKCOLUMN）。">
              <QuestionCircleOutlined style={{ color: '#faad14' }} />
            </Tooltip>
          </Space>
        </Row>
        <Row label="打印不显示空意见">
          <Space size={8}>
            <Switch
              size="small"
              checked={!!pSet.stNull}
              onChange={(v) => patch({ printSet: { ...pSet, stNull: v } })}
            />
            <Tooltip title="开启后，没有签字意见的节点不会出现在打印结果里。">
              <QuestionCircleOutlined style={{ color: '#faad14' }} />
            </Tooltip>
          </Space>
        </Row>
        <Row label="打印显示类型">
          <Space size={8} wrap>
            <Select
              mode="multiple"
              allowClear
              style={{ width: 460 }}
              placeholder="不选 = 沿用显示模板的显示类型"
              value={Array.isArray(pSet.viewTypes) ? pSet.viewTypes : []}
              options={[
                { value: PRINT_VIEW_TYPE_OLD, label: '沿用显示模板（oldvalue）' },
                ...OPINION_TYPE_OPTIONS,
              ]}
              optionFilterProp="label"
              onChange={(v) => patch({ printSet: { ...pSet, viewTypes: v } })}
            />
            <Tooltip title="对齐 ecology printviewtype：可整体「沿用显示模板」，或按意见类型逐项勾选（提交 / 退回 / 抄送 / 转办 …）决定打印哪些意见。">
              <QuestionCircleOutlined style={{ color: '#faad14' }} />
            </Tooltip>
          </Space>
        </Row>
        <Row label="同步到其它节点">
          <span style={{ color: '#888', fontSize: 12 }}>
            打印内容随「显示模板」页签的「同步节点」一并同步（同属本节点表单内容）。
          </span>
        </Row>
      </Section>

      <DetailFilterEditor
        title="明细表打印筛选"
        value={detailFilterPrint}
        onChange={(v) => patch({ detailFilterPrint: v })}
      />
    </>
  );

  return (
    <Modal
      title={`设置表单内容${node ? `:${node.nodeName || node.nodeKey}` : ''}`}
      open={open}
      onCancel={onClose}
      width={1000}
      style={{ top: 40 }}
      maskClosable={false}
      destroyOnClose
      footer={
        <Space>
          <Button type="primary" loading={saving} onClick={save} disabled={!nodeKey}>
            保存
          </Button>
        </Space>
      }
    >
      <Tabs
        activeKey={tab}
        onChange={setTab}
        items={[
          { key: 'show', label: '显示模板', children: showTemplate },
          { key: 'print', label: '打印模板', children: printTemplate },
        ]}
      />
    </Modal>
  );
};

export default FormContentDesignModal;
