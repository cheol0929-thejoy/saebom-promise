// 새봄약속 — 개인 모드 (성도 각자 스마트폰)
(function () {
  const cfg = window.APP_CONFIG;
  const STORE_KEY = `saebom-promise-${cfg.YEAR}`; // { 이름: {no, at} }
  const CACHE_KEY = 'saebom-promise-verses';
  const PENDING_KEY = 'saebom-promise-pending'; // 보내지 못한 기록

  const $ = (sel) => document.querySelector(sel);
  const screens = ['start', 'draw', 'result'];
  let verses = [];
  let current = null; // { verse, name }

  // ---------- 저장소 (사생활 모드 등에서 실패해도 앱은 동작) ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 무시 */ } },
  };

  // ---------- CSV ----------
  function parseCSV(text) {
    const rows = []; let row = []; let f = ''; let q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"' && text[i + 1] === '"') { f += '"'; i++; }
        else if (c === '"') q = false;
        else f += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(f); f = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(f); rows.push(row); row = []; f = '';
      } else f += c;
    }
    if (f || row.length) { row.push(f); rows.push(row); }
    return rows.filter((r) => r.some((x) => x.trim() !== ''));
  }

  function toVerses(csv) {
    const rows = parseCSV(csv);
    const head = rows.shift().map((h) => h.trim());
    const col = (name) => head.indexOf(name);
    const iNo = col('번호'), iRef = col('장절'), iText = col('본문'),
      iTheme = col('주제'), iBless = col('축복 한 줄'), iUse = col('사용');
    if (iRef < 0 || iText < 0) throw new Error('시트 머리글(장절·본문)을 찾을 수 없습니다');
    return rows
      .filter((r) => iUse < 0 || (r[iUse] || '').trim().toUpperCase() === 'Y')
      .map((r) => ({
        no: Number(r[iNo]) || 0,
        ref: (r[iRef] || '').trim(),
        text: (r[iText] || '').trim(),
        theme: iTheme >= 0 ? (r[iTheme] || '').trim() : '',
        blessing: iBless >= 0 ? (r[iBless] || '').trim() : '',
      }))
      .filter((v) => v.ref && v.text);
  }

  async function loadVerses() {
    const url = `https://docs.google.com/spreadsheets/d/${cfg.SHEET_ID}/gviz/tq?tqx=out:csv&headers=1`
      + `&sheet=${encodeURIComponent(cfg.SHEET_TAB)}&range=A1:G`;
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(res.status);
      const list = toVerses(await res.text());
      if (list.length < 10) throw new Error('말씀 수가 너무 적음');
      store.set(CACHE_KEY, list);
      return list;
    } catch (e) {
      const cached = store.get(CACHE_KEY, null);
      if (cached && cached.length) return cached;
      const res = await fetch(cfg.SAMPLE_CSV);
      return toVerses(await res.text());
    }
  }

  // ---------- 뽑기 ----------
  function randomIndex(n) {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0] % n;
  }

  function normName(s) { return s.replace(/\s+/g, ' ').trim(); }

  function findDrawn(name) {
    const map = store.get(STORE_KEY, {});
    const hit = map[name];
    if (!hit) return null;
    return verses.find((v) => v.no === hit.no && hit.no) || hit.verse || null;
  }

  function saveDrawn(name, verse) {
    const map = store.get(STORE_KEY, {});
    map[name] = { no: verse.no, verse, at: new Date().toISOString() };
    store.set(STORE_KEY, map);
  }

  // ---------- 기록 전송 (4단계에서 LOG_URL을 채우면 동작) ----------
  async function sendLog(entry) {
    if (!cfg.LOG_URL) return;
    const pending = store.get(PENDING_KEY, []);
    pending.push(entry);
    store.set(PENDING_KEY, pending);
    await flushLogs();
  }

  async function flushLogs() {
    if (!cfg.LOG_URL) return;
    const pending = store.get(PENDING_KEY, []);
    const left = [];
    for (const e of pending) {
      try {
        await fetch(cfg.LOG_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(e),
        });
      } catch { left.push(e); }
    }
    store.set(PENDING_KEY, left);
  }

  // ---------- 화면 ----------
  function show(id) {
    for (const s of screens) $('#' + s).hidden = s !== id;
    window.scrollTo(0, 0);
  }

  function fillFront(verse, name) {
    $('#front-name').textContent = name ? `${name} 님께 주신 말씀` : '';
    $('#front-text').textContent = verse.text;
    $('#front-ref').textContent = verse.ref;
    $('#front-bless').textContent = verse.blessing || '';
  }

  function startDraw() {
    const name = normName($('#name').value);
    if (!name) { $('#name').focus(); $('#name-hint').hidden = false; return; }
    $('#name-hint').hidden = true;

    const already = findDrawn(name);
    if (already) { current = { verse: already, name }; showResult(true); return; }

    current = { verse: verses[randomIndex(verses.length)], name };
    fillFront(current.verse, name);
    $('#flip').classList.remove('flipped');
    $('#draw-name').textContent = name;
    show('draw');
  }

  function flipCard() {
    const card = $('#flip');
    if (card.classList.contains('flipped')) return;
    card.classList.add('flipped');
    if (navigator.vibrate) navigator.vibrate(30);
    saveDrawn(current.name, current.verse);
    sendLog({
      name: current.name, no: current.verse.no, ref: current.verse.ref,
      mode: 'personal', at: new Date().toISOString(), year: cfg.YEAR,
    });
    setTimeout(() => showResult(false), 1600);
  }

  async function showResult(again) {
    const { verse, name } = current;
    $('#again-note').hidden = !again;
    $('#result-name').textContent = `${name} 님께 주신 말씀`;
    $('#result-text').textContent = verse.text;
    $('#result-ref').textContent = verse.ref;
    $('#result-bless').textContent = verse.blessing || '';
    show('result');
  }

  async function makeImage(format) {
    const cv = await window.PromiseCard.render(current.verse, current.name, format);
    const blob = await window.PromiseCard.toBlob(cv);
    const fname = `${cfg.APP_NAME}_${cfg.YEAR}_${current.name}${format === 'story' ? '_배경화면' : ''}.png`;
    return new File([blob], fname, { type: 'image/png' });
  }

  function download(file) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = file.name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  async function busy(btn, fn) {
    const label = btn.textContent;
    btn.disabled = true; btn.textContent = '만드는 중…';
    try { await fn(); } finally { btn.disabled = false; btn.textContent = label; }
  }

  async function share() {
    const file = await makeImage('post');
    const text = `${cfg.YEAR} 약속의 말씀\n${current.verse.text}\n(${current.verse.ref})`;
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], text }); return; } catch (e) {
        if (e && e.name === 'AbortError') return;
      }
    }
    download(file);
    toast('이미지를 저장했습니다. 카카오톡에서 사진으로 보내 주세요.');
  }

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { t.hidden = true; }, 3500);
  }

  // ---------- 시작 ----------
  async function init() {
    document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = cfg.YEAR; });
    $('#name').value = ''; // 다른 사람이 같은 폰을 써도 이전 이름이 보이지 않게 비워 둡니다.

    $('#start-btn').disabled = true;
    try {
      verses = await loadVerses();
      $('#start-btn').disabled = false;
      $('#loading').hidden = true;
    } catch (e) {
      $('#loading').textContent = '말씀을 불러오지 못했습니다. 인터넷 연결을 확인하고 새로고침해 주세요.';
      return;
    }

    $('#start-form').addEventListener('submit', (e) => { e.preventDefault(); startDraw(); });
    $('#flip').addEventListener('click', flipCard);
    $('#flip').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flipCard(); }
    });
    $('#share-btn').addEventListener('click', (e) => busy(e.currentTarget, share));
    $('#save-btn').addEventListener('click', (e) => busy(e.currentTarget, async () => {
      download(await makeImage('post')); toast('사진첩(다운로드)에 저장했습니다.');
    }));
    $('#wall-btn').addEventListener('click', (e) => busy(e.currentTarget, async () => {
      download(await makeImage('story')); toast('배경화면용 이미지를 저장했습니다.');
    }));
    $('#other-btn').addEventListener('click', () => { $('#name').value = ''; show('start'); $('#name').focus(); });

    flushLogs();
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  // 테스트용으로 몇 가지를 밖에 노출
  window.SaebomApp = { parseCSV, toVerses };
  document.addEventListener('DOMContentLoaded', init);
})();
