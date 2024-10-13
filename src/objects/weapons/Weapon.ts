import { Box3, BufferGeometry, Mesh, MeshStandardMaterial, NormalBufferAttributes, Vector3Like } from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { gui, world } from "../../Globals";
import { PickableObject } from "../PickableObject";
import { Vector3 } from "../../helpers";
import { ItemName, ItemType } from "../../inventory/Inventory";

export interface WeaponProps {
  name: ItemName;
  position: Vector3Like;
  barrelLength: number;
  caliber: CaliberType;
  magazineCapacity: number;
  fireRate: number;
  reloadTime: number;
  accuracy: number;
}

export class Weapon extends PickableObject {
  rigidBody: RAPIER.RigidBody;
  weaponProperties: WeaponProps;
  meshes: ReturnType<Weapon["createWeaponMeshes"]>;
  shotInProgress = false;
  shotAtMs = 0;
  shootingAnimations: ReturnType<Weapon["createAnimations"]> = [];
  constructor(props: WeaponProps) {
    super({ inventoryItemName: props.name, inventoryItemType: ItemType.Weapon, stackSize: 1 });
    this.weaponProperties = props;
    const { position } = props;
    this.rigidBody = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(position.x, position.y, position.z));
    this.meshes = this.createWeaponMeshes();
    const box = new Box3();
    this.meshes.forEach((mesh) => {
      this.add(mesh);
      box.expandByObject(mesh);
    });
    const collider = world.createCollider(
      RAPIER.ColliderDesc.cuboid((box.max.x - box.min.x) / 2, (box.max.y - box.min.y) / 2, (box.max.z - box.min.z) / 2),
      this.rigidBody
    );
    collider.setRestitution(0.4);
    gui.add(this, "shoot");
    this.shootingAnimations = this.createAnimations();
  }

  createWeaponMeshes(): Mesh[] {
    throw new Error("Implement createWeaponMeshes in weapon subclass");
  }

  createAnimations(): { animate: (shotAtMs: number) => void; reset: () => void }[] {
    throw new Error("Implement createAnimations in weapon subclass");
  }

  shoot() {
    if (this.shotInProgress) return;
    this.shotInProgress = true;
    this.shotAtMs = performance.now();
  }

  afterUpdate(): void {
    super.afterUpdate();
    if (this.shotInProgress) {
      this.shootingAnimations.forEach((animation) => {
        animation.animate(this.shotAtMs);
      });
      if (performance.now() - this.shotAtMs > 1000 / this.weaponProperties.fireRate) {
        this.shotInProgress = false;
        this.shootingAnimations.forEach((animation) => {
          animation.reset();
        });
      }
    }
  }
}

export enum CaliberType {
  ".25 ACPL" = ".25 ACPL", // tiny pistol
  "9mm" = "9mm", // pistols and SMGs
  ".50 AE" = ".50 AE", // desert eagle
  ".44 Magnum" = ".44 Magnum", // revolver
  ".500 S&W" = ".500 S&W", // powerful revolver
  "5.56 AR" = "5.56 AR", // assault rifles
  "7.62 AR" = "7.62 AR", // assault rifles - AK47
  ".300 Magnum" = ".300 Magnum", // sniper rifles
  ".50 BMG" = ".50 BMG", // anti-material rifles
  "20 Gauge" = "20 Gauge", // smaller shotguns
  "12 Gauge" = "12 Gauge", // standard shotgun
}

export const weaponMaterials = {
  MetaloRubber: new MeshStandardMaterial({ color: 0x202020, metalness: 0.7, roughness: 0.6 }),
  gunMetal: new MeshStandardMaterial({ color: 0x505050, metalness: 0.8, roughness: 0.4 }),
  silverMetal: new MeshStandardMaterial({ color: 0xffffff, metalness: 0.8, roughness: 0.3 }),
};

export const createStandardRecoilAnimation = (mesh: Mesh, recoilOffset: Vector3Like, recoilToOffsetTime: number, recoilBackTime: number) => {
  const initialPosition = mesh.position.clone();
  const recoilFinalPosition = initialPosition.clone().add(recoilOffset);
  return {
    animate: (shotAtMs: number) => {
      const now = performance.now();
      const timeSinceShot = now - shotAtMs;
      const recoilTime = recoilToOffsetTime + recoilBackTime;
      const recoilTimeProgress = Math.min(timeSinceShot / recoilTime, 1);
      if (recoilTimeProgress < 1) {
        mesh.position.lerpVectors(initialPosition, recoilFinalPosition, recoilTimeProgress);
      } else {
        mesh.position.lerpVectors(recoilFinalPosition, initialPosition, (timeSinceShot - recoilTime) / recoilBackTime);
      }
    },
    reset: () => {
      mesh.position.copy(initialPosition);
    },
  };
};

export const createRotateAnimation = (mesh: Mesh, rotateOffset: Vector3Like, recoilToOffsetTime: number, recoilBackTime: number) => {
  const initialRotation = mesh.rotation.clone();
  const rotationVector = new Vector3(initialRotation.x, initialRotation.y, initialRotation.z);
  const finalRotation = rotationVector.clone().add(rotateOffset);
  return {
    animate: (shotAtMs: number) => {
      const now = performance.now();
      const timeSinceShot = now - shotAtMs;
      const recoilTime = recoilToOffsetTime + recoilBackTime;
      const recoilTimeProgress = Math.min(timeSinceShot / recoilTime, 1);
      if (recoilTimeProgress < 1) {
        rotationVector.lerpVectors(initialRotation, finalRotation, recoilTimeProgress);
        mesh.rotation.setFromVector3(rotationVector);
      } else {
        rotationVector.lerpVectors(finalRotation, initialRotation, (timeSinceShot - recoilTime) / recoilBackTime);
        mesh.rotation.setFromVector3(rotationVector);
      }
    },
    reset: () => {
      rotationVector.copy(initialRotation);
      mesh.rotation.setFromVector3(rotationVector);
    },
  };
};
