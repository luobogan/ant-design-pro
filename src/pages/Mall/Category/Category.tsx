import React, { useState, useEffect } from 'react';
import { PageContainer } from '@ant-design/pro-components';
import {
  Tree,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  TreeSelect,
  message,
  Card,
  Space,
  Popconfirm,
  Table,
  Select,
  Switch,
  Tag,
  Transfer,
  Row,
  Col,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  SettingOutlined,
  TagOutlined,
  BuildOutlined,
} from '@ant-design/icons';
import {
  categoryApi,
  brandApi,
  categoryAttributeApi,
  categoryBrandApi,
  categoryParamApi,
} from '@/services/mall';
import type {
  Category,
  Brand,
  CategoryAttribute,
  CategoryParamTemplate,
} from '@/services/mall/typings';
import EmojiPicker from '@/components/EmojiPicker';
import ImageUploader from '@/components/ImageUploader';

const { TextArea } = Input;
const { Option } = Select;

const attributeTypes = [
  { value: 1, label: '单选', color: 'blue' },
  { value: 2, label: '多选', color: 'green' },
  { value: 3, label: '文本输入', color: 'orange' },
  { value: 4, label: '数字输入', color: 'purple' },
  { value: 5, label: '日期', color: 'cyan' },
];

const CategoryList: React.FC = () => {
  const [treeData, setTreeData] = useState<any[]>([]);
  const [categoryTree, setCategoryTree] = useState<Category[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentCategory, setCurrentCategory] = useState<Category | null>(null);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const [attrModalVisible, setAttrModalVisible] = useState(false);
  const [currentCategoryForAttr, setCurrentCategoryForAttr] =
    useState<Category | null>(null);
  const [attributes, setAttributes] = useState<CategoryAttribute[]>([]);
  const [attrForm] = Form.useForm();
  const [editingAttrId, setEditingAttrId] = useState<number | null>(null);
  const [attrLoading, setAttrLoading] = useState(false);
  const [currentAttributeType, setCurrentAttributeType] = useState<number>(1);

  const [brandModalVisible, setBrandModalVisible] = useState(false);
  const [currentCategoryForBrand, setCurrentCategoryForBrand] =
    useState<Category | null>(null);
  const [allBrands, setAllBrands] = useState<Brand[]>([]);
  const [selectedBrandIds, setSelectedBrandIds] = useState<number[]>([]);
  const [brandLoading, setBrandLoading] = useState(false);

  const [paramModalVisible, setParamModalVisible] = useState(false);
  const [currentCategoryForParam, setCurrentCategoryForParam] =
    useState<Category | null>(null);
  const [params, setParams] = useState<CategoryParamTemplate[]>([]);
  const [paramForm] = Form.useForm();
  const [editingParamId, setEditingParamId] = useState<number | null>(null);
  const [paramLoading, setParamLoading] = useState(false);
  const [currentParamType, setCurrentParamType] = useState<number>(1);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const data = await categoryApi.getTree();
      const treeData = transformToTreeData(data);
      setCategoryTree(data);
      setTreeData(treeData);
    } catch (error: any) {
      message.error(error.message || '获取分类失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchBrands = async () => {
    try {
      const result = await brandApi.getList({ page: 1, pageSize: 1000 });
      setAllBrands(result.list || []);
    } catch (error: any) {
      message.error(error.message || '获取品牌失败');
    }
  };

  useEffect(() => {
    fetchCategories();
    fetchBrands();
  }, []);

  const transformToTreeData = (categories: Category[]): any[] => {
    return categories.map((cat) => ({
      key: cat.id,
      title: (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '100%',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {cat.icon && (
              <span style={{ fontSize: '18px', marginRight: '8px' }}>
                {cat.icon}
              </span>
            )}
            <span>{cat.name}</span>
          </div>
          <Space size="small">
            {!!cat.parentId && (
              <>
                <Button
                  type="link"
                  size="small"
                  icon={<SettingOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleManageAttributes(cat);
                  }}
                >
                  属性
                </Button>
                <Button
                  type="link"
                  size="small"
                  icon={<TagOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleManageBrands(cat);
                  }}
                >
                  品牌
                </Button>
                <Button
                  type="link"
                  size="small"
                  icon={<BuildOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleManageParams(cat);
                  }}
                >
                  参数
                </Button>
              </>
            )}
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                handleEdit(cat);
              }}
            >
              编辑
            </Button>
            <Button
              type="link"
              size="small"
              icon={<PlusOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                handleAddChild(cat);
              }}
            >
              添加子分类
            </Button>
            <Popconfirm
              title="确认删除"
              description="确定要删除该分类吗？"
              onConfirm={(e) => {
                e?.stopPropagation();
                handleDelete(cat.id);
              }}
              okText="确认"
              cancelText="取消"
            >
              <Button
                type="link"
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={(e) => e.stopPropagation()}
              >
                删除
              </Button>
            </Popconfirm>
          </Space>
        </div>
      ),
      children:
        cat.children && cat.children.length > 0
          ? transformToTreeData(cat.children)
          : undefined,
    }));
  };

  const transformToTreeSelectData = (categories: Category[]): any[] => {
    return categories.map((cat) => ({
      value: cat.id,
      title: (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {cat.icon && (
            <span style={{ fontSize: '16px', marginRight: '6px' }}>
              {cat.icon}
            </span>
          )}
          <span>{cat.name}</span>
        </div>
      ),
      children:
        cat.children && cat.children.length > 0
          ? transformToTreeSelectData(cat.children)
          : undefined,
    }));
  };

  const handleAdd = () => {
    setCurrentCategory(null);
    form.resetFields();
    form.setFieldsValue({ parentId: null, sort: 0 });
    setModalVisible(true);
  };

  const handleAddChild = (parent: Category) => {
    setCurrentCategory(null);
    form.resetFields();
    form.setFieldsValue({ parentId: parent.id, sort: 0 });
    setModalVisible(true);
  };

  const handleEdit = (category: Category) => {
    setCurrentCategory(category);
    form.setFieldsValue({
      name: category.name,
      description: category.description,
      icon: category.icon,
      banner: category.banner,
      parentId: category.parentId,
      sort: category.sort,
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await categoryApi.delete(id);
      message.success('删除成功');
      fetchCategories();
    } catch (error: any) {
      message.error(error.message || '删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (currentCategory) {
        await categoryApi.update(currentCategory.id, values);
        message.success('更新成功');
      } else {
        await categoryApi.create(values);
        message.success('创建成功');
      }
      setModalVisible(false);
      fetchCategories();
    } catch (error: any) {
      message.error(error.message || '操作失败');
    }
  };

  const handleManageAttributes = async (category: Category) => {
    setCurrentCategoryForAttr(category);
    setAttrModalVisible(true);
    setAttrLoading(true);
    try {
      const data = await categoryAttributeApi.getByCategoryId(category.id);
      setAttributes(data);
    } catch (error: any) {
      message.error(error.message || '获取属性失败');
    } finally {
      setAttrLoading(false);
    }
    attrForm.resetFields();
    setEditingAttrId(null);
  };

  const fetchAttributes = async (categoryId: number) => {
    setAttrLoading(true);
    try {
      const data = await categoryAttributeApi.getByCategoryId(categoryId);
      setAttributes(data);
    } catch (error: any) {
      message.error(error.message || '获取属性失败');
    } finally {
      setAttrLoading(false);
    }
  };

  const handleAddAttribute = () => {
    setEditingAttrId(null);
    setCurrentAttributeType(1);
    attrForm.resetFields();
    attrForm.setFieldsValue({ type: 1, isRequired: 0, isSearchable: 0, sortOrder: 0 });
  };

  const handleEditAttribute = (attr: any) => {
    setEditingAttrId(attr.id);
    setCurrentAttributeType(attr.type);

    const formValues = {
      name: attr.name,
      type: attr.type,
      isRequired: attr.isRequired === 1,
      isSearchable: attr.isSearchable === 1,
      sortOrder: attr.sortOrder || 0,
    };

    if (
      (attr.type === 1 || attr.type === 2) &&
      attr.values &&
      attr.values.length > 0
    ) {
      formValues.values = attr.values.map((val: any) => val.value).join('、');
    }

    attrForm.setFieldsValue(formValues);
  };

  const handleDeleteAttribute = async (id: number) => {
    if (!currentCategoryForAttr) return;

    try {
      await categoryAttributeApi.delete(id);
      message.success('属性删除成功');
      await fetchAttributes(currentCategoryForAttr.id);
    } catch (error: any) {
      message.error(error.message || '删除失败');
    }
  };

  const handleSaveAttribute = async () => {
    if (!currentCategoryForAttr) return;

    try {
      const values = await attrForm.validateFields();
      const attrData = {
        categoryId: currentCategoryForAttr.id,
        name: values.name,
        type: values.type,
        isRequired: values.isRequired ? 1 : 0,
        isSearchable: values.isSearchable ? 1 : 0,
        sortOrder: values.sortOrder || 0,
      };

      if (editingAttrId) {
        await categoryAttributeApi.update(editingAttrId, attrData);
        message.success('属性更新成功');
      } else {
        const savedAttr = await categoryAttributeApi.create(attrData);
        message.success('属性创建成功');

        if ((values.type === 1 || values.type === 2) && values.values) {
          const valueList = values.values.split('、').filter((v: string) => v.trim());
          if (valueList.length > 0) {
            const valueDataList = valueList.map(
              (value: string, index: number) => ({
                attributeId: savedAttr.id,
                value: value.trim(),
                sortOrder: index,
              }),
            );
            await categoryAttributeApi.batchAddValues(
              savedAttr.id,
              valueDataList,
            );
            message.success('属性值添加成功');
          }
        }
      }

      await fetchAttributes(currentCategoryForAttr.id);
      attrForm.resetFields();
      setEditingAttrId(null);
      setCurrentAttributeType(1);
    } catch (error: any) {
      message.error(error.message || '保存失败');
    }
  };

  const handleManageBrands = async (category: Category) => {
    setCurrentCategoryForBrand(category);
    setBrandModalVisible(true);
    setBrandLoading(true);
    try {
      const selectedBrands = await categoryBrandApi.getBrandsByCategoryId(
        category.id,
      );
      setSelectedBrandIds(selectedBrands.map((b) => b.id));
    } catch (error: any) {
      message.error(error.message || '获取品牌列表失败');
    } finally {
      setBrandLoading(false);
    }
  };

  const handleSaveBrands = async () => {
    if (!currentCategoryForBrand) return;
    setBrandLoading(true);
    try {
      await categoryBrandApi.saveCategoryBrands(
        currentCategoryForBrand.id,
        selectedBrandIds,
      );
      message.success('品牌关联保存成功');
      setBrandModalVisible(false);
    } catch (error: any) {
      message.error(error.message || '保存失败');
    } finally {
      setBrandLoading(false);
    }
  };

  const handleManageParams = async (category: Category) => {
    setCurrentCategoryForParam(category);
    setParamModalVisible(true);
    setParamLoading(true);
    try {
      const data = await categoryParamApi.getParamsByCategoryId(category.id);
      setParams(data);
    } catch (error: any) {
      message.error(error.message || '获取参数列表失败');
      setParams([]);
    } finally {
      setParamLoading(false);
    }
    paramForm.resetFields();
    setEditingParamId(null);
  };

  const fetchParams = async (categoryId: number) => {
    setParamLoading(true);
    try {
      const data = await categoryParamApi.getParamsByCategoryId(categoryId);
      setParams(data);
    } catch (error: any) {
      message.error(error.message || '获取参数列表失败');
    } finally {
      setParamLoading(false);
    }
  };

  const handleAddParam = () => {
    setEditingParamId(null);
    setCurrentParamType(1);
    paramForm.resetFields();
    paramForm.setFieldsValue({ type: 1, isRequired: 0, isSearchable: 0, sortOrder: 0 });
  };

  const handleEditParam = (param: CategoryParamTemplate) => {
    setEditingParamId(param.id);
    setCurrentParamType(param.type);
    paramForm.setFieldsValue({
      name: param.name,
      type: param.type,
      value: param.value,
      isRequired: param.isRequired === 1,
      isSearchable: param.isSearchable === 1,
      sortOrder: param.sortOrder,
    });
  };

  const handleDeleteParam = async (id: number) => {
    if (!currentCategoryForParam) return;
    setParamLoading(true);
    try {
      await categoryParamApi.deleteParam(id);
      message.success('参数删除成功');
      await fetchParams(currentCategoryForParam.id);
    } catch (error: any) {
      message.error(error.message || '删除失败');
    } finally {
      setParamLoading(false);
    }
  };

  const handleSaveParam = async () => {
    if (!currentCategoryForParam) return;
    try {
      const values = await paramForm.validateFields();
      const paramData = {
        categoryId: currentCategoryForParam.id,
        name: values.name,
        type: values.type,
        value: values.value,
        isRequired: values.isRequired ? 1 : 0,
        isSearchable: values.isSearchable ? 1 : 0,
        sortOrder: values.sortOrder || 0,
      };

      if (editingParamId) {
        await categoryParamApi.updateParam(editingParamId, paramData);
        message.success('参数更新成功');
      } else {
        await categoryParamApi.createParam(paramData);
        message.success('参数创建成功');
      }

      await fetchParams(currentCategoryForParam.id);
      paramForm.resetFields();
      setEditingParamId(null);
      setCurrentParamType(1);
    } catch (error: any) {
      message.error(error.message || '保存失败');
    }
  };

  return (
    <PageContainer>
      <Card
        title="商品分类"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchCategories}>
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
              新增一级分类
            </Button>
          </Space>
        }
      >
        <Tree
          treeData={treeData}
          showLine
          defaultExpandAll
          blockNode
          style={{ background: '#fff' }}
        />
      </Card>

      <Modal
        title={currentCategory ? '编辑分类' : '新增分类'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="分类名称"
            name="name"
            rules={[{ required: true, message: '请输入分类名称' }]}
          >
            <Input placeholder="请输入分类名称" />
          </Form.Item>

          <Form.Item label="父级分类" name="parentId">
            <TreeSelect
              placeholder="请选择父级分类（不选则为一级分类）"
              treeData={transformToTreeSelectData(categoryTree)}
              treeDefaultExpandAll
              allowClear
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item
            label="排序"
            name="sort"
            rules={[{ required: true, message: '请输入排序' }]}
          >
            <InputNumber
              min={0}
              style={{ width: '100%' }}
              placeholder="请输入排序"
            />
          </Form.Item>

          <Form.Item label="分类图标" name="icon">
            <EmojiPicker placeholder="选择分类图标" />
          </Form.Item>

          <ImageUploader
            name="banner"
            label="分类图片"
            value={form.getFieldValue('banner')}
            onChange={(value) => form.setFieldsValue({ banner: value })}
            maxCount={1}
            accept=".jpg,.jpeg,.png"
            maxSize={2}
            supportDrag={true}
            showPreview={true}
            showProgress={true}
            height={120}
          />

          <Form.Item label="分类描述" name="description">
            <TextArea rows={4} placeholder="请输入分类描述" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`属性管理 - ${currentCategoryForAttr?.name}`}
        open={attrModalVisible}
        onCancel={() => setAttrModalVisible(false)}
        width={900}
        footer={null}
      >
        <Row gutter={16}>
          <Col span={10}>
            <Card
              title={editingAttrId ? '编辑属性' : '添加属性'}
              size="small"
              style={{ marginBottom: 16 }}
            >
              <Form form={attrForm} layout="vertical">
                <Form.Item
                  label="属性名称"
                  name="name"
                  rules={[{ required: true, message: '请输入属性名称' }]}
                >
                  <Input placeholder="如：颜色、尺寸" />
                </Form.Item>

                <Form.Item
                  label="属性类型"
                  name="type"
                  rules={[{ required: true }]}
                  initialValue={1}
                >
                  <Select
                    placeholder="请选择属性类型"
                    onChange={(value) => setCurrentAttributeType(value)}
                  >
                    {attributeTypes.map((type) => (
                      <Option key={type.value} value={type.value}>
                        <Tag color={type.color}>{type.label}</Tag>
                      </Option>
                    ))}
                  </Select>
                </Form.Item>

                {(currentAttributeType === 1 || currentAttributeType === 2) && (
                  <Form.Item label="属性选项值" name="values" required={false}>
                    <TextArea
                      rows={3}
                      placeholder="多个选项值用顿号分隔，如：红色、蓝色、绿色"
                      help="仅单选和多选类型需要填写选项值"
                    />
                  </Form.Item>
                )}

                <Form.Item
                  label="是否必填"
                  name="isRequired"
                  valuePropName="checked"
                >
                  <Switch />
                </Form.Item>

                <Form.Item
                  label="是否可搜索"
                  name="isSearchable"
                  valuePropName="checked"
                >
                  <Switch />
                </Form.Item>

                <Form.Item label="排序" name="sortOrder">
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>

                <Space>
                  <Button type="primary" onClick={handleSaveAttribute}>
                    {editingAttrId ? '更新' : '添加'}
                  </Button>
                  {editingAttrId && (
                    <Button onClick={handleAddAttribute}>取消编辑</Button>
                  )}
                </Space>
              </Form>
            </Card>
          </Col>

          <Col span={14}>
            <Card title="属性列表" size="small">
              <Table
                dataSource={attributes}
                rowKey="id"
                size="small"
                pagination={false}
                loading={attrLoading}
                columns={[
                  { title: '属性名', dataIndex: 'name', width: 100 },
                  {
                    title: '类型',
                    dataIndex: 'type',
                    width: 80,
                    render: (type: number) => {
                      const typeInfo = attributeTypes.find(
                        (t) => t.value === type,
                      );
                      return <Tag color={typeInfo?.color}>{typeInfo?.label}</Tag>;
                    },
                  },
                  {
                    title: '必填',
                    dataIndex: 'isRequired',
                    width: 60,
                    render: (v: number) =>
                      v === 1 ? (
                        <Tag color="red">是</Tag>
                      ) : (
                        <Tag>否</Tag>
                      ),
                  },
                  {
                    title: '可搜索',
                    dataIndex: 'isSearchable',
                    width: 70,
                    render: (v: number) =>
                      v === 1 ? (
                        <Tag color="green">是</Tag>
                      ) : (
                        <Tag>否</Tag>
                      ),
                  },
                  {
                    title: '操作',
                    key: 'action',
                    width: 120,
                    render: (_, record) => (
                      <Space size="small">
                        <Button
                          type="link"
                          size="small"
                          onClick={() => handleEditAttribute(record)}
                        >
                          编辑
                        </Button>
                        <Popconfirm
                          title="确认删除"
                          onConfirm={() => handleDeleteAttribute(record.id)}
                        >
                          <Button type="link" size="small" danger>
                            删除
                          </Button>
                        </Popconfirm>
                      </Space>
                    ),
                  },
                ]}
              />
            </Card>
          </Col>
        </Row>
      </Modal>

      <Modal
        title={`品牌关联 - ${currentCategoryForBrand?.name}`}
        open={brandModalVisible}
        onOk={handleSaveBrands}
        onCancel={() => setBrandModalVisible(false)}
        width={700}
        confirmLoading={brandLoading}
      >
        <Transfer
          dataSource={allBrands.map((b) => ({
            key: b.id,
            title: b.name,
            description: b.description || '',
          }))}
          titles={['可选品牌', '已选品牌']}
          targetKeys={selectedBrandIds}
          onChange={(targetKeys) =>
            setSelectedBrandIds(targetKeys as number[])
          }
          render={(item) => item.title}
          listStyle={{ width: 300, height: 400 }}
          loading={brandLoading}
        />
      </Modal>

      <Modal
        title={`参数模板 - ${currentCategoryForParam?.name}`}
        open={paramModalVisible}
        onCancel={() => setParamModalVisible(false)}
        width={900}
        footer={null}
      >
        <Row gutter={16}>
          <Col span={10}>
            <Card
              title={editingParamId ? '编辑参数' : '添加参数'}
              size="small"
              style={{ marginBottom: 16 }}
              loading={paramLoading}
              extra={
                currentCategoryForParam ? (
                  <Button
                    type="link"
                    size="small"
                    icon={<ReloadOutlined />}
                    onClick={() => fetchParams(currentCategoryForParam.id)}
                  >
                    刷新
                  </Button>
                ) : null
              }
            >
              <Form form={paramForm} layout="vertical">
                <Form.Item
                  label="参数名称"
                  name="name"
                  rules={[{ required: true, message: '请输入参数名称' }]}
                >
                  <Input placeholder="如：材质、产地" />
                </Form.Item>

                <Form.Item
                  label="参数类型"
                  name="type"
                  rules={[{ required: true }]}
                  initialValue={1}
                >
                  <Select
                    placeholder="请选择参数类型"
                    onChange={(value) => setCurrentParamType(value)}
                  >
                    <Option value={1}>
                      <Tag color="blue">单选</Tag>
                    </Option>
                    <Option value={2}>
                      <Tag color="green">多选</Tag>
                    </Option>
                  </Select>
                </Form.Item>

                <Form.Item
                  label="参数选项值"
                  name="value"
                  rules={[{ required: true, message: '请输入参数值' }]}
                >
                  <TextArea
                    rows={3}
                    placeholder="多个选项值用顿号分隔，如：红色、蓝色、绿色"
                  />
                </Form.Item>

                <Form.Item
                  label="是否必填"
                  name="isRequired"
                  valuePropName="checked"
                >
                  <Switch />
                </Form.Item>

                <Form.Item
                  label="是否可搜索"
                  name="isSearchable"
                  valuePropName="checked"
                >
                  <Switch />
                </Form.Item>

                <Form.Item label="排序" name="sortOrder">
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>

                <Space>
                  <Button
                    type="primary"
                    onClick={handleSaveParam}
                    loading={paramLoading}
                  >
                    {editingParamId ? '更新' : '添加'}
                  </Button>
                  {editingParamId && (
                    <Button onClick={handleAddParam} disabled={paramLoading}>
                      取消编辑
                    </Button>
                  )}
                </Space>
              </Form>
            </Card>
          </Col>

          <Col span={14}>
            <Card
              title="参数列表"
              size="small"
              extra={
                currentCategoryForParam ? (
                  <Button
                    type="link"
                    size="small"
                    onClick={() => {
                      const sourceCategoryId = currentCategoryForParam.id;
                      Modal.confirm({
                        title: '复制参数模板',
                        content: (
                          <Form layout="vertical">
                            <Form.Item label="目标分类">
                              <TreeSelect
                                placeholder="请选择目标分类"
                                treeData={transformToTreeSelectData(categoryTree)}
                                treeDefaultExpandAll
                                allowClear
                                style={{ width: '100%' }}
                                onChange={(value) => {
                                  if (value) {
                                    categoryParamApi
                                      .copyParamsToCategory(sourceCategoryId, value)
                                      .then(() => {
                                        message.success('复制成功');
                                      })
                                      .catch((error) => {
                                        message.error(
                                          error.message || '复制失败',
                                        );
                                      });
                                  }
                                }}
                              />
                            </Form.Item>
                          </Form>
                        ),
                        okText: '取消',
                        cancelText: '关闭',
                        footer: [
                          <Button key="close" onClick={() => Modal.destroyAll()}>
                            关闭
                          </Button>,
                        ],
                      });
                    }}
                  >
                    复制到其他分类
                  </Button>
                ) : null
              }
            >
              <Table
                dataSource={params}
                rowKey="id"
                size="small"
                pagination={false}
                loading={paramLoading}
                locale={{
                  emptyText:
                    params.length === 0 && !paramLoading
                      ? '暂无参数，请添加'
                      : '加载中...',
                }}
                columns={[
                  { title: '参数名', dataIndex: 'name', width: 100 },
                  {
                    title: '类型',
                    dataIndex: 'type',
                    width: 80,
                    render: (type: number) => {
                      return type === 1 ? (
                        <Tag color="blue">单选</Tag>
                      ) : (
                        <Tag color="green">多选</Tag>
                      );
                    },
                  },
                  {
                    title: '必填',
                    dataIndex: 'isRequired',
                    width: 60,
                    render: (v: number) =>
                      v === 1 ? (
                        <Tag color="red">是</Tag>
                      ) : (
                        <Tag>否</Tag>
                      ),
                  },
                  {
                    title: '可搜索',
                    dataIndex: 'isSearchable',
                    width: 70,
                    render: (v: number) =>
                      v === 1 ? (
                        <Tag color="green">是</Tag>
                      ) : (
                        <Tag>否</Tag>
                      ),
                  },
                  { title: '参数值', dataIndex: 'value', ellipsis: true },
                  { title: '排序', dataIndex: 'sortOrder', width: 60 },
                  {
                    title: '操作',
                    key: 'action',
                    width: 120,
                    render: (_, record) => (
                      <Space size="small">
                        <Button
                          type="link"
                          size="small"
                          onClick={() => handleEditParam(record)}
                          disabled={paramLoading}
                        >
                          编辑
                        </Button>
                        <Popconfirm
                          title="确认删除"
                          onConfirm={() => handleDeleteParam(record.id)}
                          disabled={paramLoading}
                        >
                          <Button
                            type="link"
                            size="small"
                            danger
                            disabled={paramLoading}
                          >
                            删除
                          </Button>
                        </Popconfirm>
                      </Space>
                    ),
                  },
                ]}
              />
            </Card>
          </Col>
        </Row>
      </Modal>
    </PageContainer>
  );
};

export default CategoryList;
