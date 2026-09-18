import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Form,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd';
import ApprovalFormRender from '@/pages/FormMode/ExcelDesign/components/ApprovalFormRender';
import {
  cleanupWorkflowTest,
  getWorkflowTest,
  listDefinitions,
  listWorkflowTest,
  removeWorkflowTest,
  runWorkflowTest,
  WfTestLogItem,
  WfTestResult,
} from '@/services/workflow';
import { PersonOrgField } from '@/components/FormMode/PersonOrgPicker';
import { dataApi } from '@/services/formmode';
import type { FieldDefinition } from '@/services/formmode';
import FieldRenderer from '@/pages/FormMode/FormView/components/FieldRenderer';

/**
 * 流程测试 / 调试（独立菜单页）
 *
 * 与「流程设计」页内的测试弹窗同源，均为**真实引擎测试**：
 * 临时部署草稿 → 真实发起（实例与待办打 is_test=1 标记）→ 逐节点自动审批到归档 →
 * 用引擎历史活动（ACT_HI_ACTINST）统计覆盖率。
 *
 * 本页额外提供「分支覆盖」：按网关各分支条件反推变量取值，为每个分支再真跑一次实例，
 * 从而验证到**每一条出口**，避免"一组数据只命中一条分支"造成的假阴性。
 * 测试完成后可点「清理测试数据」一键删除（清实例/待办/日志/快照 + 卸载测试部署）。
 */

const NODE_TYPE: Record<number, string> = {
  0: '创建',
  1: '审批',
  2: '提交',
  3: '归档',
  5: '等待',
  6: '自动处理',
  7: '网关',
};

const statusTag = (s?: number) => {
  switch (s) {
    case 1:
      return <Tag color="green">走通</Tag>;
    case 2:
      return <Tag color="red">走不通</Tag>;
    default:
      return <Tag color="default">未走到</Tag>;
  }
};

const testStatusTag = (s?: number) => {
  switch (s) {
    case 1:
      return <Tag color="green">通过</Tag>;
    case 2:
      return <Tag color="orange">中断</Tag>;
    default:
      return <Tag color="red">未通过</Tag>;
  }
};

const linkStatusTag = (s?: number) =>
  s === 1 ? <Tag color="green">已走过</Tag> : <Tag color="default">未走过</Tag>;

const WorkflowTestPage: React.FC = () => {
  const [defs, setDefs] = useState<any[]>([]);
  const [defId, setDefId] = useState<any>(undefined);
  const [testUserId, setTestUserId] = useState<any>(undefined);
  const [coverBranches, setCoverBranches] = useState<boolean>(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WfTestResult | null>(null);
  const [history, setHistory] = useState<WfTestLogItem[]>([]);
  const [logView, setLogView] = useState<{ title: string; content: string } | null>(null);

  // 测试实例会被自动审批到归档，渲染包默认取"当前(结束)节点"→ 看不到开始节点布局。
  // 这里默认选「开始」节点（类型 0），并提供下拉切换查看各节点布局。
  const startNodeKey = useMemo(() => {
    const ns: any[] = result?.nodes || [];
    const start = ns.find((n) => n.nodeType === 0) || ns[0];
    return start?.nodeKey;
  }, [result]);
  const [viewNodeKey, setViewNodeKey] = useState<string | undefined>();
  const effectiveNodeKey = viewNodeKey ?? startNodeKey;

  const [form] = Form.useForm();
  const [formFields, setFormFields] = useState<FieldDefinition[]>([]);
  const [formLoading, setFormLoading] = useState(false);

  const currentDef = useMemo(
    () => defs.find((d) => String(d.id) === String(defId)),
    [defs, defId],
  );
  const formId = currentDef?.formId;

  // 仅展示「激活版本」：按 procKey 分组，组内取 activeVersionId 指向的版本
  // （无锚点则取版本号最大者），并排除已删除；标签标记版本号。
  const activeDefs = useMemo(() => {
    const groups = new Map<string, any[]>();
    (defs || []).forEach((d: any) => {
      if (d.isDeleted) return;
      const key = d.procKey || String(d.id);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(d);
    });
    const out: any[] = [];
    groups.forEach((list) => {
      const anchor = list.find((d) => d.activeVersionId != null)?.activeVersionId;
      let active: any;
      if (anchor != null) {
        active = list.find((d) => String(d.id) === String(anchor));
      } else {
        active = [...list].sort((a: any, b: any) => (b.version ?? 0) - (a.version ?? 0))[0];
      }
      if (active) out.push(active);
    });
    return out;
  }, [defs]);

  const normalizeField = (f: FieldDefinition): any => ({
    ...f,
    options: (f.options || []).map((o) => ({ value: o.optionValue, label: o.optionLabel })),
  });

  const loadDefs = async () => {
    try {
      const res: any = await listDefinitions();
      setDefs(res?.data || []);
    } catch {
      setDefs([]);
    }
  };

  const loadFields = async () => {
    if (!formId) {
      setFormFields([]);
      return;
    }
    try {
      setFormLoading(true);
      const fields = await dataApi.getFieldDefinitions(String(formId));
      setFormFields(fields || []);
    } catch {
      setFormFields([]);
    } finally {
      setFormLoading(false);
    }
  };

  const loadHistory = async () => {
    try {
      const res: any = await listWorkflowTest(defId);
      setHistory(res?.data || []);
    } catch {
      /* 历史加载失败不阻塞使用 */
    }
  };

  useEffect(() => {
    loadDefs();
  }, []);

  useEffect(() => {
    setResult(null);
    form.resetFields();
    setFormFields([]);
    if (defId) {
      loadFields();
      loadHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defId]);

  /** 运行测试：表单字段值作为流程变量下发引擎，驱动网关按真实条件选分支 */
  const run = async () => {
    if (!defId) {
      message.warning('请选择流程');
      return;
    }
    if (!testUserId) {
      message.warning('请选择测试发起人');
      return;
    }
    let formData: Record<string, any> = {};
    if (formId) {
      try {
        formData = await form.validateFields();
      } catch {
        return;
      }
    }
    setLoading(true);
    try {
      const res: any = await runWorkflowTest({ defId, testUserId, formData, coverBranches });
      if (res?.success === false) {
        message.error(res?.msg || '流程测试失败');
        return;
      }
      setResult(res?.data || null);
      loadHistory();
      message.success('测试完成');
    } catch (e: any) {
      message.error(e?.msg || '流程测试失败');
    } finally {
      setLoading(false);
    }
  };

  /** 清理测试数据：删除测试态实例/待办/日志/快照并卸载测试部署 */
  const cleanup = () => {
    Modal.confirm({
      title: '确定清理测试数据吗？',
      content:
        '将删除测试态（is_test=1）的实例/待办/日志/快照，并卸载测试部署（清掉引擎 ACT_* 数据）。不传流程时清理全部。',
      onOk: async () => {
        try {
          const res: any = await cleanupWorkflowTest(defId);
          if (res?.success === false) {
            message.error('清理失败');
            return;
          }
          message.success(`已清理 ${res?.data ?? 0} 条测试实例`);
        } catch (e: any) {
          message.error(e?.msg || '清理失败');
        }
      },
    });
  };

  const viewHistory = async (id: any) => {
    try {
      const res: any = await getWorkflowTest(id);
      const d = res?.data;
      if (!d) {
        message.error('记录不存在');
        return;
      }
      setLogView({
        title: `测试记录 #${id}`,
        content: d.logContent || d.summary || '（无日志）',
      });
    } catch (e: any) {
      message.error(e?.msg || '加载失败');
    }
  };

  const delHistory = (ids: any[]) => {
    Modal.confirm({
      title: `确定删除 ${ids.length} 条测试记录吗？`,
      content: '仅删除测试日志（wf_test_log）；清理测试实例请用「清理测试数据」。',
      onOk: async () => {
        try {
          await removeWorkflowTest(ids);
          message.success('已删除');
          loadHistory();
        } catch (e: any) {
          message.error(e?.msg || '删除失败');
        }
      },
    });
  };

  // 按出口线条顺序对「节点」排序：开始(0) 最前、结束(3) 最后，中间沿 from→to 链路展开
  const sortedNodes = useMemo(() => {
    const ns: any[] = result?.nodes || [];
    if (ns.length === 0) return [];
    const links: any[] = result?.links || [];
    const nodeMap = new Map(ns.map((n) => [n.nodeKey, n]));
    const incoming = new Map<string, number>();
    const outMap = new Map<string, string[]>();
    links.forEach((l) => {
      incoming.set(l.toNodeKey, (incoming.get(l.toNodeKey) || 0) + 1);
      if (!outMap.has(l.fromNodeKey)) outMap.set(l.fromNodeKey, []);
      outMap.get(l.fromNodeKey)!.push(l.toNodeKey);
    });
    const start =
      ns.find((n) => n.nodeType === 0) || ns.find((n) => !incoming.has(n.nodeKey));
    const visited = new Set<string>();
    const order: string[] = [];
    const queue: string[] = start ? [start.nodeKey] : [];
    while (queue.length) {
      const k = queue.shift()!;
      if (visited.has(k)) continue;
      visited.add(k);
      order.push(k);
      (outMap.get(k) || []).forEach((t) => {
        if (!visited.has(t)) queue.push(t);
      });
    }
    // 链路未覆盖到的节点（孤立/异常）追加在末尾，保持原顺序
    ns.forEach((n) => {
      if (!visited.has(n.nodeKey)) {
        visited.add(n.nodeKey);
        order.push(n.nodeKey);
      }
    });
    return order.map((k) => nodeMap.get(k)).filter(Boolean);
  }, [result]);

  const nodeColumns = [
    { title: '节点', dataIndex: 'nodeName', render: (v: string, r: any) => v || r.nodeKey },
    { title: '类型', dataIndex: 'nodeType', render: (v: number) => NODE_TYPE[v] ?? v },
    { title: '经过次数', dataIndex: 'passTimes' },
    { title: '结果', dataIndex: 'status', render: (v: number) => statusTag(v) },
    { title: '说明', dataIndex: 'message', ellipsis: true },
  ];

  const linkColumns = [
    {
      title: '源节点',
      dataIndex: 'fromNodeName',
      render: (v: string, r: any) => v || r.fromNodeKey,
    },
    {
      title: '目标节点',
      dataIndex: 'toNodeName',
      render: (v: string, r: any) => v || r.toNodeKey,
    },
    {
      title: '出口条件',
      dataIndex: 'conditionCn',
      render: (v: string, r: any) =>
        v || r.conditionExpr || <span style={{ color: '#bbb' }}>无条件</span>,
      ellipsis: true,
    },
    { title: '走过次数', dataIndex: 'passTimes' },
    { title: '覆盖', dataIndex: 'status', render: (v: number) => linkStatusTag(v) },
  ];

  const historyColumns = [
    { title: '流程', dataIndex: 'defName', ellipsis: true },
    { title: '测试人', dataIndex: 'testUserName' },
    { title: '时间', dataIndex: 'testTime' },
    { title: '结论', dataIndex: 'testStatus', render: (v: number) => testStatusTag(v) },
    { title: '节点', render: (_: any, r: any) => `${r.nodePassed ?? 0}/${r.nodeTotal ?? 0}` },
    {
      title: '操作',
      render: (_: any, r: any) => (
        <Space size={4}>
          <Button type="link" size="small" onClick={() => viewHistory(r.id)}>
            日志
          </Button>
          <Button type="link" size="small" danger onClick={() => delHistory([r.id])}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 16 }}>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        流程测试 / 调试
      </Typography.Title>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="真实引擎测试"
        description="临时部署草稿 → 真实发起（实例与待办打 is_test=1 标记）→ 自动审批到归档 → 用引擎历史活动统计节点与出口覆盖率。开启「分支覆盖」会按网关各分支条件反推变量取值、为每个分支再真跑一次，验证到每一条出口。测试完成后点「清理测试数据」一键删除。"
      />

      <Card size="small" title="测试配置" style={{ marginBottom: 12 }}>
        <Row gutter={12} align="middle">
          <Col span={8}>
            <Space align="center">
              <span>流程</span>
              <Select
                style={{ width: 260 }}
                placeholder="选择流程（仅激活版本）"
                value={defId}
                onChange={setDefId}
                options={activeDefs.map((d: any) => ({
                  value: d.id,
                  label: `${d.name || d.procKey}（v${d.version ?? '-'}）`,
                }))}
                showSearch
                optionFilterProp="label"
              />
            </Space>
          </Col>
          <Col span={7}>
            <Space align="center">
              <span>测试发起人</span>
              <PersonOrgField
                browserType={1}
                multiple={false}
                value={testUserId}
                onChange={(v: any) => setTestUserId(v || undefined)}
                placeholder="选择人员"
              />
            </Space>
          </Col>
          <Col span={4}>
            <Space align="center">
              <span>分支覆盖</span>
              <Switch checked={coverBranches} onChange={setCoverBranches} />
            </Space>
          </Col>
          <Col span={5}>
            <Space>
              <Button type="primary" loading={loading} onClick={run} disabled={!defId}>
                开始测试
              </Button>
              <Button danger onClick={cleanup}>
                清理测试数据
              </Button>
            </Space>
          </Col>
        </Row>

        {defId && !formId && (
          <Alert
            type="warning"
            showIcon
            style={{ marginTop: 12 }}
            message="该流程未关联表单，无法渲染测试表单（将无法用表单变量驱动网关条件）"
          />
        )}
      </Card>

      {defId && formId && (
        <Card
          size="small"
          title="测试表单（字段值将作为流程变量下发引擎）"
          style={{ marginBottom: 12 }}
        >
          {formLoading ? (
            <span style={{ color: '#999' }}>表单加载中…</span>
          ) : (
            <Form form={form} layout="vertical">
              <Row gutter={12}>
                {formFields.map((f) => (
                  <Col span={8} key={f.fieldName}>
                    <Form.Item
                      name={f.fieldName}
                      label={f.fieldLabel}
                      rules={
                        f.isRequired === 1
                          ? [{ required: true, message: `请输入${f.fieldLabel}` }]
                          : []
                      }
                    >
                      <FieldRenderer field={normalizeField(f)} disabled={f.isReadOnly === 1} />
                    </Form.Item>
                  </Col>
                ))}
              </Row>
              {formFields.length === 0 && (
                <div style={{ color: '#999', fontSize: 12 }}>该表单暂无字段</div>
              )}
            </Form>
          )}
        </Card>
      )}

      {result && (
        <Card size="small" title="测试结果" style={{ marginBottom: 12 }}>
          <Row gutter={16} style={{ marginBottom: 12 }}>
            <Col span={4}>
              <Statistic title="结论" valueRender={() => testStatusTag(result.testStatus)} />
            </Col>
            <Col span={4}>
              <Statistic
                title="节点覆盖"
                value={`${result.nodePassed ?? 0}/${result.nodeTotal ?? 0}`}
              />
            </Col>
            <Col span={4}>
              <Statistic
                title="出口覆盖"
                value={`${result.linkPassed ?? 0}/${result.linkTotal ?? 0}`}
              />
            </Col>
            <Col span={4}>
              <Statistic title="场景数" value={result.scenarioCount ?? 1} />
            </Col>
            <Col span={4}>
              <Statistic title="耗时(ms)" value={result.costMs ?? 0} />
            </Col>
            <Col span={4}>
              <Statistic
                title="走到归档"
                valueRender={() =>
                  result.reachedEnd ? <Tag color="green">是</Tag> : <Tag color="red">否</Tag>
                }
              />
            </Col>
          </Row>
          <Alert
            type={
              result.testStatus === 1 ? 'success' : result.testStatus === 2 ? 'warning' : 'error'
            }
            showIcon
            message={result.summary || '-'}
          />
          {/* 对齐 ecology「自动测试」页：左 = 节点/出口/场景/日志，右 = 真实流程表单界面 */}
          <Row gutter={12} style={{ marginTop: 12 }}>
            <Col span={10}>
              <Tabs
                style={{ marginTop: 12 }}
                items={[
              {
                key: 'nodes',
                label: `节点 (${result.nodePassed ?? 0}/${result.nodeTotal ?? 0})`,
                children: (
                  <Table
                    size="small"
                    rowKey="nodeKey"
                    pagination={false}
                    dataSource={sortedNodes}
                    columns={nodeColumns}
                  />
                ),
              },
              {
                key: 'links',
                label: `出口 (${result.linkPassed ?? 0}/${result.linkTotal ?? 0})`,
                children: (
                  <Table
                    size="small"
                    rowKey={(r: any) => `${r.fromNodeKey}→${r.toNodeKey}`}
                    pagination={false}
                    dataSource={result.links || []}
                    columns={linkColumns}
                  />
                ),
              },
              {
                key: 'scenarios',
                label: `场景 (${result.scenarioCount ?? 1})`,
                children: (
                  <Table
                    size="small"
                    rowKey="index"
                    pagination={false}
                    dataSource={result.scenarios || []}
                    columns={[
                      { title: '#', dataIndex: 'index' },
                      { title: '场景', dataIndex: 'label' },
                      { title: '结论', dataIndex: 'testStatus', render: (v: number) => testStatusTag(v) },
                      {
                        title: '经过节点',
                        dataIndex: 'path',
                        render: (v: string[]) => (v || []).join(' → ') || '-',
                        ellipsis: true,
                      },
                      { title: '说明', dataIndex: 'summary', ellipsis: true },
                    ]}
                  />
                ),
              },
              {
                key: 'log',
                label: '日志',
                children: (
                  <pre style={{ maxHeight: 320, overflow: 'auto', margin: 0, fontSize: 12 }}>
                    {(result.log || []).join('\n') || '（无日志）'}
                  </pre>
                ),
              },
                ]}
              />
            </Col>
            <Col span={14}>
              <Card
                size="small"
                title={`流程表单（测试实例 #${result.instId ?? '-'}）`}
                extra={
                  (result.nodes || []).length > 0 && (
                    <Space size={4}>
                      <span style={{ fontSize: 12, color: '#888' }}>查看节点</span>
                      <Select
                        size="small"
                        style={{ width: 200 }}
                        value={effectiveNodeKey}
                        onChange={(v: string) => setViewNodeKey(v)}
                        options={(result.nodes || []).map((n: any) => ({
                          value: n.nodeKey,
                          label: `${n.nodeName || n.nodeKey}（${NODE_TYPE[n.nodeType] ?? n.nodeType}）`,
                        }))}
                      />
                    </Space>
                  )
                }
              >
                {result.instId ? (
                  <ApprovalFormRender instanceId={result.instId} nodeKey={effectiveNodeKey} />
                ) : (
                  <Empty
                    description={
                      <div>
                        <div>未取到测试实例ID，无法渲染真实表单</div>
                        <div style={{ marginTop: 4, fontSize: 12, color: '#999' }}>
                          流程已走通，但后端 /test/run 未回传 instId —— 请确认已重新编译并重启
                          blade-workflow 服务后重跑测试
                        </div>
                      </div>
                    }
                  />
                )}
              </Card>
            </Col>
          </Row>
        </Card>
      )}

      <Card size="small" title="测试历史">
        <Table
          size="small"
          rowKey="id"
          dataSource={history}
          columns={historyColumns}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title={logView?.title}
        open={!!logView}
        onCancel={() => setLogView(null)}
        footer={null}
        width={760}
      >
        <pre style={{ maxHeight: 460, overflow: 'auto', margin: 0, fontSize: 12 }}>
          {logView?.content}
        </pre>
      </Modal>
    </div>
  );
};

export default WorkflowTestPage;
