import { MouseEvent as ReactMouseEvent, useEffect, useState } from "react";
import { Inventory, InventoryItem, PersonInventory } from "../Inventory";
import { Overlay } from "../../ui/Components";
import { theme } from "../../Theme";
import styled from "@emotion/styled";
import { add } from "three/webgpu";

interface PlayerInventoryUIProps {
  playerInventory: PersonInventory;
}

export const PlayerInventoryUI = ({ playerInventory }: PlayerInventoryUIProps) => {
  const [showInventory, setShowInventory] = useState(false);
  const [pickedItemData, setPickedItemData] = useState<{ item: InventoryItem; inventory: Inventory; idx: number } | null>(null);
  const [mouseXY, setMouseXY] = useState({ x: 0, y: 0 });
  const inventory = playerInventory.backpackInventory;
  const toolbar = playerInventory.toolBarInventory;

  const pickItem = (item: InventoryItem, inventory: Inventory, idx: number, e: ReactMouseEvent) => {
    if (!pickedItemData) {
      setPickedItemData({ item, inventory, idx });
      setMouseXY({ x: e.clientX, y: e.clientY });
      e.stopPropagation();
    }
  };

  const dropItem = (inventory: Inventory, idx: number) => {
    if (pickedItemData) {
      Inventory.moveItem(pickedItemData.inventory, pickedItemData.idx, inventory, idx);
      setPickedItemData(null);
    }
  };

  const clickOutside = (e: ReactMouseEvent) => {
    if (pickedItemData && e.target instanceof HTMLElement && e.target.dataset.outside) {
      pickedItemData.inventory.dropItemOutOfInventory(pickedItemData.idx);
      setPickedItemData(null);
    }
  };

  useEffect(() => {
    if (pickedItemData) {
      const handleMouseMove = (event: MouseEvent) => {
        setMouseXY({ x: event.clientX, y: event.clientY });
      };
      document.addEventListener("mousemove", handleMouseMove);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
      };
    }
  }, [pickedItemData]);

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.code === "Tab") {
        setShowInventory((showInventory) => {
          if (!showInventory && document.pointerLockElement !== null) {
            document.exitPointerLock();
          } else if (showInventory && document.pointerLockElement === null) {
            const canvas = document.querySelector("#mainCanvas") as HTMLCanvasElement;
            canvas.requestPointerLock();
            setPickedItemData(null);
          }
          return !showInventory;
        });
        event.preventDefault();
      }
    };
    document.addEventListener("keydown", handleKeyPress);
    return () => {
      document.removeEventListener("keydown", handleKeyPress);
    };
  }, []);

  return (
    <>
      {showInventory && (
        <>
          <Overlay darkenBackground onClick={clickOutside} data-outside>
            <InventoryUI inventory={inventory} pickItem={pickItem} dropItem={dropItem} pickedItemData={pickedItemData} />
          </Overlay>
          {pickedItemData && (
            <FakePickedSlot x={mouseXY.x} y={mouseXY.y}>
              <StyledItem>{pickedItemData.item.name}</StyledItem>
            </FakePickedSlot>
          )}
        </>
      )}
      <ToolbarWrapper>
        <InventoryUI
          inventory={toolbar}
          pickItem={pickItem}
          dropItem={dropItem}
          pickedItemData={pickedItemData}
          toolbar
          addSelectionChangeListener={playerInventory.addSelectedItemChangedListener}
          removeSelectionChangeListener={playerInventory.removeSelectedItemChangedListener}
        />
      </ToolbarWrapper>
    </>
  );
};

interface InventoryUIProps {
  inventory: Inventory;
  pickItem: (item: InventoryItem, inventory: Inventory, idx: number, e: ReactMouseEvent) => void;
  dropItem: (inventory: Inventory, idx: number) => void;
  pickedItemData: { item: InventoryItem; inventory: Inventory; idx: number } | null;
  toolbar?: boolean;
  addSelectionChangeListener?: PersonInventory["addSelectedItemChangedListener"];
  removeSelectionChangeListener?: PersonInventory["removeSelectedItemChangedListener"];
}

const InventoryUI = ({
  inventory,
  pickItem,
  dropItem,
  pickedItemData,
  toolbar,
  addSelectionChangeListener,
  removeSelectionChangeListener,
}: InventoryUIProps) => {
  const [invItems, setInvItems] = useState([...inventory.items]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(addSelectionChangeListener ? 0 : null);
  const invWidth = toolbar ? inventory.items.length : Math.ceil(Math.pow(inventory.items.length, 0.5));

  useEffect(() => {
    setInvItems([...inventory.items]);
  }, [inventory]);

  useEffect(() => {
    const updateInvItems = () => {
      setInvItems([...inventory.items]);
    };
    const updateSelectedIdx = (idx: number) => {
      setSelectedIdx(idx);
    };
    inventory.addInventoryChangedListener(updateInvItems);
    if (addSelectionChangeListener) {
      addSelectionChangeListener(updateSelectedIdx);
    }
    return () => {
      inventory.removeInventoryChangedListener(updateInvItems);
      if (removeSelectionChangeListener) {
        removeSelectionChangeListener(updateSelectedIdx);
      }
    };
  }, [inventory, toolbar, addSelectionChangeListener, removeSelectionChangeListener]);

  return (
    <InvWrapper bottom={toolbar}>
      <SlotGrid widthItems={invWidth}>
        {invItems.map((item, i) => (
          <StyledSlot key={i} selected={i === selectedIdx} onClick={() => dropItem(inventory, i)} holdingItem={!!pickedItemData} hasItem={!!item}>
            {item && !(pickedItemData?.inventory === inventory && pickedItemData?.idx === i) && (
              <StyledItem onClick={(e) => pickItem(item, inventory, i, e)}>{item.name}</StyledItem>
            )}
          </StyledSlot>
        ))}
      </SlotGrid>
    </InvWrapper>
  );
};

const ToolbarWrapper = styled.div`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 2000;
  margin: auto;
  width: fit-content;
`;

const InvWrapper = styled.div<{ bottom?: boolean }>`
  display: flex;
  flex-direction: column;
  ${(props) =>
    props.bottom &&
    `
  height: 100%;
  justify-content: flex-end;
  `}
`;

const SlotGrid = styled.div<{ widthItems: number }>`
  display: grid;
  grid-template-columns: repeat(${(props) => props.widthItems}, 1fr);
  margin: 8px;
  padding: 8px;
  background-color: ${theme.colors.blueishBlack};
  border: 2px solid ${theme.colors.green};
  border-radius: 8px;
`;

const StyledSlot = styled.div<{ selected: boolean; holdingItem: boolean; hasItem: boolean }>`
  width: 48px;
  height: 48px;
  border: 2px solid ${(props) => (props.selected ? theme.colors.orange : theme.colors.green)};
  border-radius: 4px;
  margin: 4px;
  display: flex;
  justify-content: center;
  align-items: center;
  :hover {
    border-color: ${(props) => (props.holdingItem ? theme.colors.ultraWhite : props.hasItem ? theme.colors.whiteDark : "inherit")};
  }
`;

const StyledItem = styled.div`
  font-size: 12px;
  cursor: pointer;
`;

const FakePickedSlot = styled.div<{ x: number; y: number }>`
  position: absolute;
  z-index: 5000;
  pointer-events: none;
  top: ${(props) => props.y - 24}px;
  left: ${(props) => props.x - 24}px;
  width: 48px;
  height: 48px;
  display: flex;
  justify-content: center;
  align-items: center;
`;
