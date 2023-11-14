#!/usr/bin/env node
/**
* create a tmux session
* - Create the windows
* - Activate AI helper
*/
import { SH } from './src/sh.js';
import path from 'node:path';

import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SESSION = 'SH';
const EXPERT = 'Coder';
SH.verbose = true;
// first row height percentage. (0:0)
const heightp = 75;

const socketFile = path.resolve(__dirname, '.cache/', `${EXPERT}.sock`);
const tmux = process.env.TMUX;
if (tmux) throw 'Do not run this in a tmux session';
try {
  const sessions = (await SH`tmux ls`).stdout;
  if (sessions.includes(`${SESSION}:`)) throw `Session ${SESSION} already created` ;
} catch (_e) {}
const lines = parseInt((await SH`tput lines`).stdout.trim());
const cols = parseInt((await SH`tput cols`).stdout.trim());
// # Calculate height based on available line height
const HEIGHT = Math.ceil(lines * heightp / 100);
console.log({HEIGHT});
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
// Be able to find 'this' socket endpoint in 'this' tmux session
await SH`tmux setenv -t ${SESSION} WORKSPACE_SOCKET ${socketFile}`;
// tmux new-session -d -s $SESSION -x "$cols" -y "$lines"
await SH`tmux rename-window 'edit'`;
// # create 2 rows
await SH`tmux split-window -v`;
// Set the percentage height calculated
await SH`tmux resize-pane -t ${SESSION}:0.0 -y ${HEIGHT}`;
await SH`tmux select-pane -t ${SESSION}:0.1`;
// # Focus on the second pane
// # Devide row 1 in 2 panes
await SH`tmux split-window -h`;
// # tmux display-message -p '#S'
await SH`tmux send-keys -t ${SESSION}:0.2 'joai ${EXPERT} --socket ${socketFile}' C-m`;
// set focus on main window
await SH`tmux select-window -t ${SESSION}:0`;
// Select main pane
await SH`tmux select-pane -t ${SESSION}:0.0`;

// FIrst select window
await SH`tmux select-window -t ${SESSION}:0`;
// Then select pane for this to work
await SH`tmux select-pane -t ${SESSION}:0.0`;
// attach to session
await SH`tmux attach -t ${SESSION}`;
