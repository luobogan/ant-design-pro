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
import {
  fullCustomOperations,
  saveCustomOperations,
  WfCustomOperationFull,
  WfCustomOperationRight,
  WfProcessNode,
} from '@/services/workflow';

const { Option } = Select;

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

  useEffect(() => {
    if (open && defId && node?.nodeKey) {
      setLoading(true);
      fullCustomOperations(Number(defId), node.nodeKey)
        .then((r: any) => setData(Array.isArray(r?.data) ? r.data : []))
        .catch(() => setData([]))
        .finally(() => setLoading(false));
    }
  }, [open, defId, node?.nodeKey]);

  const patchOp = (i: number, p: any) =>
    setData((prev) => prev.map((it, idx) => (idx === i ? { ...it, op: { ...it.op, ...p } } : it)));
  const patchAction = (i: number, p: any) =>
    setData((prev) => prev.map((it, idx) => (idx === i ? { ...it, action: { ...it.action, ...p } } : it)));
  const patchRights = (i: number, rights: WfCustomOperationRight[]) =>
    setData((prev) => prev.map((it, idx) => (idx === i ? { ...it, rights } : it)));

  const onSave = async () => {
    const payload = data
      .filter((d) => d.op?.btnName && d.op.btnName.trim())
      .map((d, i) => ({
        ...d,
        op: { ...d.op, btnOrder: i, enabled: d.op?.enabled ? 1 : 0 },
        rights: (d.rights || []).filter((r) => r.rightValue && r.rightValue.trim()),
      }));
    setSaving(true);
    try {
      await saveCustomOperations(Number(defId), node!.nodeKey!, payload as any);
      message.success('自定义操作已保存');
      onClose();
    } catch (e: any) {
      message.error(e?.msg || '保存失败');
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
