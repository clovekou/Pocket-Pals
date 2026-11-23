'use strict';
// Pocket Pals: every item in the game, shared by the game (game.js) and the Admin page.
//   kind: 'basic' (berries, candy, eggs) · 'ball' (catch wheel) · 'value' (treasure to sell) · 'evo' (evolution item)
//   how (evolution items): 'use' = use it on your main to evolve right away;
//                          'hold' = give it to your main to hold; it evolves at its next level-up
//   buy / sell: default Poké Mart prices in Pokécoins (0 = not sold / not bought). The admin can change them.
//   find: how likely a dungeon treasure chest holds it (weight; bigger = more common). Evolution items are rare.
//   pic: true = its icon is a picture in assets/items/<key>.png (drawn by tools/make_ui_icons.py)
// Which Pokémon each evolution item works on is in evodata.js (tools/build_evolutions.py).

const ITEM_DATA = {
  // ---- basics
  oran:       { name: 'Oran Berry',  icon: 'oran',         kind: 'basic', use: true, buy: 60,   sell: 20,  find: 40, desc: 'Restores every need by 25.' },
  rareCandy:  { name: 'Rare Candy',  icon: 'rareCandy',    kind: 'basic', use: true, buy: 800,  sell: 0,   find: 6,  desc: 'Your main grows 1 level.' },
  mysteryEgg: { name: 'Mystery Egg', icon: 'egg_legend_0', kind: 'basic', use: true, buy: 2500, sell: 0,   find: .15, desc: 'A new egg that hatches into a random Pokémon (needs a free party slot). Very rare in dungeons.' },
  // ---- healing (heal = share of HP restored in Explore; use them from the Items button in a dungeon)
  sitrus:      { name: 'Sitrus Berry', icon: 'sitrus',      pic: true, kind: 'basic', use: true, heal: .3, buy: 150, sell: 40,  find: 16, desc: 'Food +35. In Explore it also restores 30% HP.' },
  potion:      { name: 'Potion',       icon: 'potion',      pic: true, kind: 'basic', heal: .35, buy: 120, sell: 30,  find: 20, desc: 'Restores 35% HP while exploring.' },
  superPotion: { name: 'Super Potion', icon: 'superPotion', pic: true, kind: 'basic', heal: .65, buy: 350, sell: 90,  find: 7,  desc: 'Restores 65% HP while exploring.' },
  hyperPotion: { name: 'Hyper Potion', icon: 'hyperPotion', pic: true, kind: 'basic', heal: 1,   buy: 900, sell: 250, find: 2,  desc: 'Fully restores HP while exploring.' },
  // ---- catch-wheel balls: use one before spinning (after beating a floor boss or a legendary)
  greatBall:  { name: 'Great Ball',  icon: 'greatball',  kind: 'ball', wheel: 'great',  buy: 400,  sell: 0, find: 5,   desc: 'Use it on the catch wheel: every Poké Ball slot becomes a Great Ball.' },
  ultraBall:  { name: 'Ultra Ball',  icon: 'ultraball',  kind: 'ball', wheel: 'ultra',  buy: 1500, sell: 0, find: 1,   desc: 'Very rare. On the catch wheel, every weaker slot becomes an Ultra Ball.' },
  masterBall: { name: 'Master Ball', icon: 'masterball', kind: 'ball', wheel: 'master', buy: 0,    sell: 0, find: .08, desc: 'Extremely rare. Turns the whole catch wheel into Master Balls — a sure catch!' },

  // ---- treasure: found in dungeons, sold at the Poké Mart for Pokécoins
  tinyMushroom: { name: 'Tiny Mushroom', icon: 'tinyMushroom', pic: true, kind: 'value', sell: 40,   find: 14,  desc: 'A small, common mushroom. Sells for a little.' },
  bigMushroom:  { name: 'Big Mushroom',  icon: 'bigMushroom',  pic: true, kind: 'value', sell: 300,  find: 5,   desc: 'A big, rare mushroom. Sells well.' },
  balmMushroom: { name: 'Balm Mushroom', icon: 'balmMushroom', pic: true, kind: 'value', sell: 900,  find: 1.2, desc: 'A sweet-smelling, very rare mushroom.' },
  pearl:        { name: 'Pearl',         icon: 'pearl',                   kind: 'value', sell: 150,  find: 18,  desc: 'A pretty pearl. A collector\'s item.' },
  bigPearl:     { name: 'Big Pearl',     icon: 'bigPearl',     pic: true, kind: 'value', sell: 500,  find: 4,   desc: 'A large, lustrous pearl.' },
  pearlString:  { name: 'Pearl String',  icon: 'pearlString',  pic: true, kind: 'value', sell: 1200, find: 1,   desc: 'A string of beautiful pearls. Very valuable.' },
  stardust:     { name: 'Stardust',      icon: 'stardust',     pic: true, kind: 'value', sell: 200,  find: 10,  desc: 'Lovely red sand that sparkles like stars.' },
  starPiece:    { name: 'Star Piece',    icon: 'starPiece',               kind: 'value', sell: 400,  find: 14,  desc: 'A shard of a shooting star. A collector\'s item.' },
  cometShard:   { name: 'Comet Shard',   icon: 'cometShard',   pic: true, kind: 'value', sell: 1500, find: .8,  desc: 'A shard that fell from a comet. Extremely valuable.' },
  nugget:       { name: 'Nugget',        icon: 'nugget',                  kind: 'value', sell: 1000, find: 8,   desc: 'A nugget of pure gold. A collector\'s item.' },
  bigNugget:    { name: 'Big Nugget',    icon: 'bigNugget',    pic: true, kind: 'value', sell: 3000, find: .6,  desc: 'A big nugget of pure gold that sparkles.' },
  rareBone:     { name: 'Rare Bone',     icon: 'rareBone',     pic: true, kind: 'value', sell: 400,  find: 4,   desc: 'A very old bone. Scientists would love it.' },
  prettyFeather:{ name: 'Pretty Feather',icon: 'prettyFeather',pic: true, kind: 'value', sell: 80,   find: 12,  desc: 'A beautiful feather. Light as air.' },
  relicCopper:  { name: 'Relic Copper',  icon: 'relicCopper',  pic: true, kind: 'value', sell: 100,  find: 6,   desc: 'An ancient copper coin.' },
  relicSilver:  { name: 'Relic Silver',  icon: 'relicSilver',  pic: true, kind: 'value', sell: 300,  find: 3,   desc: 'An ancient silver coin.' },
  relicGold:    { name: 'Relic Gold',    icon: 'relicGold',    pic: true, kind: 'value', sell: 4000, find: .3,  desc: 'An ancient gold coin. Worth a fortune.' },
  relicVase:    { name: 'Relic Vase',    icon: 'relicVase',    pic: true, kind: 'value', sell: 600,  find: 2,   desc: 'An ancient vase from a lost civilisation.' },
  relicBand:    { name: 'Relic Band',    icon: 'relicBand',    pic: true, kind: 'value', sell: 900,  find: 1.4, desc: 'An ancient bracelet set with jewels.' },
  relicStatue:  { name: 'Relic Statue',  icon: 'relicStatue',  pic: true, kind: 'value', sell: 1500, find: .8,  desc: 'An ancient statue of a mysterious Pokémon.' },
  relicCrown:   { name: 'Relic Crown',   icon: 'relicCrown',   pic: true, kind: 'value', sell: 2500, find: .4,  desc: 'An ancient crown fit for a king.' },

  // ---- evolution items: used on your main
  fireStone:    { name: 'Fire Stone',    icon: 'fireStone',    pic: true, kind: 'evo', how: 'use', buy: 1500, sell: 375, find: .5, desc: 'A stone that glows with warm, red heat.' },
  waterStone:   { name: 'Water Stone',   icon: 'waterStone',   pic: true, kind: 'evo', how: 'use', buy: 1500, sell: 375, find: .5, desc: 'A clear blue stone with a ripple inside.' },
  thunderStone: { name: 'Thunder Stone', icon: 'thunderStone', pic: true, kind: 'evo', how: 'use', buy: 1500, sell: 375, find: .5, desc: 'A stone with a lightning bolt pattern.' },
  leafStone:    { name: 'Leaf Stone',    icon: 'leafStone',    pic: true, kind: 'evo', how: 'use', buy: 1500, sell: 375, find: .5, desc: 'A green stone with a leaf pattern.' },
  moonStone:    { name: 'Moon Stone',    icon: 'moonStone',    pic: true, kind: 'evo', how: 'use', buy: 1500, sell: 375, find: .5, desc: 'A dark stone as black as the night sky.' },
  sunStone:     { name: 'Sun Stone',     icon: 'sunStone',     pic: true, kind: 'evo', how: 'use', buy: 1500, sell: 375, find: .5, desc: 'A stone that burns as red as the setting sun.' },
  shinyStone:   { name: 'Shiny Stone',   icon: 'shinyStone',   pic: true, kind: 'evo', how: 'use', buy: 1800, sell: 450, find: .35, desc: 'A stone that sparkles with a dazzling shine.' },
  duskStone:    { name: 'Dusk Stone',    icon: 'duskStone',    pic: true, kind: 'evo', how: 'use', buy: 1800, sell: 450, find: .35, desc: 'A gloomy stone, dark as dusk.' },
  dawnStone:    { name: 'Dawn Stone',    icon: 'dawnStone',    pic: true, kind: 'evo', how: 'use', buy: 1800, sell: 450, find: .35, desc: 'A stone that sparkles like the morning sky.' },
  iceStone:     { name: 'Ice Stone',     icon: 'iceStone',     pic: true, kind: 'evo', how: 'use', buy: 1800, sell: 450, find: .35, desc: 'A stone with a snowflake frozen inside.' },
  linkingCord:  { name: 'Linking Cord',  icon: 'linkingCord',  pic: true, kind: 'evo', how: 'use', buy: 3000, sell: 750, find: .3, desc: 'A mysterious cord. It evolves Pokémon that normally evolve by trading.' },
  sweetApple:   { name: 'Sweet Apple',   icon: 'sweetApple',   pic: true, kind: 'evo', how: 'use', buy: 1200, sell: 300, find: .3, desc: 'A very sweet apple.' },
  tartApple:    { name: 'Tart Apple',    icon: 'tartApple',    pic: true, kind: 'evo', how: 'use', buy: 1200, sell: 300, find: .3, desc: 'A very sour apple.' },
  syrupyApple:  { name: 'Syrupy Apple',  icon: 'syrupyApple',  pic: true, kind: 'evo', how: 'use', buy: 1200, sell: 300, find: .3, desc: 'An apple dripping with sweet syrup.' },
  crackedPot:   { name: 'Cracked Pot',   icon: 'crackedPot',   pic: true, kind: 'evo', how: 'use', buy: 1500, sell: 375, find: .25, desc: 'A cracked teapot. Something lives inside.' },
  unremarkableTeacup: { name: 'Unremarkable Teacup', icon: 'unremarkableTeacup', pic: true, kind: 'evo', how: 'use', buy: 1500, sell: 375, find: .25, desc: 'A plain old teacup. Or is it?' },
  blackAugurite:{ name: 'Black Augurite',icon: 'blackAugurite',pic: true, kind: 'evo', how: 'use', buy: 3000, sell: 750, find: .2, desc: 'A glassy black stone that splits when struck.' },
  peatBlock:    { name: 'Peat Block',    icon: 'peatBlock',    pic: true, kind: 'evo', how: 'use', buy: 3000, sell: 750, find: .2, desc: 'A block of muddy material that smells of the earth.' },
  metalAlloy:   { name: 'Metal Alloy',   icon: 'metalAlloy',   pic: true, kind: 'evo', how: 'use', buy: 3000, sell: 750, find: .2, desc: 'A strange metal made of layered steel.' },
  auspiciousArmor: { name: 'Auspicious Armor', icon: 'auspiciousArmor', pic: true, kind: 'evo', how: 'use', buy: 3000, sell: 750, find: .2, desc: 'Armour full of hope and good fortune.' },
  galaricaCuff:    { name: 'Galarica Cuff',    icon: 'galaricaCuff',    pic: true, kind: 'evo', how: 'use', buy: 2500, sell: 625, find: .15, desc: 'A bracelet woven from Galarica twigs.' },
  galaricaWreath:  { name: 'Galarica Wreath',  icon: 'galaricaWreath',  pic: true, kind: 'evo', how: 'use', buy: 2500, sell: 625, find: .15, desc: 'A wreath made from woven Galarica twigs.' },
  scrollOfDarkness:{ name: 'Scroll of Darkness', icon: 'scrollOfDarkness', pic: true, kind: 'evo', how: 'use', buy: 5000, sell: 1250, find: .08, desc: 'A scroll of the secrets of the dark arts.' },
  scrollOfWaters:  { name: 'Scroll of Waters', icon: 'scrollOfWaters',  pic: true, kind: 'evo', how: 'use', buy: 5000, sell: 1250, find: .08, desc: 'A scroll of the secrets of the flowing waters.' },
  maliciousArmor:  { name: 'Malicious Armor',  icon: 'maliciousArmor',  pic: true, kind: 'evo', how: 'use', buy: 3000, sell: 750, find: .2, desc: 'Armour full of grudges and resentment.' },

  // ---- evolution items: held by your main until its next level-up
  kingsRock:    { name: "King's Rock",   icon: 'kingsRock',    pic: true, kind: 'evo', how: 'hold', buy: 2500, sell: 625, find: .3, desc: 'A rock shaped like a crown.' },
  metalCoat:    { name: 'Metal Coat',    icon: 'metalCoat',    pic: true, kind: 'evo', how: 'hold', buy: 2500, sell: 625, find: .3, desc: 'A special coating that protects with metal.' },
  dragonScale:  { name: 'Dragon Scale',  icon: 'dragonScale',  pic: true, kind: 'evo', how: 'hold', buy: 2500, sell: 625, find: .3, desc: 'A thick, tough scale from a dragon.' },
  upgrade:      { name: 'Up-Grade',      icon: 'upgrade',      pic: true, kind: 'evo', how: 'hold', buy: 2500, sell: 625, find: .3, desc: 'A transparent device full of data.' },
  dubiousDisc:  { name: 'Dubious Disc',  icon: 'dubiousDisc',  pic: true, kind: 'evo', how: 'hold', buy: 2500, sell: 625, find: .3, desc: 'A clear disc overflowing with dubious data.' },
  protector:    { name: 'Protector',     icon: 'protector',    pic: true, kind: 'evo', how: 'hold', buy: 2500, sell: 625, find: .3, desc: 'A protective item that is extremely heavy.' },
  electirizer:  { name: 'Electirizer',   icon: 'electirizer',  pic: true, kind: 'evo', how: 'hold', buy: 2500, sell: 625, find: .3, desc: 'A box packed with a huge amount of electricity.' },
  magmarizer:   { name: 'Magmarizer',    icon: 'magmarizer',   pic: true, kind: 'evo', how: 'hold', buy: 2500, sell: 625, find: .3, desc: 'A box packed with a huge amount of magma.' },
  reaperCloth:  { name: 'Reaper Cloth',  icon: 'reaperCloth',  pic: true, kind: 'evo', how: 'hold', buy: 2500, sell: 625, find: .3, desc: 'A cloth imbued with spiritual energy.' },
  razorClaw:    { name: 'Razor Claw',    icon: 'razorClaw',    pic: true, kind: 'evo', how: 'hold', buy: 2500, sell: 625, find: .3, desc: 'A sharply hooked claw.' },
  razorFang:    { name: 'Razor Fang',    icon: 'razorFang',    pic: true, kind: 'evo', how: 'hold', buy: 2500, sell: 625, find: .3, desc: 'A sharp fang.' },
  ovalStone:    { name: 'Oval Stone',    icon: 'ovalStone',    pic: true, kind: 'evo', how: 'hold', buy: 2000, sell: 500, find: .3, desc: 'A peculiar stone shaped just like an egg.' },
  deepSeaTooth: { name: 'Deep Sea Tooth',icon: 'deepSeaTooth', pic: true, kind: 'evo', how: 'hold', buy: 2500, sell: 625, find: .25, desc: 'A fang that gleams a sharp silver.' },
  deepSeaScale: { name: 'Deep Sea Scale',icon: 'deepSeaScale', pic: true, kind: 'evo', how: 'hold', buy: 2500, sell: 625, find: .25, desc: 'A scale that shines a faint pink.' },
  prismScale:   { name: 'Prism Scale',   icon: 'prismScale',   pic: true, kind: 'evo', how: 'hold', buy: 2500, sell: 625, find: .25, desc: 'A mysterious scale that shines in many colours.' },
  sachet:       { name: 'Sachet',        icon: 'sachet',       pic: true, kind: 'evo', how: 'hold', buy: 2500, sell: 625, find: .25, desc: 'A sachet filled with fragrant perfume.' },
  whippedDream: { name: 'Whipped Dream', icon: 'whippedDream', pic: true, kind: 'evo', how: 'hold', buy: 2500, sell: 625, find: .25, desc: 'A soft and sweet treat made of fluffy cream.' },
};
