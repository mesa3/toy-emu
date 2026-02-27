import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as THREE from 'three';
import Axis from './lib/axis.js';
import { forEachMesh } from './lib/util.js';
import SR6Model from './lib/models/sr6/sr6.js';

const COMMAND_REGEX = /^(L0|L1|L2|R0|R1|R2)([0-9]+)$/;
const COMMAND_EXTENSION_REGEX = /^(L0|L1|L2|R0|R1|R2)([0-9]+)(I|S)([0-9]+)$/;

class DeviceController {
  #buffer = '';
  #axisEmulator;
  #scale;
  #osrModel;
  #modelGroup;
  #port;
  #reader;
  #readableStreamClosed;

  constructor(scene) {
    this.#axisEmulator = {
      'L0': new Axis('L0'), // Stroke
      'L1': new Axis('L1'), // Forward
      'L2': new Axis('L2'), // Left
      'R0': new Axis('R0'), // Twist
      'R1': new Axis('R1'), // Roll
      'R2': new Axis('R2'), // Pitch
    };

    this.#scale = {
      'L0': 1, 'L1': 1, 'L2': 1,
      'R0': 1, 'R1': 1, 'R2': 1,
    };

    this.#osrModel = new SR6Model();
    this.#modelGroup = new THREE.Group();

    const { objects, orientation } = this.#osrModel.load();
    const osrGroup = new THREE.Group();

    for (const object of Object.values(objects)) {
      forEachMesh(object, (mesh) => {
        mesh.receiveShadow = true;
        mesh.castShadow = true;
      });
      osrGroup.add(object);
    }

    osrGroup.rotation.set(orientation, 0, 0);
    this.#modelGroup.add(osrGroup);
    scene.add(this.#modelGroup);
  }

  get axes() {
    const result = {};
    Object.keys(this.#axisEmulator).forEach(axis => {
      result[axis] = this.#axisEmulator[axis].getPosition() / 10000;
    });
    return result;
  }

  update() {
    this.#osrModel.preRender(this.axes, this.#scale);
  }

  setTransform(x, y, z, rotation) {
    this.#modelGroup.position.set(x, y, z);
    this.#modelGroup.rotation.y = rotation;
  }

  async connect() {
    if ('serial' in navigator) {
      try {
        this.#port = await navigator.serial.requestPort();
        await this.#port.open({ baudRate: 115200 });

        const textDecoder = new TextDecoderStream();
        this.#readableStreamClosed = this.#port.readable.pipeTo(textDecoder.writable);
        this.#reader = textDecoder.readable.getReader();

        this.#readLoop();
      } catch (err) {
        console.error('There was an error opening the serial port:', err);
      }
    } else {
      console.error('Web Serial API not supported.');
    }
  }

  async #readLoop() {
    while (true) {
      const { value, done } = await this.#reader.read();
      if (done) {
        this.#reader.releaseLock();
        break;
      }
      if (value) {
        this.write(value);
      }
    }
  }

  write(input) {
    if (typeof input !== 'string') return;

    for (let byte of input) {
      this.#buffer += byte;
      if (byte === '\n') {
        this.#executeCommand(this.#buffer);
        this.#buffer = '';
      }
    }
  }

  #executeCommand(buffer) {
    const commands = buffer.trim().split(/\s/).map(c => c.trim());
    const parseValue = value => Number(value.substring(0, 4).padEnd(4, '0'));

    for (const command of commands) {
      if (COMMAND_REGEX.test(command)) {
        const match = COMMAND_REGEX.exec(command);
        const axis = match[1];
        const value = match[2];
        this.#axisEmulator[axis].set(parseValue(value));
      } else if (COMMAND_EXTENSION_REGEX.test(command)) {
        const match = COMMAND_EXTENSION_REGEX.exec(command);
        const axis = match[1];
        const value = match[2];
        const ext = match[3];
        const extValue = match[4];
        this.#axisEmulator[axis].set(parseValue(value), ext, Number(extValue));
      }
    }
  }
}

class DualSR6App {
  #element;
  #scene;
  #camera;
  #renderer;
  #controls;
  #devices = [];

  constructor(elementId) {
    this.#element = document.getElementById(elementId);
    this.#initCanvas();

    this.#devices.push(new DeviceController(this.#scene));
    this.#devices.push(new DeviceController(this.#scene));

    // Set initial positions
    this.#devices[0].setTransform(-150, 0, 0, 0);
    this.#devices[1].setTransform(150, 0, 0, 0);

    this.#animate();

    window.addEventListener('resize', this.#resize.bind(this));
  }

  #initCanvas() {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, this.#computeAspectRatio(), 0.1, 2000);

    // Position camera to see both devices
    camera.position.set(0, 800, 400);
    camera.up.set(0, 0, 1);

    const renderer = new THREE.WebGLRenderer();
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setSize(this.#element.clientWidth, this.#element.clientHeight);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.maxDistance = 1500;
    controls.target.set(0, 0, 0);
    controls.update();

    this.#scene = scene;
    this.#camera = camera;
    this.#renderer = renderer;
    this.#controls = controls;

    this.#setupLighting(scene);
    this.#element.appendChild(renderer.domElement);
  }

  #setupLighting(scene) {
    const ambientLight = new THREE.AmbientLight(0xFFFFFF, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xFFFFFF, 0.8);
    dirLight.position.set(200, 200, 500);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // Add a second light for better visibility
    const backLight = new THREE.PointLight(0xFFFFFF, 0.5);
    backLight.position.set(-200, -200, 300);
    scene.add(backLight);
  }

  #computeAspectRatio() {
    return this.#element.clientWidth / this.#element.clientHeight;
  }

  #resize() {
    this.#camera.aspect = this.#computeAspectRatio();
    this.#camera.updateProjectionMatrix();
    this.#renderer.setSize(this.#element.clientWidth, this.#element.clientHeight);
  }

  #animate() {
    requestAnimationFrame(this.#animate.bind(this));
    this.#controls.update();

    this.#devices.forEach(device => device.update());

    this.#renderer.render(this.#scene, this.#camera);
  }

  connectDevice(index) {
    if (this.#devices[index]) {
      this.#devices[index].connect();
    }
  }

  setDeviceTransform(index, x, y, z, rotation) {
    if (this.#devices[index]) {
      this.#devices[index].setTransform(x, y, z, rotation);
    }
  }
}

// Export for global access
window.DualSR6App = DualSR6App;
