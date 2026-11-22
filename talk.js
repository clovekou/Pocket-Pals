'use strict';
// Pocket Pal — Mystery-Dungeon-style dialogue: a portrait box + a typewriter text box.
// Lines: [emotion, text]. Emotions match the portrait files (Happy, Sad, Joyous, …).
// Placeholders: {name} {species} {player} {lv} {berry} {medal} {to} {n}

const LINES = {
  greetMorning: [[['Happy', 'Good morning, {player}! Did you sleep well?']], [['Joyous', 'Morning! The sun is out — let\'s have a great day!']]],
  greetDay: [[['Happy', 'Oh, {player}! You\'re here! Hehe, I was hoping you\'d come.']], [['Joyous', 'Hi hi! What are we doing today?']]],
  greetEvening: [[['Normal', 'Good evening, {player}. The sky\'s turning orange...'], ['Happy', 'It\'s nice spending the evening with you.']]],
  greetNight: [[['Sigh', '*yawn*... Oh, {player}? It\'s pretty late, you know.'], ['Happy', '...But I\'m happy you came to see me.']]],
  backHappy: [[['Joyous', 'You\'re back! I missed you, {player}!']], [['Surprised', 'Oh! {player}! You came back!'], ['Happy', 'I knew you would. Hehe.']]],
  backNeedy: [[['Teary-Eyed', '{player}...! Where were you...?'], ['Worried', 'I waited and waited... and I got really hungry...']], [['Sad', 'You were gone so long... I thought you forgot about me...']]],

  hatch: [[['Surprised', '...!? W-where am I...?'], ['Normal', 'Are you... the one who was keeping me warm?'], ['Joyous', 'I\'m {species}! Let\'s be best friends, {player}!']]],
  hatchShiny: [[['Surprised', 'Huh? Why are you staring at me like that?'], ['Inspired', 'Is my color... special? Hehe, I\'m {species}! Nice to meet you!']]],

  pet: [[['Happy', 'Hehe, that tickles!']], [['Joyous', 'Ahh~ I love it when you do that!']], [['Happy', 'More, more!']], [['Joyous', '♪ ♪ ♪']], [['Happy', 'You\'re the best, {player}!']]],
  petSad: [[['Sad', 'Thanks... but I really need something more right now...']], [['Worried', '...I don\'t feel so good, {player}.']]],
  petAsleep: [[['', '{name} is sleeping soundly... Better not wake it.']], [['', '{name} mumbles something in its sleep...']]],

  favFirst: [[['Surprised', 'Wh-whoa!! What IS this?!'], ['Inspired', 'This {berry} is AMAZING! It\'s my favorite! You remembered... wait, how did you know?!']]],
  fav: [[['Joyous', 'Mmm! My favorite!']], [['Inspired', 'A {berry}! You know me so well!']]],
  berry: [[['Happy', 'Thanks! *munch munch*']], [['Normal', 'Mm, it\'s pretty good!']], [['Happy', 'Yum! That hit the spot.']]],
  berryFull: [[['Dizzy', 'Ugh... I\'m so full... I can\'t eat another bite...']]],
  candy: [[['Joyous', 'Sweeet!! ...Can I have just one more?']], [['Happy', 'Candy! Best. Day. Ever!']]],
  candyHeavy: [[['Worried', 'Hmm... I\'m feeling kinda heavy lately...'], ['Sigh', 'Maybe we should play outside more...']]],

  playGood: [[['Joyous', 'That was so fun! Did you see how fast I was?!']], [['Determined', 'I\'m getting quicker every day! Let\'s go again sometime!']]],
  playBad: [[['Sigh', 'Aww... those stars were too fast.'], ['Determined', 'I\'ll do better next time!']]],
  trainGood: [[['Determined', 'Hyaah! I can feel myself getting stronger!']], [['Shouting', 'Take THAT! ...Hehe, I\'m pumped!']]],
  trainBad: [[['Sigh', 'Phew... that bag is tough.']]],
  bath: [[['Happy', 'Ahh... squeaky clean! That feels nice.']], [['Joyous', 'Splish splash! Hehe, I smell like flowers now!']]],
  bathStinky: [[['Sigh', 'Finally... it was getting SO stinky in here.'], ['Happy', 'Thanks, {player}. Much better.']]],
  sleep: [[['Sigh', '*yawn*... Good night, {player}...']], [['Normal', 'I\'m a bit sleepy... Wake me up later, okay? Zzz...']]],
  wake: [[['Happy', 'Mmm... good morning! I had a really nice dream.']], [['Joyous', 'I\'m wide awake! Full of energy!']]],
  wakeTired: [[['Dizzy', 'Huh...? Is it time already? I\'m still so sleepy...']]],
  tooTired: [[['Dizzy', 'I\'m too tired for that right now... Can I rest first?']]],

  level: [[['Inspired', 'I feel stronger! I\'m level {lv} now!']], [['Determined', 'Level {lv}! I\'m growing up fast, huh?']]],
  medal: [[['Joyous', 'We got a medal! "{medal}"! We make a great team!']]],
  milestone: [[['Inspired', '{n} days in a row together! You never forget about me... That makes me really happy.']]],
  slip: [[['Pain', 'I... I don\'t feel so good...']], [['Crying', 'It hurts... {player}, please...']]],

  hungry: [[['Worried', 'My tummy\'s rumbling... Can I have something to eat?']], [['Sad', '{player}... I\'m so hungry...']]],
  dirty: [[['Angry', 'Ugh! It\'s getting really stinky around here!']], [['Sad', 'I feel all icky... Can I have a bath?']]],
  bored: [[['Sad', 'I\'m bored... Will you play with me?']], [['Sigh', 'Hey, {player}... Can we do something fun?']]],
  sleepy: [[['Dizzy', 'I\'m so tired... I can barely keep my eyes open...']]],
  chatDay: [[['Happy', 'The sun feels so warm today!']], [['Normal', 'Look at the clouds, {player}! That one looks like a berry.']], [['Joyous', 'Hehe, I feel great today!']]],
  chatNight: [[['Normal', 'The stars are out... It\'s so peaceful.']], [['Sigh', 'Do you ever wonder what\'s up there, past the stars?']]],
  chatEvolve: [[['Inspired', 'I wonder what I\'ll look like when I evolve someday...']], [['Determined', 'I\'m gonna get big and strong! Just you watch!']]],
  chatBond: [[['Happy', 'Hey, {player}... I\'m really glad I met you.']], [['Teary-Eyed', 'Thanks for always taking care of me. I mean it.']]],
  chatStreak: [[['Joyous', 'You\'ve visited me {n} days in a row! Hehe.']]],
  chatFat: [[['Worried', 'Is it just me, or is it harder to walk lately...?']]],

  evolveReady: [[['Surprised', 'W-what\'s this...? My body feels warm...'], ['Determined', 'A power is welling up inside me! {player}, I think... I\'m ready!']]],
  evolveDone: [[['Inspired', 'I... I evolved! I\'m {to} now!'], ['Joyous', 'Thank you for raising me, {player}! I\'ll keep getting stronger!']]],
  evolveNo: [[['Normal', 'Oh... okay. I\'ll stay like this a little longer.'], ['Happy', 'I like being me anyway!']]],
  farewellReady: [[['Teary-Eyed', '{player}... We\'ve been through so much together.'], ['Sigh', 'I think... it might be time for me to go on my own journey.']]],
  farewell: [[['Crying', 'Thank you... for everything.'], ['Teary-Eyed', 'I\'ll never, ever forget you, {player}. Goodbye...']]],
  stay: [[['Joyous', 'Really?! Then let\'s stay together a little longer!']]],
  runawayReady: [[['Crying', '...You don\'t care about me anymore... do you...?']]],
  runaway: [[['Sad', '...Goodbye.']]],
  release: [[['Teary-Eyed', '...You\'re letting me go?'], ['Sad', '...I understand. Take care of yourself, {player}.']]],
  newEgg: [[['', 'A new Egg appeared...'], ['', 'It feels warm. Something is moving inside!']]],
  eggTap: [[['', 'The Egg wobbled!']], [['', 'Something is tapping back from inside!']]],
};

const Talk = (() => {
  let box, face, faceImg, nameEl, textEl, nextEl;
  let queue = [], cur = null, shown = 0, typing = false, lastType = 0, closeAt = 0, prio = 0;
  let sound = () => {}, getPlayer = () => 'partner';
  const CPS = 38; // characters per second

  function init(opts) {
    box = document.getElementById('talk');
    face = box.querySelector('.tk-face'); faceImg = face.querySelector('img');
    nameEl = box.querySelector('.tk-name'); textEl = box.querySelector('.tk-text'); nextEl = box.querySelector('.tk-next');
    sound = opts.sound || sound; getPlayer = opts.player || getPlayer;
    box.addEventListener('pointerdown', e => { e.stopPropagation(); advance(); });
    requestAnimationFrame(loop);
  }

  function petInfo() {
    const p = Game.pet();
    if (!p) return null;
    const sp = SPECIES_BY_ID[p.sp];
    return { p, sp, name: p.egg ? 'Egg' : (p.name || sp.name) };
  }
  function fill(text, vars) {
    const info = petInfo();
    const base = { player: getPlayer(), name: info ? info.name : '', species: info ? info.sp.name : '', lv: Game.level() };
    return text.replace(/\{(\w+)\}/g, (_, k) => (vars && vars[k] != null ? vars[k] : base[k] != null ? base[k] : ''));
  }
  function portraitSrc(emo) {
    const info = petInfo(); if (!info || info.p.egg || !emo) return null;
    return portraitUrl(info.p.sp, info.p.shiny, emo);
  }

  /** say(key | lines, {vars, prio}) — prio 0 idle chatter, 1 reaction, 2 important */
  function say(what, opts = {}) {
    const p = opts.prio == null ? 1 : opts.prio;
    let lines = what;
    if (typeof what === 'string') {
      const variants = LINES[what]; if (!variants) return;
      lines = variants[Math.floor(Math.random() * variants.length)];
    }
    if (cur && p < prio) return;            // never interrupt something more important
    const items = lines.map(([emo, text]) => ({ emo, text: fill(text, opts.vars) }));
    if (cur && p === 2 && prio === 2) { queue.push(...items); return; } // important lines wait their turn
    queue = items; prio = p; next();        // otherwise the new reaction replaces what was showing
  }

  function next() {
    cur = queue.shift() || null;
    if (!cur) { box.classList.add('hidden'); prio = 0; return; }
    const info = petInfo();
    const src = portraitSrc(cur.emo);
    face.classList.toggle('hidden', !src);
    if (src) faceImg.src = src;
    nameEl.textContent = cur.emo && info && !info.p.egg ? info.name : '';
    nameEl.classList.toggle('hidden', !nameEl.textContent);
    box.classList.toggle('narrator', !cur.emo);
    textEl.textContent = ''; shown = 0; typing = true; lastType = performance.now(); closeAt = 0;
    nextEl.classList.add('hidden');
    box.classList.remove('hidden');
  }
  function advance() {
    if (!cur) return;
    if (typing) { shown = cur.text.length; textEl.textContent = cur.text; typing = false; afterTyped(); return; }
    next();
  }
  function afterTyped() {
    nextEl.classList.toggle('hidden', !queue.length);
    closeAt = performance.now() + (queue.length ? 6000 : 2600 + cur.text.length * 35);
  }
  function loop() {
    requestAnimationFrame(loop);              // schedule first so an error can't freeze the dialogue
    try { step(); } catch (e) { if (window.__pocketPalError) window.__pocketPalError(e); }
  }
  function step() {
    const now = performance.now(); // same clock as lastType/closeAt
    if (cur && typing) {
      const want = Math.min(cur.text.length, shown + Math.floor((now - lastType) / 1000 * CPS));
      if (want > shown) {
        if (Math.floor(want / 3) > Math.floor(shown / 3) && /\S/.test(cur.text[want - 1] || '')) { try { sound(cur.emo ? 'blip' : 'blipLow'); } catch (e) {} }
        shown = want; lastType = now; textEl.textContent = cur.text.slice(0, shown);
        if (shown >= cur.text.length) { typing = false; afterTyped(); }
      }
    } else if (cur && closeAt && now > closeAt) {
      next();
    }
  }
  function clear() { queue = []; cur = null; box && box.classList.add('hidden'); prio = 0; }

  return { init, say, clear, get busy() { return !!cur; } };
})();
