import { ExtrudeGeometry, Mesh, MeshStandardMaterial, MeshToonMaterial, Shape, Vector2, Vector3Tuple } from "three";
import { generateGradientMap } from "../texturesAndMaps/firstStuff";
import { world } from "../Globals";
import RAPIER from "@dimforge/rapier3d-compat";

interface PrismProps {
  length: number;
  width: number;
  height?: number;
  angle?: number;
}

export class PrismGeometry extends ExtrudeGeometry {
  constructor({ length, width, height, angle }: PrismProps) {
    if (angle) {
      // calculate the height of the prism
      height = Math.sin(angle * (Math.PI / 180)) * length;
    }

    const a = new Vector2(0, height);
    const b = new Vector2(0, 0);
    const c = new Vector2(length, 0);
    super(new Shape([a, b, c]), { depth: width, bevelEnabled: false });
    this.rotateX(Math.PI / 2);
  }
}

export const createPrismWithColider = (prismProps: PrismProps, position?: Vector3Tuple) => {
  const prismGeometry = new PrismGeometry(prismProps);
  const prismMaterial = new MeshToonMaterial({ color: 0x44aa88, gradientMap: generateGradientMap() });
  const prism = new Mesh(prismGeometry, prismMaterial);
  prism.position.set(...(position || [0, 0, 0]));
  const rigidBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(...(position || [0, 0, 0])));
  const collider = world.createCollider(createConvexMeshColiderForMesh(prism), rigidBody);
  return {
    prism,
    rigidBody,
    collider,
  };
};

interface StairsProps {
  length: number;
  width: number;
  height: number;
  steps: number;
  solidBottom?: boolean;
}

export class StairsGeometry extends ExtrudeGeometry {
  constructor({ length, width, height, steps, solidBottom }: StairsProps) {
    const lengthIncrement = length / steps;
    const heightIncrement = height / steps;
    const positions: Vector2[] = [];
    positions.push(new Vector2(0, 0));
    for (let i = 0; i < steps; i++) {
      positions.push(new Vector2(i * lengthIncrement, (i + 1) * heightIncrement));
      positions.push(new Vector2((i + 1) * lengthIncrement, (i + 1) * heightIncrement));
    }
    if (solidBottom) {
      positions.push(new Vector2(length, 0));
    } else {
      positions.push(new Vector2(length, height * 0.8));
      positions.push(new Vector2(length * 0.2, 0));
    }
    super(new Shape(positions), { depth: width, bevelEnabled: false });
    this.rotateX(Math.PI / 2);
  }
}

export const createStairsWithColider = (stairsProps: StairsProps, position?: Vector3Tuple) => {
  const stairsGeometry = new StairsGeometry(stairsProps);
  const stairsMaterial = new MeshStandardMaterial({ color: 0x998888 });
  const stairs = new Mesh(stairsGeometry, stairsMaterial);
  stairs.position.set(...(position || [0, 0, 0]));
  const rigidBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(...(position || [0, 0, 0])));
  const collider = world.createCollider(createTrimeshColiderForMesh(stairs), rigidBody);
  return {
    stairs,
    rigidBody,
    collider,
  };
};

export const createConvexMeshColiderForMesh = (mesh: Mesh, shortenVertices = 4): RAPIER.ColliderDesc => {
  const geometry = mesh.geometry;
  let vertices = geometry.getAttribute("position").array as Float32Array;
  // for some reason the vertices are repeated a few times, we need to shorten them
  vertices = vertices.slice(0, vertices.length / shortenVertices);
  const indices = geometry.getIndex()?.array as Uint32Array;
  return RAPIER.ColliderDesc.convexMesh(vertices, indices)!;
};

export const createTrimeshColiderForMesh = (mesh: Mesh): RAPIER.ColliderDesc => {
  const geometry = mesh.geometry;
  if (!geometry.getIndex()) {
    geometry.setIndex([...Array(geometry.attributes.position.count).keys()]);
  }
  const vertices = geometry.getAttribute("position").array as Float32Array;
  const indices = geometry.getIndex()?.array as Uint32Array;
  return RAPIER.ColliderDesc.trimesh(vertices, indices)!;
};
