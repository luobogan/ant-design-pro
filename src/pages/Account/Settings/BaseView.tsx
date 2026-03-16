import {
  MailOutlined,
  MobileOutlined,
  UploadOutlined,
  UserOutlined,
} from '@ant-design/icons';
import type { UploadProps } from 'antd';
import { Button, Form, Input, message, Select, Upload } from 'antd';
import React, { useState } from 'react';

const { Option } = Select;
const { TextArea } = Input;

const BaseView: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState<boolean>(false);

  const initialValues = {
    name: '管理员',
    email: 'admin@sword.com',
    phone: '138****8888',
    nickname: 'Admin',
    gender: 'male',
    avatar: [
      {
        uid: '1',
        name: 'avatar.jpg',
        status: 'done',
        url: 'https://randomuser.me/api/portraits/men/1.jpg',
      },
    ],
    bio: '系统管理员，负责系统的日常维护和管理工作。',
    location: '北京市海淀区',
    website: 'https://sword-admin.com',
  };

  const handleSubmit = async (_values: any) => {
    try {
      setLoading(true);
      // 模拟保存操作
      setTimeout(() => {
        message.success('保存成功');
        setLoading(false);
      }, 1000);
    } catch (_error) {
      message.error('保存失败，请稍后重试');
      setLoading(false);
    }
  };

  const handleReset = () => {
    form.resetFields();
  };

  const uploadProps: UploadProps = {
    name: 'avatar',
    action: 'https://run.mocky.io/v3/435e224c-44fb-4773-9faf-380c5e6a2188',
    headers: {
      authorization: 'authorization-text',
    },
    onChange(info: any) {
      if (info.file.status === 'uploading') {
        setLoading(true);
        return;
      }
      if (info.file.status === 'done') {
        message.success(`${info.file.name} 上传成功`);
        setLoading(false);
      } else if (info.file.status === 'error') {
        message.error(`${info.file.name} 上传失败`);
        setLoading(false);
      }
    },
  };

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={initialValues}
      onFinish={handleSubmit}
    >
      <Form.Item
        name="avatar"
        label="头像"
        valuePropName="fileList"
        getValueFromEvent={(e: any) => {
          if (Array.isArray(e)) {
            return e;
          }
          return e?.fileList;
        }}
      >
        <Upload {...uploadProps} listType="picture-card">
          <div>
            <UploadOutlined />
            <div style={{ marginTop: 8 }}>上传</div>
          </div>
        </Upload>
      </Form.Item>

      <Form.Item
        name="name"
        label="姓名"
        rules={[
          {
            required: true,
            message: '请输入姓名',
          },
        ]}
      >
        <Input prefix={<UserOutlined />} placeholder="请输入姓名" />
      </Form.Item>

      <Form.Item
        name="nickname"
        label="昵称"
        rules={[
          {
            required: true,
            message: '请输入昵称',
          },
        ]}
      >
        <Input placeholder="请输入昵称" />
      </Form.Item>

      <Form.Item
        name="gender"
        label="性别"
        rules={[
          {
            required: true,
            message: '请选择性别',
          },
        ]}
      >
        <Select placeholder="请选择性别">
          <Option value="male">男</Option>
          <Option value="female">女</Option>
          <Option value="other">其他</Option>
        </Select>
      </Form.Item>

      <Form.Item
        name="email"
        label="邮箱"
        rules={[
          {
            required: true,
            message: '请输入邮箱',
          },
          {
            type: 'email',
            message: '请输入正确的邮箱地址',
          },
        ]}
      >
        <Input prefix={<MailOutlined />} placeholder="请输入邮箱" />
      </Form.Item>

      <Form.Item
        name="phone"
        label="电话"
        rules={[
          {
            required: true,
            message: '请输入电话',
          },
          {
            pattern: /^1[3-9]\d{9}$/,
            message: '请输入正确的手机号码',
          },
        ]}
      >
        <Input prefix={<MobileOutlined />} placeholder="请输入电话" />
      </Form.Item>

      <Form.Item name="location" label="所在地">
        <Input placeholder="请输入所在地" />
      </Form.Item>

      <Form.Item name="website" label="个人网站">
        <Input placeholder="请输入个人网站" />
      </Form.Item>

      <Form.Item name="bio" label="个人简介">
        <TextArea rows={4} placeholder="请输入个人简介" />
      </Form.Item>

      <Form.Item>
        <Button type="primary" htmlType="submit" loading={loading}>
          保存修改
        </Button>
        <Button style={{ marginLeft: 8 }} onClick={handleReset}>
          重置
        </Button>
      </Form.Item>
    </Form>
  );
};

export default BaseView;
