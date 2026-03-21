import { ArrowLeftOutlined, LoadingOutlined } from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { history, useLocation, useSearchParams } from '@umijs/max';
import { Button, Card, message, Spin } from 'antd';
import React, { useEffect, useState } from 'react';
import { productApi } from '@/services/mall';
import type { Product, ProductFormData } from '@/services/mall/typings';
import ProductForm from './components/ProductForm';

const ProductAae: React.FC = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  
  const mode = searchParams.get('mode') || 'add';
  const productId = searchParams.get('id');
  
  const [product, setProduct] = useState<Product | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const isEditMode = mode === 'edit' && productId;
  
  useEffect(() => {
    if (isEditMode && productId) {
      loadProductData(Number(productId));
    }
  }, [productId, isEditMode]);
  
  const loadProductData = async (id: number) => {
    setLoading(true);
    try {
      const data = await productApi.getById(id);
      setProduct(data);
    } catch (error: any) {
      message.error(error.message || '获取商品数据失败');
      history.push('/mall/product');
    } finally {
      setLoading(false);
    }
  };
  
  const handleSubmit = async (data: ProductFormData) => {
    try {
      setSubmitting(true);
      if (isEditMode && productId) {
        await productApi.update(Number(productId), data);
        message.success('商品更新成功');
      } else {
        await productApi.create(data);
        message.success('商品创建成功');
      }
      history.push('/mall/product');
    } catch (error: any) {
      message.error(error.message || (isEditMode ? '更新商品失败' : '创建商品失败'));
    } finally {
      setSubmitting(false);
    }
  };
  
  const handleCancel = () => {
    history.push('/mall/product');
  };
  
  const getPageTitle = () => {
    return isEditMode ? '编辑商品' : '新增商品';
  };
  
  const getBreadcrumb = () => {
    return [
      { name: '商品管理', path: '/mall/product' },
      { name: getPageTitle() },
    ];
  };
  
  if (loading) {
    return (
      <PageContainer>
        <Card>
          <div style={{ textAlign: 'center', padding: '100px 0' }}>
            <Spin indicator={<LoadingOutlined style={{ fontSize: 48 }} spin />} />
            <p style={{ marginTop: 16, color: '#666' }}>正在加载商品数据...</p>
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
      ]}
    >
      <Card>
        <ProductForm
          product={product}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          submitting={submitting}
          setSubmitting={setSubmitting}
          mode={isEditMode ? 'edit' : 'add'}
        />
      </Card>
    </PageContainer>
  );
};

export default ProductAae;
