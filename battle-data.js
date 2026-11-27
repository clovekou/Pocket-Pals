'use strict';
// Pocket Pals — battle data: the Pokémon type chart, moves, learnsets, balance and explore areas.
// Everything here is plain data so it can be tuned without touching the game code (battle.js reads it).
// Safe to edit: change numbers, rename moves (MOVE_NAMES), add moves, or change which areas are hard.

window.PP_BATTLE = (() => {
  // ---------------- types (the 18 Pokémon types; every species has one or two: el / el2 in species.js) ----------------
  // se: its moves are super effective (2×) against these · nve: not very effective (½×) · none: no effect (0×).
  // Against a Pal with two types the numbers multiply (4×, 2×, 1×, ½×, ¼× or 0×), like the main games.
  const ELEMENTS = {
    normal:   { label: 'Normal',   icon: '⭐', color: '#a8a77a', se: [], nve: ['rock', 'steel'], none: ['ghost'] },
    fire:     { label: 'Fire',     icon: '🔥', color: '#ee8130', se: ['grass', 'ice', 'bug', 'steel'], nve: ['fire', 'water', 'rock', 'dragon'], none: [] },
    water:    { label: 'Water',    icon: '💧', color: '#6390f0', se: ['fire', 'ground', 'rock'], nve: ['water', 'grass', 'dragon'], none: [] },
    electric: { label: 'Electric', icon: '⚡', color: '#e7c11f', se: ['water', 'flying'], nve: ['electric', 'grass', 'dragon'], none: ['ground'] },
    grass:    { label: 'Grass',    icon: '🌿', color: '#5fb04a', se: ['water', 'ground', 'rock'], nve: ['fire', 'grass', 'poison', 'flying', 'bug', 'dragon', 'steel'], none: [] },
    ice:      { label: 'Ice',      icon: '❄️', color: '#74cec0', se: ['grass', 'ground', 'flying', 'dragon'], nve: ['fire', 'water', 'ice', 'steel'], none: [] },
    fighting: { label: 'Fighting', icon: '🥊', color: '#c22e28', se: ['normal', 'ice', 'rock', 'dark', 'steel'], nve: ['poison', 'flying', 'psychic', 'bug', 'fairy'], none: ['ghost'] },
    poison:   { label: 'Poison',   icon: '☠️', color: '#a33ea1', se: ['grass', 'fairy'], nve: ['poison', 'ground', 'rock', 'ghost'], none: ['steel'] },
    ground:   { label: 'Ground',   icon: '⛰️', color: '#c9a44a', se: ['fire', 'electric', 'poison', 'rock', 'steel'], nve: ['grass', 'bug'], none: ['flying'] },
    flying:   { label: 'Flying',   icon: '🪶', color: '#8f7fe8', se: ['grass', 'fighting', 'bug'], nve: ['electric', 'rock', 'steel'], none: [] },
    psychic:  { label: 'Psychic',  icon: '🔮', color: '#f95587', se: ['fighting', 'poison'], nve: ['psychic', 'steel'], none: ['dark'] },
    bug:      { label: 'Bug',      icon: '🐛', color: '#91a119', se: ['grass', 'psychic', 'dark'], nve: ['fire', 'fighting', 'poison', 'flying', 'ghost', 'steel', 'fairy'], none: [] },
    rock:     { label: 'Rock',     icon: '🪨', color: '#b6a136', se: ['fire', 'ice', 'flying', 'bug'], nve: ['fighting', 'ground', 'steel'], none: [] },
    ghost:    { label: 'Ghost',    icon: '👻', color: '#735797', se: ['psychic', 'ghost'], nve: ['dark'], none: ['normal'] },
    dragon:   { label: 'Dragon',   icon: '🐉', color: '#6f35fc', se: ['dragon'], nve: ['steel'], none: ['fairy'] },
    dark:     { label: 'Dark',     icon: '🌙', color: '#705746', se: ['psychic', 'ghost'], nve: ['fighting', 'dark', 'fairy'], none: [] },
    steel:    { label: 'Steel',    icon: '⚙️', color: '#8a8aa8', se: ['ice', 'rock', 'fairy'], nve: ['fire', 'water', 'electric', 'steel'], none: [] },
    fairy:    { label: 'Fairy',    icon: '✨', color: '#d685ad', se: ['fighting', 'dragon', 'dark'], nve: ['fire', 'poison', 'steel'], none: [] },
  };
  // types that can't get a status (like the main games)
  const STATUS_IMMUNE = { brn: ['fire'], par: ['electric'], frz: ['ice'], psn: ['poison', 'steel'] };

  // ---------------- balance ----------------
  const BALANCE = {
    superEffective: 2, notVeryEffective: .5, noEffect: 0, stab: 1.5,
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
    // special lean: how much a type's Pals favour Sp. Atk / Sp. Def over Attack / Defence (two types: the average)
    specialLean: { normal: .95, fire: 1.08, water: 1.06, electric: 1.1, grass: 1.0, ice: 1.06, fighting: .85, poison: 1.0, ground: .9,
      flying: 1.0, psychic: 1.15, bug: .95, rock: .88, ghost: 1.08, dragon: 1.0, dark: 1.0, steel: .92, fairy: 1.12 },
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
    // the PP-free fallback
    struggle: 'struggle',
    // enemy AI: chance it picks its best-scoring move (bosses think harder)
    aiSmart: { wild: .65, boss: .85, legend: .9, trainer: .8 },
    capture: { statusBonus: { slp: 2, frz: 2, par: 1.5, psn: 1.5, brn: 1.5 } },
  };

  // ---------------- moves ----------------
  // el: the move's type.  cat: 'phys' | 'spec' | 'status'.  power 0 for status.  acc: 0-100 (0 = never misses).  pri: priority.
  // effect keys: burn/par/psn/slp/frz/flinch (chance %), self / foe stat changes {stat: stages, chance},
  // drain (share of damage healed), recoil (share of damage taken), heal (share of max HP), hits [min,max],
  // crit (extra crit stages), protect, charge (needs a turn to charge), recharge (rests the next turn)
  const MOVES = {
    // Normal
    tackle:       { name: 'Tackle',        el: 'normal', cat: 'phys', power: 40,  acc: 100, pp: 35, desc: 'A full-body charge.' },
    scratch:      { name: 'Scratch',       el: 'normal', cat: 'phys', power: 40,  acc: 100, pp: 35, desc: 'Scratches with sharp claws.' },
    quickAttack:  { name: 'Quick Attack',  el: 'normal', cat: 'phys', power: 40,  acc: 100, pp: 30, pri: 1, desc: 'Always strikes first.' },
    furySwipes:   { name: 'Fury Swipes',   el: 'normal', cat: 'phys', power: 18,  acc: 80,  pp: 15, hits: [2, 5], desc: 'Scratches 2 to 5 times.' },
    takeDown:     { name: 'Take Down',     el: 'normal', cat: 'phys', power: 90,  acc: 85,  pp: 20, recoil: 1 / 4, desc: 'A reckless charge. Hurts the user too.' },
    bodySlam:     { name: 'Body Slam',     el: 'normal', cat: 'phys', power: 85,  acc: 100, pp: 15, par: 30, desc: 'Slams with its whole body. 30% chance to paralyse.' },
    swift:        { name: 'Swift',         el: 'normal', cat: 'spec', power: 60,  acc: 0,   pp: 20, desc: 'Star-shaped rays that never miss.' },
    hyperBeam:    { name: 'Hyper Beam',    el: 'normal', cat: 'spec', power: 150, acc: 90,  pp: 5,  recharge: true, desc: 'A mighty beam. The user must rest next turn.' },
    // Fire
    ember:        { name: 'Ember',         el: 'fire', cat: 'spec', power: 40,  acc: 100, pp: 25, burn: 10, desc: 'A small flame. 10% chance to burn.' },
    fireFang:     { name: 'Fire Fang',     el: 'fire', cat: 'phys', power: 65,  acc: 95,  pp: 15, burn: 10, flinch: 10, desc: 'A fiery bite. May burn or make the foe flinch.' },
    flamethrower: { name: 'Flamethrower',  el: 'fire', cat: 'spec', power: 90,  acc: 100, pp: 15, burn: 10, desc: 'A blast of fire. 10% chance to burn.' },
    fireBlast:    { name: 'Fire Blast',    el: 'fire', cat: 'spec', power: 110, acc: 85,  pp: 5,  burn: 10, desc: 'A huge, all-consuming fire. 10% chance to burn.' },
    flareBlitz:   { name: 'Flare Blitz',   el: 'fire', cat: 'phys', power: 120, acc: 100, pp: 15, burn: 10, recoil: 1 / 3, desc: 'A blazing charge. Hurts the user too.' },
    // Water
    waterGun:     { name: 'Water Gun',     el: 'water', cat: 'spec', power: 40,  acc: 100, pp: 25, desc: 'Squirts water at the foe.' },
    bubbleBeam:   { name: 'Bubble Beam',   el: 'water', cat: 'spec', power: 65,  acc: 100, pp: 20, foe: { spe: -1, chance: 10 }, desc: 'A spray of bubbles. May lower Speed.' },
    aquaTail:     { name: 'Aqua Tail',     el: 'water', cat: 'phys', power: 90,  acc: 90,  pp: 10, desc: 'Swings its tail like a raging wave.' },
    surf:         { name: 'Surf',          el: 'water', cat: 'spec', power: 90,  acc: 100, pp: 15, desc: 'A big wave crashes down.' },
    hydroPump:    { name: 'Hydro Pump',    el: 'water', cat: 'spec', power: 110, acc: 80,  pp: 5,  desc: 'A powerful blast of water.' },
    // Grass
    vineWhip:     { name: 'Vine Whip',     el: 'grass', cat: 'phys', power: 45,  acc: 100, pp: 25, desc: 'Strikes with slender vines.' },
    razorLeaf:    { name: 'Razor Leaf',    el: 'grass', cat: 'phys', power: 55,  acc: 95,  pp: 25, crit: 1, desc: 'Sharp leaves. Lands critical hits more often.' },
    energyBall:   { name: 'Energy Ball',   el: 'grass', cat: 'spec', power: 90,  acc: 100, pp: 10, foe: { sdef: -1, chance: 10 }, desc: 'Nature\'s power. May lower Sp. Def.' },
    solarBeam:    { name: 'Solar Beam',    el: 'grass', cat: 'spec', power: 120, acc: 100, pp: 10, charge: true, desc: 'Soaks up light on the first turn, fires on the next.' },
    absorb:       { name: 'Absorb',        el: 'grass', cat: 'spec', power: 20,  acc: 100, pp: 25, drain: .5, desc: 'Drains HP. Heals half the damage dealt.' },
    gigaDrain:    { name: 'Giga Drain',    el: 'grass', cat: 'spec', power: 75,  acc: 100, pp: 10, drain: .5, desc: 'A big drain. Heals half the damage dealt.' },
    bulletSeed:   { name: 'Bullet Seed',   el: 'grass', cat: 'phys', power: 25,  acc: 100, pp: 30, hits: [2, 5], desc: 'Shoots 2 to 5 seeds in a row.' },
    sleepPowder:  { name: 'Sleep Powder',  el: 'grass', cat: 'status', power: 0, acc: 75, pp: 15, slp: 100, desc: 'A sleep-inducing powder.' },
    // Electric
    thunderShock: { name: 'Thunder Shock', el: 'electric', cat: 'spec', power: 40,  acc: 100, pp: 30, par: 10, desc: 'A jolt of electricity. 10% chance to paralyse.' },
    spark:        { name: 'Spark',         el: 'electric', cat: 'phys', power: 65,  acc: 100, pp: 20, par: 30, desc: 'An electric tackle. 30% chance to paralyse.' },
    thunderbolt:  { name: 'Thunderbolt',   el: 'electric', cat: 'spec', power: 90,  acc: 100, pp: 15, par: 10, desc: 'A strong electric blast. 10% chance to paralyse.' },
    thunder:      { name: 'Thunder',       el: 'electric', cat: 'spec', power: 110, acc: 70,  pp: 10, par: 30, desc: 'A wicked thunderbolt. 30% chance to paralyse.' },
    thunderWave:  { name: 'Thunder Wave',  el: 'electric', cat: 'status', power: 0, acc: 90, pp: 20, par: 100, desc: 'A weak jolt that paralyses the foe.' },
    // Ice
    powderSnow:   { name: 'Powder Snow',   el: 'ice', cat: 'spec', power: 40,  acc: 100, pp: 25, frz: 10, desc: 'Freezing snow. 10% chance to freeze.' },
    iceShard:     { name: 'Ice Shard',     el: 'ice', cat: 'phys', power: 40,  acc: 100, pp: 30, pri: 1, desc: 'A chunk of ice that always strikes first.' },
    iceFang:      { name: 'Ice Fang',      el: 'ice', cat: 'phys', power: 65,  acc: 95,  pp: 15, frz: 10, flinch: 10, desc: 'An icy bite. May freeze or make the foe flinch.' },
    iceBeam:      { name: 'Ice Beam',      el: 'ice', cat: 'spec', power: 90,  acc: 100, pp: 10, frz: 10, desc: 'An icy beam. 10% chance to freeze.' },
    blizzard:     { name: 'Blizzard',      el: 'ice', cat: 'spec', power: 110, acc: 70,  pp: 5,  frz: 10, desc: 'A howling blizzard. 10% chance to freeze.' },
    // Fighting
    rockSmash:    { name: 'Rock Smash',    el: 'fighting', cat: 'phys', power: 40,  acc: 100, pp: 15, foe: { def: -1, chance: 50 }, desc: 'A rock-breaking punch. May lower Defence.' },
    doubleKick:   { name: 'Double Kick',   el: 'fighting', cat: 'phys', power: 30,  acc: 100, pp: 30, hits: [2, 2], desc: 'Kicks twice in a row.' },
    brickBreak:   { name: 'Brick Break',   el: 'fighting', cat: 'phys', power: 75,  acc: 100, pp: 15, desc: 'A karate chop strong enough to break bricks.' },
    bulkUp:       { name: 'Bulk Up',       el: 'fighting', cat: 'status', power: 0, acc: 0, pp: 20, self: { atk: 1, def: 1 }, desc: 'Tenses its muscles. Raises Attack and Defence.' },
    closeCombat:  { name: 'Close Combat',  el: 'fighting', cat: 'phys', power: 120, acc: 100, pp: 5,  self: { def: -1, sdef: -1 }, desc: 'An all-out attack. Lowers its own Defence and Sp. Def.' },
    // Poison
    poisonSting:  { name: 'Poison Sting',  el: 'poison', cat: 'phys', power: 15,  acc: 100, pp: 35, psn: 30, desc: 'A toxic barb. 30% chance to poison.' },
    acid:         { name: 'Acid',          el: 'poison', cat: 'spec', power: 40,  acc: 100, pp: 30, foe: { sdef: -1, chance: 10 }, desc: 'Sprays acid. May lower Sp. Def.' },
    poisonJab:    { name: 'Poison Jab',    el: 'poison', cat: 'phys', power: 80,  acc: 100, pp: 20, psn: 30, desc: 'A toxic stab. 30% chance to poison.' },
    sludgeBomb:   { name: 'Sludge Bomb',   el: 'poison', cat: 'spec', power: 90,  acc: 100, pp: 10, psn: 30, desc: 'Hurls sludge. 30% chance to poison.' },
    // Ground
    mudSlap:      { name: 'Mud-Slap',      el: 'ground', cat: 'spec', power: 20,  acc: 100, pp: 10, foe: { acc: -1, chance: 100 }, desc: 'Mud in the face. Lowers accuracy.' },
    bulldoze:     { name: 'Bulldoze',      el: 'ground', cat: 'phys', power: 60,  acc: 100, pp: 20, foe: { spe: -1, chance: 100 }, desc: 'Stomps the ground. Lowers Speed.' },
    earthPower:   { name: 'Earth Power',   el: 'ground', cat: 'spec', power: 90,  acc: 100, pp: 10, foe: { sdef: -1, chance: 10 }, desc: 'The ground erupts. May lower Sp. Def.' },
    earthquake:   { name: 'Earthquake',    el: 'ground', cat: 'phys', power: 100, acc: 100, pp: 10, desc: 'A powerful quake.' },
    // Flying
    gust:         { name: 'Gust',          el: 'flying', cat: 'spec', power: 40,  acc: 100, pp: 35, desc: 'Whips up a strong gust of wind.' },
    wingAttack:   { name: 'Wing Attack',   el: 'flying', cat: 'phys', power: 60,  acc: 100, pp: 35, desc: 'Strikes with wide-spread wings.' },
    airSlash:     { name: 'Air Slash',     el: 'flying', cat: 'spec', power: 75,  acc: 95,  pp: 15, flinch: 30, desc: 'A blade of air. 30% chance to flinch.' },
    braveBird:    { name: 'Brave Bird',    el: 'flying', cat: 'phys', power: 120, acc: 100, pp: 15, recoil: 1 / 3, desc: 'A low, reckless dive. Hurts the user too.' },
    // Psychic
    confusion:    { name: 'Confusion',     el: 'psychic', cat: 'spec', power: 50,  acc: 100, pp: 25, desc: 'A weak telekinetic attack.' },
    psybeam:      { name: 'Psybeam',       el: 'psychic', cat: 'spec', power: 65,  acc: 100, pp: 20, desc: 'A peculiar ray.' },
    zenHeadbutt:  { name: 'Zen Headbutt',  el: 'psychic', cat: 'phys', power: 80,  acc: 90,  pp: 15, flinch: 20, desc: 'A focused headbutt. 20% chance to flinch.' },
    psychic:      { name: 'Psychic',       el: 'psychic', cat: 'spec', power: 90,  acc: 100, pp: 10, foe: { sdef: -1, chance: 10 }, desc: 'A strong telekinetic force. May lower Sp. Def.' },
    hypnosis:     { name: 'Hypnosis',      el: 'psychic', cat: 'status', power: 0, acc: 60, pp: 20, slp: 100, desc: 'Hypnotises the foe to sleep.' },
    calmMind:     { name: 'Calm Mind',     el: 'psychic', cat: 'status', power: 0, acc: 0,  pp: 20, self: { spa: 1, sdef: 1 }, desc: 'Raises Sp. Atk and Sp. Def.' },
    // Bug
    furyCutter:   { name: 'Fury Cutter',   el: 'bug', cat: 'phys', power: 40,  acc: 95,  pp: 20, desc: 'Slashes with scythes or claws.' },
    bugBite:      { name: 'Bug Bite',      el: 'bug', cat: 'phys', power: 60,  acc: 100, pp: 20, desc: 'A biting attack.' },
    xScissor:     { name: 'X-Scissor',     el: 'bug', cat: 'phys', power: 80,  acc: 100, pp: 15, desc: 'Slashes with crossed scythes.' },
    bugBuzz:      { name: 'Bug Buzz',      el: 'bug', cat: 'spec', power: 90,  acc: 100, pp: 10, foe: { sdef: -1, chance: 10 }, desc: 'A damaging sound wave. May lower Sp. Def.' },
    // Rock
    rockThrow:    { name: 'Rock Throw',    el: 'rock', cat: 'phys', power: 50,  acc: 90,  pp: 15, desc: 'Throws a small rock.' },
    rockTomb:     { name: 'Rock Tomb',     el: 'rock', cat: 'phys', power: 60,  acc: 95,  pp: 15, foe: { spe: -1, chance: 100 }, desc: 'Boulders block the foe. Lowers Speed.' },
    rockSlide:    { name: 'Rock Slide',    el: 'rock', cat: 'phys', power: 75,  acc: 90,  pp: 10, flinch: 30, desc: 'Large boulders. 30% chance to flinch.' },
    stoneEdge:    { name: 'Stone Edge',    el: 'rock', cat: 'phys', power: 100, acc: 80,  pp: 5,  crit: 1, desc: 'Sharp stones. Lands critical hits more often.' },
    // Ghost
    lick:         { name: 'Lick',          el: 'ghost', cat: 'phys', power: 30,  acc: 100, pp: 30, par: 30, desc: 'A long tongue. 30% chance to paralyse.' },
    shadowSneak:  { name: 'Shadow Sneak',  el: 'ghost', cat: 'phys', power: 40,  acc: 100, pp: 30, pri: 1, desc: 'Strikes from the shadows first.' },
    shadowClaw:   { name: 'Shadow Claw',   el: 'ghost', cat: 'phys', power: 70,  acc: 100, pp: 15, crit: 1, desc: 'A shadowy claw. Lands critical hits more often.' },
    shadowBall:   { name: 'Shadow Ball',   el: 'ghost', cat: 'spec', power: 80,  acc: 100, pp: 15, foe: { sdef: -1, chance: 20 }, desc: 'A shadowy blob. May lower Sp. Def.' },
    // Dragon
    twister:      { name: 'Twister',       el: 'dragon', cat: 'spec', power: 40,  acc: 100, pp: 20, flinch: 20, desc: 'A twisting vortex. 20% chance to flinch.' },
    dragonBreath: { name: 'Dragon Breath', el: 'dragon', cat: 'spec', power: 60,  acc: 100, pp: 20, par: 30, desc: 'A strong breath. 30% chance to paralyse.' },
    dragonClaw:   { name: 'Dragon Claw',   el: 'dragon', cat: 'phys', power: 80,  acc: 100, pp: 15, desc: 'Slashes with sharp claws.' },
    dragonPulse:  { name: 'Dragon Pulse',  el: 'dragon', cat: 'spec', power: 85,  acc: 100, pp: 10, desc: 'A shockwave from its mouth.' },
    // Dark
    bite:         { name: 'Bite',          el: 'dark', cat: 'phys', power: 60,  acc: 100, pp: 25, flinch: 30, desc: 'Bites hard. 30% chance to flinch.' },
    snarl:        { name: 'Snarl',         el: 'dark', cat: 'spec', power: 55,  acc: 95,  pp: 15, foe: { spa: -1, chance: 100 }, desc: 'A nasty yell. Lowers Sp. Atk.' },
    crunch:       { name: 'Crunch',        el: 'dark', cat: 'phys', power: 80,  acc: 100, pp: 15, foe: { def: -1, chance: 20 }, desc: 'Crunches with sharp fangs. May lower Defence.' },
    darkPulse:    { name: 'Dark Pulse',    el: 'dark', cat: 'spec', power: 80,  acc: 100, pp: 15, flinch: 20, desc: 'A wave of dark thoughts. 20% chance to flinch.' },
    // Steel
    metalClaw:    { name: 'Metal Claw',    el: 'steel', cat: 'phys', power: 50,  acc: 95,  pp: 35, desc: 'Rakes with steel claws.' },
    steelWing:    { name: 'Steel Wing',    el: 'steel', cat: 'phys', power: 70,  acc: 90,  pp: 25, desc: 'Strikes with hard wings.' },
    ironHead:     { name: 'Iron Head',     el: 'steel', cat: 'phys', power: 80,  acc: 100, pp: 15, flinch: 30, desc: 'A steel-hard headbutt. 30% chance to flinch.' },
    flashCannon:  { name: 'Flash Cannon',  el: 'steel', cat: 'spec', power: 80,  acc: 100, pp: 10, foe: { sdef: -1, chance: 10 }, desc: 'A flash of light energy. May lower Sp. Def.' },
    // Fairy
    fairyWind:    { name: 'Fairy Wind',    el: 'fairy', cat: 'spec', power: 40,  acc: 100, pp: 30, desc: 'Stirs up a fairy wind.' },
    drainingKiss: { name: 'Draining Kiss', el: 'fairy', cat: 'spec', power: 50,  acc: 100, pp: 10, drain: .75, desc: 'A kiss that steals HP. Heals most of the damage.' },
    dazzlingGleam:{ name: 'Dazzling Gleam',el: 'fairy', cat: 'spec', power: 80,  acc: 100, pp: 10, desc: 'A powerful flash of light.' },
    moonblast:    { name: 'Moonblast',     el: 'fairy', cat: 'spec', power: 95,  acc: 100, pp: 15, foe: { spa: -1, chance: 30 }, desc: 'The moon\'s power. May lower Sp. Atk.' },
    // Support
    growl:        { name: 'Growl',         el: 'normal', cat: 'status', power: 0, acc: 100, pp: 40, foe: { atk: -1, chance: 100 }, desc: 'Lowers the foe\'s Attack.' },
    tailWhip:     { name: 'Tail Whip',     el: 'normal', cat: 'status', power: 0, acc: 100, pp: 30, foe: { def: -1, chance: 100 }, desc: 'Lowers the foe\'s Defence.' },
    recover:      { name: 'Recover',       el: 'normal', cat: 'status', power: 0, acc: 0,   pp: 5,  heal: .5, desc: 'Restores half its max HP.' },
    protect:      { name: 'Protect',       el: 'normal', cat: 'status', power: 0, acc: 0,   pp: 10, pri: 4, protect: true, desc: 'Blocks the foe\'s move this turn. Fails if used twice in a row.' },
    harden:       { name: 'Harden',        el: 'normal', cat: 'status', power: 0, acc: 0,   pp: 30, self: { def: 1 }, desc: 'Raises its Defence.' },
    agility:      { name: 'Agility',       el: 'psychic', cat: 'status', power: 0, acc: 0,  pp: 30, self: { spe: 2 }, desc: 'Sharply raises its Speed.' },
    // fallback when every move is out of PP (no type: always 1×)
    struggle:     { name: 'Struggle',      el: 'none', cat: 'phys', power: 50, acc: 0, pp: 0, struggle: true, desc: 'Used when no PP is left. Hurts the user.' },
  };
  // rename any move here without touching anything else, e.g. { ember: 'Spark Flame' }
  const MOVE_NAMES = {};

  // ---------------- learnsets ----------------
  // Every Pal learns its first type's 4 moves as it levels up, its second type's first 3 a little later,
  // plus Normal and support moves that suit its build (fast Pals learn Quick Attack and Agility, sturdy ones Harden
  // and Protect, strong ones Take Down…) and a few extras for its types. The levels are in LEARN.
  const ELEMENT_MOVES = {
    normal:   ['tackle', 'quickAttack', 'bodySlam', 'hyperBeam'],
    fire:     ['ember', 'fireFang', 'flamethrower', 'fireBlast'],
    water:    ['waterGun', 'bubbleBeam', 'surf', 'hydroPump'],
    electric: ['thunderShock', 'spark', 'thunderbolt', 'thunder'],
    grass:    ['vineWhip', 'razorLeaf', 'energyBall', 'solarBeam'],
    ice:      ['powderSnow', 'iceFang', 'iceBeam', 'blizzard'],
    fighting: ['rockSmash', 'doubleKick', 'brickBreak', 'closeCombat'],
    poison:   ['poisonSting', 'acid', 'poisonJab', 'sludgeBomb'],
    ground:   ['mudSlap', 'bulldoze', 'earthPower', 'earthquake'],
    flying:   ['gust', 'wingAttack', 'airSlash', 'braveBird'],
    psychic:  ['confusion', 'psybeam', 'zenHeadbutt', 'psychic'],
    bug:      ['furyCutter', 'bugBite', 'xScissor', 'bugBuzz'],
    rock:     ['rockThrow', 'rockTomb', 'rockSlide', 'stoneEdge'],
    ghost:    ['lick', 'shadowSneak', 'shadowClaw', 'shadowBall'],
    dragon:   ['twister', 'dragonBreath', 'dragonClaw', 'dragonPulse'],
    dark:     ['bite', 'snarl', 'crunch', 'darkPulse'],
    steel:    ['metalClaw', 'steelWing', 'ironHead', 'flashCannon'],
    fairy:    ['fairyWind', 'drainingKiss', 'dazzlingGleam', 'moonblast'],
  };
  // extra moves for a type (learned at LEARN.type1 / type2 / type2 + 8)
  const TYPE_MOVES = {
    ice: ['iceShard'], poison: ['poisonJab'], grass: ['absorb', 'gigaDrain', 'sleepPowder'],
    bug: ['bulletSeed', 'furySwipes'], fighting: ['bulkUp'], steel: ['harden'], psychic: ['hypnosis', 'calmMind'],
    ghost: ['hypnosis'], fairy: ['drainingKiss', 'calmMind'], electric: ['thunderWave'], fire: ['swift'],
    normal: ['furySwipes', 'swift'], flying: ['agility'], dragon: ['agility'], ground: ['rockTomb'], rock: ['harden'],
    dark: ['furySwipes'], water: ['aquaTail'],
  };
  // level each tier of the first type's moves is learned at; the second type's come a few levels later
  const LEARN = { element: [5, 20, 36, 52], second: [9, 26, 44], start: 1, support1: 3, build: 10, type1: 12, support2: 22, type2: 36, bulk: 26, extra: 55, finale: 65 };

  // ---------------- explore areas ----------------
  // difficulty and recommended level for each explore map (ids from maps.js). Wild Pals there are at least
  // around this level (LEVEL_FLOOR share of it), so hard maps really are hard.
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

  return { ELEMENTS, STATUS_IMMUNE, BALANCE, MOVES, MOVE_NAMES, ELEMENT_MOVES, TYPE_MOVES, LEARN, AREAS, AREA_DEFAULT, LEVEL_FLOOR };
})();
