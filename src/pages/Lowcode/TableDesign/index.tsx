import {
  ApiOutlined,
  CodeOutlined,
  CopyOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  EditOutlined,
  EllipsisOutlined,
  EyeOutlined,
  FileOutlined,
  FunctionOutlined,
  LockOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
  SearchOutlined,
  SettingOutlined,
  TeamOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import {
  Button,
  Card,
  Col,
  DatePicker,
  Drawer,
  Dropdown,
  Form,
  Input,
  Modal,
  message,
  Popconfirm,
  Row,
  Select,
  Space,
  Switch,
  Tabs,
  Tag,
  Tooltip,
  Tree,
} from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import {
  type DbformItem,
  type GroupDbformItem,
  getDbformDetail,
  getDbformPage,
  getGroupDbformTree,
  removeDbform,
  removeGroupDbform,
  saveDbform,
  saveGroupDbform,
  syncDbformDb,
  updateDbform,
} from '@/services/lowcode/dbform';
import ButtonConfigDrawer from './components/ButtonConfigDrawer';
import EnhanceDrawer from './components/EnhanceDrawer';
import FieldConfigDrawer from './components/FieldConfigDrawer';

const TableDesign: React.FC = () => {
  const actionRef = useRef<ActionType>(null);
  const [form] = Form.useForm();
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentRow, setCurrentRow] = useState<DbformItem | null>(null);
  const [groupTree, setGroupTree] = useState<GroupDbformItem[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [fieldDrawerVisible, setFieldDrawerVisible] = useState(false);
  const [buttonDrawerVisible, setButtonDrawerVisible] = useState(false);
  const [enhanceDrawerVisible, setEnhanceDrawerVisible] = useState(false);
  const [enhanceType, setEnhanceType] = useState<'sql' | 'java' | 'js'>('sql');
  const [groupFormVisible, setGroupFormVisible] = useState(false);
  const [groupForm] = Form.useForm();
  const [searchParams, setSearchParams] = useState({
    tableName: '',
    tableDescribe: '',
    tableType: '',
    isDbSync: '',
    groupId: '',
    startTime: undefined,
    endTime: undefined,
  });

  // 字段管理状态
  const [fields, setFields] = useState<any[]>([]);
  const [currentField, setCurrentField] = useState<any>(null);
  const [fieldForm] = Form.useForm();

  useEffect(() => {
    loadGroupTree();
  }, []);

  const loadGroupTree = async () => {
    const res = await getGroupDbformTree();
    if (res.code === 200) {
      setGroupTree(res.data || []);
    }
  };

  const tableTypeMap: Record<number, { text: string; color: string }> = {
    1: { text: '单表', color: 'blue' },
    2: { text: '树表', color: 'green' },
    3: { text: '主表', color: 'orange' },
    4: { text: '附表', color: 'purple' },
  };

  const syncStatusMap: Record<string, { text: string; color: string }> = {
    Y: { text: '已同步', color: 'success' },
    N: { text: '未同步', color: 'warning' },
  };

  const columns: ProColumns<DbformItem>[] = [
    {
      title: '序号',
      valueType: 'index',
      width: 60,
      align: 'center',
    },
    {
      title: '表名',
      dataIndex: 'tableName',
      width: 180,
      ellipsis: true,
      copyable: true,
      filters: [
        { text: 'user', value: 'user' },
        { text: 'order', value: 'order' },
      ],
    },
    {
      title: '表描述',
      dataIndex: 'tableDescribe',
      width: 220,
      ellipsis: true,
    },
    {
      title: '表类型',
      dataIndex: 'tableType',
      width: 100,
      align: 'center',
      filters: [
        { text: '单表', value: 1 },
        { text: '树表', value: 2 },
        { text: '主表', value: 3 },
        { text: '附表', value: 4 },
      ],
      render: (_, record) => {
        const type = tableTypeMap[record.tableType || 1];
        return <Tag color={type?.color}>{type?.text}</Tag>;
      },
    },
    {
      title: '同步状态',
      dataIndex: 'isDbSync',
      width: 100,
      align: 'center',
      filters: [
        { text: '已同步', value: 'Y' },
        { text: '未同步', value: 'N' },
      ],
      render: (_, record) => {
        const status = syncStatusMap[record.isDbSync || 'N'];
        return <Tag color={status?.color}>{status?.text}</Tag>;
      },
    },
    {
      title: '创建人',
      dataIndex: 'createUser',
      width: 120,
      align: 'center',
      render: (_, record) => (
        <Tooltip title="创建人">
          <span>{record.createUser || '-'}</span>
        </Tooltip>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createTime',
      valueType: 'dateTime',
      width: 180,
      align: 'center',
    },
    {
      title: '更新时间',
      dataIndex: 'updateTime',
      valueType: 'dateTime',
      width: 180,
      align: 'center',
    },
    {
      title: '操作',
      valueType: 'option',
      width: 320,
      fixed: 'right',
      align: 'center',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="编辑">
            <Button
              type="primary"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            >
              编辑
            </Button>
          </Tooltip>
          <Tooltip title="字段配置">
            <Button
              size="small"
              icon={<SettingOutlined />}
              onClick={() => {
                setCurrentRow(record);
                setFieldDrawerVisible(true);
              }}
            >
              字段配置
            </Button>
          </Tooltip>
          <Tooltip title="按钮配置">
            <Button
              size="small"
              icon={<ThunderboltOutlined />}
              onClick={() => {
                setCurrentRow(record);
                setButtonDrawerVisible(true);
              }}
            >
              按钮配置
            </Button>
          </Tooltip>
          <Dropdown
            menu={{
              items: [
                { key: 'sql', icon: <DatabaseOutlined />, label: 'SQL增强' },
                { key: 'java', icon: <FunctionOutlined />, label: 'JAVA增强' },
                { key: 'js', icon: <CodeOutlined />, label: 'JS增强' },
                { type: 'divider' },
                { key: 'sync', icon: <ApiOutlined />, label: '同步数据库' },
                { key: 'copy', icon: <CopyOutlined />, label: '复制表单' },
                { key: 'preview', icon: <EyeOutlined />, label: '预览' },
                { key: 'export', icon: <FileOutlined />, label: '导出' },
                { type: 'divider' },
                {
                  key: 'delete',
                  icon: <DeleteOutlined />,
                  label: '删除',
                  danger: true,
                },
              ],
              onClick: ({ key }) => handleMenuClick(key, record),
            }}
          >
            <Button size="small" icon={<EllipsisOutlined />}>
              更多
            </Button>
          </Dropdown>
        </Space>
      ),
    },
  ];

  const handleMenuClick = (key: string, record: DbformItem) => {
    switch (key) {
      case 'field':
        setCurrentRow(record);
        setFieldDrawerVisible(true);
        break;
      case 'button':
        setCurrentRow(record);
        setButtonDrawerVisible(true);
        break;
      case 'sql':
        setCurrentRow(record);
        setEnhanceType('sql');
        setEnhanceDrawerVisible(true);
        break;
      case 'java':
        setCurrentRow(record);
        setEnhanceType('java');
        setEnhanceDrawerVisible(true);
        break;
      case 'js':
        setCurrentRow(record);
        setEnhanceType('js');
        setEnhanceDrawerVisible(true);
        break;
      case 'sync':
        handleSyncDb(record);
        break;
      case 'copy':
        handleCopy(record);
        break;
      case 'preview':
        message.info('预览功能开发中');
        break;
      case 'delete':
        handleDelete(record);
        break;
    }
  };

  const handleAdd = () => {
    setCurrentRow(null);
    form.resetFields();
    setDrawerVisible(true);
  };

  const handleEdit = async (record: DbformItem) => {
    const res = await getDbformDetail(record.id);
    if (res.code === 200) {
      setCurrentRow(res.data);
      form.setFieldsValue(res.data);
      setDrawerVisible(true);
    }
  };

  const handleDelete = async (record: DbformItem) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除表单「${record.tableDescribe}」吗？`,
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        const res = await removeDbform(record.id);
        if (res.code === 200) {
          message.success('删除成功');
          actionRef.current?.reload();
        } else {
          message.error(res.msg || '删除失败');
        }
      },
    });
  };

  const handleSyncDb = async (record: DbformItem) => {
    Modal.confirm({
      title: '同步数据库',
      content: `确定要将表单「${record.tableDescribe}」同步到数据库吗？`,
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        const res = await syncDbformDb(record.id);
        if (res.code === 200) {
          message.success('同步成功');
          actionRef.current?.reload();
        } else {
          message.error(res.msg || '同步失败');
        }
      },
    });
  };

  const handleCopy = async (record: DbformItem) => {
    Modal.confirm({
      title: '复制表单',
      content: `确定要复制表单「${record.tableDescribe}」吗？`,
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        const res = await getDbformDetail(record.id);
        if (res.code === 200) {
          const newData = {
            ...res.data,
            id: undefined,
            tableName: `${res.data.tableName}_copy`,
            tableDescribe: `${res.data.tableDescribe}(复制)`,
            isDbSync: 'N',
          };
          const saveRes = await saveDbform(newData as DbformItem);
          if (saveRes.code === 200) {
            message.success('复制成功');
            actionRef.current?.reload();
          } else {
            message.error(saveRes.msg || '复制失败');
          }
        }
      },
    });
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      // 构建完整的表单数据，包括字段配置
      const formData = {
        ...values,
        fields: fields,
      };
      let res;
      if (currentRow?.id) {
        res = await updateDbform({ ...formData, id: currentRow.id });
      } else {
        res = await saveDbform(formData);
      }
      if (res.code === 200) {
        message.success('保存成功');
        setDrawerVisible(false);
        actionRef.current?.reload();
      } else {
        message.error(res.msg || '保存失败');
      }
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  const handleGroupClick = (groupId: string) => {
    setSelectedGroupId(groupId);
    actionRef.current?.reload();
  };

  const handleAddGroup = () => {
    groupForm.resetFields();
    setGroupFormVisible(true);
  };

  const handleSaveGroup = async () => {
    try {
      const values = await groupForm.validateFields();
      const res = await saveGroupDbform(values);
      if (res.code === 200) {
        message.success('保存成功');
        setGroupFormVisible(false);
        loadGroupTree();
      } else {
        message.error(res.msg || '保存失败');
      }
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除该分组吗？',
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        const res = await removeGroupDbform(groupId);
        if (res.code === 200) {
          message.success('删除成功');
          loadGroupTree();
        } else {
          message.error(res.msg || '删除失败');
        }
      },
    });
  };

  const handleSearchParamChange = (key: string, value: any) => {
    setSearchParams((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSearch = () => {
    actionRef.current?.reload();
  };

  const handleReset = () => {
    setSearchParams({
      tableName: '',
      tableDescribe: '',
      tableType: '',
      isDbSync: '',
      groupId: '',
      startTime: undefined,
      endTime: undefined,
    });
    actionRef.current?.reload();
  };

  const handleAdvancedSearch = () => {
    message.info('高级搜索功能开发中');
  };

  const handleBatchOperation = () => {
    message.info('批量操作功能开发中');
  };

  // 字段管理函数
  const handleAddField = (fieldType: string) => {
    // 生成唯一的字段编码
    let newFieldName = `field_${fields.length + 1}`;
    let counter = 1;
    while (fields.some((field) => field.fieldName === newFieldName)) {
      newFieldName = `field_${fields.length + 1}_${counter}`;
      counter++;
    }

    const newField = {
      id: Date.now(),
      fieldName: newFieldName,
      fieldLabel: `字段${fields.length + 1}`,
      fieldType: fieldType === 'text' ? 'string' : 'string',
      fieldLength: 50,
      isRequired: false,
      isUnique: false,
      isSearch: false,
      isTable: true,
      defaultValue: '',
    };
    setFields([...fields, newField]);
    message.success('添加字段成功');
  };

  const handleEditField = (field: any) => {
    setCurrentField(field);
    fieldForm.setFieldsValue(field);
  };

  const handleDeleteField = (fieldId: number) => {
    setFields(fields.filter((field) => field.id !== fieldId));
    message.success('删除字段成功');
  };

  const _handleSaveField = async () => {
    try {
      const values = await fieldForm.validateFields();

      // 字段编码唯一性校验
      const isDuplicate = fields.some(
        (field) =>
          field.fieldName === values.fieldName && field.id !== currentField?.id,
      );

      if (isDuplicate) {
        message.error('字段编码已存在，请修改');
        return;
      }

      // 类型-长度匹配校验
      if (
        values.fieldType === 'Integer' &&
        (!values.fieldLength || values.fieldLength < 1)
      ) {
        message.error('整数长度不能为0');
        return;
      }

      if (currentField) {
        setFields(
          fields.map((field) =>
            field.id === currentField.id ? { ...field, ...values } : field,
          ),
        );
        message.success('编辑字段成功');
      } else {
        const newField = {
          id: Date.now(),
          ...values,
        };
        setFields([...fields, newField]);
        message.success('添加字段成功');
      }
      fieldForm.resetFields();
      setCurrentField(null);
    } catch (error) {
      console.error('字段验证失败:', error);
    }
  };

  const _handleSelectAllFields = () => {
    // 全选逻辑
    message.info('全选功能开发中');
  };

  const _handleReverseSelectFields = () => {
    // 反选逻辑
    message.info('反选功能开发中');
  };

  const handleDeleteSelectedFields = () => {
    // 删除选中字段逻辑
    message.info('删除选中字段功能开发中');
  };

  const treeData = groupTree.map((item) => ({
    key: item.id,
    title: (
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>{item.groupName}</span>
        <Space size={0}>
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              groupForm.setFieldsValue(item);
              setGroupFormVisible(true);
            }}
          />
          <Popconfirm
            title="确定要删除该分组吗？"
            onConfirm={(e) => {
              e?.stopPropagation();
              handleDeleteGroup(item.id);
            }}
            onCancel={(e) => e?.stopPropagation()}
          >
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={(e) => e.stopPropagation()}
            />
          </Popconfirm>
        </Space>
      </div>
    ),
    icon: item.groupIcon,
  }));

  return (
    <PageContainer>
      <Row gutter={16}>
        <Col span={4}>
          <Card
            title="分组"
            size="small"
            extra={
              <Button
                type="link"
                size="small"
                icon={<PlusOutlined />}
                onClick={handleAddGroup}
              >
                新增
              </Button>
            }
            style={{ height: 'calc(100vh - 180px)', overflow: 'auto' }}
          >
            <Tree
              showIcon
              defaultExpandAll
              selectedKeys={selectedGroupId ? [selectedGroupId] : []}
              treeData={[
                {
                  key: 'all',
                  title: '全部',
                  icon: <DatabaseOutlined />,
                },
                ...treeData,
              ]}
              onSelect={(keys) => {
                if (keys[0] && keys[0] !== 'all') {
                  handleGroupClick(keys[0] as string);
                } else {
                  setSelectedGroupId(null);
                  actionRef.current?.reload();
                }
              }}
            />
          </Card>
        </Col>
        <Col span={20}>
          <Card style={{ marginBottom: 16 }}>
            <Row gutter={16} align="middle">
              <Col flex="auto">
                <Space>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={handleAdd}
                  >
                    新建表单
                  </Button>
                  <Button icon={<SaveOutlined />}>保存配置</Button>
                  <Button icon={<ReloadOutlined />}>刷新</Button>
                  <Dropdown
                    menu={{
                      items: [
                        {
                          key: 'import',
                          icon: <FileOutlined />,
                          label: '导入',
                        },
                        {
                          key: 'export',
                          icon: <FileOutlined />,
                          label: '导出',
                        },
                        {
                          key: 'template',
                          icon: <FileOutlined />,
                          label: '模板管理',
                        },
                      ],
                    }}
                  >
                    <Button icon={<FileOutlined />}>更多操作</Button>
                  </Dropdown>
                </Space>
              </Col>
              <Col>
                <Space>
                  <Button icon={<SettingOutlined />}>系统设置</Button>
                  <Button icon={<LockOutlined />}>权限管理</Button>
                  <Button icon={<TeamOutlined />}>团队协作</Button>
                </Space>
              </Col>
            </Row>
          </Card>

          <Card>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={8}>
                <Input
                  placeholder="表名"
                  prefix={<SearchOutlined />}
                  value={searchParams.tableName}
                  onChange={(e) =>
                    handleSearchParamChange('tableName', e.target.value)
                  }
                />
              </Col>
              <Col span={8}>
                <Input
                  placeholder="表描述"
                  prefix={<FileOutlined />}
                  value={searchParams.tableDescribe}
                  onChange={(e) =>
                    handleSearchParamChange('tableDescribe', e.target.value)
                  }
                />
              </Col>
              <Col span={8}>
                <Select
                  placeholder="表类型"
                  options={[
                    { value: '', label: '全部类型' },
                    { value: 1, label: '单表' },
                    { value: 2, label: '树表' },
                    { value: 3, label: '主表' },
                    { value: 4, label: '附表' },
                  ]}
                  value={searchParams.tableType}
                  onChange={(value) =>
                    handleSearchParamChange('tableType', value)
                  }
                />
              </Col>
            </Row>

            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={8}>
                <Select
                  placeholder="同步状态"
                  options={[
                    { value: '', label: '全部状态' },
                    { value: 'Y', label: '已同步' },
                    { value: 'N', label: '未同步' },
                  ]}
                  value={searchParams.isDbSync}
                  onChange={(value) =>
                    handleSearchParamChange('isDbSync', value)
                  }
                />
              </Col>
              <Col span={8}>
                <Select
                  placeholder="所属分组"
                  options={[
                    { value: '', label: '全部分组' },
                    { value: 'default', label: '默认分组' },
                  ]}
                  value={searchParams.groupId}
                  onChange={(value) =>
                    handleSearchParamChange('groupId', value)
                  }
                />
              </Col>
              <Col span={8}>
                <DatePicker.RangePicker
                  placeholder={['开始时间', '结束时间']}
                  style={{ width: '100%' }}
                  value={[searchParams.startTime, searchParams.endTime]}
                  onChange={(dates) => {
                    if (dates) {
                      handleSearchParamChange('startTime', dates[0]);
                      handleSearchParamChange('endTime', dates[1]);
                    } else {
                      handleSearchParamChange('startTime', undefined);
                      handleSearchParamChange('endTime', undefined);
                    }
                  }}
                />
              </Col>
            </Row>

            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={24}>
                <Space>
                  <Button
                    type="primary"
                    icon={<SearchOutlined />}
                    onClick={handleSearch}
                  >
                    搜索
                  </Button>
                  <Button onClick={handleReset}>重置</Button>
                  <Button onClick={handleAdvancedSearch}>高级搜索</Button>
                  <Button onClick={handleBatchOperation}>批量操作</Button>
                </Space>
              </Col>
            </Row>

            <ProTable<DbformItem>
              headerTitle=""
              actionRef={actionRef}
              rowKey="id"
              columns={columns}
              scroll={{ x: 1500 }}
              request={async (params) => {
                const res = await getDbformPage({
                  pageNo: params.current,
                  pageSize: params.pageSize,
                  tableName: searchParams.tableName || params.tableName,
                  tableDescribe:
                    searchParams.tableDescribe || params.tableDescribe,
                  tableType: searchParams.tableType
                    ? Number(searchParams.tableType)
                    : undefined,
                  isDbSync: searchParams.isDbSync,
                  startTime: searchParams.startTime,
                  endTime: searchParams.endTime,
                  groupDbformId:
                    selectedGroupId || searchParams.groupId || undefined,
                });
                return {
                  data: res.data?.records || [],
                  total: res.data?.total || 0,
                  success: res.code === 200,
                };
              }}
              toolBarRender={false}
              search={false}
              pagination={{
                defaultPageSize: 15,
                showSizeChanger: true,
                pageSizeOptions: ['10', '15', '20', '50'],
                showTotal: (total) => `共 ${total} 条记录`,
              }}
              rowSelection={{
                type: 'checkbox',
              }}
              expandable={{
                expandedRowRender: (record) => (
                  <div style={{ padding: 16, background: '#f5f5f5' }}>
                    <Row gutter={16}>
                      <Col span={8}>
                        <p>
                          <strong>表名:</strong> {record.tableName}
                        </p>
                        <p>
                          <strong>表描述:</strong> {record.tableDescribe}
                        </p>
                      </Col>
                      <Col span={8}>
                        <p>
                          <strong>表类型:</strong>{' '}
                          {tableTypeMap[record.tableType || 1]?.text}
                        </p>
                        <p>
                          <strong>同步状态:</strong>{' '}
                          {syncStatusMap[record.isDbSync || 'N']?.text}
                        </p>
                      </Col>
                      <Col span={8}>
                        <p>
                          <strong>创建时间:</strong> {record.createTime}
                        </p>
                        <p>
                          <strong>创建人:</strong> {record.createUser}
                        </p>
                      </Col>
                    </Row>
                  </div>
                ),
              }}
            />
          </Card>
        </Col>
      </Row>

      <Drawer
        title={currentRow ? '编辑表单' : '新增表单'}
        width={1200}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        footer={null}
        style={{
          backgroundColor: '#ffffff',
          color: '#000000',
        }}
      >
        <div
          style={{ height: '700px', display: 'flex', flexDirection: 'column' }}
        >
          {/* 顶部标签页 */}
          <Tabs
            defaultActiveKey="basic"
            style={{ marginBottom: 16, borderBottom: '1px solid #e8e8e8' }}
          >
            <Tabs.TabPane tab="基本信息" key="basic">
              <div style={{ padding: 16 }}>
                <Row gutter={16} style={{ marginBottom: 16 }}>
                  <Col span={6}>
                    <Form.Item
                      name="tableName"
                      label="表名 *"
                      rules={[{ required: true, message: '请输入表名' }]}
                    >
                      <Input
                        placeholder="请输入表名"
                        style={{
                          backgroundColor: '#fff',
                          borderColor: '#d9d9d9',
                          color: '#000',
                        }}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={6}>
                    <Form.Item
                      name="tableDescribe"
                      label="表描述 *"
                      rules={[{ required: true, message: '请输入表描述' }]}
                    >
                      <Input
                        placeholder="请输入表描述"
                        style={{
                          backgroundColor: '#fff',
                          borderColor: '#d9d9d9',
                          color: '#000',
                        }}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={6}>
                    <Form.Item
                      name="tableType"
                      label="表类型"
                      initialValue="单表"
                    >
                      <Select
                        placeholder="请选择表类型"
                        options={[
                          { value: '单表', label: '单表' },
                          { value: '多表关联', label: '多表关联' },
                        ]}
                        style={{
                          backgroundColor: '#fff',
                          borderColor: '#d9d9d9',
                          color: '#000',
                        }}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={6}>
                    <Form.Item
                      name="tableCategory"
                      label="表分类"
                      initialValue="业务表"
                    >
                      <Select
                        placeholder="请选择表分类"
                        options={[
                          { value: '业务表', label: '业务表' },
                          { value: '系统表', label: '系统表' },
                        ]}
                        style={{
                          backgroundColor: '#fff',
                          borderColor: '#d9d9d9',
                          color: '#000',
                        }}
                      />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={16} style={{ marginBottom: 16 }}>
                  <Col span={6}>
                    <Form.Item
                      name="formStyle"
                      label="表单风格"
                      initialValue="二列"
                    >
                      <Select
                        placeholder="请选择表单风格"
                        options={[
                          { value: '二列', label: '二列' },
                          { value: '三列', label: '三列' },
                        ]}
                        style={{
                          backgroundColor: '#fff',
                          borderColor: '#d9d9d9',
                          color: '#000',
                        }}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={6}>
                    <Form.Item
                      name="defaultForm"
                      label="默认表单"
                      initialValue="是"
                    >
                      <Select
                        placeholder="请选择默认表单"
                        options={[
                          { value: '是', label: '是' },
                          { value: '否', label: '否' },
                        ]}
                        style={{
                          backgroundColor: '#fff',
                          borderColor: '#d9d9d9',
                          color: '#000',
                        }}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={6}>
                    <Form.Item
                      name="groupType"
                      label="分组类型"
                      initialValue="请选择分组类型"
                    >
                      <Select
                        placeholder="请选择分组类型"
                        options={[
                          { value: '请选择分组类型', label: '请选择分组类型' },
                          { value: '部门分组', label: '部门分组' },
                          { value: '区域分组', label: '区域分组' },
                        ]}
                        style={{
                          backgroundColor: '#fff',
                          borderColor: '#d9d9d9',
                          color: '#000',
                        }}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={6}>
                    <Form.Item
                      name="themeTemplate"
                      label="主题模板"
                      initialValue="默认主题"
                    >
                      <Select
                        placeholder="请选择主题模板"
                        options={[
                          { value: '默认主题', label: '默认主题' },
                          { value: '蓝色主题', label: '蓝色主题' },
                        ]}
                        style={{
                          backgroundColor: '#fff',
                          borderColor: '#d9d9d9',
                          color: '#000',
                        }}
                      />
                    </Form.Item>
                  </Col>
                </Row>
              </div>
            </Tabs.TabPane>

            <Tabs.TabPane tab="配置选项" key="config">
              <div style={{ padding: 16 }}>
                {/* 数据配置 */}
                <Card title="数据配置" style={{ marginBottom: 16 }}>
                  <Row gutter={16}>
                    <Col span={6}>
                      <Form.Item
                        name="pagination"
                        label="分页"
                        initialValue={true}
                      >
                        <Switch style={{ color: '#1890ff' }} />
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item
                        name="initialDataRequest"
                        label="初始数据请求"
                        initialValue={true}
                      >
                        <Switch style={{ color: '#1890ff' }} />
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item
                        name="loginRequired"
                        label="登录要求"
                        initialValue="需登录"
                      >
                        <Select
                          placeholder="请选择登录要求"
                          options={[
                            { value: '需登录', label: '需登录' },
                            { value: '无需登录', label: '无需登录' },
                          ]}
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                </Card>

                {/* 表格配置 */}
                <Card title="表格配置" style={{ marginBottom: 16 }}>
                  <Row gutter={16} style={{ marginBottom: 16 }}>
                    <Col span={6}>
                      <Form.Item
                        name="fixedTableHeight"
                        label="固定表格高度"
                        initialValue={true}
                      >
                        <Switch style={{ color: '#1890ff' }} />
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item
                        name="tableHeaderOperation"
                        label="表格头部操作"
                        initialValue={true}
                      >
                        <Switch style={{ color: '#1890ff' }} />
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item
                        name="operationColumn"
                        label="操作列"
                        initialValue={true}
                      >
                        <Switch style={{ color: '#1890ff' }} />
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item
                        name="serialNumberColumn"
                        label="序号列"
                        initialValue={true}
                      >
                        <Switch style={{ color: '#1890ff' }} />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={16} style={{ marginBottom: 16 }}>
                    <Col span={6}>
                      <Form.Item
                        name="verticalBorder"
                        label="纵向边框"
                        initialValue={true}
                      >
                        <Switch style={{ color: '#1890ff' }} />
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item
                        name="zebraStyle"
                        label="斑马纹样式"
                        initialValue={false}
                      >
                        <Switch style={{ color: '#1890ff' }} />
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item
                        name="fixedScrollbar"
                        label="表格滚动条固定在底部"
                        initialValue={true}
                      >
                        <Switch style={{ color: '#1890ff' }} />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={16}>
                    <Col span={6}>
                      <Form.Item
                        name="tableSelection"
                        label="表格选择"
                        initialValue="多选"
                      >
                        <Select
                          placeholder="请选择表格选择"
                          options={[
                            { value: '多选', label: '多选' },
                            { value: '单选', label: '单选' },
                          ]}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item
                        name="searchStyle"
                        label="搜索样式"
                        initialValue="表格顶部"
                      >
                        <Select
                          placeholder="请选择搜索样式"
                          options={[
                            { value: '表格顶部', label: '表格顶部' },
                            { value: '弹出层', label: '弹出层' },
                          ]}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item
                        name="operationBarStyle"
                        label="操作栏样式"
                        initialValue="更多下拉"
                      >
                        <Select
                          placeholder="请选择操作栏样式"
                          options={[
                            { value: '更多下拉', label: '更多下拉' },
                            { value: '直接显示', label: '直接显示' },
                          ]}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item
                        name="singleTableStyle"
                        label="单表样式"
                        initialValue="默认表格"
                      >
                        <Select
                          placeholder="请选择单表样式"
                          options={[
                            { value: '默认表格', label: '默认表格' },
                            { value: '紧凑型', label: '紧凑型' },
                            { value: '卡片式', label: '卡片式' },
                          ]}
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                </Card>

                {/* 基础功能 */}
                <Card title="基础功能">
                  <Row gutter={16}>
                    <Col span={4}>
                      <Form.Item
                        name="enableAdd"
                        label="新增"
                        initialValue={true}
                      >
                        <Switch style={{ color: '#1890ff' }} />
                      </Form.Item>
                    </Col>
                    <Col span={4}>
                      <Form.Item
                        name="enableEdit"
                        label="编辑"
                        initialValue={true}
                      >
                        <Switch style={{ color: '#1890ff' }} />
                      </Form.Item>
                    </Col>
                    <Col span={4}>
                      <Form.Item
                        name="enableView"
                        label="查看"
                        initialValue={true}
                      >
                        <Switch style={{ color: '#1890ff' }} />
                      </Form.Item>
                    </Col>
                    <Col span={4}>
                      <Form.Item
                        name="enableDelete"
                        label="删除"
                        initialValue={true}
                      >
                        <Switch style={{ color: '#1890ff' }} />
                      </Form.Item>
                    </Col>
                    <Col span={4}>
                      <Form.Item
                        name="enableBatchDelete"
                        label="批量删除"
                        initialValue={true}
                      >
                        <Switch style={{ color: '#1890ff' }} />
                      </Form.Item>
                    </Col>
                    <Col span={4}>
                      <Form.Item
                        name="enableImport"
                        label="导入"
                        initialValue={true}
                      >
                        <Switch style={{ color: '#1890ff' }} />
                      </Form.Item>
                    </Col>
                    <Col span={4}>
                      <Form.Item
                        name="enableExport"
                        label="导出"
                        initialValue={true}
                      >
                        <Switch style={{ color: '#1890ff' }} />
                      </Form.Item>
                    </Col>
                  </Row>
                </Card>
              </div>
            </Tabs.TabPane>

            <Tabs.TabPane tab="字段管理" key="fields">
              <div style={{ padding: 16 }}>
                {/* 操作按钮 */}
                <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => handleAddField('text')}
                  >
                    新增
                  </Button>
                  <Button
                    danger
                    icon={<DeleteOutlined />}
                    onClick={handleDeleteSelectedFields}
                  >
                    批量删除
                  </Button>
                  <Button icon={<SettingOutlined />}>调整排序</Button>
                  <Tooltip title="隐藏系统字段（如创建时间、租户ID）">
                    <Button icon={<EyeOutlined />}>隐藏系统字段</Button>
                  </Tooltip>
                </div>

                {/* 字段列表 */}
                <div
                  style={{
                    backgroundColor: '#f5f5f5',
                    borderRadius: 4,
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
                    <table
                      style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        backgroundColor: '#fff',
                      }}
                    >
                      <thead>
                        <tr
                          style={{
                            borderBottom: '1px solid #e8e8e8',
                            backgroundColor: '#fafafa',
                          }}
                        >
                          <th
                            style={{
                              padding: 8,
                              textAlign: 'left',
                              color: '#666',
                              fontSize: 12,
                            }}
                          >
                            选择
                          </th>
                          <th
                            style={{
                              padding: 8,
                              textAlign: 'left',
                              color: '#666',
                              fontSize: 12,
                            }}
                          >
                            #
                          </th>
                          <th
                            style={{
                              padding: 8,
                              textAlign: 'left',
                              color: '#666',
                              fontSize: 12,
                            }}
                          >
                            字段编码
                          </th>
                          <th
                            style={{
                              padding: 8,
                              textAlign: 'left',
                              color: '#666',
                              fontSize: 12,
                            }}
                          >
                            字段名称
                          </th>
                          <th
                            style={{
                              padding: 8,
                              textAlign: 'left',
                              color: '#666',
                              fontSize: 12,
                            }}
                          >
                            字段类型
                          </th>
                          <th
                            style={{
                              padding: 8,
                              textAlign: 'left',
                              color: '#666',
                              fontSize: 12,
                            }}
                          >
                            默认值
                          </th>
                          <th
                            style={{
                              padding: 8,
                              textAlign: 'left',
                              color: '#666',
                              fontSize: 12,
                            }}
                          >
                            字段长度
                          </th>
                          <th
                            style={{
                              padding: 8,
                              textAlign: 'left',
                              color: '#666',
                              fontSize: 12,
                            }}
                          >
                            小数位数
                          </th>
                          <th
                            style={{
                              padding: 8,
                              textAlign: 'left',
                              color: '#666',
                              fontSize: 12,
                            }}
                          >
                            是否为空
                          </th>
                          <th
                            style={{
                              padding: 8,
                              textAlign: 'left',
                              color: '#666',
                              fontSize: 12,
                            }}
                          >
                            同步数据库
                          </th>
                          <th
                            style={{
                              padding: 8,
                              textAlign: 'left',
                              color: '#666',
                              fontSize: 12,
                            }}
                          >
                            操作
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr style={{ borderBottom: '1px solid #e8e8e8' }}>
                          <td style={{ padding: 8 }}>
                            <input type="checkbox" />
                          </td>
                          <td style={{ padding: 8, color: '#333' }}>1</td>
                          <td style={{ padding: 8, color: '#333' }}>id</td>
                          <td style={{ padding: 8, color: '#333' }}>主键</td>
                          <td style={{ padding: 8, color: '#333' }}>
                            大整数 BigInt
                          </td>
                          <td style={{ padding: 8, color: '#333' }}>-</td>
                          <td style={{ padding: 8, color: '#333' }}>128</td>
                          <td style={{ padding: 8, color: '#333' }}>0</td>
                          <td style={{ padding: 8, color: '#333' }}>√</td>
                          <td style={{ padding: 8, color: '#333' }}>√</td>
                          <td style={{ padding: 8 }}>
                            <Button size="small">编辑</Button>
                          </td>
                        </tr>
                        <tr style={{ borderBottom: '1px solid #e8e8e8' }}>
                          <td style={{ padding: 8 }}>
                            <input type="checkbox" />
                          </td>
                          <td style={{ padding: 8, color: '#333' }}>2</td>
                          <td style={{ padding: 8, color: '#333' }}>
                            is_deleted
                          </td>
                          <td style={{ padding: 8, color: '#333' }}>
                            是否删除
                          </td>
                          <td style={{ padding: 8, color: '#333' }}>
                            整数 Integer
                          </td>
                          <td style={{ padding: 8, color: '#333' }}>0</td>
                          <td style={{ padding: 8, color: '#333' }}>2</td>
                          <td style={{ padding: 8, color: '#333' }}>0</td>
                          <td style={{ padding: 8, color: '#333' }}>√</td>
                          <td style={{ padding: 8, color: '#333' }}>√</td>
                          <td style={{ padding: 8 }}>
                            <Button size="small">编辑</Button>
                          </td>
                        </tr>
                        <tr style={{ borderBottom: '1px solid #e8e8e8' }}>
                          <td style={{ padding: 8 }}>
                            <input type="checkbox" />
                          </td>
                          <td style={{ padding: 8, color: '#333' }}>3</td>
                          <td style={{ padding: 8, color: '#333' }}>
                            update_time
                          </td>
                          <td style={{ padding: 8, color: '#333' }}>
                            更新时间
                          </td>
                          <td style={{ padding: 8, color: '#333' }}>
                            日期时间 DateTime
                          </td>
                          <td style={{ padding: 8, color: '#333' }}>-</td>
                          <td style={{ padding: 8, color: '#333' }}>128</td>
                          <td style={{ padding: 8, color: '#333' }}>0</td>
                          <td style={{ padding: 8, color: '#333' }}>√</td>
                          <td style={{ padding: 8, color: '#333' }}>√</td>
                          <td style={{ padding: 8 }}>
                            <Button size="small">编辑</Button>
                          </td>
                        </tr>
                        {fields.map((field, index) => (
                          <tr
                            key={field.id}
                            style={{ borderBottom: '1px solid #e8e8e8' }}
                          >
                            <td style={{ padding: 8 }}>
                              <input type="checkbox" />
                            </td>
                            <td style={{ padding: 8, color: '#333' }}>
                              {index + 4}
                            </td>
                            <td style={{ padding: 8, color: '#333' }}>
                              {field.fieldName}
                            </td>
                            <td style={{ padding: 8, color: '#333' }}>
                              {field.fieldLabel}
                            </td>
                            <td style={{ padding: 8, color: '#333' }}>
                              {field.fieldType}
                            </td>
                            <td style={{ padding: 8, color: '#333' }}>
                              {field.defaultValue || '-'}
                            </td>
                            <td style={{ padding: 8, color: '#333' }}>
                              {field.fieldLength || '-'}
                            </td>
                            <td style={{ padding: 8, color: '#333' }}>0</td>
                            <td style={{ padding: 8, color: '#333' }}>
                              {field.isRequired ? '×' : '√'}
                            </td>
                            <td style={{ padding: 8, color: '#333' }}>√</td>
                            <td style={{ padding: 8 }}>
                              <Button
                                size="small"
                                style={{ marginRight: 4 }}
                                onClick={() => handleEditField(field)}
                              >
                                编辑
                              </Button>
                              <Button
                                size="small"
                                danger
                                onClick={() => handleDeleteField(field.id)}
                              >
                                删除
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </Tabs.TabPane>

            <Tabs.TabPane tab="扩展配置" key="extend">
              <div style={{ padding: 16 }}>
                <Card title="表格扩展配置" style={{ marginBottom: 16 }}>
                  <Row gutter={16}>
                    <Col span={8}>
                      <Form.Item name="tableColumnWidth" label="列宽设置">
                        <Input placeholder="请输入列宽设置" />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="tableThemeColor" label="主题色">
                        <Input placeholder="请输入主题色" />
                      </Form.Item>
                    </Col>
                  </Row>
                </Card>

                <Card title="默认排序" style={{ marginBottom: 16 }}>
                  <Form.Item name="defaultSort">
                    <Input placeholder="如：create_time DESC" />
                  </Form.Item>
                </Card>

                <Card title="默认搜索">
                  <Form.Item name="defaultSearch">
                    <Input placeholder="如：is_deleted=0" />
                  </Form.Item>
                </Card>
              </div>
            </Tabs.TabPane>
          </Tabs>

          {/* 底部操作按钮 */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: 16,
              borderTop: '1px solid #e8e8e8',
            }}
          >
            <div style={{ display: 'flex', gap: 8 }}>
              <Form.Item
                name="databaseTable"
                label="数据库表选择"
                style={{ marginBottom: 0 }}
              >
                <Select
                  placeholder="请选择数据库表"
                  options={[
                    { value: '', label: '请选择数据库表' },
                    { value: 'user', label: 'user' },
                    { value: 'order', label: 'order' },
                  ]}
                  style={{ width: 200 }}
                />
              </Form.Item>
              <Button icon={<DatabaseOutlined />}>反向生成数据</Button>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button onClick={() => setDrawerVisible(false)}>
                取消 <DeleteOutlined />
              </Button>
              <Button type="primary" onClick={handleSubmit}>
                保存 <SaveOutlined />
              </Button>
            </div>
          </div>
        </div>
      </Drawer>

      <Modal
        title="新增分组"
        open={groupFormVisible}
        onOk={handleSaveGroup}
        onCancel={() => setGroupFormVisible(false)}
      >
        <Form form={groupForm} layout="vertical">
          <Form.Item
            name="groupName"
            label="分组名称"
            rules={[{ required: true, message: '请输入分组名称' }]}
          >
            <Input placeholder="请输入分组名称" />
          </Form.Item>
          <Form.Item name="groupSort" label="排序">
            <Input type="number" placeholder="请输入排序" />
          </Form.Item>
        </Form>
      </Modal>

      <FieldConfigDrawer
        open={fieldDrawerVisible}
        onClose={() => setFieldDrawerVisible(false)}
        dbformId={currentRow?.id || ''}
        tableName={currentRow?.tableName || ''}
      />

      <ButtonConfigDrawer
        open={buttonDrawerVisible}
        onClose={() => setButtonDrawerVisible(false)}
        dbformId={currentRow?.id || ''}
      />

      <EnhanceDrawer
        open={enhanceDrawerVisible}
        onClose={() => setEnhanceDrawerVisible(false)}
        dbformId={currentRow?.id || ''}
        type={enhanceType}
      />
    </PageContainer>
  );
};

export default TableDesign;
