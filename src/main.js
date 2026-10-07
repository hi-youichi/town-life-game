import { createPondShapes } from './pond.js';
import { createWater } from './water.js';
import { createRendering } from './rendering.js';
import { createFrameMonitor } from './frame-monitor.js';
import { mergeGeometries } from 'https://esm.sh/three@0.180.0/examples/jsm/utils/BufferGeometryUtils.js';
import { setupInteraction } from './interaction.js';
let readDiagnostics = () => ({ ready:false });
export function getSceneDiagnostics() { return readDiagnostics(); }
import { createMaterials } from './materials.js';
import { createHouse } from './house.js';
import { createTrees, createLandscape } from './landscape.js';
import { configureRenderer, createLighting, updateLighting } from './lighting.js';
import { setupCapture } from './capture.js';
import { createTrafficSignals } from './traffic-signals.js';
import { trafficDistance } from './traffic-rules.js';
import { createCharacterRoster } from './character.js';
import { savedCharacterStyle } from './character-styles.js';
import { setupCharacterPicker } from './character-picker.js';

// 固定版本，核心库和控制器使用同一个版本。
const root = document.getElementById('three-house-demo');
const container = root.querySelector('.three-house-view');
try {
  const THREE = await import('https://esm.sh/three@0.180.0');
  const { OrbitControls } = await import('https://esm.sh/three@0.180.0/examples/jsm/controls/OrbitControls.js');

  // 1. 场景、相机、渲染器。
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 140);
  const compact = matchMedia('(max-width: 700px)').matches;
  // 从西南侧看向住宅区，湖泊落在参考图的左上方。
  camera.position.set(-13, 23, 28);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  configureRenderer(renderer, compact);
  container.appendChild(renderer.domElement);
  const materials = createMaterials();
  const lights = createLighting(scene, compact);
  const rendering = createRendering(renderer,scene,camera,compact);

  // 3. 地面：PlaneGeometry 默认在 XY 平面，旋转后位于 XZ 平面。
  const groundMaterial = new THREE.MeshStandardMaterial({ roughness: 1, vertexColors:true });
  const roadMaterial = new THREE.MeshStandardMaterial({ roughness: 1 });
  const markingMaterial = new THREE.MeshStandardMaterial({ roughness: 1 });
  const walkableRoads = [];
  const terrain = new THREE.PlaneGeometry(64,64,32,32).toNonIndexed();
  const terrainColors = [];
  for (let i=0; i<terrain.attributes.position.count; i+=3) {
    const shade=.94+((i*17)%31)/31*.1;
    for (let vertex=0;vertex<3;vertex++) terrainColors.push(shade,shade,shade);
  }
  terrain.setAttribute('color',new THREE.Float32BufferAttribute(terrainColors,3));
  const ground = new THREE.Mesh(terrain, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  // 视觉地面延伸到取景之外，原 64×64 地面仍负责点击与寻路。
  const backdropGeometry=new THREE.PlaneGeometry(140,140,56,56).toNonIndexed();
  const backdropColors=[];
  for(let i=0;i<backdropGeometry.attributes.position.count;i+=3) {
    const shade=.96+((i*11)%29)/29*.07;
    for(let v=0;v<3;v++)backdropColors.push(shade,shade,shade);
  }
  backdropGeometry.setAttribute('color',new THREE.Float32BufferAttribute(backdropColors,3));
  const backdrop=new THREE.Mesh(backdropGeometry,groundMaterial);
  backdrop.rotation.x=-Math.PI/2;backdrop.position.y=-.008;backdrop.receiveShadow=true;scene.add(backdrop);

  const house = createHouse(materials);
  scene.add(house);

  // 7. 在街区网格中摆放九栋放大的房屋。
  const streetCoordinates = [-15, -5, 5, 15];
  const blockCenters = [-10, 0, 10];
  const houses = blockCenters.flatMap((x) => blockCenters.map((z) => ({
    x,
    z,
    angle: 0,
    entryRoadZ: z + 5
  })));
  const houseRecords = [];
  houses.forEach(({ x, z, angle, entryRoadZ }, index) => {
    const building = index === 0 ? house : house.clone(true);
    building.position.set(x, 0, z);
    building.rotation.y = angle;
    if (index !== 0) scene.add(building);
    houseRecords.push({
      building,
      entryRoadZ,
      roof: building.getObjectByName('house-roof'),
      door: building.getObjectByName('house-door'),
      meshes: [],
      inside: false
    });
    building.traverse((object) => {
      if (object.isMesh && !object.userData.decoration) houseRecords[index].meshes.push(object);
    });
  });

  // 8. 四条横街和四条纵街组成连续街区网格。
  function road(width, depth, x, z) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), roadMaterial);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.02, z);
    mesh.receiveShadow = true;
    scene.add(mesh);
    walkableRoads.push(mesh);
  }
  const markingGeometries = [];
  for (const coordinate of streetCoordinates) {
    road(36, 2.8, 0, coordinate);
    road(2.8, 36, coordinate, 0);
    for (let n = -17; n <= 17; n += 2.8) {
      if (streetCoordinates.some(street => Math.abs(n - street) < 1.9)) continue;
      const across = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.025, 0.09), markingMaterial);
      across.position.set(n, 0.04, coordinate);
      across.updateMatrix();
      markingGeometries.push(across.geometry.applyMatrix4(across.matrix));
      const along = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.025, 0.85), markingMaterial);
      along.position.set(coordinate, 0.04, n);
      along.updateMatrix();
      markingGeometries.push(along.geometry.applyMatrix4(along.matrix));
    }
  }

  const markings = new THREE.Mesh(mergeGeometries(markingGeometries),markingMaterial);
  for (const geometry of markingGeometries) geometry.dispose();
  scene.add(markings);
  const trafficSignals = createTrafficSignals(scene, streetCoordinates);
  let currentSignals = trafficSignals.update(0);
  const landscape = createLandscape(scene, houseRecords, materials);
  const treeObstacles = [];
  const forestFloor = new THREE.Mesh(
    new THREE.CircleGeometry(1, 48),
    new THREE.MeshStandardMaterial({ color: 0x55764d, roughness: 1 })
  );
  forestFloor.rotation.x = -Math.PI / 2;
  forestFloor.scale.set(7.5, 11, 1);
  forestFloor.position.set(-24, 0.018, 0);
  forestFloor.receiveShadow = true;
  scene.add(forestFloor);
  const forestPositions = [];
  for (let row = 0; row < 9; row++) {
    for (let column = 0; column < 6; column++) {
      if ((row * 3 + column * 5) % 13 === 0) continue;
      const x = -29 + column * 2.05 + (row % 2) * 0.45;
      const z = -8.4 + row * 2.1 + (column % 2) * 0.35;
      const scale = 0.82 + ((row + column * 2) % 4) * 0.12;
      forestPositions.push([x, z, scale]);
    }
  }
  const treePositions = [
    ...[-12, 0, 12].flatMap((z) => [[-17, z], [17, z]]),
    ...[-12, 0, 12].flatMap((x) => [[x, -17], [x, 17]]),
    [-17, -17], [17, -17], [-17, 17], [17, 17],
    [-4,-26,.85],[-1,-30,1],[3,-29,.75],[7,-29,.95],[12,-29,1.1],[17,-28,1.1],[21,-24,.9],[18,-18,.8],
    [-13,-31,1.1],[-7,-34,.8],[6,-35,1.15],[12,-33,.85],[20,-34,1.1],[27,-29,.85],
    [-22,-29,.95],[-17,-36,.8],[2,-40,.9],[24,-40,1.1],
    ...forestPositions
  ];
  createTrees(scene, treePositions, materials, true);
  treePositions.forEach(([x,z,size=1]) => treeObstacles.push({x,z,radius:.42*size}));

  const pondShapes=createPondShapes();
  const lakeShore = new THREE.Mesh(
    new THREE.ShapeGeometry(pondShapes.shore,24),
    new THREE.MeshStandardMaterial({ color: 0xe3d0a0, roughness: 1 })
  );
  lakeShore.rotation.x = -Math.PI / 2;
  lakeShore.scale.set(1.16,1.08,1);
  lakeShore.position.set(8, 0.025, -23);
  lakeShore.receiveShadow = true;
  scene.add(lakeShore);
  const water = createWater(new THREE.ShapeGeometry(pondShapes.water,24),compact);
  const lake = water.mesh;
  lake.scale.set(1.16,1.08,1);
  lake.rotation.x = -Math.PI / 2;
  lake.position.set(8, 0.045, -23);
  lake.receiveShadow = true;
  scene.add(lake);
  const streetLamps = [];
  const poleMaterial = new THREE.MeshStandardMaterial({ color: 0x535a56, metalness: 0.55, roughness: 0.5 });
  const bulbMaterial = new THREE.MeshStandardMaterial({ color: 0xffe3a0, emissive: 0xffc45b, emissiveIntensity: 0 });
  const haloMaterial = new THREE.MeshBasicMaterial({ color: 0xffd078, transparent: true, opacity: 0, depthWrite: false });
  function makeStreetLamp(x, z, side, axis) {
    const lamp = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.065, 2.8, 8), poleMaterial);
    pole.position.y = 1.4;
    pole.castShadow = true;
    lamp.add(pole);
    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(axis === 'x' ? 0.62 : 0.12, 0.1, axis === 'z' ? 0.62 : 0.12),
      poleMaterial
    );
    arm.position.set(axis === 'z' ? -side * 0.24 : 0, 2.72, axis === 'x' ? -side * 0.24 : 0);
    lamp.add(arm);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), bulbMaterial);
    bulb.position.set(axis === 'z' ? -side * 0.48 : 0, 2.65, axis === 'x' ? -side * 0.48 : 0);
    lamp.add(bulb);
    const shade=new THREE.Mesh(new THREE.ConeGeometry(.23,.14,8),poleMaterial);
    shade.position.copy(bulb.position);shade.position.y+=.18;lamp.add(shade);
    const base=new THREE.Mesh(new THREE.CylinderGeometry(.13,.16,.2,8),poleMaterial);
    base.position.y=.1;lamp.add(base);
    const metalParts=[pole,arm,shade,base].map(part=>{part.updateMatrix();return part.geometry.clone().applyMatrix4(part.matrix);});
    const fixture=new THREE.Mesh(mergeGeometries(metalParts),poleMaterial);fixture.castShadow=true;lamp.add(fixture);
    for(const part of [pole,arm,shade,base]){lamp.remove(part);part.geometry.dispose();}
    for(const geometry of metalParts)geometry.dispose();
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), haloMaterial);
    halo.position.copy(bulb.position);
    lamp.add(halo);
    const light = new THREE.PointLight(0xffd38a, 0, 5.5, 2);
    light.position.copy(bulb.position);
    lamp.add(light);
    lamp.position.set(x, 0, z);
    scene.add(lamp);
    streetLamps.push({ light, bulb, halo, x, z });
  }
  for (const streetZ of streetCoordinates) {
    for (const side of [-1, 1]) makeStreetLamp(side * 3.8, streetZ + side * 1.8, side, 'x');
  }
  for (const streetX of streetCoordinates) {
    for (const side of [-1, 1]) makeStreetLamp(streetX + side * 1.8, side * 3.8, side, 'z');
  }

  // 四辆小车沿十字路的两组车道循环行驶。
  const traffic = [];
  const wheelGeometry = new THREE.CylinderGeometry(0.16, 0.16, 0.12, 12);
  const tireMaterial = new THREE.MeshStandardMaterial({ color: 0x282a2b, roughness: 1 });
  const glassMaterial = materials.glass.clone();
  const lampMaterial = new THREE.MeshStandardMaterial({ color: 0xffedb0, emissive: 0x8a682b, emissiveIntensity: 0.35 });
  const tailMaterial = new THREE.MeshStandardMaterial({ color: 0xd74738, emissive: 0x7c1b13, emissiveIntensity: 0.3 });
  function makeCar({ axis, direction, lane, start, speed, color }) {
    const car = new THREE.Group();
    const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.12 });
    function carPart(geometry, material, x, y, z) {
      const part = new THREE.Mesh(geometry, material);
      part.position.set(x, y, z);
      part.castShadow = true;
      car.add(part);
      return part;
    }
    carPart(new THREE.BoxGeometry(0.82, 0.3, 1.35), paint, 0, 0.32, 0);
    carPart(new THREE.BoxGeometry(0.66, 0.32, 0.68), glassMaterial, 0, 0.61, -0.04);
    const wheels = new THREE.InstancedMesh(wheelGeometry,tireMaterial,4);
    wheels.castShadow = true;
    const wheelDummy = new THREE.Object3D();
    const wheelLocations = [-.43,.43].flatMap(x=>[-.42,.42].map(z=>[x,z]));
    function updateWheels(angle) {
      wheelLocations.forEach(([x,z],i)=>{
        wheelDummy.position.set(x,.17,z);
        wheelDummy.rotation.set(angle,0,Math.PI/2);
        wheelDummy.updateMatrix(); wheels.setMatrixAt(i,wheelDummy.matrix);
      });
      wheels.instanceMatrix.needsUpdate = true;
    }
    updateWheels(0); car.add(wheels);
    for (const x of [-0.27, 0.27]) {
      carPart(new THREE.BoxGeometry(0.18, 0.1, 0.035), lampMaterial, x, 0.34, 0.69);
      carPart(new THREE.BoxGeometry(0.18, 0.1, 0.035), tailMaterial, x, 0.34, -0.69);
    }
    const carBatches = new Map();
    for (const part of [...car.children]) {
      if (!part.isMesh || part.isInstancedMesh) continue;
      if (!carBatches.has(part.material)) carBatches.set(part.material,[]);
      part.updateMatrix();
      carBatches.get(part.material).push(part.geometry.clone().applyMatrix4(part.matrix));
      part.geometry.dispose(); car.remove(part);
    }
    for (const [material,geometries] of carBatches) {
      const combined=new THREE.Mesh(mergeGeometries(geometries),material);
      combined.castShadow=true; car.add(combined);
      for (const geometry of geometries) geometry.dispose();
    }
    car.rotation.y = axis === 'x' ? direction * Math.PI / 2 : (direction > 0 ? 0 : Math.PI);
    car.position.set(axis === 'x' ? start : lane, 0, axis === 'z' ? start : lane);
    scene.add(car);
    traffic.push({ car, axis, direction, lane, position: start, speed, updateWheels, wheelAngle:0 });
  }
  const carColors = [0xc95c43, 0x4c84a4, 0xe0a83e, 0x65966a];
  streetCoordinates.forEach((coordinate, index) => {
    makeCar({ axis: 'x', direction: 1, lane: coordinate - 0.65, start: -17 + index * 2, speed: 2.2, color: carColors[index] });
    makeCar({ axis: 'x', direction: -1, lane: coordinate + 0.65, start: 17 - index * 2, speed: 2.6, color: carColors[(index + 1) % carColors.length] });
    makeCar({ axis: 'z', direction: 1, lane: coordinate + 0.65, start: -17 + index * 2, speed: 2.4, color: carColors[(index + 2) % carColors.length] });
    makeCar({ axis: 'z', direction: -1, lane: coordinate - 0.65, start: 17 - index * 2, speed: 2.0, color: carColors[(index + 3) % carColors.length] });
  });

  // 小人和脚下的目的地标记。点击只会命中两块道路平面。
  const character = createCharacterRoster(savedCharacterStyle());
  const { walker } = character;
  walker.position.set(0, 0.04, 5);
  scene.add(walker);
  const destinationMarker = new THREE.Mesh(
    new THREE.RingGeometry(0.22, 0.34, 32),
    new THREE.MeshBasicMaterial({ color: 0xffdf6e, side: THREE.DoubleSide })
  );
  destinationMarker.rotation.x = -Math.PI / 2;
  destinationMarker.position.set(0, 0.055, 5);
  destinationMarker.visible = false;
  scene.add(destinationMarker);
  const timeButton = root.querySelector('.three-house-time');
  let nightMode = false;
  let forceSceneRefresh=true;
  function requestSceneRefresh(){forceSceneRefresh=true;}

  // 颜色跟随当前主题；独立页面在 CSS 中定义这些变量。
  function applyTheme() {
    groundMaterial.color.set(nightMode ? 0x668663 : 0xb0c15d);
    roadMaterial.color.set(nightMode ? 0x657283 : 0x85878b);
    markingMaterial.color.set(0xdcdacd);
    updateLighting(scene, renderer, lights, materials, nightMode);
    water.setNight(nightMode);
    streetLamps.forEach(({ light, bulb, halo }) => {
      light.visible = false;
      light.intensity = nightMode ? 5 : 0;
      bulb.material.emissiveIntensity = nightMode ? 2.5 : .85;
      halo.material.opacity = nightMode ? 0.32 : 0;
      halo.visible = nightMode;
    });
    requestSceneRefresh();
  }
  timeButton.addEventListener('click', () => {
    nightMode = !nightMode;
    root.classList.toggle('night', nightMode);
    document.body.classList.toggle('night', nightMode);
    timeButton.setAttribute('aria-label', nightMode ? '切换到白天' : '切换到夜晚');
    timeButton.title = nightMode ? '切换到白天' : '切换到夜晚';
    timeButton.innerHTML = nightMode
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.2 15.4A8.5 8.5 0 0 1 8.6 3.8 8.5 8.5 0 1 0 20.2 15.4Z"/></svg>';
    applyTheme();
  });

  // 鼠标旋转和缩放均以人物身体为中心。
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(walker.position);
  controls.target.y += 0.85;
  controls.minDistance = 5;
  controls.maxDistance = 60;
  controls.maxPolarAngle = Math.PI / 2 - 0.05;
  controls.enablePan = false;
  function render({capture=false}={}) {
    if(forceSceneRefresh||capture) {
      rendering.invalidateShadows();water.forceRefresh();forceSceneRefresh=false;
    }
    if(capture)rendering.resetSamples();
    rendering.render({capture});
  }
  root.dataset.sceneVersion = 'character-refined-v13';
  setupCharacterPicker(root,character,requestSceneRefresh);
  setupCapture(root, renderer, render, () => nightMode);
  // 旋转、跟随和缩放只改变状态，统一由 RAF 绘制。
  controls.update();
  function restore(state) {
    const position = state?.privateContent?.camera;
    if (Array.isArray(position) && position.length === 3 && position.every(Number.isFinite)) {
      camera.position.fromArray(position);
      controls.update();requestSceneRefresh();
    }
  }
  restore(window.openai?.widgetState);
  window.addEventListener('openai:set_globals', (event) => restore(event.detail?.globals?.widgetState));
  controls.addEventListener('end', () => {
    window.openai?.setWidgetState({ privateContent: { camera: camera.position.toArray() } }).catch(() => {});
  });

  const interaction = setupInteraction({ root, renderer, camera, controls, walker, character,
    destinationMarker, houseRecords, streetCoordinates, walkableRoads, ground, treeObstacles });
  let frameMs = 0,animationFrames=0,rendersThisFrame=0;
  const houseVisualState=houseRecords.map(record=>({roof:record.roof.visible,door:record.door.rotation.y}));
  const frameMonitor = createFrameMonitor(root.querySelector('.three-house-fps'));
  readDiagnostics = () => ({ ready:true, drawCalls:renderer.info.render.calls,
    triangles:renderer.info.render.triangles, frameMs, compact, animationFrames,rendersThisFrame,rendering:rendering.diagnostics(), water:water.diagnostics(), landscape:landscape.diagnostics(), ...frameMonitor.getState(),
    trafficSignals: { intersections: trafficSignals.count, ...currentSignals },
    character:character.diagnostics(), view:interaction.getState(), camera:camera.position.toArray(), target:controls.target.toArray() });
  let trafficTime = performance.now();
  let signalTime = 0;
  function animateTraffic(now) {
    frameMs = now - trafficTime;
    const delta = Math.min(frameMs / 1000, 0.05);
    trafficTime = now;
    signalTime += delta;
    currentSignals = trafficSignals.update(signalTime);
    traffic.forEach((vehicle) => {
      const { car, axis, direction, lane, speed, updateWheels } = vehicle;
      let position = axis === 'x' ? car.position.x : car.position.z;
      const distance = trafficDistance(position, direction, speed * delta, streetCoordinates, currentSignals[axis]);
      position += direction * distance;
      if (position > 20) position = -20;
      if (position < -20) position = 20;
      if (axis === 'x') car.position.set(position, 0, lane);
      else car.position.set(lane, 0, position);
      vehicle.wheelAngle += direction * distance / .16;
      updateWheels(vehicle.wheelAngle);
    });
    landscape.update(now / 1000);
    water.update(now/1000);
    if (nightMode) {
      const active = [...streetLamps].sort((a,b) =>
        (a.x-walker.position.x)**2+(a.z-walker.position.z)**2
        -((b.x-walker.position.x)**2+(b.z-walker.position.z)**2)).slice(0,compact?4:8);
      for (const lamp of streetLamps) lamp.light.visible=active.includes(lamp);
    }
    interaction.update();
    character.update(now / 1000);
    houseRecords.forEach((record,index)=>{
      const state=houseVisualState[index];
      if(state.roof!==record.roof.visible||state.door!==record.door.rotation.y) {
        state.roof=record.roof.visible;state.door=record.door.rotation.y;requestSceneRefresh();
      }
    });
    rendering.observeFrame(frameMs,now);
    const before=rendering.renderCount;
    render();
    rendersThisFrame=rendering.renderCount-before;animationFrames++;
    frameMonitor.update(now);
    requestAnimationFrame(animateTraffic);
  }
  new ResizeObserver(() => {
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (!width || !height) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    requestSceneRefresh();
  }).observe(container);
  new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] });
  applyTheme();
  requestAnimationFrame(animateTraffic);
} catch (error) {
  const message = root.querySelector('.three-house-error');
  message.hidden = false;
  message.textContent = '无法加载三维预览，请检查网络连接和浏览器 WebGL 支持。';
  console.error(error);
}
