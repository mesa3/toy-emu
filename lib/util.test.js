import test from 'node:test';
import assert from 'node:assert';
import { degToRad, radToDeg, map, mapDecimal, constrain } from './util.js';

test('degToRad converts degrees to radians correctly', () => {
  assert.strictEqual(degToRad(0), 0);
  assert.strictEqual(degToRad(180), Math.PI);
  assert.strictEqual(degToRad(90), Math.PI / 2);
  assert.strictEqual(degToRad(360), 2 * Math.PI);
  assert.strictEqual(degToRad(-180), -Math.PI);
});

test('radToDeg converts radians to degrees correctly', () => {
  assert.strictEqual(radToDeg(0), 0);
  assert.strictEqual(radToDeg(Math.PI), 180);
  assert.strictEqual(radToDeg(Math.PI / 2), 90);
  assert.strictEqual(radToDeg(2 * Math.PI), 360);
  assert.strictEqual(radToDeg(-Math.PI), -180);
});

test('map() maps a value from one range to another as an integer', () => {
  // Basic mapping
  assert.strictEqual(map(5, 0, 10, 0, 100), 50);
  assert.strictEqual(map(50, 0, 100, 0, 10), 5);

  // Negative ranges
  assert.strictEqual(map(-5, -10, 0, 0, 100), 50);
  assert.strictEqual(map(5, 0, 10, 0, -100), -50);

  // Non-integer results are floored
  assert.strictEqual(map(3, 0, 10, 0, 10), 3);
  assert.strictEqual(map(3.5, 0, 10, 0, 10), 3);
  assert.strictEqual(map(11, 0, 30, 0, 20), 7); // 11 * 20 / 30 = 220 / 30 = 7.333 -> 7

  // Reverse ranges
  assert.strictEqual(map(2, 0, 10, 100, 0), 80); // Math.floor((2-0)*(0-100)/(10-0) + 100) = Math.floor(2*-10 + 100) = 80

  // Out of bounds
  assert.strictEqual(map(15, 0, 10, 0, 100), 150);
});

test('mapDecimal() maps a value from one range to another allowing decimals', () => {
  // Basic mapping
  assert.strictEqual(mapDecimal(5, 0, 10, 0, 100), 50);
  assert.strictEqual(mapDecimal(0.5, 0, 1, 0, 10), 5);

  // Decimals
  assert.strictEqual(mapDecimal(3.5, 0, 10, 0, 10), 3.5);

  // Default out range [0, 1]
  assert.strictEqual(mapDecimal(5, 0, 10), 0.5);

  // Negative ranges
  assert.strictEqual(mapDecimal(-5, -10, 0, 0, 1), 0.5);
});

test('constrain() constrains a value within a range', () => {
  assert.strictEqual(constrain(5, 0, 10), 5);
  assert.strictEqual(constrain(-5, 0, 10), 0);
  assert.strictEqual(constrain(15, 0, 10), 10);
  assert.strictEqual(constrain(0, 0, 10), 0);
  assert.strictEqual(constrain(10, 0, 10), 10);
});
