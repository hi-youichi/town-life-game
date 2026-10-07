# 人物美化验证（v7）

## 实现

- `src/character.js` 替换原有胶囊角色，保留橙色外套与原有位置、碰撞和第一人称眼高。
- 新增侧分头发、眉毛、小眼睛和高光、鼻子、微笑、腮红、耳朵、袖口、口袋、拉链、背包与运动鞋。
- 腿从髋部摆动，手臂反向摆动；上半身连同头部与背包轻微起伏，停止后平滑收步。待机有呼吸和眨眼。
- 静态部件按关节及材质合并，模型共 22 个 mesh、14,848 个三角形；没有增加模型或纹理下载及后处理通道。
- `main.js` 调用角色工厂与动画更新，`interaction.js` 向角色提供步态，寻路与进出房屋流程沿用现有实现。

## 验证

- `npm run build`、三个修改模块的 `node --check` 通过，现有 `npm test` 的 5 项测试通过。
- BrowserOS neo 本地加载 `character-polish-v7`，行走状态与步态更新正常；普通帧仍仅合成一次。
- 实际点击住宅后进入第一人称，第九栋屋顶隐藏；点击返回街道后第三人称恢复、九栋屋顶全部恢复、角色停止。
- 昼夜切换与实际场景 PNG 导出通过，捕获的 error 与 unhandledrejection 均为空。
- 浏览器后台 RAF 有节流；进出住宅验收在单独 QA 页中使用受控 50 ms delta 与手动帧推进，完成后恢复原 Clock 与 RAF。该验证不代表实体手机性能测试。
- 场景画布采用 480×900 的竖向取景，但初始化是桌面模式，不据此声称已经验证 compact 模式或实体手机 FPS。

## 图片

- `references/character-polish-comparison.png`：1600×1000，直接加载游戏角色模块，原版 / 新版正面 / 新版背面模型对比。
- `references/character-polish-town-day.png`：1092×2048，游戏拍照按钮导出的白天实际场景。
- `references/character-polish-town-night.png`：1092×2048，同一取景的夜晚实际场景。
- `character-preview.html`：本地模型展示页，包含效果图下载按钮。

## dev 发布

- 已执行 `npm run deploy:dev`，发布到 `https://dev.youichi.me`。
- Cloudflare dev 版本：`bb44afdf-22cd-4839-8e57-af0d26d169d4`。
- BrowserOS neo 刷新缓存后加载 `character-polish-v7`，`ready=true`，新人物为 22 个 mesh，普通帧合成一次，页面加载错误为空。
- 线上 main、character、interaction 三个模块的 SHA256 与本地逐文件一致。

## 精细人物实装（v8）

依据 `references/character-refined-concept-v1.png` 的美术方向实现，保留橙色外套、奶油色肩带、深青裤鞋和小背包。实时模型与概念图的离线柔光、景深和微观材质表现仍有差异。

- `character-refined.js`：分层头发、柔和面部顶点腮红、手掌与四指及拇指、贴合身形的衣袖、口袋缝线、拉链牙、连贯肩带、调节扣、背包轮廓、扁平鞋型和鞋带。
- `character-materials.js`：3 组织物颜色/凹凸纹理和 1 张发丝凹凸纹理，全部在本地生成；两个角色实例共享同一组 7 张纹理。细发丝采用纹理，避免远景微小几何产生颗粒。
- 共 36 个 mesh、21,256 个三角形；各关节内静态部分按材质合并。没有增加渲染通道，普通帧仍只合成一次。
- 新增髋部摆腿和膝关节弯曲，手臂反向摆动，保持待机呼吸与眨眼；脚底最低点约为角色局部坐标 0，人物高度约 1.486。

### 验证证据

- 最终代码语法检查、构建和现有 5 项测试通过。
- `character-runtime-check.js` 在本地 QA 页验证：无非有限属性、无异常法线；手臂与腿反向摆动，膝部弯曲约 0.27 弧度，收步后 stride 小于 0.001；眨眼缩放 0.08、恢复 1；纹理实例共享。
- 点击第九栋住宅，进入第一人称且对应屋顶隐藏；返回街道后第三人称恢复，九栋屋顶全部可见。昼夜切换正常，脚本、Promise、console.error 捕获为空。
- 390×844 iframe 以真正的窄 viewport 初始化：`compact=true`、新版角色加载成功、水面倒影 384×384 / 12 Hz。夜景切换与 PNG 导出通过。
- 桌面竖向实际场景 PNG 导出后画布恢复 480×900。对比图 1600×1000，白天与夜晚均 1092×2048，文件解码通过。
- 自动化进出住宅使用受控行走 delta 与 RAF 推进；该场景的 60 FPS 指示为测试时间轴产生，不能作为实体设备性能结论。QA 原生 Clock 和 RAF 已恢复，随后页面重新加载。手机检查也不代表实体 GPU 压测。

### 图片与发布

- `references/character-refined-v8-comparison.png`：上一版与精细版正面、背面实际模型对比。
- `references/character-refined-v8-day.png`、`references/character-refined-v8-night.png`：实际游戏截图。
- `character-refined-preview.html`、`character-mobile-check.html`：本地开发预览及手机尺寸检查页，均不包含在生产构建中。
- 已发布到 `https://dev.youichi.me`，版本 `0278f3a5-5544-4e00-a6ec-944823682244`。线上 `character-refined-v8`、`ready=true`，新角色计数正确，普通帧合成一次，无页面加载错误。
- 线上 main、character、character-refined、character-materials 四个模块 SHA256 与本地逐文件一致。原始验收结果见 `character-v8-release-results.json`。

## 服饰与动作细化（v9）

- 肩带由圆管改为带厚度的扁平织带，前段沿外套曲面贴合；口袋改为贴合衣服的圆角布片，领口改为环形针织轮廓；鼻部平滑度、顶部发束和肤色进一步调整。
- 两条裤腿使用连续的蒙皮网格与髋、膝骨骼，去除分段裤腿的关节接缝。共 36 个 mesh、23,136 个三角形、2 个 SkinnedMesh，继续共享 7 张材质纹理。
- 最终代码语法、构建和现有 5 项测试通过。浏览器运行检查：非有限属性与异常法线均为 0，蒙皮权重异常为 0；膝关节弯曲产生约 0.0414 的顶点位移，角色平移误差约 2.8e-17；摆臂与腿反向，收步和眨眼正常。
- 游戏昼夜切换与截图导出通过；进入第九栋住宅时第一人称与隐藏屋顶正常，返回后恢复第三人称与全部屋顶。QA 捕获 error、Promise 和 console.error 为空。
- 390×844 浏览器 viewport 实际初始化 `compact=true`，加载 v9、36 个 mesh 和 2 个蒙皮网格；昼夜按钮和截图导出正常。该检查不代表实体手机 GPU 性能测试；本地交互 QA 使用受控 Clock 与 RAF，未将其 60 FPS 读数视为设备性能。
- 图片：`references/character-refined-v9-comparison.png`（1600×1000）；`character-refined-v9-day.png` 与 `character-refined-v9-night.png`（1092×2048）；`character-refined-v9-mobile-night.png`（946×2048）。均由实际代码渲染并通过文件解码检查。
- 已发布 `https://dev.youichi.me`，版本 `7c59daa2-186b-4bdf-8152-629f11025166`。线上 `character-refined-v9`、`ready=true`、普通帧合成一次，四个人物相关模块 SHA256 与本地一致。原始结果见 `character-v9-release-results.json`。
