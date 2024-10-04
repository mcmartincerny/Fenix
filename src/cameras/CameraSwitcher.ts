import { PerspectiveCamera } from "three";
import { FollowingCamera } from "./FollowingCamera";
import { BetterObject3D } from "../objects/BetterObject3D";
// @ts-ignore
import { OrbitControls } from "three/addons/controls/OrbitControls";
import { ThirdPersonCamera } from "./ThirdPersonCamera";
export enum CameraType {
  Free = "Free",
  Follow = "Follow",
  ThirdPerson = "ThirdPerson",
  None = "None",
}

export class CameraSwitcher {
  canvasElement: HTMLCanvasElement;
  cameraTarget: BetterObject3D;
  type: CameraType;
  fov = 75;
  aspect = 2;
  near = 0.1;
  far = 100;
  camera: PerspectiveCamera = new PerspectiveCamera(this.fov, this.aspect, this.near, this.far);
  orbitControls?: OrbitControls;
  followingCamera?: FollowingCamera;
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
    } else if (this.type === CameraType.Follow) {
      this.unswitchFromFollowCamera();
    } else if (this.type === CameraType.ThirdPerson) {
      this.unswitchFromThirdPersonCamera();
    }

    this.type = type;

    if (this.type === CameraType.Free) {
      this.switchToFreeCamera();
    } else if (this.type === CameraType.Follow) {
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
      this.followingCamera = new FollowingCamera(this.camera, this.cameraTarget, this.canvasElement);
      this.followingCamera.init();
    }
  }

  unswitchFromFollowCamera() {}

  switchToThirdPersonCamera() {
    if (!this.thirdPersonCamera) {
      this.thirdPersonCamera = new ThirdPersonCamera(this.camera, this.cameraTarget, this.canvasElement);
      this.thirdPersonCamera.init();
    }
    this.thirdPersonCamera.setActive(true);
  }

  unswitchFromThirdPersonCamera() {
    this.thirdPersonCamera?.setActive(false);
  }

  beforeStep() {
    if (this.type === CameraType.Follow) {
      this.followingCamera?.beforeStep();
    } else if (this.type === CameraType.ThirdPerson) {
      this.thirdPersonCamera?.beforeStep();
    }
  }

  afterStep() {
    if (this.type === CameraType.Follow) {
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
