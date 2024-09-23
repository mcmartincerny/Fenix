import { PhysicsHooks as IPhysicsHooks, SolverFlags } from "@dimforge/rapier3d-compat";
import { calfHandleIds, feetHandleIds } from "./Globals";

export const PhysicsHooks: IPhysicsHooks = {
  filterIntersectionPair: (collider1, collider2, body1, body2) => {
    return true;
  },
  filterContactPair: (collider1, collider2, body1, body2) => {
    // calf calf contact
    if (calfHandleIds.has(body1) && calfHandleIds.has(body2)) {
      return SolverFlags.EMPTY;
    }
    // foot foot contact
    if (feetHandleIds.has(body1) && feetHandleIds.has(body2)) {
      // console.log("foot foot contact ");
      return SolverFlags.EMPTY;
    }
    // foot calf contact
    if ((feetHandleIds.has(body1) || feetHandleIds.has(body2)) && (calfHandleIds.has(body1) || calfHandleIds.has(body2))) {
      // console.log("foot calf contact ");
      return SolverFlags.EMPTY;
    }
    return SolverFlags.COMPUTE_IMPULSE;
  },
};
