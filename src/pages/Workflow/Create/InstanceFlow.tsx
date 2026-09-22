import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { collectFieldValues } from '@/pages/FormMode/ExcelDesign/utils/collectFieldValues';
import { PersonOrgField } from '@/components/FormMode/PersonOrgPicker';
import { loadPersonOrgData } from '@/components/FormMode/personOrg';
import { MENUS_OPTIONS } from '@/pages/FormMode/WorkflowDesign/wfDict';
import {
  addSignTask,
  approveTask,
  forwardTask,
  getInstance,
  getInstanceNodeOperators,
  getLogs,
  getWorkflowTestTodo,
  listTodo,
  markTaskViewed,
  rejectTask,
  saveFormData,
  urgeTask,
} from '@/services/workflow';
import { pickPayload } from '@/utils/utils';
import FlowDiagram from '@/pages/FormMode/Test/components/FlowDiagram';

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

/**
 * 测试态禁用的操作（方案 §6.4 **C6** / V7）。
 *
 * 共同点是「会给真实用户产生东西」：转办/加签给真人新建待办、传阅给真人建已办条目、
 * 催办在真人名下写留痕、退回会触发节点后附加操作（可能写业务表/调外部接口）。
 *
 * 后端 C16 已对这些动作一律拒绝（绕不过），这里前置禁用只是**不让用户点了才收到报错**；
 * 测试态保留「提交」（走 `/test/step`）即可完成逐节点推进。
 */
const TEST_BLOCKED_MENUS = ['reject', 'forward', 'sign', 'circulate', 'urge'];

/**
 * 测试态**白名单**：只保留"不产生真实用户待办/留痕"的动作。
 *
 * <p>推进测试实例靠「提交」（走 `/test/step`）即可；其余办理动作（转办/转交/传阅/意见征询/
 * 保存/超时设置…）在测试域要么无意义、要么会给真人产生数据，一律不渲染。</p>
 */
const TEST_MENUS = ['submit', 'print', 'opinion'];

const menuLabel = (code: string) => MENUS_OPTIONS.find((o) => o.value === code)?.label || code;

/** 流转动作（wf_approval_log.log_type，对齐 WfApprovalLog 常量）→ 展示文案 */
const LOG_ACTION: Record<string, string> = {
  '0': '通过',
  '2': '提交',
  '3': '退回',
  '7': '转发',
  '9': '批注',
  'h': '转办',
  's': '督办',
  't': '抄送',
  'y': '批示',
};

/** 把后端返回的「下一节点办理人」逗号串（用户ID）按人员字典解析成「姓名、姓名」 */
const namesOf = (
  ids: string | undefined,
  userMap: Record<string, { name: string; desc?: string }>,
) => {
  if (!ids) return '';
  return ids
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
    .map((id) => userMap[id]?.name || id)
    .join('、');
};

export interface InstanceFlowProps {
  /** 19 位雪花实例 ID：务必保持字符串，转 number 会丢精度；预览模式（preview=true）下可省略 */
  instanceId?: string;
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
  /** 预览模式：不依赖测试实例，仅展示流程表单布局（只读）；用于测试页选好流程/发起人后直接打开表单 */
  preview?: boolean;
  /** 预览模式下的流程定义 ID / 表单 ID（传给 ApprovalFormRender 走 /form/preview） */
  previewDefId?: number | string;
  previewFormId?: number | string;
}

const InstanceFlowContent: React.FC<InstanceFlowProps> = ({
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
  preview,
  previewDefId,
  previewFormId,
}) => {
  const { message } = App.useApp();
  const [pkg, setPkg] = useState<any>(null);
  const [tab, setTab] = useState<'form' | 'diagram' | 'status'>('form');
  const [logs, setLogs] = useState<any[]>([]);
  /** nodeKey → 操作者分组（流程图节点「谁批的」+ 悬浮「操作者」面板） */
  const [nodeOps, setNodeOps] = useState<Record<string, any>>({});
  /** 操作人 id → {姓名, 部门/角色}（复用统一人员字典，模块级缓存，不额外发请求） */
  const [userMap, setUserMap] = useState<Record<string, { name: string; desc?: string }>>({});
  useEffect(() => {
    loadPersonOrgData()
      .then((d: any) => {
        const m: Record<string, { name: string; desc?: string }> = {};
        ((d?.users || []) as any[]).forEach((u) => {
          m[String(u.id)] = { name: u.name, desc: u.desc };
        });
        setUserMap(m);
      })
      .catch(() => {});
  }, []);
  /** 人员ID → 姓名（流程图节点下方「谁批的」与悬浮面板复用同一人员字典） */
  const resolveUserName = useCallback(
    (id: string | number) => userMap[String(id)]?.name || String(id),
    [userMap],
  );
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
    // 无效实例号（null / 0 / 负数，如失败哨兵 -1）一律不请求，直接空转
    if (!instanceId || Number(instanceId) <= 0) return () => {};
    getLogs(instanceId)
      .then((r: any) => {
        // 倒序（最新在前）：与参照系统一致——刚办完的那条排最上面
        if (alive) setLogs([...(r?.data || [])].reverse());
      })
      .catch(() => alive && setLogs([]));
    // 流程图节点「谁批的」+ 悬浮「操作者」分组（已操作/已查看/未操作）
    getInstanceNodeOperators(instanceId)
      .then((r: any) => {
        if (alive) setNodeOps(r?.data || {});
      })
      .catch(() => alive && setNodeOps({}));
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
        // 测试态：打开该节点表单即视为「已查看」（后端只记首次），
        // 让流程图悬浮「操作者」面板能区分「已查看」与「未操作」
        if (alive && testMode && hit?.id) {
          markTaskViewed(String(hit.id)).catch(() => {
            /* 记录失败不影响查看 */
          });
        }
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

  // 操作菜单：与发起页 `Start.tsx#menuAllowed` 同口径，避免"同一流程两边按钮不一样"：
  //   - 渲染包未回来（pkg 为空）→ 一个都不给（否则会退化成"未配置=全量"，闪出一堆按钮）；
  //   - allowMenus 为 null/未配置 → 不限制（按 MENUS_OPTIONS 全量）；
  //   - 配置过 → 只给集合内的动作（空数组 = 全部禁用）。
  // 测试态再收成白名单 TEST_MENUS：只保留不产生真实用户数据的动作。
  const menus = useMemo(() => {
    if (!pkg) return [];
    const all = MENUS_OPTIONS.map((o) => String(o.value));
    const allowed =
      pkg.allowMenus == null ? all : all.filter((c) => (pkg.allowMenus || []).map(String).includes(c));
    return testMode ? allowed.filter((c) => TEST_MENUS.includes(c)) : allowed;
  }, [pkg, testMode]);

  /** 流程图标记：nodeKey -> 状态（1走通 2走不通） */
  const nodeStatusMap = useMemo(() => {
    const m: Record<string, number> = {};
    (nodes || []).forEach((n: any) => {
      if (n?.nodeKey != null) m[String(n.nodeKey)] = n.status;
    });
    return m;
  }, [nodes]);

  /**
   * 当前查看的是否「开始节点（申请人，nodeType=0）」。
   * 它已被引擎在发起时自动完成、不生成待办（taskId 为空），但测试时它才是起点表单：
   * 在它上面填值点「提交」＝按申请人提交推进实例（后端 step() 用提交值做开始节点必填校验）。
   */
  const viewingStartNode = useMemo(
    () => (nodes || []).some((n: any) => String(n.nodeKey) === String(nodeKey) && n.nodeType === 0),
    [nodes, nodeKey],
  );

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
    // 测试态兜底拦截（菜单已不渲染这些按钮，这里是防御：避免任何路径绕过 UI 触发）
    if (testMode && TEST_BLOCKED_MENUS.includes(code)) {
      message.info(`流程测试不支持「${menuLabel(code)}」：该操作会给真实用户产生任务或留痕`);
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
      // 与「发起页 / 办理页」同口径：坐标键（Excel 布局回显用）+ 字段名键
      // （出口条件 UEL ${字段名} 用）一并下发，避免手动测试填了值却走不到对应分支。
      let layout: any = null;
      try {
        layout = pkg?.layoutJson ? JSON.parse(pkg.layoutJson) : null;
      } catch {
        layout = null;
      }
      onStep?.({ opinion, formData: { ...formValues, ...collectFieldValues(layout, formValues) } });
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

    // 保存（只存不流转）：与「正式办理页」同口径走 `/form/save` —— 写业务行 + 同步节点快照，
    // 不改任务状态、不推进引擎。注意：保存**不需要待办**，故必须放在 `!taskId` 校验之前。
    if (code === 'save') {
      if (!instanceId) {
        message.warning('当前实例不可用，无法保存');
        return;
      }
      setActing(true);
      try {
        // defId/formId/dataId 从实例取（`/form/save` 只认 formId|defId）
        const inst: any = pickPayload(await getInstance(instanceId));
        let layout: any = null;
        try {
          layout = pkg?.layoutJson ? JSON.parse(pkg.layoutJson) : null;
        } catch {
          layout = null;
        }
        const res: any = await saveFormData({
          instanceId,
          nodeKey,
          taskId,
          defId: inst?.defId,
          formId: inst?.formId,
          dataId: inst?.dataId,
          // 与提交同口径：坐标键（布局回显）+ 字段名键（出口条件）
          fieldValues: { ...formValues, ...collectFieldValues(layout, formValues) },
        });
        if (res?.success === false) {
          message.error(res?.msg || '保存失败');
          return;
        }
        message.success('已保存（未流转）');
      } catch (e: any) {
        message.error(e?.msg || '保存失败');
      } finally {
        setActing(false);
      }
      return;
    }

    if (!taskId) {
      message.warning(`当前实例无该节点待办，无法「${menuLabel(code)}」`);
      return;
    }
    // 本页已接入的写操作只有 提交 / 退回 / 催办；其余菜单码（转办/转交/传阅/意见征询/抄送…）
    // 尚未接入，**绝不能兜底成「催办」**（否则点错按钮会执行错误动作）。
    if (code !== 'submit' && code !== 'reject' && code !== 'urge') {
      message.info(`「${menuLabel(code)}」在办理页暂未接入，请在正式流程中使用`);
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
    // 测试态防御：弹窗路径同样拦截（正常不会打开，因按钮已不渲染）
    if (testMode && modalType && TEST_BLOCKED_MENUS.includes(modalType)) {
      message.info('流程测试不支持该操作：会给真实用户产生任务或留痕');
      return;
    }
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
          {preview && <Tag color="default">预览</Tag>}
          {!taskId && menus.length > 0 && !preview && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {testMode
                ? viewingStartNode
                  ? '开始节点（申请人）表单：填写后点「提交」，即按申请人提交推进到下一节点'
                  : hasPending
                    ? '当前查看的节点无待办；「提交」作用于实例当前待办节点（可用「查看节点」切换）'
                    : '当前节点无待办（可切换节点查看，或点「开始自动测试」）'
                : '当前节点无待办（实例已归档），按钮不可执行'}
            </Typography.Text>
          )}
          {preview && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              设计态预览（只读，不创建测试实例）
            </Typography.Text>
          )}
        </Space>
        {!preview && (
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
        )}
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
                    testMode={testMode}
                    instanceId={preview ? undefined : instanceId}
                    previewDefId={preview ? previewDefId : undefined}
                    previewFormId={preview ? previewFormId : undefined}
                    nodeKey={nodeKey}
                    hideHeader
                    /*
                     * 可编辑性：
                     *  - 预览（设计态）→ 只读；
                     *  - 测试态 → 有测试待办才可编辑（`!hasPending`）；开始节点无待办但需补填，故不能用 `!taskId`；
                     *  - 正式态 → **本人在当前节点有待办即可编辑**（`!taskId`）；已办/我的请求查看态无待办 → 只读。
                     */
                    readOnly={preview ? true : testMode ? !hasPending : !taskId}
                    onPackage={setPkg}
                    // 始终回传当前值：测试态手动提交、办理态「保存」都要用它（原先仅测试态接线，导致办理态保存拿不到值）
                    onValuesChange={setFormValues}
                  />
                  {/* 签字意见固定在流程表单最下方（对齐 ecology 流程处理页） */}
                  {!preview && menus.some((c) =>
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
                  {/* 流转意见：本实例全部节点的审批/流转记录。
                      切到下一节点（或归档节点）后即能看到上一节点的流转意见（对齐 ecology 处理页）。 */}
                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>流转意见</div>
                    <Timeline
                      items={
                        logs.length === 0
                          ? [
                              {
                                children: (
                                  <Typography.Text type="secondary">暂无流转记录</Typography.Text>
                                ),
                              },
                            ]
                          : logs.map((l: any) => {
                              const u = userMap[String(l.operator)];
                              const who =
                                String(l.operator) === '0'
                                  ? '系统'
                                  : u?.name || String(l.operator || '-');
                              return {
                                children: (
                                  <div style={{ fontSize: 12 }}>
                                    {/* 第一行：操作人（+ 部门/角色） */}
                                    <Space size={6} wrap>
                                      <Typography.Text strong>{who}</Typography.Text>
                                      {u?.desc ? (
                                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                          {u.desc}
                                        </Typography.Text>
                                      ) : null}
                                    </Space>
                                    {/* 第二行：签字意见（高亮块） */}
                                    {l.opinion ? (
                                      <div
                                        style={{
                                          margin: '4px 0',
                                          padding: '4px 8px',
                                          background: '#e6f4ff',
                                          borderRadius: 4,
                                          color: '#1677ff',
                                        }}
                                      >
                                        <RichTextView html={l.opinion} style={{ fontSize: 12 }} />
                                      </div>
                                    ) : null}
                                    {/* 第三行：时间 + [节点名 / 动作]（对齐参照系统） */}
                                    <Space size={6} wrap>
                                      <Typography.Text
                                        type="secondary"
                                        style={{ fontSize: 12 }}
                                      >
                                        {l.operateTime || ''}
                                      </Typography.Text>
                                      <Tag
                                        color={
                                          l.logType === '2'
                                            ? 'blue'
                                            : l.logType === '0'
                                              ? 'green'
                                              : 'default'
                                        }
                                        style={{ marginInlineEnd: 0 }}
                                      >
                                        {`${l.nodeName || l.nodeKey || '-'} / ${
                                          LOG_ACTION[String(l.logType)] || l.logType || '-'
                                        }`}
                                      </Tag>
                                    </Space>
                                    {/* 第四行：接收人（下一节点办理人，后端按出口解析部门/角色/人员后返回ID） */}
                                    {l.nextHandlerIds ? (
                                      <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                                        接收人：{namesOf(l.nextHandlerIds, userMap) || '—'}
                                      </div>
                                    ) : null}
                                  </div>
                                ),
                              };
                            })
                      }
                    />
                  </div>
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
                      nodeOperators={nodeOps}
                      resolveUserName={resolveUserName}
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

const InstanceFlow: React.FC<InstanceFlowProps> = (props) => (
  <App>
    <InstanceFlowContent {...props} />
  </App>
);

export default InstanceFlow;
