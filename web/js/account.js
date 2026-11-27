/* Account UI: sign in / create account, profile menu, change password, delete account */
Object.assign(I,{
 mail:'<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7.5 8 6 8-6"/></g>',
 key:'<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M16 7l3 3M14 9l2 2"/></g>',
 lock:'<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></g>',
 user:'<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/></g>',
 trash:'<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></g>',
 out:'<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M15 8l4 4-4 4M19 12H9"/></g>',
 x:'<path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>'
});

function Field({icon,type,value,onChange,placeholder,ac,name,focus,cap}){
 const[show,setShow]=useState(false),pw=type==="password";
 return h("label",{className:"fld"},Ic(icon),
  h("input",{type:pw&&show?"text":type,value,placeholder,name,autoComplete:ac,autoFocus:focus,spellCheck:false,autoCapitalize:cap||"off",onChange:e=>onChange(e.target.value)}),
  pw&&h("button",{type:"button",className:"eye",onClick:()=>setShow(!show),"aria-label":show?"Hide password":"Show password"},show?"Hide":"Show"))}

function AuthScreen({onAuth}){
 const[mode,setMode]=useState("in"),[name,setName]=useState(""),[email,setEmail]=useState(""),[pw,setPw]=useState(""),[pw2,setPw2]=useState(""),[err,setErr]=useState(""),[busy,setBusy]=useState(false);
 const up=mode==="up",sw=m=>{setMode(m);setErr("");setPw2("")};
 const submit=async e=>{e.preventDefault();if(busy)return;setErr("");
  if(up&&pw!==pw2){SFX("warn");return setErr("Passwords don’t match.")}
  setBusy(true);
  try{const u=up?await Auth.register({name,email,password:pw}):await Auth.login({email,password:pw});SFX(up?"signup":"login");onAuth(u)}
  catch(x){setErr(x.message||"Something went wrong. Try again.");setBusy(false);SFX("error")}};
 return h("div",{className:"auth"},h("div",{className:"auth-in"},h("div",{className:"auth-card"},
  h("div",{className:"logo rise",style:{"--d":0}},Ic("note")),
  h("h1",{className:"rise",style:{"--d":1}},"Music"),
  h("p",{className:"sub rise",style:{"--d":2}},up?"Create an account to start listening.":"Sign in to pick up where you left off."),
  h("div",{className:"seg rise",style:{"--i":up?1:0,"--d":3}},h("div",{className:"hl2"}),
   h("button",{type:"button",className:up?"":"on",onClick:()=>sw("in")},"Sign In"),
   h("button",{type:"button",className:up?"on":"",onClick:()=>sw("up")},"Create Account")),
  h("form",{onSubmit:submit,noValidate:true,className:"rise",style:{"--d":4}},
   h("div",{className:"grp"},
    up&&h(Field,{key:"n",icon:"user",type:"text",value:name,onChange:setName,placeholder:"Name",ac:"name",name:"name",cap:"words"}),
    h(Field,{key:"e",icon:"mail",type:"email",value:email,onChange:setEmail,placeholder:"Email",ac:"email",name:"email"}),
    h(Field,{key:"p"+mode,icon:"lock",type:"password",value:pw,onChange:setPw,placeholder:"Password",ac:up?"new-password":"current-password",name:"password"}),
    up&&h(Field,{key:"p2",icon:"lock",type:"password",value:pw2,onChange:setPw2,placeholder:"Confirm password",ac:"new-password",name:"confirm"})),
   err&&h("p",{className:"err",role:"alert"},err),
   h("button",{className:"btn",type:"submit",disabled:busy},busy?"Please wait…":up?"Create Account":"Sign In")),
  h("p",{className:"alt rise",style:{"--d":5}},up?"Already have an account? ":"New here? ",
   h("button",{type:"button",onClick:()=>sw(up?"in":"up")},up?"Sign in":"Create an account")))))}

function Modal({title,onClose,children}){
 return h("div",{className:"ov dim",onClick:onClose},
  h("div",{className:"dlg",role:"dialog","aria-modal":"true","aria-label":title,onClick:e=>e.stopPropagation()},
   h("div",{className:"dh"},h("b",null,title),h("button",{className:"circ",onClick:onClose,"aria-label":"Close"},Ic("x"))),children))}

function ChangePw({user,close,notify}){
 const[a,setA]=useState(""),[b,setB]=useState(""),[c,setC]=useState(""),[err,setErr]=useState(""),[busy,setBusy]=useState(false);
 const go=async e=>{e.preventDefault();if(busy)return;setErr("");
  if(b!==c){SFX("warn");return setErr("New passwords don’t match.")}
  setBusy(true);
  try{await Auth.changePassword(a,b);notify("Password updated");close()}
  catch(x){setErr(x.message||"Couldn’t update the password.");setBusy(false);SFX("error")}};
 return h(Modal,{title:"Change Password",onClose:close},
  h("form",{onSubmit:go,noValidate:true},
   h("input",{type:"text",hidden:true,readOnly:true,autoComplete:"username",value:user.email}),
   h("div",{className:"grp"},
    h(Field,{icon:"lock",type:"password",value:a,onChange:setA,placeholder:"Current password",ac:"current-password",name:"current",focus:true}),
    h(Field,{icon:"key",type:"password",value:b,onChange:setB,placeholder:"New password",ac:"new-password",name:"new"}),
    h(Field,{icon:"key",type:"password",value:c,onChange:setC,placeholder:"Confirm new password",ac:"new-password",name:"confirm"})),
   err&&h("p",{className:"err",role:"alert"},err),
   h("button",{className:"btn",type:"submit",disabled:busy},busy?"Please wait…":"Update Password")))}

function DeleteAcct({user,close,gone}){
 const[p,setP]=useState(""),[err,setErr]=useState(""),[busy,setBusy]=useState(false);
 const go=async e=>{e.preventDefault();if(busy)return;setErr("");setBusy(true);
  try{await Auth.deleteAccount(p);gone()}
  catch(x){setErr(x.message||"Couldn’t delete the account.");setBusy(false);SFX("error")}};
 return h(Modal,{title:"Delete Account",onClose:close},
  h("form",{onSubmit:go,noValidate:true},
   h("p",{className:"note"},"This permanently deletes the account for "+user.email+" from this browser. You can’t undo it."),
   h("input",{type:"text",hidden:true,readOnly:true,autoComplete:"username",value:user.email}),
   h("div",{className:"grp"},h(Field,{icon:"lock",type:"password",value:p,onChange:setP,placeholder:"Enter your password",ac:"current-password",name:"password",focus:true})),
   err&&h("p",{className:"err",role:"alert"},err),
   h("button",{className:"btn",type:"submit",disabled:busy},busy?"Please wait…":"Delete Account"),
   h("button",{className:"btn ghost",type:"button",onClick:close},"Cancel")))}

function Profile({user,view,setView,logout,notify,gone}){
 const[,bump]=useState(0);
 if(!view)return null;
 const close=()=>setView(null);
 if(view==="pw")return h(ChangePw,{user,close,notify});
 if(view==="del")return h(DeleteAcct,{user,close,gone});
 const item=(ic,label,fn)=>h("button",{className:"pitem"+(ic==="trash"?" danger":""),role:"menuitem",onClick:fn},Ic(ic),h("span",{className:"t"},label));
 return h("div",{className:"ov",onClick:close},
  h("div",{className:"pmenu",role:"menu",onClick:e=>e.stopPropagation()},
   h("div",{className:"ph"},h("div",{className:"circ av lg"},ini(user.name)),h("div",{className:"pi"},h("b",null,user.name))),
   h("div",{className:"pl"},
    h("div",{className:"pitem static"},Ic("mail"),h("div",{className:"t"},h("span",null,"Email"),h("small",null,user.email))),
    h("div",{className:"sep"}),
    window.sfx&&h("button",{className:"pitem","data-sfx":1,role:"menuitem",onClick:()=>{window.sfx.toggle();bump(x=>x+1)}},Ic(window.sfx.enabled?"vol":"volx"),h("span",{className:"t"},window.sfx.enabled?"Sound: On":"Sound: Off")),
    item("key","Change Password",()=>setView("pw")),
    item("trash","Delete Account",()=>setView("del")),
    h("div",{className:"sep"}),
    item("out","Sign Out",logout))))}

function Root(){
 const[user,setUser]=useState(()=>Auth.current()),[view,setView]=useState(null),[toast,setToast]=useState(null),tt=useRef(0);
 const notify=m=>{const sn=toastSnd(m);if(sn)SFX(sn);setToast(m);clearTimeout(tt.current);tt.current=setTimeout(()=>setToast(null),2600)};
 useEffect(()=>{const f=()=>{const u=Auth.current();setUser(u);if(!u)setView(null)};addEventListener("storage",f);return()=>removeEventListener("storage",f)},[]);
 useEffect(()=>{if(!view)return;const k=e=>{if(e.key==="Escape")setView(null)};document.addEventListener("keydown",k);return()=>document.removeEventListener("keydown",k)},[view]);
 const logout=()=>{SFX("logout");au.pause();Auth.logout();setUser(null);setView(null)};
 const gone=()=>{SFX("danger");au.pause();setUser(null);setView(null);notify("Account deleted")};
 const ctx=React.useMemo(()=>({user,notify,openMenu:()=>setView("menu")}),[user]);
 return h("div",{className:"shell"},
  user?h(UserCtx.Provider,{value:ctx},h(App,{key:user.email}),h(Profile,{user,view,setView,logout,notify,gone}))
      :h(AuthScreen,{onAuth:setUser}),
  toast&&h("div",{className:"toast",role:"status"},toast))}

ReactDOM.createRoot(document.getElementById("root")).render(h(Root));
