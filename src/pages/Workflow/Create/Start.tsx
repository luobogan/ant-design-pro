import { PageContainer } from '@ant-design/pro-components';
import { useModel } from '@umijs/max';
import {
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
  listNodes,
  renderFormPreview,
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

  // defId 为 19 位雪花 ID，全程保持字符串（Number() 会丢精度）
  const defId = new URLSearchParams(window.location.search).get('defId');

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
  const previewRef = useRef<any>(null);

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

  const initialValues = useMemo<Record<string, any>>(() => pkg?.dataJson || {}, [pkg]);

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

  const doStart = async (values: Record<string, any>) => {
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
      setDone(true);
    } catch (e: any) {
      message.error(e?.msg || '发起失败');
    } finally {
      setSubmitting(false);
    }
  };

  /** 提交：先校验（节点意见必填）→ 触发 ExcelPreview 布局级必填校验 → 校验通过回调 onSubmit 里真发起 */
  const handleSubmitClick = () => {
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

  const submitButton = (
    <PermissionButton hasPermission={buttons.some((b: any) => b.code === 'workflow_create_submit')}>
      <Button type="primary" size="small" loading={submitting} onClick={handleSubmitClick}>
        提交
      </Button>
    </PermissionButton>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      <PageContainer
        header={{
          // 页头：流程:{开始节点类型} - {流程名} - {开始节点类型}（如「流程:创建 - 测试-918 - 创建」）
          title: def ? `流程:${startTypeName} - ${def.name} - ${startTypeName}` : '发起流程',
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
              status="success"
              title="流程发起成功"
              subTitle={`「${def?.name || ''}」已发起，可在「我的请求」中查看进度。`}
              extra={
                <Button type="primary" onClick={closeTab}>
                  关闭
                </Button>
              }
            />
          ) : (
            <>
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
