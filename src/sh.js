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
/*
* Source: zx
* Original Source Link: https://github.com/google/zx
* Reason for Copy: 
* The core part of this code is convenient and useful. However, other parts overwrite the global namespace 
* with core libraries and variables, causing conflicts with other packages (e.g., fetch) or introducing unexpected 
* elements into my code base.
* Modifications: 
* - Reformatted the code to ES2020 standards.
* - Added and modified some methods to increase usability.
* - Changed namespace from '$' to 'SH'.
* Author: jorrit.duin+sh[AT]gmail.com
*/

import assert from 'node:assert';
import { spawn } from 'node:child_process';
import { AsyncLocalStorage, createHook } from 'node:async_hooks';
import { inspect } from 'node:util';
import which from 'which';
import { errnoMessage, exitCodeInfo, formatCmd, noop, parseDuration, psTree, quote, quotePowerShell, } from './utils.js';

const processCwd = Symbol('processCwd');
const storage = new AsyncLocalStorage();
const hook = createHook({
	init: syncCwd,
	before: syncCwd,
	promiseResolve: syncCwd,
	after: syncCwd,
	destroy: syncCwd,
});
hook.enable();
export const defaults = {
	[processCwd]: process.cwd(),
	verbose: false,
	env: process.env,
	shell: true,
	prefix: '',
	quote: () => {
		throw new Error('No quote function is defined: https://ï.at/no-quote-func');
	},
	spawn,
	log,
};
try {
	defaults.shell = which.sync('bash');
	defaults.prefix = 'set -euo pipefail;';
	defaults.quote = quote;
}
catch (err) {
	if (process.platform == 'win32') {
		defaults.shell = which.sync('powershell.exe');
		defaults.quote = quotePowerShell;
	}
}
function getStore() {
	return storage.getStore() || defaults;
}

export const SH = new Proxy(function(pieces, ...args) {
	const from = new Error().stack.split(/^\s*at\s/m)[2].trim();
	if (pieces.some((p) => p == undefined)) {
		throw new Error(`Malformed command at ${from}`);
	}
	let resolve, reject;
	const promise = new ProcessPromise((...args) => ([resolve, reject] = args));
	let cmd = pieces[0], i = 0;
	while (i < args.length) {
		let s;
		if (Array.isArray(args[i])) {
			s = args[i].map((x) => SH.quote(substitute(x))).join(' ');
		}
		else {
			s = SH.quote(substitute(args[i]));
		}
		cmd += s + pieces[++i];
	}
	promise._bind(cmd, from, resolve, reject, getStore());
	// Postpone run to allow promise configuration.
	setImmediate(() => promise.isHalted || promise.run());
	return promise;
}, {
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
function substitute(arg) {
	if (arg?.stdout) {
		return arg.stdout.replace(/\n$/, '');
	}
	return `${arg}`;
}
export class ProcessPromise extends Promise {
	constructor() {
		super(...arguments);
		this._command = '';
		this._from = '';
		this._resolve = noop;
		this._reject = noop;
		this._snapshot = getStore();
		this._stdio = ['inherit', 'pipe', 'pipe'];
		this._nothrow = false;
		this._quiet = false;
		this._resolved = false;
		this._halted = false;
		this._piped = false;
		this._prerun = noop;
		this._postrun = noop;
	}
	_bind(cmd, from, resolve, reject, options) {
		this._command = cmd;
		this._from = from;
		this._resolve = resolve;
		this._reject = reject;
		this._snapshot = { ...options };
	}
	run() {
		const $ = this._snapshot;
		if (this.child)
			return this; // The _run() can be called from a few places.
		this._prerun(); // In case $1.pipe($2), the $2 returned, and on $2._run() invoke $1._run().
		$.log({
			kind: 'cmd',
			cmd: this._command,
			verbose: $.verbose && !this._quiet,
		});
		this.child = $.spawn($.prefix + this._command, {
			cwd: $.cwd ?? $[processCwd],
			shell: typeof $.shell === 'string' ? $.shell : true,
			stdio: this._stdio,
			windowsHide: true,
			env: $.env,
		});
		this.child.on('close', (code, signal) => {
			let message = `exit code: ${code}`;
			if (code != 0 || signal != null) {
				message = `${stderr || '\n'}    at ${this._from}`;
				message += `\n    exit code: ${code}${exitCodeInfo(code) ? ' (' + exitCodeInfo(code) + ')' : ''}`;
				if (signal != null) {
					message += `\n    signal: ${signal}`;
				}
			}
			let output = new ProcessOutput(code, signal, stdout, stderr, combined, message);
			if (code === 0 || this._nothrow) {
				this._resolve(output);
			}
			else {
				this._reject(output);
			}
			this._resolved = true;
		});
		this.child.on('error', (err) => {
			const message = `${err.message}\n` +
				`    errno: ${err.errno} (${errnoMessage(err.errno)})\n` +
				`    code: ${err.code}\n` +
				`    at ${this._from}`;
			this._reject(new ProcessOutput(null, null, stdout, stderr, combined, message));
			this._resolved = true;
		});
		let stdout = '', stderr = '', combined = '';
		let onStdout = (data) => {
			$.log({ kind: 'stdout', data, verbose: $.verbose && !this._quiet });
			stdout += data;
			combined += data;
		};
		let onStderr = (data) => {
			$.log({ kind: 'stderr', data, verbose: $.verbose && !this._quiet });
			stderr += data;
			combined += data;
		};
		if (!this._piped)
			this.child.stdout?.on('data', onStdout); // If process is piped, don't collect or print output.
		this.child.stderr?.on('data', onStderr); // Stderr should be printed regardless of piping.
		this._postrun(); // In case $1.pipe($2), after both subprocesses are running, we can pipe $1.stdout to $2.stdin.
		if (this._timeout && this._timeoutSignal) {
			const t = setTimeout(() => this.kill(this._timeoutSignal), this._timeout);
			this.finally(() => clearTimeout(t)).catch(noop);
		}
		return this;
	}
	get stdin() {
		this.stdio('pipe');
		this.run();
		assert(this.child);
		if (this.child.stdin == null)
			throw new Error('The stdin of subprocess is null.');
		return this.child.stdin;
	}
	get stdout() {
		this.run();
		assert(this.child);
		if (this.child.stdout == null)
			throw new Error('The stdout of subprocess is null.');
		return this.child.stdout;
	}
	get stderr() {
		this.run();
		assert(this.child);
		if (this.child.stderr == null)
			throw new Error('The stderr of subprocess is null.');
		return this.child.stderr;
	}
	get exitCode() {
		return this.then((p) => p.exitCode, (p) => p.exitCode);
	}
	then(onfulfilled, onrejected) {
		if (this.isHalted && !this.child) {
			throw new Error('The process is halted!');
		}
		return super.then(onfulfilled, onrejected);
	}
	catch(onrejected) {
		return super.catch(onrejected);
	}
	pipe(dest) {
		if (typeof dest == 'string')
			throw new Error('The pipe() method does not take strings. Forgot SH?');
		if (this._resolved) {
			if (dest instanceof ProcessPromise)
				dest.stdin.end(); // In case of piped stdin, we may want to close stdin of dest as well.
			throw new Error("The pipe() method shouldn't be called after promise is already resolved!");
		}
		this._piped = true;
		if (dest instanceof ProcessPromise) {
			dest.stdio('pipe');
			dest._prerun = this.run.bind(this);
			dest._postrun = () => {
				if (!dest.child)
					throw new Error('Access to stdin of pipe destination without creation a subprocess.');
				this.stdout.pipe(dest.stdin);
			};
			return dest;
		}
		else {
			this._postrun = () => this.stdout.pipe(dest);
			return this;
		}
	}
	async kill(signal = 'SIGTERM') {
		if (!this.child)
			throw new Error('Trying to kill a process without creating one.');
		if (!this.child.pid)
			throw new Error('The process pid is undefined.');
		let children = await psTree(this.child.pid);
		for (const p of children) {
			try {
				process.kill(+p.PID, signal);
			}
			catch (e) { }
		}
		try {
			process.kill(this.child.pid, signal);
		}
		catch (e) { }
	}
	stdio(stdin, stdout = 'pipe', stderr = 'pipe') {
		this._stdio = [stdin, stdout, stderr];
		return this;
	}
	nothrow() {
		this._nothrow = true;
		return this;
	}
	quiet() {
		this._quiet = true;
		return this;
	}
	verbose() {
		this._quiet = false;
		return this;
	}
	timeout(d, signal = 'SIGTERM') {
		this._timeout = parseDuration(d);
		this._timeoutSignal = signal;
		return this;
	}
	halt() {
		this._halted = true;
		return this;
	}
	get isHalted() {
		return this._halted;
	}
}
export class ProcessOutput extends Error {
	constructor(code, signal, stdout, stderr, combined, message) {
		super(message);
		this._code = code;
		this._signal = signal;
		this._stdout = stdout;
		this._stderr = stderr;
		this._combined = combined;
	}
	toString() {
		return this._combined;
	}
	get stdout() {
		return this._stdout;
	}
	get stderr() {
		return this._stderr;
	}
	get exitCode() {
		return this._code;
	}
	get signal() {
		return this._signal;
	}
	[inspect.custom]() {
		let stringify = (s) => s.length === 0 ? "''" : inspect(s);
		return `ProcessOutput {
  stdout: ${stringify(this.stdout)},
  stderr: ${stringify(this.stderr)},
  signal: ${inspect(this.signal)},
  exitCode: ${(this.exitCode)}${exitCodeInfo(this.exitCode)
				? ' (' + exitCodeInfo(this.exitCode) + ')'
				: ''}
}`;
	}
}
export function within(callback) {
	return storage.run({ ...getStore() }, callback);
}

export async function stdin() {
	let buf = '';
	process.stdin.setEncoding('utf8');
	for await (const chunk of process.stdin) {
		buf += chunk;
	}
	return buf;
}
export async function retry(count, a, b) {
	const total = count;
	let callback;
	let delayStatic = 0;
	let delayGen;
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
			if (delayGen)
				delay = delayGen.next().value;
			SH.log({
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

export function sleep(duration) {
	return new Promise((resolve) => {
		setTimeout(resolve, parseDuration(duration));
	});
}
export function* expBackoff(max = '60s', rand = '100ms') {
	const maxMs = parseDuration(max);
	const randMs = parseDuration(rand);
	let n = 1;
	while (true) {
		const ms = Math.floor(Math.random() * randMs);
		yield Math.min(2 ** n++, maxMs) + ms;
	}
}
function syncCwd() {
	if (SH[processCwd] != process.cwd())
		process.chdir(SH[processCwd]);
}
export function log(entry) {
	switch (entry.kind) {
		case 'cmd':
			if (!entry.verbose)
				return;
			process.stderr.write(formatCmd(entry.cmd));
			break;
		case 'stdout':
		case 'stderr':
			if (!entry.verbose)
				return;
			process.stderr.write(entry.data);
			break;
		case 'retry':
			if (!SH.verbose)
				return;
			process.stderr.write(entry.error + '\n');
	}
}