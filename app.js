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
  const STORE_ENTRY = 'mayi.entry.v1';

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
  // The next player after p, wrapping round, with no score yet this round.
  const nextEmptyInRound = (g, r, p) => {
    const n = g.players.length;
    for (let i = 1; i < n; i++) if (g.scores[r][(p + i) % n] == null) return (p + i) % n;
    return null;
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
    // Return on the phone keyboard moves to the next name; on the last one it closes the keyboard.
    const onNameKey = e => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const inputs = [...list.querySelectorAll('input')];
      const following = inputs[inputs.indexOf(e.target) + 1];
      if (following) following.focus(); else e.target.blur();
    };
    const addRow = (name) => {
      const row = el('div', { class: 'player-row' }, [
        el('input', {
          type: 'text', placeholder: 'Player ' + (list.children.length + 1), value: name || '', maxlength: '16',
          autocomplete: 'off', autocapitalize: 'words', autocorrect: 'off', spellcheck: 'false', onkeydown: onNameKey,
        }),
        el('button', { class: 'remove', 'aria-label': 'Remove', text: '✕', onclick: () => { if (list.children.length > 2) { row.remove(); refresh(); } } }),
      ]);
      list.appendChild(row);
      refresh();
    };
    const refresh = () => {
      const inputs = [...list.querySelectorAll('input')];
      inputs.forEach((inp, i) => {
        inp.placeholder = 'Player ' + (i + 1);
        inp.setAttribute('enterkeyhint', i === inputs.length - 1 ? 'done' : 'next');
      });
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
      app.appendChild(el('div', { class: 'dock' }, [
        el('button', { class: 'btn btn-primary', text: 'Enter ' + g.players[n.p] + "'s round " + (n.r + 1) + ' score', onclick: () => openSheet(n.r, n.p) }),
      ]));
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
  const panel = $('.sheet-panel', sheet);
  const saveBtn = $('#sheet-save');
  let sheetCell = null;
  let sheetNext = null;   // player whose sheet opens after this one is saved, if any
  let openedAt = 0;
  let mode = load(STORE_ENTRY, 'cards') === 'total' ? 'total' : 'cards';
  let tally = [];
  let typed = '';         // digits typed in total mode, or the score being edited
  let typedFresh = false; // true while `typed` holds the score being edited: the next digit replaces it

  // A second tap on Save or "Went out" can land on the next player's sheet; ignore taps that soon after it opens.
  const settled = () => performance.now() - openedAt > 350;
  const hasEntry = () => tally.length > 0 || typed !== '';
  function tallyTotal() { return tally.reduce((s, c) => s + c.value, 0); }
  function currentValue() {
    if (tally.length) return tallyTotal();
    return typed === '' ? 0 : parseInt(typed, 10);
  }
  function updateSheet() {
    $('#sheet-total').textContent = String(currentValue());
    sheet.querySelectorAll('.mode-btn').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
    $('#pad-cards').classList.toggle('hidden', mode !== 'cards');
    $('#pad-total').classList.toggle('hidden', mode !== 'total');
    const box = $('#tally');
    box.innerHTML = '';
    tally.forEach(c => box.appendChild(el('span', { class: 'chip ' + (c.label === 'A' ? 'ace' : c.label === 'Joker' ? 'joker' : ''), text: c.label })));
    if (!tally.length) box.appendChild(el('span', { class: 'muted small', text: mode === 'cards' ? 'Tap the cards left in the hand.' : 'Type the hand total.' }));
    saveBtn.disabled = !hasEntry();
    saveBtn.textContent = sheetNext == null ? 'Save' : 'Save & next';
  }
  function openSheet(r, p) {
    const advancing = !sheet.classList.contains('hidden');
    sheetCell = { r, p };
    const existing = game.scores[r][p];
    sheetNext = existing == null ? nextEmptyInRound(game, r, p) : null;
    tally = [];
    typed = existing == null ? '' : String(existing);
    typedFresh = existing != null;
    $('#sheet-title').textContent = game.players[p] + ' — round ' + (r + 1);
    $('#sheet-sub').textContent = ROUND_HINTS[r] + (existing == null ? '' : ' · currently ' + existing);
    updateSheet();
    sheet.classList.remove('hidden');
    document.body.classList.add('sheet-open');
    if (advancing) { panel.classList.remove('advance'); void panel.offsetWidth; panel.classList.add('advance'); }
    openedAt = performance.now();
  }
  function closeSheet() {
    sheet.classList.add('hidden');
    document.body.classList.remove('sheet-open');
    panel.classList.remove('advance');
    sheetCell = null;
  }
  function saveSheet(value) {
    if (!sheetCell || !game) return;
    const { r, p } = sheetCell;
    const following = sheetNext;
    const wasEmpty = game.scores[r][p] == null;
    game.scores[r][p] = value;
    save(STORE_GAME, game);
    render();
    if (following != null) {
      openSheet(r, following);
      toast(game.players[p] + ': ' + value);
      return;
    }
    closeSheet();
    if (isFinished(game)) {
      toast('Game over — ' + ranking(game)[0].name + ' wins');
    } else if (wasEmpty && roundComplete(game, r)) {
      toast('Round ' + (r + 1) + ' done');
    }
  }
  function setMode(m) {
    mode = m;
    save(STORE_ENTRY, m);
    updateSheet();
  }
  function addCard(value, label) {
    tally.push({ value, label });
    typed = ''; typedFresh = false;
    updateSheet();
  }
  function typeDigit(d) {
    tally = [];
    if (typedFresh) { typed = ''; typedFresh = false; }
    if (typed.length < 4) typed = typed === '0' ? d : typed + d;
    updateSheet();
  }
  function backspace() {
    if (mode === 'cards' || tally.length) tally.pop();
    else { typed = typed.slice(0, -1); typedFresh = false; }
    updateSheet();
  }
  function clearEntry() { tally = []; typed = ''; typedFresh = false; updateSheet(); }
  function trySave() { if (settled() && hasEntry()) saveSheet(currentValue()); }

  sheet.querySelectorAll('.key[data-add]').forEach(btn => {
    btn.addEventListener('click', () => addCard(parseInt(btn.dataset.add, 10), btn.dataset.label || btn.dataset.add));
  });
  sheet.querySelectorAll('.key[data-digit]').forEach(btn => btn.addEventListener('click', () => typeDigit(btn.dataset.digit)));
  sheet.querySelectorAll('.key[data-clear]').forEach(btn => btn.addEventListener('click', clearEntry));
  sheet.querySelectorAll('.mode-btn').forEach(btn => btn.addEventListener('click', () => setMode(btn.dataset.mode)));
  $('#key-undo').onclick = backspace;
  $('#key-back').onclick = backspace;
  $('#sheet-zero').onclick = () => { if (settled()) saveSheet(0); };
  saveBtn.onclick = trySave;
  $('#sheet-close').onclick = closeSheet;
  $('.sheet-backdrop').onclick = () => { if (settled()) closeSheet(); };

  // Physical keyboards still work: digits type a total, Backspace, Enter saves, Escape closes.
  document.addEventListener('keydown', e => {
    if (sheet.classList.contains('hidden') || e.ctrlKey || e.metaKey || e.altKey) return;
    if (/^[0-9]$/.test(e.key)) { if (mode !== 'total') setMode('total'); typeDigit(e.key); }
    else if (e.key === 'Backspace') backspace();
    else if (e.key === 'Enter') trySave();
    else if (e.key === 'Escape') closeSheet();
    else return;
    e.preventDefault();
  });

  // ---------- top bar ----------
  $('#btn-new').onclick = () => {
    if (game && !isFinished(game) && !confirm('Start a new game? The current one will be saved to history as unfinished.')) return;
    finishGame(); view = 'setup'; render();
  };
  $('#btn-history').onclick = () => { view = view === 'history' ? (game ? 'game' : 'setup') : 'history'; render(); };

  // iOS Safari only shows :active press feedback when a touch listener exists.
  document.addEventListener('touchstart', () => {}, { passive: true });

  render();

  // ---------- service worker ----------
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
