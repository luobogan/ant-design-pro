import { PageContainer } from '@ant-design/pro-components';
import { useModel } from '@umijs/max';
import { Button, Card, Empty, Form, Result, Space, Spin, Tag, message } from 'antd';
import { useEffect, useState } from 'react';
import { usePageButtons } from '@/hooks/usePageButtons';
import { PermissionButton } from '@/components/PermissionButton';
import FieldRenderer from '@/pages/FormMode/FormView/components/FieldRenderer';
import { dataApi } from '@/services/formmode';
import type { FieldDefinition } from '@/services/formmode';
import { getDefinition, startInstance } from '@/services/workflow';
import type { WfProcessDefinition } from '@/services/workflow';
import { pickPayload } from '@/utils/utils';

/**
 * 发起流程页（「独立页」：无 ProLayout/左侧菜单）。
 *
 * 组件路由由菜单表驱动（blade_menu code=workflow_create_start）：
 *   category=2（按钮）+ is_component=1（生成组件）+ is_open=2（独立页）+ path=/workflow/create/start
 *   → app.tsx#loopMenuItem 命中后按规则加载 ./pages/Workflow/Create/Start.tsx（文件名必须与此一致），
 *     由 patchClientRoutes 挂到顶层（带 layout:false），故本页不带左侧菜单外壳。
 *
 * 由「新建流程」列表点流程卡片以新标签页打开（URL 携带 defId），
 * 加载流程定义与表单字段，填写后真实发起流程实例（startInstance）。
 */
const StartFlow: React.FC = () => {
  const { initialState } = useModel('@@initialState');
  const userId = initialState?.currentUser?.userid;
  const { buttons } = usePageButtons('workflow_create');

  // defId 为 19 位雪花 ID，全程保持字符串（Number() 会丢精度）
  const defId = new URLSearchParams(window.location.search).get('defId');

  const [def, setDef] = useState<WfProcessDefinition | null>(null);
  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [done, setDone] = useState<boolean>(false);
  const [form] = Form.useForm();

  useEffect(() => {
    if (!defId) {
      setLoadError('缺少流程参数（defId）');
      setLoading(false);
      return;
    }
    setLoading(true);
    getDefinition(defId)
      .then(async (res: any) => {
        const d: WfProcessDefinition = pickPayload(res);
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
        if (d.formId) {
          try {
            const fs = await dataApi.getFieldDefinitions(String(d.formId));
            setFields(fs || []);
          } catch {
            setFields([]);
          }
        }
      })
      .catch((e: any) => setLoadError(e?.msg || '流程定义加载失败'))
      .finally(() => setLoading(false));
  }, [defId]);

  const normalizeField = (f: FieldDefinition): any => ({
    ...f,
    options: (f.options || []).map((o: any) => ({ value: o.optionValue, label: o.optionLabel })),
  });

  const handleStart = async () => {
    if (!def) return;
    let values: Record<string, any> = {};
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    setSubmitting(true);
    try {
      const res: any = await startInstance({
        defId: def.id,
        formId: def.formId,
        title: def.name,
        starter: userId,
        fieldValues: values,
        variables: values,
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
      <Button type="primary" loading={submitting} onClick={handleStart}>
        提交
      </Button>
    </PermissionButton>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <PageContainer header={{ title: '发起流程', subTitle: def?.name || '填写表单并发起' }}>
        <Card style={{ maxWidth: 960 }}>
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
          ) : fields.length === 0 ? (
            <>
              <Empty description="该流程暂无表单字段，可直接提交发起" />
              <div style={{ textAlign: 'center', marginTop: 16 }}>{submitButton}</div>
            </>
          ) : (
            <Form form={form} layout="vertical">
              <div style={{ marginBottom: 12 }}>
                <Tag color="blue">V{def?.version || 1}</Tag>
                <Tag color="green">已发布</Tag>
              </div>
              {fields.map((f) => (
                <Form.Item key={f.id} name={f.fieldName} label={f.fieldLabel}>
                  <FieldRenderer field={normalizeField(f)} />
                </Form.Item>
              ))}
              <div style={{ marginTop: 24 }}>
                <Space>
                  {submitButton}
                  <Button onClick={closeTab}>关闭</Button>
                </Space>
              </div>
            </Form>
          )}
        </Card>
      </PageContainer>
    </div>
  );
};

export default StartFlow;
