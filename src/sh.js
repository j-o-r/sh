// Copyright 2021 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
// 
//
// Original Source: zx
// Link to Original Source: https://github.com/google/zx
// Reason for Using This Code: 
// The core functionality of this code is highly beneficial. However, certain parts of the original code 
// were overwriting the global namespace with core libraries and variables. This was causing conflicts with 
// other packages (for instance, fetch) and introducing unexpected elements into my code base.
// Changes Made: 
// - The code has been or is being reformatted to comply with ES2020 standards.
// - Some methods were added and existing ones were modified to enhance usability.
// - The namespace has been changed from '$' to 'SH'.
// Modified by: jorrit.duin+sh[AT]gmail.com

import assert from 'node:assert';
import { AsyncLocalStorage } from 'node:async_hooks';
import which from 'which';
import { log, parseDuration, quote, quotePowerShell, } from './utils.js';
import ProcessPromise from './ProcessPromise.js';
// const processCwd = Symbol('processCwd');
const storage = new AsyncLocalStorage();

const defaults = {
	processCwd: '',
	verbose: false,
	env: {},
	shell: '',
	prefix: '',
};
if (process.platform == 'win32') {
	defaults.shell = which.sync('powershell.exe');
} else {
	defaults.shell = which.sync('bash');
	defaults.prefix = 'set -euo pipefail;';
}
/**
* Escape CLI arguments
* @retruns {string}
*/
const sanitizeArg = (arg) => {
	const s = `${arg}`;
	if (process.platform == 'win32') {
		return quotePowerShell(s)
	}
	return quote(s);
}

const getStore = () => {
	return storage.getStore() || defaults;
}

/**
* Creates a new ProcessPromise object that represents a command to be executed.
*
* @typedef {Function} Shell
* @type {function}
* @param {Array} pieces - An array of string literals from a template literal.
* @param {...*} args - The values to be interpolated into the string literals.
* @returns {ProcessPromise} A ProcessPromise object that represents the command.
* @throws {Error} Throws an error if any of the string literals in `pieces` is undefined.
*
* @property {boolean} verbose
*
* @example
* const command = await SH`echo 'Hello, world!'`;
*/
/** @type {Shell} */
const SH = new Proxy(function(pieces, ...args) {
	const from = new Error().stack.split(/^\s*at\s/m)[2].trim();
	if (pieces.some((p) => p == undefined)) {
		throw new Error(`Malformed command at ${from}`);
	}
	let cmd = pieces[0], i = 0;
	while (i < args.length) {
		let s;
		if (Array.isArray(args[i])) {
			s = args[i].map((x) => sanitizeArg(x)).join(' ');
		}
		else {
			s = sanitizeArg(args[i]);
		}
		cmd += s + pieces[++i];
	}
	let resolve, reject;

	const promise = new ProcessPromise((...args) => ([resolve, reject] = args));
	// re-add the environment
	defaults.processCwd = process.cwd();
	defaults.env = process.env,
		promise._bind(cmd, from, resolve, reject, getStore());
	// Postpone run to allow promise configuration.
	setImmediate(() => promise.isHalted || promise.run());
	return promise;
}, {
	// this will get and set from:
	// defaults OR storage (@see within());
	set(_, key, value) {
		const target = key in Function.prototype ? _ : getStore();
		Reflect.set(target, key, value);
		return true;
	},
	get(_, key) {
		const target = key in Function.prototype ? _ : getStore();
		return Reflect.get(target, key);
	},
});

/**
* Create a async context in an sync block
* @param {function} callback - async function
* @example
* const p = within(async () => {
*		const res = await Promise.all([
*			SH`sleep 1; echo 1`,
*			SH`sleep 2; echo 2`,
*			sleep(2),
*			SH`sleep 3; echo 3`
*		]);
*/
const within = (callback) => {
	// @ts-ignore
	return storage.run({ ...getStore() }, callback);
}
/**
* This function reads the standard input (stdin) for the current process.
* It is used to get piped content into a script.
* @example 
* const content = await stdin();
*/
const stdin = async () => {
	let buf = '';
	process.stdin.setEncoding('utf8');
	for await (const chunk of process.stdin) {
		buf += chunk;
	}
	return buf;
}
/**
* This function retries a command a specified number of times.
* @example 
* // Retry a command 3 times
* const p = await retry(3, () => SH`curl -s https://flipwrsi`);
* 
* // Retry a command 3 times with an interval of 1 second between each try
* const p = await retry(3, '1s', () => SH`curl -s https://flipwrsi`);
* 
* // Retry a command 3 times with irregular intervals using exponential backoff
* const p = await retry(3, expBackoff(), () => SH`curl -s https://flipwrsi`);
*/
const retry = async (count, a, b) => {
	const total = count;
	let callback;
	let delayStatic = 0;
	let delayGen;
	// @ts-ignore
	const verbose = SH.verbose;
	if (typeof a == 'function') {
		callback = a;
	}
	else {
		if (typeof a == 'object') {
			delayGen = a;
		}
		else {
			delayStatic = parseDuration(a);
		}
		// console.log(assert(b));
		assert(b);
		callback = b;
	}
	let lastErr;
	let attempt = 0;
	while (count-- > 0) {
		attempt++;
		try {
			return await callback();
		}
		catch (err) {
			let delay = 0;
			if (delayStatic > 0)
				delay = delayStatic;
			if (delayGen) delay = delayGen.next().value;
			log({
				verbose,
				kind: 'retry',
				error: ' FAIL ' +
					` Attempt: ${attempt}${total == Infinity ? '' : `/${total}`}` +
					(delay > 0 ? `; next in ${delay}ms` : ''),
			});
			lastErr = err;
			if (count == 0)
				break;
			if (delay)
				await sleep(delay);
		}
	}
	throw lastErr;
}
/**
* This function pauses or "sleeps" code execution for a specified duration.
* @param {string} duration - The duration to pause execution for, e.g., '100ms' or '3s'.
* 
* @example
* 
* const res = await Promise.all([
* 	SH`sleep 2; echo 2`,  // Sleep for 2 seconds
* 	sleep(2),             // Sleep for 2 seconds
* 	SH`sleep 3; echo 3`   // Sleep for 3 seconds
* ]);
*/

const sleep = (duration) => {
	return new Promise((resolve) => {
		setTimeout(resolve, parseDuration(duration));
	});
}
/**
* Change working directory
* @param {string} dir
*/
const cd = (dir) => {
	// @ts-ignore
	const verbose = SH.verbose;
	log({ kind: 'cd', dir, verbose });
	process.chdir(dir);
}
function* expBackoff(max = '60s', rand = '100ms') {
	const maxMs = parseDuration(max);
	const randMs = parseDuration(rand);
	let n = 1;
	while (true) {
		const ms = Math.floor(Math.random() * randMs);
		yield Math.min(2 ** n++, maxMs) + ms;
	}
}
// const syncCwd = () => {
// 	if (SH['processCwd'] != process.cwd())
// 		process.chdir(SH['processCwd']);
// }

export {
	/** @type {Shell} */
	SH,
	cd,
	sleep,
	retry,
	stdin,
	within,
	expBackoff,
}
