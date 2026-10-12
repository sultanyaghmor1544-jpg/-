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
    storiesTab = $('#storiesTab'), storiesBox = $('#stories'),
    notifyBtn = $('#notifyBtn'), notifyStatus = $('#notifyStatus'), nextPrayer = $('#nextPrayer'),
    progressText = $('#progressText'), progressLabel = $('#progressLabel'), progressRing = $('.progress-ring'),
    welcome = $('#welcome'), toast = $('#toast');

  const savedMode = store.get('thakir-mode');
  let mode = savedMode === 'evening' || savedMode === 'stories' ? savedMode : 'morning';
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
    document.body.classList.remove('morning', 'evening', 'stories'); document.body.classList.add(mode);
    [[morningTab, 'morning'], [eveningTab, 'evening'], [storiesTab, 'stories']].forEach(([b, m]) => { b.classList.toggle('active', mode === m); b.setAttribute('aria-pressed', mode === m); });
    const isStories = mode === 'stories';
    $('#heroTitle').textContent = isStories ? 'تذكرة وعِبرة' : mode === 'morning' ? 'ابدأ صباحك بالذكر' : 'اختم يومك بالذكر';
    $('#greeting').textContent = isStories ? 'تذكّر' : mode === 'morning' ? 'صباح الخير' : 'مساء الخير';
    list.hidden = isStories; storiesBox.hidden = !isStories;
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
    c.appendChild(el('div', 'label', 'تحدّي التذكرة'));
    c.appendChild(el('div', 'text', 'اختر عدد الأسئلة وانظر كم تجيب'));
    const grid = el('div', 'rounds');
    ROUNDS.forEach(n => {
      const b = el('button', 'round-btn'); b.type = 'button';
      b.appendChild(el('b', '', String(n)));
      b.appendChild(el('span', '', 'أسئلة'));
      const best = store.get('best-' + n);
      b.appendChild(el('small', '', best !== null && best !== undefined ? 'أفضل: ' + best + '/' + n : 'لم تبدأ بعد'));
      b.onclick = () => startRound(n);
      grid.appendChild(b);
    });
    c.appendChild(grid);
    return c;
  }

  function startRound(n) {
    round = { n, i: 0, score: 0, qs: shuffle(POOL).slice(0, n), missed: [] };
    renderStories(); storiesBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function roundView() {
    const r = round;
    const wrap = document.createDocumentFragment();
    const head = el('div', 'rhead');
    head.appendChild(el('span', '', 'السؤال ' + (r.i + 1) + ' من ' + r.n));
    head.appendChild(el('span', '', 'الصحيح: ' + r.score));
    wrap.appendChild(head);
    const bar = el('div', 'rbar'); const fill = el('i'); fill.style.width = (r.i / r.n * 100) + '%'; bar.appendChild(fill); wrap.appendChild(bar);
    const s = r.qs[r.i];
    wrap.appendChild(questionCard(s, 'تذكرة · ' + s.cat, r.i + 1 < r.n ? 'السؤال التالي' : 'عرض النتيجة',
      good => { if (good) r.score++; else r.missed.push(s); head.lastChild.textContent = 'الصحيح: ' + r.score; fill.style.width = ((r.i + 1) / r.n * 100) + '%'; },
      () => { r.i++; renderStories(); window.scrollTo({ top: storiesBox.offsetTop - 10, behavior: 'smooth' }); }));
    const quit = el('button', 'linkbtn', 'إنهاء التحدي'); quit.type = 'button';
    quit.onclick = () => { round = null; renderStories(); };
    wrap.appendChild(quit);
    return wrap;
  }

  function resultView() {
    const r = round, pct = r.score / r.n;
    const prev = parseInt(store.get('best-' + r.n), 10);
    const isBest = isNaN(prev) || r.score > prev;
    if (isBest) store.set('best-' + r.n, String(r.score));
    if (pct >= .7) { sky().celebrate(); buzz([20, 40, 20]); }
    const c = el('article', 'zekr in quiz'); c.style.cursor = 'default';
    c.appendChild(el('div', 'label', 'نتيجتك'));
    c.appendChild(el('div', 'score', r.score + ' / ' + r.n));
    const bar = el('div', 'rbar'); const fill = el('i'); fill.style.width = (pct * 100) + '%'; bar.appendChild(fill); c.appendChild(bar);
    c.appendChild(el('div', 'text', pct >= .9 ? 'ما شاء الله، تذكّرت أغلب ما سألناك عنه' : pct >= .6 ? 'جيد، وراجع التذكرات أدناه لتثبّتها' : 'لا بأس، التكرار يثبّت المعلومة فأعد المحاولة'));
    if (isBest && r.score > 0) c.appendChild(el('div', 'ref', '✦ أفضل نتيجة لك في تحدّي ' + r.n + ' أسئلة'));
    if (r.missed.length) {
      c.appendChild(el('div', 'sec-title', 'تذكرات للمراجعة'));
      r.missed.forEach(s => {
        const m = el('div', 'missed');
        m.appendChild(el('div', 'mq', s.q)); m.appendChild(el('div', 'ma', s.ok)); m.appendChild(el('div', 'ref', s.note));
        c.appendChild(m);
      });
    }
    const again = el('button', 'mark', 'إعادة التحدي'); again.type = 'button'; again.onclick = () => startRound(r.n);
    const back = el('button', 'linkbtn', 'تغيير عدد الأسئلة'); back.type = 'button'; back.onclick = () => { round = null; renderStories(); };
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

  /* ---------- prayer times + in-page reminders ---------- */
  const timers = {};
  const notifyOn = type => store.get('thakir-notify-' + type) !== '0';
  async function showReminder(type) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const title = type === 'fajr' ? 'أذكار الصباح' : 'أذكار المساء';
    const body = type === 'fajr' ? 'حان وقت أذكار الصباح 🌅' : 'حان وقت أذكار المساء 🌙';
    try {
      const reg = navigator.serviceWorker && await navigator.serviceWorker.ready;
      if (reg && reg.showNotification) { await reg.showNotification(title, { body, icon: 'icon.png', badge: 'icon.png', dir: 'rtl', lang: 'ar' }); return; }
    } catch (_) {}
    try { new Notification(title, { body, icon: 'icon.png' }); } catch (_) {}
  }
  function scheduleInPage(type, time) {
    const [h, m] = String(time).slice(0, 5).split(':').map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return;
    const now = new Date(), target = new Date(); target.setHours(h, m, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);
    clearTimeout(timers[type]);
    timers[type] = setTimeout(() => { if (notifyOn(type)) showReminder(type); scheduleInPage(type, time); }, target - now);
  }
  function showTimes(t) {
    nextPrayer.textContent = `الفجر ${String(t.Fajr).slice(0, 5)}  •  العصر ${String(t.Asr).slice(0, 5)}`;
    scheduleInPage('fajr', t.Fajr); scheduleInPage('asr', t.Asr);
  }
  async function prayerTimes() {
    let cached = null; try { cached = JSON.parse(store.get('thakir-times') || 'null'); } catch (_) {}
    if (cached && cached.day === today()) { showTimes(cached); return; }
    try {
      const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 9000);
      const r = await fetch('https://api.aladhan.com/v1/timingsByCity?city=Jeddah&country=Saudi%20Arabia&method=4', { signal: ctl.signal });
      clearTimeout(to);
      const t = (await r.json()).data.timings;
      store.set('thakir-times', JSON.stringify({ day: today(), Fajr: t.Fajr, Asr: t.Asr }));
      showTimes(t);
    } catch (_) {
      if (cached) showTimes(cached);
      else nextPrayer.textContent = 'فعّل الإنترنت لحساب وقت الفجر والعصر في جدة';
    }
  }

  /* ---------- push ---------- */
  const PUSH_WORKER = 'https://divine-tooth-9dc5.sultanyaghmor1544.workers.dev';
  function urlBase64ToUint8Array(b64) {
    const pad = '='.repeat((4 - b64.length % 4) % 4), raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/')), out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
    return out;
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
    const response = await fetch(PUSH_WORKER + '/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(subscription) });
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
    box.addEventListener('change', () => store.set('thakir-notify-' + type, box.checked ? '1' : '0'));
  });

  /* ---------- go ---------- */
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
  sky().setMode(skyMode(), true);
  render();
  prayerTimes();
})();
