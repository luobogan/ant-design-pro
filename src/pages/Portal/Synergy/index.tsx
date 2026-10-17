import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Typography,
  message,
} from 'antd';
import { DeleteOutlined, ReloadOutlined, SaveOutlined } from '@ant-design/icons';
import { portalApi } from '@/services/portal';
import { usePageButtons } from '@/hooks/usePageButtons';
import type { PortalSynergyArea, WorkflowOption } from '@/services/portal';

const { Text } = Typography;

type AreaType = 'workflow' | 'form' | 'node';
const AREA_LABELS: Record<AreaType, string> = {
  workflow: '流程协同',
  form: '流程表单协同',
  node: '流程节点协同',
};
const AREA_DESC: Record<AreaType, string> = {
  workflow: '把某个流程绑定到门户面板，展示该流程的待办/发起入口。',
  form: '把某个流程的表单字段映射到门户面板展示（选择要展示的字段）。',
  node: '把某个流程的特定节点绑定到门户面板，展示该节点的待办。',
};

interface FieldVO {
  key?: string;
  label?: string;
  control?: string;
}

const SynergyTab: React.FC<{ areaType: AreaType }> = ({ areaType }) => {
  const { buttons } = usePageButtons('portal');
  const canManage = buttons.some((b: any) => b.code === 'portal_synergy_manage');

  const [list, setList] = useState<PortalSynergyArea[]>([]);
  const [wfOptions, setWfOptions] = useState<WorkflowOption[]>([]);
  const [nodeOptions, setNodeOptions] = useState<WorkflowOption[]>([]);
  const [wfFields, setWfFields] = useState<FieldVO[]>([]);
  const [loading, setLoading] = useState(false);

  const [editingId, setEditingId] = useState<number | undefined>();
  const [bindId, setBindId] = useState<string>('');
  const [bindName, setBindName] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [nodeId, setNodeId] = useState<string>('');
  const [nodeName, setNodeName] = useState<string>('');
  const [formId, setFormId] = useState<string>('');
  const [enabled, setEnabled] = useState<number>(1);
  const [width, setWidth] = useState<number>(12);
  const [fieldKeys, setFieldKeys] = useState<string[]>([]);
  const [paramsText, setParamsText] = useState<string>('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tree, opts] = await Promise.all([portalApi.getSynergyTree(), portalApi.getSynergyWorkflowOptions()]);
      setList(tree?.[areaType] ?? []);
      setWfOptions(opts || []);
    } catch (e) {
      console.error('[portal] 加载协同区失败', e);
      message.error('加载协同区失败');
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [areaType]);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setEditingId(undefined);
    setBindId('');
    setBindName('');
    setTitle('');
    setNodeId('');
    setNodeName('');
    setFormId('');
    setEnabled(1);
    setWidth(12);
    setFieldKeys([]);
    setParamsText('');
    setNodeOptions([]);
    setWfFields([]);
  };

  const onBindChange = async (val: string) => {
    const opt = wfOptions.find((o) => o.value === val);
    setBindId(val);
    setBindName(opt?.label || '');
    setNodeId('');
    setNodeName('');
    setFieldKeys([]);
    if (areaType === 'node') {
      try {
        setNodeOptions((await portalApi.getSynergyNodeOptions(val)) || []);
      } catch {
        setNodeOptions([]);
      }
    }
    if (areaType === 'form') {
      try {
        setWfFields((await portalApi.getSynergyWfFields(val)) || []);
      } catch {
        setWfFields([]);
      }
    }
  };

  const onEdit = (row: PortalSynergyArea) => {
    setEditingId(row.id);
    setBindId(row.bindId || '');
    setBindName(row.bindName || '');
    setTitle(row.title || '');
    setNodeId(row.nodeId || '');
    setNodeName(row.nodeName || '');
    setFormId(row.formId || '');
    setEnabled(row.enabled ?? 1);
    setWidth(row.width ?? 12);
    if (areaType === 'form' && row.paramsJson) {
      try {
        setFieldKeys(JSON.parse(row.paramsJson));
        setParamsText('');
      } catch {
        setFieldKeys([]);
        setParamsText(row.paramsJson);
      }
    } else {
      setParamsText(row.paramsJson || '');
      setFieldKeys([]);
    }
    if (areaType === 'node' && row.bindId) {
      portalApi.getSynergyNodeOptions(row.bindId).then((opts) => setNodeOptions(opts || [])).catch(() => setNodeOptions([]));
    }
    if (areaType === 'form' && row.bindId) {
      portalApi.getSynergyWfFields(row.bindId).then((f) => setWfFields(f || [])).catch(() => setWfFields([]));
    }
  };

  const buildParamsJson = (): string => {
    if (areaType === 'form') {
      return JSON.stringify(fieldKeys);
    }
    return paramsText.trim() || '{}';
  };

  const handleSave = async () => {
    if (!bindId) {
      message.warning('请先选择绑定流程');
      return;
    }
    const dto: Partial<PortalSynergyArea> = {
      id: editingId,
      areaType,
      title: title || bindName,
      bindId,
      bindName,
      nodeId: areaType === 'node' ? nodeId : '',
      nodeName: areaType === 'node' ? nodeName : '',
      formId: areaType === 'form' ? formId : '',
      enabled,
      width,
      paramsJson: buildParamsJson(),
    };
    try {
      const ok = await portalApi.saveSynergy(dto);
      if (ok) {
        message.success(editingId ? '已更新' : '已新增');
        resetForm();
        load();
      } else {
        message.error('保存失败');
      }
    } catch (e) {
      console.error('[portal] 保存协同区失败', e);
      message.error('保存失败');
    }
  };

  const handleRemove = async (id?: number) => {
    if (id == null) return;
    try {
      const ok = await portalApi.removeSynergy(id);
      if (ok) {
        message.success('已注销');
        if (editingId === id) resetForm();
        load();
      } else {
        message.error('注销失败');
      }
    } catch (e) {
      console.error('[portal] 注销协同区失败', e);
      message.error('注销失败');
    }
  };

  const handleToggle = async (row: PortalSynergyArea, next: number) => {
    try {
      await portalApi.setSynergyEnabled(row.id ?? 0, next);
      load();
    } catch {
      message.error('操作失败');
    }
  };

  const columns = [
    {
      title: '标题/流程',
      key: 'title',
      render: (_: any, row: PortalSynergyArea) => (
        <Space direction="vertical" size={0}>
          <Text strong>{row.title || row.bindName}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {row.bindName}
            {row.nodeName ? ` / ${row.nodeName}` : ''}
          </Text>
        </Space>
      ),
    },
    {
      title: '宽度',
      dataIndex: 'width',
      key: 'width',
      width: 70,
      render: (v: number) => `${v || 12}/24`,
    },
    {
      title: '启用',
      key: 'enabled',
      width: 80,
      render: (_: any, row: PortalSynergyArea) =>
        canManage ? (
          <Switch
            checked={row.enabled === 1}
            onChange={(c) => handleToggle(row, c ? 1 : 0)}
            disabled={!canManage}
          />
        ) : (
          <Text type={row.enabled === 1 ? 'success' : 'secondary'}>{row.enabled === 1 ? '启用' : '禁用'}</Text>
        ),
    },
    {
      title: '操作',
      key: 'op',
      width: 140,
      render: (_: any, row: PortalSynergyArea) => (
        <Space>
          <Button type="link" size="small" disabled={!canManage} onClick={() => onEdit(row)}>
            编辑
          </Button>
          <Popconfirm title="确认注销该协同区？" onConfirm={() => handleRemove(row.id)} disabled={!canManage}>
            <Button type="link" size="small" danger disabled={!canManage}>
              注销
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card
      size="small"
      title={AREA_LABELS[areaType]}
      extra={
        <Button icon={<ReloadOutlined />} size="small" onClick={load}>
          刷新
        </Button>
      }
    >
      <Alert type="info" showIcon style={{ marginBottom: 12 }} message={AREA_DESC[areaType]} />
      <Form layout="vertical" style={{ marginBottom: 16, opacity: canManage ? 1 : 0.6 }}>
        <Row gutter={12}>
          <Col span={8}>
            <Form.Item label="绑定流程" required>
              <Select
                placeholder="选择已发布流程"
                value={bindId || undefined}
                onChange={onBindChange}
                options={wfOptions.map((o) => ({ value: o.value, label: o.label }))}
                disabled={!canManage}
                showSearch
                optionFilterProp="label"
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="显示标题">
              <Input
                placeholder="留空则用流程名"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={!canManage}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="宽度(1-24)">
              <InputNumber
                min={1}
                max={24}
                value={width}
                onChange={(v) => setWidth(v ?? 12)}
                disabled={!canManage}
                style={{ width: '100%' }}
              />
            </Form.Item>
          </Col>
          {areaType === 'node' && (
            <Col span={8}>
              <Form.Item label="绑定节点">
                <Select
                  placeholder="选择流程节点"
                  value={nodeId || undefined}
                  onChange={(v) => {
                    setNodeId(v);
                    const opt = nodeOptions.find((o) => o.value === v);
                    setNodeName(opt?.label || '');
                  }}
                  options={nodeOptions.map((o) => ({ value: o.value, label: o.label }))}
                  disabled={!canManage || !bindId}
                  showSearch
                  optionFilterProp="label"
                />
              </Form.Item>
            </Col>
          )}
          {areaType === 'form' && (
            <Col span={16}>
              <Form.Item label="展示字段（选择要映射的表单字段）">
                <Select
                  mode="multiple"
                  placeholder={bindId ? '选择字段' : '请先选择流程'}
                  value={fieldKeys}
                  onChange={setFieldKeys}
                  options={wfFields.map((f) => ({ value: f.key, label: `${f.label}（${f.key}）` }))}
                  disabled={!canManage || !bindId}
                  showSearch
                  optionFilterProp="label"
                />
              </Form.Item>
            </Col>
          )}
        </Row>
        {areaType !== 'form' && (
          <Form.Item label="扩展参数(JSON)">
            <Input.TextArea
              rows={2}
              placeholder='如 {"max":5,"sortField":"createTime"}'
              value={paramsText}
              onChange={(e) => setParamsText(e.target.value)}
              disabled={!canManage}
            />
          </Form.Item>
        )}
        <Space>
          <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} disabled={!canManage}>
            {editingId ? '保存修改' : '新增协同区'}
          </Button>
          {editingId && (
            <Button icon={<DeleteOutlined />} onClick={resetForm} disabled={!canManage}>
              取消编辑
            </Button>
          )}
        </Space>
      </Form>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={list}
        columns={columns as any}
        pagination={false}
        size="middle"
      />
    </Card>
  );
};

const PortalSynergyPage: React.FC = () => {
  const { buttons } = usePageButtons('portal');
  const canManage = buttons.some((b: any) => b.code === 'portal_synergy_manage');
  return (
    <div style={{ padding: 16 }}>
      {!canManage && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="只读模式：需要「协同区」按钮权限才能新增/编辑/注销"
        />
      )}
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 12 }}
        message="本期实现流程/流程表单/流程节点三类协同（知识型延后）。绑定流程/节点/字段均深度对接 blade-workflow（经其内部 Feign 端点拉取真实数据）；首页渲染面板为后续消费点。"
      />
      <Tabs
        items={(['workflow', 'form', 'node'] as AreaType[]).map((t) => ({
          key: t,
          label: AREA_LABELS[t],
          children: <SynergyTab areaType={t} />,
        }))}
      />
    </div>
  );
};

export default PortalSynergyPage;
