/* Player extras: playlists (saved per account in this browser), download, playback speed, share menu */
const IS='fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
Object.assign(I,{
 share:`<g ${IS}><path d="M12 15V4M8 7.5 12 4l4 3.5"/><path d="M8 10H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-2"/></g>`,
 download:`<g ${IS}><path d="M12 4v11M8 11.5l4 3.5 4-3.5M5 19.5h14"/></g>`,
 plus:`<g ${IS}><path d="M12 5v14M5 12h14"/></g>`,
 check:`<path d="m5 12.5 4.5 4.5L19 7" ${IS} stroke-width="2.6"/>`,
 addlist:`<g ${IS}><path d="M4 7h11M4 12h7M4 17h7M17 13v6M14 16h6"/></g>`
});

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
  remove(id){write(read().filter(p=>p.id!==id));emit()}
 }})();
function usePL(){const[,n]=useState(0);useEffect(()=>PL.on(()=>n(x=>x+1)),[]);return PL.all()}

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
function PlaylistsView({play,cur}){
 const pls=usePL(),[openId,setOpenId]=useState(null),[name,setName]=useState(""),[err,setErr]=useState(""),[conf,setConf]=useState(false);
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
    h("button",{className:"rm",onClick:()=>PL.removeTrack(p.id,o.id),"aria-label":"Remove from playlist"},Ic("x")))}),
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
function useRecs(pls){
 const key=JSON.stringify(pls.filter(p=>p.tracks.length).slice(0,3).map(p=>[p.id,p.name,p.tracks.slice(-3).map(t=>[t.id,t.url]),p.tracks.map(t=>t.id)]));
 const[recs,setRecs]=useState([]);
 useEffect(()=>{let stop=false,tm;const lists=JSON.parse(key);
  if(!lists.length){setRecs([]);return}
  const load=async()=>{
   const out=await Promise.all(lists.map(async([,name,seeds,all])=>{
    try{const r=await fetch("/api/recommend",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({seeds:seeds.map(([id,url])=>({id,url})),exclude:all})});
     if(!r.ok)return null;const tracks=(await r.json()).tracks.map(reg);
     return tracks.length?{title:"Recommended for “"+name+"”",tracks}:null}catch(e){return null}}));
   if(!stop){setRecs(out.filter(Boolean));tm=setTimeout(load,3*3600e3)}};
  load();return()=>{stop=true;clearTimeout(tm)}},[key]);
 return recs}
