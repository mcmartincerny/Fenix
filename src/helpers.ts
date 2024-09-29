import RAPIER, { QueryFilterFlags, Ray } from "@dimforge/rapier3d-compat";
import { world } from "./Globals";
import { BetterObject3D } from "./objects/BetterObject3D";
import { Quaternion, Vector3 as Vector3Class, Vector3Like } from "three";

export function isTouchingGround(obj: BetterObject3D) {
  const colider = obj.rigidBody?.collider(0);
  let touching = false;
  if (!colider) return false;
  world.contactPairsWith(colider, (colider2) => {
    if ((colider2.parent()?.userData as any)?.name === "ground") {
      touching = true;
    }
  });
  return touching;
}

export function isSomeChildTouchingGround(obj: BetterObject3D) {
  let touching = false;
  obj.traverse((object) => {
    if (touching === false && object instanceof BetterObject3D && isTouchingGround(object)) {
      touching = true;
    }
  });
  return touching;
}

export function clamp(num: number, min: number, max: number) {
  return Math.min(Math.max(num, min), max);
}

export function toRange(num: number, from: { min: number; max: number }, to: { min: number; max: number }) {
  const clampedNum = clamp(num, from.min, from.max);
  return ((clampedNum - from.min) * (to.max - to.min)) / (from.max - from.min) + to.min;
}

export function getYawFromQuaternion(q: RAPIER.Quaternion): number {
  const siny_cosp = 2 * (q.w * q.z + q.x * q.y);
  const cosy_cosp = 1 - 2 * (q.y * q.y + q.z * q.z);
  return Math.atan2(siny_cosp, cosy_cosp); // Return angle in radians
}

export function rotateVectorAroundZ(vector: Vector3, angle: number): Vector3 {
  const cosTheta = Math.cos(angle);
  const sinTheta = Math.sin(angle);

  return new Vector3(
    vector.x * cosTheta - vector.y * sinTheta, // Rotated X
    vector.x * sinTheta + vector.y * cosTheta, // Rotated Y
    vector.z // Z remains unchanged
  );
}

export function keepRigidBodyUpright(
  body: RAPIER.RigidBody,
  zRot?: RAPIER.Quaternion,
  Kp = 0.00003,
  Kd = 0.000005,
  Kp_Z = 0.000003,
  Kd_Z = 0.0000006,
  MAX_FORCE = 0.0001
) {
  const rot = body.rotation();
  // Get the current body rotation as quaternion
  const currentRotation = new Quaternion(rot.x, rot.y, rot.z, rot.w);

  // Get the upright rotation (no tilt on X or Y, only Z rotation is fine)
  const uprightRotation = new Quaternion(0, 0, currentRotation.z, currentRotation.w);

  // Compute the quaternion difference (relative rotation)
  const rotationDifference = uprightRotation.invert().multiply(currentRotation);

  // Extract the angular difference in X and Y axes (these are the ones we want to correct)
  const angleX = 2 * Math.atan2(rotationDifference.x, rotationDifference.w);
  const angleY = 2 * Math.atan2(rotationDifference.y, rotationDifference.w);

  // Get angular velocity (to use for D term)
  const angVel = body.angvel();

  // P term: Corrective torque based on angular error
  const correctiveTorqueX_P = -Kp * angleX;
  const correctiveTorqueY_P = -Kp * angleY;

  // D term: Damping torque based on angular velocity
  const correctiveTorqueX_D = -Kd * angVel.x;
  const correctiveTorqueY_D = -Kd * angVel.y;

  // Total corrective torque is P term + D term
  let correctiveTorqueX = correctiveTorqueX_P + correctiveTorqueX_D;
  let correctiveTorqueY = correctiveTorqueY_P + correctiveTorqueY_D;

  let correctiveTorqueZ = 0;

  if (zRot) {
    // Now handle Z rotation correction to align with the requested Z rotation
    const torsoYaw = getYawFromQuaternion(zRot);
    const bodyYaw = getYawFromQuaternion(rot);

    // Calculate the angular difference in Z
    const angleZ = bodyYaw - torsoYaw;

    // P term for Z-axis alignment (match rotation)
    const correctiveTorqueZ_P = -Kp_Z * angleZ;

    // D term for Z-axis damping (based on Z angular velocity)
    const correctiveTorqueZ_D = -Kd_Z * angVel.z;

    // Total corrective torque for Z is P term + D term
    correctiveTorqueZ = correctiveTorqueZ_P + correctiveTorqueZ_D;
  }
  // if (correctiveTorqueX > MAX_FORCE || correctiveTorqueY > MAX_FORCE || correctiveTorqueZ > MAX_FORCE) {
  //   console.log("MAX FORCE EXCEEDED");
  // }
  correctiveTorqueX = clamp(correctiveTorqueX, -MAX_FORCE, MAX_FORCE);
  correctiveTorqueY = clamp(correctiveTorqueY, -MAX_FORCE, MAX_FORCE);
  correctiveTorqueZ = clamp(correctiveTorqueZ, -MAX_FORCE, MAX_FORCE);

  // Apply the torque to correct the body's rotation around X and Y
  body.applyTorqueImpulse(new RAPIER.Vector3(correctiveTorqueX, correctiveTorqueY, correctiveTorqueZ), true);
}

export const throttle = <R, A extends any[]>(fn: (...args: A) => R, delay: number): ((...args: A) => R | undefined) => {
  let wait = false;

  return (...args: A) => {
    if (wait) return undefined;

    const val = fn(...args);

    wait = true;

    window.setTimeout(() => {
      wait = false;
    }, delay);

    return val;
  };
};

export const log = throttle((...values: any[]) => {
  console.log(...values);
}, 500);

export class Vector3 extends Vector3Class {
  constructor(xOrVector: Vector3Like);
  constructor(xOrVector?: number, y?: number, z?: number);
  constructor(xOrVector?: Vector3Like | number, y?: number, z?: number) {
    if (typeof xOrVector === "object") {
      super(xOrVector.x, xOrVector.y, xOrVector.z);
    } else {
      super(xOrVector, y, z);
    }
  }
}

/**
 * debug rigid body used only for visualizing some position
 * if there isn't one already created, it creates it and sets the position
 * if there is one already created, it sets the position
 */
export const debugRigidBody = (position: Vector3Like, name: string, zOffset = 0) => {
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

export const resetDebugRigidBodies = () => {
  debugRigidBodies.forEach((body) => {
    world.removeRigidBody(body);
  });
  debugRigidBodies.clear();
};

export const getIdealPositionOfUpperFoot = (
  downFootDistanceToTorso: number,
  torsoVelocity: number,
  lowerFootDistanceBeforeSwitchingFeet: number
): { higherFootIdealDistanceToTorso: number; higherFootIdealHeightDiff: number } => {
  torsoVelocity = clamp(torsoVelocity, 0, 1);
  const idealDistanceToTorsoOfUpperFoot = -downFootDistanceToTorso * torsoVelocity; //TODO  + torsoVelocity * 0.1;
  const ZOffsetFromTheDownFoot =
    toRange(downFootDistanceToTorso, { min: -lowerFootDistanceBeforeSwitchingFeet, max: lowerFootDistanceBeforeSwitchingFeet }, { min: 0.2, max: -0.05 }) *
    torsoVelocity;
  return { higherFootIdealDistanceToTorso: idealDistanceToTorsoOfUpperFoot, higherFootIdealHeightDiff: ZOffsetFromTheDownFoot };
};

export const castRayBelow = (position: Vector3Like, maxDistance = 0.3): number | false => {
  const direction = new RAPIER.Vector3(0, 0, -1);
  const ray = world.castRay(new Ray(position, direction), maxDistance, true, QueryFilterFlags.ONLY_FIXED);
  if (ray) {
    return ray.timeOfImpact;
  }
  return false;
};

/*
  Checks if the position is behind the object in movement
*/
export const isBehindObjectInMovementXY = (rigidBody: RAPIER.RigidBody, position: Vector3Like): boolean => {
  const rigidBodyPos = new Vector3(rigidBody.translation()).setZ(0);
  const rigidBodyVel = new Vector3(rigidBody.linvel()).setZ(0);
  const rigidBodyPosPlusVel = rigidBodyPos.clone().add(rigidBodyVel);
  const pos = new Vector3(position).setZ(0);
  const distanceToRigidBody = pos.distanceTo(rigidBodyPos);
  const distanceToPosPlusVel = pos.distanceTo(rigidBodyPosPlusVel);
  return distanceToPosPlusVel > distanceToRigidBody;
};
