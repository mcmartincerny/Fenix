import { BoxGeometry, CylinderGeometry, Mesh, MeshStandardMaterial } from "three";
import { PipeGeometry } from "../Shapes";
import { Weapon, WeaponProps } from "./Weapon";
import * as BufferGeometryUtils from "three/addons/utils/BufferGeometryUtils.js";
import { degToRad } from "three/src/math/MathUtils.js";
import { gui, world } from "../../Globals";
import RAPIER from "@dimforge/rapier3d-compat";

interface PistolProps extends WeaponProps {}

export class Pistol extends Weapon {
  size = 0.05;
  meshes: ReturnType<Pistol["createPistolMeshes"]>;
  shootDelayMs = 100;
  shotInProgress = false;
  shotAtMs = 0;
  initialTopBarrelX: number;
  constructor(props: PistolProps) {
    super(props);
    this.meshes = this.createPistolMeshes();
    this.initialTopBarrelX = this.meshes.barrelEnclosureTopMesh.position.x;
    this.meshes.handleAndBottomBarrelMesh.geometry.computeBoundingBox();
    this.meshes.barrelEnclosureTopMesh.geometry.computeBoundingBox();
    const box = this.meshes.handleAndBottomBarrelMesh.geometry.boundingBox!.union(this.meshes.barrelEnclosureTopMesh.geometry.boundingBox!);
    const collider = world.createCollider(
      RAPIER.ColliderDesc.cuboid((box.max.x - box.min.x) / 2, (box.max.y - box.min.y) / 2, (box.max.z - box.min.z) / 2),
      this.rigidBody
    );
    collider.setRestitution(0.4);
    gui.add(this, "shoot");
  }

  createPistolMeshes() {
    // create materials for the pistol
    const gunMetal = new MeshStandardMaterial({ color: 0x505050, metalness: 0.8, roughness: 0.4 });
    const handleMaterial = new MeshStandardMaterial({ color: 0x202020, metalness: 0.7, roughness: 0.6 });
    const silverMetal = new MeshStandardMaterial({ color: 0xffffff, metalness: 0.8, roughness: 0.3 });
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
      geometry.scale(this.size, this.size, this.size);
    });
    const handleAndBottomBarrelMesh = new Mesh(handleAndBottomBarrel, handleMaterial);
    const barrelEnclosureTopMesh = new Mesh(barrelEnclosureTop, gunMetal);
    const barrelMesh = new Mesh(barrel, silverMetal);
    const triggerMesh = new Mesh(trigger, silverMetal);
    [handleAndBottomBarrelMesh, barrelEnclosureTopMesh, barrelMesh, triggerMesh].forEach((mesh) => {
      this.add(mesh);
    });
    return { handleAndBottomBarrelMesh, barrelEnclosureTopMesh, barrelMesh, triggerMesh };
  }

  shoot() {
    if (this.shotInProgress) return;
    this.shotInProgress = true;
    this.shotAtMs = performance.now();
  }

  afterUpdate(): void {
    super.afterUpdate();
    if (this.shotInProgress) {
      this.shootAnimation();
    }
  }

  shootAnimationCockBack = 0.6 * this.size;
  cockingPart = 0.2;
  shootAnimation() {
    const now = performance.now();
    const timeSinceShot = now - this.shotAtMs;

    // Reset if the shooting delay has passed
    if (timeSinceShot > this.shootDelayMs) {
      this.shotInProgress = false;
      this.meshes.barrelEnclosureTopMesh.position.x = this.initialTopBarrelX;
      return;
    }

    const barrelTop = this.meshes.barrelEnclosureTopMesh;
    const cockingBack = timeSinceShot < this.shootDelayMs * this.cockingPart;

    // Cock back
    if (cockingBack) {
      barrelTop.position.x = this.initialTopBarrelX - this.shootAnimationCockBack * (timeSinceShot / (this.shootDelayMs * this.cockingPart));
    }
    // Cock forward, ensuring it doesn't overshoot
    else {
      const progressForward = (timeSinceShot - this.shootDelayMs * this.cockingPart) / (this.shootDelayMs * (1 - this.cockingPart));
      barrelTop.position.x = this.initialTopBarrelX - this.shootAnimationCockBack + this.shootAnimationCockBack * Math.min(progressForward, 1);
    }
  }
}
