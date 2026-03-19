import * as icons from '@ant-design/icons';
import { Input, List, Modal, Space, Typography } from 'antd';
import React, { useState } from 'react';

interface IconPreviewProps {
  onCancel: (value: string) => void;
}

const { Search } = Input;
const { Text } = Typography;

const IconPreview: React.FC<IconPreviewProps> = ({ onCancel }) => {
  const [searchText, setSearchText] = useState('');

  // Get all icon names from @ant-design/icons
  const allIcons = Object.keys(icons).filter((key) => {
    // Filter out non-icon exports
    return typeof icons[key] === 'function' && key.endsWith('Outlined');
  });

  // Filter icons based on search text
  const filteredIcons = allIcons.filter((iconName) =>
    iconName.toLowerCase().includes(searchText.toLowerCase()),
  );

  return (
    <Modal
      title="选择图标"
      open
      onCancel={() => onCancel('')}
      footer={null}
      width={600}
    >
      <Search
        placeholder="搜索图标"
        onChange={(e) => setSearchText(e.target.value)}
        style={{ marginBottom: 16 }}
      />
      <List
        grid={{ gutter: 16, column: 6 }}
        dataSource={filteredIcons}
        renderItem={(iconName) => {
          const IconComponent = icons[iconName];
          return (
            <List.Item
              onClick={() => onCancel(iconName.replace('Outlined', ''))}
              style={{
                textAlign: 'center',
                cursor: 'pointer',
                padding: '16px',
                borderRadius: '8px',
                hover: { backgroundColor: '#f0f0f0' },
              }}
            >
              <Space direction="vertical" size={8}>
                <IconComponent style={{ fontSize: 24 }} />
                <Text ellipsis style={{ width: 80 }}>
                  {iconName.replace('Outlined', '')}
                </Text>
              </Space>
            </List.Item>
          );
        }}
      />
    </Modal>
  );
};

export default IconPreview;
