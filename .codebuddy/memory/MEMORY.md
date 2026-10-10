# 长期记忆（SpringBlade 工作区 d:\workproject\springbladeandreact）

## 用户偏好
- **方案取舍：要「功能完善 + 合理」，不要「最小风险/最小改动」。** 按完整度排序，不以"改动最小"为推荐理由。（2026-09-21 纠正）
- 分析类产出：结合泛微前端（`D:\Weaver2020\ecology`）+ 源码（`d:\project\ecology\src`），结论带 `文件:行号`，落到 `springBlade/doc/md/`。

## 环境 / 构建 / 数据库
- 双 Maven 仓库：IDEA=`E:\project\mavenLib`，CLI=`~/.m2`。**改 api 模块**：① `mvn --% -pl blade-service-api/<api> install -DskipTests`；② 复制新 jar 到 `E:\project\mavenLib`（先 Rename 再 Copy，被占用静默跳过）。禁 `-Dmaven.repo.local=E:/`；「找不到符号」加 `-Dmaven.compiler.proc=full`。
- ❗PowerShell 吞 `-D` → `mvn` 后加 `--%`；只改 api 不 install → 服务模块「找不到符号」。
- ❗外部改 `.java` 用**小写 `springBlade`** 路径（大写 `SpringBlade` 路径 replace_in_file 可能「报成功不落盘」）→ 用 PowerShell `[IO.File]::WriteAllText($p,$t,(New-Object System.Text.UTF8Encoding($false)))` 直写后 `Select-String` 复核。
- MySQL：`D:\project\mysql-8.0.23-winx64\bin\mysql.exe -uroot -p123456`（`blade`=system/menu；`blade_workflow`=wf_*）。执行 SQL：`Get-Content x.sql | & '...\mysql.exe' -uroot -p123456 -t`。
- Nacos 生效配置：`d:\project\nacos\data\tenant-config-data\public\DEFAULT_GROUP\*.yaml`（≠ 仓库 `springBlade/doc/nacos/blade.yaml`）；LF 换行，改写用 `WriteAllText`+`UTF8Encoding($false)`。

## 后端规范与坑
- API/Service 分离；跨库/跨服务只能 Feign（`BladeFeignRequestHeaderInterceptor` 转 Blade-Auth）；响应 `R<T>`。
- ❗**雪花 ID 精度**：主键 ASSIGN_ID 19 位 Long 超 JS 安全整数（2^53）→ 实体/VO 的 id 须 `@JsonSerialize(ToStringSerializer)`；前端 19 位 ID 不要 `Number()`，透传字符串。`POST /instance/start` 返 `R<String>`。
- MP `.eq(col,null)` 不跳过→`.eq(val!=null,col,val)`；`@TableLogic` 只逻辑删。
- `@RequestBody` 根类型不可 Map/List（400），用 DTO 包一层。
- XSS 过滤器取 `getServletPath()`，只匹配服务内路径（`/form-data/**`、`/instance/**`）；`/api/<svc>` 前缀无效；富文本必须 skip。已加 `/api/blade-workflow/**`、`/blade-workflow/**`。
- DataScope NPE：无 `blade_scope_model` 时 feign 返 null→NPE；workflow `application.yml` 已加 `blade.data-scope.mapper-exclude`。
- ❗本服务类与框架类**简名相同**→`ConflictingBeanDefinitionException`：显式 `@Service("xxxService")` 别动 blade-tool。
- 循环依赖：服务间互相注入用 `@Lazy` 破环（如 WfInstanceServiceImpl↔WfSubflowServiceImpl）。
- ❗**实体继承链的公共列必须与表列一致**：实体 `extends TenantEntity`（→ BaseEntity）时，MP 的基础 SQL 会带上 `create_user/create_dept/create_time/update_user/update_time/status/is_deleted/tenant_id`，表缺任一列就报 `Unknown column 'xxx' in 'field list'`（与 Mapper 无关，是纯 schema 问题，**不用重启服务**）。本库历史上有 8 张表如此，已由迁移 `V2026.09.21_013`（wf_ 系 6 张）与 `_014`（blade 系 2 张）补齐。
- ❗旧版 Blade 表用 `create_user varchar(64) DEFAULT ''` 而实体是 `Long`：空串映射 Long 会抛类型转换异常。补列以外的这类表要把 `''/非数字` 先 `SET NULL` 再 `MODIFY ... BIGINT`（严格模式下不先置 NULL 直接改类型会报 Data truncated）。
- 新增/改表后的**自检法**（防同类问题再犯）：收集所有 `extends (TenantEntity|BaseEntity)` 实体的 `@TableName` → 对 information_schema 查那 8 列有无缺失（脚本见 `.codebuddy/memory/2026-09-21.md`）。全新加实体时，先按 Blade 惯例把 8 列建全。

## 鉴权模型（401 排查）
- `@PreAuth` → `AuthAspect` 失败→`SecureException`→**HTTP 401** `{"code":401,...,"msg":"请求未授权"}`。网关 401=`{"msg":"缺失令牌,鉴权失败"}`。
- `AuthFun.hasRole(r)` 读 token `role_name`；改完角色必须重新登录。
- `@PreAuth` 方法级覆盖类级。自定义越权用 `ServiceException` 继承覆写 `getMessage()` → 403 `R.fail(code,msg)`。
- 流程中心鉴权分层：接口层放开用 `HAS_AUTH`（登录即可）；记录级 `WfAuthUtil`+`WfInstanceServiceImpl#canView`。放开要成套（Feign 下游 formmode 同口径放开，否则表单空白）。

## 前端路由（100% 菜单驱动，勿改 routes.ts）
- 菜单页 `./pages/{Module}/{Page}/{Page}.tsx`；末段 PascalCase。`toPascalCase` 对 commonWords 首字母大写（含 Form/Mode/Design，不含 Request）。
- `blade_menu`：`category=1` 进路由树；`category=2`+`is_component=1`+非空 path = 按钮型组件页，挂 '/' 下带外壳。`is_open=2`=无壳独立页（`layout:false`，顶层挂）。
- 动态 `import()` 须先拼单字符串变量；改后重启 8000。«流程建模» code=`mode`；«表单管理» id=2059568062799073282。

## 前端规范与坑
- ❗**JSX 属性区不能放 `{/* 注释 */}`**（只能在 children 位置）。写进属性区（如 `<Alert a={1} {/*c*/} b={2}/>`）→ 构建报 `Could not parse module ... Expected '</', got '}'`、页面 ErrorBoundary 白屏。注释要放在元素上方（children 区）或行内 `//`。
- ❗**IDE 诊断可能漏报 JSX 语法错**（read_lints 报 0 条但代码根本不能解析）。要确认语法，用临时 tsconfig + tsc 只筛 `TS1xxx`（`noResolve:true` 会刷一堆 `TS2307` 属预期；注意新版 TS 已移除 `moduleResolution:node10`，且**指定文件时会因 tsconfig 存在而报 TS5112**，必须用 `-p <临时tsconfig>`）。
- ❗**响应取数一律用 `pickPayload(res)`（`src/utils/utils.ts`），禁止直接 `res.data`**（`src/requestErrorConfig.ts:571` 明示：`request()` 返回可能是「载荷本身 / {data:载荷} / {data:{data:载荷}}」三种形态之一）。直接 `res.data` 在「载荷本身」形态下得到 undefined → 拿不到返回 ID，极易引发「重复创建」类 bug（如发起页多次保存草稿生成多条实例）。`pickPayload` 最多剥 2 层 `.data`，兼容三种形态；数组/字符串不剥。

## 流程设计器 (WorkflowDesign)
- 三页签 图形/节点信息/出口；`nodeKey`==BPMN 元素 id（剥 `_label`）。引擎 Flowable；camunda:* 只存不生效，生效走 `wf_process_node.extJson`。
- `nodeTypeOf()`：网关→7；Catch/Throw/Boundary/Receive→5；Service/CallActivity/Send/Script/BusinessRule→6；其余 Task→1。
- 节点设置口径：`WorkflowDesign/nodeSettings.ts` 的 `SETTING_DEFS`，统一存 `wf_process_node.ext_json.settings`；`NodeSettingModal` 受控表单 + `buildExtJson` 即改即存（`s[def.key]=values` 嵌套）。

## 流程真引擎测试 (/formmode/test)
- `WfTestServiceImpl`：deployForTest→真实发起 `is_test=1`→autoApprove→历史活动采集→cleanup。出口覆盖率=历史活动相邻对↔物理出口。
- ❗`ACT_HI_ACTINST` 含 seqFlow 同毫秒顺序不稳→跳过 seqFlow + 按 `(startTime,ID_)` 二级排序。
- 流程图 overlays：`position` 每轴只一个值；activity 用 `h/2+10`、事件 `h+22`、网关 `h+2`；审批节点 label 不在 elementRegistry。

## 工作流实例发起约束
- `data_id BIGINT NOT NULL` 无默认值 + `uk_biz_key` 唯一 ⇒ **发起必须带 dataId**（表单直发 `WfInstanceServiceImpl.start()` 用 `IdWorker.getId()` 造占位）。
- 业务数据表：`workflow_bill.table_name`（blade 库 → `formtable_main_1/2/3/5`，带 `_dtN` 明细）；列名 == `workflow_billfield.fieldname`。
- 方案B：`POST /form-data/save-by-form`（Feign 不带 `/api/blade-formmode` 前缀）按 `workflow_bill` 取表名/列名写入；`createBusinessData()` dataId 空时调它，失败回退占位。
- ❗**草稿合成任务判定坑**：`wf_task.engine_task_id` 在库里实际存的是**空字符串 `''`（不是 NULL）**。`saveDraft` 给草稿实例合成待办时不能用 `isNull(engineTaskId)` 去重（永远 count=0 → 每次保存都插一条 → 同一草稿待办无限叠加，待办页按行展示就显示多次）。正确做法：草稿实例(`status=5`、未发起、不可能有引擎任务)每次保存**直接删该实例全部待办再插一条**（幂等）。SQL 涉及该列须兼容 `''` 与 NULL。

## 退回规则：退回目标必须是「引擎能停留的节点」
- ❗**创建节点(node_type=0) 在 BPMN 里是 `startEvent`，不是等待态** —— 直接 `moveActivity` 过去停不住，引擎会立刻沿出口流回第一个审批节点，表现为「退回了但节点没变」（实证：`ACT_HI_ACTINST` 里 startEvent → sequenceFlow → 同一 userTask）。网关(7)/归档(3)/等待(5)/自动处理(6) 同理；**退到网关还会按条件重新选分支**（可能走回原节点或跳到别的分支）。
- 口径：`WfRejectManager.computeRejectableNodes` 只返回 `node_type ∉ {3,5,6,7}` 的候选（**黑名单**，未知/未配类型保持既有行为），仍按「由近及远」；**创建节点(0) 保留为候选**，由 `WfTaskServiceImpl.reject` 分流。
- 退回创建节点 = **退回发起人**（`WfTaskServiceImpl#rejectToStarter`）：引擎 token 移到创建节点→顺出口自然停在**第一个审批节点**（保证引擎有活动任务，不被 `advance` 判成「流程结束」误归档）；语义层删本实例 TODO（保留已办）+ 当前节点记为创建节点 + 给发起人建**合成待办**（`engine_task_id` 留空，同草稿机制）。⚠️ 该路径**不能调 `advance`**（会把当前节点改写成引擎落点 = 等于没退回）。
- 发起人重新提交走 `doApprove` 的 `isCreatorResubmitTask` 分支（node_type=0 且 engine_task_id 空）→ `resubmitByCreator`：token 移回创建节点重新入流，第一个审批节点重新拿待办。⚠️ **不能走 `completeTask`**（引擎正停在第一个审批节点上，complete 会跳过它）。
- 限制：`moveActivity` 只移**本分支** token，并行分支下其他分支回不去（仅 `log.warn`，不作废属业务决策）。

## 界面状态一致性规则（页面过期识别，2026-09-21 落地）
- 规则：**界面状态 ≠ 实例状态时拦截写操作**。覆盖场景——草稿已删（防「删了又复活」）、流程回退/被他人流转导致当前节点改变而界面未刷新（「流程已不在当前节点但界面仍显示原节点」）、实例已归档/不通过/撤回。
- ❗判定口径（**并行分支安全**）：**禁止**只用 `wf_instance.current_node_key == 界面节点` 判定过期——并行网关分叉后 `current_node_key` 只记其中一条分支的节点，会误杀另一条分支上的合法办理。正确：`界面节点==currentNodeKey` **或** 该节点仍有 `wf_task.status=0` → 活动节点；否则过期。
- 单一权威出口：`IWfInstanceService#fresh(instId, nodeKey, taskId)` → `InstanceFreshVO{stale, staleReason, nodeActive, currentNodeKey/Name}` → `GET /instance/{id}/fresh`（返回的 `staleReason` 已成人话，前端直接展示）。鉴权沿用 `requireVisible`（实例已删抛「流程实例不存在」，前端据此判失效）。VO 在 **service 模块** vo 包（不是 api 模块）。
- 后端消费点：`WfFormRenderServiceImpl#save` 写业务行前调 `fresh`（原来保存路径无任何节点新鲜度校验，是最大缺口）；`WfTaskServiceImpl#requireTodoTask` 用 `staleTaskReason()` 把「任务非待办状态」换成带当前节点/归档状态的可行动提示（`doApprove`/`reject`/`forward`/`addSign` 共用入口，天然全覆盖）。统一措辞以 `本页已过期` 开头，供前端识别并同步降级页面。
- 前端消费点：`ApprovalPage.tsx` = `stale` 态 + `checkFresh()` + `guardFresh()` 写操作统一门禁（提交/保存/退回/转办/加签/传阅/催办/自定义操作全过）+ 加载即复检 + 20s 轮询 + `focus`/`visibilitychange` 复检 → 顶部 Alert 横幅 + 停用操作按钮 + 表单强制只读；`Start.tsx` = `staleReason`（实例 `status≠5` 即过期）+ `recheckDraft()`/`guardDraft()` 动作前复检 + `notifyDraftFail()`。服务：`freshInstance()`（`skipErrorHandler:true`，调用方兜底）。
- 未覆盖：待办/已办列表行本身过期（列表有手动刷新）、测试页 `Test/FlowFormPanel.tsx`。

## 表单渲染与人员组织
- 三处统一 `ApprovalFormRender`（含 `ExcelPreview` 渲染 `form_layout.layoutJson`）：`Start.tsx`/`ApprovalPage.tsx`/`Test/FlowFormPanel.tsx`。
- ❗`ExcelPreview` 值 key=单元格坐标 `{sheetId}__{row}__{col}`；引擎出口 UEL 用字段名 → `collectFieldValues.ts` 桥接，提交两种键一起下发。
- `allowMenus`=`settings.operateMenu.menus`（null=不限制、`[]`=全禁用）；`opinionRequired`=`settings.signOpinion.required`。
- ❗**流程信息（时间线）意见显示的两条过滤口径**：① `WfInstanceServiceImpl#logs` 只隐藏「流程停在开始节点 **且** 是最新一条」的开始节点日志（＝本轮未提交的填表动作）——**不可**一刀切隐藏开始节点全部日志，否则「退回发起人」后流程又停在开始节点，会把历史各轮提交意见全藏掉；② `opinionDisplay.viewTypeAll` **未配置=显示全部**（默认已从 0 改为 1；仅显式配 0 才「仅显示最后一次」），前端「仅最后一次」按**最后一条有内容的意见**判定（不是 idx===0，否则最新一条没填意见时整条时间线无意见）。
- `PersonOrgPicker`：值=id 逗号串；类型 1/161/167/168 人员、2/17/19/20 部门、3/163 角色、4 岗位。
- `RichTextEditor`(TinyMCE 8)：`isRichTextEmpty`(`<p><br></p>`)、`wf_approval_log.opinion` 已扩 TEXT。

## 子流程高级设置（2026-09-21 落地，项 3）
- 表 `wf_subflow_request`（迁移 `V2026.09.21_005`，幂等）。实体 `WfSubflowRequest`（api）、`WfSubflowRequestMapper`、`IWfSubflowService`/`WfSubflowServiceImpl`。
- 读取入口 `WfNodeSettingsUtil.subflow*`（bool 型开关：allEndBeforeSubmit/dataSummary/autoForward/remindEnabled/remindBeforeOperator；remindTypes 用 list 读数组）。
- 触发：`NodeActionExecutor.triggerSubflow` 守卫——`allEndBeforeSubmit=1` 时**强制 afterSubmit**（避免 afterArchive 因主流程永不合档而失效/死锁）。
- 四行为：`record()`（触发时登记关系，快照开关）→ `holdForSubflow()`（主实例归档前阻塞）→ `onSubflowArchived()`（子归档回写，全归档后 汇总/提醒/自动流转 main）→ `WfTaskServiceImpl.doApprove` 提交门禁（本节点有未归档子流程则拒提交）。
- 前端 `nodeSettings.ts` 的 `subflow` SETTING_DEFS 扩 4 组开关 + `checkboxGroup`(remindTypes)；`NodeSettingModal` 已支持 `checkboxGroup` 控件。

## 调试与工具
- ❗IDEA 还原外部工具已打开文件的写入：改完回读；`mvn BUILD SUCCESS`≠源码生效（治本 Ctrl+F4 关标签）。
- 不要由我重启 8000；用户 `npm run dev`。Playwright 访问 `http://192.168.1.5:8000`（127 不同 origin→401）。
- Univer/ExcelDesign：字段占两格，HMR 不稳，改完停 server 重启+硬刷新；Node>=22.18（勿 25）。
- `node_modules` 被 .gitignore 屏蔽：搜不到，改用 `read_file` 绝对路径或 PowerShell `Select-String`。

## 迁移脚本（doc/sql/migration，幂等）
- 规范：`information_schema` 存在性守卫 + `PREPARE` 动态 SQL + 尾部校验；新建表 `CREATE TABLE IF NOT EXISTS`；种子 `INSERT...WHERE NOT EXISTS`；`tenant_id` 固定 `000000`，新 id 用 `UUID_SHORT()`。
- 001~008 历史；005=wf_subflow_request（项 3）。执行：`mysql ... -t -e "source d:/.../xxx.sql" blade`。

## 文档索引（springBlade/doc/md/）
- `测试流程与正式流程一致性规范.md`：4 级校验（L1 发布门禁/L2 部署隔离/L3 运行时自检/L4 巡检 SQL）。
- `流程测试与生产上线隔离方案.md`（v1.1，2026-09-21）：**测试/上线隔离的唯一权威文档**。在《一致性规范》之上把「同源」从应用层推到**引擎定义层**。核心结论——推荐「①定义版本隔离 + ②测试域隔离 + ③灰度切流（含⑤影子比对）」三层叠加，**不推荐蓝绿**（单库单引擎，且与"同源"要求冲突）。引擎侧关键是 `startProcessInstanceByKey`（`ProcessServiceImpl.java:43`）升级为**按 `processDefinitionId` 启动**。❗❗**最关键口径（易被写反，务必先读 §6.4 之（0））**：**隔离按「入口」区分，不按「用户身份」**——`canVisible` **不得**按 `is_test` 收口；同一用户在生产入口（`/task/todo|count`、`/instance/mine`、`/formmode/approval/*`）看不到测试单，但在测试入口（`/test/**`、`?mode=test`）**要能看到并自己办理**（"测试那边用相应用户审批"）。把测试实例对参与人整体封死 = 测试无法用相应用户办理。❗已确认事故口：A1 生产查询未过滤 `is_test`；A5 测试面板退回/加签/转办/催办直打生产接口（`FlowFormPanel.tsx:325-358`）；A6 打开测试面板即写生产 `task/{id}/view`（`FlowFormPanel.tsx:220-224`）；**A8** 超时扫描命中测试任务（`WfTimeoutJob.java:46-51`）；**A9 = 原「V10 标记断层」**（`addSign`/`forward`/`circulate` 新建 `wf_task` **没设 `is_test`** → 是 0，将来加过滤也漏，必须先补标记）；**V11**（本次新发现）`/test/**` 无 `is_test=1` 断言 → `step` 传正式 `instId` 会落 `advance()` **推进正式实例**（`WfTestServiceImpl.java:947-976`）。含 **§6 测试数据可见性隔离**（V1–V11 / C1–C15 / S1–S16 / V-1–V-12 / 巡检⑫–⑯）与统一入口设计：`/workflow/create/start?defId=&mode=prod|test|preview`。
- ❗**代跑（`/test/step`）留痕归属（实测确认）**："谁办的"**只有两处**落地——`wf_task.assignee` 与 `wf_approval_log.operator`，写的都是**节点接收人**（会签逐人各一条）；`wf_task` **无 operate_user 列**，`create_user`/`update_user` **全 NULL**（Blade 自动填充未生效），Flowable 的 `ASSIGNEE_`/`COMPLETED_BY_` **全 NULL** → 管理员代跑零痕迹（仅 `wf_test_log` 有执行人但不记逐步）。⇒ 代跑会在真人名下留"一条已办"，**已办是最易漏的外泄口**（`done()` 状态集合 2/3/4/7/8/9，`WfTaskServiceImpl.java:109-113`，须整组排除）→ 文档 C14/C15、S16、V-12、巡检⑯。
- ❗**测试态"不写业务表"是误解**（**已于 2026-09-21 修复，C17 已落地**）：曾经只在 `needBind` 处**不回填 `request_id`**（`WfInstanceServiceImpl.java:355-357`），但 `start()` 当 `dataId==null` 时**照常 `createBusinessData()` 建真实业务行**，`/form/save` 也会写，而 `cleanupTestData` **从不删业务行** → 留下永久无主脏行（V13/C17）。**现状**：① `start()` 测试态直接用占位 dataId；② `/form/save` 测试态只落快照；③ `cleanupTestData` 按 `form_id+data_id` 调 `formmodeClient.deleteBusinessData`（安全条件 `request_id_bound != 1`）。历史脏行已由迁移 `V2026.09.21_016` 清理。
- ✅**测试隔离清单已全部收口（2026-09-22）**：文档 §8 的 P0–P3 全部有结论。新增落地 —— **C9/C10**（`cleanupTestData` 补 `wf_test_log` + 孤儿 `__test` 部署清理，新增 `IProcessService#deploymentIdsByKeyLike`）、**C15**（代跑意见统一加「[测试] 」前缀；「测试历史」由「终态才落一条」改为**每次提交刷新同一条** upsert 并写入执行人）、**灰度路由**（`WfInstanceServiceImpl#resolveGrayProcDefId`/`isGrayHit` 接入 `start`，命中写 `is_gray=1`；实体 `WfDefinitionGray` 在 **api 模块** → 改后须 `mvn -pl blade-service-api/blade-workflow-api install`）、**影子测试**（`POST /test/shadow` 双版本路径比对，收尾只清本次新增实例）、**巡检 8 项→18 项**（`doc/sql/check/consistency_check.sql`，已实测跑通）、**P3**（管理面审计日志 + 网关 `TestApiGuardFilter` 的 IP 段/限流，**默认关闭**）。复核确认已在位：C6（前端三层拦截）/C5/C3/按 `processDefinitionId` 启动/部署回写 `proc_def_id`/迁移 `_015`。**C12 真人办理面 + F8 已于同日续做落地**（与代跑**并存**，代跑口径不变）：`/test/my-todo`（按登录人过滤 assignee）+ `/test/approve`（断言 `is_test=1` + 本人是 assignee）+ `@PreAuth` **类级下沉到方法级**（管理面保留 `HAS_ROLE_WORKFLOW`、办理面 `state`/`todo`/`my-todo`/`approve` 放开为 `HAS_AUTH`）+ `/form/render` 增加 `testMode` 参数（**放开 C8 一档**：生产办理页不传仍拒、测试面板/真人模式传 true 可渲染）；前端 `ApprovalFormRender`/`FlowFormPanel` 透传 testMode、`Test.tsx#manualStep` 提交前查 `/test/my-todo` 决定走 approve 还是 step（**自动循环仍走代跑**）。❗**XSS 口径修正**：`xss.skip-url` 匹配的是**服务内路径**（`BladeRequestFilter` 用 `getServletPath()`，网关已剥掉 `/api/{service}`）——**不是** `/api/blade-workflow/**`；已补 `doc/nacos/blade.yaml` 的 `/form/**`、`/definition/**`、`/custom-operation/**`、`/subflow/**`（原缺失会让**表单富文本与 BPMN XML 被 `XssHtmlFilter` 清洗**）→ ⚠️ 需发布 Nacos + 重启服务才生效。⚠️ **网关模块存在既有编译错误**（`AuthFilter`/`GatewayFilter`/`InnerFilter`/`JwtUtil`「找不到符号」= 依赖 jar 未同步；且该模块 lombok 注解处理未生效，`@Slf4j` 的 `log` 解析不了）→ 故新写的 `TestApiGuardFilter` 用显式 `LoggerFactory`。
- ❗**别把测试态的 `markTaskViewed` 当 bug（C7 已复核取消）**：测试面板打开时写的 `view_time` 是**测试任务自己那一行**（`is_test=1`），不污染生产任务；「已查看」分组是测试面板刻意需要的展示。改它反而会破坏流程图的「已查看 / 未操作」区分。
- ✅**已落地的测试隔离守卫（2026-09-21，后端 BUILD SUCCESS）**：**C16** `WfTaskServiceImpl` 新增 `isTestInst/isTestTask/assertNotTestTask`，转办·加签·抄送·催办后端拒绝 `is_test=1`，`reject` 保留但跳过附加操作且留痕用 `task.getAssignee()`；**C17** 见上；**C18** `WfCustomOperationServiceImpl#execute` 补 `canView` + `is_test=1` 拒绝；**C19** `WfInstanceServiceImpl` 新增 `assertNotTestInst`，`terminate/stop/resume/cancel` 拒绝测试态，且 **`resume` 与 `cancel` 补记录级鉴权**（二者原本分别"只有角色门"与"完全无鉴权"，可对任意实例调用）。
- ✅**第二批也已落地（2026-09-21，BUILD SUCCESS）**：**C11** `WfTestServiceImpl` 新增 `requireTestInst`，`step`/`state`/`todo` 断言 `is_test=1`（堵住传正式 instId 落 `advance()` 推进生产实例）；**C2** `forward`/`circulate`/`addSign` 新建任务补 `setIsTest`（防御性，因 C16 已拒绝测试态执行）；**C4** `WfTimeoutJob#scan` 加 `.eq(isTest, 0)`；**C1** `list`/`count(todo+done)`/`mine`/`getByBiz`/`countByForm` 加 `.eq(isTest, 0)`，`detail` 对 `is_test=1` **仅 `WfAuthUtil.isAdmin()` 放行**；**C8** `WfFormRenderServiceImpl` 新增 `assertNotTestForProdEntry`，`render`+`save` 仅管理员放行。
- ❗**两个已核实的实施前提**：`wf_task.is_test` 与 `wf_instance.is_test` 均为 **`tinyint NOT NULL DEFAULT 0`**（无 NULL），所以 `.eq(isTest, 0)` 不会误伤正式数据 —— 若换库/换表务必先确认这点，否则正式任务的超时与列表会静默失效。
- ⚠️**两条已知限制**：① C8 让 `render`/`save` 对测试实例**仅管理员放行** —— 将来做 C12 真人办理面时真人会被挡住，需按实例归属再放开（代码注释已标）；② C1 后测试实例**不再出现在「我的请求」**，管理员核查测试单要走 `/test/**`（S4 既定口径）。
- ✅**统一入口已落地（2026-09-21）**：选型是「**把发起页套进 `/formmode/test` 的「节点审批情况（预览）」**」（不是反过来）。做法：给 `src/pages/Workflow/Create/Start.tsx` 加 `StartFlowProps`（`defId`/`nodeKey`/`mode`/`testUserId`/`embedded`/`refreshKey`/`onSubmitted`），`mode` 缺省 `prod`；`Test.tsx` 预览分支改为 `<StartFlow embedded ...>`。未选发起人=`preview` 只读，已选=`test`（提交走 `/test/start`，不写业务表）。**自动走流程（`Test.tsx` 的 `startAuto` 循环 `/test/step`）完整保留**。也可单独用 `/workflow/create/start?defId=xxx&mode=test`。
- ❗**未采用原 F2/F3 的「抽 `FlowRuntimePanel` 组件」路径** —— 改为「发起页自身可内嵌复用」，同样消除预览/测试/正式三态分叉，但改动面小得多且不破坏现有发起页。若将来三态差异继续膨胀再考虑抽取。
- ⏳**仅剩未落地**：**C12 真人办理面** 与 **F8 真人模式**（本次选型为「代跑」，暂不需要）。
- ❗**前端改动必做真实语法校验**：IDE 诊断（read_lints）会漏报 JSX 语法错（曾导致白屏）。用临时 tsconfig + `npx tsc -p`（`noResolve:true`，只筛 `TS1xxx`；`TS2307` 是预期噪声）。本次改 Start.tsx/Test.tsx 后校验 `TS1xxx=0`。
- ❗**自定义操作是最危险的口**：`POST /custom-operation/execute`（`WfCustomOperationServiceImpl.java:158-206`）无 `is_test` 守卫、**连 `canView` 都没有**，且 `actionType=1` 时 `restTemplate.postForObject`（`:257-262`）**真发 HTTP 到外部系统**（URL/body 由 `$field$` 从业务数据替换）→ 测试单上点按钮会打到生产第三方（V12/C18）。
- ❗**前端禁用 ≠ 后端拒绝**：测试态的退回/转办/加签/传阅/催办只在前端禁用，后端零守卫；`reject` 的「节点后附加操作」也**没跳过**测试态（`WfTaskServiceImpl.java:381`，对比 `doApprove` `:309-313` 有）（V14/C16）。另 `/instance/{id}/resume` **无记录级鉴权**（`:849-859`），任意 workflow 角色可对任意正式实例调用（V15/C19，独立越权项）。
- **测试态查询泄漏面 = 所有"按 id 取单条"的接口**（不止待办/已办）：`/instance/{id}`、`/{id}/logs`、`/{id}/node-operators`、`/{id}/snapshot/{nodeKey}`、`/{id}/fresh`、`/by-biz`、`/form/render`、`/form/validate`、`/form/save`、`/monitor/count`，**全部只走 `canView`/`requireVisible`、不过滤 `is_test`**；`GET /form/render` 因此能让生产办理页渲染测试实例。另 `countByForm`（`:546-553`）被用作删除表单的绑定校验 → 测试实例会抬高计数、可能阻止删表单。
- **已排除的两类风险**（复查确认，无需投入）：本模块**无缓存**（`@Cacheable`/Redis 0 命中）→ 清理后无残留；**无附件/导出/打印落文件**接口（"打印"只是渲染包里的 `PrintSetVO` 配置）。
- **过滤写法的现成参考**：`WfDefinitionServiceImpl.java:1048-1051`（删除流程定义时用了 `is_test=0` 过滤）——本项目已有先例。
- `流程测试可见性隔离分析.md`：⚠️ **已并入上篇 §6（v1.1），不再单独维护**；该文件仅留「已并入」提示作历史存档，勿据其行号单独引用。
- `泛微流程操作菜单与退回机制分析.md`（八章）：退回反向 BFS 回溯、`nodelink.isreject` 封锁、`RequestRejectManager`→`DoRejectRequestCmd`→`flowNextNode(src="reject")`；发起人终止/撤回四权限。
- `泛微流程节点信息设置项分析.md`（14 章+附录）：节点信息页完整列集拆解；第十一章 = 按**完整度**排序的 10 项补齐建议（即本次施工清单来源）。
