import React, { useState } from 'react';
import { Tabs, Button, Input, Modal, Space, Tooltip } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';

/**
 * TabManager组件
 * 支持多Tab页签布局管理
 */
interface TabManagerProps {
  activeTab: string;
  onTabChange: (tabKey: string) => void;
  onTabAdd: (tabName: string) => void;
  onTabDelete: (tabKey: string) => void;
  onTabRename: (oldKey: string, newName: string) => void;
}

const TabManager: React.FC<TabManagerProps> = ({
  activeTab,
  onTabChange,
  onTabAdd,
  onTabDelete,
  onTabRename,
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newTabName, setNewTabName] = useState('');
  const [editingTab, setEditingTab] = useState<string>('');
  const [editTabName, setEditTabName] = useState('');

  const handleAddTab = () => {
    if (newTabName.trim()) {
      onTabAdd(newTabName.trim());
      setNewTabName('');
      setIsAdding(false);
    }
  };

  const handleRenameTab = (tabKey: string) => {
    if (editTabName.trim()) {
      onTabRename(tabKey, editTabName.trim());
      setEditingTab('');
      setEditTabName('');
    }
  };

  const tabItems = [
    { key: 'Sheet1', label: 'Sheet1' },
    { key: 'Sheet2', label: 'Sheet2' },
    { key: 'Sheet3', label: 'Sheet3' },
  ].map(tab => ({
    key: tab.key,
    label: (
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {editingTab === tab.key ? (
          <Input
            size="small"
            value={editTabName}
            onChange={e => setEditTabName(e.target.value)}
            onBlur={() => handleRenameTab(tab.key)}
            onPressEnter={() => handleRenameTab(tab.key)}
            style={{ width: 80 }}
            autoFocus
          />
        ) : (
          <span>{tab.label}</span>
        )}
        <Space size={4} style={{ marginLeft: 8 }}>
          <Tooltip title="重命名">
            <EditOutlined
              style={{ fontSize: 12 }}
              onClick={e => {
                e.stopPropagation();
                setEditingTab(tab.key);
                setEditTabName(tab.label);
              }}
            />
          </Tooltip>
          {tab.key !== 'Sheet1' && (
            <Tooltip title="删除">
              <DeleteOutlined
                style={{ fontSize: 12 }}
                onClick={e => {
                  e.stopPropagation();
                  onTabDelete(tab.key);
                }}
              />
            </Tooltip>
          )}
        </Space>
      </div>
    ),
  }));

  return (
    <div>
      <Tabs
        activeKey={activeTab}
        onChange={onTabChange}
        type="editable-card"
        items={tabItems}
        tabBarExtraContent={
          <Button
            type="text"
            icon={<PlusOutlined />}
            onClick={() => setIsAdding(true)}
            size="small"
          >
            添加Tab
          </Button>
        }
      />
      <Modal
        title="添加新Tab"
        open={isAdding}
        onOk={handleAddTab}
        onCancel={() => setIsAdding(false)}
        okText="确定"
        cancelText="取消"
      >
        <Input
          placeholder="请输入Tab名称"
          value={newTabName}
          onChange={e => setNewTabName(e.target.value)}
          onPressEnter={handleAddTab}
        />
      </Modal>
    </div>
  );
};

export default TabManager;
