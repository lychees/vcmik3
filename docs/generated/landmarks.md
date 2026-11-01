<!-- 由 scripts/generate-content-docs.mjs 生成，请勿手工编辑。 -->
# 地标类型、访问规则与传送门

> 数据来源：`src/game/landmarks.ts`、`src/game/types.ts`、`src/game/map.ts`、`src/game/GameStore.ts`。运行 `npm run docs:generate` 重新生成，运行 `npm run docs:check` 校验。

当前有 **10 种地标、默认地图 11 个地标对象**；旅者传送门成对出现，因此对象数比类型数多 1。

| 类型 ID | 地标 | 效果 | 复用规则 | 默认对象与界面坐标 |
| --- | --- | --- | --- | --- |
| `arcaneLibrary` | 奥术图书馆<br>Arcane Library | 按图书馆列表顺序教授第一项未知法术（列表含全部 19 种）；全部已知时不消耗访问机会。 | 每位英雄永久一次<br>`never` | `landmark-arcaneLibrary`<br>(15, 5) |
| `warriorsArena` | 勇士竞技场<br>Warriors' Arena | 来访英雄基础攻击永久 +1。 | 每位英雄永久一次<br>`never` | `landmark-warriorsArena`<br>(32, 5) |
| `heroesShrine` | 英雄神龛<br>Heroes' Shrine | 来访英雄获得 1,000 经验，可触发升级。 | 每位英雄永久一次<br>`never` | `landmark-heroesShrine`<br>(54, 5) |
| `huntersLodge` | 猎人木屋<br>Hunters' Lodge | 来访英雄基础防御永久 +1。 | 每位英雄永久一次<br>`never` | `landmark-huntersLodge`<br>(15, 17) |
| `waterwheel` | 水车<br>Waterwheel | 来访英雄当前移动力恢复至最大值。 | 每位英雄每天一次<br>`daily` | `landmark-waterwheel`<br>(54, 17) |
| `elementalForge` | 元素锻炉<br>Elemental Forge | 来访英雄基础攻击与基础防御均永久 +1。 | 每位英雄永久一次<br>`never` | `landmark-elementalForge`<br>(15, 37) |
| `ancientObservatory` | 远古天文台<br>Ancient Observatory | 以来访对象为中心，将半径 8 的圆形范围加入该玩家的已探索区域，随后更新可见战争迷雾。 | 每位英雄永久一次<br>`never` | `landmark-ancientObservatory`<br>(54, 37) |
| `healersSanctuary` | 医者圣所<br>Healers' Sanctuary | 来访英雄当前法力恢复至最大值。 | 每位英雄每天一次<br>`daily` | `landmark-healersSanctuary`<br>(32, 37) |
| `wayfarerPortal` | 旅者传送门<br>Wayfarer Portal | 传到双向链接的另一座旅者传送门；目的地被其他存活英雄占用时不传送。 | 不限次数<br>`always` | `landmark-wayfarerPortal-west`<br>(15, 44)<br>`landmark-wayfarerPortal-east`<br>(54, 44) |
| `merchantsTent` | 商人帐篷<br>Merchants' Tent | 支付 500 金币，获得 1 木材 · 1 矿石；金币不足时不交易。 | 每位英雄每天一次<br>`daily` | `landmark-merchantsTent`<br>(32, 17) |

## `visits`、每日重置与失败访问

- 成功互动会记录 `object.visits[hero.id] = 当前总天数`。限制按**地标对象 + 英雄**分别计算，不是全玩家或全英雄共享。
- `never`：该英雄在同一对象上只能成功使用一次；`daily`：仅当记录天数等于当前天数时不可再用，新的一天自动恢复，无需清空记录；`always`：忽略访问记录。
- 对象若被标记 `depleted`，一律视为已使用。默认地图的对象初始均未耗尽。
- 已会全部图书馆法术、传送门目的地被占用、商人交易金币不足时，效果不会发生，也不会写入本次成功访问记录。重复进入已用对象不会再次生效。

## 成对旅者传送门

| 对象 | 界面坐标 | 双向链接目标 |
| --- | --- | --- |
| `landmark-wayfarerPortal-west` | (15, 44) | `landmark-wayfarerPortal-east` |
| `landmark-wayfarerPortal-east` | (54, 44) | `landmark-wayfarerPortal-west` |

两端必须互相链接，存档校验会拒绝单向、自连或缺失目标。成功传送会更新英雄位置与战争迷雾，并在两端记录访问；由于类型为 `always`，记录不妨碍再次使用。目的格若被其他存活英雄占据，则本次无法旅行。

<!-- h3docs-registry:landmark
arcaneLibrary
warriorsArena
heroesShrine
huntersLodge
waterwheel
elementalForge
ancientObservatory
healersSanctuary
wayfarerPortal
merchantsTent
-->

<!-- h3docs-registry:landmark-object
landmark-arcaneLibrary
landmark-warriorsArena
landmark-heroesShrine
landmark-huntersLodge
landmark-waterwheel
landmark-elementalForge
landmark-ancientObservatory
landmark-healersSanctuary
landmark-wayfarerPortal-west
landmark-wayfarerPortal-east
landmark-merchantsTent
-->
