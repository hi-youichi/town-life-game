import * as THREE from 'https://esm.sh/three@0.180.0';

export function setupCapture(root, renderer, render, isNight) {
  const button=root.querySelector('.three-house-photo');
  const toast=root.querySelector('.three-house-toast');
  let toastTimer;
  function notify(message) {
    clearTimeout(toastTimer); toast.textContent=message; toast.hidden=false;
    toastTimer=setTimeout(()=>{toast.hidden=true;},4000);
  }
  button.addEventListener('click',async()=>{
    button.disabled=true;
    const size=renderer.getSize(new THREE.Vector2()), ratio=renderer.getPixelRatio();
    let blobPromise;
    try {
      const scale=Math.min(2048/Math.max(size.x,size.y),3);
      renderer.setPixelRatio(1);
      renderer.setSize(Math.round(size.x*scale),Math.round(size.y*scale),false);
      render({capture:true});
      blobPromise=new Promise((resolve,reject)=>renderer.domElement.toBlob(blob=>blob?resolve(blob):reject(new Error('PNG 编码失败')),'image/png'));
    } catch(error) {
      console.error(error); notify('截图失败，请重试。');
    } finally {
      renderer.setPixelRatio(ratio); renderer.setSize(size.x,size.y,false); render();
    }
    try {
      if(blobPromise) {
        const blob=await blobPromise,url=URL.createObjectURL(blob),link=document.createElement('a');
        link.href=url; link.download=`town-${isNight()?'night':'day'}-${Date.now()}.png`;
        document.body.appendChild(link); link.click(); link.remove();
        setTimeout(()=>URL.revokeObjectURL(url),60000); notify('截图已生成。');
      }
    } catch(error) { console.error(error); notify('截图失败，请重试。'); }
    finally { button.disabled=false; }
  });
}
