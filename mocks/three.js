export const MathUtils = {
  degToRad: (deg) => deg * Math.PI / 180,
  radToDeg: (rad) => rad * 180 / Math.PI,
};

export class Material {}
export class Mesh {}
export class Vector3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
}
