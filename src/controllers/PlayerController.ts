import { PerspectiveCamera, Vector2, Vector3 } from "three";
import { BetterObject3D } from "../objects/BetterObject3D";
import { StandardController } from "../objects/Person";

const WALK_SPEED = 0.7;
const RUN_SPEED = 2.5;

class PlayerController implements StandardController {
  pressedKeys: Set<string> = new Set();
  pressedMouseButtons: Set<number> = new Set();
  scrollDelta = 0;
  rotation = { x: 0, y: -1 };
  gPressedAt = 0;

  constructor() {
    document.addEventListener("keydown", this.keydown);
    document.addEventListener("keyup", this.keyup);
    document.addEventListener("mousedown", this.mousedown);
    document.addEventListener("mouseup", this.mouseup);
    document.addEventListener("wheel", this.onScroll);
    PlayerController.lastInstance?.dispose();
    PlayerController.lastInstance = this;
  }
  static lastInstance: PlayerController | null = null;

  keydown = (event: KeyboardEvent) => {
    if (event.code === "KeyG" && !this.pressedKeys.has("KeyG")) {
      this.gPressedAt = Date.now();
    }
    this.pressedKeys.add(event.code);
    if (event.ctrlKey) {
      event.preventDefault();
    }
  };

  keyup = (event: KeyboardEvent) => {
    this.pressedKeys.delete(event.code);
  };

  mousedown = (event: MouseEvent) => {
    this.pressedMouseButtons.add(event.button);
  };

  mouseup = (event: MouseEvent) => {
    this.pressedMouseButtons.delete(event.button);
  };

  onScroll = (event: WheelEvent) => {
    this.scrollDelta += event.deltaY;
  };

  getScroll(): -1 | 0 | 1 {
    if (this.scrollDelta < 0) {
      this.scrollDelta = 0;
      return -1;
    } else if (this.scrollDelta > 0) {
      this.scrollDelta = 0;
      return 1;
    }
    return 0;
  }

  dispose(): void {
    document.removeEventListener("keydown", this.keydown);
    document.removeEventListener("keyup", this.keyup);
    document.removeEventListener("mousedown", this.mousedown);
    document.removeEventListener("mouseup", this.mouseup);
    document.removeEventListener("wheel", this.onScroll);
  }

  getMovement(): { direction: any; rotation: any; speed: number; jump: boolean } {
    throw new Error("getMovement() must be implemented in subclasses");
  }

  getActions() {
    const scroll = this.getScroll();
    let digitKey: number | null = null;
    this.pressedKeys.forEach((key) => {
      if (key.startsWith("Digit")) {
        digitKey = parseInt(key[5]);
      }
    });

    return {
      pickUp: this.pressedKeys.has("KeyE"),
      drop: this.pressedKeys.has("KeyG") ? Math.min((Date.now() - this.gPressedAt) / 1000, 1) : 0,
      primaryAction: this.pressedMouseButtons.has(0),
      tertiaryAction: this.pressedMouseButtons.has(1),
      secondaryAction: this.pressedMouseButtons.has(2),
      switchItemUp: scroll === -1,
      switchItemDown: scroll === 1,
      switchToItem: digitKey ? digitKey - 1 : null,
    };
  }
}

export class PlayerTopDownController extends PlayerController {
  getMovement() {
    const direction = { x: 0, y: 0 };
    let speed = 0;
    if (this.pressedKeys.has("KeyW")) {
      direction.y += 1;
    }
    if (this.pressedKeys.has("KeyS")) {
      direction.y -= 1;
    }
    if (this.pressedKeys.has("KeyA")) {
      direction.x -= 1;
    }
    if (this.pressedKeys.has("KeyD")) {
      direction.x += 1;
    }
    if (Math.abs(direction.x) + Math.abs(direction.y) > 0) {
      this.rotation = { ...direction };
      speed = this.pressedKeys.has("ShiftLeft") ? RUN_SPEED : WALK_SPEED;
    }
    if (Math.abs(direction.x) + Math.abs(direction.y) > 1) {
      direction.x /= Math.sqrt(2);
      direction.y /= Math.sqrt(2);
    }

    return { direction, rotation: this.rotation, speed, jump: this.pressedKeys.has("Space") };
  }
}

export class PlayerThirdPersonController extends PlayerController {
  playerObject: BetterObject3D;
  camera: PerspectiveCamera;

  constructor(playerObject: BetterObject3D, camera: PerspectiveCamera) {
    super();
    this.playerObject = playerObject;
    this.camera = camera;
  }

  getMovement() {
    // get rotation based on the camera rotation
    const rotationVect = new Vector3();
    this.camera.getWorldDirection(rotationVect);
    rotationVect.z = 0;
    rotationVect.normalize();
    let rotation = { x: rotationVect.x, y: rotationVect.y };
    // Create a perpendicular vector to handle sideways movement (A/D keys)
    const rightVect = new Vector2(rotationVect.y, -rotationVect.x); // Rotate 90 degrees to get the 'right' vector

    // Get movement based on the keys pressed
    const direction = new Vector2(0, 0);
    let speed = 0;

    if (this.pressedKeys.has("KeyW")) {
      direction.add(rotationVect); // Move forward in the direction the camera is facing
    }
    if (this.pressedKeys.has("KeyS")) {
      direction.sub(rotationVect); // Move backward in the opposite direction
    }
    if (this.pressedKeys.has("KeyA")) {
      direction.sub(rightVect); // Move left (strafe left)
    }
    if (this.pressedKeys.has("KeyD")) {
      direction.add(rightVect); // Move right (strafe right)
    }

    if (direction.length() > 0) {
      speed = this.pressedKeys.has("ShiftLeft") ? RUN_SPEED : WALK_SPEED;
      direction.normalize(); // Normalize direction to maintain consistent speed

      if (this.pressedKeys.has("ShiftLeft")) {
        // If running, rotate the player to face the direction they are moving
        rotation = direction;
      }
    }
    return { direction, rotation, speed, jump: this.pressedKeys.has("Space") };
  }
}
