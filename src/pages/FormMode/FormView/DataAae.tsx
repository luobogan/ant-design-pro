import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { useNavigate, useSearchParams } from '@umijs/max';
import { Button, Card, message, Form } from 'antd';
import React, { useState, useEffect } from 'react';
import { formApi, dataApi } from '@/services/formmode';
import type { FieldDefinition, FormDataFormData } from '@/services/formmode/typings';
import FieldRenderer from './components/FieldRenderer';

/**
 * 表单数据新增/编辑页面（AAE模式）
 */
const DataAae: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [formFields, setFormFields] = useState<FieldDefinition[]>([]);
  const [formName, setFormName] = useState<string>('');

  // 通过 URL 参数获取模式和 ID
  const mode = searchParams.get('mode') || 'add';
  const dataId = searchParams.get('id');
  const formId = searchParams.get('formId');
  const isEditMode = mode === 'edit' && dataId;

  // 页面标题
  const pageTitle = isEditMode ? `编辑数据 - ${formName || '加载中...'}` : `新增数据 - ${formName || '加载中...'}`;

  // 获取表单信息和字段定义
  const fetchFormInfo = async () => {
    if (!formId) return;

    setFetchLoading(true);
    try {
      // 获取表单详情
      const formDetail = await formApi.getById(formId);
      if (formDetail) {
        setFormName(formDetail.formName);
      }

      // 获取字段定义
      const fields = await dataApi.getFieldDefinitions(formId);
      setFormFields(fields || []);

      // 如果是编辑模式，获取数据详情并填充表单
      if (isEditMode && dataId) {
        const formData = await dataApi.getById(formId, dataId);
        if (formData) {
          const formDataValues: Record<string, any> = {};
          fields?.forEach((field) => {
            formDataValues[field.fieldName] = formData[field.fieldName];
          });
          form.setFieldsValue(formDataValues);
        }
      }
    } catch (error) {
      console.error('获取表单信息失败:', error);
      message.error('获取表单信息失败');
    } finally {
      setFetchLoading(false);
    }
  };

  // 初始加载
  useEffect(() => {
    if (formId) {
      fetchFormInfo();
    }
  }, [formId, dataId, isEditMode]);

  // 提交表单
  const handleSubmit = async () => {
    if (!formId) return;

    try {
      const values = await form.validateFields();
      setLoading(true);

      // 构建表单数据
      const formData: FormDataFormData = {
        id: isEditMode && dataId ? dataId : undefined,
        formId,
        ...values,
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

  // 如果没有 formId，显示错误提示
  if (!formId) {
    return (
      <PageContainer title="表单数据">
        <Card>
          <div style={{ textAlign: 'center', padding: '50px' }}>
            请先从表单管理页面进入
          </div>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title={pageTitle}
      onBack={() => navigate(`/formmode/formview?formId=${formId}`)}
      extra={
        <Button type="primary" icon={<SaveOutlined />} loading={loading} onClick={handleSubmit}>
          保存
        </Button>
      }
    >
      <Card>
        {fetchLoading ? (
          <div style={{ textAlign: 'center', padding: '50px' }}>加载中...</div>
        ) : (
          <Form form={form} layout="vertical" style={{ maxWidth: 800, margin: '0 auto' }}>
            {/* 动态生成表单字段 */}
            {formFields.map((field) => (
              <Form.Item
                key={field.id}
                name={field.fieldName}
                label={field.fieldLabel}
                rules={
                  field.isRequired === 1
                    ? [{ required: true, message: `请输入${field.fieldLabel}` }]
                    : []
                }
              >
                <FieldRenderer field={field} disabled={field.isReadOnly === 1} />
              </Form.Item>
            ))}

            {/* 提交按钮 */}
            <Form.Item>
              <Button type="primary" onClick={handleSubmit} loading={loading}>
                提交
              </Button>
              <Button style={{ marginLeft: 8 }} onClick={() => navigate(`/formmode/formview?formId=${formId}`)}>
                取消
              </Button>
            </Form.Item>
          </Form>
        )}
      </Card>
    </PageContainer>
  );
};

export default DataAae;