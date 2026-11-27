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

/* ---- چرخ ماوس روی ردیف (lookmv): هر «ژست» یا کاملاً افقی است یا کاملاً صفحه ----
   - ژست جدید = بعد از ۵۰۰ms سکون. فقط در ابتدا/انتهای ردیف (در جهت اسکرول) به صفحه می‌رود.
   - وسط یک ژست عمودی (حتی اگر زیر موس ردیف دیگری بیاید) ژست همان‌طور عمودی می‌ماند و ناگهان افقی نمی‌شود. */
const WG={t:0,mode:null},WGAP=500;
document.addEventListener("wheel",e=>{
 if(e.ctrlKey||!e.target.closest)return;
 const now=performance.now(),r=e.target.closest(".row");
 if(!r){WG.t=now;WG.mode="page";return}
 if(Math.abs(e.deltaX)>Math.abs(e.deltaY))return;
 const max=r.scrollWidth-r.clientWidth;
 if(max<2){WG.t=now;WG.mode="page";return}
 if(WG.mode==="page"&&now-WG.t<=WGAP){WG.t=now;return}
 const pos=Math.min(max,Math.abs(r.scrollLeft)),eff=r._t!=null?r._t:pos,f=e.deltaY>0;
 if(now-(r._lw||0)>WGAP||WG.mode!=="row"||now-WG.t>WGAP){r._mode=(f?eff>=max-1:eff<=1)?"page":"row"}
 r._lw=now;WG.t=now;WG.mode=r._mode;
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
/* UI sounds (js/sfx.js): SFX("error") etc. Clicks, typing and scrolling are routed automatically inside sfx.js. */
const SFX=(n,a,o)=>{try{window.sfx&&window.sfx.play(n,a,o)}catch(e){}};
/* which cue a toast gets (click sounds already covered download / playlist toggles) */
const toastSnd=m=>/^(Download started|Added to|Removed from|Account deleted)/.test(m)?null:/couldn|can’t|cannot|failed|incorrect|wrong|don’t match/i.test(m)?"error":/updated/i.test(m)?"success":"notify";
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
vol:'<path d="M4 9v6h4l5 4V5L8 9z"/>',
volx:'<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 9.5l4.5 5M21 9.5l-4.5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
bm:'<path d="M7 4.5h10a1 1 0 0 1 1 1V20l-6-4.2L6 20V5.5a1 1 0 0 1 1-1z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/>',
dl:'<path d="M12 4v11M7.5 11 12 15.5 16.5 11M5 19.5h14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>'};
const Ic=(n,c)=>h("svg",{viewBox:"0 0 24 24",className:"ic "+(c||""),dangerouslySetInnerHTML:{__html:I[n]}});

/* Every track the app has seen (from /api/*) lives here once, so object identity stays stable. */
const REG={};
const hash=s=>{let x=5381;for(let i=0;i<s.length;i++)x=(x*33^s.charCodeAt(i))>>>0;return x};
function reg(o){const r=REG[o.id]||(REG[o.id]={});Object.assign(r,o);
 if(r.h==null){const x=hash(String(r.id));r.h=x%360;r.d=x%97+1;r.m=x>>3&1}
 if(!r.src)r.src="/api/stream/"+r.id+(r.url?"?u="+encodeURIComponent(r.url):"");
 return r}
const au=new Audio();au.preload="auto";au.addEventListener("playing",()=>{PT.tries=0});
/* real duration if the browser knows it; streams report Infinity/NaN, so fall back to the length from the track's metadata */
const durOf=()=>{const d=au.duration;if(isFinite(d)&&d>0)return d;const c=CUR.o;return c&&!c.live&&c.dur?c.dur:0};
const CUR={o:null};
/* ---- direct playback: the server only hands out the CDN link, the browser streams the audio itself ---- */
const LINKS={},PT={n:0,retry:null,tries:0,id:null};let HLS=null;
const stopHls=()=>{if(HLS){try{HLS.destroy()}catch(e){}HLS=null}};
async function linkOf(o,fresh){const c=LINKS[o.id];if(!fresh&&c&&Date.now()-c.t<10*60e3)return c;
 const r=await fetch("/api/link/"+o.id+"?"+(o.url?"u="+encodeURIComponent(o.url)+"&":"")+(fresh?"fresh=1&":"")+"_="+Date.now(),{cache:"no-store"});if(!r.ok)throw new Error("link");
 return LINKS[o.id]={...await r.json(),t:Date.now()}}
function attach(l){stopHls();
 if(!l.hls||au.canPlayType("application/vnd.apple.mpegurl")){au.src=l.url;return}
 if(!(window.Hls&&Hls.isSupported()))throw new Error("no hls");
 HLS=new Hls({maxBufferLength:30});HLS.loadSource(l.url);HLS.attachMedia(au);
 HLS.on(Hls.Events.ERROR,(e,d)=>{if(d&&d.fatal&&au.onerror)au.onerror()})}
function startTrack(o,fresh){const tok=++PT.n;stopHls();
 if(o.live){au.src=o.src;au.play().catch(()=>{});return}
 (fresh||typeof OFF==="undefined"?Promise.resolve(null):OFF.url(o.id)).then(u=>{if(tok!==PT.n)return;if(u){au.src=u;return au.play()}
  return linkOf(o,fresh).then(l=>{if(tok!==PT.n)return;attach(l);return au.play()})}).catch(()=>{if(tok===PT.n&&au.onerror)au.onerror()})}
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
 return h("div",{className:"bgc"},L.map(x=>h("div",{key:x.id,className:"bgi",style:{backgroundImage:cssUrl(x)}})),h("div",{className:"bgs"}))}

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
  h("div",{className:"tb"},back?h("button",{className:"circ press",onClick:onBack,"aria-label":"Back"},Ic("back")):h(Support),
   h("div",{className:"st",style:{opacity:y>46?1:0,transform:y>46?"none":"translateY(8px)"}},title),right),
  h("div",{className:"scroll",onScroll:sc},h("h1",rs(0),title),children));
}
/* ---- حساب کاربر: دایره‌ی پروفایل (دو حرف اول نام) منو را باز می‌کند ---- */
const UserCtx=React.createContext(null);
const ini=n=>Array.from(String(n||"").trim()).slice(0,2).join("").toUpperCase()||"?";
function Av(){const c=useContext(UserCtx);
 return h("button",{className:"circ av",onClick:()=>c&&c.openMenu(),"aria-label":"Profile","aria-haspopup":"menu"},c&&c.user?ini(c.user.name):"?")}
/* hooks that App fills in: open the "Add to Playlist" dialog / show a toast */
const ACT={pl:()=>{},note:()=>{},more:()=>{},search:()=>{}};
const halt=f=>e=>{e.stopPropagation();e.preventDefault();f()};
const Card=(o,i,play,list)=>h("div",{key:o.id,className:"card press",role:"button",tabIndex:0,style:{"--i":i},onClick:()=>play(o,list),
 onKeyDown:e=>{if(e.target===e.currentTarget&&(e.key==="Enter"||e.key===" ")){e.preventDefault();e.stopPropagation();play(o,list)}}},
 h("div",{className:"cw"},Art(o),
  !o.live&&h("button",{className:"ca bm",style:{"--k":0},"aria-label":"Add to playlist",title:"Add to playlist",onClick:halt(()=>ACT.pl(o))},Ic("bm")),
  !o.live&&h("button",{className:"ca dl",style:{"--k":1},"aria-label":"Download",title:"Download",onClick:halt(()=>download(o).then(()=>ACT.note("Download started")).catch(()=>ACT.note("Couldn’t download this song")))},Ic("dl"))),
 h("b",null,o.t),h("small",null,o.a));
const Loader=()=>h("div",{className:"list lw",role:"progressbar","aria-label":"Loading"},h("div",{className:"lbar"},h("i")));
/* last tile of a row: opens the full list (and keeps loading more from search) */
const MoreCard=(title,q,items,i)=>h("button",{key:"more",className:"card more press",style:{"--i":i},onClick:()=>ACT.more({title,q,seed:items}),"aria-label":"More "+title},
 h("div",{className:"cw"},h("div",{className:"art mt"},h("i",null,Ic("chev")),h("span",null,"More"))));
const Row=(title,items,play,more)=>h(RV,{key:title},h("h2",null,title),h(RowBox,null,items.map((o,i)=>Card(o,i,play,items)),more&&MoreCard(title,more.q,items,items.length)));
/* ردیف جدید با باز شدن نرم ارتفاع ظاهر می‌شود، تا بقیه‌ی صفحه ناگهان پایین نپرد (anim=false: بدون انیمیشن) */
function Reveal({children,anim}){const[a,setA]=useState(!!anim);
 return h("div",{className:"rcw"+(a?" go":""),onAnimationEnd:e=>{if(e.target===e.currentTarget)setA(false)}},h("div",{className:"rci"},children))}
const Empty=t=>h("p",{className:"empty"},t);
/* fetch JSON, keep it fresh: every = ms or fn(json)->ms */
function useJSON(url,every,map,ck){
 const last=useRef(null),[d,setD]=useState(()=>{if(!ck)return null;try{const raw=localStorage.getItem(ck),c=JSON.parse(raw);if(c){last.current=raw;return map(c)}return null}catch(e){return null}}),[err,setErr]=useState(false);
 useEffect(()=>{let stop=false,t;
  const load=async()=>{try{const r=await fetch(url);if(!r.ok)throw 0;const j=await r.json();if(stop)return;
    const str=JSON.stringify(j);
    if(ck)try{localStorage.setItem(ck,str)}catch(e){}
    if(str!==last.current){last.current=str;setD(map(j))}setErr(false);t=setTimeout(load,typeof every==="function"?every(j):every)}
   catch(e){if(!stop){setErr(true);t=setTimeout(load,15000)}}};
  load();return()=>{stop=true;clearTimeout(t)}},[url]);
 return[d,err]}

/* paged search results: first page, then "More" (server slices 20 at a time from a cached pool of up to 100) */
function usePages(q,seed,auto){
 const[s,setS]=useState({items:seed||[],busy:false,more:!!q,err:false}),R=useRef({off:0,gen:0,ctl:null});
 const fetchPage=async reset=>{const r=R.current;if(reset){r.gen++;r.off=0}const gen=r.gen;
  if(r.ctl)r.ctl.abort();const ctl=r.ctl=new AbortController();
  setS(x=>({...x,busy:true,err:false,items:reset?(seed||[]):x.items}));
  try{const res=await fetch("/api/search?q="+encodeURIComponent(q)+"&offset="+r.off,{signal:ctl.signal});if(!res.ok)throw 0;const j=await res.json();if(gen!==r.gen)return;
   const t=j.tracks.map(reg);r.off+=20;
   setS(x=>{const seen=new Set(x.items.map(o=>o.id));return{items:[...x.items,...t.filter(o=>!seen.has(o.id))],busy:false,more:!!j.more&&t.length>0,err:false}})}
  catch(e){if(e&&e.name==="AbortError")return;if(gen===r.gen)setS(x=>({...x,busy:false,err:true}))}};
 useEffect(()=>{const r=R.current;r.gen++;r.off=0;if(r.ctl)r.ctl.abort();
  if(!q){setS({items:seed||[],busy:false,more:false,err:false});return}
  if(auto){setS({items:[],busy:true,more:false,err:false});const t=setTimeout(()=>fetchPage(true),450);return()=>{clearTimeout(t);if(r.ctl)r.ctl.abort()}}
  setS({items:seed||[],busy:false,more:true,err:false});return()=>{if(r.ctl)r.ctl.abort()}},[q]);
 return{...s,load:()=>fetchPage(false)}}
const searchMenu=o=>[
 {icon:"bm",label:"Add to Playlist",fn:()=>ACT.pl(o)},
 {icon:"dl",label:"Download",fn:()=>download(o).then(()=>ACT.note("Download started")).catch(()=>ACT.note("Couldn’t download this song"))}];
function TrackListV({items,play,cur}){const[mnode,openMenu]=useMenu();
 return h("div",{className:"list"},items.map((o,i)=>h("div",{key:o.id,className:"li rise"+(cur&&cur.id===o.id?" on":""),style:{"--d":Math.min(i%20,12)}},
  h("button",{className:"main press",onClick:()=>play(o,items)},Art(o),h("div",{className:"t"},h("b",null,o.t),h("small",null,o.a))),
  !o.live&&h("button",{className:"rm",onClick:e=>openMenu(e,searchMenu(o)),"aria-label":"More","aria-haspopup":"menu"},Ic("more")))),mnode)}
const TrackList=(items,play,cur)=>h(TrackListV,{items,play,cur});
const PageMore=({P})=>P.busy?h(Loader):P.err?h("div",{className:"list"},h("button",{className:"morebtn press",onClick:P.load},"Couldn’t load. Tap to retry")):P.more&&P.items.length?h("div",{className:"list"},h("button",{className:"morebtn press",onClick:P.load},"More")):null;
function MoreView({title,q,seed,play,cur,onClose,onDir}){
 const[out,setOut]=useState(false),P=usePages(q,seed,false);
 const close=()=>{setOut(true);setTimeout(onClose,700)};
 useEffect(()=>{const k=e=>{if(e.key==="Escape")close()};document.addEventListener("keydown",k);return()=>document.removeEventListener("keydown",k)},[]);
 return h("div",{className:"screen subs",style:{background:"var(--bg)",animation:(out?"outR":"inR")+" .7s cubic-bezier(.32,.72,0,1) both",zIndex:8}},
  h(Screen,{title,back:1,onBack:close,right:h(Av),onDir,cls:"inner"},
   P.items.length?TrackList(P.items,play,cur):(P.busy?null:Empty("Nothing here yet.")),
   h(PageMore,{P})))}

const homeMap=j=>({...j,rows:(j.rows||[]).map(r=>({...r,tracks:r.tracks.map(reg)}))});
function Home({play,onDir}){
 const[d,err]=useJSON("/api/home",j=>j.rows&&j.rows.length?5*60e3:8e3,homeMap,"ms_home_v1"),pls=usePL(),recs=useRecs(pls),seen=useRef(null);
 if(!seen.current)seen.current=new Set(recs.map(r=>r.title));
 return h(Screen,{title:"Home",right:h(Av),onDir},
  recs.map(r=>{const anim=!seen.current.has(r.title);seen.current.add(r.title);return h(Reveal,{key:"rec|"+r.title,anim},Row(r.title,r.tracks,play,{q:null}))}),
  d&&d.rows.map(r=>Row(r.title,r.tracks,play,{q:r.genre||null})),
  !d&&(err?Empty("Can’t reach the server. Retrying…"):h(Loader)),
  d&&!d.rows.length&&h(React.Fragment,null,Empty("Building Home for the first time… this takes a minute or two."),h(Loader)))}

const radioMap=j=>(j.stations||[]).map(s=>reg({id:"r:"+s.id,t:s.name,a:s.genre,desc:s.desc,group:s.group,featured:s.featured,live:true,src:s.stream,cover:"/api/img/radio/"+encodeURIComponent(s.id)}));
function Radio({play,onDir}){
 const[d,err]=useJSON("/api/radio",36e5,radioMap),feat=d?d.filter(s=>s.featured):[],groups=d?[...new Set(d.map(s=>s.group))]:[];
 return h(Screen,{title:"Radio",right:h(Av),onDir},
  !d&&(err?Empty("Can’t load stations. Retrying…"):h(Loader)),
  feat.length>0&&h("section",rs(1),h("h2",null,"Listen to Live Radio for Free"),h(RowBox,null,feat.map(o=>h("button",{key:o.id,className:"live press",style:{"--g":grad(o),"--cv":cssUrl(o)},onClick:()=>play(o,feat)},h("small",null,"LIVE · "+o.a),h("b",null,o.t),h("p",null,o.desc))))),
  groups.map(g=>Row(g,d.filter(s=>s.group===g),play)))}

/* Library is built from the tracks in the user's playlists */
function LibList({kind,play,cur,openArt,setOpenArt}){const pls=usePL(),songs=libSongs(pls),[mnode,openMenu]=useMenu(),rep=useRep();
 if(!songs.length)return h("div",{className:"list"},Empty("Songs you add to a playlist show up here."));
 if(kind==="Artists"){const m={};songs.forEach(o=>(m[o.a]=m[o.a]||[]).push(o));
  if(openArt&&m[openArt]){const l=m[openArt];
   return h("div",{className:"list"},
    h("button",{className:"li press",onClick:()=>setOpenArt(null)},Ic("back","r"),"Artists"),
    h("h2",{className:"plh"},openArt),
    h("button",{className:"li press plact",onClick:()=>{REP.set(null);play(l[0],l)}},Ic("play","r"),"Play"),
    l.map(o=>h("div",{key:o.id,className:"li"+(cur&&cur.id===o.id?" on":"")},
     h("button",{className:"main press",onClick:()=>play(o,l)},Art(o),h("div",{className:"t"},h("b",null,o.t),h("small",null,o.a))),
     rep===o.id&&Ic("repeat","rp"),
     h("button",{className:"rm",onClick:e=>openMenu(e,searchMenu(o).concat(trackMenu(o,l,play,"Remove from Playlist",()=>{PL.removeEverywhere(o.id);ACT.note("Removed from playlist")}))),"aria-label":"More","aria-haspopup":"menu"},Ic("more")))),mnode)}
  return h("div",{className:"list"},Object.keys(m).sort().map((a,i)=>h("button",{key:a,className:"li press rise",style:{"--d":Math.min(i,12)},onClick:()=>setOpenArt(a)},Art(m[a][0]),h("div",{className:"t"},h("b",null,a),h("small",null,m[a].length+(m[a].length===1?" song":" songs"))),Ic("chev","ch"))))}
 return h("div",{className:"list"},songs.map((o,i)=>h("div",{key:o.id,className:"li rise"+(cur&&cur.id===o.id?" on":""),style:{"--d":Math.min(i,12)}},
  h("button",{className:"main press",onClick:()=>play(o,songs)},Art(o),h("div",{className:"t"},h("b",null,o.t),h("small",null,o.a))),
  rep===o.id&&Ic("repeat","rp"),
  h("button",{className:"rm",onClick:e=>openMenu(e,trackMenu(o,songs,play,"Remove from Playlist",()=>{PL.removeEverywhere(o.id);ACT.note("Removed from playlist")})),"aria-label":"More","aria-haspopup":"menu"},Ic("more")))),mnode)}
function Library({play,onDir,cur}){
 const[sub,setSub]=useState(null),[out,setOut]=useState(false),[plOpen,setPlOpen]=useState(null),[openArt,setOpenArt]=useState(null),[conf,setConf]=useState(null);
 const pls=usePL(),songs=libSongs(pls),[mnode,openMenu]=useMenu(),openPl=pls.find(p=>p.id===plOpen);
 const close=()=>{setOut(true);setTimeout(()=>{setSub(null);setOut(false);setPlOpen(null);setOpenArt(null)},700)};
 /* منوی سه‌نقطه‌ی بالا: Play All (نوبت‌به‌نوبت از اول) و حذف همه */
 const playAll=l=>{if(!l.length)return;REP.set(null);play(l[0],l,true)};
 const menuItems=()=>{
  if(sub==="Playlists"&&openPl){const l=openPl.tracks.map(reg);
   return[{icon:"play",label:"Play All",disabled:!l.length,fn:()=>playAll(l)},
    {icon:"trash",label:"Remove All Songs",danger:1,disabled:!l.length,fn:()=>setConf({title:"Remove All Songs",text:"Remove all songs from “"+openPl.name+"”?",yes:"Remove All",fn:()=>{PL.clearTracks(openPl.id);ACT.note("Removed all songs")}})}]}
  if(sub==="Artists"&&openArt)return[{icon:"search",label:"Load More",fn:()=>ACT.search(openArt)}];
  if(sub==="Playlists")return[{icon:"play",label:"Play All",disabled:!songs.length,fn:()=>playAll(songs)},
   {icon:"trash",label:"Delete All Playlists",danger:1,disabled:!pls.length,fn:()=>setConf({title:"Delete All Playlists",text:"Delete all "+pls.length+" playlists? This can’t be undone.",yes:"Delete All",fn:()=>{PL.removeAll();setPlOpen(null);ACT.note("All playlists deleted")}})}];
  return[{icon:"play",label:"Play All",disabled:!songs.length,fn:()=>playAll(songs)},
   {icon:"trash",label:"Remove All",danger:1,disabled:!songs.length,fn:()=>setConf({title:"Remove All",text:"Remove all songs from your playlists? The playlists themselves stay.",yes:"Remove All",fn:()=>{PL.clearAllTracks();ACT.note("Removed all songs")}})}]};
 useEffect(()=>{if(sub)MB.watch(document.querySelector(".subs"),{k:.16,max:14,grace:300})},[sub,out]);
 const items=[["Playlists","list"],["Artists","mic"],["Songs","note"]];
 return h("div",{className:"screen"},
  h(Screen,{title:"Library",right:h(Av),onDir,cls:"inner"},h("div",{className:"list"},items.map((it,i)=>h("button",{key:i,className:"li press rise",style:{"--d":i+1},onClick:()=>setSub(it[0])},Ic(it[1],"r"),it[0],Ic("chev","ch"))))),
  sub&&h("div",{className:"screen subs",style:{background:"var(--bg)",animation:(out?"outR":"inR")+" .7s cubic-bezier(.32,.72,0,1) both",zIndex:8}},
   h(Screen,{title:sub,back:1,onBack:close,right:h("button",{className:"circ press",onClick:e=>openMenu(e,menuItems()),"aria-label":"More","aria-haspopup":"menu"},Ic("more")),onDir,cls:"inner"},
    sub==="Playlists"?h(PlaylistsView,{play,cur,openId:plOpen,setOpenId:setPlOpen}):h(LibList,{kind:sub,play,cur,openArt,setOpenArt}))),
  mnode,conf&&h(Confirm,{title:conf.title,text:conf.text,yes:conf.yes,onYes:conf.fn,onClose:()=>setConf(null)}))}

const GENRE_FALLBACK=[["Pop","pop"],["Hip-Hop","hip hop"],["Rock","rock"],["Indie","indie"],["Electronic","electronic"],["House","house"],["Techno","techno"],["Lo-Fi","lofi hip hop"],["Chill","chillout"],["Ambient","ambient"],["Jazz","jazz"],["Classical","classical piano"],["Metal","metal"],["R&B","r&b"],["Reggaeton","reggaeton"],["K-Pop","kpop"],["Persian Pop","persian pop"],["Persian Rap","persian rap"]];
/* photo per genre (server: /api/img/genre/<name>); the generated SVG is kept underneath as a fallback while loading / if no photo */
const genreMap=j=>(j.genres||[]).map((g,i,a)=>{const o={name:g.name,q:g.q,h:Math.round(i*360/a.length+8)%360,d:i+3,m:i%2};o.fb=cover(o);o.cover="/api/img/genre/"+encodeURIComponent(g.name);return o});
function useGenres(){const[g,setG]=useState(()=>genreMap({genres:GENRE_FALLBACK.map(([name,q])=>({name,q}))}));
 useEffect(()=>{let off=false;fetch("/api/genres").then(r=>r.ok?r.json():null).then(j=>{if(!off&&j&&j.genres&&j.genres.length)setG(genreMap(j))}).catch(()=>{});return()=>{off=true}},[]);return g}
function Search({play,onDir,cur,initQ}){const genres=useGenres(),[q,setQ]=useState(initQ||""),s=q.trim(),P=usePages(s.length>=2?s:"",null,true);
 return h(Screen,{title:"Search",right:h(Av),onDir},
  h("div",{className:"search rise",style:{"--d":1}},Ic("search"),h("input",{value:q,placeholder:"Artists, Songs…",onChange:e=>setQ(e.target.value)})),
  s.length>=2?(P.items.length?h(React.Fragment,null,TrackList(P.items,play,cur),h(PageMore,{P})):P.busy?h(Loader):P.err?Empty("Search failed. Check your connection and try again."):Empty("No results."))
   :h("div",{className:"grid gens"},genres.map((g,i)=>h("button",{key:g.name,className:"gen press rise",style:{"--d":Math.min(i,10)+2,backgroundColor:`hsl(${g.h} 55% 30%)`,backgroundImage:cssUrl(g)+`,url("${g.fb}")`,backgroundSize:"cover"},onClick:()=>setQ(g.q)},h("span",null,g.name)))))}

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
 const el=useRef(null),st=useRef(null),o=cur||null;
 const dn=e=>{st.current=e.clientY;e.currentTarget.setPointerCapture(e.pointerId)};
 const mv=e=>{if(st.current==null)return;const dy=Math.max(0,e.clientY-st.current);el.current.style.transition="none";el.current.style.transform=`translateY(${dy}px)`};
 const up=e=>{if(st.current==null)return;const dy=e.clientY-st.current;st.current=null;el.current.style.transition="";el.current.style.transform="";if(dy>110)setOpen(false)};
 const pct=tm.d?Math.min(100,Math.max(0,tm.t/tm.d*100)):0;
 return h("div",{ref:el,className:"sheet"+(open?" open":"")},
  h("button",{className:"close",onClick:()=>setOpen(false),"aria-label":"Close"},Ic("back")),
  h(Backdrop,{o}),
  h("div",{onPointerDown:dn,onPointerMove:mv,onPointerUp:up,onPointerCancel:up,style:{paddingBottom:14,touchAction:"none"}},h("div",{className:"grab"}),Art(o,"big "+(pl?"":"pp"))),
  h("div",{className:"meta"},h("b",null,o?o.t:"Not Playing"),h("small",null,o?o.a:"")),
  h("div",{style:{marginTop:18}},h("input",{type:"range",min:0,max:100,step:.1,value:pct,style:{"--p":pct+"%"},"aria-label":"Seek",disabled:!!(o&&o.live),onChange:e=>{const d=durOf();if(d)try{au.currentTime=e.target.value/100*d}catch(x){}}}),h("div",{className:"tm"},h("span",null,o&&o.live?"LIVE":fmt(tm.t)),h("span",null,o&&o.live?"":"-"+fmt(Math.max(0,tm.d-tm.t))))),
  h("div",{className:"ctlrow"},h(SpeedBtn),h("div",{className:"ctl"},h("button",{onClick:()=>go(-1),"aria-label":"Previous"},Ic("rw")),h("button",{className:"pl",onClick:toggle,"aria-label":"Play or pause"},Ic(pl?"pause":"play")),h("button",{onClick:()=>go(1),"aria-label":"Next"},Ic("ff"))),h(ShareBtn,{o,onPlaylist})),
  h(Volume))}

function App(){
 const ctx=useContext(UserCtx),notify=ctx&&ctx.notify?ctx.notify:()=>{};
 const[more,setMore]=useState(null),[sq,setSq]=useState({q:"",n:0}),[tab,setTab]=useState(0),[cur,setCur]=useState(null),[pl,setPl]=useState(false),[open,setOpen]=useState(false),[col,setCol]=useState(false),[tm,setTm]=useState({t:0,d:0}),[plFor,setPlFor]=useState(null);
 const cr=useRef(null),Q=useRef([]);
 useEffect(()=>{au.onplay=()=>setPl(true);au.onpause=()=>setPl(false);const upd=()=>setTm({t:au.currentTime||0,d:durOf()});
  au.ontimeupdate=upd;au.onloadedmetadata=upd;au.ondurationchange=upd;au.onseeked=upd;
  au.onended=()=>{const c=cr.current;if(!c||c.live)return;if(REP.id===c.id){au.currentTime=0;au.play().catch(()=>{});return}go(1)};
  au.onerror=()=>{const c=cr.current;if(c&&!c.live){if(PT.id!==c.id){PT.id=c.id;PT.tries=0}if(PT.tries<3){PT.tries++;delete LINKS[c.id];setTimeout(()=>{if(cr.current&&cr.current.id===c.id)startTrack(c,true)},PT.tries*600);return}}setPl(false);if(c)notify("Couldn’t play “"+c.t+"”")}},[]);
 useEffect(()=>()=>{au.pause()},[]);
 useEffect(()=>{ACT.pl=setPlFor;ACT.note=notify;ACT.more=setMore;ACT.search=q=>{setSq({q,n:Date.now()});setTab(3);setCol(false);setMore(null)};return()=>{ACT.pl=()=>{};ACT.note=()=>{};ACT.more=()=>{};ACT.search=()=>{}}});
 useEffect(()=>{const k=e=>{const t=e.target.tagName;if(t==="INPUT"&&e.target.type!=="range")return;
  if(e.key==="Escape")setOpen(false);
  else if(e.code==="Space"&&t!=="BUTTON"){e.preventDefault();toggle()}};
  document.addEventListener("keydown",k);return()=>document.removeEventListener("keydown",k)},[]);
 useEffect(()=>{["mini","tabs"].forEach(c=>MB.watch(document.querySelector(".dock ."+c),{k:.22,max:8}))},[col]);
 useEffect(()=>{MB.watch(document.querySelector(".sheet"),{k:.12,max:14})},[open]);
 useEffect(()=>{MB.watch(document.querySelector(".tabs .hl"),{k:.22,max:9})},[tab]);
 /* lock-screen / headset controls */
 useEffect(()=>{if(!("mediaSession"in navigator)||!cur)return;const ms=navigator.mediaSession;
  try{ms.metadata=new MediaMetadata({title:cur.t,artist:cur.a,artwork:cur.cover?[{src:cur.cover,sizes:"500x500"}]:[]});
   ms.setActionHandler("previoustrack",()=>go(-1));ms.setActionHandler("nexttrack",()=>go(1))}catch(e){}},[cur]);
 /* play(track, list): list becomes the queue so Next/Previous walk the row you tapped in */
 function play(o,list,force){if(!o)return;
  if(list&&list.length)Q.current=list;else if(!Q.current.some(x=>x.id===o.id))Q.current=[o];
  if(cr.current&&cr.current.id===o.id){if(force){au.currentTime=0;au.play().catch(()=>{})}else au.paused?au.play().catch(()=>{}):au.pause();return}
  if(REP.id&&REP.id!==o.id)REP.set(null);
  cr.current=o;CUR.o=o;PT.retry=null;setCur(o);setTm({t:0,d:o.live?0:(o.dur||0)});startTrack(o)}
 function go(d){const q=Q.current;if(!q.length)return;const i=q.findIndex(x=>cr.current&&x.id===cr.current.id),n=q[((i<0?0:i)+d+q.length)%q.length];
  if(cr.current&&n.id===cr.current.id){au.currentTime=0;au.play().catch(()=>{})}else play(n)}
 function toggle(){if(!cr.current)return;au.paused?au.play().catch(()=>{}):au.pause()}
 const o=cur,pr={play,onDir:setCol,cur},tabs=[["Home","home"],["Radio","radio"],["Library","lib"],["Search","search"]];
 const goTab=i=>{setTab(i);setCol(false);setMore(null)};
 const S=[Home,Radio,Library,Search][tab];
 return h("div",{className:"app"},
  h(S,{key:tab===3?"3|"+sq.n:tab,...pr,initQ:tab===3?sq.q:undefined}),
  more&&h(MoreView,{key:more.title+"|"+more.q,...more,play,cur,onDir:setCol,onClose:()=>setMore(null)}),
  h("div",{className:"dock"+(col?" col":"")},
   h("button",{className:"side l circ press",onClick:()=>goTab(0),"aria-label":"Home"},Ic("home")),
   h("button",{className:"side r circ press",onClick:()=>goTab(3),"aria-label":"Search"},Ic("search")),
   h("div",{className:"mini press",role:"button",onClick:()=>setOpen(true)},Art(o,pl?"":""),h("b",null,o?o.t:"Not Playing"),
    h("button",{onClick:e=>{e.stopPropagation();toggle()},"aria-label":"Play or pause"},Ic(pl?"pause":"play")),
    h("button",{className:o?"":"dim",onClick:e=>{e.stopPropagation();go(1)},"aria-label":"Next"},Ic("ff","sk"))),
   h("div",{className:"tabs",style:{"--i":tab}},h("div",{className:"hl"}),tabs.map((t,i)=>h("button",{key:t[0],className:i==tab?"on":"",onClick:()=>goTab(i)},Ic(t[1]),t[0])))),
  h(Sheet,{open,setOpen,cur,pl,toggle,go,tm,onPlaylist:setPlFor}),
  plFor&&h(PlaylistPicker,{track:plFor,onClose:()=>setPlFor(null)}))}
