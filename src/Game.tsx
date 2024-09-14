import { useEffect } from "react";
import "./Game.css";
import {
  DataTexture,
  Mesh,
  MeshPhongMaterial,
  MeshToonMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  RedFormat,
  Scene,
  SphereGeometry,
  WebGLRenderer,
} from "three";
// @ts-ignore
import { OrbitControls } from "three/addons/controls/OrbitControls";

export const Game = () => {
  useEffect(init, []);

  return <canvas id="gameCanvas" />;
};
const init = () => {
  console.log("init");
  const canvas = document.querySelector("#gameCanvas") as HTMLCanvasElement;
  const renderer = new WebGLRenderer({ antialias: true, canvas });
  const camera = new PerspectiveCamera(75, 2, 0.1, 10);
  camera.position.z = 2;
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.25;

  const scene = new Scene();

  const geometry = new SphereGeometry(1, 100, 100);
  const material = new MeshToonMaterial({ color: 0x44aa88, gradientMap: generateGradientMap() });
  const sphere = new Mesh(geometry, material);
  sphere.rotation.x = 0.5;
  scene.add(sphere);

  const planeGeometry = new PlaneGeometry(3, 3);
  const planeMaterial = new MeshPhongMaterial({ color: 0x44aa88 });
  const plane = new Mesh(planeGeometry, planeMaterial);
  plane.position.y = 0;
  plane.position.z = -1;
  plane.rotation.x = 0;
  scene.add(plane);

  const light = new PointLight(0xffffff, 20);
  light.position.set(0, 0, 3);
  scene.add(light);

  let running = true;
  const animate = (time: number) => {
    if (!running) return;
    requestAnimationFrame(animate);
    controls.update();

    sphere.rotation.y += 0.01;
    sphere.rotation.x = 0.5 + Math.sin(time / 1000) / 5;
    sphere.position.x = Math.sin(time / 700);

    resizeRendererToDisplaySize(renderer, camera);
    renderer.render(scene, camera);
  };
  animate(0);

  return () => {
    running = false;
    previousAspectRatio = 0;
    destroySceneObjects(scene);
    renderer.dispose();
    console.log("cleanup complete");
  };
};

let previousAspectRatio = 0;

const resizeRendererToDisplaySize = (renderer: WebGLRenderer, camera: PerspectiveCamera) => {
  const canvas = renderer.domElement;
  const pixelRatio = window.devicePixelRatio;
  const width = Math.floor(canvas.clientWidth * pixelRatio);
  const height = Math.floor(canvas.clientHeight * pixelRatio);
  const aspect = width / height;
  const needResize = aspect !== previousAspectRatio;
  previousAspectRatio = aspect;
  if (needResize) {
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
};

function destroySceneObjects(scene: Scene) {
  scene.traverse((object) => {
    console.log("disposing", object);
    if (hasDispose(object)) {
      object.dispose();
    }

    if (!isMesh(object)) return;

    // Dispose of geometries
    if (object.geometry) {
      object.geometry.dispose();
    }

    // Dispose of materials
    if (object.material) {
      if (Array.isArray(object.material)) {
        object.material.forEach((material) => material.dispose());
      } else {
        object.material.dispose();
      }
    }
  });

  // Remove objects from the scene
  while (scene.children.length > 0) {
    scene.remove(scene.children[0]);
  }
}

function hasDispose(object: any): object is { dispose: () => void } {
  return object && object.dispose;
}

function isMesh(object: any): object is Mesh {
  return object && object.isMesh;
}

function generateGradientMap() {
  // Create a small 1D data texture for the gradient map (grayscale values)
  const size = 3; // Two steps in the gradient
  const data = new Uint8Array([80, 200, 255]); // Two luminance values for shading steps

  // Create a DataTexture with LuminanceFormat
  const gradientMap = new DataTexture(data, size, 1, RedFormat);
  gradientMap.needsUpdate = true;
  return gradientMap;
}
