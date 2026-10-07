import * as THREE from 'https://esm.sh/three@0.180.0';
import { mergeGeometries } from 'https://esm.sh/three@0.180.0/examples/jsm/utils/BufferGeometryUtils.js';

export function createHouse(m) {
  const house = new THREE.Group();
  const solid = new THREE.Group();
  house.add(solid);
  function box(parent, w, h, d, material, x, y, z, decoration = false) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), material);
    mesh.position.set(x,y,z);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.userData.decoration = decoration;
    parent.add(mesh);
    return mesh;
  }
  box(solid,3.6,2.5,.12,m.wall,0,1.25,-1.24);
  // 外墙实际挖出窗洞，玻璃位于墙体厚度内，框与窗沿形成遮蔽。
  for(const side of [-1,1]) {
    box(solid,.1,1.12,2.6,m.wall,side*1.75,.56,0);
    box(solid,.1,.48,2.6,m.wall,side*1.75,2.26,0);
    box(solid,.1,.9,.585,m.wall,side*1.75,1.57,-1.0075);
    box(solid,.1,.9,1.085,m.wall,side*1.75,1.57,.7575);
    box(solid,1.375,1.12,.12,m.wall,side*1.1125,.56,1.24);
    box(solid,1.375,.48,.12,m.wall,side*1.1125,2.26,1.24);
    box(solid,.12,.9,.12,m.wall,side*1.74,1.57,1.24);
    box(solid,.395,.9,.12,m.wall,side*.6225,1.57,1.24);
  }
  box(solid,.85,.8,.12,m.wall,0,2.1,1.24);
  const floor = box(solid,3.4,.04,2.4,m.stone,0,.025,0);
  floor.name = 'interior-floor';
  // 地基沿墙布置，保留门洞；台阶不会遮挡第一人称路线。
  box(solid,3.7,.13,.16,m.stone,0,.075,-1.26);
  for (const x of [-1.77,1.77]) box(solid,.15,.13,2.6,m.stone,x,.075,0);
  for (const x of [-1.14,1.14]) box(solid,1.3,.13,.16,m.stone,x,.075,1.26);
  box(solid,1.05,.08,.62,m.stone,0,.04,1.59,true);
  box(solid,.88,.055,.18,m.trim,0,.07,1.37,true);
  for(const x of [-.35,.35]) box(solid,.008,.012,.46,m.joint,x,.084,1.62,true);
  box(solid,4.6,.1,3.4,m.trim,0,2.48,0);

  const roof = new THREE.Group();
  roof.name = 'house-roof';
  roof.position.y = 2.53;
  house.add(roof);
  // 四坡屋顶，顶脊沿 X 轴；四个坡面均有独立展开的 UV。
  const a = [-2.3,0,-1.7], b = [2.3,0,-1.7], c = [2.3,0,1.7], d = [-2.3,0,1.7];
  const l = [-.55,1.45,0], r = [.55,1.45,0];
  const positions = [], uvs = [];
  for (const face of [[a,b,r,l],[b,c,r],[c,d,l,r],[d,a,l]]) {
    const origin = new THREE.Vector3(...face[0]);
    const along = new THREE.Vector3(...face[1]).sub(origin).normalize();
    const edge = new THREE.Vector3(...face[2]).sub(origin);
    const slope = edge.clone().addScaledVector(along,-edge.dot(along)).normalize();
    for (let i = 1; i < face.length - 1; i++) {
      const triangle = [face[0],face[i],face[i+1]];
      const normal = new THREE.Vector3(...triangle[1]).sub(new THREE.Vector3(...triangle[0]))
        .cross(new THREE.Vector3(...triangle[2]).sub(new THREE.Vector3(...triangle[0])));
      if (normal.y < 0) [triangle[1],triangle[2]] = [triangle[2],triangle[1]];
      for (const v of triangle) {
        positions.push(...v);
        const offset = new THREE.Vector3(...v).sub(origin);
        uvs.push(offset.dot(along)/2.4, offset.dot(slope)/2.4);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.computeVertexNormals();
  const skin = new THREE.Mesh(geometry,m.roof);
  skin.castShadow = skin.receiveShadow = true;
  roof.add(skin);
  function beam(parent, start, end, radius, material) {
    const p = new THREE.Vector3(...start), q = new THREE.Vector3(...end);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,p.distanceTo(q),6),material);
    mesh.position.copy(p).add(q).multiplyScalar(.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),q.sub(p).normalize());
    mesh.castShadow = true;
    parent.add(mesh);
  }
  for (const [p,q] of [[l,r],[a,l],[d,l],[b,r],[c,r]]) beam(roof,p,q,.085,m.ridge);
  for (const z of [-1.73,1.73]) box(roof,4.62,.055,.07,m.trim,0,-.01,z);
  for (const x of [-2.33,2.33]) box(roof,.07,.055,3.5,m.trim,x,-.01,0);
  // 雨水管固定在外墙，屋顶分组隐藏时只移除檐口与顶脊。
  for (const x of [-1.71,1.71]) box(solid,.045,2.35,.055,m.trim,x,1.25,-1.34,true);

  const door = new THREE.Group();
  door.name = 'house-door'; door.position.set(-.425,0,1.3); house.add(door);
  box(door,.85,1.7,.08,m.door,.425,.85,0);
  for (const y of [.43,1.17]) {
    box(door,.66,.59,.012,m.doorInset,.425,y,.045);
    box(door,.58,.51,.014,m.door,.425,y,.054);
  }
  const handle = new THREE.Mesh(new THREE.SphereGeometry(.045,8,6),m.metal);
  handle.position.set(.73,.85,.075); door.add(handle);
  box(door,.07,.16,.012,m.metal,.73,.85,.044);
  for (const x of [-.47,.47]) box(solid,.065,1.8,.13,m.trim,x,.9,1.32);
  box(solid,1.02,.08,.13,m.trim,0,1.76,1.32);

  for (const x of [-1.25,1.25]) {
    box(solid,.8,.85,.035,m.glass,x,1.57,1.235);
    for(const dx of [-.405,.405]) box(solid,.025,.87,.14,m.reveal,x+dx,1.57,1.285);
    for(const dy of [-.437,.437]) box(solid,.83,.025,.14,m.reveal,x,1.57+dy,1.285);
    for (const sx of [-.43,.43]) box(solid,.065,.97,.13,m.trim,x+sx,1.57,1.37);
    for (const sy of [-.45,.45]) box(solid,.93,.065,.13,m.trim,x,1.57+sy,1.37);
    box(solid,.035,.87,.08,m.trim,x,1.57,1.32);
    box(solid,.85,.035,.08,m.trim,x,1.57,1.32);
    box(solid,1,.085,.29,m.trim,x,1.09,1.4);
    box(solid,.76,.16,.24,m.pot,x,.96,1.44,true);
    box(solid,.71,.045,.19,m.leaves,x,1.045,1.44,true);
    for (const [index,dx] of [-.28,-.14,0,.14,.28].entries()) {
      const bloomY=1.18+(index%2)*.055;
      box(solid,.025,.14,.025,m.leaves,x+dx,1.1,1.44,true);
      const leaf=new THREE.Mesh(new THREE.SphereGeometry(.065,5,3),m.leaves);
      leaf.position.set(x+dx,1.095,1.46);leaf.scale.set(1,.65,1);leaf.userData.decoration=true;solid.add(leaf);
      for (let i=0;i<5;i++) {
        const petal = new THREE.Mesh(new THREE.SphereGeometry(.036,5,3),m.flower);
        petal.position.set(x+dx+Math.cos(i*Math.PI*2/5)*.037,bloomY,1.44+Math.sin(i*Math.PI*2/5)*.037);
        petal.userData.decoration = true; solid.add(petal);
      }
      const center = new THREE.Mesh(new THREE.SphereGeometry(.026,6,4),m.flowerCenter);
      center.position.set(x+dx,bloomY+.013,1.44); center.userData.decoration = true; solid.add(center);
    }
  }
  // 侧墙补齐窗户，斜俯视时不再出现整面空白墙。
  for (const side of [-1,1]) {
    const x=side*1.825,z=-.25;
    box(solid,.035,.85,.8,m.glass,side*1.755,1.57,z);
    for(const dz of [-.405,.405]) box(solid,.14,.87,.025,m.reveal,side*1.805,1.57,z+dz);
    for(const dy of [-.437,.437]) box(solid,.14,.025,.83,m.reveal,side*1.805,1.57+dy,z);
    for(const dz of [-.43,.43]) box(solid,.13,.97,.065,m.trim,x,1.57,z+dz);
    for(const dy of [-.45,.45]) box(solid,.13,.065,.93,m.trim,x,1.57+dy,z);
    box(solid,.08,.87,.035,m.trim,side*1.82,1.57,z);
    box(solid,.08,.035,.85,m.trim,side*1.82,1.57,z);
    box(solid,.29,.085,1,m.trim,x,1.09,z);
  }
  // 静态部件按材质合并，装饰独立批次，不参与房屋点击。
  mergeStatic(solid);
  mergeStatic(roof);
  mergeStatic(door);
  house.scale.set(1.55,1.4,1.55);
  return house;
}

function mergeStatic(group) {
  const batches = new Map();
  for (const mesh of [...group.children]) {
    if (!mesh.isMesh) continue;
    // 合并要求几何的索引形式一致，花箱中的盒体与多面体需分批。
    const key = `${mesh.material.uuid}:${!!mesh.userData.decoration}:${!!mesh.geometry.index}`;
    if (!batches.has(key)) batches.set(key,{material:mesh.material,decoration:!!mesh.userData.decoration,geometries:[]});
    mesh.updateMatrix();
    batches.get(key).geometries.push(mesh.geometry.clone().applyMatrix4(mesh.matrix));
    mesh.geometry.dispose(); group.remove(mesh);
  }
  for (const batch of batches.values()) {
    const geometry = mergeGeometries(batch.geometries,false);
    for (const source of batch.geometries) source.dispose();
    const mesh = new THREE.Mesh(geometry,batch.material);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.userData.decoration = batch.decoration;
    group.add(mesh);
  }
}
