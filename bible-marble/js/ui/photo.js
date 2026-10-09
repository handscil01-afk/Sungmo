'use strict';
/* ================= 사진 말 만들기 =================
   기기에 있는 사진을 골라 동그란 점선 안에 맞춥니다. 점선 밖은 흐리고 어둡게, 안쪽만 선명하게 보여 줍니다.
   한 손가락으로 옮기고, 두 손가락으로 벌리거나 오므리고 돌려서 크기와 방향을 바꿉니다(PC는 휠·단추).
   결과는 128px 정사각형 JPEG로 줄여서 기기 안에만 저장하고, 함께하기에서는 방장이 같은 방 기기들에게만 나눠 줍니다. */
const PhotoCrop={
  OUT:128,     // 저장 크기(px)
  MAXLEN:7000, // 참가 기기가 방장에게 보내는 편지 한 통 크기 제한(8000자)보다 작게
  /* 파일 고르기 → 자르기 창 → 완성되면 done('@'+번호) */
  pick(done){const inp=document.createElement('input');inp.type='file';inp.accept='image/*';inp.style.display='none';document.body.appendChild(inp);
    inp.onchange=()=>{const f=inp.files&&inp.files[0];inp.remove();if(f)this.load(f).then(img=>this.edit(img,done)).catch(()=>UI.toast('사진을 열 수 없어요. 다른 사진을 골라 주세요'))};
    inp.click()},
  /* 큰 사진은 먼저 1024px 안쪽으로 줄여서 움직임이 버벅이지 않게 합니다 */
  load(file){return new Promise((res,rej)=>{const url=URL.createObjectURL(file),im=new Image();
    im.onload=()=>{const k=Math.min(1,1024/Math.max(im.naturalWidth,im.naturalHeight)),c=document.createElement('canvas');
      c.width=Math.max(1,Math.round(im.naturalWidth*k));c.height=Math.max(1,Math.round(im.naturalHeight*k));c.getContext('2d').drawImage(im,0,0,c.width,c.height);URL.revokeObjectURL(url);res(c)};
    im.onerror=()=>{URL.revokeObjectURL(url);rej(new Error('img'))};im.src=url})},
  edit(src,done){
    const url=src.toDataURL('image/jpeg',.9),W=src.width,H=src.height;
    const L=openLayer('edit',`<div class="kick">📷 내 사진으로 말 만들기</div><h3>동그라미 안에 얼굴을 맞춰 주세요</h3>
      <div class="crop" id="crop"><img class="cb" src="${url}" alt="" draggable="false"><div class="csw"><img class="cs" src="${url}" alt="" draggable="false"></div><div class="ring"></div></div>
      <p class="ref cropnote">두 손가락으로 벌리면 커지고, 오므리면 작아지고, 돌리면 함께 돌아가요. 한 손가락으로 옮길 수 있어요.</p>
      <div class="croptools"><button class="btn" data-z="-1" aria-label="작게">➖</button><button class="btn" data-z="1" aria-label="크게">➕</button><button class="btn" data-r="-1" aria-label="왼쪽으로 돌리기">⟲</button><button class="btn" data-r="1" aria-label="오른쪽으로 돌리기">⟳</button><button class="btn" data-fit>처음대로</button></div>
      <div class="mbtns row"><button class="btn wide" data-c>취소</button><button class="btn main wide" data-ok>✅ 이 사진으로</button></div>`,{tone:'#86d5ea',wide:true});
    const box=$('#crop',L.box),imgs=$$('#crop img',L.box);
    const S=()=>box.clientWidth,R=()=>S()*.4;   // 동그라미 반지름 = 상자 폭의 40%
    imgs.forEach(i=>{i.style.width=W+'px';i.style.height=H+'px'});
    const st={x:0,y:0,s:1,r:0};
    const fit=()=>{st.x=0;st.y=0;st.r=0;st.s=2*R()/Math.min(W,H);draw()};
    const draw=()=>{st.s=Math.max(.02,Math.min(st.s,40));const t=`translate(-50%,-50%) translate(${st.x}px,${st.y}px) rotate(${st.r}rad) scale(${st.s})`;imgs.forEach(i=>i.style.transform=t)};
    /* 손가락 따라가기 */
    const pts=new Map();let g0=null;
    const snap=()=>{const a=[...pts.values()];if(a.length>=2){const[p,q]=a;g0={d:Math.hypot(q.x-p.x,q.y-p.y)||1,a:Math.atan2(q.y-p.y,q.x-p.x),mx:(p.x+q.x)/2,my:(p.y+q.y)/2,...st}}
      else if(a.length===1)g0={mx:a[0].x,my:a[0].y,...st};else g0=null};
    box.addEventListener('pointerdown',e=>{e.preventDefault();box.setPointerCapture(e.pointerId);pts.set(e.pointerId,{x:e.clientX,y:e.clientY});snap()});
    box.addEventListener('pointermove',e=>{if(!pts.has(e.pointerId)||!g0)return;pts.set(e.pointerId,{x:e.clientX,y:e.clientY});const a=[...pts.values()];
      if(a.length>=2&&g0.d){const[p,q]=a,d=Math.hypot(q.x-p.x,q.y-p.y)||1,an=Math.atan2(q.y-p.y,q.x-p.x),mx=(p.x+q.x)/2,my=(p.y+q.y)/2;
        st.s=g0.s*d/g0.d;st.r=g0.r+(an-g0.a);st.x=g0.x+(mx-g0.mx);st.y=g0.y+(my-g0.my)}
      else{st.x=g0.x+(a[0].x-g0.mx);st.y=g0.y+(a[0].y-g0.my)}
      draw()});
    const up=e=>{pts.delete(e.pointerId);snap()};box.addEventListener('pointerup',up);box.addEventListener('pointercancel',up);
    box.addEventListener('wheel',e=>{e.preventDefault();st.s*=Math.exp(-e.deltaY*.0015);draw()},{passive:false});
    $$('[data-z]',L.box).forEach(b=>b.onclick=()=>{st.s*=+b.dataset.z>0?1.15:1/1.15;draw()});
    $$('[data-r]',L.box).forEach(b=>b.onclick=()=>{st.r+=+b.dataset.r*Math.PI/12;draw()});
    $('[data-fit]',L.box).onclick=fit;$('[data-c]',L.box).onclick=L.close;
    $('[data-ok]',L.box).onclick=()=>{const d=this.render(src,st,R());if(!d)return UI.toast('사진을 만들지 못했어요');
      const id=uid('').replace(/[^a-z0-9]/g,'').slice(-6).padStart(6,'0');if(!savePhoto(id,d))return UI.toast('사진을 저장하지 못했어요');L.close();done('@'+id)};
    requestAnimationFrame(fit)},
  /* 동그라미 안쪽을 그대로 작은 정사각형 그림으로 옮깁니다 (화면에서 보이는 모습과 같게) */
  render(src,st,r){const O=this.OUT,c=document.createElement('canvas');c.width=c.height=O;const x=c.getContext('2d');
    x.fillStyle='#fff';x.fillRect(0,0,O,O);x.translate(O/2,O/2);x.scale(O/(2*r),O/(2*r));x.translate(st.x,st.y);x.rotate(st.r);x.scale(st.s,st.s);
    x.imageSmoothingQuality='high';x.drawImage(src,-src.width/2,-src.height/2);
    for(let q=.85;q>=.3;q-=.1){const d=c.toDataURL('image/jpeg',q);if(d.length<this.MAXLEN)return d}
    return null}};
