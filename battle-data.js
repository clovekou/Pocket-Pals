'use strict';
// Pocket Pals — battle data: elements, moves, learnsets, balance and explore areas.
// Everything here is plain data so it can be tuned without touching the game code (battle.js reads it).
// Safe to edit: change numbers, rename moves (MOVE_NAMES), add moves, or change which areas are hard.

window.PP_BATTLE = (() => {
  // ---------------- elements ----------------
  // strong: this element's attacks do 2× to these elements.  Attacks against an element that is strong against
  // the attacker do 0.5× (e.g. Nature hitting Fire). resistSelf: its own element's attacks do 0.5× to it.
  const ELEMENTS = {
    fire:     { label: 'Fire',     icon: '🔥', color: '#ee7f30', strong: ['nature'],   resistSelf: true },
    water:    { label: 'Water',    icon: '💧', color: '#4f8fe8', strong: ['fire'],     resistSelf: true },
    nature:   { label: 'Nature',   icon: '🌿', color: '#4cb04a', strong: ['earth'],    resistSelf: true },
    electric: { label: 'Electric', icon: '⚡', color: '#e8b10f', strong: ['water'],    resistSelf: true },
    earth:    { label: 'Earth',    icon: '🪨', color: '#b08a4a', strong: ['electric'], resistSelf: true },
    light:    { label: 'Light',    icon: '☀️', color: '#e9b83c', strong: ['dark'],     resistSelf: false },
    dark:     { label: 'Dark',     icon: '🌙', color: '#6b5a8e', strong: ['light'],    resistSelf: false },
    neutral:  { label: 'Neutral',  icon: '⭐', color: '#a8a77a', strong: [],           resistSelf: false },
  };
  // the roster's original types → the eight battle elements
  const TYPE_TO_ELEMENT = {
    fire: 'fire',
    water: 'water', ice: 'water',
    grass: 'nature', bug: 'nature', poison: 'nature',
    electric: 'electric', steel: 'electric',
    ground: 'earth', rock: 'earth', fighting: 'earth',
    fairy: 'light', psychic: 'light',
    dark: 'dark', ghost: 'dark',
    normal: 'neutral', flying: 'neutral', dragon: 'neutral',
  };
  // a few species whose look fits a different element than their type (species id → element)
  const SPECIES_ELEMENT = {};

  // ---------------- balance ----------------
  const BALANCE = {
    superEffective: 2, normal: 1, notVeryEffective: .5, stab: 1.5,
    critChance: [1 / 24, 1 / 8, 1 / 2, 1],   // by crit stage (high-crit moves start at stage 1)
    critMult: 1.5,
    damageScale: .8,                         // every hit × this (longer, less swingy battles than the main games)
    randomMin: .85,                          // damage roll is randomMin..1
    burnPhysical: .5,                        // a burned Pal's physical moves do this much
    paralysisSkip: .25, paralysisSpeed: .5,
    sleepTurns: [1, 3], freezeThaw: .2,
    burnTick: 1 / 16, poisonTick: 1 / 8,
    struggleRecoil: 1 / 4,
    // stats: Pokémon-style formula from each species' three base stats (ATK/DEF/SPD in species.js).
    // special lean: how much an element's Pals favour Sp. Atk / Sp. Def over Attack / Defence
    specialLean: { fire: 1.08, water: 1.06, nature: .98, electric: 1.1, earth: .9, light: 1.12, dark: 1.0, neutral: .95 },
    trainingEV: 2.52,                        // training 0-100 counts like 0-252 effort points
    // looked after well: small bonuses, never big penalties
    care: { goodAvg: 70, goodBonus: .05, happyJoy: 80, happyCrit: 1, bondAcc: .05 },
    endureBond: 60,                          // hold on at 1 HP once per battle (as before)
    awakenBond: 100,                         // Bond Awakening unlocks at max bond
    awaken: { turns: 3, mult: 1.3, critStage: 1, heal: .2 },
    // HP and PP come back at home (per game minute)
    regen: { hpAwake: .02, hpAsleep: .05, ppEveryAwake: 6, ppEveryAsleep: 2 },
    // EXP: battles add game-minutes of growth (60 = one level)
    exp: { wild: 8, perLevelOver: 1, boss: 30, legend: 45, friend: 10, max: 90 },
    // the first PP-free fallback
    struggle: 'struggle',
    // enemy AI: chance it picks its best-scoring move (bosses think harder)
    aiSmart: { wild: .65, boss: .85, legend: .9, trainer: .8 },
    capture: { statusBonus: { slp: 2, frz: 2, par: 1.5, psn: 1.5, brn: 1.5 } },
  };

  // ---------------- moves ----------------
  // cat: 'phys' | 'spec' | 'status'.  power 0 for status.  acc: 0-100 (0 = never misses).  pri: priority.
  // effect keys: burn/par/psn/slp/frz/flinch (chance %), self / foe stat changes {stat: stages, chance},
  // drain (share of damage healed), recoil (share of damage taken), heal (share of max HP), hits [min,max],
  // crit (extra crit stages), protect, charge (needs a turn to charge), recharge (rests the next turn)
  const MOVES = {
    // Fire
    ember:        { name: 'Ember',         el: 'fire', cat: 'spec', power: 40,  acc: 100, pp: 25, burn: 10, desc: 'A small flame. 10% chance to burn.' },
    fireFang:     { name: 'Fire Fang',     el: 'fire', cat: 'phys', power: 65,  acc: 95,  pp: 15, burn: 10, flinch: 10, desc: 'A fiery bite. May burn or make the foe flinch.' },
    flamethrower: { name: 'Flamethrower',  el: 'fire', cat: 'spec', power: 90,  acc: 100, pp: 15, burn: 10, desc: 'A blast of fire. 10% chance to burn.' },
    fireBlast:    { name: 'Fire Blast',    el: 'fire', cat: 'spec', power: 110, acc: 85,  pp: 5,  burn: 10, desc: 'A huge, all-consuming fire. 10% chance to burn.' },
    flareBlitz:   { name: 'Flare Blitz',   el: 'fire', cat: 'phys', power: 120, acc: 100, pp: 15, burn: 10, recoil: 1 / 3, desc: 'A blazing charge. Hurts the user too.' },
    // Water
    waterGun:     { name: 'Water Gun',     el: 'water', cat: 'spec', power: 40,  acc: 100, pp: 25, desc: 'Squirts water at the foe.' },
    aquaTail:     { name: 'Aqua Tail',     el: 'water', cat: 'phys', power: 90,  acc: 90,  pp: 10, desc: 'Swings its tail like a raging wave.' },
    surf:         { name: 'Surf',          el: 'water', cat: 'spec', power: 90,  acc: 100, pp: 15, desc: 'A big wave crashes down.' },
    hydroPump:    { name: 'Hydro Pump',    el: 'water', cat: 'spec', power: 110, acc: 80,  pp: 5,  desc: 'A powerful blast of water.' },
    powderSnow:   { name: 'Powder Snow',   el: 'water', cat: 'spec', power: 40,  acc: 100, pp: 25, frz: 10, desc: 'Freezing snow. 10% chance to freeze.' },
    iceBeam:      { name: 'Ice Beam',      el: 'water', cat: 'spec', power: 90,  acc: 100, pp: 10, frz: 10, desc: 'An icy beam. 10% chance to freeze.' },
    // Nature
    vineWhip:     { name: 'Vine Whip',     el: 'nature', cat: 'phys', power: 45,  acc: 100, pp: 25, desc: 'Strikes with slender vines.' },
    razorLeaf:    { name: 'Razor Leaf',    el: 'nature', cat: 'phys', power: 55,  acc: 95,  pp: 25, crit: 1, desc: 'Sharp leaves. Lands critical hits more often.' },
    energyBall:   { name: 'Energy Ball',   el: 'nature', cat: 'spec', power: 90,  acc: 100, pp: 10, foe: { sdef: -1, chance: 10 }, desc: 'Nature\'s power. May lower the foe\'s Sp. Def.' },
    solarBeam:    { name: 'Solar Beam',    el: 'nature', cat: 'spec', power: 120, acc: 100, pp: 10, charge: true, desc: 'Soaks up light on the first turn, fires on the next.' },
    absorb:       { name: 'Absorb',        el: 'nature', cat: 'spec', power: 20,  acc: 100, pp: 25, drain: .5, desc: 'Drains HP. Heals half the damage dealt.' },
    gigaDrain:    { name: 'Giga Drain',    el: 'nature', cat: 'spec', power: 75,  acc: 100, pp: 10, drain: .5, desc: 'A big drain. Heals half the damage dealt.' },
    bulletSeed:   { name: 'Bullet Seed',   el: 'nature', cat: 'phys', power: 25,  acc: 100, pp: 30, hits: [2, 5], desc: 'Shoots 2 to 5 seeds in a row.' },
    poisonSting:  { name: 'Poison Sting',  el: 'nature', cat: 'phys', power: 15,  acc: 100, pp: 35, psn: 30, desc: 'A toxic barb. 30% chance to poison.' },
    sludgeBomb:   { name: 'Sludge Bomb',   el: 'nature', cat: 'spec', power: 90,  acc: 100, pp: 10, psn: 30, desc: 'Hurls sludge. 30% chance to poison.' },
    sleepPowder:  { name: 'Sleep Powder',  el: 'nature', cat: 'status', power: 0, acc: 75, pp: 15, slp: 100, desc: 'A sleep-inducing powder.' },
    // Electric
    thunderShock: { name: 'Thunder Shock', el: 'electric', cat: 'spec', power: 40,  acc: 100, pp: 30, par: 10, desc: 'A jolt of electricity. 10% chance to paralyse.' },
    spark:        { name: 'Spark',         el: 'electric', cat: 'phys', power: 65,  acc: 100, pp: 20, par: 30, desc: 'An electric tackle. 30% chance to paralyse.' },
    thunderbolt:  { name: 'Thunderbolt',   el: 'electric', cat: 'spec', power: 90,  acc: 100, pp: 15, par: 10, desc: 'A strong electric blast. 10% chance to paralyse.' },
    thunder:      { name: 'Thunder',       el: 'electric', cat: 'spec', power: 110, acc: 70,  pp: 10, par: 30, desc: 'A wicked thunderbolt. 30% chance to paralyse.' },
    thunderWave:  { name: 'Thunder Wave',  el: 'electric', cat: 'status', power: 0, acc: 90, pp: 20, par: 100, desc: 'A weak jolt that paralyses the foe.' },
    // Earth
    mudSlap:      { name: 'Mud-Slap',      el: 'earth', cat: 'spec', power: 20,  acc: 100, pp: 10, foe: { acc: -1, chance: 100 }, desc: 'Mud in the face. Lowers accuracy.' },
    rockThrow:    { name: 'Rock Throw',    el: 'earth', cat: 'phys', power: 50,  acc: 90,  pp: 15, desc: 'Throws a small rock.' },
    rockSlide:    { name: 'Rock Slide',    el: 'earth', cat: 'phys', power: 75,  acc: 90,  pp: 10, flinch: 30, desc: 'Large boulders. 30% chance to flinch.' },
    earthquake:   { name: 'Earthquake',    el: 'earth', cat: 'phys', power: 100, acc: 100, pp: 10, desc: 'A powerful quake.' },
    doubleKick:   { name: 'Double Kick',   el: 'earth', cat: 'phys', power: 30,  acc: 100, pp: 30, hits: [2, 2], desc: 'Kicks twice in a row.' },
    // Light
    fairyWind:    { name: 'Fairy Wind',    el: 'light', cat: 'spec', power: 40,  acc: 100, pp: 30, desc: 'Stirs up a shining wind.' },
    drainingKiss: { name: 'Draining Kiss', el: 'light', cat: 'spec', power: 50,  acc: 100, pp: 10, drain: .75, desc: 'A kiss that steals HP. Heals most of the damage.' },
    dazzlingGleam:{ name: 'Dazzling Gleam',el: 'light', cat: 'spec', power: 80,  acc: 100, pp: 10, desc: 'A powerful flash of light.' },
    moonblast:    { name: 'Moonblast',     el: 'light', cat: 'spec', power: 95,  acc: 100, pp: 15, foe: { spa: -1, chance: 30 }, desc: 'The moon\'s power. May lower Sp. Atk.' },
    hypnosis:     { name: 'Hypnosis',      el: 'light', cat: 'status', power: 0, acc: 60, pp: 20, slp: 100, desc: 'Hypnotises the foe to sleep.' },
    // Dark
    bite:         { name: 'Bite',          el: 'dark', cat: 'phys', power: 60,  acc: 100, pp: 25, flinch: 30, desc: 'Bites hard. 30% chance to flinch.' },
    shadowBall:   { name: 'Shadow Ball',   el: 'dark', cat: 'spec', power: 80,  acc: 100, pp: 15, foe: { sdef: -1, chance: 20 }, desc: 'A shadowy blob. May lower Sp. Def.' },
    crunch:       { name: 'Crunch',        el: 'dark', cat: 'phys', power: 80,  acc: 100, pp: 15, foe: { def: -1, chance: 20 }, desc: 'Crunches with sharp fangs. May lower Defence.' },
    darkPulse:    { name: 'Dark Pulse',    el: 'dark', cat: 'spec', power: 80,  acc: 100, pp: 15, flinch: 20, desc: 'A wave of dark thoughts. 20% chance to flinch.' },
    // Neutral
    tackle:       { name: 'Tackle',        el: 'neutral', cat: 'phys', power: 40,  acc: 100, pp: 35, desc: 'A full-body charge.' },
    scratch:      { name: 'Scratch',       el: 'neutral', cat: 'phys', power: 40,  acc: 100, pp: 35, desc: 'Scratches with sharp claws.' },
    quickAttack:  { name: 'Quick Attack',  el: 'neutral', cat: 'phys', power: 40,  acc: 100, pp: 30, pri: 1, desc: 'Always strikes first.' },
    furySwipes:   { name: 'Fury Swipes',   el: 'neutral', cat: 'phys', power: 18,  acc: 80,  pp: 15, hits: [2, 5], desc: 'Scratches 2 to 5 times.' },
    takeDown:     { name: 'Take Down',     el: 'neutral', cat: 'phys', power: 90,  acc: 85,  pp: 20, recoil: 1 / 4, desc: 'A reckless charge. Hurts the user too.' },
    bodySlam:     { name: 'Body Slam',     el: 'neutral', cat: 'phys', power: 85,  acc: 100, pp: 15, par: 30, desc: 'Slams with its whole body. 30% chance to paralyse.' },
    swift:        { name: 'Swift',         el: 'neutral', cat: 'spec', power: 60,  acc: 0,   pp: 20, desc: 'Star-shaped rays that never miss.' },
    hyperBeam:    { name: 'Hyper Beam',    el: 'neutral', cat: 'spec', power: 150, acc: 90,  pp: 5,  recharge: true, desc: 'A mighty beam. The user must rest next turn.' },
    // Support
    growl:        { name: 'Growl',         el: 'neutral', cat: 'status', power: 0, acc: 100, pp: 40, foe: { atk: -1, chance: 100 }, desc: 'Lowers the foe\'s Attack.' },
    tailWhip:     { name: 'Tail Whip',     el: 'neutral', cat: 'status', power: 0, acc: 100, pp: 30, foe: { def: -1, chance: 100 }, desc: 'Lowers the foe\'s Defence.' },
    recover:      { name: 'Recover',       el: 'neutral', cat: 'status', power: 0, acc: 0,   pp: 5,  heal: .5, desc: 'Restores half its max HP.' },
    protect:      { name: 'Protect',       el: 'neutral', cat: 'status', power: 0, acc: 0,   pp: 10, pri: 4, protect: true, desc: 'Blocks the foe\'s move this turn. Fails if used twice in a row.' },
    harden:       { name: 'Harden',        el: 'neutral', cat: 'status', power: 0, acc: 0,   pp: 30, self: { def: 1 }, desc: 'Raises its Defence.' },
    agility:      { name: 'Agility',       el: 'neutral', cat: 'status', power: 0, acc: 0,   pp: 30, self: { spe: 2 }, desc: 'Sharply raises its Speed.' },
    calmMind:     { name: 'Calm Mind',     el: 'neutral', cat: 'status', power: 0, acc: 0,   pp: 20, self: { spa: 1, sdef: 1 }, desc: 'Raises Sp. Atk and Sp. Def.' },
    // fallback when every move is out of PP
    struggle:     { name: 'Struggle',      el: 'none', cat: 'phys', power: 50, acc: 0, pp: 0, struggle: true, desc: 'Used when no PP is left. Hurts the user.' },
  };
  // rename any move here without touching anything else, e.g. { ember: 'Spark Flame' }
  const MOVE_NAMES = {};

  // ---------------- learnsets ----------------
  // Every Pal learns its element's moves as it levels up, plus Neutral and support moves that suit its build
  // (fast Pals learn Quick Attack and Agility, sturdy ones Harden and Protect, strong ones Take Down…), plus a few
  // moves from its original type (ice → Powder Snow, poison → Poison Sting…). The levels are in LEARN.
  const ELEMENT_MOVES = {
    fire:     ['ember', 'fireFang', 'flamethrower', 'fireBlast'],
    water:    ['waterGun', 'aquaTail', 'surf', 'hydroPump'],
    nature:   ['vineWhip', 'razorLeaf', 'energyBall', 'solarBeam'],
    electric: ['thunderShock', 'spark', 'thunderbolt', 'thunder'],
    earth:    ['mudSlap', 'rockThrow', 'rockSlide', 'earthquake'],
    light:    ['fairyWind', 'drainingKiss', 'dazzlingGleam', 'moonblast'],
    dark:     ['bite', 'shadowBall', 'crunch', 'darkPulse'],
    neutral:  ['tackle', 'quickAttack', 'bodySlam', 'hyperBeam'],
  };
  const TYPE_MOVES = {
    ice: ['powderSnow', 'iceBeam'], poison: ['poisonSting', 'sludgeBomb'], grass: ['absorb', 'gigaDrain', 'sleepPowder'],
    bug: ['bulletSeed', 'furySwipes'], fighting: ['doubleKick'], steel: ['harden'], psychic: ['hypnosis', 'calmMind'],
    ghost: ['shadowBall'], fairy: ['drainingKiss'], electric: ['thunderWave'], fire: ['swift'],
    normal: ['furySwipes', 'swift'], flying: ['swift', 'agility'], dragon: ['swift', 'calmMind'], ground: ['mudSlap'], rock: ['harden'],
    dark: ['bite'], water: ['iceBeam'],
  };
  // level each tier of element move is learned at, and when the extras come
  const LEARN = { element: [5, 20, 36, 52], start: 1, support1: 3, build: 10, type1: 12, support2: 22, type2: 36, bulk: 26, extra: 55, finale: 65 };

  // ---------------- explore areas ----------------
  // difficulty and recommended level for each explore map (ids from maps.js). Wild Pals there are at least
  // around this level (levelFloor share of it), so hard maps really are hard.
  const AREAS = {
    wildwood:   { difficulty: 'Easy',   rec: 1 },
    frostcoast: { difficulty: 'Normal', rec: 12 },
    canyon:     { difficulty: 'Normal', rec: 20 },
    ancientlab: { difficulty: 'Hard',   rec: 30 },
    skypeak:    { difficulty: 'Expert', rec: 42 },
    cave:       { difficulty: 'Normal', rec: 1 },
  };
  const AREA_DEFAULT = { difficulty: 'Normal', rec: 10 };
  const LEVEL_FLOOR = .75;

  return { ELEMENTS, TYPE_TO_ELEMENT, SPECIES_ELEMENT, BALANCE, MOVES, MOVE_NAMES, ELEMENT_MOVES, TYPE_MOVES, LEARN, AREAS, AREA_DEFAULT, LEVEL_FLOOR };
})();
