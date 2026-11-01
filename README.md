# Aster Vale

一款完全在浏览器中运行的原创 3D 回合制策略游戏。带领英雄探索地图、建设 13 个阵营城镇、招募 52 种阵营兵种并迎战 20 种中立生物，收集宝物与资源，在六角格战场中击败对手。无需账号或后端。

## 启动

准备支持 Vite 6 的 Node.js 与 npm，然后运行：

```bash
npm ci
npm run dev
```

打开终端显示的地址；默认开发地址为 `http://127.0.0.1:5173/vcmik3/`。本次文档验证使用 Node.js 22.14.0。

```bash
npm run docs:generate  # 从真实注册表重建中文图鉴
npm run docs:check     # 校验数量、ID 覆盖和生成文件是否最新
npm test               # 主测试套件
npm run test:modules   # 分模块测试
npm run build          # 类型检查并生成 dist/
npm run test:e2e       # 构建并运行 Chrome/WebGL 端到端测试
```

端到端测试需要 Chrome；可用 `CHROME_BIN` 指定其可执行文件。

## 中文文档

- **[完整中文文档索引](docs/README.md)**：所有图鉴与指南的入口。
- [游戏玩法](docs/guide/gameplay.md) · [界面与操作](docs/guide/controls.md)
- [13 城镇与 57 建筑](docs/generated/factions.md) · [72 兵种](docs/generated/creatures.md)
- [20 宝物](docs/generated/artifacts.md) · [19 法术](docs/generated/spells.md) · [10 资源](docs/generated/resources.md)
- [10 类地标与成对传送门](docs/generated/landmarks.md) · [20 中立模型与遭遇](docs/generated/neutrals.md)
- [自定义内容、JSON 与沙盒](docs/guide/content-editor.md)
- [安装、测试与部署](docs/guide/development.md) · [存档兼容性](docs/guide/save-compatibility.md)
- [开发会话摘要](SESSION.md)

`docs/generated/` 中的文件由 `scripts/generate-content-docs.mjs` 生成，请不要手工编辑；修改注册表后应重新生成并校验。
