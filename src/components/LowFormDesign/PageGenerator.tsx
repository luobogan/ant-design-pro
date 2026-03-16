import { Form as AntForm, Button, Input, Modal, message, Select } from 'antd';
import React, { useEffect, useState } from 'react';
import {
  generatePagePreview,
  getPageTemplates,
  publishGeneratedPage,
} from '@/services/lowcode/pageGenerator';

interface PageGeneratorProps {
  visible: boolean;
  onCancel: () => void;
  formId: number | undefined;
  formName: string;
}

const { Option } = Select;

const PageGenerator: React.FC<PageGeneratorProps> = ({
  visible,
  onCancel,
  formId,
  formName,
}) => {
  const [form] = AntForm.useForm();
  const [loading, setLoading] = useState(false);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [templates, setTemplates] = useState<
    Array<{ value: string; label: string }>
  >([]);

  // 加载模板列表
  useEffect(() => {
    if (visible) {
      loadTemplates();
    }
  }, [visible]);

  const loadTemplates = async () => {
    try {
      setTemplateLoading(true);
      const response = await getPageTemplates();
      if (response?.success && response?.data) {
        const templateList = response.data.map((template: any) => ({
          value: template.code,
          label: template.name,
        }));
        setTemplates(templateList);
      }
    } catch (error) {
      console.error('加载模板失败:', error);
      message.error('加载模板失败');
    } finally {
      setTemplateLoading(false);
    }
  };

  // 生成预览页面
  const handleGeneratePreview = async () => {
    try {
      await form.validateFields();
      const values = form.getFieldsValue();

      if (!formId) {
        message.error('表单ID不能为空');
        return;
      }

      setLoading(true);
      const params = {
        formId,
        pageName: values.pageName,
        pagePath: values.pagePath,
        templateType: values.templateType,
        generateType: 'preview',
      };

      const response = await generatePagePreview(params);
      if (response?.success) {
        Modal.success({
          title: '生成成功',
          content: (
            <div>
              <p>预览页面已生成</p>
              {response.data?.pageUrl && (
                <p>
                  预览地址:{' '}
                  <a
                    href={response.data.pageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {response.data.pageUrl}
                  </a>
                </p>
              )}
            </div>
          ),
        });
      } else {
        throw new Error(response?.msg || '生成失败');
      }
    } catch (error: any) {
      console.error('生成预览失败:', error);
      Modal.error({
        title: '生成失败',
        content: error.message || '生成预览页面时发生错误',
      });
    } finally {
      setLoading(false);
    }
  };

  // 发布页面
  const handlePublishPage = async () => {
    try {
      await form.validateFields();
      const values = form.getFieldsValue();

      if (!formId) {
        message.error('表单ID不能为空');
        return;
      }

      setLoading(true);
      const params = {
        formId,
        pageName: values.pageName,
        pagePath: values.pagePath,
        templateType: values.templateType,
        generateType: 'publish',
      };

      const response = await publishGeneratedPage(params);
      if (response?.success) {
        Modal.success({
          title: '发布成功',
          content: (
            <div>
              <p>页面已成功发布</p>
              {response.data?.pageUrl && (
                <p>
                  访问地址:{' '}
                  <a
                    href={response.data.pageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {response.data.pageUrl}
                  </a>
                </p>
              )}
            </div>
          ),
        });
      } else {
        throw new Error(response?.msg || '发布失败');
      }
    } catch (error: any) {
      console.error('发布页面失败:', error);
      Modal.error({
        title: '发布失败',
        content: error.message || '发布页面时发生错误',
      });
    } finally {
      setLoading(false);
    }
  };

  // 重置表单
  const handleReset = () => {
    form.resetFields();
  };

  return (
    <Modal
      title="页面生成器"
      open={visible}
      onCancel={onCancel}
      footer={[
        <Button key="reset" onClick={handleReset}>
          重置
        </Button>,
        <Button key="cancel" onClick={onCancel}>
          取消
        </Button>,
        <Button
          key="preview"
          type="primary"
          onClick={handleGeneratePreview}
          loading={loading}
          style={{ marginLeft: 8 }}
        >
          生成预览
        </Button>,
        <Button
          key="publish"
          type="primary"
          danger
          onClick={handlePublishPage}
          loading={loading}
          style={{ marginLeft: 8 }}
        >
          发布页面
        </Button>,
      ]}
    >
      <AntForm
        form={form}
        layout="vertical"
        initialValues={{
          pageName: formName || '新页面',
          pagePath: `/form/${formId || 'new'}`,
          templateType: 'default',
        }}
      >
        <AntForm.Item
          name="pageName"
          label="页面名称"
          rules={[{ required: true, message: '请输入页面名称' }]}
        >
          <Input placeholder="请输入页面名称" />
        </AntForm.Item>

        <AntForm.Item
          name="pagePath"
          label="页面路径"
          rules={[{ required: true, message: '请输入页面路径' }]}
        >
          <Input placeholder="请输入页面路径，如 /form/1" />
        </AntForm.Item>

        <AntForm.Item
          name="templateType"
          label="模板类型"
          rules={[{ required: true, message: '请选择模板类型' }]}
        >
          <Select placeholder="请选择模板类型" loading={templateLoading}>
            {templates.map((template) => (
              <Option key={template.value} value={template.value}>
                {template.label}
              </Option>
            ))}
            {templates.length === 0 && (
              <Option value="default">默认模板</Option>
            )}
          </Select>
        </AntForm.Item>
      </AntForm>
    </Modal>
  );
};

export default PageGenerator;
