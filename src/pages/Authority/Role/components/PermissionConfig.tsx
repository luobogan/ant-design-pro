import {
  ApiOutlined,
  CheckCircleOutlined,
  DatabaseOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { Alert, Card, Modal, Space, Tabs, Tag, Tree } from 'antd';
import type { DataNode } from 'antd/es/tree';
import React, { useEffect, useMemo, useState } from 'react';

const { TabPane } = Tabs;

interface PermissionConfigProps {
  visible: boolean;
  roleId?: string;
  roleName?: string;
  menuTreeData: any[];
  dataScopeTreeData: any[];
  apiTreeData: any[];
  initialMenuKeys: React.Key[];
  initialDataScopeKeys: React.Key[];
  initialApiKeys: React.Key[];
  onCancel: () => void;
  onSave: (permissions: {
    menuIds: React.Key[];
    dataScopeIds: React.Key[];
    apiIds: React.Key[];
  }) => void;
  loading?: boolean;
}

const PermissionConfig: React.FC<PermissionConfigProps> = ({
  visible,
  roleId,
  roleName,
  menuTreeData,
  dataScopeTreeData,
  apiTreeData,
  initialMenuKeys,
  initialDataScopeKeys,
  initialApiKeys,
  onCancel,
  onSave,
  loading,
}) => {
  const [activeTab, setActiveTab] = useState<string>('menu');
  const [checkedMenuKeys, setCheckedMenuKeys] = useState<React.Key[]>([]);
  const [checkedDataScopeKeys, setCheckedDataScopeKeys] = useState<React.Key[]>(
    [],
  );
  const [checkedApiKeys, setCheckedApiKeys] = useState<React.Key[]>([]);

  // 初始化选中的权限
  useEffect(() => {
    if (visible) {
      setCheckedMenuKeys(initialMenuKeys || []);
      // 数据权限：过滤掉可能包含的分组key，只保留实际ID
      const validDataScopeKeys = (initialDataScopeKeys || []).filter((key) => {
        const keyStr = String(key);
        return !keyStr.startsWith('menu-');
      });
      setCheckedDataScopeKeys(validDataScopeKeys);
      setCheckedApiKeys(initialApiKeys || []);
    }
  }, [visible, initialMenuKeys, initialDataScopeKeys, initialApiKeys]);

  // 构建菜单树
  const menuTree = useMemo(() => {
    console.log('Menu tree data in PermissionConfig:', menuTreeData);
    const buildTree = (data: any[]): DataNode[] => {
      if (!Array.isArray(data)) {
        console.error('Menu tree data is not an array:', data);
        return [];
      }
      const nodes = data.map((item) => {
        console.log('Processing menu item:', item);
        return {
          key: item.id || item.key || item.code,
          title: (
            <Space>
              <span>{item.name || item.title || item.label}</span>
              {item.path && (
                <Tag size="small" color="blue">
                  {item.path}
                </Tag>
              )}
            </Space>
          ),
          children: item.children ? buildTree(item.children) : undefined,
        };
      });
      console.log('Built menu nodes:', nodes);
      return nodes;
    };
    const result = buildTree(menuTreeData);
    console.log('Final menu tree:', result);
    return result;
  }, [menuTreeData]);

  // 构建数据权限树 - 按菜单名称分组展示层级关系
  const dataScopeTree = useMemo(() => {
    console.log('Data scope tree data in PermissionConfig:', dataScopeTreeData);
    console.log('Menu tree data for lookup:', menuTreeData);

    if (!Array.isArray(dataScopeTreeData) || dataScopeTreeData.length === 0) {
      console.warn('Data scope tree data is empty or not an array');
      return [];
    }

    // 构建顶级菜单ID到菜单名称的映射
    const menuIdToName: Record<string, string> = {};
    const topLevelMenus: Record<string, string> = {}; // 用于记录每个菜单ID对应的顶级菜单

    const buildMenuMap = (data: any[], topLevelName?: string) => {
      if (!Array.isArray(data)) return;
      data.forEach((item) => {
        const id = item.id || item.key;
        const name = item.name || item.title || item.label;
        const isTopLevel =
          !item.parentId || item.parentId === '0' || item.parentId === 0;

        if (id && name) {
          // 如果是顶级菜单，记录为顶级
          if (isTopLevel) {
            menuIdToName[id] = name;
            menuIdToName[String(id)] = name;
            topLevelMenus[id] = name;
            topLevelMenus[String(id)] = name;
          } else {
            // 非顶级菜单，继承父级的顶级菜单名称
            topLevelMenus[id] = topLevelName || name;
            topLevelMenus[String(id)] = topLevelName || name;
          }
        }

        // 递归处理子菜单，传递当前顶级菜单名称
        if (item.children) {
          buildMenuMap(item.children, isTopLevel ? name : topLevelName);
        }
      });
    };
    buildMenuMap(menuTreeData);
    console.log('Menu ID to top-level menu mapping:', topLevelMenus);

    // 按菜单名称分组数据权限
    const groupedByMenu: Record<string, any[]> = {};

    dataScopeTreeData.forEach((item) => {
      // 优先使用 menuId 查找对应的顶级菜单名称
      let menuName = item.menuName;

      if (!menuName && item.menuId && topLevelMenus[item.menuId]) {
        menuName = topLevelMenus[item.menuId];
      }

      // 备选：从其他字段获取
      if (!menuName) {
        menuName = item.moduleName || item.category;
      }

      // 最后兜底：从 scopeName 提取或直接使用
      if (!menuName) {
        const match = item.scopeName?.match(/^([^[【(]+)/);
        menuName = match
          ? match[1].trim()
          : item.scopeName || item.resourceCode || '未分类';
      }

      if (!groupedByMenu[menuName]) {
        groupedByMenu[menuName] = [];
      }
      groupedByMenu[menuName].push(item);
    });

    // 构建树形结构：第一级菜单/模块，第二级具体数据权限
    const tree: DataNode[] = Object.entries(groupedByMenu).map(
      ([menuName, items]) => ({
        key: `menu-${menuName}`,
        title: (
          <Space>
            <span style={{ fontWeight: 'bold', color: '#1890ff' }}>
              {menuName}
            </span>
            <Tag>{items.length} 项</Tag>
          </Space>
        ),
        children: items.map((item) => ({
          key: item.id || item.key,
          title: (
            <Space>
              <span>{item.scopeName || item.name || item.title}</span>
              {item.resourceCode && <Tag color="blue">{item.resourceCode}</Tag>}
              {item.scopeTypeName && (
                <Tag color="cyan">{item.scopeTypeName}</Tag>
              )}
            </Space>
          ),
        })),
      }),
    );

    console.log('Built data scope tree:', tree);
    return tree;
  }, [dataScopeTreeData, menuTreeData]);

  // 构建接口权限树
  const apiTree = useMemo(() => {
    const buildTree = (data: any[]): DataNode[] => {
      if (!Array.isArray(data)) return [];
      return data.map((item) => ({
        key: item.id || item.key || item.code,
        title: (
          <Space>
            <span>{item.name || item.title}</span>
            {item.method && (
              <Tag
                size="small"
                color={
                  item.method === 'GET'
                    ? 'green'
                    : item.method === 'POST'
                      ? 'blue'
                      : 'orange'
                }
              >
                {item.method}
              </Tag>
            )}
            {item.url && (
              <Tag size="small" style={{ fontSize: '11px' }}>
                {item.url}
              </Tag>
            )}
          </Space>
        ),
        children: item.children ? buildTree(item.children) : undefined,
      }));
    };
    return buildTree(apiTreeData);
  }, [apiTreeData]);

  // 处理保存
  const handleSave = () => {
    // 确保数据权限ID只包含实际ID（Long类型），过滤掉分组的key
    const validDataScopeIds = checkedDataScopeKeys.filter((key) => {
      const keyStr = String(key);
      return !keyStr.startsWith('menu-');
    });

    onSave({
      menuIds: checkedMenuKeys,
      dataScopeIds: validDataScopeIds,
      apiIds: checkedApiKeys,
    });
  };

  return (
    <Modal
      title={`权限配置 - ${roleName || '角色'}`}
      open={visible}
      onCancel={onCancel}
      onOk={handleSave}
      width={900}
      bodyStyle={{ padding: 0, minHeight: '500px' }}
      confirmLoading={loading}
      okText="保存配置"
      cancelText="取消"
    >
      <Alert
        message="权限配置说明"
        description={
          <Space direction="vertical" size={0}>
            <span>• 菜单权限：控制角色可以访问的菜单和功能页面</span>
            <span>• 数据权限：控制角色可以查看的数据范围</span>
            <span>• 接口权限：控制角色可以调用的API接口</span>
          </Space>
        }
        type="info"
        showIcon
        icon={<InfoCircleOutlined />}
        style={{ margin: '16px 24px' }}
      />

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        type="card"
        style={{ margin: '0 24px' }}
        tabBarStyle={{ marginBottom: 0 }}
      >
        {/* 菜单权限 */}
        <TabPane
          tab={
            <span>
              <CheckCircleOutlined />
              菜单权限
              {checkedMenuKeys.length > 0 && (
                <Tag color="blue" size="small" style={{ marginLeft: 4 }}>
                  {checkedMenuKeys.length}
                </Tag>
              )}
            </span>
          }
          key="menu"
        >
          <Card
            size="small"
            bordered={false}
            bodyStyle={{
              padding: '12px 0',
              maxHeight: '400px',
              overflow: 'auto',
            }}
          >
            <Tree
              checkable
              treeData={menuTree}
              checkedKeys={checkedMenuKeys}
              onCheck={(checked) => setCheckedMenuKeys(checked as React.Key[])}
              defaultExpandAll
              showLine
            />
          </Card>
        </TabPane>

        {/* 数据权限 */}
        <TabPane
          tab={
            <span>
              <DatabaseOutlined />
              数据权限
              {checkedDataScopeKeys.length > 0 && (
                <Tag color="blue" size="small" style={{ marginLeft: 4 }}>
                  {checkedDataScopeKeys.length}
                </Tag>
              )}
            </span>
          }
          key="data"
        >
          <Card
            size="small"
            bordered={false}
            bodyStyle={{
              padding: '12px 0',
              maxHeight: '400px',
              overflow: 'auto',
            }}
          >
            <Tree
              checkable
              treeData={dataScopeTree}
              checkedKeys={checkedDataScopeKeys}
              onCheck={(checked, _info) => {
                // 只保留实际的数据权限ID（数字或字符串ID），过滤掉分组的key（以"menu-"开头）
                const checkedArray = checked as React.Key[];
                const realIds = checkedArray.filter((key) => {
                  const keyStr = String(key);
                  return !keyStr.startsWith('menu-');
                });
                setCheckedDataScopeKeys(realIds);
              }}
              defaultExpandAll
              showLine
            />
          </Card>
        </TabPane>

        {/* 接口权限 */}
        <TabPane
          tab={
            <span>
              <ApiOutlined />
              接口权限
              {checkedApiKeys.length > 0 && (
                <Tag color="blue" size="small" style={{ marginLeft: 4 }}>
                  {checkedApiKeys.length}
                </Tag>
              )}
            </span>
          }
          key="api"
        >
          <Card
            size="small"
            bordered={false}
            bodyStyle={{
              padding: '12px 0',
              maxHeight: '400px',
              overflow: 'auto',
            }}
          >
            <Tree
              checkable
              treeData={apiTree}
              checkedKeys={checkedApiKeys}
              onCheck={(checked) => setCheckedApiKeys(checked as React.Key[])}
              defaultExpandAll
              showLine
            />
          </Card>
        </TabPane>
      </Tabs>

      {/* 权限统计 */}
      <div
        style={{
          padding: '12px 24px',
          background: '#f5f5f5',
          borderTop: '1px solid #e8e8e8',
          marginTop: 16,
        }}
      >
        <Space size="large">
          <span>
            已选菜单权限: <Tag color="blue">{checkedMenuKeys.length}</Tag> 项
          </span>
          <span>
            已选数据权限: <Tag color="cyan">{checkedDataScopeKeys.length}</Tag>{' '}
            项
          </span>
          <span>
            已选接口权限: <Tag color="orange">{checkedApiKeys.length}</Tag> 项
          </span>
        </Space>
      </div>
    </Modal>
  );
};

export default PermissionConfig;
