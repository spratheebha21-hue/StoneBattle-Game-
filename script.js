"use strict";

const STARTING_STONES = 15;
const MAX_REMOVAL = 3;
const MEDIUM_SEARCH_DEPTH = 4;

const STATISTICS_KEY = "stoneBattleStats";
const HISTORY_KEY = "stoneBattleHistory";
const SETTINGS_KEY = "stoneBattleSettings";

const DEFAULT_STATISTICS = {
  gamesPlayed: 0,
  wins: 0,
  losses: 0,
  draws: 0,
  aiGames: 0,
  aiWins: 0,
  aiLosses: 0,
  twoPlayerGames: 0,
  currentStreak: 0,
  bestStreak: 0
};

let startingStones = STARTING_STONES;
let maximumRemoval = MAX_REMOVAL;
let stones = startingStones;

let currentPlayer = 1;
let gameMode = "";
let gameOver = false;
let aiThinking = false;
let aiTimer = null;

let aiDifficulty = "medium";
let nextAIStarter = 1;

/* =========================================================
   TIMER
   0  = No Timer
   15 = 15 seconds
   30 = 30 seconds
   60 = 1 minute
========================================================= */

let turnTimeLimit = 0;
let turnSecondsRemaining = 0;
let turnDeadline = 0;
let turnTimerInterval = null;
let turnTimerPlayer = 0;

let statistics = loadStatistics();
let matchHistory = loadMatchHistory();

let currentAnalysis = null;
let displayedStones = null;

/* =========================================================
   DOM ELEMENTS
========================================================= */

const elements = {
  menuScreen: document.querySelector("#menu-screen"),
  gameScreen: document.querySelector("#game-screen"),
  headerMenu: document.querySelector("#header-menu"),
  modeHeading: document.querySelector("#mode-heading"),

  playerOneCard: document.querySelector("#player-one-card"),
  playerTwoCard: document.querySelector("#player-two-card"),

  playerOneName: document.querySelector("#player-one-name"),
  playerTwoName: document.querySelector("#player-two-name"),

  playerOneCaption: document.querySelector("#player-one-caption"),
  playerTwoCaption: document.querySelector("#player-two-caption"),

  playerOneSymbol: document.querySelector("#player-one-symbol"),
  playerTwoSymbol: document.querySelector("#player-two-symbol"),

  playerOneState: document.querySelector("#player-one-state"),
  playerTwoState: document.querySelector("#player-two-state"),

  stoneCount: document.querySelector("#stone-count"),
  stonePile: document.querySelector("#stone-pile"),

  progressValue: document.querySelector("#progress-value"),
  progressTrack: document.querySelector(".progress-track"),
  progressFill: document.querySelector("#progress-fill"),

  moveControls: document.querySelector("#move-controls"),

  turnBanner: document.querySelector("#turn-banner"),
  turnMessage: document.querySelector("#turn-message"),
  turnClock: document.querySelector("#turn-clock"),
  playPrompt: document.querySelector("#play-prompt"),

  aiInfo: document.querySelector("#ai-info"),
  aiDetail: document.querySelector("#ai-detail"),

  moveFeedback: document.querySelector("#move-feedback"),

  winnerOverlay: document.querySelector("#winner-overlay"),
  winnerName: document.querySelector("#winner-name"),

  difficultyPicker: document.querySelector("#difficulty-picker"),
  battleIntro: document.querySelector("#battle-intro"),

  startingStonesInput:
    document.querySelector("#starting-stones-input"),

  maxRemovalInput:
    document.querySelector("#max-removal-input"),

  aiDifficultyLabel:
    document.querySelector("#ai-difficulty-label"),

  aiTools:
    document.querySelector("#ai-tools"),

  analysisSummary:
    document.querySelector("#analysis-summary"),

  featureDialog:
    document.querySelector("#feature-dialog"),

  dialogContent:
    document.querySelector("#dialog-content")
};

/* =========================================================
   MINIMAX
========================================================= */

/*
 * Minimax returns a score from the AI's perspective.
 *
 * +1 = AI wins
 * -1 = AI loses
 *  0 = depth-limited neutral
 *
 * maximizingPlayer = true
 *     AI's turn
 *
 * maximizingPlayer = false
 *     Human/opponent's turn
 */

function minimax(
  remainingStones,
  maximizingPlayer,
  depth = Infinity,
  metrics = { statesEvaluated: 0 }
) {
  if (!metrics.memo) {
    metrics.memo = new Map();
  }

  const stateKey =
    `${remainingStones}|${maximizingPlayer}|${depth}`;

  if (metrics.memo.has(stateKey)) {
    return metrics.memo.get(stateKey);
  }

  metrics.statesEvaluated += 1;

  /*
   * Terminal state.
   *
   * If it is the AI's turn and there are zero stones,
   * the previous player took the final stone.
   *
   * Therefore AI lost.
   */
  if (remainingStones === 0) {
    const score = maximizingPlayer ? -1 : 1;

    metrics.memo.set(stateKey, score);

    return score;
  }

  /*
   * Depth-limited search.
   */
  if (depth === 0) {
    metrics.memo.set(stateKey, 0);
    return 0;
  }

  let bestScore;

  /*
   * AI / MAX PLAYER
   */
  if (maximizingPlayer) {
    bestScore = -Infinity;

    for (
      let move = 1;
      move <= Math.min(maximumRemoval, remainingStones);
      move += 1
    ) {
      const nextDepth =
        depth === Infinity
          ? Infinity
          : depth - 1;

      const score = minimax(
        remainingStones - move,
        false,
        nextDepth,
        metrics
      );

      bestScore = Math.max(
        bestScore,
        score
      );
    }
  }

  /*
   * HUMAN / MIN PLAYER
   */
  else {
    bestScore = Infinity;

    for (
      let move = 1;
      move <= Math.min(maximumRemoval, remainingStones);
      move += 1
    ) {
      const nextDepth =
        depth === Infinity
          ? Infinity
          : depth - 1;

      const score = minimax(
        remainingStones - move,
        true,
        nextDepth,
        metrics
      );

      bestScore = Math.min(
        bestScore,
        score
      );
    }
  }

  metrics.memo.set(
    stateKey,
    bestScore
  );

  return bestScore;
}

/* =========================================================
   MOVE SCORE CALCULATION
========================================================= */

function calculateMoveScores(
  remainingStones,
  searchDepth
) {
  const moveScores = [];

  let statesEvaluated = 0;
  let bestScore = -Infinity;
  let bestMove = 1;

  /*
   * Immediate win.
   *
   * If the AI can take all remaining stones,
   * it should always do so.
   */
  if (remainingStones <= maximumRemoval) {
    const winningMove = remainingStones;

    return {
      move: winningMove,
      score: 1,

      moveScores: [
        {
          move: winningMove,
          score: 1,
          statesEvaluated: 1
        }
      ],

      statesEvaluated: 1,
      searchDepth
    };
  }

  /*
   * Evaluate every legal move.
   */
  for (
    let move = 1;
    move <= Math.min(
      maximumRemoval,
      remainingStones
    );
    move += 1
  ) {
    const metrics = {
      statesEvaluated: 0,
      memo: new Map()
    };

    const nextDepth =
      searchDepth === Infinity
        ? Infinity
        : Math.max(
            0,
            searchDepth - 1
          );

    const score = minimax(
      remainingStones - move,
      false,
      nextDepth,
      metrics
    );

    statesEvaluated +=
      metrics.statesEvaluated;

    moveScores.push({
      move,
      score,
      statesEvaluated:
        metrics.statesEvaluated
    });

    /*
     * MAX chooses the highest score.
     *
     * If scores are tied,
     * the first legal move remains selected.
     */
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return {
    move: bestMove,
    score: bestScore,
    moveScores,
    statesEvaluated,
    searchDepth
  };
}

/* =========================================================
   DIFFICULTY LEVELS
========================================================= */

function getHardMove(remainingStones) {
  return calculateMoveScores(
    remainingStones,
    Infinity
  );
}

function getMediumMove(remainingStones) {
  return calculateMoveScores(
    remainingStones,
    MEDIUM_SEARCH_DEPTH
  );
}

function getEasyMove(remainingStones) {
  /*
   * Never miss an immediate win.
   */
  if (remainingStones <= maximumRemoval) {
    return {
      move: remainingStones,
      score: 1,

      moveScores: [
        {
          move: remainingStones,
          score: 1,
          statesEvaluated: 1
        }
      ],

      statesEvaluated: 1,
      searchDepth: Infinity
    };
  }

  /*
   * Perform full analysis so Easy can intentionally
   * choose a weaker move sometimes.
   */
  const analysis =
    getHardMove(remainingStones);

  const weakerMoves =
    analysis.moveScores.filter(
      (entry) =>
        entry.score < analysis.score
    );

  /*
   * 25% chance of making a weaker legal move.
   */
  if (
    weakerMoves.length > 0 &&
    Math.random() < 0.25
  ) {
    const selected =
      weakerMoves[
        Math.floor(
          Math.random() *
          weakerMoves.length
        )
      ];

    analysis.move =
      selected.move;

    analysis.score =
      selected.score;

    analysis.intentionallySuboptimal =
      true;
  }

  return analysis;
}

function getAIMove(remainingStones) {
  if (aiDifficulty === "easy") {
    return getEasyMove(
      remainingStones
    );
  }

  if (aiDifficulty === "medium") {
    return getMediumMove(
      remainingStones
    );
  }

  return getHardMove(
    remainingStones
  );
}

function findBestMove(remainingStones) {
  return getAIMove(
    remainingStones
  );
}

/* =========================================================
   STORAGE
========================================================= */

function readStorage(
  key,
  fallback
) {
  try {
    const stored =
      localStorage.getItem(key);

    return stored
      ? JSON.parse(stored)
      : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(
  key,
  value
) {
  try {
    localStorage.setItem(
      key,
      JSON.stringify(value)
    );
  } catch {
    if (elements.moveFeedback) {
      elements.moveFeedback.textContent =
        "Browser storage is unavailable; this session will not be saved.";
    }
  }
}

function loadStatistics() {
  return {
    ...DEFAULT_STATISTICS,
    ...readStorage(
      STATISTICS_KEY,
      {}
    )
  };
}

function loadMatchHistory() {
  const history =
    readStorage(
      HISTORY_KEY,
      []
    );

  return Array.isArray(history)
    ? history
    : [];
}

function loadSettings() {
  const settings =
    readStorage(
      SETTINGS_KEY,
      {}
    );

  return {
    difficulty:
      [
        "easy",
        "medium",
        "hard"
      ].includes(
        settings.difficulty
      )
        ? settings.difficulty
        : "medium",

    turnTimeLimit:
      [
        0,
        15,
        30,
        60
      ].includes(
        settings.turnTimeLimit
      )
        ? settings.turnTimeLimit
        : 0,

    startingStones:
      Number.isInteger(
        settings.startingStones
      ) &&
      settings.startingStones >= 1 &&
      settings.startingStones <= 50
        ? settings.startingStones
        : STARTING_STONES,

    maximumRemoval:
      Number.isInteger(
        settings.maximumRemoval
      ) &&
      settings.maximumRemoval >= 1 &&
      settings.maximumRemoval <= 10
        ? settings.maximumRemoval
        : MAX_REMOVAL
  };
}

function saveSettings() {
  writeStorage(
    SETTINGS_KEY,
    {
      difficulty: aiDifficulty,
      turnTimeLimit,
      startingStones,
      maximumRemoval
    }
  );
}

function saveStatistics() {
  writeStorage(
    STATISTICS_KEY,
    statistics
  );
}

function saveMatchHistory() {
  writeStorage(
    HISTORY_KEY,
    matchHistory
  );
}

/* =========================================================
   DIFFICULTY
========================================================= */

function setDifficulty(difficulty) {
  if (
    ![
      "easy",
      "medium",
      "hard"
    ].includes(difficulty)
  ) {
    return;
  }

  aiDifficulty =
    difficulty;

  saveSettings();

  document
    .querySelectorAll(
      "[data-difficulty]"
    )
    .forEach(
      (button) => {
        button.setAttribute(
          "aria-pressed",
          String(
            button.dataset.difficulty ===
              aiDifficulty
          )
        );
      }
    );

  const difficultyNote =
    document.querySelector(
      "#difficulty-note"
    );

  if (difficultyNote) {
    difficultyNote.textContent =
      `${aiDifficulty.toUpperCase()} SELECTED`;
  }

  if (
    elements.aiDifficultyLabel
  ) {
    elements.aiDifficultyLabel.textContent =
      `${aiDifficulty.toUpperCase()} AI · MINIMAX`;
  }
}

/* =========================================================
   TIMER SETTINGS
========================================================= */

function setTurnTimeLimit(seconds) {
  const duration =
    Number(seconds);

  if (
    ![
      0,
      15,
      30,
      60
    ].includes(duration)
  ) {
    return;
  }

  turnTimeLimit =
    duration;

  saveSettings();

  document
    .querySelectorAll(
      "[data-timer]"
    )
    .forEach(
      (button) => {
        button.setAttribute(
          "aria-pressed",
          String(
            Number(
              button.dataset.timer
            ) === turnTimeLimit
          )
        );
      }
    );

  const timerNote =
    document.querySelector(
      "#timer-note"
    );

  if (timerNote) {
    timerNote.textContent =
      duration === 0
        ? "OFF · NO LIMIT"
        : duration === 60
          ? "1 MINUTE PER TURN"
          : `${duration} SECONDS PER TURN`;
  }

  /*
   * If a game is currently running,
   * apply the new timer immediately.
   */
  if (
    !gameOver &&
    (
      gameMode === "local" ||
      (
        gameMode === "ai" &&
        currentPlayer === 2
      )
    )
  ) {
    clearTurnTimer();
    updateTurnTimer();
  }
}

/* =========================================================
   CUSTOM RULES
========================================================= */

function updateRulePreview() {
  if (
    elements.startingStonesInput
  ) {
    elements.startingStonesInput.value =
      String(startingStones);
  }

  if (
    elements.maxRemovalInput
  ) {
    elements.maxRemovalInput.value =
      String(maximumRemoval);
  }

  const artPileCount =
    document.querySelector(
      "#art-pile-count"
    );

  if (artPileCount) {
    artPileCount.textContent =
      `01—${String(
        startingStones
      ).padStart(2, "0")}`;
  }

  const ruleStartingCount =
    document.querySelector(
      "#rule-starting-count"
    );

  if (ruleStartingCount) {
    ruleStartingCount.textContent =
      `${startingStones} ${
        startingStones === 1
          ? "stone"
          : "stones"
      }`;
  }

  const ruleRemovalRange =
    document.querySelector(
      "#rule-removal-range"
    );

  if (ruleRemovalRange) {
    ruleRemovalRange.textContent =
      maximumRemoval === 1
        ? "1"
        : `1–${maximumRemoval}`;
  }
}

function setCustomRules() {
  const requestedStartingStones =
    Number(
      elements.startingStonesInput.value
    );

  const requestedMaximumRemoval =
    Number(
      elements.maxRemovalInput.value
    );

  if (
    Number.isInteger(
      requestedStartingStones
    ) &&
    requestedStartingStones >= 1 &&
    requestedStartingStones <= 50
  ) {
    startingStones =
      requestedStartingStones;
  }

  if (
    Number.isInteger(
      requestedMaximumRemoval
    ) &&
    requestedMaximumRemoval >= 1 &&
    requestedMaximumRemoval <= 10
  ) {
    maximumRemoval =
      requestedMaximumRemoval;
  }

  /*
   * maximumRemoval may be greater than
   * startingStones. The game automatically
   * limits legal moves to remaining stones.
   */

  updateRulePreview();
  saveSettings();
}

/* =========================================================
   GAME START
========================================================= */

function startGame(mode) {
  clearTimeout(aiTimer);
  clearTurnTimer();

  gameMode =
    mode;

  gameOver =
    true;

  elements.menuScreen.hidden =
    true;

  elements.gameScreen.hidden =
    false;

  elements.headerMenu.hidden =
    false;

  elements.difficultyPicker.hidden =
    mode !== "ai";

  elements.aiTools.hidden =
    mode !== "ai";

  elements.modeHeading.textContent =
    mode === "ai"
      ? "AI VS PLAYER"
      : "PLAYER 1 VS PLAYER 2";

  setupPlayers();
  updateMoveButtons();
  playBattleIntro();
}

/* =========================================================
   BATTLE INTRO
========================================================= */

function playBattleIntro() {
  const overlay =
    elements.battleIntro;

  overlay.hidden =
    false;

  overlay.classList.remove(
    "is-active"
  );

  void overlay.offsetWidth;

  let fallbackTimer;

  const finishIntro = () => {
    clearTimeout(
      fallbackTimer
    );

    overlay.removeEventListener(
      "animationend",
      handleIntroAnimationEnd
    );

    overlay.hidden =
      true;

    overlay.classList.remove(
      "is-active"
    );

    /*
     * Prevent a ghost game if the user
     * has already returned to menu.
     */
    if (!gameMode) {
      return;
    }

    restartGame();
  };

  const handleIntroAnimationEnd =
    (event) => {
      if (
        event.target === overlay &&
        event.animationName ===
          "battle-overlay"
      ) {
        finishIntro();
      }
    };

  overlay.addEventListener(
    "animationend",
    handleIntroAnimationEnd
  );

  fallbackTimer =
    window.setTimeout(
      finishIntro,
      2200
    );

  overlay.classList.add(
    "is-active"
  );
}

/* =========================================================
   PLAYER SETUP
========================================================= */

function setupPlayers() {
  if (gameMode === "ai") {
    elements.playerOneName.textContent =
      "AI";

    elements.playerTwoName.textContent =
      "PLAYER 1";

    elements.playerOneCaption.textContent =
      "MINIMAX PLAYER";

    elements.playerTwoCaption.textContent =
      "HUMAN PLAYER";

    elements.playerOneSymbol.textContent =
      "✳";

    elements.playerTwoSymbol.textContent =
      "01";

    elements.aiInfo.hidden =
      false;

    elements.aiTools.hidden =
      false;

    elements.aiDifficultyLabel.textContent =
      `${aiDifficulty.toUpperCase()} AI · MINIMAX`;
  } else {
    elements.playerOneName.textContent =
      "PLAYER 1";

    elements.playerTwoName.textContent =
      "PLAYER 2";

    elements.playerOneCaption.textContent =
      "LOCAL PLAYER";

    elements.playerTwoCaption.textContent =
      "LOCAL PLAYER";

    elements.playerOneSymbol.textContent =
      "01";

    elements.playerTwoSymbol.textContent =
      "02";

    elements.aiInfo.hidden =
      true;

    elements.aiTools.hidden =
      true;

    elements.analysisSummary.hidden =
      true;
  }
}

function setupAIGame() {
  startGame("ai");
}

function setupTwoPlayerGame() {
  startGame("local");
}

/* =========================================================
   RESTART
========================================================= */

function restartGame() {
  clearTimeout(aiTimer);
  clearTurnTimer();

  stones =
    startingStones;

  currentPlayer =
    gameMode === "ai"
      ? (
          nextAIStarter
        )
      : 1;

  if (
    gameMode === "ai"
  ) {
    nextAIStarter =
      nextAIStarter === 1
        ? 2
        : 1;
  }

  gameOver =
    false;

  aiThinking =
    false;

  displayedStones =
    null;

  elements.winnerOverlay.hidden =
    true;

  elements.moveFeedback.textContent =
    `Take 1 to ${Math.min(
      maximumRemoval,
      stones
    )} ${
      Math.min(
        maximumRemoval,
        stones
      ) === 1
        ? "stone"
        : "stones"
    } to begin.`;

  elements.aiDetail.textContent =
    "AI evaluates every legal move.";

  elements.analysisSummary.hidden =
    true;

  currentAnalysis =
    null;

  updateGameDisplay();
  updateTurnDisplay();

  /*
   * Randomize the starting player in AI mode
   * because the first move has a strategic advantage.
   */
  if (
    gameMode === "ai" &&
    currentPlayer === 1
  ) {
    aiTurn();
  }
}

/* =========================================================
   HUMAN MOVE
========================================================= */

function makeMove(amount) {
  const isHumanTurn =
    gameMode === "local" ||
    currentPlayer === 2;

  if (
    gameOver ||
    aiThinking ||
    !isHumanTurn ||
    amount < 1 ||
    amount > maximumRemoval ||
    amount > stones
  ) {
    return;
  }

  const playerName =
    getPlayerName(
      currentPlayer
    );

  /*
   * Stop the active timer immediately.
   */
  clearTurnTimer();

  stones -= amount;

  elements.moveFeedback.textContent =
    `${playerName} REMOVED ${amount} ${
      amount === 1
        ? "STONE"
        : "STONES"
    }.`;

  /*
   * Human took the final stone.
   */
  if (stones === 0) {
    updateGameDisplay();

    endGame(
      currentPlayer
    );

    return;
  }

  /*
   * Change turn.
   */
  currentPlayer =
    gameMode === "local"
      ? (
          currentPlayer === 1
            ? 2
            : 1
        )
      : 1;

  updateGameDisplay();
  updateTurnDisplay();

  /*
   * AI gets its turn.
   */
  if (
    gameMode === "ai"
  ) {
    aiTurn();
  }
}

/* =========================================================
   AI TURN
========================================================= */

function aiTurn() {
  if (
    gameMode !== "ai" ||
    currentPlayer !== 1 ||
    gameOver
  ) {
    return;
  }

  /*
   * AI does not use the human timer.
   */
  clearTurnTimer();

  aiThinking =
    true;

  updateTurnDisplay();

  const legalMoves =
    Math.min(
      maximumRemoval,
      stones
    );

  elements.aiDetail.textContent =
    `Evaluating ${legalMoves} legal move${
      legalMoves === 1
        ? ""
        : "s"
    } with Minimax...`;

  updateMoveButtons();

  aiTimer =
    window.setTimeout(
      () => {
        if (
          gameOver ||
          gameMode !== "ai" ||
          currentPlayer !== 1
        ) {
          return;
        }

        const stonesBefore =
          stones;

        const result =
          findBestMove(
            stonesBefore
          );

        currentAnalysis = {
          ...result,
          stonesBefore,
          difficulty:
            aiDifficulty
        };

        /*
         * Safety clamp.
         */
        const actualRemoval =
          Math.min(
            result.move,
            stones
          );

        stones -=
          actualRemoval;

        aiThinking =
          false;

        elements.moveFeedback.textContent =
          `⚡ AI CHOSE ${actualRemoval} ${
            actualRemoval === 1
              ? "STONE"
              : "STONES"
          } · MINIMAX SCORE ${
            formatScore(
              result.score
            )
          }.`;

        elements.aiDetail.textContent =
          `${aiDifficulty.toUpperCase()} search chose ${
            actualRemoval
          }; evaluated ${
            result.statesEvaluated
          } states.`;

        renderAnalysisSummary();

        updateGameDisplay();

        /*
         * AI took the final stone.
         */
        if (
          stones === 0
        ) {
          endGame(1);
          return;
        }

        /*
         * Human turn.
         */
        currentPlayer =
          2;

        updateTurnDisplay();
      },
      650
    );
}

/* =========================================================
   TIMER
========================================================= */

function clearTurnTimer() {
  if (
    turnTimerInterval !== null
  ) {
    clearInterval(
      turnTimerInterval
    );
  }

  turnTimerInterval =
    null;

  turnTimerPlayer =
    0;

  turnDeadline =
    0;

  turnSecondsRemaining =
    0;

  if (
    elements.turnClock
  ) {
    elements.turnClock.hidden =
      true;

    elements.turnClock.classList.remove(
      "urgent"
    );
  }
}

function updateTurnTimer() {
  /*
   * No timer.
   */
  if (
    turnTimeLimit === 0 ||
    gameOver
  ) {
    clearTurnTimer();
    return;
  }

  /*
   * AI's turn has no timer.
   */
  if (
    gameMode === "ai" &&
    currentPlayer === 1
  ) {
    clearTurnTimer();
    return;
  }

  /*
   * AI is calculating.
   */
  if (
    aiThinking
  ) {
    clearTurnTimer();
    return;
  }

  /*
   * Timer already belongs to this player.
   */
  if (
    turnTimerInterval !== null &&
    turnTimerPlayer === currentPlayer
  ) {
    return;
  }

  clearTurnTimer();

  turnTimerPlayer =
    currentPlayer;

  turnDeadline =
    Date.now() +
    turnTimeLimit * 1000;

  elements.turnClock.hidden =
    false;

  renderTurnClock();

  turnTimerInterval =
    window.setInterval(
      () => {
        /*
         * Stop stale timer.
         */
        if (
          gameOver ||
          currentPlayer !==
            turnTimerPlayer
        ) {
          clearTurnTimer();
          return;
        }

        turnSecondsRemaining =
          Math.max(
            0,
            Math.ceil(
              (
                turnDeadline -
                Date.now()
              ) / 1000
            )
          );

        renderTurnClock();

        /*
         * TIME EXPIRED
         */
        if (
          turnSecondsRemaining <= 0
        ) {
          handleTurnTimeout(
            turnTimerPlayer
          );
        }
      },
      200
    );
}

function renderTurnClock() {
  if (
    !elements.turnClock ||
    turnTimeLimit === 0
  ) {
    return;
  }

  turnSecondsRemaining =
    Math.max(
      0,
      Math.ceil(
        (
          turnDeadline -
          Date.now()
        ) / 1000
      )
    );

  const minutes =
    String(
      Math.floor(
        turnSecondsRemaining /
          60
      )
    ).padStart(
      2,
      "0"
    );

  const seconds =
    String(
      turnSecondsRemaining %
        60
    ).padStart(
      2,
      "0"
    );

  elements.turnClock.textContent =
    `${minutes}:${seconds}`;

  elements.turnClock.setAttribute(
    "aria-label",
    `${turnSecondsRemaining} seconds remaining this turn`
  );

  elements.turnClock.classList.toggle(
    "urgent",
    turnSecondsRemaining <= 5
  );
}

function handleTurnTimeout(
  expiredPlayer
) {
  /*
   * Ignore stale timer callbacks.
   */
  if (
    gameOver ||
    currentPlayer !==
      expiredPlayer
  ) {
    return;
  }

  const skippedPlayer =
    getPlayerName(
      expiredPlayer
    );

  clearTurnTimer();

  elements.moveFeedback.textContent =
    `${skippedPlayer} RAN OUT OF TIME · TURN PASSED.`;

  /*
   * Local game:
   * Player 1 <-> Player 2
   */
  if (
    gameMode === "local"
  ) {
    currentPlayer =
      currentPlayer === 1
        ? 2
        : 1;
  }

  /*
   * AI game:
   * Human is Player 2.
   * Timeout gives the turn to AI.
   */
  else {
    currentPlayer =
      1;
  }

  updateGameDisplay();
  updateTurnDisplay();

  /*
   * Automatically start AI.
   */
  if (
    gameMode === "ai" &&
    currentPlayer === 1
  ) {
    aiTurn();
  }
}

/* =========================================================
   PLAYER NAME
========================================================= */

function getPlayerName(player) {
  if (
    gameMode === "ai"
  ) {
    return player === 1
      ? "AI"
      : "PLAYER 1";
  }

  return `PLAYER ${player}`;
}

/* =========================================================
   GAME DISPLAY
========================================================= */

function updateGameDisplay() {
  elements.stoneCount.textContent =
    String(stones);

  elements.stonePile.setAttribute(
    "aria-label",
    `${stones} ${
      stones === 1
        ? "stone"
        : "stones"
    } remaining`
  );

  renderMoveButtons();

  /*
   * Rebuild stone pile if starting-stone
   * configuration changed.
   */
  if (
    elements.stonePile.querySelectorAll(
      ".stone"
    ).length !==
    startingStones
  ) {
    elements.stonePile.replaceChildren();

    for (
      let index = 0;
      index < startingStones;
      index += 1
    ) {
      const stone =
        document.createElement(
          "span"
        );

      stone.className =
        "stone";

      stone.setAttribute(
        "aria-hidden",
        "true"
      );

      elements.stonePile.append(
        stone
      );
    }
  }

  Array.from(
    elements.stonePile.querySelectorAll(
      ".stone"
    )
  ).forEach(
    (stone, index) => {
      const removed =
        index >= stones;

      stone.classList.toggle(
        "is-gone",
        removed
      );

      stone.classList.toggle(
        "is-returning",
        !removed &&
          displayedStones !== null &&
          stones > displayedStones
      );

      stone.style.setProperty(
        "--stone-delay",
        `${(index % 5) * 45}ms`
      );
    }
  );

  if (
    displayedStones !== null &&
    stones < displayedStones
  ) {
    animateStoneRemoval(
      displayedStones - stones,
      stones
    );
  }

  displayedStones =
    stones;

  const progress =
    Math.round(
      (
        (
          startingStones -
          stones
        ) /
        startingStones
      ) *
        100
    );

  elements.progressValue.textContent =
    `${progress}%`;

  elements.progressFill.style.width =
    `${progress}%`;

  elements.progressTrack.setAttribute(
    "aria-valuenow",
    String(progress)
  );

  updatePlayerCards();
  updateMoveButtons();
}

/* =========================================================
   MOVE BUTTONS
========================================================= */

function renderMoveButtons() {
  if (
    elements.moveControls.children
      .length ===
    maximumRemoval
  ) {
    return;
  }

  const buttons =
    Array.from(
      {
        length:
          maximumRemoval
      },
      (_, index) => {
        const amount =
          index + 1;

        const button =
          document.createElement(
            "button"
          );

        button.className =
          "move-button";

        button.type =
          "button";

        button.dataset.move =
          String(amount);

        button.setAttribute(
          "aria-label",
          `Remove ${amount} ${
            amount === 1
              ? "stone"
              : "stones"
          }`
        );

        button.innerHTML =
          `<strong>${String(
            amount
          ).padStart(
            2,
            "0"
          )}</strong><span>${
            amount === 1
              ? "STONE"
              : "STONES"
          }</span>`;

        return button;
      }
    );

  elements.moveControls.replaceChildren(
    ...buttons
  );
}

/* =========================================================
   STONE ANIMATION
========================================================= */

function animateStoneRemoval(
  amount,
  remainingStones
) {
  elements.stonePile.classList.remove(
    "pile-impact"
  );

  void elements.stonePile.offsetWidth;

  elements.stonePile.classList.add(
    "pile-impact"
  );

  const removedStones =
    Array.from(
      elements.stonePile.querySelectorAll(
        ".stone"
      )
    ).slice(
      remainingStones,
      remainingStones + amount
    );

  removedStones.forEach(
    (stone, index) => {
      const angle =
        (
          (
            remainingStones +
            index
          ) %
            2 ===
          0
            ? -1
            : 1
        ) *
        (
          18 +
          index * 11
        );

      stone.style.setProperty(
        "--stone-rotation",
        `${angle}deg`
      );

      stone.style.setProperty(
        "--stone-fall",
        `${20 + index * 9}px`
      );

      stone.style.setProperty(
        "--stone-delay",
        `${index * 75}ms`
      );

      const centerX =
        stone.offsetLeft +
        stone.offsetWidth /
          2;

      const centerY =
        stone.offsetTop +
        stone.offsetHeight /
          2;

      const fracture =
        document.createElement(
          "span"
        );

      fracture.className =
        "stone-fracture";

      fracture.setAttribute(
        "aria-hidden",
        "true"
      );

      fracture.style.left =
        `${stone.offsetLeft}px`;

      fracture.style.top =
        `${stone.offsetTop}px`;

      fracture.style.width =
        `${stone.offsetWidth}px`;

      fracture.style.height =
        `${stone.offsetHeight}px`;

      elements.stonePile.append(
        fracture
      );

      window.setTimeout(
        () => fracture.remove(),
        420
      );

      for (
        let fragmentIndex = 0;
        fragmentIndex < 6;
        fragmentIndex += 1
      ) {
        const direction =
          (
            Math.PI *
            2 *
            fragmentIndex
          ) /
            6 +
          index * 0.28;

        const distance =
          30 +
          (
            fragmentIndex %
            3
          ) *
            12;

        const fragment =
          document.createElement(
            "span"
          );

        fragment.className =
          `stone-fragment shard-${
            fragmentIndex + 1
          }`;

        fragment.setAttribute(
          "aria-hidden",
          "true"
        );

        fragment.style.left =
          `${centerX}px`;

        fragment.style.top =
          `${centerY}px`;

        fragment.style.setProperty(
          "--fragment-x",
          `${Math.cos(
            direction
          ) * distance}px`
        );

        fragment.style.setProperty(
          "--fragment-y",
          `${Math.sin(
            direction
          ) * distance}px`
        );

        fragment.style.setProperty(
          "--fragment-spin",
          `${
            (
              fragmentIndex % 2
                ? 1
                : -1
            ) *
            (
              110 +
              fragmentIndex * 45
            )
          }deg`
        );

        fragment.style.setProperty(
          "--fragment-delay",
          `${80 + index * 55}ms`
        );

        elements.stonePile.append(
          fragment
        );

        window.setTimeout(
          () =>
            fragment.remove(),
          1150 +
            index * 55
        );
      }
    }
  );

  const burst =
    document.createElement(
      "span"
    );

  burst.className =
    "stone-burst";

  burst.setAttribute(
    "aria-hidden",
    "true"
  );

  elements.stonePile.append(
    burst
  );

  window.setTimeout(
    () => burst.remove(),
    560
  );
}

/* =========================================================
   SCORE FORMATTING
========================================================= */

function formatScore(score) {
  if (
    Number.isInteger(score)
  ) {
    return score > 0
      ? `+${score}`
      : String(score);
  }

  return `${
    score > 0
      ? "+"
      : ""
  }${score.toFixed(2)}`;
}

/* =========================================================
   AI ANALYSIS
========================================================= */

function getAIAnalysis(
  remainingStones
) {
  if (
    aiDifficulty === "easy"
  ) {
    return getEasyMove(
      remainingStones
    );
  }

  if (
    aiDifficulty === "medium"
  ) {
    return getMediumMove(
      remainingStones
    );
  }

  return getHardMove(
    remainingStones
  );
}

function renderAnalysisSummary() {
  if (
    !currentAnalysis
  ) {
    return;
  }

  elements.analysisSummary.hidden =
    false;

  const highestScore =
    Math.max(
      ...currentAnalysis.moveScores.map(
        (entry) =>
          entry.score
      )
    );

  const rows =
    currentAnalysis.moveScores
      .map(
        ({
          move,
          score
        }) =>
          `<div class="analysis-row${
            move ===
            currentAnalysis.move
              ? " is-best"
              : ""
          }">
            <span>REMOVE ${move}</span>
            <strong>${formatScore(
              score
            )}</strong>
            ${
              move ===
              currentAnalysis.move
                ? `<b>${
                    score ===
                    highestScore
                      ? "BEST"
                      : "EASY PICK"
                  }</b>`
                : ""
            }
          </div>`
      )
      .join("");

  elements.analysisSummary.innerHTML =
    `<div class="analysis-title">
      <span>LAST AI ANALYSIS · ${
        currentAnalysis.difficulty.toUpperCase()
      }</span>
      <span>${
        currentAnalysis.statesEvaluated
      } STATES</span>
    </div>
    <div class="analysis-list">
      ${rows}
    </div>
    <p>
      Stones before move:
      <b>${currentAnalysis.stonesBefore}</b>
      · Selected:
      <b>${currentAnalysis.move}</b>
      · Search depth:
      <b>${
        Number.isFinite(
          currentAnalysis.searchDepth
        )
          ? currentAnalysis.searchDepth
          : "FULL"
      }</b>
    </p>`;
}

/* =========================================================
   DIALOG
========================================================= */

function showDialog(
  title,
  content
) {
  elements.dialogContent.innerHTML =
    `<p class="eyebrow">
      <span class="eyebrow-line"></span>
      STONE BATTLE · AI LAB
    </p>
    <h2 id="dialog-title">${title}</h2>
    ${content}`;

  if (
    !elements.featureDialog.open
  ) {
    elements.featureDialog.showModal();
  }
}

/* =========================================================
   MINIMAX TREE
========================================================= */

function showMinimaxTree(
  remainingStones,
  maximizingPlayer,
  depth,
  bestMove,
  isRoot = false
) {
  const role =
    maximizingPlayer
      ? "MAX · AI"
      : "MIN · OPPONENT";

  const roleClass =
    maximizingPlayer
      ? "tree-max"
      : "tree-min";

  const label =
    `<span class="tree-node ${roleClass}">
      <b>${role}</b>
      <span>
        ${remainingStones}
        ${
          remainingStones === 1
            ? "stone"
            : "stones"
        }
      </span>
    </span>`;

  if (
    remainingStones === 0 ||
    depth === 0
  ) {
    const metrics = {
      statesEvaluated: 0
    };

    const score =
      minimax(
        remainingStones,
        maximizingPlayer,
        Infinity,
        metrics
      );

    return `
      <li>
        ${label}
        <small>
          evaluation ${formatScore(
            score
          )}
        </small>
      </li>`;
  }

  const branches = [];

  for (
    let move = 1;
    move <= Math.min(
      maximumRemoval,
      remainingStones
    );
    move += 1
  ) {
    const child =
      showMinimaxTree(
        remainingStones - move,
        !maximizingPlayer,
        depth - 1,
        bestMove,
        false
      );

    branches.push(
      `<li class="tree-branch${
        isRoot &&
        move === bestMove
          ? " selected-branch"
          : ""
      }">
        <span class="tree-move">
          −${move}
        </span>
        <ul>
          ${child}
        </ul>
      </li>`
    );
  }

  return `
    <li>
      ${label}
      <ul>
        ${branches.join("")}
      </ul>
    </li>`;
}

/* =========================================================
   HOW AI THINKS
========================================================= */

function showHowAIThinks() {
  if (
    gameMode !== "ai"
  ) {
    return;
  }

  const analysis =
    getAIAnalysis(
      stones
    );

  const legalMoves =
    analysis.moveScores
      .map(
        (entry) =>
          entry.move
      )
      .join(", ") ||
    "None";

  const rows =
    analysis.moveScores
      .map(
        ({
          move,
          score
        }) =>
          `<div class="analysis-row${
            move === analysis.move
              ? " is-best"
              : ""
          }">
            <span>
              REMOVE ${move}
              ${
                move === 1
                  ? "STONE"
                  : "STONES"
              }
            </span>
            <strong>
              ${formatScore(score)}
            </strong>
            ${
              move === analysis.move
                ? "<b>BEST MOVE</b>"
                : ""
            }
          </div>`
      )
      .join("");

  const tree =
    showMinimaxTree(
      stones,
      true,
      2,
      analysis.move,
      true
    );

  showDialog(
    "HOW AI THINKS",
    `<p class="dialog-lead">
      Minimax evaluates future game states and chooses
      the move with the best outcome, assuming the
      opponent also plays optimally.
    </p>

    <div class="state-strip">
      <div>
        <span>STONES REMAINING</span>
        <b>${stones}</b>
      </div>

      <div>
        <span>AI TURN</span>
        <b>
          ${
            currentPlayer === 1
              ? "YES"
              : "NO · PREVIEW"
          }
        </b>
      </div>

      <div>
        <span>POSSIBLE MOVES</span>
        <b>${legalMoves}</b>
      </div>
    </div>

    <h3>
      MOVE EVALUATION ·
      ${aiDifficulty.toUpperCase()} AI
    </h3>

    <div class="analysis-list">
      ${rows}
    </div>

    <p class="best-move-callout">
      ✦ BEST MOVE:
      REMOVE ${analysis.move}
      ${
        analysis.move === 1
          ? "STONE"
          : "STONES"
      }
    </p>

    <div class="analysis-meta">
      Search depth:
      <b>
        ${
          Number.isFinite(
            analysis.searchDepth
          )
            ? analysis.searchDepth
            : "FULL GAME"
        }
      </b>

      <span>
        States evaluated:
        <b>${analysis.statesEvaluated}</b>
      </span>

      <span>
        Algorithm:
        <b>MINIMAX</b>
      </span>
    </div>

    <details class="tree-disclosure">
      <summary>
        EXPLORE GAME TREE ·
        MAX = AI · MIN = OPPONENT
      </summary>

      <div class="tree-scroll">
        <ul class="game-tree">
          ${tree}
        </ul>
      </div>

      <p class="tree-note">
        Showing two turns of branches;
        leaf scores are evaluated through
        the remaining game.
      </p>
    </details>`
  );
}

/* =========================================================
   HTML ESCAPE
========================================================= */

function escapeHTML(value) {
  return String(
    value
  ).replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      })[character]
  );
}

/* =========================================================
   STATISTICS
========================================================= */

function updateStatistics(
  winner
) {
  statistics.gamesPlayed += 1;

  /*
   * In AI mode:
   *   Player 1 = AI
   *   Player 2 = Human
   *
   * Therefore winner 2 means
   * human Player 1 won.
   */

  if (
    gameMode === "ai"
  ) {
    statistics.aiGames += 1;

    if (
      winner === 1
    ) {
      statistics.aiWins += 1;
    } else {
      statistics.aiLosses += 1;
    }
  } else {
    statistics.twoPlayerGames += 1;
  }

  const playerOneWon =
    gameMode === "ai"
      ? winner === 2
      : winner === 1;

  if (
    playerOneWon
  ) {
    statistics.wins += 1;

    statistics.currentStreak += 1;

    statistics.bestStreak =
      Math.max(
        statistics.bestStreak,
        statistics.currentStreak
      );
  } else {
    statistics.losses += 1;
    statistics.currentStreak = 0;
  }

  saveStatistics();
}

/* =========================================================
   MATCH HISTORY
========================================================= */

function recordMatch(
  winner
) {
  const winnerName =
    getPlayerName(
      winner
    );

  const record = {
    mode:
      gameMode,

    players:
      gameMode === "ai"
        ? [
            "AI",
            "PLAYER 1"
          ]
        : [
            "PLAYER 1",
            "PLAYER 2"
          ],

    difficulty:
      gameMode === "ai"
        ? aiDifficulty
        : null,

    turnTimeLimit,

    winner:
      winnerName,

    startingStones,

    maximumRemoval,

    timestamp:
      new Date().toISOString()
  };

  matchHistory.unshift(
    record
  );

  matchHistory =
    matchHistory.slice(
      0,
      100
    );

  saveMatchHistory();
  updateStatistics(
    winner
  );
}

function formatMatchDate(
  timestamp
) {
  const date =
    new Date(
      timestamp
    );

  return Number.isNaN(
    date.getTime()
  )
    ? "Date unavailable"
    : date.toLocaleString(
        undefined,
        {
          dateStyle: "medium",
          timeStyle: "short"
        }
      );
}

/* =========================================================
   STATISTICS UI
========================================================= */

function showStatistics() {
  const winRate =
    statistics.gamesPlayed
      ? Math.round(
          (
            statistics.wins /
            statistics.gamesPlayed
          ) *
            100
        )
      : 0;

  const cards = [
    [
      "Games played",
      statistics.gamesPlayed
    ],
    [
      "Wins · Player 1",
      statistics.wins
    ],
    [
      "Losses · Player 1",
      statistics.losses
    ],
    [
      "Draws",
      statistics.draws
    ],
    [
      "Win rate",
      `${winRate}%`
    ],
    [
      "Current streak",
      statistics.currentStreak
    ],
    [
      "Best streak",
      statistics.bestStreak
    ],
    [
      "AI games",
      statistics.aiGames
    ],
    [
      "Wins against AI",
      statistics.aiWins
    ],
    [
      "Losses against AI",
      statistics.aiLosses
    ],
    [
      "Two-player games",
      statistics.twoPlayerGames
    ]
  ]
    .map(
      ([label, value]) =>
        `<div class="stat-card">
          <span>${label}</span>
          <strong>${value}</strong>
        </div>`
    )
    .join("");

  const history =
    matchHistory
      .slice(0, 10)
      .map(
        (match) =>
          `<article class="history-row">
            <div>
              <strong>
                ${
                  match.mode === "ai"
                    ? "AI VS PLAYER 1"
                    : "PLAYER 1 VS PLAYER 2"
                }
              </strong>

              <span>
                ${
                  match.mode === "ai"
                    ? `${escapeHTML(
                        (
                          match.difficulty ||
                          "medium"
                        ).toUpperCase()
                      )} DIFFICULTY · `
                    : ""
                }

                ${match.startingStones}
                STARTING · MAX
                ${
                  match.maximumRemoval ||
                  MAX_REMOVAL
                }/TURN ·

                ${
                  match.turnTimeLimit
                    ? match.turnTimeLimit === 60
                      ? "1 MIN TIMER"
                      : `${match.turnTimeLimit}S TIMER`
                    : "NO TIMER"
                }
              </span>
            </div>

            <div>
              <strong>
                ${escapeHTML(
                  match.winner
                )}
                WINS
              </strong>

              <span>
                ${escapeHTML(
                  formatMatchDate(
                    match.timestamp
                  )
                )}
              </span>
            </div>
          </article>`
      )
      .join("") ||
    `<p class="empty-history">
      No completed matches yet.
      Play a game to start your history.
    </p>`;

  showDialog(
    "STATISTICS",
    `<div class="statistics-grid">
      ${cards}
    </div>

    <div class="history-heading">
      <h3>MATCH HISTORY</h3>

      <button
        class="dialog-action"
        id="clear-history-button"
        type="button"
      >
        CLEAR HISTORY
      </button>
    </div>

    <div class="history-list">
      ${history}
    </div>

    <button
      class="reset-statistics-button"
      id="reset-statistics-button"
      type="button"
    >
      RESET STATISTICS
    </button>`
  );

  document
    .querySelector(
      "#clear-history-button"
    )
    .addEventListener(
      "click",
      clearMatchHistory
    );

  document
    .querySelector(
      "#reset-statistics-button"
    )
    .addEventListener(
      "click",
      resetStatistics
    );
}

function clearMatchHistory() {
  if (
    !window.confirm(
      "Clear all saved match history? This cannot be undone."
    )
  ) {
    return;
  }

  matchHistory = [];

  saveMatchHistory();

  showStatistics();
}

function resetStatistics() {
  if (
    !window.confirm(
      "Reset all saved statistics?"
    )
  ) {
    return;
  }

  statistics = {
    ...DEFAULT_STATISTICS
  };

  saveStatistics();

  if (
    window.confirm(
      "Also clear match history?"
    )
  ) {
    matchHistory = [];

    saveMatchHistory();
  }

  showStatistics();
}

/* =========================================================
   LEARN MINIMAX
========================================================= */

function showLearnMinimax() {
  const analysis =
    getAIAnalysis(
      stones
    );

  const actions =
    Array.from(
      {
        length:
          Math.min(
            maximumRemoval,
            stones
          )
      },
      (_, index) =>
        index + 1
    ).join(", ") ||
    "None";

  showDialog(
    "LEARN MINIMAX",
    `<p class="dialog-lead">
      Minimax is a search algorithm for two-player
      games. It looks ahead at possible moves and
      assumes both sides choose their strongest response.
    </p>

    <div class="lesson-grid">
      <article>
        <b>MAX · THE AI</b>
        <p>
          MAX tries to get the highest score.
          An AI win is +1; an AI loss is −1.
        </p>
      </article>

      <article>
        <b>MIN · THE OPPONENT</b>
        <p>
          MIN tries to make the AI's score as low
          as possible by choosing the toughest reply.
        </p>
      </article>

      <article>
        <b>MOVE EVALUATION</b>
        <p>
          The search follows legal moves until the
          end of the game (Hard) or a depth limit (Medium).
        </p>
      </article>

      <article>
        <b>BEST MOVE</b>
        <p>
          The AI compares each move's Minimax score
          and chooses the highest-scoring option.
        </p>
      </article>
    </div>

    <div class="flow-steps">
      <span>CURRENT STATE</span>
      <i>↓</i>
      <span>GENERATE LEGAL MOVES</span>
      <i>↓</i>
      <span>EVALUATE FUTURE STATES</span>
      <i>↓</i>
      <span>MAX CHOOSES HIGHEST SCORE</span>
      <i>↓</i>
      <span>AI MAKES MOVE</span>
    </div>

    <div class="difficulty-explainer">
      <p>
        <b>EASY</b>
        Full Minimax analysis with an occasional
        non-optimal legal move, except when an
        immediate win is available.
      </p>

      <p>
        <b>MEDIUM</b>
        Minimax searches 4 plies while immediate
        winning moves are always selected.
      </p>

      <p>
        <b>HARD</b>
        Full Minimax to terminal states for
        an optimal decision.
      </p>
    </div>

    <section class="demo-panel">
      <h3>AI DEMONSTRATION</h3>

      <div>
        <span>Algorithm</span>
        <b>
          MINIMAX ·
          ${aiDifficulty.toUpperCase()}
        </b>
      </div>

      <div>
        <span>Game state</span>
        <b>
          ${stones} stones remaining
        </b>
      </div>

      <div>
        <span>Possible actions</span>
        <b>${actions}</b>
      </div>

      <div>
        <span>AI decision</span>
        <b>Remove ${analysis.move}</b>
      </div>

      <div>
        <span>Evaluation</span>
        <b>
          ${formatScore(
            analysis.score
          )}
        </b>
      </div>

      <div>
        <span>States evaluated</span>
        <b>
          ${analysis.statesEvaluated}
        </b>
      </div>
    </section>`
  );
}

/* =========================================================
   BUTTON STATE
========================================================= */

function updateMoveButtons() {
  const playerCanMove =
    gameMode === "local" ||
    currentPlayer === 2;

  elements.moveControls
    .querySelectorAll(
      ".move-button"
    )
    .forEach(
      (button) => {
        const amount =
          Number(
            button.dataset.move
          );

        button.disabled =
          gameOver ||
          aiThinking ||
          !playerCanMove ||
          amount > stones;
      }
    );
}

/* =========================================================
   TURN DISPLAY
========================================================= */

function updateTurnDisplay() {
  const isAiTurn =
    gameMode === "ai" &&
    currentPlayer === 1;

  const playerName =
    getPlayerName(
      currentPlayer
    );

  elements.turnBanner.classList.toggle(
    "thinking",
    aiThinking
  );

  elements.turnMessage.textContent =
    aiThinking
      ? "AI THINKING..."
      : `${playerName} TURN`;

  elements.playPrompt.textContent =
    aiThinking
      ? "CALCULATING BEST MOVE"
      : (
          isAiTurn
            ? "AI IS UP"
            : "CHOOSE YOUR MOVE"
        );

  elements.playerOneState.textContent =
    currentPlayer === 1
      ? (
          aiThinking
            ? "THINKING"
            : "YOUR TURN"
        )
      : "READY";

  elements.playerTwoState.textContent =
    currentPlayer === 2
      ? "YOUR TURN"
      : "READY";

  updateTurnTimer();
  updatePlayerCards();
  updateMoveButtons();
}

function updatePlayerCards() {
  elements.playerOneCard.classList.toggle(
    "active",
    currentPlayer === 1 &&
      !gameOver
  );

  elements.playerTwoCard.classList.toggle(
    "active",
    currentPlayer === 2 &&
      !gameOver
  );
}

/* =========================================================
   END GAME
========================================================= */

function endGame(winner) {
  if (
    gameOver
  ) {
    return;
  }

  gameOver =
    true;

  aiThinking =
    false;

  clearTimeout(
    aiTimer
  );

  clearTurnTimer();

  elements.turnBanner.classList.remove(
    "thinking"
  );

  elements.turnMessage.textContent =
    "GAME OVER";

  elements.playPrompt.textContent =
    "FINAL STONE TAKEN";

  elements.playerOneState.textContent =
    winner === 1
      ? "WINNER"
      : "DEFEATED";

  elements.playerTwoState.textContent =
    winner === 2
      ? "WINNER"
      : "DEFEATED";

  recordMatch(
    winner
  );

  updatePlayerCards();
  updateMoveButtons();

  const winnerName =
    getPlayerName(
      winner
    );

  elements.winnerName.textContent =
    `${winnerName} WINS!`;

  elements.winnerOverlay.hidden =
    false;

  document
    .querySelector(
      "#winner-restart"
    )
    .focus();
}

/* =========================================================
   MAIN MENU
========================================================= */

function goToMainMenu() {
  clearTimeout(
    aiTimer
  );

  clearTurnTimer();

  gameMode =
    "";

  stones =
    startingStones;

  currentPlayer =
    1;

  gameOver =
    false;

  aiThinking =
    false;

  elements.winnerOverlay.hidden =
    true;

  elements.gameScreen.hidden =
    true;

  elements.headerMenu.hidden =
    true;

  elements.difficultyPicker.hidden =
    false;

  elements.aiTools.hidden =
    true;

  elements.analysisSummary.hidden =
    true;

  elements.menuScreen.hidden =
    false;

  const aiButton =
    document.querySelector(
      '[data-mode="ai"]'
    );

  if (aiButton) {
    aiButton.focus();
  }
}

/* =========================================================
   EVENT LISTENERS
========================================================= */

/*
 * Game mode buttons
 */
document
  .querySelectorAll(
    "[data-mode]"
  )
  .forEach(
    (button) => {
      button.addEventListener(
        "click",
        () => {
          if (
            button.dataset.mode ===
            "ai"
          ) {
            setupAIGame();
          } else {
            setupTwoPlayerGame();
          }
        }
      );
    }
  );

/*
 * Difficulty buttons
 */
document
  .querySelectorAll(
    "[data-difficulty]"
  )
  .forEach(
    (button) => {
      button.addEventListener(
        "click",
        () =>
          setDifficulty(
            button.dataset.difficulty
          )
      );
    }
  );

/*
 * Timer buttons
 *
 * Required HTML:
 *
 * data-timer="0"
 * data-timer="15"
 * data-timer="30"
 * data-timer="60"
 */
document
  .querySelectorAll(
    "[data-timer]"
  )
  .forEach(
    (button) => {
      button.addEventListener(
        "click",
        () =>
          setTurnTimeLimit(
            button.dataset.timer
          )
      );
    }
  );

/*
 * Starting stones
 */
if (
  elements.startingStonesInput
) {
  elements.startingStonesInput.addEventListener(
    "change",
    setCustomRules
  );
}

/*
 * Maximum removal
 */
if (
  elements.maxRemovalInput
) {
  elements.maxRemovalInput.addEventListener(
    "change",
    setCustomRules
  );
}

/*
 * Move buttons
 */
elements.moveControls.addEventListener(
  "click",
  (event) => {
    const button =
      event.target.closest(
        ".move-button"
      );

    if (
      button &&
      !button.disabled
    ) {
      makeMove(
        Number(
          button.dataset.move
        )
      );
    }
  }
);

/*
 * Restart
 */
document
  .querySelector(
    "#restart-button"
  )
  .addEventListener(
    "click",
    restartGame
  );

/*
 * Winner restart
 */
document
  .querySelector(
    "#winner-restart"
  )
  .addEventListener(
    "click",
    restartGame
  );

/*
 * Menu
 */
document
  .querySelector(
    "#menu-button"
  )
  .addEventListener(
    "click",
    goToMainMenu
  );

document
  .querySelector(
    "#header-menu"
  )
  .addEventListener(
    "click",
    goToMainMenu
  );

document
  .querySelector(
    "#winner-menu"
  )
  .addEventListener(
    "click",
    goToMainMenu
  );

/*
 * Statistics
 */
document
  .querySelector(
    "#statistics-button"
  )
  .addEventListener(
    "click",
    showStatistics
  );

/*
 * Learn Minimax
 */
document
  .querySelector(
    "#learn-button"
  )
  .addEventListener(
    "click",
    showLearnMinimax
  );

/*
 * How AI thinks
 */
document
  .querySelector(
    "#thinking-button"
  )
  .addEventListener(
    "click",
    showHowAIThinks
  );

/*
 * Demo
 */
document
  .querySelector(
    "#demo-button"
  )
  .addEventListener(
    "click",
    showLearnMinimax
  );

/*
 * Dialog close
 */
document
  .querySelector(
    "#dialog-close"
  )
  .addEventListener(
    "click",
    () =>
      elements.featureDialog.close()
  );

/*
 * Close dialog by clicking backdrop
 */
elements.featureDialog.addEventListener(
  "click",
  (event) => {
    if (
      event.target ===
      elements.featureDialog
    ) {
      elements.featureDialog.close();
    }
  }
);

/*
 * Brand link
 */
document
  .querySelector(
    "#brand-link"
  )
  .addEventListener(
    "click",
    (event) => {
      if (
        !elements.gameScreen.hidden
      ) {
        event.preventDefault();
        goToMainMenu();
      }
    }
  );

/* =========================================================
   INITIAL SETTINGS
========================================================= */

const savedSettings =
  loadSettings();

startingStones =
  savedSettings.startingStones;

maximumRemoval =
  savedSettings.maximumRemoval;

stones =
  startingStones;

setDifficulty(
  savedSettings.difficulty
);

setTurnTimeLimit(
  savedSettings.turnTimeLimit
);

updateRulePreview();