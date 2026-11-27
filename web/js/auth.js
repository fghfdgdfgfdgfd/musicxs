/* Accounts live in this browser (localStorage). Passwords are never stored as plain text. */
const Auth=(()=>{
 const UK="ms_users_v1",SK="ms_session_v1",MIN=6;
 const rd=k=>{try{return JSON.parse(localStorage.getItem(k))}catch(e){return null}};
 const users=()=>rd(UK)||{};
 const put=u=>{try{localStorage.setItem(UK,JSON.stringify(u))}catch(e){throw new Error("This browser can’t save accounts (storage is blocked).")}};
 const hex=b=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,"0")).join("");
 const canSubtle=()=>!!(window.crypto&&crypto.subtle&&crypto.subtle.importKey);
 const rnd=()=>{const a=new Uint8Array(16);if(window.crypto&&crypto.getRandomValues)crypto.getRandomValues(a);else a.forEach((_,i)=>a[i]=Math.random()*256);return hex(a)};
 const clean=n=>String(n||"").replace(/\s+/g," ").trim();
 const normE=e=>String(e||"").trim().toLowerCase();
 const okE=e=>/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
 const pub=u=>({name:u.name,email:u.email});

 async function derive(pw,salt,alg){
  if(alg==="pbkdf2"){
   if(!canSubtle())throw new Error("Open the site over https or localhost to sign in.");
   const e=new TextEncoder(),k=await crypto.subtle.importKey("raw",e.encode(pw),"PBKDF2",false,["deriveBits"]);
   return hex(await crypto.subtle.deriveBits({name:"PBKDF2",salt:e.encode(salt),iterations:150000,hash:"SHA-256"},k,256))}
  /* fallback for non-secure contexts (plain http on a LAN address) */
  let h1=0xdeadbeef,h2=0x41c6ce57;const s=salt+pw;
  for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);h1=Math.imul(h1^c,2654435761);h2=Math.imul(h2^c,1597334677)}
  h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909);
  h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909);
  return(4294967296*(2097151&h2)+(h1>>>0)).toString(16)}
 async function mk(pw){const salt=rnd(),alg=canSubtle()?"pbkdf2":"basic";return{salt,alg,hash:await derive(pw,salt,alg)}}
 const check=async(u,pw)=>(await derive(pw,u.salt,u.alg))===u.hash;
 const me=()=>{const e=localStorage.getItem(SK),u=e&&users()[e];return u||null};
 const needPw=p=>{if(String(p||"").length<MIN)throw new Error("Password must be at least "+MIN+" characters.")};

 return{
  MIN,
  current(){try{const u=me();if(!u&&localStorage.getItem(SK))localStorage.removeItem(SK);return u?pub(u):null}catch(e){return null}},
  async register({name,email,password}){
   name=clean(name);email=normE(email);
   if(name.length<2)throw new Error("Enter your name (at least 2 letters).");
   if(name.length>40)throw new Error("Name is too long (40 characters max).");
   if(!okE(email))throw new Error("Enter a valid email address.");
   needPw(password);
   const all=users();
   if(all[email])throw new Error("An account with this email already exists. Sign in instead.");
   all[email]={name,email,created:Date.now(),...await mk(password)};
   put(all);localStorage.setItem(SK,email);return pub(all[email])},
  async login({email,password}){
   email=normE(email);
   if(!email||!password)throw new Error("Enter your email and password.");
   const u=users()[email];
   if(!u||!(await check(u,password)))throw new Error("Email or password is incorrect.");
   localStorage.setItem(SK,email);return pub(u)},
  logout(){try{localStorage.removeItem(SK)}catch(e){}},
  async changePassword(cur,next){
   const u=me();if(!u)throw new Error("You’re signed out. Sign in again.");
   if(!(await check(u,cur)))throw new Error("Current password is incorrect.");
   needPw(next);
   if(next===cur)throw new Error("New password must be different from the current one.");
   const all=users();all[u.email]={...u,...await mk(next)};put(all)},
  async deleteAccount(password){
   const u=me();if(!u)throw new Error("You’re signed out. Sign in again.");
   if(!(await check(u,password)))throw new Error("Password is incorrect.");
   const all=users();delete all[u.email];put(all);localStorage.removeItem(SK);try{localStorage.removeItem("ms_pl_v1_"+u.email)}catch(e){}}
 }})();
