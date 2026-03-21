import { ArrowLeftOutlined } from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { history } from '@umijs/max';
import { Button, Card, message } from 'antd';
import React, { useState } from 'react';
import { productApi } from '@/services/mall';
import type { ProductFormData } from '@/services/mall/typings';
import ProductForm from './components/ProductForm';

const ProductAdd: React.FC = () => {
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (data: ProductFormData) => {
    try {
      setSubmitting(true);
      await productApi.create(data);
      message.success('商品创建成功');
      history.push('/mall/product');
    } catch (error: any) {
      message.error(error.message || '创建商品失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    history.push('/mall/product');
  };

  return (
    <PageContainer
      title="新增商品"
      breadcrumb={{
        items: [
          { name: '商品管理', path: '/mall/product' },
          { name: '新增商品' },
        ],
      }}
      extra={[
        <Button
          key="back"
          icon={<ArrowLeftOutlined />}
          onClick={handleCancel}
        >
          返回列表
        </Button>,
      ]}
    >
      <Card>
        <ProductForm
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          submitting={submitting}
          setSubmitting={setSubmitting}
          mode="add"
        />
      </Card>
    </PageContainer>
  );
};

export default ProductAdd;
