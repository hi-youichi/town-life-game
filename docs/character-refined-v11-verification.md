# v11 人物精修记录

已发布到 https://dev.youichi.me ，部署版本：966a717f-25a4-4907-9e01-60a8b76c2496。

调整后脑发束与头发纹理、柔和腮红、衣袖褶皱和鞋带。三种造型均保留两组裤腿骨骼蒙皮，共享纹理。

| 造型 | v10 网格数 → v11 | v10 三角形 → v11 |
| --- | --- | --- |
| A 圆润治愈 | 37 → 35 | 23336 → 26032 |
| B 清爽冒险 | 42 → 40 | 28688 → 31384 |
| C 精致潮流 | 36 → 34 | 23924 → 26620 |

验证：构建成功，现有 5 项测试通过；三种人物几何与蒙皮检查通过；移动中换装保持位置；行走、进出房屋和昼夜切换通过；390×844 手机布局可换装。线上三种造型均为 refined-v11，验证切换期间未捕获错误。受控时钟动画检查不代表真实设备帧率。

效果图保存在项目 docs/references：
- character-refined-v11-actual.png：1800×1200，三种人物的正面、侧面、背面。
- character-refined-v11-comparison.png：1800×1100，细节前后对比。
- character-refined-v11-day.png、character-refined-v11-night.png：游戏内日夜效果。

原始验证数据：character-refined-v11-local-checks.json；线上与手机验证：character-refined-v11-release-results.json。
