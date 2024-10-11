enum ItemName {
  Pistol = "Pistol",
}

enum ItemType {
  Weapon = "Weapon",
}

class InventoryItem {
  constructor(public name: ItemName, public type: ItemType, public quantity = 1) {}
}
