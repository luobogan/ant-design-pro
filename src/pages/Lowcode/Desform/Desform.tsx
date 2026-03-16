import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import {
  Button,
  Divider,
  Form,
  Input,
  List,
  Modal,
  message,
  Space,
  Switch,
} from 'antd';
import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  type DesformItem,
  desformDetail,
  desformPage,
  desformRemove,
  desformSave,
  desformTemplates,
  desformUnlock,
  desformUpdate,
  groupList,
  groupSave,
} from '@/services/lowcode/desform';

const DesformPage: React.FC = () => {
  const actionRef = useRef<ActionType>();
  const [form] = Form.useForm<DesformItem>();
  const [modalVisible, setModalVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [templateVisible, setTemplateVisible] = useState(false);
  const [groupVisible, setGroupVisible] = useState(false);
  const [current, setCurrent] = useState<DesformItem>();
  const [detailData, setDetailData] = useState<any>();
  const [templateData, setTemplateData] = useState<DesformItem[]>([]);
  const [groupData, setGroupData] = useState<{ id?: number; name?: string }[]>(
    [],
  );
  const [groupName, setGroupName] = useState('');
  const navigate = useNavigate();

  const columns: ProColumns<DesformItem>[] = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 80,
      search: false,
    },
    {
      title: '表单名称',
      dataIndex: 'desformName',
    },
    {
      title: '是否开启',
      dataIndex: 'isOpen',
      valueEnum: {
        Y: { text: '是' },
        N: { text: '否' },
      },
    },
    {
      title: '是否模板',
      dataIndex: 'isTemplate',
      valueEnum: {
        Y: { text: '是' },
        N: { text: '否' },
      },
    },
    {
      title: '创建时间',
      dataIndex: 'createTime',
      valueType: 'dateTime',
      search: false,
    },
    {
      title: '更新时间',
      dataIndex: 'updateTime',
      valueType: 'dateTime',
      search: false,
    },
    {
      title: '操作',
      valueType: 'option',
      width: 320,
      render: (_, record) => [
        <Button
          key="detail"
          type="link"
          onClick={async () => {
            const res = await desformDetail(Number(record.id), true);
            if (res?.success) {
              setDetailData(res.data);
              setDetailVisible(true);
            } else {
              message.error(res?.msg || '获取详情失败');
            }
          }}
        >
          查看并加锁
        </Button>,
        <Button
          key="unlock"
          type="link"
          onClick={async () => {
            const res = await desformUnlock(Number(record.id));
            if (res?.success) {
              message.success('解锁成功');
            } else {
              message.error(res?.msg || '解锁失败');
            }
          }}
        >
          解锁
        </Button>,
        <Button
          key="design"
          type="link"
          onClick={() => {
            navigate(`/lowcode/desform/design/${record.id}`);
          }}
        >
          设计
        </Button>,
        <Button
          key="edit"
          type="link"
          onClick={() => {
            setCurrent(record);
            form.setFieldsValue({
              ...record,
              isOpen: record.isOpen === 'Y',
              isTemplate: record.isTemplate === 'Y',
            });
            setModalVisible(true);
          }}
        >
          编辑
        </Button>,
        <Button
          key="delete"
          type="link"
          danger
          onClick={() => {
            Modal.confirm({
              title: '确认删除',
              content: '删除后不可恢复，确认要删除吗？',
              onOk: async () => {
                const res = await desformRemove([record.id as number]);
                if (res?.success) {
                  message.success('删除成功');
                  actionRef.current?.reload();
                } else {
                  message.error(res?.msg || '删除失败');
                }
              },
            });
          }}
        >
          删除
        </Button>,
      ],
    },
  ];

  const handleSubmit = async () => {
    const values = await form.validateFields();
    const payload: DesformItem = {
      ...values,
      isOpen: values.isOpen ? 'Y' : 'N',
      isTemplate: values.isTemplate ? 'Y' : 'N',
    };
    const api = current?.id ? desformUpdate : desformSave;
    const res = await api({ ...payload, id: current?.id });
    if (res?.success) {
      message.success('保存成功');
      setModalVisible(false);
      setCurrent(undefined);
      form.resetFields();
      actionRef.current?.reload();
    } else {
      message.error(res?.msg || '保存失败');
    }
  };

  const loadTemplates = async () => {
    const res = await desformTemplates({ pageNo: 1, pageSize: 50 });
    if (res?.success) {
      setTemplateData(res.data?.records || []);
      setTemplateVisible(true);
    } else {
      message.error(res?.msg || '获取模板失败');
    }
  };

  const loadGroups = async () => {
    const res = await groupList();
    if (res?.success) {
      setGroupData(res.data || []);
      setGroupVisible(true);
    } else {
      message.error(res?.msg || '获取分组失败');
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName) {
      message.warning('请输入分组名称');
      return;
    }
    const res = await groupSave({ name: groupName });
    if (res?.success) {
      message.success('分组新增成功');
      setGroupName('');
      loadGroups();
    } else {
      message.error(res?.msg || '新增分组失败');
    }
  };

  return (
    <PageContainer
      header={{
        title: '表单设计',
        extra: [
          <Button key="template" onClick={loadTemplates}>
            模板列表
          </Button>,
          <Button key="group" onClick={loadGroups}>
            分组列表
          </Button>,
          <Button
            key="add"
            type="primary"
            onClick={() => {
              setCurrent(undefined);
              form.resetFields();
              setModalVisible(true);
            }}
          >
            新增表单
          </Button>,
        ],
      }}
    >
      <ProTable<DesformItem>
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        pagination={{ pageSize: 10 }}
        request={async (params) => {
          const { current, pageSize, ...rest } = params;
          const res = await desformPage({
            pageNo: current,
            pageSize,
            ...rest,
          });
          return {
            data: res?.data?.records || [],
            success: res?.success,
            total: res?.data?.total || 0,
          };
        }}
        search={{ labelWidth: 100 }}
      />

      <Modal
        open={modalVisible}
        title={current?.id ? '编辑表单' : '新增表单'}
        onOk={handleSubmit}
        onCancel={() => {
          setModalVisible(false);
          setCurrent(undefined);
        }}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="表单名称"
            name="desformName"
            rules={[{ required: true, message: '请输入表单名称' }]}
          >
            <Input placeholder="请输入" />
          </Form.Item>
          <Form.Item label="表单内容" name="desformJson">
            <Input.TextArea placeholder="请输入表单 JSON" rows={4} />
          </Form.Item>
          <Form.Item
            label="是否开启"
            name="isOpen"
            valuePropName="checked"
            initialValue
          >
            <Switch checkedChildren="是" unCheckedChildren="否" />
          </Form.Item>
          <Form.Item label="是否模板" name="isTemplate" valuePropName="checked">
            <Switch checkedChildren="是" unCheckedChildren="否" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={detailVisible}
        title="表单详情"
        onCancel={() => setDetailVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailVisible(false)}>
            关闭
          </Button>,
        ]}
        width={700}
      >
        <pre
          style={{
            background: '#f7f7f7',
            padding: 16,
            borderRadius: 8,
            maxHeight: 520,
            overflow: 'auto',
          }}
        >
          {JSON.stringify(detailData, null, 2)}
        </pre>
      </Modal>

      <Modal
        open={templateVisible}
        title="模板列表"
        onCancel={() => setTemplateVisible(false)}
        footer={[
          <Button key="close" onClick={() => setTemplateVisible(false)}>
            关闭
          </Button>,
        ]}
        width={800}
      >
        <ProTable<DesformItem>
          rowKey="id"
          search={false}
          options={false}
          pagination={false}
          dataSource={templateData}
          columns={[
            { title: 'ID', dataIndex: 'id', width: 80 },
            { title: '名称', dataIndex: 'desformName' },
            {
              title: '创建时间',
              dataIndex: 'createTime',
              valueType: 'dateTime',
            },
          ]}
          size="small"
        />
      </Modal>

      <Modal
        open={groupVisible}
        title="分组列表"
        onCancel={() => setGroupVisible(false)}
        footer={[
          <Button key="close" onClick={() => setGroupVisible(false)}>
            关闭
          </Button>,
        ]}
        width={520}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Space.Compact style={{ width: '100%' }}>
            <Input
              placeholder="请输入新分组名称"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />
            <Button type="primary" onClick={handleCreateGroup}>
              新增分组
            </Button>
          </Space.Compact>
          <Divider style={{ margin: '12px 0' }} />
          <List
            dataSource={groupData}
            renderItem={(item) => <List.Item>{item.name || '-'}</List.Item>}
          />
        </Space>
      </Modal>
    </PageContainer>
  );
};

export default DesformPage;
