import * as THREE from 'https://esm.sh/three@0.180.0';
import { mergeGeometries } from 'https://esm.sh/three@0.180.0/examples/jsm/utils/BufferGeometryUtils.js';
import { createCharacterMaterials } from './character-materials-v8.js';

// Geometry and fabric detail derived from character-refined-concept-v1.png.
export function createCharacter() {
  const walker = new THREE.Group(); walker.name = 'town-walker';
  const m = createCharacterMaterials(), sources = [];
  const keep = geometry => { sources.push(geometry); return geometry; };
  const sphere = keep(new THREE.SphereGeometry(1, 12, 10));
  const smoothSphere = keep(new THREE.SphereGeometry(1, 24, 18));
  const capsule = keep(new THREE.CapsuleGeometry(1, 1, 4, 12));
  const box = keep(new THREE.BoxGeometry(1, 1, 1));
  function part(parent, geometry, material, position, scale = [1, 1, 1], rotation = [0, 0, 0]) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.fromArray(position); mesh.scale.fromArray(scale); mesh.rotation.fromArray(rotation);
    parent.add(mesh); return mesh;
  }
  const ball = (parent, mat, p, s, r) => part(parent, sphere, mat, p, s, r);
  function repairPoleNormals(g) {
    const positions=g.attributes.position,normals=g.attributes.normal;
    const normal=new THREE.Vector3();
    for(let i=0;i<normals.count;i++){
      normal.fromBufferAttribute(normals,i);
      if(normal.lengthSq()<.25){
        normal.fromBufferAttribute(positions,i).normalize();
        if(!normal.lengthSq())normal.set(0,1,0);
        normals.setXYZ(i,normal.x,normal.y,normal.z);
      }
    }
    return g;
  }
  // Smooth elliptical cross sections give jackets and trousers an actual fitted silhouette.
  function form(rings, segments = 20) {
    const positions = [], uvs = [], indices = [];
    for (let j = 0; j < rings.length; j++) {
      const [y, rx, rz, z = 0] = rings[j];
      for (let i = 0; i <= segments; i++) {
        const a = i / segments * Math.PI * 2;
        positions.push(Math.cos(a) * rx, y, Math.sin(a) * rz + z);
        uvs.push(i / segments, j / (rings.length - 1));
        if (j && i < segments) {
          const n = j * (segments + 1) + i, below = n - segments - 1;
          indices.push(below, n, below + 1, n, n + 1, below + 1);
        }
      }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));g.setIndex(indices);g.computeVertexNormals();
    return keep(repairPoleNormals(g));
  }
  function curve(parent, mat, points, radius = .004, segments = 16, radialSegments = 4) {
    const path = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
    return part(parent, keep(new THREE.TubeGeometry(path, segments, radius, radialSegments, false)), mat, [0, 0, 0]);
  }
  function batch(group) {
    const batches = new Map();
    for (const mesh of [...group.children]) {
      if (!mesh.isMesh) continue;
      mesh.updateMatrix();
      if (!batches.has(mesh.material)) batches.set(mesh.material, []);
      batches.get(mesh.material).push(mesh.geometry.clone().applyMatrix4(mesh.matrix));group.remove(mesh);
    }
    for (const [mat, geometries] of batches) {
      const merged = mergeGeometries(geometries);
      if (!merged) throw new Error('Character geometry attributes do not match');
      const mesh = new THREE.Mesh(merged, mat);mesh.castShadow=mat!==m.shine;mesh.receiveShadow=true;group.add(mesh);
      geometries.forEach(g => g.dispose());
    }
  }

  const body = new THREE.Group();body.name='character-upper-body';body.position.y = .69;walker.add(body);
  part(body, form([[-.245,0,0],[-.235,.174,.127],[-.20,.198,.152],[-.08,.208,.16],[.07,.214,.153],[.18,.192,.124],[.232,.12,.089],[.25,0,0]]), m.coat, [0,0,0]);
  // Ribbed hem, short cream collar, inset tee and a fine metallic zipper.
  part(body, form([[-.25,.17,.122],[-.244,.18,.131],[-.222,.19,.14],[-.214,.186,.137]]), m.trim, [0,0,0]);
  ball(body, m.cream, [0,.232,.005], [.102,.048,.086]);
  ball(body, m.sole, [0,.227,.072], [.051,.037,.035]);
  curve(body, m.trim, [[0,-.212,.141],[0,-.12,.164],[0,.03,.159],[0,.17,.122]], .008);
  for (let i = 0; i < 25; i++) {
    const y = -.20 + i * .014, z = .162 - Math.max(0,y-.02)*.23 - Math.max(0,-y-.12)*.21;
    part(body, box, m.metal, [(i%2 ? -1:1)*.0035,y,z], [.009,.006,.004]);
  }
  part(body, capsule, m.sole, [0,.12,.154], [.01,.018,.004]);
  for (const side of [-1,1]) {
    // Raised fabric pocket with a curved opening and a fine stitch border.
    ball(body,m.trim,[side*.119,-.115,.137],[.06,.061,.016],[0,0,side*-.12]);
    curve(body,m.coat,[[side*.067,-.152,.15],[side*.119,-.166,.153],[side*.17,-.142,.13]],.0025,10);
    curve(body,m.trim,[[side*.074,-.083,.159],[side*.115,-.071,.159],[side*.16,-.087,.145]],.006,10);
    // Continuous shoulder strap curves over the jacket to the back of the pack.
    curve(body,m.strap,[[side*.154,-.094,.143],[side*.154,.062,.136],[side*.143,.207,.076],[side*.146,.247,-.014],[side*.154,.19,-.122],[side*.151,-.02,-.212]],.0155,22,6);
    const buckle = new THREE.Group();buckle.position.set(side*.154,.006,.159);body.add(buckle);
    for (const x of [-.02,.02]) part(buckle,box,m.buckle,[x,0,0],[.009,.044,.009]);
    for (const y of [-.019,.019]) part(buckle,box,m.buckle,[0,y,0],[.047,.008,.009]);
    batch(buckle);
  }
  part(body,form([[-.145,0,0],[-.131,.124,.06],[-.08,.152,.078],[.10,.148,.074],[.174,.118,.06],[.188,0,0]],16),m.pack,[0,.025,-.201]);
  ball(body,m.pack,[0,-.047,-.271],[.115,.058,.023]);
  curve(body,m.pants,[[-.093,.072,-.274],[0,.12,-.285],[.093,.072,-.274]],.003,14);
  curve(body,m.strap,[[-.033,.196,-.192],[-.028,.22,-.195],[.028,.22,-.195],[.033,.196,-.192]],.009,12,5);
  ball(body,m.metal,[0,.015,-.299],[.009,.017,.005]);

  const head = new THREE.Group();head.name='character-head';head.position.set(0,.516,0);body.add(head);
  const faceGeometry = keep(smoothSphere.clone());
  const p = faceGeometry.attributes.position, faceColors = [];
  for (let i = 0; i < p.count; i++) {
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
    // A softer jaw and vertex-tinted blush instead of protruding pink spheres.
    p.setX(i,x*(y<0 ? .94 + .06*(y+1) : 1));
    const cheeks = Math.exp(-((Math.abs(x)-.52)**2/.028 + (y+.16)**2/.018))*Math.max(0,z);
    const color = new THREE.Color(0xffffff).lerp(new THREE.Color(0xf7a394), cheeks*.45);
    faceColors.push(color.r,color.g,color.b);
  }
  faceGeometry.setAttribute('color',new THREE.Float32BufferAttribute(faceColors,3));faceGeometry.computeVertexNormals();repairPoleNormals(faceGeometry);
  part(head,faceGeometry,m.face,[0,0,0],[.254,.259,.218]);
  ball(head,m.skin,[0,-.24,0],[.07,.059,.067]);
  for (const side of [-1,1]) {
    ball(head,m.skin,[side*.249,-.006,-.008],[.05,.078,.045]);
    ball(head,m.ear,[side*.265,-.004,.021],[.019,.043,.009]);
    curve(head,m.hair,[[side*.041,.085,.205],[side*.08,.092,.202],[side*.112,.079,.184]],.009,12,6);
  }
  ball(head,m.skin,[0,-.022,.221],[.03,.032,.034]);
  curve(head,m.hair,[[-.048,-.11,.193],[-.026,-.132,.191],[0,-.138,.188],[.028,-.13,.189],[.048,-.111,.188]],.004,18,5);
  const eyes = new THREE.Group();eyes.name='character-eyes';head.add(eyes);
  for (const side of [-1,1]) {
    ball(eyes,m.eyes,[side*.079,.02,.205],[.024,.033,.011]);
    ball(eyes,m.shine,[side*.079-.007,.032,.216],[.006,.007,.0028]);
    ball(eyes,m.shine,[side*.079+.007,.006,.216],[.0025,.003,.0015]);
  }
  const cap = keep(new THREE.SphereGeometry(1,24,14,0,Math.PI*2,0,1.72));
  part(head,cap,m.hair,[0,.016,-.023],[.265,.269,.23],[-.17,0,0]);
  // Smooth swept locks follow the skull; the shared bump map carries fine strands.
  function lock(position,scale,rotation) {
    const group=new THREE.Group();group.position.fromArray(position);group.rotation.fromArray(rotation);head.add(group);
    part(group,smoothSphere,m.hair,[0,0,0],scale);
    // Merge into the head coordinate system so individual locks cost no extra draws.
    group.updateMatrix();
    for(const mesh of [...group.children]) {
      mesh.applyMatrix4(group.matrix);head.add(mesh);
    }
    head.remove(group);
  }
  lock([.055,.178,.144],[.171,.09,.09],[.08,.13,-.28]);
  lock([-.105,.137,.163],[.123,.083,.079],[.03,-.12,-.50]);
  lock([-.202,.064,.103],[.05,.114,.073],[.18,-.3,-.36]);
  lock([.193,.092,.109],[.055,.109,.068],[.12,.28,.36]);

  function arm(side) {
    const shoulder=new THREE.Group();shoulder.name=side<0?'character-left-arm':'character-right-arm';shoulder.position.set(side*.199,.172,0);body.add(shoulder);
    // Fitted sleeve has a softened shoulder and elbow fold, not a detached capsule.
    part(shoulder,form([[-.288,0,0],[-.281,.06,.057],[-.23,.071,.068],[-.167,.067,.062],[-.115,.078,.069],[-.053,.085,.076],[0,.077,.069],[.026,.06,.055],[.043,.035,.033],[.05,0,0]],24),m.coat,[side*.051,-.006,0]);
    ball(shoulder,m.trim,[side*.051,-.192,.047],[.06,.01,.014],[0,0,side*.13]);
    part(shoulder,form([[-.308,.057,.056],[-.30,.062,.059],[-.266,.063,.06],[-.258,.059,.055]],16),m.cream,[side*.052,0,0]);
    const hand=new THREE.Group();hand.position.set(side*.053,-.34,.01);shoulder.add(hand);
    ball(hand,m.skin,[0,0,0],[.042,.047,.029]);
    for(let i=0;i<4;i++) {
      const x=(i-1.5)*.018,y=-.043+Math.abs(i-1.5)*.004;
      part(hand,capsule,m.skin,[x,y,.008],[.01,.0165,.0105],[.15,0,side*.06]);
    }
    part(hand,capsule,m.skin,[-side*.037,-.009,.018],[.014,.016,.014],[.4,0,-side*.6]);
    shoulder.rotation.z=side*.1;batch(hand);batch(shoulder);return shoulder;
  }
  const leftArm=arm(-1),rightArm=arm(1);
  function leg(side) {
    const hip=new THREE.Group();hip.name=side<0?'character-left-hip':'character-right-hip';hip.position.set(side*.105,.427,0);walker.add(hip);
    part(hip,form([[-.225,.078,.074],[-.192,.089,.083],[-.10,.09,.086],[-.04,.099,.09],[.018,.098,.083],[.033,0,0]],16),m.pants,[0,0,0]);
    const knee=new THREE.Group();knee.name=side<0?'character-left-knee':'character-right-knee';knee.position.y=-.208;hip.add(knee);
    ball(knee,m.pants,[0,-.004,0],[.084,.045,.078]);
    part(knee,form([[-.153,.069,.065],[-.133,.078,.073],[-.087,.075,.07],[-.024,.085,.079],[.018,.081,.075]],16),m.pants,[0,0,0]);
    ball(knee,m.pants,[0,-.10,.059],[.077,.014,.016],[0,0,side*.06]);
    ball(knee,m.trim,[0,-.145,.048],[.069,.005,.013]);
    // A low, flattened sneaker with heel, toe box, layered sole and laces.
    part(knee,smoothSphere,m.shoes,[0,-.152,.034],[.092,.065,.141]);
    part(knee,form([[-.219,0,0,.041],[-.219,.093,.146,.041],[-.197,.095,.145,.041],[-.188,.088,.137,.041],[-.187,0,0,.041]],20),m.sole,[0,0,0]);
    ball(knee,m.shoes,[0,-.133,-.031],[.069,.036,.062]);
    ball(knee,m.shoes,[0,-.126,.052],[.059,.016,.068]);
    for(let i=0;i<3;i++) {
      const z=.035+i*.025,y=-.104-i*.008;
      curve(knee,m.sole,[[-.04,y-.005,z],[0,y+.001,z+.008],[.04,y-.005,z]],.004,8,5);
    }
    curve(knee,m.strap,[[-.075,-.17,.108],[-.062,-.154,.149],[0,-.149,.173],[.062,-.154,.149],[.075,-.17,.108]],.0018,14);
    for(const x of [-.077,.077]) curve(knee,m.strap,[[x,-.175,-.022],[x*1.13,-.178,.049],[x,-.179,.105]],.0015,10);
    batch(knee);batch(hip);return {hip,knee};
  }
  const leftLeg=leg(-1),rightLeg=leg(1);
  batch(eyes);batch(head);batch(body);sources.forEach(g=>g.dispose());
  let moving=false,phase=0,stride=0,lastTime=null;
  return {
    walker,
    setGait(nextPhase,walking){phase=nextPhase;moving=walking;},
    update(time){
      const delta=lastTime===null?1/60:Math.max(0,Math.min(time-lastTime,.05));lastTime=time;
      stride=THREE.MathUtils.damp(stride,moving?1:0,14,delta);
      const swing=Math.sin(phase)*stride;
      leftLeg.hip.rotation.x=swing*.43;rightLeg.hip.rotation.x=-swing*.43;
      leftLeg.knee.rotation.x=Math.max(0,-Math.cos(phase))*.27*stride;
      rightLeg.knee.rotation.x=Math.max(0,Math.cos(phase))*.27*stride;
      leftArm.rotation.x=-swing*.32;rightArm.rotation.x=swing*.32;
      body.position.y=.69+Math.abs(Math.sin(phase*2))*.012*stride+Math.sin(time*2.3)*.004*(1-stride);
      body.rotation.z=swing*.013;head.rotation.y=Math.sin(time*.75)*.022*(1-stride);
      const blink=time%4.7;eyes.scale.y=blink<.14?Math.max(.08,Math.abs(blink-.07)/.07):1;
    },
    diagnostics(){
      let meshes=0,triangles=0;const textures=new Set();
      walker.traverse(o=>{if(o.isMesh){meshes++;triangles+=o.geometry.index?o.geometry.index.count/3:o.geometry.attributes.position.count/3;if(o.material.bumpMap)textures.add(o.material.bumpMap);}});
      return {style:'refined-v8',meshes,triangles,proceduralTextures:textures.size,moving,stride};
    },
  };
}
