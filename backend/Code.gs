/**
 * Backend for Aglaia's Craft Sale site: a Google Sheet + this Apps Script web app.
 *
 * Sheet "Guests": one row per family that answered (filled by the site).
 * Sheet "Gifts":  the wishlist. Edit it by hand: title, price, link, image, emoji, note, tags.
 *                 Type a name into "taken_by" to mark a gift as taken yourself.
 *
 * Setup is in README.md (step 1). After changing this code: Deploy → Manage deployments →
 * edit → Version: New version, otherwise the site keeps running the old code.
 */

const GUESTS = 'Guests';
const GIFTS = 'Gifts';
const GUEST_COLS = ['token', 'name', 'kids', 'adults', 'sells', 'message', 'coming', 'updated'];
const GIFT_COLS = ['id', 'title', 'price', 'link', 'image', 'emoji', 'note', 'tags', 'taken_by', 'token', 'taken_at'];

// Aglaia's wishlist (prices from Amazon.es, 30 Oct 2026): id, title, price, link, image, emoji, note, tags.
const SAMPLE_GIFTS = [
  ["a1", "Kids' microscope", 35.68, "https://www.amazon.es/dp/B0FKN195Q4", "https://m.media-amazon.com/images/I/71f3-EKo4XL._AC_SL500_.jpg", "🔬", "Option 1 · digital, zoom up to 1000×", "science"],
  ["a2", "Crystal growing tree", 21.34, "https://www.amazon.es/dp/B09LYYMT5R", "https://m.media-amazon.com/images/I/91rSa0DHk3L._AC_SL500_.jpg", "💎", "National Geographic", "science"],
  ["a3", "Crystal growing kit, 6 colours", 26.42, "https://www.amazon.es/dp/B0FMK85JST", "https://m.media-amazon.com/images/I/91cLBSYWvdL._AC_SL500_.jpg", "💠", "Klever Kits", "science"],
  ["a4", "Smart greenhouse water garden", 38.68, "https://www.amazon.es/dp/B0FD49LNLY", "https://m.media-amazon.com/images/I/815MWGda9CL._AC_SL500_.jpg", "🌱", "Clementoni Smart Tech", "science"],
  ["a5", "Kids' digital microscope", 26.14, "https://www.amazon.es/dp/B0DXPFR177", "https://m.media-amazon.com/images/I/614YPmW2AvL._AC_SL500_.jpg", "🔬", "Option 2 · rechargeable, with a screen", "science"],
  ["a6", "Magic water elves", 21.19, "https://www.amazon.es/dp/B0DS1Q4M4J", "https://m.media-amazon.com/images/I/811s5oiq4DL._AC_SL500_.jpg", "🧚", "Dreamon Aqua Gelz", "science,crafts"],
  ["a7", "Cherry blossom building blocks", 17.27, "https://www.amazon.es/dp/B0DM96D9GZ", "https://m.media-amazon.com/images/I/81x7-NpupfL._AC_SL500_.jpg", "🌸", "Option 1 · HOTUT, with LED light", "building,decor"],
  ["a8", "Flower building blocks", 30.49, "https://www.amazon.es/dp/B0HDPNT385", "https://m.media-amazon.com/images/I/71h4HDayiEL._AC_SL500_.jpg", "🌷", "Option 2 · tulips with LED light and dome", "building,decor"],
  ["a9", "Moving sand picture", 28.02, "https://www.amazon.es/dp/B0CDL8PWFZ", "https://m.media-amazon.com/images/I/71pBQiczYpL._AC_SL500_.jpg", "⏳", "Ulikey", "decor"],
  ["a10", "Metal detector", 17.18, "https://www.amazon.es/dp/B0CXXJT2ZD", "https://m.media-amazon.com/images/I/81N3c9ylTRL._AC_SL500_.jpg", "🧭", "Flintronic, portable", "science"],
  ["a11", "3D maze cube", 13.21, "https://www.amazon.es/dp/B0FWKQ71BF", "https://m.media-amazon.com/images/I/61x1LzFlT6L._AC_SL500_.jpg", "🧩", "Rolling-ball puzzle", "science"],
  ["a12", "3D tear-off desk calendar 2027", 30.49, "https://www.amazon.es/dp/B0HCMY7Z6Z", "https://m.media-amazon.com/images/I/71EHUALe7+L._AC_SL500_.jpg", "📅", "With LED light", "decor"],
  ["a13", "Ocean diamond painting", 12.19, "https://www.amazon.es/dp/B0D2D24M6V", "https://m.media-amazon.com/images/I/81VMmHEwqgL._AC_SL500_.jpg", "🐠", "Option 1 · set of 6 pictures", "crafts"],
  ["a14", "Ocean diamond painting", 8.12, "https://www.amazon.es/dp/B0D4PSB3GT", "https://m.media-amazon.com/images/I/71iTV1hf5bL._AC_SL500_.jpg", "🐬", "Option 2 · Yolistar complete kit", "crafts"],
  ["a15", "Christmas diamond painting", 13.21, "https://www.amazon.es/dp/B0DJKT64F4", "https://m.media-amazon.com/images/I/81CJJnworaL._AC_SL500_.jpg", "🎄", "KiKiHong, 2 pictures", "crafts"],
  ["a16", "Puffy 3D markers", 12.41, "https://www.amazon.es/dp/B0HC46SVP1", "https://m.media-amazon.com/images/I/615LvmNhX+L._AC_SL500_.jpg", "🖍️", "Fabric markers, 6 colours", "drawing,crafts"],
  ["a17", "Bamboo coasters for mosaic", 16.25, "https://www.amazon.es/dp/B0CWN74KC6", "https://m.media-amazon.com/images/I/71R4yUD6eyL._AC_SL500_.jpg", "🟫", "Anktily, set of 4", "crafts"],
  ["a18", "Resin moulds for pens & bookmarks", 11.17, "https://www.amazon.es/dp/B0BQ2FPBJH", "https://m.media-amazon.com/images/I/81WncjCYUdL._AC_SL500_.jpg", "🔖", "Suitedget, 41 pieces", "crafts"],
  ["a19", "Silicone resin moulds", 19.3, "https://www.amazon.es/dp/B0BJK2FDMJ", "https://m.media-amazon.com/images/I/91zcMOekFAL._AC_SL500_.jpg", "🧪", "Mocoosy, 182 pieces", "crafts"],
  ["a20", "Mandala dotting tools", 13.21, "https://www.amazon.es/dp/B0DZH1GQ1R", "https://m.media-amazon.com/images/I/71dDVUsVo8L._AC_SL500_.jpg", "🎨", "TIMESETL, 30 pieces", "drawing,crafts"],
  ["a21", "Precision craft knife", 13.21, "https://www.amazon.es/dp/B0C286M59G", "https://m.media-amazon.com/images/I/61m1TJXv10L._AC_SL500_.jpg", "✂️", "OMIGA carving set", "crafts"],
  ["a22", "Weaving loom kit", 31.07, "https://www.amazon.es/dp/B0GWV865XH", "https://m.media-amazon.com/images/I/91kqUR3i-JL._AC_SL500_.jpg", "🧶", "FlashFable potholder loom", "crafts"],
  ["a23", "Pom-pom makers", 7.99, "https://www.amazon.es/dp/B0H95BXXRY", "https://m.media-amazon.com/images/I/71Xm8FfkxUL._AC_SL500_.jpg", "🧶", "Set of 8, 4 sizes", "crafts"],
  ["a24", "Wooden bookmarks with tassels", 15.97, "https://www.amazon.es/dp/B0D3YMKC76", "https://m.media-amazon.com/images/I/71hHD-5guuL._AC_SL500_.jpg", "🔖", "50 pieces", "crafts"],
  ["a25", "Puzzle maker punch", 14.7, "https://www.amazon.es/dp/B0GZR69PCK", "https://m.media-amazon.com/images/I/61QZJkjI5FL._AC_SL500_.jpg", "🧩", "Turns photos into puzzles", "crafts"],
  ["a26", "FIMO Effect Sparkle clay", 16.19, "https://www.amazon.es/dp/B0BVN3VPXK", "https://m.media-amazon.com/images/I/81lfggPEhaL._AC_SL500_.jpg", "🏺", "12 glitter colours", "crafts"],
  ["a27", "Plant stickers", 8.63, "https://www.amazon.es/dp/B0HGR58XN8", "https://m.media-amazon.com/images/I/91zb81LaUFL._AC_SL500_.jpg", "🌿", "Option 1 · 120 floral vinyl stickers", "stickers"],
  ["a28", "Vintage scrapbooking kit", 12.19, "https://www.amazon.es/dp/B0FN3FF64T", "https://m.media-amazon.com/images/I/91oSa20YRIL._AC_SL500_.jpg", "📒", "Option 2 · 400 pieces", "stickers,crafts"],
  ["a29", "365 ideas to draw manga", 19.26, "https://www.amazon.es/dp/0241764181", "https://m.media-amazon.com/images/I/7131575MuIL._AC_SL500_.jpg", "📚", "Book in Spanish", "books,drawing"],
  ["a30", "How to draw optical illusions", 13.24, "https://www.amazon.es/dp/B09LWP5BZ7", "https://m.media-amazon.com/images/I/61hLGcVcjTL._AC_SL500_.jpg", "📐", "Book in Spanish", "books,drawing"],
  ["a31", "The best optical illusions", 17.37, "https://www.amazon.es/dp/846962721X", "https://m.media-amazon.com/images/I/81hdNrLTPlL._AC_SL500_.jpg", "👁️", "Book in Spanish", "books,drawing"],
  ["a32", "Glow-in-the-dark scratch art", 12.19, "https://www.amazon.es/dp/B0FMFMKLVT", "https://m.media-amazon.com/images/I/81QRUw3cnaL._AC_SL500_.jpg", "✨", "8 pictures + tools", "drawing"],
  ["a33", "Spiroglyphics: Animals", 8.1, "https://www.amazon.es/dp/B0CF4BFBZ5", "https://m.media-amazon.com/images/I/71RY-ksOuVL._AC_SL500_.jpg", "🌀", "Spiral colouring book", "books,drawing"],
  ["a34", "Doodle Fusion colouring book", 12.17, "https://www.amazon.es/dp/1517376912", "https://m.media-amazon.com/images/I/919vGibfWhL._AC_SL500_.jpg", "✏️", "Zifflin's, volume 2", "books,drawing"],
  ["a35", "Kawaii Cozy Corner sticker scenes", 15.9, "https://www.amazon.es/dp/B0GZ6JCQVN", "https://m.media-amazon.com/images/I/81ONX49NXyL._AC_SL500_.jpg", "🏠", "With tweezers", "stickers"],
  ["a36", "Bestie Moments colouring book", 10.59, "https://www.amazon.es/dp/1964113180", "https://m.media-amazon.com/images/I/71aD+cRe4jL._AC_SL500_.jpg", "💕", "Cute & cozy scenes", "books,drawing"],
  ["a37", "Kawaii Bedroom colouring book", 9.2, "https://www.amazon.es/dp/B0HDCGR9VQ", "https://m.media-amazon.com/images/I/712aBor96wL._AC_SL500_.jpg", "🛏️", "50 cozy room interiors", "books,drawing"],
  ["a38", "Paint by Sticker Kids: Zoo Animals", 10.37, "https://www.amazon.es/dp/0761189602", "https://m.media-amazon.com/images/I/81GIvo3b02L._AC_SL500_.jpg", "🦒", "Workman · 10 sticker pictures", "stickers,books"],
  ["a39", "LEGO Botanicals Ballerina Plants", 16.25, "https://www.amazon.es/dp/B0FPXFLNR7", "https://m.media-amazon.com/images/I/81rmpeWyqxL._AC_SL500_.jpg", "🪴", "LEGO set 11506", "building,decor"],
  ["a40", "Big A3 sketchbook", 20.28, "https://www.amazon.es/dp/B08DRC1C6T", "https://m.media-amazon.com/images/I/91WPC5CoLCL._AC_SL500_.jpg", "📓", "String & Space · thick 200 g paper, hardcover", "drawing"],
];

/** Run once from the editor: creates both sheets with headers and Aglaia's wishlist. */
function setup() {
  const ss = SpreadsheetApp.getActive();
  const guests = ss.getSheetByName(GUESTS) || ss.insertSheet(GUESTS);
  if (guests.getLastRow() === 0) guests.appendRow(GUEST_COLS);
  const gifts = ss.getSheetByName(GIFTS) || ss.insertSheet(GIFTS);
  if (gifts.getLastRow() === 0) {
    gifts.appendRow(GIFT_COLS);
    SAMPLE_GIFTS.forEach(r => gifts.appendRow(r.concat(['', '', ''])));
  }
  [guests, gifts].forEach(sh => {
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, sh.getLastColumn()).setFontWeight('bold').setBackground('#FDEBA6');
  });
}

function doGet(e) {
  return withLock(() => json(state(String((e && e.parameter.token) || ''))));
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json({ error: 'bad_request' });
  }
  return withLock(() => {
    const error = handle(body);
    const out = state(clean(body.token, 64));
    if (error) out.error = error;
    return json(out);
  });
}

function handle(b) {
  const token = clean(b.token, 64);
  if (!token) return 'no_token';
  switch (b.action) {
    case 'rsvp': return rsvp(token, b);
    case 'cancel_rsvp': return cancelRsvp(token);
    case 'take': return take(token, b);
    case 'release': return release(token, b);
    default: return 'unknown_action';
  }
}

// ---------- actions (return an error code, or nothing on success) ----------

function rsvp(token, b) {
  const name = clean(b.name, 60);
  const kids = count(b.kids), adults = count(b.adults);
  if (!name) return 'name_required';
  if (kids + adults < 1) return 'nobody';
  const t = table(GUESTS);
  const rec = { token, name, kids, adults, sells: !!b.sells, message: clean(b.message, 300), coming: true, updated: new Date() };
  const old = t.rows.find(r => r.token === token);
  if (old) update(t, old._row, rec);
  else t.sh.appendRow(t.head.map(h => (h in rec ? rec[h] : '')));
}

function cancelRsvp(token) {
  const t = table(GUESTS);
  const old = t.rows.find(r => r.token === token);
  if (old) update(t, old._row, { coming: false, updated: new Date() });
}

function take(token, b) {
  const t = table(GIFTS);
  const g = t.rows.find(r => String(r.id) === String(b.id));
  if (!g) return 'not_found';
  if (isTaken(g) && String(g.token) !== token) return 'taken';
  update(t, g._row, { taken_by: clean(b.name, 60) || 'a guest', token, taken_at: new Date() });
}

function release(token, b) {
  const t = table(GIFTS);
  const g = t.rows.find(r => String(r.id) === String(b.id));
  if (!g || String(g.token) !== token) return 'not_yours';
  update(t, g._row, { taken_by: '', token: '', taken_at: '' });
}

// ---------- what the site gets: totals and gifts, never other people's names ----------

function state(token) {
  const guests = table(GUESTS).rows.filter(r => r.coming === true);
  const giftTable = table(GIFTS);
  ensureIds(giftTable);
  const gifts = giftTable.rows.filter(r => String(r.title).trim());
  const me = token ? guests.find(r => r.token === token) : null;
  return {
    guests: {
      families: guests.length,
      kids: guests.reduce((n, r) => n + (Number(r.kids) || 0), 0),
      adults: guests.reduce((n, r) => n + (Number(r.adults) || 0), 0),
      sellers: guests.filter(r => r.sells === true).length,
    },
    gifts: gifts.map(r => ({
      id: String(r.id),
      title: String(r.title),
      price: price(r.price),
      link: String(r.link || ''),
      image: String(r.image || ''),
      emoji: String(r.emoji || ''),
      note: String(r.note || ''),
      tags: String(r.tags || ''),
      taken: isTaken(r),
      mine: !!token && String(r.token) === token,
    })),
    me: {
      rsvp: me ? { name: String(me.name), kids: Number(me.kids) || 0, adults: Number(me.adults) || 0, sells: me.sells === true, message: String(me.message || '') } : null,
    },
  };
}

// ---------- helpers ----------

function table(name) {
  const sh = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sh) throw new Error('Sheet "' + name + '" is missing: run setup() once.');
  const values = sh.getDataRange().getValues();
  const head = values.shift().map(h => String(h).trim());
  const rows = values.map((v, i) => {
    const o = { _row: i + 2 };
    head.forEach((h, j) => { o[h] = v[j]; });
    return o;
  });
  return { sh, head, rows };
}

function update(t, rowNum, patch) {
  Object.keys(patch).forEach(k => {
    const col = t.head.indexOf(k);
    if (col >= 0) t.sh.getRange(rowNum, col + 1).setValue(patch[k]);
  });
}

/** Gifts added by hand may have no id: give them one so reservations stay attached. */
function ensureIds(t) {
  t.rows.forEach(r => {
    if (String(r.title).trim() && !String(r.id).trim()) {
      r.id = 'g' + Utilities.getUuid().slice(0, 8);
      update(t, r._row, { id: r.id });
    }
  });
}

function isTaken(r) {
  return !!(String(r.token || '').trim() || String(r.taken_by || '').trim());
}

/** Accepts 12, "12", "12,50", "€12.50". */
function price(v) {
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v || '').replace(',', '.').replace(/[^\d.]/g, ''));
  return isFinite(n) ? n : null;
}

function count(v) {
  return Math.max(0, Math.min(10, Math.round(Number(v) || 0)));
}

/** Trim, cut to length, and stop text like "=HYPERLINK(...)" from becoming a formula. */
function clean(v, max) {
  let s = String(v == null ? '' : v).trim().slice(0, max);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

function withLock(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
