import {it} from 'node:test';
import assert from 'node:assert/strict';
import {evolve, parseNextStep, describeEvolution, type EvolutionDeps} from '../services/selfEvolutionService.ts';
import type {CheckResult} from '../utils/projectChecks.ts';

const base = {'src/math.ts': 'export const add = (a: number, b: number) => a - b;\n'};
const reply = (edits: unknown[], extra: Record<string, unknown> = {}) => JSON.stringify({text: 'ok', speechText: 'ok', edits, ...extra});
const pass: CheckResult = {label: 'Tests', command: 'npm test', success: true, exit_code: 0, timed_out: false, output: ''};
const fail = (output: string): CheckResult => ({label: 'Tests', command: 'npm test', success: false, exit_code: 1, timed_out: false, output});

/** Checks pass only when add() really adds. */
function harness(answers: string[]) {
  const asked: string[] = [];
  const progress: string[] = [];
  const checked: string[][] = [];
  const deps: EvolutionDeps = {
    ask: async (followUp) => { asked.push(followUp); const next = answers.shift(); if (!next) throw new Error('no more answers'); return next; },
    check: async (files) => {
      checked.push(files.map((f) => f.path));
      const math = files.find((f) => f.path === 'src/math.ts')?.content ?? base['src/math.ts'];
      return [math.includes('a + b') ? pass : fail('AssertionError: add(2, 2) expected 4, got 0')];
    },
    progress: (t) => progress.push(t),
  };
  return {deps, asked, progress, checked};
}

it('fixes a failing edit from the real test output before the user sees it', async () => {
  const first = reply([{path: 'src/math.ts', find: 'a - b', replace: 'a * b'}]);
  const {deps, asked, progress} = harness([reply([{path: 'src/math.ts', find: 'a * b', replace: 'a + b'}], {text: 'Fixed the operator.'})]);
  const r = await evolve(first, base, deps);
  assert.equal(r.verified, 'passed');
  assert.equal(r.fixAttempts, 1);
  assert.equal(r.files['src/math.ts'], 'export const add = (a: number, b: number) => a + b;\n');
  assert.equal(base['src/math.ts'].includes('a - b'), true, 'the real files map is not modified');
  assert.match(asked[0], /"Tests" \(`npm test`\) failed/);
  assert.match(asked[0], /expected 4, got 0/);
  assert.match(asked[0], /untrusted tool output/);
  assert.match(asked[0], /a \* b/, 'sends the current scratch contents');
  assert.ok(progress.some((p) => /Fixing it \(attempt 1 of 3\)/.test(p)));
  assert.match(describeEvolution(r), /Tested before showing you:\*\* ✓ Tests \(fixed 1 problem/);
});

it('stops after the fix budget and reports the change as not passing', async () => {
  const wrong = reply([{path: 'src/math.ts', content: 'export const add = () => 0;\n'}]);
  const {deps, asked} = harness([wrong, wrong, wrong, wrong]);
  const r = await evolve(wrong, base, deps, {maxFixes: 2, maxSteps: 6});
  assert.equal(r.verified, 'failed');
  assert.equal(r.fixAttempts, 2);
  assert.equal(asked.length, 2);
  assert.match(describeEvolution(r), /Not passing yet:.*still failing after 2 fix attempts/s);
});

it('builds a big feature step by step, testing each step', async () => {
  const step1 = reply([{path: 'src/math.ts', find: 'a - b', replace: 'a + b'}], {next_step: 'add a multiply helper'});
  const step2 = reply([{path: 'src/multiply.ts', content: 'export const mul = (a: number, b: number) => a * b;\n'}], {next_step: 'export it from an index'});
  const step3 = reply([{path: 'src/index.ts', content: "export * from './math';\nexport * from './multiply';\n"}]);
  const {deps, asked, checked} = harness([step2, step3]);
  const r = await evolve(step1, base, deps);
  assert.equal(r.verified, 'passed');
  assert.deepEqual(r.steps, ['add a multiply helper', 'export it from an index']);
  assert.deepEqual(r.touched.sort(), ['src/index.ts', 'src/math.ts', 'src/multiply.ts']);
  assert.equal(checked.length, 3, 'every step was tested');
  assert.match(asked[0], /Continue with the next step: add a multiply helper/);
  assert.equal(parseNextStep(step3), null);
});

it('asks again when an edit does not apply, and never throws on a model failure', async () => {
  const miss = reply([{path: 'src/math.ts', find: 'not there', replace: 'x'}]);
  const {deps, asked} = harness([]); // the model call fails
  const r = await evolve(miss, base, deps);
  assert.match(asked[0], /could not be applied/);
  assert.match(r.stoppedBecause ?? '', /stopped responding/);
  assert.deepEqual(r.problems, ['src/math.ts: the text to replace was not found in the current file']);
});

it('reports untested changes honestly outside the desktop app', async () => {
  const edit = reply([{path: 'src/math.ts', find: 'a - b', replace: 'a + b'}]);
  const r = await evolve(edit, base, {ask: async () => '', check: async () => null, progress: () => {}});
  assert.equal(r.verified, 'unverified');
  assert.match(describeEvolution(r), /Not tested \(testing needs the AXION desktop app\)/);
});
