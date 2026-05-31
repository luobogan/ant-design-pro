import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from '@umijs/max';
import { Button, Card, message } from 'antd';
import React, { useEffect, useState } from 'react';
import { PageContainer } from '@ant-design/pro-components';
import { fieldApi } from '@/services/formmode';
import type {
  FieldDefinition,
  FieldDefinitionFormData,
} from '@/services/formmode/typings';
import FieldManageForm from './components/FieldManageForm';

/**
 * 字段新增/编辑页面（AAE模式）
 */
const FieldAae: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [fieldDefinition, setFieldDefinition] = useState<FieldDefinition | undefined>();

  // 通过 URL 参数获取模式和 ID
  const mode = searchParams.get('mode') || 'add';
  const fieldId = searchParams.get('id');
  const formId = searchParams.get('formId');
  const isEditMode = mode === 'edit' && fieldId;

  // 页面标题
  const pageTitle = isEditMode ? '编辑字段' : '新增字段';

  // 获取字段详情
  const fetchFieldDetail = async () => {
    if (!fieldId) return;

    setFetchLoading(true);
    try {
      const result = await fieldApi.getById(fieldId);
      setFieldDefinition(result);
    } catch (error) {
      console.error('获取字段详情失败:', error);
      message.error('获取字段详情失败');
    } finally {
      setFetchLoading(false);
    }
  };

  // 初始加载
  useEffect(() => {
    if (isEditMode && fieldId) {
      fetchFieldDetail();
    } else {
      setFetchLoading(false);
    }
  }, [fieldId, isEditMode]);

  // 提交表单
  const handleSubmit = async (values: FieldDefinitionFormData) => {
    if (!formId && !fieldDefinition?.formId) {
      message.error('表单ID不能为空');
      return;
    }

    setLoading(true);
    try {
      if (isEditMode && fieldId) {
        await fieldApi.update(fieldId, values);
        message.success('字段更新成功');
      } else {
        await fieldApi.create({
          ...values,
          formId: formId || fieldDefinition?.formId || '',
        });
        message.success('字段创建成功');
      }
      navigate('/formmode/fieldmanage');
    } catch (error: any) {
      message.error(error.message || (isEditMode ? '更新字段失败' : '创建字段失败'));
    } finally {
      setLoading(false);
    }
  };

  // 生成初始值
  const initialValues = React.useMemo(() => {
    if (!fieldDefinition) return undefined;
    return {
      fieldName: fieldDefinition.fieldName,
      fieldLabel: fieldDefinition.fieldLabel,
      fieldHtmlType: fieldDefinition.fieldHtmlType,
      fieldType: fieldDefinition.fieldType,
      fieldDbType: fieldDefinition.fieldDbType,
      fieldLength: fieldDefinition.fieldLength,
      fieldDecimals: fieldDefinition.fieldDecimals,
      isRequired: fieldDefinition.isRequired,
      isReadOnly: fieldDefinition.isReadOnly,
      isDisabled: fieldDefinition.isDisabled,
      defaultValue: fieldDefinition.defaultValue,
      sort: fieldDefinition.sort,
      validateRule: fieldDefinition.validateRule,
      description: fieldDefinition.description,
      status: fieldDefinition.status,
      formId: fieldDefinition.formId,
    };
  }, [fieldDefinition]);

  return (
    <PageContainer
      title={pageTitle}
      onBack={() => navigate('/formmode/fieldmanage')}
      extra={
        <Button type="primary" icon={<SaveOutlined />} loading={loading}>
          保存
        </Button>
      }
    >
      <Card>
        {fetchLoading ? (
          <div style={{ textAlign: 'center', padding: '50px' }}>加载中...</div>
        ) : (
          <FieldManageForm
            initialValues={initialValues}
            onFinish={handleSubmit}
            loading={loading}
            formId={formId || fieldDefinition?.formId || undefined}
          />
        )}
      </Card>
    </PageContainer>
  );
};

export default FieldAae;
