import test from 'node:test';
import assert from 'node:assert/strict';
import {createRefreshGate,createQualityController} from '../src/performance-policy.js';

test('continuous 60 Hz frames keep shadow and reflection refresh bounded',()=>{
  for(const hz of [12,18,30]) {
    const gate=createRefreshGate(1000/hz);
    let updates=0;
    for(let frame=0;frame<600;frame++) if(gate.take(frame*1000/60))updates++;
    assert.ok(updates<=hz*10+1);
    assert.ok(updates>=hz*10*.8);
  }
});

test('scene discontinuities refresh immediately and restart the interval',()=>{
  const gate=createRefreshGate(1000/12);
  assert.equal(gate.take(0),true);
  assert.equal(gate.take(10),false);
  assert.equal(gate.take(10,true),true);
  assert.equal(gate.take(80),false);
  assert.equal(gate.take(94),true);
});

function feed(controller,delta,count,clock) {
  for(let i=0;i<count;i++){clock.now+=delta;controller.observe(delta,true,clock.now);}
}

test('40 FPS first reduces AO, then scales rendering with a bounded minimum',()=>{
  const quality=createQualityController(true),clock={now:0};
  feed(quality,25,120,clock);
  assert.equal(quality.settings.name,'ao-balanced');
  assert.equal(quality.settings.renderScale,1);
  feed(quality,25,120,clock);
  assert.equal(quality.settings.renderScale,.85);
  feed(quality,25,1200,clock);
  assert.equal(quality.settings.renderScale,.72);
});

test('short spikes and background throttling do not degrade or restore quality',()=>{
  const quality=createQualityController(false),clock={now:0};
  feed(quality,25,30,clock);
  feed(quality,100,100,clock);
  assert.equal(quality.settings.name,'high');
  feed(quality,25,120,clock);
  assert.equal(quality.settings.name,'ao-balanced');
  for(let i=0;i<1000;i++) quality.observe(16.67,false,clock.now+=16.67);
  assert.equal(quality.settings.name,'ao-balanced');
});

test('quality restores one step only after sustained healthy frames',()=>{
  const quality=createQualityController(false),clock={now:0};
  feed(quality,25,240,clock);
  assert.equal(quality.settings.name,'balanced');
  feed(quality,1000/60,300,clock);
  assert.equal(quality.settings.name,'balanced');
  feed(quality,1000/60,240,clock);
  assert.equal(quality.settings.name,'ao-balanced');
  feed(quality,1000/60,540,clock);
  assert.equal(quality.settings.name,'high');
});
