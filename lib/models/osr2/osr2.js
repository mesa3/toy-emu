import { Vector3, Quaternion, MeshPhongMaterial, MeshStandardMaterial } from 'three';
import { degToRad, radToDeg, loadObj } from '../../util.js';
import mainArmGeometry from './geometry/bearing-arm.js';
import baseGeometry from './geometry/base.js';
import caseGeometry from '../common/case.js';
import lidGeometry from './geometry/lid.js';
import pitcherArmGeometry from './geometry/pitcher-arm.js';
import pitcherGeometry from './geometry/pitcher.js';
import pitcherLinkArmGeometry from './geometry/pitcher-link-arm.js';
import receiverGeometry from './geometry/receiver.js';
import bearingGeometry from '../common/rod-end-bearing.js'
import bearingJointGeometry from './geometry/bearing-joint.js';
import { mapDecimal, servoToRotation, circleSphereIntersection, vectorDirection, recomputeNormals } from '../../util.js';

const X_AXIS = new Vector3(1, 0, 0);
const Y_AXIS = new Vector3(0, 1, 0);
const NEG_Y_AXIS = new Vector3(0, -1, 0);
const RECEIVER_DIRECTION = new Vector3(-1, 0, 0);

/**
 * 3D Model of the OSR2
 */
export default class OSR2Model {
  #leftArmPosition = [70, 5, 16.5];
  #rightArmPosition = [-70, 5, 16.5];
  #pitcherArmPosition = [77, 5, 17];
  #orientation = -Math.PI / 2; // Rotation around the x-axis.

  #scratchVector1 = new Vector3();
  #scratchVector2 = new Vector3();
  #scratchVector3 = new Vector3();
  #scratchVector4 = new Vector3();
  #scratchVector5 = new Vector3();
  #scratchVector6 = new Vector3();
  #scratchVector7 = new Vector3();
  #scratchVector8 = new Vector3();
  #scratchQuaternion1 = new Quaternion();
  #scratchQuaternion2 = new Quaternion();
  #scratchQuaternion3 = new Quaternion();
  #scratchQuaternion4 = new Quaternion();

  load () {
    const receiverMaterial = new MeshPhongMaterial({ color: 0x3f5173 });
    const baseMaterial = new MeshPhongMaterial({ color: 0x1E1E1E });
    const bearingMaterial = new MeshStandardMaterial({
      color: 0xC0C0C0,
      metalness: 1,
      roughness: 0.5, 
    });

    const modCase = loadObj(caseGeometry, baseMaterial);
    const base = loadObj(baseGeometry, baseMaterial);
    const receiver = loadObj(receiverGeometry, receiverMaterial);
    const rightArm = loadObj(mainArmGeometry, baseMaterial);
    const leftArm = loadObj(mainArmGeometry, baseMaterial);
    const lid = loadObj(lidGeometry, receiverMaterial);
    const pitcher = loadObj(pitcherGeometry, baseMaterial);
    const pitcherArm = loadObj(pitcherArmGeometry, baseMaterial);
    const pitcherLinkArm = loadObj(pitcherLinkArmGeometry, baseMaterial);
    const leftBearing = loadObj(bearingGeometry, bearingMaterial, recomputeNormals);
    const rightBearing = loadObj(bearingGeometry, bearingMaterial, recomputeNormals);
    const linkStartBearing = loadObj(bearingGeometry, bearingMaterial, recomputeNormals);
    const linkEndBearing = loadObj(bearingGeometry, bearingMaterial, recomputeNormals);
    const leftJoint = loadObj(bearingJointGeometry, bearingMaterial, recomputeNormals);
    const rightJoint = loadObj(bearingJointGeometry, bearingMaterial, recomputeNormals);
    const linkJoint = loadObj(bearingJointGeometry, bearingMaterial, recomputeNormals);

    pitcherArm.position.fromArray(this.#pitcherArmPosition);
    rightArm.position.fromArray(this.#rightArmPosition);
    leftArm.position.fromArray(this.#leftArmPosition);

    this.objects = {
      base,
      receiver,
      leftArm,
      rightArm,
      lid,
      pitcher,
      pitcherArm,
      pitcherLinkArm,
      modCase,
      leftBearing,
      rightBearing,
      linkStartBearing,
      linkEndBearing,
      leftJoint, 
      rightJoint,
      linkJoint,
    };

    return { objects: this.objects, orientation: this.#orientation };
  }

  preRender (axes, scale) {
    this.#forwardKinematics(axes, scale);
  }

  #forwardKinematics (axes, scale) {
    const R0_SCALE = scale['R0'];
    const leftBearingPosition = this.#scratchVector1.set(0, 0, 140);
    const rightBearingPosition = this.#scratchVector2.copy(leftBearingPosition);
    const armBearingOffset = 3.5;

    const { leftServoAngle, rightServoAngle, pitcherServoAngle, armBend } = this.#computeServoAngles(axes, scale);

    const { 
      leftArm, rightArm, pitcherArm, pitcherLinkArm, 
      leftBearing, rightBearing, linkStartBearing, linkEndBearing,
      receiver, modCase, leftJoint, rightJoint, linkJoint,
    } = this.objects;

    leftArm.rotation.set(leftServoAngle, -armBend, degToRad(180));
    rightArm.rotation.set(rightServoAngle, armBend, 0);
    pitcherArm.rotation.set(pitcherServoAngle, 0, 0);

    this.#updateMainArmBearingValues(leftBearing, leftBearingPosition, leftArm, -armBearingOffset, -armBend);
    this.#updateMainArmBearingValues(rightBearing, rightBearingPosition, rightArm, armBearingOffset, armBend);

    leftJoint.position.copy(leftBearing.position);
    rightJoint.position.copy(rightBearing.position);

    pitcherLinkArm.position.set(-3, -40, 0)
      .applyAxisAngle(X_AXIS, pitcherServoAngle)
      .add(pitcherArm.position);

    linkStartBearing.position.set(0, 0, 0).add(pitcherLinkArm.position);
    
    const receiverPosition = this.#scratchVector3.copy(leftBearingPosition)
      .lerp(rightBearingPosition, 0.5);

    receiver.position.copy(receiverPosition);

    const receiverBearingAxis = this.#scratchVector4.copy(rightBearingPosition)
      .sub(leftBearingPosition).normalize();

    const intersectionPoints = circleSphereIntersection(
      leftBearingPosition, 
      40, // Distance between pitcher hole and arm hole on the receiver...
      receiverBearingAxis, 
      linkStartBearing.position, 
      140 // Length of pitcher link arm to the hole...
    );

    if (intersectionPoints) {
      const linkEndBearingPosition = intersectionPoints.length === 1 ? intersectionPoints[0] :
        intersectionPoints[0].y < intersectionPoints[1].y ? intersectionPoints[0] :
        intersectionPoints[1];

      linkEndBearing.position.copy(linkEndBearingPosition);
      linkEndBearing.up.set(0, 0, 1);
      linkEndBearing.lookAt(this.#toWorldCoordinates(this.#scratchVector5.copy(linkEndBearingPosition).sub(linkStartBearing.position).add(linkEndBearingPosition)));

      linkStartBearing.up.set(0, 0, 1);
      linkStartBearing.lookAt(this.#toWorldCoordinates(this.#scratchVector5.copy(linkStartBearing.position).sub(linkEndBearing.position).add(linkStartBearing.position)));

      pitcherLinkArm.up.set(0, 0, 1);
      pitcherLinkArm.lookAt(this.#toWorldCoordinates(linkEndBearing.position));
    } else {
      console.warn('Invalid model arrangement. No intersection found for positioning pitcher link.');
    }

    linkJoint.position.copy(linkEndBearing.position);
    const rotationAxis = this.#scratchVector5.copy(RECEIVER_DIRECTION).cross(receiverBearingAxis).normalize();
    const rotationAngle = Math.acos(RECEIVER_DIRECTION.dot(receiverBearingAxis));
    const rollQuaternion = this.#scratchQuaternion1.setFromAxisAngle(rotationAxis, rotationAngle);

    const pitchUpVector = this.#scratchVector6.set(0, -1, 0)
      .applyQuaternion(rollQuaternion)
      .normalize();

    const pitchBearingVector = this.#scratchVector7.copy(linkEndBearing.position).sub(leftBearing.position);
    const pitchAngleDirection = vectorDirection(pitchUpVector, pitchBearingVector, this.#scratchVector8.copy(X_AXIS).applyQuaternion(rollQuaternion));

    const pitchAngle = pitchBearingVector.angleTo(pitchUpVector) * pitchAngleDirection;
    const pitchQuaternion = this.#scratchQuaternion2.setFromAxisAngle(X_AXIS, pitchAngle);
    
    const twistQuaternion = this.#scratchQuaternion3.setFromAxisAngle(NEG_Y_AXIS, axes['R0'] * degToRad(240 * R0_SCALE) - degToRad(120  * R0_SCALE));
    const receiverQuaternion = this.#scratchQuaternion4.copy(rollQuaternion).multiply(pitchQuaternion);
    
    receiver.setRotationFromQuaternion(receiverQuaternion);

    modCase.position.copy(receiverPosition);
    modCase.setRotationFromQuaternion(this.#scratchQuaternion1.copy(receiverQuaternion).multiply(twistQuaternion));

    leftJoint.setRotationFromQuaternion(receiverQuaternion);
    rightJoint.setRotationFromQuaternion(receiverQuaternion);
  }

  #updateMainArmBearingValues (bearing, bearingPosition, arm, bearingOffset, armBend) {
    bearingPosition.x += bearingOffset;
    bearingPosition.applyAxisAngle(Y_AXIS, armBend);
    bearingPosition.applyAxisAngle(X_AXIS, arm.rotation.x);
    bearingPosition.add(arm.position);

    bearing.position.copy(bearingPosition);
    bearing.rotation.x = arm.rotation.x;
    bearing.rotation.y = arm.rotation.y;
  }

  #toWorldCoordinates (vector) {
    return this.#scratchVector8.copy(vector).applyAxisAngle(X_AXIS, this.#orientation);
  }

  /**
   * Compute the angles for the servos based on the algorithm from the actual OSR2 Firmware.
   */
  #computeServoAngles (axes, scale) {
    const L0_SCALE = scale['L0'];
    const R1_SCALE = scale['R1'];
    const R2_SCALE = scale['R2'];

    const stroke = mapDecimal(axes['L0'],0, 0.9999, -350 * L0_SCALE, 350 * L0_SCALE);
    const roll   = mapDecimal(axes['R1'],0, 0.9999, -132 * R1_SCALE, 132 * R1_SCALE);
    const pitch  = mapDecimal(axes['R2'],0, 0.9999, -350 * R2_SCALE, 350 * R2_SCALE);

    const servoZero = 1515.105;
    const servoFrequency = 330;
    const servoInterval = 1000000 / servoFrequency;
    
    const leftServo = mapDecimal(servoZero + stroke + roll,0,servoInterval,0,65535);
    const rightServo = mapDecimal(servoZero - stroke + roll,0,servoInterval,0,65535);
    const pitchServo = mapDecimal(servoZero - pitch,0,servoInterval,0,65535);
    
    return {
      leftServoAngle: servoToRotation(leftServo),
      rightServoAngle: servoToRotation(rightServo, -1),
      pitcherServoAngle: servoToRotation(pitchServo, -1),
      armBend: degToRad(mapDecimal(Math.abs(roll), 0, 132, 0, 4)),
    }
  }
}
