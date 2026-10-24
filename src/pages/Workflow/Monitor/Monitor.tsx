import { useModel, useAccess } from '@umijs/max';
import { PageContainer } from '@ant-design/pro-components';
import StandardTable from '@/components/StandardTable';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { Badge, Button, Card, Popconfirm, Modal, Input, Select, Statistic, Tag, message, Space } from 'antd';
import type { ProFormInstance } from '@ant-design/pro-components';
import { useEffect, useRef, useState } from 'react';
import {
  monitorList,
  forceRecallInstance,
  forceArchiveInstance,
  deleteInstanceById,
  batchMonitorAction,
  stopInstance,
  resumeInstance,
  cancelInstance,
  urgeTask,
  listNodes,
  monitorAnomalySummary,
  cleanupWorkflowTest,
  listDefinitions,
} from '@/services/workflow';
import { list as userList } from '@/services/system/user';
import type {
  MonitorInstanceItem,
  MonitorBatchResult,
  MonitorAnomalySummary,
  WfProcessNode,
} from '@/services/workflow';
import MonitorDetailDrawer from './MonitorDetailDrawer';
import { pickPayload } from '@/utils/utils';

/** 实例状态：0运行中 1通过 2不通过 3撤销 4暂停 5草稿 */
const INSTANCE_STATUS: Record<number, { text: string; color: string }> = {
  0: { text: '运行中', color: 'processing' },
  1: { text: '通过', color: 'success' },
  2: { text: '不通过', color: 'error' },
  3: { text: '撤销', color: 'default' },
  4: { text: '暂停', color: 'warning' },
  5: { text: '草稿', color: 'warning' },
};

/** 异常聚合卡片：点击后写入检索表单对应维度（与列 search.transform 的入参一致） */
const ANOMALY_CARDS = [
  { key: 'overdue', title: '超时', patch: { overdueFilter: 'true' } },
  { key: 'businessRowMissing', title: '业务行缺失', patch: { anomalyTypesFilter: [1] } },
  { key: 'requestIdUnbound', title: 'requestId未回填', patch: { anomalyTypesFilter: [2] } },
  { key: 'deploymentDrift', title: '部署漂移', patch: { anomalyTypesFilter: [3] } },
  { key: 'testInstances', title: '测试实例', patch: { isTestFilter: 1 } },
];

/** 异常类型 → 编码（与后端 MonitorInstanceQuery.anomalyTypes 对齐：1业务行缺失 2requestId未回填 3部署漂移） */
const ANOMALY_OPTIONS = [
  { label: '业务行缺失', value: 1 },
  { label: 'requestId未回填', value: 2 },
  { label: '部署漂移', value: 3 },
];

const MonitorList: React.FC = () => {
const actionRef = useRef<ActionType>();
// 是否管理员：委托人(被授权监控的非管理员)只看只读列表/详情，强制动作按钮隐藏
const { canAdmin } = useAccess();
const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  // 只读详情抽屉
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRecord, setDetailRecord] = useState<MonitorInstanceItem | undefined>(undefined);
  // 异常聚合（异常 Tab 卡片）
  const [anomaly, setAnomaly] = useState<MonitorAnomalySummary | undefined>(undefined);
  const formRef = useRef<ProFormInstance>();
  // 检索下拉：流程定义 / 发起人
  const [defOptions, setDefOptions] = useState<{ label: string; value: string | number }[]>([]);
  const [userOptions, setUserOptions] = useState<{ label: string; value: string | number }[]>([]);

  const loadAnomaly = () => {
    monitorAnomalySummary()
      .then((res: any) => setAnomaly(pickPayload(res) || {}))
      .catch(() => setAnomaly(undefined));
  };

  useEffect(() => {
    loadAnomaly();
    listDefinitions()
      .then((res: any) => {
        const list = pickPayload(res) || [];
        setDefOptions(list.map((d: any) => ({ label: d.name || d.id, value: d.id })));
      })
      .catch(() => setDefOptions([]));
    userList({ current: 1, size: 500 })
      .then((res: any) => {
        const records = (pickPayload(res) || {}).records || [];
        setUserOptions(records.map((u: any) => ({ label: u.name || u.realName || u.account, value: u.id })));
      })
      .catch(() => setUserOptions([]));
  }, []);

  /** 点异常卡片 → 写入检索表单并提交（复用既有筛选维度，不另造过滤逻辑） */
  const applyQuickFilter = (patch: Record<string, any>) => {
    formRef.current?.setFieldsValue({
      overdueFilter: undefined,
      anomalyTypesFilter: undefined,
      isTestFilter: undefined,
      ...patch,
    });
    formRef.current?.submit();
  };

  /** §6 测试态一键清理：删除全部 is_test=1 实例/待办/日志/快照并卸载测试部署（破坏性，二次确认） */
  const handleCleanupTest = async () => {
    try {
      const res: any = await cleanupWorkflowTest();
      const n = pickPayload(res) || 0;
      message.success(`已清理 ${n} 个测试实例`);
      setSelectedRowKeys([]);
      loadAnomaly();
      actionRef.current?.reload();
    } catch (e: any) {
      message.error(e?.msg || '清理测试数据失败');
    }
  };

  // 强制意见弹窗（强制收回 / 强制归档 复用）
  // 强制收回额外带「收回至」目标节点：传 defId 时异步加载该流程可停留的节点
  const [opinionOpen, setOpinionOpen] = useState(false);
  const [opinionTitle, setOpinionTitle] = useState('');
  const [opinionVal, setOpinionVal] = useState('');
  const [opinionNodes, setOpinionNodes] = useState<{ label: string; value: string }[]>([]);
  const [opinionTarget, setOpinionTarget] = useState<string | undefined>(undefined);
  const opinionCb = useRef<(op?: string, target?: string) => void>();

  const askOpinion = (title: string, cb: (op?: string, target?: string) => void, defId?: string) => {
    setOpinionTitle(title);
    setOpinionVal('');
    setOpinionNodes([]);
    setOpinionTarget(undefined);
    opinionCb.current = cb;
    setOpinionOpen(true);
    if (!defId) {
      return;
    }
    // 仅「创建(0) / 审批(1)」可作为收回落点：网关(7)/归档(3) 等引擎停不住，不进候选
    listNodes(defId)
      .then((res: any) => {
        const list: WfProcessNode[] = (res?.data || []) as any;
        const opts = list
          .filter((n) => n.nodeType === 0 || n.nodeType === 1)
          .map((n) => ({
            label: `${n.nodeName || n.nodeKey}${n.nodeType === 0 ? '（创建/填单）' : ''}`,
            value: n.nodeKey as string,
          }));
        setOpinionNodes(opts);
        const create = list.find((n) => n.nodeType === 0);
        setOpinionTarget(create?.nodeKey);
      })
      .catch(() => setOpinionNodes([]));
  };

  /** 详情：只读监控抽屉（复用 InstanceFlow，隐藏办理按钮） */
  const openDetail = (record: MonitorInstanceItem) => {
    setDetailRecord(record);
    setDetailOpen(true);
  };

  /** 在办理视图中打开（需办理时使用，非只读） */
  const openProgress = (record: MonitorInstanceItem) => {
    window.open(
      `/workflow/create/start?defId=${record.defId}&mode=instance&instanceId=${record.id}`,
      '_blank',
    );
  };

  const handleStop = async (record: MonitorInstanceItem) => {
    try {
      await stopInstance(record.id as string);
      message.success('已暂停');
      actionRef.current?.reload();
    } catch (e: any) {
      message.error(e?.msg || '暂停失败');
    }
  };

  const handleResume = async (record: MonitorInstanceItem) => {
    try {
      await resumeInstance(record.id as string);
      message.success('已恢复');
      actionRef.current?.reload();
    } catch (e: any) {
      message.error(e?.msg || '恢复失败');
    }
  };

  const handleRecall = (record: MonitorInstanceItem) => {
    askOpinion(
      '强制收回（原地回退，实例不终止）',
      async (op, target) => {
        try {
          await forceRecallInstance(record.id as string, op, target);
          message.success('已强制收回');
          actionRef.current?.reload();
        } catch (e: any) {
          message.error(e?.msg || '强制收回失败');
        }
      },
      record.defId,
    );
  };

  const handleArchive = (record: MonitorInstanceItem) => {
    askOpinion('强制归档（强制办结）', async (op) => {
      try {
        await forceArchiveInstance(record.id as string, op);
        message.success('已强制归档');
        actionRef.current?.reload();
      } catch (e: any) {
        message.error(e?.msg || '强制归档失败');
      }
    });
  };

  /** 终止(撤销)：复用实例级 cancel（→CANCELED，终结实例，区别于「强制收回」的保留重填） */
  const handleCancel = (record: MonitorInstanceItem) => {
    askOpinion('终止（撤销作废）', async (op) => {
      try {
        await cancelInstance(record.id as string, op);
        message.success('已终止');
        actionRef.current?.reload();
      } catch (e: any) {
        message.error(e?.msg || '终止失败');
      }
    });
  };

  const handleDelete = async (record: MonitorInstanceItem) => {
    try {
      await deleteInstanceById(record.id as string);
      message.success('已强制删除');
      actionRef.current?.reload();
    } catch (e: any) {
      message.error(e?.msg || '强制删除失败');
    }
  };

  const handleBatch = (action: string, label: string) => {
    const ids = selectedRowKeys.map(String);
    if (ids.length === 0) {
      message.warning('请先勾选流程');
      return;
    }
    Modal.confirm({
      title: `确认${label}选中的 ${ids.length} 个流程？`,
      onOk: async () => {
        try {
          const res: any = await batchMonitorAction(action, ids);
          const data: MonitorBatchResult = pickPayload(res) || {};
          const ok = data.success || [];
          const fail = data.failed || {};
          const failCount = Object.keys(fail).length;
          if (failCount === 0) {
            message.success(`已${label} ${ok.length} 个`);
          } else {
            message.warning(
              `成功 ${ok.length}，失败 ${failCount}：${Object.entries(fail)
                .map(([k, v]) => `${k}:${v}`)
                .join('; ')}`,
            );
          }
          setSelectedRowKeys([]);
          actionRef.current?.reload();
        } catch (e: any) {
          message.error(e?.msg || '批量操作失败');
        }
      },
    });
  };

  const columns: ProColumns<MonitorInstanceItem>[] = [
    {
      title: '流程标题',
      dataIndex: 'title',
      ellipsis: true,
      render: (_, r) => <a onClick={() => openDetail(r)}>{r.title || '-'}</a>,
      // 检索按后端 keyword（标题模糊）；dataIndex 仅用于表格展示
      search: { transform: (v) => (v ? { keyword: v } : {}) },
    },
    { title: '流程名称', dataIndex: 'defName', ellipsis: true },
    {
      title: '流程定义',
      dataIndex: 'defId',
      hideInTable: true,
      valueType: 'select',
      fieldProps: { options: defOptions, allowClear: true, showSearch: true, optionFilterProp: 'label' },
      search: { transform: (v) => (v != null ? { defId: v } : {}) },
    },
    { title: '发起人', dataIndex: 'starterName', hideInSearch: true },
    {
      title: '发起人',
      dataIndex: 'starter',
      hideInTable: true,
      valueType: 'select',
      fieldProps: { options: userOptions, allowClear: true, showSearch: true, optionFilterProp: 'label' },
      search: { transform: (v) => (v != null ? { starter: v } : {}) },
    },
    {
      title: '当前节点',
      dataIndex: 'currentNodeKey',
      hideInTable: true,
      search: { transform: (v) => (v ? { currentNodeKey: v } : {}) },
    },
    { title: '当前节点', dataIndex: 'currentNodeName', hideInSearch: true },
    {
      title: '状态',
      dataIndex: 'status',
      valueType: 'select',
      valueEnum: Object.fromEntries(
        Object.entries(INSTANCE_STATUS).map(([k, v]) => [k, { text: v.text }]),
      ),
      // 后端按 statuses(List) 过滤：单选取的值转换为 statuses（Spring 可绑定单值到 List）
      search: { transform: (v) => (v != null ? { statuses: v } : {}) },
      render: (_, r) => {
        const s = INSTANCE_STATUS[r.status || 0] || { text: '未知', color: 'default' };
        return <Badge status={s.color as any} text={s.text} />;
      },
    },
    {
      title: '紧急度',
      dataIndex: 'urgency',
      valueType: 'select',
      valueEnum: {
        0: { text: '普通' },
        1: { text: '紧急' },
        2: { text: '特急' },
      },
      // 后端筛选字段是 urgent（MonitorInstanceQuery.urgent → wf_instance.urgency），列名与之不同
      search: { transform: (v) => (v != null ? { urgent: v } : {}) },
      render: (_, r) => {
        const u = r.urgency ?? 0;
        if (u === 2) return <Tag color="red">特急</Tag>;
        if (u === 1) return <Tag color="orange">紧急</Tag>;
        return <Tag>普通</Tag>;
      },
    },
    {
      title: '超时',
      dataIndex: 'overdue',
      hideInSearch: true,
      render: (_, r) =>
        r.overdue ? (
          <Badge status="error" text="超时" />
        ) : (
          <Badge status="default" text="正常" />
        ),
    },
    {
      title: '异常',
      dataIndex: 'anomalyTags',
      hideInSearch: true,
      render: (_, r) =>
        r.anomalyTags && r.anomalyTags.length ? (
          <Space size={[0, 4]} wrap>
            {r.anomalyTags.map((t) => (
              <Tag key={t} color="red">
                {t}
              </Tag>
            ))}
          </Space>
        ) : (
          <Tag color="green">正常</Tag>
        ),
    },
    {
      title: '测试态',
      dataIndex: 'isTest',
      hideInSearch: true,
      render: (_, r) =>
        r.isTest === 1 ? <Tag color="purple">测试</Tag> : <Tag>正式</Tag>,
    },
    {
      title: '发起时间',
      dataIndex: 'startTime',
      valueType: 'dateTime',
      hideInSearch: true,
    },
    // ── 仅检索列 ──
    {
      title: '仅超时',
      dataIndex: 'overdueFilter',
      hideInTable: true,
      valueType: 'select',
      fieldProps: {
        options: [
          { label: '全部', value: '' },
          { label: '仅超时', value: 'true' },
        ],
      },
      search: { transform: (v) => (v ? { overdue: true } : {}) },
    },
    {
      title: '异常类型',
      dataIndex: 'anomalyTypesFilter',
      hideInTable: true,
      valueType: 'select',
      fieldProps: { mode: 'multiple', options: ANOMALY_OPTIONS },
      search: { transform: (v) => (v && (v as number[]).length ? { anomalyTypes: (v as number[]).join(',') } : {}) },
    },
    {
      title: '运行态',
      dataIndex: 'isTestFilter',
      hideInTable: true,
      valueType: 'select',
      fieldProps: {
        options: [
          { label: '全部', value: '' },
          { label: '正式', value: 0 },
          { label: '测试', value: 1 },
        ],
      },
      search: { transform: (v) => (v === '' || v == null ? {} : { isTest: Number(v) }) },
    },
    {
      title: '发起时间范围',
      dataIndex: 'timeRange',
      hideInTable: true,
      valueType: 'dateTimeRange',
      search: {
        transform: (v) =>
          v && (v as string[]).length === 2
            ? { beginTime: (v as string[])[0], endTime: (v as string[])[1] }
            : {},
      },
    },
    {
      title: '操作',
      valueType: 'option',
      fixed: 'right',
      render: (_, record) => {
        const running = record.status === 0 || record.status === 4;
        const items: React.ReactNode[] = [<a key="detail" onClick={() => openDetail(record)}>详情</a>];
        // 强制动作仅管理员可见（委托人只读，点动作后端会 403，故前端隐藏）
        if (canAdmin) {
          if (record.status === 0) {
            items.push(
              <Popconfirm key="stop" title="确认暂停该流程？" onConfirm={() => handleStop(record)}>
                <a>暂停</a>
              </Popconfirm>,
            );
          }
          if (record.status === 4) {
            items.push(
              <Popconfirm key="resume" title="确认恢复该流程？" onConfirm={() => handleResume(record)}>
                <a>恢复</a>
              </Popconfirm>,
            );
          }
          if (running) {
            items.push(<a key="recall" onClick={() => handleRecall(record)}>强制收回</a>);
            items.push(<a key="archive" onClick={() => handleArchive(record)}>强制归档</a>);
            items.push(<a key="cancel" onClick={() => handleCancel(record)}>终止</a>);
          }
          items.push(
            <Popconfirm
              key="del"
              title="确认强制删除该流程（逻辑删业务行 + 清引擎运行态 + 清历史）？"
              onConfirm={() => handleDelete(record)}
            >
              <a style={{ color: '#ff4d4f' }}>强制删除</a>
            </Popconfirm>,
          );
        }
        return items;
      },
    },
  ];

  return (
    <PageContainer header={{ title: '流程监控' }}>
      {/* 异常聚合：点击卡片即把对应维度写入检索表单（§6 异常 Tab） */}
      <Space size={12} wrap style={{ marginBottom: 16 }}>
        {ANOMALY_CARDS.map((c) => {
          const v = (anomaly as any)?.[c.key] ?? 0;
          return (
            <Card key={c.key} size="small" hoverable onClick={() => applyQuickFilter(c.patch)} style={{ minWidth: 132 }}>
              <Statistic
                title={c.title}
                value={v}
                valueStyle={{ fontSize: 20, color: v > 0 ? '#cf1322' : undefined }}
              />
            </Card>
          );
        })}
        <Card size="small" style={{ minWidth: 168 }}>
          <Statistic
            title="引擎对账差异"
            value={anomaly?.ledgerTotalDiff ?? 0}
            suffix={anomaly?.ledgerListenerRegistered ? '（监听已注册）' : '（监听未注册）'}
            valueStyle={{
              fontSize: 20,
              color: (anomaly?.ledgerTotalDiff ?? 0) > 0 ? '#cf1322' : undefined,
            }}
          />
        </Card>
        {canAdmin && (
          <Popconfirm
            title="确认清理全部测试态实例？"
            description="将删除所有 is_test=1 的实例/待办/日志/快照，并卸载测试部署（不可恢复）"
            onConfirm={handleCleanupTest}
            okText="确认清理"
            cancelText="取消"
          >
            <Button danger style={{ alignSelf: 'center' }}>
              清理测试数据{(anomaly?.testInstances ?? 0) > 0 ? `（${anomaly?.testInstances}）` : ''}
            </Button>
          </Popconfirm>
        )}
      </Space>

      <StandardTable<MonitorInstanceItem>
        actionRef={actionRef}
        formRef={formRef}
        rowKey={(r) => r.id || `${r.title}`}
        columns={columns}
        scroll={{ x: 1200 }}
        search={{ labelWidth: 'auto' }}
        pagination={{ defaultPageSize: 20 }}
        rowSelection={canAdmin ? { selectedRowKeys, onChange: setSelectedRowKeys } : undefined}
        request={async (params) => {
          try {
            const res: any = await monitorList({
              current: params.current,
              pageSize: params.pageSize,
              ...params,
            });
            const page: any = pickPayload(res) || {};
            const list: MonitorInstanceItem[] = Array.isArray(page) ? page : page.records || [];
            return {
              data: list,
              success: true,
              total: Array.isArray(page) ? list.length : page.total ?? list.length,
            };
          } catch {
            return { data: [], success: true, total: 0 };
          }
        }}
        tableAlertOptionRender={({ onClean }) => (
          <Space>
            {canAdmin && (
              <>
                <a onClick={() => handleBatch('stop', '暂停')}>批量暂停</a>
                <a onClick={() => handleBatch('resume', '恢复')}>批量恢复</a>
                <a onClick={() => handleBatch('recall', '收回')}>批量收回</a>
                <a onClick={() => handleBatch('archive', '归档')}>批量归档</a>
                <a style={{ color: '#ff4d4f' }} onClick={() => handleBatch('delete', '删除')}>
                  批量删除
                </a>
              </>
            )}
            <a onClick={onClean}>取消选择</a>
          </Space>
        )}
        options={{ reload: true, density: true, setting: true }}
      />

      <MonitorDetailDrawer
        open={detailOpen}
        record={detailRecord}
        onClose={() => setDetailOpen(false)}
        onOperated={() => actionRef.current?.reload()}
      />

      <Modal
        title={opinionTitle}
        open={opinionOpen}
        onOk={() => {
          opinionCb.current?.(opinionVal || undefined, opinionTarget);
          setOpinionOpen(false);
        }}
        onCancel={() => setOpinionOpen(false)}
        okText="确认"
        cancelText="取消"
      >
        {opinionNodes.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ marginBottom: 4 }}>收回至</div>
            <Select
              style={{ width: '100%' }}
              placeholder="选择收回到的节点（默认创建/填单节点）"
              options={opinionNodes}
              value={opinionTarget}
              onChange={setOpinionTarget}
            />
          </div>
        )}
        <Input.TextArea
          rows={3}
          placeholder="办理意见（可选）"
          value={opinionVal}
          onChange={(e) => setOpinionVal(e.target.value)}
        />
      </Modal>
    </PageContainer>
  );
};

export default MonitorList;
