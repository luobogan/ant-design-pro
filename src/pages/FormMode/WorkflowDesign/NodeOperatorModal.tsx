import React, { useEffect, useState } from 'react';
import {
  Button,
  Input,
  InputNumber,
  Modal,
  Radio,
  Select,
  Space,
  Table,
  Tabs,
  message,
} from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import { configOperator, WfNodeOperator } from '@/services/workflow';
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
 * · 操作组名称（必填）：一组操作者的标识。表结构 wf_node_operator 没有组名列，
 *   借用每行的 condition_json（json 列）以 {"name":组名,"expr":生效条件} 结构持久化，
 *   引擎侧当前不消费该字段，后续实现生效条件时按结构化对象解析即可。
 * · 类型单选（指定人/指定部门/指定分部/指定角色/指定岗位/所有人）+ 按类型变化的对象选择器；
 *   选择器统一走 {@link PersonOrgField}（人员与组织选择弹窗，E9 BrowserBean 交互）；
 *   另补「创建人本人/创建人上级/本部门」三个引擎已支持的无对象类型，避免功能回退。
 *   「指定分部」在 blade 中无独立分部体系，落库为部门(opType=1)且固定含下级，
 *   选择器仅列部门树根节点。
 * · 「添加操作者设置」把当前表单追加为一条记录；「已设操作者」表格只读展示
 *   （类型/名称/级别/会签属性/条件/批次），勾选后可批量删除。
 * · 提交走 `configOperator`（整体覆盖写 wf_node_operator），契约与旧版一致。
 */

/** 解析 condition_json：{"name","expr"} 结构；旧版纯文本条件降级为 expr */
const parseCondMeta = (cj?: string | null): { name?: string; expr?: string } => {
  if (!cj) return {};
  try {
    const o = JSON.parse(cj);
    if (o && typeof o === 'object' && !Array.isArray(o)) {
      return {
        name: typeof o.name === 'string' ? o.name : undefined,
        expr: typeof o.expr === 'string' ? o.expr : undefined,
      };
    }
  } catch {
    /* 旧数据是纯文本条件，按 expr 处理 */
  }
  return { expr: cj };
};

const buildCondJson = (name: string, expr?: string): string | undefined => {
  const meta: Record<string, string> = {};
  if (name) meta.name = name;
  if (expr) meta.expr = expr;
  return Object.keys(meta).length ? JSON.stringify(meta) : undefined;
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
  const [kind, setKind] = useState<OpKind>('dept');
  const [objId, setObjId] = useState<string | undefined>();
  const [bhxj, setBhxj] = useState(0); // 0本部 1含下级
  const [levelMin, setLevelMin] = useState<number | undefined>(0);
  const [levelMax, setLevelMax] = useState<number | undefined>(100);
  const [signOrder, setSignOrder] = useState(0);
  const [batchNo, setBatchNo] = useState(0);
  const [expr, setExpr] = useState('');

  // ── 名称解析字典（id → 显示名，来自统一数据层） ─────────────────
  const [userMap, setUserMap] = useState<Record<string, string>>({});
  const [deptMap, setDeptMap] = useState<Record<string, string>>({});
  const [roleMap, setRoleMap] = useState<Record<string, string>>({});
  const [postMap, setPostMap] = useState<Record<string, string>>({});
  const [dictLoaded, setDictLoaded] = useState(false);

  useEffect(() => {
    if (!open) {
      setDictLoaded(false);
      return;
    }
    const list = (operators || []).map((o) => ({ ...o }));
    setOps(list);
    setSelectedKeys([]);
    // 操作组名称：取任意一行 condition_json 里存的 name
    setGroupName(list.map((o) => parseCondMeta(o.conditionJson).name).find((n) => n) || '');
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

  const scopeTag = (b?: number) => (b === 1 ? '（含下级）' : '（本部门）');

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
    // 字段型：objId 存的是字段名，直接展示
    if ([5, 6, 42, 43].includes(r.opType ?? -1)) return `字段：${raw}`;
    const names = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((id) => resolveOne(r.opType, id))
      .join('、');
    // 部门/分部类补范围标记（整行一个范围）
    return r.opType === 1 ? `${names}${scopeTag(r.bhxj)}` : names;
  };

  const typeOf = (r: WfNodeOperator) =>
    r.opType === 1 ? '指定部门（属于）' : TYPE_LABELS[r.opType ?? -1] ?? `类型${r.opType}`;

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
      // 分部固定含下级；部门/本部门取范围下拉；其余类型不涉及
      bhxj: kind === 'branch' ? 1 : kind === 'dept' || kind === 'selfDept' ? bhxj : undefined,
      levelMin,
      levelMax,
      signOrder,
      batchNo,
      conditionJson: buildCondJson(groupName.trim(), expr.trim() || undefined),
    };
    setOps((prev) => [...prev, row]);
    setObjId(undefined);
    setExpr('');
    message.success('已添加操作者设置');
  };

  const batchRemove = () => {
    if (!selectedKeys.length) return;
    setOps((prev) => prev.filter((_, i) => !selectedKeys.includes(i)));
    setSelectedKeys([]);
  };

  const handleSave = async () => {
    if (!nodeKey) return;
    if (!groupName.trim()) {
      message.warning('请输入操作组名称');
      return;
    }
    // 组名统一回写进每行 condition_json，保证重开弹窗可还原
    const finalOps = ops.map((o) => ({
      ...o,
      conditionJson: buildCondJson(groupName.trim(), parseCondMeta(o.conditionJson).expr),
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

  /** 按类型渲染对象选择器（统一走人员与组织选择弹窗） */
  const renderPicker = () => {
    switch (kind) {
      case 'user':
        return (
          <PersonOrgField
            browserType={1}
            value={objId}
            onChange={(v) => setObjId(v || undefined)}
            placeholder="选择人员"
          />
        );
      case 'dept':
        return (
          <Space size={8}>
            <Select style={{ width: 110 }} value={bhxj} options={BHXJ} onChange={setBhxj} />
            <PersonOrgField
              browserType={2}
              value={objId}
              onChange={(v) => setObjId(v || undefined)}
              placeholder="选择部门"
            />
          </Space>
        );
      case 'branch':
        return (
          <PersonOrgField
            browserType={18}
            value={objId}
            onChange={(v) => setObjId(v || undefined)}
            placeholder="选择分部"
          />
        );
      case 'role':
        return (
          <PersonOrgField
            browserType={3}
            value={objId}
            onChange={(v) => setObjId(v || undefined)}
            placeholder="选择角色"
          />
        );
      case 'post':
        return (
          <PersonOrgField
            browserType={4}
            value={objId}
            onChange={(v) => setObjId(v || undefined)}
            placeholder="选择岗位"
          />
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
          <InputNumber
            style={{ width: 64 }}
            min={0}
            max={100}
            value={levelMin}
            onChange={(v) => setLevelMin(v ?? undefined)}
          />
          <span style={{ color: '#bbb' }}>-</span>
          <InputNumber
            style={{ width: 64 }}
            min={0}
            max={100}
            value={levelMax}
            onChange={(v) => setLevelMax(v ?? undefined)}
          />
        </Space>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16, marginTop: 12 }}>
        <Space size={4}>
          <span style={{ color: '#666' }}>会签属性：</span>
          <Select style={{ width: 120 }} value={signOrder} options={SIGN_ORDERS} onChange={setSignOrder} />
        </Space>
        <Space size={4}>
          <span style={{ color: '#666' }}>批次：</span>
          <InputNumber
            style={{ width: 80 }}
            min={0}
            value={batchNo}
            onChange={(v) => setBatchNo(v ?? 0)}
          />
        </Space>
        <Space size={4}>
          <span style={{ color: '#666' }}>生效条件：</span>
          <Input
            style={{ width: 260 }}
            value={expr}
            placeholder="留空=始终生效"
            onChange={(e) => setExpr(e.target.value)}
          />
        </Space>
      </div>
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
        <Button
          size="small"
          icon={<DeleteOutlined />}
          disabled={!selectedKeys.length}
          onClick={batchRemove}
        >
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
          {
            title: '类型',
            width: 150,
            dataIndex: 'opType',
            render: (_: any, r: WfNodeOperator) => typeOf(r),
          },
          {
            title: '名称',
            dataIndex: 'objId',
            render: (_: any, r: WfNodeOperator) => {
              const name = nameOf(r);
              return name ? (
                <span style={{ color: '#1890ff' }}>{name}</span>
              ) : (
                <span style={{ color: '#bbb' }}>—</span>
              );
            },
          },
          {
            title: '级别',
            width: 90,
            render: (_: any, r: WfNodeOperator) =>
              r.levelMin != null && r.levelMax != null ? (
                `${r.levelMin}-${r.levelMax}`
              ) : (
                <span style={{ color: '#bbb' }}>—</span>
              ),
          },
          {
            title: '会签属性',
            width: 100,
            render: (_: any, r: WfNodeOperator) =>
              r.signOrder ? SIGN_ORDERS.find((s) => s.value === r.signOrder)?.label ?? r.signOrder : '',
          },
          {
            title: '条件',
            width: 160,
            ellipsis: true,
            render: (_: any, r: WfNodeOperator) => parseCondMeta(r.conditionJson).expr || '',
          },
          {
            title: '批次',
            width: 70,
            render: (_: any, r: WfNodeOperator) => r.batchNo ?? 0,
          },
        ]}
      />
      <div style={{ color: '#999', fontSize: 12, marginTop: 8 }}>
        保存为整体覆盖：保存后该节点的操作者以本列表为准（写回 wf_node_operator）。
      </div>
    </Modal>
  );
};

export default NodeOperatorModal;
