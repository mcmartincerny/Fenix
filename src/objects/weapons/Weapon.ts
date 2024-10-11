import { Vector3Like } from "three";
import { BetterObject3D } from "../BetterObject3D";
import RAPIER from "@dimforge/rapier3d-compat";
import { world } from "../../Globals";

export interface WeaponProps {
  position: Vector3Like;
}

export class Weapon extends BetterObject3D {
  constructor(props: WeaponProps) {
    super();
    const { position } = props;
    this.rigidBody = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(position.x, position.y, position.z));
  }
}
