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

import { spawn } from 'node:child_process';
import assert from 'node:assert';
import { log, errnoMessage, exitCodeInfo, noop, parseDuration, psTree } from './utils.js';
import ProcessOutput from './ProcessOutput.js';
/** 
* @typedef {Function} resolver
* @param {ProcessOutput} value
*/
/** 
* @typedef {Function} rejecter
* @param {ProcessOutput} value
*/
/**
* @typedef {Function} PromiseConstruct 
* @param {resolver} resolve
* @param {rejecter} reject
*/

class ProcessPromise extends Promise {
	#command = '';
	#from = '';
	/** @type {resolver} */
	#resolve = () => { };
	/** @type {rejecter} */
	#reject = () => { };
	#snapshot = {};
	#stdio = ['inherit', 'pipe', 'pipe'];
	#nothrow = false;
	#quiet = false;
	#resolved = false;
	#halted = false;
	#piped = false;
	#prerun = noop;
	#postrun = noop;
	/**
	* @param {PromiseConstruct} p - A function that takes two arguments, resolve and reject.
	*/
	constructor(p) {
    super(p)
	}
	/**
	* Set the environment 
	* and the 
	* @param {string} cmd - Command to execute
	* @param {string} from - Position in the codfe where this is triggred from
	* @param {function} resolve - Promise resolve method
	* @param {function} reject - Reject method
	* @param {object} options - Settings (options default)
	*/
	_bind(cmd, from, resolve, reject, options) {
		this.#command = cmd;
		this.#from = from;
		this.#resolve = resolve;
		this.#reject = reject;
		this.#snapshot = { ...options };
	}
	/**
	* Run the promise
	*/
	run() {
		const ENV = this.#snapshot;
		if (this.child) return this; // The _run() can be called from a few places.
		this.#prerun(); // In case $1.pipe($2), the $2 returned, and on $2._run() invoke $1._run().
		log({
			kind: 'cmd',
			cmd: this.#command,
			verbose: ENV.verbose && !this.#quiet,
		});
		const cwd = ENV['processCwd'];
		this.child = spawn(ENV.prefix + this.#command, {
			cwd,
			// cwd: $.cwd ?? $[processCwd],
			shell: typeof ENV.shell === 'string' ? ENV.shell : true,
			stdio: this.#stdio,
			windowsHide: true,
			env: ENV.env,
		});
		this.child.on('close', (code, signal) => {
			let message = `exit code: ${code}`;
			if (code != 0 || signal != null) {
				message = `${stderr || '\n'}    at ${this.#from}`;
				message += `\n    exit code: ${code}${exitCodeInfo(code) ? ' (' + exitCodeInfo(code) + ')' : ''}`;
				if (signal != null) {
					message += `\n    signal: ${signal}`;
				}
			}
			let output = new ProcessOutput(code, signal, stdout, stderr, combined, message);
			if (code === 0 || this.#nothrow) {
				this.#resolve(output);
			}
			else {
				this.#reject(output);
			}
			this.#resolved = true;
		});
		this.child.on('error', (err) => {
			const message = `${err.message}\n` +
				`    errno: ${err.errno} (${errnoMessage(err.errno)})\n` +
				`    code: ${err.code}\n` +
				`    at ${this.#from}`;
			this.#reject(new ProcessOutput(null, null, stdout, stderr, combined, message));
			this.#resolved = true;
		});
		let stdout = '', stderr = '', combined = '';
		/** @param {Blob} data */
		const onStdout = (data) => {
			log({ kind: 'stdout', data, verbose: ENV.verbose && !this.#quiet });
			stdout += data;
			combined += data;
		};
		/** @param {Blob} data */
		const onStderr = (data) => {
			log({ kind: 'stderr', data, verbose: ENV.verbose && !this.#quiet });
			stderr += data;
			combined += data;
		};
		if (!this.#piped)
			this.child.stdout?.on('data', onStdout); // If process is piped, don't collect or print output.
		this.child.stderr?.on('data', onStderr); // Stderr should be printed regardless of piping.
		this.#postrun(); // In case $1.pipe($2), after both subprocesses are running, we can pipe $1.stdout to $2.stdin.
		if (this._timeout && this._timeoutSignal) {
			const t = setTimeout(() => this.kill(this._timeoutSignal), this._timeout);
			this.finally(() => clearTimeout(t)).catch(noop);
		}
		return this;
	}
	/**
	* stdin child stream
	* @retruns {Writeable}
	*/
	get stdin() {
		this.stdio('pipe');
		this.run();
		assert(this.child);
		if (this.child.stdin == null)
			throw new Error('The stdin of subprocess is null.');
		return this.child.stdin;
	}
	/**
	* stdout child stream
	* @retruns {Readable}
	*/
	get stdout() {
		this.run();
		assert(this.child);
		if (this.child.stdout == null)
			throw new Error('The stdout of subprocess is null.');
		return this.child.stdout;
	}
	/**
	* stderr child stream
	* @retruns {Readable}
	*/
	get stderr() {
		this.run();
		assert(this.child);
		if (this.child.stderr == null)
			throw new Error('The stderr of subprocess is null.');
		return this.child.stderr;
	}
	/**
	* process exit code
	* @returns {Promise<number>}
	*/
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
	/**
	* Pipe the output to the input to the next Promise
	* @example
	* const res = await SH`ls -FLa`.pipe(SH`grep package.json`);
	*/
	pipe(dest) {
		if (typeof dest == 'string')
			throw new Error('The pipe() method does not take strings. Forgot SH?');
		if (this.#resolved) {
			if (dest instanceof ProcessPromise)
				dest.stdin.end(); // In case of piped stdin, we may want to close stdin of dest as well.
			throw new Error("The pipe() method shouldn't be called after promise is already resolved!");
		}
		this.#piped = true;
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
	/**
	* Send a KILL signal to the child process
	*/
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
		this.#stdio = [stdin, stdout, stderr];
		return this;
	}
	/**
	* Do not throw
	*/
	nothrow() {
		this.#nothrow = true;
		return this;
	}
	/**
	* supress log output
	* SH.verbose = false; does the same
	*/
	quiet() {
		this.#quiet = true;
		return this;
	}
	/**
	* Show log output in the console
	*/
	verbose() {
		this._quiet = false;
		return this;
	}
	/** 
	* Set a timeout to kill a process
	*
	* @param {string} d - 10s, 1000ms
	* @param {string} [signal] - default "SIGTERM" Signal to send to kill the proces
	*/
	timeout(d, signal = 'SIGTERM') {
		this._timeout = parseDuration(d);
		this._timeoutSignal = signal;
		return this;
	}
  /**
	* stop execution for the next step
	*/
	halt() {
		this.#halted = true;
		return this;
	}
	/** 
	* @private
	* Set a prerun action, internal use only
	* @param {function} f
	*/
	set _prerun(f) {
		// @ts-ignore
		this.#prerun = f;
	}
	/** 
	* @private
	* Set a postrun action, internal use only
	* @param {function} f
	*/
	set _postrun(f) {
		// @ts-ignore
		this.#postrun = f;
	}
  /**
	* Is this promise halted?
	* @returns {boolean}
	*/
	get isHalted() {
		return this.#halted;
	}
}
export default ProcessPromise;
