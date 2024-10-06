import { PerspectiveCamera, Vector2, Vector3 } from "three";
import { BetterObject3D } from "../objects/BetterObject3D";
import { StandardController } from "../objects/Person";

const WALK_SPEED = 0.7;
const RUN_SPEED = 2.5;

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
    PlayerTopDownController.lastInstance?.dispose();
    PlayerTopDownController.lastInstance = this;
  }
  static lastInstance: PlayerTopDownController | null = null;

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
      speed = this.pressedKeys.has("shift") ? RUN_SPEED : WALK_SPEED;
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

export class PlayerThirdPersonController implements StandardController {
  pressedKeys: Set<string> = new Set();
  playerObject: BetterObject3D;
  camera: PerspectiveCamera;

  keydown = (event: KeyboardEvent) => {
    this.pressedKeys.add(event.key.toLowerCase());
    if (event.ctrlKey) {
      event.preventDefault();
    }
  };

  keyup = (event: KeyboardEvent) => {
    this.pressedKeys.delete(event.key.toLowerCase());
  };

  constructor(playerObject: BetterObject3D, camera: PerspectiveCamera) {
    this.playerObject = playerObject;
    this.camera = camera;
    document.addEventListener("keydown", this.keydown);
    document.addEventListener("keyup", this.keyup);
    PlayerThirdPersonController.lastInstance?.dispose();
    PlayerThirdPersonController.lastInstance = this;
  }
  static lastInstance: PlayerThirdPersonController | null = null;

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

    if (this.pressedKeys.has("w")) {
      direction.add(rotationVect); // Move forward in the direction the camera is facing
    }
    if (this.pressedKeys.has("s")) {
      direction.sub(rotationVect); // Move backward in the opposite direction
    }
    if (this.pressedKeys.has("a")) {
      direction.sub(rightVect); // Move left (strafe left)
    }
    if (this.pressedKeys.has("d")) {
      direction.add(rightVect); // Move right (strafe right)
    }

    if (direction.length() > 0) {
      speed = this.pressedKeys.has("shift") ? RUN_SPEED : WALK_SPEED;
      direction.normalize(); // Normalize direction to maintain consistent speed

      if (this.pressedKeys.has("shift")) {
        // If running, rotate the player to face the direction they are moving
        rotation = direction;
      }
    }

    return { direction, rotation, speed, jump: this.pressedKeys.has(" ") };
  }

  dispose(): void {
    document.removeEventListener("keydown", this.keydown);
    document.removeEventListener("keyup", this.keyup);
  }
}
