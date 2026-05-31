import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from '@umijs/max';
import { Button, Card, message } from 'antd';
import React, { useRef, useState, useEffect } from 'react';
import { PageContainer } from '@ant-design/pro-components';
import { formApi } from '@/services/formmode';
import type { WorkflowBillFormData } from '@/services/formmode/typings';
import FormManageForm from './components/FormManageForm';

/**
 * 表单编辑页面
 */
const FormEdit: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const formRef = useRef<any>(null);
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);

  // 获取表单详情
  const fetchFormDetail = async () => {
    if (!id) return;
    
    setFetchLoading(true);
    try {
      const result = await formApi.getById(id);
      if (result) {
        // 填充表单
        formRef.current?.setFieldsValue({
          formName: result.formName,
          tableName: result.tableName,
          description: result.description,
          status: result.status,
          moduleId: result.moduleId,
        });
      }
    } catch (error) {
      console.error('获取表单详情失败:', error);
      message.error('获取表单详情失败');
    } finally {
      setFetchLoading(false);
    }
  };

  // 初始加载
  useEffect(() => {
    fetchFormDetail();
  }, [id]);

  // 提交表单
  const handleSubmit = async (values: FormDefinitionFormData) => {
    if (!id) return;
    
    setLoading(true);
    try {
      await formApi.update(id, values);
      message.success('更新成功');
      navigate('/formmode/form-manage');
    } catch (error) {
      console.error('更新失败:', error);
      message.error('更新失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer
      title="编辑表单"
      onBack={() => navigate('/formmode/form-manage')}
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
          <FormManageForm
            form={formRef.current}
            onFinish={handleSubmit}
            loading={loading}
          />
        )}
      </Card>
    </PageContainer>
  );
};

export default FormEdit;
