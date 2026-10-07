// Art direction: docs/references/character-design-directions-v1.png.
export const CHARACTER_STYLES = Object.freeze([
  { id:'cozy', letter:'A', label:'圆润治愈', description:'橙色外套 · 圆形背包',
    swatch:'#d77849', headScale:1, torsoScale:1, legScale:1, width:1,
    palette:{coat:0xdb794a,trim:0xc4653e,cream:0xf2e5cb,strap:0xe9dbbb,pants:0x385a66,pack:0x557e75,shoes:0x304c54,hair:0x493024,accent:0xc4653e,tee:0xf2e5cb} },
  { id:'adventure', letter:'B', label:'清爽冒险', description:'连帽外套 · 工装裤',
    swatch:'#85977b', headScale:.93, torsoScale:1.04, legScale:1.13, width:.97,
    palette:{coat:0x909c79,trim:0x768663,cream:0x8b9873,strap:0xc8a459,pants:0x9a8060,pack:0xcba45d,shoes:0xb56643,hair:0x493126,accent:0x806844,tee:0xf2e8d5} },
  { id:'urban', letter:'C', label:'精致潮流', description:'翻领衬衫 · 层次短发',
    swatch:'#e9dfc9', headScale:.88, torsoScale:1.10, legScale:1.23, width:.92,
    palette:{coat:0xe7dcc5,trim:0xd6cbb5,cream:0x466b69,strap:0x3c5552,pants:0x344f5b,pack:0xb96543,shoes:0xf2ead7,hair:0x493126,accent:0x466b69,tee:0xbb6947} },
]);

export function characterStyle(id) {
  return CHARACTER_STYLES.find(style=>style.id===id) || CHARACTER_STYLES[0];
}

export function savedCharacterStyle() {
  try { return characterStyle(localStorage.getItem('town-character-style')).id; }
  catch { return 'cozy'; }
}
