# usePageButtons Hook 使用指南

## 概述

`usePageButtons` 是一个通用的自定义 Hook，用于动态获取当前页面的按钮权限。它会自动从路由路径提取菜单 code，并返回对应的按钮权限数组。

## 安装位置

```
src/hooks/usePageButtons.ts
```

## 基础用法

### 1. 自动从路由获取（推荐）

```tsx
import React from 'react';
import { usePageButtons } from '@/hooks/usePageButtons';

const UserPage: React.FC = () => {
  // 自动从当前路由 /system/user 提取 'user'
  const { buttons, loading } = usePageButtons();
  
  return (
    <PageContainer
      extra={buttons
        .filter(btn => btn.action === 1)
        .map(btn => <Button key={btn.code}>{btn.name}</Button>)
      }
    >
      <ProTable
        toolBarRender={() => [
          buttons.some(btn => btn.code === 'user_add') && (
            <Button type="primary">新增</Button>
          ),
        ].filter(Boolean)}
      />
    </PageContainer>
  );
};
```

### 2. 手动指定菜单 code

```tsx
// 如果路由路径和菜单 code 不一致，可以手动指定
const { buttons } = usePageButtons('custom_menu_code');
```

## 返回值

```typescript
{
  buttons: any[];      // 按钮权限数组
  loading: boolean;    // 加载状态
}
```

## 按钮数据结构

每个按钮对象包含以下字段：

```typescript
{
  id: string;          // 按钮 ID
  code: string;        // 按钮代码，如 'user_add'
  name: string;        // 按钮名称，如 '新增'
  alias: string;       // 按钮别名，如 'add'
  action: number;      // 操作类型：1-新增，2-修改，3-删除，4-查看
  actionName: string;  // 操作类型名称
  path: string;        // 按钮对应的路径
  source: string;      // 按钮图标来源
  sort: number;        // 排序
}
```

## 常见使用场景

### 场景 1：顶部按钮（PageContainer.extra）

```tsx
const { buttons } = usePageButtons();

<PageContainer
  extra={buttons
    .filter(btn => btn.action === 1 || btn.action === 3)
    .map(btn => (
      <Button
        key={btn.code}
        type={btn.alias === 'add' ? 'primary' : 'default'}
      >
        {btn.name}
      </Button>
    ))
  }
>
  {/* 页面内容 */}
</PageContainer>
```

### 场景 2：工具栏按钮（ProTable.toolBarRender）

```tsx
const { buttons } = usePageButtons();

<ProTable
  toolBarRender={() => [
    buttons.some(btn => btn.code === 'user_add') && (
      <Button type="primary" icon={<PlusOutlined />}>
        新增
      </Button>
    ),
    buttons.some(btn => btn.code === 'user_delete') && (
      <Button danger icon={<DeleteOutlined />}>
        删除
      </Button>
    ),
  ].filter(Boolean)}
/>
```

### 场景 3：操作列按钮

```tsx
const { buttons } = usePageButtons();

const columns: ProColumns<User>[] = [
  {
    title: '操作',
    key: 'action',
    render: (_, record) => (
      <Space>
        {buttons.some(btn => btn.code === 'user_edit') && (
          <Button type="link" icon={<EditOutlined />}>
            编辑
          </Button>
        )}
        {buttons.some(btn => btn.code === 'user_delete') && (
          <Button type="link" danger icon={<DeleteOutlined />}>
            删除
          </Button>
        )}
      </Space>
    ),
  },
];
```

### 场景 4：根据 action 类型过滤

```tsx
const { buttons } = usePageButtons();

// 只显示新增按钮（action === 1）
const addButtons = buttons.filter(btn => btn.action === 1);

// 只显示查看按钮（action === 4）
const viewButtons = buttons.filter(btn => btn.action === 4);
```

## 路由与菜单 code 映射规则

Hook 会自动从路由路径的最后一段提取菜单 code：

| 路由路径 | 提取的菜单 code |
|---------|----------------|
| `/system/user` | `user` |
| `/system/menu` | `menu` |
| `/system/dept` | `dept` |
| `/system/role` | `role` |
| `/mall/product` | `product` |

## 调试信息

Hook 内置了调试日志，会在控制台输出：

```javascript
当前路由路径：/system/user
使用的菜单 code: user
获取到的按钮权限：[...]
```

## 注意事项

1. **按钮 code 格式**：使用下划线分隔，如 `user_add`，不是 `user:add`
2. **数据结构**：按钮存储在菜单项的 `children` 字段中
3. **权限控制**：结合 `usePermission` Hook 的 `hasPermission` 方法可以实现更细粒度的权限控制

## 完整示例

```tsx
import React from 'react';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { Button, Space } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { usePageButtons } from '@/hooks/usePageButtons';

const UserPage: React.FC = () => {
  const { buttons } = usePageButtons();

  const columns = [
    {
      title: '姓名',
      dataIndex: 'name',
    },
    {
      title: '操作',
      render: (_, record) => (
        <Space>
          {buttons.some(btn => btn.code === 'user_edit') && (
            <Button type="link" icon={<EditOutlined />}>
              编辑
            </Button>
          )}
          {buttons.some(btn => btn.code === 'user_delete') && (
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <PageContainer
      title="用户管理"
      extra={buttons
        .filter(btn => btn.action === 1)
        .map(btn => (
          <Button key={btn.code} type="primary">
            {btn.name}
          </Button>
        ))
      }
    >
      <ProTable
        columns={columns}
        toolBarRender={() => [
          buttons.some(btn => btn.code === 'user_add') && (
            <Button type="primary" icon={<PlusOutlined />}>
              新增
            </Button>
          ),
          buttons.some(btn => btn.code === 'user_delete') && (
            <Button danger icon={<DeleteOutlined />}>
              批量删除
            </Button>
          ),
        ].filter(Boolean)}
      />
    </PageContainer>
  );
};

export default UserPage;
```

## 迁移指南

### 从旧代码迁移

**旧代码：**
```tsx
const [buttons, setButtons] = useState([]);

useEffect(() => {
  const btns = getButton('user');
  setButtons(btns || []);
}, []);
```

**新代码：**
```tsx
const { buttons } = usePageButtons();
```

**优势：**
- ✅ 代码更简洁
- ✅ 自动从路由获取菜单 code
- ✅ 包含加载状态
- ✅ 统一的调试日志
