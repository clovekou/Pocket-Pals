# Pocket Pals Dock

Your Pocket Pals Pokémon walking around your Mac's desktop, synced with your Pocket Pals account.
For a Windows laptop, see `Pocket Pals Windows/`.

- Your main Pokémon walks along the top of the Dock, stops to idle, and looks around. When an app
  is full screen (and the Dock is hidden), it walks along the bottom of the screen instead, and rides
  up with the Dock when you bring it up.
- When your Pokémon is asleep in the game, it sleeps on your desktop too, with floating z's. An egg
  sits there and wobbles. You can choose this yourself in the menu bar under **Asleep or awake**:
  **Same as in the game**, **Asleep (stays still)** or **Awake (walks around)**.
- **Hide Pokémon** (⌘H while the menu is open) takes it off your screen until you turn it off again.
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

## Desktop widgets
Two widgets that sit on your desktop and line up with the macOS ones:
- **Stats** (medium size): rings for **Food, Happy, Energy and Clean**, like the Batteries widget. A ring turns
  red under 20%, and a moon sits on the Energy ring while your Pokémon is asleep.
- **Portrait** (small size): your main Pokémon's face, matching how it feels right now (the same expression as
  the phone widget), with its name, level and mood.

Drag either one anywhere; when you let go it snaps onto the macOS widget grid. Click one to open the game.
Turn each on or off in the menu bar (**Show stats widget**, **Show portrait widget**).
