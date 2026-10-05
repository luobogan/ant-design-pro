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
  Tag,
} from 'antd';
import { CheckCircleFilled, SettingOutlined } from '@ant-design/icons';
import { WfNodeOperator, WfProcessNode } from '@/services/workflow';
import { getActiveModeler } from './bpmnModelerHolder';
import { getWfNodeExt, setWfNodeExt, WfFieldPerm } from './bpmnExtension';
import { readNodeOperators } from './nodeOperatorIO';
import { PersonOrgValueText } from '@/components/FormMode/PersonOrgPicker';
import NodeOperatorModal, { describeOperatorCondition } from './NodeOperatorModal';
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

/** 操作者 opType（落库值）→ 人员组织选择器的 browserType；无对象型（所有人/创建人本人/上级/本部门）返回 null。 */
const OP_PICKER_BT: Record<number, number | null> = {
  3: 1, // 人员
  1: 2, // 部门
  2: 3, // 角色
  58: 4, // 岗位
};

// 操作者双向映射（BPMN 扩展 ↔ 本地编辑模型）已收口到 `nodeOperatorIO.ts`，
// 与「节点信息」列表共用同一实现，避免两处读源/映射漂移。

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
  /** 打开「生成表单布局」（Excel 布局设计器） */
  onOpenLayout?: (nodeKey: string) => void;
  /**
   * 打开「设置表单内容」弹框（显示模式 / 显示模板设置）。
   * 提供时「表单布局」tab 优先弹此框（与「节点信息 → 设计」保持一致），
   * 由框内「初始化 / 显示模板」再进入 Excel 布局设计器。
   */
  onDesignFormContent?: (node: WfProcessNode) => void;
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
 *
 * 「操作者」分区为**只读摘要**：其编辑（组名 / 可见性 / 类型 / 对象 / 安全级别 / 会签 /
 * 生效条件 / 协办 / 同步到其它节点）全部由 `NodeOperatorModal` 承担——与「节点信息」列表
 * 共用同一实现，避免两套 UI 各自演进导致能力漂移或写坏组内数据。
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
  onDesignFormContent,
  activeTab,
  onTabChange,
}) => {
  const nodeKey = node?.nodeKey;
  const [baseForm] = Form.useForm();
  const [settingForm] = Form.useForm();
  const [savingBase, setSavingBase] = useState(false);
  const [operators, setOperators] = useState<WfNodeOperator[]>([]);
  /** 「编辑操作组」弹窗（复用 NodeOperatorModal，单一实现） */
  const [opOpen, setOpOpen] = useState(false);
  const [permMap, setPermMap] = useState<Record<string, PermTriple>>({});
  const [savingPerm, setSavingPerm] = useState(false);
  /** 节点扩展属性（原样保存，只改其中的 sign / settings） */
  const [ext, setExt] = useState<Record<string, any>>({});
  const [settingKey, setSettingKey] = useState<string | undefined>();

  const settings: Record<string, any> = useMemo(
    () => (ext.settings && typeof ext.settings === 'object' ? ext.settings : {}),
    [ext],
  );

  /**
   * 字段权限用的字段清单：按 `scope|fieldName` 去重（防御性）。
   *
   * 说明：同一 `fieldName` 会按作用域各出现一条（main + dt{n}，明细表字段权限），**这不是重复**，
   * 去重不会合并它们；只有后端真的吐回完全相同的 `scope|fieldName` 行时才会被折叠，
   * 避免权限矩阵出现重复行、并把重复条目写进 `wf:fieldPerm`（同键多条、后者覆盖前者）。
   */
  const permFields = useMemo(() => {
    const seen = new Set<string>();
    return (formFields || []).filter((f) => {
      const k = `${f.scope}|${f.fieldName}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [formFields]);

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
      // 操作者：BPMN 优先；缺失时回退 REST 并就地迁移写回 BPMN（共享实现见 nodeOperatorIO）
      readNodeOperators(defId, nodeKey)
        .then(setOperators)
        .catch(() => setOperators([]));
      const bpmnExt = getWfNodeExt(element);
      // 字段权限：仅读 BPMN wf:node.fieldPerm（路线 B 唯一事实源，P6 停写后不再回退 REST）
      const map: Record<string, PermTriple> = {};
      if (bpmnExt?.fieldPerm && bpmnExt.fieldPerm.length) {
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
      }
      // 未配置过的字段默认「显示 + 可编辑」（与升级前 perm=2 行为一致）
      permFields.forEach((f) => {
        const k = `${f.scope}|${f.fieldName}`;
        if (map[k] == null) map[k] = permToTriple(2);
      });
      setPermMap(map);
    } else {
      // 画布未就绪：操作者按 BPMN 读（nodeOperatorIO 已 BPMN-only，无元素时返回空）；字段权限默认可见可编辑
      readNodeOperators(defId, nodeKey)
        .then(setOperators)
        .catch(() => setOperators([]));
      const map: Record<string, PermTriple> = {};
      permFields.forEach((f) => {
        map[`${f.scope}|${f.fieldName}`] = permToTriple(2);
      });
      setPermMap(map);
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

  /**
   * 操作者不再在本面板内自行编辑：统一交由 `NodeOperatorModal`（「编辑操作组」）维护，本面板只读。
   *
   * 背景：这里曾用一份扁平行表格编辑 opType/objId/bhxj/batchNo 四个标量，保存时按 **数组下标**
   * 去继承 `wf:node.operator` 里其余字段（groupName / conditionJson / canView / coadjutants /
   * levelMin / levelMax …）。一旦发生行的增删就会错位——删除中间一行会让后续行整体前移，
   * 从而静默继承上一行的组名与生效条件；新增行则因下标越界丢掉全部组级属性。
   * 改为复用同一套「操作组」实现后，写回由 NodeOperatorModal 全量覆盖（buildFinalOps），
   * 本面板只负责读取展示，从而从根上消除该隐患。
   */
  const reloadOperators = () => {
    if (!nodeKey) return;
    readNodeOperators(defId, nodeKey)
      .then(setOperators)
      .catch(() => setOperators([]));
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
      // 路线 B：主表 + 明细表字段权限统一写 wf:fieldPerm（scope=main / dt{idx}）；按去重后的清单写，避免重复条目
      const perms: WfFieldPerm[] = permFields.map((f) => {
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
      {/*
        注意：Form 必须显式带上 `name`。
        antd 会用 `${formName}_${fieldName}` 生成控件 id；若 Form 没有 name，控件的 id 会直接取
        Form.Item 的 name（如 `id="nodeName"`）。而 HTML 规范里「带 id 的元素会成为 window 的
        命名属性」，于是 `window.nodeName` 会被该 <input> 顶替（变成一个元素对象而非 undefined）。
        react-dom 的 ChangeEventPlugin 在事件 target 不在 React 树内时会用 `window` 兜底再读
        `.nodeName.toLowerCase()`，从而抛出 TypeError —— 表现为打开弹窗时的
        `reactName.nodeName.toLowerCase is not a function`。请勿移除 `name`。
      */}
      <Form form={baseForm} layout="vertical" size="small" name="wfNodeBase">
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

  /** 操作者类型显示名（OP_TYPES 未覆盖的历史/字段型回退「类型N」） */
  const opTypeLabel = (t?: number) => OP_TYPES.find((o) => o.value === t)?.label ?? `类型${t}`;

  /**
   * 组级摘要：组名 / 可见性 / 生效条件由 NodeOperatorModal 统一回写到**每一行**上，
   * 故任取一行即可代表本组（与 NodeOperatorModal 打开时的还原逻辑保持一致）。
   */
  const groupMeta = useMemo(() => {
    const named = operators.find((o) => o.groupName);
    const visible = operators.find((o) => o.canView != null);
    const cj = operators.map((o) => o.conditionJson).find((c) => c);
    return {
      name: named?.groupName,
      canView: visible?.canView,
      cond: cj ? describeOperatorCondition(cj) : undefined,
    };
  }, [operators]);
  const hasCoadjutant = operators.some((o) => o.isCoadjutant === 1);

  const operatorTab = (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Space size={8} wrap>
          <span style={{ color: '#666' }}>操作组：</span>
          <span>{groupMeta.name || <span style={{ color: '#bbb' }}>未命名</span>}</span>
          {groupMeta.canView != null && (
            <Tag color={groupMeta.canView === 1 ? 'blue' : 'default'}>
              {groupMeta.canView === 1 ? '表单可见' : '表单不可见'}
            </Tag>
          )}
          {hasCoadjutant && <Tag color="purple">协办 / 征询</Tag>}
        </Space>
        <Button
          type="primary"
          size="small"
          icon={<SettingOutlined />}
          disabled={!nodeKey}
          onClick={() => setOpOpen(true)}
        >
          编辑操作组
        </Button>
      </div>
      <Table
        rowKey={(r, i) => `${i}-${r.opType ?? ''}-${r.objId ?? ''}`}
        size="small"
        dataSource={operators}
        pagination={false}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: '暂无操作者，请点「编辑操作组」配置' }}
        columns={[
          {
            title: '类型',
            width: 140,
            render: (_: any, r: WfNodeOperator) => opTypeLabel(r.opType),
          },
          {
            title: '对象 / 字段',
            render: (_: any, r: WfNodeOperator) => {
              const bt = OP_PICKER_BT[r.opType ?? -1];
              // 有对应人员/组织类型的走只读名称解析（id 串 → 名称串）
              if (bt != null) return <PersonOrgValueText browserType={bt} value={r.objId} />;
              // 字段型（5/6/42/43）：objId 存的是表单字段名；无对象型（所有人 / 创建人…）显示占位
              return r.objId ? <span>字段：{r.objId}</span> : <span style={{ color: '#bbb' }}>—</span>;
            },
          },
          {
            title: '范围',
            width: 90,
            render: (_: any, r: WfNodeOperator) =>
              r.bhxj != null ? (
                BHXJ.find((o) => o.value === r.bhxj)?.label ?? String(r.bhxj)
              ) : (
                <span style={{ color: '#bbb' }}>—</span>
              ),
          },
          {
            title: '安全级别',
            width: 100,
            render: (_: any, r: WfNodeOperator) =>
              r.levelMin != null && r.levelMax != null ? (
                `${r.levelMin} - ${r.levelMax}`
              ) : (
                <span style={{ color: '#bbb' }}>—</span>
              ),
          },
          {
            title: '会签',
            width: 110,
            render: (_: any, r: WfNodeOperator) =>
              r.signOrder != null ? (
                SIGN_ORDERS.find((o) => o.value === r.signOrder)?.label ?? String(r.signOrder)
              ) : (
                <span style={{ color: '#bbb' }}>—</span>
              ),
          },
          {
            title: '批次',
            width: 70,
            render: (_: any, r: WfNodeOperator) => r.batchNo ?? 0,
          },
        ]}
      />
      <div style={{ marginTop: 8, color: '#999', fontSize: 12 }}>
        生效条件：{groupMeta.cond || '未设置'}　·　组级属性（名称 / 可见性 / 生效条件 / 协办）在「编辑操作组」中统一维护，与「节点信息」共用同一实现。
      </div>
    </>
  );

  const permTab = (
    <>
      <Table
        rowKey={(r: FormFieldBrief) => `${r.scope}|${r.fieldName}`}
        size="small"
        dataSource={permFields}
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
        onClick={() => {
          if (!nodeKey) return;
          // 与「节点信息 → 设计」保持一致：先弹「设置表单内容」弹框（显示模式 / 显示模板设置），
          // 再由框内「初始化 / 显示模板」进入 Excel 布局设计器。未接线时才回退为直接进设计器。
          if (onDesignFormContent && node) onDesignFormContent(node);
          else onOpenLayout?.(nodeKey);
        }}
      >
        {onDesignFormContent ? '设置表单内容' : '生成表单布局'}
        {node ? `（${node.nodeName}）` : ''}
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
        {/* 同上：必须带 name，否则字段 id 会污染 window 的命名属性 */}
        {activeDef && (
          <Form form={settingForm} layout="vertical" name="wfNodeSetting">
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

      {/* 操作者：与「节点信息」列表共用同一个 NodeOperatorModal（操作组形态），避免两套实现漂移 */}
      <NodeOperatorModal
        open={opOpen}
        nodeKey={nodeKey}
        nodeName={node?.nodeName}
        onSaved={() => {
          setOpOpen(false);
          // 弹窗内已全量覆盖写回 BPMN 扩展，这里按单一事实源重读，确保面板与画布一致
          reloadOperators();
        }}
        onClose={() => setOpOpen(false)}
      />

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
