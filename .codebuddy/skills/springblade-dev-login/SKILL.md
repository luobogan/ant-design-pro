---
name: springblade-dev-login
description: SpringBlade 微服务开发环境的登录与接口联调工具。当用户需要在本地 dev 环境登录 SpringBlade（ant-design-pro 前端）获取有效的 sword-token，或调用需要鉴权的后端接口（如 /blade-workflow/...、/blade-desk/... 等网关背后的服务）进行测试/调试时使用；用真实前端请求头访问网关，避免手搓签名/头。登录验证码已通过系统参数 `captcha_mode` 关闭，无需处理。触发词：登录、拿 token、sword-token、调试后端接口、调接口、联调、captcha、验证码、网关鉴权。
---

# SpringBlade 开发环境登录与接口联调

## 何时用

- 需要在本地 dev 环境拿到一个**真实有效**的 `sword-token`（自动走前端 SM2 加密、登录流程），而不是手搓 JWT。
- 需要调用网关背后需要鉴权的后端接口做测试（对账、回填、列表查询等），但手动 curl 被网关拒（缺签名/头）。

## 前置（详见 references/setup.md）

- ant-design-pro dev server 在 `:8000`，代理 `/api` → 网关 `:81`。
- blade-auth 在 `:8100`。**登录验证码已通过系统参数关闭**（`blade_param` 中 `captcha_mode:000000=false`，租户级开关），自动登录无需处理验证码，**不再需要改代码 / 重编译 / 重启 blade-auth**。原理与如何查看/恢复见 setup.md 第 4 节。
- **Playwright 环境已就绪（2026-10-07 实测 LOGIN_OK + 接口 200）**，跑 `pw_login.cjs` 前设置两个环境变量（脚本内置的浏览器路径 1208 已过时，本机实际为 1243）：
  - `PLAYWRIGHT_MODULE_DIR = D:\project\springbladeandreact\ant-design-pro\node_modules`（playwright@1.63.0 含 playwright-core，就在前端依赖里，无需另装）
  - `PLAYWRIGHT_CHROMIUM_PATH = C:\Users\Administrator\AppData\Local\ms-playwright\chromium_headless_shell-1243\chrome-headless-shell-win64\chrome-headless-shell.exe`
  - 详细说明与浏览器升级后的探测命令见 setup.md 第 6 节。

## 核心用法：scripts/pw_login.cjs

用真实前端登录拿 token + 捕获真实请求头，可选直接调接口。

```bash
# 仅登录，输出 TOKEN= 与 HEADERS_JSON=（供后续手动 curl 用）
node scripts/pw_login.cjs --account admin --password ant.design --tenant 000000

# 登录并直接调用某接口（路径为网关侧真实路径，不含 /api 前缀）
node scripts/pw_login.cjs --endpoint blade-workflow/migration/reconcile
node scripts/pw_login.cjs --endpoint blade-workflow/migration/backfill --method GET

# 自定义前端 base
node scripts/pw_login.cjs --base http://localhost:8000 --endpoint blade-desk/xxx
```

输出约定：登录成功打印 `LOGIN_OK` / `TOKEN=...` / `HEADERS_JSON={...}`；若带 `--endpoint` 再打印 `ENDPOINT_STATUS=` / `ENDPOINT_BODY=`。失败打印 `LOGIN_FAIL` + 错误提示。

脚本会自动从页面登录后发出的真实 API 请求里捕获 `blade-auth` / `Authorization` / `Tenant-Id` 三头（网关鉴权所需），无需手算签名。

## 可选（已废弃）：scripts/restart_blade_auth.ps1

> **已废弃**：本脚本原本通过注释 `CaptchaTokenGranter` 验证码判断 + 重编译 + 重启 blade-auth 来临时关闭验证码。**现在验证码由系统参数 `captcha_mode` 控制，默认已关闭，本脚本不再需要**，请勿再用来"关验证码"（会徒改源码、制造需要回滚的脏改动）。保留仅作历史参考 / 其它 blade-auth 热重启用途。

## 关键事实（避免踩坑）

- 网关在本环境**只**校验 `blade-auth: bearer <token>` + `Authorization: Basic c3dvcmQ6c3dvcmRfc2VjcmV0`（`sword:sword_secret`）+ `Tenant-Id: 000000`，**不**额外校验 `sword` 签名。
- 前端代理把 `/api/xxx` 转发为网关的 `/xxx`；`--endpoint` 参数填网关侧真实路径（不含 `/api`）。
- 完整环境地图、端口、凭据、排错见 `references/setup.md`。
