import { Button, Card, Divider, Form, message, Select, Switch } from 'antd';
import React, { useState } from 'react';

const { Option } = Select;

const NotificationView: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState<boolean>(false);

  const initialValues = {
    systemNotifications: true,
    emailNotifications: true,
    messageNotifications: true,
    pushNotifications: false,
    emailFrequency: 'daily',
    systemNotificationTypes: {
      security: true,
      systemUpdates: true,
      maintenance: true,
      promotions: false,
    },
    messageNotificationTypes: {
      directMessages: true,
      groupMessages: true,
      mentions: true,
      comments: true,
    },
  };

  const handleSubmit = async (_values: any) => {
    try {
      setLoading(true);
      // 模拟保存操作
      setTimeout(() => {
        message.success('通知设置保存成功');
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

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={initialValues}
      onFinish={handleSubmit}
    >
      <Card title="通知偏好" bordered={false} style={{ marginBottom: 24 }}>
        <Form.Item
          name="systemNotifications"
          label="系统通知"
          valuePropName="checked"
        >
          <Switch checkedChildren="开启" unCheckedChildren="关闭" />
        </Form.Item>

        <Form.Item
          name="emailNotifications"
          label="邮件通知"
          valuePropName="checked"
        >
          <Switch checkedChildren="开启" unCheckedChildren="关闭" />
        </Form.Item>

        <Form.Item
          name="messageNotifications"
          label="消息通知"
          valuePropName="checked"
        >
          <Switch checkedChildren="开启" unCheckedChildren="关闭" />
        </Form.Item>

        <Form.Item
          name="pushNotifications"
          label="推送通知"
          valuePropName="checked"
        >
          <Switch checkedChildren="开启" unCheckedChildren="关闭" />
        </Form.Item>

        <Form.Item name="emailFrequency" label="邮件通知频率">
          <Select placeholder="请选择邮件通知频率">
            <Option value="immediate">即时</Option>
            <Option value="hourly">每小时</Option>
            <Option value="daily">每天</Option>
            <Option value="weekly">每周</Option>
          </Select>
        </Form.Item>
      </Card>

      <Divider orientation="left">系统通知类型</Divider>
      <Card bordered={false} style={{ marginBottom: 24 }}>
        <Form.Item
          name={['systemNotificationTypes', 'security']}
          label="安全相关通知"
          valuePropName="checked"
        >
          <Switch checkedChildren="开启" unCheckedChildren="关闭" />
        </Form.Item>

        <Form.Item
          name={['systemNotificationTypes', 'systemUpdates']}
          label="系统更新通知"
          valuePropName="checked"
        >
          <Switch checkedChildren="开启" unCheckedChildren="关闭" />
        </Form.Item>

        <Form.Item
          name={['systemNotificationTypes', 'maintenance']}
          label="系统维护通知"
          valuePropName="checked"
        >
          <Switch checkedChildren="开启" unCheckedChildren="关闭" />
        </Form.Item>

        <Form.Item
          name={['systemNotificationTypes', 'promotions']}
          label="促销活动通知"
          valuePropName="checked"
        >
          <Switch checkedChildren="开启" unCheckedChildren="关闭" />
        </Form.Item>
      </Card>

      <Divider orientation="left">消息通知类型</Divider>
      <Card bordered={false} style={{ marginBottom: 24 }}>
        <Form.Item
          name={['messageNotificationTypes', 'directMessages']}
          label="直接消息"
          valuePropName="checked"
        >
          <Switch checkedChildren="开启" unCheckedChildren="关闭" />
        </Form.Item>

        <Form.Item
          name={['messageNotificationTypes', 'groupMessages']}
          label="群组消息"
          valuePropName="checked"
        >
          <Switch checkedChildren="开启" unCheckedChildren="关闭" />
        </Form.Item>

        <Form.Item
          name={['messageNotificationTypes', 'mentions']}
          label="@提及通知"
          valuePropName="checked"
        >
          <Switch checkedChildren="开启" unCheckedChildren="关闭" />
        </Form.Item>

        <Form.Item
          name={['messageNotificationTypes', 'comments']}
          label="评论通知"
          valuePropName="checked"
        >
          <Switch checkedChildren="开启" unCheckedChildren="关闭" />
        </Form.Item>
      </Card>

      <Form.Item>
        <Button type="primary" htmlType="submit" loading={loading}>
          保存设置
        </Button>
        <Button style={{ marginLeft: 8 }} onClick={handleReset}>
          重置
        </Button>
      </Form.Item>
    </Form>
  );
};

export default NotificationView;
