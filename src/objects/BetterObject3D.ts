import RAPIER from "@dimforge/rapier3d-compat";
import { Object3D } from "three";
import { world } from "../Globals";

export class BetterObject3D extends Object3D {
  rigidBody?: RAPIER.RigidBody;
  initialized = false;
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

  afterStep() {
    this.afterUpdate();
    this.updatePhysics();
  }

  beforeUpdate() {}

  afterUpdate() {}

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

  dispose() {
    if (this.rigidBody) {
      world.removeRigidBody(this.rigidBody);
    }
    this.children.forEach((child) => {
      if (child instanceof BetterObject3D) {
        child.dispose();
      }
    });
  }
}
