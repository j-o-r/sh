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

// Why is it extending an error?
// The error is hidden and only accsisable with .toString();
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
	}
	get stdout() {
		return this.#stdout;
	}
	get stderr() {
		return this.#stderr;
	}
	get output() {
		return this.#combined;
	}
	get exitCode() {
		return this.#code;
	}
	get signal() {
		return this.#signal;
	}
	/** Custom: called upon console.log(output) */
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
