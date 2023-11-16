#! /usr/bin/env node

import { suite } from 'uvu';
import * as assert from 'uvu/assert';
import { SH, within, sleep, retry, expBackoff} from '../src/sh.js';
import ProcessOutput from '../src/ProcessOutput.js';
const test = suite('SH');

test('Elementary usages', async () => {
	let res = await SH`ls -FLa`.pipe(SH`grep package.json`);
	assert.equal(res instanceof ProcessOutput, true);
	assert.equal(res.exitCode, 0);
	assert.equal(res.stdout.trim(), 'package.json');
	res = await SH`ls -FLa | grep package.json`;
	assert.equal(res instanceof ProcessOutput, true);
	assert.equal(res.exitCode, 0);
	assert.equal(res.stdout.trim(), 'package.json');
})

test('within: async context, mutiple commands and a sleep', () => {
	SH.verbose = false;
	// 'within' Creates an async context
	within(async () => {
		const res = await Promise.all([
			SH`sleep 1; echo 1`,
			SH`sleep 2; echo 2`,
			sleep(2),
			SH`sleep 3; echo 3`
		]);
		assert.equal(res.length, 4);
	});
});

test(`retry`, async () => {
	try {
		// Number of retries
	  // const p = await retry(3, () => SH`curl -s https://flipwrsi`);
		// interval 1 s
	  // const p = await retry(3, '1s', () => SH`curl -s https://flipwrsi`);
		// exponential retry
	  const p = await retry(3, expBackoff(), () => SH`curl -s https://flipwrsi`);
		assert.unreachable('should have thrown');
	} catch (e) {
		console.error(e.toString());
		// Error === ProcessOutput
	  assert.equal(e instanceof ProcessOutput, true);
	  assert.equal(e.exitCode, 6);
	}
});

test('flags', async() => {
	const flags = ['-F', '-l', '-a']
	const res = await SH`ls ${flags} | grep README`;
	assert.equal(res.exitCode, 0);
})

test.run();
