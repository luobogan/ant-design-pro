import React, { useEffect, useState } from 'react';
import {
  Button,
  Divider,
  Input,
  InputNumber,
  Modal,
  Radio,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  message,
} from 'antd';
import { DeleteOutlined, LinkOutlined } from '@ant-design/icons';
import {
  configOperator,
  getNodeOperators,
  listNodes,
  syncOperatorToNodes,
  WfNodeOperator,
  WfProcessNode,
} from '@/services/workflow';
import { PersonOrgField } from '@/components/FormMode/PersonOrgPicker';
import { loadPersonOrgData } from '@/components/FormMode/personOrg';
import { BHXJ, SIGN_ORDERS } from './wfDict';

export interface NodeOperatorModalProps {
  open: boolean;
  defId: any;
  nodeKey?: string;
  nodeName?: string;
  /** 已有操作者（由列表加载后传入，避免弹窗内再拉一次） */
  operators: WfNodeOperator[];
  /** 保存成功后回调，供列表就地更新 */
  onSaved?: (nodeKey: string, ops: WfNodeOperator[]) => void;
  /** 草稿模式：不落库，仅通过 onSaved 回传，供列表本地暂存 */
  draftMode?: boolean;
  onClose: () => void;
}

/**
 * 节点操作者编辑弹窗 —— 对齐 ecology 的「添加操作组」交互（E9 风格）：
 *
 * · 操作组名称（必填）：一组操作者的标识。除借用 condition_json 外，新增的 group_name 列直存，便于查询/展示。
 * · 操作组可见性 canView：表单填写人是否能看到该操作组（1可见 0不可见）。
 * · 类型单选（指定人/指定部门/指定分部/指定角色/指定岗位/所有人/创建人本人/创建人上级/本部门）。
 * · 生效条件升级：AND/OR + 可视化规则（字段/运算符/值），并生成中文描述；旧版纯文本条件降级展示。
 * · 协办/征询意见人：勾选后本组操作者作为非阻塞知会对象（生成协办待办，不门禁流转）。
 * · 提交走 `configOperator`（整体覆盖写 wf_node_operator）；另提供「同步到其它节点」。
 */

/** 条件规则：字段 + 运算符 + 值（可视化条件，对齐 ecology 条件设置） */
interface CondRule {
  field: string;
  op: 'eq' | 'ne' | 'gt' | 'lt' | 'in' | 'contains';
  value: string;
}
const COND_OP_LABELS: Record<CondRule['op'], string> = {
  eq: '等于',
  ne: '不等于',
  gt: '大于',
  lt: '小于',
  in: '属于',
  contains: '包含',
};
const COND_OP_OPTIONS = (Object.keys(COND_OP_LABELS) as CondRule['op'][]).map((k) => ({
  value: k,
  label: COND_OP_LABELS[k],
}));

/** 解析 condition_json：新结构 {name, logic, rules} 或旧结构 {name, expr} */
const parseCondMeta = (
  cj?: string | null,
): { name?: string; logic?: 'AND' | 'OR'; rules?: CondRule[]; expr?: string } => {
  if (!cj) return {};
  try {
    const o = JSON.parse(cj);
    if (o && typeof o === 'object' && !Array.isArray(o)) {
      return {
        name: typeof o.name === 'string' ? o.name : undefined,
        logic: o.logic === 'OR' ? 'OR' : 'AND',
        rules: Array.isArray(o.rules) ? (o.rules as CondRule[]) : undefined,
        expr: typeof o.expr === 'string' ? o.expr : undefined,
      };
    }
  } catch {
    /* 旧数据是纯文本条件，按 expr 处理 */
  }
  return { expr: cj };
};

const buildCondJson = (meta: {
  name?: string;
  logic?: 'AND' | 'OR';
  rules?: CondRule[];
  expr?: string;
}): string | undefined => {
  const out: Record<string, unknown> = {};
  if (meta.name) out.name = meta.name;
  out.logic = meta.logic === 'OR' ? 'OR' : 'AND';
  if (meta.rules && meta.rules.length) out.rules = meta.rules;
  if (meta.expr) out.expr = meta.expr;
  return Object.keys(out).length ? JSON.stringify(out) : undefined;
};

/** 条件中文描述 */
const condDesc = (logic?: 'AND' | 'OR', rules?: CondRule[], expr?: string): string => {
  if (rules && rules.length) {
    const parts = rules.map((r) => `${r.field || '字段'} ${COND_OP_LABELS[r.op]} ${r.value || ''}`);
    return (logic === 'OR' ? '满足任一：' : '满足全部：') + parts.join(logic === 'OR' ? ' 或 ' : ' 且 ');
  }
  if (expr) return `始终生效（历史条件：${expr}）`;
  return '始终生效（无生效条件）';
};

type OpKind =
  | 'user'
  | 'dept'
  | 'branch'
  | 'role'
  | 'post'
  | 'all'
  | 'creator'
  | 'creatorLeader'
  | 'selfDept';

/** 类型单选项（前 6 项对齐 E9 截图，后 3 项为引擎已支持的无对象类型） */
const KIND_OPTIONS: { value: OpKind; label: string }[] = [
  { value: 'user', label: '指定人' },
  { value: 'dept', label: '指定部门' },
  { value: 'branch', label: '指定分部' },
  { value: 'role', label: '指定角色' },
  { value: 'post', label: '指定岗位' },
  { value: 'all', label: '所有人' },
  { value: 'creator', label: '创建人本人' },
  { value: 'creatorLeader', label: '创建人上级' },
  { value: 'selfDept', label: '本部门' },
];

/** 类型 → wf_node_operator.op_type（对齐 OperatorDBType） */
const KIND_OP: Record<OpKind, number> = {
  user: 3,
  dept: 1,
  branch: 1, // 分部落库为部门（blade 无独立分部体系），固定含下级
  role: 2,
  post: 58,
  all: 4,
  creator: 17,
  creatorLeader: 18,
  selfDept: 19,
};

/** 已有记录的类型展示名（含历史数据/字段型） */
const TYPE_LABELS: Record<number, string> = {
  3: '指定人',
  1: '指定部门',
  2: '指定角色',
  58: '指定岗位',
  4: '所有人',
  17: '创建人本人',
  18: '创建人上级',
  19: '本部门',
  40: '本人',
  41: '上级',
  5: '字段-人员',
  6: '字段-人员上级',
  42: '字段-部门',
  43: '字段-角色',
};

const NodeOperatorModal: React.FC<NodeOperatorModalProps> = ({
  open,
  defId,
  nodeKey,
  nodeName,
  operators,
  draftMode,
  onSaved,
  onClose,
}) => {
  const [ops, setOps] = useState<WfNodeOperator[]>([]);
  const [saving, setSaving] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([]);

  // ── 添加表单（E9「添加操作组」上半区） ──────────────────────────
  const [groupName, setGroupName] = useState('');
  const [canView, setCanView] = useState(1);
  const [kind, setKind] = useState<OpKind>('dept');
  const [objId, setObjId] = useState<string | undefined>();
  const [bhxj, setBhxj] = useState(0); // 0本部 1含下级 2含上级 3逐级向上
  const [levelMin, setLevelMin] = useState<number | undefined>(0);
  const [levelMax, setLevelMax] = useState<number | undefined>(100);
  const [signOrder, setSignOrder] = useState(0);
  const [batchNo, setBatchNo] = useState(0);

  // ── 生效条件（可视化 AND/OR + 规则） ───────────────────────
  const [condLogic, setCondLogic] = useState<'AND' | 'OR'>('AND');
  const [rules, setRules] = useState<CondRule[]>([]);
  const [legacyExpr, setLegacyExpr] = useState<string | undefined>();

  // ── 协办 / 征询意见人（组级开关） ─────────────────────────
  const [isCoadjutant, setIsCoadjutant] = useState(false);
  const [coadjutants, setCoadjutants] = useState<string | undefined>();
  const [isPending, setIsPending] = useState(0);
  const [isModify, setIsModify] = useState(0);
  const [signType, setSignType] = useState<number | undefined>();

  // ── 名称解析字典（id → 显示名，来自统一数据层） ─────────────────
  const [userMap, setUserMap] = useState<Record<string, string>>({});
  const [deptMap, setDeptMap] = useState<Record<string, string>>({});
  const [roleMap, setRoleMap] = useState<Record<string, string>>({});
  const [postMap, setPostMap] = useState<Record<string, string>>({});
  const [dictLoaded, setDictLoaded] = useState(false);

  // ── 同步到其它节点 ─────────────────────────────────────
  const [syncOpen, setSyncOpen] = useState(false);
  const [nodeOptions, setNodeOptions] = useState<{ value: string; label: string }[]>([]);
  const [targetKeys, setTargetKeys] = useState<string[]>([]);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!open) {
      setDictLoaded(false);
      return;
    }
    const list = (operators || []).map((o) => ({ ...o }));
    setOps(list);
    setSelectedKeys([]);
    // 操作组名称：优先取 group_name 列，回退 condition_json 里存的 name
    const metaName = list.map((o) => o.groupName || parseCondMeta(o.conditionJson).name).find((n) => n);
    setGroupName(metaName || '');
    const anyCanView = list.find((o) => o.canView != null);
    setCanView(anyCanView ? (anyCanView.canView as number) : 1);
    // 条件：取任意一行的 condition_json 还原可视化结构
    const meta = parseCondMeta(list.map((o) => o.conditionJson).find((c) => c));
    setCondLogic(meta.logic === 'OR' ? 'OR' : 'AND');
    setRules(meta.rules || []);
    setLegacyExpr(meta.expr);
    // 协办：取任意一行 isCoadjutant=1 的配置
    const co = list.find((o) => o.isCoadjutant === 1);
    setIsCoadjutant(!!co);
    setCoadjutants(co?.coadjutants || undefined);
    setIsPending(co?.isPending ?? 0);
    setIsModify(co?.isModify ?? 0);
    setSignType(co?.signType);
    setSyncOpen(false);
    setTargetKeys([]);
  }, [open, operators]);

  // 打开时加载一次人员/部门/角色/岗位字典（选择弹窗与表格名称解析共用，模块级缓存）
  useEffect(() => {
    if (!open || dictLoaded) return;
    setDictLoaded(true);
    (async () => {
      const data = await loadPersonOrgData();
      setUserMap(Object.fromEntries(data.users.map((i) => [i.id, i.name])));
      setDeptMap(Object.fromEntries(data.depts.map((i) => [i.id, i.name])));
      setRoleMap(Object.fromEntries(data.roles.map((i) => [i.id, i.name])));
      setPostMap(Object.fromEntries(data.posts.map((i) => [i.id, i.name])));
    })();
  }, [open, dictLoaded]);

  const scopeTag = (b?: number) => (b === 1 ? '（含下级）' : b === 2 ? '（含上级）' : b === 3 ? '（逐级向上）' : '（本部）');

  /** 单值解析：按类型从字典取显示名（取不到时回退原 id） */
  const resolveOne = (opType: number | undefined, id: string): string => {
    switch (opType) {
      case 3:
        return userMap[id] || id;
      case 1:
        return deptMap[id] || id;
      case 2:
        return roleMap[id] || id;
      case 58:
        return postMap[id] || id;
      default:
        return id;
    }
  };

  /** 名称：objId 可能是逗号分隔的多个 id（多选），逐个解析后拼接 */
  const nameOf = (r: WfNodeOperator): string => {
    const raw = (r.objId || '').trim();
    if (!raw) return '';
    if ([5, 6, 42, 43].includes(r.opType ?? -1)) return `字段：${raw}`;
    const names = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((id) => resolveOne(r.opType, id))
      .join('、');
    return r.opType === 1 ? `${names}${scopeTag(r.bhxj)}` : names;
  };

  const typeOf = (r: WfNodeOperator) =>
    r.opType === 1 ? '指定部门（属于）' : TYPE_LABELS[r.opType ?? -1] ?? `类型${r.opType}`;

  const condMetaOf = (r: WfNodeOperator) => parseCondMeta(r.conditionJson);

  /** 添加操作者设置：校验 → 追加一行 */
  const addOperator = () => {
    if (!groupName.trim()) {
      message.warning('请输入操作组名称');
      return;
    }
    const type = KIND_OP[kind];
    const needObj = !['all', 'creator', 'creatorLeader', 'selfDept'].includes(kind);
    if (needObj && !objId) {
      message.warning('请选择操作者对象');
      return;
    }
    const row: WfNodeOperator = {
      groupNo: 1,
      opType: type,
      objId: needObj ? String(objId) : '',
      bhxj: kind === 'branch' ? 1 : kind === 'dept' || kind === 'selfDept' ? bhxj : undefined,
      levelMin,
      levelMax,
      signOrder,
      batchNo,
      groupName: groupName.trim(),
      canView,
      conditionJson: buildCondJson({ name: groupName.trim(), logic: condLogic, rules, expr: legacyExpr }),
      // 协办配置（组级开关，逐行携带）
      isCoadjutant: isCoadjutant ? 1 : 0,
      coadjutants: isCoadjutant ? coadjutants || '' : undefined,
      isPending: isCoadjutant ? isPending : 0,
      isModify: isCoadjutant ? isModify : 0,
      signType: isCoadjutant ? signType : undefined,
    };
    setOps((prev) => [...prev, row]);
    setObjId(undefined);
    message.success('已添加操作者设置');
  };

  const batchRemove = () => {
    if (!selectedKeys.length) return;
    setOps((prev) => prev.filter((_, i) => !selectedKeys.includes(String(i))));
    setSelectedKeys([]);
  };

  const handleSave = async () => {
    if (!nodeKey) return;
    if (!groupName.trim()) {
      message.warning('请输入操作组名称');
      return;
    }
    // 组名/可见性/条件/协办 统一回写进每行，保证重开弹窗可还原
    const finalOps = ops.map((o) => ({
      ...o,
      groupName: groupName.trim(),
      canView,
      conditionJson: buildCondJson({ name: groupName.trim(), logic: condLogic, rules, expr: legacyExpr }),
      isCoadjutant: isCoadjutant ? 1 : 0,
      coadjutants: isCoadjutant ? coadjutants || '' : undefined,
      isPending: isCoadjutant ? isPending : 0,
      isModify: isCoadjutant ? isModify : 0,
      signType: isCoadjutant ? signType : undefined,
    }));
    if (draftMode) {
      onSaved?.(nodeKey, finalOps);
      onClose();
      return;
    }
    setSaving(true);
    try {
      const r: any = await configOperator(defId, nodeKey, finalOps);
      if (r?.success === false) {
        message.error('保存失败');
        return;
      }
      onSaved?.(nodeKey, finalOps);
      message.success('操作者已保存');
      onClose();
    } catch {
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const openSync = async () => {
    setSyncOpen(true);
    try {
      const res: any = await listNodes(defId);
      const nodes: WfProcessNode[] = res?.data || [];
      setNodeOptions(
        nodes
          .filter((n) => n.nodeKey && n.nodeKey !== nodeKey)
          .map((n) => ({ value: n.nodeKey as string, label: n.nodeName || (n.nodeKey as string) })),
      );
    } catch {
      setNodeOptions([]);
    }
  };

  const handleSync = async () => {
    if (!nodeKey) return;
    if (!targetKeys.length) {
      message.warning('请选择要同步的目标节点');
      return;
    }
    setSyncing(true);
    try {
      const r: any = await syncOperatorToNodes(defId, nodeKey, targetKeys);
      if (r?.success === false) {
        message.error('同步失败');
        return;
      }
      message.success('已同步到所选节点');
      setSyncOpen(false);
    } catch {
      message.error('同步失败');
    } finally {
      setSyncing(false);
    }
  };

  /** 按类型渲染对象选择器（统一走人员与组织选择弹窗） */
  const renderPicker = () => {
    switch (kind) {
      case 'user':
        return (
          <PersonOrgField browserType={1} value={objId} onChange={(v) => setObjId(v || undefined)} placeholder="选择人员" />
        );
      case 'dept':
        return (
          <Space size={8}>
            <Select style={{ width: 110 }} value={bhxj} options={BHXJ} onChange={setBhxj} />
            <PersonOrgField browserType={2} value={objId} onChange={(v) => setObjId(v || undefined)} placeholder="选择部门" />
          </Space>
        );
      case 'branch':
        return (
          <Space size={8}>
            <Select style={{ width: 110 }} value={bhxj} options={BHXJ} onChange={setBhxj} />
            <PersonOrgField browserType={18} value={objId} onChange={(v) => setObjId(v || undefined)} placeholder="选择分部" />
          </Space>
        );
      case 'role':
        return (
          <PersonOrgField browserType={3} value={objId} onChange={(v) => setObjId(v || undefined)} placeholder="选择角色" />
        );
      case 'post':
        return (
          <PersonOrgField browserType={4} value={objId} onChange={(v) => setObjId(v || undefined)} placeholder="选择岗位" />
        );
      case 'selfDept':
        return (
          <Space size={8}>
            <Select style={{ width: 110 }} value={bhxj} options={BHXJ} onChange={setBhxj} />
            <span style={{ color: '#999' }}>办理人所在部门成员</span>
          </Space>
        );
      default:
        return <span style={{ color: '#999' }}>无需选择对象</span>;
    }
  };

  const generalTab = (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 12 }}>
        <Radio.Group
          value={kind}
          onChange={(e) => {
            setKind(e.target.value);
            setObjId(undefined);
          }}
          options={KIND_OPTIONS}
        />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}>
        {renderPicker()}
        <Space size={4}>
          <span style={{ color: '#666' }}>安全级别：</span>
          <InputNumber style={{ width: 64 }} min={0} max={100} value={levelMin} onChange={(v) => setLevelMin(v ?? undefined)} />
          <span style={{ color: '#bbb' }}>-</span>
          <InputNumber style={{ width: 64 }} min={0} max={100} value={levelMax} onChange={(v) => setLevelMax(v ?? undefined)} />
        </Space>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16, marginTop: 12 }}>
        <Space size={4}>
          <span style={{ color: '#666' }}>会签属性：</span>
          <Select style={{ width: 120 }} value={signOrder} options={SIGN_ORDERS} onChange={setSignOrder} />
        </Space>
        <Space size={4}>
          <span style={{ color: '#666' }}>批次：</span>
          <InputNumber style={{ width: 80 }} min={0} value={batchNo} onChange={(v) => setBatchNo(v ?? 0)} />
        </Space>
      </div>

      {/* 生效条件（AND/OR + 可视化规则） */}
      <Divider orientation="left" style={{ margin: '16px 0 8px' }}>生效条件</Divider>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}>
        <Space size={4}>
          <span style={{ color: '#666' }}>逻辑关系：</span>
          <Radio.Group
            value={condLogic}
            onChange={(e) => setCondLogic(e.target.value)}
            optionType="button"
            options={[
              { value: 'AND', label: '满足全部(且)' },
              { value: 'OR', label: '满足任一(或)' },
            ]}
          />
        </Space>
      </div>
      <div style={{ marginTop: 8 }}>
        {rules.map((r, idx) => (
          <Space key={idx} size={6} style={{ marginBottom: 6 }}>
            <Input
              style={{ width: 160 }}
              placeholder="字段名"
              value={r.field}
              onChange={(e) => {
                const next = [...rules];
                next[idx] = { ...r, field: e.target.value };
                setRules(next);
              }}
            />
            <Select
              style={{ width: 90 }}
              value={r.op}
              options={COND_OP_OPTIONS}
              onChange={(v) => {
                const next = [...rules];
                next[idx] = { ...r, op: v };
                setRules(next);
              }}
            />
            <Input
              style={{ width: 160 }}
              placeholder="值"
              value={r.value}
              onChange={(e) => {
                const next = [...rules];
                next[idx] = { ...r, value: e.target.value };
                setRules(next);
              }}
            />
            <Button
              size="small"
              icon={<DeleteOutlined />}
              onClick={() => setRules(rules.filter((_, i) => i !== idx))}
            />
          </Space>
        ))}
        <div>
          <Button
            size="small"
            type="dashed"
            onClick={() => setRules([...rules, { field: '', op: 'eq', value: '' }])}
          >
            添加条件
          </Button>
        </div>
        <div style={{ color: '#999', fontSize: 12, marginTop: 6 }}>
          {condDesc(condLogic, rules, legacyExpr)}
        </div>
      </div>

      {/* 协办 / 征询意见人 */}
      <Divider orientation="left" style={{ margin: '16px 0 8px' }}>协办 / 征询意见人</Divider>
      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        <Space size={8}>
          <Switch checked={isCoadjutant} onChange={setIsCoadjutant} />
          <span style={{ color: '#666' }}>启用协办/征询（非阻塞知会，生成协办待办，不门禁流转）</span>
        </Space>
        {isCoadjutant && (
          <>
            <PersonOrgField
              browserType={1}
              value={coadjutants}
              onChange={(v) => setCoadjutants(v || undefined)}
              placeholder="选择协办/征询意见人（人员）"
            />
            <Space size={16}>
              <Space size={4}>
                <span style={{ color: '#666' }}>生成待办：</span>
                <Switch checked={isPending === 1} onChange={(v) => setIsPending(v ? 1 : 0)} />
              </Space>
              <Space size={4}>
                <span style={{ color: '#666' }}>可改表单：</span>
                <Switch checked={isModify === 1} onChange={(v) => setIsModify(v ? 1 : 0)} />
              </Space>
            </Space>
          </>
        )}
      </Space>

      <div style={{ textAlign: 'right', marginTop: 12 }}>
        <Button type="primary" onClick={addOperator}>
          添加操作者设置
        </Button>
      </div>
    </>
  );

  return (
    <Modal
      title={`添加操作组${nodeName ? `（${nodeName}）` : ''}`}
      open={open}
      onCancel={onClose}
      onOk={handleSave}
      confirmLoading={saving}
      width={1080}
      destroyOnClose
      okText="保 存"
      cancelText="取消"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <span>操作组名称：</span>
        <Input
          style={{ width: 320 }}
          value={groupName}
          maxLength={100}
          placeholder="请输入操作组名称"
          onChange={(e) => setGroupName(e.target.value)}
        />
        <span style={{ color: '#ff4d4f' }}>*</span>
        <Space size={6} style={{ marginLeft: 16 }}>
          <span style={{ color: '#666' }}>可见性：</span>
          <Select
            style={{ width: 120 }}
            value={canView}
            onChange={setCanView}
            options={[
              { value: 1, label: '表单可见' },
              { value: 0, label: '表单不可见' },
            ]}
          />
        </Space>
        <Button icon={<LinkOutlined />} onClick={openSync}>
          同步到其它节点
        </Button>
      </div>
      <Tabs
        items={[
          { key: 'general', label: '通用', children: generalTab },
          {
            key: 'matrix',
            label: '矩阵对应',
            children: (
              <div style={{ color: '#999', padding: '24px 0', textAlign: 'center' }}>
                矩阵对应（组织矩阵）暂未开放，请使用「通用」页签配置操作者。
              </div>
            ),
          },
        ]}
      />
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          margin: '8px 0',
        }}
      >
        <span>已设操作者</span>
        <Button size="small" icon={<DeleteOutlined />} disabled={!selectedKeys.length} onClick={batchRemove}>
          批量删除
        </Button>
      </div>
      <Table
        rowKey={(_r, i) => String(i)}
        size="small"
        dataSource={ops}
        pagination={false}
        locale={{ emptyText: '暂无操作者，请选择类型后点「添加操作者设置」' }}
        rowSelection={{
          selectedRowKeys: selectedKeys,
          onChange: (keys) => setSelectedKeys(keys),
          columnWidth: 36,
        }}
        columns={[
          { title: '类型', width: 150, dataIndex: 'opType', render: (_: any, r: WfNodeOperator) => typeOf(r) },
          {
            title: '名称',
            dataIndex: 'objId',
            render: (_: any, r: WfNodeOperator) => {
              const name = nameOf(r);
              return name ? <span style={{ color: '#1890ff' }}>{name}</span> : <span style={{ color: '#bbb' }}>—</span>;
            },
          },
          {
            title: '级别',
            width: 90,
            render: (_: any, r: WfNodeOperator) =>
              r.levelMin != null && r.levelMax != null ? `${r.levelMin}-${r.levelMax}` : <span style={{ color: '#bbb' }}>—</span>,
          },
          { title: '会签属性', width: 100, render: (_: any, r: WfNodeOperator) => (r.signOrder ? SIGN_ORDERS.find((s) => s.value === r.signOrder)?.label ?? r.signOrder : '') },
          {
            title: '条件',
            width: 220,
            ellipsis: true,
            render: (_: any, r: WfNodeOperator) => {
              const m = condMetaOf(r);
              return <span style={{ color: '#666' }}>{condDesc(m.logic, m.rules, m.expr)}</span>;
            },
          },
          { title: '批次', width: 70, render: (_: any, r: WfNodeOperator) => r.batchNo ?? 0 },
          {
            title: '协办',
            width: 70,
            render: (_: any, r: WfNodeOperator) =>
              r.isCoadjutant === 1 ? <span style={{ color: '#fa8c16' }}>是</span> : '',
          },
        ]}
      />
      <div style={{ color: '#999', fontSize: 12, marginTop: 8 }}>
        保存为整体覆盖：保存后该节点的操作者以本列表为准（写回 wf_node_operator）。
      </div>

      {/* 同步到其它节点 */}
      <Modal
        title="同步操作者到其它节点"
        open={syncOpen}
        onCancel={() => setSyncOpen(false)}
        onOk={handleSync}
        confirmLoading={syncing}
        width={520}
        destroyOnClose
        okText="同 步"
        cancelText="取消"
      >
        <div style={{ marginBottom: 8, color: '#666' }}>选择目标节点（整体覆盖写入）：</div>
        <Select
          mode="multiple"
          style={{ width: '100%' }}
          value={targetKeys}
          onChange={setTargetKeys}
          options={nodeOptions}
          placeholder="请选择目标节点"
          showSearch
          optionFilterProp="label"
        />
      </Modal>
    </Modal>
  );
};

export default NodeOperatorModal;
