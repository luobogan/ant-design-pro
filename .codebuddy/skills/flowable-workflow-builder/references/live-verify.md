# 在真实 springblade 服务上验证工作流（导入 / 幂等回归）

本 skill 默认只产出 BPMN 文件并做本地结构校验。若要在**运行中的 springblade**
验证"生成的 BPMN 能成功导入且重复导入幂等"，用本目录 `scripts/` 下的两个脚本：

- `scripts/sm2_auth.py` — 纯标准库实现的国密 SM2/SM3 + 向 `/blade-auth/token` 换 token。
- `scripts/import_workflow.py` — 把本地 `.bpmn20.xml` 导入 `/blade-workflow/definition/import`，
  并可连续导入 N 次做幂等回归。

## 1. 鉴权（最容易踩坑的一步）

登录端点：`POST {gateway}/blade-auth/token`，`application/x-www-form-urlencoded`。

请求头：

- `Tenant-Id: 000000`
- `Authorization: Basic base64(client_id:client_secret)` —— 默认 `sword:sword_secret`

请求体（form 字段）：

```
grantType=password&tenantId=000000&account=admin&password=<SM2密文>&scope=all&userType=web
```

### SM2 关键坑（务必记牢）

- **加密模式必须是 `C1C2C3`（C3 在密文末尾）**，不是 `C1C3C2`。
  blade-core 的 `SM2Util` 用的是 BouncyCastle `new SM2Engine()`，其**默认模式就是 C1C2C3**。
  用 C1C3C2 加密时服务端 C3 校验不过，登录会笼统报"用户名或密码错误"，极难排查。
- 明文编码：服务端 `input.getBytes()`（平台默认，ASCII/UTF-8 一致），密码用其字节即可。
- 公钥来源：配置 `blade.auth.public-key`（Nacos/yml），dev 默认公钥已内置在 `sm2_auth.py`；
  若环境不同，用 `--pub` 或环境变量 `BLADE_SM2_PUB` 覆盖。
- `TokenUtil.decryptPassword` 解完密还会做一次 `sign(private)->verify(public)` 自校验，
  所以密文必须真能被这对密钥解密，不能随便塞数据。

默认 dev 账号：`admin` / `ant.design`（已核对 `blade_user` 表：其存储哈希正是 `sha1(md5("ant.design"))`）。

## 2. 导入接口

端点：`POST {gateway}/blade-workflow/definition/import`，`application/json`。

请求头：`Blade-Auth: bearer <token>`、`Tenant-Id: 000000`。

请求体（对应 `DefinitionImportDTO`，只有两个有效字段）：

```json
{ "name": "流程名称(可空, 缺省回退为 BPMN process id)",
  "bpmnXml": "<BPMN 2.0 XML 原文或 base64>" }
```

- `bpmnXml` 原文或 base64 服务端都接受；脚本直接传原文。
- `name` 为空时服务端回退使用 BPMN 的 `process` id。

成功响应：`{"code":200,"success":true,"data":<新增的 defId>}`.

## 3. 导入幂等回归（验证修复是否生效）

后端 `importNewDefinition` 在 insert 前会先
`selectAllByProcKeyVersion(procKey, 1)` **物理删除**同 `procKey + version=1` 的旧行
（含被逻辑删除的"幽灵行"），再插入新行。因此：

- **修复后**：对同一个 `processKey` 连续导入多次，每次都 `200`，且每次返回一个新的 `defId`
  （旧行被清理，不撞唯一键）。
- **修复前**：第 2 次导入必 `500`（唯一键冲突，因为旧行/幽灵行仍在）。

### 一键回归

```bash
cd scripts
python import_workflow.py ../../your-flow.bpmn20.xml --repeats 3
```

脚本会先 `selftest()`（SM3 标准向量 + 曲线 + 加解密回路），再 SM2 登录，再连续导入 N 次并打印每次的
`code/msg/defId`。全部 `200` 即通过。

## 4. 前端 UI 导入入口（/system/workflow 列表页）

除了脚本，前端 `ant-design-pro` 也在流程设计列表页提供了"导入"按钮，直接打同一个后端接口：

- 入口：`src/pages/System/Workflow/Workflow.tsx` 工具栏「导入」按钮（`UploadOutlined`）→
  「导入流程 (BPMN)」弹窗（填流程名称[可空] + 选 `.xml/.bpmn/.bpmn20.xml` 文件）。
- 服务方法：`src/services/workflow/index.ts` 的 `importDefinition({ name, bpmnXml })`。
- 注意点（与脚本的差异）：
  - 前端为规避 SpringBlade XSS 过滤器把 `<bpmn:*>` 标签整段删掉，**`bpmnXml` 统一走
    base64 编码**再发送（复用 `utf8ToBase64`，与 `saveBpmn` 一致）；后端 `importNewDefinition`
    会对"不含 `<` 的串"自动 base64 解码，所以两种写法都能通。
  - 该按钮**未做权限门禁**（与"刷新"同级，恒可见），方便随时导入。如需按角色收敛，
    可在 `hasPerm(...)` 里加按钮 code（如 `workflow_import`）。
- 行为：点击后后端新建**版本=1 的草稿流程**，并自动解析 `wf:` 扩展配置节点操作者 /
  操作菜单 / 字段权限 —— 与设计页画布的「打开文件/粘贴XML」不同，后者是 bpmn-js 前端画布
  导入（还需再点保存才落库）。

## 5. 仅验证 SM2 登录本身

```bash
cd scripts
python sm2_auth.py          # 跑 selftest + 用 admin/ant.design 登录，打印 token 前40位
```

## 6. 已知坑 / 排查清单（导入链路相关）

### 6.1 导入草稿 `activeVersionId` 落到库默认值 `-1`

`importNewDefinition` 里写的是 `def.setActiveVersionId(null)`，但 MyBatis-Plus 的插入策略
**会跳过 null 字段**，于是 `wf_process_definition.active_version_id` 列使用其默认值（库里定义为 `-1`）。
结果导入出来的草稿 `activeVersionId = -1`，而不是"未成组"应有的 null / 自身 id。

- **已修复（后端）**：insert 后自锚定 `def.setActiveVersionId(defId); defMapper.updateById(def);`，
  让 version=1 的草稿锚点=自身，与"新增/保存"创建的草稿一致。
- **未修前的影响**：前端版本组过滤把 `activeVersionId = -1` 当成"有效锚点"，`"-1" === id` 恒 false，
  导入的草稿会被整行过滤掉，列表看不到（见 6.3）。
- **补救存量数据**：对已有 `activeVersionId = -1` 的单版本草稿，令其 `activeVersionId = id` 即可
  （发布/另存为新版本时 `setGroupAnchor` 也会自动纠正为自身锚点）。

### 6.2 `/definition/list` 非 admin 仅返回 `status=1`（已发布）

`WfDefinitionServiceImpl.listByForm` 有记录级收口：

```java
boolean admin = WfAuthUtil.isAdmin();
query.eq(!admin, WfProcessDefinition::getStatus, DEF_STATUS_PUBLISHED); // DEF_STATUS_PUBLISHED = 1
```

- 状态语义（代码实锤，`deploy()` 置 1、`testDeploy()` 置 3）：`0=草稿`、`1=已发布`、`3=测试`。
- **非流程管理员（普通员工，发起页场景）只看到 `status=1` 的已发布流程**；草稿(0)/测试(3) 不返回。
- 若某环境"发布/测试数据在列表里看不到"，先确认登录账号是不是 admin：
  admin 能看到全部（含 0/3），非 admin 只能看到正式发布的（1）。这是设计行为，不是 bug。
- 顺带提醒：本 skill 的 `import_workflow.py` 用 `admin` 登录，拉列表时拿的是全量（含草稿/测试），
  与"发起页"视角不同，排查时别混淆。

### 6.3 前端版本组过滤的「精度坑」（曾因误改导致发布/测试行消失）

`Workflow.tsx` 的 `defs` 过滤"每个流程仅显示当前激活版本"：

```js
const anchor = d.activeVersionId != null ? d.activeVersionId : d.id;
if (String(anchor) === String(d.id)) { map.set(String(anchor), d); }
```

⚠️ **绝不要对 `activeVersionId` 做 `Number()` 转换**。雪花 ID 是 19 位，当 JSON 把它序列化为
**字符串**时，`Number("2100918142244032513")` 会丢失尾数精度，而 `d.id` 仍是原字符串，
导致 `String(anchor) === String(d.id)` 不相等 → **所有大 ID 的已激活发布/测试行被整行丢弃**。
导入草稿因 `activeVersionId = -1`（走 `anchor = d.id` 原字符串分支）反而能显示，于是出现
"导入草稿在、发布/测试没了"的诡异现象。

正确写法（已落地）：不转 Number，仅把 `null`/`-1`/`"-1"` 视为"单版本流程、锚点=自身"：

```js
const av = d.activeVersionId;
const isSelfAnchor = av == null || av === -1 || av === '-1';
const anchor = isSelfAnchor ? d.id : av;
if (String(anchor) === String(d.id)) { map.set(String(anchor), d); }
```

排查"列表缺数据"时按此顺序：
1. 先确认登录角色（6.2 的 admin/非 admin 数据范围差异）。
2. 再确认是否 `activeVersionId = -1` 的导入草稿被过滤（6.1 + 6.3 的 `-1` 自锚定）。
3. 最后确认没有对大 ID 做 `Number()` 之类的精度破坏（6.3）。

