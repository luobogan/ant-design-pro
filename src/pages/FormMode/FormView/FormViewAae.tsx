import { SaveOutlined } from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { useNavigate, useSearchParams } from '@umijs/max';
import { Button, Card, Form, Spin, message } from 'antd';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { formApi, dataApi, fieldDefinitionApi } from '@/services/formmode';
import { getFormLayout } from '@/services/formmode/formLayoutApi';
import type { FieldDefinition, FormDataFormData } from '@/services/formmode/typings';
import FieldRenderer from './components/FieldRenderer';
import { useRuntimeFieldPerm } from './hooks/useRuntimeFieldPerm';
import ExcelPreview, { type ExcelPreviewHandle } from '../ExcelDesign/components/ExcelPreview';
import { collectFieldValues, expandInitialValues, pickFieldNameValues } from '../ExcelDesign/utils/collectFieldValues';

/** 把后端 layoutJson（可能是 JSON 字符串）规范成 ExcelPreview 可消费的布局对象 */
const normalizeLayoutData = (raw: any): any | null => {
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.sheets && Object.keys(parsed.sheets).length) return parsed;
    // 兼容画布 parentData 形状：{ Sheet1: { sheets: {...} } }
    const sheetKey = Object.keys(parsed).find((k) => parsed[k]?.sheets);
    if (sheetKey) {
      return {
        ...parsed[sheetKey],
        detailTables: parsed.detailTables || {},
        tabTables: parsed.tabTables || {},
      };
    }
    return null;
  } catch {
    return null;
  }
};

/**
 * 表单数据新增/编辑/查看页面（AAE模式）
 *
 * 有 Univer 布局：按当前用户命中的授权对象组 + layoutType 加载布局并用 ExcelPreview 渲染。
 * 无布局：继续按字段定义动态生成表单，保证兼容不阻断。
 */
const DataAae: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [form] = Form.useForm();
  const previewRef = useRef<ExcelPreviewHandle>(null);
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [layoutLoading, setLayoutLoading] = useState(true);
  const [formFields, setFormFields] = useState<FieldDefinition[]>([]);
  const [fieldConfigured, setFieldConfigured] = useState(false);
  const [formName, setFormName] = useState<string>('');
  const [initialFieldValues, setInitialFieldValues] = useState<Record<string, any>>({});
  const [layoutData, setLayoutData] = useState<any | null>(null);

  const mode = searchParams.get('mode') || 'add';
  const dataId = searchParams.get('id');
  const formId = searchParams.get('formId');
  const isViewMode = mode === 'view';
  const isEditMode = mode === 'edit' && !!dataId;
  const hasData = !!dataId && (isEditMode || isViewMode);
  // 0=编辑/新增布局，1=显示/查看布局
  const layoutType = isViewMode ? 1 : 0;
  const runtimePerm = useRuntimeFieldPerm(formId, layoutType);
  const nodePermission = runtimePerm.resolve;

  const pageTitle = isViewMode
    ? `查看数据 - ${formName || '加载中...'}`
    : (isEditMode ? `编辑数据 - ${formName || '加载中...'}` : `新增数据 - ${formName || '加载中...'}`);

  const fetchFormInfo = async () => {
    if (!formId) return;
    setFetchLoading(true);
    try {
      const formDetail = await formApi.getById(formId);
      if (formDetail) setFormName(formDetail.formName);

      const [fields, configured] = await Promise.all([
        dataApi.getFieldDefinitions(formId),
        fieldDefinitionApi.isConfigured(formId),
      ]);
      setFormFields(fields || []);
      setFieldConfigured(!!configured);

      if (hasData && dataId) {
        const formData = await dataApi.getById(formId, dataId);
        if (formData) {
          const values: Record<string, any> = {};
          const valueMap = (formData as any).fieldValues;
          fields?.forEach((field) => {
            const key = (field.fieldDbName || field.fieldName) as string;
            values[key] = valueMap ? valueMap[key] : (formData as any)[key];
          });
          setInitialFieldValues(values);
          form.setFieldsValue(values);
        }
      } else {
        setInitialFieldValues({});
      }
    } catch (error) {
      console.error('获取表单信息失败:', error);
      message.error('获取表单信息失败');
    } finally {
      setFetchLoading(false);
    }
  };

  useEffect(() => {
    if (formId) fetchFormInfo();
  }, [formId, dataId, isEditMode, isViewMode]);

  // 按当前用户命中组 + 布局类型加载 Univer 布局；没有组时使用表单级布局
  useEffect(() => {
    if (!formId || runtimePerm.loading) return;
    let cancelled = false;
    setLayoutLoading(true);
    (async () => {
      try {
        const nodeKey = runtimePerm.layoutNodeKey;
        const res: any = await getFormLayout(formId, layoutType, nodeKey, !nodeKey);
        const raw = res?.data?.layoutJson;
        const parsed = normalizeLayoutData(raw);
        if (!cancelled) setLayoutData(parsed);
      } catch (e) {
        console.warn('[FormViewAae] 加载 Univer 布局失败，使用字段表单降级:', e);
        if (!cancelled) setLayoutData(null);
      } finally {
        if (!cancelled) setLayoutLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [formId, layoutType, runtimePerm.loading, runtimePerm.layoutNodeKey]);

  const previewInitialValues = useMemo(
    () => expandInitialValues(layoutData, initialFieldValues),
    [layoutData, initialFieldValues],
  );

  const submitData = async (values: Record<string, any>) => {
    if (!formId) return;
    if (!fieldConfigured) {
      message.warning('请先完成字段配置，再进行数据编辑');
      return;
    }
    try {
      setLoading(true);
      const fieldValues = layoutData
        ? pickFieldNameValues({ ...values, ...collectFieldValues(layoutData, values) })
        : values;
      const formData: FormDataFormData = {
        id: isEditMode && dataId ? dataId : undefined,
        formId,
        ...fieldValues,
      };
      if (isEditMode && dataId) {
        await dataApi.update(formId, dataId, formData);
        message.success('更新成功');
      } else {
        await dataApi.create(formId, formData);
        message.success('新增成功');
      }
      navigate(`/formmode/formview?formId=${formId}`);
    } catch (error) {
      console.error('操作失败:', error);
      message.error(isEditMode ? '更新失败' : '新增失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (isViewMode) return;
    if (!fieldConfigured) {
      message.warning('请先完成字段配置，再进行数据编辑');
      return;
    }
    if (layoutData) {
      previewRef.current?.submit();
      return;
    }
    const values = await form.validateFields();
    await submitData(values);
  };

  if (!formId) {
    return (
      <PageContainer title="表单数据">
        <Card>
          <div style={{ textAlign: 'center', padding: '50px' }}>请先从表单管理页面进入</div>
        </Card>
      </PageContainer>
    );
  }

  if (!fetchLoading && !fieldConfigured) {
    return (
      <PageContainer title={pageTitle} onBack={() => navigate(`/formmode/formview?formId=${formId}`)}>
        <Card>
          <div style={{ textAlign: 'center', padding: '50px' }}>
            该表单尚未完成字段配置，无法新增或编辑数据。请先到字段管理/表格设计器完成字段配置。
          </div>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title={pageTitle}
      onBack={() => navigate(`/formmode/formview?formId=${formId}`)}
      extra={isViewMode ? undefined : (
        <Button type="primary" icon={<SaveOutlined />} loading={loading} disabled={!fieldConfigured} onClick={handleSubmit}>
          保存
        </Button>
      )}
    >
      <Card>
        {fetchLoading || layoutLoading || runtimePerm.loading ? (
          <div style={{ textAlign: 'center', padding: '50px' }}><Spin tip="加载中..." /></div>
        ) : layoutData ? (
          <ExcelPreview
            ref={previewRef}
            layoutData={layoutData}
            open
            standalone
            hideHeader
            readOnly={isViewMode}
            formId={formId}
            nodePermission={nodePermission}
            initialValues={previewInitialValues}
            onValuesChange={() => undefined}
            onSubmit={(values, _errors, valid) => {
              if (valid) submitData(values);
            }}
            onClose={() => navigate(`/formmode/formview?formId=${formId}`)}
            title={pageTitle}
          />
        ) : (
          <Form form={form} layout="vertical" style={{ maxWidth: 800, margin: '0 auto' }}>
            {formFields.map((field) => (
              <Form.Item
                key={field.id}
                name={field.fieldDbName || field.fieldName}
                label={field.fieldLabel || field.fieldName}
                rules={field.isRequired === 1 ? [{ required: true, message: `请输入${field.fieldLabel}` }] : []}
              >
                <FieldRenderer field={field} disabled={isViewMode || field.isReadOnly === 1} nodePermission={nodePermission} />
              </Form.Item>
            ))}
            {!isViewMode && (
              <Form.Item>
                <Button type="primary" onClick={handleSubmit} loading={loading} disabled={!fieldConfigured}>提交</Button>
                <Button style={{ marginLeft: 8 }} onClick={() => navigate(`/formmode/formview?formId=${formId}`)}>取消</Button>
              </Form.Item>
            )}
          </Form>
        )}
      </Card>
    </PageContainer>
  );
};

export default DataAae;
