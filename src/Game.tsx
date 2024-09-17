import { useEffect } from "react";
import "./Game.css";
import {
  DataTexture,
  Mesh,
  MeshBasicMaterial,
  MeshNormalMaterial,
  MeshPhongMaterial,
  MeshStandardMaterial,
  MeshToonMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  RedFormat,
  RGBAIntegerFormat,
  RGBFormat,
  RGBIntegerFormat,
  RGFormat,
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
  const camera = new PerspectiveCamera(75, 2, 0.1, 100);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.25;
  camera.position.z = 4;
  camera.position.y = -5;
  controls.target.set(0, 3, 0);

  const scene = new Scene();

  const geometry = new SphereGeometry(1, 100, 100);
  const material = new MeshToonMaterial({ color: 0x44aa88, gradientMap: generateGradientMap() });
  const sphere = new Mesh(geometry, material);
  sphere.position.z = 1;
  sphere.position.y = 2;
  scene.add(sphere);

  const groundGeometry = new PlaneGeometry(10, 10, 99, 99);
  const groundMaterial = new MeshPhongMaterial({ color: 0x44aa88 });
  // groundMaterial.bumpMap = generateGrassBumpMap(100, 100);
  groundMaterial.displacementMap = generateGrassBumpMap(100, 100);
  const ground = new Mesh(groundGeometry, groundMaterial);
  ground.position.z = 0;
  scene.add(ground);

  const wallGeometry = new PlaneGeometry(6, 4, 99, 99);
  const wallMaterial = new MeshStandardMaterial();
  const bricksMap = generateBricksMap(100, 100, 255);
  wallMaterial.displacementMap = bricksMap;
  wallMaterial.displacementScale = 0.1;
  wallMaterial.bumpMap = bricksMap;
  wallMaterial.bumpScale = 5;
  wallMaterial.map = generateBricksTexture(100, 100);
  const wall = new Mesh(wallGeometry, wallMaterial);
  wall.position.z = 2.5;
  wall.position.y = 3;
  wall.rotation.x = Math.PI / 2;
  wall.rotation.z = Math.PI;
  scene.add(wall);

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

function generateBumpMap(sizeX: number, sizeY: number, bumpFunction: (x: number, y: number, previousData: number[]) => number) {
  const data = [];
  for (let y = 0; y < sizeY; y++) {
    for (let x = 0; x < sizeX; x++) {
      const value = bumpFunction(x, y, data);
      data.push(value);
    }
  }
  const texture = new DataTexture(new Uint8Array(data), sizeX, sizeY, RedFormat);
  texture.needsUpdate = true;
  return texture;
}

function generateTextureMap(sizeX: number, sizeY: number, textureFunction: (x: number, y: number) => [number, number, number]) {
  const data: number[] = [];
  for (let y = 0; y < sizeY; y++) {
    for (let x = 0; x < sizeX; x++) {
      const value = textureFunction(x, y);
      data.push(...value, 255);
    }
  }
  const texture = new DataTexture(new Uint8Array(data), sizeX, sizeY);
  texture.needsUpdate = true;
  return texture;
}

function generateGrassBumpMap(sizeX: number, sizeY: number, grassHeight = 255) {
  return generateBumpMap(sizeX, sizeY, (x, y, data) => {
    const currentIndex = y * sizeX + x;
    let wasTallGrassPastFewIndexes = false;
    for (let i = 1; i < Math.random() * 20 + 20; i++) {
      if (data[currentIndex - i] > grassHeight / 2) {
        wasTallGrassPastFewIndexes = true;
        break;
      }
    }
    let wasMiddleGrassPastFewIndexes = false;
    for (let i = 1; i < 6; i++) {
      if (data[currentIndex - i] > grassHeight / 4) {
        wasMiddleGrassPastFewIndexes = true;
        break;
      }
    }
    const wasTallGrassUp =
      data[currentIndex - sizeX] > grassHeight / 2 || data[currentIndex - sizeX - 1] > grassHeight / 2 || data[currentIndex - sizeX + 1] > grassHeight / 2;
    const wasMiddleGrassUp =
      data[currentIndex - sizeX] > grassHeight / 4 || data[currentIndex - sizeX - 1] > grassHeight / 4 || data[currentIndex - sizeX + 1] > grassHeight / 4;
    const wasTallGrass = wasTallGrassPastFewIndexes || wasTallGrassUp;
    const wasMiddleGrass = wasMiddleGrassPastFewIndexes || wasMiddleGrassUp;
    let grass = wasTallGrass ? (wasMiddleGrass ? 0 : grassHeight / 2) : grassHeight;
    grass = (Math.random() / 2 + 0.5) * grass;
    return grass;
  });
}

function generateBricksMap(sizeX: number, sizeY: number, brickDepth = 255, brickWidth = 12, brickHeight = 7, mortarWidth = 1) {
  return generateBumpMap(sizeX, sizeY, (x, y) => {
    const mortarVertical = y % (brickHeight + mortarWidth) < mortarWidth;
    const oddRow = Math.floor(y / (brickHeight + mortarWidth)) % 2 === 1;
    const mortarHorizontal = (oddRow ? x + Math.floor(brickWidth / 2) : x) % (brickWidth + mortarWidth) < mortarWidth;
    const brick = !mortarVertical && !mortarHorizontal;
    const beginningOfBrick = brick && (oddRow ? x + Math.floor(brickWidth / 2) : x) % (brickWidth + mortarWidth) === 1;
    const endingOfBrick = brick && (oddRow ? x + Math.floor(brickWidth / 2) : x) % (brickWidth + mortarWidth) === brickWidth;
    const mortarLineOnTop = (y - 1) % (brickHeight + mortarWidth) === 0;
    const mortarLineOnBottom = (y + 1) % (brickHeight + mortarWidth) === 0;
    // slight chance of missing a corner of brick
    if ((beginningOfBrick || endingOfBrick) && (mortarLineOnTop || mortarLineOnBottom) && Math.random() < 0.1) {
      return brickDepth / 2;
    }
    return brick ? (Math.random() / 8 + 0.75) * brickDepth : 0;
  });
}

function generateBricksTexture(sizeX: number, sizeY: number, brickWidth = 12, brickHeight = 7, mortarWidth = 1) {
  return generateTextureMap(sizeX, sizeY, (x, y) => {
    const mortarVertical = y % (brickHeight + mortarWidth) < mortarWidth;
    const oddRow = Math.floor(y / (brickHeight + mortarWidth)) % 2 === 1;
    const mortarHorizontal = (oddRow ? x + Math.floor(brickWidth / 2) : x) % (brickWidth + mortarWidth) < mortarWidth;
    const brick = !mortarVertical && !mortarHorizontal;

    if (brick) {
      return [40, 10, 5];
    } else {
      return [50, 50, 50];
    }
  });
}
