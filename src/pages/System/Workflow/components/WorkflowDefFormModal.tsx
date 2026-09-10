import React, { useEffect, useState } from 'react';
import { Button, Dropdown, Form, message, Modal, Space, Spin } from 'antd';
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
 * 流程（路径）新增 / 编辑弹窗 —— 对齐 ecology「添加路径」。
 *
 * **condition 驱动**：字段清单（标签/必填/控件/选项/校验/提示）全部由后端
 * `GET /definition/form-condition` 下发，前端用 SchemaForm 通用渲染。
 * 新增或调整字段只需改后端字段清单，无需改本组件。
 *
 * 说明：procKey 不在界面暴露，创建时自动生成占位值；保存流程画布时后端会以 BPMN process id 校正。
 */
export interface WorkflowDefFormModalProps {
  open: boolean;
  mode?: 'add' | 'edit';
  initialValues?: Partial<WfProcessDefinition>;
  /** 关闭弹窗 */
  onCancel: () => void;
  /** 保存成功（未进入详细设置） */
  onSaved?: (id?: number) => void;
  /** 「保存并进入详细设置」成功 */
  onEnterDesign?: (id?: number) => void;
  /** 「更多 -> 另存为新版本」（仅编辑态可用，未传则禁用） */
  onSaveAsNewVersion?: (id: number) => void;
}

const genProcKey = () =>
  `flow_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const WorkflowDefFormModal: React.FC<WorkflowDefFormModalProps> = ({
  open,
  mode = 'add',
  initialValues,
  onCancel,
  onSaved,
  onEnterDesign,
  onSaveAsNewVersion,
}) => {
  const [form] = Form.useForm();
  const [fields, setFields] = useState<FormField[]>([]);
  const [title, setTitle] = useState('添加路径');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const isEdit = mode === 'edit';

  // 浏览框「+」新增路径类型：弹窗 + 刷新键（新增后刷新选项并选中）
  const [addTypeOpen, setAddTypeOpen] = useState(false);
  const [addTypeField, setAddTypeField] = useState<FormField | null>(null);
  const [browserRefreshKey, setBrowserRefreshKey] = useState(0);

  // 对应表单列表刷新键：新建自定义表单后重新拉取，便于直接选中新表单
  const [formListKey, setFormListKey] = useState(0);
  // 「新建自定义表单」弹窗（点 formSelect 的「+」打开，不跳转页面）
  const [formAddOpen, setFormAddOpen] = useState(false);
  // 「配置字段」弹窗：弹窗内嵌表设计器，不打开新页签
  const [designOpen, setDesignOpen] = useState(false);
  const [designFormId, setDesignFormId] = useState<string>('');

  // 打开时拉取字段描述并初始化表单
  useEffect(() => {
    if (!open) return;
    let mounted = true;
    setLoading(true);
    getDefinitionFormCondition(isEdit ? 'edit' : 'add', initialValues?.id)
      .then((r: any) => {
        if (!mounted) return;
        const cond: FormCondition = r?.data || r || { fields: [] };
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
  }, [open, isEdit, initialValues?.id, form]);

  // 动态数据源：对应表单下拉
  // 自定义表单 / 系统表单都来自 formmode 表单定义（workflow_bill），
  // 由 form_type 区分：0-自定义（表设计器创建） 1-系统（平台预置）。
  const dataSources: Record<string, DataSourceResolver> = {
    formList: async () => {
      const res: any = await workflowBillApi.getAll();
      const list = Array.isArray(res) ? res : res?.data || [];
      return list.map((b: any) => ({
        value: String(b.id),
        label: b.formName || b.tableName || b.name || String(b.id),
        // 浏览框「表名」列展示用
        description: b.tableName,
        // 缺省按自定义表单处理，保证加列前的存量数据也可用
        type: b.formType ?? 0,
      }));
    },
  };

  // 在表设计器创建完自定义表后切回本窗口：自动刷新表单列表
  useEffect(() => {
    if (!open) return;
    const onFocus = () => setFormListKey((k) => k + 1);
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [open]);

  // 浏览框数据源：路径类型（wftype）等，control=browser 时由 SchemaForm 调用
  const browserResolvers: Record<string, (kw?: string) => Promise<any>> = {
    wftype: async (kw?: string) => {
      const res: any = await workflowBrowserApi.list('wftype', kw);
      return res?.data || [];
    },
  };

  const submit = async (enterDesign: boolean) => {
    let values: any;
    try {
      values = await form.validateFields();
    } catch {
      return; // 必填校验未通过
    }
    setSubmitting(true);
    try {
      const payload: any = buildPayload(fields, values, {
        ...(isEdit ? { id: initialValues?.id } : {}),
        procKey: initialValues?.procKey || genProcKey(),
      });
      const res: any = isEdit
        ? await updateDefinition(Number(initialValues?.id), payload)
        : await createDefinition(payload);
      const newId =
        typeof res?.data === 'number' ? res.data : res?.data?.data ?? res?.data;
      message.success(isEdit ? '保存成功' : '创建成功');
      if (enterDesign && newId != null) {
        onEnterDesign?.(Number(newId));
      } else {
        onSaved?.(newId != null ? Number(newId) : undefined);
      }
    } catch (e: any) {
      message.error(
        `${isEdit ? '保存' : '创建'}失败：${e?.msg || e?.message || '请稍后重试'}`,
      );
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
    <Modal
      title={title}
      open={open}
      onCancel={onCancel}
      width={720}
      destroyOnClose
      maskClosable={false}
      footer={
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
                  onSaveAsNewVersion?.(Number(initialValues.id));
                }
              },
            }}
          >
            <Button>更多 »</Button>
          </Dropdown>
        </Space>
      }
    >
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
              // 自定义表单：就地弹出「新建自定义表单」小窗（不跳转页面）
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
          // 刷新表单下拉，并自动选中刚创建的自定义表单
          setFormListKey((k) => k + 1);
          if (created?.id) {
            form.setFieldsValue({ form: { type: 0, id: String(created.id) } });
            // 创建完成后直接进入「配置字段」弹窗（内嵌表设计器，不新开页签）
            setDesignFormId(String(created.id));
            setDesignOpen(true);
          }
          message.success(`自定义表单「${created?.formName || ''}」已创建并选中`);
        }}
      />

      {/* 配置字段：弹窗内嵌表设计器（不打开新页签） */}
      <Modal
        title="配置字段"
        open={designOpen}
        onCancel={() => {
          setDesignOpen(false);
          // 设计器里可能改了表单名称 / 字段，关闭后刷新下拉
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
              // 保存成功后关闭弹窗并刷新表单下拉
              setFormListKey((k) => k + 1);
              setDesignOpen(false);
            }}
          />
        ) : null}
      </Modal>
    </Modal>
  );
};

export default WorkflowDefFormModal;
