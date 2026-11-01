<!-- 由 scripts/generate-content-docs.mjs 生成，请勿手工编辑。 -->
# Aster Vale 中文文档

> 数据来源：`src/game/`、`src/town/registry.ts`、`src/battle/`、`src/adventure/`、`src/editor/`。运行 `npm run docs:generate` 重新生成，运行 `npm run docs:check` 校验。

欢迎来到完整中文手册。玩法与操作指南为人工维护；下列注册表图鉴由生成器直接读取当前游戏数据，避免漏项或数值漂移。

## 玩法与开发指南

- [游戏玩法与回合流程](./guide/gameplay.md)
- [冒险、3D 城镇与战斗操作](./guide/controls.md)
- [自定义 ContentEditor、JSON 导入导出与沙盒](./guide/content-editor.md)
- [安装、测试、构建与部署](./guide/development.md)
- [存档位置、校验、迁移与兼容性](./guide/save-compatibility.md)
- [开发会话摘要（目标、架构、演进、审查与验证）](../SESSION.md)

## 数据图鉴

| 内容 | 当前数量 | 文档 |
| --- | --- | --- |
| 阵营 / 城镇 | 13 | [阵营、城镇与建筑链](./generated/factions.md) |
| 建筑（含 5 种共同建筑） | 57 | [建筑链](./generated/factions.md) |
| 兵种（52 阵营 + 20 中立） | 72 | [兵种总图鉴](./generated/creatures.md) |
| 宝物 | 20 | [宝物图鉴](./generated/artifacts.md) |
| 法术 | 19 | [法术图鉴](./generated/spells.md) |
| 资源 | 10 | [资源图鉴](./generated/resources.md) |
| 地标类型 / 默认对象 | 10 / 11 | [地标与传送门](./generated/landmarks.md) |
| 中立模型 / 中立主题遭遇 | 20 / 10 | [中立模型与遭遇](./generated/neutrals.md) |

## 可重复校验

```bash
npm ci
npm run docs:generate
npm run docs:check
```

生成器会加载真实注册表并创建默认地图与中立模型，断言上述数量、ID 集合和建筑模型集合一致。`docs:check` 在内存中重新生成全部图鉴，逐字比较提交文件，并检查每页的注册 ID 覆盖块；缺少、额外或过期内容都会失败，不会改写文件。它还会检查 SESSION.md 的必需章节、验证命令、README 链接、篇幅及常见敏感信息模式。
