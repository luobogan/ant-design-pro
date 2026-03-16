import {
  DeleteOutlined,
  DragOutlined,
  EditOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import {
  Button,
  Col,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  message,
  Popconfirm,
  Row,
  Select,
  Space,
  Tag,
  Tooltip,
} from 'antd';
import React, { useEffect, useState } from 'react';
import {
  type DbformFieldItem,
  getDbformFieldList,
  removeDbformField,
  saveDbformField,
} from '@/services/lowcode/dbform';

interface FieldConfigDrawerProps {
  open: boolean;
  onClose: () => void;
  dbformId: string;
  tableName: string;
}

const FieldConfigDrawer: React.FC<FieldConfigDrawerProps> = ({
  open,
  onClose,
  dbformId,
  tableName,
}) => {
  const [dataSource, setDataSource] = useState<DbformFieldItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [currentField, setCurrentField] = useState<DbformFieldItem | null>(
    null,
  );
  const [form] = Form.useForm();

  useEffect(() => {
    if (open && dbformId) {
      loadFields();
    }
  }, [open, dbformId]);

  const loadFields = async () => {
    setLoading(true);
    try {
      const res = await getDbformFieldList(dbformId);
      if (res.code === 200) {
        setDataSource(res.data || []);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setCurrentField(null);
    form.resetFields();
    form.setFieldsValue({ isNull: 'Y', isPrimaryKey: 'N', isDb: 'Y' });
    setEditModalVisible(true);
  };

  const handleEdit = (record: DbformFieldItem) => {
    setCurrentField(record);
    form.setFieldsValue(record);
    setEditModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    const res = await removeDbformField(id);
    if (res.code === 200) {
      message.success('删除成功');
      loadFields();
    } else {
      message.error(res.msg || '删除失败');
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const fieldData: DbformFieldItem = {
        ...values,
        id: currentField?.id || `${Date.now()}`,
        dbformId,
      };
      const res = await saveDbformField([fieldData]);
      if (res.code === 200) {
        message.success('保存成功');
        setEditModalVisible(false);
        loadFields();
      } else {
        message.error(res.msg || '保存失败');
      }
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  const fieldTypeOptions = [
    { label: '字符串', value: 'string' },
    { label: '整型', value: 'int' },
    { label: '长整型', value: 'long' },
    { label: '浮点型', value: 'double' },
    { label: '日期', value: 'date' },
    { label: '日期时间', value: 'datetime' },
    { label: '文本', value: 'text' },
    { label: '布尔', value: 'boolean' },
  ];

  const columns: ProColumns<DbformFieldItem>[] = [
    {
      title: '排序',
      dataIndex: 'sortNum',
      width: 60,
      render: () => <DragOutlined style={{ cursor: 'move' }} />,
    },
    {
      title: '字段名',
      dataIndex: 'fieldCode',
      width: 150,
      render: (text) => <Tag color="blue">{text as string}</Tag>,
    },
    {
      title: '字段描述',
      dataIndex: 'fieldName',
      width: 150,
    },
    {
      title: '字段类型',
      dataIndex: 'fieldType',
      width: 100,
      valueEnum: {
        string: { text: '字符串' },
        int: { text: '整型' },
        long: { text: '长整型' },
        double: { text: '浮点型' },
        date: { text: '日期' },
        datetime: { text: '日期时间' },
        text: { text: '文本' },
        boolean: { text: '布尔' },
      },
    },
    {
      title: '长度',
      dataIndex: 'fieldLen',
      width: 80,
    },
    {
      title: '主键',
      dataIndex: 'isPrimaryKey',
      width: 60,
      render: (text) => (
        <Tag color={text === 'Y' ? 'red' : 'default'}>
          {text === 'Y' ? '是' : '否'}
        </Tag>
      ),
    },
    {
      title: '允许空',
      dataIndex: 'isNull',
      width: 60,
      render: (text) => (
        <Tag color={text === 'Y' ? 'green' : 'orange'}>
          {text === 'Y' ? '是' : '否'}
        </Tag>
      ),
    },
    {
      title: '操作',
      valueType: 'option',
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="编辑">
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Popconfirm
            title="确定要删除该字段吗？"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Drawer
      title={`字段配置 - ${tableName}`}
      width={1000}
      open={open}
      onClose={onClose}
      footer={
        <Space style={{ float: 'right' }}>
          <Button onClick={onClose}>关闭</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            新增字段
          </Button>
        </Space>
      }
    >
      <ProTable<DbformFieldItem>
        headerTitle="字段列表"
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={dataSource}
        search={false}
        pagination={false}
        scroll={{ x: 800 }}
        toolBarRender={false}
        options={false}
      />

      <Modal
        title={currentField ? '编辑字段' : '新增字段'}
        open={editModalVisible}
        onOk={handleSave}
        onCancel={() => setEditModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="fieldCode"
                label="字段名"
                rules={[{ required: true, message: '请输入字段名' }]}
              >
                <Input
                  placeholder="请输入字段名（数据库字段）"
                  disabled={!!currentField}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="fieldName"
                label="字段描述"
                rules={[{ required: true, message: '请输入字段描述' }]}
              >
                <Input placeholder="请输入字段描述" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="fieldType"
                label="字段类型"
                initialValue="string"
              >
                <Select
                  options={fieldTypeOptions}
                  placeholder="请选择字段类型"
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="fieldLen" label="长度">
                <InputNumber
                  min={1}
                  placeholder="长度"
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="fieldPointLen" label="小数位">
                <InputNumber
                  min={0}
                  placeholder="小数位"
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="isPrimaryKey" label="是否主键" initialValue="N">
                <Select>
                  <Select.Option value="Y">是</Select.Option>
                  <Select.Option value="N">否</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="isNull" label="允许为空" initialValue="Y">
                <Select>
                  <Select.Option value="Y">是</Select.Option>
                  <Select.Option value="N">否</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="isDb" label="同步数据库" initialValue="Y">
                <Select>
                  <Select.Option value="Y">是</Select.Option>
                  <Select.Option value="N">否</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="fieldDefaultVal" label="默认值">
                <Input placeholder="请输入默认值" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="sortNum" label="排序">
                <InputNumber
                  min={0}
                  placeholder="排序"
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="fieldRemark" label="备注">
            <Input.TextArea rows={2} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>
    </Drawer>
  );
};

export default FieldConfigDrawer;
