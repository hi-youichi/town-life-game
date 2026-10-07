// 统计主动画循环的帧间隔，额外的渲染调用不会重复计入 FPS。
export function createFrameMonitor(element) {
  let startedAt = null;
  let frames = 0;
  let fps = null;
  let averageFrameMs = null;

  function reset() {
    startedAt = null;
    frames = 0;
    fps = null;
    averageFrameMs = null;
    element.textContent = 'FPS — · — ms';
  }

  // 后台 RAF 节流和切回前台的长间隔不纳入统计。
  document.addEventListener('visibilitychange', reset);
  reset();

  return {
    update(now) {
      if (document.hidden) return;
      if (startedAt === null) {
        startedAt = now;
        return;
      }
      frames++;
      const elapsed = now - startedAt;
      if (elapsed < 500) return;
      fps = frames * 1000 / elapsed;
      averageFrameMs = elapsed / frames;
      element.textContent = `FPS ${Math.round(fps)} · ${averageFrameMs.toFixed(1)} ms`;
      startedAt = now;
      frames = 0;
    },
    getState() { return { fps, averageFrameMs }; }
  };
}
