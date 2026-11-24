# Pocket Pals Dock

Your Pocket Pals Pokémon walking around your Mac's desktop, synced with your Pocket Pals account.
For a Windows laptop, see `Pocket Pals Windows/`.

- Your main Pokémon walks along the top of the Dock, stops to idle, and looks around. When an app
  is full screen (and the Dock is hidden), it walks along the bottom of the screen instead, and rides
  up with the Dock when you bring it up.
- When your Pokémon is asleep in the game, it sleeps on your desktop too, with floating z's. An egg
  sits there and wobbles. If you'd rather it keep walking around, set **When asleep in the game →
  Keep doing its own thing** in the menu bar.
- They stay visible above every window, on every desktop Space, and over full-screen apps.
- Every so often a little portrait of your Pokémon pops up over its head, with a face that matches how
  it's doing (happy, sad, sleepy…). **Click** it to make it hop and smile. **Drag** it to pick it up; let go and
  it drops back down.
- The Poké Ball icon in the menu bar shows your Pokémon's level, mood and needs, and has the
  settings: size, portrait reactions on or off, walk on the Dock or the bottom of the screen, position (walk around, or stay in the right or left
  corner), click-through, open at
  login, sync now, and change account key.

## First time
1. Double-click **Pocket Pals Dock.app**. It runs in the menu bar (there's no Dock icon).
2. In the game, sign in, then open **Options → Home-screen widget** and tap **Copy key for desktop app**.
3. Paste the key into the box the app shows and click **Connect**. (If you copied it first, it's
   filled in for you.)

It checks your account every 10 seconds. The game sends your Pokémon's stats every 10 seconds while
it's open (only when they've changed), and whenever you leave it.

Tip: move the app into your **Applications** folder if you want **Open at login**.

## Rebuilding
After changing `Sources/main.swift`, run `./build.sh` in this folder (it needs the Xcode command
line tools). `./build.sh` makes a fresh `Pocket Pals Dock.app`.
To preview without an account: `"Pocket Pals Dock.app/Contents/MacOS/PocketPalsDock" --demo`.

Sprites are from the PMD SpriteCollab project and are cached in `~/Library/Caches/PocketPalsDock`.

## Desktop widget
A small glass card on your desktop, in the style of the macOS Batteries widget: your main Pokémon's portrait
(the ring is its overall wellbeing, the label its level), then rings for **Food, Happy, Energy and Clean**.
A ring turns red under 20%, and a moon sits on the first ring while your Pokémon is asleep.
Drag it anywhere (it remembers where). Turn it on or off with **Show desktop widget** in the menu bar.
