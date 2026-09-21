import { PageContainer } from '@ant-design/pro-components';
import { useModel } from '@umijs/max';
import {
  Alert,
  Button,
  Card,
  Dropdown,
  Empty,
  Result,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd';
import { EllipsisOutlined } from '@ant-design/icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import RichTextEditor, { focusRichText, isRichTextEmpty } from '@/components/RichTextEditor';
import { PermissionButton } from '@/components/PermissionButton';
import { usePageButtons } from '@/hooks/usePageButtons';
import ExcelPreview from '@/pages/FormMode/ExcelDesign/components/ExcelPreview';
import type { NodePermissionResolver } from '@/pages/FormMode/ExcelDesign/components/ExcelPreview';
import { collectFieldValues } from '@/pages/FormMode/ExcelDesign/utils/collectFieldValues';
import FlowDiagram from '@/pages/FormMode/Test/components/FlowDiagram';
import { MENUS_OPTIONS } from '@/pages/FormMode/WorkflowDesign/wfDict';
import {
  getBpmn,
  getDefinition,
  getInstance,
  getSnapshot,
  listNodes,
  renderFormPreview,
  saveDraft,
  startInstance,
  validateForm,
} from '@/services/workflow';
import type { WfProcessDefinition, WfProcessNode } from '@/services/workflow';
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

/** 发起页「⋯ 更多」里支持的动作（其余操作菜单项在发起环节不适用） */
const MORE_MENUS = ['print', 'opinion', 'attach'];

/**
 * L3 运行时自检（规范 §2-L3）：把后端返回的三个标志翻译成人话。
 *
 * 取值：1 正常 / 0 异常 / undefined|null = 未自检（存量实例，不提示，避免误报）。
 */
const collectSelfCheckWarnings = (inst: any): string[] => {
  const warns: string[] = [];
  if (inst?.businessRowReady === 0) {
    warns.push('业务数据行未创建成功（本次用了占位 dataId）：业务表里查不到这张单，请检查表单服务。');
  }
  if (inst?.requestIdBound === 0) {
    warns.push('业务行 request_id 未回填：流程与单据的双向反查会断，请检查表单服务。');
  }
  if (inst?.engineDeploymentMatched === 0) {
    warns.push('引擎最新部署与本流程的正式部署不一致（可能被测试部署顶替）：请在流程设计器重新发布一次。');
  }
  return warns;
};

/**
 * 发起流程页（独立页：无 ProLayout 左侧菜单；菜单驱动路由 code=workflow_create_start）。
 *
 * 布局对齐 ecology「流程处理（新建）」页 / 参考图：
 *   ┌ 流程节点：{流程名}-{节点名}   [流程表单 | 流程图 | 流程状态]         [提交] [返回] [⋯]
 *   ├ 表单：审批态渲染包 `GET /form/preview`（布局 layoutJson + 节点字段权限）→ ExcelPreview 可编辑
 *   └ 底部：签字意见（富文本，随发起写入流转意见第一条）
 */
const StartFlow: React.FC = () => {
  const { initialState } = useModel('@@initialState');
  const userId = initialState?.currentUser?.userid;
  const { buttons } = usePageButtons('workflow_create');

  // defId / dataId 均为 19 位雪花 ID，全程保持字符串（Number() 会丢精度）
  const urlDefId = new URLSearchParams(window.location.search).get('defId');
  /** 由「草稿」续填进入时带上的草稿实例ID（表单直发无） */
  const instanceId = new URLSearchParams(window.location.search).get('instanceId');
  /** 由「单据」发起时带上的业务数据ID（formtable_main_{formId}.id）；
   *  「表单直发」不带 → 后端自造唯一占位 dataId（data_id 列 NOT NULL + uk_biz_key 唯一） */
  const dataId = new URLSearchParams(window.location.search).get('dataId');
  // defId 为 state：草稿续填时由实例详情回填（URL 可能不带 defId）
  const [defId, setDefId] = useState<string | undefined>(urlDefId || undefined);
  /** 当前草稿实例ID（保存草稿后回填；提交时作为 draftInstId 原地提升） */
  const [draftInstId, setDraftInstId] = useState<string>('');
  /** 由 URL 带入的草稿实例已被删除（待办/其他列表删过）：置 true 后禁止保存/提交，避免「删了又复活」 */
  const [instanceGone, setInstanceGone] = useState<boolean>(false);
  /**
   * 本页已过期（界面状态与实例状态不一致）。
   *
   * <p>与「草稿已删除」并列的另一类不一致：草稿已在别处被<b>提交</b>（实例状态不再是草稿），
   * 而本页仍按草稿在编辑。非空即禁止保存/提交并提示用户改从「待办 / 我的请求」继续处理。</p>
   */
  const [staleReason, setStaleReason] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string>('');
  const [def, setDef] = useState<WfProcessDefinition | null>(null);
  const [nodes, setNodes] = useState<WfProcessNode[]>([]);
  const [startNodeKey, setStartNodeKey] = useState<string | undefined>();
  const [bpmnXml, setBpmnXml] = useState<string>('');
  const [pkg, setPkg] = useState<any>(null);
  const [layoutData, setLayoutData] = useState<any>(null);
  const [nodePermission, setNodePermission] = useState<NodePermissionResolver | undefined>();
  const [tab, setTab] = useState<'form' | 'diagram' | 'status'>('form');
  const [opinion, setOpinion] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [done, setDone] = useState<boolean>(false);
  /** 发起成功后的 L3 自检提示（业务行 / request_id / 引擎部署） */
  const [selfChecks, setSelfChecks] = useState<string[]>([]);
  const previewRef = useRef<any>(null);
  /** 表单当前值（ExcelPreview 的 onValuesChange 实时回填；保存/提交都用它） */
  const formValuesRef = useRef<Record<string, any>>({});
  /** 「保存」后拿到的业务数据ID：再点提交时带上，复用同一条业务行，不重复建行 */
  const [savedDataId, setSavedDataId] = useState<string>(dataId || '');
  /** 草稿续填时由快照回填的表单值（合并到初始值之上） */
  const [snapshotValues, setSnapshotValues] = useState<Record<string, any> | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  /** 草稿续填：从实例详情回填 defId / dataId / 草稿实例ID（URL 可能只带 instanceId） */
  useEffect(() => {
    if (!instanceId) return;
    (async () => {
      try {
        const inst: any = pickPayload(await getInstance(instanceId));
        if (inst && inst.id) {
          // 实例已不再是草稿态（别处提交过 / 已归档 / 已终止）→ 本页按草稿编辑的状态已过期
          if (Number(inst.status) !== 5) {
            setStaleReason(
              '该流程已发起（当前状态已不是草稿），本页的保存/提交已失效，请在「待办」或「我的请求」中继续处理',
            );
          }
          if (!defId && inst.defId) setDefId(String(inst.defId));
          if (inst.dataId) setSavedDataId(String(inst.dataId));
          setDraftInstId(String(inst.id));
        } else {
          // 草稿已被删除（待办/我的请求/其他列表删过它）：标记后禁止保存/提交
          setInstanceGone(true);
        }
      } catch {
        // 详情读取失败（含 404 / 实例已删除）→ 同样视为草稿不存在
        setInstanceGone(true);
      }
    })();
  }, [instanceId]);

  /** 草稿续填：拉取草稿表单快照回填到表单初始值 */
  useEffect(() => {
    if (!draftInstId || !startNodeKey) return;
    (async () => {
      try {
        const s: any = pickPayload(await getSnapshot(draftInstId, startNodeKey));
        if (s) {
          try {
            setSnapshotValues(JSON.parse(s));
          } catch {
            // 非 JSON（如空串）忽略
          }
        }
      } catch {
        // 快照读取失败忽略，表单以渲染默认值呈现
      }
    })();
  }, [draftInstId, startNodeKey]);

  useEffect(() => {
    if (!defId) {
      setLoadError('缺少流程参数（defId）');
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const d: WfProcessDefinition = pickPayload(await getDefinition(defId));
        if (!d?.id) {
          setLoadError('流程定义不存在或已被删除');
          return;
        }
        setDef(d);
        // 仅已发布（启用）的流程可发起
        if (d.status !== 1) {
          setLoadError('该流程未发布或已停用，无法发起');
          return;
        }

        // 流程图（「流程图」页签）
        getBpmn(d.id as any)
          .then((r: any) => setBpmnXml(pickPayload(r) || ''))
          .catch(() => setBpmnXml(''));

        // 节点清单 → 开始节点（nodeType=0；没有则取 sortOrder 最小者）
        const ns: WfProcessNode[] = pickPayload(await listNodes(d.id as any)) || [];
        setNodes(ns);
        const start =
          ns.find((n) => n.nodeType === 0) ||
          [...ns].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))[0];
        const nodeKey = start?.nodeKey;
        setStartNodeKey(nodeKey);

        // 审批态渲染包（预览：布局 + 节点字段权限 + 操作菜单；不创建实例）
        if (d.formId && nodeKey) {
          const p: any = pickPayload(await renderFormPreview(d.id as any, d.formId, nodeKey));
          if (p) {
            setPkg(p);
            try {
              setLayoutData(p.layoutJson ? JSON.parse(p.layoutJson) : null);
            } catch {
              setLayoutData(null);
            }
            // 节点字段权限解析器：scope 回退 dt{idx}_r{row} → dt{idx} → main
            const permByScopeField = new Map<string, number>();
            (p.fieldPerms || []).forEach((perm: any) => {
              permByScopeField.set(`${perm.scope || 'main'}|${perm.fieldName}`, perm.perm);
            });
            const scopeChain = (scope?: string): string[] => {
              const s = scope || 'main';
              if (/^dt\d+_r\d+$/.test(s)) return [s, s.replace(/_r\d+$/, ''), 'main'];
              if (/^dt\d+$/.test(s)) return [s, 'main'];
              return ['main'];
            };
            setNodePermission(() => (fieldName: string, scope?: string) => {
              for (const sc of scopeChain(scope)) {
                const perm = permByScopeField.get(`${sc}|${fieldName}`);
                if (perm != null) {
                  return { readonly: perm === 1, required: perm === 3, hidden: perm === 0 };
                }
              }
              return undefined;
            });
          }
        }
      } catch (e: any) {
        setLoadError(e?.msg || '流程定义加载失败');
      } finally {
        setLoading(false);
      }
    })();
  }, [defId]);

  /** 开始节点的类型名（0创建 1审批 …）：页头「流程:{类型名} - {流程名} - {类型名}」用 */
  const startTypeName = useMemo(() => {
    const n = nodes.find((x) => String(x.nodeKey) === String(startNodeKey));
    return NODE_TYPE[n?.nodeType ?? 0] || '创建';
  }, [nodes, startNodeKey]);

  const initialValues = useMemo<Record<string, any>>(() => {
    const base = pkg?.dataJson || {};
    // 草稿续填：快照值覆盖渲染默认值（与正式提交同一来源，保证回填一致）
    return snapshotValues ? { ...base, ...snapshotValues } : base;
  }, [pkg, snapshotValues]);

  /**
   * 节点操作菜单（allowMenus）口径与「办理页」ApprovalPage 完全一致：
   *   - 渲染包未回来（pkg 为空）→ 不渲染操作按钮，避免闪出不该有的按钮；
   *   - allowMenus 为 null/undefined（节点未配置操作菜单）→ **不限制**，按全量动作走；
   *   - 配置过 → 只给集合内的动作（空数组 = 全部禁用）。
   * 这样同一份节点配置在「测试流程」与「正式流程」表现一致。
   */
  const menuAllowed = useCallback(
    (code: string): boolean => {
      if (!pkg) return false;
      if (pkg.allowMenus == null) return true;
      return (pkg.allowMenus || []).map(String).includes(code);
    },
    [pkg],
  );

  /** 「⋯ 更多」：本页支持的动作（打印/填写意见/附件）∩ 节点允许的动作 */
  const moreMenus = useMemo(() => MORE_MENUS.filter((c) => menuAllowed(c)), [menuAllowed]);

  /** 提交按钮：节点配置里允许「提交」才显示（未配置 = 不限制） */
  const canSubmit = menuAllowed('submit');

  /**
   * 新建流程页的「保存」按钮：只要该流程绑定了表单就始终显示。
   * 「先保存草稿、暂不提交」是新建流程的固有能力，不应被节点操作菜单的开关隐藏
   * （节点操作菜单的「保存」语义面向办理态，与发起态草稿保存不同）。
   */
  const canSave = !!def?.formId;

  const runMore = (code: string) => {
    if (code === 'print') {
      window.print();
      return;
    }
    if (code === 'opinion') {
      focusRichText('start-flow-opinion');
      return;
    }
    message.info('该操作在发起页暂未接入');
  };

  /**
   * 动作前复检（「界面未刷新」场景的草稿页落点）。
   *
   * <p>覆盖「页面打开之后，草稿在待办/我的请求/其他标签页被删除或被提交」：
   * 此时本页显示的仍是原草稿内容 —— 继续保存会让已删除的草稿「复活」成一条新流程，
   * 继续提交则会把已发起的流程当草稿再走一次提升。</p>
   *
   * @return 空串=仍可保存/提交；非空=过期原因（调用方据此中断并提示）
   */
  const recheckDraft = async (): Promise<string> => {
    if (!instanceId) return '';
    try {
      const inst: any = pickPayload(await getInstance(instanceId));
      if (!inst || !inst.id) {
        return '该草稿已不存在（可能已在待办或其他列表删除），无法保存';
      }
      if (Number(inst.status) !== 5) {
        return '该流程已发起（不再是草稿），本页已过期，请在「待办」或「我的请求」中继续处理';
      }
      return '';
    } catch (e: any) {
      const msg = e?.msg || e?.message || '';
      if (msg.includes('不存在')) {
        return '该草稿已不存在（可能已在待办或其他列表删除），无法保存';
      }
      // 网络抖动等无法判定：不拦，由后端 saveDraft 的存在性/状态校验兜底
      return '';
    }
  };

  /** 保存/提交前的统一门禁：过期则中断，并把本页置为过期态（按钮同时停用） */
  const guardDraft = async (): Promise<boolean> => {
    if (instanceGone) {
      message.error('该草稿已不存在（可能已在待办或其他列表删除），无法保存');
      return false;
    }
    if (staleReason) {
      message.error(staleReason);
      return false;
    }
    const reason = await recheckDraft();
    if (reason) {
      setStaleReason(reason);
      message.error(reason);
      return false;
    }
    return true;
  };

  /**
   * 后端拒绝时的统一提示：识别「草稿已不存在 / 已发起」类拒绝并同步把本页置为过期态，
   * 让按钮与横幅一起进入过期状态，避免用户反复点击（后端已是不可能绕过的权威守卫）。
   */
  const notifyDraftFail = (msg: string | undefined, fallback: string) => {
    const text = msg || fallback;
    if (text.includes('草稿已不存在') || text.includes('已发起')) {
      setStaleReason(text);
    }
    message.error(text);
  };

  const doStart = async (values: Record<string, any>) => {
    // 写操作门禁：草稿可能已被删除或在别处提交（界面未刷新），过期则绝不发起
    if (!(await guardDraft())) return;
    setSubmitting(true);
    try {
      // 坐标键（{sheetId}__row__col，供 Excel 布局回显）与字段名键（供出口条件 UEL ${字段名}）
      // 一并下发：与「流程测试页 / 办理页」同一口径，保证开始节点的分支判断能拿到变量。
      const payload = { ...values, ...collectFieldValues(layoutData, values) };
      // 服务端复核（节点字段权限必填矩阵 + 明细表必须新增）：与「测试页 /test/step」同口径，
      // 避免只靠前端校验被绕过（前端布局必填校验已在 handleSubmitClick 里跑过）。
      // 校验不通过时后端抛业务异常（HTTP 400，带 msg），由下方 catch 统一提示。
      await validateForm({
        defId: def?.id,
        formId: def?.formId,
        nodeKey: startNodeKey,
        formData: payload,
      });
      const res: any = await startInstance({
        defId: def?.id,
        formId: def?.formId,
        // 有单据/已保存过则回传业务数据ID（复用同一行），否则由后端生成占位值
        // （两者都满足 data_id NOT NULL / biz_key 唯一）
        dataId: dataId || savedDataId || undefined,
        // 草稿续填提交：把草稿实例原地提升为正式运行实例（复用同一行，避免唯一键冲突）
        draftInstId: draftInstId || undefined,
        title: def?.name,
        starter: userId,
        fieldValues: payload,
        variables: payload,
        // 申请人签字意见（写 wf_approval_log 第一条 SUBMIT 记录）
        opinion,
      });
      if (res?.success === false) {
        message.error(res?.msg || '发起失败');
        return;
      }
      // 发起后回读实例，取 L3 运行时自检标志（业务行 / request_id / 引擎部署）
      // 后端返回的是字符串形式的实例ID（19 位雪花 ID），原样使用，切勿 Number()
      const instId = pickPayload(res);
      if (instId) {
        try {
          const inst: any = pickPayload(await getInstance(instId)) || {};
          setSelfChecks(collectSelfCheckWarnings(inst));
        } catch {
          // 回读失败不影响发起结果（自检只是提示），静默降级
          setSelfChecks([]);
        }
      }
      setDone(true);
    } catch (e: any) {
      notifyDraftFail(e?.msg, '发起失败');
    } finally {
      setSubmitting(false);
    }
  };

  /** 保存（只存不流转）：写业务行 → 建/更新草稿实例与发起人待办 → 记住草稿实例ID，供后续提交复用 */
  const handleSaveClick = async () => {
    if (!def?.formId && !def?.id) {
      message.warning('该流程未绑定表单，无法保存');
      return;
    }
    // 过期/已删除门禁：动作前复检草稿是否仍存在且仍是草稿态
    // （避免「删了又复活」新建一条，或在已发起的实例上继续按草稿保存）
    if (!(await guardDraft())) return;
    setSaving(true);
    try {
      const values = formValuesRef.current || {};
      // 与提交同口径：坐标键（供布局回显）+ 字段名键（供出口条件）一并下发
      const payload = { ...values, ...collectFieldValues(layoutData, values) };
      const res: any = await saveDraft({
        defId: def?.id,
        formId: def?.formId,
        // 已保存过（草稿实例存在）则更新同一行/实例，否则新建。
        // ⚠️ 优先用 URL 的 instanceId：即便内存里 draftInstId 因加载失败被清空，
        //    也能把原始 instanceId 交给后端做存在性校验，删除后点保存会被后端拒绝。
        dataId: savedDataId || undefined,
        instanceId: instanceId || draftInstId || undefined,
        fieldValues: payload,
      });
      // 统一用 pickPayload 取响应载荷：request() 返回可能是「载荷本身 / {data:载荷} /
      // {data:{data:载荷}}」三种形态之一，直接取 res.data 在「载荷本身」形态下会拿到 undefined，
      // 导致 draftInstId 永远设不上、每次保存都新建实例（多点几次生成多条草稿）。
      const savedInstId = pickPayload(res);
      if (res?.success === false) {
        notifyDraftFail(res?.msg, '保存失败');
        return;
      }
      if (savedInstId) {
        setDraftInstId(String(savedInstId));
        // 取回该草稿实例的 dataId（保存草稿时已确保业务行存在），供后续提交复用
        let nextDataId = savedDataId;
        try {
          const inst: any = pickPayload(await getInstance(savedInstId));
          if (inst?.dataId) {
            setSavedDataId(String(inst.dataId));
            nextDataId = String(inst.dataId);
          }
        } catch {
          // 取 dataId 失败不阻断（savedDataId 已足够）
        }
        // 把草稿实例ID / 业务数据ID 回写到当前页 URL（对齐泛微 requestid 回写机制）：
        // 刷新或重开本页时，URL 带 instanceId → 顶部 effect 自动按「草稿续填」回填，复用同一条草稿，
        // 不会因内存里的 draftInstId 丢失而又新建一条草稿（避免重复流程）。
        const url = new URL(window.location.href);
        url.searchParams.set('instanceId', String(savedInstId));
        if (nextDataId) url.searchParams.set('dataId', nextDataId);
        window.history.replaceState({}, '', url.toString());
      }
      message.success('已保存草稿（未提交，可继续编辑后再提交）');
    } catch (e: any) {
      notifyDraftFail(e?.msg, '保存失败');
    } finally {
      setSaving(false);
    }
  };

  /** 提交：先校验（节点意见必填）→ 触发 ExcelPreview 布局级必填校验 → 校验通过回调 onSubmit 里真发起 */
  const handleSubmitClick = async () => {
    // 提交前先过门禁：草稿被删或已在别处提交时，本页已过期，不再进入校验/发起链路
    if (!(await guardDraft())) return;
    if (pkg?.opinionRequired && isRichTextEmpty(opinion)) {
      message.warning('当前节点要求填写签字意见，无法提交');
      return;
    }
    if (layoutData) {
      previewRef.current?.submit?.();
      return;
    }
    // 无布局（未设计表单）时直接发起
    doStart({});
  };

  /** 关闭当前标签页（非新标签打开时回退为返回上一页） */
  const closeTab = () => {
    if (window.opener) {
      window.close();
    } else if (window.history.length > 1) {
      window.history.back();
    }
  };

  /**
   * 提交成功后自动关闭本页（对齐办理页「已提交，即将关闭」的体感）。
   *
   * <p>两个前提，缺一不关：</p>
   * <ol>
   *   <li><b>本页是脚本打开的新标签</b>（{@code window.opener} 存在）——
   *       从待办 / 我的请求 / 菜单点进来的标签页由 {@code window.open} 打开，可直接 close；
   *       直接输入网址或在当前标签内路由过来的页面，浏览器不允许脚本关闭，
   *       此时保留成功页交给用户手动关闭（强行走 history.back 会跳到 about:blank 之类的意外页）。</li>
   *   <li><b>没有 L3 自检提示</b>——自检存在的意义就是让人看到（业务行 / request_id / 引擎部署
   *       是否就绪），自动关闭会把提示一起藏掉；有提示时页面保持打开。</li>
   * </ol>
   */
  useEffect(() => {
    if (!done || selfChecks.length > 0 || !window.opener) return;
    message.success('流程已发起，本页即将自动关闭');
    const timer = window.setTimeout(() => closeTab(), 1200);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, selfChecks]);

  const submitButton = (
    <PermissionButton hasPermission={buttons.some((b: any) => b.code === 'workflow_create_submit')}>
      <Button type="primary" size="small" loading={submitting} disabled={instanceGone || !!staleReason} onClick={handleSubmitClick}>
        提交
      </Button>
    </PermissionButton>
  );

  /**
   * 保存（不提交）：节点「操作菜单」勾了「保存」才显示。
   * 只把表单值写到业务表并记住 dataId，之后提交时复用同一行；不做必填校验（允许先存草稿）。
   */
  const saveButton = (
    <Button size="small" loading={saving} disabled={instanceGone || !!staleReason} onClick={handleSaveClick}>
      保存
    </Button>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      <PageContainer
        header={{
          // 页头：流程:{开始节点类型} - {流程名} - {开始节点类型}（如「流程:创建 - 测试-918 - 创建」）
          title: def ? `流程:${startTypeName} - ${def.name} - ${startTypeName}${draftInstId ? '（草稿）' : ''}` : '发起流程',
        }}
      >
        <Card styles={{ body: { padding: 16 } }}>
          {loading ? (
            <div style={{ padding: 48, textAlign: 'center' }}>
              <Spin />
            </div>
          ) : loadError ? (
            <Result
              status="warning"
              title="无法发起该流程"
              subTitle={loadError}
              extra={
                <Button type="primary" onClick={closeTab}>
                  关闭
                </Button>
              }
            />
          ) : done ? (
            <Result
              status={selfChecks.length ? 'warning' : 'success'}
              title="流程发起成功"
              subTitle={`「${def?.name || ''}」已发起，可在「我的请求」中查看进度。`}
              extra={
                <Button type="primary" onClick={closeTab}>
                  关闭
                </Button>
              }
            >
              {selfChecks.length > 0 && (
                <Alert
                  type="warning"
                  showIcon
                  style={{ textAlign: 'left', maxWidth: 560, margin: '0 auto' }}
                  message="发起自检发现以下问题（流程已发起，但建议处理）"
                  description={
                    <ul style={{ paddingLeft: 18, marginBottom: 0 }}>
                      {selfChecks.map((w) => (
                        <li key={w}>{w}</li>
                      ))}
                    </ul>
                  }
                />
              )}
            </Result>
          ) : (
            <>
              {/* ⓪ 状态不一致横幅：草稿已删除 / 已被提交（界面未刷新）时置顶告警并停用保存提交 */}
              {(instanceGone || staleReason) && (
                <Alert
                  type="warning"
                  showIcon
                  style={{ marginBottom: 12 }}
                  message={instanceGone ? '该草稿已不存在' : '本页已过期：流程状态已变更'}
                  description={
                    instanceGone
                      ? '此草稿可能已在待办、我的请求或其他列表中删除，无法继续保存或提交。如需新建，请关闭本页后重新进入发起页。'
                      : `${staleReason}。为避免把过期数据写回，本页的保存/提交已停用，请关闭本页后在「待办」或「我的请求」中打开最新状态。`
                  }
                  action={
                    <Button size="small" onClick={() => window.location.reload()}>
                      刷新页面
                    </Button>
                  }
                />
              )}
              {/* ① 顶部：左 = 三页签（流程表单 / 流程图 / 流程状态）；右 = 提交 / 返回 / ⋯ */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 8,
                  flexWrap: 'wrap',
                  marginBottom: 4,
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
                <Space size={6} style={{ marginTop: 4 }}>
                  {/* 提交：节点操作菜单允许（或未配置）时显示 */}
                  {canSubmit && submitButton}
                  {/* 保存：只存业务数据、不发起；新建流程页只要绑定了表单就显示 */}
                  {canSave && saveButton}
                  <Button size="small" onClick={closeTab}>
                    返回
                  </Button>
                  {moreMenus.length > 0 && (
                    <Dropdown
                      menu={{
                        items: moreMenus.map((c) => ({
                          key: c,
                          label: MENUS_OPTIONS.find((o) => String(o.value) === c)?.label || c,
                        })),
                        onClick: ({ key }) => runMore(key),
                      }}
                    >
                      <Button size="small" icon={<EllipsisOutlined />} />
                    </Dropdown>
                  )}
                </Space>
              </div>

              {/* ② 表单 / 流程图 / 流程状态 */}
              <div style={{ border: '1px solid #f0f0f0', borderRadius: 6, padding: '8px 8px 12px' }}>
                {tab === 'form' && (
                  <>
                    <div>
                      {layoutData ? (
                        <ExcelPreview
                          ref={previewRef}
                          layoutData={layoutData}
                          open
                          standalone
                          hideHeader
                          readOnly={false}
                          nodeId={startNodeKey}
                          nodePermission={nodePermission}
                          initialValues={initialValues}
                          title="流程表单"
                          onClose={closeTab}
                          onValuesChange={(v: Record<string, any>) => {
                            formValuesRef.current = v || {};
                          }}
                          onSubmit={(
                            _values: Record<string, any>,
                            _errors: Record<string, boolean>,
                            valid: boolean,
                          ) => {
                            if (!valid) return;
                            doStart(_values);
                          }}
                        />
                      ) : (
                        <Empty description="该节点暂无表单布局（可在流程设计器中设计表单内容）" />
                      )}
                    </div>

                    {/* 签字意见：固定在表单最下方（对齐参考图/流程处理页），随发起写入流转意见 */}
                    <div id="start-flow-opinion" style={{ margin: '14px 0 4px' }}>
                      <div style={{ fontSize: 13, marginBottom: 4 }}>签字意见</div>
                      <RichTextEditor
                        compact
                        height={140}
                        value={opinion}
                        onChange={setOpinion}
                        placeholder={pkg?.opinionRequired ? '请填写签字意见（必填）' : '签字意见（可选）'}
                      />
                    </div>
                  </>
                )}

                {tab === 'diagram' && (
                  <div style={{ padding: '4px 0' }}>
                    {bpmnXml ? (
                      <FlowDiagram bpmnXml={bpmnXml} currentNodeKey={startNodeKey} height={460} />
                    ) : (
                      <Empty description="暂无流程图（该流程未保存 BPMN）" />
                    )}
                  </div>
                )}

                {tab === 'status' && (
                  <div style={{ padding: '4px 0' }}>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      流程尚未发起：以下为流程节点清单，发起后可在此查看各节点经过情况与审批记录。
                    </Typography.Text>
                    <Table
                      size="small"
                      style={{ marginTop: 8 }}
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
                        { title: '节点Key', dataIndex: 'nodeKey', width: 220 },
                      ]}
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </Card>
      </PageContainer>
    </div>
  );
};

export default StartFlow;
