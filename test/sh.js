#! /usr/bin/env node

import { suite } from 'uvu';
import * as assert from 'uvu/assert';
import { SH, within, sleep, retry, expBackoff } from '../src/sh.js';
import ProcessOutput from '../src/ProcessOutput.js';
const test = suite('SH');

test('Elementary usages 1', async () => {
	const res = await SH`ls -FLa`.pipe(SH`grep package.json`);
	assert.equal(res instanceof ProcessOutput, true);
	assert.equal(res.exitCode, 0);
	assert.equal(res.stdout.trim(), 'package.json');
	assert.equal(res.toString(), 'package.json');
})

test('Elementary usages 2', async () => {
	const res = await SH`ls -FLa | grep package.json`;
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
		assert.equal(res[3].toString().trim(), '3');
	});
});

test(`retry`, async () => {
	SH.verbose = false;
	try {
		const p = await retry(3, expBackoff(), () => SH`curl -s https://flipwrsi`);
		assert.unreachable('should have thrown');
	} catch (e) {
		assert.equal(e instanceof ProcessOutput, true);
		assert.equal(e.exitCode, 6);
	}
});

test('flags', async () => {
	const flags = ['-F', '-l', '-a']
	const res = await SH`ls ${flags} | grep README`;
	assert.equal(res.exitCode, 0);
});

test('error', async () => {
	SH.verbose = false;
	try {
		const res = await SH`$$BREAK IT`;
		assert.unreachable('should have thrown');
	} catch (e) {
		console.log(e);
		assert.equal(e.exitCode, 127);
	}
})
test('kill', async () => {
	const p = SH`sleep 5; echo 1`;
	setTimeout(async () => {
		const pids = await p.kill();
		assert.equal(pids.length, 2);
	}, 10);
	// The promise will error 
	// when killed
	p.catch((e) => {
		assert.equal(e.exitCode, null);
	});
});
test('kill, not throw', async () => {
	const p = SH`sleep 5; echo 1`;
	p.nothrow();
	setTimeout(async () => {
		const pids = await p.kill();
		assert.equal(pids.length, 2);
	}, 10);
	p.catch((e) => {
		assert.unreachable('should not have thrown');
	});
});
test.run();
