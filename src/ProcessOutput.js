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

import { inspect } from 'node:util';
import { exitCodeInfo} from './utils.js';

/**
* The ProcessPromise returns a ProcessOutput even when it fails, by rejecting it.
* The extension of the Error class is implemented to ensure compatibility when an Error is expected upon rejection.
*/
class ProcessOutput extends Error {
	#code = 0;
	#signal;
	#stdout = '';
	#stderr = '';
	#combined = '';
	/**
	* @param {number} code - exit code
	* @param {string} signal - SIGTERM ...
	* @param {string} stdout - std reponse string
	* @param {string} stderr - error reponse string
	* @param {string} combined - stderr + stdout
	* @param {string} message - Error message
	*/
	constructor(code, signal, stdout = '', stderr = '', combined = '', message = '') {
		super(message);
		this.#code = code;
		this.#signal = signal;
		this.#stdout = stdout;
		this.#stderr = stderr;
		this.#combined = combined;
		this.name = 'ProcessOutput';
	}
	/**
	* This string represents the standard output (stdout) from the child process.
	* @returns {string}
	*/
	get stdout() {
		return this.#stdout;
	}
	/**
	* This string represents the error output (stderr) from the child process.
	* @returns {string}
	*/
	get stderr() {
		return this.#stderr;
	}

	/**
	* This is an internal method that is often invoked automatically 
	* by various JavaScript methods. 
	* It consolidates the entire output for completeness and facilitates further processing.
	* 
	* @returns {string} The consolidated output as a
	*/
	toString() {
		return this.#combined.trim();
	}
	/**
	* This represents the exit code returned by the external process.
	* @returns {number} The exit
	*/
	get exitCode() {
		return this.#code;
	}
	/**
	* This represents the exit signal, for example, "SIGTERM", received from the child process.
	* @returns {string} The exit signal from the child
	*/
	get signal() {
		return this.#signal;
	}
 	/** 
	* This method is used for debugging purposes. It displays the current state of the object
	* when passed to the console.log function.
	*/
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
export default ProcessOutput;
