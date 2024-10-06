import { useEffect, useState } from "react";
import "./Game.css";
import {
  ACESFilmicToneMapping,
  AgXToneMapping,
  AmbientLight,
  BoxGeometry,
  CineonToneMapping,
  ColorSpace,
  CustomToneMapping,
  DirectionalLight,
  HemisphereLight,
  Light,
  LinearToneMapping,
  Mesh,
  MeshPhongMaterial,
  MeshStandardMaterial,
  MeshToonMaterial,
  NeutralToneMapping,
  NoToneMapping,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  ReinhardToneMapping,
  Scene,
  SphereGeometry,
  WebGLRenderer,
} from "three";

import { Person } from "./objects/Person";
import Stats from "stats.js";
import { generateBricksMap, generateBricksTexture, generateGradientMap, generateGrassBumpMap } from "./texturesAndMaps/firstStuff";
import RAPIER, { EventQueue } from "@dimforge/rapier3d-compat";
import { RapierDebugRenderer } from "./Debug";
import GUI from "lil-gui";
import { BetterObject3D } from "./objects/BetterObject3D";
import { setGui, setWorld } from "./Globals";
import { PlayerTopDownController } from "./controllers/PlayerController";
import { PhysicsHooks } from "./PhysicsHooks";
import { log, resetDebugRigidBodies } from "./helpers";
import { createPrismWithColider, createStairsWithColider } from "./objects/Shapes";
import { CameraSwitcher, CameraType } from "./cameras/CameraSwitcher";
import { DestructibleBlock } from "./objects/DestructibleBlock";

await RAPIER.init();

const stats = new Stats();

const testCubesGuiHelper = {
  enabled: false,
  speed: 0.001,
};

export const Game = () => {
  //TODO: RAM increases every reset - memory leak
  const [reset, setReset] = useState(false);
  useEffect(init, [reset]);

  useEffect(() => {
    const resetF = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "r") {
        setReset((r) => !r);
        document.exitPointerLock();
      }
    };
    document.addEventListener("keydown", resetF);
    stats.showPanel(0);
    (stats.dom.children[1] as HTMLElement).style.display = "block";
    document.body.appendChild(stats.dom);
    return () => {
      document.body.removeChild(stats.dom);
      document.removeEventListener("keydown", resetF);
    };
  }, []);

  return <canvas id="gameCanvas" />;
};

const init = () => {
  console.log("init");
  const gui = new GUI();
  setGui(gui);
  const canvas = document.querySelector("#gameCanvas") as HTMLCanvasElement;
  const renderer = new WebGLRenderer({ antialias: true, canvas, alpha: true }); // TODO: settings
  renderer.setPixelRatio(2); // TODO: settings
  const toneMappingOptions = [
    NoToneMapping,
    LinearToneMapping,
    ReinhardToneMapping,
    CineonToneMapping,
    ACESFilmicToneMapping,
    AgXToneMapping,
    NeutralToneMapping,
    CustomToneMapping,
  ];
  let toneMappingIndex = 0;
  document.addEventListener("keydown", (event) => {
    // TODO: this preserves between rerenders
    if (event.key === "m") {
      // TODO: remove event listener on destroy
      toneMappingIndex = (toneMappingIndex + 1) % toneMappingOptions.length;
      renderer.toneMapping = toneMappingOptions[toneMappingIndex];
      console.log("Tone mapping set to", renderer.toneMapping);
    }
  });
  renderer.outputColorSpace = "srgb" as ColorSpace;
  const outputColorSpaces = ["srgb", "srgb-linear", "display-p3", "display-p3-linear"];
  let outputColorSpaceIndex = 0;
  document.addEventListener("keydown", (event) => {
    // TODO: remove event listener on destroy
    if (event.key === "c") {
      outputColorSpaceIndex = (outputColorSpaceIndex + 1) % outputColorSpaces.length;
      renderer.outputColorSpace = outputColorSpaces[outputColorSpaceIndex] as ColorSpace;
      console.log("Output color space set to", outputColorSpaces[outputColorSpaceIndex]);
    }
  });

  const scene = new Scene();

  const world = new RAPIER.World({ x: 0.0, y: 0.0, z: -9.81 });
  setWorld(world);

  const rapierDebugRenderer = new RapierDebugRenderer(scene, world);
  gui.add(rapierDebugRenderer, "enabled").name("Show physics debug");
  const guiHelper = {
    set gravity(value: number) {
      world.gravity = { x: 0, y: 0, z: value };
      scene.traverse((object) => (object as BetterObject3D).rigidBody?.wakeUp());
    },
    get gravity() {
      return world.gravity.z;
    },
    slowMotion: 1,
  };
  gui.add(guiHelper, "gravity", -9.81, 9.81).name("Gravity");
  gui.add(guiHelper, "slowMotion").min(1).max(10);

  // const ambientLight = new AmbientLight(0xffffff, 0.1);
  // scene.add(ambientLight);
  const geometry = new SphereGeometry(1, 100, 100);
  const material = new MeshToonMaterial({ color: 0x44aa88, gradientMap: generateGradientMap() });
  const sphere = new Mesh(geometry, material);
  sphere.position.z = 3;
  sphere.position.y = 2;
  scene.add(sphere);
  const sphereRigidBody = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0.0, 2.0, 3.0));
  const sphereCollider = world.createCollider(RAPIER.ColliderDesc.ball(1.0).setTranslation(0.0, 0.0, 0.0), sphereRigidBody);
  sphereCollider.setRestitution(0.8);
  sphereCollider.setDensity(0.05);

  const groundGeometry = new PlaneGeometry(30, 30, 599, 599);
  const groundMaterial = new MeshPhongMaterial({ color: 0x44aa88 });
  // groundMaterial.bumpMap = generateGrassBumpMap(100, 100);
  groundMaterial.displacementMap = generateGrassBumpMap(600, 600, 120);
  const ground = new Mesh(groundGeometry, groundMaterial);
  ground.position.z = 0;
  scene.add(ground);
  const groundRigidBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0.0, 0.0, 0));
  groundRigidBody.userData = { name: "ground" };
  const groundCollider = world.createCollider(RAPIER.ColliderDesc.cuboid(15, 15, 0.1).setTranslation(0.0, 0.0, 0.0), groundRigidBody);
  groundCollider.setRestitution(1);
  groundCollider.setFriction(1);

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

  const light = new PointLight(0xffffff, 20, 0, 1.4);
  light.position.set(0, -4, 4);
  scene.add(light);

  const directionalLight = new DirectionalLight(0xffffff, 0.05);
  directionalLight.position.set(0, 0, 20);
  directionalLight.lookAt(-10, -10, 0);
  scene.add(directionalLight);

  const hemisphereLight = new HemisphereLight(0xffffff, 0x444444, 0.1);
  scene.add(hemisphereLight);

  const person = new Person(new PlayerTopDownController());
  person.position.z = 3;
  scene.add(person);
  person.init();

  const cameraSwitcher = new CameraSwitcher(canvas, person.torso);
  gui
    .add({}, "dummy", CameraType)
    .name("Camera type")
    .setValue(cameraSwitcher.type)
    .onChange((type: CameraType) => cameraSwitcher.switchCamera(type));

  const cubeGeometry = new BoxGeometry(1, 3, 2);
  const cubeMaterial = new MeshStandardMaterial({ color: 0x44aa88 });
  const cube = new Mesh(cubeGeometry, cubeMaterial);
  scene.add(cube);
  const cubeRigidBody = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(2.0, 0.0, 1.0));
  const cubeCollider = world.createCollider(RAPIER.ColliderDesc.cuboid(0.5, 1.5, 1).setTranslation(0.0, 0.0, 0.0), cubeRigidBody);
  cubeCollider.setRestitution(1);

  const cube2 = new Mesh(cubeGeometry, cubeMaterial);
  scene.add(cube2);
  const cubeRigidBody2 = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(-2.0, 0.0, 1.0));
  const cubeCollider2 = world.createCollider(RAPIER.ColliderDesc.cuboid(0.5, 1.5, 1).setTranslation(0.0, 0.0, 0.0), cubeRigidBody2);
  cubeCollider2.setRestitution(1);

  gui.add(testCubesGuiHelper, "enabled").name("Enable test cubes");
  gui.add(testCubesGuiHelper, "speed").min(0.001).max(0.005).name("Test cubes speed");

  for (let i = 0; i < 5; i++) {
    const { prism } = createPrismWithColider({ length: 2, width: 2, angle: 10 + i * 20 }, [-6, i * 2 - 5, 0]);
    scene.add(prism);
  }
  const { stairs } = createStairsWithColider({ length: 2.5, width: 2, height: 2, steps: 10, solidBottom: false }, [0.5, 1, 0]);
  scene.add(stairs);

  const destructibleBlock = new DestructibleBlock({
    position: { x: 0, y: -0.5, z: 1.5 },
    size: { x: 2, y: 0.2, z: 2 },
    detail: 20,
  });
  scene.add(destructibleBlock);
  destructibleBlock.init();

  let running = true;
  let previousTime: number;
  const animate = (time: number) => {
    if (!running) return;
    stats.begin();
    requestAnimationFrame(animate);
    scene.traverse((object) => (object as BetterObject3D).beforeStep?.());
    cameraSwitcher.beforeStep();
    const cubeZ = testCubesGuiHelper.enabled ? 1 : -3;
    const cubePos = Math.sin(time * testCubesGuiHelper.speed) * 2.8;
    cubeRigidBody.setNextKinematicTranslation({ x: cubePos + 3, y: 0, z: cubeZ });
    cubeRigidBody2.setNextKinematicTranslation({ x: cubePos - 3, y: 0, z: cubeZ });
    if (previousTime) {
      let delta = time - previousTime;
      if (delta > 50) {
        delta = 50;
      }
      world.timestep = delta / 1000 / guiHelper.slowMotion;
    }
    previousTime = time;
    world.step(new EventQueue(true), PhysicsHooks);
    sphere.position.copy(sphereRigidBody.translation());
    cube.position.copy(cubeRigidBody.translation());
    cube2.position.copy(cubeRigidBody2.translation());

    scene.traverse((object) => (object as BetterObject3D).afterStep?.());
    cameraSwitcher.afterStep();

    rapierDebugRenderer.update();
    resizeRendererToDisplaySize(renderer, cameraSwitcher.camera);
    renderer.render(scene, cameraSwitcher.camera);
    stats.end();
    log(`Make it into a loot it game. Two or three teams on a map with buildings where 
      is loot and dangers. Each team has some base - maybe a van? Maybe movable? Where they can store loot and respawn.
      Game ends in 10m or after some respawn points and which team has the most loot wins.`);
  };
  animate(0);

  return () => {
    running = false;
    previousAspectRatio = 0;
    destroySceneObjects(scene);
    renderer.dispose();
    gui.destroy();
    cameraSwitcher.dispose();
    resetDebugRigidBodies();
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
