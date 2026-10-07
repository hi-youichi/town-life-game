import * as THREE from 'https://esm.sh/three@0.180.0';
import { signalState } from './traffic-rules.js';

export function createTrafficSignals(scene, streets) {
  const fixtures = [];
  for (const x of streets) for (const z of streets) {
    for (const direction of [-1, 1]) {
      fixtures.push({ x: x - direction * 1.8, z: z - direction * 1.65,
        angle: -direction * Math.PI / 2, axis: 'x' });
      fixtures.push({ x: x + direction * 1.65, z: z - direction * 1.8,
        angle: direction > 0 ? Math.PI : 0, axis: 'z' });
    }
  }
  const dummy = new THREE.Object3D();
  function batch(geometry, material, records, y, offset = 0) {
    const mesh = new THREE.InstancedMesh(geometry, material, records.length);
    records.forEach((record, index) => {
      dummy.position.set(record.x + Math.sin(record.angle) * offset, y,
        record.z + Math.cos(record.angle) * offset);
      dummy.rotation.set(0, record.angle, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.computeBoundingSphere();
    scene.add(mesh);
    return mesh;
  }
  const metal = new THREE.MeshStandardMaterial({ color: 0x4a5658, roughness: .65, metalness: .35 });
  batch(new THREE.CylinderGeometry(.032, .05, 1.5, 8), metal, fixtures, .75);
  batch(new THREE.BoxGeometry(.23, .65, .18), metal, fixtures, 1.8);
  const lamps = [];
  for (const axis of ['x', 'z']) {
    ['red', 'yellow', 'green'].forEach((color, index) => {
      const value = { red: 0xff4438, yellow: 0xffca38, green: 0x40ef83 }[color];
      const material = new THREE.MeshStandardMaterial({ color: value, emissive: value, roughness: .35 });
      const geometry = new THREE.CylinderGeometry(.075, .075, .028, 12);
      geometry.rotateX(Math.PI / 2);
      batch(geometry, material, fixtures.filter(record => record.axis === axis), 2.005 - index * .2, .105);
      lamps.push({ axis, color, material, value });
    });
  }
  const marks = [];
  for (const x of streets) for (const z of streets) for (const direction of [-1, 1]) {
    marks.push({ x: x - direction * 2.25, z: z - direction * .65, angle: Math.PI / 2 });
    marks.push({ x: x + direction * .65, z: z - direction * 2.25, angle: 0 });
  }
  batch(new THREE.BoxGeometry(1.02, .018, .075),
    new THREE.MeshStandardMaterial({ color: 0xdcdacd, roughness: 1 }), marks, .055);
  let previous;
  function update(time) {
    const state = signalState(time);
    const key = `${state.x}/${state.z}`;
    if (key !== previous) {
      for (const lamp of lamps) {
        const active = state[lamp.axis] === lamp.color;
        lamp.material.color.set(active ? lamp.value : 0x26332d);
        lamp.material.emissiveIntensity = active ? 1.6 : 0;
      }
      previous = key;
    }
    return state;
  }
  update(0);
  return { update, count: streets.length ** 2 };
}
