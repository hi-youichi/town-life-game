// 纯时间策略，渲染器和测试共用；相机移动不绕过刷新间隔。
export function createRefreshGate(intervalMs) {
  let last=-Infinity;
  return {take(now,force=false) {
    if(!force&&now-last<intervalMs-.001) return false;
    last=now;return true;
  }};
}

export function createQualityController(compact) {
  const levels=[
    {name:'high',aoScale:compact?.6:.8,renderScale:1},
    {name:'ao-balanced',aoScale:compact?.45:.6,renderScale:1},
    {name:'balanced',aoScale:compact?.4:.5,renderScale:.85},
    {name:'performance',aoScale:compact?.35:.45,renderScale:.72}
  ];
  let level=0,elapsed=0,frames=0,slow=0,fast=0,lastChange=0,changes=0;
  function resetSamples(){elapsed=0;frames=0;slow=0;fast=0;}
  return {
    get settings(){return levels[level];},
    observe(frameMs,visible,now) {
      // 长间隔通常来自后台节流、切回窗口或截图，不参与降档判断。
      if(!visible||!Number.isFinite(frameMs)||frameMs<=0||frameMs>80) {resetSamples();return false;}
      elapsed+=frameMs;frames++;
      if(elapsed<1000) return false;
      const average=elapsed/frames;
      elapsed=0;frames=0;
      slow=average>20?slow+1:0;
      fast=average<17.5?fast+1:0;
      if(slow>=2&&level<levels.length-1&&now-lastChange>=3000) {
        level++;lastChange=now;changes++;resetSamples();return true;
      }
      if(fast>=8&&level>0&&now-lastChange>=8000) {
        level--;lastChange=now;changes++;resetSamples();return true;
      }
      return false;
    },
    resetSamples,
    diagnostics(){return {level,...levels[level],changes};}
  };
}
