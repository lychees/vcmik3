<!-- 由 scripts/generate-content-docs.mjs 生成，请勿手工编辑。 -->
# 法术图鉴（19 种）

> 数据来源：`src/game/content.ts`、`src/game/spells.ts`、`src/game/spellbook.ts`、`src/battle/magic.ts`、`src/battle/BattleEngine.ts`。运行 `npm run docs:generate` 重新生成，运行 `npm run docs:check` 校验。

本表覆盖 **19 种战斗法术**，按等级与注册 ID 排序。**P 表示进入战斗时英雄的有效法术力量**（含已装备宝物）。

| ID | 法术 | 派系 | 等级 | 法力 | 目标 | 精确效果 |
| --- | --- | --- | --- | --- | --- | --- |
| `bless` | 祝福术<br>Bless | 水系 | 1 | 5 | 一队友军<br>`ally` | 最小与最大伤害均 +2，持续 3 轮。 |
| `haste` | 攻击加速<br>Haste | 气系 | 1 | 6 | 一队友军<br>`ally` | 速度 +3，持续 3 轮。 |
| `magicArrow` | 魔法神箭<br>Magic Arrow | 气系 | 1 | 5 | 一队敌军<br>`enemy` | 造成 12 + 10 × P 点法术伤害。 |
| `spiritChannel` | 精神引导<br>Spirit Channel | 水系 | 1 | 5 | 施法英雄<br>`caster` | 支付施法消耗后，为施法者恢复至多 ⌊8 + 2 × P⌋ 点法力，不超过上限。 |
| `stoneSkin` | 石肤术<br>Stone Skin | 土系 | 1 | 6 | 一队友军<br>`ally` | 防御 +3，持续 3 轮。 |
| `battleFervor` | 战斗狂热<br>Battle Fervor | 火系 | 2 | 11 | 全部友军<br>`allAllies` | 攻击 +3，持续 3 轮。 |
| `cure` | 疗伤术<br>Cure | 水系 | 2 | 8 | 一队友军<br>`ally` | 恢复至多 20 + 10 × P 点总生命；可复活原格空闲的阵亡友军。 |
| `graniteAegis` | 花岗岩庇护<br>Granite Aegis | 土系 | 2 | 10 | 一队友军<br>`ally` | 防御 +5、受到伤害降低 15%，持续 3 轮。 |
| `slow` | 迟缓大法<br>Slow | 土系 | 2 | 8 | 一队敌军<br>`enemy` | 敌方速度 −3，持续 3 轮，最低速度仍为 1。 |
| `staticDisruption` | 静电扰断<br>Static Disruption | 气系 | 2 | 7 | 敌方英雄<br>`enemyHero` | 最多移除敌方英雄 ⌊6 + 2 × P⌋ 点法力，不超过其现有法力。 |
| `tailwind` | 顺风术<br>Tailwind | 气系 | 2 | 10 | 全部友军<br>`allAllies` | 速度 +2，持续 3 轮。 |
| `emberVolley` | 余烬齐射<br>Ember Volley | 火系 | 3 | 12 | 全部敌军<br>`allEnemies` | 每个有效目标受到 ⌊18 + 6 × P⌋ 伤害（至少 1）。 |
| `fireball` | 火球术<br>Fireball | 火系 | 3 | 15 | 全部敌军<br>`allEnemies` | 造成 30 + 10 × P 点法术伤害。 |
| `manaSiphon` | 法力虹吸<br>Mana Siphon | 火系 | 3 | 9 | 敌方英雄<br>`enemyHero` | 最多吸取敌方英雄 ⌊8 + 2 × P⌋ 点法力；施法者只能恢复支付本次消耗后仍可容纳的量。 |
| `mireHex` | 沼泽诅咒<br>Mire Hex | 土系 | 3 | 12 | 全部敌军<br>`allEnemies` | 攻击 -3、速度 -1，持续 3 轮。 |
| `tidalRenewal` | 潮汐复苏<br>Tidal Renewal | 水系 | 3 | 13 | 全部友军<br>`allAllies` | 每个目标恢复至多 ⌊16 + 5 × P⌋ 点总生命，不超过初始总生命；仅治疗受伤的存活友军，不复活。 |
| `fountainOfLife` | 生命之泉<br>Fountain of Life | 水系 | 4 | 14 | 一队友军<br>`ally` | 每个目标恢复至多 ⌊40 + 10 × P⌋ 点总生命，不超过初始总生命；可复活原格空闲的阵亡友军。 |
| `quakePulse` | 地震脉冲<br>Quake Pulse | 土系 | 4 | 16 | 双方全部兵种<br>`all` | 每个有效目标受到 ⌊20 + 6 × P⌋ 伤害（至少 1）。 |
| `stormRelay` | 风暴接力<br>Storm Relay | 气系 | 4 | 15 | 一队敌军<br>`enemy` | 首目标造成 ⌊30 + 9 × P⌋ 伤害，再跳向最近且尚未命中的敌军，最多 4 队；每跳伤害 × 0.7 并向下取整，至少 1。 |

## 共通施法规则

- 只能在己方某一队兵种行动时施法；每名英雄每轮限一次，但不消耗该队兵种的移动/攻击行动。必须有已知法术、足够法力与有效目标。
- 单体友军/敌军法术需要点选高亮目标；群体、施法者与敌方英雄法术立即结算。伤害法术受法术抗性减半及目标减伤影响，最终至少造成 1 点伤害。
- 基础法术的伤害/治疗量为注册 `power` + 10 × P；扩展法术按表内各自公式计算并向下取整。状态持续时间按战斗轮递减。
- 疗伤术与生命之泉复活时，必须另有存活友军，且阵亡队原有六角格未被占用或阻挡；治疗总量不超过该队初始总生命。
- 当前新游戏的英雄默认掌握全部 19 种法术。奥术图书馆按自身列表顺序补上第一项缺失法术，主要影响空魔法书或旧存档。

<!-- h3docs-registry:spell
bless
haste
magicArrow
spiritChannel
stoneSkin
battleFervor
cure
graniteAegis
slow
staticDisruption
tailwind
emberVolley
fireball
manaSiphon
mireHex
tidalRenewal
fountainOfLife
quakePulse
stormRelay
-->
