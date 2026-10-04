# 多人小镇生活游戏

基于 Three.js 的小镇场景原型，以及多人生活游戏的完整策划方案。

## 项目内容

- [游戏策划](game-design.md)：职业、经济、建造、家具制作、租房、盗窃与报警等系统的设计和验收目标。
- [场景演示](index.html)：四栋房屋和十字道路，支持拖动旋转视角和滚轮缩放。

当前演示只实现三维场景展示；策划中的多人、职业、交易和存档等系统尚未实现。

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
