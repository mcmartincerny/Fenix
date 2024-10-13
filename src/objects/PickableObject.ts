import { Vector3Like } from "three";
import { BetterObject3D } from "./BetterObject3D";
import { ItemName, ItemType } from "../inventory/Inventory";

interface PickableObjectProps {
  inventoryItemName: ItemName;
  inventoryItemType: ItemType;
  stackSize: number;
}

export class PickableObject extends BetterObject3D {
  static pickableObjects: Set<PickableObject> = new Set();

  inventoryItemName: ItemName;
  stackSize = 1;
  constructor(props: PickableObjectProps) {
    super();
    this.inventoryItemName = props.inventoryItemName;
    this.stackSize = props.stackSize;
    PickableObject.pickableObjects.add(this);
  }

  dispose(removeFromParent = true): void {
    super.dispose(removeFromParent);
    PickableObject.pickableObjects.delete(this);
  }

  static getNearestPickable(position: Vector3Like, maxDistance = 1.5) {
    let nearest = null;
    let nearestDistance = Infinity;
    for (const object of PickableObject.pickableObjects) {
      const distance = object.position.distanceTo(position);
      if (distance < maxDistance && distance < nearestDistance) {
        nearest = object;
        nearestDistance = distance;
      }
    }
    return nearest;
  }
}
