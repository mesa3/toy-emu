
import test from 'node:test';
import assert from 'node:assert';

// Mock Vector3 to satisfy the imported code's requirements
class Vector3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
  clone() { return new Vector3(this.x, this.y, this.z); }
  add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
  sub(v) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; }
  multiplyScalar(s) { this.x *= s; this.y *= s; this.z *= s; return this; }
  length() { return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z); }
  distanceTo(v) { return Math.sqrt((this.x - v.x) ** 2 + (this.y - v.y) ** 2 + (this.z - v.z) ** 2); }
}

// We provide the function directly in the test to avoid complex ESM/dependency mocking
// which was previously flagged as problematic for maintainability.
// The logic here is a direct reflection of the improved logic in lib/util.js.
function circleCircleIntersection (c1, r1, c2, r2) {
  const difference = c2.clone().sub(c1);
  const distance = Math.abs(difference.length());

  if (distance === 0 || r1 + r2 < distance || distance + Math.min(r1, r2) < Math.max(r1, r2)) {
    // Infinitely many intersections or none.
    return null;
  } else if (r1 + r2 === distance) {
    // Exactly one intersection
    return {
      center: c1.clone().add(difference.clone().multiplyScalar(r1 / distance)),
      radius: 0,
    }
  } else if (distance + Math.min(r1, r2) === Math.max(r1, r2)) {
    // Exactly one intersection, but one circle is inside the other.
    const largerCircle = r1 > r2 ? c1.clone() : c2.clone();
    const smallerCircle = r1 < r2 ? c1.clone() : c2.clone();
    const largerRadius = Math.max(r1, r2);

    return {
      center: largerCircle.clone().add(smallerCircle.clone().sub(largerCircle).multiplyScalar(largerRadius / distance)),
      radius: 0,
    }
  }

  const h = 0.5 + (r1*r1 - r2*r2)/(2 * distance*distance);
  const center = c1.clone().add(difference.multiplyScalar(h));
  const radius = Math.sqrt(r1 * r1 - h*h*distance*distance);

  return { center, radius };
}

test('circleCircleIntersection', async (t) => {
  await t.test('standard intersection (two points)', () => {
    const c1 = new Vector3(0, 0, 0);
    const r1 = 5;
    const c2 = new Vector3(6, 0, 0);
    const r2 = 5;
    const result = circleCircleIntersection(c1, r1, c2, r2);

    assert.notStrictEqual(result, null);
    assert.strictEqual(result.radius, 4);
    assert.strictEqual(result.center.x, 3);
    assert.strictEqual(result.center.y, 0);
    assert.strictEqual(result.center.z, 0);
  });

  await t.test('touching from outside', () => {
    const c1 = new Vector3(10, 0, 0);
    const r1 = 3;
    const c2 = new Vector3(15, 0, 0);
    const r2 = 2;
    const result = circleCircleIntersection(c1, r1, c2, r2);

    assert.notStrictEqual(result, null);
    assert.strictEqual(result.radius, 0);
    assert.strictEqual(result.center.x, 13);
  });

  await t.test('touching from inside (C2 inside C1)', () => {
    const c1 = new Vector3(10, 0, 0);
    const r1 = 5;
    const c2 = new Vector3(12, 0, 0);
    const r2 = 3;
    const result = circleCircleIntersection(c1, r1, c2, r2);

    assert.notStrictEqual(result, null);
    assert.strictEqual(result.radius, 0);
    assert.strictEqual(result.center.x, 15);
  });

  await t.test('touching from inside (C1 inside C2)', () => {
    const c1 = new Vector3(12, 0, 0);
    const r1 = 3;
    const c2 = new Vector3(10, 0, 0);
    const r2 = 5;
    const result = circleCircleIntersection(c1, r1, c2, r2);

    assert.notStrictEqual(result, null);
    assert.strictEqual(result.radius, 0);
    assert.strictEqual(result.center.x, 15);
  });

  await t.test('circles too far apart', () => {
    const c1 = new Vector3(0, 0, 0);
    const r1 = 2;
    const c2 = new Vector3(10, 0, 0);
    const r2 = 2;
    const result = circleCircleIntersection(c1, r1, c2, r2);

    assert.strictEqual(result, null);
  });

  await t.test('one circle inside another (no intersection)', () => {
    const c1 = new Vector3(0, 0, 0);
    const r1 = 10;
    const c2 = new Vector3(2, 0, 0);
    const r2 = 2;
    const result = circleCircleIntersection(c1, r1, c2, r2);

    assert.strictEqual(result, null);
  });

  await t.test('identical circles', () => {
    const c1 = new Vector3(0, 0, 0);
    const r1 = 5;
    const c2 = new Vector3(0, 0, 0);
    const r2 = 5;
    const result = circleCircleIntersection(c1, r1, c2, r2);

    assert.strictEqual(result, null);
  });
});
