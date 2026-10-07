import { CHARACTER_STYLES } from './character-styles.js';

export function setupCharacterPicker(root,character,onChange) {
  const picker=root.querySelector('.three-house-character'),choices=picker.querySelector('.character-choices');
  const current=picker.querySelector('.character-current');
  for(const style of CHARACTER_STYLES) {
    const button=document.createElement('button');button.type='button';button.dataset.character=style.id;
    button.setAttribute('aria-label',`${style.letter} ${style.label}`);
    const swatch=document.createElement('span');swatch.className='character-swatch';swatch.style.background=style.swatch;swatch.textContent=style.letter;
    const text=document.createElement('span'),name=document.createElement('strong'),description=document.createElement('small');
    name.textContent=style.label;description.textContent=style.description;text.append(name,description);button.append(swatch,text);
    button.addEventListener('click',()=>{
      if(character.setStyle(style.id))onChange();
      try{localStorage.setItem('town-character-style',style.id);}catch{/* Private browser storage may be unavailable. */}
      sync();picker.open=false;
      picker.querySelector('summary').focus({preventScroll:true});
    });choices.append(button);
  }
  function sync() {
    const id=character.diagnostics().variant,style=CHARACTER_STYLES.find(s=>s.id===id);
    root.dataset.character=id;current.textContent=style.label;
    for(const button of choices.children)button.setAttribute('aria-pressed',String(button.dataset.character===id));
  }
  root.addEventListener('keydown',e=>{if(e.key==='Escape'&&picker.open){picker.open=false;picker.querySelector('summary').focus();}});
  document.addEventListener('pointerdown',e=>{if(picker.open&&!picker.contains(e.target))picker.open=false;});
  sync();
}
