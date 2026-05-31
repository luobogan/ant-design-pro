import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
import { useNavigate, useParams, useSearchParams } from '@umijs/max';
import { Button, Card, message } from 'antd';
import React, { useRef, useState, useEffect } from 'react';
import { PageContainer } from '@ant-design/pro-components';
import { fieldApi } from '@/services/formmode';
import type { FieldDefinitionFormData } from '@/services/formmode/typings';
import FieldManageForm from './components/FieldManageForm';

/**
 * 字段编辑页面
 */
const FieldEdit: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const formId = searchParams.get('formId');
  const formRef = useRef<any>(null);
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);

  // 获取字段详情
  const fetchFieldDetail = async () => {
    if (!id) return;
    
    setFetchLoading(true);
    try {
      const result = await fieldApi.getById(id);
      if (result) {
        // 填充表单
        formRef.current?.setFieldsValue({
          fieldName: result.fieldName,
          fieldLabel: result.fieldLabel,
          fieldHtmlType: result.fieldHtmlType,
          fieldType: result.fieldType,
          fieldDbType: result.fieldDbType,
          fieldLength: result.fieldLength,
          fieldDecimals: result.fieldDecimals,
          isRequired: result.isRequired,
          isReadOnly: result.isReadOnly,
          isDisabled: result.isDisabled,
          defaultValue: result.defaultValue,
          sort: result.sort,
          validateRule: result.validateRule,
          description: result.description,
          status: result.status,
          formId: result.formId,
        });
      }
    } catch (error) {
      console.error('获取字段详情失败:', error);
      message.error('获取字段详情失败');
    } finally {
      setFetchLoading(false);
    }
  };

  // 初始加载
  useEffect(() => {
    fetchFieldDetail();
  }, [id]);

  // 提交表单
  const handleSubmit = async (values: FieldDefinitionFormData) => {
    if (!id) return;
    
    setLoading(true);
    try {
      await fieldApi.update(id, values);
      message.success('更新成功');
      navigate('/formmode/field-manage');
    } catch (error) {
      console.error('更新失败:', error);
      message.error('更新失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer
      title="编辑字段"
      onBack={() => navigate('/formmode/field-manage')}
      extra={
        <Button
          type="primary"
          icon={<SaveOutlined />}
          loading={loading}
          onClick={() => formRef.current?.submit()}
        >
          保存
        </Button>
      }
    >
      <Card>
        {fetchLoading ? (
          <div style={{ textAlign: 'center', padding: '50px' }}>加载中...</div>
        ) : (
          <FieldManageForm
            form={formRef.current}
            onFinish={handleSubmit}
            loading={loading}
            formId={formId || undefined}
          />
        )}
      </Card>
    </PageContainer>
  );
};

export default FieldEdit;
