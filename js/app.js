/* ---- غیرفعال‌کردن زوم و کپی ---- */
(function(){const pd=e=>{if(e.target&&e.target.tagName==="INPUT")return;e.preventDefault()};
["copy","cut","contextmenu","selectstart","dragstart","gesturestart","gesturechange","gestureend","dblclick"].forEach(n=>document.addEventListener(n,pd,{passive:false}));
document.addEventListener("touchmove",e=>{if(e.touches.length>1)e.preventDefault()},{passive:false});
document.addEventListener("wheel",e=>{if(e.ctrlKey)e.preventDefault()},{passive:false});
document.addEventListener("keydown",e=>{if((e.ctrlKey||e.metaKey)&&"cxauspv=-+0".includes(e.key.toLowerCase())&&!(e.target.tagName=="INPUT"&&"vzcxa".includes(e.key)))e.preventDefault()})})();

/* ---- Motion blur: بلور جهت‌دار SVG بر اساس سرعت واقعی حرکت ---- */
const MB=(()=>{const NS="http://www.w3.org/2000/svg",reduce=matchMedia("(prefers-reduced-motion:reduce)").matches;let defs=null,n=0;
 const init=()=>{if(defs)return;const s=document.createElementNS(NS,"svg");s.setAttribute("width","0");s.setAttribute("height","0");s.style.cssText="position:absolute;pointer-events:none";defs=document.createElementNS(NS,"defs");s.appendChild(defs);document.body.appendChild(s)};
 const make=el=>{init();const f=document.createElementNS(NS,"filter"),id="mb"+(++n),g=document.createElementNS(NS,"feGaussianBlur");f.id=id;f.setAttribute("x","-30%");f.setAttribute("y","-30%");f.setAttribute("width","160%");f.setAttribute("height","160%");f.setAttribute("color-interpolation-filters","sRGB");g.setAttribute("stdDeviation","0 0");f.appendChild(g);defs.appendChild(f);return el._mb={id,g,on:false,run:false}};
 function watch(el,o){if(!el||reduce)return;o=o||{};const m=el._mb||make(el);if(m.run)return;
  const k=o.k||.2,mx=o.max||12,grace=o.grace==null?450:o.grace,idle=o.idle||10,pos=o.pos||(()=>{const r=el.getBoundingClientRect();return[r.left,r.top]});
  let[px,py]=pos(),vx=0,vy=0,still=0;const t0=performance.now();m.run=true;
  const tick=()=>{const[x,y]=pos();vx+=(Math.abs(x-px)-vx)*.3;vy+=(Math.abs(y-py)-vy)*.3;px=x;py=y;
   const sx=Math.min(mx,vx*k),sy=Math.min(mx,vy*k),t=performance.now()-t0;
   if(sx>.3||sy>.3){m.g.setAttribute("stdDeviation",sx.toFixed(2)+" "+sy.toFixed(2));if(!m.on){el.style.filter="url(#"+m.id+")";m.on=true}still=0}
   else{if(m.on){el.style.filter="";m.on=false}still++}
   if(t>(o.dur||3000)||(t>grace&&still>idle)){if(m.on){el.style.filter="";m.on=false}m.run=false;return}
   requestAnimationFrame(tick)};requestAnimationFrame(tick)}
 return{watch}})();

/* ---- چرخ ماوس روی ردیف (lookmv): هر «ژست» یا کاملاً افقی است یا کاملاً صفحه ---- */
document.addEventListener("wheel",e=>{
 if(e.ctrlKey||!e.target.closest)return;const r=e.target.closest(".row");if(!r)return;
 if(Math.abs(e.deltaX)>Math.abs(e.deltaY))return;
 const max=r.scrollWidth-r.clientWidth;if(max<2)return;
 const now=performance.now(),pos=Math.min(max,Math.abs(r.scrollLeft)),f=e.deltaY>0;
 /* ژست = رویدادهای نزدیک‌تر از 220ms (شامل اینرسی تاچ‌پد)؛ حالت فقط یک بار برای هر ژست تعیین می‌شود */
 if(now-(r._lw||0)>220){r._mode=(f?pos>=max-1:pos<=1)?"page":"row"}
 r._lw=now;
 if(r._mode==="page"){r._t=undefined;return}
 e.preventDefault();
 const cur=r._t??pos;
 r._t=Math.min(max,Math.max(0,cur+e.deltaY*(e.deltaMode===1?32:e.deltaMode===2?innerHeight:1)));
 if(!r._raf)r._raf=requestAnimationFrame(function st(){
  if(r._t==null){r._raf=0;return}
  const p=r.scrollLeft,d=r._t-p;
  if(Math.abs(d)<.6){r.scrollLeft=r._t;r._raf=0;r._t=undefined;return}
  r.scrollLeft=p+d*.2;r._raf=requestAnimationFrame(st)})
},{passive:false});

/* ---- هاور کارت‌ها حین اسکرول: موقعیت موس را هر فریم دوباره می‌سنجیم (مرورگر حین اسکرول :hover را به‌روز نمی‌کند) ---- */
(function(){let mx=-1,my=-1,cur=null,raf=0;
const set=c=>{if(c===cur)return;cur&&cur.classList.remove("hov");cur=c;cur&&cur.classList.add("hov")};
const upd=()=>{raf=0;if(mx<0){set(null);return}const el=document.elementFromPoint(mx,my);set(el&&el.closest?el.closest(".card"):null)};
const q=()=>{if(!raf)raf=requestAnimationFrame(upd)};
document.addEventListener("pointermove",e=>{if(e.pointerType!=="mouse")return;mx=e.clientX;my=e.clientY;q()});
document.documentElement.addEventListener("mouseleave",()=>{mx=-1;q()});
document.addEventListener("scroll",q,true);
document.addEventListener("wheel",q,{passive:true});
document.addEventListener("pointerdown",e=>{if(e.pointerType!=="mouse")set(null)});
})();

/* ---- درگ‌کردن ردیف‌ها با ماوس (دسکتاپ) ---- */
(function(){let r=null,x=0,s=0,m=false;
document.addEventListener("pointerdown",e=>{m=false;if(e.pointerType!=="mouse"||e.button)return;r=e.target.closest&&e.target.closest(".row");if(r){x=e.clientX;s=r.scrollLeft}});
addEventListener("pointermove",e=>{if(!r)return;const dx=e.clientX-x;if(!m&&Math.abs(dx)>5){m=true;r.style.scrollSnapType="none"}if(m)r.scrollLeft=s-dx});
addEventListener("pointerup",()=>{if(r)r.style.scrollSnapType="";r=null});
document.addEventListener("click",e=>{if(m){e.stopPropagation();e.preventDefault();m=false}},true)})();

const{useState,useEffect,useRef,useContext}=React,h=React.createElement;
const I={home:'<path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
radio:'<g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="2.2" fill="currentColor"/><path d="M8.6 8.6a5 5 0 0 0 0 6.8M15.4 8.6a5 5 0 0 1 0 6.8M5.7 5.7a9 9 0 0 0 0 12.6M18.3 5.7a9 9 0 0 1 0 12.6"/></g>',
lib:'<rect x="3.5" y="9" width="17" height="12" rx="2.4"/><path d="M7 5h10M5.5 7h13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M13.6 12v4a1.7 1.7 0 1 1-1.2-1.6v-3.2l3.4-.8v1.4z" fill="rgba(0,0,0,.85)"/>',
search:'<g fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.3"/><path d="m15.4 15.4 5 5"/></g>',
play:'<path d="M7 4.5v15l13-7.5z"/>',pause:'<path d="M6 4h4.5v16H6zM13.5 4H18v16h-4.5z"/>',
ff:'<path d="M2.5 5v14l9-7zM12.5 5v14l9-7z"/>',rw:'<path d="M21.5 5v14l-9-7zM11.5 5v14l-9-7z"/>',
note:'<path d="M9 17V6l11-2v11" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="6.5" cy="17.5" r="2.8"/><circle cx="17.5" cy="15.5" r="2.8"/>',
chev:'<path d="m9 5 7 7-7 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>',
back:'<path d="m15 5-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
more:'<circle cx="5" cy="12" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="19" cy="12" r="1.9"/>',
list:'<path d="M4 6h11M4 12h11M4 18h7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="18" cy="17" r="2.6"/>',
mic:'<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 18v3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
vol:'<path d="M4 9v6h4l5 4V5L8 9z"/>'};
const Ic=(n,c)=>h("svg",{viewBox:"0 0 24 24",className:"ic "+(c||""),dangerouslySetInnerHTML:{__html:I[n]}});

/* آهنگ‌ها: به‌جای synth می‌توانید src:"https://.../song.mp3" بگذارید */
const T=[{t:"Midnight Drive",a:"Nova Lane",h:265,b:174,m:0,s:.22,d:5},{t:"Soft Rain",a:"Mira Sol",h:200,b:220,m:0,s:.42,d:7},{t:"Golden Hour",a:"The Marlows",h:35,b:294,m:1,s:.3,d:33},{t:"Coastline",a:"Aria Blue",h:170,b:262,m:1,s:.5,d:21},{t:"Neon Pulse",a:"Kairo",h:320,b:196,m:0,s:.26,d:99},{t:"Desert Wind",a:"Sahar",h:18,b:233,m:0,s:.55,d:12},{t:"Paper Planes",a:"Juno & Co",h:95,b:330,m:1,s:.24,d:48},{t:"Slow Train",a:"Elm Street",h:350,b:165,m:0,s:.2,d:61}];
const SC=[[0,3,5,7,10],[0,2,4,7,9]];
function synth(o){const sr=11025,N=24,L=Math.floor(o.s*sr),n=L*N,p=new Float32Array(n);let s=o.d,ix=3;const r=()=>(s=(s*1664525+1013904223)%4294967296)/4294967296,sc=SC[o.m];
for(let k=0;k<N;k++){ix=Math.max(0,Math.min(9,ix+Math.round((r()-.5)*4)));const f=o.b*Math.pow(2,(sc[ix%5]+12*Math.floor(ix/5))/12);
for(let i=0;i<L;i++){const t=i/sr;let v=(Math.sin(6.2832*f*t)+.3*Math.sin(12.566*f*t))*Math.exp(-t*3.2)*.45;if(k%4==0)v+=Math.sin(3.1416*o.b*t)*Math.exp(-t*1.4)*.4;p[k*L+i]=Math.max(-1,Math.min(1,p[k*L+i]+v))}}
const b=new ArrayBuffer(44+n*2),d=new DataView(b),w=(q,x)=>[...x].forEach((c,i)=>d.setUint8(q+i,c.charCodeAt(0)));
w(0,"RIFF");d.setUint32(4,36+n*2,1);w(8,"WAVEfmt ");d.setUint32(16,16,1);d.setUint16(20,1,1);d.setUint16(22,1,1);d.setUint32(24,sr,1);d.setUint32(28,sr*2,1);d.setUint16(32,2,1);d.setUint16(34,16,1);w(36,"data");d.setUint32(40,n*2,1);
p.forEach((v,i)=>d.setInt16(44+i*2,v*32767,1));const u=new Uint8Array(b);let z="";for(let i=0;i<u.length;i+=8192)z+=String.fromCharCode.apply(null,u.subarray(i,i+8192));return"data:audio/wav;base64,"+btoa(z)}
const au=new Audio();
const grad=o=>`linear-gradient(145deg,hsl(${o.h} 62% 50%),hsl(${o.h+40} 55% 22%))`;
const fmt=s=>isFinite(s)&&s>0?Math.floor(s/60)+":"+String(Math.floor(s%60)).padStart(2,"0"):"0:00";
const rs=i=>({className:"rise",style:{"--d":i}});
/* کاور آهنگ: اگر در T فیلد cover:"https://.../cover.jpg" بگذارید همان استفاده می‌شود؛ وگرنه یک کاور تولیدی (SVG) ساخته می‌شود */
function cover(o){
 if(o.cover)return o.cover;if(o._cv)return o._cv;
 let s=(o.d||1)*7919+13;const r=()=>(s=(s*16807)%2147483647)/2147483647;
 const H=o.h,A=`hsl(${H} 72% 58%)`,B=`hsl(${(H+45)%360} 62% 20%)`,C=`hsl(${(H+180)%360} 85% 66%)`,D=`hsl(${(H+25)%360} 90% 72%)`;
 let g=`<defs><linearGradient id='a' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${A}'/><stop offset='1' stop-color='${B}'/></linearGradient><radialGradient id='b' cx='.25' cy='.15' r='.85'><stop offset='0' stop-color='white' stop-opacity='.38'/><stop offset='1' stop-color='white' stop-opacity='0'/></radialGradient></defs><rect width='400' height='400' fill='url(#a)'/>`;
 if(o.m){
  g+=`<circle cx='${150+r()*100}' cy='${120+r()*70}' r='${70+r()*30}' fill='${D}' opacity='.9'/>`;
  for(let i=0;i<4;i++){const y=230+i*45+r()*10;g+=`<path d='M0 ${y} Q100 ${y-34} 200 ${y} T400 ${y} V400 H0Z' fill='hsl(${(H+30+i*12)%360} 55% ${34-i*7}%)' opacity='.75'/>`}
 }else{
  for(let i=0;i<5;i++)g+=`<circle cx='${r()*400}' cy='${r()*400}' r='${40+r()*110}' fill='${i%2?C:D}' opacity='${.16+r()*.2}'/>`;
  const cx=120+r()*160,cy=120+r()*160;
  for(let i=1;i<5;i++)g+=`<circle cx='${cx}' cy='${cy}' r='${i*28}' fill='none' stroke='white' stroke-opacity='${.5-i*.09}' stroke-width='3'/>`;
 }
 g+=`<rect width='400' height='400' fill='url(#b)'/>`;
 return o._cv="data:image/svg+xml;utf8,"+encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 400'>${g}</svg>`)}
const cssUrl=o=>`url("${cover(o)}")`;
const Art=(o,c,extra)=>h("div",{className:"art "+(c||""),style:o?{backgroundColor:"#2a2a2e",backgroundImage:cssUrl(o),backgroundSize:"cover",backgroundPosition:"center"}:{background:"#2a2a2e"}},o?null:Ic("note"));
/* پس‌زمینه‌ی پلیر: همان کاور با بلور، با محو شدن نرم بین آهنگ‌ها */
function Backdrop({o}){
 const[L,setL]=useState(()=>o?[o]:[]);
 useEffect(()=>{if(!o)return;setL(p=>p[p.length-1]===o?p:[...p.slice(-1),o]);const t=setTimeout(()=>setL(p=>p.slice(-1)),1100);return()=>clearTimeout(t)},[o]);
 return h("div",{className:"bgc"},L.map(x=>h("div",{key:x.t,className:"bgi",style:{backgroundImage:cssUrl(x)}})),h("div",{className:"bgs"}))}

function RowBox({children}){const rf=useRef(null);
 useEffect(()=>{const r=rf.current;
  const f=()=>{const max=r.scrollWidth-r.clientWidth,x=r.scrollLeft;r.classList.toggle("fl",max>2&&x>1);r.classList.toggle("fr",max>2&&max-x>1)};
  f();const ro=new ResizeObserver(f);ro.observe(r);r.addEventListener("scroll",f,{passive:true});addEventListener("load",f);
  return()=>{ro.disconnect();r.removeEventListener("scroll",f);removeEventListener("load",f)}},[]);
 return h("div",{ref:rf,className:"row"},children)}
/* بخش با ظاهر شدن تدریجی هنگام اسکرول عمودی (IntersectionObserver مثل lookmv) */
function RV({children}){const el=useRef(null);
 useEffect(()=>{const n=el.current;if(!("IntersectionObserver"in window)){n.classList.add("in");return}
  const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){n.classList.add("in");io.disconnect()}}),{root:n.closest(".scroll"),threshold:.12,rootMargin:"0px 0px -6% 0px"});
  io.observe(n);return()=>io.disconnect()},[]);
 return h("section",{ref:el,className:"rv2"},children)}
function Screen({title,right,back,onBack,onDir,children,cls}){
 const[y,setY]=useState(0),last=useRef(0);
 const sc=e=>{const v=e.target.scrollTop;setY(v);if(v>90&&v>last.current+5)onDir(true);else if(v<last.current-5||v<40)onDir(false);last.current=v};
 return h("div",{className:"screen "+(cls||"")},
  h("div",{className:"tb"},back?h("button",{className:"circ press",onClick:onBack,"aria-label":"Back"},Ic("back")):h("span"),
   h("div",{className:"st",style:{opacity:y>46?1:0,transform:y>46?"none":"translateY(8px)"}},title),right),
  h("div",{className:"scroll",onScroll:sc},h("h1",rs(0),title),children));
}
/* ---- حساب کاربر: دایره‌ی پروفایل (دو حرف اول نام) منو را باز می‌کند ---- */
const UserCtx=React.createContext(null);
const ini=n=>Array.from(String(n||"").trim()).slice(0,2).join("").toUpperCase()||"?";
function Av(){const c=useContext(UserCtx);
 return h("button",{className:"circ av",onClick:()=>c&&c.openMenu(),"aria-label":"Profile","aria-haspopup":"menu"},c&&c.user?ini(c.user.name):"?")}
const Card=(o,i,play)=>h("button",{key:i,className:"card press",style:{"--i":i},onClick:()=>play(T.indexOf(o))},Art(o),h("b",null,o.t),h("small",null,o.a));
const Row=(title,items,play,d)=>h(RV,{key:title},h("h2",null,title),h(RowBox,null,items.map((o,i)=>Card(o,i,play))));

function Home({play,onDir}){return h(Screen,{title:"Home",right:h(Av),onDir},
 Row("Recently Added",T,play,1),Row("Made for You",[...T].reverse(),play,2),
 Row("Top Charts",T.slice(3).concat(T.slice(0,3)),play,3))}
function Radio({play,onDir}){return h(Screen,{title:"Radio",right:h(Av),onDir},
 h("div",{className:"grid"},T.slice(0,6).map((o,i)=>h("button",{key:i,className:"tile press rise",style:{"--d":i+1,background:`linear-gradient(145deg,hsl(${o.h} 30% 17%),#000)`},onClick:()=>play(i)},Ic("note")))),
 h("section",rs(7),h("h2",null,"Listen to Live Radio for Free"),h(RowBox,null,["Apple Music 1","Apple Music Hits","Apple Music Country"].map((n,i)=>h("button",{key:i,className:"live press",style:{"--g":grad(T[i*2])},onClick:()=>play(i*2)},h("small",null,"music 1 · 20:30–21:30"),h("b",null,n),h("p",null,"The world’s best new music is on "+n+".")))) ),
 Row("Subscribe to Play Episodes ›",[...T].reverse(),play,8))}
function Library({play,onDir,cur}){
 const[sub,setSub]=useState(null),[out,setOut]=useState(false);
 const close=()=>{setOut(true);setTimeout(()=>{setSub(null);setOut(false)},700)};
 useEffect(()=>{if(sub)MB.watch(document.querySelector(".subs"),{k:.16,max:14,grace:300})},[sub,out]);
 const items=[["Playlists","list"],["Artists","mic"],["Albums","lib"],["Songs","note"]];
 return h("div",{className:"screen"},
  h(Screen,{title:"Library",right:h(Av),onDir,cls:"inner"},h("div",{className:"list"},items.map((it,i)=>h("button",{key:i,className:"li press rise",style:{"--d":i+1},onClick:()=>setSub(it[0])},Ic(it[1],"r"),it[0],Ic("chev","ch"))))),
  sub&&h("div",{className:"screen subs",style:{background:"var(--bg)",animation:(out?"outR":"inR")+" .7s cubic-bezier(.32,.72,0,1) both",zIndex:8}},
   h(Screen,{title:sub,back:1,onBack:close,right:h("div",{className:"circ"},Ic("more")),onDir,cls:"inner"},
    sub==="Playlists"?h(PlaylistsView,{play,cur}):h("div",{className:"list"},T.map((o,i)=>h("button",{key:i,className:"li press rise "+(cur==i?"on":""),style:{"--d":i},onClick:()=>play(i)},Art(o),h("div",{className:"t"},h("b",null,sub=="Artists"?o.a:o.t),h("small",null,sub=="Artists"?"Artist":o.a)),Ic("more","ch")))))))}
function Search({play,onDir}){const[q,setQ]=useState("");const r=T.filter(o=>(o.t+o.a).toLowerCase().includes(q.toLowerCase()));
 return h(Screen,{title:"Search",right:h(Av),onDir},
  h("div",{className:"search rise",style:{"--d":1}},Ic("search"),h("input",{value:q,placeholder:"Artists, Songs, Lyrics…",onChange:e=>setQ(e.target.value)})),
  q?h("div",{className:"list"},r.map((o,i)=>h("button",{key:o.t,className:"li press rise",style:{"--d":i},onClick:()=>play(T.indexOf(o))},Art(o),h("div",{className:"t"},h("b",null,o.t),h("small",null,o.a)))))
   :h("div",{className:"grid",style:{gridTemplateColumns:"1fr 1fr"}},["Pop","Rock","Chill","Electronic","Classical","Hip-Hop"].map((g,i)=>h("div",{key:g,className:"gen press rise",style:{"--d":i+2,background:grad(T[i])}},g))))}

/* ---- کنترل صدا: موج‌های بلندگو با سطح صدا عوض می‌شوند، اسلایدر نرم و فنری است، حباب درصد، و قطع/وصل با محو شدن ---- */
let VOL=.8;
const WV=["M15.5 9.5a3.5 3.5 0 0 1 0 5","M18 7a7 7 0 0 1 0 10","M20.5 4.5a10.5 10.5 0 0 1 0 15"];
function Volume(){
 const[v,setV]=useState(VOL),[drag,setDrag]=useState(false),[st,setSt]=useState(0);
 const bar=useRef(null),anim=useRef(0),dr=useRef(false),fade=useRef(false),cur=useRef(VOL),last=useRef(VOL||.8);
 const RM=matchMedia("(prefers-reduced-motion:reduce)").matches;
 useEffect(()=>{au.volume=VOL;return()=>cancelAnimationFrame(anim.current)},[]);
 const apply=x=>{x=Math.max(0,Math.min(1,x));cur.current=VOL=x;au.volume=x;if(x>.01&&!fade.current)last.current=x;setV(x)};
 const glide=(to,dur)=>{cancelAnimationFrame(anim.current);const from=cur.current;if(RM||!dur){apply(to);return}
  const t0=performance.now(),step=t=>{const p=Math.min(1,(t-t0)/dur),e=1-Math.pow(1-p,3);apply(from+(to-from)*e);if(p<1)anim.current=requestAnimationFrame(step)};
  anim.current=requestAnimationFrame(step)};
 const raw=e=>{const r=bar.current.getBoundingClientRect();return(e.clientX-r.left)/r.width};
 const down=e=>{e.currentTarget.setPointerCapture(e.pointerId);dr.current=true;fade.current=false;setDrag(true);glide(Math.max(0,Math.min(1,raw(e))),150)};
 const move=e=>{if(!dr.current)return;const r=raw(e);cancelAnimationFrame(anim.current);apply(r);setSt(r>1?r-1:r<0?r:0)};
 const up=()=>{if(!dr.current)return;dr.current=false;setDrag(false);setSt(0)};
 const toggle=()=>{if(cur.current>.01){fade.current=true;glide(0,380)}else{fade.current=false;glide(last.current||.8,380)}};
 const key=e=>{const d={ArrowRight:.05,ArrowUp:.05,ArrowLeft:-.05,ArrowDown:-.05}[e.key];
  if(d!=null){e.preventDefault();fade.current=false;glide(cur.current+d,120)}
  else if(e.key==="Home"){e.preventDefault();glide(0,200)}else if(e.key==="End"){e.preventDefault();fade.current=false;glide(1,200)}};
 const wheel=e=>{fade.current=false;glide(cur.current-Math.sign(e.deltaY)*.04,90)};
 const lvl=v<.005?0:v<.34?1:v<.67?2:3,pct=Math.round(v*100),sx=1+Math.min(.06,Math.abs(st)*.25);
 return h("div",{className:"vol"},
  h("button",{className:"vbtn",onClick:toggle,"aria-label":lvl?"Mute":"Unmute"},
   h("svg",{viewBox:"0 0 24 24",className:"sp"},
    h("path",{d:"M4 9v6h4l5 4V5L8 9z",fill:"currentColor"}),
    WV.map((d,i)=>h("path",{key:i,className:"w",d,style:{"--k":i,opacity:lvl>i?1:0,transform:lvl>i?"none":"scale(.5)"}})),
    h("path",{className:"sl",d:"M4 4 20 20",style:{strokeDashoffset:lvl?24:0}}))),
  h("div",{className:"vtrack"+(drag?" drag":""),role:"slider",tabIndex:0,"aria-label":"Volume","aria-valuemin":0,"aria-valuemax":100,"aria-valuenow":pct,style:{"--v":v},
   onPointerDown:down,onPointerMove:move,onPointerUp:up,onPointerCancel:up,onKeyDown:key,onWheel:wheel},
   h("div",{ref:bar,className:"vbar",style:{transform:`scale(${sx},${1-(sx-1)*.6})`,transformOrigin:st<0?"right center":"left center"}},h("div",{className:"vfill"})),
   h("div",{className:"vbub"},pct+"%")))}

function Sheet({open,setOpen,cur,pl,toggle,go,tm,onPlaylist}){
 const el=useRef(null),st=useRef(null),o=T[cur]||null;
 const dn=e=>{st.current=e.clientY;e.currentTarget.setPointerCapture(e.pointerId)};
 const mv=e=>{if(st.current==null)return;const dy=Math.max(0,e.clientY-st.current);el.current.style.transition="none";el.current.style.transform=`translateY(${dy}px)`};
 const up=e=>{if(st.current==null)return;const dy=e.clientY-st.current;st.current=null;el.current.style.transition="";el.current.style.transform="";if(dy>110)setOpen(false)};
 const pct=tm.d?tm.t/tm.d*100:0;
 return h("div",{ref:el,className:"sheet"+(open?" open":"")},
  h("button",{className:"close",onClick:()=>setOpen(false),"aria-label":"Close"},Ic("back")),
  h(Backdrop,{o}),
  h("div",{onPointerDown:dn,onPointerMove:mv,onPointerUp:up,onPointerCancel:up,style:{paddingBottom:14,touchAction:"none"}},h("div",{className:"grab"}),Art(o,"big "+(pl?"":"pp"))),
  h("div",{className:"meta"},h("b",null,o?o.t:"Not Playing"),h("small",null,o?o.a:"")),
  h("div",{style:{marginTop:18}},h("input",{type:"range",min:0,max:100,step:.1,value:pct,style:{"--p":pct+"%"},"aria-label":"Seek",onChange:e=>{if(au.duration)au.currentTime=e.target.value/100*au.duration}}),h("div",{className:"tm"},h("span",null,fmt(tm.t)),h("span",null,"-"+fmt(tm.d-tm.t)))),
  h("div",{className:"ctlrow"},h(SpeedBtn),h("div",{className:"ctl"},h("button",{onClick:()=>go(-1),"aria-label":"Previous"},Ic("rw")),h("button",{className:"pl",onClick:toggle,"aria-label":"Play or pause"},Ic(pl?"pause":"play")),h("button",{onClick:()=>go(1),"aria-label":"Next"},Ic("ff"))),h(ShareBtn,{o,onPlaylist})),
  h(Volume))}

function App(){
 const[tab,setTab]=useState(0),[cur,setCur]=useState(-1),[pl,setPl]=useState(false),[open,setOpen]=useState(false),[col,setCol]=useState(false),[tm,setTm]=useState({t:0,d:0}),[plFor,setPlFor]=useState(null);
 useEffect(()=>{au.onplay=()=>setPl(true);au.onpause=()=>setPl(false);au.ontimeupdate=()=>setTm({t:au.currentTime,d:au.duration||0});au.onended=()=>go(1)},[]);
 const cr=useRef(-1);cr.current=cur;
 useEffect(()=>()=>{au.pause()},[]);
 useEffect(()=>{const k=e=>{const t=e.target.tagName;if(t==="INPUT"&&e.target.type!=="range")return;
  if(e.key==="Escape")setOpen(false);
  else if(e.code==="Space"&&t!=="BUTTON"){e.preventDefault();cr.current<0?play(0):au.paused?au.play():au.pause()}};
  document.addEventListener("keydown",k);return()=>document.removeEventListener("keydown",k)},[]);
 useEffect(()=>{["mini","tabs"].forEach(c=>MB.watch(document.querySelector(".dock ."+c),{k:.22,max:8}))},[col]);
 useEffect(()=>{MB.watch(document.querySelector(".sheet"),{k:.12,max:14})},[open]);
 useEffect(()=>{MB.watch(document.querySelector(".tabs .hl"),{k:.22,max:9})},[tab]);
 function play(i){i=(i+T.length)%T.length;if(i===cr.current){au.paused?au.play():au.pause();return}const o=T[i];o.src=o.src||synth(o);au.src=o.src;au.play().catch(()=>{});setCur(i);cr.current=i}
 function go(d){play((cr.current<0?0:cr.current)+d)}
 const toggle=()=>cur<0?play(0):au.paused?au.play():au.pause();
 const o=T[cur],pr={play,onDir:setCol,cur},tabs=[["Home","home"],["Radio","radio"],["Library","lib"],["Search","search"]];
 const goTab=i=>{setTab(i);setCol(false)};
 const S=[Home,Radio,Library,Search][tab];
 return h("div",{className:"app"},
  h(S,{key:tab,...pr}),
  h("div",{className:"dock"+(col?" col":"")},
   h("button",{className:"side l circ press",onClick:()=>goTab(0),"aria-label":"Home"},Ic("home")),
   h("button",{className:"side r circ press",onClick:()=>goTab(3),"aria-label":"Search"},Ic("search")),
   h("div",{className:"mini press",role:"button",onClick:()=>setOpen(true)},Art(o,pl?"":""),h("b",null,o?o.t:"Not Playing"),
    h("button",{onClick:e=>{e.stopPropagation();toggle()},"aria-label":"Play or pause"},Ic(pl?"pause":"play")),
    h("button",{className:o?"":"dim",onClick:e=>{e.stopPropagation();go(1)},"aria-label":"Next"},Ic("ff","sk"))),
   h("div",{className:"tabs",style:{"--i":tab}},h("div",{className:"hl"}),tabs.map((t,i)=>h("button",{key:t[0],className:i==tab?"on":"",onClick:()=>goTab(i)},Ic(t[1]),t[0])))),
  h(Sheet,{open,setOpen,cur,pl,toggle,go,tm,onPlaylist:setPlFor}),
  plFor&&h(PlaylistPicker,{track:plFor,onClose:()=>setPlFor(null)}))}
