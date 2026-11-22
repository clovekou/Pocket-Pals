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
Start the server from this folder:
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
