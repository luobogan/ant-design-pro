import { ArrowLeftOutlined, LoadingOutlined } from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { history, useSearchParams } from '@umijs/max';
import { Button, Card, Form, Input, InputNumber, message, TreeSelect, Spin } from 'antd';
import React, { useEffect, useState } from 'react';
import * as deptApi from '@/services/system/dept';
const { TextArea } = Input;

interface DeptFormData {
  id?: string;
name: string;
  code: string;
  parentId: string;
sort: number;
  status: string;
  remark?: string;
}

interface DeptData {
  id: string;
  deptName: string;
  code: string;
  parentId: string;
  parentName: string;
  sort: number;
status: string;
  remark: string;
}

const DeptAae: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [form] = Form.useForm<DeptFormData>();
  
  const mode = searchParams.get('mode') || 'add';
  const deptId = searchParams.get('id');
  
  const [dept, setDept] = useState<DeptData | undefined>(undefined);
  const [loading, setLoading] = useState(false);
const [submitting, setSubmitting] = useState(false);
  const [parentTreeData, setParentTreeData] = useState<any[]>([]);
  
  const isEditMode = mode === 'edit' && deptId;
  
  useEffect(() => {
    loadParentDepts();
    if (isEditMode && deptId) {
      loadDeptData(deptId);
    }
  }, [deptId, isEditMode]);
  
  const loadParentDepts = async () => {
    try {
      const data = await deptApi.list({});
      const records = Array.isArray(data) ? data : data?.records || data?.data || [];

      const deptMap = new Map<string, any>();
      const rootNodes: any[] = [];

      records.forEach((dept: any) => {
        deptMap.set(String(dept.id), {
          value: String(dept.id),
          title: dept.deptName || dept.name || dept.id,
          children: [],
        });
      });

      deptMap.forEach((dept, id) => {
        const parentId = records.find((r: any) => String(r.id) === id)?.parentId;
        if (!parentId || parentId === '0' || !deptMap.has(String(parentId))) {
          rootNodes.push(dept);
        } else {
          const parent = deptMap.get(String(parentId));
          if (parent) {
            parent.children.push(dept);
          }
        }
      });

      const removeEmptyChildren = (nodes: any[]): any[] => {
        return nodes.map(node => {
          if (node.children && node.children.length > 0) {
            return {
              ...node,
              children: removeEmptyChildren(node.children),
            };
          }
          const { children, ...rest } = node;
          return rest;
        });
      };

      setParentTreeData([{
        value: '0',
        title: '无',
        children: removeEmptyChildren(rootNodes),
      }]);
    } catch (error) {
      console.error('获取部门列表失败:', error);
    }
  };
  
  const loadDeptData = async (id: string) => {
    setLoading(true);
    try {
      const data = await deptApi.getById(id);
      setDept(data);
      form.setFieldsValue({
        id: data.id,
        name: data.deptName || data.name,
        code: data.code,
        parentId: String(data.parentId || '0'),
        sort: data.sort || 0,
        status: data.status || '启用',
        remark: data.remark,
    });
    } catch (error: any) {
      message.error(error.message || '获取部门数据失败');
      history.push('/system/dept');
  } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values: DeptFormData) => {
    try {
      setSubmitting(true);
      const submitData = {
        ...values,
        deptName: values.name,
    };
      delete submitData.name;
      
      if (isEditMode && deptId) {
        await deptApi.submit({ ...submitData, id: deptId });
        message.success('部门更新成功');
      } else {
        await deptApi.submit(submitData);
        message.success('部门创建成功');
      }
      history.push('/system/dept');
    } catch (error: any) {
      message.error(error.message || (isEditMode ? '更新部门失败' : '创建部门失败'));
  } finally {
      setSubmitting(false);
    }
  };
  
  const handleCancel = () => {
    history.push('/system/dept');
  };
  
  const getPageTitle = () => {
    return isEditMode ? '编辑部门' : '新增部门';
  };
  
  const getBreadcrumb = () => {
    return [
      { name: '部门管理', path: '/system/dept' },
      { name: getPageTitle() },
    ];
  };
  
  if (loading) {
    return (
      <PageContainer>
        <Card>
          <div style={{ textAlign: 'center', padding: '100px 0' }}>
            <Spin indicator={<LoadingOutlined style={{ fontSize: 48 }} spin />} />
            <p style={{ marginTop: 16, color: '#666' }}>正在加载部门数据...</p>
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
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          style={{ maxWidth: 600 }}
        >
          <Form.Item<DeptFormData>
            name="id"
            hidden
          >
            <Input />
          </Form.Item>
          
          <Form.Item<DeptFormData>
            name="name"
            label="部门名称"
            rules={[{ required: true, message: '请输入部门名称' }]}
          >
            <Input placeholder="请输入部门名称" />
          </Form.Item>
          
          <Form.Item<DeptFormData>
            name="code"
            label="部门编码"
            rules={[{ required: true, message: '请输入部门编码' }]}
          >
            <Input placeholder="请输入部门编码" />
          </Form.Item>
          
          <Form.Item<DeptFormData>
            name="parentId"
            label="上级部门"
          >
            <TreeSelect
              placeholder="请选择上级部门"
              treeData={parentTreeData}
              treeDefaultExpandAll
            />
          </Form.Item>
          
          <Form.Item<DeptFormData>
            name="sort"
            label="排序"
            rules={[{ required: true, message: '请输入排序' }]}
          >
            <InputNumber placeholder="请输入排序" min={1} />
          </Form.Item>
          
          <Form.Item<DeptFormData>
            name="status"
            label="状态"
            rules={[{ required: true, message: '请选择状态' }]}
          >
            <Select placeholder="请选择状态">
              <Option value="启用">启用</Option>
              <Option value="禁用">禁用</Option>
            </Select>
          </Form.Item>
          
          <Form.Item<DeptFormData>
            name="remark"
            label="备注"
          >
            <TextArea rows={3} placeholder="请输入备注" />
          </Form.Item>
          
          <Form.Item>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'flex-end' }}>
              <Button onClick={handleCancel}>
                取消
              </Button>
              <Button type="primary" htmlType="submit" loading={submitting}>
                {isEditMode ? '保存修改' : '创建部门'}
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Card>
    </PageContainer>
  );
};

export default DeptAae;
