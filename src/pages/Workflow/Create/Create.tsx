import { PageContainer, ProCard } from '@ant-design/pro-components';
import { useModel } from '@umijs/max';
import { Button, Card, Drawer, Empty, Form, Input, Spin, Tag, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { usePageButtons } from '@/hooks/usePageButtons';
import { PermissionButton } from '@/components/PermissionButton';
import FieldRenderer from '@/pages/FormMode/FormView/components/FieldRenderer';
import { dataApi } from '@/services/formmode';
import type { FieldDefinition } from '@/services/formmode';
import { listDefinitions, startInstance } from '@/services/workflow';
import type { WfProcessDefinition } from '@/services/workflow';
import { pickPayload } from '@/utils/utils';

const { Search } = Input;

/**
 * 新建流程：按「路径类型」分组展示可发起流程，点击卡片打开发起表单并真实发起实例。
 */
const CreateWorkflow: React.FC = () => {
  const { initialState } = useModel('@@initialState');
  const userId = initialState?.currentUser?.userid;
  const { buttons } = usePageButtons('workflow_create');
  const [defs, setDefs] = useState<WfProcessDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [open, setOpen] = useState(false);
  const [def, setDef] = useState<WfProcessDefinition | null>(null);
  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [formLoading, setFormLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const res: any = await listDefinitions();
      setDefs(pickPayload(res) || []);
    } catch {
      setDefs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, WfProcessDefinition[]>();
    defs
      .filter((d) => !keyword || (d.name || '').includes(keyword))
      .forEach((d) => {
        const key = d.type || '未分类';
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(d);
      });
    return Array.from(map.entries());
  }, [defs, keyword]);

  const normalizeField = (f: FieldDefinition): any => ({
    ...f,
    options: (f.options || []).map((o: any) => ({ value: o.optionValue, label: o.optionLabel })),
  });

  const openDef = async (d: WfProcessDefinition) => {
    setDef(d);
    setOpen(true);
    setFormLoading(true);
    try {
      if (d.formId) {
        const fs = await dataApi.getFieldDefinitions(String(d.formId));
        setFields(fs || []);
      } else {
        setFields([]);
      }
    } catch {
      setFields([]);
    } finally {
      setFormLoading(false);
    }
  };

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
      message.success('流程发起成功');
      setOpen(false);
      form.resetFields();
    } catch (e: any) {
      message.error(e?.msg || '发起失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageContainer header={{ title: '新建流程', subTitle: '选择流程并发起' }}>
      <div style={{ marginBottom: 16, maxWidth: 420 }}>
        <Search placeholder="搜索流程名称" allowClear onSearch={setKeyword} onChange={(e) => setKeyword(e.target.value)} />
      </div>

      {loading ? (
        <div style={{ padding: 48, textAlign: 'center' }}>
          <Spin />
        </div>
      ) : defs.length === 0 ? (
        <Card>
          <Empty description="暂无可发起的流程" />
        </Card>
      ) : (
        grouped.map(([type, items]) => (
          <ProCard key={type} title={type} style={{ marginBottom: 16 }} headerBordered>
            <ProCard ghost gutter={16} wrap>
              {items.map((d) => (
                <ProCard key={d.id} colSpan={{ xs: 24, sm: 12, md: 8, lg: 6 }} bordered hoverable style={{ marginBottom: 16 }} onClick={() => openDef(d)}>
                  <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8 }}>{d.name}</div>
                  <div style={{ color: '#8c8c8c', fontSize: 13, minHeight: 40 }}>{d.description || '暂无描述'}</div>
                  <div style={{ marginTop: 8 }}>
                    <Tag color="blue">V{d.version || 1}</Tag>
                    {d.status === 1 && <Tag color="green">已发布</Tag>}
                    {d.status === 2 && <Tag color="default">停用</Tag>}
                  </div>
                </ProCard>
              ))}
            </ProCard>
          </ProCard>
        ))
      )}

      <Drawer
        title={def ? `发起流程：${def.name}` : '发起流程'}
        width={640}
        open={open}
        onClose={() => setOpen(false)}
        extra={
          <PermissionButton hasPermission={buttons.some((b: any) => b.code === 'workflow_create_submit')}>
            <Button type="primary" loading={submitting} onClick={handleStart}>
              提交
            </Button>
          </PermissionButton>
        }
      >
        {formLoading ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <Spin />
          </div>
        ) : fields.length === 0 ? (
          <Empty description="该流程暂无表单字段，可直接提交发起" />
        ) : (
          <Form form={form} layout="vertical">
            {fields.map((f) => (
              <Form.Item key={f.id} name={f.fieldName} label={f.fieldLabel}>
                <FieldRenderer field={normalizeField(f)} />
              </Form.Item>
            ))}
          </Form>
        )}
      </Drawer>
    </PageContainer>
  );
};

export default CreateWorkflow;
