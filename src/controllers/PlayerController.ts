import { StandardController } from "../objects/Person";

export class PlayerTopDownController implements StandardController {
  rotation = { x: 0, y: -1 };

  pressedKeys: Set<string> = new Set();

  keydown = (event: KeyboardEvent) => {
    this.pressedKeys.add(event.key.toLowerCase());
    if (event.ctrlKey) {
      event.preventDefault();
    }
  };

  keyup = (event: KeyboardEvent) => {
    this.pressedKeys.delete(event.key.toLowerCase());
  };

  constructor() {
    document.addEventListener("keydown", this.keydown);
    document.addEventListener("keyup", this.keyup);
  }

  getMovement() {
    const direction = { x: 0, y: 0 };
    let speed = 0;
    if (this.pressedKeys.has("w")) {
      direction.y += 1;
    }
    if (this.pressedKeys.has("s")) {
      direction.y -= 1;
    }
    if (this.pressedKeys.has("a")) {
      direction.x -= 1;
    }
    if (this.pressedKeys.has("d")) {
      direction.x += 1;
    }
    if (Math.abs(direction.x) + Math.abs(direction.y) > 0) {
      this.rotation = { ...direction };
      speed = 0.7;
    }
    if (this.pressedKeys.has("control")) {
      speed = 0.4;
    }
    if (this.pressedKeys.has("shift")) {
      speed = 2.5;
    }
    if (Math.abs(direction.x) + Math.abs(direction.y) > 1) {
      direction.x /= Math.sqrt(2);
      direction.y /= Math.sqrt(2);
    }

    return { direction, rotation: this.rotation, speed, jump: this.pressedKeys.has(" ") };
  }

  dispose(): void {
    document.removeEventListener("keydown", this.keydown);
    document.removeEventListener("keyup", this.keyup);
  }
}
