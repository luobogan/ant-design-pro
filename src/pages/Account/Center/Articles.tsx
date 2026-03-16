import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  MessageOutlined,
  StarOutlined,
} from '@ant-design/icons';
import { Avatar, Button, List, Space, Tag, Typography } from 'antd';
import React, { useState } from 'react';

const { Paragraph } = Typography;

const Articles: React.FC = () => {
  const [articles, _setArticles] = useState<any[]>([
    {
      id: 1,
      title: 'Sword Admin 系统架构设计',
      summary:
        '本文详细介绍了 Sword Admin 系统的架构设计，包括前端技术栈、后端架构和数据库设计。',
      tags: ['架构设计', '前端', '后端'],
      views: 128,
      likes: 24,
      comments: 8,
      date: '2026-01-20',
      author: '管理员',
      avatar: 'https://randomuser.me/api/portraits/men/1.jpg',
    },
    {
      id: 2,
      title: 'Ant Design Pro 使用指南',
      summary:
        'Ant Design Pro 是一个企业级中后台前端解决方案，本文介绍了如何快速上手和使用。',
      tags: ['Ant Design', '前端', '使用指南'],
      views: 96,
      likes: 18,
      comments: 5,
      date: '2026-01-15',
      author: '管理员',
      avatar: 'https://randomuser.me/api/portraits/men/1.jpg',
    },
    {
      id: 3,
      title: 'TypeScript 高级特性详解',
      summary:
        'TypeScript 是 JavaScript 的超集，本文详细介绍了 TypeScript 的高级特性和最佳实践。',
      tags: ['TypeScript', '前端', '编程语言'],
      views: 156,
      likes: 32,
      comments: 12,
      date: '2026-01-10',
      author: '管理员',
      avatar: 'https://randomuser.me/api/portraits/men/1.jpg',
    },
  ]);

  const handleEdit = (id: number) => {
    console.log('Edit article:', id);
  };

  const handleDelete = (id: number) => {
    console.log('Delete article:', id);
  };

  return (
    <List
      itemLayout="vertical"
      dataSource={articles}
      renderItem={(article) => (
        <List.Item
          key={article.id}
          extra={
            <Space size="small">
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={() => handleEdit(article.id)}
              >
                编辑
              </Button>
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleDelete(article.id)}
              >
                删除
              </Button>
            </Space>
          }
        >
          <List.Item.Meta
            avatar={<Avatar src={article.avatar} />}
            title={
              <div>
                <h3 style={{ marginBottom: 8 }}>{article.title}</h3>
                <Space size="small">
                  {article.tags.map((tag: string) => (
                    <Tag key={tag} color="blue">
                      {tag}
                    </Tag>
                  ))}
                </Space>
              </div>
            }
            description={
              <div>
                <Paragraph ellipsis={{ rows: 2 }} style={{ marginBottom: 8 }}>
                  {article.summary}
                </Paragraph>
                <Space size="middle">
                  <span>
                    <EyeOutlined /> {article.views} 浏览
                  </span>
                  <span>
                    <StarOutlined /> {article.likes} 点赞
                  </span>
                  <span>
                    <MessageOutlined /> {article.comments} 评论
                  </span>
                  <span>{article.date}</span>
                </Space>
              </div>
            }
          />
        </List.Item>
      )}
    />
  );
};

export default Articles;
