# 自定义 ContentEditor、JSON 导入导出与沙盒

## 工作区与保存

从开始界面或冒险界面的 **Content editor** 打开工作区。有待结算战斗时不能打开；打开期间战役移动、建设、回合和保存等命令暂停，关闭后恢复。

编辑器分为 Creatures 与 Artifacts 两类，支持新建、选择、编辑、删除和实时预览。**修改表单不会立刻写入注册表**；必须提交并通过全部验证。切换条目、类型或导入前，未保存草稿会要求确认是否丢弃。

已保存内容写入当前浏览器 `localStorage` 的 `h3content.custom-registry.v1`。它没有云端同步；清除站点数据会删除内容。Reset custom content 会永久删除此浏览器中的全部自定义兵种和宝物，操作前应先导出。

内置 72 兵种和 20 宝物不会被编辑器修改或删除。自定义兵种使用程序化的 `custom-humanoid` 模型，按阵营、阶级、攻防与能力显示颜色、武器、翅膀、盾牌等特征；当前不支持导入外部 3D 模型文件。

## 字段与验证限制

### 兵种

| 字段 | 规则 |
| --- | --- |
| `id` | 最长 64；字母开头，后续仅字母、数字、`-`、`_`；与内置或其他自定义兵种/宝物均不能重复 |
| `name` | 非空，最长 80 |
| `faction` | 13 个内置阵营的英文注册名之一，或 `Neutral` |
| `tier` | 整数 1–4 |
| `attack` / `defense` | 整数 0–999 |
| `damage` | 两项整数 0–999999；最小值不大于最大值，最大值至少 1 |
| `health` | 整数 1–999999 |
| `speed` | 整数 1–99 |
| `shots` | 整数 0–999；有 `ranged` 时至少 1 |
| `growth` | 整数 0–999 |
| `cost` | 10 种资源各自为整数 0–1000000；0 不保留在规范化结果中 |
| `abilities` | `ranged`、`flying`、`retaliation`、`doubleStrike`、`regeneration`、`spellResistance`，不得重复 |

### 宝物

- `id`、`name` 与兵种采用相同长度和唯一性规则。
- `description` 为非空字符串，最长 240。
- `slot` 为 `weapon`、`armor`、`helmet`、`boots`、`trinket` 之一。
- `rarity` 为 `common`、`rare`、`epic`、`legendary` 之一。
- `bonuses` 仅允许 `attack`、`defense`、`spellPower`、`knowledge`，各为整数 0–99，至少一项大于 0。

未知字段、非安全整数、原型污染相关键（如 `__proto__`）都会被拒绝。错误按字段路径列出，验证失败不会保存当前条目。

## 导出 JSON

**Export JSON** 只导出已保存条目，不包含未提交草稿。可复制文本或下载 `h3custom-content-v1.json`。顶层结构如下：

```json
{
  "format": "h3content-editor",
  "version": 1,
  "creatures": [],
  "artifacts": []
}
```

`creatures` 和 `artifacts` 分别包含上述完整定义。导出适合备份、分享或在另一个浏览器中导入；它不是战役存档。

## 导入 JSON

1. 选择 **Import JSON**，粘贴完整注册表文本。
2. 选择导入方式：
   - **Merge; reject duplicate IDs**：保留现有注册表并追加导入项，任何重复 ID 都使整次导入失败。
   - **Replace the entire custom registry**：用导入注册表替换全部自定义内容。
3. 选择 **Validate and import**。

格式必须为 `h3content-editor`，版本必须为 1，文本最多 **5,000,000 字符**。系统先验证整个文档及合并/替换后的 ID 唯一性，再一次性提交；任何 JSON、字段、范围或重复错误都会使导入完全不生效，不会留下部分条目。替换模式也应先导出备份。

## 隔离沙盒战斗

工作区顶部可选择**一个自定义兵种**和**可选的自定义宝物**，然后启动真实战术沙盒：

- 攻方有 12 个所选自定义兵种；守方是 12 个民兵。
- 攻方基础攻击/防御/法术力量/知识为 2/2/2/4，所选宝物直接叠加到这些属性；守方为 1/1/1/4。
- 双方使用默认完整魔法书，初始法力按知识计算；战斗采用正常移动、攻击、AI、法术和模型渲染规则。
- 奖励为 0。结果显示后返回编辑器，**不会改变战役军队、资源、待结算战斗或本地战役存档**。

没有自定义兵种时不能启动沙盒。选择 **Leave sandbox** 可提前退出并返回工作区。
