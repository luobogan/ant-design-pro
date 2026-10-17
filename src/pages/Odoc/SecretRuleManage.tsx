import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Form, Input, Modal, Select, Switch, Table, Tag, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import {
  odocReceiveGroupApi,
  odocReceiveUnitApi,
  odocSecretRuleApi,
  type OdocReceiveGroup,
  type OdocReceiveUnit,
  type OdocSecretRule,
} from '@/services/workflow';

/** 密级序数 → 名称（与后端 OdocSecretLevel 对齐） */
const SECRET_LEVEL: Record<number, string> = { 0: '公开', 1: '秘密', 2: '机密', 3: '绝密' };
const SECRET_OPTIONS = [0, 1, 2, 3].map((v) => ({ value: v, label: SECRET_LEVEL[v] }));
const TARGET_TYPE: Record<number, string> = { 1: '收文单位', 2: '公共组' };

/**
 * 密级收发限制规则维护（对应 E9 SENDREUNITRESTRICTIONS / CommReceiveGroup）。
 * 约束某收文单位/公共组可收发的公文密级范围；提交越限由后端拦截。
 */
const OdocSecretRuleManage: React.FC = () => {
  const [list, setList] = useState<OdocSecretRule[]>([]);
  const [units, setUnits] = useState<OdocReceiveUnit[]>([]);
  const [groups, setGroups] = useState<OdocReceiveGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [current, setCurrent] = useState<OdocSecretRule | null>(null);
  const [modalType, setModalType] = useState<number>(1);
  const [form] = Form.useForm();

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await odocSecretRuleApi.list();
      setList((res?.data as OdocSecretRule[]) || []);
    } catch (e: any) {
      message.error(e?.msg || '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);
  const reloadRefs = useCallback(async () => {
    try {
      const [u, g] = await Promise.all([odocReceiveUnitApi.list(), odocReceiveGroupApi.list()]);
      setUnits((u?.data as OdocReceiveUnit[]) || []);
      setGroups((g?.data as OdocReceiveGroup[]) || []);
    } catch {
      /* 参照数据加载失败不阻塞规则页 */
    }
  }, []);

  useEffect(() => {
    reload();
    reloadRefs();
  }, [reload, reloadRefs]);

  const nameOf = useMemo(() => {
    const u: Record<string, string> = {};
    units.forEach((x) => {
      if (x.id != null) u[`1_${x.id}`] = x.unitName || String(x.id);
    });
    const g: Record<string, string> = {};
    groups.forEach((x) => {
      if (x.id != null) g[`2_${x.id}`] = x.groupName || String(x.id);
    });
    return (r: OdocSecretRule) => (r.targetType != null && r.targetId != null ? (r.targetType === 2 ? g : u)[`${r.targetType}_${r.targetId}`] : undefined) || String(r.targetId ?? '-');
  }, [units, groups]);

  const openAdd = () => {
    setCurrent(null);
    setModalType(1);
    form.resetFields();
    form.setFieldsValue({ targetType: 1, secLevelFrom: 0, secLevelTo: 3, enabled: true });
    setEditOpen(true);
  };
  const openEdit = (r: OdocSecretRule) => {
    setCurrent(r);
    setModalType(r.targetType ?? 1);
    form.setFieldsValue({ ...r, enabled: r.enabled !== 0 });
    setEditOpen(true);
  };
  const handleSubmit = async () => {
    const v = await form.validateFields();
    setSubmitting(true);
    try {
      await odocSecretRuleApi.save({
        id: current?.id,
        targetType: v.targetType,
        targetId: v.targetId,
        secLevelFrom: v.secLevelFrom,
        secLevelTo: v.secLevelTo,
        enabled: v.enabled ? 1 : 0,
        remark: v.remark,
      });
      message.success('已保存');
      setEditOpen(false);
      reload();
    } catch (e: any) {
      message.error(e?.msg || '保存失败');
    } finally {
      setSubmitting(false);
    }
  };
  const handleRemove = async (id: any) => {
    try {
      await odocSecretRuleApi.remove(id);
      message.success('已删除');
      reload();
    } catch (e: any) {
      message.error(e?.msg || '删除失败');
    }
  };

  const targetOptions =
    modalType === 2
      ? groups.map((g) => ({ label: g.groupName, value: String(g.id) }))
      : units.map((u) => ({ label: u.unitName, value: String(u.id) }));

  const columns = [
    {
      title: '目标类型',
      dataIndex: 'targetType',
      key: 'targetType',
      width: 110,
      render: (v: number) => <Tag color={v === 2 ? 'purple' : 'blue'}>{TARGET_TYPE[v] || v}</Tag>,
    },
    { title: '目标', key: 'target', width: 200, render: (_: any, r: OdocSecretRule) => nameOf(r) },
    {
      title: '允许密级',
      key: 'range',
      width: 170,
      render: (_: any, r: OdocSecretRule) =>
        `${SECRET_LEVEL[r.secLevelFrom ?? 0] ?? r.secLevelFrom} ~ ${SECRET_LEVEL[r.secLevelTo ?? 3] ?? r.secLevelTo}`,
    },
    { title: '备注', dataIndex: 'remark', key: 'remark', ellipsis: true, render: (v: string) => v || '-' },
    {
      title: '启用',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 80,
      render: (v: number) => <Tag color={v === 1 ? 'green' : 'default'}>{v === 1 ? '启用' : '停用'}</Tag>,
    },
    {
      title: '操作',
      key: 'op',
      width: 120,
      render: (_: any, r: OdocSecretRule) => (
        <>
          <Button type="link" size="small" onClick={() => openEdit(r)}>
            编辑
          </Button>
          <Button type="link" size="small" danger onClick={() => handleRemove(r.id)}>
            删除
          </Button>
        </>
      ),
    },
  ];

  return (
    <div style={{ background: '#fff', padding: 16, borderRadius: 8 }}>
      <div style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
          新增限制规则
        </Button>
      </div>
      <Table<OdocSecretRule> rowKey="id" loading={loading} columns={columns} dataSource={list} pagination={false} />

      <Modal
        title={current ? '编辑限制规则' : '新增限制规则'}
        open={editOpen}
        onOk={handleSubmit}
        onCancel={() => setEditOpen(false)}
        confirmLoading={submitting}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="targetType" label="目标类型" rules={[{ required: true }]}>
            <Select
              onChange={(v) => {
                setModalType(v);
                form.setFieldsValue({ targetId: undefined });
              }}
              options={[
                { value: 1, label: '收文单位' },
                { value: 2, label: '公共组' },
              ]}
            />
          </Form.Item>
          <Form.Item name="targetId" label="目标" rules={[{ required: true, message: '请选择目标' }]}>
            <Select showSearch optionFilterProp="label" options={targetOptions} placeholder="选择单位/公共组" />
          </Form.Item>
          <Form.Item name="secLevelFrom" label="允许密级起" rules={[{ required: true }]}>
            <Select options={SECRET_OPTIONS} />
          </Form.Item>
          <Form.Item name="secLevelTo" label="允许密级至" rules={[{ required: true }]}>
            <Select options={SECRET_OPTIONS} />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default OdocSecretRuleManage;
