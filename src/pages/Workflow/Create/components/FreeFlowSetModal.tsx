import { Alert, Button, Checkbox, Input, Modal, Select, Space, Table, Typography, message } from 'antd';
import React, { useEffect, useState } from 'react';
import { PersonOrgField } from '@/components/FormMode/PersonOrgPicker';
import { getFreeFlowSteps, saveFreeFlowSteps } from '@/services/workflow';
import type { FreeFlowStep } from '@/services/workflow';

const { Text } = Typography;
const TEMPLATE_KEY = 'wf_free_flow_templates';

const SIGN_OPTIONS = [
  { value: 0, label: '非会签' },
  { value: 1, label: '会签' },
  { value: 2, label: '依次逐个' },
];

interface TemplateItem {
  name: string;
  steps: FreeFlowStep[];
}

const readTemplates = (): TemplateItem[] => {
  const raw = localStorage.getItem(TEMPLATE_KEY);
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
};

export interface FreeFlowSetModalProps {
  open: boolean;
  instId?: string;
  onClose: () => void;
  onSaved?: () => void;
}

/** 办理页「流转设定」：按本次单据编排步骤；模板保存在浏览器本地。 */
const FreeFlowSetModal: React.FC<FreeFlowSetModalProps> = ({ open, instId, onClose, onSaved }) => {
  const [steps, setSteps] = useState<FreeFlowStep[]>([]);
  const [version, setVersion] = useState<number>(0);
  const [poolSize, setPoolSize] = useState<number>(5);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);

  useEffect(() => {
    if (!open || !instId) return;
    setLoading(true);
    setTemplates(readTemplates());
    getFreeFlowSteps(instId)
      .then((r: any) => {
        const d = r?.data;
        setSteps(Array.isArray(d?.steps) ? d.steps : []);
        setVersion(Number(d?.version ?? 0));
        setPoolSize(Number(d?.poolSize ?? 5));
      })
      .catch((e: unknown) => {
        console.error(e);
        message.error('读取流转设定失败');
      })
      .finally(() => setLoading(false));
  }, [open, instId]);

  const update = (index: number, patch: Partial<FreeFlowStep>) => {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const addStep = () => {
    if (steps.length >= poolSize) {
      message.warning(`最多 ${poolSize} 步，请到流程设计器调大「通用节点数量」并重新发布`);
      return;
    }
    setSteps((prev) => [
      ...prev,
      { flowOrder: prev.length + 1, nodeName: `步骤${prev.length + 1}`, operatorIds: [], signType: 0 },
    ]);
  };

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= steps.length) return;
    setSteps((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const save = () => {
    if (!instId) return;
    if (steps.length === 0) {
      message.warning('请至少添加一个步骤');
      return;
    }
    const normalized = steps.map((s, i) => ({ ...s, flowOrder: i + 1 }));
    if (normalized.some((s) => !s.operatorIds || s.operatorIds.length === 0)) {
      message.warning('每一步都必须指定办理人');
      return;
    }
    setSaving(true);
    saveFreeFlowSteps({
      instId,
      steps: normalized,
      version,
      saveToken: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    })
      .then((r: any) => {
        if (r?.code !== undefined && r.code !== 200) {
          message.error(r?.msg || '保存失败');
          return;
        }
        setVersion(Number(r?.data ?? version + 1));
        message.success('流转设定已保存');
        onSaved?.();
        onClose();
      })
      .catch((e: any) => {
        console.error(e);
        message.error(e?.msg || e?.message || '保存失败');
      })
      .finally(() => setSaving(false));
  };

  const saveAsTemplate = () => {
    const name = window.prompt('模板名称');
    if (!name) return;
    const next = [...readTemplates().filter((t) => t.name !== name), { name, steps }];
    localStorage.setItem(TEMPLATE_KEY, JSON.stringify(next));
    setTemplates(next);
    message.success('已保存为本地模板');
  };

  const importTemplate = (name: string) => {
    const t = readTemplates().find((x) => x.name === name);
    if (!t) return;
    if (t.steps.length > poolSize) {
      message.warning(`模板有 ${t.steps.length} 步，超过当前节点池容量 ${poolSize}`);
      return;
    }
    setSteps(t.steps.map((s, i) => ({ ...s, flowOrder: i + 1 })));
    message.info('已导入模板，请确认后保存');
  };

  const columns = [
    {
      title: '顺序',
      width: 70,
      render: (_: unknown, __: FreeFlowStep, i: number) => i + 1,
    },
    {
      title: '步骤名称',
      width: 170,
      render: (_: unknown, row: FreeFlowStep, i: number) => (
        <Input
          value={row.nodeName}
          placeholder="步骤名称"
          onChange={(e) => update(i, { nodeName: e.target.value })}
        />
      ),
    },
    {
      title: '办理人',
      render: (_: unknown, row: FreeFlowStep, i: number) => (
        <PersonOrgField
          browserType={1}
          multiple
          value={(row.operatorIds || []).join(',')}
          onChange={(val: any) =>
            update(i, {
              operatorIds: String(val || '')
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean) as unknown as number[],
            })
          }
          placeholder="选择办理人"
        />
      ),
    },
    {
      title: '会签',
      width: 120,
      render: (_: unknown, row: FreeFlowStep, i: number) => (
        <Select
          style={{ width: '100%' }}
          value={row.signType ?? 0}
          options={SIGN_OPTIONS}
          onChange={(val) => update(i, { signType: val })}
        />
      ),
    },
    {
      title: '定稿取号',
      width: 90,
      render: (_: unknown, row: FreeFlowStep, i: number) => (
        <Checkbox
          checked={!!row.isFinalize}
          onChange={(e) => update(i, { isFinalize: e.target.checked })}
        />
      ),
    },
    {
      title: '操作',
      width: 130,
      render: (_: unknown, row: FreeFlowStep, i: number) => (
        <Space size={4}>
          <Button size="small" onClick={() => move(i, -1)} disabled={i === 0}>↑</Button>
          <Button size="small" onClick={() => move(i, 1)} disabled={i === steps.length - 1}>↓</Button>
          <Button size="small" danger onClick={() => setSteps((p) => p.filter((_, x) => x !== i))}>删</Button>
        </Space>
      ),
    },
  ];

  return (
    <Modal
      title="流转设定"
      open={open}
      onCancel={onClose}
      onOk={save}
      okText="保存设置"
      confirmLoading={saving}
      width={980}
      destroyOnHidden
      footer={null}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <Space wrap>
          <Button onClick={addStep}>添加步骤</Button>
          <Button onClick={saveAsTemplate}>另存为模板</Button>
          <Select
            style={{ width: 200 }}
            placeholder="从本地模板导入"
            value={undefined}
            onChange={importTemplate}
            options={templates.map((t) => ({ value: t.name, label: t.name }))}
          />
          <Button type="primary" loading={saving} onClick={save}>保存设置</Button>
        </Space>
        <Alert
          type="info"
          showIcon
          message={`本次单据可编排 ${steps.length}/${poolSize} 步；定稿取号与套红必做点由勾选列指定。`}
          description="模板保存在当前浏览器本地（localStorage），不跨设备同步。保存后请到办理页用「下一步设置」逐段提交。"
        />
        <Table
          rowKey={(_, i) => String(i)}
          size="small"
          loading={loading}
          pagination={false}
          dataSource={steps}
          columns={columns as any}
          locale={{ emptyText: <Text type="secondary">尚未编排步骤，点「添加步骤」开始</Text> }}
        />
      </Space>
    </Modal>
  );
};

export default FreeFlowSetModal;
