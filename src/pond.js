import * as THREE from 'https://esm.sh/three@0.180.0';

export function createPondShapes() {
  const water=new THREE.Shape();
  water.moveTo(-5.7,-1.8);
  water.bezierCurveTo(-6.8,-4.4,-2.8,-5.2,.1,-4.1);
  water.bezierCurveTo(3.5,-5.2,6.2,-2.8,5.6,.2);
  water.bezierCurveTo(6.8,2.8,2.8,4.9,-.2,3.8);
  water.bezierCurveTo(-3.2,5.2,-6.6,2.1,-5.7,-1.8);
  const shoreline=water.getSpacedPoints(96).slice(0,-1).map((point,i)=>{
    const width=.3+.23*(.5+.5*Math.sin(i*.22))+.13*(.5+.5*Math.cos(i*.47));
    return point.clone().addScaledVector(point.clone().normalize(),width);
  });
  const shore=new THREE.Shape(shoreline);shore.closePath();
  return {water,shore};
}
