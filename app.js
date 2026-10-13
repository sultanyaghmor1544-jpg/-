'use strict';
(function () {
  const $ = s => document.querySelector(s);
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (_) {} },
    del(k) { try { localStorage.removeItem(k); } catch (_) {} },
    keys() { try { return Object.keys(localStorage); } catch (_) { return []; } }
  };
  const sky = () => window.ThakirSky || { setMode() {}, burst() {}, celebrate() {}, shoot() {} };
  const buzz = p => { try { navigator.vibrate && navigator.vibrate(p); } catch (_) {} };

  const morningTab = $('#morningTab'), eveningTab = $('#eveningTab'), list = $('#adhkar'),
    storiesTab = $('#storiesTab'), storiesBox = $('#stories'), prayerTab = $('#prayerTab'), prayerBox = $('#prayer'),
    notifyBtn = $('#notifyBtn'), notifyStatus = $('#notifyStatus'), nextPrayer = $('#nextPrayer'),
    progressText = $('#progressText'), progressLabel = $('#progressLabel'), progressRing = $('.progress-ring'),
    welcome = $('#welcome'), toast = $('#toast');

  const savedMode = store.get('thakir-mode');
  let mode = savedMode === 'evening' || savedMode === 'stories' || savedMode === 'prayer' ? savedMode : 'morning';
  const items = () => (mode === 'evening' ? EVENING : MORNING);
  const skyMode = () => (mode === 'morning' ? 'morning' : 'evening');
  const today = () => new Date().toLocaleDateString('en-CA');

  /* ---------- daily reset ---------- */
  (function resetDailyCounts() {
    const d = today();
    if (store.get('thakir-count-date') !== d) {
      store.keys().forEach(k => { if (k.startsWith('count-') || k.startsWith('done-')) store.del(k); });
      store.set('thakir-count-date', d);
    }
  })();

  /* ---------- counts ---------- */
  const COUNT_LABEL = { 1: 'مرة واحدة', 2: 'مرتان', 3: 'ثلاث مرات', 4: 'أربع مرات', 7: 'سبع مرات', 10: 'عشر مرات', 100: 'مائة مرة' };
  const label = n => COUNT_LABEL[n] || (n + ' مرات');
  const targetOf = z => z.count || 1;
  function getCount(m, i) {
    const n = Number.parseInt(store.get(`count-${m}-${i}`), 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }
  function stats() {
    let done = 0, total = 0;
    items().forEach((z, i) => { const t = targetOf(z); total += t; done += Math.min(getCount(mode, i), t); });
    return { done, total, pct: total ? Math.round(done / total * 100) : 0 };
  }
  function updateProgress(fromTap) {
    const s = stats();
    progressText.textContent = s.pct + '%';
    progressRing.style.setProperty('--progress', s.pct + '%');
    progressRing.classList.toggle('full', s.pct === 100);
    progressLabel.textContent = s.pct === 100 ? 'أحسنت، اكتملت الأذكار' : s.done ? 'أكمل أذكارك' : 'ابدأ أول ذكر';
    if (fromTap && s.pct === 100 && !store.get('done-all-' + mode)) {
      store.set('done-all-' + mode, '1');
      sky().celebrate();
      buzz([20, 60, 20, 60, 40]);
      showToast(mode === 'morning' ? 'ما شاء الله — أتممت أذكار الصباح 🌅' : 'ما شاء الله — أتممت أذكار المساء 🌙');
    }
  }
  let toastTimer;
  function showToast(msg) {
    toast.textContent = msg; toast.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 3800);
  }

  /* ---------- cards ---------- */
  function setBtn(btn, count, target) {
    btn.textContent = `${count}/${target}`;
    btn.setAttribute('aria-label', `الذكر ${count} من ${target}`);
    btn.style.setProperty('--p', (count / target * 100) + '%');
  }
  function card(z, i) {
    const target = targetOf(z), count = Math.min(getCount(mode, i), target);
    const el = document.createElement('article');
    el.className = 'zekr' + (count >= target ? ' complete' : '');
    el.style.setProperty('--d', Math.min(i, 6) * 50 + 'ms');

    const text = document.createElement('div'); text.className = 'text'; text.textContent = z.text; el.appendChild(text);
    const meta = document.createElement('div'); meta.className = 'meta';
    const chip = document.createElement('span'); chip.className = 'chip'; chip.textContent = label(target); meta.appendChild(chip);
    if (z.ref) { const r = document.createElement('span'); r.className = 'ref'; r.textContent = z.ref; meta.appendChild(r); }
    el.appendChild(meta);
    if (z.benefit) { const b = document.createElement('div'); b.className = 'benefit'; b.textContent = z.benefit; el.appendChild(b); }

    const btn = document.createElement('button'); btn.className = 'mark' + (count >= target ? ' done' : ''); btn.type = 'button';
    setBtn(btn, count, target); if (count >= target) btn.disabled = true;
    el.appendChild(btn);

    const advance = ev => {
      const cur = getCount(mode, i); if (cur >= target) return;
      const next = Math.min(cur + 1, target);
      store.set(`count-${mode}-${i}`, String(next));
      setBtn(btn, next, target);
      btn.classList.remove('tap'); void btn.offsetWidth; btn.classList.add('tap');

      const box = el.getBoundingClientRect(); let x, y;
      if (ev && ev.clientX) { x = ev.clientX; y = ev.clientY; }
      else { const b = btn.getBoundingClientRect(); x = b.left + b.width / 2; y = b.top + b.height / 2; }
      el.style.setProperty('--rx', (x - box.left) + 'px'); el.style.setProperty('--ry', (y - box.top) + 'px');
      el.classList.remove('ripple'); void el.offsetWidth; el.classList.add('ripple');

      if (next >= target) {
        btn.classList.add('done'); btn.disabled = true; el.classList.add('complete');
        sky().burst(x, y, 'big'); buzz([14, 50, 14]);
      } else buzz(8);
      updateProgress(true);
    };
    el.addEventListener('click', e => { if (e.target.closest('.mark')) return; advance(e); });
    btn.addEventListener('click', e => { e.stopPropagation(); advance(e); });
    return el;
  }

  let io = null;
  function reveal() {
    const cards = list.querySelectorAll('.zekr');
    if (!('IntersectionObserver' in window)) { cards.forEach(c => c.classList.add('in')); return; }
    if (io) io.disconnect();
    io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }),
      { threshold: .06, rootMargin: '0px 0px -4% 0px' });
    cards.forEach(c => io.observe(c));
  }

  function render() {
    document.body.classList.remove('morning', 'evening', 'stories', 'prayer'); document.body.classList.add(mode);
    [[morningTab, 'morning'], [eveningTab, 'evening'], [storiesTab, 'stories'], [prayerTab, 'prayer']].forEach(([b, m]) => { b.classList.toggle('active', mode === m); b.setAttribute('aria-pressed', mode === m); });
    const isStories = mode === 'stories', isPrayer = mode === 'prayer';
    $('#heroTitle').textContent = isPrayer ? 'مواقيت الصلاة والقبلة' : isStories ? 'تذكرة وعِبرة' : mode === 'morning' ? 'ابدأ صباحك بالذكر' : 'اختم يومك بالذكر';
    $('#greeting').textContent = isPrayer ? 'جدة' : isStories ? 'تذكّر' : mode === 'morning' ? 'صباح الخير' : 'مساء الخير';
    list.hidden = isStories || isPrayer; storiesBox.hidden = !isStories; prayerBox.hidden = !isPrayer;
    if (!isPrayer) stopPrayerUI();
    if (isPrayer) { renderPrayer(); return; }
    if (isStories) { renderStories(); return; }
    list.textContent = '';
    const frag = document.createDocumentFragment();
    items().forEach((z, i) => frag.appendChild(card(z, i)));
    list.appendChild(frag);
    reveal(); updateProgress(false);
  }

  /* ---------- stories ---------- */
  const el = (tag, cls, txt) => { const n = document.createElement(tag); if (cls) n.className = cls; if (txt) n.textContent = txt; return n; };
  const dayIndex = () => { const d = new Date(); return Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 864e5); };
  const POOL = TRIVIA;
  const shuffle = arr => arr.map(x => ({ x, r: Math.random() })).sort((p, q) => p.r - q.r).map(o => o.x);
  const ROUNDS = [5, 10, 20];
  const LV = { all: 'منوّع', 1: 'سهل', 2: 'متوسط', 3: 'صعب' };
  let level = ['all', '1', '2', '3'].includes(store.get('thakir-level')) ? store.get('thakir-level') : 'all';
  const poolFor = l => (l === 'all' ? POOL : POOL.filter(x => String(x.lvl) === String(l)));
  let round = null;

  function questionCard(s, label, nextText, onAnswer, onNext) {
    const c = el('article', 'zekr in quiz');
    c.style.cursor = 'default';
    c.appendChild(el('div', 'label', label));
    c.appendChild(el('div', 'text', s.q));
    const wrap = el('div', 'opts');
    const box = el('div', 'answer'); box.hidden = true;
    const a1 = el('div'); a1.appendChild(el('span', 'lbl', 'الجواب')); a1.appendChild(document.createTextNode(s.ok)); box.appendChild(a1);
    const a2 = el('div'); a2.style.marginTop = '6px'; a2.appendChild(el('span', 'lbl', 'تذكّر')); a2.appendChild(document.createTextNode(s.note)); box.appendChild(a2);
    if (s.ref) box.appendChild(el('span', 'ref', s.ref));
    const next = el('button', 'mark', nextText); next.type = 'button'; next.hidden = true;
    next.onclick = onNext;
    const btns = shuffle([s.ok].concat(s.bad)).map(t => {
      const b = el('button', 'opt', t); b.type = 'button';
      b.onclick = e => {
        btns.forEach(x => { x.disabled = true; if (x.textContent === s.ok) x.classList.add('right'); });
        const good = t === s.ok;
        if (!good) b.classList.add('wrong');
        box.hidden = false; next.hidden = false;
        if (good) { sky().burst(e.clientX || innerWidth / 2, e.clientY || innerHeight / 2, 'big'); buzz(10); } else buzz([30]);
        onAnswer(good);
      };
      wrap.appendChild(b); return b;
    });
    c.appendChild(wrap); c.appendChild(box); c.appendChild(next);
    return c;
  }

  function launcher() {
    const c = el('article', 'zekr in quiz'); c.style.cursor = 'default';
    c.appendChild(el('div', 'label', 'تحدّي التذكرة · ' + POOL.length + ' سؤال'));
    c.appendChild(el('div', 'text', 'اختر المستوى وعدد الأسئلة وانظر كم تجيب'));
    const lv = el('div', 'levels');
    ['all', '1', '2', '3'].forEach(k => {
      const b = el('button', 'lvl-btn' + (level === k ? ' on' : ''), LV[k]); b.type = 'button';
      b.onclick = () => { level = k; store.set('thakir-level', k); renderStories(); };
      lv.appendChild(b);
    });
    c.appendChild(lv);
    const grid = el('div', 'rounds');
    const size = poolFor(level).length;
    ROUNDS.forEach(n => {
      const b = el('button', 'round-btn'); b.type = 'button';
      b.appendChild(el('b', '', String(n)));
      b.appendChild(el('span', '', 'أسئلة'));
      const best = store.get('best-' + level + '-' + n);
      b.appendChild(el('small', '', best !== null && best !== undefined ? 'أفضل: ' + best + '/' + n : 'لم تبدأ بعد'));
      b.onclick = () => startRound(Math.min(n, size));
      grid.appendChild(b);
    });
    c.appendChild(grid);
    const board = el('div', 'board');
    board.appendChild(el('div', 'bt', 'لوحة أرقامك'));
    const hd = el('div', 'brow h'); hd.appendChild(el('span', '', '')); ROUNDS.forEach(n => hd.appendChild(el('span', '', n + ' أسئلة'))); board.appendChild(hd);
    ['1', '2', '3', 'all'].forEach(k => {
      const r = el('div', 'brow'); r.appendChild(el('span', '', LV[k]));
      ROUNDS.forEach(n => { const v = store.get('best-' + k + '-' + n); r.appendChild(el('b', v !== null && v !== undefined ? 'has' : '', v !== null && v !== undefined ? v + '/' + n : '-')); });
      board.appendChild(r);
    });
    c.appendChild(board);
    return c;
  }

  function startRound(n) {
    round = { n, level, i: 0, score: 0, qs: shuffle(poolFor(level)).slice(0, n), missed: [] };
    renderStories(); storiesBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function roundView() {
    const r = round;
    const wrap = document.createDocumentFragment();
    const head = el('div', 'rhead');
    head.appendChild(el('span', '', 'السؤال ' + (r.i + 1) + ' من ' + r.n + ' · ' + LV[r.level]));
    head.appendChild(el('span', '', 'الصحيح: ' + r.score));
    wrap.appendChild(head);
    const bar = el('div', 'rbar'); const fill = el('i'); fill.style.width = (r.i / r.n * 100) + '%'; bar.appendChild(fill); wrap.appendChild(bar);
    const s = r.qs[r.i];
    wrap.appendChild(questionCard(s, 'تذكرة · ' + s.cat + ' · ' + LV[s.lvl], r.i + 1 < r.n ? 'السؤال التالي' : 'عرض النتيجة',
      good => { if (good) r.score++; else r.missed.push(s); head.lastChild.textContent = 'الصحيح: ' + r.score; fill.style.width = ((r.i + 1) / r.n * 100) + '%'; },
      () => { r.i++; renderStories(); window.scrollTo({ top: storiesBox.offsetTop - 10, behavior: 'smooth' }); }));
    const quit = el('button', 'linkbtn', 'إنهاء التحدي'); quit.type = 'button';
    quit.onclick = () => { round = null; renderStories(); };
    wrap.appendChild(quit);
    return wrap;
  }

  function resultView() {
    const r = round, pct = r.score / r.n;
    const prev = parseInt(store.get('best-' + r.level + '-' + r.n), 10);
    const isBest = isNaN(prev) || r.score > prev;
    if (isBest) store.set('best-' + r.level + '-' + r.n, String(r.score));
    if (pct >= .7) { sky().celebrate(); buzz([20, 40, 20]); }
    const c = el('article', 'zekr in quiz'); c.style.cursor = 'default';
    c.appendChild(el('div', 'label', 'نتيجتك'));
    c.appendChild(el('div', 'score', r.score + ' / ' + r.n));
    const bar = el('div', 'rbar'); const fill = el('i'); fill.style.width = (pct * 100) + '%'; bar.appendChild(fill); c.appendChild(bar);
    c.appendChild(el('div', 'text', pct >= .9 ? 'ما شاء الله، تذكّرت أغلب ما سألناك عنه' : pct >= .6 ? 'جيد، وراجع التذكرات أدناه لتثبّتها' : 'لا بأس، التكرار يثبّت المعلومة فأعد المحاولة'));
    if (isBest && r.score > 0) c.appendChild(el('div', 'ref', '✦ أفضل نتيجة لك في ' + LV[r.level] + ' · ' + r.n + ' أسئلة'));
    if (r.missed.length) {
      c.appendChild(el('div', 'sec-title', 'تذكرات للمراجعة'));
      r.missed.forEach(s => {
        const m = el('div', 'missed');
        m.appendChild(el('div', 'mq', s.q)); m.appendChild(el('div', 'ma', s.ok)); m.appendChild(el('div', 'ref', s.note));
        c.appendChild(m);
      });
    }
    const again = el('button', 'mark', 'إعادة التحدي'); again.type = 'button'; again.onclick = () => startRound(r.n);
    const back = el('button', 'linkbtn', 'تغيير المستوى أو العدد'); back.type = 'button'; back.onclick = () => { round = null; renderStories(); };
    c.appendChild(again); c.appendChild(back);
    return c;
  }

  function storyCard(s, idx) {
    const c = el('article', 'zekr in'); c.style.cursor = 'default';
    const head = el('button', 'story-head'); head.type = 'button'; head.setAttribute('aria-expanded', 'false');
    const t = el('span', '', s.title); t.appendChild(el('small', '', s.ref.split('،')[0]));
    head.appendChild(t); head.appendChild(el('i', '', '⌄'));
    const body = el('div', 'story-body'); body.hidden = true;
    body.appendChild(el('p', '', s.sum));
    body.appendChild(el('span', 'mini-label', 'العِبر'));
    const ul = el('ul'); s.lessons.forEach(l => ul.appendChild(el('li', '', l))); body.appendChild(ul);
    body.appendChild(el('span', 'ref', 'المراجع: ' + s.ref));
    head.onclick = () => { const open = body.hidden; body.hidden = !open; head.setAttribute('aria-expanded', open); };
    c.appendChild(head); c.appendChild(body);
    return c;
  }
  function renderStories() {
    storiesBox.textContent = '';
    if (round) { storiesBox.appendChild(round.i >= round.n ? resultView() : roundView()); return; }
    storiesBox.appendChild(launcher());
    storiesBox.appendChild(el('h3', 'sec-title', 'سيرة نبينا محمد صلى الله عليه وسلم'));
    SEERAH.forEach((s, i) => storiesBox.appendChild(storyCard(s, i)));
    storiesBox.appendChild(el('h3', 'sec-title', 'قصص الأنبياء السابقين'));
    STORIES.forEach((s, i) => storiesBox.appendChild(storyCard(s, i)));
  }
  function setMode(m) {
    if (m === mode) return;
    mode = m; store.set('thakir-mode', mode);
    sky().setMode(skyMode()); render();
  }
  morningTab.onclick = () => setMode('morning');
  eveningTab.onclick = () => setMode('evening');
  storiesTab.onclick = () => setMode('stories');
  prayerTab.onclick = () => setMode('prayer');

  $('#continueBtn').onclick = () => {
    const next = [...list.querySelectorAll('.zekr')].find(c => !c.classList.contains('complete'));
    if (next) next.scrollIntoView({ behavior: 'smooth', block: 'center' });
    else showToast('أتممت جميع الأذكار، تقبّل الله منك 🤍');
  };

  /* ---------- welcome ---------- */
  $('#startBtn').onclick = e => {
    store.set('thakir-welcomed', '1');
    sky().burst(e.clientX || innerWidth / 2, e.clientY || innerHeight / 2, 'mega');
    welcome.classList.add('hidden'); welcome.setAttribute('aria-hidden', 'true'); document.body.classList.remove('welcoming');
  };
  if (store.get('thakir-welcomed') === '1') welcome.classList.add('hidden'); else { welcome.setAttribute('aria-hidden', 'false'); document.body.classList.add('welcoming'); }

  /* ---------- prayer times + reminders (Jeddah) ---------- */
  const PRAYERS = [['Fajr', 'الفجر'], ['Dhuhr', 'الظهر'], ['Asr', 'العصر'], ['Maghrib', 'المغرب'], ['Isha', 'العشاء']];
  const RIYADH = 3 * 3600e3;
  const rdate = () => new Date(Date.now() + RIYADH).toISOString().slice(0, 10);
  const instant = (hhmm, addDays) => {
    const [h, m] = String(hhmm).slice(0, 5).split(':').map(Number), s = new Date(Date.now() + RIYADH);
    return Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate() + (addDays || 0), h - 3, m);
  };
  const fmt12 = hhmm => { const [h, m] = String(hhmm).slice(0, 5).split(':').map(Number); return ((h % 12) || 12) + ':' + String(m).padStart(2, '0') + ' ' + (h >= 12 ? 'م' : 'ص'); };
  const hhmmPlus = (hhmm, mins) => { const [h, m] = String(hhmm).slice(0, 5).split(':').map(Number), t = (h * 60 + m + mins) % 1440; return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); };
  const IQ_DEF = { Fajr: 25, Dhuhr: 20, Asr: 20, Maghrib: 10, Isha: 20 };
  const iqMin = k => { try { const v = parseInt(JSON.parse(store.get('thakir-iqama-min') || '{}')[k], 10); return v > 0 ? v : IQ_DEF[k]; } catch (_) { return IQ_DEF[k]; } };
  const iqBefore = () => { const v = store.get('thakir-iqama-before'); return v === null || v === undefined ? 5 : (parseInt(v, 10) || 0); };
  let iqEdit = false;
  const timers = {};
  const notifyOn = type => store.get('thakir-notify-' + type) !== '0';
  const prayOn = k => store.get('thakir-pray-' + k) === '1';
  let ptimes = null, tick = null, qiblaCleanup = null;

  async function notify(title, body, tag) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try {
      const reg = navigator.serviceWorker && await navigator.serviceWorker.ready;
      if (reg && reg.showNotification) { await reg.showNotification(title, { body, tag, icon: 'icon.png', badge: 'icon.png', dir: 'rtl', lang: 'ar' }); return; }
    } catch (_) {}
    try { new Notification(title, { body, icon: 'icon.png', tag }); } catch (_) {}
  }
  function nextPrayerInfo() {
    if (!ptimes) return null;
    const now = Date.now();
    for (const [k, n] of PRAYERS) { const t = instant(ptimes[k]); if (t > now) return { k, n, t }; }
    return { k: 'Fajr', n: 'الفجر', t: instant(ptimes.Fajr, 1) };
  }
  function updateNextText() {
    const x = nextPrayerInfo();
    if (x) nextPrayer.textContent = 'الصلاة القادمة: ' + x.n + ' ' + fmt12(ptimes[x.k]);
  }
  function scheduleAll() {
    Object.values(timers).forEach(clearTimeout);
    if (!ptimes) return;
    const now = Date.now();
    PRAYERS.forEach(([k, n]) => {
      const t = instant(ptimes[k]), bf = iqBefore();
      if (prayOn(k) && bf > 0 && iqMin(k) > bf) {
        const ti = t + (iqMin(k) - bf) * 60000;
        if (ti > now) timers['i' + k] = setTimeout(() => notify('باقي ' + bf + ' دقائق على إقامة ' + n, 'الإقامة الساعة ' + fmt12(hhmmPlus(ptimes[k], iqMin(k))), 'iqama-' + k), ti - now);
      }
      if (t <= now) return;
      if (prayOn(k)) timers['p' + k] = setTimeout(() => notify('حان وقت صلاة ' + n, 'قم إلى الصلاة، تقبّل الله منك', 'prayer-' + k), t - now);
      if (k === 'Fajr' && notifyOn('fajr')) timers.adhkarFajr = setTimeout(() => notify('أذكار الصباح', 'حان وقت أذكار الصباح 🌅', 'adhkar-fajr'), t - now);
      if (k === 'Asr' && notifyOn('asr')) timers.adhkarAsr = setTimeout(() => notify('أذكار المساء', 'حان وقت أذكار المساء 🌙', 'adhkar-asr'), t - now);
    });
    const s = new Date(now + RIYADH), midnight = Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate() + 1, -3, 5);
    timers.refresh = setTimeout(prayerTimes, midnight - now);
  }
  function applyTimes(t) { ptimes = t; updateNextText(); scheduleAll(); if (mode === 'prayer') renderPrayer(); }
  async function prayerTimes() {
    let cached = null; try { cached = JSON.parse(store.get('thakir-times2') || 'null'); } catch (_) {}
    if (cached && cached.day === rdate()) { applyTimes(cached); return; }
    try {
      const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 9000);
      const r = await fetch('https://api.aladhan.com/v1/timingsByCity?city=Jeddah&country=Saudi%20Arabia&method=4', { signal: ctl.signal });
      clearTimeout(to);
      const t = (await r.json()).data.timings, o = { day: rdate() };
      ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'].forEach(k => { o[k] = String(t[k]).slice(0, 5); });
      store.set('thakir-times2', JSON.stringify(o)); applyTimes(o);
    } catch (_) {
      if (cached) applyTimes(cached);
      else { nextPrayer.textContent = 'فعّل الإنترنت لحساب مواقيت الصلاة في جدة'; if (mode === 'prayer') renderPrayer(); }
    }
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) prayerTimes(); });

  /* ---------- prayer tab UI ---------- */
  function stopPrayerUI() {
    clearInterval(tick); tick = null;
    if (qiblaCleanup) { qiblaCleanup(); qiblaCleanup = null; }
  }
  const pad2 = n => String(n).padStart(2, '0');
  const fmtLeft = ms => { const s = Math.max(0, Math.floor(ms / 1000)); return pad2(Math.floor(s / 3600)) + ':' + pad2(Math.floor(s % 3600 / 60)) + ':' + pad2(s % 60); };

  function renderPrayer() {
    stopPrayerUI();
    prayerBox.textContent = '';
    if (!ptimes) {
      const c = el('article', 'zekr in'); c.style.cursor = 'default';
      c.appendChild(el('div', 'label', 'مواقيت جدة'));
      c.appendChild(el('div', 'text', 'فعّل الإنترنت لحساب مواقيت الصلاة في جدة'));
      prayerBox.appendChild(c);
    } else {
      const nx = nextPrayerInfo();
      const c = el('article', 'zekr in'); c.style.cursor = 'default';
      c.appendChild(el('div', 'label', 'الصلاة القادمة · جدة'));
      const big = el('div', 'pnext'); big.appendChild(el('b', '', nx.n)); big.appendChild(el('span', '', fmt12(ptimes[nx.k]))); c.appendChild(big);
      const cd = el('div', 'pcount'); c.appendChild(cd);
      c.appendChild(el('div', 'pcount', 'الإقامة ' + fmt12(hhmmPlus(ptimes[nx.k], iqMin(nx.k)))));
      const upd = () => { const left = nx.t - Date.now(); if (left <= 0) { renderPrayer(); return; } cd.textContent = 'بعد ' + fmtLeft(left); };
      upd(); tick = setInterval(upd, 1000);
      prayerBox.appendChild(c);

      const lc = el('article', 'zekr in'); lc.style.cursor = 'default';
      lc.appendChild(el('div', 'label', 'مواقيت اليوم · فعّل التذكير لكل صلاة'));
      [['Fajr', 'الفجر'], ['Sunrise', 'الشروق'], ['Dhuhr', 'الظهر'], ['Asr', 'العصر'], ['Maghrib', 'المغرب'], ['Isha', 'العشاء']].forEach(([k, n]) => {
        const row = el('div', 'prow' + (k === nx.k ? ' next' : '') + (k === 'Sunrise' ? ' sun' : ''));
        row.appendChild(el('span', '', n));
        const pt = el('span', 'pt'); pt.appendChild(el('b', '', fmt12(ptimes[k])));
        if (k !== 'Sunrise') pt.appendChild(el('small', '', 'الإقامة ' + fmt12(hhmmPlus(ptimes[k], iqMin(k)))));
        row.appendChild(pt);
        if (k === 'Sunrise') row.appendChild(el('span', 'nosw'));
        else {
          const lab = el('label', 'switch'), inp = document.createElement('input'); inp.type = 'checkbox'; inp.checked = prayOn(k);
          inp.setAttribute('aria-label', 'تذكير ' + n);
          inp.onchange = async () => {
            if (inp.checked) {
              let ok = 'Notification' in window && Notification.permission === 'granted';
              if (!ok && 'Notification' in window) { try { ok = (await Notification.requestPermission()) === 'granted'; } catch (_) {} }
              if (!ok) { inp.checked = false; showToast('فعّل الإشعارات من إعدادات المتصفح أو الجهاز'); return; }
            }
            store.set('thakir-pray-' + k, inp.checked ? '1' : '0'); scheduleAll(); syncPrefs();
          };
          lab.appendChild(inp); lab.appendChild(document.createElement('span')); row.appendChild(lab);
        }
        lc.appendChild(row);
      });
      const reapply = () => { scheduleAll(); syncPrefs(); renderPrayer(); };
      const iqRow = el('div', 'prow'); iqRow.style.borderTop = '1px solid var(--line)';
      const iqName = el('span', '', 'تنبيه قبل الإقامة'); iqRow.appendChild(iqName); iqRow.appendChild(el('span', 'pt'));
      const iqLab = el('label', 'switch'), iqInp = document.createElement('input'); iqInp.type = 'checkbox'; iqInp.checked = iqBefore() > 0; iqInp.setAttribute('aria-label', 'تنبيه قبل الإقامة');
      iqInp.onchange = () => { store.set('thakir-iqama-before', iqInp.checked ? (store.get('thakir-iqama-last') || '5') : '0'); reapply(); };
      iqLab.appendChild(iqInp); iqLab.appendChild(document.createElement('span')); iqRow.appendChild(iqLab); lc.appendChild(iqRow);
      if (iqBefore() > 0) {
        const chips = el('div', 'levels'); chips.style.gridTemplateColumns = 'repeat(3,1fr)'; chips.style.marginBottom = '6px';
        [3, 5, 10].forEach(m => { const b = el('button', 'lvl-btn' + (iqBefore() === m ? ' on' : ''), 'قبل ' + m + ' دقائق'); b.type = 'button'; b.onclick = () => { store.set('thakir-iqama-before', String(m)); store.set('thakir-iqama-last', String(m)); reapply(); }; chips.appendChild(b); });
        lc.appendChild(chips);
      }
      const iqToggle = el('button', 'linkbtn', iqEdit ? 'إخفاء ضبط الإقامة' : 'ضبط مدة الإقامة بعد الأذان'); iqToggle.type = 'button';
      iqToggle.onclick = () => { iqEdit = !iqEdit; renderPrayer(); };
      lc.appendChild(iqToggle);
      if (iqEdit) {
        const box = el('div', 'iqedit');
        PRAYERS.forEach(([k, n]) => {
          const r = el('div', 'iqrow'); r.appendChild(el('span', '', n));
          const inp = document.createElement('input'); inp.type = 'number'; inp.min = '1'; inp.max = '60'; inp.inputMode = 'numeric'; inp.value = String(iqMin(k)); inp.setAttribute('aria-label', 'مدة الإقامة بعد أذان ' + n);
          inp.onchange = () => {
            let o = {}; try { o = JSON.parse(store.get('thakir-iqama-min') || '{}'); } catch (_) {}
            const v = Math.max(1, Math.min(60, parseInt(inp.value, 10) || IQ_DEF[k])); o[k] = v; store.set('thakir-iqama-min', JSON.stringify(o)); reapply();
          };
          r.appendChild(inp); r.appendChild(el('small', '', 'دقيقة بعد الأذان')); box.appendChild(r);
        });
        box.appendChild(el('p', 'pnote', 'المدد الافتراضية تقريبية (الفجر 25، الظهر 20، العصر 20، المغرب 10، العشاء 20 دقيقة) وتختلف بين المساجد. عدّلها لتناسب مسجدك.'));
        lc.appendChild(box);
      }
      const pushRow = el('button', 'linkbtn', 'جاري فحص الإشعارات الخارجية…'); pushRow.type = 'button';
      pushSub().then(sub => { pushRow.textContent = sub ? 'الإشعارات الخارجية مفعّلة ✓ (تصل والتطبيق مغلق)' : 'فعّل الإشعارات الخارجية لتصلك والتطبيق مغلق'; pushRow.dataset.on = sub ? '1' : '0'; });
      pushRow.onclick = async () => {
        if (pushRow.dataset.on === '1') return;
        try { pushRow.textContent = 'جاري التفعيل…'; const ok = await enablePush(); if (ok) { await syncPrefs(); renderPrayer(); } else pushRow.textContent = 'تعذّر التفعيل. تأكد من السماح بالإشعارات'; }
        catch (_) { pushRow.textContent = 'تعذّر التفعيل. حاول مرة أخرى'; }
      };
      lc.appendChild(pushRow);
      const test = el('button', 'linkbtn', 'جرّب تنبيهًا الآن'); test.type = 'button';
      test.onclick = async () => {
        const sub = await pushSub();
        if (sub) {
          try { const r = await fetch(PUSH_WORKER + '/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: sub.toJSON() }) }); const j = await r.json(); showToast(j.ok ? 'أُرسل التنبيه من السيرفر، انتظر ثوانٍ' : 'السيرفر رفض الإرسال (رمز ' + (j.status || r.status) + ')'); } catch (_) { showToast('تعذّر الوصول للسيرفر'); }
          return;
        }
        let ok = 'Notification' in window && Notification.permission === 'granted';
        if (!ok && 'Notification' in window) { try { ok = (await Notification.requestPermission()) === 'granted'; } catch (_) {} }
        if (ok) { notify('ذَكِّر', 'هكذا سيصلك تنبيه الصلاة ✦', 'test'); showToast('أُرسل التنبيه'); } else showToast('الإشعارات غير مفعّلة');
      };
      lc.appendChild(test);
      lc.appendChild(el('p', 'pnote', 'المواقيت لمدينة جدة (أم القرى). تعمل التنبيهات داخل التطبيق ما دام مفتوحًا أو في الخلفية، وللتنبيه والتطبيق مغلق فعّل الإشعارات الخارجية أعلاه.'));
      prayerBox.appendChild(lc);
    }
    prayerBox.appendChild(qiblaCard());
  }

  /* ---------- qibla ---------- */
  const KAABA = { lat: 21.4225, lon: 39.8262 };
  const rad = d => d * Math.PI / 180, deg = r => r * 180 / Math.PI;
  const qiblaBearing = (lat, lon) => {
    const p1 = rad(lat), p2 = rad(KAABA.lat), dl = rad(KAABA.lon - lon);
    return (deg(Math.atan2(Math.sin(dl) * Math.cos(p2), Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl))) + 360) % 360;
  };
  const distKm = (lat, lon) => {
    const dp = rad(KAABA.lat - lat), dl = rad(KAABA.lon - lon), a = Math.sin(dp / 2) ** 2 + Math.cos(rad(lat)) * Math.cos(rad(KAABA.lat)) * Math.sin(dl / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };
  let loc = null; try { loc = JSON.parse(store.get('thakir-loc') || 'null'); } catch (_) {}
  if (!loc || typeof loc.lat !== 'number') loc = { lat: 21.4858, lon: 39.1925, name: 'جدة' };

  function qiblaCard() {
    const q = qiblaBearing(loc.lat, loc.lon);
    const c = el('article', 'zekr in'); c.style.cursor = 'default';
    c.appendChild(el('div', 'label', 'اتجاه القبلة'));
    let ticks = '';
    for (let i = 0; i < 36; i++) { const a = rad(i * 10), r1 = 100, r2 = i % 9 === 0 ? 88 : 94; ticks += `<line class="ctick" x1="${120 + r1 * Math.sin(a)}" y1="${130 - r1 * Math.cos(a)}" x2="${120 + r2 * Math.sin(a)}" y2="${130 - r2 * Math.cos(a)}"/>`; }
    const wrap = el('div', 'compass');
    wrap.innerHTML = `<svg viewBox="0 0 240 250" role="img" aria-label="بوصلة القبلة"><polygon class="cptr" points="120,2 111,20 129,20"/><g id="cdial"><circle class="cring" cx="120" cy="130" r="100"/>${ticks}<text class="cn" x="120" y="62">N</text><text class="cl" x="184" y="134">E</text><text class="cl" x="120" y="206">S</text><text class="cl" x="56" y="134">W</text><g id="ckaaba" transform="rotate(${q.toFixed(1)} 120 130)"><line class="cline" x1="120" y1="130" x2="120" y2="52"/><rect class="ckaaba" x="108" y="20" width="24" height="24" rx="4"/><rect class="ckband" x="108" y="27" width="24" height="4"/></g></g><circle class="cdot" cx="120" cy="130" r="4"/></svg>`;
    c.appendChild(wrap);
    const dist = Math.round(distKm(loc.lat, loc.lon));
    c.appendChild(el('div', 'qinfo', 'القبلة ' + Math.round(q) + '° من الشمال · ' + (loc.name || 'موقعك') + ' · ' + dist + ' كم إلى الكعبة'));
    const stat = el('div', 'qstat', 'ضع الجوال أفقيًا ثم اضغط «تشغيل البوصلة»'); c.appendChild(stat);
    const btns = el('div', 'qbtns');
    const startBtn = el('button', 'opt', 'تشغيل البوصلة'); startBtn.type = 'button';
    const locBtn = el('button', 'opt', 'استخدم موقعي'); locBtn.type = 'button';
    btns.appendChild(startBtn); btns.appendChild(locBtn); c.appendChild(btns);

    const dial = wrap.querySelector('#cdial');
    let heading = null, aligned = false, got = false;
    const setHeading = h => {
      if (heading === null) heading = h; else { const d = ((h - heading + 540) % 360) - 180; heading = (heading + d * 0.3 + 360) % 360; }
      dial.setAttribute('transform', 'rotate(' + (-heading).toFixed(1) + ' 120 130)');
      const ok = Math.abs(((q - heading + 540) % 360) - 180) < 5;
      c.classList.toggle('aligned', ok);
      stat.textContent = ok ? 'أنت متجه نحو القبلة ✓' : 'أدر الجوال حتى تصل الكعبة إلى أعلى';
      if (ok && !aligned) buzz(20);
      aligned = ok;
    };
    const onOri = e => {
      let h = null;
      if (typeof e.webkitCompassHeading === 'number') h = e.webkitCompassHeading;
      else if ((e.type === 'deviceorientationabsolute' || e.absolute) && e.alpha !== null && e.alpha !== undefined) h = (360 - e.alpha + ((screen.orientation && screen.orientation.angle) || 0)) % 360;
      if (h === null || Number.isNaN(h)) return;
      got = true; setHeading(h);
    };
    startBtn.onclick = async () => {
      try {
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
          if ((await DeviceOrientationEvent.requestPermission()) !== 'granted') { stat.textContent = 'لم يُسمح باستخدام البوصلة'; return; }
        }
        window.addEventListener('deviceorientationabsolute', onOri, true);
        window.addEventListener('deviceorientation', onOri, true);
        stat.textContent = 'جاري قراءة البوصلة…';
        setTimeout(() => { if (!got) stat.textContent = 'لا توجد قراءة من مستشعر البوصلة. القبلة ' + Math.round(q) + '° من الشمال، فاستعن ببوصلة الجوال.'; }, 2500);
      } catch (_) { stat.textContent = 'تعذّر تشغيل البوصلة على هذا الجهاز'; }
    };
    locBtn.onclick = () => {
      if (!navigator.geolocation) { stat.textContent = 'الموقع غير مدعوم على هذا الجهاز'; return; }
      stat.textContent = 'جاري تحديد موقعك…';
      navigator.geolocation.getCurrentPosition(p => {
        loc = { lat: p.coords.latitude, lon: p.coords.longitude, name: 'موقعك الحالي' };
        store.set('thakir-loc', JSON.stringify(loc)); renderPrayer();
      }, () => { stat.textContent = 'لم يُسمح بالوصول للموقع، نستخدم جدة'; }, { timeout: 10000 });
    };
    qiblaCleanup = () => { window.removeEventListener('deviceorientationabsolute', onOri, true); window.removeEventListener('deviceorientation', onOri, true); };
    return c;
  }

  /* ---------- push ---------- */
  const PUSH_WORKER = 'https://divine-tooth-9dc5.sultanyaghmor1544.workers.dev';
  function urlBase64ToUint8Array(b64) {
    const pad = '='.repeat((4 - b64.length % 4) % 4), raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/')), out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
    return out;
  }
  async function pushSub() {
    try { const reg = await navigator.serviceWorker.ready; return await reg.pushManager.getSubscription(); } catch (_) { return null; }
  }
  const currentPrefs = () => ({ fajr: prayOn('Fajr'), dhuhr: prayOn('Dhuhr'), asr: prayOn('Asr'), maghrib: prayOn('Maghrib'), isha: prayOn('Isha'), adhkarFajr: notifyOn('fajr'), adhkarAsr: notifyOn('asr'), iqamaBefore: iqBefore(), iqamaMin: { Fajr: iqMin('Fajr'), Dhuhr: iqMin('Dhuhr'), Asr: iqMin('Asr'), Maghrib: iqMin('Maghrib'), Isha: iqMin('Isha') } });
  async function syncPrefs() {
    const sub = await pushSub(); if (!sub) return;
    try { await fetch(PUSH_WORKER + '/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: sub.toJSON(), prefs: currentPrefs() }) }); } catch (_) {}
  }
  async function enablePush() {
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) { alert('هذا الجهاز لا يدعم إشعارات Push للموقع.'); return false; }
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') { notifyStatus.textContent = 'الإشعارات غير مفعّلة'; return false; }
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      const keyResponse = await fetch(PUSH_WORKER + '/vapid-public-key');
      if (!keyResponse.ok) throw new Error('تعذر جلب مفتاح الإشعارات');
      const publicKey = (await keyResponse.text()).trim();
      subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
    }
    const response = await fetch(PUSH_WORKER + '/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: subscription.toJSON(), prefs: currentPrefs() }) });
    if (!response.ok) throw new Error('تعذر حفظ اشتراك الإشعارات');
    notifyStatus.textContent = 'تم تفعيل الإشعارات ✅';
    return true;
  }
  notifyBtn.onclick = async () => {
    try { notifyBtn.disabled = true; notifyStatus.textContent = 'جاري تفعيل الإشعارات…'; await enablePush(); }
    catch (e) { console.error(e); notifyStatus.textContent = 'تعذر تفعيل الإشعارات — حاول مرة أخرى'; }
    finally { notifyBtn.disabled = false; }
  };

  /* ---------- settings ---------- */
  const modal = $('#settingsModal');
  $('#settingsBtn').onclick = () => { modal.classList.add('open'); modal.setAttribute('aria-hidden', 'false'); };
  const closeModal = () => { modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); };
  $('#closeSettings').onclick = closeModal;
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
  [['morningNotify', 'fajr'], ['eveningNotify', 'asr']].forEach(([id, type]) => {
    const box = $('#' + id); box.checked = notifyOn(type);
    box.addEventListener('change', () => { store.set('thakir-notify-' + type, box.checked ? '1' : '0'); syncPrefs(); });
  });

  /* ---------- go ---------- */
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
  sky().setMode(skyMode(), true);
  render();
  prayerTimes();
  syncPrefs();
})();
