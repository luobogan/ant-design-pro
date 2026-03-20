import {
  CheckCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  ExportOutlined,
  EyeOutlined,
  ImportOutlined,
  KeyOutlined,
  MoreOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  SettingOutlined,
  UnlockOutlined,
} from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { useModel, useRequest } from '@umijs/max';
import {
  Button,
  Card,
  Col,
  Collapse,
  Descriptions,
  Input,
  Modal,
  Space,
  Switch,
  Tag,
  Tree,
  message,
} from 'antd';
import type { DataNode } from 'antd/es/tree';
import React, { useEffect, useMemo, useState } from 'react';
import { usePageButtons } from '@/hooks/usePageButtons';
import * as roleApi from '@/services/authority/role';
import * as deptApi from '@/services/system/dept';
import * as positionApi from '@/services/system/position';
import * as userApi from '@/services/system/user';
import UserAdd from './UserAdd';
import UserEdit from './UserEdit';

const { Panel } = Collapse;

interface User {
  id: string;
  account: string;
  name: string;
  realName: string;
  tenantName: string;
  roleName: string;
  deptName: string;
  deptId: string;
  platform: string;
  phone: string;
  email: string;
  sex: number;
  sexName: string;
  birthday: string;
  userCode: string;
  positionName: string;
  managerName: string;
  isManager: number;
  status: number;
  createTime: string;
}

interface DeptNode {
  id: string;
  parentId: string;
  title: string;
  key: string;
  children?: DeptNode[];
}

const UserPage: React.FC = () => {
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [addModalVisible, setAddModalVisible] = useState<boolean>(false);
  const [editModalVisible, setEditModalVisible] = useState<boolean>(false);
  const [viewModalVisible, setViewModalVisible] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [searchValue, setSearchValue] = useState<string>('');
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [pageButtons, setPageButtons] = useState<any[]>([]);

  const { initialState } = useModel('@@initialState');

  // 获取页面按钮权限（自动从路由提取菜单 code）
  const { buttons: pageButtons, loading: buttonsLoading } = usePageButtons();

  // 获取部门树数据
  const { data: deptTreeData, loading: deptLoading } = useRequest(deptApi.tree);

  // 获取角色树数据
  const { data: roleTreeData } = useRequest(roleApi.tree);

  // 获取岗位列表数据
  const { data: positionListData } = useRequest(positionApi.list);

  // 获取页面按钮权限（自动从路由提取菜单 code）
  const { buttons: pageButtons, loading: buttonsLoading } = usePageButtons();

  // 获取用户数据
  const {
    data: userData,
    loading: userLoading,
    refresh,
  } = useRequest(() => userApi.list({ deptId: selectedDeptId || undefined }), {
    refreshDeps: [selectedDeptId],
  });

  // 转换部门树数据
  const deptTree = useMemo(() => {
    const data = Array.isArray(deptTreeData)
      ? deptTreeData
      : deptTreeData?.data || [];
    return data;
  }, [deptTreeData]);

  // 转换角色树数据
  const roleTree = useMemo(() => {
    const data = Array.isArray(roleTreeData)
      ? roleTreeData
      : roleTreeData?.data || [];
    return data;
  }, [roleTreeData]);

  // 转换岗位列表数据
  const positionList = useMemo(() => {
    const records = Array.isArray(positionListData)
      ? positionListData
      : positionListData?.records || positionListData?.data || [];
    return records;
  }, [positionListData]);

  // 转换用户数据
  const users = useMemo(() => {
    const records = Array.isArray(userData)
      ? userData
      : userData?.records || userData?.data || [];
    return records.map((user: any) => ({
      ...user,
      account: user.account || user.username || '',
      realName: user.realName || user.name || '',
      tenantName: user.tenantName || '管理组',
      roleName: user.roleName || user.role || '暂无分配',
      deptName: user.deptName || '暂无分配',
      platform: user.platform || 'web',
      sexName: user.sex === 1 ? '男' : user.sex === 2 ? '女' : '未知',
    }));
  }, [userData]);

  // 构建树形数据
  const buildTreeData = (data: DeptNode[]): DataNode[] => {
    return data.map((item) => ({
      key: item.id,
      title: item.title,
      children: item.children ? buildTreeData(item.children) : undefined,
    }));
  };

  // 获取所有部门ID用于默认展开
  React.useEffect(() => {
    if (deptTree.length > 0) {
      const getAllKeys = (data: DeptNode[]): string[] => {
        let keys: string[] = [];
        data.forEach((item) => {
          keys.push(item.id);
          if (item.children) {
            keys = keys.concat(getAllKeys(item.children));
          }
        });
        return keys;
      };
      setExpandedKeys(getAllKeys(deptTree));
    }
  }, [deptTree]);

  // 处理部门选择
  const handleDeptSelect = (selectedKeys: React.Key[], _info: any) => {
    if (selectedKeys.length > 0) {
      setSelectedDeptId(selectedKeys[0] as string);
    } else {
      setSelectedDeptId('');
    }
  };

  // 处理展开/折叠
  const handleExpand = (expandedKeys: React.Key[]) => {
    setExpandedKeys(expandedKeys);
  };

  const columns: ProColumns<User>[] = [
    {
      title: '登录账号',
      dataIndex: 'account',
      key: 'account',
      search: true,
      width: 120,
    },
    {
      title: '所属租户',
      dataIndex: 'tenantName',
      key: 'tenantName',
      width: 120,
      render: (tenantName) => <Tag color="blue">{tenantName}</Tag>,
    },
    {
      title: '用户姓名',
      dataIndex: 'realName',
      key: 'realName',
      search: true,
      width: 120,
    },
    {
      title: '所属角色',
      dataIndex: 'roleName',
      key: 'roleName',
      width: 150,
      render: (roleName) => <Tag color="cyan">{roleName || '暂无分配'}</Tag>,
    },
    {
      title: '所属部门',
      dataIndex: 'deptName',
      key: 'deptName',
      width: 150,
      render: (deptName) => (
        <span style={{ color: '#1890ff' }}>{deptName || '暂无分配'}</span>
      ),
    },
    {
      title: '用户平台',
      dataIndex: 'platform',
      key: 'platform',
      width: 100,
      render: (platform) => <Tag color="purple">{platform || 'web'}</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: any, record: User) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => {
              setCurrentUser(record);
              setViewModalVisible(true);
            }}
          >
            查看
          </Button>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => {
              setCurrentUser(record);
              setEditModalVisible(true);
            }}
          >
            编辑
          </Button>
          <Button type="link" icon={<MoreOutlined />}>
            更多
          </Button>
        </Space>
      ),
    },
  ];

  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要删除的用户');
      return;
    }
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除选中的 ${selectedRowKeys.length} 个用户吗？`,
      onOk: async () => {
        try {
          // 将 React.Key[] 转换为 string[]
          const idList = selectedRowKeys.map((id) => String(id));
          await userApi.remove({ ids: idList });
          message.success('删除成功');
          setSelectedRowKeys([]);
          refresh();
        } catch (_error) {
          message.error('删除失败');
        }
      },
    });
  };

  const handleResetPassword = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要重置密码的用户');
      return;
    }
    Modal.confirm({
      title: '重置密码确认',
      content: '确定将选择账号密码重置为初始密码?',
      onOk: async () => {
        try {
          message.success('密码重置成功');
        } catch (_error) {
          message.error('密码重置失败');
        }
      },
    });
  };

  // 查看详情内容
  const ViewContent = ({ user }: { user: User }) => (
    <Collapse defaultActiveKey={['1', '2', '3']}>
      <Panel header="基础信息" key="1">
        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label="所属租户">
            {user.tenantName}
          </Descriptions.Item>
          <Descriptions.Item label="用户平台">
            {user.platform?.toUpperCase()}
          </Descriptions.Item>
          <Descriptions.Item label="登录账号">{user.account}</Descriptions.Item>
          <Descriptions.Item label="用户状态">
            <Tag color={user.status === 1 ? 'green' : 'red'}>
              {user.status === 1 ? '启用' : '禁用'}
            </Tag>
          </Descriptions.Item>
        </Descriptions>
      </Panel>
      <Panel header="详细信息" key="2">
        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label="用户昵称">{user.name}</Descriptions.Item>
          <Descriptions.Item label="用户姓名">
            {user.realName}
          </Descriptions.Item>
          <Descriptions.Item label="手机号码">
            {user.phone?.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')}
          </Descriptions.Item>
          <Descriptions.Item label="电子邮箱">
            {user.email?.replace(/(.{2}).+(@.+)/, '$1***$2')}
          </Descriptions.Item>
          <Descriptions.Item label="用户性别">{user.sexName}</Descriptions.Item>
          <Descriptions.Item label="用户生日">
            {user.birthday}
          </Descriptions.Item>
        </Descriptions>
      </Panel>
      <Panel header="职责信息" key="3">
        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label="用户编号">
            {user.userCode || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="所属角色">
            <Tag color="blue">{user.roleName}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="所属部门">
            {user.deptName?.split(',').map((d, i) => (
              <Tag key={i} color="cyan">
                {d}
              </Tag>
            ))}
          </Descriptions.Item>
          <Descriptions.Item label="所属岗位">
            <Tag color="orange">{user.positionName || '-'}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="直属主管">
            {user.managerName || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="是否主管">
            <Switch
              checked={user.isManager === 1}
              disabled
              checkedChildren="是"
              unCheckedChildren="否"
            />
          </Descriptions.Item>
        </Descriptions>
      </Panel>
    </Collapse>
  );

  return (
    <PageContainer
      title="用户管理"
      subTitle="管理系统用户，包括添加、编辑、删除用户等操作"
      extra={pageButtons
        .filter((btn) => btn.action === 1 || btn.action === 3)
        .map((btn) => (
          <Button
            key={btn.code}
            type={btn.alias === 'add' ? 'primary' : 'default'}
          >
            {btn.name}
          </Button>
        ))}
    >
      <Row gutter={16}>
        {/* 左侧部门树 */}
        <Col span={5}>
          <Card
            title="组织机构"
            extra={
              <Button
                type="text"
                icon={<ReloadOutlined />}
                onClick={() => refresh()}
                size="small"
              />
            }
            loading={deptLoading}
            bodyStyle={{ padding: '12px', minHeight: '600px' }}
          >
            <Input
              placeholder="输入关键字进行过滤"
              prefix={<SearchOutlined />}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              style={{ marginBottom: 12 }}
            />
            <Tree
              treeData={buildTreeData(deptTree)}
              onSelect={handleDeptSelect}
              expandedKeys={expandedKeys}
              onExpand={handleExpand}
              selectable
              showLine
              showIcon={false}
              style={{ maxHeight: '500px', overflow: 'auto' }}
            />
          </Card>
        </Col>

        {/* 右侧用户列表 */}
        <Col span={19}>
          <ProTable
            columns={columns}
            dataSource={users}
            loading={userLoading}
            rowKey="id"
            pagination={{ pageSize: 10 }}
            rowSelection={{
              selectedRowKeys,
              onChange: (keys) => setSelectedRowKeys(keys),
            }}
            toolBarRender={() => [
              pageButtons.some((btn) => btn.code === 'user_add') && (
                <Button
                  key="add"
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => setAddModalVisible(true)}
                >
                  新增
                </Button>
              ),
              pageButtons.some((btn) => btn.code === 'user_delete') && (
                <Button
                  key="delete"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={handleBatchDelete}
                  disabled={selectedRowKeys.length === 0}
                >
                  删除
                </Button>
              ),
              pageButtons.some((btn) => btn.code === 'user_audit') && (
                <Button key="audit" icon={<CheckCircleOutlined />}>
                  审核
                </Button>
              ),
              pageButtons.some((btn) => btn.code === 'user_role') && (
                <Button key="role" icon={<SettingOutlined />}>
                  角色配置
                </Button>
              ),
              pageButtons.some((btn) => btn.code === 'user_password') && (
                <Button
                  key="password"
                  icon={<KeyOutlined />}
                  onClick={handleResetPassword}
                >
                  密码重置
                </Button>
              ),
              pageButtons.some((btn) => btn.code === 'user_unlock') && (
                <Button key="unlock" icon={<UnlockOutlined />}>
                  账户解封
                </Button>
              ),
              pageButtons.some((btn) => btn.code === 'user_import') && (
                <Button key="import" icon={<ImportOutlined />}>
                  导入
                </Button>
              ),
              pageButtons.some((btn) => btn.code === 'user_export') && (
                <Button key="export" icon={<ExportOutlined />}>
                  导出
                </Button>
              ),
            ].filter(Boolean)}
            search={{
              labelWidth: 'auto',
            }}
          />
        </Col>
      </Row>

      {/* 新增用户弹窗 */}
      <Modal
        title="新增用户"
        open={addModalVisible}
        onCancel={() => setAddModalVisible(false)}
        footer={null}
        width={800}
      >
        <UserAdd
          onOk={() => {
            setAddModalVisible(false);
            refresh();
          }}
          onCancel={() => setAddModalVisible(false)}
          roleTree={roleTree}
          deptTree={deptTree}
          positionList={positionList}
        />
      </Modal>

      {/* 编辑用户弹窗 */}
      <Modal
        title="编辑用户"
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        footer={null}
        width={800}
      >
        {currentUser && (
          <UserEdit
            user={currentUser}
            onOk={() => {
              setEditModalVisible(false);
              refresh();
            }}
            onCancel={() => setEditModalVisible(false)}
            roleTree={roleTree}
            deptTree={deptTree}
            positionList={positionList}
          />
        )}
      </Modal>

      {/* 查看用户弹窗 */}
      <Modal
        title="查看用户"
        open={viewModalVisible}
        onCancel={() => setViewModalVisible(false)}
        footer={[
          <Button key="ok" onClick={() => setViewModalVisible(false)}>
            确定
          </Button>,
        ]}
        width={800}
      >
        <div style={{ padding: '24px' }}>
          {currentUser && <ViewContent user={currentUser} />}
        </div>
      </Modal>
    </PageContainer>
  );
};

export default UserPage;
