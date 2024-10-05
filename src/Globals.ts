import RAPIER from "@dimforge/rapier3d-compat";
import GUI from "lil-gui";

export let world: RAPIER.World;

export const setWorld = (newWorld: RAPIER.World) => {
  world = newWorld;
};

export const feetHandleIds = new Set<number>();

export const calfHandleIds = new Set<number>();

export let gui: GUI;

export const setGui = (newGui: GUI) => {
  gui = newGui;
};
