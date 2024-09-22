import RAPIER from "@dimforge/rapier3d-compat";
import { Object3D } from "three";

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

  step(delta: number) {
    this.update();
    this.updatePhysics();
  }

  beforeUpdate() {}

  update() {}

  updatePhysics() {
    if (this.rigidBody?.isDynamic) {
      this.position.copy(this.rigidBody.translation());
      this.quaternion.copy(this.rigidBody.rotation());
    }
  }

  addMultiple(...objects: Object3D[]) {
    objects.forEach((object) => this.add(object));
  }

  // getCorrectPositionToWorld() {
  //   let parent = this.parent;
  //   const position = this.position.clone();
  //   while (parent) {
  //     console.log(parent.position);
  //     position.add(parent.position);
  //     parent = parent.parent;
  //   }
  //   return position;
  // }
}

// function findWorldInParent(object: BetterObject3D): RAPIER.World {
//   let parent = object.parent;
//   while (parent) {
//     if (parent instanceof BetterObject3D) {
//       return parent.world;
//     }
//     if (parent instanceof Scene) {
//       return parent.userData.world;
//     }
//     parent = parent.parent;
//   }
//   throw new Error("BetterObject3D must be a child of a BetterObject3D or a Scene with a world property");
// }
