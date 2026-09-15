const test = require('node:test');
const assert = require('node:assert/strict');
const {
  matchingPrefixLength,
  advancePresetIndex,
  reconcilePresetIndex,
  retreatPresetIndex,
  advancePresetIndexFromInsertedText,
  isExpectedPresetWrite,
  shouldIgnoreActiveWrite,
  shouldOvertypeAutoClosingCharacter,
  getReservedWriteAction
} = require('../out/presetProgress.js');

test('finds the longest matching prefix from document start', () => {
  assert.equal(matchingPrefixLength('', 'hello'), 0);
  assert.equal(matchingPrefixLength('hel', 'hello'), 3);
  assert.equal(matchingPrefixLength('hex', 'hello'), 2);
  assert.equal(matchingPrefixLength('hello', 'hello'), 5);
});

test('treats CRLF in the document as LF in the preset', () => {
  assert.equal(matchingPrefixLength('a\r\n    b', 'a\n    b'), 7);
});

test('treats LF in the document as CRLF in the preset', () => {
  assert.equal(matchingPrefixLength('a\n    b', 'a\r\n    b'), 8);
});

test('accepted completion can advance progress by multiple characters', () => {
  assert.equal(advancePresetIndex(2, 'hello', 'hello world'), 5);
});

test('document synchronization never moves progress backward', () => {
  assert.equal(advancePresetIndex(5, 'he', 'hello world'), 5);
  assert.equal(advancePresetIndex(5, 'hex', 'hello world'), 5);
});

test('only explicit rollback synchronization can move progress backward', () => {
  assert.equal(reconcilePresetIndex(5, 'he', 'hello world', false), 5);
  assert.equal(reconcilePresetIndex(5, 'he', 'hello world', true), 2);
});

test('backspace retreats one logical preset character without resetting progress', () => {
  assert.equal(retreatPresetIndex(8, 'function test() {}'), 7);
  assert.equal(retreatPresetIndex(3, 'a\r\nb'), 1);
  assert.equal(retreatPresetIndex(3, 'a😀b'), 1);
});

test('accepted completion advances from the current preset region without a document-wide prefix match', () => {
  const preset = 'console.log(value);';

  // VS Code may replace the already typed prefix with the whole completion.
  assert.equal(advancePresetIndexFromInsertedText(3, 'console.log', 3, preset), 11);

  // Some completion providers insert only the remaining suffix.
  assert.equal(advancePresetIndexFromInsertedText(3, 'sole.log', 0, preset), 11);
});

test('completion replacement length disambiguates repeated preset text', () => {
  assert.equal(advancePresetIndexFromInsertedText(3, 'foo', 3, 'foofooZ'), 3);
  assert.equal(advancePresetIndexFromInsertedText(3, 'foo', 0, 'foofooZ'), 6);
  assert.equal(advancePresetIndexFromInsertedText(5, 'abcdefgh', 5, 'abcdefgh'), 8);
});

test('completion replacement length remains aligned across LF and CRLF differences', () => {
  assert.equal(advancePresetIndexFromInsertedText(4, 'a\nbX', 3, 'a\r\nbX'), 5);
  assert.equal(advancePresetIndexFromInsertedText(3, 'a\r\nbX', 4, 'a\nbX'), 4);
});

test('an active preset write is recognized across selection replacement and newline formats', () => {
  assert.equal(isExpectedPresetWrite('x', 'x'), true);
  assert.equal(isExpectedPresetWrite('\n', '\r\n'), true);
  assert.equal(isExpectedPresetWrite('x', 'xy'), false);
});

test('active pass-through writes do not cancel queued preset input', () => {
  assert.equal(shouldIgnoreActiveWrite(false, '\n', '\r\n    '), true);
  assert.equal(shouldIgnoreActiveWrite(true, '\n', '\r\n    '), false);
  assert.equal(shouldIgnoreActiveWrite(false, '\n', '\r\n'), true);
});

test('unrelated inserted text does not move preset progress', () => {
  assert.equal(advancePresetIndexFromInsertedText(3, 'different', 0, 'console.log(value);'), 3);
});

test('an existing auto-closing character at the cursor is overtyped instead of skipped', () => {
  assert.equal(typeof shouldOvertypeAutoClosingCharacter, 'function');
  assert.equal(shouldOvertypeAutoClosingCharacter(')', ')'), true);
  assert.equal(shouldOvertypeAutoClosingCharacter(']', ']'), true);
  assert.equal(shouldOvertypeAutoClosingCharacter('}', '}'), true);
  assert.equal(shouldOvertypeAutoClosingCharacter('"', '"'), true);
  assert.equal(shouldOvertypeAutoClosingCharacter('a', 'a'), false);
  assert.equal(shouldOvertypeAutoClosingCharacter(')', ''), false);
});

test('a covered auto-closer still uses native typing so the cursor moves past it', () => {
  assert.equal(typeof getReservedWriteAction, 'function');
  assert.equal(getReservedWriteAction(true, ')', ')'), 'type');
  assert.equal(getReservedWriteAction(true, ']', ']'), 'type');
  assert.equal(getReservedWriteAction(true, 'e', ''), 'skip');
  assert.equal(getReservedWriteAction(false, ')', ')'), 'type');
});
