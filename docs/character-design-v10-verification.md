# 三套人物设计实装（v10）

参考图：`references/character-design-directions-v1.png`。三套为实时几何模型，服饰、发型和比例分别实现；概念图中的离线柔光、发丝和布料微观细节仍比实时游戏更丰富。

| 方向 | 实装特征 | Mesh | 三角形 |
| --- | --- | --- | --- |
| A 圆润治愈 | 大头短身、橙色拉链外套、奶油色织带、圆形青绿背包、青色运动鞋 | 37 | 23,336 |
| B 清爽冒险 | 较长腿、蓬松尖端发束、绿色连帽外套和抽绳、带翻盖的外套口袋、腿侧工装袋、方形黄色背包、橙色鞋 | 42 | 28,688 |
| C 精致潮流 | 较小头部、较窄长身、中分层次头发、奶油色开襟衬衫、青绿翻领及胸袋、橙色内搭及背包、卷边裤脚、白鞋 | 36 | 23,924 |

## 游戏行为

左下角“人物”入口打开三个可选造型，当前项使用 `aria-pressed` 标记。按钮点击后关闭菜单并恢复焦点，Escape 与外部点击均可关闭。选择保存到 localStorage；存储不可用时仍可切换。

人物外层 walker 始终为同一个对象，只替换内部模型；路线、朝向、位置和室内可见性保持。三个模型按需创建并缓存，场景树中只挂载当前模型。三个材质组共享同一组 7 张纹理，保持两个蒙皮裤腿、膝关节弯曲、反向摆臂、眨眼和待机呼吸。

## 验证

- 最终源码语法检查、构建、现有 5 项性能策略回归通过。
- 三套模型均无非有限顶点/属性、无异常法线、无异常蒙皮权重；最低点约为 0，高度分别约 1.512、1.568、1.600。
- 角色平移后的蒙皮顶点误差小于 1e-5；膝弯曲位移分别约 0.0414、0.0403、0.0259。反向摆臂、收步、眨眼均通过。B 的实际连帽几何记录存在，工装袋附着髋骨。
- 单独 roster 多次切换后仍只有一个当前模型，人物位置、朝向、可见性及 moving 状态保持，纹理资源跨角色共享。
- 实际游戏中 B 行走时切换 C，切换前后位置一致、walking 为 true，继续到达原目标。
- C 进入第九栋房屋后隐藏对应屋顶，室内切换 A 后仍为第一人称；返回街道后九栋屋顶可见、第三人称恢复。
- 昼夜切换及 PNG 截图成功。QA error、Promise rejection 和 console.error 捕获为空；普通帧合成一次。
- 390×844 iframe 以窄 viewport 初始化，`compact=true`。C 已选状态从存储恢复；手机选择 B 后重新加载仍显示 B。320×844 窄屏下菜单范围 x=12..256、y=516..768，完整位于 viewport 内。
- 本地路线验收使用受控 Clock 与 RAF，完成后均已恢复，不将合成时间轴的 60 FPS 视为设备性能。手机检查是浏览器尺寸检查，未对实体手机 GPU 做压测。

原始证据：`character-design-v10-local-checks.json`、`character-design-v10-release-results.json`。最后将 B/C 背包提手降低至包体顶部，消除侧面悬空；人物几何、骨骼、动画和共享资源再次全量复验，结果见 `character-design-v10-final-results.json`。选择器、roster 和交互代码在该修正中未变。复验入口为 `character-design-check.js`，在游戏页加载；仅开发验收，不包含在 dist 中。

## 图片与发布

- `references/character-design-v10-actual.png`：1800×1200，三套实际模型的正、侧、背面。
- `references/character-design-v10-cozy-day.png`、`character-design-v10-urban-day.png`、`character-design-v10-urban-night.png`：1092×2048，游戏拍照导出。
- `references/character-design-v10-adventure-mobile.png`：946×2048，compact 模式实际游戏截图。
- `character-design-v10-preview.html`：本地实际模型展示页；`character-design-mobile.html`：手机尺寸验收页。
- dev 最终发布到 `https://dev.youichi.me`，Cloudflare 版本 `7b3f9163-7ad7-4f68-bc8a-b4416a640f12`。首轮功能验收版本为 `cde1a13a-deff-4878-bd47-0e056146a133`。
- 线上版本 `character-design-v10`，三个按钮切换模型、选中项和保存值一致；C 选择后重载仍为 C，普通帧合成一次。线上 index、main、character、character-refined、character-materials、character-styles、character-picker 七个文件的 SHA256 与本地逐一一致。
