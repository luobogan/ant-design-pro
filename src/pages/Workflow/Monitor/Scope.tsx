import { PageContainer } from '@ant-design/pro-components';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { Button, Form, Input, Modal, Popconfirm, Select, Tag, TreeSelect, message } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { PersonOrgField } from '@/components/FormMode/PersonOrgPicker';
import { monitorScopeList, saveMonitorScope, updateMonitorScope, removeMonitorScope, listDefinitions } from '@/services/workflow';
import type { MonitorScopeItem } from '@/services/workflow';
import { list as userList } from '@/services/system/user';
import { tree as deptTree } from '@/services/system/dept';
import { usePageButtons } from '@/hooks/usePageButtons';
import { pickPayload } from '@/utils/utils';

/** 范围类型 */
const SCOPE_TYPE: Record<number, { text: string; color: string }> = {
  1: { text: '分部', color: 'purple' },
  2: { text: '部门', color: 'blue' },
  3: { text: '人员', color: 'green' },
};

/** 把部门树节点转换为 antd TreeSelect 的 treeData（兼容 id/value、title/name） */
const toTreeData = (nodes: any[]): any[] =>
  (nodes || []).map((n) => ({
    value: n.id ?? n.value,
    title: n.title ?? n.name ?? n.id,
    children: n.children && n.children.length ? toTreeData(n.children) : undefined,
  }));

/** 在部门树中递归查找节点名称 */
const findDeptName = (nodes: any[], id: any): string | undefined => {
  for (const n of nodes || []) {
    if (String(n.id ?? n.value) === String(id)) return n.title ?? n.name ?? String(id);
    if (n.children?.length) {
      const r = findDeptName(n.children, id);
      if (r) return r;
    }
  }
  return undefined;
};

const MonitorScopePage: React.FC = () => {
  const buttons = usePageButtons('workflow_monitor_scope');
  const actionRef = useRef<ActionType>();
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<MonitorScopeItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<MonitorScopeItem | null>(null);
  const [form] = Form.useForm();
  const [scopeType, setScopeType] = useState<number>(3);

  const [defOptions, setDefOptions] = useState<{ label: string; value: number }[]>([]);
  const [userMap, setUserMap] = useState<Record<string, string>>({});
  const [deptTreeData, setDeptTreeData] = useState<any[]>([]);

  /** 加载列表 + 下拉数据 */
  const loadData = (current = page) => {
    setLoading(true);
    monitorScopeList({ current, pageSize: 20 })
      .then((res: any) => {
        const payload = pickPayload(res) || {};
        setRecords(payload.records || []);
        setTotal(payload.total || 0);
        setPage(current);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData(1);
    listDefinitions()
      .then((res: any) => {
        const list = pickPayload(res) || [];
        setDefOptions(list.map((d: any) => ({ label: d.name || d.id, value: Number(d.id) })));
      })
      .catch(() => setDefOptions([]));
    userList({ current: 1, size: 500 })
      .then((res: any) => {
        const records = (pickPayload(res) || {}).records || [];
        const map: Record<string, string> = {};
        records.forEach((u: any) => {
          map[String(u.id)] = u.name || u.realName || u.account;
        });
        setUserMap(map);
      })
      .catch(() => setUserMap({}));
    deptTree()
      .then((res: any) => setDeptTreeData(toTreeData(pickPayload(res) || [])))
      .catch(() => setDeptTreeData([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreate = () => {
    setEditing(null);
    setScopeType(3);
    form.resetFields();
    form.setFieldsValue({ defId: -1, scopeType: 3 });
    setDrawerOpen(true);
  };

  const openEdit = (record: MonitorScopeItem) => {
    setEditing(record);
    const st = record.scopeType || 3;
    setScopeType(st);
    form.resetFields();
    form.setFieldsValue({
      monitorUserIds: record.monitorUserIds || '',
      defId: record.defId == null || record.defId === -1 ? -1 : record.defId,
      scopeType: st,
      scopeValue: record.scopeValue == null || record.scopeValue === -1 ? undefined : record.scopeValue,
      remark: record.remark || '',
    });
    setDrawerOpen(true);
  };

  const handleSubmit = async () => {
    const v = await form.validateFields();
    const payload: MonitorScopeItem = {
      id: editing?.id,
      defId: v.defId === -1 || v.defId == null ? undefined : Number(v.defId),
      scopeType: v.scopeType,
      scopeValue:
        v.scopeValue == null || v.scopeValue === '' || v.scopeValue === -1
          ? undefined
          : Number(v.scopeValue),
      monitorUserIds: v.monitorUserIds ? String(v.monitorUserIds) : '',
      remark: v.remark || '',
    };
    try {
      if (editing?.id) {
        await updateMonitorScope(payload);
        message.success('已更新');
      } else {
        await saveMonitorScope(payload);
        message.success('已新增');
      }
      setDrawerOpen(false);
      loadData(1);
    } catch (e: any) {
      message.error(e?.msg || '保存失败');
    }
  };

  const handleDelete = async (id?: string) => {
    try {
      await removeMonitorScope(id as string);
      message.success('已删除');
      loadData(1);
    } catch (e: any) {
      message.error(e?.msg || '删除失败');
    }
  };

  const resolveScopeValueName = (record: MonitorScopeItem): string => {
    if (record.scopeValue == null) return '-';
    if (record.scopeType === 3) {
      return userMap[String(record.scopeValue)] || String(record.scopeValue);
    }
    return findDeptName(deptTreeData, record.scopeValue) || String(record.scopeValue);
  };

  const columns: ProColumns<MonitorScopeItem>[] = [
    {
      title: '被委托人',
      dataIndex: 'monitorUserIds',
      render: (_, r) => {
        if (!r.monitorUserIds) return '-';
        const ids = r.monitorUserIds.split(',').filter(Boolean);
        if (!ids.length) return '-';
        return (
          <span>
            {ids.map((id) => (
              <Tag key={id}>{userMap[id] || id}</Tag>
            ))}
          </span>
        );
      },
    },
    {
      title: '流程定义',
      dataIndex: 'defId',
      render: (_, r) =>
        r.defId == null || r.defId === -1 ? (
          <Tag color="default">全部流程</Tag>
        ) : (
          defOptions.find((d) => d.value === r.defId)?.label || r.defId
        ),
    },
    {
      title: '范围类型',
      dataIndex: 'scopeType',
      render: (_, r) => {
        const t = SCOPE_TYPE[r.scopeType as number];
        return t ? <Tag color={t.color}>{t.text}</Tag> : r.scopeType;
      },
    },
    {
      title: '范围值',
      dataIndex: 'scopeValue',
      render: (_, r) => resolveScopeValueName(r),
    },
    { title: '备注', dataIndex: 'remark', ellipsis: true },
    {
      title: '操作',
      valueType: 'option',
      render: (_, r) => [
        <a key="edit" onClick={() => openEdit(r)}>
          编辑
        </a>,
        <Popconfirm key="del" title="确认删除该委托范围？" onConfirm={() => handleDelete(r.id)}>
          <a>删除</a>
        </Popconfirm>,
      ],
    },
  ];

  if (!buttons) return null;

  return (
    <PageContainer
      header={{
        title: '监控委托范围',
        subTitle: '部门/分部/人员级委托：被委托人仅能在流程监控中查看授权范围内的实例',
      }}
    >
      <div style={{ marginBottom: 16 }}>
        <Button type="primary" onClick={openCreate}>
          新增委托范围
        </Button>
      </div>
      <ProTable<MonitorScopeItem>
        actionRef={actionRef}
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={records}
        search={false}
        pagination={{
          total,
          current: page,
          pageSize: 20,
          onChange: (p) => loadData(p),
        }}
        options={false}
      />
      <Modal
        title={editing ? '编辑委托范围' : '新增委托范围'}
        open={drawerOpen}
        onOk={handleSubmit}
        onCancel={() => setDrawerOpen(false)}
        okText="保存"
        cancelText="取消"
        width={560}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="被委托人"
            name="monitorUserIds"
            rules={[{ required: true, message: '请选择被委托人' }]}
          >
            <PersonOrgField browserType={1} multiple />
          </Form.Item>
          <Form.Item label="流程定义" name="defId" extra="留空或选「全部流程」表示覆盖所有流程">
            <Select
              options={[{ label: '全部流程', value: -1 }, ...defOptions]}
              allowClear
            />
          </Form.Item>
          <Form.Item
            label="范围类型"
            name="scopeType"
            rules={[{ required: true, message: '请选择范围类型' }]}
          >
            <Select
              options={[
                { label: '分部', value: 1 },
                { label: '部门', value: 2 },
                { label: '人员', value: 3 },
              ]}
              onChange={(v) => setScopeType(v)}
            />
          </Form.Item>
          {scopeType === 3 ? (
            <Form.Item
              label="范围值（人员）"
              name="scopeValue"
              rules={[{ required: true, message: '请选择人员' }]}
            >
              <PersonOrgField browserType={1} multiple={false} />
            </Form.Item>
          ) : (
            <Form.Item
              label="范围值（部门/分部）"
              name="scopeValue"
              rules={[{ required: true, message: '请选择部门/分部' }]}
            >
              <TreeSelect treeData={deptTreeData} treeDefaultExpandAll showSearch treeNodeFilterProp="title" placeholder="选择部门/分部" />
            </Form.Item>
          )}
          <Form.Item label="备注" name="remark">
            <Input.TextArea rows={3} placeholder="可选" />
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
};

export default MonitorScopePage;
