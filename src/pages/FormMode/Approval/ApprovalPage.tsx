import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Radio,
  Space,
  Spin,
  Tag,
  Upload,
  message,
} from 'antd';
import {
  renderForm,
  approveTask,
  rejectTask,
  forwardTask,
  addSignTask,
  markTaskViewed,
  urgeTask,
} from '@/services/workflow';
import { MENUS_OPTIONS } from '@/pages/FormMode/WorkflowDesign/wfDict';
import { dataApi } from '@/services/formmode';
import type { FieldDefinition } from '@/services/formmode';
import FieldRenderer from '@/pages/FormMode/FormView/components/FieldRenderer';
import { PersonOrgField } from '@/components/FormMode/PersonOrgPicker';
import RichTextEditor, { focusRichText, isRichTextEmpty } from '@/components/RichTextEditor';

/**
 * 流程审批界面（运行期，对齐 ecology 单据审批页）。
 *
 * <p>功能：</p>
 * <ul>
 *   <li>渲染真实表单：从审批态渲染包（{@code renderForm}）取布局/数据快照/字段权限，
 *       复用与「测试流程」一致的 {@link FieldRenderer} 画标准 FormMode 表单。</li>
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

  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [pkg, setPkg] = useState<any>(null);
  const [dataJson, setDataJson] = useState<Record<string, any>>({});
  const [readonly, setReadonly] = useState(false);
  const [allowMenus, setAllowMenus] = useState<string[]>([]);
  const [opinionRequired, setOpinionRequired] = useState(false);
  const [opinion, setOpinion] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // 弹窗状态：reject / forward / sign / attach
  const [modalType, setModalType] = useState<string | null>(null);
  const [modalAssignee, setModalAssignee] = useState<any>(undefined);
  const [modalAddSignType, setModalAddSignType] = useState<number>(0);
  const [fileList, setFileList] = useState<any[]>([]);

  const dataJsonRef = useRef<Record<string, any>>({});

  // 字段权限查询：perm 0=隐藏 1=只读 2=可编辑 3=必填
  const permMap = useMemo(() => {
    const m = new Map<string, number>();
    (pkg?.fieldPerms || []).forEach((p: any) => m.set(p.fieldName, p.perm));
    return m;
  }, [pkg]);

  const normalizeField = (f: FieldDefinition): any => ({
    ...f,
    options: (f.options || []).map((o: any) => ({ value: o.optionValue, label: o.optionLabel })),
  });

  useEffect(() => {
    if (!instanceId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const tid = taskId ? Number(taskId) : undefined;
    // 19 位雪花 ID 保持字符串：Number() 会丢精度导致查不到实例
    renderForm(instanceId, tid)
      .then(async (res: any) => {
        const p = res?.data;
        if (!p) {
          message.error('获取审批渲染包失败');
          return;
        }
        setPkg(p);
        setReadonly(!!p.readonly);
        setAllowMenus(p.allowMenus || []);
        setOpinionRequired(!!p.opinionRequired);
        const dj = p.dataJson || {};
        setDataJson(dj);
        dataJsonRef.current = dj;
        // 拉字段定义，复用与测试流程一致的 FieldRenderer
        if (p.formId) {
          try {
            const fs = await dataApi.getFieldDefinitions(String(p.formId));
            setFields(fs || []);
          } catch {
            setFields([]);
          }
        }
        // 注入初始值（快照数据）
        form.setFieldsValue(dj);
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

  // 当前用户不是处理人（只读）时，仅可查看，隐藏操作区
  const canOperate = !readonly;

  /** 收集表单值（合并快照，确保所有字段都作为变量下发，避免网关变量缺失） */
  const collectVariables = async (): Promise<Record<string, any>> => {
    let values: Record<string, any> = {};
    try {
      values = await form.validateFields();
    } catch {
      // 校验失败（必填未填）由 antd 标红，这里返回空，上层据此拦截
      return {};
    }
    return { ...dataJsonRef.current, ...values };
  };

  /** 提交 / 同意：字段值作为流程变量驱动网关 */
  const handleSubmit = async () => {
    if (!taskId) return;
    const variables = await collectVariables();
    if (Object.keys(variables).length === 0) return; // 校验未通过
    if (opinionRequired && isRichTextEmpty(opinion)) {
      message.warning('当前节点要求填写审批意见');
      return;
    }
    setSubmitting(true);
    try {
      const res: any = await approveTask(Number(taskId), { opinion, variables });
      if (res?.success === false) {
        message.error(res?.msg || '提交失败');
        return;
      }
      message.success('已提交');
      setDone(true);
    } catch (e: any) {
      message.error(e?.msg || '提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  const closeModal = () => {
    setModalType(null);
    setModalAssignee(undefined);
    setModalAddSignType(0);
    setFileList([]);
  };

  /** 通用弹窗确认（退回/转办/加签） */
  const handleModalOk = async () => {
    if (!taskId) return;
    setSubmitting(true);
    try {
      if (modalType === 'reject') {
        if (opinionRequired && isRichTextEmpty(opinion)) {
          message.warning('当前节点要求填写审批意见');
          return;
        }
        const res: any = await rejectTask(Number(taskId), { opinion });
        if (res?.success === false) return message.error(res?.msg || '退回失败');
        message.success('已退回');
      } else if (modalType === 'forward') {
        if (!modalAssignee) return message.warning('请选择转办人');
        const res: any = await forwardTask(Number(taskId), {
          opinion,
          assignee: Number(modalAssignee),
        });
        if (res?.success === false) return message.error(res?.msg || '转办失败');
        message.success('已转办');
      } else if (modalType === 'sign') {
        if (!modalAssignee) return message.warning('请选择加签人');
        const res: any = await addSignTask(Number(taskId), {
          opinion,
          assignee: Number(modalAssignee),
          addSignType: modalAddSignType,
        });
        if (res?.success === false) return message.error(res?.msg || '加签失败');
        message.success('已加签');
      } else if (modalType === 'attach') {
        // 附件暂仅本地选择，后端持久化接口待接入
        message.info('附件已选择（持久化接口待接入）');
      }
      closeModal();
      setDone(true);
    } catch (e: any) {
      message.error(e?.msg || '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUrge = async () => {
    if (!taskId) return;
    setSubmitting(true);
    try {
      const res: any = await urgeTask(Number(taskId), { opinion });
      if (res?.success === false) return message.error(res?.msg || '催办失败');
      message.success('已催办');
    } catch (e: any) {
      message.error(e?.msg || '催办失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrint = () => window.print();

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
              <Button key="submit" type="primary" loading={submitting} onClick={handleSubmit}>
                提交
              </Button>
            );
          case 'reject':
            return (
              <Button key="reject" danger onClick={() => setModalType('reject')}>
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

  return (
    <div style={{ padding: 24, maxWidth: 960, margin: '0 auto' }}>
      <Card
        size="small"
        title={`审批表单${pkg?.nodeName ? `（${pkg.nodeName}）` : ''}`}
        style={{ marginBottom: 16 }}
        extra={
          readonly ? <Tag color="orange">只读（非当前处理人）</Tag> : <Tag color="green">可审批</Tag>
        }
      >
        {fields.length === 0 ? (
          <div style={{ color: '#999', fontSize: 12 }}>该表单暂无字段</div>
        ) : (
          <Form form={form} layout="vertical">
            {fields.map((f) => {
              const perm = permMap.get(f.fieldName);
              if (perm === 0) return null; // 隐藏
              const disabled = readonly || perm === 1;
              const required = perm === 3;
              return (
                <Form.Item
                  key={f.id}
                  name={f.fieldName}
                  label={f.fieldLabel}
                  rules={required ? [{ required: true, message: `请输入${f.fieldLabel}` }] : []}
                >
                  <FieldRenderer field={normalizeField(f)} disabled={disabled} />
                </Form.Item>
              );
            })}
          </Form>
        )}
      </Card>

      {canOperate && (
        <Card size="small" title="审批操作" style={{ marginBottom: 16 }}>
          <Form.Item label="审批意见" required={opinionRequired}>
            {/* 审批意见统一用富文本（与系统其余审批入口一致） */}
            <div id="approval-opinion">
              <RichTextEditor
                compact
                height={160}
                value={opinion}
                onChange={setOpinion}
                placeholder={opinionRequired ? '请填写审批意见（必填）' : '请填写审批意见'}
              />
            </div>
          </Form.Item>
          <Space wrap>{actionButtons}</Space>
        </Card>
      )}

      {!canOperate && (
        <Alert
          type="info"
          showIcon
          message="您不是当前节点的处理人，表单仅可查看，不可进行审批操作。"
        />
      )}

      <Modal
        title={modalType ? menuLabel(modalType) : ''}
        open={!!modalType}
        onOk={handleModalOk}
        confirmLoading={submitting}
        onCancel={closeModal}
        destroyOnClose
      >
        {modalType === 'reject' && (
          <p>确认退回？退回后将终止当前流程（内核阶段）。如需退回指定节点，请在流程建模时配置退回线。</p>
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
