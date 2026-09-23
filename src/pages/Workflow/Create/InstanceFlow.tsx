import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
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
  Tooltip,
  Upload,
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
  circulateTask,
  executeCustomOperation,
  forwardTask,
  freshInstance,
  getInstance,
  getInstanceNodeOperators,
  getLogs,
  getWorkflowTestTodo,
  listCustomOperations,
  listTodo,
  markTaskViewed,
  rejectNodes,
  rejectTask,
  saveFormData,
  urgeTask,
  validateForm,
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

/** 需要填写/选择额外信息的操作（传阅可多人，走多选人员弹窗；附件走上传弹窗） */
const NEED_EXTRA = ['forward', 'sign', 'circulate', 'attach'];

/**
 * 测试态**置灰**的动作（方案 §6.4 **C6** / V7）。
 *
 * 共同点是「会给真实用户产生东西」：转办/转交给真人新建待办、传阅给真人建已办条目、
 * 催办在真人名下写留痕、自定义操作可能写业务表/调外部接口。
 *
 * 测试态**保留按钮位置但禁用**（+ 悬浮说明），使「测试 ↔ 正式」的按钮布局完全一致，
 * 差异只在可用性；后端 C16 亦一律拒绝（绕不过）。
 *
 * 注：「退回」不在本清单 —— 退回是流程测试需要验证的核心路径（后端 C16 明确豁免：
 * 允许执行 + 跳过节点后附加操作 + 留痕记节点接收人），测试与正式同一弹窗同一步骤。
 */
const TEST_BLOCKED_MENUS = [
  'forward', 'forwardRetract', 'transfer', 'deliver', 'sign',
  'circulate', 'circulateFb', 'circulateNoFb',
  'consult', 'consultFb', 'consultNoFb', 'consultReply', 'consultRetract', 'consultTransfer',
  'urge', 'timeoutSet', 'flowSet', 'withdraw', 'submitToReject',
  // 自定义操作按节点配置执行真实动作（可能写业务表/调外部接口），测试域一并置灰
  'custom',
];

/** 测试态置灰按钮的悬浮说明 */
const TEST_BLOCKED_TIP = '测试域不支持：该操作会给真实用户产生待办/留痕，或触发节点后附加操作';

/**
 * 后端返回的过期提示统一措辞（见 WfTaskServiceImpl#staleTaskReason）。
 * 命中即把本页降级为过期态，阻止继续写操作。
 */
const isStaleMsg = (msg?: string) => !!msg && msg.includes('本页已过期');

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
  /** 流程出口清单（result.links / designLinks）：用于推导「当前节点的下一个节点」及其操作者 */
  links?: any[];
  /**
   * 实例「当前所在节点」Key（流程此刻流转到的节点），与「查看节点」`nodeKey` 解耦。
   *
   * <p>头部「节点审批情况」与流程图高亮都跟随它，不随用户点开查看历史节点而变：
   * 例如流程已走到「业务领导」审批，即便你点开查看更早的「部门经理」表单，
   * 头部仍显示「业务领导（当前操作者：…）」——即「流程流转到哪个操作者」的真实口径。</p>
   */
  currentNodeKey?: string;
  /** 实例「当前所在节点」名称（不传则由 `nodes` 按 `currentNodeKey` 兜底解析；正式态再用渲染包兜底） */
  currentNodeName?: string;
  /**
   * 显式指定待办 ID（生产办理页由 URL 带入）。
   * 不传时按「实例 + 查看节点」自行查待办；会签 / 并行下同一节点有多条待办，
   * 必须由调用方精确指定，否则可能取到别人的那条。
   */
  taskId?: string;
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
  /** 表单值变化回传（外层据此在「继续测试」时带最新值提交） */
  onValuesChange?: (values: Record<string, any>) => void;
  /** 提交进行中（提交按钮 loading） */
  submitting?: boolean;
  /** 预览模式：不依赖测试实例，仅展示流程表单布局（只读）；用于测试页选好流程/发起人后直接打开表单 */
  preview?: boolean;
  /** 预览模式下的流程定义 ID / 表单 ID（传给 ApprovalFormRender 走 /form/preview） */
  previewDefId?: number | string;
  previewFormId?: number | string;
  /** 内嵌（父页提供外壳与返回）：不再渲染「返回」按钮（与发起页 `!embedded` 口径一致） */
  embedded?: boolean;
  /** 外层自增键：每次办理成功 +1，用于强制本面板重新拉取节点操作者等运行态数据 */
  refreshKey?: number | string;
}

const InstanceFlowContent: React.FC<InstanceFlowProps> = ({
  instanceId,
  nodeKey,
  defName,
  bpmnXml,
  nodes,
  links,
  currentNodeKey,
  currentNodeName,
  onSelectNode,
  onOperated,
  testMode,
  instanceStatus,
  hasPending,
  taskId: taskIdProp,
  onStep,
  onValuesChange,
  submitting,
  preview,
  previewDefId,
  previewFormId,
  embedded,
  refreshKey,
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

  // ── 界面新鲜度（过期复检）：与「正式办理页」ApprovalPage 同口径 ──
  // 场景：流程被退回 / 被他人流转 / 被撤回 / 已归档，而本页仍按旧节点渲染。
  // 此时继续保存或提交会把过期数据写回，故识别后禁止一切写操作并引导刷新。
  const [stale, setStale] = useState<{ reason: string } | null>(null);
  /** pkg 最新值快照：复检发生在异步回调/定时器里，直接读 state 会拿到闭包旧值 */
  const pkgRef = useRef<any>(null);
  /** 过期标记的同步副本：同一 tick 内多次门禁调用也要立即生效 */
  const staleRef = useRef(false);
  /** 表单渲染句柄：自绘「提交」按钮经它触发表单自身的布局级必填校验（与正式办理页同口径） */
  const formRef = useRef<any>(null);
  /** 提交已通过布局级必填校验（由 ApprovalFormRender.onSubmit 回调置位，避免递归触发校验） */
  const submitAfterValidateRef = useRef(false);
  /** 校验通过时表单回传的最新值（坐标键 + 字段名键），提交时优先用它 */
  const submitValuesRef = useRef<Record<string, any> | null>(null);
  /**
   * 启用范围（比 ApprovalPage 更保守，因本组件可查看任意历史节点）：
   *  · 预览态无实例 → 不启用；
   *  · 测试态由父页按 result/formKey 驱动状态，且测试允许查看任意节点（那不是过期）→ 不启用；
   *  · 必须有 taskId（当前查看节点确有本人名下待办）——无待办时本就禁止写操作，无需复检。
   */
  const staleEnabled = !preview && !testMode && !!taskId;

  /** 标记本页已过期（幂等：保留第一次的原因，避免被后续复检结果覆盖） */
  const markStale = useCallback((reason: string) => {
    staleRef.current = true;
    setStale((prev) => prev || { reason });
  }, []);

  /** 复检节流时间戳：避免「聚焦/可见性事件 + 渲染包回流」被高频触发时，/fresh 被打成死循环 */
  const lastFreshRef = useRef(0);

  /**
   * 界面新鲜度复检：判定交给后端 GET /instance/{id}/fresh（单一权威实现，
   * 并行网关分支安全，不会把并行分支上的合法办理误判为过期），前端只负责拦截与提示。
   */
  const checkFresh = useCallback(async (): Promise<boolean> => {
    if (!instanceId || !staleEnabled) return true;
    if (staleRef.current) return false;
    // 全局节流（1.5s）：点击字段、表单逐字段校验/回流会高频触发 focus / 渲染包回流，
    // 不加保护就会把 /fresh 打成死循环。节流内的重复调用直接放行（以最近一次复检为准），
    // 写操作门禁可接受此短暂时效，正常办理不受影响。
    const now = Date.now();
    if (now - lastFreshRef.current < 1500) return true;
    lastFreshRef.current = now;
    let res: any = null;
    try {
      res = await freshInstance(instanceId, pkgRef.current?.nodeKey, taskId || undefined);
    } catch (e: any) {
      const msg = e?.msg || e?.message || '';
      if (msg.includes('不存在')) {
        markStale('该流程已不存在（可能已被删除），请关闭本页');
        return false;
      }
      // 网络抖动等无法判定：不拦截，写操作由后端权威守卫兜底，避免误伤正常办理
      return true;
    }
    const p: any = pickPayload(res);
    if (p && p.stale) {
      markStale(p.staleReason || '流程状态已变更，本页已过期');
      return false;
    }
    return true;
  }, [instanceId, taskId, staleEnabled, markStale]);

  /** 写操作前的统一门禁：保存 / 提交 / 退回 / 转办 / 加签 / 催办 一律先过这里 */
  const guardFresh = useCallback(async (): Promise<boolean> => {
    if (!staleEnabled) return true;
    if (staleRef.current) {
      message.error('本页已过期：流程状态已变更，请刷新页面后重新操作');
      return false;
    }
    const ok = await checkFresh();
    if (!ok) {
      message.error('本页已过期：流程状态已变更（可能已回退或被他人流转），请刷新页面后重新操作');
    }
    return ok;
  }, [staleEnabled, checkFresh]);

  /** 统一失败提示：识别后端「本页已过期」并同步把本页降级为过期态 */
  const notifyFail = useCallback(
    (msg: string | undefined, fallback: string) => {
      const text = msg || fallback;
      if (isStaleMsg(text)) markStale(text);
      message.error(text);
    },
    [markStale],
  );

  // pkg 变化时同步快照，供定时器/异步回调里的复检读取
  useEffect(() => {
    pkgRef.current = pkg;
  }, [pkg]);

  // 换了实例或待办 → 解除过期态（新的一次办理起点）
  useEffect(() => {
    staleRef.current = false;
    setStale(null);
  }, [instanceId, taskId]);

  // 渲染包首次就绪 + 待办确定后复检一次：覆盖「用历史任务/旧链接打开」的过期页面
  // （此时渲染包与任务都还查得到，但流程早已不在该节点）。
  // 用 ref 保证「每个（实例, 待办）只复检一次」：pkg 引用每次渲染都是新对象，
  // 若直接依赖 pkg 会让该 effect 随表单回流反复跑 → /fresh 死循环。
  const initCheckedRef = useRef(false);
  useEffect(() => {
    initCheckedRef.current = false;
  }, [instanceId, taskId]);
  useEffect(() => {
    if (!pkg || !staleEnabled || initCheckedRef.current) return;
    initCheckedRef.current = true;
    checkFresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pkg, staleEnabled, instanceId, taskId]);

  // 主动识别过期：定时轮询 + 切回标签页/窗口聚焦时复检。
  // 覆盖「用户停在本页期间，流程被他人退回或流转」——界面不会自己更新，
  // 只有主动复检才能及时发现并把页面降级为只读。
  useEffect(() => {
    if (!staleEnabled) return;
    const timer = window.setInterval(() => {
      checkFresh();
    }, 20000);
    const onWake = () => {
      if (document.visibilityState === 'visible') checkFresh();
    };
    // 仅监听 visibilitychange（切回标签页/窗口时复检），去掉 window 'focus'：
    // 'focus' 会在表单逐字段聚焦 / 嵌入式环境反复触发，与 1.5s 节流叠加仍表现为 /fresh 死循环。
    // 空闲过期检测由下方 20s 轮询兜底，不依赖 focus。
    document.addEventListener('visibilitychange', onWake);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onWake);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staleEnabled]);

  // ── 退回：可退回节点候选 + 「选择退回目标」（与正式办理页 ApprovalPage 同口径）──
  /** 后端返回：type=1 直接退回（退默认/上一节点）；type=2 选择退回节点 */
  const [rejectCandidates, setRejectCandidates] = useState<any>(null);
  /** 用户在弹窗里选中的退回目标节点 key */
  const [rejectTargetKey, setRejectTargetKey] = useState<string | undefined>(undefined);
  /** 退回后再提交的处理方式：1=逐级审批（缺省） 2=直达本节点（对齐 ecology 退回设置弹窗） */
  const [rejectResubmitMode, setRejectResubmitMode] = useState<number>(1);
  /** 附件（仅本地暂存；后端持久化接口待接入，与正式办理页同口径） */
  const [fileList, setFileList] = useState<any[]>([]);

  /** 关闭弹窗：一并清掉退回 / 转办 / 加签的临时态 */
  const closeModal = useCallback(() => {
    setModalType(null);
    setAssignee(undefined);
    setRejectCandidates(null);
    setRejectTargetKey(undefined);
    setRejectResubmitMode(1);
  }, []);

  /**
   * 退回：先拉可退回节点候选，拉到才开弹窗（查询失败不开，避免退到未知节点）。
   * 与「正式办理页」同口径：候选为空/失败一律终止。
   */
  const openReject = useCallback(async () => {
    if (!taskId) {
      message.warning('当前实例无该节点待办，无法「退回」');
      return;
    }
    if (!(await guardFresh())) return;
    try {
      const res: any = await rejectNodes(taskId);
      if (res?.success === false) {
        notifyFail(res?.msg, '查询退回节点失败');
        return;
      }
      const data: any = res?.data || {};
      const list: any[] = Array.isArray(data.nodes) ? data.nodes : [];
      setRejectCandidates(data);
      // 「退回设置」弹窗始终展示候选 radio 表；未点选时生效选中 = 默认退回节点
      // （defaultNodeKey），展示态与提交态一致，无需区分 type=1/2 与候选数量
      setRejectTargetKey(undefined);
      setRejectResubmitMode(1);
      setModalType('reject');
    } catch (e: any) {
      message.error(e?.msg || e?.message || '查询退回节点失败');
    }
  }, [taskId, guardFresh, notifyFail]);

  /**
   * 执行节点「自定义操作」：按节点配置走真实动作（可能写业务表 / 调外部接口），
   * 与其余写操作一样先过新鲜度门禁。
   */
  const runCustom = useCallback(
    async (op: any) => {
      if (!instanceId) {
        message.warning('当前实例不可用，无法执行该操作');
        return;
      }
      if (!(await guardFresh())) return;
      setActing(true);
      try {
        // 雪花 ID 按字符串下发，避免 Number() 丢精度（后端 @RequestParam Long 可绑定数字字符串）
        const res: any = await executeCustomOperation(String(op?.id), String(instanceId));
        if (res?.success === false) {
          notifyFail(res?.msg, '执行失败');
          return;
        }
        message.success('自定义操作已执行');
        onOperated?.();
      } catch (e: any) {
        notifyFail(e?.msg || e?.message, '执行失败');
      } finally {
        setActing(false);
      }
    },
    [instanceId, guardFresh, notifyFail, onOperated],
  );

  /** 节点「自定义操作」按钮：allowMenus 显式含 'custom' 时才拉（未启用不请求） */
  const [customOps, setCustomOps] = useState<any[]>([]);
  useEffect(() => {
    if (
      pkg?.defId &&
      pkg?.nodeKey &&
      (pkg.allowMenus || []).map(String).includes('custom')
    ) {
      // 雪花 ID 按字符串下发（后端 @RequestParam Long 可绑定数字字符串）
      listCustomOperations(String(pkg.defId), String(pkg.nodeKey))
        .then((r: any) => setCustomOps(Array.isArray(r?.data) ? r.data : []))
        .catch(() => setCustomOps([]));
    } else {
      setCustomOps([]);
    }
  }, [pkg?.defId, pkg?.nodeKey, pkg?.allowMenus]);

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
        // 调用方显式给了 taskId（生产办理页 URL 带入）时以它为准：
        // 会签 / 并行下同一节点有多条待办，自行查询可能取到别人的那条。
        if (alive) {
          setTaskId(taskIdProp ? String(taskIdProp) : hit ? String(hit.id) : undefined);
        }
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
  }, [instanceId, nodeKey, testMode, refreshKey]);

  // 渲染包未回来时先用测试结果里的节点名兜底，避免头部/徽标短暂显示「-」
  const nodeName =
    pkg?.nodeName ||
    (nodes || []).find((n: any) => String(n.nodeKey) === String(nodeKey))?.nodeName ||
    '-';

  // 头部「节点审批情况」跟随的节点：
  //  - 正式态：引擎当前节点 currentNodeKey（流程流转到哪，不随点开历史节点变）；
  //  - 测试态：用户正在查看/填写的节点 nodeKey（测试逐节点走查，nodeKey 即「当前节点」；
  //    且开始节点被自动完成后引擎停在下一节点，若跟 currentNodeKey 申请人姓名永远出不来）。
  const headerNodeKey = testMode ? nodeKey : currentNodeKey;
  const currentNodeNameResolved =
    (headerNodeKey != null
      ? (nodes || []).find((n: any) => String(n.nodeKey) === String(headerNodeKey))?.nodeName
      : undefined) ||
    (testMode ? undefined : currentNodeName) ||
    (headerNodeKey != null && String(headerNodeKey) === String(nodeKey) ? pkg?.nodeName : undefined) ||
    (headerNodeKey != null ? '-' : nodeName);
  /**
   * 当前节点的「实际办理人」：取实例态 `nodeOps[headerNodeKey]` 的「待办人 → 已操作 → 已查看」回退名单。
   * 这是引擎真正下发的待办办理人，而非节点设计态/测试结果里的候选人；
   * 测试态直接跟「查看节点」走，故开始节点能显示申请人、已办结节点也能显示办理人。
   */
  const currentNodeOperators = useMemo(() => {
    if (headerNodeKey == null) return [] as string[];
    const grp = nodeOps[String(headerNodeKey)] || {};
    // 优先「待办人」（流程此刻流转到谁在办理）；无待办时回退到「已操作 / 已查看」名单，
    // 让开始节点（申请人，已被引擎自动完成 → 落在 handled）与已办结节点也能显示出操作者姓名，
    // 否则这些节点 todo 为空、头部只能退回「测试实例 #id」兜底，看不到是谁在操作。
    const ids: any[] = (grp.todo && grp.todo.length
      ? grp.todo
      : [...(grp.handled || []), ...(grp.viewed || [])]);
    return ids.map((id: any) => resolveUserName(id)).filter(Boolean);
  }, [headerNodeKey, nodeOps, resolveUserName]);

  /**
   * 当前节点的「下一个节点」及其操作者：沿出口（links）找 `fromNodeKey === 当前节点` 的下游节点，
   * 再据节点清单取目标节点的名称与操作者（设计态/测试结果里已解析的候选人）。
   * 用于头部「下个节点：…」，让用户提前看到流程下一步会流转到谁（网关多出口时并列展示）。
   */
  const nextNodes = useMemo(() => {
    if (currentNodeKey == null || !links || !links.length) return [] as any[];
    return (links as any[])
      .filter((l: any) => String(l.fromNodeKey) === String(currentNodeKey) && l.isReject !== 1)
      .map((l: any) => {
        const tk = l.toNodeKey;
        const tn = (nodes || []).find((n: any) => String(n.nodeKey) === String(tk));
        return {
          key: tk,
          name: tn?.nodeName || l.toNodeName || tk,
          ops: (tn?.operators || []).map((o: any) => o.userName).filter(Boolean),
        };
      })
      .filter((n: any) => n.key != null);
  }, [currentNodeKey, links, nodes]);

  /**
   * 表单是否可编辑（同时决定表单读写与「保存」是否可用）：
   *  - 预览（设计态）→ 只读；
   *  - 测试态 → 有测试待办才可编辑（`!hasPending`）；开始节点无待办但需补填，故不能用 `!taskId`；
   *  - 正式态 → **本人在当前节点有待办即可编辑**（`!taskId`）；已办/我的请求查看态无待办 → 只读。
   */
  const formEditable = !preview && (testMode ? !!hasPending : !!taskId);

  /**
   * 签字意见是否必填（对齐 ecology「意见必填」三态，与「正式办理页」同口径）：
   *  never=从不要求 / all=所有操作均必填 / byOperation=仅指定操作必填（如只「退回」必填）。
   *  未配置时回退旧字段 `opinionRequired`（等价于 all）。
   */
  const isOpinionRequired = (op: string): boolean => {
    const mode = pkg?.opinionMustInput;
    if (mode === 'all') return true;
    if (mode === 'byOperation') {
      return (pkg?.opinionMustInputOperations || []).map(String).includes(op);
    }
    return !!pkg?.opinionRequired;
  };

  // 操作菜单：与发起页 `Start.tsx#menuAllowed` 同口径，避免"同一流程两边按钮不一样"：
  //   - 渲染包未回来（pkg 为空）→ 一个都不给（否则会退化成"未配置=全量"，闪出一堆按钮）；
  //   - allowMenus 为 null/未配置 → 不限制（按 MENUS_OPTIONS 全量）；
  //   - 配置过 → 只给集合内的动作（空数组 = 全部禁用）。
  // 测试态**不再过滤菜单**（改为置灰）：集合与正式完全一致，隔离动作在渲染时禁用并给悬浮说明。
  // 「保存」是固有能力（与发起页 `canSave = !!def.formId` 口径一致，不看节点「操作菜单」开关）：
  // 只要当前可编辑就补上，否则节点菜单没勾「保存」时办理/测试页会缺「保存」按钮。
  const menus = useMemo(() => {
    if (!pkg) return [];
    const all = MENUS_OPTIONS.map((o) => String(o.value));
    // 'custom' 不渲染成通用按钮（点了只会提示"暂未接入"），改由下方 customOps 渲染真实按钮
    let allowed = (
      pkg.allowMenus == null ? all : all.filter((c) => (pkg.allowMenus || []).map(String).includes(c))
    ).filter((c) => c !== 'custom');
    // 创建节点(nodeType=0)：对齐「正式发起页」开始节点的操作集 —— 仅 提交/保存/打印/填写意见/附件。
    // 退回/转发/转办/加签/传阅/征询/催办等在第一个节点无意义（无上游可退回，且发起页本就不给这些），
    // 测试页与正式页在开始节点保持菜单完全一致，避免出现「开始节点却显示退回」的差异。
    const atStartNode = (nodes || []).some(
      (n: any) => String(n.nodeKey) === String(nodeKey) && n.nodeType === 0,
    );
    if (atStartNode) {
      allowed = allowed.filter((c) => ['submit', 'save', 'print', 'opinion', 'attach'].includes(c));
    }
    // 仅「本人可操作节点」展示写操作（提交/退回/转发/转办/加签/传阅/催办…）：
    // 正式态=当前节点有待办(taskId)、测试态=有待办(hasPending)，或测试态开始节点（申请人补填后提交）。
    // 查看无待办的其它节点（历史节点 / 他人节点）只保留 打印 / 填写意见 / 附件 等只读辅助动作，
    // 避免出现「当前节点不是我操作的却显示提交」的错位。
    const canOperate = formEditable || (testMode && atStartNode);
    if (!canOperate) {
      allowed = allowed.filter((c) => ['print', 'opinion', 'attach'].includes(c));
    }
    if (formEditable && !allowed.includes('save')) {
      const i = allowed.indexOf('submit');
      return i >= 0
        ? [...allowed.slice(0, i + 1), 'save', ...allowed.slice(i + 1)]
        : ['save', ...allowed];
    }
    return allowed;
  }, [pkg, formEditable, nodes, nodeKey, testMode]);

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

  /** 关闭当前标签页（非新标签打开时回退为返回上一页）——与发起页 `closeTab` 同口径 */
  const closeTab = () => {
    if (window.opener) {
      window.close();
    } else if (window.history.length > 1) {
      window.history.back();
    }
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
    // 注：attach 已纳入 NEED_EXTRA（走上传弹窗），此处不再提前拦截
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
      if (isOpinionRequired('submit') && isRichTextEmpty(opinion)) {
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
      if (!(await guardFresh())) return;
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
    // 写操作统一门禁：本页已过期（流程已回退/被他人流转/已归档）则中断，绝不写回过期数据
    if (!(await guardFresh())) return;
    // 退回：需先拉可退回节点候选、由用户选目标节点，故单独分支（不走下面的直接办理）
    if (code === 'reject') {
      await openReject();
      return;
    }
    // 提交：先走表单自身的布局级必填校验（会标红并提示具体缺失字段名）。
    // 校验通过由 ApprovalFormRender.onSubmit 回调再次进入本函数（submitAfterValidateRef 置位）。
    if (code === 'submit' && formRef.current && !submitAfterValidateRef.current) {
      submitAfterValidateRef.current = true;
      // ExcelPreview.handleSubmit 是同步的：校验通过会同步回调 onSubmit → run('submit')
      formRef.current.submit();
      submitAfterValidateRef.current = false;
      return;
    }
    submitAfterValidateRef.current = false;
    // 本页已接入的写操作只有 提交 / 退回 / 催办；其余菜单码（转办/转交/传阅/意见征询/抄送…）
    // 尚未接入，**绝不能兜底成「催办」**（否则点错按钮会执行错误动作）。
    if (code !== 'submit' && code !== 'reject' && code !== 'urge') {
      message.info(`「${menuLabel(code)}」在办理页暂未接入，请在正式流程中使用`);
      return;
    }
    if ((code === 'submit' || code === 'reject') && isOpinionRequired(code) && isRichTextEmpty(opinion)) {
      message.warning(`当前节点要求填写签字意见，无法「${menuLabel(code)}」`);
      return;
    }
    // 与「测试态提交 / 保存」同口径：坐标键（布局回显）+ 字段名键（出口条件 UEL ${字段名}）
    // 一并作为流程变量下发；否则表单值传不到引擎，排他网关会走错分支。
    let layout: any = null;
    try {
      layout = pkg?.layoutJson ? JSON.parse(pkg.layoutJson) : null;
    } catch {
      layout = null;
    }
    // 优先用「校验通过时回传的最新值」，其次才是 onChange 累积的 formValues
    const submitValues = submitValuesRef.current || formValues;
    const variables: Record<string, any> = {
      ...(pkg?.dataJson || {}),
      ...submitValues,
      ...collectFieldValues(layout, submitValues),
    };
    // 提交前：服务端按节点必填矩阵复核（前端校验不可信，与「正式办理页」同口径）。
    // 布局级必填已由 ExcelPreview 提交时校验，这里补「字段权限=必填」那一层。
    if (code === 'submit') {
      try {
        const vres: any = await validateForm({
          instanceId,
          defId: pkg?.defId,
          nodeKey: nodeKey || pkg?.nodeKey,
          formData: variables,
        });
        if (vres?.success === false) {
          notifyFail(vres?.msg, '服务端必填校验未通过');
          return;
        }
      } catch (e: any) {
        const vmsg = e?.msg || e?.message || '';
        // 明确是必填 / 过期问题时拦截；其余异常交给 approveTask 的后端守卫兜底，避免误伤正常办理
        if (/必填|过期/.test(vmsg)) {
          notifyFail(vmsg, '服务端必填校验未通过');
          return;
        }
      }
    }
    setActing(true);
    try {
      const res: any =
        code === 'submit'
          ? await approveTask(taskId, { opinion, variables })
          : code === 'reject'
            ? await rejectTask(taskId, { opinion })
            : await urgeTask(taskId, { opinion });
      if (res?.success === false) {
        message.error(res?.msg || '操作失败');
        return;
      }
      afterOperate(menuLabel(code));
      // 与「正式办理页」同口径：提交 / 退回后关闭页签（加签 / 传阅 / 催办 / 附件留在原页继续操作）。
      // 仅非内嵌时自动关闭 —— 内嵌时本组件是宿主页面的一部分，关页会把宿主页面一起关掉。
      if (!embedded && (code === 'submit' || code === 'reject')) {
        window.setTimeout(() => closeTab(), 800);
      }
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
    // 退回：目标节点已在弹窗里选好（单候选则自动取默认节点），不需要选人员
    if (modalType === 'reject') {
      if (!(await guardFresh())) return;
      if (isOpinionRequired('reject') && isRichTextEmpty(opinion)) {
        message.warning('当前节点要求填写签字意见，无法「退回」');
        return;
      }
      const list: any[] = Array.isArray(rejectCandidates?.nodes) ? rejectCandidates.nodes : [];
      // 弹窗为 radio 选择表，未点选时以「默认退回节点」为生效选中（与展示态一致）
      const effKey = rejectTargetKey ?? rejectCandidates?.defaultNodeKey ?? list[0]?.nodeKey;
      if (list.length > 0 && !effKey) {
        message.warning('请选择退回节点');
        return;
      }
      // ⚠️ type=2 时后端无条件要求 targetNodeKey（rejectType==2 且无目标直接抛错）；
      //    type=1 显式带上用户所选节点同样合法（后端校验目标在可退回集合内）。
      const target = list.length > 0 ? effKey : undefined;
      setActing(true);
      try {
        const res: any = await rejectTask(taskId, {
          opinion,
          targetNodeKey: target,
          // 退回后再提交的处理方式：1 逐级审批 / 2 直达本节点（后端 reject 写引擎标记，
          // 退回目标节点重新提交时消费，跳过中间节点直达本次执行退回的节点）
          resubmitMode: rejectResubmitMode,
        });
        if (res?.success === false) {
          notifyFail(res?.msg, '退回失败');
          return;
        }
        closeModal();
        afterOperate('退回');
      } catch (e: any) {
        notifyFail(e?.msg || e?.message, '退回失败');
      } finally {
        setActing(false);
      }
      return;
    }
    // 附件：暂仅本地选择（后端持久化接口待接入），确定即收进本次附件列表
    if (modalType === 'attach') {
      closeModal();
      return;
    }
    if (!assignee) {
      message.warning(`请选择${modalType === 'circulate' ? '传阅人' : '人员'}`);
      return;
    }
    if (!(await guardFresh())) return;
    setActing(true);
    try {
      // ⚠️ assignee 是 19 位雪花 ID **字符串**（PersonOrgField 回传 id 串）：
      //   绝不能 Number() 转换 —— JS Number 只有 16 位有效精度，会指派到另一个人。
      //   后端 DTO 是 Long，Jackson 能把数字字符串正确反序列化为 Long，故按字符串下发。
      // 传阅可多选：PersonOrgField 回传逗号 id 串，拆成数组下发。
      // 保持字符串不转 Number —— 19 位雪花 ID 转 Number 会丢精度、传阅给错误的人。
      const assignees = String(assignee)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const res: any =
        modalType === 'circulate'
          ? await circulateTask(taskId, { opinion, assignees })
          : modalType === 'forward'
            ? await forwardTask(taskId, { opinion, assignee: String(assignee) })
            : await addSignTask(taskId, {
                opinion,
                assignee: String(assignee),
                addSignType,
              });
      if (res?.success === false) {
        message.error(res?.msg || '操作失败');
        return;
      }
      afterOperate(menuLabel(modalType || ''));
      // 转办后关闭页签（与正式办理页同口径）；加签 / 传阅留在原页继续操作。
      // 仅非内嵌时关闭（内嵌时关页会连宿主页面一起关掉）。
      if (!embedded && modalType === 'forward') {
        window.setTimeout(() => closeTab(), 800);
      }
      setModalType(null);
    } catch (e: any) {
      message.error(e?.msg || '操作失败');
    } finally {
      setActing(false);
    }
  };

  const runMenu = (code: string) => () => run(code);

  const menuBtn = (code: string) => {
    // 测试态：保留按钮位置但置灰（隔离动作），并给悬浮说明 —— 使「测试 ↔ 正式」按钮布局一致
    const blocked = testMode && TEST_BLOCKED_MENUS.includes(code);
    const btn = (
      <Button
        key={code}
        size="small"
        type={code === 'submit' ? 'primary' : 'default'}
        danger={code === 'reject'}
        disabled={blocked}
        loading={code === 'submit' && (acting || !!submitting)}
        onClick={runMenu(code)}
      >
        {menuLabel(code)}
      </Button>
    );
    // 禁用按钮自身不派发鼠标事件，用 span 包裹让 Tooltip 生效
    return blocked ? (
      <Tooltip key={code} title={TEST_BLOCKED_TIP}>
        <span style={{ display: 'inline-block', cursor: 'not-allowed' }}>{btn}</span>
      </Tooltip>
    ) : (
      btn
    );
  };

  // 前 3 个外露，其余收进「⋯」更多菜单（对齐 ecology 表单右上角的紧凑按钮栏）
  const inlineMenus = menus.slice(0, 3);
  const moreMenus = menus.slice(3);

  // 渲染包未回来时用测试结果里的实例状态兜底
  const effectiveInstStatus = pkg?.instanceStatus ?? instanceStatus;
  const statusCfg = effectiveInstStatus != null ? INST_STATUS[effectiveInstStatus] : undefined;

  /**
   * 意见显示范围（节点「意见显示设置」）：
   *  all=全部可见（缺省） / none=全不可见 / list=仅 opinionViewNodeKeys 内节点可见。
   */
  const visibleLogs = useMemo(() => {
    const mode = pkg?.opinionViewMode || 'all';
    if (mode === 'none') return [];
    if (mode === 'list') {
      const keys: string[] = (pkg?.opinionViewNodeKeys || []).map(String);
      return logs.filter((l: any) => keys.includes(String(l.nodeKey)));
    }
    return logs;
  }, [logs, pkg?.opinionViewMode, pkg?.opinionViewNodeKeys]);

  const statusColumns = [
    {
      title: '节点名称',
      dataIndex: 'nodeName',
      width: 160,
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
      {/* ⓪ 过期横幅：流程已回退 / 节点已变更 / 任务已办结，但界面未刷新时置顶告警。
          具体指引由后端 staleReason 按场景给出，此处只说明「写操作已停用」并给刷新入口。 */}
      {stale && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message="流程状态已变更，本页已过期"
          description={`${stale.reason}。为避免把过期数据写回，本页的保存/提交/退回等操作已停用。`}
          action={
            <Button size="small" type="primary" onClick={() => window.location.reload()}>
              刷新页面
            </Button>
          }
        />
      )}
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
            <span style={{ fontWeight: 600 }}>{currentNodeNameResolved}</span>
            {currentNodeOperators.length > 0 ? (
              <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)', marginLeft: 8 }}>
                （当前操作者：{currentNodeOperators.join('、')}）
              </span>
            ) : testMode && instanceId ? (
              // 当前节点未解析出待办人时的兜底（仅测试域实例）：让测试页仍能对上具体实例
              <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)', marginLeft: 8 }}>
                （测试实例 #{instanceId}）
              </span>
            ) : null}
            {nextNodes.length > 0 && (
              <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)', marginLeft: 12 }}>
                下个节点：
                {nextNodes.map((n: any, i: number) => (
                  <span key={String(n.key)}>
                    {i > 0 ? '；' : ''}
                    <span style={{ fontWeight: 600 }}>{n.name}</span>
                    {n.ops.length > 0
                      ? `（操作者：${n.ops.join('、')}）`
                      : '（未配置操作者）'}
                  </span>
                ))}
              </span>
            )}
          </span>
          {statusCfg && <Tag color={statusCfg.color}>{statusCfg.label}</Tag>}
          {preview && <Tag color="default">预览</Tag>}
          {!taskId && menus.length > 0 && !preview && (
            <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>
              {testMode
                ? viewingStartNode
                  ? '开始节点（申请人）表单：填写后点「提交」，即按申请人提交推进到下一节点'
                  : hasPending
                    ? '当前查看的节点无待办；「提交」作用于实例当前待办节点（可用「查看节点」切换）'
                    : '当前节点无待办（可切换节点查看，或点「开始自动测试」）'
                : '当前节点无待办（实例已归档），按钮不可执行'}
            </span>
          )}
          {preview && (
            <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>
              设计态预览（只读，不创建测试实例）
            </span>
          )}
        </Space>
        {!preview && (
          <Space size={6} wrap>
            {/* 过期页面：操作按钮整体停用，只保留「刷新页面」（与顶部横幅同一处理） */}
            {stale ? (
              <Button size="small" type="primary" onClick={() => window.location.reload()}>
                刷新页面
              </Button>
            ) : (
              <>
                {inlineMenus.map(menuBtn)}
                {moreMenus.length > 0 && (
              <Dropdown
                menu={{
                  items: moreMenus.map((c) => {
                    const blocked = testMode && TEST_BLOCKED_MENUS.includes(c);
                    return {
                      key: c,
                      label: blocked ? `${menuLabel(c)}（测试域不支持）` : menuLabel(c),
                      disabled: blocked,
                    };
                  }),
                  onClick: ({ key }) => run(key),
                }}
              >
                  <Button size="small" icon={<EllipsisOutlined />} />
                </Dropdown>
              )}
              </>
            )}
            {/* 节点「自定义操作」按钮：由后端配置驱动；测试域置灰（TEST_BLOCKED_MENUS 含 custom） */}
            {customOps.map((op: any) => {
              const blocked = !!testMode;
              const btn = (
                <Button key={op.id} size="small" disabled={blocked} onClick={() => runCustom(op)}>
                  {op.name || op.label || '自定义操作'}
                </Button>
              );
              return blocked ? (
                <Tooltip key={op.id} title={TEST_BLOCKED_TIP}>
                  <span style={{ display: 'inline-block', cursor: 'not-allowed' }}>{btn}</span>
                </Tooltip>
              ) : (
                btn
              );
            })}
            {/* 返回：非内嵌时显示（内嵌由父页统一提供）——与发起页 `!embedded` 口径一致 */}
            {!embedded && (
              <Button size="small" onClick={closeTab}>
                返回
              </Button>
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
                    ref={formRef}
                    testMode={testMode}
                    instanceId={preview ? undefined : instanceId}
                    previewDefId={preview ? previewDefId : undefined}
                    previewFormId={preview ? previewFormId : undefined}
                    nodeKey={nodeKey}
                    hideHeader
                    /* 可编辑性见上方 `formEditable` 的三条口径；
                       页面已过期时强制只读：表单按「原节点」渲染的字段权限已不适用于当前节点 */
                    readOnly={!formEditable || !!stale}
                    onPackage={setPkg}
                    // 始终回传当前值：测试态手动提交、办理态「保存」都要用它（原先仅测试态接线，导致办理态保存拿不到值）
                    onValuesChange={(v) => {
                      setFormValues(v || {});
                      onValuesChange?.(v || {});
                    }}
                    // 布局级必填校验通过后才真正提交（缺失字段已由 ExcelPreview 标红并提示字段名）
                    onSubmit={(vals: Record<string, any>, fieldValues: Record<string, any>) => {
                      submitValuesRef.current = { ...(vals || {}), ...(fieldValues || {}) };
                      submitAfterValidateRef.current = true;
                      run('submit');
                    }}
                  />
                  {/* 签字意见固定在流程表单最下方（对齐 ecology 流程处理页） */}
                  {/* 签字意见：受节点「签字意见设置」约束 ——
                      hideArea=整块不显示；hideInput=仅隐藏输入框（历史意见仍见下方「流转意见」） */}
                  {!preview &&
                    !pkg?.opinionHideArea &&
                    menus.some((c) =>
                      ['submit', 'reject', 'forward', 'sign', 'urge'].includes(c),
                    ) && (
                      <div id="flow-form-opinion" style={{ margin: '12px 0 4px' }}>
                        <div style={{ fontSize: 13, marginBottom: 4 }}>签字意见</div>
                        {/* 签字意见统一用富文本（与系统其余审批入口一致） */}
                        {!pkg?.opinionHideInput && (
                          <RichTextEditor
                            compact
                            height={140}
                            value={opinion}
                            onChange={setOpinion}
                            placeholder={
                              isOpinionRequired('submit')
                                ? '请填写签字意见（必填）'
                                : '签字意见（可选）'
                            }
                          />
                        )}
                      </div>
                    )}
                  {/* 流转意见：本实例全部节点的审批/流转记录。
                      切到下一节点（或归档节点）后即能看到上一节点的流转意见（对齐 ecology 处理页）。 */}
                  {/* 意见显示范围：none=整块不展示 */}
                  {pkg?.opinionViewMode !== 'none' && (
                    <div style={{ marginTop: 14 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                        流转意见
                      </div>
                      <Timeline
                        items={
                          visibleLogs.length === 0
                          ? [
                              {
                                children: (
                                  <span style={{ color: 'rgba(0,0,0,0.45)' }}>暂无流转记录</span>
                                ),
                              },
                            ]
                          : visibleLogs.map((l: any) => {
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
                                      <span style={{ fontWeight: 600 }}>{who}</span>
                                      {u?.desc ? (
                                        <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>
                                          {u.desc}
                                        </span>
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
                                      <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>
                                        {l.operateTime || ''}
                                      </span>
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
                      currentNodeKey={currentNodeKey ?? nodeKey}
                      nodeOperators={nodeOps}
                      resolveUserName={resolveUserName}
                      onSelectNode={onSelectNode}
                      height={420}
                    />
                  ) : (
                    <span style={{ color: 'rgba(0,0,0,0.45)' }}>暂无流程图（该流程未保存 BPMN）</span>
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
                        visibleLogs.length === 0
                          ? [
                              {
                                children: (
                                  <span style={{ color: 'rgba(0,0,0,0.45)' }}>暂无审批记录</span>
                                ),
                              },
                            ]
                          : visibleLogs.map((l: any) => ({
                              children: (
                                <Space size={6} wrap>
                                  <span style={{ fontWeight: 600 }}>
                                    {l.nodeName || l.nodeKey || '-'}
                                  </span>
                                  <RichTextView
                                    html={l.opinion}
                                    style={{ fontSize: 12, color: '#555', maxWidth: 420 }}
                                  />
                                  <span style={{ color: 'rgba(0,0,0,0.45)' }}>
                                    {l.operateTime || ''}
                                  </span>
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
        title={modalType === 'reject' ? '退回设置' : modalType ? menuLabel(modalType) : ''}
        open={!!modalType}
        okText={modalType === 'reject' ? '确定' : 'OK'}
        onOk={handleModalOk}
        confirmLoading={acting}
        onCancel={closeModal}
        destroyOnHidden
      >
        {modalType === 'reject' ? (
          <>
            {/* 请选择退回节点：radio 表格（节点名称 / 操作者），对齐 ecology「退回设置」弹窗。
                未点选时生效选中 = 后端默认退回节点（defaultNodeKey），与展示态保持一致。 */}
            <div style={{ marginBottom: 8 }}>请选择退回节点</div>
            {(rejectCandidates?.nodes?.length || 0) > 0 ? (
              <Radio.Group
                style={{ width: '100%' }}
                value={
                  rejectTargetKey ??
                  rejectCandidates?.defaultNodeKey ??
                  rejectCandidates?.nodes?.[0]?.nodeKey
                }
                onChange={(e) => setRejectTargetKey(e.target.value)}
              >
                <div
                  style={{
                    display: 'flex',
                    background: '#fafafa',
                    padding: '6px 12px',
                    borderRadius: 4,
                    color: 'rgba(0,0,0,0.65)',
                  }}
                >
                  <div style={{ flex: 1 }}>节点名称</div>
                  <div style={{ flex: 1 }}>操作者</div>
                </div>
                {(rejectCandidates?.nodes || []).map((n: any) => (
                  <label
                    key={n.nodeKey}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 12px',
                      cursor: 'pointer',
                      borderBottom: '1px solid #f5f5f5',
                    }}
                  >
                    <Radio value={n.nodeKey} style={{ marginRight: 0 }} />
                    <span style={{ flex: 1 }}>
                      {n.nodeName || n.nodeKey}
                      {/* 后端无「是否发起人」标记，靠 nodeType=0 派生（与正式办理页同口径） */}
                      {n.nodeType === 0 ? '（退回发起人）' : ''}
                    </span>
                    <span style={{ flex: 1, color: '#1677ff' }}>{n.operators || '-'}</span>
                  </label>
                ))}
              </Radio.Group>
            ) : (
              <div>
                确认退回？流程将回退到上一节点（或节点配置的默认退回节点），并保持流程继续运行。
              </div>
            )}
            {/* 退回后再提交的处理方式（对齐 ecology）：逐级审批=重新按顺序经过各节点；
                直达本节点=重新提交时跳过中间节点，直接回到本次执行退回的节点 */}
            <div style={{ margin: '16px 0 8px' }}>退回后再提交的处理方式</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'rgba(0,0,0,0.45)' }}>请选择：</span>
              <Radio.Group
                value={rejectResubmitMode}
                onChange={(e) => setRejectResubmitMode(e.target.value)}
              >
                <Radio value={1}>逐级审批</Radio>
                <Radio value={2}>直达本节点</Radio>
              </Radio.Group>
            </div>
          </>
        ) : modalType === 'attach' ? (
          <>
            <Upload
              multiple
              fileList={fileList}
              beforeUpload={() => false}
              onChange={({ fileList: fl }) => setFileList(fl)}
            >
              <Button size="small">选择文件</Button>
            </Upload>
            <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)', marginTop: 8 }}>
              附件仅本地暂存，持久化接口待接入（与正式办理页同口径）
            </div>
          </>
        ) : (
          <>
            <div style={{ marginBottom: 12 }}>
              <div style={{ marginBottom: 6 }}>
                {modalType === 'forward'
                  ? '转办人'
                  : modalType === 'circulate'
                    ? '传阅人（可多选）'
                    : '加签人'}
              </div>
              <PersonOrgField
                browserType={1}
                multiple={modalType === 'circulate'}
                value={assignee}
                onChange={(v: any) => setAssignee(v || undefined)}
                placeholder={modalType === 'circulate' ? '选择传阅人' : '选择人员'}
              />
            </div>
            {modalType === 'sign' && (
              <Radio.Group value={addSignType} onChange={(e) => setAddSignType(e.target.value)}>
                <Radio value={0}>前加签</Radio>
                <Radio value={1}>后加签</Radio>
              </Radio.Group>
            )}
          </>
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
