"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";

function makeShemaghTexture() {
  const size = 256;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const cellX = Math.floor(x / 32);
      const cellY = Math.floor(y / 32);
      const inRedCheck = (cellX + cellY) % 2 === 0;
      const gridLine = x % 32 < 3 || y % 32 < 3;
      const diagonal = Math.abs((x + y) % 32 - 16) < 2 || Math.abs((x - y + 512) % 32 - 16) < 2;
      const red = gridLine || (inRedCheck && diagonal);
      const offset = (y * size + x) * 4;
      data[offset] = red ? 174 : 246;
      data[offset + 1] = red ? 35 : 242;
      data[offset + 2] = red ? 42 : 235;
      data[offset + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

function addShapePanel(
  group: THREE.Group,
  points: Array<[number, number]>,
  position: THREE.Vector3,
  material: THREE.Material,
) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  points.slice(1).forEach(([x, y]) => shape.lineTo(x, y));
  shape.closePath();
  const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), material);
  mesh.position.copy(position);
  group.add(mesh);
  return mesh;
}

function makeClothPanel(width: number, height: number, material: THREE.Material) {
  const geometry = new THREE.PlaneGeometry(width, height, 10, 18);
  const positions = geometry.attributes.position;
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const u = (x / width) + 0.5;
    const v = (y / height) + 0.5;
    positions.setZ(index, Math.sin(u * Math.PI * 5) * 0.006 + Math.sin(v * Math.PI * 4) * 0.004);
  }
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  return mesh;
}

type SourceBounds = {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
};

type SourceModel = {
  updateMatrixWorld: (force?: boolean) => void;
  traverse: (callback: (object: {
    isMesh?: boolean;
    geometry?: {
      boundingBox: SourceBounds | null;
      computeBoundingBox: () => void;
    };
    matrixWorld?: unknown;
  }) => void) => void;
};

function buildSaudiDoctorAttire(modelValue: unknown) {
  const model = modelValue as SourceModel;
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3();
  model.traverse((object) => {
    if (!object.isMesh || !object.geometry) return;
    if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
    const sourceBounds = object.geometry.boundingBox;
    if (!sourceBounds || !object.matrixWorld) return;
    const matrix = object.matrixWorld as THREE.Matrix4;
    for (const x of [sourceBounds.min.x, sourceBounds.max.x]) {
      for (const y of [sourceBounds.min.y, sourceBounds.max.y]) {
        for (const z of [sourceBounds.min.z, sourceBounds.max.z]) {
          bounds.expandByPoint(new THREE.Vector3(x, y, z).applyMatrix4(matrix));
        }
      }
    }
  });
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const height = Math.max(size.y, 1.35);
  const baseY = bounds.min.y + height * 0.018;
  const robeHeight = height * 0.765;
  const frontZ = center.z + Math.max(size.z * 0.48, height * 0.145);
  const group = new THREE.Group();
  group.name = "SCD01_Saudi_Doctor_Attire";
  const sleeveMeshes: Array<{ side: number; mesh: THREE.Mesh }> = [];
  const cuffMeshes: Array<{ side: number; mesh: THREE.Mesh }> = [];
  const headMeshes: THREE.Mesh[] = [];
  const attachedMeshes: THREE.Mesh[] = [];
  group.userData.attachedMeshes = attachedMeshes;

  const thobeMaterial = new THREE.MeshStandardMaterial({
    color: "#f5f6f2",
    roughness: 0.94,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  const coatMaterial = new THREE.MeshStandardMaterial({
    color: "#e9efed",
    roughness: 0.9,
    side: THREE.DoubleSide,
  });
  const trimMaterial = new THREE.MeshStandardMaterial({
    color: "#74b9ae",
    roughness: 0.65,
    metalness: 0.08,
  });
  const darkMaterial = new THREE.MeshStandardMaterial({ color: "#222629", roughness: 0.76 });
  const badgeMaterial = new THREE.MeshStandardMaterial({ color: "#d9e7e4", roughness: 0.7 });
  const shemaghTexture = makeShemaghTexture();
  const shemaghMaterial = new THREE.MeshStandardMaterial({
    map: shemaghTexture,
    roughness: 1,
    side: THREE.DoubleSide,
  });

  // Long Saudi thobe: a flared, full-length fabric shell that covers the source suit.
  const thobeProfile = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(height * 0.205, 0),
    new THREE.Vector2(height * 0.218, robeHeight * 0.09),
    new THREE.Vector2(height * 0.178, robeHeight * 0.36),
    new THREE.Vector2(height * 0.142, robeHeight * 0.66),
    new THREE.Vector2(height * 0.15, robeHeight * 0.91),
    new THREE.Vector2(height * 0.105, robeHeight),
    new THREE.Vector2(0, robeHeight),
  ];
  const thobe = new THREE.Mesh(new THREE.LatheGeometry(thobeProfile, 56), thobeMaterial);
  thobe.position.set(center.x, baseY, center.z);
  thobe.scale.z = 0.82;
  thobe.castShadow = true;
  thobe.receiveShadow = true;
  group.add(thobe);

  // Sleeves and cuffs are shaped as real geometry, not a recolour of the business suit.
  [-1, 1].forEach((side) => {
    const sleeve = new THREE.Mesh(
      new THREE.CylinderGeometry(height * 0.064, height * 0.052, height * 0.34, 24, 2, false),
      thobeMaterial,
    );
    sleeve.position.set(center.x + side * height * 0.185, baseY + height * 0.605, center.z);
    sleeve.rotation.z = side * -0.31;
    sleeve.castShadow = true;
    group.add(sleeve);
    sleeveMeshes.push({ side, mesh: sleeve });

    const cuff = new THREE.Mesh(
      new THREE.CylinderGeometry(height * 0.054, height * 0.054, height * 0.025, 24, 1, true),
      coatMaterial,
    );
    cuff.position.set(center.x + side * height * 0.236, baseY + height * 0.45, center.z);
    cuff.rotation.z = side * -0.31;
    group.add(cuff);
    cuffMeshes.push({ side, mesh: cuff });
  });

  // Thobe collar, front placket and small buttons.
  const collar = new THREE.Mesh(
    new THREE.TorusGeometry(height * 0.071, height * 0.009, 8, 36),
    coatMaterial,
  );
  collar.rotation.x = Math.PI / 2;
  collar.position.set(center.x, baseY + robeHeight * 0.985, center.z + height * 0.012);
  group.add(collar);

  const placket = new THREE.Mesh(
    new THREE.BoxGeometry(height * 0.018, robeHeight * 0.31, height * 0.009),
    coatMaterial,
  );
  placket.position.set(center.x, baseY + robeHeight * 0.79, frontZ * 0.985 + center.z * 0.015);
  group.add(placket);

  for (let index = 0; index < 4; index += 1) {
    const button = new THREE.Mesh(
      new THREE.SphereGeometry(height * 0.006, 10, 8),
      trimMaterial,
    );
    button.position.set(center.x, baseY + robeHeight * (0.91 - index * 0.055), frontZ + height * 0.008);
    group.add(button);
  }

  // Open white clinical coat layered over the thobe, with lapels and an identification badge.
  const coatTop = baseY + robeHeight * 0.91;
  const coatBottom = baseY + height * 0.39;
  const panelHeight = coatTop - coatBottom;
  [-1, 1].forEach((side) => {
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(height * 0.125, panelHeight, height * 0.018),
      coatMaterial,
    );
    panel.position.set(center.x + side * height * 0.078, (coatTop + coatBottom) / 2, frontZ + height * 0.012);
    panel.castShadow = true;
    group.add(panel);

    const lapel = addShapePanel(
      group,
      side < 0
        ? [[-height * 0.055, 0], [height * 0.012, -height * 0.16], [height * 0.012, height * 0.08], [-height * 0.06, height * 0.17]]
        : [[height * 0.055, 0], [-height * 0.012, -height * 0.16], [-height * 0.012, height * 0.08], [height * 0.06, height * 0.17]],
      new THREE.Vector3(center.x + side * height * 0.045, coatTop - height * 0.025, frontZ + height * 0.025),
      coatMaterial,
    );
    lapel.material = coatMaterial;
    group.add(lapel);

    const pocket = new THREE.Mesh(
      new THREE.BoxGeometry(height * 0.07, height * 0.065, height * 0.006),
      badgeMaterial,
    );
    pocket.position.set(center.x + side * height * 0.08, coatBottom + panelHeight * 0.46, frontZ + height * 0.026);
    group.add(pocket);
  });

  const badge = new THREE.Mesh(
    new THREE.BoxGeometry(height * 0.075, height * 0.055, height * 0.012),
    trimMaterial,
  );
  badge.position.set(center.x + height * 0.105, coatTop - height * 0.15, frontZ + height * 0.03);
  group.add(badge);

  // Stethoscope detail: dark tubing and chest piece over the coat.
  const tubeCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(center.x - height * 0.055, coatTop - height * 0.055, frontZ + height * 0.045),
    new THREE.Vector3(center.x - height * 0.08, coatTop - height * 0.22, frontZ + height * 0.048),
    new THREE.Vector3(center.x - height * 0.045, coatTop - height * 0.31, frontZ + height * 0.05),
    new THREE.Vector3(center.x + height * 0.005, coatTop - height * 0.22, frontZ + height * 0.05),
  ]);
  group.add(new THREE.Mesh(new THREE.TubeGeometry(tubeCurve, 28, height * 0.006, 8, false), darkMaterial));
  const chestPiece = new THREE.Mesh(
    new THREE.CylinderGeometry(height * 0.025, height * 0.025, height * 0.012, 20),
    darkMaterial,
  );
  chestPiece.position.set(center.x + height * 0.005, coatTop - height * 0.31, frontZ + height * 0.05);
  chestPiece.rotation.x = Math.PI / 2;
  group.add(chestPiece);

  // Red-and-white shemagh, draped at both sides, secured by a black agal.
  const headRadius = height * 0.083;
  const headTop = bounds.max.y - height * 0.012;
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(headRadius, 36, 20, 0, Math.PI * 2, 0, Math.PI * 0.64),
    shemaghMaterial,
  );
  cap.position.set(center.x, headTop - headRadius * 0.34, center.z);
  cap.scale.set(1.18, 0.82, 1.04);
  cap.castShadow = true;
  group.add(cap);
  headMeshes.push(cap);

  [-1, 1].forEach((side) => {
    const tail = makeClothPanel(height * 0.17, height * 0.27, shemaghMaterial);
    tail.position.set(center.x + side * height * 0.075, headTop - height * 0.155, center.z + height * 0.018);
    tail.rotation.y = side * 0.17;
    tail.rotation.z = side * -0.07;
    group.add(tail);
    headMeshes.push(tail);
  });

  const agal = new THREE.Mesh(
    new THREE.TorusGeometry(headRadius * 0.91, height * 0.012, 12, 48),
    darkMaterial,
  );
  agal.rotation.x = Math.PI / 2;
  agal.position.set(center.x, headTop - headRadius * 0.49, center.z + height * 0.002);
  agal.castShadow = true;
  group.add(agal);
  headMeshes.push(agal);

  // Parent torso, sleeves and headwear to matching animated bones.
  const modelObject = modelValue as THREE.Object3D;
  const bones: THREE.Bone[] = [];
  modelObject.traverse((object) => {
    if ((object as THREE.Bone).isBone) bones.push(object as THREE.Bone);
  });
  const findBone = (pattern: RegExp) => bones.find((bone) => pattern.test(bone.name));
  const bodyAnchor = findBone(/hips|pelvis/i) ?? findBone(/spine/i);
  modelObject.add(group);
  modelObject.updateMatrixWorld(true);
  if (bodyAnchor) bodyAnchor.attach(group);

  sleeveMeshes.forEach(({ side, mesh }) => {
    const sideName = side > 0 ? "left" : "right";
    const suffix = side > 0 ? "l" : "r";
    const arm = findBone(new RegExp(sideName + ".*(upper.?arm|arm)|(upper.?arm|arm).*" + sideName + "|(upperarm|arm)[._:]?" + suffix + "$|mixamorig:" + sideName + "arm", "i"));
    if (arm) {
      arm.attach(mesh);
      attachedMeshes.push(mesh);
    }
  });

  cuffMeshes.forEach(({ side, mesh }) => {
    const sideName = side > 0 ? "left" : "right";
    const suffix = side > 0 ? "l" : "r";
    const forearm = findBone(new RegExp(sideName + ".*(forearm|lower.?arm)|(forearm|lower.?arm).*" + sideName + "|(forearm|lowerarm)[._:]?" + suffix + "$|mixamorig:" + sideName + "forearm", "i"));
    if (forearm) {
      forearm.attach(mesh);
      attachedMeshes.push(mesh);
    }
  });

  const headBone = findBone(/head$/i);
  if (headBone) headMeshes.forEach((mesh) => {
    headBone.attach(mesh);
    attachedMeshes.push(mesh);
  });

  return group;
}

export function SaudiDoctorAttire({ model }: { model: unknown }) {
  const attire = useMemo(() => buildSaudiDoctorAttire(model), [model]);

  useEffect(() => () => {
    attire.parent?.remove(attire);
    const meshes = new Set<THREE.Mesh>(attire.userData.attachedMeshes as THREE.Mesh[] | undefined);
    attire.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.isMesh) meshes.add(mesh);
    });
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();
    meshes.forEach((mesh) => {
      mesh.parent?.remove(mesh);
      mesh.geometry.dispose();
      (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((material) => {
        materials.add(material);
        if ("map" in material && material.map instanceof THREE.Texture) textures.add(material.map);
      });
    });
    textures.forEach((texture) => texture.dispose());
    materials.forEach((material) => material.dispose());
  }, [attire]);

  // The outfit is attached to the avatar's skeleton in buildSaudiDoctorAttire.
  return null;
}
