import { ArrowLeftOutlined, SaveOutlined, LoadingOutlined, SettingOutlined } from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { useNavigate, useSearchParams } from '@umijs/max';
import { Button, Card, message, Spin, Modal } from 'antd';
import React, { useEffect, useState } from 'react';
import { formApi } from '@/services/formmode';
import type { FormDefinition, FormDefinitionFormData } from '@/services/formmode/typings';
import FormManageForm from './components/FormManageForm';

/**
 * 表单新增/编辑页面（aae = Add And Edit）
 * 通过 URL 参数 mode 区分新增和编辑模式
 */
const FormAae: React.FC = () => {
  const [searchParams] = useSearchParams();

  const mode = searchParams.get('mode') || 'add';
  const formId = searchParams.get('id');

  const navigate = useNavigate();
  const [formDefinition, setFormDefinition] = useState<FormDefinition | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);

  const isEditMode = mode === 'edit' && formId;

  useEffect(() => {
    if (isEditMode && formId) {
      loadFormData(formId);
    } else {
      setFetchLoading(false);
    }
  }, [formId, isEditMode]);

  const loadFormData = async (id: string) => {
    setFetchLoading(true);
    try {
      const data = await formApi.getById(id);
      setFormDefinition(data);
    } catch (error: any) {
      message.error(error.message || '获取表单数据失败');
      navigate('/formmode/formmanage');
    } finally {
      setFetchLoading(false);
    }
  };

  const handleSubmit = async (data: FormDefinitionFormData) => {
    try {
      setLoading(true);
      if (isEditMode && formId) {
        await formApi.update(formId, data);
        message.success('表单更新成功');
        navigate('/formmode/formmanage');
      } else {
        const result = await formApi.create(data);
        message.success('表单创建成功');
        // 显示下一步选项
        Modal.confirm({
          title: '表单创建成功',
          content: '表单已创建成功，是否立即配置字段？',
          okText: '下一步：配置字段',
          cancelText: '返回列表',
          onOk: () => {
            // 跳转到字段管理的新增页面，并传递表单ID
            navigate(`/formmode/fieldmanage/aae?mode=add&formId=${result.id}`);
          },
          onCancel: () => {
            navigate('/formmode/formmanage');
          },
        });
      }
    } catch (error: any) {
      message.error(error.message || (isEditMode ? '更新表单失败' : '创建表单失败'));
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate('/formmode/formmanage');
  };

  const getPageTitle = () => {
    return isEditMode ? '编辑表单' : '新增表单';
  };

  const getBreadcrumb = () => {
    return [
      { name: '表单管理', path: '/formmode/formmanage' },
      { name: getPageTitle() },
    ];
  };

  if (fetchLoading) {
    return (
      <PageContainer>
        <Card>
          <div style={{ textAlign: 'center', padding: '100px 0' }}>
            <Spin indicator={<LoadingOutlined style={{ fontSize: 48 }} spin />} />
            <p style={{ marginTop: 16, color: '#666' }}>正在加载表单数据...</p>
          </div>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title={getPageTitle()}
      breadcrumb={{ items: getBreadcrumb() }}
      extra={[
        <Button
          key="back"
          icon={<ArrowLeftOutlined />}
          onClick={handleCancel}
        >
          返回列表
        </Button>,
        isEditMode && (
          <Button
            key="manageFields"
            type="default"
            icon={<SettingOutlined />}
            onClick={() => {
              if (formId) {
                navigate(`/formmode/fieldmanage?formId=${formId}`);
              }
            }}
          >
            管理字段
          </Button>
        ),
        <Button
          key="save"
          type="primary"
          icon={<SaveOutlined />}
          loading={loading}
          onClick={() => {
            // 触发 Form 组件的提交
            const form = document.querySelector('form');
            if (form) {
              form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
            }
          }}
        >
          保存
        </Button>,
      ].filter(Boolean)}
    >
      <Card>
        <FormManageForm
          formDefinition={formDefinition}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          submitting={loading}
          mode={isEditMode ? 'edit' : 'add'}
        />
      </Card>
    </PageContainer>
  );
};

export default FormAae;
