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
  // ancient stone halls turned into a lab: glowing tubes and machines (Electric, Steel, Psychic), eerie purple light (Ghost)
  { id: 'ancientlab', name: 'Ancient Lab', src: 'backgrounds/explore/ancientlab.jpg', thumb: 'backgrounds/explore/thumb/ancientlab.jpg',
    types: { psychic: 5, electric: 4, steel: 3, ghost: 3 }, beast: 150, beastChance: 2 },                    // Mewtwo
  // waterfalls, mushrooms, pitcher plants and a misty poison swamp
  { id: 'wildwood', name: 'Wildwood Forest', src: 'backgrounds/explore/wildwood.jpg', thumb: 'backgrounds/explore/thumb/wildwood.jpg',
    types: { grass: 6, bug: 5, poison: 3 }, beast: 251, beastChance: 2 },                                    // Celebi
  // a frozen sea, ice floes and an ice cave
  { id: 'frostcoast', name: 'Frostwave Coast', src: 'backgrounds/explore/frostcoast.jpg', thumb: 'backgrounds/explore/thumb/frostcoast.jpg',
    types: { water: 6, ice: 4 }, beast: 144, beastChance: 2 },                                               // Articuno
  // sunny canyon ruins leading into a lava cave
  { id: 'canyon', name: 'Scorched Canyon', src: 'backgrounds/explore/canyon.jpg', thumb: 'backgrounds/explore/thumb/canyon.jpg',
    types: { fire: 5, rock: 4, ground: 4, fighting: 3 }, beast: 244, beastChance: 2 },                       // Entei
  // blossom meadows above the clouds, mountains, and a dark storm cave
  { id: 'skypeak', name: 'Skyward Peak', src: 'backgrounds/explore/skypeak.jpg', thumb: 'backgrounds/explore/thumb/skypeak.jpg',
    types: { normal: 5, fairy: 3, dragon: 3, dark: 3, flying: 2 }, beast: 384, beastChance: 2 },             // Rayquaza
];
