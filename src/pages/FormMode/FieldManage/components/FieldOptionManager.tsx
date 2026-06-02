import React, { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  Modal,
  Popconfirm,
  Radio,
  Row,
  Space,
  Table,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
} from '@ant-design/icons';
import type { FieldOption } from '@/services/formmode/typings';

interface FieldOptionManagerProps {
  fieldId?: string;
  formId?: string;
  options?: FieldOption[];
  onChange?: (options: FieldOption[]) => void;
  readonly?: boolean; // 是否只读模式
}

/**
 * 字段选项管理组件
 * 用于管理选择框、单选框、复选框的选项数据
 */
const FieldOptionManager: React.FC<FieldOptionManagerProps> = ({
  fieldId,
  formId,
  options = [],
  onChange,
  readonly = false,
}) => {
  const [optionList, setOptionList] = useState<FieldOption[]>(options);
  const [modalVisibe, setModalVisibe] = useState<boolean>(false);
  const [currentOption, setCurrentOption] = useState<Partial<FieldOption> | null>(null);
  const [form] = Form.useForm();

  // 当外部 options 变化时更新内部状态
  useEffect(() => {
    setOptionList(options);
  }, [options]);

  // 添加选项
  const handleAdd = () => {
    setCurrentOption(null);
    form.resetFields();
    setModalVisibe(true);
  };

  // 编辑选项
  const handleEdit = (record: FieldOption) => {
    setCurrentOption(record);
    form.setFieldsValue({
      optionValue: record.optionValue,
      optionLabel: record.optionLabel,
      isDefault: record.isDefault,
    });
    setModalVisibe(true);
  };

  // 保存选项
  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      let newList: FieldOption[];

      if (currentOption?.optionValue) {
        // 编辑模式
        newList = optionList.map((item) => {
          if (item.optionValue === currentOption.optionValue) {
            return {
              ...item,
              optionLabel: values.optionLabel,
              isDefault: values.isDefault || 0,
            };
          }
          return item;
        });
      } else {
        // 新增模式
        const newOption: FieldOption = {
          fieldId,
          formId,
          optionValue: `option_${Date.now()}`, // 临时ID，保存时由后端生成
          optionLabel: values.optionLabel,
          listOrder: optionList.length + 1,
          isDefault: values.isDefault || 0,
        };
        newList = [...optionList, newOption];
      }

      setOptionList(newList);
      if (onChange) {
        onChange(newList);
      }
      setModalVisibe(false);
      message.success('保存成功');
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  // 删除选项
  const handleDelete = (record: FieldOption) => {
    const newList = optionList.filter(
      (item) => item.optionValue !== record.optionValue
    );
    setOptionList(newList);
    if (onChange) {
      onChange(newList);
    }
    message.success('删除成功');
  };

  // 上移
  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newList = [...optionList];
    [newList[index - 1], newList[index]] = [newList[index], newList[index - 1]];
    // 更新排序
    newList.forEach((item, idx) => {
      item.listOrder = idx + 1;
    });
    setOptionList(newList);
    if (onChange) {
      onChange(newList);
    }
  };

  // 下移
  const handleMoveDown = (index: number) => {
    if (index === optionList.length - 1) return;
    const newList = [...optionList];
    [newList[index], newList[index + 1]] = [newList[index + 1], newList[index]];
    // 更新排序
    newList.forEach((item, idx) => {
      item.listOrder = idx + 1;
    });
    setOptionList(newList);
    if (onChange) {
      onChange(newList);
    }
  };

  // 设置默认选中
  const handleSetDefault = (record: FieldOption) => {
    const newList = optionList.map((item) => ({
      ...item,
      isDefault: item.optionValue === record.optionValue ? 1 : 0,
    }));
    setOptionList(newList);
    if (onChange) {
      onChange(newList);
    }
  };

  // 表格列定义
  const columns: ColumnsType<FieldOption> = [
    {
      title: '排序',
      dataIndex: 'listOrder',
      key: 'listOrder',
      width: 80,
      render: (text: number, record: FieldOption, index: number) => (
        <Space>
          <Button
            type="text"
            size="small"
            icon={<ArrowUpOutlined />}
            disabled={index === 0 || readonly}
            onClick={() => handleMoveUp(index)}
          />
          <Button
            type="text"
            size="small"
            icon={<ArrowDownOutlined />}
            disabled={index === optionList.length - 1 || readonly}
            onClick={() => handleMoveDown(index)}
          />
        </Space>
      ),
    },
    {
      title: '选项值',
      dataIndex: 'optionValue',
      key: 'optionValue',
      width: 150,
    },
    {
      title: '选项标签',
      dataIndex: 'optionLabel',
      key: 'optionLabel',
      width: 200,
    },
    {
      title: '默认选中',
      dataIndex: 'isDefault',
      key: 'isDefault',
      width: 100,
      render: (isDefault: number, record: FieldOption) => (
        <Radio
          checked={isDefault === 1}
          disabled={readonly}
          onChange={() => handleSetDefault(record)}
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: any, record: FieldOption, index: number) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            disabled={readonly}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除"
            description="确定要删除这个选项吗？"
            onConfirm={() => handleDelete(record)}
            okText="确认"
            cancelText="取消"
            disabled={readonly}
          >
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              disabled={readonly}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title="选项配置"
      size="small"
      extra={
        !readonly && (
          <Button
            type="primary"
            size="small"
            icon={<PlusOutlined />}
            onClick={handleAdd}
          >
            添加选项
          </Button>
        )
      }
    >
      <Table
        rowKey="optionValue"
        columns={columns}
        dataSource={optionList}
        pagination={false}
        size="small"
        scroll={{ x: 800 }}
      />

      {/* 新增/编辑选项 Modal */}
      <Modal
        title={currentOption ? '编辑选项' : '新增选项'}
        open={modalVisibe}
        onOk={handleSave}
        onCancel={() => setModalVisibe(false)}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="optionLabel"
            label="选项标签"
            rules={[{ required: true, message: '请输入选项标签' }]}
          >
            <Input placeholder="请输入选项标签" />
          </Form.Item>
          <Form.Item name="isDefault" label="是否默认选中">
            <Radio checked={form.getFieldValue('isDefault') === 1}>
              默认选中
            </Radio>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default FieldOptionManager;
