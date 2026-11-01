<!-- 由 scripts/generate-content-docs.mjs 生成，请勿手工编辑。 -->
# 阵营、城镇与建筑链

> 数据来源：`src/game/factions.ts`、`src/game/content.ts`、`src/game/map.ts`、`src/game/scenario.ts`、`src/town/registry.ts`。运行 `npm run docs:generate` 重新生成，运行 `npm run docs:check` 校验。

本册覆盖 **13 个阵营/城镇、57 种建筑**。每座城都有 5 种共同建筑与 4 级专属兵种建筑，共 9 个可交互 3D 建筑位置。坐标采用游戏界面显示的一基坐标；默认地图种子为 `h3core-default`。

## 共同建筑

以下 5 种建筑出现在每个阵营的城镇中。模型栏依次给出注册模型形式、占地与高度。

| ID | 建筑 | 费用 | 前置 | 作用 | 3D 模型 |
| --- | --- | --- | --- | --- | --- |
| `townHall` | 市政厅<br>Town Hall | 1,500 金币 · 5 木材 · 5 矿石 | 无 | 每日产出 500 金币 | townHall<br>占地 5.4 × 4.6；高度 5.4 |
| `capitol` | 国会<br>Capitol | 5,000 金币 · 5 木材 · 5 矿石 · 3 水晶 · 2 秘银 · 1 黑曜石 | 市政厅（`townHall`） | 每日产出 1,000 金币 | capitol<br>占地 4.8 × 4.4；高度 5.8 |
| `market` | 市场<br>Market | 800 金币 · 5 木材 | 市政厅（`townHall`） | 每日产出 250 金币 | market<br>占地 4.8 × 4.2；高度 3.4 |
| `fort` | 堡垒<br>Fort | 1,200 金币 · 10 木材 · 10 矿石 | 市政厅（`townHall`） | 军事巢穴的共同前置建筑；提供守军城防主题 | fort<br>占地 5.2 × 4.5；高度 4.4 |
| `mageGuild` | 法师公会<br>Mage Guild | 1,200 金币 · 5 木材 · 5 矿石 · 2 水银 · 1 魔法精粹 | 市政厅（`townHall`） | 解锁城镇中来访英雄的魔法书视图；不直接施法或教学 | mageGuild<br>占地 4.3 × 4.3；高度 6.5 |

建筑费用从玩家共享库存扣除；每城每天只能完成一个项目，已建项目不能重复建造。高阶兵种建筑按各阵营链条逐级解锁。

## 圣堂 Haven（`haven`）

- **城镇**：星芒要塞 Aster Keep（`Aster Keep`），界面坐标 **(4, 25)**，地图对象 `town-haven`。
- **初始归属**：Azure League（`red`，人类）。初始建筑：市政厅 `townHall`、堡垒 `fort`、民兵营房 `militiaBarracks`。
- **注册英雄**：艾芙琳 Aveline（`aveline`），专长后勤学；攻击/防御/法术力量/知识为 **2/2/1/2**。
- **英雄初始军队**：24 × 民兵（`militia`）<br>12 × 长弓手（`archer`）。定义所列法术：`haste`、`magicArrow`；当前新游戏实际通过默认魔法书获得全部 19 种法术。

| 等级 | 建筑 / ID | 费用 | 前置 | 对应兵种与增长 | 3D 模型 |
| --- | --- | --- | --- | --- | --- |
| 1 | 民兵营房<br>Militia Barracks<br>`militiaBarracks` | 400 金币 · 5 木材 | 堡垒（`fort`） | 民兵<br>Militia<br>每周 +14 | bastion<br>占地 3.7 × 3.5；高度 3.2 |
| 2 | 弓箭靶场<br>Archery Range<br>`archeryRange` | 700 金币 · 8 木材 | 堡垒（`fort`） | 长弓手<br>Longbow Archer<br>每周 +9 | hall<br>占地 3.7 × 3.5；高度 3.3 |
| 3 | 狮鹫塔<br>Griffin Tower<br>`griffinTower` | 1,200 金币 · 5 木材 · 8 矿石 | 弓箭靶场（`archeryRange`） | 风暴狮鹫<br>Storm Griffin<br>每周 +6 | tower<br>占地 3.7 × 3.5；高度 5.2 |
| 4 | 骑士竞技场<br>Jousting Arena<br>`joustingArena` | 2,200 金币 · 10 木材 · 10 矿石 · 2 水晶 | 狮鹫塔（`griffinTower`） | 太阳骑士<br>Sun Cavalier<br>每周 +4 | pen<br>占地 3.7 × 3.5；高度 3.5 |

## 林地 Grove（`grove`）

- **城镇**：月华林谷 Lunar Glade（`Lunar Glade`），界面坐标 **(61, 25)**，地图对象 `town-grove`。
- **初始归属**：Lunar Covenant（`blue`，AI）。初始建筑：市政厅 `townHall`、堡垒 `fort`、小精灵林地 `spriteGlade`。
- **注册英雄**：罗文 Rowan（`rowan`），专长侦察术；攻击/防御/法术力量/知识为 **1/2/2/2**。
- **英雄初始军队**：28 × 闪光小精灵（`sprite`）<br>10 × 荆棘游侠（`ranger`）。定义所列法术：`cure`、`stoneSkin`；当前新游戏实际通过默认魔法书获得全部 19 种法术。

| 等级 | 建筑 / ID | 费用 | 前置 | 对应兵种与增长 | 3D 模型 |
| --- | --- | --- | --- | --- | --- |
| 1 | 小精灵林地<br>Sprite Glade<br>`spriteGlade` | 400 金币 · 5 木材 | 堡垒（`fort`） | 闪光小精灵<br>Glimmer Sprite<br>每周 +16 | grove<br>占地 3.7 × 3.5；高度 3.7 |
| 2 | 游侠木屋<br>Ranger Lodge<br>`rangerLodge` | 750 金币 · 8 木材 | 堡垒（`fort`） | 荆棘游侠<br>Thorn Ranger<br>每周 +9 | hall<br>占地 3.7 × 3.5；高度 3.3 |
| 3 | 独角兽圣林<br>Unicorn Grove<br>`unicornGrove` | 1,400 金币 · 6 木材 · 3 宝石 | 游侠木屋（`rangerLodge`） | 月光独角兽<br>Moon Unicorn<br>每周 +5 | grove<br>占地 3.7 × 3.5；高度 4.3 |
| 4 | 巨龙悬崖<br>Dragon Cliffs<br>`dragonCliffs` | 3,500 金币 · 10 木材 · 10 矿石 · 6 水晶 | 独角兽圣林（`unicornGrove`） | 翠叶巨龙<br>Verdant Dragon<br>每周 +2 | cavern<br>占地 3.7 × 3.5；高度 5 |

## 炼狱 Ember（`ember`）

- **城镇**：灰烬堡垒 Cinder Bastion（`Cinder Bastion`），界面坐标 **(4, 5)**，地图对象 `town-ember`。
- **初始归属**：Azure League（`red`，人类）。初始建筑：市政厅 `townHall`、堡垒 `fort`、小鬼巢穴 `impWarrens`。
- **注册英雄**：塞拉芬 Seraphine（`seraphine`），专长火焰魔法；攻击/防御/法术力量/知识为 **2/1/3/2**。
- **英雄初始军队**：28 × 灰烬小鬼（`imp`）<br>8 × 地狱猎犬（`hellhound`）。定义所列法术：`fireball`、`magicArrow`；当前新游戏实际通过默认魔法书获得全部 19 种法术。

| 等级 | 建筑 / ID | 费用 | 前置 | 对应兵种与增长 | 3D 模型 |
| --- | --- | --- | --- | --- | --- |
| 1 | 小鬼巢穴<br>Imp Warrens<br>`impWarrens` | 400 金币 · 5 木材 | 堡垒（`fort`） | 灰烬小鬼<br>Cinder Imp<br>每周 +16 | cavern<br>占地 3.7 × 3.5；高度 2.9 |
| 2 | 地狱犬舍<br>Hellhound Kennels<br>`hellhoundKennels` | 750 金币 · 6 木材 · 4 矿石 · 1 硫磺 | 小鬼巢穴（`impWarrens`） | 地狱猎犬<br>Hellhound<br>每周 +9 | pen<br>占地 3.7 × 3.5；高度 3.2 |
| 3 | 火巨灵高塔<br>Ifrit Spire<br>`ifritSpire` | 1,400 金币 · 6 矿石 · 3 硫磺 | 地狱犬舍（`hellhoundKennels`） | 火巨灵<br>Ifrit<br>每周 +5 | tower<br>占地 3.7 × 3.5；高度 5.4 |
| 4 | 深渊恶魔裂隙<br>Pit Fiend Abyss<br>`pitFiendAbyss` | 3,200 金币 · 8 木材 · 8 矿石 · 6 硫磺 | 火巨灵高塔（`ifritSpire`） | 深渊恶魔<br>Pit Fiend<br>每周 +2 | ritual<br>占地 3.7 × 3.5；高度 4.7 |

## 沼泽 Mire（`mire`）

- **城镇**：沉没沼泽 Sunken Fen（`Sunken Fen`），界面坐标 **(61, 44)**，地图对象 `town-mire`。
- **初始归属**：Lunar Covenant（`blue`，AI）。初始建筑：市政厅 `townHall`、堡垒 `fort`、蜥蜴人巢穴 `lizardmanDen`。
- **注册英雄**：莫尔文 Morven（`morven`），专长沼泽知识；攻击/防御/法术力量/知识为 **1/3/2/2**。
- **英雄初始军队**：24 × 沼泽蜥蜴人（`lizardman`）<br>8 × 泥潭蛇发兽（`gorgon`）。定义所列法术：`slow`、`stoneSkin`；当前新游戏实际通过默认魔法书获得全部 19 种法术。

| 等级 | 建筑 / ID | 费用 | 前置 | 对应兵种与增长 | 3D 模型 |
| --- | --- | --- | --- | --- | --- |
| 1 | 蜥蜴人巢穴<br>Lizardman Den<br>`lizardmanDen` | 450 金币 · 5 木材 | 堡垒（`fort`） | 沼泽蜥蜴人<br>Mire Lizardman<br>每周 +12 | cavern<br>占地 3.7 × 3.5；高度 3 |
| 2 | 蛇发兽围栏<br>Gorgon Pen<br>`gorgonPen` | 800 金币 · 6 木材 · 4 矿石 · 1 水银 | 蜥蜴人巢穴（`lizardmanDen`） | 泥潭蛇发兽<br>Bog Gorgon<br>每周 +8 | pen<br>占地 3.7 × 3.5；高度 3.2 |
| 3 | 飞龙栖巢<br>Wyvern Roost<br>`wyvernRoost` | 1,350 金币 · 8 木材 · 2 水银 | 蛇发兽围栏（`gorgonPen`） | 沼泽飞龙<br>Marsh Wyvern<br>每周 +5 | tower<br>占地 3.7 × 3.5；高度 4.8 |
| 4 | 石化蜥蜴深坑<br>Basilisk Pit<br>`basiliskPit` | 3,000 金币 · 8 木材 · 8 矿石 · 4 水晶 · 2 水银 | 飞龙栖巢（`wyvernRoost`） | 石化蜥蜴<br>Basilisk<br>每周 +2 | ritual<br>占地 3.7 × 3.5；高度 4 |

## 塔楼 Tower（`tower`）

- **城镇**：星辉高塔 Astral Spire（`Astral Spire`），界面坐标 **(21, 5)**，地图对象 `town-tower`。
- **初始归属**：Lunar Covenant（`blue`，AI）。初始建筑：市政厅 `townHall`、堡垒 `fort`、小魔怪工坊 `gremlinWorkshop`。
- **注册英雄**：索尔米尔 Solmyr（`solmyr`），专长连锁闪电；攻击/防御/法术力量/知识为 **1/1/3/3**。
- **英雄初始军队**：26 × 工匠小魔怪（`gremlin`）<br>8 × 石像鬼（`stoneGargoyle`）。定义所列法术：`magicArrow`、`haste`；当前新游戏实际通过默认魔法书获得全部 19 种法术。

| 等级 | 建筑 / ID | 费用 | 前置 | 对应兵种与增长 | 3D 模型 |
| --- | --- | --- | --- | --- | --- |
| 1 | 小魔怪工坊<br>Gremlin Workshop<br>`gremlinWorkshop` | 450 金币 · 5 木材 | 堡垒（`fort`） | 工匠小魔怪<br>Tinker Gremlin<br>每周 +16 | industrial<br>占地 3.7 × 3.5；高度 3.4 |
| 2 | 石像鬼城垛<br>Gargoyle Parapet<br>`gargoyleParapet` | 800 金币 · 5 木材 · 5 矿石 | 小魔怪工坊（`gremlinWorkshop`） | 石像鬼<br>Stone Gargoyle<br>每周 +9 | bastion<br>占地 3.7 × 3.5；高度 4 |
| 3 | 巨灵亭阁<br>Genie Pavilion<br>`geniePavilion` | 1,500 金币 · 6 矿石 · 2 宝石 | 石像鬼城垛（`gargoyleParapet`） | 星界巨灵<br>Astral Genie<br>每周 +5 | ritual<br>占地 3.7 × 3.5；高度 4.6 |
| 4 | 泰坦云端神殿<br>Titan Cloud Temple<br>`titanCloudTemple` | 3,400 金币 · 8 木材 · 8 矿石 · 5 宝石 | 巨灵亭阁（`geniePavilion`） | 风暴泰坦<br>Storm Titan<br>每周 +2 | tower<br>占地 3.7 × 3.5；高度 6 |

## 墓园 Necropolis（`necropolis`）

- **城镇**：灵魂帷幕 Veil of Souls（`Veil of Souls`），界面坐标 **(43, 5)**，地图对象 `town-necropolis`。
- **初始归属**：Lunar Covenant（`blue`，AI）。初始建筑：市政厅 `townHall`、堡垒 `fort`、骷髅地穴 `skeletonCrypt`。
- **注册英雄**：伊斯拉 Isra（`isra`），专长招魂术；攻击/防御/法术力量/知识为 **1/2/2/3**。
- **英雄初始军队**：30 × 墓地骷髅（`skeleton`）<br>10 × 复苏僵尸（`zombie`）。定义所列法术：`slow`、`stoneSkin`；当前新游戏实际通过默认魔法书获得全部 19 种法术。

| 等级 | 建筑 / ID | 费用 | 前置 | 对应兵种与增长 | 3D 模型 |
| --- | --- | --- | --- | --- | --- |
| 1 | 骷髅地穴<br>Skeleton Crypt<br>`skeletonCrypt` | 400 金币 · 5 木材 | 堡垒（`fort`） | 墓地骷髅<br>Grave Skeleton<br>每周 +16 | ruins<br>占地 3.7 × 3.5；高度 3.2 |
| 2 | 僵尸墓园<br>Zombie Graveyard<br>`zombieGraveyard` | 750 金币 · 5 木材 · 1 水银 | 骷髅地穴（`skeletonCrypt`） | 复苏僵尸<br>Risen Zombie<br>每周 +9 | ruins<br>占地 3.7 × 3.5；高度 3 |
| 3 | 吸血鬼庄园<br>Vampire Estate<br>`vampireEstate` | 1,450 金币 · 6 矿石 · 2 水银 | 僵尸墓园（`zombieGraveyard`） | 暗夜吸血鬼<br>Night Vampire<br>每周 +5 | hall<br>占地 3.7 × 3.5；高度 4.8 |
| 4 | 幽灵龙陵墓<br>Ghost Dragon Sepulcher<br>`ghostDragonSepulcher` | 3,300 金币 · 8 木材 · 8 矿石 · 5 水银 | 吸血鬼庄园（`vampireEstate`） | 幽灵龙<br>Ghost Dragon<br>每周 +2 | ruins<br>占地 3.7 × 3.5；高度 5.5 |

## 地下城 Dungeon（`dungeon`）

- **城镇**：黑曜深渊 Obsidian Depths（`Obsidian Depths`），界面坐标 **(21, 17)**，地图对象 `town-dungeon`。
- **初始归属**：Lunar Covenant（`blue`，AI）。初始建筑：市政厅 `townHall`、堡垒 `fort`、穴居人洞窟 `troglodyteWarrens`。
- **注册英雄**：达克斯通 Darkstorn（`darkstorn`），专长地下路径；攻击/防御/法术力量/知识为 **2/1/3/2**。
- **英雄初始军队**：24 × 洞穴穴居人（`troglodyte`）<br>10 × 鹰身女妖（`harpy`）。定义所列法术：`fireball`、`slow`；当前新游戏实际通过默认魔法书获得全部 19 种法术。

| 等级 | 建筑 / ID | 费用 | 前置 | 对应兵种与增长 | 3D 模型 |
| --- | --- | --- | --- | --- | --- |
| 1 | 穴居人洞窟<br>Troglodyte Warrens<br>`troglodyteWarrens` | 450 金币 · 5 木材 | 堡垒（`fort`） | 洞穴穴居人<br>Cave Troglodyte<br>每周 +15 | cavern<br>占地 3.7 × 3.5；高度 3.1 |
| 2 | 鹰身女妖栖巢<br>Harpy Roost<br>`harpyRoost` | 800 金币 · 6 木材 · 4 矿石 | 穴居人洞窟（`troglodyteWarrens`） | 鹰身女妖<br>Harpy Hag<br>每周 +9 | tower<br>占地 3.7 × 3.5；高度 4.5 |
| 3 | 牛头人迷宫<br>Minotaur Labyrinth<br>`minotaurLabyrinth` | 1,500 金币 · 6 木材 · 2 硫磺 | 鹰身女妖栖巢（`harpyRoost`） | 迷宫牛头人<br>Labyrinth Minotaur<br>每周 +5 | bastion<br>占地 3.7 × 3.5；高度 4.1 |
| 4 | 红龙洞窟<br>Red Dragon Cavern<br>`redDragonCavern` | 3,500 金币 · 10 木材 · 8 矿石 · 5 硫磺 | 牛头人迷宫（`minotaurLabyrinth`） | 洞窟红龙<br>Cavern Red Dragon<br>每周 +2 | cavern<br>占地 3.7 × 3.5；高度 5.4 |

## 据点 Stronghold（`stronghold`）

- **城镇**：雷霆堡垒 Thunder Bastion（`Thunder Bastion`），界面坐标 **(43, 17)**，地图对象 `town-stronghold`。
- **初始归属**：Lunar Covenant（`blue`，AI）。初始建筑：市政厅 `townHall`、堡垒 `fort`、哥布林营房 `goblinBarracks`。
- **注册英雄**：约格 Yog（`yog`），专长进攻术；攻击/防御/法术力量/知识为 **3/2/1/1**。
- **英雄初始军队**：32 × 战斗哥布林（`goblin`）<br>10 × 狼骑兵（`wolfRider`）。定义所列法术：`haste`、`bless`；当前新游戏实际通过默认魔法书获得全部 19 种法术。

| 等级 | 建筑 / ID | 费用 | 前置 | 对应兵种与增长 | 3D 模型 |
| --- | --- | --- | --- | --- | --- |
| 1 | 哥布林营房<br>Goblin Barracks<br>`goblinBarracks` | 400 金币 · 5 木材 | 堡垒（`fort`） | 战斗哥布林<br>War Goblin<br>每周 +18 | bastion<br>占地 3.7 × 3.5；高度 3.2 |
| 2 | 狼骑兵围栏<br>Wolf Pen<br>`wolfPen` | 750 金币 · 8 木材 | 哥布林营房（`goblinBarracks`） | 狼骑兵<br>Wolf Rider<br>每周 +10 | pen<br>占地 3.7 × 3.5；高度 3 |
| 3 | 食人魔堡垒<br>Ogre Fort<br>`ogreFort` | 1,400 金币 · 6 木材 · 6 矿石 | 狼骑兵围栏（`wolfPen`） | 战斗食人魔<br>War Ogre<br>每周 +5 | bastion<br>占地 3.7 × 3.5；高度 4.4 |
| 4 | 比蒙悬崖<br>Behemoth Cliffs<br>`behemothCliffs` | 3,200 金币 · 10 木材 · 10 矿石 · 4 水晶 | 食人魔堡垒（`ogreFort`） | 远古比蒙<br>Ancient Behemoth<br>每周 +2 | cavern<br>占地 3.7 × 3.5；高度 5.2 |

## 元素 Conflux（`conflux`）

- **城镇**：元素枢纽 Elemental Nexus（`Elemental Nexus`），界面坐标 **(4, 37)**，地图对象 `town-conflux`。
- **初始归属**：Lunar Covenant（`blue`，AI）。初始建筑：市政厅 `townHall`、堡垒 `fort`、仙子花园 `pixieGarden`。
- **注册英雄**：拉贝莎 Labetha（`labetha`），专长元素魔法；攻击/防御/法术力量/知识为 **1/1/3/3**。
- **英雄初始军队**：30 × 电光仙子（`pixie`）<br>10 × 气元素（`airElemental`）。定义所列法术：`magicArrow`、`cure`；当前新游戏实际通过默认魔法书获得全部 19 种法术。

| 等级 | 建筑 / ID | 费用 | 前置 | 对应兵种与增长 | 3D 模型 |
| --- | --- | --- | --- | --- | --- |
| 1 | 仙子花园<br>Pixie Garden<br>`pixieGarden` | 400 金币 · 5 木材 | 堡垒（`fort`） | 电光仙子<br>Spark Pixie<br>每周 +18 | grove<br>占地 3.7 × 3.5；高度 3.6 |
| 2 | 气元素祭坛<br>Air Elemental Altar<br>`airElementalAltar` | 800 金币 · 5 木材 · 1 宝石 | 仙子花园（`pixieGarden`） | 气元素<br>Air Elemental<br>每周 +10 | ritual<br>占地 3.7 × 3.5；高度 4.2 |
| 3 | 风暴元素高塔<br>Storm Elemental Spire<br>`stormElementalSpire` | 1,450 金币 · 5 矿石 · 2 宝石 | 气元素祭坛（`airElementalAltar`） | 风暴元素<br>Storm Elemental<br>每周 +5 | tower<br>占地 3.7 × 3.5；高度 5.5 |
| 4 | 凤凰火葬堆<br>Phoenix Pyre<br>`phoenixPyre` | 3,400 金币 · 8 木材 · 5 宝石 · 2 水银 | 风暴元素高塔（`stormElementalSpire`） | 重生凤凰<br>Reborn Phoenix<br>每周 +2 | ritual<br>占地 3.7 × 3.5；高度 5.1 |

## 港湾 Cove（`cove`）

- **城镇**：潮汐港 Tidehaven（`Tidehaven`），界面坐标 **(21, 37)**，地图对象 `town-cove`。
- **初始归属**：Lunar Covenant（`blue`，AI）。初始建筑：市政厅 `townHall`、堡垒 `fort`、宁芙石窟 `nymphGrotto`。
- **注册英雄**：德里克 Derek（`derek`），专长航海术；攻击/防御/法术力量/知识为 **2/2/1/2**。
- **英雄初始军队**：26 × 潮汐宁芙（`nymph`）<br>12 × 海盗（`corsair`）。定义所列法术：`bless`、`haste`；当前新游戏实际通过默认魔法书获得全部 19 种法术。

| 等级 | 建筑 / ID | 费用 | 前置 | 对应兵种与增长 | 3D 模型 |
| --- | --- | --- | --- | --- | --- |
| 1 | 宁芙石窟<br>Nymph Grotto<br>`nymphGrotto` | 450 金币 · 5 木材 | 堡垒（`fort`） | 潮汐宁芙<br>Tide Nymph<br>每周 +15 | aquatic<br>占地 3.7 × 3.5；高度 3.3 |
| 2 | 海盗酒馆<br>Corsair Tavern<br>`corsairTavern` | 800 金币 · 8 木材 | 宁芙石窟（`nymphGrotto`） | 海盗<br>Corsair<br>每周 +10 | hall<br>占地 3.7 × 3.5；高度 3.8 |
| 3 | 海女巫塔<br>Sea Witch Tower<br>`seaWitchTower` | 1,450 金币 · 6 木材 · 2 水银 | 海盗酒馆（`corsairTavern`） | 海女巫<br>Sea Witch<br>每周 +5 | tower<br>占地 3.7 × 3.5；高度 5.1 |
| 4 | 海蛇港湾<br>Sea Serpent Cove<br>`seaSerpentCove` | 3,500 金币 · 10 木材 · 8 矿石 · 5 水晶 | 海女巫塔（`seaWitchTower`） | 深渊海蛇<br>Abyssal Sea Serpent<br>每周 +2 | aquatic<br>占地 3.7 × 3.5；高度 4.6 |

## 工厂 Factory（`factory`）

- **城镇**：黄铜工坊堡垒 Brasswork Bastion（`Brasswork Bastion`），界面坐标 **(43, 37)**，地图对象 `town-factory`。
- **初始归属**：Lunar Covenant（`blue`，AI）。初始建筑：市政厅 `townHall`、堡垒 `fort`、半身人小屋 `halflingHovels`。
- **注册英雄**：托德 Todd（`todd`），专长炮术；攻击/防御/法术力量/知识为 **2/3/1/2**。
- **英雄初始军队**：28 × 半身人投石手（`halfling`）<br>8 × 黄铜自动机（`automaton`）。定义所列法术：`stoneSkin`、`magicArrow`；当前新游戏实际通过默认魔法书获得全部 19 种法术。

| 等级 | 建筑 / ID | 费用 | 前置 | 对应兵种与增长 | 3D 模型 |
| --- | --- | --- | --- | --- | --- |
| 1 | 半身人小屋<br>Halfling Hovels<br>`halflingHovels` | 450 金币 · 5 木材 · 2 矿石 | 堡垒（`fort`） | 半身人投石手<br>Halfling Slinger<br>每周 +16 | hall<br>占地 3.7 × 3.5；高度 2.9 |
| 2 | 自动机装配厂<br>Automaton Assembly<br>`automatonAssembly` | 850 金币 · 5 木材 · 5 矿石 | 半身人小屋（`halflingHovels`） | 黄铜自动机<br>Brass Automaton<br>每周 +9 | industrial<br>占地 3.7 × 3.5；高度 4 |
| 3 | 无畏机铸造厂<br>Dreadnought Foundry<br>`dreadnoughtFoundry` | 1,550 金币 · 8 矿石 · 2 水晶 | 自动机装配厂（`automatonAssembly`） | 钢铁无畏机<br>Iron Dreadnought<br>每周 +4 | industrial<br>占地 3.7 × 3.5；高度 4.7 |
| 4 | 毁灭者机库<br>Juggernaut Hangar<br>`juggernautHangar` | 3,600 金币 · 8 木材 · 12 矿石 · 4 水晶 | 无畏机铸造厂（`dreadnoughtFoundry`） | 攻城毁灭者<br>Siege Juggernaut<br>每周 +2 | industrial<br>占地 3.7 × 3.5；高度 5 |

## 壁垒 Bulwark（`bulwark`）

- **城镇**：芦墙庇护所 Reedwall Refuge（`Reedwall Refuge`），界面坐标 **(21, 44)**，地图对象 `town-bulwark`。
- **初始归属**：Lunar Covenant（`blue`，AI）。初始建筑：市政厅 `townHall`、堡垒 `fort`、强盗藏身处 `banditHideout`。
- **注册英雄**：伊丽莎 Eliza（`eliza`），专长游击战术；攻击/防御/法术力量/知识为 **2/2/2/2**。
- **英雄初始军队**：26 × 芦苇强盗（`bandit`）<br>12 × 巨型黄蜂（`hornet`）。定义所列法术：`slow`、`stoneSkin`；当前新游戏实际通过默认魔法书获得全部 19 种法术。

| 等级 | 建筑 / ID | 费用 | 前置 | 对应兵种与增长 | 3D 模型 |
| --- | --- | --- | --- | --- | --- |
| 1 | 强盗藏身处<br>Bandit Hideout<br>`banditHideout` | 400 金币 · 5 木材 | 堡垒（`fort`） | 芦苇强盗<br>Reed Bandit<br>每周 +15 | hall<br>占地 3.7 × 3.5；高度 3.1 |
| 2 | 巨型黄蜂巢<br>Giant Hornet Nest<br>`hornetNest` | 750 金币 · 6 木材 · 1 水银 | 强盗藏身处（`banditHideout`） | 巨型黄蜂<br>Giant Hornet<br>每周 +11 | grove<br>占地 3.7 × 3.5；高度 4.2 |
| 3 | 萨满木屋<br>Shaman Lodge<br>`shamanLodge` | 1,400 金币 · 6 木材 · 2 宝石 | 巨型黄蜂巢（`hornetNest`） | 沼泽萨满<br>Mire Shaman<br>每周 +5 | ritual<br>占地 3.7 × 3.5；高度 4.3 |
| 4 | 远古巨鳄池<br>Ancient Alligator Pit<br>`alligatorPit` | 3,200 金币 · 8 木材 · 8 矿石 · 4 水银 | 萨满木屋（`shamanLodge`） | 远古巨鳄<br>Ancient Alligator<br>每周 +2 | aquatic<br>占地 3.7 × 3.5；高度 3.8 |

## 庭院 Courtyard（`courtyard`）

- **城镇**：玫瑰宫廷 Rose Court（`Rose Court`），界面坐标 **(43, 44)**，地图对象 `town-courtyard`。
- **初始归属**：Lunar Covenant（`blue`，AI）。初始建筑：市政厅 `townHall`、堡垒 `fort`、侍从营房 `pageBarracks`。
- **注册英雄**：碧翠丝 Beatrice（`beatrice`），专长外交术；攻击/防御/法术力量/知识为 **1/3/2/2**。
- **英雄初始军队**：26 × 宫廷侍从（`page`）<br>10 × 玫瑰决斗者（`duelist`）。定义所列法术：`bless`、`cure`；当前新游戏实际通过默认魔法书获得全部 19 种法术。

| 等级 | 建筑 / ID | 费用 | 前置 | 对应兵种与增长 | 3D 模型 |
| --- | --- | --- | --- | --- | --- |
| 1 | 侍从营房<br>Page Barracks<br>`pageBarracks` | 450 金币 · 5 木材 | 堡垒（`fort`） | 宫廷侍从<br>Court Page<br>每周 +14 | bastion<br>占地 3.7 × 3.5；高度 3.4 |
| 2 | 决斗者沙龙<br>Duelist Salon<br>`duelistSalon` | 800 金币 · 6 木材 · 4 矿石 | 侍从营房（`pageBarracks`） | 玫瑰决斗者<br>Rose Duelist<br>每周 +9 | hall<br>占地 3.7 × 3.5；高度 3.8 |
| 3 | 宫廷法师图书馆<br>Court Wizard Library<br>`courtWizardLibrary` | 1,500 金币 · 5 木材 · 5 矿石 · 2 宝石 | 决斗者沙龙（`duelistSalon`） | 宫廷法师<br>Court Wizard<br>每周 +5 | tower<br>占地 3.7 × 3.5；高度 5 |
| 4 | 皇家翼狮花园<br>Royal Lion Garden<br>`royalLionGarden` | 3,400 金币 · 10 木材 · 8 矿石 · 4 水晶 | 宫廷法师图书馆（`courtWizardLibrary`） | 皇家翼狮<br>Royal Winged Lion<br>每周 +2 | grove<br>占地 3.7 × 3.5；高度 4.8 |


<!-- h3docs-registry:faction
haven
grove
ember
mire
tower
necropolis
dungeon
stronghold
conflux
cove
factory
bulwark
courtyard
-->

<!-- h3docs-registry:building
townHall
capitol
market
fort
mageGuild
militiaBarracks
archeryRange
griffinTower
joustingArena
spriteGlade
rangerLodge
unicornGrove
dragonCliffs
impWarrens
hellhoundKennels
ifritSpire
pitFiendAbyss
lizardmanDen
gorgonPen
wyvernRoost
basiliskPit
gremlinWorkshop
gargoyleParapet
geniePavilion
titanCloudTemple
skeletonCrypt
zombieGraveyard
vampireEstate
ghostDragonSepulcher
troglodyteWarrens
harpyRoost
minotaurLabyrinth
redDragonCavern
goblinBarracks
wolfPen
ogreFort
behemothCliffs
pixieGarden
airElementalAltar
stormElementalSpire
phoenixPyre
nymphGrotto
corsairTavern
seaWitchTower
seaSerpentCove
halflingHovels
automatonAssembly
dreadnoughtFoundry
juggernautHangar
banditHideout
hornetNest
shamanLodge
alligatorPit
pageBarracks
duelistSalon
courtWizardLibrary
royalLionGarden
-->
