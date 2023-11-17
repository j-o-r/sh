#!/usr/bin/env node
/*
# Workspace

This script sets up a tmux session with multiple windows.

```
   +---+---+
   |   0   |
   +---+---+
   | 1 | 2 |
   +---+---+
```
0. Main Editor Window
1. CLI Test/Commands Window
2. qwe - AI Environment (a custom, homebrewed copilot for this project)

This script resizes the tmux session to fit the available screen size and prepares applications/tools for use in this session.
*/
import { SH } from './src/sh.js';
import path from 'node:path';
import { fileURLToPath } from 'url';
// @ts-ignore
SH.verbose = false;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SESSION = 'j-o-r-sh';
const EXPERT = 'Coder';
const heightp = 75;

const socketFile = path.resolve(__dirname, '.cache/', `${EXPERT}.sock`);
const tmux = process.env.TMUX;
if (tmux) throw 'Do not run this in a tmux session';
try {
  const sessions = await SH`tmux ls`;
  if (sessions.includes(`${SESSION}:`)) {
    console.log(`Session ${SESSION} already created`);
    process.exit(1);
  }
} catch (_e) {}
const lines = parseInt(await SH`tput lines`);
const cols = parseInt(await SH`tput cols`);
// # Calculate height based on available line height
const HEIGHT = Math.ceil(lines * heightp / 100);
// Create tmux layout
const flags = [
  '-d',
  '-s',
	SESSION,
	'-x',
	`${cols}`,
	'-y',
	`${lines}`
];
await SH`tmux new-session ${flags}`;
// Set the environment BEFORE creating any panes
// to be able to find 'this' socket endpoint in 'this' tmux session
await SH`tmux setenv -t ${SESSION} WORKSPACE_SOCKET ${socketFile}`;
// 
await SH`tmux rename-window 'edit'`;
// # create 2 rows
await SH`tmux split-window -v`;
// Set the percentage height calculated
await SH`tmux resize-pane -t ${SESSION}:0.0 -y ${HEIGHT}`;
await SH`tmux select-pane -t ${SESSION}:0.1`;
// # Focus on the second pane
// # Devide row 1 in 2 panes
await SH`tmux split-window -h`;
await SH`tmux send-keys -t ${SESSION}:0.2 'joai ${EXPERT} --socket ${socketFile}' C-m`;
// set focus on main window
await SH`tmux select-window -t ${SESSION}:0`;
// Select main pane
await SH`tmux select-pane -t ${SESSION}:0.0`;
// attach to session
await SH`tmux attach -t ${SESSION}`;
