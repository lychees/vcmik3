<!-- 由 scripts/generate-content-docs.mjs 生成，请勿手工编辑。 -->
# 兵种总图鉴（72 种）

> 数据来源：`src/game/content.ts`、`src/game/factions.ts`、`src/game/neutral.ts`。运行 `npm run docs:generate` 重新生成，运行 `npm run docs:check` 校验。

共 **52 种阵营兵种 + 20 种中立兵种 = 72 种**。生命是单个兵种的生命；伤害、攻击、防御、速度和弹药均按注册基础值列出，不含英雄、装备或法术修正。招募费用与周增长均为每个兵种/每座对应巢穴的数值。

## 能力术语

- **远程 `ranged`**：不相邻且有弹药时可射击；超过 6 格、穿过障碍或城墙分别减半。远程兵种近战伤害减半。
- **飞行 `flying`**：可越过阻挡，但落点必须空闲，移动距离仍受速度限制。
- **额外反击 `retaliation`**：每轮最多反击 2 次；普通兵种为 1 次。反击只由近战触发。
- **双击 `doubleStrike`**：近战连续攻击两次，目标若能反击会在两次攻击之间反击。
- **再生 `regeneration`**：每轮首次开始行动时恢复单体最大生命的 10%（至少 1 点），不超过本队初始总生命。
- **法术抗性 `spellResistance`**：所受法术伤害减半并向下取整；不阻止增益、减益、治疗或法力效果。

## 圣堂 Haven

| ID | 兵种 | 阶级 | 攻 | 防 | 伤害 | 生命 | 速度 | 弹药 | 招募费用（每个） | 周增长 | 能力 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `militia` | 民兵<br>Militia | 1 | 3 | 4 | 1–3 | 8 | 4 | — | 55 金币 | +14 | 额外反击 `retaliation` |
| `archer` | 长弓手<br>Longbow Archer | 2 | 6 | 3 | 2–4 | 10 | 5 | 12 | 110 金币 | +9 | 远程 `ranged` |
| `griffin` | 风暴狮鹫<br>Storm Griffin | 3 | 8 | 8 | 3–6 | 25 | 7 | — | 220 金币 | +6 | 飞行 `flying`、额外反击 `retaliation` |
| `cavalier` | 太阳骑士<br>Sun Cavalier | 4 | 12 | 11 | 8–12 | 55 | 8 | — | 420 金币 | +4 | 双击 `doubleStrike` |

## 林地 Grove

| ID | 兵种 | 阶级 | 攻 | 防 | 伤害 | 生命 | 速度 | 弹药 | 招募费用（每个） | 周增长 | 能力 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `sprite` | 闪光小精灵<br>Glimmer Sprite | 1 | 4 | 2 | 1–3 | 5 | 7 | — | 50 金币 | +16 | 飞行 `flying` |
| `ranger` | 荆棘游侠<br>Thorn Ranger | 2 | 7 | 4 | 3–5 | 12 | 6 | 16 | 130 金币 | +9 | 远程 `ranged` |
| `unicorn` | 月光独角兽<br>Moon Unicorn | 3 | 10 | 10 | 6–10 | 40 | 8 | — | 320 金币 · 1 宝石 | +5 | 法术抗性 `spellResistance` |
| `dragon` | 翠叶巨龙<br>Verdant Dragon | 4 | 16 | 16 | 15–25 | 110 | 9 | — | 950 金币 · 2 水晶 | +2 | 飞行 `flying`、法术抗性 `spellResistance` |

## 炼狱 Ember

| ID | 兵种 | 阶级 | 攻 | 防 | 伤害 | 生命 | 速度 | 弹药 | 招募费用（每个） | 周增长 | 能力 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `imp` | 灰烬小鬼<br>Cinder Imp | 1 | 4 | 2 | 1–3 | 6 | 6 | — | 45 金币 | +16 | 飞行 `flying` |
| `hellhound` | 地狱猎犬<br>Hellhound | 2 | 7 | 4 | 3–5 | 14 | 8 | — | 135 金币 | +9 | 双击 `doubleStrike` |
| `ifrit` | 火巨灵<br>Ifrit | 3 | 10 | 10 | 6–10 | 40 | 8 | — | 350 金币 · 1 硫磺 | +5 | 飞行 `flying` |
| `pitFiend` | 深渊恶魔<br>Pit Fiend | 4 | 15 | 15 | 14–22 | 100 | 8 | — | 900 金币 · 3 硫磺 | +2 | 再生 `regeneration` |

## 沼泽 Mire

| ID | 兵种 | 阶级 | 攻 | 防 | 伤害 | 生命 | 速度 | 弹药 | 招募费用（每个） | 周增长 | 能力 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `lizardman` | 沼泽蜥蜴人<br>Mire Lizardman | 1 | 4 | 5 | 2–3 | 10 | 4 | — | 65 金币 | +12 | 额外反击 `retaliation` |
| `gorgon` | 泥潭蛇发兽<br>Bog Gorgon | 2 | 7 | 8 | 3–6 | 24 | 5 | — | 160 金币 · 1 水银 | +8 | 再生 `regeneration` |
| `wyvern` | 沼泽飞龙<br>Marsh Wyvern | 3 | 11 | 9 | 7–11 | 45 | 8 | — | 360 金币 · 1 水银 | +5 | 飞行 `flying` |
| `basilisk` | 石化蜥蜴<br>Basilisk | 4 | 14 | 16 | 12–20 | 105 | 6 | — | 875 金币 · 2 水晶 | +2 | 再生 `regeneration`、法术抗性 `spellResistance` |

## 塔楼 Tower

| ID | 兵种 | 阶级 | 攻 | 防 | 伤害 | 生命 | 速度 | 弹药 | 招募费用（每个） | 周增长 | 能力 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `gremlin` | 工匠小魔怪<br>Tinker Gremlin | 1 | 3 | 3 | 1–3 | 7 | 5 | 8 | 50 金币 | +16 | 远程 `ranged` |
| `stoneGargoyle` | 石像鬼<br>Stone Gargoyle | 2 | 7 | 8 | 2–5 | 22 | 7 | — | 150 金币 | +9 | 飞行 `flying` |
| `genie` | 星界巨灵<br>Astral Genie | 3 | 11 | 10 | 6–10 | 40 | 8 | — | 360 金币 · 1 宝石 | +5 | 飞行 `flying`、法术抗性 `spellResistance` |
| `titan` | 风暴泰坦<br>Storm Titan | 4 | 18 | 16 | 16–24 | 120 | 8 | 24 | 1,050 金币 · 3 宝石 | +2 | 远程 `ranged`、法术抗性 `spellResistance` |

## 墓园 Necropolis

| ID | 兵种 | 阶级 | 攻 | 防 | 伤害 | 生命 | 速度 | 弹药 | 招募费用（每个） | 周增长 | 能力 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `skeleton` | 墓地骷髅<br>Grave Skeleton | 1 | 4 | 3 | 1–3 | 8 | 5 | — | 50 金币 | +16 | 额外反击 `retaliation` |
| `zombie` | 复苏僵尸<br>Risen Zombie | 2 | 6 | 8 | 2–4 | 24 | 4 | — | 140 金币 | +9 | 再生 `regeneration` |
| `vampire` | 暗夜吸血鬼<br>Night Vampire | 3 | 11 | 10 | 6–10 | 40 | 8 | — | 380 金币 · 1 水银 | +5 | 飞行 `flying`、再生 `regeneration` |
| `ghostDragon` | 幽灵龙<br>Ghost Dragon | 4 | 17 | 15 | 15–25 | 120 | 9 | — | 1,000 金币 · 3 水银 | +2 | 飞行 `flying`、法术抗性 `spellResistance` |

## 地下城 Dungeon

| ID | 兵种 | 阶级 | 攻 | 防 | 伤害 | 生命 | 速度 | 弹药 | 招募费用（每个） | 周增长 | 能力 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `troglodyte` | 洞穴穴居人<br>Cave Troglodyte | 1 | 5 | 4 | 1–4 | 9 | 5 | — | 55 金币 | +15 | 额外反击 `retaliation` |
| `harpy` | 鹰身女妖<br>Harpy Hag | 2 | 8 | 4 | 3–5 | 16 | 9 | — | 155 金币 | +9 | 飞行 `flying`、双击 `doubleStrike` |
| `minotaur` | 迷宫牛头人<br>Labyrinth Minotaur | 3 | 12 | 11 | 7–12 | 50 | 7 | — | 400 金币 | +5 | 额外反击 `retaliation`、双击 `doubleStrike` |
| `redDragon` | 洞窟红龙<br>Cavern Red Dragon | 4 | 18 | 17 | 17–26 | 135 | 10 | — | 1,100 金币 · 3 硫磺 | +2 | 飞行 `flying`、法术抗性 `spellResistance` |

## 据点 Stronghold

| ID | 兵种 | 阶级 | 攻 | 防 | 伤害 | 生命 | 速度 | 弹药 | 招募费用（每个） | 周增长 | 能力 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `goblin` | 战斗哥布林<br>War Goblin | 1 | 5 | 2 | 1–3 | 7 | 6 | — | 45 金币 | +18 | 额外反击 `retaliation` |
| `wolfRider` | 狼骑兵<br>Wolf Rider | 2 | 9 | 4 | 3–6 | 18 | 9 | — | 150 金币 | +10 | 双击 `doubleStrike` |
| `ogre` | 战斗食人魔<br>War Ogre | 3 | 12 | 12 | 6–11 | 55 | 5 | — | 390 金币 · 1 硫磺 | +5 | 再生 `regeneration` |
| `behemoth` | 远古比蒙<br>Ancient Behemoth | 4 | 19 | 15 | 18–28 | 140 | 7 | — | 1,050 金币 · 2 水晶 | +2 | 额外反击 `retaliation` |

## 元素 Conflux

| ID | 兵种 | 阶级 | 攻 | 防 | 伤害 | 生命 | 速度 | 弹药 | 招募费用（每个） | 周增长 | 能力 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `pixie` | 电光仙子<br>Spark Pixie | 1 | 3 | 2 | 1–3 | 5 | 9 | — | 45 金币 | +18 | 飞行 `flying` |
| `airElemental` | 气元素<br>Air Elemental | 2 | 8 | 5 | 2–6 | 20 | 8 | — | 145 金币 | +10 | 飞行 `flying` |
| `stormElemental` | 风暴元素<br>Storm Elemental | 3 | 11 | 9 | 5–10 | 38 | 8 | 16 | 370 金币 · 2 宝石 | +5 | 远程 `ranged`、法术抗性 `spellResistance` |
| `phoenix` | 重生凤凰<br>Reborn Phoenix | 4 | 17 | 14 | 14–24 | 105 | 12 | — | 1,000 金币 · 2 水银 | +2 | 飞行 `flying`、再生 `regeneration` |

## 港湾 Cove

| ID | 兵种 | 阶级 | 攻 | 防 | 伤害 | 生命 | 速度 | 弹药 | 招募费用（每个） | 周增长 | 能力 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `nymph` | 潮汐宁芙<br>Tide Nymph | 1 | 4 | 3 | 1–3 | 8 | 6 | — | 55 金币 | +15 | 法术抗性 `spellResistance` |
| `corsair` | 海盗<br>Corsair | 2 | 8 | 5 | 3–5 | 18 | 7 | — | 150 金币 | +10 | 双击 `doubleStrike` |
| `seaWitch` | 海女巫<br>Sea Witch | 3 | 10 | 9 | 5–9 | 36 | 6 | 14 | 360 金币 · 2 水银 | +5 | 远程 `ranged`、法术抗性 `spellResistance` |
| `seaSerpent` | 深渊海蛇<br>Abyssal Sea Serpent | 4 | 17 | 17 | 16–25 | 135 | 7 | — | 1,100 金币 · 3 水晶 | +2 | 再生 `regeneration` |

## 工厂 Factory

| ID | 兵种 | 阶级 | 攻 | 防 | 伤害 | 生命 | 速度 | 弹药 | 招募费用（每个） | 周增长 | 能力 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `halfling` | 半身人投石手<br>Halfling Slinger | 1 | 4 | 3 | 1–3 | 8 | 5 | 8 | 50 金币 | +16 | 远程 `ranged` |
| `automaton` | 黄铜自动机<br>Brass Automaton | 2 | 7 | 9 | 2–5 | 28 | 5 | — | 165 金币 · 1 矿石 | +9 | 额外反击 `retaliation`、再生 `regeneration` |
| `dreadnought` | 钢铁无畏机<br>Iron Dreadnought | 3 | 12 | 13 | 6–11 | 60 | 5 | 18 | 420 金币 · 2 矿石 | +4 | 远程 `ranged`、再生 `regeneration` |
| `juggernaut` | 攻城毁灭者<br>Siege Juggernaut | 4 | 18 | 18 | 15–24 | 150 | 6 | — | 1,100 金币 · 4 矿石 | +2 | 双击 `doubleStrike`、法术抗性 `spellResistance` |

## 壁垒 Bulwark

| ID | 兵种 | 阶级 | 攻 | 防 | 伤害 | 生命 | 速度 | 弹药 | 招募费用（每个） | 周增长 | 能力 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `bandit` | 芦苇强盗<br>Reed Bandit | 1 | 5 | 3 | 2–4 | 9 | 6 | — | 60 金币 | +15 | 双击 `doubleStrike` |
| `hornet` | 巨型黄蜂<br>Giant Hornet | 2 | 7 | 4 | 2–5 | 15 | 9 | — | 135 金币 | +11 | 飞行 `flying` |
| `shaman` | 沼泽萨满<br>Mire Shaman | 3 | 10 | 10 | 5–9 | 38 | 6 | 12 | 350 金币 · 1 宝石 | +5 | 远程 `ranged`、法术抗性 `spellResistance` |
| `alligator` | 远古巨鳄<br>Ancient Alligator | 4 | 16 | 18 | 14–23 | 140 | 5 | — | 1,000 金币 · 2 水银 | +2 | 再生 `regeneration`、额外反击 `retaliation` |

## 庭院 Courtyard

| ID | 兵种 | 阶级 | 攻 | 防 | 伤害 | 生命 | 速度 | 弹药 | 招募费用（每个） | 周增长 | 能力 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `page` | 宫廷侍从<br>Court Page | 1 | 4 | 5 | 1–3 | 10 | 5 | — | 60 金币 | +14 | 额外反击 `retaliation` |
| `duelist` | 玫瑰决斗者<br>Rose Duelist | 2 | 9 | 6 | 3–6 | 20 | 8 | — | 165 金币 | +9 | 双击 `doubleStrike` |
| `courtWizard` | 宫廷法师<br>Court Wizard | 3 | 11 | 9 | 6–10 | 38 | 6 | 16 | 390 金币 · 2 宝石 | +5 | 远程 `ranged`、法术抗性 `spellResistance` |
| `royalLion` | 皇家翼狮<br>Royal Winged Lion | 4 | 17 | 16 | 15–24 | 120 | 10 | — | 1,050 金币 · 2 水晶 | +2 | 飞行 `flying`、双击 `doubleStrike` |

## 中立生物

中立生物没有阵营城镇专属巢穴；它们出现在固定混合遭遇中。模型、位置和奖励见[中立模型与遭遇](./neutrals.md)。

| ID | 兵种 | 阶级 | 攻 | 防 | 伤害 | 生命 | 速度 | 弹药 | 招募费用（每个） | 周增长 | 能力 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `ratling` | 鼠人<br>Ratling | 1 | 3 | 2 | 1–3 | 6 | 7 | — | 45 金币 | +18 | 额外反击 `retaliation` |
| `mummy` | 木乃伊<br>Mummy | 1 | 5 | 5 | 2–3 | 14 | 4 | — | 80 金币 | +12 | 再生 `regeneration` |
| `giantSpider` | 巨型蜘蛛<br>Giant Spider | 1 | 5 | 3 | 1–4 | 10 | 6 | — | 75 金币 | +14 | 双击 `doubleStrike` |
| `seaHag` | 海妖婆<br>Sea Hag | 2 | 7 | 5 | 3–5 | 18 | 5 | 10 | 145 金币 · 1 水银 | +9 | 远程 `ranged`、法术抗性 `spellResistance` |
| `direBear` | 凶暴熊<br>Dire Bear | 2 | 8 | 8 | 4–6 | 28 | 6 | — | 180 金币 | +8 | 额外反击 `retaliation` |
| `cerberus` | 三头地狱犬<br>Cerberus | 2 | 9 | 6 | 3–6 | 24 | 8 | — | 190 金币 · 1 硫磺 | +8 | 双击 `doubleStrike` |
| `broodMother` | 巢母<br>Brood Mother | 2 | 8 | 7 | 3–6 | 26 | 5 | — | 175 金币 | +8 | 再生 `regeneration`、额外反击 `retaliation` |
| `wraith` | 怨灵<br>Wraith | 2 | 8 | 6 | 3–6 | 20 | 7 | — | 170 金币 · 1 宝石 | +9 | 飞行 `flying`、法术抗性 `spellResistance` |
| `golem` | 符文魔像<br>Runic Golem | 3 | 11 | 13 | 6–9 | 55 | 5 | — | 390 金币 · 2 矿石 | +5 | 额外反击 `retaliation`、法术抗性 `spellResistance` |
| `manticore` | 蝎尾狮<br>Manticore | 3 | 12 | 9 | 7–11 | 45 | 9 | — | 380 金币 | +5 | 飞行 `flying`、双击 `doubleStrike` |
| `sandWyrm` | 沙虫<br>Sand Wyrm | 3 | 12 | 11 | 7–12 | 58 | 6 | — | 420 金币 | +5 | 再生 `regeneration` |
| `ent` | 远古树人<br>Ancient Ent | 3 | 10 | 13 | 6–10 | 65 | 5 | — | 400 金币 · 2 木材 | +4 | 额外反击 `retaliation`、再生 `regeneration` |
| `iceWyrm` | 冰霜巨虫<br>Ice Wyrm | 3 | 12 | 10 | 7–11 | 48 | 8 | — | 410 金币 · 1 水晶 | +5 | 飞行 `flying`、法术抗性 `spellResistance` |
| `basiliskKing` | 蜥蜴王<br>Basilisk King | 3 | 13 | 12 | 8–12 | 60 | 6 | — | 460 金币 · 1 水晶 | +4 | 额外反击 `retaliation`、法术抗性 `spellResistance` |
| `lich` | 巫妖<br>Lich | 3 | 12 | 10 | 7–10 | 42 | 6 | 12 | 430 金币 · 1 水银 | +5 | 远程 `ranged`、法术抗性 `spellResistance` |
| `beholder` | 眼魔<br>Beholder | 4 | 16 | 14 | 14–20 | 95 | 7 | 12 | 900 金币 · 2 宝石 | +2 | 远程 `ranged`、飞行 `flying`、法术抗性 `spellResistance` |
| `kraken` | 克拉肯<br>Kraken | 4 | 17 | 17 | 16–24 | 130 | 7 | — | 1,100 金币 · 2 水银 | +2 | 额外反击 `retaliation`、再生 `regeneration` |
| `frostGiant` | 霜巨人<br>Frost Giant | 4 | 18 | 16 | 16–25 | 140 | 6 | — | 1,200 金币 · 2 水晶 | +2 | 额外反击 `retaliation`、法术抗性 `spellResistance` |
| `balor` | 巴洛炎魔<br>Balor | 4 | 19 | 15 | 18–26 | 115 | 9 | — | 1,250 金币 · 3 硫磺 | +2 | 飞行 `flying`、双击 `doubleStrike` |
| `hydra` | 沼泽九头蛇<br>Swamp Hydra | 4 | 17 | 18 | 15–24 | 135 | 6 | — | 1,150 金币 · 2 水银 | +2 | 额外反击 `retaliation`、再生 `regeneration` |

<!-- h3docs-registry:creature
militia
archer
griffin
cavalier
sprite
ranger
unicorn
dragon
imp
hellhound
ifrit
pitFiend
lizardman
gorgon
wyvern
basilisk
gremlin
stoneGargoyle
genie
titan
skeleton
zombie
vampire
ghostDragon
troglodyte
harpy
minotaur
redDragon
goblin
wolfRider
ogre
behemoth
pixie
airElemental
stormElemental
phoenix
nymph
corsair
seaWitch
seaSerpent
halfling
automaton
dreadnought
juggernaut
bandit
hornet
shaman
alligator
page
duelist
courtWizard
royalLion
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

<!-- h3docs-registry:faction-creature
militia
archer
griffin
cavalier
sprite
ranger
unicorn
dragon
imp
hellhound
ifrit
pitFiend
lizardman
gorgon
wyvern
basilisk
gremlin
stoneGargoyle
genie
titan
skeleton
zombie
vampire
ghostDragon
troglodyte
harpy
minotaur
redDragon
goblin
wolfRider
ogre
behemoth
pixie
airElemental
stormElemental
phoenix
nymph
corsair
seaWitch
seaSerpent
halfling
automaton
dreadnought
juggernaut
bandit
hornet
shaman
alligator
page
duelist
courtWizard
royalLion
-->

<!-- h3docs-registry:neutral-creature
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
