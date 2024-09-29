import {
  CylinderGeometry,
  Material,
  Mesh,
  MeshStandardMaterial,
  MeshToonMaterial,
  OctahedronGeometry,
  Quaternion,
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
import {
  castRayBelow,
  debugRigidBody,
  getIdealPositionOfUpperFoot,
  getYawFromQuaternion,
  isBehindObjectInMovementXY,
  isSomeChildTouchingGround,
  isTouchingGround,
  keepRigidBodyUpright,
  log,
  rotateVectorAroundZ,
  throttle,
  toRange,
  Vector3,
} from "../helpers";

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

  torsoGravMemory: number[] = [];
  torsoGravMemoryLength = 10;
  addTorsoGravity(gravForce: number) {
    this.torsoGravMemory.push(gravForce);
    if (this.torsoGravMemory.length > this.torsoGravMemoryLength) {
      this.torsoGravMemory.shift();
    }
    const averageGrav = this.torsoGravMemory.reduce((acc, val) => acc + val, 0) / this.torsoGravMemoryLength;
    this.torso.rigidBody!.setGravityScale(averageGrav, true);
  }

  rightFeetWalking = false;
  lastFeetSwitch = 0;
  lastJump = 0;
  // lastTouchingGround = 0;
  beforeUpdate(): void {
    const tBody = this.torso.rigidBody!;
    const contMov = this.controller.getMovement();
    let leftFootRay = castRayBelow(this.leftFoot.rigidBody!.translation());
    let rightFootRay = castRayBelow(this.rightFoot.rigidBody!.translation());
    leftFootRay = leftFootRay === false ? 999 : leftFootRay;
    rightFootRay = rightFootRay === false ? 999 : rightFootRay;
    const closestRayDistance = Math.min(leftFootRay, rightFootRay);
    const IS_WALKING_RAY_DISTANCE = 0.2;
    const touchingGround = isSomeChildTouchingGround(this) || closestRayDistance < IS_WALKING_RAY_DISTANCE;
    if (!touchingGround) {
      this.addTorsoGravity(0.7);
    }
    const averageFeetPosition = new Vector3().addVectors(this.leftFoot.rigidBody!.translation(), this.rightFoot.rigidBody!.translation()).divideScalar(2);
    const torsoPosition = new Vector3(this.torso.rigidBody!.translation());
    const horizontalDifference = averageFeetPosition.clone().sub(torsoPosition).setZ(0).length();
    const legStandingCutOff = 0.5;
    if (touchingGround) {
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
      const antigravFeetZmodifier = toRange(verticalDistanceBetweenTorsoAndFeet, { min: 0.5, max: MAX_DISTANCE_BETWEEN_TORSO_AND_FEET }, { min: 1, max: 0.7 });
      const antigravFeetZForce = 0.25; // TODO maybe 0.3???
      const antigrav = antigravFeetZForce * antigravFeetZmodifier + antigravFeetXYForce * antigravFeetXYModifier;
      this.addTorsoGravity(-antigrav); // TODO: make the antigrav stronger based on the foot position
      const walkSpeedModifier = 0.0007; // TODO: calculate this from the status of the person
      const walkModifiedSpeed = contMov.speed * walkSpeedModifier * clamp(walkSpeedStatusModifier + walkSpeedDirectionStatusModifier, 0, 1);
      let jumpSpeed = 0;
      if (contMov.jump && this.lastJump + 1000 < Date.now() && verticalDistanceBetweenTorsoAndFeet > 0.5) {
        this.lastJump = Date.now();
        jumpSpeed = 0.3; // TODO: calculate this from the status of the person but not from height - we've been there already
        // TODO: also add direction of the walk to the jump
      }
      const walkTotalSpeedX = contMov.direction.x * walkModifiedSpeed;
      const walkTotalSpeedY = contMov.direction.y * walkModifiedSpeed;
      tBody.applyImpulse(new RAPIER.Vector3(walkTotalSpeedX, walkTotalSpeedY, jumpSpeed), true);

      if (walkTotalSpeedX === 0 || walkTotalSpeedY === 0) {
        // apply damping force on the torso
        const dampingForceMultiplier = 0.0001;
        const dampingForce = new Vector3(tBody.linvel()).multiplyScalar(-dampingForceMultiplier);
        tBody.applyImpulse(dampingForce, true);
      }
    }

    // TODO: Completely refactor and rewrite the shouldWalk and not walk mechanic.
    // There should not be 2 mechanics, there should be one where it stabilizes feet one after another.
    // When the feet are under the body, it should stay at rest, but when the body is more far apart from both feet,
    // one feet should lift up and make a step towards the body direction of movement NOT the opposite of the other feet. It would work too but far more poorly.
    const lowerFootDistanceBeforeSwitchingFeet = 0.5;
    let higherFoot = this.rightFeetWalking ? this.rightFoot.rigidBody! : this.leftFoot.rigidBody!;
    let lowerFoot = this.rightFeetWalking ? this.leftFoot.rigidBody! : this.rightFoot.rigidBody!;
    let higherFootPos = higherFoot.translation();
    let lowerFootPos = lowerFoot.translation();
    const isLowerFootBehindTorso1 = isBehindObjectInMovementXY(tBody, lowerFootPos);
    if (isLowerFootBehindTorso1) {
      const torsoXYPos = new Vector3(tBody.translation()).setZ(0);
      const lowerFootDistanceToTorsoXY = new Vector3(lowerFootPos).setZ(0).distanceTo(torsoXYPos);
      if (lowerFootDistanceToTorsoXY > lowerFootDistanceBeforeSwitchingFeet) {
        this.rightFeetWalking = !this.rightFeetWalking;
        higherFoot = this.rightFeetWalking ? this.rightFoot.rigidBody! : this.leftFoot.rigidBody!;
        lowerFoot = this.rightFeetWalking ? this.leftFoot.rigidBody! : this.rightFoot.rigidBody!;
        higherFootPos = higherFoot.translation();
        lowerFootPos = lowerFoot.translation();
      }
    }

    (this.rightFoot.mainMesh!.material as MeshToonMaterial).color.set(this.rightFeetWalking ? 0xff0000 : 0x2ecc71);
    (this.leftFoot.mainMesh!.material as MeshToonMaterial).color.set(this.rightFeetWalking ? 0x2ecc71 : 0xff0000);
    (this.rightCalf.mainMesh!.material as MeshToonMaterial).color.set(this.rightFeetWalking ? 0xff0000 : 0x2ecc71);
    (this.leftCalf.mainMesh!.material as MeshToonMaterial).color.set(this.rightFeetWalking ? 0x2ecc71 : 0xff0000);
    (this.rightLeg.mainMesh!.material as MeshToonMaterial).color.set(this.rightFeetWalking ? 0xff0000 : 0x2ecc71);
    (this.leftLeg.mainMesh!.material as MeshToonMaterial).color.set(this.rightFeetWalking ? 0x2ecc71 : 0xff0000);

    // stabilize the lower foot in it's position
    // damped the foot velocity
    const lowerFootDampeningMultiplier = 0.001;
    const lowerFootVelocity = new Vector3(lowerFoot.linvel());
    const lowerFootDampingForce = lowerFootVelocity.setZ(0).multiplyScalar(-lowerFootDampeningMultiplier);
    lowerFoot.applyImpulse(lowerFootDampingForce, true);

    // move the higher foot to the position of torso + velocity offset
    const higherFootXYForceKp = 0.007;
    const higherFootXYForceKd = 0.0005;
    const torsoXYPos = new Vector3(tBody.translation()).setZ(0);
    const torsoXYVel = new Vector3(tBody.linvel().x, tBody.linvel().y, 0);
    const torsoRotationQuat = this.torso.rigidBody!.rotation();

    // Horizontal force
    const torsoYaw = getYawFromQuaternion(torsoRotationQuat); // Get yaw angle (Z-axis rotation)
    // Apply rotation to the leg offsets
    const lowerFootDistanceToTorsoXY = new Vector3(lowerFootPos).setZ(0).distanceTo(torsoXYPos);
    const isLowerFootBehindTorso = isBehindObjectInMovementXY(tBody, lowerFootPos);
    const { higherFootIdealDistanceToTorso, higherFootIdealHeightDiff } = getIdealPositionOfUpperFoot(
      lowerFootDistanceToTorsoXY * (isLowerFootBehindTorso ? 1 : -1),
      torsoXYVel.length(),
      lowerFootDistanceBeforeSwitchingFeet
    );

    const higherFootIdealPositionWeirdOffset = rotateVectorAroundZ(
      new Vector3(this.rightFeetWalking ? -LEFT_LEG_X_OFFSET : LEFT_LEG_X_OFFSET, higherFootIdealDistanceToTorso, higherFootIdealHeightDiff),
      torsoYaw
    );
    const higherFootIdealPositionWithOffset = new Vector3(torsoXYPos).setZ(lowerFootPos.z).add(higherFootIdealPositionWeirdOffset);
    debugRigidBody(higherFootIdealPositionWithOffset, "higherFootIdealPositionWithOffset");
    const higherFootPositionDifference = new Vector3(higherFootIdealPositionWithOffset).sub(new Vector3(higherFootPos));
    const higherFootVelocity = new Vector3(higherFoot.linvel());
    const higherFootHorizontalForce = higherFootPositionDifference.multiplyScalar(higherFootXYForceKp);
    const higherFootHorizontalDampingForce = higherFootVelocity.multiplyScalar(-higherFootXYForceKd);
    const higherFootTotalForce = higherFootHorizontalForce.add(higherFootHorizontalDampingForce);

    higherFoot.applyImpulse(higherFootTotalForce, true);
    // apply opposite force to the torso
    tBody.applyImpulse(new Vector3(higherFootTotalForce).multiplyScalar(-1), true); // TODO: maybe add there the Z force too?????????????????????????????????

    if (touchingGround || closestRayDistance < IS_WALKING_RAY_DISTANCE * 3) {
      this.rightFoot.rigidBody!.setRotation(new RAPIER.Quaternion(0, 0, 0, 1), true);
      this.leftFoot.rigidBody!.setRotation(new RAPIER.Quaternion(0, 0, 0, 1), true);
    }

    // TODO: rotate only the mesh of the feet with the torso rotation

    keepRigidBodyUpright(this.leftCalf.rigidBody!);
    keepRigidBodyUpright(this.rightCalf.rigidBody!);
    keepRigidBodyUpright(this.leftLeg.rigidBody!);
    keepRigidBodyUpright(this.rightLeg.rigidBody!);
    keepRigidBodyUpright(this.torso.rigidBody!);

    // stabilize the torso position
    const torsoDampingForceMultiplier = 0.001;
    const torsoVelocity = new Vector3(0, 0, tBody.linvel().z);
    const torsoDampingForce = torsoVelocity.multiplyScalar(-torsoDampingForceMultiplier);
    // tBody.applyImpulse(torsoDampingForce, true);
    // stabilize the torso rotation
    const torsoDampingTorqueMultiplier = 0.00001;
    const angVel = tBody.angvel();
    const torsoDampingTorque = new Vector3(angVel.x, angVel.y, 0).multiplyScalar(-torsoDampingTorqueMultiplier);
    // tBody.applyTorqueImpulse(torsoDampingTorque, true);

    //

    //

    //

    //

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
      JointAxesMask.LinX | JointAxesMask.LinY | JointAxesMask.LinZ
    );
    const leftFeetJoint = world.createImpulseJoint(leftFeetJointData, this.leftFoot.rigidBody!, this.leftCalf.rigidBody!, true);
    const rightFeetJointData = RAPIER.JointData.generic(
      new Vector3(0, 0, this.rightFoot.mainMesh!.geometry.boundingBox!.max.z),
      new Vector3(0, 0, this.rightCalf.mainMesh!.geometry.boundingBox!.min.z),
      new RAPIER.Vector3(1, 1, 1),
      JointAxesMask.LinX | JointAxesMask.LinY | JointAxesMask.LinZ
    );
    const rightFeetJoint = world.createImpulseJoint(rightFeetJointData, this.rightFoot.rigidBody!, this.rightCalf.rigidBody!, true);
    const leftCalfJointData = RAPIER.JointData.generic(
      new Vector3(0, 0, this.leftCalf.mainMesh!.geometry.boundingBox!.max.z),
      new Vector3(0, 0, this.leftLeg.mainMesh!.geometry.boundingBox!.min.z),
      new RAPIER.Vector3(1, 1, 1),
      JointAxesMask.LinX | JointAxesMask.LinY | JointAxesMask.LinZ | JointAxesMask.AngZ
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
    leftLegJoint.setContactsEnabled(false);
    const rightLegJointData = RAPIER.JointData.generic(
      new Vector3(0, 0, this.rightLeg.mainMesh!.geometry.boundingBox!.max.z),
      new Vector3(this.rightLeg.position.x, 0, this.torso.mainMesh!.geometry.boundingBox!.min.z),
      new RAPIER.Vector3(1, 1, 1),
      JointAxesMask.LinX | JointAxesMask.LinY | JointAxesMask.LinZ | JointAxesMask.AngZ
    );
    const rightLegJoint = world.createImpulseJoint(rightLegJointData, this.rightLeg.rigidBody!, this.torso.rigidBody!, true);
    rightLegJoint.setContactsEnabled(false);
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
      colider = world.createCollider(RAPIER.ColliderDesc.cuboid(boundingBox.y, boundingBox.y, boundingBox.z), this.rigidBody);
      colider.setFriction(0.3);
      colider.setRestitution(0);
      colider.setActiveHooks(RAPIER.ActiveHooks.FILTER_CONTACT_PAIRS);
      feetHandleIds.add(this.rigidBody!.handle);
    } else {
      colider = world.createCollider(RAPIER.ColliderDesc.capsule(boundingBox.z / 3, (boundingBox.x + boundingBox.y) / 2), this.rigidBody);
      colider.setRotationWrtParent({ x: 1, y: 0.0, z: 0.0, w: 1 });
      colider.setRestitution(1);
    }
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
    const footGeometry = new ParametricGeometry(parametricCurvedCube(0.05, 0.2, 0.2, 0.3), 100, 100);
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
