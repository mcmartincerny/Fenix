import { BoxGeometry, CylinderGeometry, Mesh, MeshStandardMaterial } from "three";
import { PipeGeometry } from "../Shapes";
import { Weapon, WeaponProps } from "./Weapon";
import * as BufferGeometryUtils from "three/addons/utils/BufferGeometryUtils.js";
import { degToRad } from "three/src/math/MathUtils.js";
import { gui } from "../../Globals";

interface PistolProps extends WeaponProps {}

export class Pistol extends Weapon {
  meshes: ReturnType<Pistol["createPistolMeshes"]>;
  shootDelayMs = 100;
  shotInProgress = false;
  shotAtMs = 0;
  initialTopBarrelX: number;
  constructor(props: PistolProps) {
    super(props);
    this.meshes = this.createPistolMeshes();
    this.initialTopBarrelX = this.meshes.barrelEnclosureTopMesh.position.x;
    gui.add(this, "shoot");
  }

  createPistolMeshes() {
    // create materials for the pistol
    const gunMetal = new MeshStandardMaterial({ color: 0x505050, metalness: 0.8, roughness: 0.4 });
    const handleMaterial = new MeshStandardMaterial({ color: 0x202020, metalness: 0.7, roughness: 0.6 });
    const silverMetal = new MeshStandardMaterial({ color: 0xffffff, metalness: 0.8, roughness: 0.3 });
    // create the geometries for the pistol
    const handle = new BoxGeometry(1, 0.7, 2.5);
    handle.rotateY(degToRad(15));
    handle.translate(0, 0, 0.1);
    const barrelEnclosureTop = new BoxGeometry(3.7, 0.8, 0.6);
    barrelEnclosureTop.translate(1, 0, 1.625);
    const barrelEnclosureBottom = new BoxGeometry(3.7, 0.8, 0.25);
    barrelEnclosureBottom.translate(1, 0, 1.2);
    // const barrel = new PipeGeometry({ radius: 0.4, length: 2, segments: 10, closed: true });
    const barrel = new CylinderGeometry(0.2, 0.2, 1, 10);
    barrel.rotateZ(Math.PI / 2);
    barrel.translate(2.55, 0, 1.6);
    const trigger = new BoxGeometry(0.7, 0.2, 0.1);
    trigger.rotateY(degToRad(60));
    trigger.translate(1.2, 0, 0.85);
    const handleAndBottomBarrel = BufferGeometryUtils.mergeGeometries([handle, barrelEnclosureBottom]);
    const handleAndBottomBarrelMesh = new Mesh(handleAndBottomBarrel, handleMaterial);
    const barrelEnclosureTopMesh = new Mesh(barrelEnclosureTop, gunMetal);
    const barrelMesh = new Mesh(barrel, silverMetal);
    const triggerMesh = new Mesh(trigger, silverMetal);
    this.add(handleAndBottomBarrelMesh);
    this.add(barrelEnclosureTopMesh);
    this.add(barrelMesh);
    this.add(triggerMesh);
    return { handleAndBottomBarrelMesh, barrelEnclosureTopMesh, barrelMesh };
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

  shootAnimationCockBack = 0.6;
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
