# Actions 和 Models 模块必要性分析报告

## 目录

- [1. 概述](#1-概述)
- [2. 当前项目架构分析](#2-当前项目架构分析)
- [3. Actions 和 Models 的使用情况](#3-actions 和 models 的使用情况)
- [4. 技术栈对比](#4-技术栈对比)
- [5. 改造建议](#5-改造建议)
- [6. 影响评估](#6-影响评估)
- [7. 结论](#7-结论)

---

## 1. 概述

本报告旨在分析 `D:\workproject\springbladeandreact\ant-design-pro` 项目中 Actions 和 Models 模块的必要性，评估其对当前项目架构的影响，并提供改造建议。

### 分析目标

1. 评估 Actions 和 Models 模块在当前项目中的必要性
2. 分析当前项目的状态管理方案
3. 提供架构优化建议
4. 评估改造的影响和风险

---

## 2. 当前项目架构分析

### 2.1 技术栈信息

通过检查 `package.json` 和 `src/app.tsx`，确认当前项目使用以下技术栈：

```json
{
  "umi": "^4.6.33",
  "react": "^19.0.0",
  "antd": "^5.24.8",
  "@ant-design/pro-components": "^2.8.10",
  "@umijs/max": "^4.6.33"
}
```

**关键技术栈：**
- **框架**: UmiJS 4.x（不是 Dva）
- **React**: 19.x（最新版本）
- **UI 库**: Ant Design 5.x
- **组件库**: Ant Design Pro Components
- **状态管理**: 使用 Umi 内置的状态管理（非 Dva）

### 2.2 项目架构特点

#### 2.2.1 目录结构

```
src/
├── components/          # 组件目录
├── pages/              # 页面目录
├── services/           # 服务层（API 调用）
├── utils/              # 工具函数
├── app.tsx             # 应用入口
└── access.ts           # 权限控制
```

**注意：** 当前项目没有 `actions/` 和 `models/` 目录

#### 2.2.2 状态管理方式

当前项目使用 UmiJS 4 的现代化状态管理方案：

1. **useRequest**：处理异步请求状态
2. **useState**：处理本地状态
3. **useModel**：使用 Umi 的简单状态管理（可选）
4. **Context**：处理全局状态

**不使用**传统的 Dva（Redux + Saga）架构。

### 2.3 与 Sword 项目的对比

| 对比项 | Sword 项目 | 当前项目 |
|-------|-----------|---------|
| **框架版本** | Umi 3.x + Dva | Umi 4.x（无 Dva） |
| **React 版本** | React 17/18 | React 19 |
| **状态管理** | Dva（Redux + Saga） | useRequest + useState |
| **Actions** | ✅ 有 | ❌ 无 |
| **Models** | ✅ 有（Dva Models） | ❌ 无 |
| **组件库** | 自研 Sword 组件 | Ant Design Pro Components |

---

## 3. Actions 和 Models 的使用情况

### 3.1 代码扫描结果

通过对 `src/` 目录的全面扫描：

```bash
# 搜索 Actions 引用
grep -r "from '@/actions" src/
# 结果：0 个文件

# 搜索 Models 引用
grep -r "from '@/models" src/
# 结果：0 个文件

# 搜索 Dva connect
grep -r "connect(" src/
# 结果：0 个文件

# 搜索 Dva useDispatch
grep -r "useDispatch" src/
# 结果：0 个文件
```

**结论：** 当前项目完全没有使用 Actions 和 Models

### 3.2 当前状态管理实践

通过分析现有代码，项目使用以下状态管理方式：

#### 3.2.1 使用 useRequest 处理异步请求

```typescript
// 示例：src/pages/System/User/User.tsx
import { useRequest } from 'ahooks';

const UserPage = () => {
  const { data, loading, run: fetchUserList } = useRequest(
    () => getUserList(params),
    { manual: true }
  );

  return <div>...</div>;
};
```

#### 3.2.2 使用 useState 处理本地状态

```typescript
// 示例
const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
const [addModalVisible, setAddModalVisible] = useState<boolean>(false);
```

#### 3.2.3 使用 useModel（可选）

UmiJS 4 提供了简化的 useModel，但不是必须的。

---

## 4. 技术栈对比

### 4.1 Dva（Actions + Models）vs 现代方案

| 对比项 | Dva（Actions + Models） | 现代方案（useRequest + useState） |
|-------|----------------------|--------------------------------|
| **学习曲线** | 陡峭（需要学习 Redux、Saga） | 平缓（React Hooks） |
| **代码量** | 多（需要编写 Actions、Models、Reducers） | 少（直接使用 Hooks） |
| **类型支持** | 一般（需要额外配置 TypeScript） | 优秀（原生 TypeScript 支持） |
| **性能** | 一般（全局状态更新） | 优秀（组件级状态更新） |
| **维护成本** | 高（文件多、结构复杂） | 低（代码集中、逻辑清晰） |
| **适用场景** | 大型复杂应用 | 中小型应用、现代项目 |

### 4.2 行业趋势

根据 React 和 UmiJS 的发展趋势：

1. **React 官方推荐**：使用 Hooks（useState、useReducer、useContext）
2. **UmiJS 4**：默认不集成 Dva，推荐使用 useRequest
3. **Ant Design Pro 6**：使用 ProComponents + Hooks
4. **新项目趋势**：避免使用 Redux/Dva，采用更轻量的方案

---

## 5. 改造建议

### 5.1 总体建议

**不建议**在当前项目中引入 Actions 和 Models 模块。

**理由：**

1. **技术栈不匹配**：当前项目使用 UmiJS 4（无 Dva），引入 Actions/Models 需要额外配置
2. **增加复杂度**：会显著增加代码量和项目复杂度
3. **违背最佳实践**：不符合 React 19 和 UmiJS 4 的最佳实践
4. **无实际需求**：当前项目没有使用 Actions/Models，功能正常运行

### 5.2 推荐方案

#### 5.2.1 继续使用现有的 Hooks 方案

```typescript
// 推荐做法
import { useRequest } from 'ahooks';
import { useState } from 'react';

const UserPage = () => {
  const [params, setParams] = useState({});
  
  const { data, loading, run } = useRequest(
    () => userService.getList(params),
    { manual: true }
  );

  const handleSearch = (newParams) => {
    setParams(newParams);
    run();
  };

  return <div>...</div>;
};
```

#### 5.2.2 如需状态复用，使用 useModel

UmiJS 4 提供了简化的 useModel：

```typescript
// src/models/useUser.ts
export default () => {
  const [users, setUsers] = useState([]);
  
  const fetchUsers = async (params) => {
    const data = await getUserList(params);
    setUsers(data);
  };

  return { users, fetchUsers };
};

// 在组件中使用
const UserPage = () => {
  const { users, fetchUsers } = useModel('useUser');
  return <div>...</div>;
};
```

#### 5.2.3 如需全局状态，使用 Context

```typescript
// src/contexts/GlobalContext.tsx
const GlobalContext = createContext({});

export const GlobalProvider = ({ children }) => {
  const [globalState, setGlobalState] = useState({});
  return (
    <GlobalContext.Provider value={{ globalState, setGlobalState }}>
      {children}
    </GlobalContext.Provider>
  );
};
```

### 5.3 如果必须引入 Actions/Models

如果由于某些原因（如团队习惯、历史代码）必须引入 Actions/Models，建议：

#### 5.3.1 安装 Dva

```bash
npm install @umijs/plugins/dist/dva
```

#### 5.3.2 配置 Dva

```typescript
// .umirc.ts
export default {
  plugins: ['@umijs/plugins/dist/dva'],
  dva: {
    immer: true,
  },
};
```

#### 5.3.3 创建 Actions 和 Models

```javascript
// src/actions/user.js
export const USER_LIST = 'user/fetchList';

export function userList(payload) {
  return {
    type: USER_LIST,
    payload,
  };
}

// src/models/user.js
export default {
  namespace: 'user',
  state: {
    list: [],
  },
  effects: {
    *fetchList({ payload }, { call, put }) {
      const response = yield call(userService.getList, payload);
      yield put({
        type: 'saveList',
        payload: response.data,
      });
    },
  },
  reducers: {
    saveList(state, action) {
      return {
        ...state,
        list: action.payload,
      };
    },
  },
};
```

#### 5.3.4 在组件中使用

```typescript
// 不推荐的做法
import { connect } from 'umi';
import { userList } from '@/actions/user';

const UserPage = ({ user, dispatch }) => {
  useEffect(() => {
    dispatch(userList({ current: 1, pageSize: 10 }));
  }, []);

  return <div>{user.list}</div>;
};

export default connect(({ user }) => ({ user }))(UserPage);
```

---

## 6. 影响评估

### 6.1 引入 Actions/Models 的影响

#### 6.1.1 正面影响（有限）

1. **代码风格统一**：如果团队熟悉 Dva，可能更容易上手
2. **状态管理集中**：所有状态都在 models 中管理

#### 6.1.2 负面影响（显著）

1. **增加复杂度**
   - 需要创建 Actions 目录和 Models 目录
   - 每个模块需要编写多个文件（Actions、Models、Reducers）
   - 代码量增加 2-3 倍

2. **性能下降**
   - 全局状态更新会导致不必要的重渲染
   - Redux 的中间件会增加运行时开销

3. **维护成本增加**
   - 需要维护更多的文件
   - 类型定义更复杂
   - 调试更困难

4. **技术栈冲突**
   - 与 UmiJS 4 的默认配置不兼容
   - 需要额外配置 Dva 插件
   - 与 ProComponents 的设计理念不符

### 6.2 不引入 Actions/Models 的影响

#### 6.2.1 正面影响（显著）

1. **代码简洁**
   - 逻辑集中在组件内，易于理解
   - 代码量减少
   - 文件数量减少

2. **性能优秀**
   - 组件级状态更新，避免不必要的重渲染
   - 无额外的运行时开销

3. **符合最佳实践**
   - 遵循 React 19 和 UmiJS 4 的最佳实践
   - 与 Ant Design Pro 6 的设计理念一致
   - 更容易获得社区支持

4. **开发效率高**
   - 减少样板代码
   - 更快的开发速度
   - 更容易测试

#### 6.2.2 潜在挑战

1. **需要学习 Hooks**
   - 团队成员需要熟悉 useRequest、useState 等 Hooks
   - 需要改变传统的 Redux/Dva 思维模式

2. **状态复用**
   - 需要使用 useModel 或 Context 实现状态复用
   - 需要设计良好的组件接口

---

## 7. 结论

### 7.1 核心结论

**Actions 和 Models 模块对于当前项目不是必要的，不建议引入。**

### 7.2 理由总结

1. **技术栈不匹配**
   - 当前项目使用 UmiJS 4 + React 19，不使用 Dva
   - 引入 Actions/Models 需要额外配置，增加复杂度

2. **无实际需求**
   - 当前项目没有使用 Actions/Models，功能正常运行
   - 现有的 Hooks 方案已经足够满足需求

3. **违背最佳实践**
   - React 官方推荐使用 Hooks
   - UmiJS 4 默认不集成 Dva
   - Ant Design Pro 6 使用 ProComponents + Hooks

4. **维护成本高**
   - 增加代码量和文件数量
   - 增加学习和维护成本
   - 降低开发效率

### 7.3 推荐方案

**继续使用现有的 Hooks 方案：**

1. **useRequest**：处理异步请求
2. **useState**：处理本地状态
3. **useModel**（可选）：简单的状态复用
4. **Context**：全局状态管理

### 7.4 BusinessComponents 组件库

为了提升代码复用率，已创建 `BusinessComponents` 组件库：

- **Panel**：页面面板容器
- **ToolBar**：工具栏按钮组件
- **SearchBox**：搜索表单组件
- **Grid**：通用表格组件

这些组件使用现代 React Hooks 编写，与当前项目技术栈完美契合。

### 7.5 后续建议

1. **保持现有技术栈**：继续使用 UmiJS 4 + React 19 + Hooks
2. **完善组件库**：继续开发 BusinessComponents 组件库
3. **提升代码质量**：使用 TypeScript，编写类型安全的代码
4. **关注最佳实践**：遵循 React 和 UmiJS 的官方推荐

---

**报告版本：** v1.0  
**创建时间：** 2026-03-20  
**作者：** 项目开发团队  
**审核状态：** 待审核
