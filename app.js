/* May I scorer — vanilla JS, no build step. State lives in localStorage. */
(function () {
  'use strict';

  const ROUNDS = 7;
  const ROUND_HINTS = [
    '2 sets',
    '1 set + 1 run',
    '2 runs',
    '3 sets',
    '2 sets + 1 run',
    '1 set + 2 runs',
    '3 runs',
  ];
  const STORE_GAME = 'mayi.game.v1';
  const STORE_HISTORY = 'mayi.history.v1';
  const STORE_NAMES = 'mayi.names.v1';

  const $ = (sel, root) => (root || document).querySelector(sel);
  const el = (tag, attrs, children) => {
    const node = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (k === 'class') node.className = attrs[k];
      else if (k === 'text') node.textContent = attrs[k];
      else if (k === 'html') node.innerHTML = attrs[k];
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), attrs[k]);
      else node.setAttribute(k, attrs[k]);
    }
    (children || []).forEach(c => c && node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
    return node;
  };

  function load(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch (e) { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignore */ }
  }

  let game = load(STORE_GAME, null);
  let view = game ? 'game' : 'setup';

  // ---------- helpers ----------
  const totals = g => g.players.map((_, p) => g.scores.reduce((s, r) => s + (r[p] == null ? 0 : r[p]), 0));
  const roundComplete = (g, r) => g.scores[r].every(v => v != null);
  const currentRound = g => { for (let r = 0; r < ROUNDS; r++) if (!roundComplete(g, r)) return r; return ROUNDS; };
  const isFinished = g => currentRound(g) >= ROUNDS;
  const nextCell = g => {
    const r = currentRound(g);
    if (r >= ROUNDS) return null;
    const p = g.scores[r].findIndex(v => v == null);
    return { r, p };
  };
  function ranking(g) {
    const t = totals(g);
    return g.players.map((name, i) => ({ name, i, total: t[i] })).sort((a, b) => a.total - b.total);
  }

  let toastTimer;
  function toast(msg) {
    let t = $('.toast');
    if (!t) { t = el('div', { class: 'toast' }); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
  }

  // ---------- rendering ----------
  const app = $('#app');
  function render() {
    app.innerHTML = '';
    if (view === 'setup') renderSetup();
    else if (view === 'history') renderHistory();
    else renderGame();
  }

  function renderSetup() {
    const tpl = $('#tpl-setup').content.cloneNode(true);
    app.appendChild(tpl);
    const list = $('#player-list');
    const names = load(STORE_NAMES, ['', '']);
    const addRow = (name) => {
      const row = el('div', { class: 'player-row' }, [
        el('input', { type: 'text', placeholder: 'Player ' + (list.children.length + 1), value: name || '', maxlength: '16', autocomplete: 'off' }),
        el('button', { class: 'remove', 'aria-label': 'Remove', text: '✕', onclick: () => { if (list.children.length > 2) { row.remove(); refresh(); } } }),
      ]);
      list.appendChild(row);
      refresh();
    };
    const refresh = () => {
      [...list.querySelectorAll('input')].forEach((inp, i) => inp.placeholder = 'Player ' + (i + 1));
      $('#add-player').disabled = list.children.length >= 8;
    };
    (names.length >= 2 ? names : ['', '']).forEach(addRow);
    $('#add-player').onclick = () => { addRow(''); list.lastChild.querySelector('input').focus(); };
    $('#start-game').onclick = () => {
      const players = [...list.querySelectorAll('input')].map((inp, i) => inp.value.trim() || ('Player ' + (i + 1)));
      save(STORE_NAMES, players);
      game = {
        id: Date.now(),
        started: new Date().toISOString(),
        players,
        scores: Array.from({ length: ROUNDS }, () => players.map(() => null)),
      };
      save(STORE_GAME, game);
      view = 'game';
      render();
    };
  }

  function renderGame() {
    const g = game;
    const t = totals(g);
    const rank = ranking(g);
    const finished = isFinished(g);
    const next = nextCell(g);

    if (finished) {
      const w = rank[0];
      const tied = rank.filter(r => r.total === w.total);
      app.appendChild(el('div', { class: 'winner-banner' }, [
        el('div', { class: 'trophy', text: '🏆' }),
        el('h2', { text: tied.length > 1 ? tied.map(x => x.name).join(' & ') + ' tie' : w.name + ' wins' }),
        el('div', { class: 'muted', text: 'with ' + w.total + ' points' }),
      ]));
    }

    // Standings
    const standings = el('div', { class: 'standings' });
    rank.forEach((r, idx) => {
      standings.appendChild(el('div', { class: 'standing' + (idx === 0 ? ' leader' : '') }, [
        el('span', { class: 'rank', text: (idx + 1) + '.' }),
        el('span', { class: 'name', text: r.name }),
        el('span', { class: 'pts', text: String(r.total) }),
      ]));
    });
    app.appendChild(el('section', { class: 'card' }, [
      el('h2', { text: finished ? 'Final standings' : 'Standings after ' + currentRound(g) + ' of ' + ROUNDS + ' rounds' }),
      standings,
    ]));

    // Grid
    const table = el('table', { class: 'grid' });
    const thead = el('thead', null, [el('tr', null, [el('th', { text: 'Round' }), ...g.players.map(p => el('th', { text: p }))])]);
    table.appendChild(thead);
    const tbody = el('tbody');
    for (let r = 0; r < ROUNDS; r++) {
      const tr = el('tr', { class: next && next.r === r ? 'current' : '' });
      tr.appendChild(el('td', { class: 'round-label', html: (r + 1) + '<small>' + ROUND_HINTS[r] + '</small>' }));
      g.players.forEach((_, p) => {
        const v = g.scores[r][p];
        const isNext = next && next.r === r && next.p === p;
        const btn = el('button', {
          class: v == null ? (isNext ? 'next' : 'empty') : '',
          text: v == null ? (isNext ? '+' : '·') : String(v),
          onclick: () => openSheet(r, p),
        });
        tr.appendChild(el('td', { class: 'cell' }, [btn]));
      });
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    table.appendChild(el('tfoot', null, [el('tr', null, [el('td', { text: 'Total' }), ...t.map(v => el('td', { text: String(v) }))])]));
    app.appendChild(el('section', { class: 'card' }, [
      el('h2', { text: 'Score sheet' }),
      el('p', { class: 'muted small', text: 'Tap any cell to enter or change a score.' }),
      el('div', { class: 'grid-wrap' }, [table]),
    ]));

    // Actions
    const actions = el('div', { class: 'row-actions' }, [
      el('button', { class: 'btn btn-secondary', text: 'Rematch', onclick: () => { finishGame(); startRematch(); } }),
      el('button', { class: finished ? 'btn btn-primary' : 'btn btn-danger', text: finished ? 'Save & close' : 'Abandon game', onclick: () => {
        if (!finished && !confirm('Abandon this game? Scores will be kept in history.')) return;
        finishGame(); view = 'setup'; render();
      } }),
    ]);
    app.appendChild(el('section', { class: 'card' }, [actions]));

    if (next) {
      const n = next;
      app.appendChild(el('button', { class: 'btn btn-primary', text: 'Enter ' + g.players[n.p] + "'s round " + (n.r + 1) + ' score', onclick: () => openSheet(n.r, n.p) }));
    }
  }

  function finishGame() {
    if (!game) return;
    const any = game.scores.some(r => r.some(v => v != null));
    if (any) {
      const hist = load(STORE_HISTORY, []);
      hist.unshift({ ...game, ended: new Date().toISOString(), finished: isFinished(game) });
      save(STORE_HISTORY, hist.slice(0, 50));
    }
    game = null;
    try { localStorage.removeItem(STORE_GAME); } catch (e) { /* ignore */ }
  }

  function startRematch() {
    const players = load(STORE_NAMES, ['Player 1', 'Player 2']);
    game = {
      id: Date.now(), started: new Date().toISOString(), players,
      scores: Array.from({ length: ROUNDS }, () => players.map(() => null)),
    };
    save(STORE_GAME, game);
    view = 'game'; render();
  }

  function renderHistory() {
    const hist = load(STORE_HISTORY, []);
    const card = el('section', { class: 'card' }, [el('h2', { text: 'Past games' })]);
    if (!hist.length) card.appendChild(el('p', { class: 'muted', text: 'No games saved yet.' }));
    hist.forEach((h, idx) => {
      const r = ranking(h);
      const when = new Date(h.ended || h.started).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' });
      const summary = r.map(x => x.name + ' ' + x.total).join(' · ');
      card.appendChild(el('div', { class: 'history-item' }, [
        el('div', null, [
          el('div', { class: 'who', text: (h.finished ? '🏆 ' + r[0].name : 'Unfinished') }),
          el('div', { class: 'small', text: summary }),
          el('div', { class: 'when', text: when }),
        ]),
        el('button', { class: 'del', 'aria-label': 'Delete', text: '🗑', onclick: () => {
          if (!confirm('Delete this game from history?')) return;
          hist.splice(idx, 1); save(STORE_HISTORY, hist); render();
        } }),
      ]));
    });
    app.appendChild(card);
    app.appendChild(el('button', { class: 'btn btn-secondary', text: game ? 'Back to game' : 'Back', onclick: () => { view = game ? 'game' : 'setup'; render(); } }));
  }

  // ---------- score sheet ----------
  const sheet = $('#sheet');
  let sheetCell = null;
  let tally = [];
  const manual = $('#manual');

  function tallyTotal() { return tally.reduce((s, c) => s + c.value, 0); }
  function currentValue() {
    const m = manual.value.trim();
    if (m !== '' && tally.length === 0) return Math.max(0, parseInt(m, 10) || 0);
    return tallyTotal();
  }
  function updateSheet() {
    $('#sheet-total').textContent = String(currentValue());
    const box = $('#tally');
    box.innerHTML = '';
    tally.forEach(c => box.appendChild(el('span', { class: 'chip ' + (c.label === 'A' ? 'ace' : c.label === 'Joker' ? 'joker' : ''), text: c.label })));
    if (!tally.length) box.appendChild(el('span', { class: 'muted small', text: 'Tap the cards left in the hand, or type a total.' }));
  }
  function openSheet(r, p) {
    sheetCell = { r, p };
    const existing = game.scores[r][p];
    tally = [];
    manual.value = existing == null ? '' : String(existing);
    $('#sheet-title').textContent = game.players[p] + ' — round ' + (r + 1);
    $('#sheet-sub').textContent = ROUND_HINTS[r] + (existing == null ? '' : ' · currently ' + existing);
    updateSheet();
    sheet.classList.remove('hidden');
  }
  function closeSheet() { sheet.classList.add('hidden'); sheetCell = null; }
  function saveSheet(value) {
    if (!sheetCell || !game) return;
    const { r, p } = sheetCell;
    game.scores[r][p] = value;
    save(STORE_GAME, game);
    closeSheet();
    render();
    if (isFinished(game)) {
      toast('Game over — ' + ranking(game)[0].name + ' wins');
    } else {
      const n = nextCell(game);
      if (n && n.r === r + 1 && n.p === 0) toast('Round ' + (r + 1) + ' done');
    }
  }

  sheet.querySelectorAll('.key[data-add]').forEach(btn => {
    btn.addEventListener('click', () => {
      tally.push({ value: parseInt(btn.dataset.add, 10), label: btn.dataset.label || btn.dataset.add });
      manual.value = '';
      updateSheet();
    });
  });
  $('#key-undo').onclick = () => { tally.pop(); updateSheet(); };
  manual.addEventListener('input', () => { tally = []; updateSheet(); });
  manual.addEventListener('keydown', e => { if (e.key === 'Enter') saveSheet(currentValue()); });
  $('#sheet-zero').onclick = () => saveSheet(0);
  $('#sheet-save').onclick = () => saveSheet(currentValue());
  $('#sheet-close').onclick = closeSheet;
  $('.sheet-backdrop').onclick = closeSheet;

  // ---------- top bar ----------
  $('#btn-new').onclick = () => {
    if (game && !isFinished(game) && !confirm('Start a new game? The current one will be saved to history as unfinished.')) return;
    finishGame(); view = 'setup'; render();
  };
  $('#btn-history').onclick = () => { view = view === 'history' ? (game ? 'game' : 'setup') : 'history'; render(); };

  render();

  // ---------- service worker ----------
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
