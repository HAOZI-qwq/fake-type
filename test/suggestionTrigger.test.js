const test = require('node:test');
const assert = require('node:assert/strict');
const { shouldTriggerSuggestion, SuggestionTriggerScheduler } = require('../out/suggestionTrigger.js');

test('triggers only while current text is a non-complete prefix of preset content', () => {
  assert.equal(shouldTriggerSuggestion('con', 'console.log("ok")'), true);
  assert.equal(shouldTriggerSuggestion('console.log("ok")', 'console.log("ok")'), false);
  assert.equal(shouldTriggerSuggestion('cox', 'console.log("ok")'), false);
  assert.equal(shouldTriggerSuggestion('const ', 'const value = 1'), false);
  assert.equal(shouldTriggerSuggestion('obj.', 'obj.method()'), true);
  assert.equal(shouldTriggerSuggestion('', 'console.log("ok")'), false);
});

test('coalesces rapid schedule calls into one suggestion trigger', async () => {
  let calls = 0;
  const scheduler = new SuggestionTriggerScheduler(() => { calls += 1; }, 20);
  scheduler.schedule();
  scheduler.schedule();
  scheduler.schedule();
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.equal(calls, 1);
  scheduler.dispose();
});

test('does not postpone an already scheduled suggestion trigger', async () => {
  let calls = 0;
  const scheduler = new SuggestionTriggerScheduler(() => { calls += 1; }, 50);
  scheduler.schedule();
  await new Promise(resolve => setTimeout(resolve, 30));
  scheduler.schedule();
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(calls, 1);
  scheduler.dispose();
});
