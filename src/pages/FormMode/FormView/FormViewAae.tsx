import { SaveOutlined } from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { useNavigate, useSearchParams } from '@umijs/max';
import { Button, Card, Spin, message } from 'antd';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { formApi, dataApi, fieldDefinitionApi } from '@/services/formmode';
import { getFormLayout } from '@/services/formmode/formLayoutApi';
import type { FormDataFormData } from '@/services/formmode/typings';
import { useRuntimeFieldPerm } from './hooks/useRuntimeFieldPerm';
import ExcelPreview, { type ExcelPreviewHandle } from '../ExcelDesign/components/ExcelPreview';
import { collectFieldValues, expandInitialValues, pickFieldNameValues } from '../ExcelDesign/utils/collectFieldValues';

/** 把后端 layoutJson（可能是 JSON 字符串）规范成 ExcelPreview 可消费的布局对象 */
const normalizeLayoutData = (raw: any): any | null => {
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.sheets && Object.keys(parsed.sheets).length) return parsed;
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
 * 表单数据新增/编辑/查看页面。
 *
 * 运行期只按「当前用户命中的字段权限组 groupKey + layoutType」加载 Univer 布局。
 * 未命中组或没有对应布局时只提示，不再兜底动态字段表单或表单级通用布局。
 */
const DataAae: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const previewRef = useRef<ExcelPreviewHandle>(null);
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [layoutLoading, setLayoutLoading] = useState(true);
  const [fieldConfigured, setFieldConfigured] = useState(false);
  const [formName, setFormName] = useState<string>('');
  const [initialFieldValues, setInitialFieldValues] = useState<Record<string, any>>({});
  const [layoutData, setLayoutData] = useState<any | null>(null);

  const mode = searchParams.get('mode') || 'add';
  const rawDataId = searchParams.get('id');
  const dataId = rawDataId && /^\d+$/.test(rawDataId) ? rawDataId : null;
  const formId = searchParams.get('formId');
  const isViewMode = mode === 'view';
  const isEditMode = mode === 'edit' && !!dataId;
  const hasData = !!dataId && (isEditMode || isViewMode);
  const invalidDataId = (mode === 'edit' || mode === 'view') && !dataId;
  // 0=编辑/新增布局，1=显示/查看布局
  const layoutType = isViewMode ? 1 : 0;
  const runtimePerm = useRuntimeFieldPerm(formId, layoutType);
  const nodePermission = runtimePerm.resolve;

  const pageTitle = invalidDataId
    ? '数据ID无效'
    : isViewMode
      ? `查看数据 - ${formName || '加载中...'}`
      : (isEditMode ? `编辑数据 - ${formName || '加载中...'}` : `新增数据 - ${formName || '加载中...'}`);

  const fetchFormInfo = async () => {
    if (!formId || invalidDataId) return;
    setFetchLoading(true);
    try {
      const formDetail = await formApi.getById(formId);
      if (formDetail) setFormName(formDetail.formName);

      const [fields, configured] = await Promise.all([
        dataApi.getFieldDefinitions(formId),
        fieldDefinitionApi.isConfigured(formId),
      ]);
      setFieldConfigured(!!configured);

      if (hasData && dataId) {
        const formData = await dataApi.getById(formId, dataId);
        if (formData) {
          const values: Record<string, any> = {};
          const valueMap = (formData as any).fieldValues;
          (fields || []).forEach((field) => {
            const key = (field.fieldDbName || field.fieldName) as string;
            values[key] = valueMap ? valueMap[key] : (formData as any)[key];
          });
          setInitialFieldValues(values);
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
  }, [formId, dataId, isEditMode, isViewMode, invalidDataId]);

  // 只加载当前用户命中组的布局；没有命中组或没有对应布局时不做任何兜底
  useEffect(() => {
    if (!formId || runtimePerm.loading) return;
    let cancelled = false;
    setLayoutLoading(true);
    const nodeKey = runtimePerm.layoutNodeKey;
    if (!nodeKey) {
      setLayoutData(null);
      setLayoutLoading(false);
      return;
    }
    (async () => {
      try {
        const res: any = await getFormLayout(formId, layoutType, nodeKey, false);
        const raw = res?.data?.layoutJson;
        const parsed = normalizeLayoutData(raw);
        if (!cancelled) setLayoutData(parsed);
      } catch (e) {
        console.warn('[FormViewAae] 加载 Univer 布局失败:', e);
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
    if (!formId || !layoutData) return;
    if (!fieldConfigured) {
      message.warning('请先完成字段配置，再进行数据编辑');
      return;
    }
    try {
      setLoading(true);
      const fieldValues = pickFieldNameValues({ ...values, ...collectFieldValues(layoutData, values) });
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
    if (!layoutData) {
      message.warning('没有相应的布局，无法保存数据');
      return;
    }
    previewRef.current?.submit();
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
      extra={isViewMode || invalidDataId ? undefined : (
        <Button type="primary" icon={<SaveOutlined />} loading={loading} disabled={!fieldConfigured || !layoutData} onClick={handleSubmit}>
          保存
        </Button>
      )}
    >
      <Card>
        {invalidDataId ? (
          <div style={{ textAlign: 'center', padding: '50px' }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>数据ID无效</div>
            <div style={{ color: '#999' }}>请从数据列表重新进入查看或编辑页面。</div>
          </div>
        ) : fetchLoading || layoutLoading || runtimePerm.loading ? (
          <div style={{ textAlign: 'center', padding: '50px' }}><Spin tip="加载中..." /></div>
        ) : !layoutData ? (
          <div style={{ textAlign: 'center', padding: '50px' }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>没有相应的布局</div>
            <div style={{ color: '#999' }}>
              当前用户未命中字段权限组，或该组未配置当前类型的 Univer 布局。请联系管理员配置字段权限组并设计对应布局。
            </div>
          </div>
        ) : (
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
        )}
      </Card>
    </PageContainer>
  );
};

export default DataAae;
