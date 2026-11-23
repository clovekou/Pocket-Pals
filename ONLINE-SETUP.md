# Turning on online play (accounts, friends, battles, trades)

Online play uses **Firebase**, Google's free backend. It handles the "Sign in with Google" button,
stores each player's save, and keeps usernames, friends and trades in sync. The free plan is plenty
for playing with friends. It takes about 10 minutes, and you only do it once.

## 1. Create the Firebase project
1. Go to <https://console.firebase.google.com> and sign in with your Google account.
2. Click **Create a project** and name it (for example `pocket-pals`). Google Analytics is optional;
   you can turn it off.

## 2. Turn on Google sign-in
1. In the left menu, open **Build → Authentication** and click **Get started**.
2. Under **Sign-in method**, choose **Google**, switch it **on**, pick a support email, and **Save**.
3. Still in Authentication, open **Settings → Authorized domains** and click **Add domain**:
   `clovekou.github.io`. (`localhost` is already there for testing on your Mac.)

## 3. Create the database
1. Open **Build → Firestore Database** and click **Create database**.
2. Pick a location close to you, and start in **production mode**.
3. Open the **Rules** tab, delete what's there, paste the entire contents of
   [`firestore.rules`](firestore.rules) from this folder, and click **Publish**.
   These rules make usernames and player IDs unique, keep each save private to its owner, and only
   let the two players in a friendship or trade see it.

## 4. Connect the game
1. Click the ⚙️ next to **Project overview → Project settings**.
2. Under **Your apps**, click the **</>** (Web) icon, give it a nickname, and click **Register app**
   (you don't need Firebase Hosting).
3. Firebase shows a `firebaseConfig = { ... }` block. Copy those values into
   [`online-config.js`](online-config.js), replacing `const FIREBASE_CONFIG = null;`:
   ```js
   const FIREBASE_CONFIG = {
     apiKey: "…",
     authDomain: "…firebaseapp.com",
     projectId: "…",
     storageBucket: "…",
     messagingSenderId: "…",
     appId: "…",
   };
   ```
   These values are meant to be public: access is protected by the rules from step 3, not by hiding
   the config.
4. Push to GitHub (or ask Claude to). The online game updates in a couple of minutes.

## How it works for players
- Tap the **Friends** button (the two trainers icon at the top) → **Sign in with Google**.
- First time: choose a **username**. No two players can have the same one, and you also get a
  random, unique **player ID** like `PP-7KX2M9QF`.
- Your progress is saved to your account and loads on any device you sign in on. If a device already
  has a different save, you choose which one to keep.
- **Add**: search for a friend's exact username and send a request. They see it under **Requests**
  and can accept or decline.
- **Battle**: pick a friend to battle their current main Pokémon. They get a notice of the result.
- **Trade**:
  1. Offer a Pokémon from your party or PC Box. Your main can't be traded, so you always keep at
     least one. The offered Pokémon is **locked** until the trade ends.
  2. Your friend picks one of theirs to give back, which locks it too.
  3. You **Confirm**, and both Pokémon swap.
  4. Declining or cancelling unlocks both.
- Every Pokémon remembers its **Original Trainer**, shown in Summary → Info, along with who you
  received it from.

## Admin: game settings and gift codes
Open `admin.html` and sign in with an admin account (see the steps on that page). After you
update `firestore.rules`, paste the whole file into **Firestore → Rules** again and **Publish**.
- **Game settings**: turn Explore, Training and gift codes on or off, post an announcement
  (every player sees it once), and tune explore floors, energy needed, treasure, egg, legendary
  and shiny chances, and how many fragments a summon costs. Saved to `config/game`, and open
  games update within seconds.
- **Gift codes**: create a code that gives event Pokémon (species, level, shiny) and/or items,
  with an optional redemption limit and expiry date. Players enter it in
  **Options → Redeem a code** while signed in, and each account can use a code once.
