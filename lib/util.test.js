import test from 'node:test';
import assert from 'node:assert';
import { degToRad, radToDeg } from './util.js';

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
