import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  MeshNormalMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Vector3Like,
} from "three";
import { BetterObject3D } from "./BetterObject3D";
import { gui, world } from "../Globals";
import { clamp, debugRigidBody, toRange, Vector3 } from "../helpers";
import { generateNoiseTexture } from "../texturesAndMaps/firstStuff";
import RAPIER, { TriMesh } from "@dimforge/rapier3d-compat";
import { createTrimeshColiderForMesh } from "./Shapes";

const guiHelper = { impactX: 0, impactY: -0.1, impactZ: 0, force: 0.2, radius: 0.4, directionX: 0, directionY: 1, directionZ: 0 };

interface DestructibleBlockProps {
  position: Vector3Like;
  size: Vector3Like;
  detail: number;
}

// TODO: Change to destructible object later and have multiple shapes
export class DestructibleBlock extends BetterObject3D {
  size: Vector3Like;
  detail: number;
  blockVertices: number[];
  blockIndices: number[];
  mainMesh: Mesh;
  boundingBox: Box3;
  collider: RAPIER.Collider;
  constructor({ position, size, detail }: DestructibleBlockProps) {
    super();
    this.position.set(position.x, position.y, position.z);
    this.size = size;
    this.detail = detail;
    const { geometry, vertices, indices } = createCustomBoxGeometry(size, detail);
    this.blockIndices = indices;
    geometry.computeBoundingBox();
    this.boundingBox = geometry.boundingBox!;
    this.blockVertices = vertices;
    const material = new MeshStandardMaterial({
      color: 0xf0e050,
      metalness: 0.7,
      roughness: 0.4,
      // map: generateNoiseTexture(500, 500)
    });
    material.side = DoubleSide;
    material.flatShading = true;
    material.needsUpdate = true;
    // material.wireframe = true;
    const mesh = new Mesh(geometry, material);
    this.add(mesh);
    this.mainMesh = mesh;
    this.rigidBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(position.x, position.y, position.z));
    this.collider = world.createCollider(createTrimeshColiderForMesh(mesh), this.rigidBody);

    gui.add(guiHelper, "impactX", -2, 2);
    gui.add(guiHelper, "impactY", -2, 2);
    gui.add(guiHelper, "impactZ", -2, 2);
    gui.add(guiHelper, "force", 0, 10);
    gui.add(guiHelper, "radius", 0, 1);
    gui.add(guiHelper, "directionX", -1, 1);
    gui.add(guiHelper, "directionY", -1, 1);
    gui.add(guiHelper, "directionZ", -1, 1);
    gui.add({ impact: () => this.impact(guiHelper) }, "impact");
    gui.add(material, "flatShading").onChange(() => (material.needsUpdate = true));
    gui.add(material, "wireframe").onChange(() => (material.needsUpdate = true));
    gui.add(material, "metalness", 0, 1).onChange(() => (material.needsUpdate = true));
    gui.add(material, "roughness", 0, 1).onChange(() => (material.needsUpdate = true));
    gui.add(material.color, "r", 0, 1).onChange(() => (material.needsUpdate = true));
    gui.add(material.color, "g", 0, 1).onChange(() => (material.needsUpdate = true));
    gui.add(material.color, "b", 0, 1).onChange(() => (material.needsUpdate = true));
  }

  updateColiderShape() {
    this.collider.setShape(new TriMesh(new Float32Array(this.blockVertices), new Uint32Array(this.blockIndices)));
  }

  impact({ impactX, impactY, impactZ, force, radius, directionX, directionY, directionZ }: typeof guiHelper) {
    const impactPosition = new Vector3(impactX, impactY, impactZ);
    debugRigidBody(new Vector3(impactX, impactY, impactZ).add(this.position), "impact", 0, radius);
    const reuseableVector = new Vector3();
    const startingIndiciesToCheck = new Set<number>();
    for (let i = 0; i < this.blockVertices.length; i += 3) {
      reuseableVector.set(this.blockVertices[i], this.blockVertices[i + 1], this.blockVertices[i + 2]);
      const distance = reuseableVector.distanceTo(impactPosition);
      if (distance < radius) {
        const dentForce = toRange(distance, { min: 0, max: radius }, { min: force, max: 0 });
        const dent = new Vector3(directionX, directionY, directionZ)
          .normalize()
          .multiplyScalar(dentForce)
          .clampLength(0, radius - distance);
        reuseableVector.add(dent);
        if (this.isOutSideOfBoundingBox(reuseableVector)) {
          const startingIndicies = this.getStartingIndicesForVertexI(i / 3);
          for (const startingIndex of startingIndicies) {
            startingIndiciesToCheck.add(startingIndex);
          }
        }
        this.blockVertices[i] = reuseableVector.x;
        this.blockVertices[i + 1] = reuseableVector.y;
        this.blockVertices[i + 2] = reuseableVector.z;
      }
    }
    const indicesToRemove = Array.from(startingIndiciesToCheck).filter((startingIndex) => {
      const vertices = this.getVerticesForStartingIndex(startingIndex);
      if (vertices.every(([x, y, z]) => this.isOutSideOfBoundingBox({ x, y, z }))) {
        return true;
      }
    });
    indicesToRemove.sort((a, b) => b - a);
    indicesToRemove.forEach((index) => {
      this.blockIndices.splice(index, 3);
    });

    this.mainMesh.geometry.setAttribute("position", new BufferAttribute(new Float32Array(this.blockVertices), 3));
    if (indicesToRemove.length > 0) {
      this.mainMesh.geometry.setIndex(new BufferAttribute(new Uint16Array(this.blockIndices), 1));
    }
    this.mainMesh.geometry.computeVertexNormals();
    this.updateColiderShape();
  }

  getStartingIndicesForVertexI(vertexIndex: number) {
    const startingIndex = [];
    for (let i = 0; i < this.blockIndices.length; i += 3) {
      if (this.blockIndices[i] === vertexIndex || this.blockIndices[i + 1] === vertexIndex || this.blockIndices[i + 2] === vertexIndex) {
        startingIndex.push(i);
      }
    }
    return startingIndex;
  }

  getVerticesForStartingIndex(startIndex: number) {
    const indices = this.blockIndices;
    const positions = this.blockVertices;

    // Get the indices of the triangle's vertices
    const aIndex = indices[startIndex];
    const bIndex = indices[startIndex + 1];
    const cIndex = indices[startIndex + 2];

    // Retrieve the 3D positions (x, y, z) for each vertex
    const aVertex = [positions[aIndex * 3], positions[aIndex * 3 + 1], positions[aIndex * 3 + 2]];

    const bVertex = [positions[bIndex * 3], positions[bIndex * 3 + 1], positions[bIndex * 3 + 2]];

    const cVertex = [positions[cIndex * 3], positions[cIndex * 3 + 1], positions[cIndex * 3 + 2]];

    // Return an array containing the three vertices of the triangle
    return [aVertex, bVertex, cVertex];
  }

  clampToBoundingBox(position: Vector3) {
    const { min, max } = this.boundingBox;
    position.x = clamp(position.x, min.x, max.x);
    position.y = clamp(position.y, min.y, max.y);
    position.z = clamp(position.z, min.z, max.z);
  }

  isOutSideOfBoundingBox(position: Vector3Like) {
    const { min, max } = this.boundingBox;
    return position.x < min.x || position.x > max.x || position.y < min.y || position.y > max.y || position.z < min.z || position.z > max.z;
  }
}

function createCustomBoxGeometry(size: Vector3Like, detail = 1) {
  const width = size.x;
  const height = size.y;
  const depth = size.z;
  const geometry = new BufferGeometry();

  const detailX = Math.max(1, detail);
  const detailY = Math.max(1, detail);
  const detailZ = Math.max(1, detail);

  const vertices: number[] = [];
  const indices: number[] = [];
  const uvs: number[] = []; // uvs for texture mapping

  function buildPlane(u: number, v: number, w: number, uDir: number, vDir: number, width: number, height: number, depth: number, gridX: number, gridY: number) {
    const segmentWidth = width / gridX;
    const segmentHeight = height / gridY;

    const gridX1 = gridX + 1;
    const gridY1 = gridY + 1;

    const offset = vertices.length / 3;

    for (let iy = 0; iy < gridY1; iy++) {
      const y = iy * segmentHeight - height / 2;
      for (let ix = 0; ix < gridX1; ix++) {
        const x = ix * segmentWidth - width / 2;

        const vertex = [0, 0, 0];
        vertex[u] = x * uDir;
        vertex[v] = y * vDir;
        vertex[w] = depth / 2;

        vertices.push(...vertex);
        uvs.push(ix / gridX, 1 - iy / gridY);
      }
    }

    for (let iy = 0; iy < gridY; iy++) {
      for (let ix = 0; ix < gridX; ix++) {
        const a = offset + ix + gridX1 * iy;
        const b = offset + ix + gridX1 * (iy + 1);
        const c = offset + (ix + 1) + gridX1 * (iy + 1);
        const d = offset + (ix + 1) + gridX1 * iy;

        indices.push(a, b, d);
        indices.push(b, c, d);
      }
    }
  }

  // Generate the six sides of the box
  buildPlane(0, 1, 2, 1, -1, width, height, depth, detailX, detailY);
  buildPlane(0, 1, 2, 1, 1, width, height, -depth, detailX, detailY);
  buildPlane(2, 1, 0, -1, 1, depth, height, -width, detailZ, detailY);
  buildPlane(2, 1, 0, 1, 1, depth, height, width, detailZ, detailY);
  buildPlane(0, 2, 1, 1, 1, width, depth, height, detailX, detailZ);
  buildPlane(0, 2, 1, 1, -1, width, depth, -height, detailX, detailZ);

  // Convert vertices and indices to typed arrays
  const verticesArray = new Float32Array(vertices);
  const indicesArray = new Uint16Array(indices);
  const uvsArray = new Float32Array(uvs);

  // Set the geometry attributes
  geometry.setAttribute("position", new BufferAttribute(verticesArray, 3));
  geometry.setIndex(new BufferAttribute(indicesArray, 1));
  geometry.setAttribute("uv", new BufferAttribute(uvsArray, 2));

  // Compute the normals
  geometry.computeVertexNormals();

  return { geometry, vertices, indices };
}
