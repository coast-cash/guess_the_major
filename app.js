// Golf Guessr — game logic

const MAX_GUESSES = 4;
const ROUND_DAYS  = ['Thursday', 'Friday', 'Saturday', 'Sunday'];
const ROUND_SHORT = ['THU', 'FRI', 'SAT', 'SUN'];

const tournamentDisplay = document.getElementById('tournament-display');
const roundIndicator    = document.getElementById('round-indicator');
const hintsArea         = document.getElementById('hints-area');
const inputArea         = document.getElementById('input-area');
const guessInput        = document.getElementById('guess-input');
const submitBtn         = document.getElementById('submit-btn');
const feedback          = document.getElementById('feedback');
const resultCard        = document.getElementById('result-card');
const resultStatus      = document.getElementById('result-status');
const winnerImg         = document.getElementById('winner-img');
const winnerName        = document.getElementById('winner-name');
const winnerMeta        = document.getElementById('winner-meta');
const shareBtn          = document.getElementById('share-btn');
const nextBtn           = document.getElementById('next-btn');
const autocompleteList  = document.getElementById('autocomplete-list');
const shareToast        = document.getElementById('share-toast');
const scorecardEl       = document.getElementById('scorecard');

// All unique golfer names for autocomplete
const ALL_WINNERS = [...new Set(TOURNAMENT_DATA.map(d => d.winner))].sort();

// Pre-compute each winner's major counts
const MAJORS_BY_PLAYER = {};
for (const entry of TOURNAMENT_DATA) {
  if (!MAJORS_BY_PLAYER[entry.winner]) MAJORS_BY_PLAYER[entry.winner] = { total: 0 };
  MAJORS_BY_PLAYER[entry.winner].total++;
  MAJORS_BY_PLAYER[entry.winner][entry.tournament] =
    (MAJORS_BY_PLAYER[entry.winner][entry.tournament] || 0) + 1;
}

const TOURNAMENT_ORDER = ['The Masters', 'U.S. Open', 'The Open', 'PGA Championship'];

function majorsSummary(winner) {
  const stats = MAJORS_BY_PLAYER[winner];
  if (!stats) return null;
  const breakdown = TOURNAMENT_ORDER
    .filter(t => stats[t])
    .map(t => `${stats[t]} ${t}`)
    .join(', ');
  return `${stats.total} major${stats.total !== 1 ? 's' : ''}: ${breakdown}`;
}

let current      = null;
let guessHistory = []; // [{ guess: 'Tiger Woods', correct: false }, ...]
let gameOver     = false;
let shareText    = '';
let acIndex      = -1;

function tournamentLabel(entry) {
  return `${entry.year} ${entry.tournament}`;
}

function pickRandom() {
  return TOURNAMENT_DATA[Math.floor(Math.random() * TOURNAMENT_DATA.length)];
}

function normalize(str) {
  return str.trim().toLowerCase();
}

// ── Scorecard ────────────────────────────────────────────

function renderScorecard() {
  scorecardEl.innerHTML = '';

  for (let i = 0; i < MAX_GUESSES; i++) {
    const entry = guessHistory[i];
    let state;
    if (entry) {
      state = entry.correct ? 'correct' : 'wrong';
    } else if (i === guessHistory.length && !gameOver) {
      state = 'active';
    } else {
      state = 'pending';
    }

    const row = document.createElement('div');
    row.className = 'round-row';
    row.dataset.state = state;

    let guessText = '';
    let icon = '';
    if (state === 'correct') { guessText = entry.guess; icon = '✓'; }
    else if (state === 'wrong')   { guessText = entry.guess; icon = '✗'; }
    else if (state === 'active')  { guessText = 'Your guess…'; icon = ''; }
    else                          { guessText = '—'; icon = '·'; }

    row.innerHTML = `
      <span class="round-num">${i + 1}</span>
      <span class="round-day">${ROUND_SHORT[i]}</span>
      <span class="round-guess">${guessText}</span>
      <span class="round-icon">${icon}</span>
    `;

    scorecardEl.appendChild(row);
  }
}

function updateRoundIndicator() {
  if (gameOver) return;
  const r = guessHistory.length; // 0-based index of current round
  roundIndicator.textContent = `Round ${r + 1} · ${ROUND_DAYS[r]}`;
}

// ── Hints ────────────────────────────────────────────────

function addHint(icon, text) {
  const pill = document.createElement('div');
  pill.className = 'hint-pill';
  pill.textContent = `${icon}  ${text}`;
  hintsArea.appendChild(pill);
}

// ── Feedback ─────────────────────────────────────────────

function showFeedback(message, type) {
  feedback.textContent = message;
  feedback.className = `feedback ${type}`;
  feedback.classList.remove('hidden');
}

function hideFeedback() {
  feedback.classList.add('hidden');
}

// ── Local player images ───────────────────────────────────

function playerImageSrc(name) {
  // "J.H. Taylor" → "j_h_taylor.png", "Mark O'Meara" → "mark_o_meara.png"
  const file = name
    .toLowerCase()
    .replace(/[.']/g, '_')   // dots and apostrophes become underscores
    .replace(/\s+/g, '_')    // spaces become underscores
    .replace(/_+/g, '_')     // collapse consecutive underscores
    .replace(/_$/, '');      // strip trailing underscore
  return `golfers/${file}.png`;
}

function showPlaceholderAvatar() {
  const existing = document.querySelector('.winner-img-placeholder');
  if (existing) existing.remove();
  const div = document.createElement('div');
  div.className = 'winner-img-placeholder';
  div.textContent = '🏌️';
  winnerImg.parentNode.insertBefore(div, winnerImg);
  winnerImg.classList.add('hidden');
}

// ── Result ────────────────────────────────────────────────

function showResult(won) {
  hideFeedback();
  resultCard.classList.remove('hidden');

  // Scroll result into view on mobile
  setTimeout(() => resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80);

  if (won) {
    resultStatus.textContent = '✅ Correct!';
    resultStatus.className = 'result-status correct';
  } else {
    resultStatus.textContent = 'The winner was…';
    resultStatus.className = 'result-status reveal';
  }

  winnerName.textContent = current.winner;
  winnerMeta.textContent = `${current.course} · ${current.country}`;

  winnerImg.src = playerImageSrc(current.winner);
  winnerImg.alt = current.winner;
  winnerImg.onload  = () => winnerImg.classList.remove('hidden');
  winnerImg.onerror = () => { winnerImg.classList.add('hidden'); showPlaceholderAvatar(); };

  // Share text — emoji grid from scorecard
  const dots = guessHistory.map(e => e.correct ? '🟢' : '🔴');
  while (dots.length < MAX_GUESSES) dots.push('⚪');
  shareText = `⛳ Golf Guessr\n${tournamentLabel(current)}\n${dots.join('')}\n\nPlay at: golf-guessr.app`;
}

// ── Start / reset ─────────────────────────────────────────

function startGame() {
  current      = pickRandom();
  guessHistory = [];
  gameOver     = false;
  shareText    = '';
  acIndex      = -1;

  tournamentDisplay.textContent = tournamentLabel(current);
  hintsArea.innerHTML = '';
  hideFeedback();
  resultCard.classList.add('hidden');
  inputArea.classList.remove('hidden');
  guessInput.value = '';
  submitBtn.disabled = false;
  autocompleteList.classList.add('hidden');

  const placeholder = document.querySelector('.winner-img-placeholder');
  if (placeholder) placeholder.remove();
  winnerImg.onload  = null;
  winnerImg.onerror = null;
  winnerImg.src = '';
  winnerImg.classList.add('hidden');

  renderScorecard();
  updateRoundIndicator();
  guessInput.focus();
}

// ── Handle guess ──────────────────────────────────────────

function handleGuess() {
  if (gameOver) return;
  const raw = guessInput.value.trim();
  if (!raw) return;

  autocompleteList.classList.add('hidden');
  guessInput.value = '';

  const correct = normalize(raw) === normalize(current.winner);
  guessHistory.push({ guess: raw, correct });
  renderScorecard();

  if (correct) {
    gameOver = true;
    showResult(true);
    return;
  }

  if (guessHistory.length === MAX_GUESSES) {
    gameOver = true;
    showResult(false);
    return;
  }

  // Reveal hints progressively after each wrong guess
  const wrongCount = guessHistory.length;

  if (wrongCount === 1) {
    showFeedback('Not quite — keep going!', 'wrong');
    if (current.tournament === 'The Masters') {
      const prev = TOURNAMENT_DATA.find(
        d => d.tournament === 'The Masters' && d.year === current.year - 1
      );
      addHint('🏅', prev
        ? `Prior year winner: ${prev.winner} (${prev.year})`
        : 'First ever Masters — no prior winner'
      );
    } else {
      addHint('📍', `Course: ${current.course}`);
    }
  } else if (wrongCount === 2) {
    showFeedback('Incorrect — one more hint coming…', 'wrong');
    addHint('🌍', `Country: ${current.country}`);
  } else if (wrongCount === 3) {
    showFeedback('Last chance!', 'wrong');
    const summary = majorsSummary(current.winner);
    if (summary) addHint('🏆', summary);
  }

  updateRoundIndicator();
  guessInput.focus();
}

// ── Autocomplete ──────────────────────────────────────────

guessInput.addEventListener('input', () => {
  const val = guessInput.value.trim().toLowerCase();
  acIndex = -1;
  if (!val) { autocompleteList.classList.add('hidden'); return; }

  const matches = ALL_WINNERS.filter(w => w.toLowerCase().includes(val)).slice(0, 8);
  if (!matches.length) { autocompleteList.classList.add('hidden'); return; }

  autocompleteList.innerHTML = '';
  matches.forEach((name) => {
    const li = document.createElement('li');
    li.textContent = name;
    li.addEventListener('mousedown', e => {
      e.preventDefault();
      guessInput.value = name;
      autocompleteList.classList.add('hidden');
    });
    autocompleteList.appendChild(li);
  });
  autocompleteList.classList.remove('hidden');
});

guessInput.addEventListener('keydown', e => {
  const items = autocompleteList.querySelectorAll('li');
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    acIndex = Math.min(acIndex + 1, items.length - 1);
    items.forEach((li, i) => li.classList.toggle('active', i === acIndex));
    if (items[acIndex]) guessInput.value = items[acIndex].textContent;
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    acIndex = Math.max(acIndex - 1, -1);
    items.forEach((li, i) => li.classList.toggle('active', i === acIndex));
    if (acIndex >= 0 && items[acIndex]) guessInput.value = items[acIndex].textContent;
  } else if (e.key === 'Escape') {
    autocompleteList.classList.add('hidden');
  } else if (e.key === 'Enter') {
    autocompleteList.classList.add('hidden');
    handleGuess();
  }
});

document.addEventListener('click', e => {
  if (!autocompleteList.contains(e.target) && e.target !== guessInput) {
    autocompleteList.classList.add('hidden');
  }
});

submitBtn.addEventListener('click', handleGuess);

shareBtn.addEventListener('click', () => {
  const copy = () => {
    shareToast.classList.remove('hidden');
    setTimeout(() => shareToast.classList.add('hidden'), 2200);
  };
  navigator.clipboard.writeText(shareText).then(copy).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = shareText;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    copy();
  });
});

nextBtn.addEventListener('click', startGame);

startGame();
