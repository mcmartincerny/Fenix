import { useEffect, useState } from "react";
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
  const inventory = playerInventory.backpackInventory;
  const toolbar = playerInventory.toolBarInventory;

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.code === "Tab") {
        setShowInventory((showInventory) => !showInventory);
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
        <Overlay darkenBackground>
          <InventoryUI inventory={inventory} />
        </Overlay>
      )}
      <ToolbarWrapper>
        <InventoryUI
          inventory={toolbar}
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
  toolbar?: boolean;
  addSelectionChangeListener?: PersonInventory["addSelectedItemChangedListener"];
  removeSelectionChangeListener?: PersonInventory["removeSelectedItemChangedListener"];
}

const InventoryUI = ({ inventory, toolbar, addSelectionChangeListener, removeSelectionChangeListener }: InventoryUIProps) => {
  const [invItems, setInvItems] = useState(inventory.items);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(addSelectionChangeListener ? 0 : null);
  const invWidth = toolbar ? inventory.items.length : Math.ceil(Math.pow(inventory.items.length, 0.5));

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
          <Slot key={i} item={item} selected={i === selectedIdx} />
        ))}
      </SlotGrid>
    </InvWrapper>
  );
};

const Slot = ({ item, selected }: { item: InventoryItem | null; selected: boolean }) => {
  return <StyledSlot selected={selected}>{item?.name ?? ""}</StyledSlot>;
};

const ToolbarWrapper = styled.div`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
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

const StyledSlot = styled.div<{ selected: boolean }>`
  width: 48px;
  height: 48px;
  border: 2px solid ${(props) => (props.selected ? theme.colors.orange : theme.colors.green)};
  border-radius: 4px;
  margin: 4px;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 12px;
`;
