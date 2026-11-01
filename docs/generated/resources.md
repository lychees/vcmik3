<!-- 由 scripts/generate-content-docs.mjs 生成，请勿手工编辑。 -->
# 资源图鉴与获取途径（10 种）

> 数据来源：`src/game/resources.ts`、`src/game/content.ts`、`src/game/map.ts`、`src/game/GameStore.ts`。运行 `npm run docs:generate` 重新生成，运行 `npm run docs:check` 校验。

资源由玩家阵营共享，当前共 **10 种**。下列初始数量、建筑/招募用途、固定拾取、矿点日产和怪物奖励均从当前注册表与默认种子 `h3core-default` 派生。

| ID | 资源 | 初始库存 | 主要用途 |
| --- | --- | --- | --- |
| `gold` | 金币<br>gold | 6,000 | 通用货币，用于全部建筑、全部阵营兵种招募以及商人交易。 |
| `wood` | 木材<br>wood | 25 | 基础建材，广泛用于市政与军事建筑；部分中立兵种也需要。 |
| `ore` | 矿石<br>ore | 25 | 基础建材，用于城防、高级建筑和工厂兵种。 |
| `crystal` | 水晶<br>crystal | 8 | 稀有建材，用于高阶建筑以及部分高阶兵种。 |
| `gems` | 宝石<br>gems | 8 | 稀有魔法材料，用于塔楼、元素等阵营建筑和远程施法兵种。 |
| `mercury` | 水银<br>mercury | 8 | 稀有炼金材料，用于沼泽、墓园、港湾等建筑与兵种。 |
| `sulfur` | 硫磺<br>sulfur | 8 | 稀有炼金材料，用于炼狱、地下城等建筑与兵种。 |
| `mithril` | 秘银<br>mithril | 4 | 轻而坚韧的银蓝金属；当前用于国会建设。 |
| `obsidian` | 黑曜石<br>obsidian | 4 | 具有锋利边缘与防护附魔价值的火山玻璃；当前用于国会建设。 |
| `essence` | 魔法精粹<br>essence | 4 | 凝聚的魔法能量；当前用于法师公会建设。 |

## 金币 gold（`gold`）

通用货币，用于全部建筑、全部阵营兵种招募以及商人交易。

- **消耗**：建筑——57 种建筑（完整费用见对应图鉴）；招募——72 种兵种（完整费用见对应图鉴）。商人帐篷每次交易另需 500 金币。
- **新游戏库存**：6,000。
- **地图拾取**：Abandoned Purse `gold-west`，(6, 25)，750 金币；Merchant Strongbox `gold-east`，(59, 25)，750 金币。
- **矿点**：Old Gold Mine `gold-north`，(33, 4)，占领后每日 +1000。
- **建筑日产**：市政厅每日 +500；国会每日 +1000；市场每日 +250。
- **战斗奖励**：23 个固定怪物遭遇提供该资源，数量为 路边盗匪 400、远古巨龙 2000、灰烬先锋 900、沼泽统领 900、奥术哨兵 900、利齿潮汐 900、蛮荒兽群 750、沙丘亡者 750、棘木守卫 750、冰封巢群 900、炼狱猎杀 900、王冠鳞群 900、地穴虫群 650、帷幕宫廷 850、Tower Warband 900、Necropolis Warband 900、Dungeon Warband 900、Stronghold Warband 900、Conflux Warband 900、Cove Warband 900、Factory Warband 900、Bulwark Warband 900、Courtyard Warband 900；只有获胜方取得奖励，平局没有奖励。

## 木材 wood（`wood`）

基础建材，广泛用于市政与军事建筑；部分中立兵种也需要。

- **消耗**：建筑——52 种建筑（完整费用见对应图鉴）；招募——远古树人 `ent`。
- **新游戏库存**：25。
- **地图拾取**：Timber Cache `wood-west`，(12, 25)，8 木材。
- **矿点**：West Sawmill `sawmill-west`，(7, 29)，占领后每日 +2。
- **商人帐篷**：每位英雄每天可支付 500 金币，换取 1 木材与 1 矿石。
- **战斗奖励**：1 个固定怪物遭遇提供该资源，数量为 棘木守卫 4；只有获胜方取得奖励，平局没有奖励。

## 矿石 ore（`ore`）

基础建材，用于城防、高级建筑和工厂兵种。

- **消耗**：建筑——31 种建筑（完整费用见对应图鉴）；招募——黄铜自动机 `automaton`、钢铁无畏机 `dreadnought`、攻城毁灭者 `juggernaut`、符文魔像 `golem`。
- **新游戏库存**：25。
- **地图拾取**：Ore Cache `ore-cache-east`，(53, 25)，8 矿石。
- **矿点**：East Ore Pit `ore-east`，(58, 21)，占领后每日 +2。
- **商人帐篷**：每位英雄每天可支付 500 金币，换取 1 木材与 1 矿石。
- **战斗奖励**：默认固定怪物遭遇不提供该资源。

## 水晶 crystal（`crystal`）

稀有建材，用于高阶建筑以及部分高阶兵种。

- **消耗**：建筑——9 种建筑（完整费用见对应图鉴）；招募——8 种兵种（完整费用见对应图鉴）。
- **新游戏库存**：8。
- **地图拾取**：Crystal Shards `crystal-north`，(33, 6)，3 水晶。
- **矿点**：Crystal Cavern `crystal-south`，(37, 45)，占领后每日 +1。
- **战斗奖励**：5 个固定怪物遭遇提供该资源，数量为 远古巨龙 4、冰封巢群 2、王冠鳞群 2、Stronghold Warband 2、Bulwark Warband 2；只有获胜方取得奖励，平局没有奖励。

## 宝石 gems（`gems`）

稀有魔法材料，用于塔楼、元素等阵营建筑和远程施法兵种。

- **消耗**：建筑——8 种建筑（完整费用见对应图鉴）；招募——8 种兵种（完整费用见对应图鉴）。
- **新游戏库存**：8。
- **地图拾取**：默认地图没有该资源的独立拾取对象。
- **矿点**：默认地图没有对应矿点。
- **战斗奖励**：6 个固定怪物遭遇提供该资源，数量为 野生小精灵 2、奥术哨兵 2、帷幕宫廷 1、Tower Warband 2、Conflux Warband 2、Courtyard Warband 2；只有获胜方取得奖励，平局没有奖励。

## 水银 mercury（`mercury`）

稀有炼金材料，用于沼泽、墓园、港湾等建筑与兵种。

- **消耗**：建筑——11 种建筑（完整费用见对应图鉴）；招募——11 种兵种（完整费用见对应图鉴）。
- **新游戏库存**：8。
- **地图拾取**：默认地图没有该资源的独立拾取对象。
- **矿点**：Quicksilver Bog `mercury-south`，(54, 45)，占领后每日 +1。
- **战斗奖励**：4 个固定怪物遭遇提供该资源，数量为 沼泽统领 2、利齿潮汐 2、Necropolis Warband 2、Cove Warband 2；只有获胜方取得奖励，平局没有奖励。

## 硫磺 sulfur（`sulfur`）

稀有炼金材料，用于炼狱、地下城等建筑与兵种。

- **消耗**：建筑——地狱犬舍 `hellhoundKennels`、火巨灵高塔 `ifritSpire`、深渊恶魔裂隙 `pitFiendAbyss`、牛头人迷宫 `minotaurLabyrinth`、红龙洞窟 `redDragonCavern`；招募——火巨灵 `ifrit`、深渊恶魔 `pitFiend`、洞窟红龙 `redDragon`、战斗食人魔 `ogre`、三头地狱犬 `cerberus`、巴洛炎魔 `balor`。
- **新游戏库存**：8。
- **地图拾取**：默认地图没有该资源的独立拾取对象。
- **矿点**：Brimstone Vent `sulfur-north`，(11, 4)，占领后每日 +1。
- **战斗奖励**：5 个固定怪物遭遇提供该资源，数量为 灰烬先锋 2、沙丘亡者 1、炼狱猎杀 2、Dungeon Warband 2、Factory Warband 2；只有获胜方取得奖励，平局没有奖励。

## 秘银 mithril（`mithril`）

轻而坚韧的银蓝金属；当前用于国会建设。

- **消耗**：建筑——国会 `capitol`；招募——无。
- **新游戏库存**：4。
- **地图拾取**：Mithril Cache `mithril-cache`，(8, 19)，2 秘银。种子相关缓存的注册范围为 2–4；上列数量是默认种子的实际结果。
- **矿点**：Mithril Mine `mithril-mine`，(10, 31)，占领后每日 +1。
- **战斗奖励**：默认固定怪物遭遇不提供该资源。

## 黑曜石 obsidian（`obsidian`）

具有锋利边缘与防护附魔价值的火山玻璃；当前用于国会建设。

- **消耗**：建筑——国会 `capitol`；招募——无。
- **新游戏库存**：4。
- **地图拾取**：Obsidian Cache `obsidian-cache`，(26, 31)，3 黑曜石。种子相关缓存的注册范围为 2–3；上列数量是默认种子的实际结果。
- **矿点**：Obsidian Mine `obsidian-mine`，(40, 19)，占领后每日 +1。
- **战斗奖励**：默认固定怪物遭遇不提供该资源。

## 魔法精粹 essence（`essence`）

凝聚的魔法能量；当前用于法师公会建设。

- **消耗**：建筑——法师公会 `mageGuild`；招募——无。
- **新游戏库存**：4。
- **地图拾取**：Essence Cache `essence-cache`，(57, 19)，1 魔法精粹。种子相关缓存的注册范围为 1–3；上列数量是默认种子的实际结果。
- **矿点**：Essence Mine `essence-mine`，(55, 31)，占领后每日 +1。
- **战斗奖励**：默认固定怪物遭遇不提供该资源。

资源拾取和宝物不同：资源进入玩家共享库存而不是英雄背包。普通资源拾取给予来访英雄 50 经验；矿点只需访问一次即可占领，产出于新的一天开始时结算。

<!-- h3docs-registry:resource
gold
wood
ore
crystal
gems
mercury
sulfur
mithril
obsidian
essence
-->
