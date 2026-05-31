import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from '@umijs/max';
import { Button, Card, message } from 'antd';
import React, { useRef, useState } from 'react';
import { PageContainer } from '@ant-design/pro-components';
import { fieldApi } from '@/services/formmode';
import type { FieldDefinitionFormData } from '@/services/formmode/typings';
import FieldManageForm from './components/FieldManageForm';

/**
 * 字段新增页面
 */
const FieldAdd: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const formId = searchParams.get('formId');
  const formRef = useRef<any>(null);
  const [loading, setLoading] = useState(false);

  // 提交表单
  const handleSubmit = async (values: FieldDefinitionFormData) => {
    if (!formId) {
      message.error('表单ID不能为空');
      return;
    }

    setLoading(true);
    try {
      await fieldApi.create({
        ...values,
        formId,
      });
      message.success('新增成功');
      // 返回字段管理列表，并传递表单ID
      navigate(`/formmode/fieldmanage?formId=${formId}`);
    } catch (error) {
      console.error('新增失败:', error);
      message.error('新增失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer
      title="新增字段"
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
        <FieldManageForm
          form={formRef.current}
          onFinish={handleSubmit}
          loading={loading}
          formId={formId || undefined}
        />
      </Card>
    </PageContainer>
  );
};

export default FieldAdd;
