import { Vector3Like } from "three";
import { Vector3 } from "../helpers";
import { BetterObject3D } from "../objects/BetterObject3D";
import { scene, world } from "../Globals";
import { Pistol } from "../objects/weapons/Pistol";
import { PickableObject } from "../objects/PickableObject";

export enum ItemName {
  Pistol9mm = "Pistol 9mm",
}

export enum ItemType {
  Weapon = "Weapon",
  Ammo = "Ammo",
}

const toolBarCompatibleItemTypes = [ItemType.Weapon];

const inventoryNameToObjConstructor: Record<ItemName, (position: Vector3Like) => BetterObject3D> = {
  [ItemName.Pistol9mm]: (position) => new Pistol(position),
};

export class InventoryItem {
  constructor(public name: ItemName, public type: ItemType, public description: string, public quantity = 1, public maxQuantity = 1) {}
  split(quantity: number) {
    if (quantity > this.quantity) {
      throw new Error("Cannot split more than quantity");
    }
    this.quantity -= quantity;
    return new InventoryItem(this.name, this.type, this.description, quantity);
  }

  toCompareString() {
    return `${this.name} ${this.type} ${this.quantity}`;
  }
}

export class Inventory {
  items: (InventoryItem | null)[] = [];
  previousItemsForCompare: (string | null)[] = [];
  inventoryChangedListeners: ((inventory: Inventory, changedIndexes: number[]) => void)[] = [];

  constructor(
    public size: number,
    public getItemDropPosition: () => Vector3Like,
    public getItemDropVelocity: () => Vector3Like,
    initialItems?: InventoryItem[]
  ) {
    if (initialItems) {
      this.items = initialItems;
    } else {
      this.items = new Array(size).fill(null);
    }
    this.possibleInventoryChange();
  }

  possibleInventoryChange() {
    // compare previousItems and items
    const changedIndexes: number[] = [];
    const longestLength = Math.max(this.items.length, this.previousItemsForCompare.length);
    const currentItemsForCompare = this.items.map((item) => (item == null ? null : item.toCompareString()));

    for (let i = 0; i < longestLength; i++) {
      if (currentItemsForCompare[i] !== this.previousItemsForCompare[i]) {
        changedIndexes.push(i);
      }
    }
    if (changedIndexes.length > 0) {
      this.inventoryChangedListeners.forEach((listener) => listener(this, changedIndexes));
      this.previousItemsForCompare = currentItemsForCompare;
    }
  }

  changeSize(size: number) {
    if (size < this.items.length) {
      for (let i = size; i < this.items.length; i++) {
        if (this.items[i] != null) {
          this.dropItem(this.items[i]!);
        }
      }
    }
    this.size = size;
    this.items = this.items.slice(0, size);
    if (this.items.length < size) {
      this.items = this.items.concat(new Array(size - this.items.length).fill(null));
    }
    this.possibleInventoryChange();
  }

  private dropItem(InventoryItem: InventoryItem) {
    // throw new Error("Implement throwing items outside");
    for (let i = 0; i < InventoryItem.quantity; i++) {
      const object = inventoryNameToObjConstructor[InventoryItem.name](this.getItemDropPosition());
      scene.add(object);
      object.init();
      object.rigidBody?.setLinvel(this.getItemDropVelocity(), true);
    }
  }

  dropItemOutOfInventory(index: number) {
    if (this.items[index] != null) {
      this.dropItem(this.items[index]!);
      this.items[index] = null;
      this.possibleInventoryChange();
    }
  }

  dropSingleItemOutOfInventory(index: number) {
    if (this.items[index] != null) {
      const item = this.items[index]!.split(1);
      this.dropItem(item);
      if (this.items[index]!.quantity === 0) {
        this.items[index] = null;
      }
      this.possibleInventoryChange();
    }
  }

  addItem(item: InventoryItem) {
    for (let i = 0; i < this.items.length; i++) {
      if (this.items[i]?.name === item.name) {
        const quantityToMove = Math.min(item.quantity, item.maxQuantity - this.items[i]!.quantity);
        this.items[i]!.quantity += quantityToMove;
        item.quantity -= quantityToMove;
        if (item.quantity === 0) {
          this.possibleInventoryChange();
          return true;
        }
      }
    }
    return this.addItemWithoutStacking(item);
  }

  addItemWithoutStacking(item: InventoryItem) {
    for (let i = 0; i < this.items.length; i++) {
      if (this.items[i] == null) {
        this.items[i] = item;
        this.possibleInventoryChange();
        return true;
      }
    }
    return false;
  }

  static moveItem(fromInventory: Inventory, fromIndex: number, toInventory: Inventory, toIndex: number, quantity?: number) {
    if (fromInventory.items[fromIndex] == null) {
      return false;
    }
    const itemToReplace = toInventory.items[toIndex];
    if (itemToReplace != null && itemToReplace.name === fromInventory.items[fromIndex]!.name) {
      if (quantity == null) {
        const availableSpace = itemToReplace.maxQuantity - itemToReplace.quantity;
        const quantityToMove = Math.min(availableSpace, fromInventory.items[fromIndex]!.quantity);
        itemToReplace.quantity += quantityToMove;
        fromInventory.items[fromIndex]!.quantity -= quantityToMove;
        if (fromInventory.items[fromIndex]!.quantity === 0) {
          fromInventory.items[fromIndex] = null;
        }
      } else {
        if (itemToReplace.maxQuantity - itemToReplace.quantity >= quantity) {
          itemToReplace.quantity += quantity;
          fromInventory.items[fromIndex]!.quantity -= quantity;
          if (fromInventory.items[fromIndex]!.quantity === 0) {
            fromInventory.items[fromIndex] = null;
          }
        }
      }
    } else if (itemToReplace != null && quantity != null) {
      throw new Error("Cannot move item with quantity to a slot with different item");
    } else if (itemToReplace == null && quantity != null) {
      const quantityToMove = Math.min(quantity, fromInventory.items[fromIndex]!.quantity);
      toInventory.items[toIndex] = fromInventory.items[fromIndex]!.split(quantityToMove);
      if (fromInventory.items[fromIndex]!.quantity === 0) {
        fromInventory.items[fromIndex] = null;
      }
    } else {
      toInventory.items[toIndex] = fromInventory.items[fromIndex];
      fromInventory.items[fromIndex] = itemToReplace;
    }
    fromInventory.possibleInventoryChange();
    toInventory.possibleInventoryChange();
  }

  addInventoryChangedListener(listener: (inventory: Inventory, changedIndexes: number[]) => void) {
    this.inventoryChangedListeners.push(listener);
  }

  removeInventoryChangedListener(listener: (inventory: Inventory, changedIndexes: number[]) => void) {
    const index = this.inventoryChangedListeners.indexOf(listener);
    if (index !== -1) {
      this.inventoryChangedListeners.splice(index, 1);
    }
  }
}

export class PersonInventory {
  toolBarInventory: Inventory;
  backpackInventory: Inventory;
  previouslySelectedToolBarItemIndex = 0;
  selectedToolBarItemIndex = 0;
  selectedToolBarItem: InventoryItem | null = null;
  selectedItemChangedListeners: Set<(selectedIndex: number) => void> = new Set();
  constructor(
    public toolBarSize: number,
    public backpackSize: number,
    public getItemDropPosition: () => Vector3Like,
    public getItemDropVelocity: () => Vector3Like
  ) {
    this.toolBarInventory = new Inventory(toolBarSize, getItemDropPosition, getItemDropVelocity);
    this.backpackInventory = new Inventory(backpackSize, getItemDropPosition, getItemDropVelocity);
    this.toolBarInventory.addInventoryChangedListener(() => this.possibleSelectedToolBarItemChange());
  }

  dropSingleSelectedToolBarItem() {
    if (this.selectedToolBarItem != null) {
      this.toolBarInventory.dropSingleItemOutOfInventory(this.selectedToolBarItemIndex);
      this.possibleSelectedToolBarItemChange();
    }
  }

  changeToolBarSize(size: number) {
    this.toolBarInventory.changeSize(size);
    this.possibleSelectedToolBarItemChange();
  }

  changeBackpackSize(size: number) {
    this.backpackInventory.changeSize(size);
  }

  selectNextToolBarItem() {
    this.selectedToolBarItemIndex = (this.selectedToolBarItemIndex + 1) % this.toolBarInventory.size;
    this.possibleSelectedToolBarItemChange();
  }

  selectPreviousToolBarItem() {
    this.selectedToolBarItemIndex = (this.selectedToolBarItemIndex - 1 + this.toolBarInventory.size) % this.toolBarInventory.size;
    this.possibleSelectedToolBarItemChange();
  }

  selectToolBarItem(index: number) {
    if (index < 0 || index >= this.toolBarInventory.size) {
      return;
    }
    this.selectedToolBarItemIndex = index;
    this.possibleSelectedToolBarItemChange();
  }

  possibleSelectedToolBarItemChange() {
    const previousItem = this.selectedToolBarItem;
    this.selectedToolBarItem = this.toolBarInventory.items[this.selectedToolBarItemIndex];
    if (previousItem !== this.selectedToolBarItem || this.previouslySelectedToolBarItemIndex !== this.selectedToolBarItemIndex) {
      this.previouslySelectedToolBarItemIndex = this.selectedToolBarItemIndex;
      this.selectedItemChangedListeners.forEach((listener) => listener(this.selectedToolBarItemIndex));
    }
  }

  addSelectedItemChangedListener = (listener: (selectedIndex: number) => void) => {
    this.selectedItemChangedListeners.add(listener);
  };

  removeSelectedItemChangedListener = (listener: (selectedIndex: number) => void) => {
    this.selectedItemChangedListeners.delete(listener);
  };

  addItem(item: InventoryItem) {
    // if there is some non full stack of the same item
    if (toolBarCompatibleItemTypes.includes(item.type)) {
      const added = this.toolBarInventory.addItem(item);
      if (added) {
        return true;
      } else {
        return this.backpackInventory.addItem(item);
      }
    }
    return this.backpackInventory.addItem(item);
  }

  pickupObjectIntoInventory(obj: PickableObject) {
    const item = new InventoryItem(obj.inventoryItemName, ItemType.Weapon, "description");
    const added = this.addItem(item);
    if (added) {
      obj.dispose();
    } else {
      console.log("Inventory full");
    }
  }
}
