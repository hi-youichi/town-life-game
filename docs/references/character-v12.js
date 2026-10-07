import * as THREE from 'https://esm.sh/three@0.180.0';
import { mergeGeometries } from 'https://esm.sh/three@0.180.0/examples/jsm/utils/BufferGeometryUtils.js';
import { createCharacterMaterials } from './character-materials-v12.js';
import { characterStyle } from './character-styles-v12.js';

// Three wardrobe and silhouette directions from character-design-directions-v1.png.
export function createCharacter(styleId='cozy') {
  const style=characterStyle(styleId),adventure=style.id==='adventure',urban=style.id==='urban';
  const bodyY=.427*style.legScale+.263*style.torsoScale;
  const walker = new THREE.Group(); walker.name = 'town-walker';
  walker.userData.characterStyle=style.id;
  const m = createCharacterMaterials(style.id), sources = [];
  const keep = geometry => { sources.push(geometry); return geometry; };
  const sphere = keep(new THREE.SphereGeometry(1, 12, 10));
  const smoothSphere = keep(new THREE.SphereGeometry(1, 24, 18));
  const handSphere = keep(new THREE.SphereGeometry(1, 16, 12));
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
  function form(rings, segments = 20, openFront = false) {
    const positions = [], uvs = [], indices = [];
    for (let j = 0; j < rings.length; j++) {
      const [y, rx, rz, z = 0] = rings[j];
      for (let i = 0; i <= segments; i++) {
        const a = i / segments * Math.PI * 2;
        positions.push(Math.cos(a) * rx, y, Math.sin(a) * rz + z);
        uvs.push(i / segments, j / (rings.length - 1));
        if (j && i < segments && !(openFront&&i>=segments/4-1&&i<segments/4+1)) {
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
  function roundedBox(width,height,depth,radius=.015) {
    const w=width/2,h=height/2,r=Math.min(radius,w*.8,h*.8),shape=new THREE.Shape();
    shape.moveTo(-w+r,-h);shape.lineTo(w-r,-h);shape.quadraticCurveTo(w,-h,w,-h+r);
    shape.lineTo(w,h-r);shape.quadraticCurveTo(w,h,w-r,h);shape.lineTo(-w+r,h);
    shape.quadraticCurveTo(-w,h,-w,h-r);shape.lineTo(-w,-h+r);shape.quadraticCurveTo(-w,-h,-w+r,-h);
    const bevel=Math.min(.004,depth/4);
    const g=keep(new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSize:bevel,bevelThickness:bevel,bevelSegments:2,curveSegments:5}));
    g.translate(0,0,-depth/2);g.setIndex(Array.from({length:g.attributes.position.count},(_,i)=>i));
    return g;
  }
  function clothPatch(points,mat) {
    const shape=new THREE.Shape(points.map(([x,y])=>new THREE.Vector2(x,y)));
    const g=keep(new THREE.ExtrudeGeometry(shape,{depth:.006,bevelEnabled:true,bevelSize:.002,bevelThickness:.002,bevelSegments:2}));
    const p=g.attributes.position;
    for(let i=0;i<p.count;i++)p.setZ(i,p.getZ(i)+jacketFront(p.getX(i),p.getY(i))+.009);
    g.setIndex(Array.from({length:p.count},(_,i)=>i));g.computeVertexNormals();repairPoleNormals(g);
    return part(body,g,mat,[0,0,0]);
  }
  function ribbon(parent, points, width=.031, thickness=.005) {
    const path=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
    const vertices=[],uvs=[],indices=[],samples=32;
    const edge=.001,half=width/2,h=thickness/2;
    const profile=[[-half+edge,-h],[half-edge,-h],[half,-h+edge],[half,h-edge],[half-edge,h],[-half+edge,h],[-half,h-edge],[-half,-h+edge],[-half+edge,-h]];
    for(let j=0;j<=samples;j++){
      const t=j/samples,p=path.getPointAt(t),tangent=path.getTangentAt(t);
      const across=new THREE.Vector3(1,0,0).addScaledVector(tangent,-tangent.x).normalize();
      const normal=new THREE.Vector3().crossVectors(tangent,across).normalize();
      profile.forEach(([x,z],i)=>{
        const v=p.clone().addScaledVector(across,x).addScaledVector(normal,z);
        if(p.z>0&&p.y<.216)v.z=jacketFront(v.x,v.y)+.010+(v.z-p.z);
        vertices.push(v.x,v.y,v.z);uvs.push(i/8,t);
        if(j&&i<8){const n=j*9+i,b=n-9;indices.push(b,b+1,n,n,b+1,n+1);}
      });
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();
    return part(parent,keep(geometry),m.strap,[0,0,0]);
  }
  // Pocket cloth follows the elliptical jacket surface instead of hovering as a ball.
  const jacketSections=[[-.245,0,0],[-.235,.174,.127],[-.20,.198,.152],[-.08,.208,.16],[.07,.214,.153],[.18,.209,.130],[.232,.137,.089],[.25,0,0]];
  const jacketFront=(x,y)=>{
    for(let i=1;i<jacketSections.length;i++)if(y<=jacketSections[i][0]){
      const a=jacketSections[i-1],b=jacketSections[i],t=THREE.MathUtils.clamp((y-a[0])/(b[0]-a[0]),0,1);
      const rx=Math.max(.0001,THREE.MathUtils.lerp(a[1],b[1],t)),radius=THREE.MathUtils.lerp(a[2],b[2],t);
      return radius*Math.sqrt(Math.max(0,1-(x/rx)**2));
    }
    return 0;
  };
  function pocket(side,{w=.115,h=.105,centerX=side*.117,centerY=-.117,mat=m.trim}={}){
    const r=.014,shape=new THREE.Shape();
    shape.moveTo(-w/2+r,-h/2);shape.lineTo(w/2-r,-h/2);shape.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r);
    shape.lineTo(w/2,h/2-r);shape.quadraticCurveTo(w/2,h/2,w/2-r,h/2);shape.lineTo(-w/2+r,h/2);
    shape.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r);shape.lineTo(-w/2,-h/2+r);shape.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2);
    const g=keep(new THREE.ExtrudeGeometry(shape,{depth:.004,bevelEnabled:true,bevelSize:.003,bevelThickness:.002,bevelSegments:2,curveSegments:5}));
    const p=g.attributes.position;
    for(let i=0;i<p.count;i++){const x=p.getX(i)+centerX,y=p.getY(i)+centerY;p.setXYZ(i,x,y,p.getZ(i)+jacketFront(x,y)+.006);}
    g.setIndex(Array.from({length:p.count},(_,i)=>i));g.computeVertexNormals();repairPoleNormals(g);part(body,g,mat,[0,0,0]);
    const border=[[-w*.42,-h*.40],[0,-h*.45],[w*.42,-h*.4],[w*.46,0]];
    curve(body,m.coat,border.map(([x,y])=>{x+=centerX;y+=centerY;return [x,y,jacketFront(x,y)+.012];}),.0018,14);
    curve(body,mat,[-w*.42,0,w*.42].map(x=>{x+=centerX;const y=centerY+h*.45;return [x,y,jacketFront(x,y)+.014];}),.003,10);
    if(adventure) {
      clothPatch([[centerX-w*.49,centerY+h*.52],[centerX+w*.49,centerY+h*.52],[centerX+w*.44,centerY+h*.23],[centerX,centerY+h*.16],[centerX-w*.44,centerY+h*.23]],m.trim);
      ball(body,m.metal,[centerX,centerY+h*.28,jacketFront(centerX,centerY+h*.28)+.023],[.008,.008,.003]);
    }
  }
  function batch(group) {
    const batches = new Map(), names = new Map();
    for (const mesh of [...group.children]) {
      if (!mesh.isMesh) continue;
      mesh.updateMatrix();
      if (!batches.has(mesh.material)) batches.set(mesh.material, []);
      if (!names.has(mesh.material)) names.set(mesh.material, []);
      if (mesh.name) names.get(mesh.material).push(mesh.name);
      batches.get(mesh.material).push(mesh.geometry.clone().applyMatrix4(mesh.matrix));group.remove(mesh);
    }
    for (const [mat, geometries] of batches) {
      const merged = mergeGeometries(geometries);
      if (!merged) throw new Error('Character geometry attributes do not match');
      const mesh = new THREE.Mesh(merged, mat);mesh.userData.parts=names.get(mat);mesh.castShadow=mat!==m.shine;mesh.receiveShadow=true;group.add(mesh);
      geometries.forEach(g => g.dispose());
    }
  }

  const body = new THREE.Group();body.name='character-upper-body';body.position.y = bodyY;
  body.scale.set(style.width,style.torsoScale,style.width);walker.add(body);
  part(body, form(jacketSections,20,urban), m.coat, [0,0,0]);
  if(urban)part(body,form([[-.232,0,0],[-.224,.16,.14],[-.10,.17,.145],[.12,.15,.12],[.23,.078,.07],[.235,0,0]]),m.tee,[0,0,0]);
  // Ribbed hem, short cream collar, inset tee and a fine metallic zipper.
  part(body, form([[-.25,.17,.122],[-.244,.18,.131],[-.222,.19,.14],[-.214,.186,.137]]), m.trim, [0,0,0]);
  part(body,form([[.211,.096,.075],[.234,.094,.073],[.267,.08,.06],[.271,.066,.05],[.233,.066,.05]],24),urban?m.tee:m.cream,[0,0,0]);
  // Tailored seams follow the garment rather than forming floating decorations.
  for(const side of [-1,1]) {
    const shoulderPoints=[[side*.104,.225],[side*.166,.185],[side*.195,.126],[side*.199,.068]];
    curve(body,m.trim,shoulderPoints.map(([x,y])=>[x,y,jacketFront(x,y)+.003]),.0018,20,5);
  }
  curve(body,m.trim,[[-.157,-.204],[-.08,-.211],[0,-.213],[.08,-.211],[.157,-.204]].map(([x,y])=>[x,y,jacketFront(x,y)+.003]),.0018,24,5);
  ball(body, m.tee, [0,.227,.072], [.051,.037,.035]);
  if(urban) {
    for(const side of [-1,1]) {
      clothPatch([[side*.025,.236],[side*.094,.232],[side*.142,.168],[side*.084,.108],[side*.031,.19]],m.accent);
      const x=side*.057;
      curve(body,m.trim,[[x,-.20,jacketFront(x,-.20)+.014],[x,0,jacketFront(x,0)+.014],[x,.14,jacketFront(x,.14)+.012]],.004);
    }
    for(const y of [-.16,-.045,.068])ball(body,m.buckle,[-.065,y,jacketFront(-.065,y)+.02],[.009,.009,.004]);
    pocket(-1,{w:.078,h:.09,centerX:-.11,centerY:.058,mat:m.accent});
  } else curve(body, m.trim, [[0,-.212,.141],[0,-.12,.164],[0,.03,.159],[0,.17,.122]], .008);
  for (let i = 0; !urban && i < 25; i++) {
    const y = -.20 + i * .014, z = .162 - Math.max(0,y-.02)*.23 - Math.max(0,-y-.12)*.21;
    part(body, box, m.metal, [(i%2 ? -1:1)*.0035,y,z], [.009,.006,.004]);
  }
  if(!urban) {
    part(body,roundedBox(.016,.031,.005,.005),m.metal,[0,.12,.159]);
    curve(body,m.sole,[[-.004,.131,.164],[-.005,.113,.164],[.005,.113,.164],[.004,.131,.164]],.0018,12,5);
  }
  if(adventure) {
    const hood=part(body,form([[.10,.09,.053,-.028],[.14,.126,.08,-.055],[.21,.142,.115,-.073],[.285,.117,.10,-.074],[.312,.073,.07,-.07],[.319,0,0,-.066]],24),m.coat,[0,0,0]);
    hood.name='character-hood';
    curve(body,m.trim,[[-.10,.244,.065],[-.074,.264,.062],[0,.273,.017],[.074,.264,.062],[.10,.244,.065]],.018,24,8);
    for(const side of [-1,1]) {
      curve(body,m.tee,[[side*.073,.213,.09],[side*.066,.145,.15],[side*.068,.082,.166]],.0035,14,5);
      part(body,capsule,m.metal,[side*.068,.08,.17],[.004,.013,.004]);
    }
  }
  for (const side of [-1,1]) {
    // Raised fabric pocket with a curved opening and a fine stitch border.
    if(!urban)pocket(side);
    // Continuous shoulder strap curves over the jacket to the back of the pack.
    ribbon(body,[[side*.154,-.094,jacketFront(side*.154,-.094)+.008],[side*.154,.062,jacketFront(side*.154,.062)+.008],[side*.143,.203,jacketFront(side*.143,.203)+.008],[side*.146,.216,-.006],[side*.154,.19,-jacketFront(side*.154,.19)-.008],[side*.151,-.02,-.212]]);
    const buckle = new THREE.Group();buckle.position.set(side*.154,.006,jacketFront(side*.154,.006)+.011);body.add(buckle);
    for (const x of [-.02,.02]) part(buckle,box,m.buckle,[x,0,0],[.009,.044,.009]);
    for (const y of [-.019,.019]) part(buckle,box,m.buckle,[0,y,0],[.047,.008,.009]);
    batch(buckle);
  }
  if(!adventure&&!urban) {
    part(body,form([[-.145,0,0],[-.131,.124,.06],[-.08,.152,.078],[.10,.148,.074],[.174,.118,.06],[.188,0,0]],20),m.pack,[0,.025,-.201]);
    part(body,roundedBox(.21,.10,.016,.028),m.pack,[0,-.066,-.285]);
    curve(body,m.strap,[[-.116,-.11,-.264],[-.13,.07,-.26],[0,.17,-.272],[.13,.07,-.26],[.116,-.11,-.264]],.0025,32);
    part(body,roundedBox(.04,.015,.004,.003),m.accent,[0,-.051,-.30]);
  } else {
    const w=adventure?.292:.252,h=adventure?.326:.29;
    part(body,roundedBox(w,h,.12,.035),m.pack,[0,.005,-.218]);
    part(body,roundedBox(w*.91,.094,.02,.019),m.pack,[0,.113,-.283]);
    part(body,roundedBox(w*.85,.116,.025,.023),m.pack,[0,-.075,-.29]);
    for(const side of [-1,1]) {
      if(adventure)part(body,roundedBox(.048,.112,.075,.016),m.pack,[side*.153,-.034,-.214]);
      part(body,roundedBox(.026,.108,.007,.003),m.accent,[side*w*.28,-.025,-.306]);
      part(body,roundedBox(.033,.027,.012,.004),m.metal,[side*w*.28,-.04,-.314]);
    }
    part(body,box,urban?m.accent:m.buckle,[0,.098,-.301],[.028,.022,.005],urban?[0,0,Math.PI/4]:[0,0,0]);
  }
  const handleBase=adventure?.17:urban?.155:.196;
  curve(body,m.strap,[[-.033,handleBase,-.192],[-.028,handleBase+.026,-.195],[.028,handleBase+.026,-.195],[.033,handleBase,-.192]],.009,12,5);
  if(!adventure&&!urban)ball(body,m.metal,[.085,-.022,-.299],[.006,.013,.004]);
  // A zipper around the opening and pocket top makes the rear view read as fabric.
  const zipWidth=adventure?.125:urban?.107:.112,zipTop=adventure?.16:urban?.14:.16;
  curve(body,m.strap,[[-zipWidth,-.08,-.277],[-zipWidth,.06,-.285],[-zipWidth*.62,zipTop,-.281],[0,zipTop+.015,-.28],[zipWidth*.62,zipTop,-.281],[zipWidth,.06,-.285]],.0022,28,5);

  const head = new THREE.Group();head.name='character-head';head.position.set(0,.516,0);body.add(head);
  head.scale.set(style.headScale/style.width,style.headScale/style.torsoScale,style.headScale/style.width);
  head.position.y=.25+.266*style.headScale/style.torsoScale;
  const faceGeometry = keep(new THREE.SphereGeometry(1,32,24));
  const p = faceGeometry.attributes.position, faceColors = [];
  for (let i = 0; i < p.count; i++) {
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
    // A softer jaw and vertex-tinted blush instead of protruding pink spheres.
    p.setX(i,x*(y<0 ? .86 + .14*(y+1) : 1));
    const cheeks = Math.exp(-((Math.abs(x)-.52)**2/.055 + (y+.16)**2/.043))*Math.max(0,z);
    const color = new THREE.Color(0xffffff).lerp(new THREE.Color(0xf08d75), cheeks*.62);
    faceColors.push(color.r,color.g,color.b);
  }
  faceGeometry.setAttribute('color',new THREE.Float32BufferAttribute(faceColors,3));faceGeometry.computeVertexNormals();repairPoleNormals(faceGeometry);
  part(head,faceGeometry,m.face,[0,0,0],[.254,.259,.218]);
  ball(head,m.skin,[0,-.24,0],[.07,.059,.067]);
  for (const side of [-1,1]) {
    ball(head,m.skin,[side*.249,-.006,-.008],[.05,.078,.045]);
    ball(head,m.ear,[side*.265,-.004,.021],[.019,.043,.009]);
    curve(head,m.hair,[[side*.043,.098,.202],[side*.078,.108,.20],[side*.116,.094,.179]],.0075,16,6);
  }
  part(head,smoothSphere,m.skin,[0,-.024,.222],[.027,.023,.027]);
  curve(head,m.hair,[[-.053,-.108,.191],[-.028,-.127,.188],[0,-.132,.186],[.031,-.123,.187],[.054,-.104,.187]],.0034,20,5);
  const eyes = new THREE.Group();eyes.name='character-eyes';eyes.position.y=.025;head.add(eyes);
  for (const side of [-1,1]) {
    const x=side*.081;
    part(eyes,smoothSphere,m.eyeWhite,[x,0,.207],[.037,.043,.014],[0,side*.22,side*-.06]);
    part(eyes,smoothSphere,m.iris,[x+.003,0,.220],[.026,.032,.008]);
    part(eyes,smoothSphere,m.eyes,[x+.004,.001,.226],[.014,.024,.006]);
    ball(eyes,m.shine,[x-.005,.014,.233],[.0065,.008,.0025]);
    ball(eyes,m.shine,[x+.014,-.012,.229],[.0025,.003,.0015]);
    // The eyelid grows from the face and keeps the whites from looking pasted on.
    curve(eyes,m.skin,[[x-.036,.002,.207],[x-.024,.031,.210],[x,.043,.210],[x+.025,.027,.205],[x+.036,-.003,.199]],.0045,20,6);
    curve(eyes,m.hair,[[x-.029,.025,.216],[x-.008,.041,.217],[x+.015,.037,.211],[x+.031,.014,.205]],.0024,16,5);
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
  // Tapered swept tufts distinguish the explorer and centre-parted town resident.
  function hairSweep(points,width,depth) {
    const path=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
    const vertices=[],uvs=[],indices=[],slices=20,sides=12;
    for(let j=0;j<=slices;j++) {
      const t=j/slices,p=path.getPoint(t),tangent=path.getTangent(t);
      const across=new THREE.Vector3(0,0,1).cross(tangent).normalize();
      const normal=new THREE.Vector3().crossVectors(tangent,across).normalize();
      const taper=Math.max(.02,Math.sin(Math.PI*Math.pow(t,.75)));
      for(let i=0;i<=sides;i++) {
        const angle=i/sides*Math.PI*2,v=p.clone().addScaledVector(across,Math.cos(angle)*width*taper).addScaledVector(normal,Math.sin(angle)*depth*taper);
        vertices.push(v.x,v.y,v.z);uvs.push(i/sides,t);
        if(j&&i<sides){const n=j*(sides+1)+i,b=n-sides-1;indices.push(b,b+1,n,n,b+1,n+1);}
      }
    }
    const g=keep(new THREE.BufferGeometry());g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();repairPoleNormals(g);
    part(head,g,m.hair,[0,0,0]);
  }
  if(adventure) {
    hairSweep([[-.18,.13,.12],[-.14,.205,.175],[-.055,.188,.214],[.015,.128,.207]],.055,.035);
    hairSweep([[.17,.095,.12],[.13,.185,.174],[.036,.22,.17],[-.008,.20,.16]],.051,.037);
    hairSweep([[-.06,.23,-.08],[.01,.276,-.028],[.08,.296,.053],[.114,.32,.024]],.043,.028);
    hairSweep([[-.2,.08,-.08],[-.217,.176,-.032],[-.245,.21,.033]],.043,.027);
    hairSweep([[.14,.18,-.115],[.209,.203,-.059],[.254,.211,-.086]],.045,.027);
    hairSweep([[-.12,.24,.041],[-.075,.284,.117],[-.032,.25,.157]],.05,.025);
    lock([-.213,.05,.06],[.044,.105,.073],[.18,-.3,-.30]);
    lock([.216,.05,.069],[.042,.1,.06],[.12,.28,.35]);
  } else if(urban) {
    lock([0,-.057,-.174],[.213,.12,.073],[0,0,0]);
    for(const side of [-1,1]) {
      hairSweep([[side*.016,.258,.009],[side*.076,.245,.155],[side*.181,.152,.177],[side*.235,.061,.084]],.076,.038);
      hairSweep([[side*.057,.251,-.044],[side*.176,.21,.099],[side*.23,.116,.096],[side*.239,-.017,.007]],.057,.027);
      hairSweep([[side*.173,.177,-.101],[side*.235,.093,-.073],[side*.244,-.06,-.048],[side*.2,-.126,-.068]],.043,.029);
    }
  } else {
    hairSweep([[-.132,.223,.025],[-.105,.256,.135],[.013,.223,.202],[.163,.13,.176]],.062,.030);
    hairSweep([[-.09,.254,-.005],[-.02,.271,.079],[.109,.230,.139],[.217,.162,.11]],.049,.028);
    hairSweep([[-.172,.161,.087],[-.148,.20,.163],[-.085,.172,.207],[.017,.133,.212]],.057,.026);
    hairSweep([[-.198,.121,.054],[-.218,.104,.113],[-.228,.022,.095],[-.207,-.073,.057]],.041,.026);
    hairSweep([[.161,.18,.045],[.218,.124,.108],[.236,.031,.060],[.22,-.049,.025]],.042,.026);
    hairSweep([[-.123,.227,-.067],[-.012,.292,-.008],[.102,.299,.03],[.159,.282,-.011]],.042,.022);
  }
  // Layered rear locks follow the scalp; the old smooth cap remains underneath.
  // Broad strands read in the town camera without adding tiny detached hairs.
  function backHairZ(x,y) {
    const c=Math.cos(-.17),s=Math.sin(-.17),dy=y-.016;
    const a=s*s/.269**2+c*c/.23**2;
    const b=2*dy*c*s*(1/.269**2-1/.23**2);
    const k=x*x/.265**2+dy*dy*(c*c/.269**2+s*s/.23**2)-1;
    return -.023+(-b-Math.sqrt(Math.max(0,b*b-4*a*k)))/(2*a);
  }
  for(const side of [-1,1]) {
    const rear=points=>points.map(([x,y])=>[side*x,y,backHairZ(x,y)+.006]);
    hairSweep(rear([[.025,.247],[.055,.193],[.077,.055],[.071,urban?-.084:-.056]]),.040,.015);
    hairSweep(rear([[.087,.227],[.131,.168],[.163,.022],[.143,urban?-.111:-.069]]),.037,.015);
    hairSweep(rear([[.154,.184],[.202,.107],[.223,-.008],[.207,urban?-.092:-.072]]),.030,.014);
  }

  function arm(side) {
    const shoulder=new THREE.Group();shoulder.name=side<0?'character-left-arm':'character-right-arm';shoulder.position.set(side*.188,.172,0);body.add(shoulder);
    // Fitted sleeve has a softened shoulder and elbow fold, not a detached capsule.
    const sleeve=form([[-.288,0,0],[-.281,.06,.057],[-.25,.075,.069],[-.222,.077,.072],[-.198,.068,.064],[-.167,.070,.065],[-.135,.081,.074],[-.105,.082,.072],[-.053,.085,.076],[0,.078,.070],[.026,.062,.055],[.043,.036,.034],[.05,0,0]],24);
    // Broad, shallow creases keep a continuous sleeve instead of tiny elbow blobs.
    const sp=sleeve.attributes.position;
    for(let i=0;i<sp.count;i++){
      const y=sp.getY(i),angle=Math.atan2(sp.getZ(i),sp.getX(i));
      const fold=Math.exp(-(((y+.19)/.035)**2))*Math.sin(angle*2+side*.7)*.003;
      sp.setX(i,sp.getX(i)+Math.cos(angle)*fold);sp.setZ(i,sp.getZ(i)+Math.sin(angle)*fold);
    }
    sleeve.computeVertexNormals();repairPoleNormals(sleeve);part(shoulder,sleeve,m.coat,[side*.051,-.006,0]);
    part(shoulder,form([[-.308,.057,.056],[-.30,.062,.059],[-.266,.063,.06],[-.258,.059,.055]],16),urban?m.accent:m.cream,[side*.052,0,0]);
    if(urban)part(shoulder,form([[-.266,.063,.06],[-.256,.07,.066],[-.218,.072,.067],[-.213,.065,.06]],16),m.coat,[side*.052,0,0]);
    const hand=new THREE.Group();hand.position.set(side*.053,-.34,.01);shoulder.add(hand);
    part(hand,handSphere,m.skin,[0,-.003,0],[.042,.048,.032]);
    for(let i=0;i<4;i++) {
      const x=(i-1.5)*.017,y=-.036+Math.abs(i-1.5)*.004;
      part(hand,handSphere,m.skin,[x,y,.013],[.0115,.018,.013],[.28,0,side*.06]);
    }
    part(hand,handSphere,m.skin,[-side*.032,-.003,.024],[.017,.026,.016],[.35,0,-side*.55]);
    shoulder.rotation.z=side*.1;batch(hand);batch(shoulder);return shoulder;
  }
  const leftArm=arm(-1),rightArm=arm(1);
  function leg(side) {
    const group=new THREE.Group();group.position.set(side*.105*style.width,.427*style.legScale,0);group.scale.set(style.width,style.legScale,style.width);walker.add(group);
    const hip=new THREE.Bone();hip.name=side<0?'character-left-hip':'character-right-hip';group.add(hip);
    const knee=new THREE.Bone();knee.name=side<0?'character-left-knee':'character-right-knee';knee.position.y=-.208;hip.add(knee);
    const cloth=form([[urban?-.312:-.362,urban?.064:.069,urban?.06:.065],[urban?-.304:-.343,urban?.072:.079,urban?.066:.073],[-.295,urban?.071:.076,urban?.066:.071],[-.249,.081,.075],[-.216,.084,.078],[-.192,.087,.082],[-.146,.088,.085],[-.10,.09,.086],[-.04,.099,.09],[.018,.098,.083],[.033,0,0]],20).clone();
    const skinIndices=[],skinWeights=[],positions=cloth.attributes.position;
    for(let i=0;i<positions.count;i++){
      const blend=THREE.MathUtils.smoothstep(-positions.getY(i),.16,.26);
      skinIndices.push(0,1,0,0);skinWeights.push(1-blend,blend,0,0);
    }
    cloth.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(skinIndices,4));cloth.setAttribute('skinWeight',new THREE.Float32BufferAttribute(skinWeights,4));
    const trousers=new THREE.SkinnedMesh(cloth,m.pants);trousers.name=side<0?'character-left-trousers':'character-right-trousers';
    trousers.castShadow=trousers.receiveShadow=true;trousers.frustumCulled=false;group.add(trousers);
    walker.updateMatrixWorld(true);trousers.bind(new THREE.Skeleton([hip,knee]));
    if(adventure) {
      const cargo=new THREE.Group();cargo.name=side<0?'character-left-cargo-pocket':'character-right-cargo-pocket';hip.add(cargo);
      part(cargo,roundedBox(.027,.102,.09,.014),m.pants,[side*.095,-.117,.012]);
      part(cargo,roundedBox(.029,.03,.096,.01),m.accent,[side*.10,-.075,.014]);
      ball(cargo,m.metal,[side*.119,-.08,.024],[.003,.006,.006]);batch(cargo);
    }
    if(!urban)ball(knee,m.pants,[0,-.10,.059],[.077,.014,.016],[0,0,side*.06]);
    if(urban) {
      part(knee,form([[-.129,.061,.057],[-.12,.062,.058],[-.08,.062,.059],[-.075,.061,.057]],20),m.skin,[0,0,0]);
      part(knee,form([[-.114,.066,.061],[-.108,.074,.068],[-.085,.074,.068],[-.08,.068,.063]],20),m.pants,[0,0,0]);
    } else if(adventure)part(knee,form([[-.153,.068,.063],[-.149,.081,.074],[-.129,.081,.074],[-.123,.072,.065]],20),m.pants,[0,0,0]);
    else ball(knee,m.trim,[0,-.145,.048],[.069,.005,.013]);
    // A low, flattened sneaker with heel, toe box, layered sole and laces.
    part(knee,smoothSphere,m.shoes,[0,-.152,.034],[.092,.065,.141]);
    part(knee,form([[-.219,0,0,.041],[-.219,.093,.146,.041],[-.197,.095,.145,.041],[-.188,.088,.137,.041],[-.187,0,0,.041]],20),m.sole,[0,0,0]);
    ball(knee,m.shoes,[0,-.133,-.031],[.069,.036,.062]);
    ball(knee,m.shoes,[0,-.126,.052],[.059,.016,.068]);
    const shoeTop=(x,z)=>-.152+.065*Math.sqrt(Math.max(0,1-(x/.092)**2-((z-.034)/.141)**2));
    for(let i=0;i<3;i++) {
      const z=.074+i*.027,edge=.04-i*.003;
      const points=[[-edge,shoeTop(-edge,z)+.005,z],[0,shoeTop(0,z+.006)+.005,z+.006],[edge,shoeTop(edge,z)+.005,z]];
      const lace=curve(knee,m.sole,points,.0033,10,5);lace.name=`character-shoelace-${side}-${i}`;
    }
    curve(knee,m.strap,[[-.075,-.17,.108],[-.062,-.154,.149],[0,-.149,.173],[.062,-.154,.149],[.075,-.17,.108]],.0018,14);
    for(const x of [-.077,.077]) curve(knee,m.strap,[[x,-.175,-.022],[x*1.13,-.178,.049],[x,-.179,.105]],.0015,10);
    batch(knee);return {hip,knee};
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
      body.position.y=bodyY+Math.abs(Math.sin(phase*2))*.012*stride+Math.sin(time*2.3)*.004*(1-stride);
      body.rotation.z=swing*.013;head.rotation.y=Math.sin(time*.75)*.022*(1-stride);
      const blink=time%4.7;eyes.scale.y=blink<.14?Math.max(.08,Math.abs(blink-.07)/.07):1;
    },
    diagnostics(){
      let meshes=0,triangles=0,skinnedMeshes=0;const textures=new Set();
      walker.traverse(o=>{if(o.isMesh){meshes++;if(o.isSkinnedMesh)skinnedMeshes++;triangles+=o.geometry.index?o.geometry.index.count/3:o.geometry.attributes.position.count/3;if(o.material.bumpMap)textures.add(o.material.bumpMap);}});
      return {style:'refined-v12',variant:style.id,label:style.label,meshes,triangles,skinnedMeshes,proceduralTextures:textures.size,moving,stride};
    },
  };
}
