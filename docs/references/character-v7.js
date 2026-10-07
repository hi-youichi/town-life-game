import * as THREE from 'https://esm.sh/three@0.180.0';
import { mergeGeometries } from 'https://esm.sh/three@0.180.0/examples/jsm/utils/BufferGeometryUtils.js';

// Small geometry-built character: no model/texture downloads or extra render passes.
export function createCharacter() {
  const walker = new THREE.Group();
  walker.name = 'town-walker';
  const material = (color, roughness = .85) => new THREE.MeshStandardMaterial({ color, roughness });
  const m = {
    skin: material(0xf2bb91), blush: material(0xe99b82), hair: material(0x49352e),
    coat: material(0xd96740), trim: material(0xb84c30), cream: material(0xf4e6cb),
    pants: material(0x3c5966), shoes: material(0x30454b), pack: material(0x648d83),
    eyes: material(0x302824, .5), shine: material(0xfffaf0, .35),
  };
  const sphere = new THREE.SphereGeometry(1, 16, 12);
  const capsule = new THREE.CapsuleGeometry(1, 1, 4, 12);
  const sources = [sphere, capsule];
  function part(parent, geometry, mat, position, scale = [1, 1, 1], rotation = [0, 0, 0]) {
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.position.fromArray(position); mesh.scale.fromArray(scale); mesh.rotation.fromArray(rotation);
    parent.add(mesh);
    return mesh;
  }
  const ball = (parent, mat, position, scale, rotation) => part(parent, sphere, mat, position, scale, rotation);
  // Bake static details by material within each joint; articulation stays independent.
  function batch(group) {
    const batches = new Map();
    for (const mesh of [...group.children]) {
      if (!mesh.isMesh) continue;
      mesh.updateMatrix();
      if (!batches.has(mesh.material)) batches.set(mesh.material, []);
      batches.get(mesh.material).push(mesh.geometry.clone().applyMatrix4(mesh.matrix));
      group.remove(mesh);
    }
    for (const [mat, geometries] of batches) {
      const mesh = new THREE.Mesh(mergeGeometries(geometries), mat);
      mesh.castShadow = true; mesh.receiveShadow = true;
      group.add(mesh);
      geometries.forEach(geometry => geometry.dispose());
    }
  }

  const body = new THREE.Group();
  body.position.y = .67; walker.add(body);
  part(body, capsule, m.coat, [0, .025, 0], [.205, .205, .155]);
  ball(body, m.pants, [0, -.205, 0], [.177, .09, .132]);
  // A cream collar, zipper, pockets and hem read clearly even at game scale.
  ball(body, m.cream, [0, .262, .04], [.095, .045, .1]);
  part(body, capsule, m.trim, [0, .015, .151], [.008, .125, .008]);
  ball(body, m.cream, [0, .169, .168], [.012, .024, .009]);
  for (const side of [-1, 1]) {
    part(body, capsule, m.trim, [side * .108, -.075, .138], [.045, .023, .01], [0, 0, side * -.18]);
    part(body, capsule, m.cream, [side * .146, .14, .122], [.015, .085, .012], [0, 0, side * .1]);
  }
  ball(body, m.trim, [0, -.227, 0], [.184, .025, .14]);
  // Backpack sits behind the torso and has a separate flap and carry handle.
  part(body, capsule, m.pack, [0, .07, -.183], [.156, .123, .075]);
  ball(body, m.pants, [0, .14, -.249], [.128, .063, .023]);
  ball(body, m.cream, [0, .1, -.275], [.02, .034, .01]);
  ball(body, m.pack, [0, .249, -.18], [.05, .032, .025]);

  const head = new THREE.Group(); head.position.set(0, .505, 0); body.add(head);
  ball(head, m.skin, [0, 0, 0], [.238, .252, .207]);
  ball(head, m.skin, [0, -.236, 0], [.065, .055, .065]);
  for (const side of [-1, 1]) {
    ball(head, m.skin, [side * .233, -.018, -.004], [.045, .068, .047]);
    ball(head, m.blush, [side * .254, -.015, .024], [.016, .033, .013]);
    ball(head, m.blush, [side * .125, -.072, .172], [.038, .02, .012]);
    part(head, capsule, m.hair, [side * .077, .067, .193], [.035, .007, .006], [0, 0, side * -.11]);
  }
  const hairCap = new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, 1.62);
  sources.push(hairCap);
  part(head, hairCap, m.hair, [0, .015, -.015], [.25, .265, .218], [-.18, 0, 0]);
  // Swept fringe instead of a featureless spherical head.
  ball(head, m.hair, [-.107, .155, .162], [.113, .062, .07], [0, 0, -.36]);
  ball(head, m.hair, [.015, .187, .16], [.11, .062, .072], [0, 0, -.28]);
  ball(head, m.hair, [.127, .142, .145], [.061, .083, .052], [0, 0, .24]);
  ball(head, m.skin, [0, -.021, .206], [.032, .037, .038]);
  const smilePoints = Array.from({ length: 13 }, (_, i) => {
    const x = (i / 12 - .5) * .087;
    return new THREE.Vector3(x, -.121 + (x / .0435) ** 2 * .023, .181 - (x / .0435) ** 2 * .005);
  });
  const smile = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(smilePoints), 12, .005, 5, false);
  sources.push(smile); part(head, smile, m.hair, [0, 0, 0]);
  const eyes = new THREE.Group(); head.add(eyes);
  for (const side of [-1, 1]) {
    ball(eyes, m.eyes, [side * .077, .016, .195], [.022, .03, .013]);
    ball(eyes, m.shine, [side * .077 - .006, .026, .206], [.006, .007, .003]);
  }

  function arm(side) {
    const joint = new THREE.Group(); joint.position.set(side * .229, .205, 0); body.add(joint);
    part(joint, capsule, m.coat, [side * .025, -.115, 0], [.07, .105, .067], [0, 0, side * .1]);
    ball(joint, m.cream, [side * .043, -.245, .005], [.059, .025, .058]);
    ball(joint, m.skin, [side * .046, -.286, .012], [.058, .069, .052]);
    joint.rotation.z = side * .08; batch(joint); return joint;
  }
  const leftArm = arm(-1), rightArm = arm(1);
  function leg(side) {
    const joint = new THREE.Group(); joint.position.set(side * .1, .435, 0); walker.add(joint);
    part(joint, capsule, m.pants, [0, -.151, 0], [.078, .105, .073]);
    ball(joint, m.shoes, [0, -.348, .043], [.092, .074, .139]);
    ball(joint, m.cream, [0, -.39, .047], [.095, .028, .144]);
    ball(joint, m.cream, [0, -.324, .111], [.053, .018, .04]);
    batch(joint); return joint;
  }
  const leftLeg = leg(-1), rightLeg = leg(1);
  batch(eyes); batch(head); batch(body);
  sources.forEach(geometry => geometry.dispose());
  let moving = false, phase = 0, stride = 0;
  const rigClock = new THREE.Clock();
  return {
    walker,
    setGait(nextPhase, walking) { phase = nextPhase; moving = walking; },
    update(time) {
      const delta = Math.min(rigClock.getDelta(), .05);
      stride = THREE.MathUtils.damp(stride, moving ? 1 : 0, 14, delta);
      const swing = Math.sin(phase) * stride;
      leftLeg.rotation.x = swing * .48; rightLeg.rotation.x = -swing * .48;
      leftArm.rotation.x = -swing * .38; rightArm.rotation.x = swing * .38;
      body.position.y = .67 + Math.abs(Math.cos(phase * 2)) * .018 * stride + Math.sin(time * 2.3) * .005 * (1 - stride);
      body.rotation.z = swing * .018;
      head.rotation.y = Math.sin(time * .75) * .025 * (1 - stride);
      // A short blink every few seconds; scale the eye group, not the face.
      const blink = time % 4.7;
      eyes.scale.y = blink < .14 ? Math.max(.08, Math.abs(blink - .07) / .07) : 1;
    },
    diagnostics() {
      let meshes = 0, triangles = 0;
      walker.traverse(object => { if (object.isMesh) { meshes++; triangles += object.geometry.index ? object.geometry.index.count / 3 : object.geometry.attributes.position.count / 3; } });
      return { meshes, triangles, moving, stride };
    },
  };
}
