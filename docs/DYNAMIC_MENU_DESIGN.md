# 动态菜单系统设计方案

**文档版本**: 1.0
**创建日期**: 2026-03-19
**项目**: Ant Design Pro 动态菜单系统重构

---

## 1. 背景与目标

### 1.1 当前实现问题

当前系统的菜单实现存在以下核心缺陷：

| 缺陷类型 | 具体问题 | 影响程度 |
|---------|---------|---------|
| 硬编码维护成本 | 添加新页面需要同时修改 `_dynamic.tsx` 中的组件映射表 | 🔴 高 |
| Webpack编译耦合 | `lazy(() => import(...))` 模式依赖编译时分析，动态添加页面需重新编译 | 🔴 高 |
| 扩展性不足 | 无法支持运行时动态注册新页面组件 | 🟡 中 |
| 权限控制粗糙 | 当前权限控制基于 `access.ts`，但菜单级别权限未与后端联动 | 🟡 中 |
| 缓存策略缺失 | 菜单数据每次刷新页面都重新请求，无本地缓存 | 🟡 中 |

### 1.2 改造目标

1. **消除硬编码**：菜单配置与前端代码解耦，通过后端API管理
2. **支持运行时动态加载**：新增页面无需重新编译打包
3. **权限精细化控制**：基于用户角色的菜单级权限控制
4. **多级缓存策略**：提升菜单加载性能，减少服务器压力
5. **统一管理界面**：复用现有 System/Menu 页面进行配置管理

---

## 2. 系统架构设计

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                         用户浏览器                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    前端应用层 (React + Umi Max)              ││
│  │  ┌─────────────┐    ┌──────────────┐    ┌─────────────────┐ ││
│  │  │  ProLayout  │◄───│  Router      │◄───│ DynamicLoader  │ ││
│  │  │  菜单渲染   │    │  路由匹配    │    │  动态组件加载   │ ││
│  │  └─────────────┘    └──────────────┘    └─────────────────┘ ││
│  │          │                                      │          ││
│  │          ▼                                      ▼          ││
│  │  ┌─────────────────────────────────────────────────────┐   ││
│  │  │           ComponentRegistry (组件注册表)             │   ││
│  │  │  ┌──────────────┐    ┌──────────────────────────┐   │   ││
│  │  │  │ BundledComponents │  │ RemoteComponentCache  │   │   ││
│  │  │  │  (编译时组件)  │    │   (远程加载组件缓存)    │   │   ││
│  │  │  └──────────────┘    └──────────────────────────┘   │   ││
│  │  └─────────────────────────────────────────────────────┘   ││
│  └─────────────────────────────────────────────────────────────┘│
│                              │                                    │
│                              ▼                                    │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    缓存层 (Multi-Level Cache)               ││
│  │  ┌─────────┐    ┌─────────────┐    ┌────────────────────┐ ││
│  │  │  Memory │    │ LocalStorage│    │  SessionStorage   │ ││
│  │  │  内存缓存│    │  本地缓存   │    │   会话缓存         │ ││
│  │  │ (进程级)│    │  (持久化)   │    │   (标签页级)       │ ││
│  │  └─────────┘    └─────────────┘    └────────────────────┘ ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Spring Boot 后端服务                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                     API 网关层                               ││
│  │  ┌─────────────────┐    ┌─────────────────────────────────┐││
│  │  │ /menu/routes    │    │ /menu/component-map             │││
│  │  │ 获取用户菜单树   │    │ 获取组件映射配置(含远程组件URL)  │││
│  │  └─────────────────┘    └─────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────────┘│
│                              │                                    │
│                              ▼                                    │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    业务逻辑层 (MenuService)                   ││
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  ││
│  │  │ MenuAuth     │    │ MenuCache    │    │ ComponentMgr │  ││
│  │  │ 权限校验     │    │ 菜单缓存管理  │    │ 组件管理     │  ││
│  │  └──────────────┘    └──────────────┘    └──────────────┘  ││
│  └─────────────────────────────────────────────────────────────┘│
│                              │                                    │
│                              ▼                                    │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    数据访问层 (JPA/MyBatis)                 ││
│  │  ┌──────────────┐    ┌──────────────────────────────────┐   ││
│  │  │ blade_menu  │    │ blade_menu_component             │   ││
│  │  │ 菜单表      │    │ 组件配置表(存储远程组件地址)     │   ││
│  │  └──────────────┘    └──────────────────────────────────┘   ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 数据流转流程

```
┌──────────────────────────────────────────────────────────────────┐
│                        用户登录流程                               │
└──────────────────────────────────────────────────────────────────┘

1. 用户登录 ─► 后端验证 ─► 返回 Token + 用户信息(含角色ID)
                     │
                     ▼
2. 前端获取Token ─► 调用 /menu/routes API
                     │
                     ▼
3. 后端根据角色ID ─► 查询角色菜单权限 ─► 返回菜单树(包含component字段)
                     │
                     ▼
4. 前端解析菜单数据 ─► 构建路由表 ─► 注册组件到 ComponentRegistry
                     │
                     ▼
5. 渲染 ProLayout ─► 显示左侧菜单 ─► 用户点击菜单
                     │
                     ▼
6. 路由匹配 ─► ComponentRegistry 查询组件
                     │
         ┌───────────┴───────────┐
         ▼                       ▼
   组件已在内存中            组件需要远程加载
   直接渲染                 动态下载JS模块
         │                       │
         └───────────┬───────────┘
                     ▼
              渲染页面组件
```

---

## 3. 后端接口设计

### 3.1 菜单路由接口 (扩展)

**接口**: `GET /api/blade-system/menu/routes`

**响应数据结构**:
```json
{
  "code": 200,
  "msg": "success",
  "data": [
    {
      "id": 1,
      "name": "商品管理",
      "path": "/mall/product/list",
      "component": "./Mall/Product/ProductList",
      "icon": "ShopOutlined",
      "parentId": 0,
      "orderNum": 1,
      "isOpen": 2,
      "permissions": ["product:view", "product:edit"],
      "children": [
        {
          "id": 11,
          "name": "商品列表",
          "path": "/mall/product/list",
          "component": "./Mall/Product/ProductList",
          "icon": "ListOutlined",
          "parentId": 1,
          "orderNum": 1,
          "isOpen": 2,
          "permissions": ["product:list"]
        }
      ]
    }
  ]
}
```

### 3.2 组件映射接口 (新增)

**接口**: `GET /api/blade-system/menu/component-map`

**响应数据结构**:
```json
{
  "code": 200,
  "msg": "success",
  "data": {
    "bundled": {
      "./Mall/Product/ProductList": "./Mall/Product/ProductList"
    },
    "remote": {
      "remote-component-product": "https://cdn.example.com/components/product-list.20260319.js"
    },
    "version": "20260319"
  }
}
```

### 3.3 远程组件注册接口 (新增)

**接口**: `POST /api/blade-system/menu/component/register`

**请求数据结构**:
```json
{
  "componentName": "custom-report",
  "componentUrl": "https://cdn.example.com/components/custom-report.js",
  "version": "1.0.0",
  "md5": "d41d8cd98f00b204e9800998ecf8427e"
}
```

---

## 4. 前端模块设计

### 4.1 核心组件架构

```
src/
├── components/
│   └── DynamicLoader/           # 动态组件加载器
│       ├── index.tsx           # 主组件
│       ├── ComponentRegistry.ts # 组件注册表
│       ├── RemoteLoader.ts      # 远程组件加载器
│       └── CacheManager.ts      # 多级缓存管理
├── pages/
│   └── System/
│       └── Menu/
│           ├── Menu.tsx         # 菜单管理主页面 (扩展)
│           └── ComponentConfig.tsx # 组件配置子页面 (新增)
├── services/
│   └── system/
│       ├── menu.ts             # 菜单API (扩展)
│       └── component.ts        # 组件管理API (新增)
├── hooks/
│   ├── useMenuData.ts          # 菜单数据Hook
│   └── useDynamicComponent.ts  # 动态组件Hook
├── models/
│   └── menuModel.ts            # 菜单状态管理
├── utils/
│   ├── menuCache.ts            # 菜单缓存工具
│   └── componentLoader.ts      # 组件加载工具
└── types/
    └── menu.ts                 # 菜单类型定义
```

### 4.2 ComponentRegistry 设计

```typescript
// ComponentRegistry.ts
interface ComponentInfo {
  component: React.ComponentType;
  source: 'bundled' | 'remote';
  url?: string;
  loadedAt: number;
}

class ComponentRegistry {
  private registry: Map<string, ComponentInfo> = new Map();

  // 注册编译时组件
  registerBundled(path: string, component: React.ComponentType): void;

  // 注册远程组件
  async registerRemote(name: string, url: string, md5?: string): Promise<void>;

  // 获取组件
  get(path: string): React.ComponentType | null;

  // 检查组件是否存在
  has(path: string): boolean;

  // 批量预加载组件
  preload(paths: string[]): Promise<void>;
}
```

### 4.3 缓存策略设计

```typescript
// CacheManager.ts
interface CacheConfig {
  memoryTTL: number;      // 内存缓存 TTL (默认: 5分钟)
  localTTL: number;        // LocalStorage TTL (默认: 30分钟)
  versionCheck: boolean;    // 是否检查版本更新
}

class MenuCacheManager {
  // L1: 内存缓存 ( fastest )
  private memoryCache: Map<string, { data: any; expiry: number }>;

  // L2: LocalStorage 缓存 ( fast )
  private localCacheKey = 'blade-menu-cache';

  // L3: 后端API ( source of truth )

  async getMenuData(forceRefresh = false): Promise<MenuData>;

  private checkExpiry(cached: any, ttl: number): boolean;

  private invalidateCache(): void;
}
```

### 4.4 远程组件加载器设计

```typescript
// RemoteLoader.ts
interface RemoteComponentConfig {
  name: string;
  url: string;
  md5?: string;
  scope?: string;  // webpack chunk 加载时的 scope 名
}

class RemoteComponentLoader {
  private loadedScripts: Map<string, Promise<any>> = new Map();

  async load(config: RemoteComponentConfig): Promise<React.ComponentType>;

  private verifyMD5(content: string, expectedMD5: string): boolean;

  private injectScript(url: string, scope: string): Promise<any>;
}
```

---

## 5. 数据库设计

### 5.1 菜单表扩展 (blade_menu)

```sql
ALTER TABLE blade_menu ADD COLUMN component VARCHAR(255) DEFAULT NULL COMMENT '组件路径';
ALTER TABLE blade_menu ADD COLUMN component_type VARCHAR(20) DEFAULT 'bundled' COMMENT '组件类型: bundled-内置, remote-远程';
ALTER TABLE blade_menu ADD COLUMN remote_url VARCHAR(500) DEFAULT NULL COMMENT '远程组件地址';
ALTER TABLE blade_menu ADD COLUMN cache_version VARCHAR(50) DEFAULT NULL COMMENT '组件版本号';
```

### 5.2 新增组件配置表 (blade_menu_component)

```sql
CREATE TABLE blade_menu_component (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    component_name VARCHAR(100) NOT NULL COMMENT '组件名称',
    component_path VARCHAR(255) NOT NULL COMMENT '组件路径',
    component_type VARCHAR(20) NOT NULL DEFAULT 'bundled' COMMENT '组件类型: bundled-内置, remote-远程',
    remote_url VARCHAR(500) COMMENT '远程组件URL',
    version VARCHAR(50) COMMENT '版本号',
    md5 VARCHAR(32) COMMENT 'MD5校验值',
    status TINYINT DEFAULT 1 COMMENT '状态: 0-禁用, 1-启用',
    remark VARCHAR(500) COMMENT '备注',
    create_user VARCHAR(64) DEFAULT '' COMMENT '创建者',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_user VARCHAR(64) DEFAULT '' COMMENT '更新者',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    UNIQUE KEY uk_component_path (component_path),
    UNIQUE KEY uk_component_name (component_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='菜单组件配置表';
```

---

## 6. 权限控制设计

### 6.1 权限校验流程

```
用户点击菜单项
      │
      ▼
检查菜单的 permissions 字段
      │
      ▼
调用后端 API 验证权限
GET /api/blade-system/menu/auth?path=/mall/product/list
      │
      ├─── 有权限 ──── 渲染组件
      │
      └─── 无权限 ──── 显示 403 页面
```

### 6.2 前端权限 Hook

```typescript
// useMenuPermission.ts
export function useMenuPermission(menuPath: string) {
  const { currentUser } = useModel('initialState');

  const hasPermission = useMemo(() => {
    if (!currentUser?.permissions) return false;
    return currentUser.permissions.includes(menuPath);
  }, [currentUser, menuPath]);

  return { hasPermission };
}
```

---

## 7. 与现有系统集成

### 7.1 集成点清单

| 模块 | 文件 | 改动方式 | 兼容性 |
|-----|------|---------|--------|
| 动态路由 | `src/pages/_dynamic.tsx` | 重构为 ComponentRegistry | 🟡 需同步修改 |
| 菜单获取 | `src/app.tsx` | 增强缓存逻辑 | ✅ 向后兼容 |
| 菜单管理 | `src/pages/System/Menu/Menu.tsx` | 增加组件配置 Tab | ✅ 向后兼容 |
| 权限控制 | `src/access.ts` | 联动后端权限 | ✅ 向后兼容 |
| 路由配置 | `config/routes.ts` | 保持 `path: '*'` 捕获 | ✅ 无需改动 |

### 7.2 向后兼容策略

1. **组件映射兼容**：远程组件加载失败时，降级到 bundled 组件查找
2. **权限降级**：后端权限校验失败时，使用前端 access.ts 的基础权限
3. **缓存降级**：LocalStorage 不可用时，仅使用内存缓存

---

## 8. 实施计划

### Phase 1: 基础设施搭建
- [ ] 创建 ComponentRegistry 类
- [ ] 创建 CacheManager 多级缓存类
- [ ] 创建 RemoteLoader 远程加载器
- [ ] 定义 TypeScript 类型

### Phase 2: 后端接口开发
- [ ] 扩展 Menu 实体增加 component 相关字段
- [ ] 修改 MenuService 增加 component 字段返回
- [ ] 新增 component-map 接口
- [ ] 新增 component 注册接口

### Phase 3: 前端核心改造
- [ ] 重构 _dynamic.tsx 为 ComponentRegistry
- [ ] 改造 app.tsx 的 render 函数集成缓存
- [ ] 实现 useMenuData Hook
- [ ] 实现 useDynamicComponent Hook

### Phase 4: 管理界面扩展
- [ ] 扩展 System/Menu 页面增加组件配置 Tab
- [ ] 开发 ComponentConfig 子页面
- [ ] 集成远程组件上传/注册功能

### Phase 5: 测试与优化
- [ ] 单元测试
- [ ] 集成测试
- [ ] 性能优化
- [ ] 错误处理与降级测试

---

## 9. 安全考虑

### 9.1 远程组件安全

1. **MD5 校验**：远程组件加载后进行 MD5 校验
2. **白名单机制**：仅允许加载认证过的远程组件
3. **沙箱执行**：远程组件在受限环境中执行

### 9.2 权限安全

1. **后端验证**：所有权限操作需后端二次验证
2. **Token 刷新**：Token 过期时自动刷新
3. **操作审计**：关键操作记录审计日志

---

## 10. 风险与应对

| 风险 | 概率 | 影响 | 应对措施 |
|-----|-----|-----|---------|
| 远程组件加载失败 | 中 | 中 | 降级到 bundled 组件 + 错误提示 |
| 缓存数据不一致 | 低 | 中 | 设置合理 TTL + 版本校验 |
| 权限校验延迟 | 低 | 低 | 前端先展示 + 后台异步校验 |
| 组件版本冲突 | 低 | 高 | MD5 校验 + 灰度发布 |

---

**文档结束**
