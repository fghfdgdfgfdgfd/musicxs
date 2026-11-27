/* Accounts are stored on the server. Legacy browser-only accounts are migrated on first successful sign-in. */
const Auth=(()=>{
 const UK="ms_users_v1",MIN=6;
 let activeUser=null;
 const normE=e=>String(e||"").trim().toLowerCase();
 const readLegacy=()=>{try{return JSON.parse(localStorage.getItem(UK))||{}}catch(e){return {}}};
 const hex=b=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,"0")).join("");
 const canSubtle=()=>!!(window.crypto&&crypto.subtle&&crypto.subtle.importKey);
 async function legacyDerive(pw,salt,alg){
  if(alg==="pbkdf2"){
   if(!canSubtle())return null;
   const e=new TextEncoder(),k=await crypto.subtle.importKey("raw",e.encode(pw),"PBKDF2",false,["deriveBits"]);
   return hex(await crypto.subtle.deriveBits({name:"PBKDF2",salt:e.encode(salt),iterations:150000,hash:"SHA-256"},k,256));
  }
  let h1=0xdeadbeef,h2=0x41c6ce57;const s=salt+pw;
  for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);h1=Math.imul(h1^c,2654435761);h2=Math.imul(h2^c,1597334677)}
  h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909);
  h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909);
  return(4294967296*(2097151&h2)+(h1>>>0)).toString(16);
 }
 async function legacyMatches(u,pw){try{return !!u&&await legacyDerive(pw,u.salt,u.alg)===u.hash}catch(e){return false}}
 async function request(path,options={}){
  let r;
  try{r=await fetch(path,{credentials:"same-origin",...options,headers:{...(options.body?{"Content-Type":"application/json"}:{}),...(options.headers||{})}})}
  catch(e){throw new Error("Can’t reach the server. Check your connection and try again.")}
  let data={};try{data=await r.json()}catch(e){}
  if(!r.ok)throw new Error(data.detail||"Something went wrong. Try again.");
  return data;
 }
 const json=(method,data)=>({method,body:JSON.stringify(data)});
 return{
  MIN,
  current(){return activeUser},
  async restore(){try{activeUser=await request("/api/auth/me")}catch(e){activeUser=null}return activeUser},
  async register({name,email,password}){
   name=String(name||"").replace(/\s+/g," ").trim();email=normE(email);
   if(name.length<2)throw new Error("Enter your name (at least 2 letters).");
   if(name.length>40)throw new Error("Name is too long (40 characters max).");
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))throw new Error("Enter a valid email address.");
   if(String(password||"").length<MIN)throw new Error("Password must be at least "+MIN+" characters.");
   activeUser=await request("/api/auth/register",json("POST",{name,email,password}));
   return activeUser;
  },
  async login({email,password}){
   email=normE(email);
   if(!email||!password)throw new Error("Enter your email and password.");
   try{activeUser=await request("/api/auth/login",json("POST",{email,password}));return activeUser}
   catch(serverError){
    /* Upgrade old accounts previously kept only in this browser. */
    if(serverError.message==="Email or password is incorrect."){
     const legacy=readLegacy()[email];
     if(await legacyMatches(legacy,password)){
      try{
       activeUser=await request("/api/auth/register",json("POST",{name:legacy.name||"Music User",email,password}));
       const all=readLegacy();delete all[email];
       try{localStorage.setItem(UK,JSON.stringify(all))}catch(e){}
       return activeUser;
      }catch(migrationError){/* An account already exists on the server: keep the original sign-in error. */}
     }
    }
    throw serverError;
   }
  },
  async logout(){await request("/api/auth/logout",{method:"POST"});activeUser=null},
  async changePassword(cur,next){
   if(String(next||"").length<MIN)throw new Error("Password must be at least "+MIN+" characters.");
   if(next===cur)throw new Error("New password must be different from the current one.");
   await request("/api/auth/password",json("POST",{current_password:cur,new_password:next}));
  },
  async deleteAccount(password){await request("/api/auth/account",json("DELETE",{password}));activeUser=null}
 };
})();
