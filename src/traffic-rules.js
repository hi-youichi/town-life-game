// 两方向之间留一秒全红，给已进入路口的车辆留出清空时间。
export function signalState(time) {
  const phase = ((time % 22) + 22) % 22;
  return {
    x: phase < 8 ? 'green' : phase < 10 ? 'yellow' : 'red',
    z: phase >= 11 && phase < 19 ? 'green' : phase >= 19 && phase < 21 ? 'yellow' : 'red'
  };
}

export function trafficDistance(position, direction, distance, streets, state) {
  if (state === 'green') return distance;
  for (const street of streets) {
    const remaining = (street - direction * 2.25 - position) * direction;
    // 车头停在路口边缘外；已经越过停止线的车辆继续通过。
    if (remaining >= -1e-8) distance = Math.min(distance, Math.max(0, remaining));
  }
  return distance;
}
