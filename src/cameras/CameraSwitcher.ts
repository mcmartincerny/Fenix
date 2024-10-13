import { PerspectiveCamera } from "three";
import { TopDownCamera } from "./TopDownCamera";
import { BetterObject3D } from "../objects/BetterObject3D";
// @ts-ignore
import { OrbitControls } from "three/addons/controls/OrbitControls";
import { ThirdPersonCamera } from "./ThirdPersonCamera";
import { Person } from "../objects/Person";
import { PlayerThirdPersonController, PlayerTopDownController } from "../controllers/PlayerController";
export enum CameraType {
  Free = "Free",
  TopDown = "TopDown",
  ThirdPerson = "ThirdPerson",
  None = "None",
}

export class CameraSwitcher {
  canvasElement: HTMLCanvasElement;
  cameraTarget: BetterObject3D;
  type: CameraType;
  fov = 75;
  aspect = 2;
  near = 0.2;
  far = 100;
  camera: PerspectiveCamera = new PerspectiveCamera(this.fov, this.aspect, this.near, this.far);
  orbitControls?: OrbitControls;
  followingCamera?: TopDownCamera;
  thirdPersonCamera?: ThirdPersonCamera;

  constructor(canvasElement: HTMLCanvasElement, cameraTarget: BetterObject3D, cameraType: CameraType = CameraType.ThirdPerson) {
    this.canvasElement = canvasElement;
    this.type = cameraType;
    this.cameraTarget = cameraTarget;
    this.camera.up.set(0, 0, 1);
    this.camera.position.z = 4;
    this.camera.position.y = -5;
    this.switchCamera(this.type);
  }

  switchCamera(type: CameraType) {
    if (this.type === CameraType.Free) {
      this.unswitchFromFreeCamera();
    } else if (this.type === CameraType.TopDown) {
      this.unswitchFromFollowCamera();
    } else if (this.type === CameraType.ThirdPerson) {
      this.unswitchFromThirdPersonCamera();
    }

    this.type = type;

    if (this.type === CameraType.Free) {
      this.switchToFreeCamera();
    } else if (this.type === CameraType.TopDown) {
      this.switchToFollowCamera();
    } else if (this.type === CameraType.ThirdPerson) {
      this.switchToThirdPersonCamera();
    }
  }

  switchToFreeCamera() {
    if (!this.orbitControls) {
      this.orbitControls = new OrbitControls(this.camera, this.canvasElement);
      this.orbitControls.enableDamping = true;
      this.orbitControls.dampingFactor = 0.25;
      this.orbitControls.target.set(0, 3, 2);
      this.orbitControls.update();
    } else {
      this.orbitControls.connect();
    }
  }

  unswitchFromFreeCamera() {
    if (this.orbitControls) {
      this.orbitControls.disconnect();
    }
  }

  switchToFollowCamera() {
    if (!this.followingCamera) {
      this.followingCamera = new TopDownCamera(this.camera, this.cameraTarget, this.canvasElement);
      this.followingCamera.init();
    }
  }

  unswitchFromFollowCamera() {}

  switchToThirdPersonCamera() {
    if (!this.thirdPersonCamera) {
      this.thirdPersonCamera = new ThirdPersonCamera(this.camera, this.cameraTarget, this.canvasElement);
      this.thirdPersonCamera.init();
    }
    this.camera.quaternion.set(0.5, 0, 0, 1);
    this.thirdPersonCamera.setActive(true);
    if (this.cameraTarget.parent instanceof Person) {
      this.cameraTarget.parent.controller = new PlayerThirdPersonController(this.cameraTarget, this.camera);
    }
  }

  unswitchFromThirdPersonCamera() {
    this.thirdPersonCamera?.setActive(false);
    if (this.cameraTarget.parent instanceof Person) {
      this.cameraTarget.parent.controller = new PlayerTopDownController();
    }
  }

  beforeStep() {
    if (this.type === CameraType.TopDown) {
      this.followingCamera?.beforeStep();
    } else if (this.type === CameraType.ThirdPerson) {
      this.thirdPersonCamera?.beforeStep();
    }
  }

  afterStep() {
    if (this.type === CameraType.TopDown) {
      this.followingCamera?.afterStep();
    } else if (this.type === CameraType.ThirdPerson) {
      this.thirdPersonCamera?.afterStep();
    }
  }

  dispose() {
    this.unswitchFromFreeCamera();
    this.unswitchFromFollowCamera();
    this.orbitControls?.dispose();
    this.followingCamera?.dispose();
    this.thirdPersonCamera?.dispose();
  }
}
