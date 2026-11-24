// Pocket Pal — explore maps: the built-in defaults, shared by the game (game.js, ui.js) and the Admin page.
// The admin can override any map's Pokémon, legendary and main chase (Admin → Explore maps, stored in Firestore config/maps);
// these are the values used until then, and whenever an override is cleared.
//   types:       which Pokémon types live there, as weights (bigger = more common); null = every type
//   beast:       the map's legendary (species id); it can be the floor boss, or wander in very rarely
//   beastChance: % chance the floor boss is that legendary
//   noLegend:    true = no legendaries at all on this map
//   chase:       the map's "main chase" Pokémon (species id), shown on the map card
//   chaseChance: % chance each wild battle is the chase Pokémon
window.EXPLORE_MAP_DEFAULTS = [
  { id: 'cave', name: 'Crystal Cave', thumb: 'backgrounds/explore/thumb/cave.jpg',
    types: null, beast: 719, beastChance: 2 },                                                        // Diancie
  { id: 'forest', name: 'Deep Forest', src: 'backgrounds/explore/forest.jpg', thumb: 'backgrounds/explore/thumb/forest.jpg',
    types: { grass: 6, bug: 5, poison: 2, fairy: 1, normal: 1 }, beast: 251, beastChance: 4 },        // Celebi — a bit more likely
  { id: 'desert', name: 'Desert Ruins', src: 'backgrounds/explore/desert.jpg', thumb: 'backgrounds/explore/thumb/desert.jpg',
    types: { ground: 6, rock: 5, fire: 2, fighting: 1 }, noLegend: true },                            // no legendaries here
  { id: 'building', name: 'Abandoned Building', src: 'backgrounds/explore/building.jpg', thumb: 'backgrounds/explore/thumb/building.jpg',
    types: { ghost: 5, dark: 4, normal: 2, poison: 1, bug: 1 }, beast: 491, beastChance: 2 },         // Darkrai
  { id: 'lab', name: 'Abandoned Lab', src: 'backgrounds/explore/lab.jpg', thumb: 'backgrounds/explore/thumb/lab.jpg',
    types: { psychic: 5, steel: 4, electric: 3, poison: 2 }, beast: 150, beastChance: 4 },            // Mewtwo — a bit more likely
  { id: 'thunder', name: 'Thunder Plains', src: 'backgrounds/explore/thunder.jpg', thumb: 'backgrounds/explore/thumb/thunder.jpg',
    types: { electric: 6, flying: 2, rock: 2 }, beast: 243, beastChance: 2 },                         // Raikou
  { id: 'sea', name: 'Undersea Cave', src: 'backgrounds/explore/sea.jpg', thumb: 'backgrounds/explore/thumb/sea.jpg',
    types: { water: 1 }, beast: 245, beastChance: 2 },                                                // Suicune
  { id: 'volcano', name: 'Volcano Cave', src: 'backgrounds/explore/volcano.jpg', thumb: 'backgrounds/explore/thumb/volcano.jpg',
    types: { fire: 6, rock: 2, ground: 2 }, beast: 244, beastChance: 2 },                             // Entei
];
