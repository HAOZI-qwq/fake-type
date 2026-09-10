const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_COMPLETION_SETTINGS,
  normalizeCompletionSettings,
  shouldForceSuggest
} = require('../out/completionSettings.js');

test('normalizes missing settings to defaults', () => {
  assert.deepEqual(normalizeCompletionSettings(undefined), DEFAULT_COMPLETION_SETTINGS);
});

test('clamps delay and falls back from invalid mode and policy', () => {
  const low = normalizeCompletionSettings({ delayMs: -20, mode: 'bad', triggerPolicy: 'bad' });
  assert.equal(low.delayMs, 0);
  assert.equal(low.mode, 'nativeFallback');
  assert.equal(low.triggerPolicy, 'code');
  const high = normalizeCompletionSettings({ delayMs: 9999 });
  assert.equal(high.delayMs, 500);
});

test('does not force suggestions when disabled or in native mode', () => {
  assert.equal(shouldForceSuggest('a', { ...DEFAULT_COMPLETION_SETTINGS, enabled: false }), false);
  assert.equal(shouldForceSuggest('a', { ...DEFAULT_COMPLETION_SETTINGS, mode: 'native' }), false);
});

test('identifier policy triggers only identifier-like characters', () => {
  const settings = { ...DEFAULT_COMPLETION_SETTINGS, triggerPolicy: 'identifier' };
  assert.equal(shouldForceSuggest('a', settings), true);
  assert.equal(shouldForceSuggest('_', settings), true);
  assert.equal(shouldForceSuggest('.', settings), false);
  assert.equal(shouldForceSuggest(' ', settings), false);
});

test('code policy includes common completion trigger punctuation but excludes whitespace', () => {
  const settings = { ...DEFAULT_COMPLETION_SETTINGS, triggerPolicy: 'code' };
  assert.equal(shouldForceSuggest('a', settings), true);
  assert.equal(shouldForceSuggest('.', settings), true);
  assert.equal(shouldForceSuggest('@', settings), true);
  assert.equal(shouldForceSuggest(' ', settings), false);
  assert.equal(shouldForceSuggest('\n', settings), false);
});

test('always policy triggers for any non-empty character', () => {
  const settings = { ...DEFAULT_COMPLETION_SETTINGS, triggerPolicy: 'always' };
  assert.equal(shouldForceSuggest(' ', settings), true);
  assert.equal(shouldForceSuggest('\n', settings), true);
  assert.equal(shouldForceSuggest('', settings), false);
});
