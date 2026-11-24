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
  candy: [[['Joyous', 'A Poffin! Sweeet!! ...Can I have just one more?']], [['Happy', 'Poffins! Best. Day. Ever!']]],
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
  exploreGo: [[['Determined', 'Let\'s go exploring! I wonder what we\'ll find...']], [['Joyous', 'Adventure time! Stay close, {player}!']]],
  exploreBack: [[['Joyous', 'We\'re back! What an adventure!']], [['Happy', 'Phew! Exploring is fun... but home is nice too.']]],
  exploreLose: [[['Pain', 'Ow... that wild Pokémon was tough...'], ['Determined', 'I\'ll get stronger. Next time!']]],
  newEgg: [[['', 'A new Egg appeared...'], ['', 'It feels warm. Something is moving inside!']]],
  eggTap: [[['', 'The Egg wobbled!']], [['', 'Something is tapping back from inside!']]],
};

// ---------------------------------------------------------------------------------------------------------
// More lines, so every Pokémon sounds like itself.
// Keys can be specialised: 'pet#shy' is only said by shy Pokémon, 'chatType@fire' only by Fire types.
// When a Pokémon has its own lines for a moment, they're mixed in with (and favoured over) the general ones.
// Personalities (natures) are fixed per Pokémon: cheerful, shy, brave, lazy, cheeky, gentle.
// ---------------------------------------------------------------------------------------------------------
const MORE_LINES = {
  // ---- more of the everyday lines ----
  greetMorning: [[['Normal', 'Mmm... is it morning already?'], ['Happy', 'Morning, {player}! Breakfast first, then adventures?']], [['Joyous', 'Rise and shine, {player}! I\'ve been up for ages!']]],
  greetDay: [[['Happy', 'There you are! I saved you a spot in the sun.']], [['Surprised', 'Oh! I didn\'t hear you coming, {player}!'], ['Happy', 'Hehe. Hi!']]],
  greetEvening: [[['Happy', 'Welcome back, {player}. Long day?'], ['Normal', 'Sit with me for a bit. It\'s nice and quiet.']]],
  greetNight: [[['Normal', 'Can\'t sleep either, {player}?'], ['Happy', 'Let\'s just hang out quietly, then.']]],
  pet: [[['Happy', 'Right there! That\'s the spot!']], [['Joyous', 'Hehehe, stop it! ...No, don\'t stop!']], [['Happy', 'Your hands are so warm, {player}.']], [['Inspired', 'I could stay like this all day.']]],
  berry: [[['Happy', 'Crunchy! Thanks, {player}!']], [['Joyous', '*nom nom nom* ...What? I\'m a growing {species}!']], [['Normal', 'Not bad... not bad at all.']]],
  bath: [[['Joyous', 'Bubbles! Look, {player}, BUBBLES!']], [['Happy', 'All fresh and shiny now!']]],
  sleep: [[['Sigh', 'Just five minutes... maybe fifty...']], [['Normal', 'Night night, {player}. Don\'t go anywhere, okay?']]],
  wake: [[['Joyous', 'I\'m up! What did I miss?']], [['Happy', 'I dreamed we found a giant berry tree, {player}!']]],
  level: [[['Joyous', 'Level {lv}! Did you see that? Did you SEE that?!']], [['Inspired', 'Level {lv}... I think I can feel something new inside me.']]],
  hungry: [[['Worried', 'Is it snack time yet? It feels like snack time.']], [['Sigh', 'I can smell berries somewhere... or I\'m imagining it.']]],
  bored: [[['Sigh', 'I counted every blade of grass here. Twice.']], [['Sad', 'Play with me? Pleeease?']]],
  dirty: [[['Worried', 'Something smells funny... oh no, is it me?']]],
  exploreGo: [[['Determined', 'Treasure, here we come!']], [['Inspired', 'I have a good feeling about today\'s trip!']]],
  exploreBack: [[['Joyous', 'Did you see me out there?! I was amazing!']], [['Sigh', 'My paws are tired... but that was worth it.']]],
  playGood: [[['Joyous', 'Again! Again! Let\'s go again!']]],
  trainGood: [[['Determined', 'Feel that? That\'s the power of teamwork!']]],
  chatDay: [[['Normal', 'Do you think the clouds are racing each other?']], [['Happy', 'I found a shiny pebble earlier. I\'m keeping it for you.']], [['Inspired', 'Today feels like a lucky day, {player}!']], [['Normal', 'Shh... listen. You can hear the wind in the leaves.']]],
  chatNight: [[['Normal', 'That star looks like it\'s winking at us.']], [['Happy', 'Night time is the best time for secrets. Wanna hear one? ...I really like you, {player}.']], [['Sigh', 'The moon looks so big tonight...']]],
  chatBond: [[['Happy', 'When you\'re here, everything feels alright.']], [['Inspired', 'We\'re a real team now, aren\'t we, {player}?']]],

  // ---- personalities ----
  'pet#cheerful': [[['Joyous', 'Yay! Pets! Best thing ever!']], [['Joyous', 'Hehe! Do it again, do it again!']]],
  'pet#shy': [[['Surprised', 'Oh! Um...'], ['Happy', '...That\'s nice. Thank you, {player}.']], [['Happy', '...I don\'t mind if you keep going.']]],
  'pet#brave': [[['Determined', 'A warrior needs rest too. Carry on!']], [['Happy', 'Heh. Don\'t tell anyone I like this.']]],
  'pet#lazy': [[['Sigh', 'Mmm... perfect... don\'t stop... zzz...']], [['Happy', 'This is my favourite kind of training.']]],
  'pet#cheeky': [[['Joyous', 'Gotcha! Now it\'s my turn to tickle YOU!']], [['Happy', 'That\'ll cost you one berry. Hehe, kidding! ...Mostly.']]],
  'pet#gentle': [[['Happy', 'Thank you, {player}. You\'re always so kind to me.']], [['Inspired', 'This feels like a warm blanket.']]],
  'berry#lazy': [[['Happy', 'Food AND I didn\'t have to get up? Perfect.']]],
  'berry#cheeky': [[['Happy', 'Mine! ...Oh, you were giving it to me anyway. Hehe.']]],
  'berry#shy': [[['Happy', '...Thank you. It\'s really good.']]],
  'berry#brave': [[['Determined', 'Fuel for the next battle! Thanks!']]],
  'bath#lazy': [[['Sigh', 'Can I just float here forever?']]],
  'bath#cheeky': [[['Joyous', 'Splash attack! Hehe, now YOU\'RE wet too!']]],
  'sleep#lazy': [[['Joyous', 'Finally! My favourite activity!']]],
  'sleep#brave': [[['Determined', 'A short rest. Then I\'ll be stronger than ever.']]],
  'level#brave': [[['Shouting', 'Level {lv}! Nothing can stop us now!']]],
  'level#shy': [[['Happy', 'Level {lv}... I did it. We did it.']]],
  'level#gentle': [[['Inspired', 'Level {lv}. I hope I can protect you even better now, {player}.']]],
  'exploreGo#brave': [[['Shouting', 'Bring on the wild Pokémon! I\'m ready!']]],
  'exploreGo#shy': [[['Worried', 'You\'ll stay close to me in there... right?']]],
  'exploreGo#lazy': [[['Sigh', 'Do we have to walk ALL the way? ...Okay, okay.']]],
  'greetDay#cheeky': [[['Joyous', 'Boo! Hehe, did I scare you?']]],
  'greetDay#shy': [[['Happy', '...Oh. Hi, {player}. I\'m glad you\'re here.']]],
  'greetMorning#lazy': [[['Dizzy', 'Morning...? Already...? Five more minutes...']]],
  chatNature: [],
  'chatNature#cheerful': [[['Joyous', 'Everything is fun when we\'re together!']], [['Happy', 'Let\'s make today the best day ever!']], [['Joyous', 'I made up a song about you! ♪ {player}, {player}, the best trainer ever ♪']]],
  'chatNature#shy': [[['Normal', '...Um, {player}? Nothing. I just wanted to say your name.']], [['Worried', 'Other Pokémon are a bit scary... but I\'m okay with you here.']], [['Happy', 'I practised saying hi to a Pidgey today. It flew away... but I tried!']]],
  'chatNature#brave': [[['Determined', 'If anything scary shows up, I\'ll protect you!']], [['Shouting', 'One day I\'ll be the strongest {species} around!']], [['Determined', 'Let\'s train hard today. No breaks! ...Okay, one break.']]],
  'chatNature#lazy': [[['Sigh', 'What if we just... lay here... all day?']], [['Dizzy', 'I had a busy day. I napped twice.']], [['Normal', 'Clouds are nice. They don\'t have to do anything either.']]],
  'chatNature#cheeky': [[['Joyous', 'I hid one of your things. Bet you can\'t find it! ...Okay, I forgot where.']], [['Happy', 'If you give me a Poffin, I\'ll tell you a secret.']], [['Joyous', 'I made a face at a Psyduck earlier. It didn\'t notice. Hehe.']]],
  'chatNature#gentle': [[['Happy', 'Are you eating well too, {player}? Take care of yourself, okay?']], [['Inspired', 'I watered the little flowers over there. They look happy.']], [['Happy', 'If you ever feel sad, you can tell me. I\'ll listen.']]],

  // ---- types ----
  chatType: [],
  'chatType@fire': [[['Happy', 'I\'m toasty warm! Want to warm your hands, {player}?']], [['Worried', 'Is it going to rain? I really don\'t like rain...']]],
  'chatType@water': [[['Joyous', 'I could swim all day long!']], [['Happy', 'Puddles are just tiny oceans, you know.']]],
  'chatType@grass': [[['Happy', 'Sunshine feels like a big warm hug.']], [['Inspired', 'I think I grew a tiny bit taller today!']]],
  'chatType@electric': [[['Joyous', 'Bzzt! Sorry, did I zap you? I\'m just excited!']], [['Determined', 'I\'m all charged up! Let\'s do something!']]],
  'chatType@ghost': [[['Joyous', 'Boo! ...Hehe. I\'m not that scary, right?']], [['Normal', 'I can walk through walls, but I like walking next to you more.']]],
  'chatType@psychic': [[['Inspired', 'I just knew you were about to visit. Don\'t ask how.']], [['Normal', 'I\'m thinking of a number between 1 and 10... You got it!']]],
  'chatType@dragon': [[['Determined', 'Dragons are proud and strong. Like me!']], [['Inspired', 'Someday I\'ll fly so high, I\'ll touch the clouds.']]],
  'chatType@ice': [[['Happy', 'Brr! Perfect weather! ...What, isn\'t it?']], [['Joyous', 'I made a snowflake just for you, {player}!']]],
  'chatType@rock': [[['Determined', 'I\'m solid as a rock! Literally.']], [['Happy', 'I found a really nice stone. It looks like me!']]],
  'chatType@ground': [[['Happy', 'Digging is the best. You never know what you\'ll find!']], [['Normal', 'The ground is warm today. Good napping weather.']]],
  'chatType@flying': [[['Joyous', 'The wind\'s perfect today! I want to fly!']], [['Inspired', 'From up high, everything looks so tiny.']]],
  'chatType@bug': [[['Happy', 'I made friends with a ladybug. Her name is Dot.']], [['Inspired', 'Small things can do big things too!']]],
  'chatType@poison': [[['Worried', 'Don\'t worry, I\'m only a little bit poisonous. Mostly.']], [['Happy', 'Purple is the best colour. Obviously.']]],
  'chatType@fighting': [[['Determined', 'Hiyah! I\'ve been practising my moves!']], [['Shouting', 'One hundred push-ups! ...Okay, ten. Ten is good.']]],
  'chatType@normal': [[['Happy', 'I\'m just a regular {species}, but I\'m YOUR {species}!']], [['Normal', 'Simple days are the best days.']]],
  'chatType@fairy': [[['Joyous', 'Let\'s sprinkle a little magic on today!']], [['Happy', 'Everything is prettier with sparkles. Everything!']]],
  'chatType@dark': [[['Normal', 'Night is my favourite. Everything is calm.']], [['Happy', 'People think I\'m scary... but you don\'t, right?']]],
  'chatType@steel': [[['Determined', 'I\'m tough as iron! Nothing can dent me!']], [['Worried', 'Is it just me, or did I squeak? I need oiling...']]],
  'bath@fire': [[['Worried', 'W-water?! Okay... just a little... for you, {player}.']]],
  'bath@water': [[['Joyous', 'Bath time is the BEST time!']]],
  'greetNight@ghost': [[['Joyous', 'Night time! My favourite! I\'m wide awake, {player}!']]],
  'greetNight@dark': [[['Happy', 'Ah, the night. This is when I\'m at my best.']]],
  'sleep@electric': [[['Sigh', 'Time to recharge my batteries... zzz...']]],

  // ---- special moments ----
  chatWeekend: [[['Joyous', 'It\'s the weekend! That means extra time together, right?']], [['Happy', 'Weekends are for lazy mornings and big adventures.']]],
  chatMonday: [[['Sigh', 'Monday again... You can do it, {player}! I believe in you!']]],
  chatFriday: [[['Joyous', 'It\'s Friday! The weekend is almost here!']]],
  chatChristmas: [[['Joyous', 'Snow and presents and lights! I love this time of year, {player}!']], [['Happy', 'I wrapped a present for you. ...It\'s a berry. Don\'t peek!']]],
  chatNewYear: [[['Inspired', 'A whole new year! Let\'s make it our best one yet, {player}!']], [['Joyous', 'My resolution? Spend even more time with you!']]],
  chatHalloween: [[['Joyous', 'Trick or treat! ...Can I have both?']], [['Surprised', 'Everyone\'s wearing costumes! Should I dress up as a {player}?']]],
  'chatHalloween@ghost': [[['Joyous', 'It\'s my time to shine! Boooo! Hehe!']]],
  chatValentine: [[['Happy', 'I made you a heart out of berry juice. It\'s a bit sticky. Happy Valentine\'s, {player}!']]],
  chatParty: [[['Happy', '{friend} told me a funny story earlier. Hehe.']], [['Normal', 'Do you think {friend} likes me? I hope so!']], [['Determined', '{friend} and I had a race. I totally won! ...Probably.']]],
  chatShiny: [[['Inspired', 'Other Pokémon keep staring at my colours. Is that a good thing?']], [['Happy', 'You said I\'m one in a million. Is that true, {player}?']]],
  chatLegend: [[['Normal', 'People tell legends about Pokémon like me... but I just want to hang out with you.']], [['Inspired', 'I can feel ancient power inside me... and a little bit of hunger.']]],
  chatTogether: [[['Happy', 'We\'ve been together for {days} days now. Time flies, huh?']], [['Teary-Eyed', '{days} days together... I remember the very first one.']]],
  chatStreakLong: [[['Inspired', '{n} days in a row! You\'re the most dependable trainer ever, {player}!']]],
};
Object.entries(MORE_LINES).forEach(([k, v]) => { LINES[k] = (LINES[k] || []).concat(v); });

/** each Pokémon's personality, fixed from its own data so it never changes */
const NATURES = ['cheerful', 'shy', 'brave', 'lazy', 'cheeky', 'gentle'];
const NATURE_LABEL = { cheerful: 'Cheerful', shy: 'Shy', brave: 'Brave', lazy: 'Laid-back', cheeky: 'Cheeky', gentle: 'Gentle' };
function natureOf(p) {
  if (!p) return 'cheerful';
  const s = String(p.key || p.hatchedAt || p.sp);
  let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return NATURES[Math.abs(h) % NATURES.length];
}

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
      // general lines, plus this Pokémon's own (personality '#', type '@'), which count double
      let variants = LINES[what] || [];
      const info = petInfo();
      if (info && !info.p.egg) {
        const own = (LINES[what + '#' + natureOf(info.p)] || []).concat(LINES[what + '@' + info.sp.el] || []);
        variants = variants.concat(own, own);
      }
      if (!variants.length) return;
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

  return { init, say, clear, nature: p => natureOf(p), natureLabel: p => NATURE_LABEL[natureOf(p)], get busy() { return !!cur; } };
})();
