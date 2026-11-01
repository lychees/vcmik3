import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const checkMode = process.argv.includes('--check');
const unknownArgs = process.argv.slice(2).filter((argument) => argument !== '--check');
if (unknownArgs.length > 0) throw new Error(`Unknown arguments: ${unknownArgs.join(', ')}`);

const EXPECTED_COUNTS = Object.freeze({
  factions: 13,
  buildings: 57,
  factionCreatures: 52,
  neutralCreatures: 20,
  creatures: 72,
  artifacts: 20,
  spells: 19,
  resources: 10,
  landmarkTypes: 10,
  landmarkObjects: 11,
  neutralEncounters: 10,
  monsterEncounters: 24,
});

const zh = {
  factions: {
    haven: '圣堂', grove: '林地', ember: '炼狱', mire: '沼泽', tower: '塔楼',
    necropolis: '墓园', dungeon: '地下城', stronghold: '据点', conflux: '元素',
    cove: '港湾', factory: '工厂', bulwark: '壁垒', courtyard: '庭院', Neutral: '中立',
  },
  towns: {
    haven: '星芒要塞', grove: '月华林谷', ember: '灰烬堡垒', mire: '沉没沼泽',
    tower: '星辉高塔', necropolis: '灵魂帷幕', dungeon: '黑曜深渊', stronghold: '雷霆堡垒',
    conflux: '元素枢纽', cove: '潮汐港', factory: '黄铜工坊堡垒', bulwark: '芦墙庇护所',
    courtyard: '玫瑰宫廷',
  },
  heroes: {
    aveline: '艾芙琳', rowan: '罗文', seraphine: '塞拉芬', morven: '莫尔文', solmyr: '索尔米尔',
    isra: '伊斯拉', darkstorn: '达克斯通', yog: '约格', labetha: '拉贝莎', derek: '德里克',
    todd: '托德', eliza: '伊丽莎', beatrice: '碧翠丝',
  },
  specialties: {
    Logistics: '后勤学', Scouting: '侦察术', 'Fire Magic': '火焰魔法', 'Swamp Lore': '沼泽知识',
    'Chain Lightning': '连锁闪电', Necromancy: '招魂术', 'Subterranean Paths': '地下路径',
    Offense: '进攻术', 'Elemental Magic': '元素魔法', Navigation: '航海术', Artillery: '炮术',
    'Guerrilla Tactics': '游击战术', Diplomacy: '外交术',
  },
  resources: {
    gold: '金币', wood: '木材', ore: '矿石', crystal: '水晶', gems: '宝石', mercury: '水银',
    sulfur: '硫磺', mithril: '秘银', obsidian: '黑曜石', essence: '魔法精粹',
  },
  resourceDescriptions: {
    gold: '通用货币，用于全部建筑、全部阵营兵种招募以及商人交易。',
    wood: '基础建材，广泛用于市政与军事建筑；部分中立兵种也需要。',
    ore: '基础建材，用于城防、高级建筑和工厂兵种。',
    crystal: '稀有建材，用于高阶建筑以及部分高阶兵种。',
    gems: '稀有魔法材料，用于塔楼、元素等阵营建筑和远程施法兵种。',
    mercury: '稀有炼金材料，用于沼泽、墓园、港湾等建筑与兵种。',
    sulfur: '稀有炼金材料，用于炼狱、地下城等建筑与兵种。',
    mithril: '轻而坚韧的银蓝金属；当前用于国会建设。',
    obsidian: '具有锋利边缘与防护附魔价值的火山玻璃；当前用于国会建设。',
    essence: '凝聚的魔法能量；当前用于法师公会建设。',
  },
  abilities: {
    ranged: '远程', flying: '飞行', retaliation: '额外反击', doubleStrike: '双击',
    regeneration: '再生', spellResistance: '法术抗性',
  },
  slots: { weapon: '武器', armor: '护甲', helmet: '头盔', boots: '靴子', trinket: '饰品' },
  rarities: { common: '普通', rare: '稀有', epic: '史诗', legendary: '传说' },
  stats: { attack: '攻击', defense: '防御', spellPower: '法术力量', knowledge: '知识' },
  schools: { air: '气系', earth: '土系', fire: '火系', water: '水系' },
  targets: {
    self: '当前己方兵种', ally: '一队友军', enemy: '一队敌军', allEnemies: '全部敌军',
    all: '双方全部兵种', allAllies: '全部友军', caster: '施法英雄', enemyHero: '敌方英雄',
  },
  creatures: {
    militia: '民兵', archer: '长弓手', griffin: '风暴狮鹫', cavalier: '太阳骑士',
    sprite: '闪光小精灵', ranger: '荆棘游侠', unicorn: '月光独角兽', dragon: '翠叶巨龙',
    imp: '灰烬小鬼', hellhound: '地狱猎犬', ifrit: '火巨灵', pitFiend: '深渊恶魔',
    lizardman: '沼泽蜥蜴人', gorgon: '泥潭蛇发兽', wyvern: '沼泽飞龙', basilisk: '石化蜥蜴',
    gremlin: '工匠小魔怪', stoneGargoyle: '石像鬼', genie: '星界巨灵', titan: '风暴泰坦',
    skeleton: '墓地骷髅', zombie: '复苏僵尸', vampire: '暗夜吸血鬼', ghostDragon: '幽灵龙',
    troglodyte: '洞穴穴居人', harpy: '鹰身女妖', minotaur: '迷宫牛头人', redDragon: '洞窟红龙',
    goblin: '战斗哥布林', wolfRider: '狼骑兵', ogre: '战斗食人魔', behemoth: '远古比蒙',
    pixie: '电光仙子', airElemental: '气元素', stormElemental: '风暴元素', phoenix: '重生凤凰',
    nymph: '潮汐宁芙', corsair: '海盗', seaWitch: '海女巫', seaSerpent: '深渊海蛇',
    halfling: '半身人投石手', automaton: '黄铜自动机', dreadnought: '钢铁无畏机', juggernaut: '攻城毁灭者',
    bandit: '芦苇强盗', hornet: '巨型黄蜂', shaman: '沼泽萨满', alligator: '远古巨鳄',
    page: '宫廷侍从', duelist: '玫瑰决斗者', courtWizard: '宫廷法师', royalLion: '皇家翼狮',
    ratling: '鼠人', mummy: '木乃伊', giantSpider: '巨型蜘蛛', seaHag: '海妖婆',
    direBear: '凶暴熊', cerberus: '三头地狱犬', broodMother: '巢母', wraith: '怨灵',
    golem: '符文魔像', manticore: '蝎尾狮', sandWyrm: '沙虫', ent: '远古树人',
    iceWyrm: '冰霜巨虫', basiliskKing: '蜥蜴王', lich: '巫妖', beholder: '眼魔',
    kraken: '克拉肯', frostGiant: '霜巨人', balor: '巴洛炎魔', hydra: '沼泽九头蛇',
  },
  buildings: {
    townHall: '市政厅', capitol: '国会', market: '市场', fort: '堡垒', mageGuild: '法师公会',
    militiaBarracks: '民兵营房', archeryRange: '弓箭靶场', griffinTower: '狮鹫塔', joustingArena: '骑士竞技场',
    spriteGlade: '小精灵林地', rangerLodge: '游侠木屋', unicornGrove: '独角兽圣林', dragonCliffs: '巨龙悬崖',
    impWarrens: '小鬼巢穴', hellhoundKennels: '地狱犬舍', ifritSpire: '火巨灵高塔', pitFiendAbyss: '深渊恶魔裂隙',
    lizardmanDen: '蜥蜴人巢穴', gorgonPen: '蛇发兽围栏', wyvernRoost: '飞龙栖巢', basiliskPit: '石化蜥蜴深坑',
    gremlinWorkshop: '小魔怪工坊', gargoyleParapet: '石像鬼城垛', geniePavilion: '巨灵亭阁', titanCloudTemple: '泰坦云端神殿',
    skeletonCrypt: '骷髅地穴', zombieGraveyard: '僵尸墓园', vampireEstate: '吸血鬼庄园', ghostDragonSepulcher: '幽灵龙陵墓',
    troglodyteWarrens: '穴居人洞窟', harpyRoost: '鹰身女妖栖巢', minotaurLabyrinth: '牛头人迷宫', redDragonCavern: '红龙洞窟',
    goblinBarracks: '哥布林营房', wolfPen: '狼骑兵围栏', ogreFort: '食人魔堡垒', behemothCliffs: '比蒙悬崖',
    pixieGarden: '仙子花园', airElementalAltar: '气元素祭坛', stormElementalSpire: '风暴元素高塔', phoenixPyre: '凤凰火葬堆',
    nymphGrotto: '宁芙石窟', corsairTavern: '海盗酒馆', seaWitchTower: '海女巫塔', seaSerpentCove: '海蛇港湾',
    halflingHovels: '半身人小屋', automatonAssembly: '自动机装配厂', dreadnoughtFoundry: '无畏机铸造厂', juggernautHangar: '毁灭者机库',
    banditHideout: '强盗藏身处', hornetNest: '巨型黄蜂巢', shamanLodge: '萨满木屋', alligatorPit: '远古巨鳄池',
    pageBarracks: '侍从营房', duelistSalon: '决斗者沙龙', courtWizardLibrary: '宫廷法师图书馆', royalLionGarden: '皇家翼狮花园',
  },
  artifacts: {
    copperSunblade: '赤铜日刃', stormcallersEdge: '唤风者之刃', starforgedBlade: '星铸之剑', worldrenderMaul: '裂界重锤',
    mosswovenCuirass: '苔织胸甲', mirrorScale: '镜面鳞甲', aegisOfEmbers: '余烬庇护', bulwarkOfAges: '万古壁垒',
    wayfarersCirclet: '旅者头环', sagesDiadem: '贤者冠冕', crownOfStarlight: '星光王冠', mindfireCrown: '灵焰王冠',
    surefootGreaves: '稳足胫甲', windrunnerBoots: '风行靴', thunderstrideSabatons: '雷霆战靴', bootsOfTheHorizon: '地平线之靴',
    dawnstoneCharm: '晨曦石护符', whisperingLocket: '低语吊坠', phoenixHourglass: '凤凰沙漏', astralHeart: '星界之心',
  },
  artifactFlavors: {
    copperSunblade: '晨曦温养的剑刃，让持有者攻击更稳。', stormcallersEdge: '蕴藏雷霆的钩刃。',
    starforgedBlade: '陨星钢同时锤炼攻击与防守。', worldrenderMaul: '巨锤以沉稳挥击揭示破绽。',
    mosswovenCuirass: '活苔与树皮缓冲来袭攻击。', mirrorScale: '交错银鳞偏转敌人的精准攻击。',
    aegisOfEmbers: '胸甲中的余火回应每一次攻击。', bulwarkOfAges: '古老甲片铭记历代守军战术。',
    wayfarersCirclet: '旅途磨旧的圆环，保存旧日学识。', sagesDiadem: '双月石连接记忆与法术塑形。',
    crownOfStarlight: '冷星光映照更深层的魔法潮流。', mindfireCrown: '受控火焰驱散杂念并点燃奥术洞见。',
    surefootGreaves: '平衡的胫甲让战士在重击下站稳。', windrunnerBoots: '随行之风加快进攻与撤退。',
    thunderstrideSabatons: '每一步都携带风暴的力量与怒火。', bootsOfTheHorizon: '远见附魔揭示攻防与求学之路。',
    dawnstoneCharm: '小型法器中留着清晨第一缕光。', whisperingLocket: '低语声诵读被遗忘的名字与地点。',
    phoenixHourglass: '玻璃中的余烬均衡强化四项纪律。', astralHeart: '夜空碎片随持有者的心跳搏动。',
  },
  spells: {
    magicArrow: '魔法神箭', stoneSkin: '石肤术', haste: '攻击加速', slow: '迟缓大法',
    cure: '疗伤术', fireball: '火球术', bless: '祝福术', stormRelay: '风暴接力',
    tailwind: '顺风术', staticDisruption: '静电扰断', graniteAegis: '花岗岩庇护', quakePulse: '地震脉冲',
    mireHex: '沼泽诅咒', emberVolley: '余烬齐射', battleFervor: '战斗狂热', manaSiphon: '法力虹吸',
    spiritChannel: '精神引导', fountainOfLife: '生命之泉', tidalRenewal: '潮汐复苏',
  },
  landmarks: {
    arcaneLibrary: '奥术图书馆', warriorsArena: '勇士竞技场', heroesShrine: '英雄神龛', huntersLodge: '猎人木屋',
    waterwheel: '水车', elementalForge: '元素锻炉', ancientObservatory: '远古天文台', healersSanctuary: '医者圣所',
    wayfarerPortal: '旅者传送门', merchantsTent: '商人帐篷',
  },
  encounters: {
    'monster-west': '路边盗匪', 'monster-east': '野生小精灵', 'monster-dragon': '远古巨龙',
    'monster-ember': '灰烬先锋', 'monster-mire': '沼泽统领', 'monster-neutral-arcane': '奥术哨兵',
    'monster-neutral-aquatic': '利齿潮汐', 'monster-neutral-beasts': '蛮荒兽群', 'monster-neutral-desert': '沙丘亡者',
    'monster-neutral-forest': '棘木守卫', 'monster-neutral-ice': '冰封巢群', 'monster-neutral-infernal': '炼狱猎杀',
    'monster-neutral-reptile': '王冠鳞群', 'monster-neutral-swarm': '地穴虫群', 'monster-neutral-undead': '帷幕宫廷',
  },
  neutralModels: {
    ratling: '啮齿拾荒者', mummy: '缠布复苏亡者', giantSpider: '八足巨蛛', seaHag: '潮汐女巫',
    direBear: '凶暴巨熊', cerberus: '三头猎犬', broodMother: '巢群女王', wraith: '兜帽幽灵',
    golem: '符文石构体', manticore: '有翼蝎尾狮', sandWyrm: '装甲沙虫', ent: '远古树木守卫',
    iceWyrm: '无翼冰霜巨虫', basiliskKing: '王冠兜帽蜥蜴', lich: '加冕亡灵施法者', beholder: '多眼悬浮暴君',
    kraken: '八臂海怪', frostGiant: '装甲霜巨人', balor: '有翼火焰恶魔', hydra: '三头沼泽九头蛇',
  },
};

function nameOf(kind, id, fallback) {
  return zh[kind]?.[id] ?? fallback ?? id;
}

function escapeCell(value) {
  return String(value).replaceAll('|', '\\|').replaceAll('\n', '<br>');
}

function table(headers, rows) {
  return [
    `| ${headers.map(escapeCell).join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map(escapeCell).join(' | ')} |`),
    '',
  ].join('\n');
}

function displayName(kind, id, english) {
  return `${nameOf(kind, id, english)}<br>${english}`;
}

function formatNumber(value) {
  return new Intl.NumberFormat('zh-CN').format(value);
}

function formatPoint(point) {
  return `(${point.x + 1}, ${point.y + 1})`;
}

function formatHex(value) {
  return `#${Number(value).toString(16).padStart(6, '0')}`;
}

function coverage(kind, ids) {
  return `\n<!-- h3docs-registry:${kind}\n${ids.join('\n')}\n-->\n`;
}

function generatedHeader(title, sources) {
  return `<!-- 由 scripts/generate-content-docs.mjs 生成，请勿手工编辑。 -->\n# ${title}\n\n> 数据来源：${sources.map((source) => `\`${source}\``).join('、')}。运行 \`npm run docs:generate\` 重新生成，运行 \`npm run docs:check\` 校验。\n\n`;
}

function assertCount(label, actual, expected) {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, received ${actual}`);
}

function assertSameIds(label, actual, expected) {
  const left = [...actual].sort();
  const right = [...expected].sort();
  if (left.length !== right.length || left.some((id, index) => id !== right[index])) {
    throw new Error(`${label} IDs differ.\nActual: ${left.join(', ')}\nExpected: ${right.join(', ')}`);
  }
}

function disposeModel(model) {
  const geometries = new Set();
  const materials = new Set();
  model.traverse((child) => {
    if (!child.isMesh && !child.isPoints && !child.isLine) return;
    geometries.add(child.geometry);
    for (const material of Array.isArray(child.material) ? child.material : [child.material]) materials.add(material);
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
}

let registry;

function costText(cost, empty = '无') {
  const parts = registry.resourceIds
    .filter((resource) => (cost?.[resource] ?? 0) !== 0)
    .map((resource) => `${formatNumber(cost[resource])} ${nameOf('resources', resource)}`);
  return parts.length > 0 ? parts.join(' · ') : empty;
}

function armyText(army) {
  return army.map((stack) => {
    const creature = registry.creatureById[stack.creatureId];
    return `${stack.count} × ${nameOf('creatures', stack.creatureId, creature?.name)}（\`${stack.creatureId}\`）`;
  }).join('<br>');
}

function prerequisitesText(building) {
  if (building.prerequisites.length === 0) return '无';
  return building.prerequisites.map((id) => `${nameOf('buildings', id, registry.buildingById[id]?.name)}（\`${id}\`）`).join('、');
}

function buildingEffect(building) {
  if (building.creatureId) {
    const creature = registry.creatureById[building.creatureId];
    return `招募${nameOf('creatures', creature.id, creature.name)}；每周增长 +${creature.growth}，建成时立即增加同等可招募数量`;
  }
  if (building.id === 'fort') return '军事巢穴的共同前置建筑；提供守军城防主题';
  if (building.id === 'mageGuild') return '解锁城镇中来访英雄的魔法书视图；不直接施法或教学';
  if (building.dailyIncome) return `每日产出 ${costText(building.dailyIncome)}`;
  return building.description;
}

function buildingModelText(spec) {
  return `${spec.form}<br>占地 ${spec.footprint.join(' × ')}；高度 ${spec.height}`;
}

function generateFactions() {
  let output = generatedHeader('阵营、城镇与建筑链', [
    'src/game/factions.ts', 'src/game/content.ts', 'src/game/map.ts', 'src/game/scenario.ts', 'src/town/registry.ts',
  ]);
  output += `本册覆盖 **${registry.factions.length} 个阵营/城镇、${registry.buildings.length} 种建筑**。每座城都有 5 种共同建筑与 4 级专属兵种建筑，共 9 个可交互 3D 建筑位置。坐标采用游戏界面显示的一基坐标；默认地图种子为 \`${registry.map.seed}\`。\n\n`;
  output += '## 共同建筑\n\n以下 5 种建筑出现在每个阵营的城镇中。模型栏依次给出注册模型形式、占地与高度。\n\n';
  output += table(
    ['ID', '建筑', '费用', '前置', '作用', '3D 模型'],
    registry.townRegistry.COMMON_BUILDING_IDS.map((id) => {
      const building = registry.buildingById[id];
      return [`\`${id}\``, displayName('buildings', id, building.name), costText(building.cost), prerequisitesText(building), buildingEffect(building), buildingModelText(registry.buildingSpecs[id])];
    }),
  );
  output += '\n建筑费用从玩家共享库存扣除；每城每天只能完成一个项目，已建项目不能重复建造。高阶兵种建筑按各阵营链条逐级解锁。\n\n';
  for (const faction of registry.factions) {
    const town = registry.state.towns[faction.id];
    const townObject = Object.values(registry.map.objects).find((object) => object.kind === 'town' && object.townId === faction.id);
    const hero = registry.heroById[faction.heroId];
    const owner = registry.state.players[town.ownerId];
    output += `## ${nameOf('factions', faction.id, faction.name)} ${faction.name}（\`${faction.id}\`）\n\n`;
    output += `- **城镇**：${nameOf('towns', faction.id, faction.townName)} ${faction.townName}（\`${faction.townName}\`），界面坐标 **${formatPoint(town.position)}**，地图对象 \`${townObject.id}\`。\n`;
    output += `- **初始归属**：${owner.name}（\`${owner.id}\`，${owner.isAI ? 'AI' : '人类'}）。初始建筑：${town.buildings.map((id) => `${nameOf('buildings', id, registry.buildingById[id].name)} \`${id}\``).join('、')}。\n`;
    output += `- **注册英雄**：${nameOf('heroes', hero.id, hero.name)} ${hero.name}（\`${hero.id}\`），专长${nameOf('specialties', hero.specialty, hero.specialty)}；攻击/防御/法术力量/知识为 **${hero.primarySkills.attack}/${hero.primarySkills.defense}/${hero.primarySkills.spellPower}/${hero.primarySkills.knowledge}**。\n`;
    output += `- **英雄初始军队**：${armyText(hero.startingArmy)}。定义所列法术：${hero.spells.map((id) => `\`${id}\``).join('、')}；当前新游戏实际通过默认魔法书获得全部 ${registry.spells.length} 种法术。\n\n`;
    output += table(
      ['等级', '建筑 / ID', '费用', '前置', '对应兵种与增长', '3D 模型'],
      faction.buildingIds.map((id, index) => {
        const building = registry.buildingById[id];
        const creature = registry.creatureById[building.creatureId];
        return [
          String(index + 1),
          `${displayName('buildings', id, building.name)}<br>\`${id}\``,
          costText(building.cost),
          prerequisitesText(building),
          `${displayName('creatures', creature.id, creature.name)}<br>每周 +${creature.growth}`,
          buildingModelText(registry.buildingSpecs[id]),
        ];
      }),
    );
    output += '\n';
  }
  output += coverage('faction', registry.factions.map((faction) => faction.id));
  output += coverage('building', registry.buildings.map((building) => building.id));
  return output;
}

function creatureTable(creatures) {
  return table(
    ['ID', '兵种', '阶级', '攻', '防', '伤害', '生命', '速度', '弹药', '招募费用（每个）', '周增长', '能力'],
    creatures.map((creature) => [
      `\`${creature.id}\``, displayName('creatures', creature.id, creature.name), String(creature.tier),
      String(creature.attack), String(creature.defense), `${creature.damage[0]}–${creature.damage[1]}`,
      String(creature.health), String(creature.speed), creature.shots > 0 ? String(creature.shots) : '—',
      costText(creature.cost), `+${creature.growth}`,
      creature.abilities.length > 0 ? creature.abilities.map((ability) => `${nameOf('abilities', ability, ability)} \`${ability}\``).join('、') : '无',
    ]),
  );
}

function generateCreatures() {
  let output = generatedHeader('兵种总图鉴（72 种）', ['src/game/content.ts', 'src/game/factions.ts', 'src/game/neutral.ts']);
  output += `共 **${registry.factionCreatures.length} 种阵营兵种 + ${registry.neutralCreatures.length} 种中立兵种 = ${registry.creatures.length} 种**。生命是单个兵种的生命；伤害、攻击、防御、速度和弹药均按注册基础值列出，不含英雄、装备或法术修正。招募费用与周增长均为每个兵种/每座对应巢穴的数值。\n\n`;
  output += '## 能力术语\n\n';
  output += '- **远程 `ranged`**：不相邻且有弹药时可射击；超过 6 格、穿过障碍或城墙分别减半。远程兵种近战伤害减半。\n';
  output += '- **飞行 `flying`**：可越过阻挡，但落点必须空闲，移动距离仍受速度限制。\n';
  output += '- **额外反击 `retaliation`**：每轮最多反击 2 次；普通兵种为 1 次。反击只由近战触发。\n';
  output += '- **双击 `doubleStrike`**：近战连续攻击两次，目标若能反击会在两次攻击之间反击。\n';
  output += '- **再生 `regeneration`**：每轮首次开始行动时恢复单体最大生命的 10%（至少 1 点），不超过本队初始总生命。\n';
  output += '- **法术抗性 `spellResistance`**：所受法术伤害减半并向下取整；不阻止增益、减益、治疗或法力效果。\n\n';
  for (const faction of registry.factions) {
    output += `## ${nameOf('factions', faction.id, faction.name)} ${faction.name}\n\n`;
    output += creatureTable(faction.creatureIds.map((id) => registry.creatureById[id]));
    output += '\n';
  }
  output += '## 中立生物\n\n中立生物没有阵营城镇专属巢穴；它们出现在固定混合遭遇中。模型、位置和奖励见[中立模型与遭遇](./neutrals.md)。\n\n';
  output += creatureTable(registry.neutralCreatures);
  output += coverage('creature', registry.creatures.map((creature) => creature.id));
  output += coverage('faction-creature', registry.factionCreatures.map((creature) => creature.id));
  output += coverage('neutral-creature', registry.neutralCreatures.map((creature) => creature.id));
  return output;
}

function artifactBonusText(artifact) {
  return registry.artifactStats
    .filter((stat) => artifact.bonuses[stat] !== undefined)
    .map((stat) => `${nameOf('stats', stat, stat)} +${artifact.bonuses[stat]}`)
    .join(' · ');
}

function generateArtifacts() {
  let output = generatedHeader('宝物图鉴（20 件）', ['src/game/artifacts.ts', 'src/game/map.ts', 'src/game/GameStore.ts']);
  output += `默认地图放置全部 **${registry.artifacts.length} 件宝物**，每件各一个拾取对象。稀有度是内容分类，不代表当前地图的随机掉落权重。坐标为界面一基坐标。\n\n`;
  output += table(
    ['ID', '宝物', '部位', '稀有度', '装备加成', '说明', '默认位置'],
    registry.artifacts.map((artifact) => {
      const object = registry.map.objects[`artifact-${artifact.id}`];
      return [
        `\`${artifact.id}\``, displayName('artifacts', artifact.id, artifact.name),
        `${nameOf('slots', artifact.slot, artifact.slot)} \`${artifact.slot}\``,
        `${nameOf('rarities', artifact.rarity, artifact.rarity)} \`${artifact.rarity}\``,
        artifactBonusText(artifact), nameOf('artifactFlavors', artifact.id, artifact.description),
        object ? `${formatPoint(object.position)}<br>\`${object.id}\`` : '无固定拾取对象',
      ];
    }),
  );
  output += '\n## 拾取与装备规则\n\n';
  output += '- 英雄移动到宝物格后拾取，宝物进入该英雄背包，地图对象消失，并获得 100 经验。\n';
  output += '- 武器、护甲、头盔、靴子、饰品各可装备一件；背包装备不生效，换装会替换同部位旧装备。\n';
  output += '- 只有已装备宝物的加成计入英雄有效攻击、防御、法术力量和知识。知识改变后最大法力为有效知识 × 10，当前法力会限制在新上限内。\n';
  output += '- 战斗待结算时不能更换装备。战斗使用进入战斗时的有效主属性。\n';
  output += coverage('artifact', registry.artifacts.map((artifact) => artifact.id));
  return output;
}

function signed(value) {
  return value > 0 ? `+${value}` : String(value);
}

function expandedEffectText(effect) {
  if (effect.kind === 'chainDamage') {
    return `首目标造成 ⌊${effect.baseDamage} + ${effect.powerDamage} × P⌋ 伤害，再跳向最近且尚未命中的敌军，最多 ${effect.maxTargets} 队；每跳伤害 × ${effect.falloff} 并向下取整，至少 1。`;
  }
  if (effect.kind === 'massDamage') return `每个有效目标受到 ⌊${effect.baseDamage} + ${effect.powerDamage} × P⌋ 伤害（至少 1）。`;
  if (effect.kind === 'status') {
    const modifiers = Object.entries(effect.modifiers).map(([key, value]) => {
      if (key === 'damageReduction') return `受到伤害降低 ${Math.round(value * 100)}%`;
      return `${nameOf('stats', key, key === 'speed' ? '速度' : key)} ${signed(value)}`;
    }).join('、');
    return `${modifiers}，持续 ${effect.duration} 轮。`;
  }
  if (effect.kind === 'manaBurn') return `最多移除敌方英雄 ⌊${effect.baseAmount} + ${effect.powerAmount} × P⌋ 点法力，不超过其现有法力。`;
  if (effect.kind === 'manaDrain') return `最多吸取敌方英雄 ⌊${effect.baseAmount} + ${effect.powerAmount} × P⌋ 点法力；施法者只能恢复支付本次消耗后仍可容纳的量。`;
  if (effect.kind === 'manaRestore') return `支付施法消耗后，为施法者恢复至多 ⌊${effect.baseAmount} + ${effect.powerAmount} × P⌋ 点法力，不超过上限。`;
  if (effect.kind === 'restoration') {
    return `每个目标恢复至多 ⌊${effect.baseAmount} + ${effect.powerAmount} × P⌋ 点总生命，不超过初始总生命；${effect.canRevive ? '可复活原格空闲的阵亡友军' : '仅治疗受伤的存活友军，不复活'}。`;
  }
  throw new Error(`Unknown expanded effect: ${effect.kind}`);
}

function spellEffectText(spell) {
  if (typeof spell.effect !== 'string') return expandedEffectText(spell.effect);
  if (spell.effect === 'damage') return `造成 ${spell.power} + 10 × P 点法术伤害。`;
  if (spell.effect === 'heal') return `恢复至多 ${spell.power} + 10 × P 点总生命；可复活原格空闲的阵亡友军。`;
  if (spell.effect === 'haste') return `速度 +${spell.power}，持续 3 轮。`;
  if (spell.effect === 'slow') return `敌方速度 −${spell.power}，持续 3 轮，最低速度仍为 1。`;
  if (spell.effect === 'shield') return `防御 +${spell.power}，持续 3 轮。`;
  if (spell.effect === 'bless') return `最小与最大伤害均 +${spell.power}，持续 3 轮。`;
  throw new Error(`Unknown core effect: ${spell.effect}`);
}

function generateSpells() {
  let output = generatedHeader('法术图鉴（19 种）', ['src/game/content.ts', 'src/game/spells.ts', 'src/game/spellbook.ts', 'src/battle/magic.ts', 'src/battle/BattleEngine.ts']);
  output += `本表覆盖 **${registry.spells.length} 种战斗法术**，按等级与注册 ID 排序。**P 表示进入战斗时英雄的有效法术力量**（含已装备宝物）。\n\n`;
  output += table(
    ['ID', '法术', '派系', '等级', '法力', '目标', '精确效果'],
    registry.spells.map((spell) => [
      `\`${spell.id}\``, displayName('spells', spell.id, spell.name), nameOf('schools', spell.school, spell.school),
      String(spell.level), String(spell.manaCost), `${nameOf('targets', spell.target, spell.target)}<br>\`${spell.target}\``,
      spellEffectText(spell),
    ]),
  );
  output += '\n## 共通施法规则\n\n';
  output += '- 只能在己方某一队兵种行动时施法；每名英雄每轮限一次，但不消耗该队兵种的移动/攻击行动。必须有已知法术、足够法力与有效目标。\n';
  output += '- 单体友军/敌军法术需要点选高亮目标；群体、施法者与敌方英雄法术立即结算。伤害法术受法术抗性减半及目标减伤影响，最终至少造成 1 点伤害。\n';
  output += '- 基础法术的伤害/治疗量为注册 `power` + 10 × P；扩展法术按表内各自公式计算并向下取整。状态持续时间按战斗轮递减。\n';
  output += '- 疗伤术与生命之泉复活时，必须另有存活友军，且阵亡队原有六角格未被占用或阻挡；治疗总量不超过该队初始总生命。\n';
  output += '- 当前新游戏的英雄默认掌握全部 19 种法术。奥术图书馆按自身列表顺序补上第一项缺失法术，主要影响空魔法书或旧存档。\n';
  output += coverage('spell', registry.spells.map((spell) => spell.id));
  return output;
}

function usageText(entries, kind) {
  if (entries.length === 0) return '无';
  const label = kind === 'building' ? '建筑' : '兵种';
  if (entries.length <= 6) {
    return `${entries.map((entry) => `${nameOf(kind === 'building' ? 'buildings' : 'creatures', entry.id, entry.name)} \`${entry.id}\``).join('、')}`;
  }
  return `${entries.length} 种${label}（完整费用见对应图鉴）`;
}

function generateResources() {
  let output = generatedHeader('资源图鉴与获取途径（10 种）', [
    'src/game/resources.ts', 'src/game/content.ts', 'src/game/map.ts', 'src/game/GameStore.ts',
  ]);
  output += `资源由玩家阵营共享，当前共 **${registry.resourceIds.length} 种**。下列初始数量、建筑/招募用途、固定拾取、矿点日产和怪物奖励均从当前注册表与默认种子 \`${registry.map.seed}\` 派生。\n\n`;
  output += table(
    ['ID', '资源', '初始库存', '主要用途'],
    registry.resourceIds.map((resource) => [
      `\`${resource}\``, displayName('resources', resource, resource), formatNumber(registry.startingResources[resource]),
      nameOf('resourceDescriptions', resource, resource),
    ]),
  );
  output += '\n';
  const monsters = Object.values(registry.map.objects).filter((object) => object.kind === 'monster');
  for (const resource of registry.resourceIds) {
    const buildingUses = registry.buildings.filter((building) => (building.cost[resource] ?? 0) > 0);
    const creatureUses = registry.creatures.filter((creature) => (creature.cost[resource] ?? 0) > 0);
    const pickups = Object.values(registry.map.objects).filter((object) => object.kind === 'resource' && (object.resources[resource] ?? 0) > 0);
    const mines = Object.values(registry.map.objects).filter((object) => object.kind === 'mine' && object.resource === resource);
    const treasures = monsters.filter((object) => (object.treasure[resource] ?? 0) > 0);
    const incomes = registry.buildings.filter((building) => (building.dailyIncome?.[resource] ?? 0) > 0);
    output += `## ${nameOf('resources', resource, resource)} ${resource}（\`${resource}\`）\n\n`;
    output += `${nameOf('resourceDescriptions', resource, resource)}\n\n`;
    output += `- **消耗**：建筑——${usageText(buildingUses, 'building')}；招募——${usageText(creatureUses, 'creature')}。`;
    if (resource === 'gold') output += '商人帐篷每次交易另需 500 金币。\n';
    else output += '\n';
    output += `- **新游戏库存**：${formatNumber(registry.startingResources[resource])}。\n`;
    output += '- **地图拾取**：';
    output += pickups.length > 0
      ? `${pickups.map((object) => `${object.name} \`${object.id}\`，${formatPoint(object.position)}，${object.resources[resource]} ${nameOf('resources', resource)}`).join('；')}。`
      : '默认地图没有该资源的独立拾取对象。';
    if (registry.newResources[resource]) {
      const definition = registry.newResources[resource];
      output += `种子相关缓存的注册范围为 ${definition.pickupRange[0]}–${definition.pickupRange[1]}；上列数量是默认种子的实际结果。`;
    }
    output += '\n';
    output += mines.length > 0
      ? `- **矿点**：${mines.map((object) => `${object.name} \`${object.id}\`，${formatPoint(object.position)}，占领后每日 +${object.dailyOutput}`).join('；')}。\n`
      : '- **矿点**：默认地图没有对应矿点。\n';
    if (incomes.length > 0) output += `- **建筑日产**：${incomes.map((building) => `${nameOf('buildings', building.id, building.name)}每日 +${building.dailyIncome[resource]}`).join('；')}。\n`;
    if (resource === 'wood' || resource === 'ore') output += '- **商人帐篷**：每位英雄每天可支付 500 金币，换取 1 木材与 1 矿石。\n';
    output += treasures.length > 0
      ? `- **战斗奖励**：${treasures.length} 个固定怪物遭遇提供该资源，数量为 ${treasures.map((object) => `${nameOf('encounters', object.id, object.name)} ${object.treasure[resource]}`).join('、')}；只有获胜方取得奖励，平局没有奖励。\n\n`
      : '- **战斗奖励**：默认固定怪物遭遇不提供该资源。\n\n';
  }
  output += '资源拾取和宝物不同：资源进入玩家共享库存而不是英雄背包。普通资源拾取给予来访英雄 50 经验；矿点只需访问一次即可占领，产出于新的一天开始时结算。\n';
  output += coverage('resource', registry.resourceIds);
  return output;
}

function landmarkEffectText(id) {
  if (id === 'arcaneLibrary') return `按图书馆列表顺序教授第一项未知法术（列表含全部 ${registry.librarySpellIds.length} 种）；全部已知时不消耗访问机会。`;
  if (id === 'warriorsArena') return '来访英雄基础攻击永久 +1。';
  if (id === 'heroesShrine') return `来访英雄获得 ${formatNumber(registry.shrineExperience)} 经验，可触发升级。`;
  if (id === 'huntersLodge') return '来访英雄基础防御永久 +1。';
  if (id === 'waterwheel') return '来访英雄当前移动力恢复至最大值。';
  if (id === 'elementalForge') return '来访英雄基础攻击与基础防御均永久 +1。';
  if (id === 'ancientObservatory') return `以来访对象为中心，将半径 ${registry.observatoryRevealRadius} 的圆形范围加入该玩家的已探索区域，随后更新可见战争迷雾。`;
  if (id === 'healersSanctuary') return '来访英雄当前法力恢复至最大值。';
  if (id === 'wayfarerPortal') return '传到双向链接的另一座旅者传送门；目的地被其他存活英雄占用时不传送。';
  if (id === 'merchantsTent') return `支付 ${costText(registry.merchantCost)}，获得 ${costText(registry.merchantReward)}；金币不足时不交易。`;
  throw new Error(`Unknown landmark: ${id}`);
}

function reuseText(reuse) {
  if (reuse === 'never') return '每位英雄永久一次';
  if (reuse === 'daily') return '每位英雄每天一次';
  return '不限次数';
}

function generateLandmarks() {
  let output = generatedHeader('地标类型、访问规则与传送门', [
    'src/game/landmarks.ts', 'src/game/types.ts', 'src/game/map.ts', 'src/game/GameStore.ts',
  ]);
  output += `当前有 **${registry.landmarks.length} 种地标、默认地图 ${registry.landmarkObjects.length} 个地标对象**；旅者传送门成对出现，因此对象数比类型数多 1。\n\n`;
  output += table(
    ['类型 ID', '地标', '效果', '复用规则', '默认对象与界面坐标'],
    registry.landmarks.map((landmark) => {
      const objects = registry.landmarkObjects.filter((object) => object.landmarkId === landmark.id);
      return [
        `\`${landmark.id}\``, displayName('landmarks', landmark.id, landmark.name), landmarkEffectText(landmark.id),
        `${reuseText(landmark.reuse)}<br>\`${landmark.reuse}\``,
        objects.map((object) => `\`${object.id}\`<br>${formatPoint(object.position)}`).join('<br>'),
      ];
    }),
  );
  output += '\n## `visits`、每日重置与失败访问\n\n';
  output += '- 成功互动会记录 `object.visits[hero.id] = 当前总天数`。限制按**地标对象 + 英雄**分别计算，不是全玩家或全英雄共享。\n';
  output += '- `never`：该英雄在同一对象上只能成功使用一次；`daily`：仅当记录天数等于当前天数时不可再用，新的一天自动恢复，无需清空记录；`always`：忽略访问记录。\n';
  output += '- 对象若被标记 `depleted`，一律视为已使用。默认地图的对象初始均未耗尽。\n';
  output += '- 已会全部图书馆法术、传送门目的地被占用、商人交易金币不足时，效果不会发生，也不会写入本次成功访问记录。重复进入已用对象不会再次生效。\n\n';
  output += '## 成对旅者传送门\n\n';
  const portals = registry.landmarkObjects.filter((object) => object.landmarkId === 'wayfarerPortal');
  output += table(
    ['对象', '界面坐标', '双向链接目标'],
    portals.map((object) => [`\`${object.id}\``, formatPoint(object.position), `\`${object.linkedObjectId}\``]),
  );
  output += '\n两端必须互相链接，存档校验会拒绝单向、自连或缺失目标。成功传送会更新英雄位置与战争迷雾，并在两端记录访问；由于类型为 `always`，记录不妨碍再次使用。目的格若被其他存活英雄占据，则本次无法旅行。\n';
  output += coverage('landmark', registry.landmarks.map((landmark) => landmark.id));
  output += coverage('landmark-object', registry.landmarkObjects.map((object) => object.id));
  return output;
}

function encounterName(encounter) {
  if (zh.encounters[encounter.id]) return `${zh.encounters[encounter.id]}<br>${encounter.name}`;
  return encounter.name;
}

function encounterTable(encounters) {
  return table(
    ['遭遇 ID', '名称', '界面坐标', '防守军队', '经验', '资源奖励'],
    encounters.map((encounter) => [
      `\`${encounter.id}\``, encounterName(encounter), formatPoint(encounter.position), armyText(encounter.army),
      formatNumber(encounter.experienceReward), costText(encounter.treasure),
    ]),
  );
}

function generateNeutrals() {
  let output = generatedHeader('中立模型与固定怪物遭遇', [
    'src/game/neutral.ts', 'src/battle/creatures.ts', 'src/battle/neutral/', 'src/adventure/models.ts', 'src/game/map.ts',
  ]);
  output += `全部 **${registry.neutralCreatures.length} 种中立生物**都有独立注册模型原型；冒险地图与战术战场复用同一生物模型工厂。下表的模型原型、视觉高度和主色直接读取模型实例。每种中立生物恰好出现在一个固定混合遭遇中，共 **${registry.neutralEncounters.length} 个中立主题遭遇**。\n\n`;
  output += table(
    ['ID', '生物', '模型原型', '中文形态', '视觉高度', '模型主色', '固定遭遇'],
    registry.neutralCreatures.map((creature) => {
      const model = registry.neutralModels[creature.id];
      const encounter = registry.neutralEncounters.find((object) => object.army.some((stack) => stack.creatureId === creature.id));
      return [
        `\`${creature.id}\``, displayName('creatures', creature.id, creature.name), `\`${model.archetype}\``,
        nameOf('neutralModels', creature.id, model.archetype), model.visualHeight.toFixed(2),
        model.palette.map(formatHex).join(' / '), `\`${encounter.id}\``,
      ];
    }),
  );
  output += '\n兵种数值见[兵种总图鉴](./creatures.md#中立生物)。视觉高度用于模型与标签布局，不是战斗属性。\n\n';
  output += '## 10 个中立主题混合遭遇\n\n';
  output += encounterTable(registry.neutralEncounters);
  output += '\n## 其余固定怪物遭遇\n\n';
  output += `默认地图共有 ${registry.monsterEncounters.length} 个怪物对象；除上述 10 个外，其余 ${registry.otherEncounters.length} 个如下。移动到怪物格会进入战术战斗，胜利后怪物对象消失并发放经验与资源；失败时剩余守军保留，平局不发放奖励。\n\n`;
  output += encounterTable(registry.otherEncounters);
  output += coverage('neutral-model', registry.neutralCreatures.map((creature) => creature.id));
  output += coverage('neutral-encounter', registry.neutralEncounters.map((encounter) => encounter.id));
  output += coverage('monster-encounter', registry.monsterEncounters.map((encounter) => encounter.id));
  return output;
}

function generateIndex() {
  let output = generatedHeader('Aster Vale 中文文档', [
    'src/game/', 'src/town/registry.ts', 'src/battle/', 'src/adventure/', 'src/editor/',
  ]);
  output += '欢迎来到完整中文手册。玩法与操作指南为人工维护；下列注册表图鉴由生成器直接读取当前游戏数据，避免漏项或数值漂移。\n\n';
  output += '## 玩法与开发指南\n\n';
  output += '- [游戏玩法与回合流程](./guide/gameplay.md)\n';
  output += '- [冒险、3D 城镇与战斗操作](./guide/controls.md)\n';
  output += '- [自定义 ContentEditor、JSON 导入导出与沙盒](./guide/content-editor.md)\n';
  output += '- [安装、测试、构建与部署](./guide/development.md)\n';
  output += '- [存档位置、校验、迁移与兼容性](./guide/save-compatibility.md)\n';
  output += '- [开发会话摘要（目标、架构、演进、审查与验证）](../SESSION.md)\n\n';
  output += '## 数据图鉴\n\n';
  output += table(
    ['内容', '当前数量', '文档'],
    [
      ['阵营 / 城镇', registry.factions.length, '[阵营、城镇与建筑链](./generated/factions.md)'],
      ['建筑（含 5 种共同建筑）', registry.buildings.length, '[建筑链](./generated/factions.md)'],
      ['兵种（52 阵营 + 20 中立）', registry.creatures.length, '[兵种总图鉴](./generated/creatures.md)'],
      ['宝物', registry.artifacts.length, '[宝物图鉴](./generated/artifacts.md)'],
      ['法术', registry.spells.length, '[法术图鉴](./generated/spells.md)'],
      ['资源', registry.resourceIds.length, '[资源图鉴](./generated/resources.md)'],
      ['地标类型 / 默认对象', `${registry.landmarks.length} / ${registry.landmarkObjects.length}`, '[地标与传送门](./generated/landmarks.md)'],
      ['中立模型 / 中立主题遭遇', `${registry.neutralCreatures.length} / ${registry.neutralEncounters.length}`, '[中立模型与遭遇](./generated/neutrals.md)'],
    ],
  );
  output += '\n## 可重复校验\n\n```bash\nnpm ci\nnpm run docs:generate\nnpm run docs:check\n```\n\n';
  output += '生成器会加载真实注册表并创建默认地图与中立模型，断言上述数量、ID 集合和建筑模型集合一致。`docs:check` 在内存中重新生成全部图鉴，逐字比较提交文件，并检查每页的注册 ID 覆盖块；缺少、额外或过期内容都会失败，不会改写文件。它还会检查 SESSION.md 的必需章节、验证命令、README 链接、篇幅及常见敏感信息模式。\n';
  return output;
}

function validateCoverageBlock(files, path, kind, expectedIds) {
  const source = files[path];
  const marker = `<!-- h3docs-registry:${kind}\n`;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`${path}: missing coverage block ${kind}`);
  const end = source.indexOf('\n-->', start + marker.length);
  if (end < 0) throw new Error(`${path}: unterminated coverage block ${kind}`);
  const actualIds = source.slice(start + marker.length, end).split('\n').filter(Boolean);
  if (new Set(actualIds).size !== actualIds.length) throw new Error(`${path}: duplicate IDs in ${kind}`);
  assertSameIds(`${path} ${kind}`, actualIds, expectedIds);
}

function buildFiles() {
  return {
    'docs/README.md': generateIndex(),
    'docs/generated/factions.md': generateFactions(),
    'docs/generated/creatures.md': generateCreatures(),
    'docs/generated/artifacts.md': generateArtifacts(),
    'docs/generated/spells.md': generateSpells(),
    'docs/generated/resources.md': generateResources(),
    'docs/generated/landmarks.md': generateLandmarks(),
    'docs/generated/neutrals.md': generateNeutrals(),
  };
}

function validateFiles(files) {
  const checks = [
    ['docs/generated/factions.md', 'faction', registry.factions.map((entry) => entry.id)],
    ['docs/generated/factions.md', 'building', registry.buildings.map((entry) => entry.id)],
    ['docs/generated/creatures.md', 'creature', registry.creatures.map((entry) => entry.id)],
    ['docs/generated/creatures.md', 'faction-creature', registry.factionCreatures.map((entry) => entry.id)],
    ['docs/generated/creatures.md', 'neutral-creature', registry.neutralCreatures.map((entry) => entry.id)],
    ['docs/generated/artifacts.md', 'artifact', registry.artifacts.map((entry) => entry.id)],
    ['docs/generated/spells.md', 'spell', registry.spells.map((entry) => entry.id)],
    ['docs/generated/resources.md', 'resource', registry.resourceIds],
    ['docs/generated/landmarks.md', 'landmark', registry.landmarks.map((entry) => entry.id)],
    ['docs/generated/landmarks.md', 'landmark-object', registry.landmarkObjects.map((entry) => entry.id)],
    ['docs/generated/neutrals.md', 'neutral-model', registry.neutralCreatures.map((entry) => entry.id)],
    ['docs/generated/neutrals.md', 'neutral-encounter', registry.neutralEncounters.map((entry) => entry.id)],
    ['docs/generated/neutrals.md', 'monster-encounter', registry.monsterEncounters.map((entry) => entry.id)],
  ];
  for (const [path, kind, ids] of checks) validateCoverageBlock(files, path, kind, ids);
}

async function validateSessionSummary() {
  let session;
  let readme;
  try {
    [session, readme] = await Promise.all([
      readFile(resolve(projectRoot, 'SESSION.md'), 'utf8'),
      readFile(resolve(projectRoot, 'README.md'), 'utf8'),
    ]);
  } catch (error) {
    if (error.code === 'ENOENT') throw new Error('SESSION.md and README.md are required documentation deliverables');
    throw error;
  }
  const requiredText = [
    '# Aster Vale 开发会话摘要', '## 目标与交付', '## 架构', '## 功能演进',
    '## 独立审查证据', '## 验证证据', '## 重要修复',
    'npm run docs:check', 'npm test', 'npm run test:modules', 'npm run build', 'npm run test:e2e',
  ];
  for (const text of requiredText) {
    if (!session.includes(text)) throw new Error(`SESSION.md: missing required section or verification command: ${text}`);
  }
  if (session.length > 16_000) throw new Error('SESSION.md: summary is too long; keep it concise');
  if (!readme.includes('[开发会话摘要](SESSION.md)')) throw new Error('README.md: missing SESSION.md link');
  const forbidden = [
    ['access token', /\b(?:ghp|github_pat|gho|ghu|ghs|ghr)_[A-Za-z0-9_]+/],
    ['bearer credential', /\bBearer\s+[A-Za-z0-9._-]+/i],
    ['private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
    ['local user path', /(?:\/Users\/|\/home\/|[A-Za-z]:\\Users\\)/],
  ];
  for (const [label, pattern] of forbidden) {
    if (pattern.test(session)) throw new Error(`SESSION.md: possible ${label} found; sanitize the summary`);
  }
}

const server = await createServer({
  root: projectRoot,
  configFile: false,
  appType: 'custom',
  logLevel: 'error',
  server: { middlewareMode: true },
  optimizeDeps: { noDiscovery: true, include: [] },
});

try {
  const content = await server.ssrLoadModule('/src/game/content.ts');
  const artifactModule = await server.ssrLoadModule('/src/game/artifacts.ts');
  const resourceModule = await server.ssrLoadModule('/src/game/resources.ts');
  const spellbook = await server.ssrLoadModule('/src/game/spellbook.ts');
  const landmarkModule = await server.ssrLoadModule('/src/game/landmarks.ts');
  const scenario = await server.ssrLoadModule('/src/game/scenario.ts');
  const townRegistry = await server.ssrLoadModule('/src/town/registry.ts');
  const creatureModels = await server.ssrLoadModule('/src/battle/creatures.ts');

  const state = scenario.createInitialGameState('h3core-default');
  const creatures = Object.values(content.CREATURES);
  const neutralRegistry = (await server.ssrLoadModule('/src/game/neutral.ts')).NEUTRAL_CREATURES;
  const neutralByRegistry = Object.values(neutralRegistry);
  const neutralCreatures = creatures.filter((creature) => Object.hasOwn(neutralRegistry, creature.id));
  assertSameIds('content neutral coverage', neutralCreatures.map((entry) => entry.id), neutralByRegistry.map((entry) => entry.id));
  const factionCreatures = creatures.filter((creature) => creature.faction !== 'Neutral');
  const factions = Object.values(content.FACTIONS);
  const buildings = Object.values(content.BUILDINGS);
  const artifacts = artifactModule.ARTIFACT_LIST;
  const spells = spellbook.COMBAT_SPELL_LIST;
  const resourceIds = [...resourceModule.EXTENDED_RESOURCE_TYPES];
  const landmarks = landmarkModule.LANDMARK_IDS.map((id) => landmarkModule.LANDMARK_DEFINITIONS[id]);
  const mapObjects = Object.values(state.map.objects);
  const landmarkObjects = mapObjects.filter((object) => object.kind === 'landmark');
  const monsterEncounters = mapObjects.filter((object) => object.kind === 'monster');
  const neutralEncounters = monsterEncounters.filter((object) => object.army.every((stack) => neutralByRegistry.some((creature) => creature.id === stack.creatureId)));
  const otherEncounters = monsterEncounters.filter((object) => !neutralEncounters.includes(object));

  assertCount('factions', factions.length, EXPECTED_COUNTS.factions);
  assertCount('buildings', buildings.length, EXPECTED_COUNTS.buildings);
  assertCount('building models', Object.keys(townRegistry.BUILDING_MODEL_REGISTRY).length, EXPECTED_COUNTS.buildings);
  assertCount('faction creatures', factionCreatures.length, EXPECTED_COUNTS.factionCreatures);
  assertCount('neutral creatures', neutralCreatures.length, EXPECTED_COUNTS.neutralCreatures);
  assertCount('creatures', creatures.length, EXPECTED_COUNTS.creatures);
  assertCount('artifacts', artifacts.length, EXPECTED_COUNTS.artifacts);
  assertCount('spells', spells.length, EXPECTED_COUNTS.spells);
  assertCount('resources', resourceIds.length, EXPECTED_COUNTS.resources);
  assertCount('landmark types', landmarks.length, EXPECTED_COUNTS.landmarkTypes);
  assertCount('landmark objects', landmarkObjects.length, EXPECTED_COUNTS.landmarkObjects);
  assertCount('neutral encounters', neutralEncounters.length, EXPECTED_COUNTS.neutralEncounters);
  assertCount('monster encounters', monsterEncounters.length, EXPECTED_COUNTS.monsterEncounters);
  assertSameIds('building models', Object.keys(townRegistry.BUILDING_MODEL_REGISTRY), buildings.map((entry) => entry.id));
  assertSameIds('faction creature registry', factions.flatMap((faction) => faction.creatureIds), factionCreatures.map((entry) => entry.id));
  assertSameIds('neutral encounter coverage', neutralEncounters.flatMap((encounter) => encounter.army.map((stack) => stack.creatureId)), neutralCreatures.map((entry) => entry.id));

  const neutralModels = {};
  for (const creature of neutralCreatures) {
    const model = creatureModels.createCreatureModel(creature.id, 'attacker');
    if (model.userData.creatureId !== creature.id || model.userData.faction !== 'Neutral' || !model.userData.archetype) {
      throw new Error(`Neutral model registration is incomplete: ${creature.id}`);
    }
    neutralModels[creature.id] = {
      archetype: model.userData.archetype,
      visualHeight: model.userData.visualHeight,
      palette: [...model.userData.palette],
    };
    disposeModel(model);
  }

  registry = {
    factions,
    buildings,
    buildingById: content.BUILDINGS,
    buildingSpecs: townRegistry.BUILDING_MODEL_REGISTRY,
    townRegistry,
    creatures,
    creatureById: content.CREATURES,
    factionCreatures,
    neutralCreatures,
    heroById: content.HEROES,
    artifacts,
    artifactStats: artifactModule.ARTIFACT_STATS,
    spells,
    resourceIds,
    newResources: resourceModule.NEW_RESOURCES,
    startingResources: content.startingResources(),
    landmarks,
    landmarkObjects,
    librarySpellIds: landmarkModule.LIBRARY_SPELL_IDS,
    shrineExperience: landmarkModule.SHRINE_EXPERIENCE,
    observatoryRevealRadius: landmarkModule.OBSERVATORY_REVEAL_RADIUS,
    merchantCost: landmarkModule.MERCHANT_TRADE_COST,
    merchantReward: landmarkModule.MERCHANT_TRADE_REWARD,
    map: state.map,
    state,
    neutralModels,
    neutralEncounters,
    otherEncounters,
    monsterEncounters,
  };

  const files = buildFiles();
  validateFiles(files);
  await validateSessionSummary();
  if (checkMode) {
    const stale = [];
    for (const [path, expected] of Object.entries(files)) {
      let actual;
      try {
        actual = await readFile(resolve(projectRoot, path), 'utf8');
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        stale.push(`${path} (missing)`);
        continue;
      }
      if (actual !== expected) stale.push(`${path} (stale; run npm run docs:generate)`);
    }
    if (stale.length > 0) throw new Error(`Generated documentation is not current:\n${stale.join('\n')}`);
    console.log(`Documentation check passed: ${Object.keys(files).length} files, ${creatures.length} creatures, ${buildings.length} buildings, ${artifacts.length} artifacts, ${spells.length} spells, ${resourceIds.length} resources, ${landmarks.length} landmark types, ${neutralCreatures.length} neutral models.`);
  } else {
    const changed = [];
    for (const [path, contents] of Object.entries(files)) {
      const absolutePath = resolve(projectRoot, path);
      await mkdir(dirname(absolutePath), { recursive: true });
      let previous = null;
      try {
        previous = await readFile(absolutePath, 'utf8');
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
      if (previous !== contents) {
        await writeFile(absolutePath, contents, 'utf8');
        changed.push(path);
      }
    }
    console.log(`Documentation generated: ${changed.length} file(s) written; ${Object.keys(files).length - changed.length} unchanged.`);
    for (const path of changed) console.log(`  ${path}`);
    console.log(`Validated counts: ${factions.length} factions, ${buildings.length} buildings, ${creatures.length} creatures, ${artifacts.length} artifacts, ${spells.length} spells, ${resourceIds.length} resources, ${landmarks.length} landmark types, ${neutralCreatures.length} neutral models.`);
  }
} finally {
  await server.close();
}
