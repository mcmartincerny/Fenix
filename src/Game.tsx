import { useEffect } from "react";
import "./Game.css";
import { BoxGeometry, DirectionalLight, Light, Mesh, MeshPhongMaterial, PerspectiveCamera, Scene, WebGLRenderer } from "three";

export const Game = () => {
  useEffect(init, []);

  return <canvas id="gameCanvas" />;
};
let initialized = false;
const init = () => {
  // if (initialized) return;
  initialized = true;
  console.log("init");
  const canvas = document.querySelector("#gameCanvas") as HTMLCanvasElement;
  const renderer = new WebGLRenderer({ antialias: true, canvas });
  const camera = new PerspectiveCamera(75, 2, 0.1, 10);
  camera.position.z = 2;

  const scene = new Scene();

  const geometry = new BoxGeometry(1, 1, 1);
  const material = new MeshPhongMaterial({ color: 0x00ff00 });
  const cube = new Mesh(geometry, material);
  cube.rotation.x = 0.5;
  scene.add(cube);

  const light = new DirectionalLight(0xffffff, 1);
  light.position.set(0, 0, 5);
  scene.add(light);

  let running = true;
  const animate = (time: number) => {
    if (!running) return;
    requestAnimationFrame(animate);

    cube.rotation.y += 0.01;
    cube.rotation.x = 0.5 + Math.sin(time / 1000) / 5;
    cube.position.x = Math.sin(time / 700);
    // camera.position.x = Math.sin(time / 700);

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
