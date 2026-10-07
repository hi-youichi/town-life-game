# 多人小镇生活游戏

基于 Three.js 的小镇场景原型，以及多人生活游戏的完整策划方案。

## 项目内容

- [游戏策划](game-design.md)：职业、经济、建造、家具制作、租房、盗窃与报警等系统的设计和验收目标。
- [架构升级方案](docs/architecture.md)：Vite 与 Cloudflare 多人架构、通信协议、财产事务、持久存档、部署迁移及分阶段验收；当前为待实施设计。
- [性能架构升级方案](docs/performance-architecture.md)：静态与动态光照分离、街区分块与 LOD、房屋实例化、模拟解耦、导航缓存，以及真实设备测量和分阶段验收；当前为待实施设计。
- [场景演示](index.html)：九栋放大的房屋、街区网格道路、循环行驶的车辆、路灯、街边树木、树林和湖泊；可点击道路行走、进屋切换第一人称，并在全屏画布中浏览场景。

当前演示只实现三维场景展示；策划中的多人、职业、交易和存档等系统尚未实现。

画面左上角显示 FPS 和平均帧间隔，每半秒更新一次。统计以主动画循环为准，切换页面前后台时重新采样；`ms` 是平均帧间隔，不是 GPU 渲染耗时。

第三人称视角的旋转和缩放以人物身体为中心，人物行走时镜头同步跟随。

## 本地运行

在项目目录启动静态文件服务，例如安装了 Python 3 时运行：

```sh
python3 -m http.server 8000
```

浏览器访问 <http://localhost:8000>。演示通过 CDN 加载 Three.js，需要网络连接以及支持 WebGL 的浏览器。

## Cloudflare 部署

使用 Cloudflare Workers 托管静态场景。在项目目录运行：

```sh
npm ci
npx wrangler login
npm run deploy
```

`npm run build` 将场景页面复制到 `dist/`，部署只上传该目录。`npm run dev` 可以启动 Cloudflare 本地预览。

开发环境部署到 <https://dev.youichi.me>：

```sh
npm run deploy:dev
```

该子域名由 Cloudflare Workers Custom Domain 管理；首次部署需要 `youichi.me` 已添加到当前 Cloudflare 账号的活动 Zone，且该主机名没有现存的 CNAME 记录。

## 场景美术与截图

场景参照 `docs/references/town-beautified-v2.png`：四坡陶瓦屋顶、屋脊、檐口和雨水管，奶油色墙面、门板、窗框与花箱，四边人行道、庭院灌木和小花，湖岸石块、芦苇、睡莲和动态涟漪。瓦缝由 Canvas 生成共享纹理，无需外部贴图素材。

暖色日光、半球光、软阴影、距离雾和地面接触阴影配合使用。静态建筑按材质合并；树木、花草、铺装和车轮批量绘制。手机默认像素比上限 1.5，桌面上限 2；使用 2048 VSM 阴影贴图；夜间同时启用距离角色最近的 4/8 个路灯光源。实际帧率依赖设备，以上是渲染配置而非性能保证。

所有住宅入口朝向相邻的 +Z 街道。屋面、屋脊和檐口统一属于 `house-roof` 分组，进屋隐藏、出屋恢复；花草和花箱不参与房屋点击判定。

右下角相机按钮将当前视角导出为 PNG，保留画幅比例，最长边最多 2048 像素。截图仅包含三维画布，不含网页按钮、手机状态栏或浏览器工具栏。昼夜和室内视角均可使用。

## 代码结构

- `src/main.js`：场景组装、车辆和统一动画循环。
- `src/house.js`：房屋模型与静态几何合并。
- `src/landscape.js`：树木、庭院、道路铺装与湖岸装饰。
- `src/materials.js`：材质与程序化瓦纹。
- `src/lighting.js`：渲染档位与昼夜光照。
- `src/interaction.js`：寻路、进出房屋与相机切换。
- `src/capture.js`：当前画布的 PNG 导出。
- `src/rendering.js`：MSAA、SSAO 接触阴影与输出色彩处理。
- `src/water.js`：湖面反射相机、波纹扰动与昼夜水色。
- `src/pond.js`：共享的湖面轮廓与宽窄变化的沙岸。
- `src/performance-policy.js`：刷新限频与自适应画质策略。

`npm run build` 复制 `index.html` 和 `src/` 到 `dist/`，参考效果图不上传到静态部署。

## 交通信号灯

16 个路口均配有红黄绿灯和停止线，东西与南北方向交替通行：绿灯 8 秒、黄灯 2 秒、全红 1 秒。车辆在红灯和黄灯时停在停止线前，已进入路口的车辆继续驶出；停车时车轮停止转动。信号灯在昼夜模式下均可见，灯具采用实例化批量绘制。

`src/traffic-signals.js` 负责灯具和停止线，`src/traffic-rules.js` 负责灯相与车辆停车规则。

## 参考图还原修订

针对初版还原不足，增加侧墙窗户、放大并丰富庭院灌木、补充庭院松树与草叶，缩窄墙体以保留更明显的屋檐和花园空间；人行道改为带厚度的圆角环。湖面使用平面反射相机、流动波纹与浅深水色过渡，湖岸扩大且同步修订避让范围，取景外地面延伸并增加背景树木。

墙面与窗玻璃使用程序化明暗纹理，VSM 提供柔和投影，SSAO 增加屋檐、窗框与墙脚的遮蔽层次。手机使用 16 个 AO 样本与 60% 的 AO 分辨率；桌面 24 个样本与 80% 分辨率。截图导出使用相同渲染管线，随后恢复画布与后处理尺寸。参考是风格与布局目标，实时场景仍需通过同视角截图持续对照。

## 第四版画面精修

湖面加入真实树木与建筑倒影，反射图进行轻微模糊和波纹扰动，并随视角与昼夜更新。手机反射分辨率为 384，桌面为 512；第六版更新为移动和静止均限频 12/18 Hz，尺寸、主题和镜头大幅跳转时立即刷新。AO 法线阶段复用反射结果，防止法线图污染倒影。实时截图见 `docs/references/town-render-v4.png`。

日光强度从 3.1 调至 2.65，半球光从 1.25 调至 1.5，VSM 模糊半径从 3 调至 5，以降低墙面反差、柔化投影。每个窗台花箱增加到五朵错落的小花，并补充叶团；路灯增加灯帽和底座，金属部件合并绘制。

## 第五版：六项美术改进

1. 植被：加宽三层松树树冠，背景混入分叉树干和多面体圆冠树；庭院植物使用固定的高低、位置变化，每个花簇含三朵错落小花。仍使用实例化批次，不逐株增加绘制调用。
2. 屋顶：共享瓦纹升级为 512×512，单张纹理由 8 行大砖改为 16 行较细陶瓦，减弱接缝、增加轻微釉面色差，凸凹强度降至 0.018，屋脊半径增至 0.085。
3. 建筑：前墙与侧墙真正留出窗洞，玻璃退入墙体，补充窗洞侧壁、加深窗沿；木门加入程序化木纹与金属锁板，入口增加门槛和铺石接缝。
4. 配色：草地改为较亮的黄绿，屋顶改为较柔和的陶土色，道路采用中性灰，保留奶油色墙面和昼夜切换。
5. 湖岸：沙岸沿水面曲线生成，宽度随位置变化；石块部分埋入地面并旋转，四组芦苇增加草叶，八片睡莲按大小成组分布。
6. 街道：信号灯灯头、灯杆与发光圆片缩小；路灯灯杆减细、金属颜色变柔和；道路虚线和停止线变细并降低对比度。16 个路口的灯相和停车规则继续保留。

实际画布截图：`docs/references/town-render-v5.png`。本次没有增加后处理通道，材质纹理均由 Canvas 生成，无需下载外部贴图。

## 第六版：行走性能优化

所有普通绘制统一到主 RAF，包括角色跟随、旋转、缩放、主题与尺寸改变；截图允许主动绘制和尺寸恢复。诊断中的 `rendersThisFrame` 应保持 1，`rendering.renders` 是包含截图的完整合成次数。

移动与静止时，湖面倒影都最多以手机 12 Hz / 桌面 18 Hz 刷新。波纹时间仍随每帧更新；昼夜、截图、尺寸以及相机位置超过 8 单位或角度超过 60° 的跳转立即刷新。AO 法线阶段不会刷新反射纹理。动态阴影最多 30 Hz 更新；开关门、屋顶显隐、主题、尺寸和截图立即刷新。

自适应画质首先降低 AO 分辨率，随后降低渲染比例，建筑、植物与瓦片保持原模型和纹理：

| 档位 | 手机 AO 比例 | 桌面 AO 比例 | 原像素比倍率 |
| --- | --- | --- | --- |
| high | 0.60 | 0.80 | 1.00 |
| ao-balanced | 0.45 | 0.60 | 1.00 |
| balanced | 0.40 | 0.50 | 0.85 |
| performance | 0.35 | 0.45 | 0.72 |

按一秒窗口统计有效帧间隔，连续两个窗口平均超过 20 ms 才降档，两次降档至少间隔 3 秒；平均低于 17.5 ms 持续八个窗口后才逐档恢复。后台、超过 80 ms 的长间隔、截图与页面可见性变化不会积累降档样本。截图使用最高 AO 档位、最长边 2048，随后恢复当前自适应画质。

`getSceneDiagnostics()` 包含合成次数、阴影更新次数、倒影更新次数、当前画质和像素比。`lastSubmitMs` 是 CPU 发出渲染命令的耗时，不能代替 GPU 耗时或 FPS。策略回归检查运行 `npm test`，验证记录见 `docs/performance-verification.md`。

## 第十版：三套人物设计

根据 `docs/references/character-design-directions-v1.png` 实装 A 圆润治愈、B 清爽冒险、C 精致潮流：分别实现圆形背包与橙色外套、连帽外套与工装裤、中分头发与翻领开襟衬衫。左下角“人物”按钮可随时切换，选择会在本地保存；移动路线和进出房屋状态保持。

造型与配色配置在 `src/character-styles.js`，几何实现位于 `src/character-refined.js`，材质共享 7 张本地生成的纹理。场景中只挂载当前模型，三套各有两个蒙皮裤腿，保留膝部弯曲、摆臂、呼吸和眨眼。实际三视图：`docs/references/character-design-v10-actual.png`；验证证据：`docs/character-design-v10-verification.md`。

## 第十一版：人物细节精修

细化后脑发束、头发纹理与腮红，调整衣袖褶皱，并让鞋带贴合鞋面。三种人物的正面、侧面、背面已保存为[多方向效果图](docs/references/character-refined-v11-actual.png)，另有[细节对比图](docs/references/character-refined-v11-comparison.png)、[日间效果](docs/references/character-refined-v11-day.png)和[夜间效果](docs/references/character-refined-v11-night.png)。开发版已发布，检查范围与结果见[验证记录](docs/character-refined-v11-verification.md)。

## 第十二版：AI 设计参考与人物改进

参考[AI 设计图](docs/references/character-refined-v12-concept.png)，实装虹膜、眼睑、流线发束、自然手型、连续衣袖褶皱和缝线。查看[实际多方向效果图](docs/references/character-refined-v12-actual.png)、[修改前后对比](docs/references/character-refined-v12-comparison.png)及[验证记录](docs/character-refined-v12-verification.md)。设计图的完整提示词保存在同目录的 character-refined-v12-concept-prompt.txt；dev 已更新到 refined-v12。

## 第十三版：头身比例与裤腿

调整三套人物的头身比例，增加裤腿的局部斜向折痕与随膝部弯曲的侧缝。dev 已更新到 refined-v13。查看[实际多方向效果图](docs/references/character-refined-v13-actual.png)、[v12/v13 比例对比](docs/references/character-refined-v13-comparison.png)和[验证记录](docs/character-refined-v13-verification.md)。
