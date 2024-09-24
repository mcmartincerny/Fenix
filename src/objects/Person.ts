import {
  CylinderGeometry,
  Material,
  Mesh,
  MeshStandardMaterial,
  MeshToonMaterial,
  OctahedronGeometry,
  Sphere,
  SphereGeometry,
  Vector3 as Vector3Class,
  Vector3Like,
} from "three";
import { BetterObject3D } from "./BetterObject3D";
import { ParametricGeometry } from "three/addons/geometries/ParametricGeometry.js";
import { generateGradientMap } from "../texturesAndMaps/firstStuff";
import RAPIER, { GenericImpulseJoint, JointAxesMask } from "@dimforge/rapier3d-compat";
import { calfHandleIds, feetHandleIds, world } from "../Globals";
import { getYawFromQuaternion, isSomeChildTouchingGround, keepRigidBodyUpright, log, rotateVectorAroundZ, throttle, toRange, Vector3 } from "../helpers";

const LEFT_LEG_X_OFFSET = 0.1;
export interface StandardController {
  getMovement(): {
    direction: { x: number; y: number };
    rotation: { x: number; y: number };
    speed: number;
    jump: boolean;
  };
  dispose(): void;
}

export class Person extends BetterObject3D {
  private controller: StandardController;
  private torso: Torso;
  private head: Head;
  private leftArm: Arm;
  private rightArm: Arm;
  private leftForearm: Forearm;
  private rightForearm: Forearm;
  private leftLeg: Leg;
  private rightLeg: Leg;
  private leftCalf: Leg;
  private rightCalf: Leg;
  private leftFoot: Leg;
  private rightFoot: Leg;

  constructor(controller?: StandardController) {
    super();
    this.controller = controller || new StillController();
    this.torso = new Torso();
    this.head = new Head();
    this.leftArm = new Arm();
    this.rightArm = new Arm(true);
    this.leftForearm = new Forearm();
    this.rightForearm = new Forearm(true);
    this.leftLeg = new Leg();
    this.rightLeg = new Leg(true);
    this.leftCalf = new Calf();
    this.rightCalf = new Calf(true);
    this.leftFoot = new Foot();
    this.rightFoot = new Foot(true);
    this.addMultiple(this.torso, this.head, this.leftArm, this.rightArm, this.leftForearm, this.rightForearm, this.leftLeg, this.rightLeg);
    this.addMultiple(this.leftCalf, this.rightCalf, this.leftFoot, this.rightFoot);
  }

  init() {
    super.init();
    this.setupJoints();
    // this.torso.rigidBody!.setLinearDamping(0.5); //TODO: maybe?
  }
  rightFeetWalking = false;
  lastFeetSwitch = 0;
  lastJump = 0;
  beforeUpdate(): void {
    const tBody = this.torso.rigidBody!;
    const contMov = this.controller.getMovement();
    if (isSomeChildTouchingGround(this) === false) {
      // console.log("not touching ground");
      tBody.setGravityScale(0.7, true);
      return;
    }
    // console.log("touching ground");
    const averageFeetPosition = new Vector3().addVectors(this.leftFoot.rigidBody!.translation(), this.rightFoot.rigidBody!.translation()).divideScalar(2);
    const torsoPosition = new Vector3(this.torso.rigidBody!.translation());
    const horizontalDifference = averageFeetPosition.clone().sub(torsoPosition).setZ(0).length();
    const legStandingCutOff = 0.5;
    const walkSpeedStatusModifier = toRange(legStandingCutOff - horizontalDifference, { min: 0, max: legStandingCutOff }, { min: 0, max: 1 });
    const dotBetweenFeetAndMovement = averageFeetPosition
      .clone()
      .sub(torsoPosition)
      .setZ(0)
      .normalize()
      .dot(new Vector3(contMov.direction.x, contMov.direction.y, 0).normalize());
    const MIN_CUT_OFF_FOR_WALK_IN_FEET_DIRECTION = 0.5;
    const walkSpeedDirectionStatusModifier = toRange(dotBetweenFeetAndMovement, { min: MIN_CUT_OFF_FOR_WALK_IN_FEET_DIRECTION, max: 1 }, { min: 0, max: 1 });
    const MAX_DISTANCE_BETWEEN_TORSO_AND_FEET = 1.15;
    const verticalDistanceBetweenTorsoAndFeet = clamp(torsoPosition.z - averageFeetPosition.z, 0, MAX_DISTANCE_BETWEEN_TORSO_AND_FEET);
    const differenceBetweenTorsoAndFeet = new Vector3(torsoPosition).setZ(0).sub(averageFeetPosition.clone().setZ(0)).length();
    const antigravFeetXYModifier = toRange(differenceBetweenTorsoAndFeet, { min: 0, max: 0.3 }, { min: 1, max: 0.5 });
    const antigravFeetXYForce = 0.1;
    // the smaller the distance the stronger the antigrav
    const antigravFeetZmodifier = toRange(verticalDistanceBetweenTorsoAndFeet, { min: 0.5, max: MAX_DISTANCE_BETWEEN_TORSO_AND_FEET }, { min: 1, max: 0.5 });
    // console.log(antigravStatusModifier);
    const antigravFeetZForce = 0.2; // TODO maybe 0.3???
    const antigrav = antigravFeetZForce * antigravFeetZmodifier + antigravFeetXYForce * antigravFeetXYModifier;
    tBody.setGravityScale(-antigrav, true); // TODO: make the antigrav stronger based on the foot position
    const walkSpeedModifier = 0.0007; // TODO: calculate this from the status of the person
    const walkModifiedSpeed = contMov.speed * walkSpeedModifier * clamp(walkSpeedStatusModifier + walkSpeedDirectionStatusModifier, 0, 1);
    let jumpSpeed = 0;
    if (contMov.jump && this.lastJump + 1000 < Date.now()) {
      this.lastJump = Date.now();
      jumpSpeed = toRange(verticalDistanceBetweenTorsoAndFeet, { min: 0.5, max: MAX_DISTANCE_BETWEEN_TORSO_AND_FEET }, { min: 0, max: 0.3 });
    }
    const walkTotalSpeedX = contMov.direction.x * walkModifiedSpeed;
    const walkTotalSpeedY = contMov.direction.y * walkModifiedSpeed;
    tBody.applyImpulse(new RAPIER.Vector3(walkTotalSpeedX, walkTotalSpeedY, jumpSpeed), true);

    const shouldWalk = contMov.direction.x !== 0 || contMov.direction.y !== 0;
    (this.torso.mainMesh!.material as MeshToonMaterial).color.set(shouldWalk ? 0xff0000 : 0x8e44ad);
    // const shouldWalk = true;
    // feet walking
    // throw new Error(
    //   "TODO: Completely refactor and rewrite the shouldWalk and not walk mechanic. There should not be 2 mechanics, there should be one where it stabilizes feet one after another. When the feet are under the body, it should stay at rest, but when the body is more far apart from both feet, one feet should lift up and make a step towards the body direction of movement NOT the opposite of the other feet. It would work too but far more poorly."
    // );
    if (shouldWalk) {
      const distanceBetweenFeet = new Vector3(this.leftFoot.rigidBody!.translation()).distanceTo(this.rightFoot.rigidBody!.translation());
      const feetSwitchCutOff = 0.5;
      const minTimeBeforeSwitch = 1000; // TODO: determine if the switch should occure by the movement direction and feet position
      if (distanceBetweenFeet > feetSwitchCutOff && this.lastFeetSwitch + minTimeBeforeSwitch < Date.now()) {
        console.log("switching feet after " + (Date.now() - this.lastFeetSwitch) + "ms");
        this.rightFeetWalking = !this.rightFeetWalking;
        this.lastFeetSwitch = Date.now();
      }
      const walkingFeetRigidBody = this.rightFeetWalking ? this.rightFoot.rigidBody! : this.leftFoot.rigidBody!;
      const notWalkingFeetRigidBody = this.rightFeetWalking ? this.leftFoot.rigidBody! : this.rightFoot.rigidBody!;
      const verticalDistanceBetweenFeet = walkingFeetRigidBody.translation().z - notWalkingFeetRigidBody.translation().z;
      const IdealVerticalDistanceBetweenFeet = 0.1;
      const feetUpForceKp = 0.01; //0.01; //TODO fix
      const feetUpForceKd = 0.002; //0.002;
      // try to push walking feet up so the difference between feet is bigger than minIdealVerticalDistanceBetweenFeet
      const feetUpDifference = IdealVerticalDistanceBetweenFeet - verticalDistanceBetweenFeet;
      const walkingFeetVelocityZ = walkingFeetRigidBody.linvel().z;
      const feetUpForce = feetUpDifference * feetUpForceKp;
      const feetUpDampingForce = -walkingFeetVelocityZ * feetUpForceKd;
      const totalFeetUpForce = feetUpForce + feetUpDampingForce;
      const walkingFeetPositionXY = { ...walkingFeetRigidBody.translation(), z: 0 };
      const notWalkingFeetPositionXY = { ...notWalkingFeetRigidBody.translation(), z: 0 };
      const torsoPositionXY = { ...tBody.translation(), z: 0 };
      const differenceBetweenTorsoAndNotWalkingFeet = new Vector3().subVectors(torsoPositionXY, notWalkingFeetPositionXY);
      const walkingFeetIdealPosition = new Vector3().addVectors(torsoPositionXY, differenceBetweenTorsoAndNotWalkingFeet);

      debugRigidBody(walkingFeetIdealPosition, "walkingFeetIdealPosition");
      const walkingFeetPositionDifference = walkingFeetIdealPosition.sub(walkingFeetPositionXY);
      const walkingSpeedVelocityXY = new Vector3(walkingFeetRigidBody.linvel().x, walkingFeetRigidBody.linvel().y, 0);
      const feetHorizontalForceKp = 0.002;
      const feetHorizontalForceKd = 0.0001;
      const walkingFeetHorizontalForce = walkingFeetPositionDifference.multiplyScalar(feetHorizontalForceKp);
      const walkingFeetHorizontalDampingForce = walkingSpeedVelocityXY.multiplyScalar(-feetHorizontalForceKd);
      const walkingFeetHorizontalTotalForce = walkingFeetHorizontalForce.add(walkingFeetHorizontalDampingForce);
      walkingFeetRigidBody.applyImpulse(walkingFeetHorizontalTotalForce.add({ x: 0, y: 0, z: totalFeetUpForce }), true);
      // apply opposite force to the torso
      tBody.applyImpulse(new RAPIER.Vector3(-walkingFeetHorizontalTotalForce.x, -walkingFeetHorizontalTotalForce.y, 0), true);
      // keep the not walking feet upright
      keepRigidBodyUpright(walkingFeetRigidBody, this.torso.rigidBody!.rotation());
      keepRigidBodyUpright(notWalkingFeetRigidBody, this.torso.rigidBody!.rotation());
    } else {
      // position feet under the torso
      const FORCE_MULTIPLIER_TO_KEEP_FEET_UNDER_TORSO = 0.0003;
      const DAMPING_FORCE_MULTIPLIER_TO_KEEP_FEET_UNDER_TORSO = 0.000003;
      const DAMPING_TORSO_FORCE = 0.0002;
      const MAX_FORCE_TO_KEEP_FEET_UNDER_TORSO = 0.01;
      const rightFoot = this.rightFoot.rigidBody!;
      const leftFoot = this.leftFoot.rigidBody!;
      const torsoRotationQuat = this.torso.rigidBody!.rotation();
      const torsoYaw = getYawFromQuaternion(torsoRotationQuat); // Get yaw angle (Z-axis rotation)
      // Apply rotation to the leg offsets
      const rightLegOffset = rotateVectorAroundZ(new Vector3(-LEFT_LEG_X_OFFSET, 0, 0), torsoYaw);
      const leftLegOffset = rotateVectorAroundZ(new Vector3(LEFT_LEG_X_OFFSET, 0, 0), torsoYaw);
      const idealPositionRight = torsoPosition.clone().setZ(0).add(rightLegOffset);
      const idealPositionLeft = torsoPosition.clone().setZ(0).add(leftLegOffset);
      const rightFootPositionDifference = idealPositionRight.clone().sub({ ...rightFoot.translation(), z: 0 });
      const leftFootPositionDifference = idealPositionLeft.clone().sub({ ...leftFoot.translation(), z: 0 });
      const rightFootPositionForce = rightFootPositionDifference
        .multiplyScalar(FORCE_MULTIPLIER_TO_KEEP_FEET_UNDER_TORSO)
        .clampLength(0, MAX_FORCE_TO_KEEP_FEET_UNDER_TORSO);
      const leftFootPositionForce = leftFootPositionDifference
        .multiplyScalar(FORCE_MULTIPLIER_TO_KEEP_FEET_UNDER_TORSO)
        .clampLength(0, MAX_FORCE_TO_KEEP_FEET_UNDER_TORSO);
      const rightFootVelocity = new Vector3(rightFoot.linvel().x, rightFoot.linvel().y, 0);
      const leftFootVelocity = new Vector3(leftFoot.linvel().x, leftFoot.linvel().y, 0);
      const rightFootDampingForce = rightFootVelocity.multiplyScalar(-DAMPING_FORCE_MULTIPLIER_TO_KEEP_FEET_UNDER_TORSO);
      const leftFootDampingForce = leftFootVelocity.multiplyScalar(-DAMPING_FORCE_MULTIPLIER_TO_KEEP_FEET_UNDER_TORSO);
      const rightFootTotalForce = rightFootPositionForce.add(rightFootDampingForce);
      const leftFootTotalForce = leftFootPositionForce.add(leftFootDampingForce);
      // rightFoot.applyImpulse(new RAPIER.Vector3(rightFootTotalForce.x, rightFootTotalForce.y, 0), true);
      // leftFoot.applyImpulse(new RAPIER.Vector3(leftFootTotalForce.x, leftFootTotalForce.y, 0), true);
      // apply opposite force to the torso
      const torsoPositionForce = rightFootTotalForce.add(leftFootTotalForce).multiplyScalar(-1);
      const torsoLinVel = new Vector3(tBody.linvel().x, tBody.linvel().y, 0);
      const torsoDampingForce = torsoLinVel.multiplyScalar(-DAMPING_TORSO_FORCE);
      const torsoTotalForce = torsoPositionForce.add(torsoDampingForce);
      tBody.applyImpulse(new RAPIER.Vector3(torsoTotalForce.x, torsoTotalForce.y, 0), true);
      // straighten the feet
      keepRigidBodyUpright(rightFoot, this.torso.rigidBody!.rotation());
      keepRigidBodyUpright(leftFoot, this.torso.rigidBody!.rotation());

      // straighten the angle between leg and calf
      keepRigidBodyUpright(this.leftCalf.rigidBody!);
      keepRigidBodyUpright(this.rightCalf.rigidBody!);
      keepRigidBodyUpright(this.leftLeg.rigidBody!);
      keepRigidBodyUpright(this.rightLeg.rigidBody!);
    }

    const desiredAngle = Math.atan2(contMov.rotation.y, contMov.rotation.x) + Math.PI / 2; // Angle in radians + 90 degrees - needed for the rotation

    const rotationQuat = tBody.rotation(); // Get current rotation as quaternion

    const currentAngle = getYawFromQuaternion(rotationQuat); // Extract yaw (Z axis rotation)

    const angleError = desiredAngle - currentAngle;
    const normalizedError = Math.atan2(Math.sin(angleError), Math.cos(angleError));

    const Kp = 0.0004; // Proportional gain
    const Kd = 0.0002; // Derivative gain
    const pulse = Kp * normalizedError - Kd * tBody.angvel().z; // Calculate the pulse
    const rotateWhileStandingCutOff = 0.5;
    const rotateWhileStandingModifier = toRange(rotateWhileStandingCutOff - horizontalDifference, { min: 0, max: legStandingCutOff }, { min: 0.3, max: 1 });
    const modifiedPulse = pulse * rotateWhileStandingModifier;

    tBody.applyTorqueImpulse(new RAPIER.Vector3(0, 0, modifiedPulse), true);
  }

  setupJoints() {
    const headAnchor = new Vector3(0, 0, -this.head.mainMesh!.geometry.boundingBox!.max.z * 1.05);
    const torsoAnchor = new Vector3(0, 0, this.torso.mainMesh!.geometry.boundingBox!.max.z * 1.05);
    const headJointData = RAPIER.JointData.generic(
      torsoAnchor,
      headAnchor,
      new RAPIER.Vector3(1, 1, 1),
      JointAxesMask.LinX | JointAxesMask.LinY | JointAxesMask.LinZ | JointAxesMask.AngZ
    );
    const headJoint = world.createImpulseJoint(headJointData, this.torso.rigidBody!, this.head.rigidBody!, true);
    const leftFeetJointData = RAPIER.JointData.generic(
      new Vector3(0, 0, this.leftFoot.mainMesh!.geometry.boundingBox!.max.z),
      new Vector3(0, 0, this.leftCalf.mainMesh!.geometry.boundingBox!.min.z),
      new RAPIER.Vector3(1, 1, 1),
      JointAxesMask.LinX | JointAxesMask.LinY | JointAxesMask.LinZ | JointAxesMask.AngZ // maybe remove Z?
    );
    const leftFeetJoint = world.createImpulseJoint(leftFeetJointData, this.leftFoot.rigidBody!, this.leftCalf.rigidBody!, true);
    const rightFeetJointData = RAPIER.JointData.generic(
      new Vector3(0, 0, this.rightFoot.mainMesh!.geometry.boundingBox!.max.z),
      new Vector3(0, 0, this.rightCalf.mainMesh!.geometry.boundingBox!.min.z),
      new RAPIER.Vector3(1, 1, 1),
      JointAxesMask.LinX | JointAxesMask.LinY | JointAxesMask.LinZ | JointAxesMask.AngZ // maybe remove Z?
    );
    const rightFeetJoint = world.createImpulseJoint(rightFeetJointData, this.rightFoot.rigidBody!, this.rightCalf.rigidBody!, true);
    const leftCalfJointData = RAPIER.JointData.generic(
      new Vector3(0, 0, this.leftCalf.mainMesh!.geometry.boundingBox!.max.z),
      new Vector3(0, 0, this.leftLeg.mainMesh!.geometry.boundingBox!.min.z),
      new RAPIER.Vector3(1, 1, 1),
      JointAxesMask.LinX | JointAxesMask.LinY | JointAxesMask.LinZ | JointAxesMask.AngY | JointAxesMask.AngZ
    );
    const leftCalfJoint = world.createImpulseJoint(leftCalfJointData, this.leftCalf.rigidBody!, this.leftLeg.rigidBody!, true);
    const rightCalfJointData = RAPIER.JointData.generic(
      new Vector3(0, 0, this.rightCalf.mainMesh!.geometry.boundingBox!.max.z),
      new Vector3(0, 0, this.rightLeg.mainMesh!.geometry.boundingBox!.min.z),
      new RAPIER.Vector3(1, 1, 1),
      JointAxesMask.LinX | JointAxesMask.LinY | JointAxesMask.LinZ | JointAxesMask.AngZ
    );
    const rightCalfJoint = world.createImpulseJoint(rightCalfJointData, this.rightCalf.rigidBody!, this.rightLeg.rigidBody!, true);
    const leftLegJointData = RAPIER.JointData.generic(
      new Vector3(0, 0, this.leftLeg.mainMesh!.geometry.boundingBox!.max.z),
      new Vector3(this.leftLeg.position.x, 0, this.torso.mainMesh!.geometry.boundingBox!.min.z),
      new RAPIER.Vector3(1, 1, 1),
      JointAxesMask.LinX | JointAxesMask.LinY | JointAxesMask.LinZ | JointAxesMask.AngZ
    );
    const leftLegJoint = world.createImpulseJoint(leftLegJointData, this.leftLeg.rigidBody!, this.torso.rigidBody!, true);
    const rightLegJointData = RAPIER.JointData.generic(
      new Vector3(0, 0, this.rightLeg.mainMesh!.geometry.boundingBox!.max.z),
      new Vector3(this.rightLeg.position.x, 0, this.torso.mainMesh!.geometry.boundingBox!.min.z),
      new RAPIER.Vector3(1, 1, 1),
      JointAxesMask.LinX | JointAxesMask.LinY | JointAxesMask.LinZ | JointAxesMask.AngZ
    );
    const rightLegJoint = world.createImpulseJoint(rightLegJointData, this.rightLeg.rigidBody!, this.torso.rigidBody!, true);
    const leftForearmJointData = RAPIER.JointData.generic(
      new Vector3(0, 0, this.leftForearm.mainMesh!.geometry.boundingBox!.max.z),
      new Vector3(0, 0, this.leftArm.mainMesh!.geometry.boundingBox!.min.z),
      new RAPIER.Vector3(1, 1, 1),
      JointAxesMask.LinX | JointAxesMask.LinY | JointAxesMask.LinZ | JointAxesMask.AngZ
    );
    const leftForearmJoint = world.createImpulseJoint(leftForearmJointData, this.leftForearm.rigidBody!, this.leftArm.rigidBody!, true);
    const rightForearmJointData = RAPIER.JointData.generic(
      new Vector3(0, 0, this.rightForearm.mainMesh!.geometry.boundingBox!.max.z),
      new Vector3(0, 0, this.rightArm.mainMesh!.geometry.boundingBox!.min.z),
      new RAPIER.Vector3(1, 1, 1),
      JointAxesMask.LinX | JointAxesMask.LinY | JointAxesMask.LinZ | JointAxesMask.AngZ
    );
    const rightForearmJoint = world.createImpulseJoint(rightForearmJointData, this.rightForearm.rigidBody!, this.rightArm.rigidBody!, true);
    const leftArmJointData = RAPIER.JointData.generic(
      new Vector3(0, 0, this.leftArm.mainMesh!.geometry.boundingBox!.max.z),
      new Vector3(this.leftArm.position.x / 1.2, 0, -this.torso.mainMesh!.geometry.boundingBox!.min.z),
      new RAPIER.Vector3(1, 1, 1),
      JointAxesMask.LinX | JointAxesMask.LinY | JointAxesMask.LinZ | JointAxesMask.AngZ
    );
    const leftArmJoint = world.createImpulseJoint(leftArmJointData, this.leftArm.rigidBody!, this.torso.rigidBody!, true);
    const rightArmJointData = RAPIER.JointData.generic(
      new Vector3(0, 0, this.rightArm.mainMesh!.geometry.boundingBox!.max.z),
      new Vector3(this.rightArm.position.x / 1.2, 0, -this.torso.mainMesh!.geometry.boundingBox!.min.z),
      new RAPIER.Vector3(1, 1, 1),
      JointAxesMask.LinX | JointAxesMask.LinY | JointAxesMask.LinZ | JointAxesMask.AngY | JointAxesMask.AngZ
    );
    const rightArmJoint = world.createImpulseJoint(rightArmJointData, this.rightArm.rigidBody!, this.torso.rigidBody!, true);
  }
  dispose() {
    this.controller.dispose();
  }
}

export class BodyPart extends BetterObject3D {
  mainMesh?: Mesh;
  addMainMesh(mesh: Mesh) {
    this.mainMesh = mesh;
    (mesh.material as MeshStandardMaterial).wireframe = true;
    this.add(mesh);
  }
  init() {
    super.init();
    if (this.mainMesh == null) throw new Error("BodyPart must have a mainMesh");
    const pos = this.localToWorld(new Vector3());
    this.rigidBody = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(pos.x, pos.y, pos.z).setRotation(this.quaternion));
    this.mainMesh.geometry.computeBoundingBox();
    const boundingBox = this.mainMesh.geometry.boundingBox!.max;
    let colider: RAPIER.Collider;
    if (this instanceof Foot) {
      colider = world.createCollider(RAPIER.ColliderDesc.cuboid(boundingBox.x, boundingBox.y, boundingBox.z), this.rigidBody);
      colider.setFriction(0.3);
      colider.setActiveHooks(RAPIER.ActiveHooks.FILTER_CONTACT_PAIRS);
      feetHandleIds.add(this.rigidBody!.handle);
    } else {
      colider = world.createCollider(RAPIER.ColliderDesc.capsule(boundingBox.z / 3, (boundingBox.x + boundingBox.y) / 2), this.rigidBody);
      colider.setRotationWrtParent({ x: 1, y: 0.0, z: 0.0, w: 1 });
    }
    colider.setRestitution(0.3);
    if (this instanceof Calf) {
      colider.setActiveHooks(RAPIER.ActiveHooks.FILTER_CONTACT_PAIRS);
      calfHandleIds.add(this.rigidBody!.handle);
    }
    // colider.setFriction(1); // TODO: add some friction
  }
}

export class Torso extends BodyPart {
  constructor() {
    super();
    const torsoGeometry = new ParametricGeometry(parametricCurvedCube(0.6, 0.45, 0.3, 0.3), 100, 100);
    const torsoMaterial = new MeshToonMaterial({ color: 0x8e44ad, gradientMap: generateGradientMap() });
    const torsoMesh = new Mesh(torsoGeometry, torsoMaterial);
    this.addMainMesh(torsoMesh);
  }
}

export class Head extends BodyPart {
  constructor() {
    super();
    // const headGeometry = new SphereGeometry(0.15, 20, 20);
    const headGeometry = new ParametricGeometry(parametricCurvedCube(0.2, 0.16, 0.2, 0.3), 100, 100);
    headGeometry.computeBoundingBox();
    const headMaterial = new MeshToonMaterial({ color: 0xf1c27d, gradientMap: generateGradientMap() });
    const headMesh = new Mesh(headGeometry, headMaterial);
    this.position.z = 0.395;
    this.addMainMesh(headMesh);
  }

  init() {
    super.init();
    this.rigidBody!.setGravityScale(-1, false);
  }
}

export class Arm extends BodyPart {
  constructor(right = false) {
    super();
    const side = right ? 1 : -1;
    const material = new MeshToonMaterial({ color: 0x3498db, gradientMap: generateGradientMap() });
    const armGeometry = new ParametricGeometry(parametricCurvedCube(0.25, 0.09, 0.09, 0.2), 100, 100);
    const armMesh = new Mesh(armGeometry, material);
    // this.rotation.y = -(Math.PI / 6) * side;
    this.position.x = 0.22 * side;
    this.position.z = 0.15;
    this.addMainMesh(armMesh);
  }
}

export class Forearm extends BodyPart {
  constructor(right = false) {
    super();
    const side = right ? 1 : -1;
    const material = new MeshToonMaterial({ color: 0x3498db, gradientMap: generateGradientMap() });
    const forearmGeometry = new ParametricGeometry(parametricCurvedCube(0.35, 0.07, 0.07, 0.3), 100, 100);
    const forearmMesh = new Mesh(forearmGeometry, material);
    this.position.x = 0.275 * side;
    this.position.z = -0.1;
    this.addMainMesh(forearmMesh);
  }
}

export class Leg extends BodyPart {
  constructor(right = false) {
    super();
    const side = right ? 1 : -1;
    const material = new MeshToonMaterial({ color: 0x2ecc71, gradientMap: generateGradientMap() });
    const thighGeometry = new ParametricGeometry(parametricCurvedCube(0.4, 0.17, 0.17, 0.2), 100, 100);
    const thighMesh = new Mesh(thighGeometry, material);
    this.position.x = -LEFT_LEG_X_OFFSET * side;
    this.position.z = -0.48;
    this.addMainMesh(thighMesh);
  }
}

export class Calf extends BodyPart {
  constructor(right = false) {
    super();
    const side = right ? 1 : -1;
    const material = new MeshToonMaterial({ color: 0x2ecc71, gradientMap: generateGradientMap() });
    const calfGeometry = new ParametricGeometry(parametricCurvedCube(0.45, 0.14, 0.11, 0.4), 100, 100);
    const calfMesh = new Mesh(calfGeometry, material);
    this.position.x = -LEFT_LEG_X_OFFSET * side;
    this.position.z = -0.88;
    this.addMainMesh(calfMesh);
  }
}

export class Foot extends BodyPart {
  constructor(right = false) {
    super();
    const side = right ? 1 : -1;
    const material = new MeshToonMaterial({ color: 0x2ecc71, gradientMap: generateGradientMap() });
    const footGeometry = new ParametricGeometry(parametricCurvedCube(0.05, 0.1, 0.2, 0.3), 100, 100);
    const footMesh = new Mesh(footGeometry, material);
    this.position.x = -LEFT_LEG_X_OFFSET * side;
    this.position.z = -1.11;
    this.position.y = -0.07;
    this.addMainMesh(footMesh);
  }
}

class StillController implements StandardController {
  getMovement() {
    return {
      direction: { x: 0, y: 0 },
      rotation: { x: 0, y: -1 },
      speed: 0,
      jump: false,
    };
  }
  dispose(): void {
    return;
  }
}

const parametricCurvedCube = (height: number, width: number, depth: number, curve: number) => (u: number, v: number, target: Vector3) => {
  //   u = u * Math.PI;
  //   v = v * 2 * Math.PI;
  const angle = v * 2 * Math.PI; // Full rotation (0 to 2π)

  // Create a smooth curve for the y position to round the top and bottom
  let radiusFactor = Math.sin(u * Math.PI); // Makes the top and bottom curved
  radiusFactor = Math.pow(radiusFactor, curve); // Makes the top and bottom more rounded
  const x = (width / 2) * Math.cos(angle) * radiusFactor; // Apply radiusFactor to x and z to make the curvature
  const y = -(depth / 2) * Math.sin(angle) * radiusFactor;

  // y controls the height, centering the torso at y = 0 and using a sine curve for rounded top/bottom
  const z = (u - 0.5) * height;

  target.set(x, y, z);
};

const clamp = (value: number, min: number, max: number) => {
  return Math.min(Math.max(value, min), max);
};

/**
 * debug rigid body used only for visualizing some position
 * if there isn't one already created, it creates it and sets the position
 * if there is one already created, it sets the position
 */
const debugRigidBody = (position: Vector3Like, name: string, zOffset = 0.2) => {
  let debugRigidBody = debugRigidBodies.get(name);
  if (debugRigidBody == null) {
    debugRigidBody = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(position.x, position.y, position.z + zOffset));
    const coliderData = RAPIER.ColliderDesc.ball(0.1).setCollisionGroups(Math.round(Math.random() * 1000));
    world.createCollider(coliderData, debugRigidBody);
    debugRigidBodies.set(name, debugRigidBody);
  } else {
    debugRigidBody.setTranslation(new RAPIER.Vector3(position.x, position.y, position.z + zOffset), true);
  }
  return debugRigidBody;
};

const debugRigidBodies: Map<string, RAPIER.RigidBody> = new Map();
