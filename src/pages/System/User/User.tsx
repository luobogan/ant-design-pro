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
  SwapOutlined,
  UnlockOutlined,
} from '@ant-design/icons';
import type { ProColumns, ActionType } from '@ant-design/pro-components';
import { PageContainer } from '@ant-design/pro-components';
import StandardTable from '@/components/StandardTable';
import { useModel, useRequest } from '@umijs/max';
import {
  Button,
  Card,
  Col,
  Collapse,
  Descriptions,
  Input,
  Modal,
  Row,
  Space,
  Switch,
  Tag,
  Tree,
  message,
} from 'antd';
import type { DataNode } from 'antd/es/tree';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { usePageButtons } from '@/hooks/usePageButtons';
import * as roleApi from '@/services/authority/role';
import * as deptApi from '@/services/system/dept';
import * as postApi from '@/pages/System/Post/service';
import * as userApi from '@/services/system/user';
import UserAdd from './UserAdd';
import UserEdit from './UserEdit';
import UserStatusFlowModal from './UserStatusFlowModal';

const { Panel } = Collapse;

/** 组织树顶层「公司」虚拟根节点 key（点击=查看全部用户；真实公司/分部/部门节点在其下） */
const COMPANY_ROOT_KEY = '__company__';

/** 人员状态 Tag 配色：在职态(0试用/1正式)绿、临时/延期蓝、退休金、解聘(4)红（该账号登录会被拦截） */
const personStatusColor = (status?: number) => {
  if (status === undefined || status === null) return 'default';
  if (status === 4) return 'red';
  if (status === 5) return 'gold';
  return status === 0 || status === 1 ? 'green' : 'blue';
};

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
  workCode: string;
  personStatus: number;
  personStatusName: string;
  certificateNum: string;
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
  const [statusFlowModalVisible, setStatusFlowModalVisible] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [searchValue, setSearchValue] = useState<string>('');
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);

  const { initialState } = useModel('@@initialState');

  // 获取页面按钮权限（自动从路由提取菜单 code）
  const { buttons: pageButtons, loading: buttonsLoading } = usePageButtons();

  // 获取部门树数据
  const { data: deptTreeData, loading: deptLoading } = useRequest(deptApi.tree);

  // 获取角色树数据
  const { data: roleTreeData } = useRequest(roleApi.tree);

  // 获取岗位列表数据
  const { data: positionListData } = useRequest(postApi.list);

  // 用户列表：服务端分页（ProTable request 模式）——current/size 传后端，
  // 组织树子树过滤（deptId）+ 租户过滤（tenantId）均由后端完成
  const tableRef = useRef<ActionType>();
  const usersRef = useRef<User[]>([]);
  const myTenantId = (initialState?.currentUser as any)?.tenantId as
    | string
    | undefined;

  /**
   * ProTable 列头排序 → Blade 的 ascs/descs 信封参数。
   * 值为**数据库列名**（Blade 直接拼进 ORDER BY，见 Condition.getPage）。
   * ⚠️ 只能登记 blade_user 表里真实存在的列；managerName 是 UserWrapper 依据
   * managerId 回填的计算字段（表里无 manager_name 列），登记进去会导致 SQL 报错，
   * 故该列走前端排序（见 columns）。
   */
  const SORT_FIELD_MAP: Record<string, string> = {
    realName: 'real_name',
    account: 'account',
    workCode: 'work_code',
  };

  const fetchUsers = async (params: any, sort?: any) => {
    const {
      current = 1,
      pageSize = 10,
      account,
      realName,
      workCode,
      deptId,
      tenantId,
    } = params || {};

    // sort = { realName: 'ascend' | 'descend' }，取第一个生效的排序字段
    let ascs: string | undefined;
    let descs: string | undefined;
    const sortKey = Object.keys(sort || {})[0];
    if (sortKey && SORT_FIELD_MAP[sortKey]) {
      if (sort[sortKey] === 'ascend') ascs = SORT_FIELD_MAP[sortKey];
      else if (sort[sortKey] === 'descend') descs = SORT_FIELD_MAP[sortKey];
    }

    const res = await userApi.list({
      current: current ?? 1,
      // blade-tool Query 已新增 pageSize 字段兼容 ProTable 原生分页参数（getSize() 优先取 pageSize），
      // 且 Condition.getQueryWrapper 已将 pageSize 从查询列排除，可直接透传
      pageSize: pageSize ?? 10,
      account: account || undefined,
      realName: realName || undefined,
      workCode: workCode || undefined,
      deptId: deptId || undefined,
      tenantId: tenantId || undefined,
      ascs,
      descs,
    });
    const page = Array.isArray(res)
      ? { records: res, total: res.length }
      : res?.records
        ? res
        : res?.data || { records: [], total: 0 };
    const records = (page.records || []).map((user: any) => ({
      ...user,
      account: user.account || user.username || '',
      realName: user.realName || user.name || '',
      tenantName: user.tenantName || '管理组',
      roleName: user.roleName || user.role || '暂无分配',
      deptName: user.deptName || '暂无分配',
      platform: user.platform || 'web',
      sexName: user.sex === 1 ? '男' : user.sex === 2 ? '女' : '未知',
      personStatusName:
        userApi.PERSON_STATUS_TEXT[user.personStatus as number] || '-',
    }));
    usersRef.current = records as User[];
    return { data: records, total: page.total ?? records.length, success: true };
  };

  // 转换部门树数据，并在最顶层叠加「公司」节点（对齐 ecology 组织树根为公司档案；租户名缺失时仅显示「公司」）
  const tenantName = (initialState?.currentUser as any)?.tenantName as
    | string
    | undefined;
  const deptTree = useMemo(() => {
    const data = Array.isArray(deptTreeData)
      ? deptTreeData
      : deptTreeData?.data || [];
    return [
      {
        id: COMPANY_ROOT_KEY,
        parentId: '-1',
        key: COMPANY_ROOT_KEY,
        title: tenantName ? `公司：${tenantName}` : '公司',
        children: data,
      },
    ];
  }, [deptTreeData, tenantName]);

  // 树节点 id → title 映射（列表顶部过滤标签用）
  const deptTitleMap = useMemo(() => {
    const map = new Map<string, string>();
    const walk = (nodes: DeptNode[]) =>
      nodes.forEach((n) => {
        map.set(n.id, n.title);
        if (n.children) walk(n.children);
      });
    walk(deptTree);
    return map;
  }, [deptTree]);

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

  // 处理部门选择（公司根节点/取消选择 = 查看全部；其余节点由后端按子树过滤）
  const handleDeptSelect = (selectedKeys: React.Key[], _info: any) => {
    const key = selectedKeys[0] as string;
    setSelectedDeptId(!key || key === COMPANY_ROOT_KEY ? '' : key);
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
      title: '工号',
      dataIndex: 'workCode',
      key: 'workCode',
      search: true,
      width: 110,
      render: (workCode) => workCode || '-',
    },
    {
      title: '人员状态',
      dataIndex: 'personStatus',
      key: 'personStatus',
      width: 90,
      render: (_, record: User) => (
        // P3-5 口径：在职 = 0/1/2/3/5，解聘(4) 灰红（该账号登录将被拦截）
        <Tag color={personStatusColor(record.personStatus)}>
          {record.personStatusName || '-'}
        </Tag>
      ),
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
      // 后端排序：走 ascs/descs = real_name（全量数据排序，分页也准确）
      sorter: true,
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
      // 直属上级：后端 UserWrapper 依据 managerId 回填 managerName（DB 默认 -1 = 无主管）
      title: '直属上级',
      dataIndex: 'managerName',
      key: 'managerName',
      width: 120,
      // ⚠️ 前端排序（仅当前页）：blade_user 表没有 manager_name 列（该值是 wrapper 计算回填），
      // 无法走后端 ORDER BY。需要全量排序时得改后端 join 上级表，见 SORT_FIELD_MAP 注释。
      // localeCompare + zh-Hans-CN 保证中文按拼音序而非 UTF-8 码点序。
      sorter: (a: User, b: User) =>
        (a.managerName || '').localeCompare(b.managerName || '', 'zh-Hans-CN'),
      render: (managerName) => (
        <span style={{ color: managerName ? '#52c41a' : '#999' }}>
          {managerName || '无'}
        </span>
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
          <Button
            type="link"
            icon={<SwapOutlined />}
            onClick={() => {
              setCurrentUser(record);
              setStatusFlowModalVisible(true);
            }}
          >
            办理
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
          tableRef.current?.reload();
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
          <Descriptions.Item label="工号">{user.workCode || '-'}</Descriptions.Item>
          <Descriptions.Item label="用户状态">
            <Tag color={user.status === 1 ? 'green' : 'red'}>
              {user.status === 1 ? '启用' : '禁用'}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="人员状态">
            <Tag
              color={
                user.personStatus === 0 || user.personStatus === 1
                  ? 'green'
                  : user.personStatus === 3 || user.personStatus === 2
                    ? 'blue'
                    : 'red'
              }
            >
              {user.personStatusName || '-'}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="证件号">
            {user.certificateNum?.replace(/(\d{4})\d+(\d{3})/, '$1***********$2') || '-'}
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
                onClick={() => tableRef.current?.reload()}
                size="small"
              />
            }
            loading={deptLoading}
            styles={{ body: { padding: '12px', minHeight: '600px' } }}
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
          {selectedDeptId && (
            <div style={{ marginBottom: 8 }}>
              <Tag
                closable
                color="blue"
                onClose={() => setSelectedDeptId('')}
              >
                组织过滤：{deptTitleMap.get(selectedDeptId) || selectedDeptId}
              </Tag>
            </div>
          )}
          <StandardTable<User>
            columns={columns}
            actionRef={tableRef}
            request={fetchUsers}
            params={{
              deptId: selectedDeptId || undefined,
              tenantId: myTenantId || undefined,
            }}
            rowKey="id"
            pagination={{ defaultPageSize: 10, showSizeChanger: true }}
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
              <Button
                key="status-flow"
                icon={<SwapOutlined />}
                disabled={selectedRowKeys.length !== 1}
                onClick={() => {
                  const target = usersRef.current.find(
                    (u) => String(u.id) === String(selectedRowKeys[0]),
                  );
                  if (!target) {
                    message.warning('请选择一条用户记录');
                    return;
                  }
                  setCurrentUser(target);
                  setStatusFlowModalVisible(true);
                }}
              >
                办理状态变更
              </Button>,
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
            tableRef.current?.reload();
          }}
          onSaved={() => tableRef.current?.reload()}
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
              tableRef.current?.reload();
            }}
            onCancel={() => setEditModalVisible(false)}
            roleTree={roleTree}
            deptTree={deptTree}
            positionList={positionList}
          />
        )}
      </Modal>

      {/* 办理状态变更弹窗（P3-2） */}
      <UserStatusFlowModal
        open={statusFlowModalVisible}
        user={currentUser}
        onCancel={() => setStatusFlowModalVisible(false)}
        onOk={() => {
          setStatusFlowModalVisible(false);
          tableRef.current?.reload();
        }}
      />

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
