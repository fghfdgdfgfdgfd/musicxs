/* Player extras: playlists (saved per account in this browser), download, playback speed, share menu */
const IS='fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
Object.assign(I,{
 share:`<g ${IS}><path d="M12 15V4M8 7.5 12 4l4 3.5"/><path d="M8 10H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-2"/></g>`,
 download:`<g ${IS}><path d="M12 4v11M8 11.5l4 3.5 4-3.5M5 19.5h14"/></g>`,
 plus:`<g ${IS}><path d="M12 5v14M5 12h14"/></g>`,
 check:`<path d="m5 12.5 4.5 4.5L19 7" ${IS} stroke-width="2.6"/>`,
 addlist:`<g ${IS}><path d="M4 7h11M4 12h7M4 17h7M17 13v6M14 16h6"/></g>`,
 headset:`<g ${IS}><path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="14" width="4" height="6" rx="1.6"/><rect x="17" y="14" width="4" height="6" rx="1.6"/><path d="M19 20c0 1.5-2 2-5 2"/></g>`,
 tg:`<path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z"/>`,
 gh:`<path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 0-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.3 4.7 18.3 5 18.3 5c.7 1.7.3 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.600-2.800 5.600-5.500 5.900.4.400.8 1.100.8 2.200v3.300c0 .3.2.7.8.6A12 12 0 0 0 12 .3"/>`,
 repeat:`<g ${IS}><path d="m17 2 4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="m7 22-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/></g>`
});

/* ---------- Repeat: فقط یک آهنگ تکرار می‌شود و به بعدی نمی‌رود ---------- */
const REP=(()=>{const subs=new Set();return{id:null,set(id){this.id=id;subs.forEach(f=>f())},on(f){subs.add(f);return()=>subs.delete(f)}}})();
function useRep(){const[,n]=useState(0);useEffect(()=>REP.on(()=>n(x=>x+1)),[]);return REP.id}
function repeatTrack(o,list,play){
 if(REP.id===o.id){REP.set(null);ACT.note("Repeat off");return}
 REP.set(o.id);ACT.note("Repeating “"+o.t+"”");
 if(CUR.o&&CUR.o.id===o.id){if(au.paused)au.play().catch(()=>{});return}
 play(o,list&&list.length?list:[o],true)}

/* ---------- Playlists: one list per account, stored in localStorage ---------- */
const PL=(()=>{
 const key=()=>{const u=Auth.current();return u?"ms_pl_v1_"+u.email:null};
 const read=()=>{const k=key();if(!k)return[];try{const a=JSON.parse(localStorage.getItem(k));return Array.isArray(a)?a.map(p=>({...p,tracks:(p.tracks||[]).filter(t=>t&&typeof t==="object"&&t.id)})):[]}catch(e){return[]}};
 const write=a=>{const k=key();if(!k)return;try{localStorage.setItem(k,JSON.stringify(a))}catch(e){throw new Error("This browser can’t save playlists (storage is blocked).")}};
 const slim=o=>({id:o.id,t:o.t,a:o.a,cover:o.cover||null,url:o.url||null,dur:o.dur||0});
 const subs=new Set(),emit=()=>subs.forEach(f=>f());
 addEventListener("storage",e=>{if(e.key&&e.key.indexOf("ms_pl_v1_")===0)emit()});
 return{
  all:read,
  on(f){subs.add(f);return()=>subs.delete(f)},
  create(name,track){
   name=String(name||"").replace(/\s+/g," ").trim().slice(0,40);
   if(!name)throw new Error("Give the playlist a name.");
   const a=read();
   if(a.some(p=>p.name.toLowerCase()===name.toLowerCase()))throw new Error("You already have a playlist with that name.");
   const p={id:Date.now().toString(36)+Math.random().toString(36).slice(2,6),name,tracks:track?[slim(track)]:[],created:Date.now()};
   a.push(p);write(a);emit();return p},
  toggle(id,track){const a=read(),p=a.find(x=>x.id===id);if(!p)return false;
   const i=p.tracks.findIndex(x=>x.id===track.id);if(i<0)p.tracks.push(slim(track));else p.tracks.splice(i,1);
   write(a);emit();return i<0},
  removeTrack(id,track){const a=read(),p=a.find(x=>x.id===id);if(!p)return;p.tracks=p.tracks.filter(t=>t.id!==track);write(a);emit()},
  remove(id){write(read().filter(p=>p.id!==id));emit()},
  /* حذف یک آهنگ از همه‌ی پلی‌لیست‌ها (برای Library > Songs) */
  removeEverywhere(tid){const a=read();a.forEach(p=>{p.tracks=p.tracks.filter(t=>t.id!==tid)});write(a);if(REP.id===tid)REP.set(null);emit()},
  /* خالی کردن آهنگ‌های یک پلی‌لیست */
  clearTracks(id){const a=read(),p=a.find(x=>x.id===id);if(!p)return;p.tracks=[];write(a);emit()},
  /* خالی کردن آهنگ‌های همه‌ی پلی‌لیست‌ها (پلی‌لیست‌ها می‌مانند) */
  clearAllTracks(){const a=read();a.forEach(p=>{p.tracks=[]});write(a);REP.set(null);emit()},
  removeAll(){write([]);REP.set(null);emit()}
 }})();
function usePL(){const[,n]=useState(0);useEffect(()=>PL.on(()=>n(x=>x+1)),[]);return PL.all()}

/* ---------- منوی کشویی (سه‌نقطه) + دیالوگ تأیید؛ داخل .shell رندر می‌شوند تا انیمیشن صفحه‌ها اذیتشان نکند ---------- */
function Menu({r,items,onClose}){
 const sh=document.querySelector(".shell"),b=sh.getBoundingClientRect();
 useEffect(()=>{const k=e=>{if(e.key==="Escape")onClose()};document.addEventListener("keydown",k);return()=>document.removeEventListener("keydown",k)},[]);
 const H=items.length*48+16,below=r.bottom-b.top+6,top=below+H>b.height-10?Math.max(10,r.top-b.top-6-H):below;
 return ReactDOM.createPortal(h("div",{className:"ov",onClick:onClose},
  h("div",{className:"pmenu",role:"menu",style:{top,right:Math.max(12,b.right-r.right),width:"min(250px,calc(100% - 24px))"},onClick:e=>e.stopPropagation()},
   items.map((it,i)=>h("button",{key:i,className:"pitem"+(it.danger?" danger":"")+(it.on?" on":""),role:"menuitem",disabled:!!it.disabled,onClick:()=>{onClose();it.fn()}},Ic(it.icon),h("span",{className:"t"},h("span",null,it.label)))))),sh)}
function useMenu(){const[m,setM]=useState(null);
 const open=(e,items)=>{e.stopPropagation();const r=e.currentTarget.getBoundingClientRect();setM({r:{top:r.top,bottom:r.bottom,right:r.right},items})};
 return[m&&h(Menu,{r:m.r,items:m.items,onClose:()=>setM(null)}),open]}
function Confirm({title,text,yes,onYes,onClose}){
 return ReactDOM.createPortal(h(Modal,{title,onClose},h("p",{className:"note"},text),
  h("button",{className:"btn",type:"button",onClick:()=>{onYes();onClose()}},yes),
  h("button",{className:"btn ghost",type:"button",onClick:onClose},"Cancel")),document.querySelector(".shell"))}
/* آیتم‌های منوی هر آهنگ: Repeat + Remove */
const trackMenu=(o,list,play,removeLabel,onRemove)=>[
 {icon:"repeat",label:REP.id===o.id?"Stop Repeat":"Repeat",on:REP.id===o.id,fn:()=>repeatTrack(o,list,play)},
 {icon:"trash",label:removeLabel,danger:1,fn:onRemove}];
/* همه‌ی آهنگ‌های یکتای پلی‌لیست‌ها */
function libSongs(pls){const seen={},songs=[];pls.forEach(p=>p.tracks.forEach(t=>{if(!seen[t.id]){seen[t.id]=1;songs.push(reg(t))}}));return songs}

/* ---------- Download (server streams the file from SoundCloud) ---------- */
async function download(o){
 if(!o||o.live)throw new Error("live");
 const save=(href,name)=>{const a=document.createElement("a");a.href=href;a.download=name||"";document.body.appendChild(a);a.click();a.remove()};
 const l=await linkOf(o);
 if(l.hls){save("/api/download/"+o.id+(o.url?"?u="+encodeURIComponent(o.url):""));return}  /* HLS-only track: no single file on the CDN, server remuxes it */
 const name=(o.a+" - "+o.t).replace(/[\\/:*?"<>|]+/g,"_").slice(0,150)+"."+(l.ext||"mp3");
 try{const r=await fetch(l.url);if(!r.ok)throw 0;const u=URL.createObjectURL(await r.blob());save(u,name);setTimeout(()=>URL.revokeObjectURL(u),6e4)}  /* straight from the CDN to the browser */
 catch(e){window.open(l.url,"_blank","noopener")}}  /* CDN blocks cross-origin fetch -> open the direct link */

/* ---------- Playback speed (left of the transport controls) ---------- */
const RATES=[.5,.75,1,1.25,1.5,2];
let RATE=(()=>{try{const r=parseFloat(localStorage.getItem("ms_rate"));return RATES.indexOf(r)>=0?r:1}catch(e){return 1}})();
const applyRate=r=>{RATE=r;au.defaultPlaybackRate=r;au.playbackRate=r;au.preservesPitch=true;au.webkitPreservesPitch=true;try{localStorage.setItem("ms_rate",String(r))}catch(e){}};
function SpeedBtn(){
 const[r,setR]=useState(RATE),[open,setOpen]=useState(false);
 useEffect(()=>{applyRate(RATE)},[]);
 const pick=x=>{applyRate(x);setR(x);setOpen(false)};
 return h(React.Fragment,null,
  open&&h("div",{className:"scrim",onClick:()=>setOpen(false)}),
  open&&h("div",{className:"spop l",role:"menu"},h("small",{className:"sh"},"Playback Speed"),
   RATES.map(x=>h("button",{key:x,role:"menuitemradio","aria-checked":x===r,className:x===r?"on":"",onClick:()=>pick(x)},h("span",null,x===1?"Normal":x+"×"),Ic("check","chk")))),
  h("button",{className:"sbtn"+(r!==1?" act":""),onClick:()=>setOpen(!open),"aria-label":"Playback speed","aria-haspopup":"menu","aria-expanded":open},r+"×"))}

/* ---------- Share menu (right of the transport controls) ---------- */
function ShareBtn({o,onPlaylist}){
 const[open,setOpen]=useState(false),c=useContext(UserCtx),notify=c&&c.notify?c.notify:()=>{};
 const dl=()=>{setOpen(false);download(o).then(()=>notify("Download started")).catch(()=>notify("Couldn’t download this song"))};
 return h(React.Fragment,null,
  open&&o&&h("div",{className:"scrim",onClick:()=>setOpen(false)}),
  open&&o&&h("div",{className:"spop r",role:"menu"},
   !o.live&&h("button",{role:"menuitem",onClick:dl},Ic("download"),h("span",null,"Download")),
   !o.live&&h("button",{role:"menuitem",onClick:()=>{setOpen(false);onPlaylist(o)}},Ic("addlist"),h("span",null,"Add to Playlist"))),
  h("button",{className:"sbtn",disabled:!o||o.live,onClick:()=>setOpen(!open),"aria-label":"Share","aria-haspopup":"menu","aria-expanded":open},Ic("share")))}

/* ---------- Add to Playlist dialog ---------- */
function PlaylistPicker({track,onClose}){
 const pls=usePL(),c=useContext(UserCtx),notify=c&&c.notify?c.notify:()=>{};
 const[name,setName]=useState(""),[err,setErr]=useState("");
 useEffect(()=>{const k=e=>{if(e.key==="Escape")onClose()};document.addEventListener("keydown",k);return()=>document.removeEventListener("keydown",k)},[]);
 const tog=p=>{try{notify(PL.toggle(p.id,track)?"Added to "+p.name:"Removed from "+p.name)}catch(x){setErr(x.message);SFX("error")}};
 const create=e=>{e.preventDefault();try{const p=PL.create(name,track);SFX("success");notify("Added to "+p.name);onClose()}catch(x){setErr(x.message);SFX("warn")}};
 return h(Modal,{title:"Add to Playlist",onClose},
  pls.length?h("div",{className:"plist"},pls.map(p=>{const on=p.tracks.some(x=>x.id===track.id);
   return h("button",{key:p.id,className:"prow"+(on?" on":""),role:"checkbox","aria-checked":on,onClick:()=>tog(p)},
    h("span",{className:"pcov"},Ic("list")),
    h("span",{className:"t"},h("b",null,p.name),h("small",null,p.tracks.length+(p.tracks.length===1?" song":" songs"))),
    h("span",{className:"tick"},Ic("check")))})):h("p",{className:"note"},"You don’t have any playlists yet. Create one below."),
  h("form",{onSubmit:create,noValidate:true},
   h("div",{className:"grp"},h(Field,{icon:"plus",type:"text",value:name,onChange:v=>{setName(v);setErr("")},placeholder:"New playlist name",ac:"off",name:"playlist",cap:"sentences"})),
   err&&h("p",{className:"err",role:"alert"},err),
   h("button",{className:"btn",type:"submit"},"Create & Add")))}

/* ---------- Library > Playlists ---------- */
function PlaylistsView({play,cur,openId,setOpenId}){
 const pls=usePL(),[name,setName]=useState(""),[err,setErr]=useState(""),[conf,setConf]=useState(false),[mnode,openMenu]=useMenu(),rep=useRep();
 const p=pls.find(x=>x.id===openId);
 useEffect(()=>{setConf(false)},[openId]);
 useEffect(()=>{if(!conf)return;const t=setTimeout(()=>setConf(false),3000);return()=>clearTimeout(t)},[conf]);
 if(p){
  const list=p.tracks.map(reg);
  return h("div",{className:"list"},
   h("button",{className:"li press",onClick:()=>setOpenId(null)},Ic("back","r"),"Playlists"),
   h("h2",{className:"plh"},p.name),
   list.length?h("button",{className:"li press plact",onClick:()=>play(list[0],list)},Ic("play","r"),"Play"):h("p",{className:"empty"},"This playlist is empty. Open a song, tap the share button and choose Add to Playlist."),
   list.map(o=>{return h("div",{key:o.id,className:"li"+(cur&&cur.id===o.id?" on":"")},
    h("button",{className:"main press",onClick:()=>play(o,list)},Art(o),h("span",{className:"t"},h("b",null,o.t),h("small",null,o.a))),
    rep===o.id&&Ic("repeat","rp"),
    h("button",{className:"rm",onClick:e=>openMenu(e,trackMenu(o,list,play,"Remove from Playlist",()=>{PL.removeTrack(p.id,o.id);ACT.note("Removed from "+p.name)})),"aria-label":"More","aria-haspopup":"menu"},Ic("more")))}),
   mnode,
   h("button",{className:"li press pldel",onClick:()=>{if(conf){PL.remove(p.id);setOpenId(null)}else setConf(true)}},Ic("trash","r"),conf?"Tap again to delete this playlist":"Delete Playlist"))}
 const create=e=>{e.preventDefault();try{const n=PL.create(name);setName("");setErr("");SFX("success");setOpenId(n.id)}catch(x){setErr(x.message);SFX("warn")}};
 return h("div",{className:"list"},
  h("form",{className:"search",onSubmit:create,noValidate:true},Ic("plus"),
   h("input",{value:name,placeholder:"New playlist",autoComplete:"off",onChange:e=>{setName(e.target.value);setErr("")}}),
   h("button",{type:"submit",className:"mk"},"Create")),
  err&&h("p",{className:"err",role:"alert"},err),
  pls.length?pls.map(x=>{const first=x.tracks[0];
   return h("button",{key:x.id,className:"li press",onClick:()=>setOpenId(x.id)},
    first?Art(reg(first)):h("div",{className:"art",style:{background:"#2a2a2e"}},Ic("list")),
    h("span",{className:"t"},h("b",null,x.name),h("small",null,x.tracks.length+(x.tracks.length===1?" song":" songs"))),Ic("chev","ch"))})
  :h("p",{className:"empty"},"No playlists yet. Create one above, or add a song from the player’s share menu."))}

/* ---------- Recommended for You: based on each playlist's latest tracks (server asks SoundCloud for related tracks) ---------- */
/* آخرین Recommended ذخیره می‌شود (localStorage، یک ورودی برای هر حساب) تا با هر بار ورود به Home یا رفرش فوراً و بدون پرش نمایش داده شود؛
   فقط وقتی لیست‌ها عوض شده یا از ۳ ساعت گذشته دوباره از سرور گرفته می‌شود و ردیف‌های قبلی تا رسیدن جواب می‌مانند. */
const RECTTL=3*3600e3,rcKey=()=>{const u=Auth.current();return u?"ms_recs_v2_"+u.email:null};
const rcRead=()=>{const k=rcKey();if(!k)return null;try{const c=JSON.parse(localStorage.getItem(k));return c&&Array.isArray(c.rows)?c:null}catch(e){return null}};
const rcRows=c=>c?c.rows.map(r=>({title:r.title,tracks:r.tracks.map(reg)})):[];
function useRecs(pls){
 const key=JSON.stringify(pls.filter(p=>p.tracks.length).slice(0,3).map(p=>[p.id,p.name,p.tracks.slice(-3).map(t=>[t.id,t.url]),p.tracks.map(t=>t.id)]));
 const[recs,setRecs]=useState(()=>rcRows(rcRead()));
 useEffect(()=>{let stop=false,tm;const lists=JSON.parse(key);
  if(!lists.length){setRecs([]);return}
  const c=rcRead(),fresh=c&&c.key===key&&Date.now()-c.t<RECTTL;
  if(c)setRecs(rcRows(c));
  const load=async()=>{
   const raw=await Promise.all(lists.map(async([,name,seeds,all])=>{
    try{const r=await fetch("/api/recommend",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({seeds:seeds.map(([id,url])=>({id,url})),exclude:all})});
     if(!r.ok)return null;const tracks=(await r.json()).tracks;
     return tracks.length?{title:"Recommended for “"+name+"”",tracks}:null}catch(e){return null}}));
   if(stop)return;const rows=raw.filter(Boolean);
   if(rows.length||!c){const k=rcKey();if(k)try{localStorage.setItem(k,JSON.stringify({key,t:Date.now(),rows}))}catch(e){}
    setRecs(rows.map(r=>({title:r.title,tracks:r.tracks.map(reg)})))}
   tm=setTimeout(load,RECTTL)};
  if(fresh)tm=setTimeout(load,Math.max(1000,RECTTL-(Date.now()-c.t)));else load();
  return()=>{stop=true;clearTimeout(tm)}},[key]);
 return recs}


/* ---------- حضور آنلاین: هر مرورگر هر ~۲۵ ثانیه ping می‌زند؛ سرور تعداد فعال‌ها را برمی‌گرداند ---------- */
const PRES=(()=>{let n=null,id=null,tm=0;const subs=new Set(),emit=()=>subs.forEach(f=>f(n));
 try{id=localStorage.getItem("ms_cid")}catch(e){}
 if(!id){id=(window.crypto&&crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2,12)).replace(/[^A-Za-z0-9-]/g,"");try{localStorage.setItem("ms_cid",id)}catch(e){}}
 const ping=async()=>{try{const r=await fetch("/api/ping",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id}),keepalive:true});if(!r.ok)return;n=(await r.json()).online;emit()}catch(e){}};
 const start=()=>{if(tm)return;ping();tm=setInterval(ping,25e3);
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)ping()});
  addEventListener("pagehide",()=>{try{navigator.sendBeacon("/api/leave",new Blob([JSON.stringify({id})],{type:"application/json"}))}catch(e){}});
  addEventListener("pageshow",e=>{if(e.persisted)ping()})};
 return{get n(){return n},on(f){subs.add(f);return()=>subs.delete(f)},start}})();
PRES.start();
function usePres(){const[n,setN]=useState(PRES.n);useEffect(()=>{setN(PRES.n);return PRES.on(setN)},[]);return n}

/* ---------- دکمه‌ی پشتیبانی (بالا-چپ): تعداد آنلاین + لینک‌های SVG ---------- */
function Support(){
 const[open,setOpen]=useState(false),[pos,setPos]=useState({top:60,left:16}),n=usePres(),bt=useRef(null);
 useEffect(()=>{if(!open)return;const k=e=>{if(e.key==="Escape")setOpen(false)};document.addEventListener("keydown",k);return()=>document.removeEventListener("keydown",k)},[open]);
 const toggle=()=>{if(!open&&bt.current){const r=bt.current.getBoundingClientRect(),b=document.querySelector(".shell").getBoundingClientRect();setPos({top:r.bottom-b.top+8,left:Math.max(12,r.left-b.left)})}setOpen(!open)};
 const A=(cls,href,label,ic)=>h("a",{className:cls,href,target:"_blank",rel:"noopener noreferrer","aria-label":label,title:label,onClick:()=>setOpen(false)},Ic(ic));
 return h(React.Fragment,null,
  h("button",{ref:bt,className:"circ press sup",onClick:toggle,"aria-label":"Support","aria-haspopup":"menu","aria-expanded":open},Ic("headset"),n!=null&&h("i",{className:"ldot"})),
  open&&ReactDOM.createPortal(h("div",{className:"ov",onClick:()=>setOpen(false)},
   h("div",{className:"pmenu smenu",role:"menu",style:{top:pos.top,left:pos.left,right:"auto"},onClick:e=>e.stopPropagation()},
    h("div",{className:"sonl"},h("i",{className:"ldot"}),h("b",null,n==null?"–":n.toLocaleString()),h("span",null,"online now")),
    h("div",{className:"slinks"},A("tg","https://t.me/amirh00sain","Telegram","tg"),A("gh","https://github.com/amirh00sain","GitHub","gh")))),document.querySelector(".shell")))}
