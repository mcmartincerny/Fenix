import { world } from "./Globals";
import { BetterObject3D } from "./objects/BetterObject3D";

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
