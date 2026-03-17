import { Vector3, Quaternion, MeshPhongMaterial, MeshStandardMaterial } from 'three';
import { 
  loadObj, loadObjs, loadComplexObj, mapDecimal, servoToRotation, constrain, degToRad,
  circleCircleIntersection, circleSphereIntersection, vectorDirection, recomputeNormals,
} from '../../util.js';
import baseGeometry from './geometry/base.js';
import lidGeometry from './geometry/lid.js';
import mainArmServoGeometry from './geometry/main-arm-servos.js';
import armGeometry from './geometry/arm.js';
import leftPitcherGeometry from './geometry/left-pitcher.js';
import rightPitcherGeometry from './geometry/right-pitcher.js';
import receiverGeometry from './geometry/receiver.js';
import mainLinkGeometry from './geometry/main-link.js';
import leftPitcherLinkGeometry from './geometry/pitcher-link-left.js';
import rightPitcherLinkGeometry from './geometry/pitcher-link-right.js';
import caseGeometry from '../common/case.js';

const UP_VECTOR = new Vector3(0, 0, 1);
const X_AXIS = new Vector3(1, 0, 0);
const Y_AXIS = new Vector3(0, 1, 0);
const NEG_Y_AXIS = new Vector3(0, -1, 0);
const RECEIVER_DIRECTION = new Vector3(-1, 0, 0);
const PITCHER_BEARING_VECTOR = new Vector3(0, -75, 0);

/**
 * 3D Model of the SR6
 */
export default class SR6Model {
  #orientation = -Math.PI / 2; // Rotation around the x-axis.

  #scratchVector1 = new Vector3();
  #scratchVector2 = new Vector3();
  #scratchVector3 = new Vector3();
  #scratchVector4 = new Vector3();
  #scratchVector5 = new Vector3();
  #scratchQuaternion1 = new Quaternion();
  #scratchQuaternion2 = new Quaternion();
  #scratchQuaternion3 = new Quaternion();

  load () {
    const ayvaBlueMaterial = new MeshPhongMaterial({ color: 0x3f5173 });
    const darkMaterial = new MeshPhongMaterial({ color: 0x1E1E1E });
    const servoMaterial = new MeshPhongMaterial({ color: 0x131313 });
    const bearingMaterial = new MeshStandardMaterial({
      color: 0xC0C0C0,
      metalness: 1,
      roughness: 0.5, 
    });

    const base = loadObj(baseGeometry, darkMaterial);
    const mainArmServos = loadObj(mainArmServoGeometry, servoMaterial);
    const lid = loadObj(lidGeometry, ayvaBlueMaterial);
    const receiver = loadObj(receiverGeometry, ayvaBlueMaterial);
    const modCase = loadObj(caseGeometry, darkMaterial);

    const [
      upperLeftArm,
      upperRightArm,
      lowerLeftArm,
      lowerRightArm,
    ] = loadObjs(4, armGeometry, ayvaBlueMaterial);

    const mainLinkModelConfig = {
      rodEndBearing: {
        processMesh: recomputeNormals,
        material: bearingMaterial,
      },
      bearingArm: {
        material: darkMaterial,
      }
    };

    const upperLeftLink = loadComplexObj(mainLinkGeometry, mainLinkModelConfig);
    const upperRightLink = loadComplexObj(mainLinkGeometry, mainLinkModelConfig);
    const lowerLeftLink = loadComplexObj(mainLinkGeometry, mainLinkModelConfig);
    const lowerRightLink = loadComplexObj(mainLinkGeometry, mainLinkModelConfig);

    const [upperLeftBackBearing, upperLeftFrontBearing] = upperLeftLink.children.filter(c => c.name === 'rodEndBearing');
    const [upperRightBackBearing, upperRightFrontBearing] = upperRightLink.children.filter(c => c.name === 'rodEndBearing');
    const [lowerLeftBackBearing, lowerLeftFrontBearing] = lowerLeftLink.children.filter(c => c.name === 'rodEndBearing');
    const [lowerRightBackBearing, lowerRightFrontBearing] = lowerRightLink.children.filter(c => c.name === 'rodEndBearing');

    const pitcherLinkModelConfig = {
      rodEndBearing: {
        processMesh: recomputeNormals,
        material: bearingMaterial,
      },
      pitcherLink: {
        material: darkMaterial,
      }
    };

    const leftPitcher = loadObj(leftPitcherGeometry, ayvaBlueMaterial);
    const leftPitcherLink = loadComplexObj(leftPitcherLinkGeometry, pitcherLinkModelConfig);
    const rightPitcher = loadObj(rightPitcherGeometry, ayvaBlueMaterial);
    const rightPitcherLink = loadComplexObj(rightPitcherLinkGeometry, pitcherLinkModelConfig);

    this.objects = {
      base,
      lid,
      mainArmServos,
      lowerRightArm,
      upperRightArm,
      lowerLeftArm,
      upperLeftArm,
      lowerRightLink,
      upperRightLink,
      lowerLeftLink,
      upperLeftLink,
      leftPitcher,
      rightPitcher,
      upperRightBackBearing,
      upperRightFrontBearing,
      lowerRightBackBearing,
      lowerRightFrontBearing,
      upperLeftBackBearing,
      upperLeftFrontBearing,
      lowerLeftBackBearing,
      lowerLeftFrontBearing,
      leftPitcherLink,
      rightPitcherLink,
      receiver,
      modCase,
    };

    this.#setBaseArmPositions();

    return { objects: this.objects, orientation: this.#orientation };
  }

  preRender (axes, scale, parentObject) {
    this.#setBaseArmPositions();
    this.#performKinematics(axes, scale, parentObject);
  }

  /**
   * Set the positions of all the arms (where they attach to the base model).
   */
  #setBaseArmPositions () {
    const armX = 58.5;
    const upperArmY = 0;
    const lowerArmY = 30;
    const armZ = 59.92 - 10; // Servo axle is about 10mm from the edge of the servo.
    
    const pitcherArmX = 14.318;
    const pitcherArmYZ = [-29.72, 49.325]

    const { 
      leftPitcher, rightPitcher,
      upperLeftArm, upperRightArm, 
      lowerLeftArm, lowerRightArm,  
    } = this.objects;

    upperLeftArm.position.fromArray([armX, upperArmY, armZ]);
    upperLeftArm.rotation.y = Math.PI;

    upperRightArm.position.fromArray([-armX, upperArmY, armZ]);

    lowerLeftArm.position.fromArray([armX, lowerArmY, armZ]);
    lowerLeftArm.rotation.x = Math.PI;
    lowerLeftArm.rotation.y = Math.PI;

    lowerRightArm.position.fromArray([-armX, lowerArmY, armZ]);
    lowerRightArm.rotation.x = Math.PI;

    leftPitcher.position.fromArray([pitcherArmX, ...pitcherArmYZ]);
    rightPitcher.position.fromArray([-pitcherArmX, ...pitcherArmYZ]);
  }

  /**
   * This method uses a combination of Forward Kinematics and Inverse Kinematics to position everything.
   * 
   * The main arms' position and rotation are calculated via Forward Kinematics. The servo angles are
   * generated using code ripped directly from the actual SR6 firmware. The position of the receiver is then 
   * calculated from the main arm positions.
   * 
   * From there, we do a direct rotation of the expected pitch on the receiver, and then do Inverse Kinematics
   * to calculate the rotation of the pitcher servos and position of the pitcher angle links.
   *  
   * @param {Object} axes - map of current values for each axis
   * @param {Object} scale - map of scale for each axis
   * @param {Object} parentObject - Optional. The parent Object3D that contains this model. Used to transform lookAt targets to world space.
   */
  #performKinematics (axes, scale, parentObject) {
    const pitchRange = 50; // mm
    const pitchAngle = scale['R2'] * axes['R2'] * degToRad(pitchRange) - degToRad(pitchRange/2);
    const pitchBearingAngle = pitchAngle - degToRad(14.763202965644615); //  Angle to the pitch holes on the receiver (from main arm holes)
    const angleLinkLength = 185; // mm
    const receiverWidth = 145.5; // mm
    const upperLinkOffset = 6; // mm
    const swayRange = 30; // mm
    const pitchQuaternion = this.#scratchQuaternion1
      .setFromAxisAngle(X_AXIS, pitchAngle);
    const pitchBearingQuaternion = this.#scratchQuaternion2
      .setFromAxisAngle(X_AXIS, pitchBearingAngle);
    const twistQuaternion = this.#scratchQuaternion3.
      setFromAxisAngle(NEG_Y_AXIS, scale['R0'] * axes['R0'] * degToRad(240) - degToRad(120));

    const { 
      lowerLeftServoAngle,
      upperLeftServoAngle,
      lowerRightServoAngle,
      upperRightServoAngle,
      leftPitchServoAngle,
      rightPitchServoAngle,
    } = this.#computeFirmwareServoAngles(axes, scale);

    const { 
      lowerRightArm,
      upperRightArm,
      lowerLeftArm,
      upperLeftArm,
      leftPitcher,
      rightPitcher,
      lowerRightLink,
      upperRightLink,
      lowerLeftLink,
      upperLeftLink,
      upperRightBackBearing,
      upperRightFrontBearing,
      lowerRightBackBearing,
      lowerRightFrontBearing,
      upperLeftBackBearing,
      upperLeftFrontBearing,
      lowerLeftBackBearing,
      lowerLeftFrontBearing,
      leftPitcherLink,
      rightPitcherLink,
      receiver,
      modCase,
    } = this.objects;

    leftPitcher.rotation.x = leftPitchServoAngle;
    rightPitcher.rotation.x = rightPitchServoAngle;
    upperLeftArm.rotation.x = upperLeftServoAngle;
    upperRightArm.rotation.x = upperRightServoAngle;
    lowerLeftArm.rotation.x = lowerLeftServoAngle;
    lowerRightArm.rotation.x = lowerRightServoAngle;

    upperLeftLink.position.copy(this.#computeLinkPosition(upperLeftArm.position, upperLeftServoAngle));
    upperRightLink.position.copy(this.#computeLinkPosition(upperRightArm.position, upperRightServoAngle, -1));
    lowerLeftLink.position.copy(this.#computeLinkPosition(lowerLeftArm.position, lowerLeftServoAngle));
    lowerRightLink.position.copy(this.#computeLinkPosition(lowerRightArm.position, lowerRightServoAngle, -1));

    const {
      intersection: leftIntersectionPoint,
      center: leftIntersectionCenter,
      radius: leftIntersectionRadius,
     } = this.#computeMainLinkIntersectionPoint(upperLeftLink.position, lowerLeftLink.position);

    const { 
      intersection: rightIntersectionPoint, 
      center: rightIntersectionCenter,
      radius: rightIntersectionRadius,
     } =  this.#computeMainLinkIntersectionPoint(upperRightLink.position, lowerRightLink.position);

    if (leftIntersectionPoint && rightIntersectionPoint) {
      const actualWidth = this.#scratchVector1.copy(rightIntersectionPoint).sub(leftIntersectionPoint).length();

      if (actualWidth > receiverWidth) {
        // Keep the main arms attached to the receiver by applying an offset
        // when the distance between the attachment points is too large.
        const offset = (actualWidth - receiverWidth) / 2;

        const rightCopy = this.#scratchVector1.copy(rightIntersectionPoint);
        const leftCopy = this.#scratchVector2.copy(leftIntersectionPoint);

        rightIntersectionPoint.addScaledVector(this.#scratchVector3.copy(leftCopy).sub(rightCopy).normalize(), offset);
        leftIntersectionPoint.addScaledVector(this.#scratchVector3.copy(rightCopy).sub(leftCopy).normalize(), offset);
      }

      const swayArc = scale['L2'] * swayRange * ((axes['L2'] - 0.5) / 0.5);
      const rightArcAngle = swayArc / rightIntersectionRadius;
      const leftArcAngle = swayArc / leftIntersectionRadius;
      
      if (rightArcAngle || leftArcAngle) {
        // To apply sway, we rotate the main arms around the Y axis (relative to their center points)
        rightIntersectionPoint.sub(rightIntersectionCenter).applyAxisAngle(Y_AXIS, rightArcAngle).add(rightIntersectionCenter);
        leftIntersectionPoint.sub(leftIntersectionCenter).applyAxisAngle(Y_AXIS, leftArcAngle).add(leftIntersectionCenter);
      }

      // The upper links of the main arms are attached on the outside, so we shift them over by an offset.
      const upperLeftVector = this.#scratchVector1.copy(leftIntersectionPoint).sub(rightIntersectionPoint).normalize();
      const upperRightVector = this.#scratchVector2.copy(rightIntersectionPoint).sub(leftIntersectionPoint).normalize();
      const leftIntersectionPointShifted = this.#scratchVector3.copy(leftIntersectionPoint).addScaledVector(upperLeftVector, upperLinkOffset);
      const rightIntersectionPointShifted = this.#scratchVector4.copy(rightIntersectionPoint).addScaledVector(upperRightVector, upperLinkOffset);

      const upperLeftLookAt = this.#toWorldCoordinates(leftIntersectionPointShifted, parentObject);
      const upperLeftLookAtReversed = this.#toWorldCoordinates(
        this.#scratchVector5.copy(upperLeftLink.position).sub(leftIntersectionPointShifted).add(upperLeftLink.position),
        parentObject
      );

      const upperRightLookAt = this.#toWorldCoordinates(rightIntersectionPointShifted, parentObject);
      const upperRightLookAtReversed = this.#toWorldCoordinates(
        this.#scratchVector5.copy(upperRightLink.position).sub(rightIntersectionPointShifted).add(upperRightLink.position),
        parentObject
      );

      const lowerLeftLookAt = this.#toWorldCoordinates(leftIntersectionPoint, parentObject);
      const lowerLeftLookAtReversed = this.#toWorldCoordinates(
        this.#scratchVector5.copy(lowerLeftLink.position).sub(leftIntersectionPoint).add(lowerLeftLink.position),
        parentObject
      );

      const lowerRightLookAt = this.#toWorldCoordinates(rightIntersectionPoint, parentObject);
      const lowerRightLookAtReversed = this.#toWorldCoordinates(
        this.#scratchVector5.copy(lowerRightLink.position).sub(rightIntersectionPoint).add(lowerRightLink.position),
        parentObject
      );

      // Position and aim the main link bearings in the right direction.
      upperLeftLink.up.set(0, 0, 1);
      upperLeftLink.lookAt(upperLeftLookAt);
      upperLeftBackBearing.up.copy(UP_VECTOR)
      upperLeftBackBearing.lookAt(upperLeftLookAtReversed);

      upperRightLink.up.copy(UP_VECTOR)
      upperRightLink.lookAt(upperRightLookAt);
      upperRightBackBearing.up.copy(UP_VECTOR)
      upperRightBackBearing.lookAt(upperRightLookAtReversed);

      lowerLeftLink.up.set(0, 0, 1);
      lowerLeftLink.lookAt(lowerLeftLookAt);
      lowerLeftBackBearing.up.copy(UP_VECTOR)
      lowerLeftBackBearing.lookAt(lowerLeftLookAtReversed);

      lowerRightLink.up.set(0, 0, 1);
      lowerRightLink.lookAt(lowerRightLookAt);
      lowerRightBackBearing.up.copy(UP_VECTOR)
      lowerRightBackBearing.lookAt(lowerRightLookAtReversed);

      upperLeftFrontBearing.up.copy(UP_VECTOR);
      upperLeftFrontBearing.lookAt(this.#toWorldCoordinates(this.#scratchVector5.copy(leftIntersectionPointShifted).sub(upperLeftLink.position).add(leftIntersectionPointShifted), parentObject));

      upperRightFrontBearing.up.copy(UP_VECTOR);
      upperRightFrontBearing.lookAt(this.#toWorldCoordinates(this.#scratchVector5.copy(rightIntersectionPointShifted).sub(upperRightLink.position).add(rightIntersectionPointShifted), parentObject));

      lowerLeftFrontBearing.up.copy(UP_VECTOR);
      lowerLeftFrontBearing.lookAt(this.#toWorldCoordinates(this.#scratchVector5.copy(leftIntersectionPoint).sub(lowerLeftLink.position).add(leftIntersectionPoint), parentObject));

      lowerRightFrontBearing.up.copy(UP_VECTOR);
      lowerRightFrontBearing.lookAt(this.#toWorldCoordinates(this.#scratchVector5.copy(rightIntersectionPoint).sub(lowerRightLink.position).add(rightIntersectionPoint), parentObject));
      
      const receiverMainBearingAxis = this.#scratchVector1.copy(rightIntersectionPoint)
        .sub(leftIntersectionPoint).normalize();

      const rotationAxis = this.#scratchVector2.copy(RECEIVER_DIRECTION).cross(receiverMainBearingAxis).normalize();
      const rotationAngle = Math.acos(RECEIVER_DIRECTION.dot(receiverMainBearingAxis));
      const rollQuaternion = (new Quaternion()).setFromAxisAngle(rotationAxis, rotationAngle);

      const leftPitcherEndBearingPosition = (new Vector3(0, -55, 0))
        .applyQuaternion(
          rollQuaternion.clone().multiply(pitchBearingQuaternion)
        ).add(leftIntersectionPoint);

      const leftPitcherSuccess = this.#computePitcherInverseKinematics(
        leftPitcher, leftPitcherLink, leftPitcherEndBearingPosition, leftPitchServoAngle, angleLinkLength, parentObject
      );

      const rightPitcherEndBearingPosition = this.#scratchVector3.copy(leftPitcherEndBearingPosition)
        .add(this.#scratchVector4.copy(rightIntersectionPoint)
        .sub(leftIntersectionPoint));

      const rightPitcherSuccess = this.#computePitcherInverseKinematics(
        rightPitcher, rightPitcherLink, rightPitcherEndBearingPosition, rightPitchServoAngle, angleLinkLength, parentObject
      );

      if (leftPitcherSuccess && rightPitcherSuccess) {
        this._lastLeftPitcherEndBearingPosition = leftPitcherEndBearingPosition;
      } else {
        console.warn('Invalid model arrangement. No intersection found for positioning pitcher link!');
      }

      const receiverQuaternion = rollQuaternion.multiply(pitchQuaternion);

      receiver.position.copy(this.#scratchVector1.copy(leftIntersectionPoint).lerp(rightIntersectionPoint, 0.5));
      receiver.setRotationFromQuaternion(receiverQuaternion);

      modCase.position.copy(receiver.position);
      modCase.setRotationFromQuaternion(receiverQuaternion.clone().multiply(twistQuaternion));
    } else {
      console.warn('No valid intersection found for link arms!');
    }
  }
  
  #computePitcherInverseKinematics(pitcher, pitcherLink, pitcherEndBearingPosition, pitcherServoAngle, angleLinkLength, parentObject) {
    const intersectionPoints = circleSphereIntersection(
      pitcher.position,
      75, // Distance between pitcher hole and arm hole on the receiver...
      new Vector3(-1, 0, 0),
      pitcherEndBearingPosition,
      angleLinkLength, // Length of pitcher link arm to the hole...
    );

    if (intersectionPoints) {
      const position = this.#intersectionPointsToPosition(intersectionPoints);

      pitcherLink.position.copy(position);

      // Correct servo angle using inverse kinematics.
      const correctPitcherVector = pitcherLink.position.clone().sub(pitcher.position);
      const currentPitcherVector = this.#scratchVector2.copy(PITCHER_BEARING_VECTOR).applyAxisAngle(RECEIVER_DIRECTION, -pitcherServoAngle);
      const correction = correctPitcherVector.angleTo(currentPitcherVector);

      const direction = vectorDirection(correctPitcherVector, currentPitcherVector, X_AXIS);
      pitcher.rotation.x -= (correction * direction);

      pitcherLink.up.fromArray([0, 0, 1]);
      pitcherLink.lookAt(this.#toWorldCoordinates(pitcherEndBearingPosition, parentObject));

      return true;
    }

    return false;
  }

  #computeMainLinkIntersectionPoint (upperLinkPosition, lowerLinkPosition) {
    const linkArmLength = 175; // mm

    const intersection = circleCircleIntersection(
      upperLinkPosition, linkArmLength, lowerLinkPosition, linkArmLength
    );

    if (!intersection || intersection.radius === 0) {
      return null;
    }

    const tangentVector = this.#scratchVector1.copy(upperLinkPosition).sub(lowerLinkPosition).cross(X_AXIS).normalize();

    return { 
      intersection: intersection.center.clone().add(tangentVector.multiplyScalar(intersection.radius)),
      center: intersection.center,
      radius: intersection.radius,
    };
  }

  #computeLinkPosition (armPosition, angle, scale = 1) {
    return (new Vector3(0, -50, 0)).applyAxisAngle(X_AXIS, angle).add(armPosition).addScaledVector(X_AXIS, scale * 14.5);
  }

  #toWorldCoordinates (vector, parentObject) {
    const worldVector = vector.clone().applyAxisAngle(X_AXIS, this.#orientation);

    if (parentObject) {
      worldVector.applyMatrix4(parentObject.matrixWorld);
    }

    return worldVector;
  }

  #intersectionPointsToPosition (points) {
    return points.length === 1 ? points[0] :
      points[0].y < points[1].y ? points[0] :
      points[1];
  }

  /**
   * Compute the angles for the servos based on the algorithm from the actual SR6 Firmware.
   */
  #computeFirmwareServoAngles (axes) {
    const pitchServoZero = 1580;
    const rightPitchServoZero = (1515.105 - pitchServoZero) + 1515.105;
    const servoZero = 1515.105;
    const servoFrequency = 330;
    const servoInterval = 1000000 / servoFrequency;
    const msPerRad = 637;

    const setMainServo = (x, y) => {
      // Function to calculate the angle for the main arm servos
      // Inputs are target x,y coords of receiver pivot in 1/100 of a mm
      x /= 100; y /= 100;               // Convert to mm
      const gamma = Math.atan2(x, y);   // Angle of line from servo pivot to receiver pivot
      const csq = x*x + y*y;            // Square of distance between servo pivot and receiver pivot
      const c = Math.sqrt(csq);         // Distance between servo pivot and receiver pivot

      let betaCos = (csq - 28125)/(100*c)
      betaCos = betaCos < -1 ? -1 : betaCos > 1 ? 1 : betaCos;
      const beta = Math.acos(betaCos);  // Angle between c-line and servo arm
      return msPerRad*(gamma + beta - 3.14159);       // Servo signal output, from neutral
    };

    const setPitchServo = (x, y, z, pitch) => {
      // Function to calculate the angle for the pitcher arm servos
      // Inputs are target x,y,z coords of receiver upper pivot in 1/100 of a mm
      // Also pitch in 1/100 of a degree
      pitch *= 0.0001745; // Convert to radians
      x += 5500*Math.sin(0.2618 + pitch);
      y -= 5500*Math.cos(0.2618 + pitch);
      x /= 100; y /= 100; z /= 100;             // Convert to mm
      const bsq = 36250 - (75 + z)*(75 + z);    // Equivalent arm length
      const gamma = Math.atan2(x,y);            // Angle of line from servo pivot to receiver pivot
      const csq = x*x + y*y;                    // Square of distance between servo pivot and receiver pivot
      const c = Math.sqrt(csq);                 // Distance between servo pivot and receiver pivot

      let betaCos = (csq + 5625 - bsq)/(150*c);
      betaCos = betaCos < -1 ? -1 : betaCos > 1 ? 1 : betaCos;

      const beta = Math.acos(betaCos); // Angle between c-line and servo arm

      return msPerRad*(gamma + beta - 3.14159);           // Servo signal output, from neutral
    }

    let roll,pitch,fwd,thrust,side;
    let out1,out2,out3,out4,out5,out6;
    
    roll = mapDecimal(axes['R1'], 0, 0.9999, -3000, 3000);
    pitch = mapDecimal(axes['R2'], 0, 0.9999, -2500, 2500);
    fwd = mapDecimal(axes['L1'], 0, 0.9999, -3000, 3000); // 60 mm
    thrust = mapDecimal(axes['L0'], 0, 0.9999, -6000, 6000); // 120 mm stroke length
    side = mapDecimal(axes['L2'], 0, 0.9999, -3000, 3000); // 60 mm

    // Main arms
    out1 = setMainServo(16248 - fwd, 1500 + thrust + roll); // Lower left servo
    out2 = setMainServo(16248 - fwd, 1500 - thrust - roll); // Upper left servo
    out5 = setMainServo(16248 - fwd, 1500 - thrust + roll); // Upper right servo
    out6 = setMainServo(16248 - fwd, 1500 + thrust - roll); // Lower right servo

    // Pitchers
    out3 = setPitchServo(16248 - fwd, 4500 - thrust,  side - 1.5*roll, -pitch);
    out4 = setPitchServo(16248 - fwd, 4500 - thrust, -side + 1.5*roll, -pitch);

    // Set Servos
    const lowerLeftServo = mapDecimal(servoZero - out1, 0, servoInterval, 0, 65535);
    const upperLeftServo = mapDecimal(servoZero + out2, 0, servoInterval, 0, 65535);
    const leftPitchServo = mapDecimal(constrain(pitchServoZero - out3, pitchServoZero - 600, pitchServoZero + 1000), 0, servoInterval, 0, 65535);
    const rightPitchServo = mapDecimal(constrain(rightPitchServoZero + out4, rightPitchServoZero - 1000, rightPitchServoZero + 600), 0, servoInterval, 0, 65535);
    const upperRightServo = mapDecimal(servoZero - out5, 0, servoInterval, 0, 65535);
    const lowerRightServo = mapDecimal(servoZero + out6, 0, servoInterval, 0, 65535);

   const scale = 0.5; // 180 degrees rotation

    return {
      lowerLeftServoAngle: servoToRotation(lowerLeftServo, scale) - Math.PI,
      upperLeftServoAngle: servoToRotation(upperLeftServo, scale),
      lowerRightServoAngle: servoToRotation(lowerRightServo, -scale) - Math.PI,
      upperRightServoAngle: servoToRotation(upperRightServo, -scale),
      leftPitchServoAngle: servoToRotation(leftPitchServo, -scale),
      rightPitchServoAngle: servoToRotation(rightPitchServo, scale),
    }
  }
}
