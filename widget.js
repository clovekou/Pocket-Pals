// POCKETPALS_WIDGET — the Pocket Pals home-screen widget (runs inside the Scriptable app).
// Loaded by the small script players copy from the game; TOKEN, PROJECT and GAME come from that script.
const DOC = "https://firestore.googleapis.com/v1/projects/" + PROJECT + "/databases/(default)/documents/widgets/" + TOKEN;
const fm = FileManager.local(), cache = fm.joinPath(fm.documentsDirectory(), "pocketpals-" + TOKEN + ".json");

function val(v) {
  if (!v) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  return null;
}
async function getData() {
  try {
    const j = await new Request(DOC).loadJSON();
    if (j && j.fields) { const d = {}; for (const k in j.fields) d[k] = val(j.fields[k]); fm.writeString(cache, JSON.stringify(d)); return d; }
  } catch (e) {}
  return fm.fileExists(cache) ? JSON.parse(fm.readString(cache)) : null;
}
async function img(url) { try { return await new Request(url).loadImage(); } catch (e) { return null; } }

// ---------- look ----------
const C = {
  bgTop: "#4256c4", bgBot: "#1d2457", card: new Color("#ffffff", 0.13), track: new Color("#0b1033", 0.55),
  text: "#ffffff", muted: "#c9d0ff", gold: "#ffd34d", low: "#ff5d5d",
};
const STATS = [
  { k: "food", label: "Food", sym: "fork.knife", color: "#ffa94d" },
  { k: "joy", label: "Happy", sym: "heart.fill", color: "#ff6fa8" },
  { k: "ene", label: "Energy", sym: "bolt.fill", color: "#ffd84d" },
  { k: "hyg", label: "Clean", sym: "drop.fill", color: "#5cc8ff" },
];
const LOW = 25;
const clamp = v => Math.max(0, Math.min(100, Math.round(v || 0)));

function txt(stack, s, size, weight, color) {
  const t = stack.addText(String(s));
  t.font = weight === "heavy" ? Font.heavyRoundedSystemFont(size) : weight === "bold" ? Font.boldRoundedSystemFont(size)
    : weight === "semi" ? Font.semiboldRoundedSystemFont(size) : Font.mediumRoundedSystemFont(size);
  t.textColor = new Color(color || C.text); t.lineLimit = 1; t.minimumScaleFactor = 0.5; return t;
}
function icon(stack, name, size, color) {
  const sf = SFSymbol.named(name); if (!sf) return null;
  sf.applyFont(Font.boldSystemFont(size));
  const im = stack.addImage(sf.image); im.imageSize = new Size(size + 2, size + 2); im.tintColor = new Color(color); return im;
}
function bar(v, w, h, color) {
  const c = new DrawContext(); c.size = new Size(w, h); c.opaque = false; c.respectScreenScale = true;
  const bg = new Path(); bg.addRoundedRect(new Rect(0, 0, w, h), h / 2, h / 2); c.addPath(bg); c.setFillColor(C.track); c.fillPath();
  const pct = clamp(v);
  if (pct > 0) {
    const p = new Path(); p.addRoundedRect(new Rect(0, 0, Math.max(h, w * pct / 100), h), h / 2, h / 2); c.addPath(p);
    c.setFillColor(new Color(pct <= LOW ? C.low : color)); c.fillPath();
  }
  return c.getImage();
}
function ago(ms) {
  if (!ms) return "";
  const m = Math.round((Date.now() - ms) / 60000);
  return m < 1 ? "Updated just now" : m < 60 ? "Updated " + m + " min ago" : m < 1440 ? "Updated " + Math.round(m / 60) + " h ago" : "Updated " + Math.round(m / 1440) + " d ago";
}
// overall status: what the Pokémon needs most right now
function status(d) {
  if (d.egg) return { sym: "hand.tap.fill", text: "Tap to hatch!", color: C.gold };
  if (d.asleep) return { sym: "moon.zzz.fill", text: "Sleeping", color: "#b9a7ff" };
  const worst = STATS.map(s => ({ s, v: clamp(d[s.k]) })).sort((a, b) => a.v - b.v)[0];
  if (worst.v <= LOW) return { sym: "exclamationmark.circle.fill", text: { food: "Hungry!", joy: "Wants to play!", ene: "Sleepy…", hyg: "Needs a bath!" }[worst.s.k], color: C.low };
  const avg = STATS.reduce((a, s) => a + clamp(d[s.k]), 0) / 4;
  return avg >= 75 ? { sym: "sparkles", text: "Feeling great!", color: "#7dff9c" } : { sym: "face.smiling", text: "Doing okay", color: C.muted };
}
function chip(parent, st, size) {
  const c = parent.addStack(); c.centerAlignContent(); c.setPadding(3, 7, 3, 8); c.cornerRadius = 9;
  c.backgroundColor = new Color(st.color, 0.18);
  icon(c, st.sym, size - 1, st.color); c.addSpacer(4); txt(c, st.text, size, "bold", st.color);
  return c;
}
function portrait(parent, face, size) {
  const card = parent.addStack(); card.size = new Size(size, size); card.cornerRadius = size * 0.22;
  card.backgroundColor = C.card; card.centerAlignContent();
  if (face) { const im = card.addImage(face); im.imageSize = new Size(size, size); }
  return card;
}
function levelPill(parent, d, size) {
  const p = parent.addStack(); p.setPadding(2, 7, 2, 7); p.cornerRadius = 8; p.backgroundColor = new Color(C.gold, 0.2);
  txt(p, d.egg ? "EGG" : "Lv " + d.level, size, "heavy", C.gold);
  if (d.shiny && !d.egg) { p.addSpacer(3); icon(p, "sparkle", size - 2, C.gold); }
}
// one stat: icon + number on top, a coloured bar underneath
function statCell(parent, d, s, w, withLabel) {
  const v = clamp(d[s.k]), low = v <= LOW;
  const cell = parent.addStack(); cell.layoutVertically(); cell.size = new Size(w, 0);
  const top = cell.addStack(); top.centerAlignContent();
  icon(top, s.sym, 11, low ? C.low : s.color); top.addSpacer(4);
  if (withLabel) txt(top, s.label, 11, "semi", C.muted);
  top.addSpacer();
  txt(top, v, 13, "heavy", low ? C.low : C.text);
  cell.addSpacer(3);
  cell.addImage(bar(v, w, 6, s.color));
  return cell;
}
function grid(parent, d, cellW, gap, withLabel) {
  const g = parent.addStack(); g.layoutVertically();
  for (let r = 0; r < 2; r++) {
    const row = g.addStack();
    statCell(row, d, STATS[r * 2], cellW, withLabel); row.addSpacer(gap); statCell(row, d, STATS[r * 2 + 1], cellW, withLabel);
    if (r === 0) g.addSpacer(7);
  }
  return g;
}

// ---------- build ----------
const d = await getData();
const w = new ListWidget(); w.url = GAME + "?from=widget";
const g = new LinearGradient(); g.colors = [new Color(C.bgTop), new Color(C.bgBot)]; g.locations = [0, 1]; w.backgroundGradient = g;
const fam = config.widgetFamily || "medium";

if (!d) {
  w.setPadding(14, 14, 14, 14);
  txt(w, "Pocket Pals", 16, "heavy"); w.addSpacer(4);
  const t = w.addText("Open the game, sign in, then tap Options → Home-screen widget.");
  t.font = Font.mediumRoundedSystemFont(12); t.textColor = new Color(C.muted);
} else {
  const face = d.face ? await img(d.face) : null;
  const st = status(d);
  if (fam === "small") {
    w.setPadding(12, 12, 12, 12);
    const top = w.addStack(); top.centerAlignContent();
    portrait(top, face, 66);
    top.addSpacer(8);
    const col = top.addStack(); col.layoutVertically();
    txt(col, d.name, 15, "heavy"); col.addSpacer(3); levelPill(col, d, 11);
    w.addSpacer(6);
    chip(w, st, 10);
    w.addSpacer();
    grid(w, d, 60, 10, false);
  } else if (fam === "large") {
    w.setPadding(16, 16, 16, 16);
    const top = w.addStack(); top.centerAlignContent();
    portrait(top, face, 130);
    top.addSpacer(14);
    const col = top.addStack(); col.layoutVertically();
    txt(col, d.name, 22, "heavy"); col.addSpacer(5); levelPill(col, d, 13);
    col.addSpacer(8); chip(col, st, 13);
    col.addSpacer(6); txt(col, (d.trainer ? d.trainer + " · " : "") + ago(d.updated), 10, "medium", C.muted);
    w.addSpacer();
    for (const s of STATS) {
      const v = clamp(d[s.k]), low = v <= LOW;
      const row = w.addStack(); row.layoutVertically();
      const h = row.addStack(); h.centerAlignContent();
      icon(h, s.sym, 14, low ? C.low : s.color); h.addSpacer(6); txt(h, s.label, 14, "bold"); h.addSpacer(); txt(h, v + "%", 15, "heavy", low ? C.low : C.text);
      row.addSpacer(4); row.addImage(bar(v, 290, 9, s.color));
      w.addSpacer(10);
    }
  } else {
    w.setPadding(14, 14, 14, 14);
    const main = w.addStack(); main.centerAlignContent();
    portrait(main, face, 116);
    main.addSpacer(14);
    const col = main.addStack(); col.layoutVertically();
    const head = col.addStack(); head.centerAlignContent();
    txt(head, d.name, 18, "heavy"); head.addSpacer(6); levelPill(head, d, 11);
    col.addSpacer(5);
    chip(col, st, 11);
    col.addSpacer(9);
    grid(col, d, 82, 12, true);
    col.addSpacer(6);
    txt(col, ago(d.updated), 9, "medium", C.muted);
  }
}
w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);
if (config.runsInWidget) Script.setWidget(w);
else if (fam === "small") await w.presentSmall(); else if (fam === "large") await w.presentLarge(); else await w.presentMedium();
Script.complete();
