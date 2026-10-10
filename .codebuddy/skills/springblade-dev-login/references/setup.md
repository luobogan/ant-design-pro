# SpringBlade 开发环境调试前置

本 skill 依赖本地 dev 环境已就绪。下面是所有需要的「地图」与「验证码关闭/重启」步骤。

## 1. 端口与服务拓扑

| 服务 | 端口 | 说明 |
|------|------|------|
| ant-design-pro 前端 dev server | **8000** | Vite，代理 `/api` → 网关 81（并去掉 `/api` 前缀） |
| blade-gateway | **81** | 网关，校验 `Blade-Auth` 后按服务名路由 |
| blade-auth | **8100** | 认证服务，登录接口 `/blade-auth/token`（`grant_type=captcha`） |

前端请求路径 `/api/blade-workflow/migration/reconcile` 经代理到网关即 `http://127.0.0.1:81/blade-workflow/migration/reconcile`。

## 2. 登录凭据（dev 默认）

- 账号 `admin`，密码 `ant.design`，租户 `000000`。
- 前端密码用 **SM2** 加密（公钥在 `config/defaultSettings.ts` 的 `auth.publicKey`）。
- token 存于 `localStorage['sword-token']`。

## 3. 网关鉴权头（关键，非显而易见）

手动测后端接口时，网关**只**需要这三个头，本环境**不**额外校验 `sword` 签名：

```
blade-auth: bearer <accessToken>
Authorization: Basic c3dvcmQ6c3dvcmRfc2VjcmV0   # = base64("sword:sword_secret")
Tenant-Id: 000000
```

> 之前只带 `bearer <token>` 会被网关拒（"签名认证失败"），漏了 Basic / Tenant-Id。
> 用 `scripts/pw_login.cjs` 时会自动从页面真实请求里捕获这三个头，无需手算。

## 4. 验证码开关（Playwright 自动登录前提）

网关登录走 `captcha` 授权类型（`CaptchaTokenGranter`），本应校验图片验证码（`Captcha-Key`/`Captcha-Code`）。**本 dev 环境已通过系统参数关闭验证码，自动登录无需任何代码改动。**

### 4.1 开关原理（已默认关闭，无需操作）

`CaptchaTokenGranter.grant()` 在登录时按租户读取系统参数 `captcha_mode`：

```
GET http://localhost:81/blade-system/param/public-value?paramKey=captcha_mode&tenantId=<租户>
```

- 返回 `data = "false"` → `captchaRequired=false` → **跳过验证码校验**。
- 返回 `"true"` 或读不到（异常）→ 仍要求验证码。

当前 dev 租户 `000000` 已设置为关闭（已确认 `blade_param` 中 `captcha_mode:000000 = false`）。因此 `scripts/pw_login.cjs` 直接以真实前端流程登录即可，不会卡在验证码。

### 4.2 如何查看 / 确认

```sql
-- blade 库
SELECT id, param_key, param_value, remark
FROM blade_param
WHERE param_key = 'captcha_mode:000000';
-- 期望 param_value = false
```

若需临时开启验证码做联调，把该值改为 `true`（或删掉该参数）即可；改完无需重启 blade-auth（参数实时读取）。**不要再用改 `CaptchaTokenGranter.java` 源码的方式关验证码**——那是旧方案，会引入需要回滚的脏改动（`scripts/restart_blade_auth.ps1` 已废弃）。

### 4.3 （历史）旧的代码改动方案 —— 不要再使用

旧方案是注释掉 `springBlade/blade-auth/src/main/java/org/springblade/auth/granter/CaptchaTokenGranter.java` 里的验证码判断块，再用 `scripts/restart_blade_auth.ps1` 重编译 + 重启 blade-auth。该方案已被 4.1 的系统参数方案取代，**不要再使用**。

## 5. 排错

- `LOGIN_FAIL` + 提示验证码错误：说明验证码仍开启，回到第 4 步关闭并重启 blade-auth。
- `ENDPOINT_FETCH_ERROR` / 连接失败：确认前端 dev server(:8000) 与网关(:81)在跑，且 endpoint 路径正确（去掉 `/api` 前缀后是网关侧真实路径）。
- Playwright 报找不到浏览器/模块：按第 6 节的实测值设置 `PLAYWRIGHT_CHROMIUM_PATH` / `PLAYWRIGHT_MODULE_DIR`。

## 6. Playwright 环境变量（本机实测值，2026-10-07）

跑 `scripts/pw_login.cjs` 前设置两个环境变量（脚本内置的浏览器路径 `chromium_headless_shell-1208` 已过时，本机实际安装的是 **1243**）：

```powershell
$env:PLAYWRIGHT_MODULE_DIR    = "D:\project\springbladeandreact\ant-design-pro\node_modules"
$env:PLAYWRIGHT_CHROMIUM_PATH = "C:\Users\Administrator\AppData\Local\ms-playwright\chromium_headless_shell-1243\chrome-headless-shell-win64\chrome-headless-shell.exe"
node scripts/pw_login.cjs --account admin --password ant.design --tenant 000000
```

- **模块来源**：`playwright@1.63.0`（含 playwright-core）就在 ant-design-pro 前端 `node_modules` 里，无需另装。
- **浏览器**：`%LOCALAPPDATA%\ms-playwright` 下已装 `chromium-1243` 与 `chromium_headless_shell-1243`；未来升级导致版本号变化时，用下面命令重新探测 exe 路径并更新 `PLAYWRIGHT_CHROMIUM_PATH`：

```powershell
Get-ChildItem "$env:LOCALAPPDATA\ms-playwright" -Directory | Select-Object Name
Get-ChildItem "$env:LOCALAPPDATA\ms-playwright\chromium_headless_shell-*" -Recurse -Filter "chrome-headless-shell.exe"
```

- 已验证（2026-10-07）：`LOGIN_OK` + `--endpoint blade-system/user/info` 返回 200。
