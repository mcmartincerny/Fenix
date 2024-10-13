import { BoxGeometry, CylinderGeometry, Mesh, MeshStandardMaterial, Vector3Like } from "three";
import { PipeGeometry } from "../Shapes";
import { CaliberType, createRotateAnimation, createStandardRecoilAnimation, Weapon, weaponMaterials, WeaponProps } from "./Weapon";
import * as BufferGeometryUtils from "three/addons/utils/BufferGeometryUtils.js";
import { degToRad } from "three/src/math/MathUtils.js";
import { gui, world } from "../../Globals";
import RAPIER from "@dimforge/rapier3d-compat";
import { ItemName } from "../../inventory/Inventory";

export class Pistol extends Weapon {
  constructor(position: Vector3Like) {
    super({
      name: ItemName.Pistol9mm,
      position: position,
      caliber: CaliberType["9mm"],
      barrelLength: 0.3,
      magazineCapacity: 15,
      fireRate: 10,
      reloadTime: 1.5,
      accuracy: 0.1,
    });
  }

  createWeaponMeshes() {
    const size = 0.05; // scale of the pistol
    // create the geometries for the pistol
    const handle = new BoxGeometry(1, 0.6, 2.5);
    const barrelEnclosureTop = new BoxGeometry(3.7, 0.8, 0.6);
    const barrelEnclosureBottom = new BoxGeometry(3.7, 0.8, 0.25);
    const barrel = new CylinderGeometry(0.2, 0.2, 1, 10);
    const trigger = new BoxGeometry(0.7, 0.2, 0.1);
    handle.rotateY(degToRad(15));
    barrel.rotateZ(Math.PI / 2);
    trigger.rotateY(degToRad(70));
    handle.translate(-1, 0, -0.3);
    barrelEnclosureTop.translate(0, 0, 1.225);
    barrelEnclosureBottom.translate(0, 0, 0.8);
    barrel.translate(1.55, 0, 1.2);
    trigger.translate(0.2, 0, 0.45);
    const handleAndBottomBarrel = BufferGeometryUtils.mergeGeometries([handle, barrelEnclosureBottom]);
    [handleAndBottomBarrel, barrelEnclosureTop, barrel, trigger].forEach((geometry) => {
      geometry.scale(size, size, size);
    });
    const handleAndBottomBarrelMesh = new Mesh(handleAndBottomBarrel, weaponMaterials.MetaloRubber);
    const barrelEnclosureTopMesh = new Mesh(barrelEnclosureTop, weaponMaterials.gunMetal);
    const barrelMesh = new Mesh(barrel, weaponMaterials.silverMetal);
    const triggerMesh = new Mesh(trigger, weaponMaterials.silverMetal);
    return [handleAndBottomBarrelMesh, barrelEnclosureTopMesh, barrelMesh, triggerMesh];
  }

  createAnimations(): { animate: (shotAtMs: number) => void; reset: () => void }[] {
    const recoilToOffsetPortion = 0.2;
    const recoilToOffsetTime = (1000 / this.weaponProperties.fireRate) * recoilToOffsetPortion;
    const recoilBackTime = (1000 / this.weaponProperties.fireRate) * (1 - recoilToOffsetPortion);
    return [
      createStandardRecoilAnimation(this.meshes[1], { x: -0.03, y: 0, z: 0 }, recoilToOffsetTime, recoilBackTime),
      createStandardRecoilAnimation(this.meshes[3], { x: -0.04, y: 0, z: 0.01 }, recoilToOffsetTime, recoilBackTime),
      createRotateAnimation(this.meshes[3], { x: 0, y: 1, z: 0 }, recoilToOffsetTime, recoilBackTime),
    ];
  }
}
