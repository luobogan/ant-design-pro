# 角色管理 - 人员管理功能实现计划

## 需求分析

在角色管理页面增加人员管理功能：
1. **查看人员**：查看当前角色下的所有用户列表
2. **增加人员**：从系统用户中选择用户添加到当前角色
3. **删减人员**：从当前角色中移除用户

## 技术方案

### 后端实现

#### 1. 修改 RoleController.java
添加新接口：
- `GET /blade-system/role/users` - 获取角色下的用户列表
- `POST /blade-system/role/grant-user` - 向角色添加用户
- `POST /blade-system/role/revoke-user` - 从角色移除用户

#### 2. 修改 IRoleService.java
添加服务接口：
- `List<User> getUsersByRoleId(Long roleId)` - 根据角色ID获取用户列表
- `boolean grantUser(Long roleId, List<Long> userIds)` - 授权用户到角色
- `boolean revokeUser(Long roleId, List<Long> userIds)` - 取消用户的角色授权

#### 3. 修改 RoleServiceImpl.java
实现上述服务方法

#### 4. 修改 UserMapper.xml
添加查询用户的 SQL

### 前端实现

#### 1. 修改 role.ts (API服务)
添加新的 API 调用方法

#### 2. 修改 Role.tsx (角色管理页面)
- 添加人员管理弹窗组件
- 在操作列添加"人员管理"按钮
- 实现人员列表展示、添加、删除功能

## 文件修改清单

| 文件路径 | 修改类型 | 说明 |
| :--- | :--- | :--- |
| `src/main/java/org/springblade/modules/system/controller/RoleController.java` | 修改 | 添加人员管理相关接口 |
| `src/main/java/org/springblade/modules/system/service/IRoleService.java` | 修改 | 添加服务接口定义 |
| `src/main/java/org/springblade/modules/system/service/impl/RoleServiceImpl.java` | 修改 | 实现服务方法 |
| `src/main/java/org/springblade/modules/system/mapper/UserMapper.xml` | 修改 | 添加查询用户的SQL |
| `src/services/authority/role.ts` | 修改 | 添加前端API调用 |
| `src/pages/Authority/Role/Role.tsx` | 修改 | 添加人员管理弹窗和操作按钮 |

## 数据库表说明

系统使用 `blade_user` 表存储用户信息，用户的角色信息存储在 `role_id` 字段（逗号分隔的角色ID字符串）。

## 实现步骤

1. **后端接口开发**（第1-2天）
   - 添加 Controller 接口
   - 添加 Service 接口和实现
   - 添加 Mapper SQL

2. **前端页面开发**（第3天）
   - 添加人员管理弹窗
   - 实现人员列表展示
   - 实现添加/删除功能

## 风险评估

- **低风险**：功能相对独立，不影响现有业务逻辑
- 需要注意租户隔离，确保只能看到当前租户的用户

## 测试要点

1. 查看角色人员列表功能
2. 添加用户到角色功能
3. 从角色移除用户功能
4. 租户隔离验证