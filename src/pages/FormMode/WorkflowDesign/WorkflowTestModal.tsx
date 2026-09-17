import React, { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Form,
  Modal,
  Space,
  Table,
  Tabs,
  Tag,
  message,
} from 'antd';
import {
  getWorkflowTest,
  listWorkflowTest,
  removeWorkflowTest,
  runWorkflowTest,
  cleanupWorkflowTest,
  WfTestLogItem,
  WfTestResult,
} from '@/services/workflow';
import { PersonOrgField } from '@/components/FormMode/PersonOrgPicker';
import { dataApi } from '@/services/formmode';
import type { FieldDefinition } from '@/services/formmode';
import FieldRenderer from '@/pages/FormMode/FormView/components/FieldRenderer';

export interface WorkflowTestModalProps {
  open: boolean;
  /** 流程定义ID */
  defId: any;
  /** 流程名称（展示用） */
  defName?: string;
  /** 关联表单ID（渲染真实测试表单；缺省则无法渲染） */
  formId?: any;
  onClose: () => void;
}

const NODE_TYPE = ['创建', '审批', '提交', '归档', '等待', '自动'];

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

/**
 * 流程测试弹窗（设计期校验，真实引擎 + 真实表单 + 测试态标记）。
 *
 * 对齐 ecology「流程测试」：渲染真实表单 → 选定测试发起人 → 真实发起（测试态标记）→
 * 自动跑到归档，基于历史活动统计覆盖率；测试数据可一键清理，不污染正常流程数据。
 * 表单字段值作为流程变量下发引擎，驱动排他网关按真实条件选分支。
 */
const WorkflowTestModal: React.FC<WorkflowTestModalProps> = ({
  open,
  defId,
  defName,
  formId,
  onClose,
}) => {
  const [testUserId, setTestUserId] = useState<any>(undefined);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WfTestResult | null>(null);
  const [history, setHistory] = useState<WfTestLogItem[]>([]);
  const [logView, setLogView] = useState<{ title: string; content: string } | null>(null);

  // 真实测试表单
  const [form] = Form.useForm();
  const [formFields, setFormFields] = useState<FieldDefinition[]>([]);
  const [formLoading, setFormLoading] = useState(false);

  /** 加载历史测试记录 */
  const loadHistory = async () => {
    try {
      const res: any = await listWorkflowTest(defId);
      setHistory(res?.data || []);
    } catch {
      /* 历史加载失败不阻塞使用 */
    }
  };

  /** 加载测试表单字段定义 */
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

  useEffect(() => {
    if (open) {
      setResult(null);
      form.resetFields();
      loadHistory();
      loadFields();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defId, formId]);

  /** 运行测试：表单字段值作为网关条件变量下发引擎 */
  const run = async () => {
    if (!testUserId) {
      message.warning('请选择测试发起人');
      return;
    }
    let formData: Record<string, any> = {};
    if (formId) {
      try {
        formData = await form.validateFields();
      } catch {
        // 表单校验未通过
        return;
      }
    }
    setLoading(true);
    try {
      const res: any = await runWorkflowTest({ defId, testUserId, formData });
      if (res?.success === false) {
        message.error(res?.msg || '流程测试失败');
        return;
      }
      setResult(res?.data || null);
      loadHistory();
    } catch (e: any) {
      message.error(e?.msg || '流程测试失败');
    } finally {
      setLoading(false);
    }
  };

  /** 清理测试数据：删除全部测试态实例/待办/日志/快照，并卸载测试部署 */
  const cleanup = () => {
    Modal.confirm({
      title: '确定清理全部测试数据吗？',
      content:
        '将删除所有测试态（is_test=1）的实例/待办/日志/快照，并卸载测试部署（清掉引擎 ACT_* 数据）。',
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

  /** 下载当前测试日志 */
  const downloadLog = () => {
    const text = (result?.log || []).join('\n');
    if (!text) {
      message.warning('暂无日志可下载');
      return;
    }
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `流程测试日志_${defName || defId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /** 查看历史记录详情 */
  const viewHistory = async (id: any) => {
    try {
      const res: any = await getWorkflowTest(id);
      const d = res?.data;
      if (!d) {
        message.error('记录不存在');
        return;
      }
      setLogView({
        title: `${d.testUserName || d.testUserId} 于 ${d.testTime} 的测试`,
        content: d.logContent || '',
      });
    } catch {
      message.error('加载失败');
    }
  };

  /** 删除历史记录 */
  const delHistory = async (id: any) => {
    Modal.confirm({
      title: '确定删除这条测试记录吗？',
      onOk: async () => {
        const res: any = await removeWorkflowTest([id]);
        if (res?.success === false) {
          message.error('删除失败');
          return;
        }
        message.success('已删除');
        loadHistory();
      },
    });
  };

  /** 归一化字段（FieldRenderer 的 options 取 value/label，而字段定义是 optionValue/optionLabel） */
  const normalizeField = (f: FieldDefinition): any => ({
    ...f,
    options: (f.options || []).map((o) => ({ value: o.optionValue, label: o.optionLabel })),
  });

  const nodeRows = (result?.nodes || []).map((n) => ({
    ...n,
    key: n.nodeKey,
  }));

  return (
    <Modal
      title={`流程测试${defName ? ` - ${defName}` : ''}`}
      open={open}
      onCancel={onClose}
      width={860}
      footer={
        <Space>
          <Button danger onClick={cleanup}>
            删除测试数据
          </Button>
          <Button onClick={onClose}>关闭</Button>
          <Button type="primary" loading={loading} onClick={run}>
            开始测试
          </Button>
        </Space>
      }
      destroyOnClose
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="流程测试（真实引擎）：选定测试发起人、填写真实表单后开始测试；系统会把草稿流程临时部署到 Flowable 真实发起，自动跑到归档，并基于历史活动统计节点覆盖率。产生的实例/待办均打测试标记，点「删除测试数据」可一键清掉。"
      />

      <Space align="center" style={{ marginBottom: 12 }}>
        <span>测试发起人</span>
        {/* 复用项目统一的人员选择控件（E9 浏览框风格），值为 userId 逗号串 */}
        <PersonOrgField
          browserType={1}
          multiple={false}
          value={testUserId}
          onChange={(v: any) => setTestUserId(v || undefined)}
          placeholder="选择人员"
        />
      </Space>

      {formId ? (
        <Card
          size="small"
          title="测试表单（真实表单，字段值作为流程变量驱动网关条件）"
          style={{ marginBottom: 12 }}
        >
          {formLoading ? (
            <div style={{ color: '#999' }}>加载中...</div>
          ) : (
            <Form form={form} layout="vertical">
              {formFields.map((f) => (
                <Form.Item
                  key={f.id}
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
              ))}
              {formFields.length === 0 && (
                <div style={{ color: '#999', fontSize: 12 }}>该表单暂无字段</div>
              )}
            </Form>
          )}
        </Card>
      ) : (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message="该流程未关联表单，无法渲染测试表单（请先在流程定义中绑定表单后再测试）。"
        />
      )}

      <Tabs
        defaultActiveKey="current"
        items={[
          {
            key: 'current',
            label: '本次测试',
            children: result ? (
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <Alert
                  type={result.testStatus === 1 ? 'success' : 'error'}
                  showIcon
                  message={result.summary}
                  description={`节点 ${result.nodePassed}/${result.nodeTotal} 走通 ｜ 耗时 ${result.costMs}ms ｜ ${
                    result.reachedEnd ? '已到达归档节点' : '未到达归档节点'
                  }`}
                />
                <Card
                  size="small"
                  title="节点经过次数"
                  extra={
                    <Button size="small" onClick={downloadLog}>
                      下载日志
                    </Button>
                  }
                >
                  <Table
                    size="small"
                    rowKey="key"
                    dataSource={nodeRows}
                    pagination={false}
                    scroll={{ y: 220 }}
                    columns={[
                      {
                        title: '节点',
                        dataIndex: 'nodeName',
                        render: (v: string, r: any) => (
                          <Space size={6}>
                            {v || r.nodeKey}
                            <Tag>{NODE_TYPE[r.nodeType ?? 0]}</Tag>
                          </Space>
                        ),
                      },
                      {
                        title: '经过次数',
                        dataIndex: 'passTimes',
                        width: 90,
                      },
                      {
                        title: '操作者',
                        dataIndex: 'operators',
                        render: (ops: any[]) =>
                          ops && ops.length ? (
                            <span>
                              {ops
                                .map((o) => `${o.userName || o.userId}（${o.userId}）`)
                                .join('、')}
                            </span>
                          ) : (
                            <span style={{ color: '#999' }}>无</span>
                          ),
                      },
                      {
                        title: '结果',
                        dataIndex: 'status',
                        width: 90,
                        render: (s: number) => statusTag(s),
                      },
                      {
                        title: '说明',
                        dataIndex: 'message',
                      },
                    ]}
                  />
                </Card>
                <Card size="small" title="测试日志">
                  <div
                    style={{
                      maxHeight: 220,
                      overflow: 'auto',
                      fontSize: 12,
                      lineHeight: '20px',
                      whiteSpace: 'pre-wrap',
                      fontFamily: 'monospace',
                    }}
                  >
                    {(result.log || []).join('\n')}
                  </div>
                </Card>
              </Space>
            ) : (
              <div style={{ color: '#999', fontSize: 12 }}>
                选择测试发起人、填写测试表单后点「开始测试」，将展示逐节点的经过次数、操作者与测试日志。
              </div>
            ),
          },
          {
            key: 'history',
            label: `历史记录（${history.length}）`,
            children: (
              <Table<WfTestLogItem>
                size="small"
                rowKey="id"
                dataSource={history}
                pagination={false}
                locale={{ emptyText: '暂无测试记录' }}
                columns={[
                  { title: '测试时间', dataIndex: 'testTime', width: 170 },
                  { title: '发起人', dataIndex: 'testUserName', width: 120 },
                  {
                    title: '结论',
                    dataIndex: 'testStatus',
                    width: 90,
                    render: (s: number) => testStatusTag(s),
                  },
                  {
                    title: '节点',
                    width: 90,
                    render: (_: any, r: WfTestLogItem) => `${r.nodePassed}/${r.nodeTotal}`,
                  },
                  { title: '摘要', dataIndex: 'summary', ellipsis: true },
                  {
                    title: '操作',
                    width: 110,
                    render: (_: any, r: WfTestLogItem) => (
                      <Space size={4}>
                        <a onClick={() => viewHistory(r.id)}>查看</a>
                        <a onClick={() => delHistory(r.id)}>删除</a>
                      </Space>
                    ),
                  },
                ]}
              />
            ),
          },
        ]}
      />

      <Modal
        title={logView?.title}
        open={!!logView}
        onCancel={() => setLogView(null)}
        footer={<Button onClick={() => setLogView(null)}>关闭</Button>}
        width={720}
        destroyOnClose
      >
        <div
          style={{
            maxHeight: 420,
            overflow: 'auto',
            fontSize: 12,
            lineHeight: '20px',
            whiteSpace: 'pre-wrap',
            fontFamily: 'monospace',
          }}
        >
          {logView?.content}
        </div>
      </Modal>
    </Modal>
  );
};

export default WorkflowTestModal;
