import React, { useEffect, useState } from 'react';
import {
  Button,
  Divider,
  Empty,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Switch,
  message,
} from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { WfCustomOperationFull, WfCustomOperationRight, WfProcessNode } from '@/services/workflow';
import { getActiveModeler } from './bpmnModelerHolder';
import { getWfNodeExt, setWfNodeExt, WfOperation } from './bpmnExtension';

const { Option } = Select;

/** BPMN 扩展 `wf:operation` → 弹窗用的三级结构（op / action / rights） */
const fromExt = (o: WfOperation): WfCustomOperationFull => ({
  op: {
    btnName: o.btnName,
    btnOrder: o.btnOrder != null ? Number(o.btnOrder) : undefined,
    enabled: o.enabled != null ? Number(o.enabled) : undefined,
    actionType: o.actionType != null ? Number(o.actionType) : undefined,
  },
  action: {
    url: o.url,
    httpMethod: o.httpMethod,
    flowOperation: o.flowOperation,
    interfaceName: o.interfaceName,
    paramExpr: o.paramExpr,
    opinion: o.opinion,
  },
  rights: (o.rights || []).map((r) => ({ rightType: r.rightType, rightValue: r.rightValue })),
});

/** 弹窗三级结构 → BPMN 扩展 `wf:operation` */
const toExt = (d: WfCustomOperationFull): WfOperation => ({
  btnName: d.op?.btnName,
  btnOrder: d.op?.btnOrder != null ? String(d.op.btnOrder) : undefined,
  actionType: d.op?.actionType != null ? String(d.op.actionType) : undefined,
  enabled: d.op?.enabled != null ? String(d.op.enabled) : undefined,
  url: d.action?.url,
  httpMethod: d.action?.httpMethod,
  paramExpr: d.action?.paramExpr,
  flowOperation: d.action?.flowOperation,
  interfaceName: d.action?.interfaceName,
  opinion: d.action?.opinion,
  rights: (d.rights || []).map((r) => ({ rightType: r.rightType, rightValue: r.rightValue })),
});

const ACTION_TYPES = [
  { label: 'URL（HTTP 调用）', value: 1 },
  { label: '流程操作', value: 2 },
  { label: '接口', value: 3 },
];
const RIGHT_TYPES = [
  { label: '角色', value: 'role' },
  { label: '部门', value: 'dept' },
  { label: '人员', value: 'person' },
];

const emptyRight = (): WfCustomOperationRight => ({ rightType: 'role', rightValue: '' });
const emptyFull = (): WfCustomOperationFull => ({
  op: { btnName: '', enabled: 1, actionType: 1, btnOrder: 0 },
  action: { httpMethod: 'POST', url: '', paramExpr: '', opinion: '' },
  rights: [],
});

/**
 * 节点「自定义操作」三级配置弹窗（对齐泛微节点信息「自定义操作」）。
 *
 * 每按钮可配：按钮名 / 启用 / 动作类型（URL·流程操作·接口）+ 动作明细
 * （地址+方法+参数表达式+流程操作标识+接口名+执行意见，支持 $field$ 占位符）
 * + 权限矩阵（角色 / 部门 / 人员，逗号分隔值）。
 */
const CustomOperationModal: React.FC<{
  open: boolean;
  defId: any;
  node?: WfProcessNode | null;
  onClose: () => void;
}> = ({ open, defId, node, onClose }) => {
  const [data, setData] = useState<WfCustomOperationFull[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // 路线 B：自定义操作改读 BPMN `wf:node/wf:operation[]`，不再调 fullCustomOperations
  useEffect(() => {
    if (!open || !node?.nodeKey) return;
    const modeler = getActiveModeler();
    const element = modeler?.get('elementRegistry')?.get(node.nodeKey);
    if (!element) {
      setData([]);
      return;
    }
    setData((getWfNodeExt(element)?.operation || []).map(fromExt));
  }, [open, node?.nodeKey]);

  const patchOp = (i: number, p: any) =>
    setData((prev) => prev.map((it, idx) => (idx === i ? { ...it, op: { ...it.op, ...p } } : it)));
  const patchAction = (i: number, p: any) =>
    setData((prev) => prev.map((it, idx) => (idx === i ? { ...it, action: { ...it.action, ...p } } : it)));
  const patchRights = (i: number, rights: WfCustomOperationRight[]) =>
    setData((prev) => prev.map((it, idx) => (idx === i ? { ...it, rights } : it)));

  const onSave = async () => {
    if (!node?.nodeKey) return;
    const payload = data
      .filter((d) => d.op?.btnName && d.op.btnName.trim())
      .map((d, i) => ({
        ...d,
        op: { ...d.op, btnOrder: i, enabled: d.op?.enabled ? 1 : 0 },
        rights: (d.rights || []).filter((r) => r.rightValue && r.rightValue.trim()),
      }));
    const modeler = getActiveModeler();
    const element = modeler?.get('elementRegistry')?.get(node.nodeKey);
    if (!element) {
      message.error('画布未就绪，无法保存');
      return;
    }
    setSaving(true);
    try {
      // 路线 B：整体覆盖写回 BPMN 扩展，由画布自动保存落库
      const ext = getWfNodeExt(element) || {};
      setWfNodeExt(modeler, element, { ...ext, operation: payload.map(toExt) });
      message.success('自定义操作已保存（已写入 BPMN 扩展）');
      onClose();
    } catch (e: any) {
      message.error(e?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`自定义操作（${node?.nodeName || node?.nodeKey || ''}）`}
      open={open}
      width={820}
      onCancel={onClose}
      onOk={onSave}
      confirmLoading={saving}
      okText="保存"
      destroyOnClose
    >
      {loading ? (
        <Empty description="加载中…" />
      ) : (
        <div>
          {data.length === 0 && <Empty description="暂无自定义操作" />}
          {data.map((d, i) => (
            <div key={i} style={{ border: '1px solid #eee', borderRadius: 6, padding: 12, marginBottom: 12 }}>
              <Space wrap size={12}>
                <span>按钮名</span>
                <Input
                  style={{ width: 160 }}
                  value={d.op?.btnName}
                  onChange={(e) => patchOp(i, { btnName: e.target.value })}
                />
                <span>启用</span>
                <Switch checked={d.op?.enabled !== 0} onChange={(v) => patchOp(i, { enabled: v ? 1 : 0 })} />
                <span>动作类型</span>
                <Select
                  style={{ width: 160 }}
                  value={d.op?.actionType ?? 1}
                  onChange={(v) => patchOp(i, { actionType: v })}
                >
                  {ACTION_TYPES.map((o) => (
                    <Option key={o.value} value={o.value}>
                      {o.label}
                    </Option>
                  ))}
                </Select>
              </Space>
              <Divider style={{ margin: '10px 0' }} />
              <Space wrap size={12}>
                {d.op?.actionType === 1 && (
                  <>
                    <span>地址(支持$field$)</span>
                    <Input
                      style={{ width: 280 }}
                      placeholder="http://..."
                      value={d.action?.url}
                      onChange={(e) => patchAction(i, { url: e.target.value })}
                    />
                    <span>方法</span>
                    <Select
                      style={{ width: 90 }}
                      value={d.action?.httpMethod || 'POST'}
                      onChange={(v) => patchAction(i, { httpMethod: v })}
                    >
                      <Option value="POST">POST</Option>
                      <Option value="GET">GET</Option>
                    </Select>
                    <br />
                    <span>参数(支持$field$)</span>
                    <Input.TextArea
                      style={{ width: 280 }}
                      rows={2}
                      placeholder='{"k":"$field$"}'
                      value={d.action?.paramExpr}
                      onChange={(e) => patchAction(i, { paramExpr: e.target.value })}
                    />
                  </>
                )}
                {d.op?.actionType === 2 && (
                  <>
                    <span>流程操作标识</span>
                    <Input
                      style={{ width: 220 }}
                      placeholder="flowOperation key"
                      value={d.action?.flowOperation}
                      onChange={(e) => patchAction(i, { flowOperation: e.target.value })}
                    />
                  </>
                )}
                {d.op?.actionType === 3 && (
                  <>
                    <span>接口名</span>
                    <Input
                      style={{ width: 220 }}
                      value={d.action?.interfaceName}
                      onChange={(e) => patchAction(i, { interfaceName: e.target.value })}
                    />
                  </>
                )}
                <span>执行意见</span>
                <Input
                  style={{ width: 200 }}
                  value={d.action?.opinion}
                  onChange={(e) => patchAction(i, { opinion: e.target.value })}
                />
              </Space>
              <Divider style={{ margin: '10px 0' }} orientation="left" plain>
                权限矩阵
              </Divider>
              {(d.rights || []).map((r, ri) => (
                <Space key={ri} wrap size={8} style={{ marginRight: 8, marginBottom: 6 }}>
                  <Select
                    style={{ width: 90 }}
                    value={r.rightType}
                    onChange={(v) => patchRights(i, (d.rights || []).map((x, xi) => (xi === ri ? { ...x, rightType: v } : x)))}
                  >
                    {RIGHT_TYPES.map((o) => (
                      <Option key={o.value} value={o.value}>
                        {o.label}
                      </Option>
                    ))}
                  </Select>
                  <Input
                    style={{ width: 220 }}
                    placeholder="值（逗号分隔）"
                    value={r.rightValue}
                    onChange={(e) => patchRights(i, (d.rights || []).map((x, xi) => (xi === ri ? { ...x, rightValue: e.target.value } : x)))}
                  />
                  <Button
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={() => patchRights(i, (d.rights || []).filter((_, xi) => xi !== ri))}
                  />
                </Space>
              ))}
              <Button
                size="small"
                icon={<PlusOutlined />}
                onClick={() => patchRights(i, [...(d.rights || []), emptyRight()])}
              >
                加权限
              </Button>
              <div style={{ textAlign: 'right', marginTop: 8 }}>
                <Button
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                  onClick={() => setData((prev) => prev.filter((_, xi) => xi !== i))}
                >
                  删除按钮
                </Button>
              </div>
            </div>
          ))}
          <Button type="dashed" icon={<PlusOutlined />} block onClick={() => setData((prev) => [...prev, emptyFull()])}>
            添加自定义操作
          </Button>
        </div>
      )}
    </Modal>
  );
};

export default CustomOperationModal;
