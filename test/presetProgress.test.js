const test = require('node:test');
const assert = require('node:assert/strict');
const { matchingPrefixLength, advancePresetIndex } = require('../out/presetProgress.js');

test('finds the longest matching prefix from document start', () => {
  assert.equal(matchingPrefixLength('', 'hello'), 0);
  assert.equal(matchingPrefixLength('hel', 'hello'), 3);
  assert.equal(matchingPrefixLength('hex', 'hello'), 2);
  assert.equal(matchingPrefixLength('hello', 'hello'), 5);
});

test('accepted completion can advance progress by multiple characters', () => {
  assert.equal(advancePresetIndex(2, 'hello', 'hello world'), 5);
});

test('document synchronization never moves progress backward', () => {
  assert.equal(advancePresetIndex(5, 'he', 'hello world'), 5);
  assert.equal(advancePresetIndex(5, 'hex', 'hello world'), 5);
});
