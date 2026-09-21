import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Divider,
  Empty,
  Modal,
  Radio,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  Timeline,
  Typography,
  Upload,
  message,
} from 'antd';
import {
  renderForm,
  approveTask,
  rejectTask,
  rejectNodes,
  forwardTask,
  addSignTask,
  circulateTask,
  markTaskViewed,
  urgeTask,
  validateForm,
  saveFormData,
  getBpmn,
  getInstance,
  freshInstance,
  getInstanceNodeOperators,
  getLogs,
  listNodes,
  listCustomOperations,
  executeCustomOperation,
} from '@/services/workflow';
import { MENUS_OPTIONS } from '@/pages/FormMode/WorkflowDesign/wfDict';
import ApprovalFormRender, {
  ApprovalFormHandle,
} from '@/pages/FormMode/ExcelDesign/components/ApprovalFormRender';
import FlowDiagram from '@/pages/FormMode/Test/components/FlowDiagram';
import { PersonOrgField } from '@/components/FormMode/PersonOrgPicker';
import { loadPersonOrgData } from '@/components/FormMode/personOrg';
import RichTextEditor, {
  RichTextView,
  focusRichText,
  isRichTextEmpty,
} from '@/components/RichTextEditor';
import { pickPayload } from '@/utils/utils';

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

/** 流转动作（wf_approval_log.log_type，对齐 WfApprovalLog 常量）→ 展示文案 */
const LOG_ACTION: Record<string, string> = {
  '0': '通过',
  '2': '提交',
  '3': '退回',
  '7': '转发',
  '9': '批注',
  h: '转办',
  s: '督办',
  t: '抄送',
  y: '批示',
};

/**
 * 流程审批界面（运行期，对齐 ecology 单据审批页）。
 *
 * <p>功能：</p>
 * <ul>
 *   <li>渲染真实表单：从审批态渲染包（{@code renderForm}）取布局/数据快照/字段权限，
 *       复用与「发起页 / 测试流程」**完全相同**的 {@link ApprovalFormRender}（Excel 布局
 *       layoutJson + 节点字段权限），保证同一流程在测试态与正式办理态版式一致。</li>
 *   <li>E9 风格操作按钮栏：按钮由当前节点的「操作菜单」({@code allowMenus}) 决定，
 *       与 ecology 节点操作菜单配置完全对应（提交/退回/转办/加签/填写意见/附件/打印/催办）。</li>
 *   <li>字段值驱动网关：点「提交」时把当前表单字段值作为流程变量下发引擎，
 *       变量名 = 字段名，须与出口条件 UEL（如 {@code ${amount > 1000}}）中的变量名一致。</li>
 * </ul>
 */
const ApprovalPage: React.FC = () => {
  const params = useMemo(() => {
    const sp = new URLSearchParams(window.location.search);
    return { instanceId: sp.get('instanceId'), taskId: sp.get('taskId') };
  }, []);
  const instanceId = params.instanceId;
  const taskId = params.taskId;

  /** 表单渲染句柄：自绘「提交」按钮经它触发与内置一致的布局级必填校验 */
  const formRef = useRef<ApprovalFormHandle>(null);
  const [loading, setLoading] = useState(true);
  const [pkg, setPkg] = useState<any>(null);
  const [readonly, setReadonly] = useState(false);
  const [allowMenus, setAllowMenus] = useState<string[]>([]);
  const [opinion, setOpinion] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // 弹窗状态：reject / forward / sign / attach
  const [modalType, setModalType] = useState<string | null>(null);
  const [modalAssignee, setModalAssignee] = useState<any>(undefined);
  const [modalAddSignType, setModalAddSignType] = useState<number>(0);
  const [fileList, setFileList] = useState<any[]>([]);
  // 退回：可退回节点候选（来自 /task/{id}/reject-nodes）+ 选中的目标节点
  const [rejectCandidates, setRejectCandidates] = useState<any>(null);
  const [rejectTargetKey, setRejectTargetKey] = useState<string | undefined>(undefined);
  /** 运行时自定义操作按钮（allowMenus 含 'custom' 时从 wf_custom_operation 拉取） */
  const [customOps, setCustomOps] = useState<any[]>([]);

  const dataJsonRef = useRef<Record<string, any>>({});
  /** Excel 布局表单的当前值（key = sheetId__row__col，明细表带 dt{idx}__r{n}__ 前缀） */
  const formValuesRef = useRef<Record<string, any>>({});

  /**
   * 「界面状态与实例状态不一致」识别结果（页面过期）。
   *
   * <p>场景：流程被退回、被他人流转、被撤回或归档之后，浏览器里已经打开的页面
   * 仍显示<b>原节点</b>（界面未刷新）。此时继续保存/提交会把过期数据写回，
   * 或在已失效的节点上完成办理。识别到后本页禁止一切写操作，并引导刷新。</p>
   */
  const [stale, setStale] = useState<{ reason: string } | null>(null);
  /** pkg 的最新值快照：复检发生在异步回调/定时器里，直接读 state 会拿到闭包旧值 */
  const pkgRef = useRef<any>(null);
  /** 过期标记的同步副本：同一 tick 内多次门禁调用也要立即生效 */
  const staleRef = useRef(false);

  /** 标记本页已过期（幂等：保留第一次的原因，避免被后续复检结果覆盖） */
  const markStale = useCallback((reason: string) => {
    staleRef.current = true;
    setStale((prev) => prev || { reason });
  }, []);

  /** 后端返回的过期提示统一措辞（见 WfTaskServiceImpl#staleTaskReason / WfFormRenderServiceImpl#save） */
  const isStaleMsg = (msg?: string) => !!msg && msg.includes('本页已过期');

  /**
   * 界面新鲜度复检（本规则的办理页落点）。
   *
   * <p>识别三类过期：① 实例已删除；② 实例已归档/不通过/撤回；③ 界面所在节点已不是活动节点
   * ——③ 即「流程已不在当前节点但界面仍显示原节点」，典型为退回或被他人流转。</p>
   *
   * <p>判定交给后端 {@code GET /instance/{id}/fresh}（单一权威实现，并行网关分支安全，
   * 不会把并行分支上的合法办理误判为过期），前端只负责拦截与提示。</p>
   *
   * @return true=页面仍有效可继续操作；false=已过期，必须中断本次写操作
   */
  const checkFresh = useCallback(async (): Promise<boolean> => {
    if (!instanceId) return true;
    if (staleRef.current) return false; // 已判定过期 → 一律拦截
    let res: any = null;
    try {
      res = await freshInstance(instanceId, pkgRef.current?.nodeKey, taskId || undefined);
    } catch (e: any) {
      const msg = e?.msg || e?.message || '';
      if (msg.includes('不存在')) {
        // 实例已被删除（后端抛「流程实例不存在」）
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
  }, [instanceId, taskId, markStale]);

  /**
   * 写操作前的统一门禁：保存 / 提交 / 退回 / 转办 / 加签 / 传阅 / 催办 一律先过这里。
   * 页面已过期则中断操作并提示刷新，绝不向后端发起可能写坏数据的请求。
   */
  const guardFresh = async (): Promise<boolean> => {
    if (staleRef.current) {
      message.error('本页已过期：流程状态已变更，请刷新页面后重新操作');
      return false;
    }
    const ok = await checkFresh();
    if (!ok) {
      message.error('本页已过期：流程状态已变更（可能已回退或被他人流转），请刷新页面后重新操作');
    }
    return ok;
  };

  /** 统一失败提示：识别后端「本页已过期」并同步把本页降级为过期态（阻止继续点击） */
  const notifyFail = (msg: string | undefined, fallback: string) => {
    const text = msg || fallback;
    if (isStaleMsg(text)) markStale(text);
    message.error(text);
  };

  useEffect(() => {
    if (!instanceId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    // 19 位雪花 ID 必须保持字符串：Number() 会丢精度（...538 → ...500）导致查不到实例/任务
    const tid = taskId || undefined;
    renderForm(instanceId, tid)
      .then(async (res: any) => {
        const p = res?.data;
        if (!p) {
          message.error('获取审批渲染包失败');
          return;
        }
        pkgRef.current = p;
        setPkg(p);
        setReadonly(!!p.readonly);
        setAllowMenus(p.allowMenus || []);
        const dj = p.dataJson || {};
        dataJsonRef.current = dj;
        // 表单初始值 = 数据快照；后续由 Excel 布局表单（ApprovalFormRender）的
        // onValuesChange 持续回填最新值，提交时连同快照一起作为流程变量下发
        formValuesRef.current = dj;
      })
      .catch((e: any) => {
        message.error(`获取审批渲染包失败：${e?.msg || e?.message || ''}`);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instanceId, taskId]);

  /**
   * 办理人打开办理页即视为「已查看」（后端只记首次，不覆盖）。
   * 流程图节点悬浮「操作者」面板据此把「待办且已打开」的人归到「已查看」（区别于「未操作」）。
   * 记录失败不影响办理，静默忽略。
   */
  useEffect(() => {
    if (!taskId) return;
    markTaskViewed(taskId).catch(() => {
      /* ignore */
    });
  }, [taskId]);

  /**
   * 打开页面即复检一次：覆盖「用历史任务/旧链接打开」的过期页面
   * （此时渲染包与任务都还查得到，但流程早已不在该节点）。
   */
  useEffect(() => {
    if (!pkg || !instanceId || done) return;
    checkFresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pkg, instanceId, done]);

  /**
   * 主动识别过期（界面未刷新的核心场景）：定时轮询 + 切回标签页/窗口聚焦时复检。
   *
   * <p>覆盖「用户停在本页期间，流程被他人退回或流转」——此时界面不会自己更新，
   * 只有主动复检才能及时发现并把页面降级为只读。</p>
   */
  useEffect(() => {
    if (!instanceId || done) return;
    const timer = window.setInterval(() => {
      checkFresh();
    }, 20000);
    const onWake = () => {
      if (document.visibilityState === 'visible') checkFresh();
    };
    window.addEventListener('focus', onWake);
    document.addEventListener('visibilitychange', onWake);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onWake);
      document.removeEventListener('visibilitychange', onWake);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instanceId, done]);

  // 自定义操作：allowMenus 含 'custom' 时拉取本节点启用的按钮
  useEffect(() => {
    if (pkg?.defId && pkg?.nodeKey && (allowMenus || []).includes('custom')) {
      listCustomOperations(Number(pkg.defId), pkg.nodeKey)
        .then((r: any) => setCustomOps(Array.isArray(r?.data) ? r.data : []))
        .catch(() => setCustomOps([]));
    } else {
      setCustomOps([]);
    }
  }, [pkg?.defId, pkg?.nodeKey, allowMenus]);

  // ── 布局状态：页签 / 审批记录 / 流程图 / 节点操作者（对齐「发起页 / 流程测试页」）──
  const [tab, setTab] = useState<'form' | 'diagram' | 'status'>('form');
  /** 本实例流转记录（倒序：最新在前） */
  const [logs, setLogs] = useState<any[]>([]);
  /** 流程定义 BPMN XML（「流程图」页签） */
  const [bpmnXml, setBpmnXml] = useState<string>('');
  /** 节点清单（「流程状态」页签） */
  const [nodes, setNodes] = useState<any[]>([]);
  /** 节点操作者分组（流程图节点「谁批的」+ 悬浮面板） */
  const [nodeOps, setNodeOps] = useState<Record<string, any>>({});
  /** 操作人 id → {姓名, 部门/角色}（复用统一人员字典，模块级缓存） */
  const [userMap, setUserMap] = useState<Record<string, { name: string; desc?: string }>>({});
  /** 流程定义 ID（渲染包 FormRenderVO 不带，需从实例取） */
  const [defId, setDefId] = useState<string>('');
  /** 流程标题/名称（实例 defName 优先，兜底 title，页首展示用） */
  const [procTitle, setProcTitle] = useState<string>('');
  /** 当前节点 Key（实例态兜底，节点操作者分组取数用） */
  const [curNodeKey, setCurNodeKey] = useState<string>('');

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

  /** 人员ID → 姓名（流程图节点下方「谁批的」与悬浮面板复用同一字典） */
  const resolveUserName = useCallback(
    (id: string | number) => userMap[String(id)]?.name || String(id),
    [userMap],
  );

  // 审批记录 + 节点操作者（打开即拉，流程图「谁批的」悬浮面板据此分组）
  useEffect(() => {
    if (!instanceId) return () => {};
    let alive = true;
    getLogs(instanceId)
      .then((r: any) => {
        if (alive) setLogs([...(r?.data || [])].reverse());
      })
      .catch(() => alive && setLogs([]));
    getInstanceNodeOperators(instanceId)
      .then((r: any) => {
        if (alive) setNodeOps(r?.data || {});
      })
      .catch(() => alive && setNodeOps({}));
    return () => {
      alive = false;
    };
  }, [instanceId]);

  // 实例信息（defId + 名称 + 当前节点）：渲染包 FormRenderVO 不带 defId，需单独取
  useEffect(() => {
    if (!instanceId) return;
    getInstance(instanceId)
      .then((r: any) => {
        const inst = r?.data;
        if (!inst) return;
        setDefId(inst.defId != null ? String(inst.defId) : '');
        setProcTitle(inst.defName || inst.title || '');
        setCurNodeKey(inst.currentNodeKey || '');
      })
      .catch(() => {});
  }, [instanceId]);

  // 流程定义相关：BPMN（流程图页签）+ 节点清单（流程状态页签），按实例拿到的 defId 拉取
  useEffect(() => {
    if (!defId) return;
    getBpmn(defId)
      .then((r: any) => setBpmnXml(r?.data || ''))
      .catch(() => setBpmnXml(''));
    listNodes(defId)
      .then((r: any) => setNodes(r?.data || []))
      .catch(() => setNodes([]));
  }, [defId]);

  // 当前用户不是处理人（只读）时，仅可查看，隐藏操作区
  const canOperate = !readonly;

  /**
   * 提交 / 同意：字段值作为流程变量驱动网关。
   *
   * <p>由 Excel 布局表单校验通过后回调（{@code formRef.current.submit()} →
   * 布局级必填校验 → 本函数），values 为该布局的表单值；
   * 与数据快照合并，确保所有字段都作为变量下发，避免网关变量缺失。</p>
   */
  /** 按操作类型判定意见是否必填（来自渲染包 signOpinion 设置） */
  const isOpinionRequired = (op: string): boolean => {
    const mode = pkg?.opinionMustInput;
    if (mode === 'all') return true;
    if (mode === 'byOperation') {
      return (pkg?.opinionMustInputOperations || []).includes(op);
    }
    return !!pkg?.opinionRequired; // 旧口径：opinionRequired=true 视为必填
  };

  const handleSubmit = async (values: Record<string, any>, fieldValues: Record<string, any>) => {
    if (!taskId) return;
    // 写操作门禁：流程可能已被退回/流转/归档而界面未刷新，过期则绝不发起提交
    if (!(await guardFresh())) return;
    // 三类键都下发：快照（可能含历史坐标键）+ 本次坐标键（供 Excel 布局回显）
    // + 字段名键（供出口条件 UEL / 必填矩阵，与测试流程一致）
    const variables = { ...dataJsonRef.current, ...(values || {}), ...(fieldValues || {}) };
    if (isOpinionRequired('submit') && isRichTextEmpty(opinion)) {
      message.warning('当前节点要求填写审批意见');
      return;
    }
    setSubmitting(true);
    try {
      // 服务端复核（节点字段权限必填矩阵 + 明细表必须新增）：与「测试页 /test/step」同口径；
      // defId/formId 不传，后端按 instanceId 反查（nodeKey 传本渲染节点，避免与实例当前节点不一致）
      await validateForm({ instanceId, nodeKey: pkg?.nodeKey, formData: variables });
      const res: any = await approveTask(taskId, { opinion, variables });
      if (res?.success === false) {
        // 后端权威判定为「页面过期」（回退/流转）→ 同步把本页降级为过期态
        if (isStaleMsg(res?.msg)) markStale(res.msg);
        message.error(res?.msg || '提交失败');
        return;
      }
      message.success('已提交，即将关闭');
      // 办理完成自动关闭页面（独立标签有 opener → window.close；否则回退上一页）
      setTimeout(() => closeTab(), 800);
    } catch (e: any) {
      const msg = e?.msg || '提交失败';
      if (isStaleMsg(msg)) markStale(msg);
      message.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const closeModal = () => {
    setModalType(null);
    setModalAssignee(undefined);
    setModalAddSignType(0);
    setFileList([]);
    setRejectCandidates(null);
    setRejectTargetKey(undefined);
  };

  /** 点击「退回」：先查可退回节点，决定直接退还是弹窗选节点 */
  const openReject = async () => {
    if (!taskId) return;
    // 弹窗只是查询，但退回目标依赖「当前节点」，过期节点上算出来的候选已不成立
    if (!(await guardFresh())) return;
    try {
      const res: any = await rejectNodes(taskId);
      if (res?.success === false) {
        notifyFail(res?.msg, '查询退回节点失败');
        return;
      }
      const data = res?.data || {};
      setRejectCandidates(data);
      // 选择退回且候选 > 1：默认选中默认节点或第一个；否则直接退（不带 targetNodeKey）
      const defaultKey = data.defaultNodeKey || (data.nodes && data.nodes[0]?.nodeKey);
      setRejectTargetKey(data.type === 2 && data.nodes?.length > 1 ? defaultKey : undefined);
      setModalType('reject');
    } catch {
      message.error('查询退回节点失败');
    }
  };

  /** 通用弹窗确认（退回/转办/加签） */
  const handleModalOk = async () => {
    if (!taskId) return;
    // 写操作门禁：弹窗期间流程可能已被退回/流转，过期则中止本次操作
    if (!(await guardFresh())) return;
    setSubmitting(true);
    try {
      if (modalType === 'reject') {
        if (isOpinionRequired('reject') && isRichTextEmpty(opinion)) {
          message.warning('当前节点要求填写审批意见');
          return;
        }
        // 选择退回（type=2）且候选 > 1 时必须指定目标节点
        const target =
          rejectCandidates?.type === 2 && rejectCandidates?.nodes?.length > 1
            ? rejectTargetKey
            : undefined;
        if (rejectCandidates?.type === 2 && !target) {
          message.warning('请选择退回节点');
          return;
        }
        const res: any = await rejectTask(taskId, { opinion, targetNodeKey: target });
        if (res?.success === false) return notifyFail(res?.msg, '退回失败');
        message.success('已退回');
      } else if (modalType === 'forward') {
        if (!modalAssignee) return message.warning('请选择转办人');
        // 转办目标人同为雪花ID，按字符串下发
        const res: any = await forwardTask(taskId, {
          opinion,
          assignee: modalAssignee,
        });
        if (res?.success === false) return notifyFail(res?.msg, '转办失败');
        message.success('已转办');
      } else if (modalType === 'sign') {
        if (!modalAssignee) return message.warning('请选择加签人');
        // 加签人同为雪花ID，按字符串下发
        const res: any = await addSignTask(taskId, {
          opinion,
          assignee: modalAssignee,
          addSignType: modalAddSignType,
        });
        if (res?.success === false) return notifyFail(res?.msg, '加签失败');
        message.success('已加签');
      } else if (modalType === 'circulate') {
        // 传阅（抄送）：可多选，生成 status=8 的知会任务，不占待办、不影响流转
        const list = Array.isArray(modalAssignee) ? modalAssignee : modalAssignee ? [modalAssignee] : [];
        if (list.length === 0) return message.warning('请选择传阅人');
        const res: any = await circulateTask(taskId, { opinion, assignees: list });
        if (res?.success === false) return notifyFail(res?.msg, '传阅失败');
        message.success('已传阅');
      } else if (modalType === 'attach') {
        // 附件暂仅本地选择，后端持久化接口待接入
        message.info('附件已选择（持久化接口待接入）');
      }
      closeModal();
      setDone(true);
    } catch (e: any) {
      notifyFail(e?.msg, '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUrge = async () => {
    if (!taskId) return;
    if (!(await guardFresh())) return;
    setSubmitting(true);
    try {
      const res: any = await urgeTask(taskId, { opinion });
      if (res?.success === false) return notifyFail(res?.msg, '催办失败');
      message.success('已催办');
    } catch (e: any) {
      notifyFail(e?.msg, '催办失败');
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * 保存（只存不流转）：把当前表单值写回业务行并同步本节点快照，
   * 不改任务状态、不推进引擎（对齐 ecology 节点「操作菜单 → 保存」）。
   */
  const handleSave = async () => {
    // 写操作门禁：保存会把当前表单值写回业务行与「本节点」快照，
    // 若流程已回退/流转（界面未刷新），必须拦下，避免污染数据
    if (!(await guardFresh())) return;
    setSubmitting(true);
    try {
      // 渲染包快照 + 用户本次改动，作为保存内容（与提交时的 variables 同口径）
      const values = { ...(dataJsonRef.current || {}), ...(formValuesRef.current || {}) };
      const res: any = await saveFormData({
        instanceId,
        taskId,
        nodeKey: pkg?.nodeKey,
        defId: defId || pkg?.defId,
        formId: pkg?.formId,
        dataId: pkg?.dataId,
        fieldValues: values,
      });
      if (res?.success === false) return notifyFail(res?.msg, '保存失败');
      message.success('已保存（未提交，流程未推进）');
    } catch (e: any) {
      notifyFail(e?.msg, '保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrint = () => window.print();

  /** 关闭当前标签页（非新标签打开时回退为返回上一页） */
  const closeTab = () => {
    if (window.opener) window.close();
    else if (window.history.length > 1) window.history.back();
  };

  /** 流转记录时间线（对齐参照系统：操作人/部门 → 签字意见高亮块 → 时间 + [节点/动作] + 接收人） */
  // 意见显示设置（屏显口径）：从渲染包取，约束意见块的展示
  const od = pkg?.opinionDisplay;
  const odViewTypes = od?.viewTypes && od.viewTypes.length ? od.viewTypes : null;
  const odStNull = !!od?.stNull;
  const odShowAll = !!od?.viewTypeAll; // false=仅显示最后一次意见
  // 流转动作 → 意见类型键（用于 viewTypes 白名单过滤；未登记的动作为 null=不约束）
  const LOG_TYPE_KEY: Record<string, string> = {
    '0': 'approve',
    '2': 'submit',
    '3': 'reject',
    '7': 'forward',
    '8': 'circulate',
  };
  const richEmpty = (html?: string) => {
    if (!html) return true;
    const text = html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .trim();
    return text.length === 0;
  };
  // 该条流转记录的意见块是否可见（叠加「签字意见设置」的显示范围约束）
  const showOpinion = (l: any, idx: number): boolean => {
    if (!l.opinion || (odStNull && richEmpty(l.opinion))) return false;
    if (!odShowAll && idx !== 0) return false; // 仅显示最新一次意见
    if (odViewTypes) {
      const key = LOG_TYPE_KEY[String(l.logType)];
      if (key && !odViewTypes.includes(key)) return false;
    }
    // 意见显示范围（signOpinion.viewNodeMode）：none=全不可见；list=仅指定节点可见
    const vm = pkg?.opinionViewMode;
    if (vm === 'none') return false;
    if (vm === 'list') {
      const keys: string[] = pkg?.opinionViewNodeKeys || [];
      if (!keys.includes(l.nodeKey)) return false;
    }
    return true;
  };
  const logItems =
    logs.length === 0
      ? [{ children: <Typography.Text type="secondary">暂无流转记录</Typography.Text> }]
      : logs.map((l: any, i: number) => {
          const u = userMap[String(l.operator)];
          const who =
            String(l.operator) === '0' ? '系统' : u?.name || String(l.operator || '-');
          return {
            children: (
              <div style={{ fontSize: 12 }}>
                <Space size={6} wrap>
                  <Typography.Text strong>{who}</Typography.Text>
                  {u?.desc ? (
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {u.desc}
                    </Typography.Text>
                  ) : null}
                </Space>
                {showOpinion(l, i) ? (
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
                <Space size={6} wrap>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
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
              </div>
            ),
          };
        });

  const menuLabel = (code: string) =>
    MENUS_OPTIONS.find((o) => o.value === code)?.label || code;

  // 按 MENUS_OPTIONS 顺序渲染当前节点允许的按钮
  const actionButtons = useMemo(() => {
    const order = MENUS_OPTIONS.map((o) => o.value);
    const codes = (allowMenus || []).slice().sort(
      (a, b) => order.indexOf(a) - order.indexOf(b),
    );
    return codes
      .map((code) => {
        switch (code) {
          case 'submit':
            return (
              <Button
                key="submit"
                type="primary"
                loading={submitting}
                // 与发起页同一套：先跑布局级必填校验，通过后回调 handleSubmit(values)
                onClick={() => formRef.current?.submit()}
              >
                提交
              </Button>
            );
          case 'save':
            return (
              <Button key="save" loading={submitting} onClick={handleSave}>
                保存
              </Button>
            );
          case 'reject':
            return (
              <Button key="reject" danger onClick={openReject}>
                退回
              </Button>
            );
          case 'forward':
            return (
              <Button key="forward" onClick={() => setModalType('forward')}>
                转办
              </Button>
            );
          case 'sign':
            return (
              <Button key="sign" onClick={() => setModalType('sign')}>
                加签
              </Button>
            );
          case 'circulate':
            return (
              <Button key="circulate" onClick={() => setModalType('circulate')}>
                传阅
              </Button>
            );
          case 'opinion':
            return (
              <Button key="opinion" onClick={() => focusRichText('approval-opinion')}>
                填写意见
              </Button>
            );
          case 'attach':
            return (
              <Button key="attach" onClick={() => setModalType('attach')}>
                附件
              </Button>
            );
          case 'print':
            return (
              <Button key="print" onClick={handlePrint}>
                打印
              </Button>
            );
          case 'urge':
            return (
              <Button key="urge" loading={submitting} onClick={handleUrge}>
                催办
              </Button>
            );
          default:
            return null;
        }
      })
      .filter(Boolean);
  }, [allowMenus, submitting, opinion]);

  // 自定义操作按钮（'custom' 菜单项启用时渲染，点击触发后端 execute）
  const customButtons = useMemo(() => {
    if (!customOps || customOps.length === 0) return null;
    return customOps.map((op: any) => (
      <Button
        key={`custom-${op.id}`}
        onClick={async () => {
          // 自定义操作同样会写数据，先过新鲜度门禁
          if (!(await guardFresh())) return;
          try {
            const res: any = await executeCustomOperation(Number(op.id), Number(instanceId));
            if (res?.success === false) return notifyFail(res.msg, '执行失败');
            message.success('自定义操作已执行');
          } catch (e: any) {
            notifyFail(e?.msg, '执行失败');
          }
        }}
      >
        {op.btnName}
      </Button>
    ));
  }, [customOps, instanceId]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin description="加载审批单…" />
      </div>
    );
  }

  if (!instanceId) {
    return (
      <div style={{ padding: 24 }}>
        <Alert type="error" showIcon message="缺少参数" description="审批界面需要 URL 参数 instanceId（与可选的 taskId）。" />
      </div>
    );
  }

  if (done) {
    return (
      <div style={{ padding: 24 }}>
        <Alert
          type="success"
          showIcon
          message="已处理"
          description="该审批操作已完成。可关闭本页面。"
          action={
            <Button onClick={() => window.close()}>
              关闭
            </Button>
          }
        />
      </div>
    );
  }

  // 当前节点的下一操作者（实例态节点操作者分组：未操作/已操作的办理人）
  const curOpsKey = pkg?.nodeKey || curNodeKey;
  const curOps = curOpsKey ? nodeOps[curOpsKey] : undefined;
  const nextOpNames = Array.from(
    new Set([...(curOps?.todo || []), ...(curOps?.handled || [])].map(String)),
  )
    .map((id) => userMap[id]?.name || id)
    .join('、');

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5', padding: 16 }}>
      {/* ⓪ 页面过期横幅：「流程已回退/节点已变更但界面未刷新」时置顶告警并引导刷新 */}
      {stale && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message="流程状态已变更，本页已过期"
          description={`${stale.reason}。为避免把过期数据写回，本页的保存/提交/退回等操作已停用，请刷新页面后按最新节点重新办理。`}
          action={
            <Button size="small" type="primary" onClick={() => window.location.reload()}>
              刷新页面
            </Button>
          }
        />
      )}
      {/* 页首：流程标题 + 当前节点 + 下个节点操作者（对齐参照图页头） */}
      <div style={{ fontSize: 15, fontWeight: 600, color: '#1f1f1f', marginBottom: 10 }}>
        流程：处理 - {procTitle || '未命名流程'}
        {pkg?.nodeName ? ` - ${pkg.nodeName}` : ''}
        <span style={{ fontWeight: 400, marginLeft: 12, color: '#666' }}>
          下个节点操作者：{nextOpNames || '—'}
        </span>
      </div>
      {/* ① 顶部：左 = 三页签（流程表单 / 流程图 / 流程状态）；右 = 操作按钮 + 返回
          （对齐「发起页 / 流程测试页」的统一布局与参照图的紧凑操作区） */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 8,
          flexWrap: 'wrap',
          marginBottom: 8,
        }}
      >
        <Space
          size={4}
          wrap
          align="center"
          style={{
            background: '#e6f4ff',
            border: '1px solid #91caff',
            borderRadius: 6,
            padding: '0 12px',
          }}
        >
          <Tabs
            size="small"
            activeKey={tab}
            onChange={(v) => setTab(v as 'form' | 'diagram' | 'status')}
            style={{ marginBottom: 0 }}
            items={[
              { key: 'form', label: '流程表单' },
              { key: 'diagram', label: '流程图' },
              { key: 'status', label: '流程状态' },
            ]}
          />
        </Space>
        <Space size={6} style={{ marginTop: 4 }} wrap>
          {/* 过期页面：操作按钮整体停用，只保留「刷新页面」（与顶部横幅同一处理） */}
          {stale ? (
            <Button size="small" type="primary" onClick={() => window.location.reload()}>
              刷新页面
            </Button>
          ) : canOperate ? (
            actionButtons
          ) : (
            <Tag color="orange">只读（非当前处理人）</Tag>
          )}
          {!stale && canOperate ? customButtons : null}
          <Button size="small" onClick={closeTab}>
            返回
          </Button>
        </Space>
      </div>

      {/* ② 表单 / 流程图 / 流程状态 */}
      <div
        style={{
          background: '#fff',
          border: '1px solid #f0f0f0',
          borderRadius: 6,
          padding: 16,
        }}
      >
        {tab === 'form' && (
          <>
            {/* 表单：与「发起页 / 流程测试页」共用 ApprovalFormRender（Excel 布局 layoutJson
                + 节点字段权限 fieldPerms，按节点渲染，只读态由 readonly 控制）。
                注：该组件内部会自行拉一次 /form/render 取布局，与本页上方那次各取所需（本页拿
                操作菜单/只读态，组件拿布局），互不依赖，渲染包未回来时组件内部有自己的 loading。 */}
            {/* 页面已过期时强制只读：表单按「原节点」渲染的字段权限已不适用于当前节点 */}
            <ApprovalFormRender
              ref={formRef}
              instanceId={instanceId}
              taskId={taskId || undefined}
              readOnly={readonly || !!stale}
              hideHeader
              onValuesChange={(v: Record<string, any>) => {
                formValuesRef.current = v;
              }}
              onSubmit={handleSubmit}
            />

            {/* 签字意见：固定在表单最下方（对齐参照图/流程处理页），仅当前处理人可填。
                受节点「签字意见设置」约束：hideArea=整块不显示；hideInput=仅隐藏输入框（历史意见仍可见）。 */}
            {canOperate && !stale && !pkg?.opinionHideArea && (
              <div id="approval-opinion" style={{ margin: '14px 0 4px' }}>
                <div style={{ fontSize: 13, marginBottom: 4 }}>
                  签字意见{isOpinionRequired('submit') ? '（必填）' : ''}
                </div>
                {!pkg?.opinionHideInput && (
                  <RichTextEditor
                    compact
                    height={160}
                    value={opinion}
                    onChange={setOpinion}
                    placeholder={isOpinionRequired('submit') ? '请填写审批意见（必填）' : '请填写审批意见'}
                  />
                )}
              </div>
            )}

            {/* 流程信息：本实例全部节点的审批/流转记录（时间线，对齐参照图底部「流程信息」）*/}
            <Divider style={{ margin: '14px 0 10px' }} />
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>流程信息</div>
            <Timeline items={logItems} />

            {!canOperate && (
              <Alert
                type="info"
                showIcon
                style={{ marginTop: 12 }}
                message="您不是当前节点的处理人，表单仅可查看，不可进行审批操作。"
              />
            )}
          </>
        )}

        {tab === 'diagram' && (
          <div style={{ padding: '4px 0' }}>
            {bpmnXml ? (
              <FlowDiagram
                bpmnXml={bpmnXml}
                currentNodeKey={pkg?.nodeKey}
                nodeOperators={nodeOps}
                resolveUserName={resolveUserName}
                height={480}
              />
            ) : (
              <Empty description="暂无流程图（该流程未保存 BPMN）" />
            )}
          </div>
        )}

        {tab === 'status' && (
          <div style={{ padding: '4px 0' }}>
            <Table
              size="small"
              rowKey={(r: any) => String(r.nodeKey)}
              pagination={false}
              dataSource={nodes}
              columns={[
                {
                  title: '节点名称',
                  dataIndex: 'nodeName',
                  render: (v: string, r: any) => v || r.nodeKey,
                },
                {
                  title: '类型',
                  dataIndex: 'nodeType',
                  width: 110,
                  render: (v: number) => <Tag>{NODE_TYPE[v] ?? v}</Tag>,
                },
                { title: '节点Key', dataIndex: 'nodeKey', width: 240 },
              ]}
            />
            <div style={{ marginTop: 14 }}>
              <Timeline items={logItems} />
            </div>
          </div>
        )}
      </div>

      <Modal
        title={modalType ? menuLabel(modalType) : ''}
        open={!!modalType}
        onOk={handleModalOk}
        confirmLoading={submitting}
        onCancel={closeModal}
        destroyOnClose
      >
        {modalType === 'reject' && (
          rejectCandidates?.type === 2 && rejectCandidates?.nodes?.length > 1 ? (
            <div style={{ marginBottom: 12 }}>
              <div style={{ marginBottom: 6 }}>请选择退回节点</div>
              <Radio.Group
                value={rejectTargetKey}
                onChange={(e) => setRejectTargetKey(e.target.value)}
              >
                <Space direction="vertical">
                  {(rejectCandidates.nodes || []).map((n: any) => (
                    <Radio key={n.nodeKey} value={n.nodeKey}>
                      {n.nodeName || n.nodeKey}
                      <span style={{ color: '#999', marginLeft: 6 }}>
                        {NODE_TYPE[n.nodeType as number] || ''}
                      </span>
                    </Radio>
                  ))}
                </Space>
              </Radio.Group>
            </div>
          ) : (
            <p>确认退回？流程将回退到上一节点（或节点配置的默认退回节点），并保持流程继续运行。</p>
          )
        )}
        {modalType === 'forward' && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ marginBottom: 6 }}>转办人</div>
            <PersonOrgField
              browserType={1}
              multiple={false}
              value={modalAssignee}
              onChange={(v: any) => setModalAssignee(v || undefined)}
              placeholder="选择人员"
            />
          </div>
        )}
        {modalType === 'circulate' && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ marginBottom: 6 }}>传阅人（可多选）</div>
            <PersonOrgField
              browserType={1}
              multiple
              value={modalAssignee}
              onChange={(v: any) => setModalAssignee(v || undefined)}
              placeholder="选择人员"
            />
          </div>
        )}
        {modalType === 'sign' && (
          <>
            <div style={{ marginBottom: 12 }}>
              <div style={{ marginBottom: 6 }}>加签人</div>
              <PersonOrgField
                browserType={1}
                multiple={false}
                value={modalAssignee}
                onChange={(v: any) => setModalAssignee(v || undefined)}
                placeholder="选择人员"
              />
            </div>
            <Radio.Group
              value={modalAddSignType}
              onChange={(e) => setModalAddSignType(e.target.value)}
              style={{ marginBottom: 12 }}
            >
              <Radio value={0}>前加签</Radio>
              <Radio value={1}>后加签</Radio>
            </Radio.Group>
          </>
        )}
        {modalType === 'attach' && (
          <Upload fileList={fileList} beforeUpload={() => false} onChange={({ fileList: fl }) => setFileList(fl)} multiple>
            <Button>选择附件</Button>
          </Upload>
        )}
      </Modal>
    </div>
  );
};

export default ApprovalPage;
