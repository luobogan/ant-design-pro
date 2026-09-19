import React, { useEffect, useMemo, useState } from 'react';
import {
  App,
  Button,
  Dropdown,
  Modal,
  Radio,
  Space,
  Table,
  Tabs,
  Tag,
  Timeline,
  Typography,
} from 'antd';
import { DeploymentUnitOutlined, EllipsisOutlined } from '@ant-design/icons';
import RichTextEditor, {
  RichTextView,
  focusRichText,
  isRichTextEmpty,
} from '@/components/RichTextEditor';
import ApprovalFormRender from '@/pages/FormMode/ExcelDesign/components/ApprovalFormRender';
import { PersonOrgField } from '@/components/FormMode/PersonOrgPicker';
import { MENUS_OPTIONS } from '@/pages/FormMode/WorkflowDesign/wfDict';
import {
  addSignTask,
  approveTask,
  forwardTask,
  getLogs,
  getWorkflowTestTodo,
  listTodo,
  rejectTask,
  urgeTask,
} from '@/services/workflow';
import FlowDiagram from './FlowDiagram';

/**
 * 流程测试页右侧「节点审批情况」面板
 *
 * 对齐 ecology 自动测试页右侧：顶部是「节点审批情况：{nodeName}」+ 操作按钮，
 * 其下是节点徽标 + 三个页签：
 *   1. 流程表单：嵌套完整的流程表单（ApprovalFormRender）+ 签字意见；
 *   2. 流程图  ：只读 BPMN 画布（FlowDiagram），按测试结果标记走通/走不通/当前节点；
 *   3. 流程状态：节点经过情况（名称/类型/经过次数/结果）+ 审批记录时间线。
 *
 * 操作按钮按 MENUS_OPTIONS 顺序渲染（前 3 个外露，其余收进「⋯」更多菜单），点击**真实办理**：
 * 通过 GET /task/todo 在本实例找出当前查看节点的待办 taskId 后调用对应接口；
 * 找不到待办时给出提示（测试实例通常已被自动审批到归档，故多数情况下无待办）。
 */

/** 实例状态 0运行中 1通过 2不通过 3撤销 4暂停 */
const INST_STATUS: Record<number, { label: string; color: string }> = {
  0: { label: '运行中', color: 'processing' },
  1: { label: '通过', color: 'success' },
  2: { label: '不通过', color: 'error' },
  3: { label: '撤销', color: 'default' },
  4: { label: '暂停', color: 'warning' },
};

/** 节点类型 0创建 1审批 2提交 3归档 5等待 6自动处理 7网关 */
const NODE_TYPE: Record<number, string> = {
  0: '创建',
  1: '审批',
  2: '提交',
  3: '归档',
  5: '等待',
  6: '自动处理',
  7: '网关',
};

/** 需要填写/选择额外信息的操作 */
const NEED_EXTRA = ['forward', 'sign'];

const menuLabel = (code: string) => MENUS_OPTIONS.find((o) => o.value === code)?.label || code;

export interface FlowFormPanelProps {
  /** 19 位雪花实例 ID：务必保持字符串，转 number 会丢精度 */
  instanceId: string;
  nodeKey?: string;
  /** 流程名称（节点徽标用） */
  defName?: string;
  /** 流程定义 BPMN XML（「流程图」页签用） */
  bpmnXml?: string;
  /** 流程节点清单（测试结果 result.nodes），用于「流程状态」页签 */
  nodes?: any[];
  /** 点流程图节点 → 切换当前查看节点 */
  onSelectNode?: (nodeKey?: string) => void;
  /** 办理成功回调（外层可据此刷新测试记录 / 统计） */
  onOperated?: () => void;
  /**
   * 交互式测试模式：
   *  - 待办查询改走 `GET /test/todo`（is_test=1 的待办不在当前用户 /task/todo 里）；
   *  - 表单按当前节点权限**可编辑**（有待办时），修改值随「提交」下发引擎驱动网关；
   *  - 「提交」改走 `POST /test/step`（后端做节点必填矩阵校验后推进）。
   */
  testMode?: boolean;
  /** 测试实例状态（0运行中 1通过 2不通过 3撤销 4暂停），渲染包未回来时兜底展示 */
  instanceStatus?: number;
  /** 当前节点是否存在待办（有待办即可提交，表单可编辑） */
  hasPending?: boolean;
  /** 测试态「提交」：携带签字意见与当前表单值推进一个节点 */
  onStep?: (payload: { opinion?: string; formData?: Record<string, any> }) => void;
  /** 提交进行中（提交按钮 loading） */
  submitting?: boolean;
}

const FlowFormPanelContent: React.FC<FlowFormPanelProps> = ({
  instanceId,
  nodeKey,
  defName,
  bpmnXml,
  nodes,
  onSelectNode,
  onOperated,
  testMode,
  instanceStatus,
  hasPending,
  onStep,
  submitting,
}) => {
  const { message } = App.useApp();
  const [pkg, setPkg] = useState<any>(null);
  const [tab, setTab] = useState<'form' | 'diagram' | 'status'>('form');
  const [logs, setLogs] = useState<any[]>([]);
  const [taskId, setTaskId] = useState<string | undefined>();
  const [acting, setActing] = useState(false);
  const [opinion, setOpinion] = useState('');
  /** 测试态手动提交：ExcelPreview 回传的当前表单值（作为流程变量下发引擎） */
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [modalType, setModalType] = useState<string | null>(null);
  const [assignee, setAssignee] = useState<any>(undefined);
  const [addSignType, setAddSignType] = useState<number>(0);

  // 审批记录 + 当前查看节点的待办（实例换了或切换节点都要重取）
  useEffect(() => {
    let alive = true;
    if (!instanceId) return () => {};
    getLogs(instanceId)
      .then((r: any) => {
        if (alive) setLogs(r?.data || []);
      })
      .catch(() => alive && setLogs([]));
    // 测试态走 /test/todo：is_test=1 的待办指派给节点操作者，不在当前登录用户的 /task/todo 里
    const todoReq: Promise<any> = testMode ? getWorkflowTestTodo(instanceId) : listTodo();
    todoReq
      .then((r: any) => {
        const hit = (r?.data || []).find(
          (t: any) =>
            String(t.instId) === String(instanceId) &&
            (!nodeKey || String(t.nodeKey) === String(nodeKey)),
        );
        if (alive) setTaskId(hit ? String(hit.id) : undefined);
      })
      .catch(() => alive && setTaskId(undefined));
    return () => {
      alive = false;
    };
  }, [instanceId, nodeKey, testMode]);

  // 渲染包未回来时先用测试结果里的节点名兜底，避免头部/徽标短暂显示「-」
  const nodeName =
    pkg?.nodeName ||
    (nodes || []).find((n: any) => String(n.nodeKey) === String(nodeKey))?.nodeName ||
    '-';

  // 操作菜单：null/未配置 = 不限制（按 MENUS_OPTIONS 全量）；空数组 = 一个都不给
  const menus = useMemo(() => {
    const all = MENUS_OPTIONS.map((o) => String(o.value));
    if (pkg?.allowMenus == null) return all;
    return all.filter((c) => (pkg.allowMenus || []).map(String).includes(c));
  }, [pkg]);

  /** 流程图标记：nodeKey -> 状态（1走通 2走不通） */
  const nodeStatusMap = useMemo(() => {
    const m: Record<string, number> = {};
    (nodes || []).forEach((n: any) => {
      if (n?.nodeKey != null) m[String(n.nodeKey)] = n.status;
    });
    return m;
  }, [nodes]);

  const afterOperate = (label: string) => {
    message.success(`已${label}`);
    setTaskId(undefined);
    onOperated?.();
  };

  /** 点击操作按钮：有待办则真实办理，否则提示 */
  const run = async (code: string) => {
    if (code === 'print') {
      window.print();
      return;
    }
    if (code === 'opinion') {
      focusRichText('flow-form-opinion');
      return;
    }
    if (code === 'attach') {
      message.info('附件上传接口待接入');
      return;
    }
    // 测试态「提交」：走 POST /test/step —— 后端按当前节点待办推进，
    // 并把用户当前表单值作为流程变量下发引擎（驱动后续排他网关按真实条件选分支）
    if (testMode && code === 'submit') {
      if (!hasPending) {
        message.warning('当前节点无待办，无法提交（可切换节点查看，或点「开始自动测试」）');
        return;
      }
      if (pkg?.opinionRequired && isRichTextEmpty(opinion)) {
        message.warning('当前节点要求填写签字意见，无法提交');
        return;
      }
      onStep?.({ opinion, formData: formValues });
      return;
    }
    if (NEED_EXTRA.includes(code)) {
      if (!taskId) {
        message.warning(`当前实例无该节点待办，无法「${menuLabel(code)}」`);
        return;
      }
      setAssignee(undefined);
      setModalType(code);
      return;
    }
    if (!taskId) {
      message.warning(`当前实例无该节点待办，无法「${menuLabel(code)}」`);
      return;
    }
    if ((code === 'submit' || code === 'reject') && pkg?.opinionRequired && isRichTextEmpty(opinion)) {
      message.warning(`当前节点要求填写签字意见，无法「${menuLabel(code)}」`);
      return;
    }
    setActing(true);
    try {
      const res: any =
        code === 'submit'
          ? await approveTask(taskId, { opinion })
          : code === 'reject'
            ? await rejectTask(taskId, { opinion })
            : await urgeTask(taskId, { opinion });
      if (res?.success === false) {
        message.error(res?.msg || '操作失败');
        return;
      }
      afterOperate(menuLabel(code));
    } catch (e: any) {
      message.error(e?.msg || '操作失败');
    } finally {
      setActing(false);
    }
  };

  const handleModalOk = async () => {
    if (!taskId) return;
    if (!assignee) {
      message.warning('请选择人员');
      return;
    }
    setActing(true);
    try {
      const res: any =
        modalType === 'forward'
          ? await forwardTask(taskId, { opinion, assignee: Number(assignee) })
          : await addSignTask(taskId, {
              opinion,
              assignee: Number(assignee),
              addSignType,
            });
      if (res?.success === false) {
        message.error(res?.msg || '操作失败');
        return;
      }
      afterOperate(menuLabel(modalType || ''));
      setModalType(null);
    } catch (e: any) {
      message.error(e?.msg || '操作失败');
    } finally {
      setActing(false);
    }
  };

  const runMenu = (code: string) => () => run(code);

  const menuBtn = (code: string) => (
    <Button
      key={code}
      size="small"
      type={code === 'submit' ? 'primary' : 'default'}
      danger={code === 'reject'}
      loading={code === 'submit' && (acting || !!submitting)}
      onClick={runMenu(code)}
    >
      {menuLabel(code)}
    </Button>
  );

  // 前 3 个外露，其余收进「⋯」更多菜单（对齐 ecology 表单右上角的紧凑按钮栏）
  const inlineMenus = menus.slice(0, 3);
  const moreMenus = menus.slice(3);

  // 渲染包未回来时用测试结果里的实例状态兜底
  const effectiveInstStatus = pkg?.instanceStatus ?? instanceStatus;
  const statusCfg = effectiveInstStatus != null ? INST_STATUS[effectiveInstStatus] : undefined;

  const statusColumns = [
    {
      title: '节点名称',
      dataIndex: 'nodeName',
      render: (v: string, r: any) => v || r.nodeKey,
      ellipsis: true,
    },
    { title: '类型', dataIndex: 'nodeType', width: 80, render: (v: number) => NODE_TYPE[v] ?? v },
    { title: '经过次数', dataIndex: 'passTimes', width: 80 },
    {
      title: '结果',
      dataIndex: 'status',
      width: 90,
      render: (v: number) =>
        v === 1 ? (
          <Tag color="green">走通</Tag>
        ) : v === 2 ? (
          <Tag color="red">走不通</Tag>
        ) : (
          <Tag>未走到</Tag>
        ),
    },
  ];

  return (
    <div>
      {/* ① 节点审批情况栏 + 操作按钮 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          flexWrap: 'wrap',
          marginBottom: 8,
        }}
      >
        <Space size={8} wrap>
          <span style={{ fontSize: 13 }}>
            节点审批情况：
            <Typography.Text strong>{nodeName}</Typography.Text>
          </span>
          {statusCfg && <Tag color={statusCfg.color}>{statusCfg.label}</Tag>}
          {!taskId && menus.length > 0 && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {testMode
                ? hasPending
                  ? '当前节点有待办，可「提交」推进一步'
                  : '当前节点无待办（可切换节点查看，或点「开始自动测试」）'
                : '当前节点无待办（实例已归档），按钮不可执行'}
            </Typography.Text>
          )}
        </Space>
        <Space size={6} wrap>
          {inlineMenus.map(menuBtn)}
          {moreMenus.length > 0 && (
            <Dropdown
              menu={{
                items: moreMenus.map((c) => ({ key: c, label: menuLabel(c) })),
                onClick: ({ key }) => run(key),
              }}
            >
              <Button size="small" icon={<EllipsisOutlined />} />
            </Dropdown>
          )}
        </Space>
      </div>

      {/* ② 节点徽标 + 流程表单 / 流程图 / 流程状态 */}
      <div style={{ border: '1px solid #f0f0f0', borderRadius: 6, padding: '4px 8px 0' }}>
        <Tag icon={<DeploymentUnitOutlined />} color="blue" style={{ marginInlineEnd: 0 }}>
          {defName || '流程'}·{nodeName}
        </Tag>
        <Tabs
          size="small"
          activeKey={tab}
          onChange={(v) => setTab(v as 'form' | 'diagram' | 'status')}
          style={{ marginBottom: 0 }}
          items={[
            {
              key: 'form',
              label: '流程表单',
              children: (
                <div>
                  <ApprovalFormRender
                    instanceId={instanceId}
                    nodeKey={nodeKey}
                    hideHeader
                    readOnly={testMode ? !hasPending : true}
                    onPackage={setPkg}
                    onValuesChange={testMode ? setFormValues : undefined}
                  />
                  {/* 签字意见固定在流程表单最下方（对齐 ecology 流程处理页） */}
                  {menus.some((c) =>
                    ['submit', 'reject', 'forward', 'sign', 'urge'].includes(c),
                  ) && (
                    <div id="flow-form-opinion" style={{ margin: '12px 0 4px' }}>
                      <div style={{ fontSize: 13, marginBottom: 4 }}>签字意见</div>
                      {/* 签字意见统一用富文本（与系统其余审批入口一致） */}
                      <RichTextEditor
                        compact
                        height={140}
                        value={opinion}
                        onChange={setOpinion}
                        placeholder={
                          pkg?.opinionRequired ? '请填写签字意见（必填）' : '签字意见（可选）'
                        }
                      />
                    </div>
                  )}
                </div>
              ),
            },
            {
              key: 'diagram',
              label: '流程图',
              children: (
                <div style={{ padding: '4px 0 8px' }}>
                  {bpmnXml ? (
                    <FlowDiagram
                      bpmnXml={bpmnXml}
                      nodeStatus={nodeStatusMap}
                      currentNodeKey={nodeKey}
                      onSelectNode={onSelectNode}
                      height={420}
                    />
                  ) : (
                    <Typography.Text type="secondary">暂无流程图（该流程未保存 BPMN）</Typography.Text>
                  )}
                </div>
              ),
            },
            {
              key: 'status',
              label: '流程状态',
              children: (
                <div style={{ padding: '4px 0 8px' }}>
                  <Table
                    size="small"
                    rowKey={(r: any) => r.nodeKey}
                    pagination={false}
                    dataSource={nodes || []}
                    columns={statusColumns as any}
                  />
                  <div style={{ marginTop: 12, maxHeight: 200, overflow: 'auto', fontSize: 12 }}>
                    <Timeline
                      items={
                        logs.length === 0
                          ? [
                              {
                                children: (
                                  <Typography.Text type="secondary">暂无审批记录</Typography.Text>
                                ),
                              },
                            ]
                          : logs.map((l: any) => ({
                              children: (
                                <Space size={6} wrap>
                                  <Typography.Text strong>
                                    {l.nodeName || l.nodeKey || '-'}
                                  </Typography.Text>
                                  <RichTextView
                                    html={l.opinion}
                                    style={{ fontSize: 12, color: '#555', maxWidth: 420 }}
                                  />
                                  <Typography.Text type="secondary">
                                    {l.operateTime || ''}
                                  </Typography.Text>
                                </Space>
                              ),
                            }))
                      }
                    />
                  </div>
                </div>
              ),
            },
          ]}
        />
      </div>

      <Modal
        title={modalType ? menuLabel(modalType) : ''}
        open={!!modalType}
        onOk={handleModalOk}
        confirmLoading={acting}
        onCancel={() => setModalType(null)}
        destroyOnHidden
      >
        <div style={{ marginBottom: 12 }}>
          <div style={{ marginBottom: 6 }}>{modalType === 'forward' ? '转办人' : '加签人'}</div>
          <PersonOrgField
            browserType={1}
            multiple={false}
            value={assignee}
            onChange={(v: any) => setAssignee(v || undefined)}
            placeholder="选择人员"
          />
        </div>
        {modalType === 'sign' && (
          <Radio.Group value={addSignType} onChange={(e) => setAddSignType(e.target.value)}>
            <Radio value={0}>前加签</Radio>
            <Radio value={1}>后加签</Radio>
          </Radio.Group>
        )}
      </Modal>
    </div>
  );
};

const FlowFormPanel: React.FC<FlowFormPanelProps> = (props) => (
  <App>
    <FlowFormPanelContent {...props} />
  </App>
);

export default FlowFormPanel;
