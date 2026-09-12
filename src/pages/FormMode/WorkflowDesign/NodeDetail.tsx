import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
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
  configOperator,
  getFieldPerm,
  getNodeOperators,
  saveFieldPerm,
  updateNode,
  FieldPermItem,
  WfNodeOperator,
  WfProcessNode,
} from '@/services/workflow';
import { FormFieldBrief } from './LinkInfoPanel';
import { isSettingConfigured, SETTING_DEFS, SettingDef, SettingField } from './nodeSettings';
import {
  BHXJ,
  MERGE_TYPES,
  NODE_TYPES,
  OP_TYPES,
  PERM_OPTIONS,
  SIGN_ORDERS,
  scopeLabel,
} from './wfDict';

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
}

/**
 * 节点详情（当前节点）。
 *
 * 对齐 ecology「流转设置 → 节点信息」的内嵌面板形态：内容全部由**当前选中节点**驱动，
 * 分五个分区——基本属性 / 操作者 / 字段权限 / 节点设置（extJson.settings）/ 表单布局。
 * 所有保存都是「即改即存」（updateNode 是按 nodeKey 的局部 merge 更新），
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
}) => {
  const nodeKey = node?.nodeKey;
  const [baseForm] = Form.useForm();
  const [settingForm] = Form.useForm();
  const [savingBase, setSavingBase] = useState(false);
  const [operators, setOperators] = useState<WfNodeOperator[]>([]);
  const [savingOp, setSavingOp] = useState(false);
  const [permMap, setPermMap] = useState<Record<string, number>>({});
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
    getNodeOperators(defId, nodeKey)
      .then((r: any) => setOperators(r?.data || []))
      .catch(() => setOperators([]));
    getFieldPerm(defId, nodeKey)
      .then((r: any) => {
        const map: Record<string, number> = {};
        (r?.data || []).forEach((p: FieldPermItem) => {
          map[`${p.scope || 'main'}|${p.fieldName}`] = p.perm;
        });
        formFields.forEach((f) => {
          const k = `${f.scope}|${f.fieldName}`;
          if (map[k] == null) map[k] = 2;
        });
        setPermMap(map);
      })
      .catch(() => setPermMap({}));
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
    try {
      const r: any = await updateNode(defId, nodeKey, { extJson });
      if (r?.success === false) {
        message.error('保存失败');
        return false;
      }
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
      const r: any = await updateNode(defId, nodeKey, patch);
      if (r?.success === false) {
        message.error('保存失败');
        return;
      }
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
    setSavingOp(true);
    try {
      const r: any = await configOperator(defId, nodeKey, operators);
      if (r?.success === false) {
        message.error('保存失败');
        return;
      }
      message.success('操作者已保存');
    } catch {
      message.error('保存失败');
    } finally {
      setSavingOp(false);
    }
  };

  const savePerms = async () => {
    if (!nodeKey) return;
    setSavingPerm(true);
    try {
      const perms: FieldPermItem[] = formFields.map((f) => ({
        scope: f.scope,
        fieldName: f.fieldName,
        perm: (permMap[`${f.scope}|${f.fieldName}`] ?? 2) as 0 | 1 | 2 | 3,
      }));
      const r: any = await saveFieldPerm(defId, nodeKey, perms);
      if (r?.success === false) {
        message.error('保存失败');
        return;
      }
      message.success('字段权限已保存');
    } catch {
      message.error('保存失败');
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
            title: '权限',
            width: 120,
            render: (_, r: FormFieldBrief) => (
              <Select
                size="small"
                style={{ width: 100 }}
                value={permMap[`${r.scope}|${r.fieldName}`] ?? 2}
                options={PERM_OPTIONS}
                onChange={(v) => setPermMap((m) => ({ ...m, [`${r.scope}|${r.fieldName}`]: v }))}
              />
            ),
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

  const settingsTab = (
    <>
      <div style={{ border: '1px solid #f0f0f0', borderRadius: 6, overflow: 'hidden' }}>
        <div style={ROW_STYLE}>
          <span>表单内容</span>
          <span style={{ color: '#1677ff' }}>普通模式</span>
        </div>
        {visibleSettingDefs.map((d) => (
          <div key={d.key} style={ROW_STYLE}>
            <span>{d.label}</span>
            <Space size={4}>
              <Button
                type="text"
                size="small"
                icon={<SettingOutlined />}
                onClick={() => setSettingKey(d.key)}
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
    </>
  );
};

export default NodeDetail;
