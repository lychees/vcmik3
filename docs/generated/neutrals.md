<!-- 由 scripts/generate-content-docs.mjs 生成，请勿手工编辑。 -->
# 中立模型与固定怪物遭遇

> 数据来源：`src/game/neutral.ts`、`src/battle/creatures.ts`、`src/battle/neutral/`、`src/adventure/models.ts`、`src/game/map.ts`。运行 `npm run docs:generate` 重新生成，运行 `npm run docs:check` 校验。

全部 **20 种中立生物**都有独立注册模型原型；冒险地图与战术战场复用同一生物模型工厂。下表的模型原型、视觉高度和主色直接读取模型实例。每种中立生物恰好出现在一个固定混合遭遇中，共 **10 个中立主题遭遇**。

| ID | 生物 | 模型原型 | 中文形态 | 视觉高度 | 模型主色 | 固定遭遇 |
| --- | --- | --- | --- | --- | --- | --- |
| `ratling` | 鼠人<br>Ratling | `rodent-scavenger` | 啮齿拾荒者 | 1.52 | #716359 / #e2b34f / #2d2929 | `monster-neutral-swarm` |
| `mummy` | 木乃伊<br>Mummy | `bandaged-undead` | 缠布复苏亡者 | 1.77 | #bfae83 / #83d7bd / #625a45 | `monster-neutral-desert` |
| `giantSpider` | 巨型蜘蛛<br>Giant Spider | `giant-eight-legged-spider` | 八足巨蛛 | 1.01 | #344238 / #9aa75c / #e2a84e | `monster-neutral-forest` |
| `seaHag` | 海妖婆<br>Sea Hag | `tide-witch` | 潮汐女巫 | 1.84 | #354d5b / #9ee4d5 / #202d35 | `monster-neutral-aquatic` |
| `direBear` | 凶暴熊<br>Dire Bear | `dire-bear` | 凶暴巨熊 | 1.28 | #6f4a32 / #d9c29a / #2e241f | `monster-neutral-beasts` |
| `cerberus` | 三头地狱犬<br>Cerberus | `three-headed-hound` | 三头猎犬 | 1.54 | #45272a / #ff7832 / #1d181e | `monster-neutral-infernal` |
| `broodMother` | 巢母<br>Brood Mother | `brood-queen` | 巢群女王 | 2.00 | #55434c / #8e9b61 / #282129 | `monster-neutral-swarm` |
| `wraith` | 怨灵<br>Wraith | `hooded-spectral-revenant` | 兜帽幽灵 | 1.93 | #35475b / #9be8df / #17232f | `monster-neutral-undead` |
| `golem` | 符文魔像<br>Runic Golem | `runic-stone-construct` | 符文石构体 | 2.39 | #718087 / #79e6e1 / #303c46 | `monster-neutral-arcane` |
| `manticore` | 蝎尾狮<br>Manticore | `winged-manticore` | 有翼蝎尾狮 | 1.64 | #b87a45 / #8f3f32 / #3a2730 | `monster-neutral-beasts` |
| `sandWyrm` | 沙虫<br>Sand Wyrm | `segmented-desert-wyrm` | 装甲沙虫 | 1.40 | #a8783f / #f0b94f / #3c2b24 | `monster-neutral-desert` |
| `ent` | 远古树人<br>Ancient Ent | `ancient-tree-guardian` | 远古树木守卫 | 2.72 | #69503a / #496b3d / #e4bd63 | `monster-neutral-forest` |
| `iceWyrm` | 冰霜巨虫<br>Ice Wyrm | `wingless-ice-wyrm` | 无翼冰霜巨虫 | 1.85 | #79aabd / #b9f0f4 / #345168 | `monster-neutral-ice` |
| `basiliskKing` | 蜥蜴王<br>Basilisk King | `crowned-hooded-basilisk` | 王冠兜帽蜥蜴 | 1.56 | #54754a / #d9b84f / #2e4033 | `monster-neutral-reptile` |
| `lich` | 巫妖<br>Lich | `crowned-undead-caster` | 加冕亡灵施法者 | 2.18 | #403653 / #82dfb0 / #c5c0a5 | `monster-neutral-undead` |
| `beholder` | 眼魔<br>Beholder | `many-eyed-floating-tyrant` | 多眼悬浮暴君 | 2.24 | #76538c / #77dbc8 / #34243f | `monster-neutral-arcane` |
| `kraken` | 克拉肯<br>Kraken | `eight-armed-sea-monster` | 八臂海怪 | 1.96 | #477f88 / #78a99d / #172d3a | `monster-neutral-aquatic` |
| `frostGiant` | 霜巨人<br>Frost Giant | `armored-frost-giant` | 装甲霜巨人 | 2.53 | #6f94ad / #c8edf2 / #34465c | `monster-neutral-ice` |
| `balor` | 巴洛炎魔<br>Balor | `winged-fire-demon` | 有翼火焰恶魔 | 2.81 | #762b31 / #ff8a32 / #211820 | `monster-neutral-infernal` |
| `hydra` | 沼泽九头蛇<br>Swamp Hydra | `three-headed-swamp-hydra` | 三头沼泽九头蛇 | 2.03 | #416f5b / #a2b964 / #263e38 | `monster-neutral-reptile` |

兵种数值见[兵种总图鉴](./creatures.md#中立生物)。视觉高度用于模型与标签布局，不是战斗属性。

## 10 个中立主题混合遭遇

| 遭遇 ID | 名称 | 界面坐标 | 防守军队 | 经验 | 资源奖励 |
| --- | --- | --- | --- | --- | --- |
| `monster-neutral-arcane` | 奥术哨兵<br>Arcane Sentinels | (15, 11) | 4 × 符文魔像（`golem`）<br>2 × 眼魔（`beholder`） | 1,800 | 900 金币 · 2 宝石 |
| `monster-neutral-aquatic` | 利齿潮汐<br>Tide of Teeth | (54, 11) | 2 × 克拉肯（`kraken`）<br>8 × 海妖婆（`seaHag`） | 1,800 | 900 金币 · 2 水银 |
| `monster-neutral-beasts` | 蛮荒兽群<br>Savage Menagerie | (15, 23) | 8 × 凶暴熊（`direBear`）<br>4 × 蝎尾狮（`manticore`） | 1,400 | 750 金币 |
| `monster-neutral-desert` | 沙丘亡者<br>Dune Revenants | (54, 23) | 16 × 木乃伊（`mummy`）<br>4 × 沙虫（`sandWyrm`） | 1,400 | 750 金币 · 1 硫磺 |
| `monster-neutral-forest` | 棘木守卫<br>Thornwood Guardians | (15, 34) | 4 × 远古树人（`ent`）<br>16 × 巨型蜘蛛（`giantSpider`） | 1,400 | 750 金币 · 4 木材 |
| `monster-neutral-ice` | 冰封巢群<br>Frozen Brood | (54, 34) | 2 × 霜巨人（`frostGiant`）<br>4 × 冰霜巨虫（`iceWyrm`） | 1,800 | 900 金币 · 2 水晶 |
| `monster-neutral-infernal` | 炼狱猎杀<br>Infernal Hunt | (15, 41) | 8 × 三头地狱犬（`cerberus`）<br>2 × 巴洛炎魔（`balor`） | 1,800 | 900 金币 · 2 硫磺 |
| `monster-neutral-reptile` | 王冠鳞群<br>Crowned Scales | (54, 41) | 2 × 沼泽九头蛇（`hydra`）<br>4 × 蜥蜴王（`basiliskKing`） | 1,800 | 900 金币 · 2 水晶 |
| `monster-neutral-swarm` | 地穴虫群<br>Burrow Swarm | (28, 11) | 18 × 鼠人（`ratling`）<br>8 × 巢母（`broodMother`） | 1,200 | 650 金币 |
| `monster-neutral-undead` | 帷幕宫廷<br>Veiled Court | (38, 11) | 4 × 巫妖（`lich`）<br>8 × 怨灵（`wraith`） | 1,600 | 850 金币 · 1 宝石 |

## 其余固定怪物遭遇

默认地图共有 24 个怪物对象；除上述 10 个外，其余 14 个如下。移动到怪物格会进入战术战斗，胜利后怪物对象消失并发放经验与资源；失败时剩余守军保留，平局不发放奖励。

| 遭遇 ID | 名称 | 界面坐标 | 防守军队 | 经验 | 资源奖励 |
| --- | --- | --- | --- | --- | --- |
| `monster-west` | 路边盗匪<br>Roadside Brigands | (10, 25) | 16 × 民兵（`militia`） | 500 | 400 金币 |
| `monster-east` | 野生小精灵<br>Wild Sprites | (55, 25) | 20 × 闪光小精灵（`sprite`） | 500 | 2 宝石 |
| `monster-dragon` | 远古巨龙<br>Elder Dragon | (33, 44) | 2 × 翠叶巨龙（`dragon`） | 2,200 | 2,000 金币 · 4 水晶 |
| `monster-ember` | 灰烬先锋<br>Ashen Vanguard | (13, 22) | 3 × 火巨灵（`ifrit`）<br>1 × 深渊恶魔（`pitFiend`） | 1,400 | 900 金币 · 2 硫磺 |
| `monster-mire` | 沼泽统领<br>Mire Marshals | (52, 28) | 3 × 沼泽飞龙（`wyvern`）<br>1 × 石化蜥蜴（`basilisk`） | 1,400 | 900 金币 · 2 水银 |
| `monster-tower` | Tower Warband | (21, 11) | 3 × 星界巨灵（`genie`）<br>1 × 风暴泰坦（`titan`） | 1,400 | 900 金币 · 2 宝石 |
| `monster-necropolis` | Necropolis Warband | (43, 11) | 3 × 暗夜吸血鬼（`vampire`）<br>1 × 幽灵龙（`ghostDragon`） | 1,400 | 900 金币 · 2 水银 |
| `monster-dungeon` | Dungeon Warband | (21, 23) | 3 × 迷宫牛头人（`minotaur`）<br>1 × 洞窟红龙（`redDragon`） | 1,400 | 900 金币 · 2 硫磺 |
| `monster-stronghold` | Stronghold Warband | (43, 23) | 3 × 战斗食人魔（`ogre`）<br>1 × 远古比蒙（`behemoth`） | 1,400 | 900 金币 · 2 水晶 |
| `monster-conflux` | Conflux Warband | (4, 43) | 3 × 风暴元素（`stormElemental`）<br>1 × 重生凤凰（`phoenix`） | 1,400 | 900 金币 · 2 宝石 |
| `monster-cove` | Cove Warband | (21, 34) | 3 × 海女巫（`seaWitch`）<br>1 × 深渊海蛇（`seaSerpent`） | 1,400 | 900 金币 · 2 水银 |
| `monster-factory` | Factory Warband | (43, 34) | 3 × 钢铁无畏机（`dreadnought`）<br>1 × 攻城毁灭者（`juggernaut`） | 1,400 | 900 金币 · 2 硫磺 |
| `monster-bulwark` | Bulwark Warband | (21, 47) | 3 × 沼泽萨满（`shaman`）<br>1 × 远古巨鳄（`alligator`） | 1,400 | 900 金币 · 2 水晶 |
| `monster-courtyard` | Courtyard Warband | (43, 47) | 3 × 宫廷法师（`courtWizard`）<br>1 × 皇家翼狮（`royalLion`） | 1,400 | 900 金币 · 2 宝石 |

<!-- h3docs-registry:neutral-model
ratling
mummy
giantSpider
seaHag
direBear
cerberus
broodMother
wraith
golem
manticore
sandWyrm
ent
iceWyrm
basiliskKing
lich
beholder
kraken
frostGiant
balor
hydra
-->

<!-- h3docs-registry:neutral-encounter
monster-neutral-arcane
monster-neutral-aquatic
monster-neutral-beasts
monster-neutral-desert
monster-neutral-forest
monster-neutral-ice
monster-neutral-infernal
monster-neutral-reptile
monster-neutral-swarm
monster-neutral-undead
-->

<!-- h3docs-registry:monster-encounter
monster-west
monster-east
monster-dragon
monster-ember
monster-mire
monster-neutral-arcane
monster-neutral-aquatic
monster-neutral-beasts
monster-neutral-desert
monster-neutral-forest
monster-neutral-ice
monster-neutral-infernal
monster-neutral-reptile
monster-neutral-swarm
monster-neutral-undead
monster-tower
monster-necropolis
monster-dungeon
monster-stronghold
monster-conflux
monster-cove
monster-factory
monster-bulwark
monster-courtyard
-->
