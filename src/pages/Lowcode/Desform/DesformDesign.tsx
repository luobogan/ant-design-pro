import { PageContainer } from '@ant-design/pro-components';
import { Button, Card, message, Spin } from 'antd';
import React, { useState } from 'react';
import { useParams } from 'umi';
import LowFormDesign from '@/components/LowFormDesign';
import { desformDetail } from '@/services/lowcode/desform';

const DesformDesign: React.FC = () => {
  const { formId } = useParams<{ formId: string }>();
  const [loading, setLoading] = useState(true);
  const [formDesignData, setFormDesignData] = useState<any>();
  const [isShow, setIsShow] = useState(false);

  // 加载表单设计数据
  React.useEffect(() => {
    const loadFormData = async () => {
      try {
        setLoading(true);
        const formIdNumber = parseInt(formId || '', 10);
        if (Number.isNaN(formIdNumber)) {
          message.error('表单ID无效');
          return;
        }
        const res = await desformDetail(formIdNumber, false);
        if (res?.success) {
          setFormDesignData(res.data);
          setIsShow(true);
        } else {
          message.error(res?.msg || '获取表单设计数据失败');
        }
      } catch (error) {
        message.error('加载表单设计数据失败');
        console.error('加载表单设计数据失败:', error);
      } finally {
        setLoading(false);
      }
    };

    loadFormData();
  }, [formId]);

  return (
    <PageContainer
      header={{
        title: '表单设计器',
        extra: [
          <Button key="back" onClick={() => window.history.back()}>
            返回列表
          </Button>,
        ],
      }}
    >
      <Card>
        <Spin spinning={loading} tip="加载中...">
          {isShow && formDesignData && (
            <LowFormDesign isShow={isShow} formDesignData={formDesignData} />
          )}
          {loading && (
            <div
              style={{
                height: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              加载表单设计器中...
            </div>
          )}
        </Spin>
      </Card>
    </PageContainer>
  );
};

export default DesformDesign;
