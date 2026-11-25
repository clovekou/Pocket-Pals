# Pocket-Pals

A virtual-pet game for phones, using the PMD sprites in `Pokemon-Sprites/` (983 Pokémon
with animations right now). It runs in any browser, and there's nothing to install.

> The sprites come from PMD SpriteCollab (CC BY-NC); Pokémon © Nintendo / Game Freak.
> Personal use only. Don't publish or sell this.

## Play online
**https://clovekou.github.io/Pocket-Pals/** works on phones and computers. On GitHub Pages the
sprites and portraits load straight from the public
[PMD SpriteCollab](https://github.com/PMDCollab/SpriteCollab) repository, so you don't need to
download anything. (The sprite dashboard only works locally, through `server.py`.)

## Getting the sprites
The sprites aren't in this repository. To play locally, create a `Pokemon-Sprites/` folder
here with one folder per Pokémon named `NNNN_Name` (for example `0025_Pikachu`), each in the
[PMD SpriteCollab](https://sprites.pmdcollab.org/) layout:
```
Pokemon-Sprites/0025_Pikachu/sprite/AnimData.xml, Idle-Anim.png, Walk-Anim.png, ...
Pokemon-Sprites/0025_Pikachu/sprite/0000/Shiny/...      (optional shiny sprites)
Pokemon-Sprites/0025_Pikachu/portrait/Normal.png, Happy.png, ...   (optional, used when it talks)
```
Then run `python3 tools/build_sprites.py`, or add them through the dashboard.

## Play it
On a Mac, double-click **Start Pocket Pal.command** (it starts the server and opens the dashboard).
Or start the server from this folder yourself:
```bash
python3 server.py
```
- Game: http://localhost:8000. On your phone (same Wi-Fi), use the address the server prints.
- Sprite dashboard: http://localhost:8000/dashboard.html (also in the game's Settings).

You can also double-click `index.html` to play, but the dashboard only works through the server.

## Sprite dashboard
- Upload a PMD SpriteCollab sprite folder, or a .zip of one: `sprite/` with `AnimData.xml`
  and `*-Anim.png`, plus the optional `sprite/0000/Shiny/` and `portrait/` (with `portrait/0000/Shiny/`).
- For each Pokémon, set its type, what it **evolves into** and at what level (more than one
  target makes a branch), egg rarity, whether it's a starter, and ATK/DEF/SPD.
- Press **Save changes**, then refresh the game.

## Online play
Sign in with Google, pick a unique username (plus a random unique player ID), and your save follows
you to any device. Add friends by username, battle their main, or trade Pokémon (offered Pokémon are
locked until both players confirm; your main can never be traded). Pokémon remember their Original
Trainer. Needs a free Firebase project: see **[ONLINE-SETUP.md](ONLINE-SETUP.md)**.

### Party photos and visiting friends
- **Party → Party photo** hides every bar and button so only your Pokémon are on screen. **Share picture** opens the
  share sheet (or downloads the PNG on a computer); **✕** goes back. Only the scene goes into the picture.
  Pose buttons: **Play** (as usual), **Look here** (everyone lines up facing the camera), **Jump!** and **Sleep**.
- **Friends → Visit** takes you to a friend's place, with the background they picked: all 6 of their Pokémon, with your main and theirs chatting and
  jumping for joy. Each friend gives one try a day at finding Pokécoins (500 at 50% by default: Admin → Game settings → Friends).
  Every visit is listed in **Admin → Visits** with the coins it found.

## Training games
**Explore → Training** on the bottom bar: Poké Ball Catch (Speed), Rock Smash (Attack) and Protect (Defence).

## Party
Keep up to 6 Pokémon. Your main (marked with a ▼) is the one you care for; the others
wander, nap, play and chat with each other in the background, and their needs pause while
they rest. Open **Party** to switch your main (or tap one on the home screen), release one,
or send one to the PC Box. New eggs come from Mystery Eggs (very rare in dungeons, or bought in the shop).

## Explore
Send your main into a pixel-art crystal cave (Crystal Cavern, Emerald Grotto, Ember Hollow),
floor by floor up to B10F. Each floor may hold a treasure chest (Oran Berry, Rare Candy, Pearl,
Star Piece, Nugget), a Mystery Egg (hatches into a random first-stage Pokémon — never
legendary, mythical, Ultra Beast or Paradox), or a wild Pokémon 3–5 levels below yours.
Between floors you can eat berries or use items (Oran Berry heals, Rare Candy levels up).

Rarely, a **legendary or special Pokémon** appears. Beat it, then spin the catch wheel
(Poké / Great / Ultra / Master Ball) for one throw. If it breaks free it flees and leaves a
fragment — collect 20 to summon it (100% catch) from **Bag → Items**. Caught Pokémon join your
party, or the **PC Box** (in the Party menu) when the party is full.

## Items, evolution items and the Poké Mart
- **Bag → Items** holds everything you find; **Bag → Shop** is the Poké Mart (buy with Pokécoins, sell treasure).
- **Treasure** (Tiny/Big/Balm Mushroom, Pearl, Big Pearl, Pearl String, Stardust, Star Piece, Comet Shard,
  Nugget, Big Nugget, Rare Bone, Pretty Feather and seven Relics) turns up in dungeon chests. Sell it for Pokécoins.
- **Evolution items** work like the main games. Stones and other "use" items (Fire, Water, Thunder, Leaf,
  Moon, Sun, Shiny, Dusk, Dawn and Ice Stone, Linking Cord, the apples, pots, armours…) evolve your main
  straight away. "Hold" items (King's Rock, Metal Coat, Dragon Scale, Up-Grade, Razor Claw, Oval Stone…)
  are given to your main, and it evolves at its next level-up. A few depend on the time of day.
  Pokémon that evolve by an item no longer evolve by level. They're rare dungeon finds (more often one
  your main can use) and can be bought in the shop.
- All items are defined in `items.js` (names, prices, how rare they are).

## Evolutions and regional forms
- Every Pokémon evolves like in the main games (the same data as pokemondb.net/evolution, from PokéAPI):
  real levels, evolution items, friendship (a bond of 70+), time of day, and trades (Linking Cord).
  Methods this game doesn't have (knowing a move, walking 1,000 steps…) become a level-up at a fitting level.
  `evodata.js` holds it; `python3 tools/build_evolutions.py` rebuilds it and the lines in `species.json`.
- **Regional forms** (Alolan, Galarian, Hisuian, Paldean) are Pokémon of their own, with their own
  evolutions (Alolan Vulpix + Ice Stone → Alolan Ninetales, Galarian Meowth → Perrserker…). They're added
  from the sprites in `Pokemon-Sprites/NNNN_Name/sprite/<Region>/` by `python3 tools/build_forms.py`
  (then run `build_evolutions.py` and `build_sprites.py`).
- **Admin → Evolutions** can change any of this for every player; those edits win over `evodata.js`.
  (Evolution levels in the sprite dashboard no longer change the game; use the Admin page.)
  Item icons in `assets/items/` and `assets/ui/` are copied from the `Pokemon_Item_Icons/` library.

## Shop backgrounds
In **Admin → Backgrounds** you can upload a picture, name it and set a price. Players buy it once in
**Options → Backgrounds** and can switch between the backgrounds they own any time (the classic scenery is
always free). Pictures are shrunk and stored in Firestore (`shopBackgrounds` + `shopBackgroundImages`).

## Backgrounds
In the dashboard's **Backgrounds** section you can upload your own scene pictures
(PNG/JPG/GIF/WebP) and pick one for every scene or a different one per landscape
(meadow, beach, forest, volcano, mountain, snow — chosen by the Pokémon's type). Uploaded
images are stored in `backgrounds/`, so they go online too when you push. Scenes without a
picture use the built-in animated scenery.

## Look
Pokémon-game style UI: cream menu boxes, HP-style need bars, a Pokédex-red menu header and a
pixel font. 32×32 pixel-art icons drawn in code in `pixelart.js` (Pecha/Aspear/Cheri berries,
Poffins, Poké Balls, Gym-style badges, eggs…) — no emoji.

## Talking
The Pokémon talks in a Mystery Dungeon-style text box, using the emotion portrait
(`portrait/Happy.png`, `Sad.png`, `Joyous.png`, …) that fits the moment. It reacts to
feeding, petting, baths, sleep, minigames, level-ups, medals, evolution and goodbyes, and
chats on its own when it's hungry, dirty, bored, sleepy, or just happy. Set the name it
calls you in Settings. The lines are in `talk.js`, so you can edit them.

## Features
- 4 needs (FOOD / JOY / ENE / HYG) that drop in real time (1 min = 1 game min)
- Poops, slip-ups (each delays evolution by 1 level), and catch-up for up to
  2 weeks while the game is closed
- 3 berry flavours (one hidden favourite per creature), candy that adds weight
- Star Catch minigame (SPEED), training bag (ATTACK), DEFENCE from 12 h of good care
- Bath, petting, sleep (energy +6/min, needs drop slower and stop at a minimum)
- 27 starters (every generation); eggs are Common / Rare / Legendary, lean toward lines you
  haven't finished, and can be shiny (1/48, down to 1/8) using the shiny sprites
- Genes (90–110%) and ATK/DEF/SPD battle stats
- Evolution you choose to watch (or decline), including branches like Eevee's 8 forms
- 3 endings: farewell (blesses the next egg), run-away (curses it), release (hold 3 s)
- Daily streak, bond, 8 medals, nickname, Dex + shinies, history of past companions
- Sky that follows the real time of day, a biome for each element, retro sound effects
- Settings: sound, a fast-time testing mode (1 s = 1 min), reset

Progress is saved in the browser (localStorage).

## Sprites
`sprites.js` (and `species.js`, from `species.json`) are generated from `Pokemon-Sprites/` (folders named `NNNN_Name`, in the
PMD SpriteCollab layout). If you change the sprites, rebuild it:
```bash
python3 tools/build_sprites.py
```
The dashboard does this for you after every upload or save.

## Pokémon data
`species.json` was filled in from PokeAPI's data tables (saved in `tools/pokeapi/`):
type, evolutions, base ATK/DEF/SPD, and legendary/mythical status. Evolutions that
don't happen by level were converted: stone ≈ Lv 30, trade ≈ Lv 40, friendship ≈ Lv 22.
After adding more sprite folders, run:
```bash
python3 tools/build_sprites.py   # re-index the sprites (a few seconds)
python3 tools/import_dex.py      # add data for new Pokémon (keeps the ones you edited)
```
Folders without `sprite/AnimData.xml` (SpriteCollab doesn't have animations for some newer
Pokémon yet) are skipped.

## Announcements
On the Admin page, open **Announcement**, type a message and press **Broadcast to everyone**. It pops up
straight away for everyone playing, and for everyone else the next time they open the game (each player sees
each broadcast once). **Stop showing** clears it. Broadcasts are stored in Firestore at `config/news`.

## Developer mail
The envelope in the corner of the home screen opens **Developer mail**, with two kinds of letters (newest first):
- **Patch notes** from `patchnotes.js`. Add an entry at the top when you push an update worth telling players
  about, using the version the commit will get (the number in `version.js` plus 1).
- **Messages from the game developer**, posted on the Admin page under **Developer mail** (stored at
  `config/devmail`). They arrive live, and you can delete them there.

A red dot shows until the player has read everything.

## Versions and updates
The game's version number is in `version.js` and shows at the bottom of **Options**. A git hook bumps it (and
the cache name in `sw.js`) on every commit that changes game files, so after you push, anyone playing gets a
**"A new version of Pocket Pals is ready — Refresh"** bar within about a minute. Turn the hook on once per clone:
```bash
git config core.hooksPath tools/hooks
```
