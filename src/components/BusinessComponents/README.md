# BusinessComponents 业务通用组件库

## 目录

- [简介](#简介)
- [安装使用](#安装使用)
- [组件列表](#组件列表)
  - [Panel 面板](#panel-面板)
  - [ToolBar 工具栏](#toolbar-工具栏)
  - [SearchBox 搜索框](#searchbox-搜索框)
  - [Grid 通用表格](#grid-通用表格)
- [使用示例](#使用示例)
- [注意事项](#注意事项)

---

## 简介

BusinessComponents 是项目的业务通用组件库，提供可复用的业务组件，包括：

- **Panel**：页面面板容器
- **ToolBar**：工具栏按钮组件
- **SearchBox**：搜索表单组件
- **Grid**：通用表格组件（集成搜索、工具栏、表格）

这些组件遵循 Ant Design Pro 6.x + React 19 + TypeScript 规范，旨在提高开发效率和代码复用率。

---

## 安装使用

组件已集成到项目中，直接使用导入语句即可：

```typescript
import { Panel, ToolBar, SearchBox, Grid } from '@/components/BusinessComponents';
```

或单独导入：

```typescript
import Panel from '@/components/BusinessComponents/Panel';
import ToolBar from '@/components/BusinessComponents/ToolBar';
import SearchBox from '@/components/BusinessComponents/SearchBox';
import Grid from '@/components/BusinessComponents/Grid';
```

---

## 组件列表

### Panel 面板

用于包裹页面内容，提供统一的页面布局。

#### API

```typescript
interface PanelProps extends CardProps {
  title: React.ReactNode;     // 面板标题（必填）
  back?: string;              // 返回路径
  action?: React.ReactNode;   // 操作按钮
  children: React.ReactNode;  // 子内容
}
```

#### 使用示例

```tsx
import { Panel } from '@/components/BusinessComponents';
import { Button } from 'antd';

const UserPage = () => {
  return (
    <Panel
      title="用户管理"
      back="/system/user"
      action={<Button type="primary">新增用户</Button>}
    >
      <div>页面内容</div>
    </Panel>
  );
};
```

---

### ToolBar 工具栏

用于渲染顶部工具栏按钮，支持权限控制。

#### API

```typescript
interface ToolBarProps {
  buttons: ButtonConfig[];              // 按钮列表（必填）
  renderLeftButton?: () => React.ReactNode;  // 自定义左侧按钮
  renderRightButton?: () => React.ReactNode; // 自定义右侧按钮
  onClick: (button: ButtonConfig) => void;   // 点击回调（必填）
}

interface ButtonConfig {
  code: string;      // 按钮代码
  name: string;      // 按钮名称
  alias?: string;    // 按钮别名（add, edit, delete 等）
  action?: number;   // 按钮类型：1=顶部，2=行内，3=都显示
  source?: string;   // 按钮图标
  path?: string;     // 按钮路径
}
```

#### 使用示例

```tsx
import { ToolBar } from '@/components/BusinessComponents';
import type { ButtonConfig } from '@/components/BusinessComponents';

const UserPage = () => {
  const buttons: ButtonConfig[] = [
    { code: 'user.add', name: '新增', alias: 'add', action: 1 },
    { code: 'user.edit', name: '编辑', alias: 'edit', action: 1 },
    { code: 'user.delete', name: '删除', alias: 'delete', action: 1 },
  ];

  const handleButtonClick = (btn: ButtonConfig) => {
    console.log('点击了按钮:', btn);
  };

  return (
    <ToolBar
      buttons={buttons}
      onClick={handleButtonClick}
      renderLeftButton={() => <Button>自定义按钮</Button>}
    />
  );
};
```

---

### SearchBox 搜索框

用于封装搜索表单，提供统一的查询/重置按钮。

#### API

```typescript
interface SearchBoxProps {
  onSubmit: (e: React.FormEvent) => void;  // 提交回调（必填）
  onReset: () => void;                     // 重置回调（必填）
  children: React.ReactNode;               // 子内容（搜索字段）（必填）
}
```

#### 使用示例

```tsx
import { SearchBox } from '@/components/BusinessComponents';
import { Input, Select } from 'antd';

const UserPage = () => {
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('执行搜索');
  };

  const handleReset = () => {
    console.log('重置表单');
  };

  return (
    <SearchBox onSubmit={handleSearch} onReset={handleReset}>
      <Input name="keyword" placeholder="请输入关键词" />
      <Select name="status" placeholder="请选择状态">
        <Select.Option value="active">启用</Select.Option>
        <Select.Option value="inactive">禁用</Select.Option>
      </Select>
    </SearchBox>
  );
};
```

---

### Grid 通用表格

集成搜索、表格、分页、按钮等功能的通用表格组件。

#### API

```typescript
interface GridProps<T = any> extends TableProps {
  code: string;                                      // 页面代码（必填）
  data: {                                            // 表格数据（必填）
    list?: T[];
    records?: T[];
    pagination?: {
      total?: number;
      current?: number;
      pageSize?: number;
    };
  };
  loading?: boolean;                                 // 加载状态
  onSearch: (params: any) => void;                   // 搜索回调（必填）
  onSelectRow?: (rows: T[]) => void;                 // 行选择回调
  renderSearchForm?: () => React.ReactNode;          // 自定义搜索表单
  renderLeftButton?: () => React.ReactNode;          // 自定义左侧按钮
  renderRightButton?: () => React.ReactNode;         // 自定义右侧按钮
  btnCallBack?: (payload: {
    btn: ButtonConfig;
    keys: React.Key[];
    rows: T[];
    refresh: () => void;
  }) => void;                                        // 按钮回调
}
```

#### 使用示例

```tsx
import { Grid } from '@/components/BusinessComponents';
import { Button, Input, message } from 'antd';
import { ColumnsType } from 'antd/es/table';

interface User {
  id: string;
  account: string;
  name: string;
  status: string;
}

const UserPage = () => {
  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState({
    list: [],
    pagination: { total: 0, current: 1, pageSize: 10 },
  });

  // 搜索处理
  const handleSearch = (params: any) => {
    setLoading(true);
    // 调用 API 获取数据
    // fetchUserList(params).then(res => {
    //   setUserData(res.data);
    //   setLoading(false);
    // });
  };

  // 列配置
  const columns: ColumnsType<User> = [
    { title: '账号', dataIndex: 'account', key: 'account' },
    { title: '姓名', dataIndex: 'name', key: 'name' },
    { title: '状态', dataIndex: 'status', key: 'status' },
  ];

  // 按钮回调
  const handleBtnCallBack = ({ btn, keys, rows, refresh }) => {
    if (btn.alias === 'delete') {
      if (keys.length === 0) {
        message.warning('请先选择要删除的记录');
        return;
      }
      Modal.confirm({
        title: '确认删除',
        content: '确定删除选中的记录吗？',
        onOk: () => {
          // 调用删除 API
          refresh();
        },
      });
    }
  };

  return (
    <Grid
      code="system.user"
      columns={columns}
      data={userData}
      loading={loading}
      onSearch={handleSearch}
      onSelectRow={(rows) => console.log('选中的行:', rows)}
      renderSearchForm={() => (
        <Input name="keyword" placeholder="请输入关键词" />
      )}
      renderLeftButton={() => <Button>导出</Button>}
      btnCallBack={handleBtnCallBack}
    />
  );
};
```

---

## 使用示例

### 完整的页面示例

```tsx
import React, { useState } from 'react';
import { PageContainer } from '@ant-design/pro-components';
import { Button, Input, Modal, message } from 'antd';
import { Grid } from '@/components/BusinessComponents';
import type { ButtonConfig } from '@/components/BusinessComponents';

interface User {
  id: string;
  account: string;
  name: string;
  status: string;
}

const UserPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState({
    list: [],
    pagination: { total: 0, current: 1, pageSize: 10 },
  });

  // 搜索处理
  const handleSearch = (params: any) => {
    setLoading(true);
    setTimeout(() => {
      setUserData({
        list: [
          { id: '1', account: 'admin', name: '管理员', status: 'active' },
          { id: '2', account: 'user', name: '普通用户', status: 'inactive' },
        ],
        pagination: { total: 2, current: 1, pageSize: 10 },
      });
      setLoading(false);
    }, 500);
  };

  // 按钮回调
  const handleBtnCallBack = ({ btn, keys, rows, refresh }) => {
    switch (btn.alias) {
      case 'add':
        console.log('新增');
        break;
      case 'edit':
        if (keys.length !== 1) {
          message.warning('只能选择一条数据进行编辑');
          return;
        }
        console.log('编辑:', keys[0]);
        break;
      case 'delete':
        if (keys.length === 0) {
          message.warning('请先选择要删除的记录');
          return;
        }
        Modal.confirm({
          title: '确认删除',
          content: '确定删除选中的记录吗？',
          onOk: () => {
            message.success('删除成功');
            refresh();
          },
        });
        break;
      default:
        console.log('其他操作:', btn);
    }
  };

  // 列配置
  const columns = [
    { title: '账号', dataIndex: 'account', key: 'account' },
    { title: '姓名', dataIndex: 'name', key: 'name' },
    { title: '状态', dataIndex: 'status', key: 'status' },
  ];

  return (
    <PageContainer title="用户管理">
      <Grid
        code="system.user"
        columns={columns}
        data={userData}
        loading={loading}
        onSearch={handleSearch}
        renderSearchForm={() => (
          <Input name="keyword" placeholder="请输入关键词" />
        )}
        btnCallBack={handleBtnCallBack}
      />
    </PageContainer>
  );
};

export default UserPage;
```

---

## 注意事项

1. **TypeScript 支持**：所有组件都使用 TypeScript 编写，提供完整的类型定义
2. **React 19 兼容**：组件遵循 React 19 的函数式组件规范
3. **Ant Design Pro 6.x**：组件基于 Ant Design Pro 6.x 设计，与其他组件无缝集成
4. **权限控制**：Grid 和 ToolBar 组件预留了权限控制接口，需要配合权限系统使用
5. **数据格式**：Grid 组件支持多种数据格式（list、records），适配不同的后端接口
6. **自定义扩展**：所有组件都支持通过 props 进行自定义扩展

---

## 更新日志

### v1.0.0 (2026-03-20)

- ✨ 新增 Panel 面板组件
- ✨ 新增 ToolBar 工具栏组件
- ✨ 新增 SearchBox 搜索框组件
- ✨ 新增 Grid 通用表格组件
- ✨ 完整的 TypeScript 类型定义
- ✨ 详细的使用文档

---

**维护者**: 项目开发团队  
**最后更新**: 2026-03-20
