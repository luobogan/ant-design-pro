import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { useNavigate, useParams, useSearchParams } from '@umijs/max';
import { Button, Card, message, Form } from 'antd';
import React, { useRef, useState, useEffect } from 'react';
import { dataApi } from '@/services/formmode';
import type { FieldDefinition, FormDataFormData } from '@/services/formmode/typings';
import FieldRenderer from './components/FieldRenderer';

/**
 * 表单数据编辑页面
 */
const DataEdit: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const formId = searchParams.get('formId');
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [formFields, setFormFields] = useState<FieldDefinition[]>([]);
  const [formName, setFormName] = useState<string>('');

  // 获取表单信息和字段定义
  const fetchFormInfo = async () => {
    if (!formId) return;

    try {
      // 获取字段定义
      const fields = await dataApi.getFieldDefinitions(formId);
      setFormFields(fields || []);

      // 获取表单详情（用于获取表单名称）
      const formData = await dataApi.getById(formId, id!);
      if (formData) {
        // 填充表单
        const formDataValues: Record<string, any> = {};
        fields?.forEach((field) => {
          formDataValues[field.fieldName] = formData[field.fieldName];
        });
        form.setFieldsValue(formDataValues);
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
    if (formId && id) {
      fetchFormInfo();
    }
  }, [formId, id]);

  // 提交表单
  const handleSubmit = async () => {
    if (!formId || !id) return;

    try {
      const values = await form.validateFields();
      setLoading(true);

      // 构建表单数据
      const formData: FormDataFormData = {
        id,
        formId,
        ...values,
      };

      await dataApi.update(formId, id, formData);
      message.success('更新成功');
      navigate(`/formmode/data-list?formId=${formId}`);
    } catch (error) {
      console.error('更新失败:', error);
      message.error('更新失败');
    } finally {
      setLoading(false);
    }
  };

  // 如果没有 formId 或 id，显示错误提示
  if (!formId || !id) {
    return (
      <PageContainer title="编辑数据">
        <Card>
          <div style={{ textAlign: 'center', padding: '50px' }}>
            参数错误
          </div>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title={`编辑数据 - ${formName || '加载中...'}`}
      onBack={() => navigate(`/formmode/data-list?formId=${formId}`)}
      extra={
        <Button
          type="primary"
          icon={<SaveOutlined />}
          loading={loading}
          onClick={handleSubmit}
        >
          保存
        </Button>
      }
    >
      <Card>
        {fetchLoading ? (
          <div style={{ textAlign: 'center', padding: '50px' }}>加载中...</div>
        ) : (
          <Form
            form={form}
            layout="vertical"
            style={{ maxWidth: 800, margin: '0 auto' }}
          >
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
                <FieldRenderer
                  field={field}
                  disabled={field.isReadOnly === 1}
                />
              </Form.Item>
            ))}

            {/* 提交按钮 */}
            <Form.Item>
              <Button type="primary" onClick={handleSubmit} loading={loading}>
                提交
              </Button>
              <Button
                style={{ marginLeft: 8 }}
                onClick={() => navigate(`/formmode/data-list?formId=${formId}`)}
              >
                取消
              </Button>
            </Form.Item>
          </Form>
        )}
      </Card>
    </PageContainer>
  );
};

export default DataEdit;
