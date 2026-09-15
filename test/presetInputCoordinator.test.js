const test = require('node:test');
const assert = require('node:assert/strict');
const { PresetInputCoordinator } = require('../out/presetInputCoordinator.js');

test('rapid input reserves each preset character before asynchronous writes finish', async () => {
  let releaseFirstWrite;
  const firstWriteBlocked = new Promise(resolve => {
    releaseFirstWrite = resolve;
  });
  const written = [];
  let writeCount = 0;
  const coordinator = new PresetInputCoordinator(async item => {
    writeCount++;
    if (writeCount === 1) {
      await firstWriteBlocked;
    }
    written.push(item.text);
    return true;
  });
  const progress = { content: 'abcdefghijklmnopqrstuvwxyz', index: 0 };

  for (let i = 0; i < 20; i++) {
    coordinator.reserve('file:///demo.txt', progress);
  }

  assert.equal(progress.index, 20);
  assert.equal(coordinator.hasPending('file:///demo.txt'), true);

  releaseFirstWrite();
  await coordinator.whenIdle();

  assert.equal(written.join(''), 'abcdefghijklmnopqrst');
  assert.equal(coordinator.hasPending('file:///demo.txt'), false);
});

test('writer failures are reported only after all reservations for the target settle', async () => {
  const settled = [];
  const progress = { content: 'abc', index: 0 };
  const coordinator = new PresetInputCoordinator(
    async item => item.text !== 'b',
    (target, hadFailure) => settled.push({ target, hadFailure })
  );

  coordinator.reserve('file:///demo.txt', progress);
  coordinator.reserve('file:///demo.txt', progress);
  coordinator.reserve('file:///demo.txt', progress);
  await coordinator.whenIdle();

  assert.deepEqual(settled, [
    { target: 'file:///demo.txt', hadFailure: true }
  ]);
});

test('pass-through input stays behind already reserved preset input', async () => {
  let releaseFirstWrite;
  const firstWriteBlocked = new Promise(resolve => {
    releaseFirstWrite = resolve;
  });
  const written = [];
  const coordinator = new PresetInputCoordinator(async item => {
    if (written.length === 0) {
      await firstWriteBlocked;
    }
    written.push(item.text);
    return true;
  });
  const progress = { content: 'ab', index: 0 };

  coordinator.reserve('file:///demo.txt', progress);
  coordinator.reserve('file:///demo.txt', progress);
  coordinator.enqueue('file:///demo.txt', '\n');

  releaseFirstWrite();
  await coordinator.whenIdle();

  assert.equal(written.join(''), 'ab\n');
});

test('reserved input records its preset range so editor auto-insertions can be skipped', async () => {
  const written = [];
  const coordinator = new PresetInputCoordinator(async item => {
    written.push(item);
    return true;
  });
  const progress = { content: 'a\n  b', index: 0 };

  for (let i = 0; i < 4; i++) {
    coordinator.reserve('file:///demo.txt', progress);
  }
  await coordinator.whenIdle();

  assert.deepEqual(
    written.map(item => [item.text, item.presetStartIndex, item.presetEndIndex]),
    [
      ['a', 0, 1],
      ['\n', 1, 2],
      [' ', 2, 3],
      [' ', 3, 4]
    ]
  );
});

test('external completion can cancel reserved writes that have not started', async () => {
  let releaseFirstWrite;
  const firstWriteBlocked = new Promise(resolve => {
    releaseFirstWrite = resolve;
  });
  const written = [];
  const coordinator = new PresetInputCoordinator(async item => {
    if (written.length === 0) {
      await firstWriteBlocked;
    }
    written.push(item.text);
    return true;
  });
  const progress = { content: 'console', index: 0 };

  coordinator.reserve('file:///demo.txt', progress);
  coordinator.reserve('file:///demo.txt', progress);
  coordinator.reserve('file:///demo.txt', progress);

  assert.deepEqual(coordinator.getActiveReservation('file:///demo.txt'), {
    target: 'file:///demo.txt',
    text: 'c',
    presetStartIndex: 0,
    presetEndIndex: 1
  });
  assert.equal(coordinator.cancelQueuedReservations('file:///demo.txt', progress), 2);
  assert.equal(progress.index, 1);

  releaseFirstWrite();
  await coordinator.whenIdle();

  assert.equal(written.join(''), 'c');
  assert.equal(coordinator.hasPending('file:///demo.txt'), false);
});

test('queued reservations can be canceled even while another target is active', async () => {
  let releaseFirstWrite;
  const firstWriteBlocked = new Promise(resolve => {
    releaseFirstWrite = resolve;
  });
  const settled = [];
  const coordinator = new PresetInputCoordinator(
    async item => {
      if (item.target === 'file:///other.txt') {
        await firstWriteBlocked;
      }
      return true;
    },
    (target, hadFailure) => settled.push({ target, hadFailure })
  );
  const progress = { content: 'xyz', index: 0 };

  coordinator.reserve('file:///other.txt', { content: 'a', index: 0 });
  coordinator.reserve('file:///demo.txt', progress);
  coordinator.reserve('file:///demo.txt', progress);

  assert.equal(coordinator.cancelQueuedReservations('file:///demo.txt', progress), 2);
  assert.equal(progress.index, 0);
  assert.equal(coordinator.hasPending('file:///demo.txt'), false);

  releaseFirstWrite();
  await coordinator.whenIdle();

  assert.deepEqual(settled, [
    { target: 'file:///demo.txt', hadFailure: false },
    { target: 'file:///other.txt', hadFailure: false }
  ]);
});
