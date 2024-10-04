import RAPIER from "@dimforge/rapier3d-compat";
import { world } from "../Globals";
import { debugRigidBody, Vector3 } from "../helpers";
import { BetterObject3D } from "../objects/BetterObject3D";
import { Euler, MathUtils, PerspectiveCamera, Quaternion } from "three";

export class ThirdPersonCamera extends BetterObject3D {
  camera: PerspectiveCamera;
  target: BetterObject3D;
  canvas: HTMLCanvasElement;
  zOffset = 0.3;
  maxZBellowTarget = 0.8;
  behindOffset = 2;
  velocityMultiplier = 0.3;
  moveKp = 0.01;
  linearDamping = 30;
  mouseSensitivity = 0.004;
  minPitch = 20;
  maxPitch = 160;
  mouseMoveSinceLastFrameX = 0;
  mouseMoveSinceLastFrameY = 0;

  constructor(camera: PerspectiveCamera, target: BetterObject3D, canvas: HTMLCanvasElement) {
    super();
    this.target = target;
    this.camera = camera;
    this.canvas = canvas;
    this.rigidBody = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setTranslation(target.position.x, target.position.y, target.position.z + this.zOffset)
    );
    this.rigidBody.setGravityScale(0, true);
    this.rigidBody.setLinearDamping(this.linearDamping);
    this.rigidBody.setAdditionalMass(0.01, true);
  }

  setActive(active: boolean) {
    if (active) {
      (document.activeElement as HTMLElement)?.blur();
      document.addEventListener("pointerlockchange", this.pointerLockChangeListener);
      this.canvas.addEventListener("click", this.canvasClickListener);
    } else {
      document.exitPointerLock();
      document.removeEventListener("pointerlockchange", this.pointerLockChangeListener);
      this.canvas.removeEventListener("click", this.canvasClickListener);
    }
  }

  pointerLockChangeListener = () => {
    if (document.pointerLockElement === this.canvas) {
      this.canvas.addEventListener("mousemove", this.mouseMoveListener);
    } else {
      console.log(this.canvas);
      this.canvas.removeEventListener("mousemove", this.mouseMoveListener);
    }
  };

  canvasClickListener = () => {
    if (document.pointerLockElement !== this.canvas) {
      this.canvas.requestPointerLock();
    }
  };

  afterUpdate() {
    this.turnCameraBasedOnMouse();
    const idealCameraPosition = this.getTargetPosition()
      .add(this.getTargetVelocity().multiplyScalar(-this.velocityMultiplier))
      .setZ(this.getTargetPosition().z + this.zOffset);
    const offsetVector = new Vector3(0, 0, this.behindOffset);
    offsetVector.applyQuaternion(this.camera.quaternion);
    idealCameraPosition.add(offsetVector);
    if (idealCameraPosition.z < this.getTargetPosition().z - this.maxZBellowTarget) {
      idealCameraPosition.setZ(this.getTargetPosition().z - this.maxZBellowTarget);
    }
    const cameraPosition = new Vector3(this.rigidBody!.translation());
    const error = idealCameraPosition.sub(cameraPosition);
    const force = error.multiplyScalar(this.moveKp * error.length()); // multiply by error length to make it exponential
    this.rigidBody!.applyImpulse(force, true);
  }

  updatePhysics(): void {
    this.camera.position.copy(this.rigidBody!.translation());
  }

  turnCameraBasedOnMouse(): void {
    // Get mouse deltas (change since last frame)
    const deltaX = this.mouseMoveSinceLastFrameX * this.mouseSensitivity; // Horizontal movement
    const deltaY = this.mouseMoveSinceLastFrameY * this.mouseSensitivity; // Vertical movement
    const quaternion = this.camera.quaternion.clone();

    // Step 1: Apply Yaw rotation (around Z axis)
    const yawQuaternion = new Quaternion();
    yawQuaternion.setFromAxisAngle(new Vector3(0, 0, 1), -deltaX);
    quaternion.multiplyQuaternions(yawQuaternion, quaternion);

    // Step 2: Apply Pitch rotation (around X axis)
    const pitchQuaternion = new Quaternion();
    pitchQuaternion.setFromAxisAngle(new Vector3(1, 0, 0), -deltaY);

    // Combine pitch and yaw
    quaternion.multiplyQuaternions(quaternion, pitchQuaternion);

    // Step 3: Clamp pitch rotation to avoid full 360 back flip
    // Convert quaternion to Euler angles to get pitch
    const euler = new Euler().setFromQuaternion(quaternion, "ZYX"); // Order ZYX: Yaw (Z), Pitch (X), Roll (Y)

    // Clamp the pitch
    const minPitch = MathUtils.degToRad(this.minPitch);
    const maxPitch = MathUtils.degToRad(this.maxPitch);

    euler.x = MathUtils.clamp(euler.x, minPitch, maxPitch); // Clamp pitch

    // Convert the clamped Euler angles back to a quaternion
    this.camera.quaternion.setFromEuler(euler);

    this.mouseMoveSinceLastFrameX = 0;
    this.mouseMoveSinceLastFrameY = 0;
  }

  getTargetPosition(): Vector3 {
    if (this.target.rigidBody) {
      return new Vector3(this.target.rigidBody.translation());
    } else {
      return new Vector3(this.target.position);
    }
  }

  getTargetVelocity(): Vector3 {
    if (this.target.rigidBody) {
      return new Vector3(this.target.rigidBody.linvel());
    } else {
      return new Vector3(0, 0, 0);
    }
  }

  dispose(): void {
    super.dispose();
    this.camera = null!;
    this.target = null!;
    this.canvas.removeEventListener("mousemove", this.mouseMoveListener);
    document.removeEventListener("pointerlockchange", this.pointerLockChangeListener);
    this.canvas.removeEventListener("click", this.canvasClickListener);
  }

  mouseMoveListener = (event: MouseEvent) => {
    this.mouseMoveSinceLastFrameX += event.movementX || 0;
    this.mouseMoveSinceLastFrameY += event.movementY || 0;
  };
}
