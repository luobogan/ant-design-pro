import React, { useEffect, useState } from 'react';
import { Button, Dropdown, Form, message, Modal, Space, Spin } from 'antd';
import { pickPayload } from '@/utils/utils';
import { workflowBillApi } from '@/services/formmode';
import {
  createDefinition,
  getDefinitionFormCondition,
  updateDefinition,
  workflowBrowserApi,
  WfProcessDefinition,
  FormCondition,
  FormField,
} from '@/services/workflow';
import SchemaForm, {
  buildInitialValues,
  buildPayload,
  DataSourceResolver,
} from '@/components/SchemaForm';
import WorkflowTypeAddModal from './WorkflowTypeAddModal';
import WorkflowFormAddModal from './WorkflowFormAddModal';
import TableDesign from '@/pages/FormMode/TableDesign/TableDesign';

/**
 * 流程（路径）基础设置表单 —— 由后端 form-condition 驱动，通用渲染。
 *
 * 同时被两处复用：
 *  - 新增/编辑弹窗（WorkflowDefFormModal）内嵌；
 *  - 设计页「基础设置」页签内联展示（替代弹窗，贴近 ecology/E9 的 tab 内编辑体验）。
 *
 * 自带「保存 / 保存并进入详细设置 / 更多(另存为新版本)」按钮与提交逻辑，
 * 因此调用方无需关心 footer，直接渲染本组件即可。
 */
export interface WorkflowDefFormProps {
  mode?: 'add' | 'edit';
  initialValues?: Partial<WfProcessDefinition>;
  /** 保存成功（未进入详细设置） */
  onSaved?: (id?: string) => void;
  /** 「保存并进入详细设置」成功 */
  onEnterDesign?: (id?: string) => void;
  /** 「更多 -> 另存为新版本」（仅编辑态可用，未传则禁用） */
  onSaveAsNewVersion?: (id: string) => void;
  /** 是否显示底部操作按钮（页签内联场景可保留，弹窗场景也可保留，统一由本组件渲染） */
  showFooter?: boolean;
}

const genProcKey = () =>
  `flow_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const WorkflowDefForm: React.FC<WorkflowDefFormProps> = ({
  mode = 'add',
  initialValues,
  onSaved,
  onEnterDesign,
  onSaveAsNewVersion,
  showFooter = true,
}) => {
  const [form] = Form.useForm();
  const [fields, setFields] = useState<FormField[]>([]);
  const [title, setTitle] = useState('添加路径');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const isEdit = mode === 'edit';

  // 浏览框「+」新增路径类型
  const [addTypeOpen, setAddTypeOpen] = useState(false);
  const [addTypeField, setAddTypeField] = useState<FormField | null>(null);
  const [browserRefreshKey, setBrowserRefreshKey] = useState(0);

  // 对应表单列表刷新键
  const [formListKey, setFormListKey] = useState(0);
  const [formAddOpen, setFormAddOpen] = useState(false);
  // 「配置字段」弹窗：弹窗内嵌表设计器
  const [designOpen, setDesignOpen] = useState(false);
  const [designFormId, setDesignFormId] = useState<string>('');

  // 加载字段描述并初始化表单
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    getDefinitionFormCondition(isEdit ? 'edit' : 'add', initialValues?.id)
      .then((r: any) => {
        if (!mounted) return;
        const cond: FormCondition = pickPayload(r) || { fields: [] };
        const flds: FormField[] = cond.fields || [];
        setFields(flds);
        setTitle(cond.title || (isEdit ? '编辑路径' : '添加路径'));
        form.resetFields();
        form.setFieldsValue(buildInitialValues(flds, initialValues || {}));
      })
      .catch(() => mounted && message.error('加载表单配置失败'))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, initialValues?.id, form]);

  // 在表设计器创建完自定义表后切回本窗口：自动刷新表单列表
  useEffect(() => {
    const onFocus = () => setFormListKey((k) => k + 1);
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  // 动态数据源：对应表单下拉（自定义/系统）
  const dataSources: Record<string, DataSourceResolver> = {
    formList: async () => {
      const res: any = await workflowBillApi.getAll();
      const list = pickPayload(res) || [];
      return list.map((b: any) => ({
        value: String(b.id),
        label: b.formName || b.tableName || b.name || String(b.id),
        description: b.tableName,
        type: b.formType ?? 0,
      }));
    },
  };

  // 浏览框数据源：路径类型（wftype）
  const browserResolvers: Record<string, (kw?: string) => Promise<any>> = {
    wftype: async (kw?: string) => {
      const res: any = await workflowBrowserApi.list('wftype', kw);
      return pickPayload(res) || [];
    },
  };

  const submit = async (enterDesign: boolean) => {
    let values: any;
    try {
      values = await form.validateFields();
    } catch (err) {
      console.warn('[WorkflowDefForm] 表单校验未通过：', err);
      message.warning('请先完善表单必填项（标红字段）后再保存');
      return;
    }
    setSubmitting(true);
    try {
      const payload: any = buildPayload(fields, values, {
        ...(isEdit ? { id: initialValues?.id } : {}),
        procKey: initialValues?.procKey || genProcKey(),
      });
      console.log('[WorkflowDefForm] 提交 payload：', payload);
      const res: any = isEdit
        ? await updateDefinition(initialValues?.id, payload)
        : await createDefinition(payload);
      const api: any =
        res?.data && typeof res.data === 'object' && !Array.isArray(res.data) && 'code' in res.data
          ? res.data
          : res;
      if (api && api.success === false) {
        message.error(`保存失败：${api.msg || api.message || '请稍后重试'}`);
        return;
      }
      if (api && api.code && api.code !== 200) {
        message.error(`保存失败：(code ${api.code}) ${api.msg || api.message || ''}`);
        return;
      }
      const pickId = (r: any): any => {
        if (r == null) return undefined;
        if (typeof r === 'number' || typeof r === 'string') return r;
        const d = r?.data;
        if (typeof d === 'number' || typeof d === 'string') return d;
        if (d && typeof d === 'object') return d?.data ?? d?.id ?? undefined;
        return r?.id ?? undefined;
      };
      const rawId = pickId(res);
      const newId = rawId != null && rawId !== '' ? String(rawId) : undefined;
      message.success(isEdit ? '保存成功' : '创建成功');
      if (enterDesign && newId != null) {
        onEnterDesign?.(newId);
      } else {
        if (enterDesign) message.warning('未取到流程定义ID，无法进入详细设置');
        onSaved?.(newId);
      }
    } catch (e: any) {
      console.error('[WorkflowDefForm] 保存异常：', e);
      message.error(`${isEdit ? '保存' : '创建'}失败：${e?.msg || e?.message || '请稍后重试'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const moreItems = [
    {
      key: 'saveAsNewVersion',
      label: '另存为新版本',
      disabled: !isEdit || !onSaveAsNewVersion,
    },
  ];

  return (
    <>
      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <Spin />
        </div>
      ) : (
        <SchemaForm
          fields={fields}
          form={form}
          dataSources={dataSources}
          browserResolvers={browserResolvers}
          browserRefreshKey={browserRefreshKey}
          onFieldAdd={(f) => {
            if (f.browser?.type === 'wftype') {
              setAddTypeField(f);
              setAddTypeOpen(true);
            } else if (f.control === 'formSelect') {
              setFormAddOpen(true);
            } else {
              message.info(`「${f.label || f.key}」新增功能暂未开放`);
            }
          }}
          dataSourceRefreshKey={formListKey}
          onRefreshDataSource={() => setFormListKey((k) => k + 1)}
          onFieldDesign={(_f, id) => {
            if (!id) return;
            setDesignFormId(String(id));
            setDesignOpen(true);
          }}
        />
      )}

      {showFooter && (
        <div style={{ marginTop: 16, textAlign: 'right' }}>
          <Space>
            <Button type="primary" loading={submitting} onClick={() => submit(false)}>
              保存
            </Button>
            <Button type="primary" loading={submitting} onClick={() => submit(true)}>
              保存并进入详细设置
            </Button>
            <Dropdown
              disabled={!isEdit || !onSaveAsNewVersion}
              menu={{
                items: moreItems,
                onClick: ({ key }) => {
                  if (key === 'saveAsNewVersion' && initialValues?.id != null) {
                    onSaveAsNewVersion?.(String(initialValues.id));
                  }
                },
              }}
            >
              <Button>更多 »</Button>
            </Dropdown>
          </Space>
        </div>
      )}

      <WorkflowTypeAddModal
        open={addTypeOpen}
        onCancel={() => setAddTypeOpen(false)}
        onCreated={(opt) => {
          if (addTypeField && opt?.value != null) {
            form.setFieldsValue({ [addTypeField.key]: String(opt.value) });
          }
          setBrowserRefreshKey((k) => k + 1);
          setAddTypeOpen(false);
          message.success('路径类型已添加并选中');
        }}
      />
      <WorkflowFormAddModal
        open={formAddOpen}
        onCancel={() => setFormAddOpen(false)}
        onCreated={(created) => {
          setFormAddOpen(false);
          setFormListKey((k) => k + 1);
          if (created?.id) {
            form.setFieldsValue({ form: { type: 0, id: String(created.id) } });
            setDesignFormId(String(created.id));
            setDesignOpen(true);
          }
          message.success(`自定义表单「${created?.formName || ''}」已创建并选中`);
        }}
      />

      <Modal
        title="配置字段"
        open={designOpen}
        onCancel={() => {
          setDesignOpen(false);
          setFormListKey((k) => k + 1);
        }}
        width="90vw"
        style={{ top: 24 }}
        styles={{ body: { height: '78vh', padding: 0 } }}
        footer={null}
        destroyOnClose
      >
        {designOpen && designFormId ? (
          <TableDesign
            formId={designFormId}
            embedded
            onClose={() => setDesignOpen(false)}
            onSaved={() => {
              setFormListKey((k) => k + 1);
              setDesignOpen(false);
            }}
          />
        ) : null}
      </Modal>
    </>
  );
};

export default WorkflowDefForm;
