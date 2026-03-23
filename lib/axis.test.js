import test from 'node:test';
import assert from 'node:assert';
import Axis from './axis.js';

// Mock performance.now
let currentTimeValue = 0;
global.performance = {
  now: () => currentTimeValue
};

test('Axis initialization', () => {
  const axis = new Axis('test');
  assert.strictEqual(axis.name, 'test');
  assert.strictEqual(axis.getPosition(), 5000);
});

test('Axis Interval command', () => {
  const axis = new Axis('test');
  currentTimeValue = 1000;
  axis.set(6000, 'I', 1000); // Move to 6000 in 1000ms

  assert.strictEqual(axis.getPosition(), 5000); // Still at start at t=1000

  currentTimeValue = 1500;
  assert.strictEqual(axis.getPosition(), 5500); // Halfway

  currentTimeValue = 2000;
  assert.strictEqual(axis.getPosition(), 6000); // Arrived

  currentTimeValue = 2500;
  assert.strictEqual(axis.getPosition(), 6000); // Stayed at target
});

test('Axis targetTime edge case (currentTime == targetTime)', () => {
  const axis = new Axis('test');
  currentTimeValue = 1000;
  axis.set(6000, 'I', 1000);

  currentTimeValue = 2000; // Exactly targetTime
  assert.strictEqual(axis.getPosition(), 6000);
});

test('Axis Speed command', () => {
  const axis = new Axis('test');
  currentTimeValue = 1000;
  // Speed is units per 100ms.
  // Move from 5000 to 6000 (distance 1000).
  // Speed 100 means 100 units per 100ms = 1 unit per ms.
  // Duration should be 1000ms.
  axis.set(6000, 'S', 100); // speed = 100 / 100 = 1 unit per 100ms. Wait.
  // extMagnitude / 100 = units per 100ms.
  // If extMagnitude is 100, speed = 1 unit per 100ms.
  // distance 1000 / speed 1 = 1000 intervals of 100ms = 100,000ms.
  // I want speed to be 100 units per 100ms = 1 unit per ms.
  // So extMagnitude = 10000.
  // wait, speed = extMagnitude / 100.
  // distance = 1000.
  // duration = floor(distance / speed) = floor(1000 / (extMagnitude/100)) = floor(100000 / extMagnitude).
  // If extMagnitude = 100, duration = 1000ms.
  axis.set(6000, 'S', 100);

  currentTimeValue = 1500;
  assert.strictEqual(axis.getPosition(), 5500);

  currentTimeValue = 2000;
  assert.strictEqual(axis.getPosition(), 6000);
});

test('Axis Live command (auto-smooth)', () => {
  const axis = new Axis('test');
  currentTimeValue = 1000;
  axis.set(6000); // Live command, default minInterval is 100ms

  assert.strictEqual(axis.getPosition(), 5000);

  currentTimeValue = 1050;
  assert.strictEqual(axis.getPosition(), 5500);

  currentTimeValue = 1100;
  assert.strictEqual(axis.getPosition(), 6000);
});

test('Axis value getter follows movement', () => {
  const axis = new Axis('test');
  currentTimeValue = 1000;
  axis.set(6000, 'I', 1000); // Target at 2000ms

  // Note: the value logic depends on deltaTime from last access.
  // When set() is called, #lastTime = 1000.

  currentTimeValue = 1500;
  // remainingTime = 2000 - 1500 = 500ms
  // remainingDistance = 6000 - 5000 = 1000
  // currentSpeed = 1000 / 500 = 2 units/ms
  // #speed = 2
  // deltaTime = 1500 - 1000 = 500ms
  // #value = 5000 + 2 * 500 = 6000.
  // Oh, wait. If speed is calculated based on remaining time and distance,
  // and we immediately move at that speed, we'd reach the target in remainingTime.

  const val = axis.value;
  assert.strictEqual(val, 6000);
});

test('Axis value getter handles multiple accesses', () => {
  const axis = new Axis('test');
  currentTimeValue = 1000;
  axis.set(6000, 'I', 1000); // Target at 2000ms

  currentTimeValue = 1100;
  // remainingTime = 900
  // remainingDistance = 1000
  // speed = 1.111...
  // deltaTime = 100
  // value = 5000 + 1.111 * 100 = 5111.11
  const val1 = axis.value;
  assert.ok(val1 > 5111 && val1 < 5112);

  currentTimeValue = 1200;
  // remainingTime = 800
  // remainingDistance = 6000 - 5111.11 = 888.89
  // speed = 888.89 / 800 = 1.111...
  // deltaTime = 100
  // value = 5111.11 + 111.11 = 5222.22
  const val2 = axis.value;
  assert.ok(val2 > 5222 && val2 < 5223);
});
