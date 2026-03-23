import { map, constrain } from './util.js';

const MIN_SMOOTH_INTERVAL = 3;     // Minimum auto-smooth ramp interval for live commands (ms)
const MAX_SMOOTH_INTERVAL = 100;   // Maximum auto-smooth ramp interval for live commands (ms)

/**
 * A class that emulates the behavior of an axis as coded on the OSR Firmware (v3.3)
 */
export default class Axis {
  name = '';

  #startTime = 0;
  #startPosition = 5000;
  #targetTime = 0;
  #targetPosition = 5000;
  #minInterval = MAX_SMOOTH_INTERVAL;

  #value = 5000;
  #targetValue = 5000;
  #speed = 0;
  #lastTime = 0;

  constructor (name) {
    this.name = name;
  }

  get value () {
    const currentTime = performance.now();

    if (currentTime >= this.#targetTime) {
      this.#value = this.#targetValue;
    } else if (this.#value !== this.#targetValue) {
      const direction = Math.sign(this.#targetValue - this.#value);
      const remainingTime = this.#targetTime - currentTime;
      const remainingDistance = direction * (this.#targetValue - this.#value);

      // Explicitly handle remainingTime being zero to avoid division by zero
      // Though the currentTime >= targetTime check above should catch it.
      const currentSpeed = remainingTime > 0 ? remainingDistance / remainingTime : 0;

      if (Math.abs(currentSpeed) > Math.abs(this.#speed) || Math.sign(currentSpeed) !== Math.sign(this.#speed)) {
        this.#speed = currentSpeed;
      }

      const deltaTime = currentTime - this.#lastTime;
      this.#value += this.#speed * deltaTime;
    }

    this.#lastTime = currentTime;
    return this.#value;
  }

  set (magnitude, ext, extMagnitude) {
    const currentTime = performance.now();
    magnitude = constrain(magnitude, 0, 9999);
    extMagnitude = constrain(extMagnitude, 0, 9999999);

    this.#targetValue = magnitude;
    this.#lastTime = currentTime;

    if (!extMagnitude || ( ext != 'S' && ext != 'I' ) ) {
      // Live command
      // Update auto-smooth regulator
      let lastInterval = currentTime - this.#startTime;
      if (lastInterval > this.#minInterval && this.#minInterval < MAX_SMOOTH_INTERVAL) { 
        this.#minInterval += 1; 
      } else if (lastInterval < this.#minInterval && this.#minInterval > MIN_SMOOTH_INTERVAL) {
        this.#minInterval -= 1;
      } 

      this.#startPosition = this.getPosition();
      this.#targetTime = currentTime + this.#minInterval;  
    } else if ( ext == 'S' ) {
      // Speed command
      const speed = extMagnitude / 100; // Interpret extMagntitude as units per 100 ms.
      this.#startPosition = this.getPosition();

      let distance = Math.abs(magnitude - this.#startPosition);
      let duration = speed > 0 ? Math.floor(distance / speed) : 0;
      this.#targetTime = currentTime + duration;
    } else if ( ext == 'I' ) {
      // Interval command
      const duration = extMagnitude; // Interpret extMagnitude as the duration of the move in ms.
      this.#startPosition = this.getPosition();
      this.#targetTime = currentTime + duration;
    }

    this.#startTime = currentTime;
    this.#targetPosition = magnitude;
  }

  getPosition () {
    // For backward compatibility, keep getPosition but it can be implemented via value.
    // However, the original getPosition used map() which is a simple linear interpolation.
    // The new 'value' getter seems to implement a more complex tracking.
    // Let's keep the original logic for getPosition if it's still needed,
    // but the task specifically asked for the new logic.

    // In dual-sr6.js and osr-emu.js, getPosition() is used.
    // If I replace getPosition with the new logic, I might change the behavior.
    // The "Current Code" in the task description showed a 'get value ()' implementation.

    let position; // 0 - 9999
    const currentTime = performance.now();

    if (currentTime >= this.#targetTime) {
      position = this.#targetPosition;
    } else if (currentTime > this.#startTime) { 
      position = map(currentTime, this.#startTime, this.#targetTime, this.#startPosition, this.#targetPosition);
    } else {
      position = this.#startPosition;
    }
    
    return constrain(position, 0, 9999);
  }
}
