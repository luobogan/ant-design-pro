import React, { useEffect, useState } from 'react';
import { Button, Checkbox, Form, Input, Modal, Space, Table, Typography, message } from 'antd';
import { MinusOutlined, PlusOutlined } from '@ant-design/icons';
import { saveCustomAction, WfCustomAction } from '@/services/workflow';

export interface ActionParamRow {
  key: string;
  name: string;
  value: string;
  isDataSource: boolean;
}

export interface CustomActionRegisterModalProps {
  open: boolean;
  /** 编辑既有注册记录（不传 = 新增） */
  action?: WfCustomAction;
  /** 保存成功回调（把最新记录回给调用方，便于自动选中） */
  onSaved?: (saved: WfCustomAction) => void;
  onClose: () => void;
}

/** 交付给后端执行器实现的接口（对齐 E9 的「接口动作类必须实现接口方法」说明） */
const CODE_TEMPLATE = `// 1) 类必须是「类全名」，并实现本接口
package com.yourcompany.workflow.action;

import org.springblade.workflow.action.IWfCustomAction;
import org.springblade.workflow.action.WfActionRequest;
import org.springframework.stereotype.Component;

@Component   // 标 @Component 后可正常 @Autowired 注入依赖；不加则按无参构造新建
public class YourAction implements IWfCustomAction {

    @Override
    public String execute(WfActionRequest request) throws Exception {
        // request.getInstId() / getDefId() / getNodeKey() / getPhase() / getOperator()
        // request.getParams()    —— 「参数设置」里配置的参数；isDataSource=是 时已按表单字段名取到值
        // request.getFormData()  —— 当前实例的表单数据快照
        String amount = String.valueOf(request.getFormData().get("amount"));
        return "ok, amount=" + amount;
    }
}`;

let paramSeq = 0;
const newParamKey = () => `p_${Date.now().toString(36)}${paramSeq++}`;

const SectionTitle: React.FC<{ title: string; extra?: React.ReactNode }> = ({ title, extra }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      background: '#fafafa',
      border: '1px solid #f0f0f0',
      borderRadius: 4,
      padding: '6px 12px',
      margin: '14px 0 10px',
      fontWeight: 600,
    }}
  >
    <span>{title}</span>
    {extra}
  </div>
);

/**
 * 「注册自定义接口」弹窗（对齐 ecology E9 的注册自定义接口）。
 *
 * 节点「前/后附加操作 → 外部接口 → 自定义接口动作」即选用这里登记的动作：
 * · 基本信息：接口动作名称 / 接口动作标识（唯一）/ 接口动作类文件（类全名）；
 * · 参数设置：参数名称 / 参数值 / 是否数据源（「是」= 参数值按表单字段名在运行时取值）；
 * · 说明：接口动作标识不能重复；类文件必须实现 IWfCustomAction。
 *
 * ⚠️ 与 E9 的差异：E9 的「在线编辑」会把源码写进平台再编译；本项目不做在线编译，
 * 这里改为「代码模板」（给出接口与示例类），新动作类需由开发同学加入工程并重启服务后再注册。
 */
const CustomActionRegisterModal: React.FC<CustomActionRegisterModalProps> = ({
  open,
  action,
  onSaved,
  onClose,
}) => {
  const [form] = Form.useForm();
  const [params, setParams] = useState<ActionParamRow[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([]);
  const [saving, setSaving] = useState(false);
  const [tplOpen, setTplOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const act = action || {};
    form.setFieldsValue({
      actionName: act.actionName || '',
      actionKey: act.actionKey || '',
      className: act.className || '',
      remark: act.remark || '',
    });
    let rows: ActionParamRow[] = [];
    if (act.paramsJson) {
      try {
        const arr = JSON.parse(act.paramsJson);
        if (Array.isArray(arr)) {
          rows = arr.map((p: any) => ({
            key: newParamKey(),
            name: String(p?.name ?? ''),
            value: String(p?.value ?? ''),
            isDataSource: p?.isDataSource === true || p?.isDataSource === 'true',
          }));
        }
      } catch {
        rows = [];
      }
    }
    setParams(rows);
    setSelectedKeys([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, action?.id]);

  const patchParam = (key: string, patch: Partial<ActionParamRow>) =>
    setParams((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)));

  const addParam = () =>
    setParams((prev) => [...prev, { key: newParamKey(), name: '', value: '', isDataSource: false }]);

  const removeSelected = () => {
    const del = new Set(selectedKeys.map(String));
    setParams((prev) => prev.filter((p) => !del.has(p.key)));
    setSelectedKeys([]);
  };

  const handleSave = async () => {
    let values: any;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    const rows = params.filter((p) => (p.name || '').trim());
    const payload: WfCustomAction = {
      id: action?.id,
      actionName: (values.actionName || '').trim(),
      actionKey: (values.actionKey || '').trim(),
      className: (values.className || '').trim(),
      remark: values.remark || '',
      paramsJson: rows.length
        ? JSON.stringify(
            rows.map((p) => ({
              name: p.name.trim(),
              value: p.value ?? '',
              isDataSource: !!p.isDataSource,
            })),
          )
        : undefined,
    };
    setSaving(true);
    try {
      const res: any = await saveCustomAction(payload);
      if (res?.success === false || (res?.code != null && res.code !== 200 && res.code !== 0)) {
        message.error(res?.msg || '保存失败');
        return;
      }
      message.success('自定义接口动作已保存');
      onSaved?.({ ...payload, id: res?.data ? Number(res.data) || payload.id : payload.id });
      onClose();
    } catch (e: any) {
      // 后端对「标识重复 / 类文件不存在」会抛业务异常，网关会以 4xx 返回，这里把 msg 透出
      message.error(e?.response?.data?.msg || e?.data?.msg || e?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const columns: any[] = [
    {
      title: '参数名称',
      dataIndex: 'name',
      render: (_: any, r: ActionParamRow) => (
        <Input
          size="small"
          value={r.name}
          placeholder="如：fieldName"
          onChange={(e) => patchParam(r.key, { name: e.target.value })}
        />
      ),
    },
    {
      title: '参数值',
      dataIndex: 'value',
      render: (_: any, r: ActionParamRow) => (
        <Input
          size="small"
          value={r.value}
          placeholder={r.isDataSource ? '表单字段名，如：amount' : '参数值，如：1'}
          onChange={(e) => patchParam(r.key, { value: e.target.value })}
        />
      ),
    },
    {
      title: '是否数据源',
      dataIndex: 'isDataSource',
      width: 110,
      align: 'center',
      render: (_: any, r: ActionParamRow) => (
        <Checkbox
          checked={r.isDataSource}
          onChange={(e) => patchParam(r.key, { isDataSource: e.target.checked })}
        />
      ),
    },
  ];

  return (
    <>
      <Modal
        title={action?.id ? '编辑自定义接口' : '注册自定义接口'}
        open={open}
        onCancel={onClose}
        width={860}
        footer={
          <Space>
            <Button onClick={() => setTplOpen(true)}>代码模板</Button>
            <Button onClick={onClose}>取消</Button>
            <Button type="primary" loading={saving} onClick={handleSave}>
              保存
            </Button>
          </Space>
        }
      >
        <SectionTitle title="基本信息" />
        <Form form={form} layout="horizontal" labelCol={{ span: 5 }} wrapperCol={{ span: 17 }}>
          <Form.Item
            name="actionName"
            label="接口动作名称"
            rules={[{ required: true, message: '请填写接口动作名称' }]}
          >
            <Input placeholder="如：审批通过后回写金额" allowClear />
          </Form.Item>
          <Form.Item
            name="actionKey"
            label="接口动作标识"
            rules={[{ required: true, message: '请填写接口动作标识（唯一）' }]}
          >
            <Input placeholder="唯一标识，如：write_back_amount（节点附加操作按此引用）" allowClear />
          </Form.Item>
          <Form.Item
            name="className"
            label="接口动作类文件"
            rules={[{ required: true, message: '请填写类全名' }]}
            extra="类全名，须实现 org.springblade.workflow.action.IWfCustomAction（示例见「代码模板」）"
          >
            <Input placeholder="如：org.springblade.workflow.action.demo.LogFormFieldAction" allowClear />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input placeholder="便于维护的说明文字" allowClear />
          </Form.Item>
        </Form>

        <SectionTitle
          title="参数设置"
          extra={
            <Space size={4}>
              <Button type="primary" size="small" icon={<PlusOutlined />} onClick={addParam} title="新增参数" />
              <Button
                size="small"
                icon={<MinusOutlined />}
                disabled={!selectedKeys.length}
                onClick={removeSelected}
                title="删除选中参数"
              />
            </Space>
          }
        />
        <Table
          size="small"
          rowKey="key"
          pagination={false}
          dataSource={params}
          columns={columns}
          locale={{ emptyText: '暂无参数，点右上角「+」新增' }}
          rowSelection={{ selectedRowKeys: selectedKeys, onChange: (keys) => setSelectedKeys(keys) }}
        />

        <SectionTitle title="说明" />
        <Typography.Paragraph style={{ color: '#666', marginBottom: 0 }}>
          <div>1、在节点前后附加操作中可设置接口动作，完成流程自定义附加操作。</div>
          <div>
            2、接口动作标识不能重复；接口动作类文件必须是<strong>类全名</strong>，该类必须实现接口
            <Typography.Text code>IWfCustomAction</Typography.Text>
            的方法 <Typography.Text code>{'public String execute(WfActionRequest request)'}</Typography.Text>。
          </div>
          <div>
            3、参数「是否数据源」= 是：参数值按表单字段名在运行时从表单数据取值；= 否：按固定值传递。
          </div>
        </Typography.Paragraph>
      </Modal>

      <Modal
        title="代码模板（接口动作类）"
        open={tplOpen}
        onCancel={() => setTplOpen(false)}
        footer={<Button type="primary" onClick={() => setTplOpen(false)}>知道了</Button>}
        width={780}
      >
        <Typography.Paragraph style={{ color: '#666' }}>
          把类加入工程（<Typography.Text code>blade-workflow</Typography.Text> 模块）并重启服务后，即可在「注册自定义接口」里登记它的类全名。
        </Typography.Paragraph>
        <pre
          style={{
            background: '#f6f8fa',
            border: '1px solid #eee',
            borderRadius: 4,
            padding: 12,
            maxHeight: 420,
            overflow: 'auto',
            fontSize: 12,
            lineHeight: '18px',
          }}
        >
          {CODE_TEMPLATE}
        </pre>
      </Modal>
    </>
  );
};

export default CustomActionRegisterModal;
