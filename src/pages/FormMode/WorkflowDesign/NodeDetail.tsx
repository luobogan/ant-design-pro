import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Checkbox,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Radio,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
} from 'antd';
import { CheckCircleFilled, SettingOutlined } from '@ant-design/icons';
import {
  getFieldPerm,
  getNodeOperators,
  WfNodeOperator,
  WfProcessNode,
} from '@/services/workflow';
import { getActiveModeler } from './bpmnModelerHolder';
import { getWfNodeExt, setWfNodeExt, WfOperator, WfFieldPerm } from './bpmnExtension';
import NodeOperateMenuModal from './NodeOperateMenuModal';
import NodeExtraOperateModal from './NodeExtraOperateModal';
import { FormFieldBrief } from './LinkInfoPanel';
import { isSettingConfigured, SETTING_DEFS, SettingDef, SettingField } from './nodeSettings';
import {
  BHXJ,
  MERGE_TYPES,
  NODE_TYPES,
  OP_TYPES,
  FORM_CONTENT_OPTIONS,
  SIGN_ORDERS,
  scopeLabel,
} from './wfDict';

/**
 * 字段权限三维度（对齐 ecology workflow_nodeform 的 isview / iseditable / ismandatory）。
 *
 * 三维度是**权威值**；后端同时下发 `perm` 兼容派生列（0隐藏/1只读/2可编辑/3必填）。
 */
interface PermTriple {
  visible: boolean;
  editable: boolean;
  required: boolean;
}

/** perm 兼容列 → 三维度（仅用于老数据/老后端回退） */
const permToTriple = (p?: number): PermTriple => {
  const v = p == null ? 2 : p;
  return { visible: v >= 1, editable: v >= 2, required: v === 3 };
};

/** 三维度 → perm 兼容列（提交时一并发，保证老消费方继续可用） */
const tripleToPerm = (t: PermTriple): 0 | 1 | 2 | 3 =>
  !t.visible ? 0 : t.required ? 3 : t.editable ? 2 : 1;

/** BPMN/REST 操作者 → 本地编辑模型（数字字段统一 parse，缺省保留为 null） */
const toLocalOp = (o: any): WfNodeOperator => ({
  id: o?.id,
  opType: parseInt(o?.opType ?? '3', 10),
  objId: o?.objId ?? null,
  bhxj: parseInt(o?.bhxj ?? '0', 10),
  batchNo: parseInt(o?.batchNo ?? '0', 10),
  groupNo: parseInt(o?.groupNo ?? '1', 10),
  groupName: o?.groupName ?? null,
  levelMin: o?.levelMin != null ? parseInt(o.levelMin, 10) : null,
  levelMax: o?.levelMax != null ? parseInt(o.levelMax, 10) : null,
  signOrder: o?.signOrder != null ? parseInt(o.signOrder, 10) : null,
  canView: o?.canView != null ? parseInt(o.canView, 10) : null,
  conditionJson: o?.conditionJson ?? null,
  isCoadjutant: o?.isCoadjutant != null ? parseInt(o.isCoadjutant, 10) : null,
  coadjutants: o?.coadjutants ?? null,
  isPending: o?.isPending != null ? parseInt(o.isPending, 10) : null,
  isModify: o?.isModify != null ? parseInt(o.isModify, 10) : null,
  signType: o?.signType != null ? parseInt(o.signType, 10) : null,
});

/** 本地编辑模型 → BPMN 扩展字符串型操作者（保留完整字段，迁移时不错损） */
const toExtOp = (r: WfNodeOperator): WfOperator => ({
  groupNo: r.groupNo != null ? String(r.groupNo) : undefined,
  opType: r.opType != null ? String(r.opType) : undefined,
  objId: r.objId ?? undefined,
  bhxj: r.bhxj != null ? String(r.bhxj) : undefined,
  levelMin: r.levelMin != null ? String(r.levelMin) : undefined,
  levelMax: r.levelMax != null ? String(r.levelMax) : undefined,
  signOrder: r.signOrder != null ? String(r.signOrder) : undefined,
  batchNo: r.batchNo != null ? String(r.batchNo) : undefined,
  groupName: r.groupName ?? undefined,
  canView: r.canView != null ? String(r.canView) : undefined,
  conditionJson: r.conditionJson ?? undefined,
  isCoadjutant: r.isCoadjutant != null ? String(r.isCoadjutant) : undefined,
  coadjutants: r.coadjutants ?? undefined,
  isPending: r.isPending != null ? String(r.isPending) : undefined,
  isModify: r.isModify != null ? String(r.isModify) : undefined,
  signType: r.signType != null ? String(r.signType) : undefined,
});

// E9 风格「节点设置」项的 schema 已抽到 `nodeSettings.ts`（与「节点信息」可编辑列表共用），
// 这里只负责纵向面板形态的渲染；统一存到 wf_process_node.ext_json.settings。

const ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '6px 10px',
  borderBottom: '1px solid #f0f0f0',
};

export interface NodeDetailProps {
  defId: any;
  /** 当前节点（由画布选中驱动） */
  node?: WfProcessNode;
  /** 当前流程的全部节点：供 `nodeMultiSelect`（如「可见节点」）生成下拉选项 */
  nodes?: WfProcessNode[];
  formFields: FormFieldBrief[];
  formId?: string;
  formName?: string;
  /** 节点名称变更后回调（同步画布节点标签，沿用既有 renameEvt 通道） */
  onSaved?: (nodeKey: string, name: string) => void;
  /** 节点属性写库成功后通知父级，就地更新 nodes */
  onPatch?: (nodeKey: string, patch: Partial<WfProcessNode>) => void;
  /** 打开「生成表单布局」 */
  onOpenLayout?: (nodeKey: string) => void;
  /** 受控激活的页签 key（如 'perm' 字段权限）；由「设置表单内容」弹框跳转用 */
  activeTab?: string;
  /** 页签切换回调（配合 activeTab 受控） */
  onTabChange?: (key: string) => void;
}

/**
 * 节点详情（当前节点）。
 *
 * 对齐 ecology「流转设置 → 节点信息」的内嵌面板形态：内容全部由**当前选中节点**驱动，
 * 分五个分区——基本属性 / 操作者 / 字段权限 / 节点设置（extJson.settings）/ 表单布局。
 * 所有保存都是「即改即存」（画布自动保存 saveBpmn 按 `wf:` 扩展整体覆盖写回），
 * 名称改动额外经 onSaved 回写画布节点标签。
 */
const NodeDetail: React.FC<NodeDetailProps> = ({
  defId,
  node,
  nodes,
  formFields,
  formId,
  formName,
  onSaved,
  onPatch,
  onOpenLayout,
  activeTab,
  onTabChange,
}) => {
  const nodeKey = node?.nodeKey;
  const [baseForm] = Form.useForm();
  const [settingForm] = Form.useForm();
  const [savingBase, setSavingBase] = useState(false);
  const [operators, setOperators] = useState<WfNodeOperator[]>([]);
  const [savingOp, setSavingOp] = useState(false);
  const [permMap, setPermMap] = useState<Record<string, PermTriple>>({});
  const [savingPerm, setSavingPerm] = useState(false);
  /** 节点扩展属性（原样保存，只改其中的 sign / settings） */
  const [ext, setExt] = useState<Record<string, any>>({});
  const [settingKey, setSettingKey] = useState<string | undefined>();

  const settings: Record<string, any> = useMemo(
    () => (ext.settings && typeof ext.settings === 'object' ? ext.settings : {}),
    [ext],
  );

  // 切换节点：回填基本属性、解析 extJson、加载操作者与字段权限
  useEffect(() => {
    if (!nodeKey) return;
    setSettingKey(undefined);
    const parsed: Record<string, any> = (() => {
      try {
        return node?.extJson ? JSON.parse(node.extJson) : {};
      } catch {
        return {};
      }
    })();
    // 节点设置：优先 extJson.settings，缺省用旧 timeoutHours/remind 兜底
    if (!parsed.settings) {
      parsed.settings = {
        timeout: {
          hours: parsed.timeoutHours ?? 0,
          remind: parsed.remind === 1 || parsed.remind === true,
        },
      };
    }
    setExt(parsed);
    baseForm.setFieldsValue({
      nodeName: node?.nodeName,
      nodeType: node?.nodeType ?? 1,
      signOrder: node?.signOrder ?? 0,
      mergeType: node?.mergeType ?? 0,
      passNum: node?.passNum ?? 0,
      allowReject: node?.allowReject === 1,
      allowForward: node?.allowForward === 1,
      autoApprove: node?.autoApprove === 1,
      sign: parsed.sign === 1 || parsed.sign === true,
    });
    // 操作者：BPMN 优先；缺失时回退 REST 并就地迁移到 BPMN（路线 B 单一事实源）
    const modeler = getActiveModeler();
    const element = modeler?.get('elementRegistry')?.get(nodeKey);
    if (element) {
      const bpmnExt = getWfNodeExt(element);
      if (bpmnExt?.operator && bpmnExt.operator.length) {
        setOperators(bpmnExt.operator.map(toLocalOp));
      } else {
        getNodeOperators(defId, nodeKey)
          .then((r: any) => {
            const ops: WfNodeOperator[] = (r?.data || []).map(toLocalOp);
            setOperators(ops);
            // 迁移：把 REST 操作者写入 BPMN（保留完整字段，避免后续保存清空）
            if (ops.length) {
              setWfNodeExt(modeler!, element, { ...(bpmnExt || {}), operator: ops.map(toExtOp) });
            }
          })
          .catch(() => setOperators([]));
      }
      // 字段权限：BPMN 优先（含明细表 scope=dt{idx}），缺失时回退 REST
      if (bpmnExt?.fieldPerm && bpmnExt.fieldPerm.length) {
        const map: Record<string, PermTriple> = {};
        (bpmnExt.fieldPerm || []).forEach((f: WfFieldPerm) => {
          // 三维度是权威值（P3-5 定稿）；仅当三维度齐备时使用，否则回退 perm 兼容派生列（老数据）
          if (f.visible != null && f.editable != null) {
            map[`${f.scope ?? 'main'}|${f.field}`] = {
              visible: f.visible === '1',
              editable: f.editable === '1',
              required: f.required === '1',
            };
          } else {
            map[`${f.scope ?? 'main'}|${f.field}`] = permToTriple(parseInt(f.perm ?? '2', 10));
          }
        });
        formFields.forEach((f) => {
          const k = `${f.scope}|${f.fieldName}`;
          if (map[k] == null) map[k] = permToTriple(2);
        });
        setPermMap(map);
      } else {
        getFieldPerm(defId, nodeKey)
          .then((r: any) => {
            const map: Record<string, PermTriple> = {};
            (r?.data || []).forEach((p: any) => {
              // 三维度为权威值；仅当三维度全部缺省（老数据）才回退到 perm 兼容列
              map[`${p.scope || 'main'}|${p.fieldName}`] =
                p.visible == null && p.editable == null && p.required == null
                  ? permToTriple(p.perm)
                  : { visible: !!p.visible, editable: !!p.editable, required: !!p.required };
            });
            // 未配置过的字段默认「显示 + 可编辑」，与升级前 perm=2 的行为保持一致
            formFields.forEach((f) => {
              const k = `${f.scope}|${f.fieldName}`;
              if (map[k] == null) map[k] = permToTriple(2);
            });
            setPermMap(map);
          })
          .catch(() => setPermMap({}));
      }
    } else {
      // 画布未就绪：纯 REST 回填
      getNodeOperators(defId, nodeKey)
        .then((r: any) => setOperators((r?.data || []).map(toLocalOp)))
        .catch(() => setOperators([]));
      getFieldPerm(defId, nodeKey)
        .then((r: any) => {
          const map: Record<string, PermTriple> = {};
          (r?.data || []).forEach((p: any) => {
            map[`${p.scope || 'main'}|${p.fieldName}`] =
              p.visible == null && p.editable == null && p.required == null
                ? permToTriple(p.perm)
                : { visible: !!p.visible, editable: !!p.editable, required: !!p.required };
          });
          formFields.forEach((f) => {
            const k = `${f.scope}|${f.fieldName}`;
            if (map[k] == null) map[k] = permToTriple(2);
          });
          setPermMap(map);
        })
        .catch(() => setPermMap({}));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeKey, defId]);

  useEffect(() => {
    if (settingKey) settingForm.setFieldsValue(settings[settingKey] || {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingKey]);

  /** 写回 extJson（合并 timeoutHours / remind 旧字段，保证引擎侧兼容） */
  const persistExt = async (nextExt: Record<string, any>) => {
    if (!nodeKey) return false;
    const extJson = JSON.stringify({
      timeoutHours: nextExt.settings?.timeout?.hours || 0,
      remind: nextExt.settings?.timeout?.remind ? 1 : 0,
      sign: nextExt.sign ? 1 : 0,
      settings: nextExt.settings || {},
    });
    const modeler = getActiveModeler();
    const element = modeler?.get('elementRegistry')?.get(nodeKey);
    if (!element) {
      message.error('画布未就绪，无法保存');
      return false;
    }
    try {
      // 路线 B：extJson 写 BPMN `wf:node` 扩展，由画布自动保存落库
      const cur = getWfNodeExt(element) || {};
      setWfNodeExt(modeler, element, { ...cur, extJson });
      setExt(nextExt);
      onPatch?.(nodeKey, { extJson });
      return true;
    } catch {
      message.error('保存失败');
      return false;
    }
  };

  const saveBase = async () => {
    if (!nodeKey) return;
    const v = await baseForm.validateFields();
    setSavingBase(true);
    try {
      const patch: Partial<WfProcessNode> = {
        nodeName: v.nodeName,
        nodeType: v.nodeType,
        signOrder: v.signOrder,
        mergeType: v.mergeType,
        passNum: v.passNum,
        allowReject: v.allowReject ? 1 : 0,
        allowForward: v.allowForward ? 1 : 0,
        autoApprove: v.autoApprove ? 1 : 0,
      };
      // 路线 B：节点名 → 画布元素 name；其余节点属性 → BPMN `wf:node` 扩展
      const modeler = getActiveModeler();
      const element = modeler?.get('elementRegistry')?.get(nodeKey);
      if (!element) {
        message.error('画布未就绪，无法保存');
        return;
      }
      if (v.nodeName && element.businessObject?.name !== v.nodeName) {
        modeler.get('modeling').updateProperties(element, { name: v.nodeName });
      }
      const cur = getWfNodeExt(element) || {};
      setWfNodeExt(modeler, element, {
        ...cur,
        nodeType: v.nodeType != null ? String(v.nodeType) : cur.nodeType,
        signOrder: v.signOrder != null ? String(v.signOrder) : cur.signOrder,
        mergeType: v.mergeType != null ? String(v.mergeType) : cur.mergeType,
        passNum: v.passNum != null ? String(v.passNum) : cur.passNum,
        allowReject: String(v.allowReject ? 1 : 0),
        allowForward: String(v.allowForward ? 1 : 0),
        autoApprove: String(v.autoApprove ? 1 : 0),
      });
      onPatch?.(nodeKey, patch);
      const ok = await persistExt({ ...ext, sign: v.sign ? 1 : 0 });
      if (!ok) return;
      // 名称可能变了：回写画布节点标签
      onSaved?.(nodeKey, v.nodeName);
      message.success('节点信息已保存');
    } catch {
      message.error('保存失败');
    } finally {
      setSavingBase(false);
    }
  };

  const saveOperators = async () => {
    if (!nodeKey) return;
    const modeler = getActiveModeler();
    const element = modeler?.get('elementRegistry')?.get(nodeKey);
    if (!element) {
      message.error('画布未就绪，无法保存');
      return;
    }
    setSavingOp(true);
    try {
      // 路线 B：直接写 BPMN 扩展；按索引合并，保留既有操作者的 groupName / 条件等字段
      const ext = getWfNodeExt(element) || {};
      const existing: WfOperator[] = ext.operator || [];
      const merged: WfOperator[] = operators.map((r, i) => ({
        ...(existing[i] || {}),
        opType: String(r.opType ?? 3),
        objId: r.objId ?? undefined,
        bhxj: String(r.bhxj ?? 0),
        batchNo: String(r.batchNo ?? 0),
      }));
      setWfNodeExt(modeler!, element, { ...ext, operator: merged });
      message.success('操作者已保存到流程定义');
    } catch (e: any) {
      message.error(e?.message || '保存失败');
    } finally {
      setSavingOp(false);
    }
  };

  const savePerms = async () => {
    if (!nodeKey) return;
    const modeler = getActiveModeler();
    const element = modeler?.get('elementRegistry')?.get(nodeKey);
    if (!element) {
      message.error('画布未就绪，无法保存');
      return;
    }
    setSavingPerm(true);
    try {
      // 路线 B：主表 + 明细表字段权限统一写 wf:fieldPerm（scope=main / dt{idx}）
      const perms: WfFieldPerm[] = formFields.map((f) => {
        const t = permMap[`${f.scope}|${f.fieldName}`] || permToTriple(2);
        return {
          scope: f.scope,
          field: f.fieldName,
          perm: String(tripleToPerm(t)),
          // P3-5 三维度权威值随 wf:fieldPerm 一并落库（perm 仅为兼容派生列）
          visible: t.visible ? '1' : '0',
          editable: t.editable ? '1' : '0',
          required: t.required ? '1' : '0',
        };
      });
      const ext = getWfNodeExt(element) || {};
      setWfNodeExt(modeler!, element, { ...ext, fieldPerm: perms });
      message.success('字段权限已保存到流程定义');
    } catch (e: any) {
      message.error(e?.message || '保存失败');
    } finally {
      setSavingPerm(false);
    }
  };

  const activeDef = SETTING_DEFS.find((d) => d.key === settingKey);

  const isConfigured = (def: SettingDef) => isSettingConfigured(def, settings[def.key]);

  const saveSetting = async () => {
    if (!settingKey) return;
    const v = await settingForm.validateFields();
    const ok = await persistExt({ ...ext, settings: { ...settings, [settingKey]: v } });
    if (ok) {
      message.success('设置已保存');
      setSettingKey(undefined);
    }
  };

  /** 节点下拉选项（nodeMultiSelect 用）：value 用 nodeKey，label 用节点名称 */
  const nodeOptions = (nodes || [])
    .filter((n) => n.nodeKey)
    .map((n) => ({ value: n.nodeKey as string, label: n.nodeName || (n.nodeKey as string) }));

  const renderSettingField = (f: SettingField) => {
    switch (f.type) {
      case 'switch':
        return <Switch />;
      case 'number':
        return <InputNumber style={{ width: '100%' }} min={0} />;
      case 'textarea':
        return <Input.TextArea rows={3} placeholder={f.placeholder} />;
      case 'select':
        return <Select options={f.options} allowClear style={{ width: '100%' }} />;
      case 'multiSelect':
        return <Select mode="multiple" options={f.options} allowClear style={{ width: '100%' }} />;
      case 'nodeMultiSelect':
        return (
          <Select
            mode="multiple"
            options={nodeOptions}
            allowClear
            style={{ width: '100%' }}
            placeholder={f.placeholder}
            optionFilterProp="label"
            showSearch
          />
        );
      case 'nodeSelect':
        // 单选节点（如「流程异常处理 → 提交至指定节点」的目标节点）
        return (
          <Select
            options={nodeOptions}
            allowClear
            style={{ width: '100%' }}
            placeholder={f.placeholder}
            optionFilterProp="label"
            showSearch
          />
        );
      case 'radio':
        return (
          <Radio.Group>
            {f.options?.map((o) => (
              <Radio key={String(o.value)} value={o.value}>
                {o.label}
              </Radio>
            ))}
          </Radio.Group>
        );
      default:
        return <Input placeholder={f.placeholder} />;
    }
  };

  const baseTab = (
    <>
      <Form form={baseForm} layout="vertical" size="small">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          <Form.Item name="nodeName" label="节点名称" rules={[{ required: true, message: '请输入节点名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="nodeType" label="节点类型">
            <Select options={NODE_TYPES} />
          </Form.Item>
          <Form.Item name="signOrder" label="审批方式">
            <Select options={SIGN_ORDERS} />
          </Form.Item>
          <Form.Item name="mergeType" label="合并类型">
            <Select options={MERGE_TYPES} />
          </Form.Item>
          <Form.Item name="passNum" label="合并阈值">
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item name="allowReject" label="允许退回" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="allowForward" label="允许转办" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="autoApprove" label="自动批准" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="sign" label="启用签章" valuePropName="checked">
            <Switch />
          </Form.Item>
        </div>
      </Form>
      <div style={{ textAlign: 'right' }}>
        <Button type="primary" size="small" loading={savingBase} onClick={saveBase}>
          保存节点信息
        </Button>
      </div>
    </>
  );

  const operatorTab = (
    <>
      <Table
        rowKey={(r, i) => String(r.id ?? i)}
        size="small"
        dataSource={operators}
        pagination={false}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: '暂无操作者' }}
        columns={[
          {
            title: '类型',
            width: 120,
            render: (_, r, i) => (
              <Select
                size="small"
                style={{ width: 100 }}
                value={r.opType ?? 3}
                options={OP_TYPES}
                onChange={(v) =>
                  setOperators((prev) => prev.map((x, idx) => (idx === i ? { ...x, opType: v } : x)))
                }
              />
            ),
          },
          {
            title: '对象 / 字段',
            render: (_, r, i) => (
              <Input
                size="small"
                value={r.objId}
                placeholder="人员/部门ID或表单字段名"
                onChange={(e) =>
                  setOperators((prev) =>
                    prev.map((x, idx) => (idx === i ? { ...x, objId: e.target.value } : x)),
                  )
                }
              />
            ),
          },
          {
            title: '范围',
            width: 110,
            render: (_, r, i) => (
              <Select
                size="small"
                style={{ width: 90 }}
                value={r.bhxj ?? 0}
                options={BHXJ}
                onChange={(v) =>
                  setOperators((prev) => prev.map((x, idx) => (idx === i ? { ...x, bhxj: v } : x)))
                }
              />
            ),
          },
          {
            title: '批次',
            width: 80,
            render: (_, r, i) => (
              <InputNumber
                size="small"
                style={{ width: 64 }}
                min={0}
                value={r.batchNo ?? 0}
                onChange={(v) =>
                  setOperators((prev) =>
                    prev.map((x, idx) => (idx === i ? { ...x, batchNo: v ?? 0 } : x)),
                  )
                }
              />
            ),
          },
          {
            title: '操作',
            width: 64,
            render: (_, _r, i) => (
              <Button
                type="link"
                danger
                size="small"
                onClick={() => setOperators((prev) => prev.filter((_, idx) => idx !== i))}
              >
                删除
              </Button>
            ),
          },
        ]}
      />
      <div style={{ marginTop: 8, textAlign: 'right' }}>
        <Space>
          <Button
            size="small"
            onClick={() => setOperators((prev) => [...prev, { opType: 3, objId: '', bhxj: 0, batchNo: 0 }])}
          >
            新增操作者
          </Button>
          <Button type="primary" size="small" loading={savingOp} onClick={saveOperators}>
            保存操作者
          </Button>
        </Space>
      </div>
    </>
  );

  const permTab = (
    <>
      <Table
        rowKey={(r: FormFieldBrief) => `${r.scope}|${r.fieldName}`}
        size="small"
        dataSource={formFields}
        pagination={false}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: '当前流程未绑定表单或无字段' }}
        columns={[
          { title: '作用域', dataIndex: 'scope', width: 110, render: (s: string) => scopeLabel(s) },
          { title: '字段名', dataIndex: 'fieldName' },
          { title: '字段标签', dataIndex: 'fieldLabel' },
          {
            title: '显示',
            width: 70,
            align: 'center' as const,
            render: (_, r: FormFieldBrief) => {
              const t = permMap[`${r.scope}|${r.fieldName}`] || permToTriple(2);
              return (
                <Checkbox
                  checked={t.visible}
                  onChange={(e) =>
                    setPermMap((m) => ({
                      ...m,
                      [`${r.scope}|${r.fieldName}`]: { ...t, visible: e.target.checked },
                    }))
                  }
                />
              );
            },
          },
          {
            title: '可编辑',
            width: 70,
            align: 'center' as const,
            render: (_, r: FormFieldBrief) => {
              const t = permMap[`${r.scope}|${r.fieldName}`] || permToTriple(2);
              return (
                <Checkbox
                  checked={t.editable}
                  onChange={(e) =>
                    setPermMap((m) => ({
                      ...m,
                      [`${r.scope}|${r.fieldName}`]: { ...t, editable: e.target.checked },
                    }))
                  }
                />
              );
            },
          },
          {
            title: '必填',
            width: 70,
            align: 'center' as const,
            render: (_, r: FormFieldBrief) => {
              const t = permMap[`${r.scope}|${r.fieldName}`] || permToTriple(2);
              return (
                <Checkbox
                  checked={t.required}
                  onChange={(e) =>
                    setPermMap((m) => ({
                      ...m,
                      [`${r.scope}|${r.fieldName}`]: { ...t, required: e.target.checked },
                    }))
                  }
                />
              );
            },
          },
        ]}
      />
      <div style={{ marginTop: 8, textAlign: 'right' }}>
        <Button type="primary" size="small" loading={savingPerm} onClick={savePerms}>
          保存字段权限
        </Button>
      </div>
    </>
  );

  // 节点设置行项动态化：仅展示对当前节点类型有意义的设置项（对齐 E9：超时仅审批/提交节点）
  const nodeType = node?.nodeType ?? 1;
  const visibleSettingDefs = SETTING_DEFS.filter((d) => {
    if (d.key === 'timeout') return nodeType === 1 || nodeType === 2;
    return true;
  });

  // 「操作菜单」独立弹窗（E9 形态）
  const [menuOpen, setMenuOpen] = useState(false);
  // 「节点前/后附加操作」独立弹窗（E9 形态）
  const [extraField, setExtraField] = useState<'preOperate' | 'postOperate' | undefined>();

  const settingsTab = (
    <>
      <div style={{ border: '1px solid #f0f0f0', borderRadius: 6, overflow: 'hidden' }}>
        <div style={ROW_STYLE}>
          <span>表单内容</span>
          <span style={{ color: '#1677ff' }}>
            {settings.formContent?.mode
              ? FORM_CONTENT_OPTIONS.find((o) => o.value === settings.formContent?.mode)?.label ||
                String(settings.formContent?.mode)
              : '未设置'}
          </span>
        </div>
        {visibleSettingDefs.map((d) => (
          <div key={d.key} style={ROW_STYLE}>
            <span>{d.label}</span>
            <Space size={4}>
              <Button
                type="text"
                size="small"
                icon={<SettingOutlined />}
                // 操作菜单、前后附加操作走 E9 形态的独立弹窗，其余沿用通用表单弹窗
                onClick={() => {
                  if (d.key === 'operateMenu') setMenuOpen(true);
                  else if (d.key === 'preOperate' || d.key === 'postOperate') setExtraField(d.key);
                  else setSettingKey(d.key);
                }}
              />
              {isConfigured(d) && <CheckCircleFilled style={{ color: '#52c41a' }} />}
            </Space>
          </div>
        ))}
      </div>
      <div style={{ color: '#999', fontSize: 12, marginTop: 6 }}>
        设置项即时写入节点扩展属性（extJson.settings），点击齿轮图标配置。
      </div>
    </>
  );

  const layoutTab = (
    <div>
      <Button
        type="primary"
        size="small"
        disabled={!formId || !nodeKey}
        onClick={() => nodeKey && onOpenLayout?.(nodeKey)}
      >
        生成表单布局{node ? `（${node.nodeName}）` : ''}
      </Button>
      {!formId && (
        <div style={{ color: '#999', marginTop: 8, fontSize: 12 }}>
          该流程尚未绑定表单，无法生成 Excel 布局
        </div>
      )}
      {formName && <div style={{ color: '#888', marginTop: 8, fontSize: 12 }}>当前绑定表单：{formName}</div>}
    </div>
  );

  return (
    <>
      <Tabs
        size="small"
        activeKey={activeTab}
        onChange={onTabChange}
        items={[
          { key: 'base', label: '基本属性', children: baseTab },
          { key: 'operator', label: '操作者', children: operatorTab },
          { key: 'perm', label: '字段权限', children: permTab },
          { key: 'settings', label: '节点设置', children: settingsTab },
          { key: 'layout', label: '表单布局', children: layoutTab },
        ]}
      />

      <Modal
        title={activeDef && node ? `${activeDef.label}（${node.nodeName}）` : ''}
        open={!!settingKey}
        onCancel={() => setSettingKey(undefined)}
        onOk={saveSetting}
        destroyOnClose
        width={440}
      >
        {activeDef && (
          <Form form={settingForm} layout="vertical">
            {activeDef.fields.map((f) => (
              <Form.Item
                key={f.name}
                name={f.name}
                label={f.label}
                valuePropName={f.type === 'switch' ? 'checked' : undefined}
              >
                {renderSettingField(f)}
              </Form.Item>
            ))}
          </Form>
        )}
      </Modal>

      <NodeOperateMenuModal
        open={menuOpen}
        defId={defId}
        node={node}
        onClose={() => setMenuOpen(false)}
        onSaved={(nk, extJson) => {
          try {
            setExt(JSON.parse(extJson));
          } catch {
            /* 解析失败保持原状态，父级刷新时会重新解析 */
          }
          onPatch?.(nk, { extJson });
        }}
      />

      <NodeExtraOperateModal
        open={extraField != null}
        field={extraField ?? 'preOperate'}
        defId={defId}
        node={node}
        formFields={formFields}
        formBound={!!formId}
        formName={formName}
        onClose={() => setExtraField(undefined)}
        onSaved={(nk, extJson) => {
          try {
            setExt(JSON.parse(extJson));
          } catch {
            /* 解析失败保持原状态，父级刷新时会重新解析 */
          }
          onPatch?.(nk, { extJson });
        }}
      />
    </>
  );
};

export default NodeDetail;
