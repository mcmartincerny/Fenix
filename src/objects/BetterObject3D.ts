import RAPIER from "@dimforge/rapier3d-compat";
import { Mesh, Object3D, Vector3Like } from "three";
import { world } from "../Globals";
import { Vector3 } from "../helpers";

const pickableObjects: Set<BetterObject3D> = new Set();

export class BetterObject3D extends Object3D {
  rigidBody?: RAPIER.RigidBody;
  mainMesh?: Mesh;
  initialized = false;
  pickable = false;
  constructor() {
    super();
    setTimeout(() => {
      if (!this.initialized) {
        throw new Error("BetterObject3D " + this.constructor.name + " must be initialized");
      }
    }, 0);
  }

  init() {
    this.initialized = true;
    if (this.pickable) {
      pickableObjects.add(this);
    }
    this.children.forEach((child) => {
      if (child instanceof BetterObject3D) {
        child.init();
      }
    });
    setTimeout(() => {
      if (this.rigidBody == null) {
        console.warn("Maybe change later? Removing position.");
        this.position.set(0, 0, 0);
      }
    }, 0);
  }

  beforeStep() {
    this.beforeUpdate();
  }

  updateCounter = 0;
  afterStep() {
    this.afterUpdate();
    this.updateCounter++;
    if (this.updateCounter % 30 === 0) {
      this.after30Updates();
    }
    this.updatePhysics();
  }

  beforeUpdate() {}

  afterUpdate() {}

  after30Updates() {}

  firstUpdateDone = false;
  updatePhysics() {
    if (this.rigidBody?.isDynamic && (!this.rigidBody.isFixed() || !this.firstUpdateDone)) {
      this.firstUpdateDone = true;
      this.position.copy(this.rigidBody.translation());
      this.quaternion.copy(this.rigidBody.rotation());
    }
  }

  addMultiple(...objects: Object3D[]) {
    objects.forEach((object) => this.add(object));
  }

  dispose(removeFromParent = true) {
    if (this.rigidBody) {
      world.removeRigidBody(this.rigidBody);
    }
    if (this.mainMesh) {
      this.mainMesh.geometry.dispose();
      if (Array.isArray(this.mainMesh.material)) {
        this.mainMesh.material.forEach((material) => material.dispose());
      } else {
        this.mainMesh.material.dispose();
      }
      this.mainMesh.clear();
      this.mainMesh.removeFromParent();
    }
    this.children.forEach((child) => {
      if (child instanceof BetterObject3D) {
        child.dispose();
      }
    });
    if (removeFromParent) {
      this.removeFromParent();
    }
    if (this.pickable) {
      pickableObjects.delete(this);
    }
  }
}

export const getNearestPickable = (position: Vector3Like, maxDistance = 1.5): BetterObject3D | null => {
  const pos = new Vector3(position);
  let nearest: BetterObject3D | null = null;
  let nearestDistance = Infinity;
  pickableObjects.forEach((object) => {
    if (object !== this) {
      const distance = pos.distanceTo(object.position);
      if (distance < maxDistance && distance < nearestDistance) {
        nearest = object;
        nearestDistance = distance;
      }
    }
  });
  return nearest;
};
