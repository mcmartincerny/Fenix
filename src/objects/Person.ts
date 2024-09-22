import { CylinderGeometry, Mesh, MeshStandardMaterial, MeshToonMaterial, OctahedronGeometry, Sphere, SphereGeometry, Vector3, Vector3Like } from "three";
import { BetterObject3D } from "./BetterObject3D";
import { ParametricGeometry } from "three/addons/geometries/ParametricGeometry.js";
import { generateGradientMap } from "../texturesAndMaps/firstStuff";
import RAPIER, { GenericImpulseJoint, JointAxesMask } from "@dimforge/rapier3d-compat";
import { world } from "../Globals";
import { isSomeChildTouchingGround } from "../helpers";

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
    // this.torso.rigidBody!.setAngularDamping(5);
  }
  lastJump = 0;
  beforeUpdate(): void {
    const tBody = this.torso.rigidBody!;
    if (isSomeChildTouchingGround(this) === false) {
      // console.log("not touching ground");
      tBody.setGravityScale(0.7, true);
      return;
    }
    // console.log("touching ground");
    tBody.setGravityScale(-0.3, true); // TODO: make the antigrav stronger based on the foot position
    const { direction, rotation, speed, jump } = this.controller.getMovement();
    const speedModifier = 0.001; // TODO: calculate this from the status of the person
    const modifiedSpeed = speed * speedModifier;
    let jumpSpeed = 0;
    if (jump && this.lastJump + 1000 < Date.now()) {
      this.lastJump = Date.now();
      jumpSpeed = 0.3; // TODO: calculate this from the status of the person
    }
    tBody.applyImpulse(new RAPIER.Vector3(direction.x * modifiedSpeed, direction.y * modifiedSpeed, jump ? jumpSpeed : 0), true);
    // console.log(tBody.linvel().x.toFixed(2), tBody.linvel().y.toFixed(2), tBody.linvel().z.toFixed(2));
    // console.log(this.torso.rigidBody!.rotation().z);
    // const difference = this.torso.rigidBody!.rotation().z - rotation;
    // const pulse = difference * 0.00001;
    // console.log(pulse);
    // TODO: This does not really work well
    // tBody.applyTorqueImpulse(new RAPIER.Vector3(0, 0, pulse), true);

    // const linVel = tBody.linvel(); // Get the linear velocity
    const linVel = rotation; // TODO: Maybe change? Just a test?
    const desiredAngle = Math.atan2(linVel.y, linVel.x) + Math.PI / 2; // Angle in radians + 90 degrees - needed for the rotation

    const rotationQuat = tBody.rotation(); // Get current rotation as quaternion

    function getYawFromQuaternion(q: RAPIER.Quaternion): number {
      const siny_cosp = 2 * (q.w * q.z + q.x * q.y);
      const cosy_cosp = 1 - 2 * (q.y * q.y + q.z * q.z);
      return Math.atan2(siny_cosp, cosy_cosp); // Return angle in radians
    }

    const currentAngle = getYawFromQuaternion(rotationQuat); // Extract yaw (Z axis rotation)

    const angleError = desiredAngle - currentAngle;
    const normalizedError = Math.atan2(Math.sin(angleError), Math.cos(angleError));
    console.log(`Desired: ${desiredAngle.toFixed(2)}, Current: ${currentAngle.toFixed(2)}, Error: ${normalizedError.toFixed(2)}`);

    const Kp = 0.0004; // Proportional gain
    const Kd = 0.0002; // Derivative gain
    const pulse = Kp * normalizedError - Kd * tBody.angvel().z; // Calculate the pulse

    tBody.applyTorqueImpulse(new RAPIER.Vector3(0, 0, pulse), true);
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
    // headJoint.setContactsEnabled(false);
    const leftFeelJointData = RAPIER.JointData.fixed(this.leftFoot.position, this.leftFoot.quaternion, this.leftCalf.position, this.leftCalf.quaternion);
    const leftFeetJoint = world.createImpulseJoint(leftFeelJointData, this.leftCalf.rigidBody!, this.leftFoot.rigidBody!, true);
    const rightFeelJointData = RAPIER.JointData.fixed(this.rightFoot.position, this.rightFoot.quaternion, this.rightCalf.position, this.rightCalf.quaternion);
    const rightFeetJoint = world.createImpulseJoint(rightFeelJointData, this.rightCalf.rigidBody!, this.rightFoot.rigidBody!, true);
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
      JointAxesMask.LinX | JointAxesMask.LinY | JointAxesMask.LinZ | JointAxesMask.AngY | JointAxesMask.AngZ
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
      JointAxesMask.LinX | JointAxesMask.LinY | JointAxesMask.LinZ | JointAxesMask.AngY | JointAxesMask.AngZ
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
    } else {
      colider = world.createCollider(RAPIER.ColliderDesc.capsule(boundingBox.z / 3, (boundingBox.x + boundingBox.y) / 2), this.rigidBody);
      colider.setRotationWrtParent({ x: 1, y: 0.0, z: 0.0, w: 1 });
    }
    colider.setRestitution(0.3);
    // colider.setCollisionGroups(Math.floor(Math.random() * 100)); // TODO: disabled
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
    this.position.x = -0.09 * side;
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
    this.position.x = -0.09 * side;
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
    this.position.x = -0.09 * side;
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
