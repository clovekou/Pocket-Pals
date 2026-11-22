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
function bar(v, w, h) {
  const c = new DrawContext(); c.size = new Size(w, h); c.opaque = false; c.respectScreenScale = true;
  const bg = new Path(); bg.addRoundedRect(new Rect(0, 0, w, h), h / 2, h / 2); c.addPath(bg); c.setFillColor(new Color("#2f3448")); c.fillPath();
  const pct = Math.max(0, Math.min(100, v || 0));
  if (pct > 0) {
    const p = new Path(); p.addRoundedRect(new Rect(0, 0, Math.max(h, w * pct / 100), h), h / 2, h / 2); c.addPath(p);
    c.setFillColor(new Color(pct > 50 ? "#48d048" : pct > 20 ? "#f8c030" : "#f85838")); c.fillPath();
  }
  return c.getImage();
}
function ago(ms) {
  const m = Math.round((Date.now() - ms) / 60000);
  return m < 1 ? "just now" : m < 60 ? m + " min ago" : m < 1440 ? Math.round(m / 60) + " h ago" : Math.round(m / 1440) + " d ago";
}
function txt(stack, s, size, bold, color) {
  const t = stack.addText(String(s)); t.font = bold ? Font.boldRoundedSystemFont(size) : Font.regularRoundedSystemFont(size);
  t.textColor = new Color(color || "#ffffff"); t.lineLimit = 1; t.minimumScaleFactor = 0.6; return t;
}

const d = await getData();
const w = new ListWidget(); w.url = GAME; w.setPadding(12, 12, 12, 12);
const g = new LinearGradient(); g.colors = [new Color("#3b4ba8"), new Color("#1f2650")]; g.locations = [0, 1]; w.backgroundGradient = g;
const fam = config.widgetFamily || "medium";

if (!d) {
  txt(w, "Pocket Pals", 15, true);
  const t = w.addText("Open the game, sign in, and tap Options → Home-screen widget."); t.font = Font.regularRoundedSystemFont(12); t.textColor = new Color("#dfe4ff");
} else {
  const face = await img(d.face);
  const stats = [["Food", d.food], ["Happy", d.joy], ["Energy", d.ene], ["Hygiene", d.hyg]];
  const sub = d.egg ? "Egg" : "Lv " + d.level + (d.shiny ? " ✦" : "");
  if (fam === "small") {
    const top = w.addStack(); top.centerAlignContent();
    if (face) { const im = top.addImage(face); im.imageSize = new Size(44, 44); im.cornerRadius = 10; }
    top.addSpacer(8);
    const col = top.addStack(); col.layoutVertically(); txt(col, d.name, 14, true); txt(col, sub, 11, false, "#f8d030");
    w.addSpacer(6);
    for (const [label, v] of stats) {
      const row = w.addStack(); row.centerAlignContent();
      const l = txt(row, label[0], 9, true, "#dfe4ff"); row.addSpacer(4);
      row.addImage(bar(v, 108, 7)); w.addSpacer(3);
    }
    w.addSpacer(2); txt(w, d.mood, 9, false, "#dfe4ff");
  } else {
    const top = w.addStack(); top.centerAlignContent();
    if (face) { const im = top.addImage(face); im.imageSize = new Size(fam === "large" ? 110 : 88, fam === "large" ? 110 : 88); im.cornerRadius = 14; }
    top.addSpacer(12);
    const col = top.addStack(); col.layoutVertically();
    const head = col.addStack(); head.centerAlignContent(); txt(head, d.name, 16, true); head.addSpacer(6); txt(head, sub, 12, true, "#f8d030");
    col.addSpacer(4);
    for (const [label, v] of stats) {
      const row = col.addStack(); row.centerAlignContent();
      const ls = row.addStack(); ls.size = new Size(52, 0); txt(ls, label, 10, true, "#dfe4ff");
      row.addImage(bar(v, 120, 8)); row.addSpacer(6); txt(row, Math.round(v || 0), 10, true);
      col.addSpacer(3);
    }
    w.addSpacer(6);
    const foot = w.addStack(); txt(foot, d.mood, 11, true, "#ffffff"); foot.addSpacer(); txt(foot, d.trainer + " · " + ago(d.updated), 9, false, "#aab3e8");
  }
}
w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);
if (config.runsInWidget) Script.setWidget(w); else await w.presentMedium();
Script.complete();
