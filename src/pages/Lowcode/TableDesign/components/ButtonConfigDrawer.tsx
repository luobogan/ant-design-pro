import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
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
  type DbformButtonItem,
  getDbformButtonList,
  removeDbformButton,
  saveDbformButton,
} from '@/services/lowcode/dbform';

interface ButtonConfigDrawerProps {
  open: boolean;
  onClose: () => void;
  dbformId: string;
}

const ButtonConfigDrawer: React.FC<ButtonConfigDrawerProps> = ({
  open,
  onClose,
  dbformId,
}) => {
  const [dataSource, setDataSource] = useState<DbformButtonItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [currentButton, setCurrentButton] = useState<DbformButtonItem | null>(
    null,
  );
  const [form] = Form.useForm();

  useEffect(() => {
    if (open && dbformId) {
      loadButtons();
    }
  }, [open, dbformId]);

  const loadButtons = async () => {
    setLoading(true);
    try {
      const res = await getDbformButtonList(dbformId);
      if (res.code === 200) {
        setDataSource(res.data || []);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setCurrentButton(null);
    form.resetFields();
    form.setFieldsValue({
      buttonLocation: 'table',
      buttonType: 'primary',
      buttonShow: 'Y',
    });
    setEditModalVisible(true);
  };

  const handleEdit = (record: DbformButtonItem) => {
    setCurrentButton(record);
    form.setFieldsValue(record);
    setEditModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    const res = await removeDbformButton(id);
    if (res.code === 200) {
      message.success('删除成功');
      loadButtons();
    } else {
      message.error(res.msg || '删除失败');
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const buttonData: DbformButtonItem = {
        ...values,
        id: currentButton?.id || `${Date.now()}`,
        dbformId,
      };
      const res = await saveDbformButton([buttonData]);
      if (res.code === 200) {
        message.success('保存成功');
        setEditModalVisible(false);
        loadButtons();
      } else {
        message.error(res.msg || '保存失败');
      }
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  const buttonLocationOptions = [
    { label: '表格上方', value: 'table' },
    { label: '行操作', value: 'row' },
    { label: '表单内', value: 'form' },
  ];

  const buttonTypeOptions = [
    { label: '主要按钮', value: 'primary' },
    { label: '默认按钮', value: 'default' },
    { label: '虚线按钮', value: 'dashed' },
    { label: '文字按钮', value: 'text' },
    { label: '链接按钮', value: 'link' },
  ];

  const columns: ProColumns<DbformButtonItem>[] = [
    {
      title: '按钮名称',
      dataIndex: 'buttonName',
      width: 150,
    },
    {
      title: '按钮编码',
      dataIndex: 'buttonCode',
      width: 150,
      render: (text) => <Tag color="blue">{text as string}</Tag>,
    },
    {
      title: '按钮位置',
      dataIndex: 'buttonLocation',
      width: 100,
      valueEnum: {
        table: { text: '表格上方' },
        row: { text: '行操作' },
        form: { text: '表单内' },
      },
    },
    {
      title: '按钮类型',
      dataIndex: 'buttonType',
      width: 100,
      valueEnum: {
        primary: { text: '主要按钮' },
        default: { text: '默认按钮' },
        dashed: { text: '虚线按钮' },
        text: { text: '文字按钮' },
        link: { text: '链接按钮' },
      },
    },
    {
      title: '排序',
      dataIndex: 'buttonSort',
      width: 80,
    },
    {
      title: '显示',
      dataIndex: 'buttonShow',
      width: 60,
      render: (text) => (
        <Tag color={text === 'Y' ? 'green' : 'red'}>
          {text === 'Y' ? '显示' : '隐藏'}
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
            title="确定要删除该按钮吗？"
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
      title="自定义按钮配置"
      width={900}
      open={open}
      onClose={onClose}
      footer={
        <Space style={{ float: 'right' }}>
          <Button onClick={onClose}>关闭</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            新增按钮
          </Button>
        </Space>
      }
    >
      <ProTable<DbformButtonItem>
        headerTitle="按钮列表"
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={dataSource}
        search={false}
        pagination={false}
        scroll={{ x: 700 }}
        toolBarRender={false}
        options={false}
      />

      <Modal
        title={currentButton ? '编辑按钮' : '新增按钮'}
        open={editModalVisible}
        onOk={handleSave}
        onCancel={() => setEditModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="buttonName"
                label="按钮名称"
                rules={[{ required: true, message: '请输入按钮名称' }]}
              >
                <Input placeholder="请输入按钮名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="buttonCode"
                label="按钮编码"
                rules={[{ required: true, message: '请输入按钮编码' }]}
              >
                <Input placeholder="请输入按钮编码（唯一标识）" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="buttonLocation"
                label="按钮位置"
                initialValue="table"
              >
                <Select
                  options={buttonLocationOptions}
                  placeholder="请选择按钮位置"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="buttonType"
                label="按钮类型"
                initialValue="primary"
              >
                <Select
                  options={buttonTypeOptions}
                  placeholder="请选择按钮类型"
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="buttonIcon" label="按钮图标">
                <Input placeholder="请输入图标名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="buttonSort" label="排序">
                <InputNumber
                  min={0}
                  placeholder="排序"
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="buttonShow" label="是否显示" initialValue="Y">
                <Select>
                  <Select.Option value="Y">显示</Select.Option>
                  <Select.Option value="N">隐藏</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="buttonAuth" label="权限编码">
                <Input placeholder="请输入权限编码" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="buttonExp" label="显隐表达式">
            <Input.TextArea rows={2} placeholder="请输入显隐表达式" />
          </Form.Item>
        </Form>
      </Modal>
    </Drawer>
  );
};

export default ButtonConfigDrawer;
