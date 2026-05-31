import { ArrowLeftOutlined, EditOutlined } from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { useNavigate, useParams, useSearchParams } from '@umijs/max';
import { Button, Card, Descriptions, message, Spin } from 'antd';
import React, { useState, useEffect } from 'react';
import { dataApi } from '@/services/formmode';
import type { FieldDefinition, FormDataRecord } from '@/services/formmode/typings';
import FieldRenderer from './components/FieldRenderer';

/**
 * 表单数据详情页面
 */
const DataDetail: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const formId = searchParams.get('formId');
  
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [formFields, setFormFields] = useState<FieldDefinition[]>([]);
  const [formData, setFormData] = useState<FormDataRecord | null>(null);
  const [formName, setFormName] = useState<string>('');

  // 获取表单信息和字段定义
  const fetchFormInfo = async () => {
    if (!formId) return;

    try {
      // 获取字段定义
      const fields = await dataApi.getFieldDefinitions(formId);
      setFormFields(fields || []);
    } catch (error) {
      console.error('获取表单信息失败:', error);
      message.error('获取表单信息失败');
    }
  };

  // 获取表单数据详情
  const fetchDataDetail = async () => {
    if (!formId || !id) return;
    
    setFetchLoading(true);
    try {
      const result = await dataApi.getById(formId, id);
      if (result) {
        setFormData(result);
      }
    } catch (error) {
      console.error('获取表单数据失败:', error);
      message.error('获取表单数据失败');
    } finally {
      setFetchLoading(false);
    }
  };

  // 初始加载
  useEffect(() => {
    if (formId) {
      fetchFormInfo();
    }
  }, [formId]);

  // 字段定义加载完成后获取数据
  useEffect(() => {
    if (formFields.length > 0 && formId && id) {
      fetchDataDetail();
    }
  }, [formFields, formId, id]);

  // 如果没有 formId 或 id，显示错误提示
  if (!formId || !id) {
    return (
      <PageContainer title="数据详情">
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
      title={`数据详情 - ${formName || '加载中...'}`}
      onBack={() => navigate(`/formmode/data-list?formId=${formId}`)}
      extra={
        <Button
          type="primary"
          icon={<EditOutlined />}
          onClick={() => navigate(`/formmode/data-edit/${id}?formId=${formId}`)}
        >
          编辑
        </Button>
      }
    >
      <Card>
        {fetchLoading ? (
          <div style={{ textAlign: 'center', padding: '50px' }}>
            <Spin size="large" />
          </div>
        ) : (
          <Descriptions
            bordered
            column={2}
            labelStyle={{ width: '150px' }}
          >
            {/* 动态生成详情字段 */}
            {formFields.map((field) => (
              <Descriptions.Item
                key={field.id}
                label={field.fieldLabel}
                span={field.fieldHtmlType === 4 ? 2 : 1}
              >
                <FieldRenderer
                  field={field}
                  value={formData?.[field.fieldName]}
                  readonly={true}
                />
              </Descriptions.Item>
            ))}

            {/* 系统字段 */}
            <Descriptions.Item label="创建时间" span={1}>
              {formData?.createTime || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="更新时间" span={1}>
              {formData?.updateTime || '-'}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Card>
    </PageContainer>
  );
};

export default DataDetail;
