import * as THREE from 'https://esm.sh/three@0.180.0';

export function setupInteraction(context) {
  const { root, renderer, camera, controls, walker, character,
    destinationMarker, houseRecords, streetCoordinates, walkableRoads, ground, treeObstacles } = context;
  root.dataset.viewMode = 'town';
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const status = root.querySelector('.three-house-status');
  const exitButton = root.querySelector('.three-house-exit');
  const clock = new THREE.Clock();
  const route = [];
  let walking = false;
  let animationScheduled = false;
  let currentHouse = null;
  let firstPerson = false;
  let thirdPersonPose = null;
  let cameraApproach = false;
  let cameraPull = null;
  const eyeHeight = 1.2;
  let followCamera = true;
  const lastFollowPosition = walker.position.clone();
  let lookYaw = 0;
  let lookPitch = 0;
  let walkPhase = 0;
  let pointerStart = null;
  let lookLast = null;
  function findWalkPath(start, goal) {
    const stepSize = 0.8;
    const gridMin = -31.2;
    const gridSide = 79;
    const total = gridSide * gridSide;
    const indexOf = (x, z) => z * gridSide + x;
    const gridPoint = (x, z) => new THREE.Vector3(gridMin + x * stepSize, walker.position.y, gridMin + z * stepSize);
    const houseBounds = houseRecords.map(({ building }) => ({
      x: building.position.x,
      z: building.position.z,
      cos: Math.cos(building.rotation.y),
      sin: Math.sin(building.rotation.y)
    }));
    function blocked(x, z) {
      if (x < 1 || z < 1 || x >= gridSide - 1 || z >= gridSide - 1) return true;
      const worldX = gridMin + x * stepSize;
      const worldZ = gridMin + z * stepSize;
      if (((worldX - 8) / 8.85) ** 2 + ((worldZ + 23) / 6.55) ** 2 < 1) return true;
      for (const tree of treeObstacles) {
        if (Math.hypot(worldX - tree.x, worldZ - tree.z) < tree.radius + 0.28) return true;
      }
      for (const house of houseBounds) {
        const dx = worldX - house.x;
        const dz = worldZ - house.z;
        const localX = house.cos * dx - house.sin * dz;
        const localZ = house.sin * dx + house.cos * dz;
        if (Math.abs(localX) < 3.52 && Math.abs(localZ) < 2.72) return true;
      }
      return false;
    }
    function nearestOpen(point) {
      const baseX = THREE.MathUtils.clamp(Math.round((point.x - gridMin) / stepSize), 1, gridSide - 2);
      const baseZ = THREE.MathUtils.clamp(Math.round((point.z - gridMin) / stepSize), 1, gridSide - 2);
      for (let radius = 0; radius <= 5; radius++) {
        let best = null;
        let bestDistance = Infinity;
        for (let dz = -radius; dz <= radius; dz++) {
          for (let dx = -radius; dx <= radius; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dz)) !== radius) continue;
            const x = baseX + dx;
            const z = baseZ + dz;
            if (blocked(x, z)) continue;
            const distance = dx * dx + dz * dz;
            if (distance < bestDistance) {
              best = { x, z };
              bestDistance = distance;
            }
          }
        }
        if (best) return best;
      }
      return null;
    }
    const source = nearestOpen(start);
    const target = nearestOpen(goal);
    if (!source || !target) return [];
    const startIndex = indexOf(source.x, source.z);
    const targetIndex = indexOf(target.x, target.z);
    const parents = new Int32Array(total);
    parents.fill(-2);
    const queue = new Int32Array(total);
    let head = 0;
    let tail = 0;
    queue[tail++] = startIndex;
    parents[startIndex] = -1;
    const directions = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    while (head < tail && parents[targetIndex] === -2) {
      const current = queue[head++];
      const x = current % gridSide;
      const z = Math.floor(current / gridSide);
      for (const [dx, dz] of directions) {
        const nx = x + dx;
        const nz = z + dz;
        const next = indexOf(nx, nz);
        if (parents[next] !== -2 || blocked(nx, nz)) continue;
        if (dx && dz && (blocked(x + dx, z) || blocked(x, z + dz))) continue;
        parents[next] = current;
        queue[tail++] = next;
      }
    }
    if (parents[targetIndex] === -2) return [];
    const path = [];
    for (let current = targetIndex; current !== -1; current = parents[current]) path.push(current);
    path.reverse();
    if (path.length < 2) return [goal.clone().setY(walker.position.y)];
    const waypoints = [];
    let previousDirection = null;
    for (let i = 1; i < path.length; i++) {
      const previous = path[i - 1];
      const current = path[i];
      const dx = Math.sign(current % gridSide - previous % gridSide);
      const dz = Math.sign(Math.floor(current / gridSide) - Math.floor(previous / gridSide));
      const nextDirection = `${dx},${dz}`;
      if (previousDirection && nextDirection !== previousDirection) {
        waypoints.push(gridPoint(previous % gridSide, Math.floor(previous / gridSide)));
      }
      previousDirection = nextDirection;
    }
    waypoints.push(goal.clone().setY(walker.position.y));
    return waypoints;
  }
  renderer.domElement.addEventListener('pointerdown', (event) => {
    pointerStart = { x: event.clientX, y: event.clientY };
    if (firstPerson) lookLast = { x: event.clientX, y: event.clientY };
  });
  renderer.domElement.addEventListener('pointermove', (event) => {
    if (!firstPerson || !lookLast) return;
    lookYaw -= (event.clientX - lookLast.x) * 0.005;
    lookPitch = THREE.MathUtils.clamp(lookPitch - (event.clientY - lookLast.y) * 0.005, -0.85, 0.85);
    lookLast = { x: event.clientX, y: event.clientY };
    updateFirstPersonCamera();
  });
  renderer.domElement.addEventListener('pointerup', (event) => {
    lookLast = null;
    if (!pointerStart || Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 5) {
      pointerStart = null;
      return;
    }
    pointerStart = null;
    if (firstPerson || cameraPull) return;
    const bounds = renderer.domElement.getBoundingClientRect();
    pointer.set(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      -((event.clientY - bounds.top) / bounds.height) * 2 + 1
    );
    raycaster.setFromCamera(pointer, camera);
    const houseHit = raycaster.intersectObjects(houseRecords.flatMap((record) => record.meshes), false)[0];
    if (houseHit) {
      const record = houseRecords.find((item) => item.meshes.some((mesh) => mesh === houseHit.object));
      if (!record) return;
      const outside = record.building.localToWorld(new THREE.Vector3(0, 0, 1.9));
      const staging = record.building.localToWorld(new THREE.Vector3(0, 0, 2.8));
      const inside = record.building.localToWorld(new THREE.Vector3(0, 0, 0));
      const points = [];
      if (currentHouse && currentHouse !== record) {
        points.push({ position: currentHouse.building.localToWorld(new THREE.Vector3(0, 0, 0)) });
        points.push({
          position: currentHouse.building.localToWorld(new THREE.Vector3(0, 0, 1.9)),
          action: () => {
            currentHouse.roof.visible = true;
            currentHouse.door.rotation.y = 0;
            currentHouse.inside = false;
            currentHouse = null;
          }
        });
      }
      const nearestStreet = (value) => streetCoordinates.reduce((nearest, candidate) =>
        Math.abs(candidate - value) < Math.abs(nearest - value) ? candidate : nearest
      , streetCoordinates[0]);
      const currentVertical = nearestStreet(walker.position.x);
      const currentHorizontal = nearestStreet(walker.position.z);
      const targetVertical = nearestStreet(record.building.position.x);
      const isOnVerticalStreet = Math.abs(walker.position.x - currentVertical) < Math.abs(walker.position.z - currentHorizontal);
      if (isOnVerticalStreet) {
        points.push({ position: new THREE.Vector3(currentVertical, walker.position.y, record.entryRoadZ) });
      } else {
        points.push({ position: new THREE.Vector3(targetVertical, walker.position.y, currentHorizontal) });
        points.push({ position: new THREE.Vector3(targetVertical, walker.position.y, record.entryRoadZ) });
      }
      points.push({ position: new THREE.Vector3(record.building.position.x, walker.position.y, record.entryRoadZ) });
      points.push({ position: staging, action: () => {
        const inward = inside.clone().sub(staging);
        walker.rotation.y = Math.atan2(inward.x, inward.z);
        record.door.rotation.y = -Math.PI / 2;
        beginCameraPull();
      }});
      points.push({ position: outside, action: () => {
        record.roof.visible = false;
        currentHouse = record;
      }});
      points.push({ position: inside, action: () => {
        currentHouse = record;
        record.inside = true;
        status.textContent = '室内第一人称视角。拖动转头，点击“返回街道”出门。';
        exitButton.hidden = false;
      }});
      if (!firstPerson && !thirdPersonPose) {
        thirdPersonPose = {
          position: camera.position.clone(),
          target: controls.target.clone(),
          walkerPosition: walker.position.clone()
        };
        cameraApproach = true;
        followCamera = false;
        controls.enabled = false;
      }
      startRoute(points, '小人正走向房门。');
      return;
    }
    const roadHit = raycaster.intersectObjects(walkableRoads, false)[0];
    const groundHit = raycaster.intersectObject(ground, false)[0];
    const hit = roadHit ?? groundHit;
    if (!hit) return;
    const lakeEdge = ((hit.point.x - 8) / 8.35) ** 2 + ((hit.point.z + 23) / 6.05) ** 2;
    if (lakeEdge <= 1) return;
    const roadTarget = new THREE.Vector3(hit.point.x, walker.position.y, hit.point.z);
    destinationMarker.position.set(hit.point.x, 0.055, hit.point.z);
    destinationMarker.visible = true;
    const points = [];
    if (currentHouse) {
      const leaving = currentHouse;
      points.push({ position: leaving.building.localToWorld(new THREE.Vector3(0, 0, 1.9)), action: () => {
        leaving.roof.visible = true;
        leaving.door.rotation.y = 0;
        leaving.inside = false;
        currentHouse = null;
      }});
    }
    const routeStart = currentHouse
      ? currentHouse.building.localToWorld(new THREE.Vector3(0, 0, 1.9))
      : walker.position.clone();
    const walkPath = findWalkPath(routeStart, roadTarget);
    if (!walkPath.length) return;
    walkPath.forEach((position) => points.push({ position }));
    startRoute(points, '小人正在前往你点击的位置。');
  });
  function updateFirstPersonCamera() {
    camera.position.set(walker.position.x, walker.position.y + eyeHeight, walker.position.z);
    const direction = new THREE.Vector3(
      Math.sin(lookYaw) * Math.cos(lookPitch),
      Math.sin(lookPitch),
      Math.cos(lookYaw) * Math.cos(lookPitch)
    );
    camera.lookAt(camera.position.clone().add(direction));
  }
  function enterFirstPerson() {
    firstPerson = true;
    root.dataset.viewMode = 'inside';
    cameraApproach = false;
    followCamera = false;
    walker.visible = false;
    controls.enabled = false;
    lookYaw = walker.rotation.y;
    lookPitch = 0;
    updateFirstPersonCamera();
  }
  function leaveFirstPerson() {
    firstPerson = false;
    root.dataset.viewMode = 'town';
    cameraApproach = false;
    cameraPull = null;
    walker.visible = true;
    controls.enabled = true;
    exitButton.hidden = true;
    if (thirdPersonPose) {
      const shift = walker.position.clone().sub(thirdPersonPose.walkerPosition);
      camera.position.copy(thirdPersonPose.position).add(shift);
      controls.target.copy(thirdPersonPose.target).add(shift);
      controls.update();
      thirdPersonPose = null;
    }
    followCamera = true;
    lastFollowPosition.copy(walker.position);
  }
  function exitHouse() {
    if (!firstPerson || !currentHouse) return;
    const leaving = currentHouse;
    const outside = leaving.building.localToWorld(new THREE.Vector3(0, 0, 1.9));
    startRoute([{ position: outside, action: () => {
      leaving.roof.visible = true;
      leaving.door.rotation.y = 0;
      leaving.inside = false;
      currentHouse = null;
      leaveFirstPerson();
    }}], '小人正从房门走回街道。');
  }
  exitButton.addEventListener('click', exitHouse);
  function beginCameraPull() {
    cameraApproach = false;
    walking = false;
    const eyePosition = walker.position.clone();
    eyePosition.y += eyeHeight;
    const forward = new THREE.Vector3(Math.sin(walker.rotation.y), 0, Math.cos(walker.rotation.y));
    cameraPull = {
      startTime: performance.now(),
      duration: 460,
      startPosition: camera.position.clone(),
      startTarget: controls.target.clone(),
      endPosition: eyePosition,
      endTarget: eyePosition.clone().add(forward)
    };
    lookYaw = walker.rotation.y;
    lookPitch = 0;
    status.textContent = '小人在门口停下，镜头正在切换……';
    scheduleWalk();
  }
  function startRoute(points, message) {
    route.splice(0, route.length, ...points.map(({ position, action }) => ({
      position: position.clone().setY(walker.position.y),
      action
    })));
    if (!route.length) return;
    if (!firstPerson && !cameraApproach && !cameraPull) {
      followCamera = true;
      lastFollowPosition.copy(walker.position);
    }
    walking = true;
    status.textContent = message;
    clock.getDelta();
    scheduleWalk();
  }
  function scheduleWalk() {
    if (animationScheduled || (!walking && !cameraPull)) return;
    animationScheduled = true;

  }
  function animateWalk() {
    animationScheduled = false;
    if (cameraPull) {
      const progress = THREE.MathUtils.clamp((performance.now() - cameraPull.startTime) / cameraPull.duration, 0, 1);
      const eased = progress * progress * (3 - 2 * progress);
      camera.position.lerpVectors(cameraPull.startPosition, cameraPull.endPosition, eased);
      const target = cameraPull.startTarget.clone().lerp(cameraPull.endTarget, eased);
      camera.lookAt(target);
        if (progress >= 1) {
        camera.position.copy(cameraPull.endPosition);
        cameraPull = null;
        enterFirstPerson();
        walking = route.length > 0;
        clock.getDelta();
      } else {
        scheduleWalk();
        return;
      }
    }
    if (!walking) return;
    const delta = Math.min(clock.getDelta(), 0.05);
    const target = route[0].position;
    const dx = target.x - walker.position.x;
    const dz = target.z - walker.position.z;
    const distance = Math.hypot(dx, dz);
    const step = Math.min(distance, delta * 2.2);
    if (distance > 0.015) {
      walker.position.x += (dx / distance) * step;
      walker.position.z += (dz / distance) * step;
      walker.rotation.y = Math.atan2(dx, dz);
      walkPhase += delta * 11;
      character.setGait(walkPhase, true);
    } else {
      walker.position.x = target.x;
      walker.position.z = target.z;
      const waypoint = route.shift();
      waypoint.action?.();
      character.setGait(walkPhase, false);
      if (!route.length) {
        walking = false;
        destinationMarker.visible = false;
        if (!currentHouse) status.textContent = '到了！点击街道继续走，点击房屋可以进屋。';
      }
    }
    if (cameraApproach) {
      const forward = new THREE.Vector3(Math.sin(walker.rotation.y), 0, Math.cos(walker.rotation.y));
      const closePosition = walker.position.clone().addScaledVector(forward, -3.7);
      closePosition.y += 2.1;
      camera.position.lerp(closePosition, 1 - Math.exp(-delta * 3.5));
      controls.target.lerp(walker.position.clone().add(new THREE.Vector3(0, 0.85, 0)).addScaledVector(forward, 0.6), 1 - Math.exp(-delta * 4));
      camera.lookAt(controls.target);
    }
    if (followCamera && !firstPerson && controls.enabled) {
      const shiftX = walker.position.x - lastFollowPosition.x;
      const shiftZ = walker.position.z - lastFollowPosition.z;
      if (shiftX || shiftZ) {
        camera.position.x += shiftX;
        camera.position.z += shiftZ;
        controls.target.copy(walker.position);
        controls.target.y += 0.85;
        lastFollowPosition.copy(walker.position);
        controls.update();
      }
    }
    if (firstPerson) updateFirstPersonCamera();
    if (walking || cameraPull) scheduleWalk();
  }

  return {
    update() { if (animationScheduled) animateWalk(); },
    getState() {
      return { firstPerson, walking, position:walker.position.toArray(),
        roofs:houseRecords.map(record=>record.roof.visible) };
    }
  };
}
