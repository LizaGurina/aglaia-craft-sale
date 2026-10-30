(() => {
  'use strict';

  const CFG = window.SITE_CONFIG || {};
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const sum = (rows, key) => rows.reduce((n, r) => n + (Number(r[key]) || 0), 0);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeUrl = u => /^https?:\/\//i.test(String(u || '').trim());

  // localStorage can throw in private windows: every access goes through here.
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* not saved, fine */ } },
  };

  // One random id per browser: lets a guest change their answer or undo a gift.
  function makeId() {
    if (crypto.randomUUID) return crypto.randomUUID();
    const a = crypto.getRandomValues(new Uint8Array(16));
    return [...a].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  let token = store.get('acs-token');
  if (!token) { token = makeId(); store.set('acs-token', token); }

  // ================= decorations =================

  // sections fade up as they come into view
  function revealOnScroll() {
    const items = $$('.reveal');
    if (!('IntersectionObserver' in window)) { items.forEach(el => el.classList.add('in')); return; }
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }), { rootMargin: '0px 0px -8% 0px' });
    items.forEach(el => io.observe(el));
    // if the observer never fires (some in-app browsers), never leave the page invisible
    setTimeout(() => { if (!$('.reveal.in')) items.forEach(el => el.classList.add('in')); }, 2500);
  }

  // The menu is a row of boats on the sea. Once the sea scrolls away they dock in a
  // thin strip of sea at the top of the screen; the boat of the section in view is underlined.
  const boatsNav = $('.boats');
  const boats = $$('.boat', boatsNav);
  function watchScroll() {
    const sea = $('.hero .sea');
    let docked = false;
    const update = () => {
      const top = sea.getBoundingClientRect().top;
      const next = docked ? top < -20 : top < -70; // hysteresis: no flicker at the edge
      if (next !== docked) { docked = next; boatsNav.classList.toggle('docked', docked); }
    };
    addEventListener('scroll', update, { passive: true });
    update();

    const io = new IntersectionObserver(entries => {
      entries.filter(e => e.isIntersecting).forEach(e => {
        boats.forEach(a => {
          const on = a.getAttribute('href') === '#' + e.target.id;
          a.classList.toggle('active', on);
          if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    boats.forEach(a => { const sec = $(a.getAttribute('href')); if (sec) io.observe(sec); });
  }

  // Jumping to a section: a painted wave rolls up over the screen, the page moves
  // underneath it, and the wave washes away upwards. Plain jump with reduced motion.
  const tide = $('.tide');
  const water = $('.tide-water', tide);
  let tideBusy = false;
  function jumpTo(target) {
    const root = document.documentElement;
    const prev = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    const pad = parseFloat(getComputedStyle(root).scrollPaddingTop) || 0;
    scrollTo(0, target.getBoundingClientRect().top + scrollY - pad);
    root.style.scrollBehavior = prev;
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  }
  async function washTo(target) {
    if (tideBusy) return;
    if (reduceMotion || !water.animate) { jumpTo(target); return; }
    tideBusy = true;
    tide.classList.add('run');
    try {
      await water.animate([{ transform: 'translateY(110vh)' }, { transform: 'translateY(-12vh)' }],
        { duration: 560, easing: 'cubic-bezier(.45,0,.7,.4)', fill: 'forwards' }).finished;
      jumpTo(target);
      await water.animate([{ transform: 'translateY(-12vh)' }, { transform: 'translateY(-150vh)' }],
        { duration: 700, easing: 'cubic-bezier(.3,.6,.4,1)', fill: 'forwards' }).finished;
    } finally {
      tide.classList.remove('run');
      water.getAnimations().forEach(a => a.cancel());
      tideBusy = false;
    }
  }
  document.addEventListener('click', e => {
    const link = e.target.closest('a[href^="#"]');
    if (!link || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const id = link.getAttribute('href').slice(1);
    const target = id && document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    history.pushState(null, '', '#' + id);
    washTo(target);
  });

  const CONFETTI =['#EE3E7E', '#FFC531', '#13A0AE', '#8E3FC2', '#FF8B2B', '#3BB273', '#2E86DE'];
  function confetti() {
    if (reduceMotion) return;
    const box = document.createElement('div');
    box.className = 'confetti';
    document.body.append(box);
    for (let i = 0; i < 90; i++) {
      const p = document.createElement('i');
      p.style.background = CONFETTI[i % CONFETTI.length];
      p.style.left = Math.random() * 100 + 'vw';
      if (i % 3 === 0) p.style.borderRadius = '50%';
      box.append(p);
      p.animate([
        { transform: 'translate(0, -5vh) rotate(0deg)' },
        { transform: `translate(${(Math.random() - 0.5) * 30}vw, 105vh) rotate(${Math.random() * 900}deg)` },
      ], { duration: 1800 + Math.random() * 1600, delay: Math.random() * 300, easing: 'cubic-bezier(.2,.6,.4,1)', fill: 'forwards' });
    }
    setTimeout(() => box.remove(), 4000);
  }

  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 3400);
  }

  // ================= date, calendar =================

  // live countdown to the party: days / hours / minutes / seconds
  function countdown() {
    const start = new Date(CFG.eventStart), end = new Date(CFG.eventEnd);
    const box = $('#countdown');
    const cells = { d: $('[data-cd="d"]', box), h: $('[data-cd="h"]', box), m: $('[data-cd="m"]', box), s: $('[data-cd="s"]', box) };
    const names = { d: 'day', h: 'hour', m: 'minute', s: 'second' };
    const pad = n => String(n).padStart(2, '0');
    function tick() {
      const now = new Date();
      if (now >= start) {
        $('.cd-tiles', box).hidden = true;
        $('.cd-title', box).hidden = true;
        const done = $('.cd-done', box);
        done.hidden = false;
        done.textContent = now > end ? 'Thank you for coming! ♥' : 'The party is on right now! ♥';
        return false;
      }
      let left = Math.floor((start - now) / 1000);
      const parts = { d: Math.floor(left / 86400), h: Math.floor(left % 86400 / 3600), m: Math.floor(left % 3600 / 60), s: left % 60 };
      for (const k in parts) {
        const v = k === 'd' ? String(parts.d) : pad(parts[k]);
        if (cells[k].textContent !== v) cells[k].textContent = v;
        $(`[data-cd-label="${k}"]`, box).textContent = names[k] + (parts[k] === 1 ? '' : 's');
      }
      return true;
    }
    if (tick()) {
      const timer = setInterval(() => { if (!tick()) clearInterval(timer); }, 1000);
    }
  }


  const stamp = d => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

  function setupCalendar() {
    const start = new Date(CFG.eventStart), end = new Date(CFG.eventEnd);
    const title = "Aglaia's Craft Sale 🎨";
    const page = location.href.split('#')[0];
    const details = `Aglaia turns 8! Bring your crafts, set prices and sell, or come to buy. ${page}`;

    const g = new URL('https://calendar.google.com/calendar/render');
    g.search = new URLSearchParams({ action: 'TEMPLATE', text: title, dates: `${stamp(start)}/${stamp(end)}`, location: CFG.address, details });
    $('#gcal').href = g;

    $('#ics').addEventListener('click', () => {
      const icsText = s => s.replace(/[\\;,]/g, m => '\\' + m);
      const ics = [
        'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//aglaia-craft-sale//EN', 'BEGIN:VEVENT',
        `UID:aglaia-craft-sale-${stamp(start)}@github.io`, `DTSTAMP:${stamp(new Date())}`,
        `DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`,
        `SUMMARY:${icsText(title)}`, `LOCATION:${icsText(CFG.address)}`, `DESCRIPTION:${icsText(details)}`,
        'END:VEVENT', 'END:VCALENDAR',
      ].join('\r\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
      a.download = 'aglaia-craft-sale.ics';
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    });
  }

  // ================= backend =================
  // Real one: a Google Apps Script web app over a Google Sheet (backend/Code.gs).
  // Without apiUrl the site runs on a fake backend in localStorage, same answers.

  function remoteApi(url) {
    return {
      demo: false,
      async load() {
        const r = await fetch(`${url}?token=${encodeURIComponent(token)}`);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      },
      async send(action, data) {
        // text/plain keeps it a "simple" request: Apps Script can't answer CORS preflights.
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action, token, ...data }),
        });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      },
    };
  }

  function demoApi() {
    const KEY = 'acs-demo-db-v2';
    let db = null;
    try { db = JSON.parse(store.get(KEY)); } catch { db = null; }
    if (!db) db = { guests: [], gifts: [] };
    // always take the current gifts.js list, keeping only who picked what from earlier visits
    const picked = Object.fromEntries((db.gifts || []).map(g => [g.id, g]));
    db.gifts = (window.WISHLIST || []).map(g => ({ ...g, token: picked[g.id]?.token || '', taken_by: picked[g.id]?.taken_by || '' }));
    const save = () => store.set(KEY, JSON.stringify(db));

    function state() {
      const coming = db.guests.filter(g => g.coming);
      const me = coming.find(g => g.token === token);
      return {
        guests: { families: coming.length, kids: sum(coming, 'kids'), adults: sum(coming, 'adults'), sellers: coming.filter(g => g.sells).length },
        gifts: db.gifts.map(({ token: t, taken_by, ...g }) => ({ ...g, taken: !!t, mine: t === token })),
        me: { rsvp: me ? { name: me.name, kids: me.kids, adults: me.adults, sells: me.sells, message: me.message } : null },
      };
    }

    const actions = {
      rsvp(b) {
        const rec = { token, name: b.name, kids: b.kids, adults: b.adults, sells: !!b.sells, message: b.message || '', coming: true };
        const i = db.guests.findIndex(g => g.token === token);
        if (i >= 0) db.guests[i] = rec; else db.guests.push(rec);
      },
      cancel_rsvp() {
        const g = db.guests.find(x => x.token === token);
        if (g) g.coming = false;
      },
      take(b) {
        const g = db.gifts.find(x => x.id === b.id);
        if (!g) return 'not_found';
        if (g.token && g.token !== token) return 'taken';
        g.token = token;
        g.taken_by = b.name;
      },
      release(b) {
        const g = db.gifts.find(x => x.id === b.id);
        if (!g || g.token !== token) return 'not_yours';
        g.token = '';
        g.taken_by = '';
      },
    };

    return {
      demo: true,
      async load() { await wait(200); return state(); },
      async send(action, data) {
        await wait(300);
        const error = actions[action](data);
        save();
        const s = state();
        if (error) s.error = error;
        return s;
      },
    };
  }

  const api = CFG.apiUrl ? remoteApi(CFG.apiUrl) : demoApi();

  // ================= state & rendering =================

  let state = null;
  let editing = false;
  let sortDir = store.get('acs-sort') === 'desc' ? 'desc' : 'asc';

  async function refresh() {
    try {
      apply(await api.load());
    } catch (err) {
      console.error(err);
      if (state) return;
      $('#gifts').innerHTML = `<li class="empty">Couldn't load the wishlist. <button class="link" id="retry" type="button">Try again</button></li>`;
      $('#retry').onclick = refresh;
    }
  }

  function apply(s) {
    state = s;
    renderCounter(s.guests);
    renderRsvp(s.me && s.me.rsvp);
    renderGifts();
  }

  function animateNumber(el, to) {
    const from = Number(el.textContent) || 0;
    if (reduceMotion || from === to) { el.textContent = to; return; }
    const t0 = performance.now(), dur = 700;
    const tick = now => {
      const k = Math.min(1, (now - t0) / dur);
      el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    setTimeout(() => { el.textContent = to; }, dur + 150); // in case frames are paused
  }

  function renderCounter(g) {
    const total = g.kids + g.adults;
    animateNumber($('#count-total'), total);
    $('#count-label').textContent = total === 1 ? 'guest is coming' : 'guests are coming';
    $('#count-kids').parentElement.lastChild.textContent = g.kids === 1 ? ' kid' : ' kids';
    $('#count-adults').parentElement.lastChild.textContent = g.adults === 1 ? ' grown-up' : ' grown-ups';
    $('#count-sellers').parentElement.lastChild.textContent = g.sellers === 1 ? ' little shop' : ' little shops';
    $('#count-families').nextSibling.textContent = g.families === 1 ? ' family so far' : ' families so far';
    $('#count-kids').textContent = g.kids;
    $('#count-adults').textContent = g.adults;
    $('#count-sellers').textContent = g.sellers;
    $('#count-families').textContent = g.families;
  }

  // ---------- RSVP ----------

  const form = $('#rsvp-form');
  const done = $('#rsvp-done');
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

  function renderRsvp(me) {
    const showDone = !!me && !editing;
    form.hidden = showDone;
    done.hidden = !showDone;
    // stop the "Are you coming?" nudging once this guest has answered
    document.documentElement.classList.toggle('rsvp-done', !!me);
    $('.btn-call').innerHTML = me ? "You're on the guest list <span aria-hidden=\"true\">♥</span>" : "Let us know you're coming <span aria-hidden=\"true\">♥</span>";
    if (!me) return;
    store.set('acs-name', me.name);
    const who = [me.kids && plural(me.kids, 'kid'), me.adults && plural(me.adults, 'grown-up')].filter(Boolean).join(' and ');
    $('#rsvp-summary').textContent = `We've got you down: ${me.name}, ${who}${me.sells ? ', bringing crafts to sell' : ''}.`;
  }

  function fillForm(me) {
    form.elements.name.value = me.name;
    form.elements.kids.value = me.kids;
    form.elements.adults.value = me.adults;
    form.elements.sells.checked = me.sells;
    form.elements.message.value = me.message || '';
  }

  $$('[data-step]', form).forEach(b => b.addEventListener('click', () => {
    const input = form.elements[b.dataset.for];
    const v = (Number(input.value) || 0) + Number(b.dataset.step);
    input.value = Math.max(0, Math.min(10, v));
  }));

  const formMsg = msg => { $('#form-msg').textContent = msg; };

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const clamp = v => Math.max(0, Math.min(10, Math.round(Number(v) || 0)));
    const data = {
      name: form.elements.name.value.trim(),
      kids: clamp(form.elements.kids.value),
      adults: clamp(form.elements.adults.value),
      sells: form.elements.sells.checked,
      message: form.elements.message.value.trim(),
    };
    if (!data.name) { formMsg('Please write your name 🙂'); form.elements.name.focus(); return; }
    if (data.kids + data.adults < 1) { formMsg('How many people are coming?'); return; }
    formMsg('');
    const btn = form.querySelector('[type=submit]');
    btn.disabled = true;
    btn.textContent = 'Sending…';
    try {
      const s = await api.send('rsvp', data);
      if (s.error) throw new Error(s.error);
      editing = false;
      apply(s);
      confetti();
      toast('Yay! See you on 22 November ♥');
    } catch (err) {
      console.error(err);
      formMsg("Couldn't send. Please check your internet and try again.");
    } finally {
      btn.disabled = false;
      btn.textContent = "We'll be there! ♥";
    }
  });

  $('#rsvp-change').addEventListener('click', () => {
    if (!state?.me?.rsvp) return;
    editing = true;
    fillForm(state.me.rsvp);
    renderRsvp(state.me.rsvp);
    form.elements.name.focus();
  });

  $('#rsvp-cancel').addEventListener('click', async () => {
    if (!confirm("Sad! Remove your answer?")) return;
    try {
      const s = await api.send('cancel_rsvp', {});
      editing = false;
      apply(s);
      toast("OK, we'll miss you! 💛");
    } catch (err) {
      console.error(err);
      toast("Couldn't save. Please try again.");
    }
  });

  // ---------- wishlist ----------

  const TILES = ['var(--pink-soft)', 'var(--yellow-soft)', 'var(--teal-soft)', 'var(--purple-soft)', 'var(--blue-soft)', 'var(--mint-soft)'];
  const TAPES = ['rgba(20,166,184,.6)', 'rgba(240,64,127,.55)', 'rgba(255,194,46,.75)', 'rgba(142,63,194,.5)'];
  const priceOf = g => (typeof g.price === 'number' && isFinite(g.price) ? g.price : null);
  const money = new Intl.NumberFormat('en-IE', { style: 'currency', currency: CFG.currency || 'EUR' });
  const fmtPrice = p => money.format(p).replace(/\.00$/, '');

  function giftCard(g, idx) {
    const emoji = `<span class="emoji" aria-hidden="true">${esc(g.emoji || '🎁')}</span>`;
    const art = safeUrl(g.image)
      ? `<img src="${esc(g.image)}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'emoji',textContent:${esc(JSON.stringify(g.emoji || '🎁'))}}))">`
      : emoji;
    const price = priceOf(g) === null ? '' : `<span class="price">${fmtPrice(g.price)}</span>`;
    const shopName = /amazon\./i.test(g.link || '') ? 'Amazon' : 'the shop';
    const shop = safeUrl(g.link)
      ? `<a class="btn btn-ghost btn-sm" href="${esc(g.link)}" target="_blank" rel="noopener">See on ${shopName} <span aria-hidden="true">↗</span></a>` : '';
    const action = g.mine
      ? `<p class="status mine-msg">You're bringing this ♥ <button class="link" type="button" data-release="${esc(g.id)}">undo</button></p>`
      : `<button class="btn btn-teal btn-sm" type="button" data-take="${esc(g.id)}">I'll bring it ♥</button>`;
    const rot = [-1.5, 1.2, -0.6, 1.8, -1.1, 0.7][idx % 6];
    return `<li class="gift${g.mine ? ' is-taken is-mine' : ''}" style="--rot:${rot}deg;--tape:${TAPES[idx % TAPES.length]}">
      <div class="gift-art${safeUrl(g.image) ? ' photo' : ''}" style="--t:${TILES[idx % TILES.length]}">${art}${g.mine ? '<span class="stamp">Yours!</span>' : ''}</div>
      ${price}
      <div class="gift-body">
        <h3>${esc(g.title)}</h3>
        ${g.note ? `<p class="note">${esc(g.note)}</p>` : ''}
        ${tagsOf(g).length ? `<p class="gtags">${tagsOf(g).map(t => `<span style="--c:${CAT[t].c}">${CAT[t].short}</span>`).join('')}</p>` : ''}
        <div class="gift-action">${action}${shop}</div>
      </div>
    </li>`;
  }

  // Kinds of presents and budgets for the filter chips (a gift can have several kinds).
  const CATS = [
    { id: 'drawing', label: 'Drawing & colouring', short: 'Drawing', c: '#F0407F' },
    { id: 'building', label: 'LEGO & blocks', short: 'LEGO & blocks', c: '#FF8A2A' },
    { id: 'crafts', label: 'Crafts', short: 'Crafts', c: '#8E3FC2' },
    { id: 'science', label: 'Science & puzzles', short: 'Science', c: '#14A6B8' },
    { id: 'books', label: 'Books', short: 'Book', c: '#2E86DE' },
    { id: 'stickers', label: 'Stickers', short: 'Stickers', c: '#D69400' },
    { id: 'decor', label: 'For her room', short: 'Room', c: '#FF6F61' },
  ];
  const CAT = Object.fromEntries(CATS.map(c => [c.id, c]));
  const BUDGETS = [
    { id: 'any', label: 'Any price' },
    { id: 'u10', label: 'Up to €10', max: 10 },
    { id: 'u20', label: '€10–20', min: 10, max: 20 },
    { id: 'u30', label: '€20–30', min: 20, max: 30 },
    { id: 'o30', label: '€30+', min: 30 },
  ];
  const tagsOf = g => String(g.tags || '').split(',').map(t => t.trim()).filter(t => CAT[t]);
  let catFilter = 'all', budgetFilter = 'any', expanded = false;
  const inCat = (g, c = catFilter) => c === 'all' || tagsOf(g).includes(c);
  const inBudget = (g, id = budgetFilter) => {
    const b = BUDGETS.find(x => x.id === id), p = priceOf(g);
    if (!b || b.id === 'any') return true;
    if (p === null) return false;
    return (b.min === undefined || p >= b.min) && (b.max === undefined || p < b.max);
  };

  function renderFilters(pool) {
    const chip = (kind, id, label, n, color) =>
      `<button type="button" class="fchip" data-${kind}="${id}" aria-pressed="${(kind === 'cat' ? catFilter : budgetFilter) === id}"${color ? ` style="--c:${color}"` : ''}${n === 0 ? ' disabled' : ''}>${label}<span class="n">${n}</span></button>`;
    $('#gift-cats').innerHTML = chip('cat', 'all', 'All', pool.filter(g => inBudget(g)).length) +
      CATS.map(c => chip('cat', c.id, c.label, pool.filter(g => inCat(g, c.id) && inBudget(g)).length, c.c)).join('');
    $('#gift-budget').innerHTML = BUDGETS.map(b => chip('budget', b.id, b.label, pool.filter(g => inCat(g) && inBudget(g, b.id)).length)).join('');
  }

  // Two rows by default, the rest behind "Show all".
  function applyCollapse() {
    const grid = $('#gifts');
    const cards = $$('.gift', grid);
    const cols = getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length || 2;
    const limit = cols * 2;
    cards.forEach((li, i) => { li.hidden = !expanded && i >= limit; });
    const row = $('.more-row');
    row.hidden = cards.length <= limit;
    $('#gift-more').textContent = expanded ? 'Show less ▲' : `Show all ${cards.length} presents ▼`;
    $('#gift-more').setAttribute('aria-expanded', String(expanded));
  }

  // Once someone picks a gift it disappears for everybody else; the picker keeps a "Yours!" card.
  function renderGifts() {
    const gifts = state.gifts;
    const pool = gifts.filter(g => !g.taken || g.mine);
    const shown = pool.filter(g => inCat(g) && inBudget(g)).sort((a, b) => {
      if (a.mine !== b.mine) return a.mine ? -1 : 1; // your own pick first
      const pa = priceOf(a), pb = priceOf(b);
      if (pa === null || pb === null) return (pa === null) - (pb === null); // no price → last
      return sortDir === 'asc' ? pa - pb : pb - pa;
    });
    renderFilters(pool);
    const free = gifts.filter(g => !g.taken).length;
    const filtered = catFilter !== 'all' || budgetFilter !== 'any';
    $('#gift-tally').textContent = !gifts.length ? ''
      : filtered ? `Showing ${shown.length} of ${free} presents left to pick`
      : `${free} ${free === 1 ? 'present' : 'presents'} left to pick`;
    $('#gifts').innerHTML = shown.length
      ? shown.map(giftCard).join('')
      : `<li class="empty">${!gifts.length ? 'The wishlist is coming soon…' : !free ? 'Everything is picked already! Thank you ♥' : 'Nothing here — try another filter.'}</li>`;
    applyCollapse();
  }

  $('.toolbar').addEventListener('click', e => {
    const c = e.target.closest('[data-cat]'), b = e.target.closest('[data-budget]');
    if (!c && !b) return;
    if (c) catFilter = c.dataset.cat;
    if (b) budgetFilter = b.dataset.budget;
    if (state) renderGifts();
  });
  $('#gift-more').addEventListener('click', () => {
    const wasExpanded = expanded;
    expanded = !expanded;
    applyCollapse();
    if (wasExpanded) $('#wishlist .toolbar').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  });
  let collapseTimer;
  addEventListener('resize', () => { clearTimeout(collapseTimer); collapseTimer = setTimeout(() => state && applyCollapse(), 150); });

  function syncSort() {
    $$('[data-sort]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.sort === sortDir)));
  }
  $$('[data-sort]').forEach(b => b.addEventListener('click', () => {
    sortDir = b.dataset.sort;
    store.set('acs-sort', sortDir);
    syncSort();
    if (state) renderGifts();
  }));

  // One tap marks a gift as taken: no names, the card just turns "Yours!" for this browser.
  $('#gifts').addEventListener('click', e => {
    const take = e.target.closest('[data-take]');
    const release = e.target.closest('[data-release]');
    if (take) takeGift(take.dataset.take, take);
    if (release) releaseGift(release.dataset.release, release);
  });

  async function takeGift(id, btn) {
    btn.disabled = true;
    btn.textContent = 'Saving…';
    try {
      const s = await api.send('take', { id });
      apply(s);
      if (s.error === 'taken') toast('Oops, someone just picked it. Choose another one? ♥');
      else if (s.error) toast("Couldn't save. Please try again.");
      else {
        const card = $(`[data-release="${CSS.escape(id)}"]`)?.closest('.gift');
        if (card) card.classList.add('just-taken');
        confetti();
        toast('Thank you! Aglaia will love it ♥');
      }
    } catch (err) {
      console.error(err);
      toast("Couldn't save. Check your internet and try again.");
      renderGifts();
    }
  }

  async function releaseGift(id, btn) {
    btn.disabled = true;
    try {
      const s = await api.send('release', { id });
      apply(s);
      toast(s.error ? "Couldn't undo. Please try again." : "OK, it's free again.");
    } catch (err) {
      console.error(err);
      toast("Couldn't undo. Check your internet and try again.");
      btn.disabled = false;
    }
  }

  // ================= start =================

  if (api.demo) $('#demo-banner').hidden = false;
  watchScroll();
  revealOnScroll();
  countdown();
  setupCalendar();
  syncSort();
  refresh();
  // someone else may have taken a gift while this tab was in the background
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
})();
