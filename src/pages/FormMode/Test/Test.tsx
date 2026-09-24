import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Form,
  Modal,
  Row,
  Segmented,
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

import TestFlowPicker from '@/pages/FormMode/Test/components/TestFlowPicker';
import WfLogTimeline from '@/pages/FormMode/components/WfLogTimeline';
import StartFlow from '@/pages/Workflow/Create/Start';
import {
  approveWorkflowTest,
  cleanupWorkflowTest,
  getBpmn,
  getMyWorkflowTestTodo,
  getWorkflowTest,
  listDefinitions,
  listLinks,
  listNodes,
  listWorkflowTest,
  removeWorkflowTest,
  runWorkflowTest,
  shadowWorkflowTest,
  startWorkflowTest,
  stepWorkflowTest,
  workflowBrowserApi,
  WfTestLogItem,
  WfTestResult,
} from '@/services/workflow';
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

/** 流程定义状态：0草稿 1已发布 2停用 3测试 */
const DEF_STATUS: Record<number, string> = { 0: '草稿', 1: '已发布', 2: '停用', 3: '测试' };

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
    case 3:
      return <Tag color="processing">进行中</Tag>;
    default:
      return <Tag color="red">未通过</Tag>;
  }
};

const linkStatusTag = (s?: number) =>
  s === 1 ? <Tag color="green">已走过</Tag> : <Tag color="default">未走过</Tag>;

/**
 * 从后端必填提示里抽出「缺失字段名」，用于提示条主文案：
 * 「节点【申请人】以下字段为必填： 采购事由、金额」→ ['采购事由','金额']
 * 「开始节点【申请人】表单必填未填： 采购事由」→ ['采购事由']
 * 字段名可能带「标签(字段名)」后缀，展示时去掉括号部分。
 */
const pickMissingFields = (msg?: string | null): string[] => {
  if (!msg) return [];
  const m = /必填[^：:]*[：:]\s*(.+)$/.exec(msg.replace(/\s+/g, ' '));
  if (!m) return [];
  return m[1]
    .split(/[、,，]/)
    .map((s) => s.trim().replace(/\([^)]*\)$/, '').trim())
    .filter(Boolean);
};

/**
 * 必填阻塞提示文案：与 ExcelPreview 的「有 N 个必填项未填写，请检查标红字段」同口径，
 * 并尽量带上具体字段名（取自后端消息里的缺失字段），让用户知道「到底是哪个字段必填」。
 */
const requiredTip = (msg?: string | null): string => {
  const fs = pickMissingFields(msg);
  if (fs.length) return `有 ${fs.length} 个必填项未填写（${fs.join('、')}），请检查标红字段`;
  return '有必填项未填写，请检查标红字段';
};

const WorkflowTestPage: React.FC = () => {
  const [defs, setDefs] = useState<any[]>([]);
  /** 路径类型（流程分类）字典：value=类型id，label=类型名称（对齐 ecology path_type） */
  const [wfTypes, setWfTypes] = useState<any[]>([]);
  const [defId, setDefId] = useState<any>(undefined);
  const [testUserId, setTestUserId] = useState<any>(undefined);
  const [coverBranches, setCoverBranches] = useState<boolean>(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WfTestResult | null>(null);
  const [history, setHistory] = useState<WfTestLogItem[]>([]);
  const [logView, setLogView] = useState<{ title: string; content: string } | null>(null);

  const [shadowOpen, setShadowOpen] = useState(false);
  const [shadowData, setShadowData] = useState<any>(null);
  const [shadowLoading, setShadowLoading] = useState(false);

  /** 节点Key -> 节点名称（影子比对路径展示用；基准版本节点名取不到时回退到 key） */
  const nodeNameOf = (k?: string) =>
    (viewNodes || []).find((n: any) => n.nodeKey === k)?.nodeName || k || '-';
  /** 设计态节点/出口（选流程即从 definition 拉取，无需测试实例即可渲染面板） */
  const [designNodes, setDesignNodes] = useState<any[]>([]);
  const [designLinks, setDesignLinks] = useState<any[]>([]);
  /** 运行测试时这两份被 result.nodes/links 覆盖；未跑测试时用设计态数据渲染 */
  const viewNodes = result?.nodes || designNodes;
  const viewLinks = result?.links || designLinks;

  // 默认查看节点＝「开始节点（申请人）」表单：对齐真实「发起流程」——先填申请人表单，再点「提交」推进。
  // 注意：开始节点在 instanceService.start 时已被引擎自动完成、不生成待办，所以它不是「当前(待办)节点」，
  // 但它是测试的起点表单；在此填值提交，后端 step() 会以提交值做开始节点必填校验并推进实例。
  // 用户用「查看节点」下拉手动选过之后（viewNodeKey 非空）不再自动切换。
  const defaultNodeKey = useMemo(() => {
    const ns: any[] = viewNodes || [];
    if (!ns.length) return undefined;
    return (ns.find((n) => n.nodeType === 0) || ns[0])?.nodeKey;
  }, [viewNodes]);
  const [viewNodeKey, setViewNodeKey] = useState<string | undefined>();
  // 用 ||（而非 ??）：实例归档后 currentNodeKey 会被清成空串，空串也要回退到默认节点
  const effectiveNodeKey = viewNodeKey || defaultNodeKey;
  // 当前查看节点的操作者不再在此解析：头部「节点审批情况」改为跟随实例当前节点（result.currentNodeKey），
  // 操作者取实例真实待办人（InstanceFlow 内由 nodeOps[currentNodeKey].todo 解析），见 InstanceFlow。
  // 办理（提交/退回/…）成功后自增，强制流程表单面板重新拉取渲染包/审批记录
  const [formKey, setFormKey] = useState(0);
  /**
   * 有效测试实例ID：失败/未发起时后端可能给 null 或异常值（如 `-1`），
   * 不能当作真实例去调 `/test/**`（否则会打出一串「测试实例不存在」）。
   */
  const validInstId =
    result?.instId != null && Number(result.instId) > 0 ? result.instId : undefined;

  /** 「开始自动测试」因必填被拦截而暂停时的提示（非空即展示暂停提示条） */
  const [startBlockMsg, setStartBlockMsg] = useState<string | null>(null);

  /** 必填阻塞提示文案（带具体字段名，与 ExcelPreview 同口径） */
  const blockTip = useMemo(() => requiredTip(startBlockMsg), [startBlockMsg]);

  // ── 交互式测试（对齐 ecology 流程测试页：开始测试 → 自动测试 / 暂停，或手动提交）──
  /** 自动测试循环是否在跑（点「暂停」置 false 后循环自然退出） */
  const [autoRunning, setAutoRunning] = useState(false);
  const autoRef = useRef(false);
  /** 面板「提交」进行中 */
  const [stepping, setStepping] = useState(false);
  /** 右侧面板是否自动跟随「当前节点」（用户手动选过节点后置 false） */
  const followRef = useRef(true);
  /** 因必填暂停：用户手动提交补齐后自动继续自动测试 */
  const resumeAutoRef = useRef(false);
  /** 入口确认「流程+发起人」后自动发起实例的防重标记（key = defId|testUserId） */
  const entryStartRef = useRef<string>('');
  /** 右侧实例表单的最新值（「继续测试」时带上它提交，避免必填仍为空） */
  const latestFormValuesRef = useRef<Record<string, any>>({});

  const [form] = Form.useForm();
  const [formFields, setFormFields] = useState<FieldDefinition[]>([]);
  const [formLoading, setFormLoading] = useState(false);
  /** 流程定义 BPMN XML（右侧「流程图」页签） */
  const [bpmnXml, setBpmnXml] = useState<string | undefined>();
  /** 左侧节点列表过滤：全部 / 已走过 */
  const [nodeFilter, setNodeFilter] = useState<'all' | 'passed'>('all');
  /** 左侧页签：节点 / 出口 / 场景 */
  const [leftTab, setLeftTab] = useState<'nodes' | 'links' | 'scenarios'>('nodes');

  const currentDef = useMemo(
    () => defs.find((d) => String(d.id) === String(defId)),
    [defs, defId],
  );
  const formId = currentDef?.formId;

  // 仅展示「激活版本」：按 procKey 分组，组内取 activeVersionId 指向的版本
  // （无锚点则取版本号最大者），并排除已删除；标签标记版本号。
  // 注意：锚点行本身可能已被删除（激活后被删），此时回退到组内剩余的最大版本，
  // 否则该流程会从列表里静默消失（如「测试914」的激活版本 v4 被删 → 整条流程不可见）。
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
      const byVersionDesc = [...list].sort(
        (a: any, b: any) => (b.version ?? 0) - (a.version ?? 0),
      );
      const active =
        (anchor != null && list.find((d) => String(d.id) === String(anchor))) || byVersionDesc[0];
      if (active) out.push(active);
    });
    return out;
  }, [defs]);

  // 仅「测试」状态（status=3）的流程进入「新建测试流程」选择器：
  // 与正式发起页 /workflow/create（只列已发布）互补，实现"测试态流程只在测试页可选"。
  const testDefs = useMemo(
    () => activeDefs.filter((d: any) => d.status === 3),
    [activeDefs],
  );

  // 分类 id → 分类名称
  const typeNameMap = useMemo(() => {
    const m = new Map<string, string>();
    (wfTypes || []).forEach((t: any) => m.set(String(t.value), t.label));
    return m;
  }, [wfTypes]);

  /** 已选流程所属分类名 */
  const currentCategory = currentDef
    ? typeNameMap.get(String(currentDef.type)) || '未分类'
    : '';

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

  const loadTypes = async () => {
    try {
      const res: any = await workflowBrowserApi.list('wftype');
      setWfTypes(res?.data || []);
    } catch {
      setWfTypes([]);
    }
  };

  /** 取流程定义 BPMN XML，供右侧「流程图」页签只读渲染 */
  const loadBpmn = async (id: any) => {
    if (!id) {
      setBpmnXml(undefined);
      return;
    }
    try {
      const res: any = await getBpmn(id);
      setBpmnXml(res?.data || undefined);
    } catch {
      setBpmnXml(undefined);
    }
  };

  useEffect(() => {
    loadDefs();
    loadTypes();
    // 左侧「测试历史」常驻：进页面就拉全量（不传 defId = 全部），选流程后会被该流程的历史覆盖
    loadHistory();
  }, []);

  /**
   * 选中流程并确认测试发起人（TestFlowPicker 内点流程后弹出人员选择）：
   * 两者齐备即进入测试界面，不自动发起任何测试实例。
   */
  const pickDef = (id: any, userId?: any) => {
    setDefId(id);
    if (userId != null && userId !== '') setTestUserId(userId);
    const d = activeDefs.find((x: any) => String(x.id) === String(id));
    message.success(
      `已选择：${d?.name || d?.procKey}（v${d?.version ?? '-'}）` +
        (userId ? '，测试发起人已确定，可开始测试' : '，请选择测试发起人后点「开始自动测试」'),
    );
  };

  useEffect(() => {
    setResult(null);
    form.resetFields();
    setFormFields([]);
    setViewNodeKey(undefined);
    if (defId) {
      loadFields();
      loadHistory();
      loadBpmn(defId);
      // 设计态节点/出口：选流程即加载，无需测试实例即可渲染面板与表单预览
      listNodes(defId as any)
        .then((r: any) => setDesignNodes(r?.data || []))
        .catch(() => setDesignNodes([]));
      listLinks(defId as any)
        .then((r: any) => setDesignLinks(r?.data || []))
        .catch(() => setDesignLinks([]));
    } else {
      setBpmnXml(undefined);
      setDesignNodes([]);
      setDesignLinks([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defId]);

  // 选好流程与发起人后不再自动发起测试实例（避免「一选测试人就开始跑测试」）。
  // 面板改为用设计态数据直接渲染：左侧「节点与出口」、右侧「节点审批情况 + 流程表单（预览）」。

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
      const d: WfTestResult | null = res?.data || null;
      setResult(d);
      // 一键测试跑完即到归档：面板切到归档节点，便于查看最终状态与流转意见
      followRef.current = true;
      syncViewNode(d);
      loadHistory();
      message.success('测试完成');
    } catch (e: any) {
      message.error(e?.msg || '流程测试失败');
    } finally {
      setLoading(false);
    }
  };

  /** 右侧面板跟随当前节点切换（用户手动指定后不再自动跟随） */
  const pickViewNode = (k?: string) => {
    followRef.current = false;
    setViewNodeKey(k);
  };

  /**
   * 发起交互式测试：真实发起测试态实例但「不自动推进」。
   * silent=true 供「选好流程+发起人后自动加载面板」使用：不弹错误、不强制顶层表单校验（允许空表单先发起）。
   */
  const startTest = async (silent = false): Promise<WfTestResult | null> => {
    if (!defId) {
      if (!silent) message.warning('请选择流程');
      return null;
    }
    if (!testUserId) {
      if (!silent) message.warning('请选择测试发起人');
      return null;
    }
    let formData: Record<string, any> = {};
    if (formId) {
      if (silent) {
        formData = form.getFieldsValue();
      } else {
        try {
          formData = await form.validateFields();
        } catch {
          return null;
        }
      }
    }
    setLoading(true);
    try {
      const res: any = await startWorkflowTest({ defId, testUserId, formData });
      if (res?.success === false) {
        // 失败一律提示（含入口静默发起）：否则用户只看到请求失败、不知道原因（如开始节点必填缺失）
        message.error(res?.msg || '发起测试失败');
        return null;
      }
      const data: WfTestResult | null = res?.data || null;
      followRef.current = true;
      setResult(data);
      // 发起/重新发起后回到「开始节点（申请人）」表单（defaultNodeKey），不直接跳到当前待办节点：
      // 对齐真实发起流程——先从申请人表单开始填写，提交后再自动跟随到新的当前节点。
      setViewNodeKey(undefined);
      loadHistory();
      if (data?.instId) {
        if (!silent) message.success('测试实例已发起，可「开始自动测试」或手动提交');
      } else if (!silent) {
        message.warning(data?.summary || '预校验未通过，无法发起测试');
      }
      return data;
    } catch (e: any) {
      // 同上传：失败必定提示原因（后端 R.fail 的 msg 已由请求层挂到 error.msg）
      message.error(e?.msg || '发起测试失败');
      return null;
    } finally {
      setLoading(false);
    }
  };

  /**
   * 「重新发起测试」：按当前「测试表单」的值重新创建一个测试态实例（停在首个待办，不自动推进）。
   * 用于补填/修改了测试表单值、或想重来一次时，把右侧真实实例表单刷新出来。
   */
  const restartTest = async () => {
    if (!defId || !testUserId) {
      message.warning('请先选择流程与测试发起人');
      return;
    }
    if (autoRunning) return;
    const d = await startTest();
    if (d?.instId) {
      message.success('已重新发起测试实例（停在首个待办，可手动提交）');
    }
  };

  /**
   * 入口确认「流程 + 发起人」后自动创建一个测试实例（用 ref 防重复）：
   * 实例创建后停在首个待办、**不自动推进**，右侧面板即以「真实实例表单」打开，可填写/提交/签字意见。
   */
  useEffect(() => {
    if (!defId || !testUserId) return;
    const key = `${defId}|${testUserId}`;
    if (entryStartRef.current === key) return;
    entryStartRef.current = key;
    startTest(true).then((d) => {
      if (!d?.instId) {
        // 失败原因已由 startTest 内的 message.error 提示（含后端 msg）；
        // 这里只解除防重标记，允许补齐后点「重新发起测试」重试。
        entryStartRef.current = '';
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defId, testUserId]);

  /**
   * 统一按测试结果切换「查看节点」：
   *  · 运行中 → 切到实例当前（待办）节点；
   *  · 已归档（后端会把 currentNodeKey 清空）→ 切到归档节点（nodeType=3），
   *    否则面板会停在最后一个办理节点，看起来「审批完没有跳转归档」；
   *  · 两者都没有 → 交给 defaultNodeKey 兜底。
   */
  const syncViewNode = (d: WfTestResult | null | undefined) => {
    if (!d) return;
    if (d.currentNodeKey) {
      setViewNodeKey(d.currentNodeKey);
      return;
    }
    const archived = (d.nodes || []).find((n: any) => n.nodeType === 3);
    setViewNodeKey(archived?.nodeKey);
  };

  /** 单步推进（自动循环 与 手动「提交」共用）；失败时抛出便于调用方提示 */
  const doStep = async (
    opinion?: string,
    formData?: Record<string, any>,
    instIdOverride?: any,
    formNodeKey?: string,
    /** 真人模式（方案 §6.4 C12 / F8）：以「本人身份」提交，走 /test/approve */
    realMode?: boolean,
  ) => {
    const instId = instIdOverride ?? validInstId;
    if (!instId) {
      message.warning('请先点「开始自动测试」发起并推进测试实例');
      return null;
    }
    // formNodeKey：本表单值来自哪个节点 → 后端按该节点布局校验必填（避免跨节点校验死锁）
    // 真人模式走 /test/approve：后端断言「本人是该测试待办的执行人」，
    // 因此没有 workflow 角色的节点操作者本人也能提交；自动循环固定走代跑 /test/step。
    const res: any = realMode
      ? await approveWorkflowTest({ instId, opinion, formData, formNodeKey })
      : await stepWorkflowTest({ instId, opinion, formData, formNodeKey });
    if (res?.success === false) {
      throw new Error(res?.msg || '推进失败');
    }
    const data: WfTestResult | null = res?.data || null;
    setResult(data);
    // 提交成功＝流程已推进：恢复「自动跟随」并切到「当前节点 / 归档节点」
    // （从开始节点提交 → 跳到首个待办节点；最后一个节点办结 → 跳到归档节点）
    followRef.current = true;
    syncViewNode(data);
    // 每次办理后强制面板重取渲染包/审批记录
    setFormKey((k) => k + 1);
    return data;
  };

  const stopAuto = () => {
    autoRef.current = false;
    setAutoRunning(false);
  };

  /** 开始自动测试：一键发起测试实例并自动逐节点提交直到归档/中断；点「暂停」随时停止 */
  const startAuto = async () => {
    if (!defId || !testUserId) {
      message.warning('请先选择流程与测试发起人');
      return;
    }
    if (autoRunning) {
      return;
    }
    // 尚未发起实例，或上一次测试已结束 → 先发起全新测试态实例，再自动逐节点推进
    let instId: any = result?.instId;
    if (!instId || (result?.instanceStatus ?? 0) !== 0) {
      const started = await startTest();
      if (!started?.instId) {
        return;
      }
      instId = started.instId;
    }
    setStartBlockMsg(null);
    resumeAutoRef.current = false;
    autoRef.current = true;
    setAutoRunning(true);
    try {
      let guard = 0;
      while (autoRef.current && guard < 200) {
        guard += 1;
        let data: WfTestResult | null = null;
        try {
          data = await doStep(undefined, undefined, instId);
        } catch (e: any) {
          const msg = e?.msg || e?.message || '自动测试中断';
          // 开始节点（或权限矩阵）必填未填 → 暂停并提示补填，用户手动提交后自动继续
          // （对齐 ecology「必填阻塞」：提示补填而不是直接报错中断）
          if (/必填/.test(msg)) {
            resumeAutoRef.current = true;
            setStartBlockMsg(msg);
            message.warning(`测试已暂停：${requiredTip(msg)}`);
          } else {
            message.error(msg);
          }
          break;
        }
        setStartBlockMsg(null);
        if (!data?.instId) break;
        if (data.instanceStatus != null && data.instanceStatus !== 0) {
          message.success(`自动测试结束：${data.summary || ''}`);
          break;
        }
        if (data.instId) {
          instId = data.instId;
        }
        if (!data.hasPending) break;
        // 稍作停顿，便于观察逐节点推进
        await new Promise((r) => setTimeout(r, 300));
      }
    } finally {
      stopAuto();
      loadHistory();
    }
  };

  /** 手动测试：右侧表单点「提交」时调用（表单值作为流程变量驱动后续网关） */
  const manualStep = async (payload: { opinion?: string; formData?: Record<string, any> }) => {
    setStepping(true);
    const prevNodeKey = result?.currentNodeKey;
    try {
      // 真人模式判定（F8）：当前登录人是否就是该测试实例当前待办的执行人 ——
      // 是则走 /test/approve（后端断言 assignee，无 workflow 角色的真人也能提交）；
      // 否则走管理面代跑 /test/step。提交前实时查一次、不做缓存，
      // 避免测试实例推进或换人后判定过期。
      let realMode = false;
      try {
        const mine: any = await getMyWorkflowTestTodo();
        realMode = (mine?.data || []).some(
          (t: any) => String(t.instId) === String(result?.instId),
        );
      } catch {
        realMode = false;
      }
      // 带上「当前查看/填写的节点」：后端按这份布局校验必填（而不是固定按待办节点校验）
      const data = await doStep(
        payload?.opinion,
        payload?.formData,
        undefined,
        effectiveNodeKey,
        realMode,
      );
      // 提交成功＝必填阻塞已解除：收起提示条
      setStartBlockMsg(null);
      if (data?.instanceStatus != null && data.instanceStatus !== 0) {
        message.success(`测试结束：${data.summary || ''}`);
        loadHistory();
      } else if (data) {
        // 同一节点仍在待提交（会签/并行未走完）→ 提示还需几人各自提交
        const stayed = data.currentNodeKey === prevNodeKey;
        const remain = data.currentNodePendingCount;
        const hint = stayed && remain && remain > 0 ? `（会签：还有 ${remain} 人待提交）` : '';
        message.success(`已提交，当前节点：${data.currentNodeName || '-'}${hint}`);
      }
      // 因必填暂停的自动测试：手动补齐并提交成功后，自动继续推进
      if (resumeAutoRef.current && data?.instanceStatus === 0) {
        resumeAutoRef.current = false;
        setStartBlockMsg(null);
        startAuto();
      }
    } catch (e: any) {
      const msg = e?.msg || e?.message || '提交失败';
      // 必填未填：阻止提交并亮出补填提示条（与自动测试暂停共用同一处提示）
      if (/必填/.test(msg)) {
        setStartBlockMsg(msg);
        message.warning(requiredTip(msg));
      } else {
        message.error(msg);
      }
    } finally {
      setStepping(false);
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
          setResult(null);
        } catch (e: any) {
          message.error(e?.msg || '清理失败');
        }
      },
    });
  };

  const shadow = async () => {
    if (!defId) {
      message.warning('请选择流程');
      return;
    }
    const base = (defs || [])
      .filter((d: any) => d.procKey === currentDef?.procKey && (d.version ?? 0) < (currentDef?.version ?? 0))
      .sort((a: any, b: any) => (b.version ?? 0) - (a.version ?? 0))[0];
    setShadowLoading(true);
    setShadowOpen(true);
    try {
      const res: any = await shadowWorkflowTest({ defId, baseDefId: base?.id, testUserId });
      if (res?.success === false) {
        message.error(res?.msg || '影子比对失败');
        setShadowData(null);
        return;
      }
      setShadowData(res?.data || null);
    } catch (e: any) {
      message.error(e?.msg || '影子比对失败');
      setShadowData(null);
    } finally {
      setShadowLoading(false);
    }
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
    const ns: any[] = viewNodes || [];
    if (ns.length === 0) return [];
    const links: any[] = viewLinks || [];
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
  }, [viewNodes, viewLinks]);

  /** 左侧节点列表：全部 / 仅已走过（经过次数>0） */
  const leftNodes = useMemo(
    () =>
      nodeFilter === 'passed'
        ? sortedNodes.filter((n: any) => (n.passTimes || 0) > 0)
        : sortedNodes,
    [sortedNodes, nodeFilter],
  );

  const nodeColumns = [
    {
      title: '节点名称',
      dataIndex: 'nodeName',
      width: 160,
      render: (v: string, r: any) => v || r.nodeKey,
      ellipsis: true,
    },
    { title: '类型', dataIndex: 'nodeType', width: 80, render: (v: number) => NODE_TYPE[v] ?? v },
    { title: '经过次数', dataIndex: 'passTimes', width: 80, align: 'center' as const },
    { title: '结果', dataIndex: 'status', width: 90, render: (v: number) => statusTag(v) },
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
      width: 140,
      render: (v: string, r: any) =>
        v || r.conditionExpr || <span style={{ color: '#bbb' }}>无条件</span>,
      ellipsis: true,
    },
    { title: '走过次数', dataIndex: 'passTimes' },
    { title: '覆盖', dataIndex: 'status', render: (v: number) => linkStatusTag(v) },
  ];

  // 面板标签：有测试实例时显示「已走/总数」；仅设计态时显示节点/出口总数
  const nodeTabLabel = result
    ? `节点 (${result.nodePassed ?? 0}/${result.nodeTotal ?? 0})`
    : `节点 (${viewNodes.length})`;
  const linkTabLabel = result
    ? `出口 (${result.linkPassed ?? 0}/${result.linkTotal ?? 0})`
    : `出口 (${viewLinks.length})`;
  const scenarioTabLabel = result ? `场景 (${result.scenarioCount ?? 1})` : '场景';

  // 左侧栏宽度只有 1/3，「测试人/时间」并到流程名下方的灰行，避免整表横向滚动
  const historyColumns = [
    {
      title: '流程',
      dataIndex: 'defName',
      render: (v: string, r: any) => (
        <div>
          <div
            title={v || '-'}
            style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {v || '-'}
          </div>
          <div style={{ fontSize: 12, color: '#999' }}>
            {r.testTime || '-'}
            {r.testUserName ? ` · ${r.testUserName}` : ''}
          </div>
        </div>
      ),
    },
    { title: '结论', dataIndex: 'testStatus', width: 68, render: (v: number) => testStatusTag(v) },
    {
      title: '节点',
      width: 48,
      render: (_: any, r: any) => `${r.nodePassed ?? 0}/${r.nodeTotal ?? 0}`,
    },
    {
      title: '操作',
      width: 82,
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

  // 入口：尚未选择流程时，展示「新建测试流程」选择面板。
  // 交互：点流程卡片 → 弹出「选择测试发起人」→ 确定后携带「流程 + 发起人」进入下方测试界面。
  if (!defId) {
    return (
      <div style={{ padding: 16 }}>
        <Typography.Title level={4} style={{ marginTop: 0 }}>
          流程测试 / 调试
        </Typography.Title>
        {testDefs.length === 0 && (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message="暂无「测试」状态的流程"
            description="在流程设计页把「流程状态」设为「测试」后，该流程会出现在此处供测试；测试态流程不会出现在正式「新建流程」页（/workflow/create）。"
          />
        )}
        <TestFlowPicker
          mode="panel"
          wfTypes={wfTypes}
          activeDefs={testDefs}
          onConfirm={pickDef}
        />
      </div>
    );
  }

  return (
    <div style={{ padding: 16 }}>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        流程测试 / 调试
        {currentDef
          ? `：${currentDef.name || currentDef.procKey}（v${currentDef.version ?? '-'}）`
          : ''}
      </Typography.Title>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="真实引擎测试"
        description="临时部署草稿 → 真实发起（实例与待办打 is_test=1 标记）→ 用引擎历史活动统计节点与出口覆盖率。入口选定「流程 + 发起人」后会自动创建一个测试实例并**停在首个待办**（不自动推进），右侧即打开**真实实例表单**，可在表单里填写、提交、加签字意见；①「重新发起测试」按当前「测试表单」的值重开一个实例（补填/改值后刷新真实表单用）；②「开始自动测试」在现有实例上逐节点自动提交直到归档（随时可「暂停」）；开始节点表单必填未填时会在首次提交被拦下并自动暂停，在右侧表单补齐后点「提交」即续跑；③「一键测试」直接自动审批到归档，开启「分支覆盖」会按网关各分支条件反推变量取值、为每个分支再真跑一次，验证到每一条出口。测试完成后点「清理测试数据」一键删除。"
      />

      <Card size="small" title="测试操作" style={{ marginBottom: 12 }}>
        {/* 流程与测试发起人已在入口「新建测试流程」选定，此处不再重复选择；
            窄屏（<1200）自动折行，避免标签被压成竖排 */}
        <Row gutter={[12, 8]} align="middle">
          <Col xs={24} md={8} xl={6}>
            <Space align="center">
              <span style={{ whiteSpace: 'nowrap' }}>分支覆盖</span>
              <Switch checked={coverBranches} onChange={setCoverBranches} />
            </Space>
          </Col>
          <Col xs={24} md={16} xl={18}>
            <Space wrap>
              <Button
                onClick={restartTest}
                loading={loading}
                disabled={!defId || !testUserId || autoRunning}
                title="按当前「测试表单」的值重新发起一个测试实例（停在首个待办，不自动推进）"
              >
                重新发起测试
              </Button>
              <Button
                onClick={startAuto}
                loading={autoRunning}
                disabled={!defId || !testUserId || autoRunning}
                title="逐节点自动提交，直到归档；随时可「暂停」"
              >
                开始自动测试
              </Button>
              <Button onClick={stopAuto} disabled={!autoRunning}>
                暂停
              </Button>
              <Button
                onClick={run}
                loading={loading}
                disabled={!defId}
                title="一次性跑完，并按网关分支反推变量覆盖每一条出口"
              >
                {coverBranches ? '分支覆盖一键测试' : '一键测试'}
              </Button>
              <Button danger onClick={cleanup}>
                清理测试数据
              </Button>
              <Button onClick={shadow} loading={shadowLoading} disabled={!defId}>
                影子比对（新旧版本）
              </Button>
            </Space>
          </Col>
        </Row>

        {currentDef && (
          <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
            <span>已选流程：</span>
            <Typography.Text strong style={{ fontSize: 12 }}>
              {currentDef.name || currentDef.procKey}
            </Typography.Text>
            <Tag style={{ marginLeft: 8 }}>{currentCategory}</Tag>
            <Tag color="blue">使用激活版本 v{currentDef.version ?? '-'}</Tag>
            {currentDef.status !== 1 && (
              <Tag color={currentDef.status === 3 ? 'blue' : 'orange'}>
                {currentDef.status === 3 ? '测试态流程' : `当前版本未发布（${DEF_STATUS[currentDef.status] ?? '-'}）`}
              </Tag>
            )}
          </div>
        )}

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
          <Row gutter={[16, 8]} style={{ marginBottom: 12 }}>
            <Col xs={12} md={8} xl={4}>
              <Statistic title="结论" valueRender={() => testStatusTag(result.testStatus)} />
            </Col>
            <Col xs={12} md={8} xl={4}>
              <Statistic
                title="节点覆盖"
                value={`${result.nodePassed ?? 0}/${result.nodeTotal ?? 0}`}
              />
            </Col>
            <Col xs={12} md={8} xl={4}>
              <Statistic
                title="出口覆盖"
                value={`${result.linkPassed ?? 0}/${result.linkTotal ?? 0}`}
              />
            </Col>
            <Col xs={12} md={8} xl={4}>
              <Statistic title="场景数" value={result.scenarioCount ?? 1} />
            </Col>
            <Col xs={12} md={8} xl={4}>
              <Statistic title="耗时(ms)" value={result.costMs ?? 0} />
            </Col>
            <Col xs={12} md={8} xl={4}>
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
              result.testStatus === 1
                ? 'success'
                : result.testStatus === 3
                ? 'info'
                : result.testStatus === 2
                ? 'warning'
                : 'error'
            }
            showIcon
            message={result.summary || '-'}
            description={
              result.instId && result.testStatus === 3
                ? `当前节点：${result.currentNodeName || '-'}${
                    result.hasPending ? '（有待办，可提交）' : '（暂无待办）'
                  }`
                : undefined
            }
          />
        </Card>
      )}

      {/* 对齐 ecology「自动测试」页：左 = 节点/出口/场景 + 测试日志 + 测试历史，右 = 节点审批情况（流程表单 / 流程图 / 流程状态） */}
      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col xs={24} lg={10} xl={9}>
          <Card size="small" title="节点与出口" style={{ marginBottom: 12 }}>
            {defId ? (
              <Tabs
                size="small"
                activeKey={leftTab}
                onChange={(v) => setLeftTab(v as 'nodes' | 'links' | 'scenarios')}
                tabBarExtraContent={
                  leftTab === 'nodes' ? (
                    <Segmented
                      size="small"
                      value={nodeFilter}
                      onChange={(v) => setNodeFilter(v as 'all' | 'passed')}
                      options={[
                        { label: '全部', value: 'all' },
                        { label: '已走过', value: 'passed' },
                      ]}
                    />
                  ) : undefined
                }
                items={[
                  {
                    key: 'nodes',
                    label: nodeTabLabel,
                    children: (
                      <Table
                        size="small"
                        rowKey="nodeKey"
                        pagination={false}
                        dataSource={leftNodes}
                        columns={nodeColumns}
                        onRow={(r: any) => ({
                          onClick: () => pickViewNode(r.nodeKey),
                          style: {
                            cursor: 'pointer',
                            background:
                              String(r.nodeKey) === String(effectiveNodeKey)
                                ? '#e6f4ff'
                                : undefined,
                          },
                        })}
                      />
                    ),
                  },
                  {
                    key: 'links',
                    label: linkTabLabel,
                    children: (
                      <Table
                        size="small"
                        rowKey={(r: any) => `${r.fromNodeKey}→${r.toNodeKey}`}
                        pagination={false}
                        dataSource={viewLinks}
                        columns={linkColumns}
                      />
                    ),
                  },
                  {
                    key: 'scenarios',
                    label: scenarioTabLabel,
                    children: (
                      <Table
                        size="small"
                        rowKey="index"
                        pagination={false}
                        dataSource={result?.scenarios || []}
                        columns={[
                          { title: '#', dataIndex: 'index', width: 40 },
                          { title: '场景', dataIndex: 'label' },
                          {
                            title: '结论',
                            dataIndex: 'testStatus',
                            width: 80,
                            render: (v: number) => testStatusTag(v),
                          },
                          {
                            title: '经过节点',
                            dataIndex: 'path',
                            width: 200,
                            render: (v: string[]) => (v || []).join(' → ') || '-',
                            ellipsis: true,
                          },
                        ]}
                      />
                    ),
                  },
                ]}
              />
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="选择流程后，这里自动加载节点与出口"
              />
            )}
          </Card>
          <WfLogTimeline
            log={result?.log}
            title="测试日志"
            maxHeight={240}
            emptyText="（无日志）"
          />
          <Card size="small" title="测试历史">
            <Table
              size="small"
              rowKey="id"
              dataSource={history}
              columns={historyColumns}
              pagination={{ pageSize: 5, size: 'small' }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={14} xl={15}>
          {/* 必填阻塞提示：自动测试暂停 / 手动提交被拦时展示；点「继续测试」带当前表单值续跑 */}
          {startBlockMsg && (
            <Alert
              type="warning"
              showIcon
              closable
              style={{ marginBottom: 12 }}
              message={
                <span>
                  提示：{blockTip}，填好后{' '}
                  <a
                    onClick={() => {
                      if (stepping || autoRunning) return;
                      manualStep({ formData: latestFormValuesRef.current });
                    }}
                  >
                    点击这里 继续测试
                  </a>
                </span>
              }
              description={<span style={{ fontSize: 12 }}>{startBlockMsg}</span>}
              onClose={() => {
                setStartBlockMsg(null);
                resumeAutoRef.current = false;
              }}
            />
          )}
          {/*
            实例态：头部（节点审批情况 / 当前操作者 / 状态 / 操作按钮）由 InstanceFlow
            这一个共享组件渲染 —— 与正式办理页同一处实现，本卡片不再重复一份。
            预览/测试态没有实例面板，才由本卡片标题承担该头部。
          */}
          <Card
            size="small"
            title={
              validInstId ? undefined : (
                <span>
                  节点审批情况：{nodeNameOf(effectiveNodeKey) || '—'}
                  <span style={{ fontSize: 12, color: '#8c8c8c', marginLeft: 8 }}>（预览）</span>
                </span>
              )
            }
            extra={null}
          >
            {/* 页头路径（流程:开始类型 - 流程名 - 开始类型，如「流程:创建 - 测试-918 - 创建」）
                不在此拼装：由 StartFlow 内嵌渲染，与正式页共用同一份 flowTitle，保证两处完全一致 */}
            {validInstId ? (
              <StartFlow
                key={`instance-${result.instId}-${formKey}`}
                mode="instance"
                embedded
                defId={String(defId)}
                instanceId={String(validInstId)}
                nodeKey={effectiveNodeKey}
                defName={currentDef?.name}
                bpmnXml={bpmnXml}
                resultNodes={sortedNodes.length ? sortedNodes : result.nodes || []}
                links={designLinks}
                currentNodeKey={result?.currentNodeKey}
                currentNodeName={result?.currentNodeName}
                onSelectNode={(k) => k && pickViewNode(k)}
                testMode
                instanceStatus={result.instanceStatus}
                hasPending={result.hasPending}
                submitting={stepping}
                onStep={manualStep}
                onValuesChange={(v) => {
                  latestFormValuesRef.current = v || {};
                }}
                onOperated={() => {
                  setFormKey((k) => k + 1);
                  loadHistory();
                }}
                refreshKey={formKey}
              />
            ) : defId && formId ? (
              /**
               * 「节点审批情况（预览）」= **正式发起页本身**（方案 §7 统一入口）。
               *
               * 这里不再自己实现一套预览渲染，而是直接内嵌 `/workflow/create/start` 的发起页组件：
               *   · 未选测试发起人 → `mode=preview`：设计态只读预览（不建实例）；
               *   · 已选测试发起人 → `mode=test`：同一套表单、**同一份节点配置与必填校验**，
               *     点「提交」即发起一条 `is_test=1` 的测试实例（不写业务表、不产生生产待办）。
               *
               * 收益：预览 / 测试 / 正式三态共用同一个组件与同一份渲染包，
               * 直接消除「测试绿灯 ≠ 正式能跑」的前端侧分叉。
               */
              <StartFlow
                key={`preview-${defId}-${effectiveNodeKey}-${testUserId || 'none'}`}
                defId={String(defId)}
                nodeKey={effectiveNodeKey}
                mode={testUserId ? 'test' : 'preview'}
                testUserId={testUserId ? String(testUserId) : undefined}
                embedded
                refreshKey={formKey}
                onSubmitted={(data: any) => {
                  // 发起测试实例后交给测试页接管：切到「测试实例」分支，
                  // 之后即可「开始自动测试」逐节点推进，或手动逐步提交
                  if (data?.instId) {
                    setResult(data);
                    followRef.current = true;
                    syncViewNode(data);
                    loadHistory();
                  }
                }}
              />
            ) : (
              <Empty description="选择流程并关联表单后，这里展示流程表单 / 流程图 / 流程状态" />
            )}
          </Card>
        </Col>
      </Row>

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

      <Modal
        title="影子比对（新旧版本路径）"
        open={shadowOpen}
        onCancel={() => setShadowOpen(false)}
        footer={null}
        width={820}
      >
        {shadowLoading ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#999' }}>比对中…</div>
        ) : shadowData ? (
          <div>
            <Alert
              type={shadowData.identical ? 'success' : 'warning'}
              showIcon
              style={{ marginBottom: 12 }}
              message={
                shadowData.identical
                  ? '新旧版本路径等价（可作为上线依据）'
                  : '新旧版本路径存在差异，请人工确认'
              }
            />
            <Descriptions size="small" bordered column={1} style={{ marginBottom: 12 }}>
              <Descriptions.Item label="新版本（target）">
                {`#${shadowData.targetDefId ?? defId}（v${shadowData.targetVersion ?? currentDef?.version ?? '-'}）`}
              </Descriptions.Item>
              <Descriptions.Item label="基准版本（base）">
                {`#${shadowData.baseDefId ?? '-'}（v${shadowData.baseVersion ?? '-'}）`}
              </Descriptions.Item>
            </Descriptions>
            {(['target', 'base'] as const).map((k) => {
              const s: any = shadowData[k];
              return (
                <Card key={k} size="small" title={k === 'target' ? '新版本路径' : '基准版本路径'} style={{ marginBottom: 12 }}>
                  <Descriptions size="small" column={2} bordered>
                    <Descriptions.Item label="结论">{testStatusTag(s?.testStatus)}</Descriptions.Item>
                    <Descriptions.Item label="走到归档">{s?.reachedEnd ? <Tag color="green">是</Tag> : <Tag color="red">否</Tag>}</Descriptions.Item>
                    <Descriptions.Item label="节点覆盖">{`${s?.nodePassed ?? 0}/${s?.nodeTotal ?? 0}`}</Descriptions.Item>
                    <Descriptions.Item label="路径">{((s?.path as string[]) || []).map((p) => nodeNameOf(p)).join(' → ') || '-'}</Descriptions.Item>
                  </Descriptions>
                  {s?.summary ? <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>{s.summary}</div> : null}
                </Card>
              );
            })}

            <Card size="small" title="差异清单" style={{ marginBottom: 12 }}>
              {(shadowData.diffs || []).length === 0 ? (
                <div style={{ color: '#999' }}>（无差异，两版本行为等价）</div>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {(shadowData.diffs || []).map((d: string, i: number) => (
                    <li key={i} style={{ marginBottom: 4 }}>{d}</li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        ) : (
          <div style={{ padding: 24, textAlign: 'center', color: '#999' }}>（无数据）</div>
        )}
      </Modal>

    </div>
  );
};

export default WorkflowTestPage;
