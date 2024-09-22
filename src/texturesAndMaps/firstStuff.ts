import { DataTexture, RedFormat } from "three";

export function generateGradientMap() {
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

export function generateGrassBumpMap(sizeX: number, sizeY: number, grassHeight = 255) {
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

export function generateBricksMap(sizeX: number, sizeY: number, brickDepth = 255, brickWidth = 12, brickHeight = 7, mortarWidth = 1) {
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

export function generateBricksTexture(sizeX: number, sizeY: number, brickWidth = 12, brickHeight = 7, mortarWidth = 1) {
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
