import RAPIER from "@dimforge/rapier3d-compat";

export let world: RAPIER.World;

export const setWorld = (newWorld: RAPIER.World) => {
  world = newWorld;
};
