const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_COMPLETION_SETTINGS,
  normalizeCompletionSettings,
  shouldForceSuggest,
  getPresetCompletion,
  shouldHideSuggestWidgetBeforeTyping,
  shouldProvidePresetCompletion
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

test('builds a preselected completion that replaces the typed preset prefix', () => {
  assert.equal(typeof getPresetCompletion, 'function');
  assert.deepEqual(getPresetCompletion('console.log(value);', 3), {
    label: 'console',
    insertText: 'console',
    filterText: 'con',
    replacementLength: 3,
    presetEndIndex: 7,
    preselect: true,
    sortText: '\u0000fake-type',
    commitCharacters: []
  });
  assert.deepEqual(getPresetCompletion('<section class-name="demo">', 4), {
    label: 'section',
    insertText: 'section',
    filterText: 'sec',
    replacementLength: 3,
    presetEndIndex: 8,
    preselect: true,
    sortText: '\u0000fake-type',
    commitCharacters: []
  });
  assert.equal(getPresetCompletion('console.log(value);', 7), undefined);
  assert.equal(getPresetCompletion('const value = 1;', 6), undefined);
});

test('preset completion keeps astral Unicode letters in the typed prefix', () => {
  assert.deepEqual(getPresetCompletion('𐐀alpha', 3), {
    label: '𐐀alpha',
    insertText: '𐐀alpha',
    filterText: '𐐀a',
    replacementLength: 3,
    presetEndIndex: 7,
    preselect: true,
    sortText: '\u0000fake-type',
    commitCharacters: []
  });
});

test('structural punctuation closes an unsafe suggestion before native typing', () => {
  assert.equal(typeof shouldHideSuggestWidgetBeforeTyping, 'function');
  assert.equal(shouldHideSuggestWidgetBeforeTyping('('), true);
  assert.equal(shouldHideSuggestWidgetBeforeTyping('.'), true);
  assert.equal(shouldHideSuggestWidgetBeforeTyping(';'), true);
  assert.equal(shouldHideSuggestWidgetBeforeTyping('>'), true);
  assert.equal(shouldHideSuggestWidgetBeforeTyping('a'), false);
  assert.equal(shouldHideSuggestWidgetBeforeTyping('中'), false);
  assert.equal(shouldHideSuggestWidgetBeforeTyping('\n'), false);
});

test('preset completions respect the completion enhancement mode', () => {
  assert.equal(typeof shouldProvidePresetCompletion, 'function');
  assert.equal(shouldProvidePresetCompletion(DEFAULT_COMPLETION_SETTINGS), true);
  assert.equal(shouldProvidePresetCompletion({
    ...DEFAULT_COMPLETION_SETTINGS,
    enabled: false
  }), false);
  assert.equal(shouldProvidePresetCompletion({
    ...DEFAULT_COMPLETION_SETTINGS,
    mode: 'native'
  }), false);
});
