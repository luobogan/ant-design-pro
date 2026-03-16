// 导入 Designable 相关组件
import { DesignableEditor } from '@designable/react';
import { createForm } from '@formily/core';
import {
  Form as AntForm,
  Button,
  Card,
  Cascader,
  Checkbox,
  DatePicker,
  Empty,
  Input,
  Layout,
  Modal,
  Radio,
  Rate,
  Select,
  Slider,
  Switch,
  Tabs,
  Tooltip,
  TreeSelect,
  Upload,
} from 'antd';
import React, { useEffect, useState } from 'react';
import { desformSave, desformUpdate } from '@/services/lowcode/desform';
import PageGenerator from './PageGenerator';

// 移除未使用的 Form 解构变量

const { Header, Sider, Content, Footer } = Layout;

interface LowFormDesignProps {
  isShow: boolean;
  formDesignData?: any;
}

const LowFormDesign: React.FC<LowFormDesignProps> = ({
  isShow,
  formDesignData,
}) => {
  const [form, setForm] = useState<any>();
  const [components, setComponents] = useState<any[]>([]);
  const [selectedComponent, setSelectedComponent] = useState<number | null>(
    null,
  );
  const [previewVisible, setPreviewVisible] = useState(false);
  const [pageGeneratorVisible, setPageGeneratorVisible] = useState(false);
  const [previewForm] = AntForm.useForm();

  useEffect(() => {
    if (isShow) {
      // 创建Formily表单实例
      const newForm = createForm();
      setForm(newForm);

      // 初始化组件列表
      setComponents(formDesignData?.components || []);
    }
  }, [isShow, formDesignData]);

  if (!isShow || !form) return null;

  const handleSave = async () => {
    try {
      // 获取设计器配置
      const formData = {
        id: formDesignData?.id,
        desformName: formDesignData?.desformName || '新表单',
        desformJson: JSON.stringify({
          components: components,
          formName: formDesignData?.desformName || '新表单',
        }),
        isOpen: formDesignData?.isOpen || '0',
        isTemplate: formDesignData?.isTemplate || '0',
      };

      console.log('保存表单设计:', formData);

      // 调用API保存到后端
      let response;
      if (formDesignData?.id) {
        // 更新已有表单
        response = await desformUpdate(formData);
      } else {
        // 保存新表单
        response = await desformSave(formData);
      }

      if (response?.success) {
        Modal.success({
          title: '保存成功',
          content: '表单设计已成功保存',
        });
      } else {
        throw new Error(response?.msg || '保存失败');
      }
    } catch (error: any) {
      console.error('保存表单设计失败:', error);
      Modal.error({
        title: '保存失败',
        content: error.message || '保存表单设计时发生错误',
      });
    }
  };

  // 添加组件的函数
  const insertComponent = (component: string, props: any) => {
    const newComponent = {
      component,
      props: {
        ...props,
        name: `${props.name}_${Date.now()}`, // 确保名称唯一
      },
    };
    setComponents([...components, newComponent]);
  };

  // 组件库定义（分类展示）
  const componentCategories = [
    {
      id: 'basic',
      name: '基础组件',
      icon: null,
      components: [
        {
          name: '输入框',
          component: 'Input',
          props: {
            title: '输入框',
            name: 'input',
          },
        },
        {
          name: '选择器',
          component: 'Select',
          props: {
            title: '选择器',
            name: 'select',
            dataSource: [
              { label: '选项1', value: '1' },
              { label: '选项2', value: '2' },
            ],
          },
        },
        {
          name: '日期选择器',
          component: 'DatePicker',
          props: {
            title: '日期选择器',
            name: 'date',
          },
        },
        {
          name: '复选框',
          component: 'Checkbox.Group',
          props: {
            title: '复选框',
            name: 'checkbox',
            options: [
              { label: '选项1', value: '1' },
              { label: '选项2', value: '2' },
            ],
          },
        },
        {
          name: '单选框',
          component: 'Radio.Group',
          props: {
            title: '单选框',
            name: 'radio',
            options: [
              { label: '选项1', value: '1' },
              { label: '选项2', value: '2' },
            ],
          },
        },
        {
          name: '开关',
          component: 'Switch',
          props: {
            title: '开关',
            name: 'switch',
          },
        },
        {
          name: '滑块',
          component: 'Slider',
          props: {
            title: '滑块',
            name: 'slider',
          },
        },
      ],
    },
    {
      id: 'advanced',
      name: '高级组件',
      icon: null,
      components: [
        {
          name: '级联选择',
          component: 'Cascader',
          props: {
            title: '级联选择',
            name: 'cascader',
          },
        },
        {
          name: '树形选择',
          component: 'TreeSelect',
          props: {
            title: '树形选择',
            name: 'treeSelect',
          },
        },
        {
          name: '文件上传',
          component: 'Upload',
          props: {
            title: '文件上传',
            name: 'upload',
          },
        },
        {
          name: '评分',
          component: 'Rate',
          props: {
            title: '评分',
            name: 'rate',
          },
        },
      ],
    },
  ];

  return (
    <div className="low-form-design" style={{ height: '800px' }}>
      <Card title="表单设计器" bordered={false} style={{ height: '100%' }}>
        {/* 顶部工具栏 */}
        <div
          style={{
            padding: '12px 24px',
            backgroundColor: '#f5f5f5',
            borderBottom: '1px solid #e8e8e8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, color: '#666' }}>文件</span>
            <span style={{ fontSize: 14, color: '#666' }}>编辑</span>
            <span style={{ fontSize: 14, color: '#666' }}>视图</span>
            <span style={{ fontSize: 14, color: '#666' }}>帮助</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Button size="small">保存</Button>
            <Button size="small">预览</Button>
            <Button size="small">生成代码</Button>
            <Button size="small">导入</Button>
            <Button size="small">导出</Button>
          </div>
        </div>
        <Layout style={{ height: 'calc(100% - 100px)' }}>
          {/* 左侧工具栏 */}
          <Sider
            width={240}
            style={{
              backgroundColor: '#f5f5f5',
              padding: 16,
              overflow: 'auto',
            }}
          >
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  margin: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 16,
                  fontWeight: 'bold',
                }}
              >
                组件库
              </div>
            </div>

            <Tabs defaultActiveKey="basic" size="small">
              {componentCategories.map((category) => (
                <Tabs.TabPane
                  key={category.id}
                  tab={
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      {category.name}
                    </div>
                  }
                >
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr',
                      gap: 6,
                      marginTop: 12,
                    }}
                  >
                    {category.components.map((item: any, index: number) => (
                      <Tooltip key={index} title={item.name}>
                        <div
                          className="component-card"
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData('component', item.component);
                            e.dataTransfer.setData(
                              'props',
                              JSON.stringify(item.props),
                            );
                          }}
                          onClick={() => {
                            insertComponent(item.component, item.props);
                          }}
                          style={{
                            padding: 12,
                            backgroundColor: '#fff',
                            borderRadius: 6,
                            border: '1px solid #e8e8e8',
                            cursor: 'pointer',
                            transition: 'all 0.3s',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = '#1890ff';
                            e.currentTarget.style.backgroundColor = '#f6faff';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = '#e8e8e8';
                            e.currentTarget.style.backgroundColor = '#fff';
                          }}
                        >
                          <div
                            style={{
                              width: 32,
                              height: 32,
                              backgroundColor: '#f0f0f0',
                              borderRadius: 4,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <span style={{ fontSize: 16 }}>
                              {item.name.charAt(0)}
                            </span>
                          </div>
                          <div
                            className="component-card-name"
                            style={{ fontSize: 14, color: '#333' }}
                          >
                            {item.name}
                          </div>
                        </div>
                      </Tooltip>
                    ))}
                  </div>
                </Tabs.TabPane>
              ))}
            </Tabs>
          </Sider>

          {/* 中间设计区域 - 使用 DesignableEditor */}
          <Content
            style={{
              padding: 0,
              backgroundColor: '#f0f0f0',
              position: 'relative',
            }}
          >
            {/* 设计区域头部 */}
            <div
              style={{
                backgroundColor: '#fff',
                padding: '12px 24px',
                borderBottom: '1px solid #e8e8e8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ margin: 0, fontSize: 16, fontWeight: 'bold' }}>
                  设计区域
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, color: '#666' }}>响应式</span>
                  <span style={{ fontSize: 14, color: '#666' }}>网格</span>
                  <span style={{ fontSize: 14, color: '#666' }}>辅助线</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Button
                  type="text"
                  size="small"
                  onClick={() => setComponents([])}
                >
                  清空
                </Button>
                <Button
                  type="text"
                  size="small"
                  onClick={() => setPreviewVisible(true)}
                >
                  预览
                </Button>
                <Button
                  type="text"
                  size="small"
                  onClick={() => setPageGeneratorVisible(true)}
                >
                  生成页面
                </Button>
              </div>
            </div>

            {/* 使用 DesignableEditor 替换自定义设计区域 */}
            <div
              style={{
                minHeight: 600,
                padding: 24,
                position: 'relative',
              }}
            >
              <DesignableEditor
                onSave={(schema) => {
                  console.log('保存设计:', schema);
                  // 更新组件状态
                  setComponents(schema.properties || []);
                  handleSave();
                }}
                onPreview={() => {
                  console.log('预览设计');
                  setPreviewVisible(true);
                }}
                initialSchema={{
                  type: 'object',
                  properties: {
                    ...components.reduce((acc, comp) => {
                      acc[comp.props.name] = {
                        type: 'string',
                        title: comp.props.title,
                        required: comp.props.required,
                      };
                      return acc;
                    }, {}),
                  },
                }}
                style={{
                  width: '100%',
                  height: '100%',
                  minHeight: 600,
                  backgroundColor: '#fff',
                  borderRadius: 8,
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                  overflow: 'hidden',
                }}
              />
            </div>
          </Content>

          {/* 右侧属性面板 */}
          <Sider
            width={360}
            style={{ backgroundColor: '#f5f5f5', padding: 0, overflow: 'auto' }}
          >
            {/* 属性面板头部 */}
            <div
              style={{
                backgroundColor: '#fff',
                padding: '16px 20px',
                borderBottom: '1px solid #e8e8e8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ margin: 0, fontSize: 16, fontWeight: 'bold' }}>
                属性配置
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Button
                  size="small"
                  type="text"
                  style={{ color: '#666' }}
                  onClick={() => {
                    // 复制组件
                    if (selectedComponent !== null) {
                      const comp = components[selectedComponent];
                      if (comp) {
                        const newComp = JSON.parse(JSON.stringify(comp));
                        newComp.props.name = `${newComp.props.name}_copy_${Date.now()}`;
                        const newComponents = [...components];
                        newComponents.push(newComp);
                        setComponents(newComponents);
                        setSelectedComponent(newComponents.length - 1);
                      }
                    }
                  }}
                >
                  复制
                </Button>
                <Button
                  size="small"
                  danger
                  type="text"
                  onClick={() => {
                    // 删除组件
                    if (selectedComponent !== null) {
                      const newComponents = [...components];
                      newComponents.splice(selectedComponent, 1);
                      setComponents(newComponents);
                      setSelectedComponent(null);
                    }
                  }}
                >
                  删除
                </Button>
              </div>
            </div>

            <div style={{ padding: 20 }}>
              {selectedComponent === null ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '80px 20px',
                    color: '#999',
                  }}
                >
                  <Empty description={<p>选择组件后可配置属性</p>} />
                </div>
              ) : (
                <div className="property-panel">
                  {(() => {
                    const comp = components[selectedComponent];
                    if (!comp) return null;

                    return (
                      <div>
                        {/* 组件信息 */}
                        <div
                          style={{
                            marginBottom: 24,
                            padding: 16,
                            backgroundColor: '#fafafa',
                            borderRadius: 6,
                            border: '1px solid #e8e8e8',
                          }}
                        >
                          <div
                            style={{
                              fontSize: 12,
                              color: '#999',
                              marginBottom: 8,
                            }}
                          >
                            组件信息
                          </div>
                          <div
                            style={{
                              fontSize: 14,
                              color: '#333',
                              fontWeight: 'bold',
                              marginBottom: 4,
                            }}
                          >
                            {comp.props.title || comp.component}
                          </div>
                          <div style={{ fontSize: 12, color: '#666' }}>
                            类型: {comp.component}
                          </div>
                        </div>

                        {/* 基本属性 */}
                        <div style={{ marginBottom: 24 }}>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              marginBottom: 16,
                              paddingBottom: 12,
                              borderBottom: '1px solid #e8e8e8',
                            }}
                          >
                            <h4
                              style={{
                                margin: 0,
                                fontSize: 14,
                                fontWeight: 'bold',
                                color: '#333',
                              }}
                            >
                              基本属性
                            </h4>
                          </div>

                          <div style={{ marginBottom: 16 }}>
                            <label
                              style={{
                                display: 'block',
                                marginBottom: 8,
                                fontSize: 12,
                                color: '#666',
                                fontWeight: '500',
                              }}
                            >
                              组件名称
                            </label>
                            <Input
                              size="small"
                              value={comp.props.title || ''}
                              onChange={(e) => {
                                const newComponents = [...components];
                                newComponents[selectedComponent].props.title =
                                  e.target.value;
                                setComponents(newComponents);
                              }}
                              placeholder="请输入组件名称"
                              style={{ borderRadius: 4 }}
                            />
                          </div>

                          <div style={{ marginBottom: 16 }}>
                            <label
                              style={{
                                display: 'block',
                                marginBottom: 8,
                                fontSize: 12,
                                color: '#666',
                                fontWeight: '500',
                              }}
                            >
                              字段名称
                            </label>
                            <Input
                              size="small"
                              value={comp.props.name || ''}
                              onChange={(e) => {
                                const newComponents = [...components];
                                newComponents[selectedComponent].props.name =
                                  e.target.value;
                                setComponents(newComponents);
                              }}
                              placeholder="请输入字段名称"
                              style={{ borderRadius: 4 }}
                            />
                          </div>

                          <div style={{ marginBottom: 16 }}>
                            <label
                              style={{
                                display: 'block',
                                marginBottom: 8,
                                fontSize: 12,
                                color: '#666',
                                fontWeight: '500',
                              }}
                            >
                              占位文本
                            </label>
                            <Input
                              size="small"
                              value={comp.props.placeholder || ''}
                              onChange={(e) => {
                                const newComponents = [...components];
                                if (!newComponents[selectedComponent].props) {
                                  newComponents[selectedComponent].props = {};
                                }
                                newComponents[
                                  selectedComponent
                                ].props.placeholder = e.target.value;
                                setComponents(newComponents);
                              }}
                              placeholder="请输入占位文本"
                              style={{ borderRadius: 4 }}
                            />
                          </div>

                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              marginBottom: 16,
                              padding: 12,
                              backgroundColor: '#fafafa',
                              borderRadius: 4,
                            }}
                          >
                            <label
                              style={{
                                fontSize: 12,
                                color: '#666',
                                fontWeight: '500',
                              }}
                            >
                              是否必填
                            </label>
                            <Switch
                              checked={comp.props.required || false}
                              onChange={(checked) => {
                                const newComponents = [...components];
                                newComponents[
                                  selectedComponent
                                ].props.required = checked;
                                setComponents(newComponents);
                              }}
                            />
                          </div>

                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              marginBottom: 16,
                              padding: 12,
                              backgroundColor: '#fafafa',
                              borderRadius: 4,
                            }}
                          >
                            <label
                              style={{
                                fontSize: 12,
                                color: '#666',
                                fontWeight: '500',
                              }}
                            >
                              是否禁用
                            </label>
                            <Switch
                              checked={comp.props.disabled || false}
                              onChange={(checked) => {
                                const newComponents = [...components];
                                if (!newComponents[selectedComponent].props) {
                                  newComponents[selectedComponent].props = {};
                                }
                                newComponents[
                                  selectedComponent
                                ].props.disabled = checked;
                                setComponents(newComponents);
                              }}
                            />
                          </div>
                        </div>

                        {/* 样式属性 */}
                        <div style={{ marginBottom: 24 }}>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              marginBottom: 16,
                              paddingBottom: 12,
                              borderBottom: '1px solid #e8e8e8',
                            }}
                          >
                            <h4
                              style={{
                                margin: 0,
                                fontSize: 14,
                                fontWeight: 'bold',
                                color: '#333',
                              }}
                            >
                              样式属性
                            </h4>
                          </div>

                          <div style={{ marginBottom: 16 }}>
                            <label
                              style={{
                                display: 'block',
                                marginBottom: 8,
                                fontSize: 12,
                                color: '#666',
                                fontWeight: '500',
                              }}
                            >
                              宽度
                            </label>
                            <Input
                              size="small"
                              value={comp.props.style?.width || ''}
                              onChange={(e) => {
                                const newComponents = [...components];
                                if (!newComponents[selectedComponent].props) {
                                  newComponents[selectedComponent].props = {};
                                }
                                if (
                                  !newComponents[selectedComponent].props.style
                                ) {
                                  newComponents[selectedComponent].props.style =
                                    {};
                                }
                                newComponents[
                                  selectedComponent
                                ].props.style.width = e.target.value;
                                setComponents(newComponents);
                              }}
                              placeholder="如: 100% 或 300px"
                              style={{ borderRadius: 4 }}
                            />
                          </div>

                          <div style={{ marginBottom: 16 }}>
                            <label
                              style={{
                                display: 'block',
                                marginBottom: 8,
                                fontSize: 12,
                                color: '#666',
                                fontWeight: '500',
                              }}
                            >
                              高度
                            </label>
                            <Input
                              size="small"
                              value={comp.props.style?.height || ''}
                              onChange={(e) => {
                                const newComponents = [...components];
                                if (!newComponents[selectedComponent].props) {
                                  newComponents[selectedComponent].props = {};
                                }
                                if (
                                  !newComponents[selectedComponent].props.style
                                ) {
                                  newComponents[selectedComponent].props.style =
                                    {};
                                }
                                newComponents[
                                  selectedComponent
                                ].props.style.height = e.target.value;
                                setComponents(newComponents);
                              }}
                              placeholder="如: 40px"
                              style={{ borderRadius: 4 }}
                            />
                          </div>
                        </div>

                        {/* 根据组件类型显示不同的配置选项 */}
                        {comp.component === 'Select' && (
                          <div style={{ marginBottom: 24 }}>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                marginBottom: 16,
                                paddingBottom: 12,
                                borderBottom: '1px solid #e8e8e8',
                              }}
                            >
                              <h4
                                style={{
                                  margin: 0,
                                  fontSize: 14,
                                  fontWeight: 'bold',
                                  color: '#333',
                                }}
                              >
                                选择器配置
                              </h4>
                            </div>

                            <div style={{ marginBottom: 16 }}>
                              <label
                                style={{
                                  display: 'block',
                                  marginBottom: 8,
                                  fontSize: 12,
                                  color: '#666',
                                  fontWeight: '500',
                                }}
                              >
                                选项列表
                              </label>
                              <div
                                style={{
                                  fontSize: 12,
                                  color: '#666',
                                  backgroundColor: '#fafafa',
                                  padding: 16,
                                  borderRadius: 4,
                                  border: '1px solid #e8e8e8',
                                  whiteSpace: 'pre-wrap',
                                  wordBreak: 'break-all',
                                }}
                              >
                                {JSON.stringify(
                                  comp.props.dataSource || [],
                                  null,
                                  2,
                                )}
                              </div>
                            </div>

                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                marginBottom: 16,
                                padding: 12,
                                backgroundColor: '#fafafa',
                                borderRadius: 4,
                              }}
                            >
                              <label
                                style={{
                                  fontSize: 12,
                                  color: '#666',
                                  fontWeight: '500',
                                }}
                              >
                                是否多选
                              </label>
                              <Switch
                                checked={comp.props.mode === 'multiple'}
                                onChange={(checked) => {
                                  const newComponents = [...components];
                                  if (!newComponents[selectedComponent].props) {
                                    newComponents[selectedComponent].props = {};
                                  }
                                  newComponents[selectedComponent].props.mode =
                                    checked ? 'multiple' : undefined;
                                  setComponents(newComponents);
                                }}
                              />
                            </div>
                          </div>
                        )}

                        {comp.component === 'Checkbox.Group' && (
                          <div style={{ marginBottom: 24 }}>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                marginBottom: 16,
                                paddingBottom: 12,
                                borderBottom: '1px solid #e8e8e8',
                              }}
                            >
                              <h4
                                style={{
                                  margin: 0,
                                  fontSize: 14,
                                  fontWeight: 'bold',
                                  color: '#333',
                                }}
                              >
                                复选框配置
                              </h4>
                            </div>

                            <div style={{ marginBottom: 16 }}>
                              <label
                                style={{
                                  display: 'block',
                                  marginBottom: 8,
                                  fontSize: 12,
                                  color: '#666',
                                  fontWeight: '500',
                                }}
                              >
                                选项列表
                              </label>
                              <div
                                style={{
                                  fontSize: 12,
                                  color: '#666',
                                  backgroundColor: '#fafafa',
                                  padding: 16,
                                  borderRadius: 4,
                                  border: '1px solid #e8e8e8',
                                  whiteSpace: 'pre-wrap',
                                  wordBreak: 'break-all',
                                }}
                              >
                                {JSON.stringify(
                                  comp.props.options || [],
                                  null,
                                  2,
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {comp.component === 'Radio.Group' && (
                          <div style={{ marginBottom: 24 }}>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                marginBottom: 16,
                                paddingBottom: 12,
                                borderBottom: '1px solid #e8e8e8',
                              }}
                            >
                              <h4
                                style={{
                                  margin: 0,
                                  fontSize: 14,
                                  fontWeight: 'bold',
                                  color: '#333',
                                }}
                              >
                                单选框配置
                              </h4>
                            </div>

                            <div style={{ marginBottom: 16 }}>
                              <label
                                style={{
                                  display: 'block',
                                  marginBottom: 8,
                                  fontSize: 12,
                                  color: '#666',
                                  fontWeight: '500',
                                }}
                              >
                                选项列表
                              </label>
                              <div
                                style={{
                                  fontSize: 12,
                                  color: '#666',
                                  backgroundColor: '#fafafa',
                                  padding: 16,
                                  borderRadius: 4,
                                  border: '1px solid #e8e8e8',
                                  whiteSpace: 'pre-wrap',
                                  wordBreak: 'break-all',
                                }}
                              >
                                {JSON.stringify(
                                  comp.props.options || [],
                                  null,
                                  2,
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* 高级属性 */}
                        <div style={{ marginBottom: 24 }}>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              marginBottom: 16,
                              paddingBottom: 12,
                              borderBottom: '1px solid #e8e8e8',
                            }}
                          >
                            <h4
                              style={{
                                margin: 0,
                                fontSize: 14,
                                fontWeight: 'bold',
                                color: '#333',
                              }}
                            >
                              高级属性
                            </h4>
                          </div>

                          <div style={{ marginBottom: 16 }}>
                            <label
                              style={{
                                display: 'block',
                                marginBottom: 8,
                                fontSize: 12,
                                color: '#666',
                                fontWeight: '500',
                              }}
                            >
                              自定义类名
                            </label>
                            <Input
                              size="small"
                              value={comp.props.className || ''}
                              onChange={(e) => {
                                const newComponents = [...components];
                                if (!newComponents[selectedComponent].props) {
                                  newComponents[selectedComponent].props = {};
                                }
                                newComponents[
                                  selectedComponent
                                ].props.className = e.target.value;
                                setComponents(newComponents);
                              }}
                              placeholder="请输入自定义类名"
                              style={{ borderRadius: 4 }}
                            />
                          </div>

                          <div style={{ marginBottom: 16 }}>
                            <label
                              style={{
                                display: 'block',
                                marginBottom: 8,
                                fontSize: 12,
                                color: '#666',
                                fontWeight: '500',
                              }}
                            >
                              自定义样式
                            </label>
                            <Input.TextArea
                              size="small"
                              value={JSON.stringify(
                                comp.props.style || {},
                                null,
                                2,
                              )}
                              onChange={(e) => {
                                try {
                                  const newComponents = [...components];
                                  if (!newComponents[selectedComponent].props) {
                                    newComponents[selectedComponent].props = {};
                                  }
                                  newComponents[selectedComponent].props.style =
                                    JSON.parse(e.target.value);
                                  setComponents(newComponents);
                                } catch (error) {
                                  console.error('Invalid JSON:', error);
                                }
                              }}
                              placeholder="请输入JSON格式的样式"
                              style={{ borderRadius: 4, minHeight: 100 }}
                              rows={4}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </Sider>
        </Layout>

        {/* 底部操作栏 */}
        <div
          style={{
            marginTop: 0,
            padding: '16px 24px',
            backgroundColor: '#f9f9f9',
            borderTop: '1px solid #e8e8e8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <span style={{ color: '#666', fontSize: 14 }}>
              组件数量: {components.length}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={handleSave}>保存设计</Button>
            <Button onClick={() => setPageGeneratorVisible(true)}>
              生成页面
            </Button>
            <Button
              type="primary"
              onClick={() => {
                // 重置预览表单
                previewForm.resetFields();
                // 显示预览模态框
                setPreviewVisible(true);
              }}
            >
              预览表单
            </Button>
          </div>
        </div>

        {/* 预览模态框 */}
        <Modal
          title="表单预览"
          open={previewVisible}
          onCancel={() => setPreviewVisible(false)}
          footer={null}
          width={800}
          bodyStyle={{ padding: 0 }}
        >
          {/* 预览模态框头部 */}
          <div
            style={{
              backgroundColor: '#f9f9f9',
              padding: '12px 24px',
              borderBottom: '1px solid #e8e8e8',
            }}
          >
            <h4 style={{ margin: 0 }}>表单预览</h4>
          </div>

          {/* 预览内容 */}
          <div style={{ padding: 24 }}>
            <AntForm
              form={previewForm}
              layout="vertical"
              onFinish={(values) => {
                console.log('预览表单提交:', values);
                Modal.success({
                  title: '提交成功',
                  content: JSON.stringify(values, null, 2),
                });
              }}
            >
              {components.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '60px 20px',
                    color: '#999',
                  }}
                >
                  <Empty description={<p>表单中还没有添加组件</p>} />
                </div>
              ) : (
                components.map((comp: any, index: number) => (
                  <AntForm.Item
                    key={index}
                    label={comp.props.title}
                    name={comp.props.name}
                    rules={
                      comp.props.required
                        ? [
                            {
                              required: true,
                              message: `请输入${comp.props.title}`,
                            },
                          ]
                        : []
                    }
                    style={{ marginBottom: 16 }}
                  >
                    {(() => {
                      switch (comp.component) {
                        case 'Input':
                          return (
                            <Input placeholder={`请输入${comp.props.title}`} />
                          );
                        case 'Select':
                          return (
                            <Select
                              placeholder={`请选择${comp.props.title}`}
                              options={comp.props.dataSource?.map(
                                (option: any) => ({
                                  label: option.label,
                                  value: option.value,
                                }),
                              )}
                            />
                          );
                        case 'DatePicker':
                          return (
                            <DatePicker
                              placeholder={`请选择${comp.props.title}`}
                            />
                          );
                        case 'Checkbox.Group':
                          return (
                            <Checkbox.Group
                              options={comp.props.options || []}
                            />
                          );
                        case 'Radio.Group':
                          return (
                            <Radio.Group options={comp.props.options || []} />
                          );
                        case 'Switch':
                          return <Switch />;
                        case 'Slider':
                          return <Slider />;
                        case 'Cascader':
                          return (
                            <Cascader
                              placeholder={`请选择${comp.props.title}`}
                            />
                          );
                        case 'TreeSelect':
                          return (
                            <TreeSelect
                              placeholder={`请选择${comp.props.title}`}
                            />
                          );
                        case 'Upload':
                          return <Upload {...comp.props} />;
                        case 'Rate':
                          return <Rate />;
                        default:
                          return (
                            <Input placeholder={`请输入${comp.props.title}`} />
                          );
                      }
                    })()}
                  </AntForm.Item>
                ))
              )}
            </AntForm>
          </div>

          {/* 预览模态框底部 */}
          <div
            style={{
              backgroundColor: '#f9f9f9',
              padding: '16px 24px',
              borderTop: '1px solid #e8e8e8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 8,
            }}
          >
            {components.length > 0 && (
              <Button type="primary" htmlType="submit">
                提交
              </Button>
            )}
            <Button onClick={() => setPreviewVisible(false)}>关闭</Button>
          </div>
        </Modal>

        {/* 页面生成器模态框 */}
        <PageGenerator
          visible={pageGeneratorVisible}
          onCancel={() => setPageGeneratorVisible(false)}
          formId={formDesignData?.id}
          formName={formDesignData?.desformName || '新表单'}
        />
      </Card>
    </div>
  );
};

export default LowFormDesign;
