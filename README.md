# Stone Battle — AI Minimax Game

Stone Battle is a browser-based stone-removal game with a Minimax-powered opponent and a local two-player mode. Start with 15 stones, take 1–3 per turn, and try to take the last stone.

## Features

- AI vs Player and local Player 1 vs Player 2 modes
- A genuine Minimax AI with Easy, Medium, and Hard difficulty
- A live Minimax explainer with move scores and a bounded game tree
- AI decision analysis with actual scores, search depth, and visited-state counts
- Optional per-turn countdown (off, 15, 30, or 60 seconds); timeout passes the turn
- Custom starting pile (1–50 stones) and maximum removal per turn (1–10)
- 15 stones and moves of 1–3 stones
- Automatic turn handling and winner detection
- Responsive scoreboard, stone pile, and progress bar
- Restart and main-menu controls
- Persistent statistics and recent match history via browser local storage
- A Learn Minimax guide and AI demonstration panel
- Animated stone falls, impact, burst fragments, and restart return effects
- Works offline; no dependencies, installation, or backend

## Technologies

- HTML5
- CSS3
- Vanilla JavaScript
- Minimax algorithm

## How to Run

1. Open the project folder in VS Code.
2. Make sure `index.html`, `style.css`, and `script.js` are together in the folder.
3. In the VS Code terminal, make sure the current directory is the project folder, then run:

	```powershell
	python -m http.server 8000
	```

4. Open [http://localhost:8000](http://localhost:8000) in a browser to verify the game. Press `Ctrl+C` in the terminal to stop the server.

You can also open `index.html` directly in a browser or use the VS Code Live Server extension and choose **Open with Live Server**.

## AI Architecture

```text
User
 ↓
Game State
 ↓
Generate Legal Moves
 ↓
Minimax
 ↓
Evaluate Moves
 ↓
Select Best Move
 ↓
Update Game
 ↓
Check Winner
```

Minimax recursively explores legal choices from the current pile. It scores a win for the AI as `+1` and a loss as `-1`. MAX represents the AI, which selects the highest score; MIN represents the opponent, which selects the lowest. The game displays scores calculated by the active search and counts each state visited by the recursion.

### Difficulty Levels

- **Easy:** Runs a full Minimax evaluation, then occasionally chooses a legal move with a lower score to make the opponent less predictable.
- **Medium:** Uses Minimax with a four-ply search limit and a frontier evaluation for positions beyond that limit.
- **Hard:** Searches all reachable states to the end of the game and chooses an optimal move.

At 15 stones, a full search is small enough to run immediately in the browser. Choose a difficulty on the menu before starting an AI match. The setting is saved locally.

Choose a per-turn timer on the main menu before starting either game mode. The default is **Off**. When enabled, the countdown resets at the start of each human turn; reaching zero automatically passes that turn without removing stones. In AI mode, the AI's calculation turn is not timed. Difficulty and timer preferences are saved in browser local storage.

## Statistics and Match History

Completed matches update games, Player 1 wins and losses, win streak, AI-match results, and local two-player totals. The dashboard calculates win rate from completed games. The latest 10 matches are shown; up to 100 records are retained in local storage. Use the dashboard controls to clear history or reset statistics, with confirmation before either action. Browser storage is local to the current browser profile and device.

The **How AI Thinks** dialog shows the current pile, legal moves, scores, selected move, search depth, visited states, and a small MAX/MIN game tree. **Learn Minimax** also includes a live AI demonstration for the current pile.

## Game Rules

Both modes default to 15 stones and a maximum removal of 3 per turn. Before starting a game, customize the pile from 1–50 stones and the maximum removal from 1–10. The player may take any positive number up to the selected maximum, but never more stones than remain. Whoever takes the last stone wins. Custom rules are saved in browser storage and included in match history.

- **AI vs Player:** The AI goes first and plays against Player 1.
- **Player 1 vs Player 2:** Player 1 goes first; both players take turns on the same device. No AI is used.

## Project Structure

```text
stone-battle/
├── index.html
├── style.css
├── script.js
└── README.md
```

Stones and decorative artwork are made with CSS, so there are no external assets to download.

## Future Enhancements

- Difficulty levels
- Sound effects
- Score history and a leaderboard
- Turn timer
- More starting stones or alternative rules
- Adjustable AI difficulty