# v12：按 AI 设计图改进人物

## 设计目标与实装

使用内置 image_gen，以 v11 实际三视图为参考，生成更精细的三套人物设计。保留服装、背包、配色和造型身份，重点改善眼神、发束、手型与衣物结构。完整提示词：[character-refined-v12-concept-prompt.txt](references/character-refined-v12-concept-prompt.txt)。

[AI 设计图](references/character-refined-v12-concept.png)为设计参考；[实际三视图](references/character-refined-v12-actual.png)直接加载游戏人物代码，分别展示三套人物的正面、侧面、背面。AI 图的雕刻细节与离线光照不等同于当前游戏实装。

实装调整：

- 眼睛加入眼白、棕色虹膜、瞳孔、眼睑与高光，眨眼组以眼睛中心为轴缩放。
- 收窄下颌，柔化鼻子与微笑线，调整腮红、皮肤和头发粗糙度。
- 橙衣人物的椭球刘海改为连续流线发束；三套人物后部发束增加层次。
- 缩短手指并使其与手掌重叠，调整拇指的弯曲和连接。
- 调整肩部连接、袖子连续褶皱，增加衣物缝线、拉链扣和背包开口拉链。

## 验证

- 三套模型：所有几何属性有限，法线和蒙皮权重有效；每套仍为两组裤腿蒙皮。膝部变形、骨骼平移、摆臂、停止收步与眨眼检查通过。
- 三套模型共享 7 张纹理，切换时外层人物组保持位置、朝向和运动状态。
- 游戏内：移动中 B → A 切换保持位置，最终抵达街道；B 进屋、返回街道后屋顶状态恢复；日夜切换与截图通过。
- 390×844 iframe：启用 compact 布局，B/C 切换、保存选择、收起选择器与夜间切换通过。
- 现有 npm test 的 5 项渲染策略测试通过，npm run build 与 JavaScript 语法检查通过。
- dev 线上三套人物均为 refined-v12，选择可保存，切换期间未捕获错误；7 项线上入口/模块 SHA-256 与本地对应文件一致。

| 造型 | v11 网格 → v12 | v11 三角形 → v12 |
| --- | --- | --- |
| A | 35 → 39 | 26032 → 34104 |
| B | 40 → 44 | 31384 → 40320 |
| C | 34 → 38 | 26620 → 35368 |

新增眼睛材质增加 4 个网格批次；几何数量有所增加。运行时回归使用受控时钟与 RAF，截图中帧率读数不代表真实设备性能。本轮没有进行独立硬件 FPS 基准测试。

原始数据：[本地检查](character-refined-v12-local-checks.json)、[线上检查](character-refined-v12-release-results.json)。预览页与验证脚本位于 docs，不随 dist 发布。

## 项目产物

| 文件 | 尺寸 | 内容 |
| --- | --- | --- |
| [concept.png](references/character-refined-v12-concept.png) | 1536×1024 | 内置 image_gen 生成的设计参考 |
| [actual.png](references/character-refined-v12-actual.png) | 1800×1200 | 实际模型三套九视图 |
| [comparison.png](references/character-refined-v12-comparison.png) | 1800×1100 | 同镜头、同光照的 v11/v12 细节对比 |
| [day.png](references/character-refined-v12-day.png) | 2048×1216 | 游戏内日间截图 |
| [night.png](references/character-refined-v12-night.png) | 2048×1216 | 游戏内夜间截图 |

所有 PNG 已校验可解码。旧版几何与材质副本位于 references/character-v11.js、character-materials-v11.js，供对比页加载。

## 发布

地址：https://dev.youichi.me

部署版本：6e71a606-8287-4186-9a78-b7826fbb4de0。
