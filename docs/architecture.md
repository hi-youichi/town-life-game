# 多人小镇游戏架构升级方案

> **状态**：Draft，待实施与技术验证；本文不代表功能已经实现。
> **版本与日期**：v1，2026-10-05。
> **已确定约束**：使用 Vite；使用 Cloudflare 部署；当前先完成方案，不改业务代码。
> **相关代码**：[场景入口](../src/main.js)、[交互](../src/interaction.js)、[部署配置](../wrangler.jsonc)、[构建脚本](../scripts/build.mjs)。
> **交叉参考**：[完整游戏策划](../game-design.md)、[项目说明](../README.md)、[现有场景验证](./visual-verification.md)。
> **性能补充**：[性能架构升级方案](./performance-architecture.md)，细化当前客户端渲染、模拟和导航的升级与验收。

## 文档定位与阅读顺序

本方案将已有 Three.js 场景演进为能够保存财产、处理生产住房和多人风险互动的小镇游戏。前端采用 Vite + TypeScript + Three.js，后端采用 Workers + 原生 Durable Objects，小镇权威数据保存到对象内 SQLite；D1 保存全局账号和小镇目录，R2 在资产规模需要时加入。

本文中的模块、目录、协议、数据表和参数都是拟议设计。现有策划中的职业、租房、盗窃、报警和经济规则仍是业务依据；本文细化其技术实现。策划中 Node.js + Colyseus + PostgreSQL 的候选技术路线，由本方案中的 Cloudflare 路线替代。策划开头关于早期四栋房屋的描述不作为当前场景事实，以现有代码和 README 为准。

推荐先阅读“关键决策”“部署拓扑”“存储模型与约束”“交易与可靠发布”“实施阶段”，再按职责查阅其余章节。所有容量、更新频率和延迟预算均需在技术验证中确认。

## 当前状态与升级动机

当前项目已经实现九栋房屋、街区道路、树林、湖岸、昼夜、车辆与信号灯、点击行走、进出屋、角色跟随相机和 PNG 截图。现有渲染还包括几何合并、植物实例化、后处理、水面反射和帧间隔显示。最新工作区包含 performance-policy.js 的刷新门控与自适应画质策略，package.json 已提供 Node 测试入口；其真实设备效果以验证报告为准。多人、登录、财产、生产、租约和案件尚未实现。

| 现状与代码依据 | 后续问题 | 升级措施 |
| --- | --- | --- |
| main.js 负责地图生成、角色车辆、主题、循环、UI 与宿主适配 | 新系统增加后入口不断扩大 | 入口只组装模块和管理生命周期 |
| interaction.js 同时包含输入、寻路、移动、进出屋和相机 | 修改一项容易影响其他行为 | 分离 Input、Navigation、PlayerController 与 CameraController |
| 位置和交互状态直接依附 Three.js 对象 | 存档与网络逻辑依赖图形对象 | 建立独立实体数据与表现映射 |
| 地图和碰撞尺寸分布在生成代码与寻路代码中 | 改湖岸或房屋后需要同步维护多处 | 共用数据化地图与碰撞定义 |
| 多个模块绑定事件、观察器并计算时间 | HMR、重新初始化和销毁容易残留状态 | 统一更新入口和 dispose 契约 |
| build.mjs 复制 HTML 与 src，运行时从 esm.sh 导入 Three.js | 构建产物不包含完整依赖 | 由 Vite 打包本地锁定依赖 |

现有美术、截图、程序化材质、合批和反射效果尽量沿用。首轮迁移不同时更换全部资产，也不以框架迁移作为画质改版。

## 目标、范围与约束

### 首版目标

- 一个持续存在的小镇先验证四名同时在线玩家，后续单独验证十六人。
- 玩家相互可见，能从采伐、加工、制作到购买、租房和布置完成生活闭环。
- 余额、物品、房屋、租约、经验与案件在重连和服务重启后恢复。
- 重复请求、并发争抢和提交后断线不复制物品、不重复扣款。
- 断线界面能够区分未提交、待确认、已完成和已拒绝。
- 保留当前昼夜、交通、相机、反射、截图及桌面/手机画质配置。

### 首版边界与未来能力

首版建议每个账号只有一个角色和一个常住小镇，账号不能通过客户端自行切换所属小镇。财产交易在同一小镇内完成，跨镇交易、携带财产拜访及搬家留到后续设计。这是为了建立明确的事务边界，不删除完整策划中的后续功能。

首版不引入完整 ECS、微服务拆分、多区域写入或独立物理引擎。模块边界先通过 TypeScript 类型、依赖约束和测试落实。网页界面继续使用轻量组件，是否引入 UI 框架以背包、商店和住房界面的复杂度为依据；Vite 本身不要求 React。

## 关键决策

| 决策 | 状态 | 理由与代价 |
| --- | --- | --- |
| Vite + Cloudflare Vite Plugin | 用户已确定 Vite，插件为推荐方案 | 同一工程开发前端与 Worker，需迁移原构建及环境选择方式 |
| TypeScript + Three.js | 推荐 | 明确实体和协议类型，逐模块迁移现有 JS |
| Workers Static Assets + API Worker | 推荐 | 沿用现有 Cloudflare 入口，前后端同源 |
| 每个持久 townId 对应一个 Town Durable Object | 推荐 | 小镇内共享状态与财产统一裁决，单镇存在容量上限 |
| 使用原生 Durable Objects | 推荐 | 生命周期、事务和恢复路径直接可控，连接与同步协议需实现 |
| 对象内 SQLite 为小镇财产权威存储 | 推荐 | 经济操作在一个本地事务中提交；跨镇转移需要专门协议 |
| D1 保存账号与小镇目录 | 推荐 | 提供全局索引，避免重复维护可独立写入的财产状态 |
| Hibernation WebSocket API | 推荐 | 空闲连接可保留；需要完整的状态恢复能力 |
| 活跃模拟先验证 10Hz，客户端按画面帧率显示 | 待实测 | 延续策划起点，不能预先保证延迟或容量 |
| JSON 协议起步 | 推荐 | 便于排查，消息量达到瓶颈后再评估二进制编码 |
| R2 按需加入，Queues 暂缓 | 推荐 | 当前程序化资产无需立即迁移；可靠发布先用对象内待发布表 |

Cloudflare Vite Plugin 可让本地 Worker 运行在 workerd 中并访问 bindings；Durable Objects 官方建议围绕需要协调的业务单元划分实例。将“小镇”作为协调单元是本项目基于策划做出的设计选择。[Vite 插件](https://developers.cloudflare.com/workers/vite-plugin/)、[Durable Objects 设计原则](https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/)

### 候选实时框架比较

| 方案 | 提供的能力 | 本项目判断 |
| --- | --- | --- |
| 原生 Durable Objects | 持久实例、SQLite、WebSocket、Alarm | 首选；业务层只依赖连接与存储接口 |
| PartyServer | 房间路由、连接钩子、广播、休眠适配 | 若连接管理成为主要开发负担，可替换传输适配层 |
| Colyseus | 游戏房间、状态同步、Node.js 部署体系 | 暂不作为 Cloudflare 原生路线的基础 |

PartyServer 官方仓库说明其基于 Durable Objects 并封装连接生命周期和休眠。Colyseus 官方常规部署路线围绕 Node.js 服务。上述选择是针对本项目的工程取舍，不表示其他路线不可部署。[PartyServer](https://github.com/cloudflare/partykit/tree/main/packages/partyserver)、[Colyseus 部署](https://docs.colyseus.io/deployment/)

## 部署拓扑与权威边界

~~~mermaid
flowchart TD
    Browser[浏览器：Three.js 与网页界面] --> Assets[Workers Static Assets：Vite 前端产物]
    Browser --> Worker[Worker：认证、API、连接路由]
    Worker --> D1[D1：账号、小镇目录]
    Worker --> Town[Town Durable Object：小镇权威裁决]
    Browser <-->|WebSocket 经 Worker 接入| Town
    Town --> SQLite[对象内 SQLite：财产、租约、任务、案件]
    Town -.->|提交后异步更新| Projection[D1：运营查询投影]
    Browser --> R2[R2：后续模型与贴图]
    Town -.->|私有存档导出| Backup[R2：后续导出文件]
~~~

| 组件 | 负责 | 不负责 |
| --- | --- | --- |
| 浏览器 | 输入、交互预览、相机、渲染、音效、界面、本地预测 | 发币、判定所有权、确认成交 |
| Worker | 身份验证、请求校验、账号目录、小镇路由 | 在全局变量中保存权威游戏状态 |
| Town Durable Object | 会话、模拟、规则裁决、经济结算、同步、任务调度 | 跨镇全局事务、图形渲染 |
| 对象内 SQLite | 小镇权威持久状态、去重、账本、变更记录 | 模型贴图、逐帧动画数据 |
| D1 | 账号、常住小镇目录、可重建查询投影 | 小镇钱包与背包的第二套可写副本 |
| R2 | 版本化资产、私有导出文件 | 实时财产交易或会话锁 |

Town 对象使用持久 townId 寻址。临时 WebSocket 连接 ID、浏览器标签 ID和一次启动生成的随机 ID 都不能成为小镇身份。Worker 的内部 RPC 适合查询和业务调用；WebSocket 升级经 Worker 转发到对应对象。

一个对象的存储是私有的，其他对象不能直接访问。单镇内 SQLite 事务不会自动覆盖 D1、R2 或另一个对象。[对象存储边界](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/)

## 工程目录与依赖方向

以下是目标结构，迁移时按阶段增加目录，不要求第一步创建所有空文件。

~~~text
town-life-game/
  index.html
  src/
    client/
      main.ts
      app/                  # 应用启动、时钟、生命周期
      state/                # 权威副本、预测、待确认操作
      input/                # 鼠标、触摸、键盘到行为请求
      camera/               # 浏览、跟随、进出屋状态机
      rendering/            # Three.js、后处理、截图、水面
      entities/             # 实体 ID 到表现对象的映射
      ui/                   # 背包、商店、住房、任务、案件
      network/              # HTTP、WebSocket、重连、协议适配
      adapters/             # 可选宿主集成
    shared/
      protocol/             # 消息类型与运行时校验
      domain/               # 实体、值对象、错误码
      rules/                # 不依赖运行时的纯规则
      navigation/           # 地图、碰撞、路径算法
      content/              # 地图、配方、物品定义
    server/
      worker.ts             # 外部 HTTP 与连接入口
      auth/                 # 身份验证、入镇票据
      town.ts               # Durable Object 平台适配
      town-runtime/         # 会话、调度、模拟与同步
      services/             # 经济、生产、住房、案件用例
      storage/              # SQLite、D1、迁移、待发布表
      observability/        # 结构化日志与指标
  public/                   # 少量版本内静态资源
  migrations/d1/            # 全局数据库迁移
  tests/                    # 规则、集成、故障与场景测试
  docs/
  vite.config.ts
  wrangler.jsonc
  tsconfig.client.json
  tsconfig.worker.json
  tsconfig.shared.json
~~~

依赖方向为 client → shared、server → shared；shared 不引用 client 或 server，不依赖 DOM、Three.js、Cloudflare bindings。server 的业务服务通过仓储、时钟和事件发布接口访问平台，Town 类只负责平台事件接入与组装。

共享类型不能代替网络校验。外部 JSON 在入口检查类型、范围、有限数值、字符串长度和消息大小；客户端传入的账号、价格、奖励和权限不作为可信数据。

规则共享用于提升预览和反馈速度。服务端仍独立执行最终校验，客户端能看到规则代码不影响其权威性。

## 客户端模块与生命周期

### 应用启动与状态分层

App 负责加载配置、建立渲染器、创建系统、连接网络和销毁。场景入口不包含购买、租房或盗窃业务。

客户端状态分为四层：

| 状态 | 内容 | 生命周期 |
| --- | --- | --- |
| AuthoritativeReplica | 服务端允许该玩家查看的世界与私人状态 | 快照和增量更新 |
| Prediction | 本地移动预测、建造预览 | 可被服务端结果纠正 |
| PendingCommands | 未确认请求、原始内容摘要、结果查询状态 | 确认或明确终止 |
| PresentationState | 相机、菜单、选择、高亮、画质 | 本地维护 |

角色位置、房屋归属和物品状态由普通数据对象表达。EntityViewRegistry 维护 entityId 与 Object3D 的映射；客户端把数据变更映射为模型创建、更新和移除。Mesh 和材质对象不进入网络协议或存档。

### 统一更新与资源销毁

保留一个主 requestAnimationFrame 入口。模拟表现、角色插值、相机、水面更新和渲染按明确顺序执行；额外的截图或尺寸重绘不重复计入 FPS。帧间隔与 CPU/GPU 耗时分别统计，不能用当前 FPS 面板中的 ms 宣称 GPU 渲染耗时。

每个系统提供 create、update、dispose 等最小生命周期接口。dispose 取消 RAF、事件监听、ResizeObserver、MutationObserver、网络重连计时器、Controls、后处理和 RenderTarget。共享几何与材质由资源缓存统一引用计数释放，单个房屋销毁不能释放其他克隆仍使用的资源。

HMR 重新创建应用前先 dispose 旧应用。页面切后台时降低表现更新，回前台清理旧插值缓冲并重新校时；网络会话按协议维护，不能用暂停画面刷新代替服务器断线判定。

### 相机与交互

相机状态明确为 townBrowse、playerFollow、enteringHouse、indoorFirstPerson、leavingHouse。转换定义进入动作、允许输入、退出清理和取消行为；新转换只能接替当前转换，不能留下两套插值同时操作相机。

玩家进屋是服务端校验后的世界动作；隐藏屋顶和相机位置属于本地表现。其他玩家进入自己的第一人称视角，不会让所有客户端同时隐藏该屋顶。昼夜首轮保留为个人显示选项；未来共享天气/时间使用独立世界时间字段。

截图继续使用与主画面相同的渲染管线，导出后恢复画布、后处理和反射资源尺寸。宿主 widgetState 的相机恢复放入可选 adapter，普通浏览器无需存在宿主 API。

## 地图、导航与资产

TownDefinition 提供 worldBounds、道路、地块、建筑入口、水域、资源节点和碰撞形状。配置带 mapVersion 和 contentVersion。湖面美术轮廓与导航障碍读取共同的二维轮廓数据，再由客户端生成 Three.js Shape；不能把 Three.js Shape 传给服务端。

每类可交互物品定义 itemTypeId、尺寸、占地、碰撞、交互点、展示资产及是否可堆叠。运行实例另有 itemId、合法主人、当前位置与版本。草叶、花瓣、水波等装饰无需逐个成为持久实体。

首轮沿用小地图网格导航，提取纯路径算法和碰撞查询。GridCache 按地图版本和障碍物版本复用，不在每次点击时重建所有静态障碍。建造改变通行区域后，失效受影响的缓存，并重算经过该区域的路径。

建筑放置由服务端检查边界、占地重叠、支撑、入口与公共通行、角色碰撞和权限。客户端做同样的预览，但服务端使用当前障碍版本再次检查。屋顶和房屋可合批，选择与编辑通过逻辑 ID、实例索引或单独代理碰撞体保持可定位。

R2 后续存放大模型和贴图，版本清单记录内容哈希，资产 URL 使用版本化路径。当前 Canvas 程序纹理保留。贴图压缩、GLB 压缩和 LOD 在体积、解码耗时及设备实测后确定，不能用资源压缩替代绘制调用优化。

## 认证、会话与 HTTP 接口

### 账号与常住小镇

认证接入通过 AuthProvider 接口抽象，首轮选择一种受维护的身份提供方验证登录凭据，再映射为内部 accountId。具体提供方和账号恢复方式在实施前确定，不把邮箱文字、客户端自报 ID 或测试 query 参数当作生产身份。

Worker 从 D1 查询 accountId、characterId、homeTownId 和账号状态。绑定常住小镇的操作通过唯一约束与条件更新保证一次成功，失败时返回已有归属。Town 初次创建角色采用账号唯一键，配合明确的初始化请求记录；重复初始化不重复发放教程补助。

账号目录操作与 Town 初始化之间没有跨库事务。Worker 先完成常住小镇绑定，再以幂等调用确保 Town 内角色初始化；中断后重试继续初始化。不能因为 Town 暂时不可达而给账号另分配一个小镇。首版不提供改写 homeTownId 的普通玩家接口。

### 入镇与单活动会话

1. 浏览器完成登录后，请求入镇票据；Worker 校验账号状态和常住小镇。
2. 票据包含 accountId、characterId、townId、短期有效期、唯一 jti 和协议范围，由服务端签名。
3. 浏览器连接 /ws/towns/:townId。浏览器 WebSocket 无法像 fetch 一样自由设置 Authorization 头；同源会话可采用安全 Cookie，或通过短期票据传递，具体选一种实现。URL 票据不得写入访问日志，且不能长期复用。
4. Town 校验票据目标、签名和有效期，在持久事务中消费 jti、递增该账号的 sessionEpoch，然后接入新会话。
5. 新连接收到 welcome；旧连接被通知接管并关闭。任何旧连接消息均因 sessionEpoch 不匹配被拒绝，不能仅依赖关闭旧 socket。
6. 连接附加信息只保存最小身份、连接 ID、会话版本和失效时间；余额、背包与权限从权威存储查询。

首版的单活动会话保证来自“固定常住小镇 + Town 内会话版本”。跨镇访问开放后，需另设全局会话协调与转移流程。新会话已生效但握手失败时，旧会话也不能继续写；新端重新申请票据并恢复，界面明确提示连接失败。

HTTP 入口检查 Origin、Cookie/票据以及操作权限。WebSocket 接入也检查允许的 Origin，防止只因浏览器携带 Cookie 就接受任意来源连接。会话过期按服务端时间判定，需要重新认证；既有连接不能无限绕过账号封禁和会话失效。

### 拟议接口

| 路径 | 方法 | 行为 |
| --- | --- | --- |
| /api/me | GET | 当前账号、角色和常住小镇 |
| /api/towns/join-ticket | POST | 取得短期入镇票据，不允许自选未授权小镇 |
| /ws/towns/:townId | WebSocket | welcome、快照、输入、命令、增量与结果 |
| /api/towns/:townId/commands/:requestId | GET | 查询当前账号自己的持久请求结果，路由至 Town |
| /api/health | GET | 入口与版本信息；不批量唤醒全部小镇 |
| /api/admin/... | 按用例 | 管理员审计、补偿与查询；独立权限 |

财产命令首轮只通过 WebSocket 写入，HTTP 用于查询结果与账号操作。将来增加 HTTP 提交入口时，必须复用同一用例和去重机制。内部管理接口不能绕过账本直接修改余额。

## 消息协议与同步模型

### 协议版本与消息分类

welcome 返回 protocolVersion、contentVersion、mapVersion、serverTime、sessionEpoch 和 connectionId。协议版本用于消息兼容，内容版本用于配方和资产定义；两者分别维护。客户端和服务端约定兼容范围，不兼容时停止新操作并提示更新。

| 消息 | 方向 | 可靠性与用途 |
| --- | --- | --- |
| moveIntent | 客户端到服务端 | 高频或目的地输入；输入序号去旧，通常不写命令结果表 |
| command | 客户端到服务端 | 购买、放置、制作、租房、交易确认等持久行为 |
| commandResult | 服务端到客户端 | 持久请求的成功或拒绝结果 |
| snapshot | 服务端到客户端 | 当前账号被授权查看的完整基线 |
| publicDelta | 服务端到客户端 | 小镇公共状态变更 |
| privateDelta | 服务端到指定客户端 | 背包、余额、个人任务与案件变更 |
| movementFrame | 服务端到客户端 | 临时运动状态与已处理输入序号 |
| resync | 客户端到服务端 | 缺失版本时申请补齐或重发快照 |
| ping/pong | 双向 | 校时和连接存活，空闲时避免无必要唤醒 |

持久命令示例只描述协议，不是当前可运行接口：

~~~json
{
  "type": "command",
  "protocolVersion": 1,
  "sessionEpoch": 7,
  "requestId": "client-generated-unique-id",
  "kind": "placeItem",
  "payload": {
    "itemId": "item-123",
    "plotId": "plot-4",
    "expectedItemVersion": 3,
    "expectedPlotVersion": 12,
    "position": { "x": 1.25, "z": 2.5 },
    "rotationQuarterTurns": 1
  }
}
~~~

actor 从连接身份取得，不采信消息中的 accountId。requestId 长度和字符集有限制，payload 中位置必须为有限数值并落在合理边界。请求摘要按校验并规范化后的 kind、payload 与业务版本计算，不能直接使用任意 JSON 属性顺序。

成功结果包含 requestId、transactionId、结果内容和该玩家需要追赶的公开/私人游标；拒绝结果包含稳定错误码和是否允许重试。错误示例为 INSUFFICIENT_FUNDS、VERSION_CONFLICT、NO_PERMISSION、OUT_OF_RANGE、CAPACITY_RESERVED、SESSION_REPLACED、PROTOCOL_MISMATCH、TOWN_UNAVAILABLE。

### 公共、私人和运动流分离

公开变更使用 publicSeq；私人变更按账号使用 privateSeq；运动帧使用独立的 movementEpoch、frameSeq 和 processedInputSeq。数据库可另有内部 worldRevision，但不要求客户端收到全部内部事件。

这样不会因没有收到其他玩家私人背包事件而误判公共流缺失。公共事件不携带私人字段；私人事件查询始终受连接身份和访问权限约束。十六人阶段引入区域订阅时，为每个订阅提供基线和独立游标，不能继续假设客户端看到了全镇每一条事件。

### 快照与增量一致性

读取快照的实体和 publicSeq/privateSeq 必须来自一致的存储视图。构造快照时若需要异步分块，先固定基线，再缓冲其后的事件。大快照带 snapshotId、分块数量与游标，客户端收到完整快照后一次切换基线。

客户端只应用连续的相应流序号，忽略已处理的重复事件。遇到缺口申请重同步；服务端若仍保存增量则补齐，否则发送新快照。待确认命令另外查询原结果，不能因为快照重载就用新 requestId 再提交同一笔购买。

请求结果和状态增量可能先后到达。客户端保留 requestId 与 transactionId，成功结果用于结束等待，状态副本仍按游标推进；不能收到结果和增量各入包一次。拒绝后清除预览，显示具体原因，并允许基于新版本重新做出操作。

### 发送队列与慢客户端

服务端对消息数量、大小和输入频率设限。运动帧可合并为最新状态，不无限排队旧位置；持久变更通过存储游标保证可恢复。慢客户端达到待发送预算时提示重同步或关闭连接，重连从快照恢复，不靠无限堆积内存保留所有广播。

网络预算以实际编码字节数测量。初始消息体上限建议 16 KiB，快照分块建议不超过 32 KiB，均为应用层起点，不是 Cloudflare 平台上限。需要更大建造批次时单独设计批量命令与原子性。

## 移动、时间与权威模拟

### 两种移动输入

现有点击行走采用 moveTo 目的地请求；服务端计算或校验路径，返回路线版本、起始位置和开始时间。客户端立即预览，收到合法路径后对齐。策划中的 WASD 后续采用方向输入和递增 inputSeq，服务端限制每步时间与速度。

两种输入进入同一个 PlayerMovementSystem。客户端不能直接声明自己已经到达目的地。购买、采伐、开门、拿取和 NPC 扣留使用服务端模拟位置做距离和视线判断；同一业务处理入口先推进到当前服务端时刻，不能使用几百毫秒前的缓存位置。

### 模拟与画面频率

活跃运动先以固定 100ms 步长验证；一轮聚合变化后向每个客户端发送一份运动帧，不对每个角色单独逐条全广播。本地玩家用预测与服务端确认纠正，其他玩家用短缓冲插值，缓冲先验证 100–200ms。低频网络帧不等于低频渲染，客户端仍按 RAF 刷新画面。

服务端长暂停后不无限补跑历史 tick。限制补算窗口，取消需要连续在线的短交互，重建安全运动状态并告知客户端；生产、租约和资源生长按持久时间戳恢复。恢复不能让角色穿过建造后新增的墙，位置无效时寻找合法落点。

### 三类时钟

| 时钟 | 用途 | 恢复方式 |
| --- | --- | --- |
| 绝对 UTC 时间 | 制作、租期、生长、配额日期 | 保存 startedAt/completeAt/expiresAt |
| 活跃模拟时间 | 移动、持续拿取、NPC 距离与确认 | 恢复时重建，不能把停机时间计为有效操作 |
| 有效在线累计 | 新手保护、暂停式通缉 | 保存累计与可信在线区间，恢复后重新开始区间 |

客户端时间仅用于估计显示。服务端校时结果为倒计时基准；客户端改系统时间不能加速制作或领取奖励。策划中真实时间租约、UTC 每日配额和在线保护使用不同字段，不能共用一个“游戏时间”。

### 运动持久性策略

移动位置可在安全落点、场景切换和低频检查点保存，不逐帧写数据库；服务重启后允许回到最近合法检查点。保存频率先验证 5–10 秒，并在有角色改变位置时写入。物品交易、拿取和建造需要精确位置证据时，同事务保存行为时的权威位置与导航版本。

每个运动检查点保存服务端时间、已确认位置和必要路径信息；已确认位置与客户端预测位置区分。经济状态不能采用“最多丢几秒”的策略。

## 存储模型与约束

### D1 全局表

| 表 | 主要字段 | 约束 |
| --- | --- | --- |
| accounts | account_id、provider_subject、status、created_at | provider 与 subject 组合唯一 |
| characters | character_id、account_id、home_town_id、display_name | 首版 account_id 唯一；小镇归属条件初始化 |
| towns | town_id、status、content_version、region_preference | 持久小镇目录；不把人数副本用于最终接纳 |
| town_projections | town_id、projection_version、统计字段、updated_at | 幂等更新；延迟不影响经济结算 |
| admin_audit | actor、target、action、reason、time、operation_id | 管理操作可追溯 |

小镇容量是否已满由 Town 判定，D1 展示的人数是可能滞后的目录信息。账号封禁在入镇与定期验证时生效；已有连接的失效策略必须覆盖，不能仅禁用登录按钮。

### Town SQLite 主要表

| 表 | 主要字段与用途 | 核心约束 |
| --- | --- | --- |
| town_meta | schema/content/map 版本、公共游标、恢复代次 | 单个持久小镇身份 |
| players | character/account、职业、经验、保护累计、安全位置 | account_id 唯一 |
| sessions、used_tickets | 会话版本、到期时间、已消费 jti | 旧会话不能写；票据不可重放 |
| money_accounts | 账户类型、所属人、整数余额、预留金额、version | 玩家可用余额非负 |
| ledger_transactions、ledger_entries | 结算原因、请求关联、借贷分录 | transaction_id 唯一；每笔分录平衡 |
| item_instances | item_id、类型、数量、合法主人、失窃案件、version | 数量为正；实例 ID 唯一 |
| item_locations | item_id、location_kind、container_id、位置 | item_id 为主键，每件物品一个有效位置 |
| item_reservations、capacity_reservations | 占用者、用途、数量/容量、失效条件 | 总预留不超过可用资源 |
| plots、buildings、building_modules | 地块、产权、模块、布局版本 | 地块权限、占地和入口有效 |
| access_grants | 房屋、主体、权限、有效期、version | 开门/布置/拿取权限分开 |
| leases、lease_escrows | 房屋、租客、到期、状态、托管押金 | 一屋一个未结束租约；一人一个租约 |
| resource_nodes、short_actions | 树木状态、独占任务、操作证据 | 同一资源同一时刻一个有效采伐 |
| production_jobs | 配方快照、投入、完成时间、产出、状态 | 每人一个未结算生产任务 |
| trades、trade_lines、trade_confirmations | 双方、版本、物品款项、确认 | 同版本双确认才能结算 |
| orders、daily_quotas | 委托需求、领取/提交状态、UTC 日期配额 | 订单奖励唯一；配额不越界 |
| cases、case_evidence | 行为证据、涉事账号、物品、追回与罚款 | 手动报案与已验证案件区分 |
| command_results | account、request_id、kind、摘要、结果、时间 | account 与 request_id 组合唯一 |
| public_events、private_events | 各自流序号、事件、transaction_id | 流内序号唯一 |
| scheduled_jobs | 到期时间、状态、尝试、去重键 | 到期查询索引；重复执行安全 |
| outbox | 目标、事件键、载荷、重试与确认 | 同目标事件键唯一 |

此表是概念模型，实际 DDL、索引与 JSON 字段拆分在存储验证后形成迁移文件。关系约束、CHECK、条件 UPDATE 与适用的部分唯一索引落实可表达的不变量；几何通行和动态权限由服务端规则实现，不能靠数据库独立完成。

### 货币、物品与托管

游戏币使用受范围限制的整数，进入 JavaScript 时必须保持安全整数；手续费按策划规则取整。余额与待缴罚款分开，不能用负钱包余额表达债务。玩家可用余额为余额减预留金额，预留应与具体交易记录关联。

每笔账本分录合计为零。教程补助和订单奖励从显式系统发行账户转出，租金、加工费和回收费流向显式系统账户；玩家转账只在已有账户间转移。系统发行账户的记账规则与玩家非负约束分别定义，不能错误地要求发行来源也有玩家式可用余额。

家具合法所有权存于 item_instances；实际位置存于 item_locations，当前持有者从背包、容器或保管位置关系推导，避免同时维护互相矛盾的 holder 字段。堆叠原料按数量管理，预留数量不可重复消耗；拆分堆叠在同事务中生成唯一实例。

位置类型至少覆盖背包、房屋、私人箱、制作占用、工作台领取区和保管站。盗窃改变位置并关联案件，合法主人不变；合法交易同时改变主人和位置。房屋、租赁使用权与家具所有权分别记录。

### 版本与保留策略

业务实体使用递增 version 处理过期预览和并发确认；修改布局递增相应空间版本。长任务保存配方、费用、奖励和规则版本快照，配置更新不能悄悄改变已扣款任务的产出。

账本和结算标识按经济审计需要长期保留；命令结果允许归档，但保留足以防重放的去重记录，不能删除后接受同一个旧请求。增量事件可按时间/数量压缩清理，超出窗口的客户端重取快照。过期票据在失效时间加容差后清理。具体保留时间随存储量和恢复要求确定。

## 交易、去重与可靠发布

### 标准命令处理管线

~~~mermaid
sequenceDiagram
    participant C as 客户端
    participant T as Town
    participant S as SQLite
    C->>T: command(requestId, payload)
    T->>T: 校验身份、会话、协议与限流
    T->>S: 查询已有请求结果
    alt 请求已经完成
        S-->>T: 原结果与摘要
        T-->>C: 返回原结果，或拒绝摘要冲突
    else 新请求
        T->>T: 推进权威位置并校验规则
        T->>S: 同事务写实体、账本、结果与事件
        S-->>T: 提交成功
        T->>T: 更新内存镜像
        T-->>C: commandResult
        T-->>C: 公开与私人增量
    end
~~~

建议同步 SQL 经济单元使用 transactionSync：读当前版本和约束、条件更新、验证受影响行数、写账本与事件。任何约束失败应终止整个事务。不能看到 UPDATE 成功执行就认为确实扣款，必须确认预期行数；数据库约束失败不能继续写成功结果。

随机产出 ID 在成功事务中保存，重试读取同一结果。已提交后内存更新、socket 发送或 HTTP 回包失败，都不撤销经济事实。下一次初始化从数据库重建，客户端通过结果查询和快照确认。

### 错误与重试分类

| 情况 | 处理 |
| --- | --- |
| 同账号、同 requestId、同规范化内容 | 返回原成功或确定拒绝结果 |
| 同账号、同 requestId、不同内容 | REQUEST_ID_CONFLICT，不执行 |
| 余额不足、权限不足、版本过期等确定拒绝 | 保存最终拒绝结果；玩家改变条件后用新请求 |
| 数据库/平台短时失败且未提交 | 返回可重试或断线；以原 requestId 重试 |
| 提交成功但回包丢失 | 查询原结果，禁止改编号重做 |
| 旧会话、无效协议、畸形消息 | 在经济事务前拒绝，不创建大批持久去重记录 |

网络层不能自动为未确认命令生成新编号。客户端保存待确认命令最小记录及摘要，可使用 IndexedDB 辅助崩溃后恢复，但本地记录不是财产依据；清除浏览器数据后仍以服务器快照为准。

### 待发布记录与查询投影

公开/私人状态事件与经济结算在同事务内提交。客户端送达可能重复或中断，按游标恢复；不承诺 WebSocket 消息恰好送达一次。

D1 运营投影或 R2 导出等外部动作使用 outbox：提交时写待发布记录，事务外调用目标，成功后标记；失败退避重试。D1 以事件键和版本去重，版本过旧的更新不能覆盖较新投影。对外已经写成功但未标记本地完成时，再次调用仍安全。

outbox 与到期任务共享 Town 的一个 Alarm 调度器，不能由各模块互相覆盖 Alarm。失败持续出现时保留记录、限制尝试频率并告警，不能通过删除待发布记录把故障变成“成功”。首版不引入完整事件溯源，状态表为主要查询来源，账本和变更记录提供审计与恢复依据。

## 业务系统落地流程

### 购买、交易与委托

购买：校验商品定义、价目版本、库存和背包容量；同事务扣游戏币、减少库存、分配物品、记账、保存结果。价格来自服务端已发布配置，客户端价格只用于显示和确认过期报价。

面对面交易：创建交易与报价版本；预留物品、款项和容量。任何一方修改内容都会递增版本并取消双方确认。双方确认同一版本时重新验证在线状态、距离、归属与预留，再一次性转移双方物品、货币和手续费。取消、断线、过期或校验失败释放预留；物品同时不能被制作、拿取或另一笔交易消耗。

赠送沿用双方确认流程。失窃物品不得出售、赠送、销毁或作为原料。委托交货在一个事务中消耗货物、扣减委托剩余量、发放奖励、写经验与配额，奖励有唯一结算键。

### 采伐、加工与制作

采伐开始时独占资源节点，检查工具、距离、视线和可用容量，预留产出空间；持续在线操作期间服务端检查范围与阻挡。取消不产出，也不扣一次完整采伐耐久。完成时同事务改变树木状态、消耗耐久、生成原木并安排再生任务。

加工/制作开始时固定配方和规则版本，将材料转入该任务的制作占用位置并扣费用；保存完成时间和唯一产出安排。首版任务被接受即开始，开始后不能取消退料，合法生产不因离线停止。完成事务消耗占用材料并生成唯一产出，优先入背包，容量不足进入制作者专属工作台领取区。领取以产出 ID 和唯一结算状态去重。若后续加入尚未开始的排队状态，其取消要同时返还占用材料和费用，与已开始任务区分。

“每人一个制作任务”与“每棵树一个采伐任务”分别约束，不能用公共工作台全局锁阻塞所有玩家。树木按绝对时间生长；角色短动作使用连续在线证据，两者恢复策略不同。

### 建造、放置与产权

放置确认时检查 itemVersion、plot/layoutVersion、地块与租约权限、占地、支撑、角色碰撞和门口可达性。通过后更改物品位置或创建建筑模块记录，递增障碍版本并发布变更。拆除返还原模块，避免通过销毁并新建复制资产。

玩家位置与房屋门口通行检查使用同一权威碰撞定义。建造不能困住其他玩家；若涉及迁移角色，必须是明确且有记录的规则，否则拒绝建造。只改变相机或屋顶可见性不修改财产表。

合法主人可以收回自有家具；租客不因租房获得固定设施所有权。非法拿取者暂时摆放失窃家具时走独立受限规则，保留原合法主人与案件，不能经普通放置/收回转换成自有物品。

### 租房、续租与退租

申请租约：原子检查房屋空闲、租客未有活动租约和款项可用；租金流向出租账户，押金进入对应托管账户。购买期数、自动续租选择、到期时间和规则版本一并保存。

续租：只在玩家已明确开启自动续租且余额足够时执行。到期任务以租约周期作为唯一结算键；余额不足进入策划定义的宽限状态。离线期间租期照常流逝。停机期间跨过多个续租周期时，按持久时间线和明确的规则处理，不能无记录地一次扣所有余额。

退租整理：租约进入 cleaning，禁止新出租和并发改动目标物品；只把仍在屋内、合法属于租客的物品移动到保管站。已经被偷走的原物品不生成替代品。首版每户家具上限内优先一次事务整理；若未来分批，保存清理进度，每个物品移动和最终退款均幂等。

整理完成后退押金，主动退租不退剩余租金，最后开放房屋。不能先把房屋标为空闲，再异步整理上一租客家具。保管站容量允许临时溢出，避免因背包满丢失物品。

### 权限、盗窃、案件与 NPC

AccessPolicy 分别判断进入、布置、拿取和交易权限。任务开始与最终提交都检查，不能因为开始时有权限就忽略后续租约到期或权限撤销。

盗窃任务独占目标物品与容量，保存开始时房主在线/保护状态、合法主人、位置和连续动作证据。离开范围、阻挡、断线、取消和恢复后证据缺失均中止。主人离线保护只阻止符合策划条件的新非法任务，不能错误撤销在保护前已经合法开始的十秒任务。

偷取完成在同事务中移动原物品、生成可信案件及失窃关联，不更改合法主人。安装报警器和权限系统决定通知对象；手动报案只创建待核实记录，不直接罚款或指定他人有罪。

NPC 根据已验证案件、道路导航和近距离确认追回原物品到合法主人保管站。罚款使用独立债务记录，未缴款从后续职业收入按策划比例扣还，不让钱包变负。通缉剩余时间按有效在线累计暂停和恢复；案件与失窃标记不因离线清除。NPC 动作不能用 Alarm 到期后直接瞬移扣留替代。

### 管理操作

补偿、撤销、强制归还和封禁采用明确的管理员命令、唯一 operationId 和审计原因。撤销使用关联原结算的补偿事务，不删除原账本。恢复被盗物品时先追踪原实例，不能同时追回原物品又发一份新物品。

## 到期任务、休眠与故障恢复

### 一个统一调度器

scheduled_jobs 保存 jobId、kind、dueAt、status、唯一结算键、目标实体版本和载荷。按 dueAt 建索引；Alarm 读取一批已到期任务，每个任务执行受条件保护的事务，再安排下一次最近唤醒。

批量限制和最长处理预算避免长时间占用对象。任务完成效果和完成标记同事务提交；事务外的通知通过事件或 outbox 发布。任务失败持久记录尝试次数、下次时间与原因，超过预算进入可见的待处理状态。请求入口也校验并补处理与当前操作有关的到期状态，不能完全依赖 Alarm 精确准时。

Alarm 只有一个活动设置，并采用至少一次执行语义。业务任务的幂等效果是应用责任。[Alarm API](https://developers.cloudflare.com/durable-objects/api/alarms/)

### 活跃与空闲状态

| 运行状态 | 循环和持久工作 |
| --- | --- |
| 存在运动或需要连续验证的交互 | 活跃 tick，按变化聚合广播 |
| 在线玩家静止且没有活跃交互 | 清除模拟定时器，允许休眠 |
| 无在线玩家 | 清除运动循环，保留制作、租约、生长与 outbox 到期任务 |
| 新请求、消息或到期任务 | 重新初始化，恢复必要状态，再执行事件 |

Hibernation 需要不存在持续定时器、未结束的相关 I/O 等条件，休眠会丢弃内存。WebSocket attachments 保存恢复连接所需的最小信息；重要业务状态保存到 SQLite。[生命周期](https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/)、[WebSocket 休眠](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)

空闲心跳可使用平台自动响应能力，但认证有效期与账号封禁仍由业务检查。不能通过每隔 100ms 的 Alarm 伪装休眠，连续模拟本来就属于活跃工作。

### 初始化与恢复顺序

1. 用受保护的初始化过程读取 townId、schemaVersion、内容版本并完成兼容迁移；初始化屏障只用于这类工作，不包住每个业务请求。
2. 重建最低限度地图、规则缓存、会话版本和权威镜像，避免每次唤醒加载完整美术资产或所有历史账本。
3. 获取仍健康的连接及 attachments，校验会话与过期时间，恢复在线玩家列表。
4. 对恢复时无法证明连续有效的采伐/拿取等短动作取消并释放预留；面对面未提交交易重新检查双方连接，条件不满足则释放。
5. 制作、生长和租约依据持久时间戳处理；完成任务按原配置快照结算。
6. 校验安全位置与现有障碍，重建需要继续的运动；必要时更换 movementEpoch 并发送运动基线。
7. 安排最近到期任务和待发布重试，在必要时恢复活跃循环。

恢复不是自动判定玩家一直在线。新手保护累计、离线保护和暂停式通缉根据可信在线检查点恢复；无法确认的停机区间不增加有效在线时长。离线保护生效时间与最后可信连接状态一起保存，服务器恢复后采取保护财产的规则，不接受停机期间补交的非法动作。

### 不同故障的处理

| 故障 | 行为与恢复 |
| --- | --- |
| 浏览器短断线 | 取消依赖连续连接的拿取和面对面交易；角色按策划保留三十秒；重连查询结果 |
| Town 休眠 | 财产保留；从 SQLite 与 attachments 恢复 |
| Town 重启或平台故障 | 丢弃不可信临时动作；生产按时间恢复；位置回合法检查点 |
| D1 目录不可用 | 新登录/目录操作返回可重试；已有已认证小镇会话不因统计投影失败丢失财产 |
| D1 投影发布失败 | outbox 重试；经济已提交，玩家结果不回滚 |
| R2 资产加载失败 | 展示重试或占位；不因此生成或删除物品 |
| 存储满、迁移失败或对象过载 | 停止相关写操作并返回可重试/维护状态；不宣称成功 |
| 单镇存档人工恢复 | 维护模式、断开会话、恢复校验、轮换恢复代次、废止旧票据、重发快照 |

### 备份、恢复与数据一致性

SQLite-backed Durable Objects 提供 PITR，官方文档说明可恢复过去三十天内的数据库状态。它用于故障恢复，不等于已经实现备份演练或长期归档。[存储恢复能力](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/)

首版上线前必须实际完成一次测试小镇导出/恢复演练，记录范围、耗时和校验结果。恢复后核对账本平衡、物品唯一位置、租约托管、任务产出与案件关系；D1 投影按新的恢复代次重建，不能让旧投影继续覆盖新状态。

正常重连与重启要求已确认的经济事务不丢失，位置按检查点策略恢复。人工回滚会撤销恢复点之后的游戏事实，应明确恢复窗口与影响；上线前确定可接受的 RPO/RTO，不能提前承诺无损恢复或固定恢复时间。未来开放跨镇财产转移后，单镇回滚还必须与转移日志协调。

## Vite、Cloudflare 配置与发布

### 开发与构建

依赖清单包括 vite、typescript、three、@cloudflare/vite-plugin 和 wrangler，测试接入 Cloudflare 当前维护的 Vitest 集成。版本在技术验证时选择相互兼容的稳定组合，写入 lockfile，CI 使用 npm ci；不在本文中把尚未安装的版本写成项目事实。

Vite 配置的最小形态如下，路径、环境和插件参数在迁移阶段验证：

~~~typescript
import { defineConfig } from 'vite';
import { cloudflare } from '@cloudflare/vite-plugin';

export default defineConfig({
  plugins: [cloudflare()],
});
~~~

客户端通过普通模块导入 three 及其 addons，不继续从 esm.sh URL 导入。客户端、shared 和 Worker 分别配置 TypeScript 检查环境，避免 Worker 被误认为有 DOM，或客户端误导入服务端 bindings。

Vite 只转译 TypeScript，类型检查需要独立步骤。Cloudflare 插件构建时生成部署配置和资源位置，不能继续用 build.mjs 手动复制源代码覆盖这些产物。[TypeScript 检查](https://vite.dev/guide/features.html#typescript)、[Vite 集成与产物配置](https://developers.cloudflare.com/workers/vite-plugin/tutorial/)

### Wrangler 输入配置

| 配置类别 | 拟议内容 |
| --- | --- |
| Worker entry | 指向 src/server/worker.ts |
| Static Assets | 前端资源由插件管理；只有需要客户端路由时才启用 SPA fallback |
| run_worker_first | /api/* 与 /ws/* 等明确的服务端路由 |
| Durable Object binding | TOWNS 对应导出的 Town 类 |
| Durable Object migration | 首次注册 SQLite-backed class；后续 class 变更逐版本迁移 |
| D1 binding | 全局账号与目录库，按环境绑定独立数据库 |
| R2 binding | 后续资产与私有导出 bucket，按环境隔离 |
| Secrets | 登录、票据签名和管理凭据；不写入客户端环境变量 |
| compatibility_date | 经本地/远端测试的固定日期，按版本计划升级 |

DO 类/命名空间迁移与对象内业务表迁移是两回事。注册 new_sqlite_classes 不会替应用创建 items、leases 等业务表。D1 迁移、DO 迁移和客户端发布分别有顺序与校验。

### 环境隔离

| 环境 | 用途 | 数据与入口 |
| --- | --- | --- |
| local | Vite + workerd 开发 | 本地状态；默认不连接生产存储 |
| dev | 远端联调与故障验证 | 保留现有 dev.youichi.me，独立对象命名空间与 D1 |
| production | 正式游戏 | 用户指定正式域名后配置；独立数据库、bucket 和 secrets |

每个环境显式配置所需非继承 bindings，并验证解析后的资源 ID。生产 secrets 不使用 VITE_ 前缀，因为客户端环境变量可能进入前端产物。开发阶段需要连接远端资源时只允许明确选定的 dev 资源。

Cloudflare Vite Plugin 在 dev/build 时读取 CLOUDFLARE_ENV，构建生成选定环境的配置。在 preview 或 deploy 时才设置它没有切换构建环境的效果。[官方环境机制](https://developers.cloudflare.com/workers/vite-plugin/reference/cloudflare-environments/)

### 建议脚本契约

| 脚本 | 目标行为 |
| --- | --- |
| npm run dev | 启动 Vite 与本地 Workers runtime |
| npm run typecheck | 检查 client、shared、worker 的类型 |
| npm run test | 执行有意义的规则与运行时测试 |
| npm run build | 对已经选择的 Cloudflare 环境执行 Vite build |
| npm run preview | 在 Workers runtime 预览构建产物 |
| npm run deploy:dev | 选择 dev 后重新构建，再发布生成的配置 |
| npm run deploy:production | 选择 production 后重新构建，再发布生成的配置 |

环境脚本应使用跨平台 Node 包装或经验证的工具，避免把 POSIX 的环境赋值写法直接放入 Windows 命令。项目当前 npm scripts 仍是旧构建，上表是未来契约。

PowerShell 中概念性的 dev 发布顺序如下；本文没有执行这些命令：

~~~powershell
$env:CLOUDFLARE_ENV = 'dev'
npm ci
npm run typecheck
npm run test
npm run build
npx wrangler deploy
~~~

CI 将构建环境、commit/版本标识、协议/内容版本和生成配置记录为发布元数据。构建与部署使用同一已验证环境，不将 dev 构建直接发布到 production。权限限于所需 Cloudflare 资源。

### 发布与兼容

客户端 JS/CSS 使用内容哈希和正确缓存策略，入口 HTML 能获取新资源清单。API 和 WebSocket 结果不走公共静态缓存。没有离线游戏需求时不先引入 Service Worker，以免额外增加旧客户端和资产缓存管理。

发布可能使对象重新初始化或连接重建，客户端始终支持结果查询与快照恢复。兼容升级尽量同时接受当前和上一协议版本；具体支持窗口明确标注。破坏性升级进入小镇维护状态，停止新财产请求，确认已接受事务，再引导客户端更新。

## 数据迁移与内容更新

### 表结构迁移

每个 Town 保存 schemaVersion。初始化时按版本顺序执行短小、可重入的兼容迁移；迁移失败保持维护状态，不能用删除数据库重新创建来恢复。首版优先增加字段和表，通过默认值兼容旧记录。

长时间迁移分阶段执行：添加结构 → 后台回填并记录进度 → 验证 → 切换读取 → 在后续版本删除旧结构。不能在所有对象第一次连接时无预算地扫描全部账本。对象初始化屏障只覆盖必要初始化，迁移期间的外部网络请求不放进经济事务。

D1 全局迁移先保证新旧 Worker 都能读取；业务代码回滚只在旧代码仍兼容新 schema 时进行。数据库破坏性变更不能随 Worker 版本回滚自动撤销。

### 地图与配方迁移

contentVersion 更新后，新任务使用新规则，已接受制作任务沿用保存的配方、费用、完成时间和产出快照。价格改变让未提交报价失效并重新确认；已完成结算不重算。

mapVersion 改变前检查玩家房屋、家具、入口和安全位置。地图迁移形成明确的移动或保管计划，记录原因及 affectedEntityIds；不能让湖泊扩大后直接吞掉家具，或让新道路无记录地删除玩家建筑。迁移后重建碰撞和路径缓存。

### 原型迁移

当前浏览器本地相机或宿主 widgetState 仅迁移为偏好，不导入为游戏财产。当前场景没有持久经济存档，因此第一版可以从确定的 TownDefinition 初始化；仍需给每个固定地块、房屋和资源节点稳定 ID。

老 JS 模块按职责逐步迁入 client/shared。每阶段保持当前场景可运行；不要同时改变 Three.js 主版本、后处理方案、资产风格和全部交互，减少回归定位成本。

## 安全、权限与数据可见性

| 风险 | 技术控制与验证 |
| --- | --- |
| 自报身份、余额、奖励或所有权 | actor 来自认证连接；价格和规则来自服务端 |
| 重放票据、旧会话继续提交 | 一次性 jti、有效期、sessionEpoch、恢复代次 |
| 重放购买和领奖 | 请求摘要、持久结果、唯一结算键 |
| 任意位置与穿墙 | 服务端运动、碰撞、距离、视线和速度校验 |
| 私人背包或案件泄露 | 服务端构造公共/私人视图，禁止先全量下发再前端隐藏 |
| 访客修改房屋 | 开门、布置、拿取分别判权，事务前重验 |
| 失窃物品洗成合法财产 | 所有权/位置/案件分离；禁止出售、拆料和普通回收 |
| 畸形 JSON 与流量滥用 | 有界解析、结构校验、频率及消息大小限制 |
| 慢连接拖垮房间 | 有界发送与重同步，丢弃过期运动帧 |
| 管理员误操作 | 独立权限、原因、唯一操作 ID 和补偿账本 |

文字聊天使用长度上限、冷却、屏蔽和举报；网页展示使用文本输出，不能把玩家输入直接作为 HTML。报案与聊天不能触发财产变更。对象入口的限流包括账号和连接，不只限制 IP，以免一个共享网络的正常玩家互相影响。

日志记录 requestId、transactionId、操作类型、结果和必要内部 ID；不记录票据、Cookie、secrets 或完整私人背包。案件证据和管理审计的访问范围明确，客户端是否具备管理按钮不能作为权限判断。

## 性能、容量与费用预算

### 待实测的应用层参数

| 参数 | 首轮起点 | 调整依据 |
| --- | --- | --- |
| 同时在线玩家 | 四人，随后十六人 | 最大玩法场景及服务端负载报告 |
| 服务端运动模拟 | 活跃时 10Hz | 输入延迟、碰撞与短交互正确性 |
| 远端角色插值 | 100–200ms | 抖动与视觉连续性 |
| 小镇尺寸 | 策划约 64 米见方 | 内容布局与导航实测 |
| 可采伐节点 | 策划 32 个 | 经济供给与玩法负载 |
| 家具预算 | 策划每户最多 50 件 | 绘制、拾取、通行与存储 |
| 安全位置检查点 | 有变化时 5–10 秒 | 写入量与重启可接受的位置回退 |
| 消息体与快照块 | 16 KiB / 32 KiB | 序列化、下载时间与对象内存 |

这些数字均为验证起点，不等于已实现的上限或平台承诺。短交互证据和在线保护检查点另设预算，不能为减少写入而让玩家重连重置保护或福利。

### 客户端预算

以策划的参考桌面设备、1080 像素纵向分辨率、最大首版场景为验收条件：目标稳定 30 FPS，帧间隔 p95 不超过 50ms，较好设备以 60 FPS 为目标。设备、浏览器、渲染分辨率和昼夜场景必须记录。手机另设档位并在实体设备验证，浏览器手机模拟只能验证布局与交互。

分别记录主帧间隔、CPU 系统耗时、绘制调用、三角形、纹理与反射目标、后处理开销。保留实例化和按材质合并；房屋室内按可见性加载，控制阴影和反射更新频率。平均 FPS 不能替代 p95，后台节流不用于性能结论。

### 服务端与网络预算

记录每个 tick、规则校验、SQLite 事务、序列化和广播的耗时，以及命令从发出到结果确认的端到端延迟。负载增加时先找测得的瓶颈，而不是直接拆成每玩家一个 DO。

示例：十六名玩家各以每秒十次发送输入，约为每秒 160 条输入。若每个 tick 为每个客户端发一份聚合运动帧，约每秒 160 条输出；若把十六名角色的更新逐个向所有人广播，则消息数量明显增加。该算例只解释聚合方式，不推导可承载人数或费用保证。

首版四人可共享小镇公共视图；十六人阶段按区域和室内订阅，进入区域先发基线，离开区域移除视图。财产仍由整个 Town 统一裁决。区域订阅不等于把每个区域立刻拆成不同事务域。

Cloudflare 文档中的单对象吞吐和存储限额是平台边界，不是游戏玩家容量。SQLite-backed 单对象当前存储上限为 10GB，容量规划还需考虑账本、事件和索引增长。[平台限制](https://developers.cloudflare.com/durable-objects/platform/limits/)

### 地域与费用

小镇对象在单个位置运行，全球 Worker 入口不会让同一个小镇在各地区各运行一份。根据真实玩家分布创建小镇，可在首次寻址时使用相应 locationHint；提示属于尽力而为，已有对象不能靠后续提示直接迁移。不要在开发者所在地提前创建所有生产小镇。[对象位置](https://developers.cloudflare.com/durable-objects/reference/data-location/)

费用模型分为 Worker 请求、DO 消息/调用、DO 活跃时长、SQL 读写存储和后续 R2 使用。DO 活跃时长按墙钟时间计费，不只按实际 CPU 运算时间；持续定时模拟会产生时长费用。空闲休眠优化与降低消息频率分别验证。[DO 计费](https://developers.cloudflare.com/durable-objects/platform/pricing/)

可用“小镇不可休眠秒数 × 计费内存系数”估算 GB-s，再套用当前套餐包含量、费率和舍入规则。消息计费与实际消息指标存在折算，不能简单把广播条数乘请求单价。预算报告记录活跃小镇数、每镇在线时长、每人消息率、SQL 扫描行数、写入行数、事件保留量和资产流量。原型未测量前不承诺免费运行或固定月费。

## 可观测性与运行手册

| 指标 | 判断的问题 |
| --- | --- |
| 活跃小镇、在线连接、恢复次数 | 流量与对象生命周期 |
| inputRate、tickDuration、serializationDuration | 模拟或编码瓶颈 |
| commandLatency、transactionDuration、错误码分布 | 经济体验与业务拒绝 |
| 重试命中率、摘要冲突、账本校验失败 | 去重与滥用 |
| resyncCount、snapshotBytes、慢连接关闭 | 同步窗口和网络健康 |
| Alarm lag、任务重试、最老待发布事件 | 到期与外部发布是否积压 |
| SQL 读写与存储增长、活跃 GB-s | 成本与容量 |
| 客户端帧间隔 p50/p95、画质档位 | 实际设备表现 |

日志能够按 requestId 关联 Worker 接入、Town 结算和客户端结果；重连复用原编号。运行手册至少覆盖小镇过载、存储满、卡住租约、outbox 积压、版本不兼容、资产发布失败和存档恢复。告警阈值在基线测试后制定，初期先建立指标与故障注入证据。

## 测试与验收计划

测试优先验证业务不变量和真实失败路径，不为简单模块搬迁编写只复述实现的测试。Cloudflare 官方当前提供在 Workers runtime 中执行的 Vitest 集成，支持 bindings、单元与集成测试；具体包版本与项目工具链一起锁定。[Workers 测试集成](https://developers.cloudflare.com/workers/testing/vitest-integration/)

| 层级 | 测试 | 通过依据 |
| --- | --- | --- |
| 纯规则 | 放置、价格取整、权限、失窃限制、路径碰撞 | 边界与非法输入得到确定结果 |
| SQLite | 并发购买同物、同屋租赁、同树采伐、同物拿取 | 单一有效结算，无负余额和重复位置 |
| 去重 | 重复请求、摘要冲突、提交后丢失结果 | 返回原结果，无重复发币扣款 |
| 双方交易 | 内容修改、旧版本确认、断线、容量变化 | 仅同版本双确认结算，预留正确释放 |
| 调度 | Alarm 重复、延迟、任务执行中重启 | 产出与退款唯一，任务不永久丢失 |
| 休眠/恢复 | 活跃转空闲、attachments 恢复、会话过期 | 权威状态一致，旧连接无法写 |
| 在线规则 | 三十秒保护、两小时累计、通缉暂停 | 改客户端时钟和重连不能刷新规则 |
| 租约 | 余额不足、跨多个周期、主动/到期退租 | 正确退款，家具保管，失窃物不复制 |
| 案件 | 手动假报、可信偷取、NPC 路径、原物追回 | 不任意处罚，不追回无关合法物 |
| 可见性 | 公开快照、私人事件、结果查询 | 不泄露其他玩家背包和案件 |
| 网络 | 150ms RTT、抖动、缺失游标、重复消息、慢连接 | 可恢复，界面不重复入包或永久等待 |
| 发布 | 新旧协议、schema 升级、连接重建 | 兼容或明确维护，不丢已确认结算 |
| 恢复 | 测试 Town PITR/导出恢复与投影重建 | 不变量校验报告与恢复耗时记录 |
| 图形 | 昼夜、交通、进出屋、反射、PNG、HMR | 对照现有验证流程，资源正确释放 |
| 负载 | 四人最大首版场景，随后十六人 | 固定设备与远端环境的性能/费用报告 |

故障注入点包括事务提交前、提交后发送前、外部投影写入后标记前、任务产出后通知前、租约整理中途与发布重启。对每个点断言经济和物品不变量，不只断言接口返回 200。

本地 workerd 测试验证运行时行为；远端 dev 验证地域、网络、真实休眠和计费指标。浏览器验证使用现有实际画布截图流程，真实设备性能另行采样。本文编写阶段未运行这些未来系统测试。

## 分阶段实施与改动清单

| 阶段 | 工作内容 | 验收门槛与可回退方式 |
| --- | --- | --- |
| A：Vite 与场景迁移 | 本地依赖、插件、类型检查、生命周期；搬迁现有渲染 | 场景行为与截图回归通过；尚无游戏存档，可回退前端产物 |
| B：世界数据与规则 | 稳定实体 ID、地图/碰撞、纯规则、本地请求执行器 | 不创建 Three.js 场景也能验证放置与导航；旧场景仍可演示 |
| C：最小多人 | 认证、Town 寻址、会话接管、移动同步、快照 | 两端同步、重连和休眠恢复正确；财产玩法暂关闭 |
| D：经济与持久性 | SQLite、账本、去重、购买、放置、任务与恢复 | 重复/并发/断线故障验证通过，完成恢复演练 |
| E：生产与住房 | 采伐、加工、制作、委托、交易、租约与退租 | 从工作到安家闭环，所有财产不变量通过 |
| F：风险互动 | 权限、门锁、拿取、报警、案件、NPC 追回 | 两人演示偷取和原物归还，保护及断线规则正确 |
| G：四人首版 | 完整界面、最大负载、遥测、发布和运行手册 | 策划功能验收与设备报告通过 |
| H：十六人与后续 | 区域订阅、内容扩展、必要时传输优化 | 单项验证容量与成本；跨镇功能另写设计 |

阶段按依赖推进，不承诺日历工期。各玩法采用服务端功能开关；开关关闭时客户端不能通过直接发送协议绕过。复杂度提升前完成前一阶段的故障与恢复验证。

| 现有/新增位置 | 计划变化 | 阶段 |
| --- | --- | --- |
| package.json、package-lock.json | 引入 Vite/TS/Cloudflare 插件并替换脚本 | A |
| vite.config.ts、tsconfig.*.json | 构建、环境与类型边界 | A |
| wrangler.jsonc | Worker 入口、路由、环境 bindings、DO migrations | A/C |
| scripts/build.mjs | 被 Vite 构建替代，确认后移除旧路径 | A |
| src/main.js | 逐步迁为客户端组装入口 | A/B |
| src/interaction.js | 拆分输入、导航、玩家与相机 | B/C |
| src/house.js、landscape.js、materials.js、lighting.js | 搬迁表现模块，保留视觉成果 | A/B |
| src/rendering.js、water.js、capture.js、frame-monitor.js | 统一时钟与资源销毁，验证截图和反射 | A |
| src/performance-policy.js、现有 Node 测试 | 保留刷新门控与自适应画质策略，迁为客户端渲染策略并沿用有效测试 | A |
| src/pond.js、traffic-rules.js | 二维地图/规则提入 shared，Three.js 转换留客户端 | B |
| src/server、migrations/d1 | 新增认证、Town、业务与存储 | C–F |
| tests | 规则、不变量、运行时与故障验证 | B–G |
| docs、README.md | 按实际阶段更新运行、验证、恢复资料 | 全阶段 |

本次只新增架构文档与文档入口，上表不是本次已经进行的代码变更。

## 尚需确认或实测的事项

| 事项 | 当前建议 | 何时解决 |
| --- | --- | --- |
| 登录提供方与账号恢复 | AuthProvider 单一接入，生产不接受游客自报身份 | C 前 |
| 常住小镇限制 | 首版账号固定一镇，无跨镇财产流转 | C 前确认产品体验 |
| 正式域名与玩家主要区域 | dev 延续现有域名，生产域名未指定 | 生产部署前 |
| Vite/插件/TS/测试工具版本 | 兼容稳定组合，锁定依赖 | A |
| 单镇 tick、插值与消息预算 | 10Hz 和有界 JSON 起步 | C/G |
| 参考设备与手机画质预算 | 沿用策划目标，补真实设备报告 | A/G |
| 事件与账本归档周期 | 可恢复游标与长期经济去重分开 | D/G |
| 备份恢复 RPO/RTO | 经济提交可靠，人工回滚窗口明确 | D/G |
| UI 框架、GLB/贴图压缩 | 根据界面和资产实测引入 | E/G |
| PartyServer 或二进制协议 | 连接开发成本/消息瓶颈明确后再评估 | C/H |

这些事项不阻止先实施 Vite 与客户端结构整理。认证和事务验证完成前，不把财产系统开放为正式多人功能。

## 官方研究依据

以下资料在 2026-10-05 的架构研究中查阅；实施时再次核实版本、限额和计费。本文的业务流程、协议字段、表模型和验收计划为针对本项目的设计，不是官方示例的直接实现。

| 资料 | 本方案使用的依据 |
| --- | --- |
| [Cloudflare Vite Plugin](https://developers.cloudflare.com/workers/vite-plugin/) | 前端与 Workers runtime 集成 |
| [Vite 集成教程](https://developers.cloudflare.com/workers/vite-plugin/tutorial/) | 构建输出配置、Static Assets 和服务端路由 |
| [Cloudflare Environments](https://developers.cloudflare.com/workers/vite-plugin/reference/cloudflare-environments/) | 构建时选择环境 |
| [Vite Features](https://vite.dev/guide/features.html) | TypeScript 转译与独立类型检查 |
| [Durable Objects 设计原则](https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/) | 协调单元、并发和存储边界 |
| [SQLite Storage API](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/) | 本地事务与 PITR |
| [WebSocket Hibernation](https://developers.cloudflare.com/durable-objects/best-practices/websockets/) | 连接恢复和空闲行为 |
| [对象生命周期](https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/) | 定时器、I/O 与休眠条件 |
| [Alarms](https://developers.cloudflare.com/durable-objects/api/alarms/) | 单 Alarm、至少一次执行与任务调度 |
| [D1 Database API](https://developers.cloudflare.com/d1/worker-api/d1-database/) | 批处理的事务语义 |
| [Data Location](https://developers.cloudflare.com/durable-objects/reference/data-location/) | 首次定位与地域提示 |
| [DO Limits](https://developers.cloudflare.com/durable-objects/platform/limits/) | 平台限额与单对象边界 |
| [DO Pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/) | 消息、时长及存储计费 |
| [Workers Vitest](https://developers.cloudflare.com/workers/testing/vitest-integration/) | 本地运行时测试 |
| [PartyServer](https://github.com/cloudflare/partykit/tree/main/packages/partyserver) | 候选连接层能力 |
| [Colyseus Deployment](https://docs.colyseus.io/deployment/) | 候选 Node.js 运行模式 |

## 实施前评审清单

- [ ] 已接受“小镇”为首版协调和经济事务边界，跨镇能力另行设计。
- [ ] Vite 构建、类型检查、开发环境和生成部署配置经过验证。
- [ ] 认证、一次性票据、单会话接管及旧连接拒绝有测试证据。
- [ ] 公开与私人状态分别构造，游标与重同步不会泄露或误判缺口。
- [ ] 命令去重、账本、物品唯一位置和提交后回包丢失有故障验证。
- [ ] 到期任务、休眠、重启和在线时间规则有不同且明确的恢复策略。
- [ ] 配方、地图、表结构、协议和人工恢复有版本与兼容计划。
- [ ] dev 与 production 资源隔离，存档恢复演练通过。
- [ ] 四人最大首版负载、真实设备和费用报告通过后才称首版可玩。
