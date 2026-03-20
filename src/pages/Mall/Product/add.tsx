import { useNavigate } from '@umijs/max';
import { Card, message } from 'antd';
import React, { useState } from 'react';
import { productApi } from '@/services/mall/product';
import type { ProductFormData } from '@/services/mall/typings';
import ProductForm from './ProductForm';

/**
 * 商品添加向导页面
 */
const ProductAddWizardPage: React.FC = () => {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [visible, setVisible] = useState(true);

  // 提交商品
  const handleSubmit = async (data: ProductFormData) => {
    setSubmitting(true);
    try {
      await productApi.create(data);
      message.success('商品创建成功');
      setVisible(false);
      // 跳转到商品列表页面
      navigate('/mall/products');
    } catch (error: any) {
      message.error(error.message || '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    setVisible(false);
    // 跳转到商品列表页面
    navigate('/mall/products');
  };

  if (!visible) {
    return null;
  }

  return (
    <div style={{ padding: '24px' }}>
      <Card title="添加商品">
        <ProductForm
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          submitting={submitting}
          setSubmitting={setSubmitting}
        />
      </Card>
    </div>
  );
};

export default ProductAddWizardPage;
