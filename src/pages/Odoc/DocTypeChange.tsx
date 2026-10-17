import React, { useCallback, useEffect, useState } from 'react';
import { Button, Card, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Switch, Table, Tabs, Tag, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import {
  odocDocTypeChangeApi,
  type OdocDocTypeChange,
  type OdocDocTypeChangeRevision,
} from '@/services/workflow';

const OFFICAL_TYPE: Record<number, string> = { 1: '发文', 2: '收文', 3: '签报' };

/**
 * 文种转换配置（对应后端 WfOdocDocTypeChangeController）。
 */
const OdocDocTypeChangePage: React.FC = () => {
  const [defId, setDefId] = useState<any>();
  const [list, setList] = useState<OdocDocTypeChange[]>([]);
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const [assignForm] = Form.useForm();
  const [assignment, setAssignment] = useState<any>(null);

  const [instId, setInstId] = useState<any>();
  const [revisions, setRevisions] = useState<OdocDocTypeChangeRevision[]>([]);

  const load = useCallback(async (id: any) => {
    if (id == null) return;
    setLoading(true);
    try {
      const [settingsRes, assignRes] = await Promise.all([
        odocDocTypeChangeApi.setting(id),
        odocDocTypeChangeApi.assignment(id),
      ]);
      setList((settingsRes?.data as OdocDocTypeChange[]) || []);
      setAssignment(assignRes?.data || null);
      assignForm.setFieldsValue({
        docTypeChangeNumber: assign?.docTypeChangeNumber,
        docTypeChangeTimes: assign?.docTypeChangeTimes,
      });
    } catch (e: any) {
      message.error(e?.msg || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [assignForm]);

  const handleAdd = async () => {
    const v = await form.validateFields();
    setSubmitting(true);
    try {
      await odocDocTypeChangeApi.saveSetting({
        defId,
        targetDefId: v.targetDefId,
        targetOfficalType: v.targetOfficalType,
        isDefault: v.isDefault ? 1 : 0,
        fieldMaps: v.fieldMaps,
        enabled: 1,
      });
      message.success('已保存');
      setAddOpen(false);
      form.resetFields();
      load(defId);
    } catch (e: any) {
      message.error(e?.msg || '保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  const saveAssignment = async () => {
    const v = await assignForm.validateFields();
    try {
      await odocDocTypeChangeApi.saveAssignment({ defId, ...v });
      message.success('赋值设置已保存');
    } catch (e: any) {
      message.error(e?.msg || '保存失败');
    }
  };

  const queryRevision = async () => {
    if (instId == null) {
      message.warning('请输入实例ID');
      return;
    }
    try {
      const res = await odocDocTypeChangeApi.revision(instId);
      setRevisions((res?.data as OdocDocTypeChangeRevision[]) || []);
    } catch (e: any) {
      message.error(e?.msg || '查询失败');
    }
  };

  const columns = [
    { title: '目标流程ID', dataIndex: 'targetDefId', key: 'targetDefId', width: 120 },
    {
      title: '目标类型',
      dataIndex: 'targetOfficalType',
      key: 'targetOfficalType',
      width: 100,
      render: (v: number) => (v ? <Tag>{OFFICAL_TYPE[v] || v}</Tag> : '-'),
    },
    { title: '默认', dataIndex: 'isDefault', key: 'isDefault', width: 70, render: (v: number) => (v === 1 ? '是' : '否') },
    {
      title: '操作',
      key: 'op',
      width: 80,
      render: (_: any, r: OdocDocTypeChange) => (
        <Popconfirm
          title="确认删除?"
          onConfirm={async () => {
            await odocDocTypeChangeApi.removeSetting(r.id);
            message.success('已删除');
            load(defId);
          }}
        >
          <Button type="link" size="small" danger>
            删除
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div style={{ background: '#fff', padding: 16, borderRadius: 8 }}>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Form layout="inline" onFinish={(v) => { setDefId(v.defId); load(v.defId); }}>
          <Form.Item name="defId" label="源流程定义ID" rules={[{ required: true, message: '请输入源流程ID' }]}>
            <Input placeholder="wf_process_definition.id" style={{ width: 220 }} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">
              加载配置
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Tabs
        items={[
          {
            key: 'setting',
            label: '转换目标',
            children: (
              <>
                <Button type="primary" icon={<PlusOutlined />} style={{ marginBottom: 12 }} onClick={() => setAddOpen(true)}>
                  新增转换目标
                </Button>
                <Table<OdocDocTypeChange> rowKey="id" loading={loading} columns={columns} dataSource={list} pagination={false} />
              </>
            ),
          },
          {
            key: 'assignment',
            label: '赋值设置',
            children: (
              <Form form={assignForm} layout="vertical" style={{ maxWidth: 360 }}>
                <Form.Item name="docTypeChangeNumber" label="变更次数限制" rules={[{ required: true }]}>
                  <Select placeholder="选择限制">
                    <Select.Option value={1}>不限制</Select.Option>
                    <Select.Option value={2}>仅一次</Select.Option>
                    <Select.Option value={3}>自定义次数</Select.Option>
                  </Select>
                </Form.Item>
                <Form.Item name="docTypeChangeTimes" label="自定义次数" tooltip="选择“自定义次数”时生效">
                  <InputNumber min={1} style={{ width: '100%' }} />
                </Form.Item>
                <Button type="primary" onClick={saveAssignment}>
                  保存
                </Button>
              </Form>
            ),
          },
          {
            key: 'revision',
            label: '变更记录',
            children: (
              <>
                <Space style={{ marginBottom: 12 }}>
                  <Input placeholder="实例ID" style={{ width: 220 }} onChange={(e) => setInstId(e.target.value)} />
                  <Button onClick={queryRevision}>查询记录</Button>
                </Space>
                <Table<OdocDocTypeChangeRevision>
                  rowKey="id"
                  dataSource={revisions}
                  pagination={false}
                  columns={[
                    { title: '实例ID', dataIndex: 'instanceId', key: 'instanceId' },
                    { title: '目标流程', dataIndex: 'targetDefId', key: 'targetDefId' },
                    {
                      title: '目标类型',
                      dataIndex: 'targetOfficalType',
                      key: 'targetOfficalType',
                      render: (v: number) => (v ? OFFICAL_TYPE[v] || v : '-'),
                    },
                    { title: '原因', dataIndex: 'reasons', key: 'reasons', ellipsis: true },
                    { title: '操作人', dataIndex: 'operatorId', key: 'operatorId' },
                    { title: '时间', dataIndex: 'createTime', key: 'createTime' },
                  ]}
                />
              </>
            ),
          },
        ]}
      />

      <Modal title="新增转换目标" open={addOpen} onOk={handleAdd} onCancel={() => setAddOpen(false)} confirmLoading={submitting} destroyOnClose>
        <Form form={form} layout="vertical">
          <Form.Item name="targetDefId" label="目标流程定义ID" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="targetOfficalType" label="目标公文类型" rules={[{ required: true }]}>
            <Select>
              <Select.Option value={1}>发文</Select.Option>
              <Select.Option value={2}>收文</Select.Option>
              <Select.Option value={3}>签报</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="isDefault" label="是否默认目标" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="fieldMaps" label="赋值设置(源字段→目标字段 JSON)">
            <Input.TextArea rows={3} placeholder='{"sourceField":"targetField"}' />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default OdocDocTypeChangePage;
