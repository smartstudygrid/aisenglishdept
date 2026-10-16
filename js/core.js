// core.js — split from index.single.html (no logic changes).
// Classic script: shares global scope with the other js/*.js files (same as the old single <script type="module">).
// Firebase symbols (db, auth, collection, doc, ...) come from js/firebase-init.js via window.
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const sha=async t=>[...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(t)))].map(b=>b.toString(16).padStart(2,"0")).join("");
const TEAM_HASH="0086b0a2fd7337577f13ee53f8ea532160e1a682d2a874c3bb03ab568b3d4385";
const DEFAULT_TEAMS=["Gladiators YB","KHAN JEE","KAPTAN 11","Pak EAGLES","RCC","SWAT XI","Riyadh Stallions","Riyadh Strikers","Saudi German","Punjab XI","Riyadh Kings","Team Avengers"];
const ovs=b=>`${Math.floor(b/6)}.${b%6}`;
const when=t=>t?new Date(t).toLocaleString([],{weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}):"";
const abbr=n=>{const w=String(n||"").trim().split(/\s+/);return(w.length>1?w.map(x=>x[0]).join(""):String(n||"").slice(0,3)).toUpperCase().padEnd(3,"X").slice(0,3);};

// ---------- shared state ----------
const Auth={user:null,admin:false,tids:[],teamIds:[],guest:false};
let Tours=[{id:"default",name:"Challenger's Cup"}];
let SqTeams=[];let SqSeeded=false;let SqErr="";
let GuideData={at:0,loaded:false,hasPlayers:false};
// Single floating back button: every screen registers where ← goes (null = no back).
let BackAct=null;
function setBack(fn){BackAct=typeof fn==="function"?fn:null;try{window.__updBack&&window.__updBack();}catch{}}
const backNow=()=>BackAct;
const guideHidden=()=>{try{return !!localStorage.getItem("scGuideHide");}catch{return false;}};
function guideSteps(){
  const em=myEmail();
  const hasTeam=SqTeams.some(t=>canEditSquad(t.id));
  const hasMatch=ScMatches.some(m=>(m.owner||"").toLowerCase()===em);
  return[
    {k:"team",n:1,t:"Create your team",sub:"Takes 30 seconds",done:hasTeam},
    {k:"players",n:2,t:"Add players",sub:"Open your squad and save names",done:GuideData.hasPlayers},
    {k:"match",n:3,t:"Score your first match",sub:"Open the Score screen and start one",done:hasMatch},
  ];
}
const guideDone=()=>guideSteps().every(s=>s.done);
async function ensureGuideData(){
  const now=Date.now();
  if(GuideData.loaded&&now-GuideData.at<30000)return GuideData.hasPlayers;
  GuideData.at=now;GuideData.loaded=true;
  const em=myEmail(),prev=GuideData.hasPlayers;GuideData.hasPlayers=false;
  const mine=SqTeams.filter(t=>canEditSquad(t.id)).slice(0,12);
  for(const t of mine){try{const d=(await getDoc(doc(db,"squads",t.id))).data()||{};if([d.captain_name,...(d.player_list||[])].some(s=>s&&s.trim())){GuideData.hasPlayers=true;break;}}catch{}}
  if(prev!==GuideData.hasPlayers&&typeof CurView!=="undefined"&&CurView==="home")renderHome();
  return GuideData.hasPlayers;
}
function guideGo(k){
  const em=myEmail();
  if(k==="team"){setView("squad");setTimeout(()=>sqUserAddTeam(),80);}
  else if(k==="players"){const t=SqTeams.find(x=>(x.owner||"")==em)||SqTeams.find(x=>canEditSquad(x.id));if(!t)return toast("Create your team first.");setView("squad");setTimeout(()=>sqOpen(t.id,false),80);}
  else if(k==="match"){setView("scorer");}
}
let ScMatches=[];let ScSquadsCache=null;let ScStagesCache={};
const SqS={team:null,viewOnly:false,edit:false,d:null,msg:"",tname:"",tour:""};
const ScS={tour:"",tab:"m",statSel:"bat",mt:"",m:null,ex:false,view:"",sel:{1:[],2:[]},sub:{1:"",2:""},pics:{1:{},2:{}},picsFor:"",out:null,cb:false,sumOpen:undefined,sumParam:false,unsubM:null,pk:{}};
let CurView="home";

// ---------- view manager (disabled stylesheets = zero UI change) ----------
function setView(v){
  closeDrawer();
  try{window.scrollTo(0,0);}catch{}
  CurView=v;document.body.dataset.view=v;
  setBack(null);
  const sq=$("#css-squad"),sc=$("#css-scorer");
  if(sq)sq.disabled=(v!=="squad");
  if(sc)sc.disabled=(v!=="scorer"&&v!=="overlay");
  $("#home-app").hidden=(v!=="home"&&v!=="cricket"&&v!=="account");
  $("#squad-app").hidden=(v!=="squad");
  $("#scorer-app").hidden=(v!=="scorer"&&v!=="overlay");
  document.body.classList.remove("sq","ovb");document.documentElement.classList.remove("ovh");
  if(v==="squad"){/* sq class managed by squad renderer */}
  if(v==="overlay"){document.documentElement.classList.add("ovh");document.body.classList.add("ovb");}
  if(v==="home")renderHome();
  if(v==="cricket")cricketView();
  if(v==="account")accountView();
  renderChrome();
  if(v==="squad")sqHome();
  if(v==="scorer"){if(ScS.playNext){ScS.playNext=false;scPlay();}else scList();}
}
window.__showView=setView;
// ---------- role shell: bottom tabs (users) / sidebar (admin) ----------
const HOME_SVG='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 11 12 4l8.5 7"/><path d="M6 9.8V20h12V9.8"/><path d="M10 20v-5h4v5"/></svg>';
const IC={home:HOME_SVG,cricket:String.fromCodePoint(0x1F465),score:String.fromCodePoint(0x1F3CF),account:String.fromCodePoint(0x1F464),tours:String.fromCodePoint(0x1F3C6),scorers:String.fromCodePoint(0x1F465),squads:String.fromCodePoint(0x270F),teams:String.fromCodePoint(0x1F6E1),users:String.fromCodePoint(0x1F464),matches:String.fromCodePoint(0x1F4CB),fixtures:"🗓️"};
function routeHome(){if(Auth.admin){setView("squad");sqAdmin();}else setView("home");}
function renderChrome(){
  const tb=$("#tabbar"),sb=$("#admin-side");if(!tb||!sb)return;
  const ov=document.body.classList.contains("ovb");
  const u=Auth.user,g=Auth.guest;
  const paintTabs=()=>{
    const cur=CurView==="scorer"?"score":(CurView==="squad"||CurView==="cricket")?"cricket":CurView==="account"?"account":"home";
    const tabs=[["home","home","Home"],["cricket","cricket","My Cricket"],["score","tours","Tournament"],["account","account","Account"]];
    tb.innerHTML=tabs.map(([k,ic,x])=>`<button class="tabbtn ${cur===k?"on":""}" data-tb="${k}"><span class="ti">${IC[ic]}</span>${x}</button>`).join("");
    tb.querySelectorAll("[data-tb]").forEach(b=>b.onclick=()=>tabGo(b.dataset.tb));
  };
  if(Auth.admin&&!ov){
    sb.hidden=false;document.body.classList.add("side-on");
    const mods=[["atours","tours","Tournaments"],["ascorers","scorers","Scorers"],["asquads","squads","Squads"],["ateams","teams","Teams"],["ausers","users","Users"],["amatches","matches","Matches"],["afixtures","fixtures","Fixtures"]];
    const cur=ScS.adminMod||"atours";
    sb.innerHTML=`<div class="ah"><b>SmartCric</b><div class="mut">ADMIN</div></div>`+mods.map(([k,ic,x])=>`<button class="abtn ${cur===k?"on":""}" data-am="${k}"><span class="ai">${IC[ic]}</span>${x}</button>`).join("")+`<div style="margin-top:auto;display:flex;gap:6px"><button class="abtn" data-am="atheme" style="flex:1">Theme</button><button class="abtn" data-am="aout" style="flex:1">Sign Out</button></div>`;
    sb.querySelectorAll("[data-am]").forEach(b=>b.onclick=()=>adminGo(b.dataset.am));
    tb.hidden=false;document.body.classList.add("tabs-on");paintTabs();
  }else{
    sb.hidden=true;document.body.classList.remove("side-on");
    if((u||g)&&!ov){tb.hidden=false;document.body.classList.add("tabs-on");paintTabs();
    }else{tb.hidden=true;document.body.classList.remove("tabs-on");}
  }
}
function tabGo(t){if(t==="home")setView("home");else if(t==="cricket"){ScS.cseg=ScS.cseg||"teams";setView("cricket");}else if(t==="score"){ScS.playNext=false;ScS.tab="m";setView("scorer");}else if(t==="account")setView("account");}
function adminGo(k){ScS.adminMod=k;
  if(k==="atheme"){toggleTheme();renderChrome();return;}
  if(k==="aout"){drawerGo("signout");return;}
  if(k==="atours"){setView("squad");sqAdmin();}
  else if(k==="ascorers")usersAdmin("home");
  else if(k==="asquads"){setView("squad");squadEditors();}
  else if(k==="ateams"){setView("squad");sqAdminRender();}
  else if(k==="ausers")usersPanel();
  else if(k==="amatches"){ScS.tab="m";setView("scorer");}
  else if(k==="afixtures")fixturesView("");
  renderChrome();
}
const mcTeamIds=()=>new Set(SqTeams.filter(t=>canEditSquad(t.id)).map(t=>t.id));
const teamPlays=m=>{const em=myEmail();if(!em)return false;return[m.t1,m.t2].some(id=>{if(!id)return false;const t=SqTeams.find(x=>x.id===id);return!!t&&(((t.owner||"").toLowerCase()===em)||teamEditors(id).includes(em)||teamCoOwners(id).includes(em));});};
const matchMine=m=>{const em=myEmail();return(Auth.tids||[]).includes(m.tid)||(!!em&&tourScorers(m.tid).includes(em))||tourOwns(m)||(!!em&&(m.owner||"").toLowerCase()===em)||(!!em&&(m.challenged||"").toLowerCase()===em)||(!!em&&(m.scoredBy||"").toLowerCase()===em)||(!!em&&(m.grant||"").toLowerCase()===em)||mcTeamIds().has(m.t1)||mcTeamIds().has(m.t2);};
function mcMatches(){return ScMatches.filter(matchMine);}
function mcDone(m){try{return scInfo({...m,history:m.history||[]}).done;}catch{return m.status==="completed";}}
function mcCat(m){if(m.status==="completed"||(m.status==="live"&&mcDone(m)))return"p";if(m.status==="live")return"l";return"u";}
function mcTours(ms){const em=myEmail(),s=new Set();
  Tours.forEach(t=>{if(t.id!=="default"&&(tourOwner(t.id)===em||(Auth.tids||[]).includes(t.id)||tourScorers(t.id).includes(em)))s.add(t.id);});
  SqTeams.filter(t=>canEditSquad(t.id)&&t.tid).forEach(t=>s.add(t.tid));
  ms.forEach(m=>{if(m.tid)s.add(m.tid);});
  return Tours.filter(t=>s.has(t.id));}
function cricketView(){
  setCssForHome();
  const em=myEmail(),seg=ScS.cseg||"teams";
  const myT=SqTeams.filter(t=>canEditSquad(t.id)).sort((a,b)=>a.name.localeCompare(b.name));
  const myM=mcMatches(),mT=mcTours(myM);
  const g={l:[],u:[],p:[]};myM.forEach(m=>g[mcCat(m)].push(m));
  g.l.sort((a,b)=>(b.when||0)-(a.when||0));g.u.sort((a,b)=>(a.when||0)-(b.when||0));g.p.sort((a,b)=>(b.when||0)-(a.when||0));
  const mf=ScS.mcf&&g[ScS.mcf]?ScS.mcf:(g.l.length?"l":g.u.length?"u":g.p.length?"p":"l");
  const empty=(ic,t,s,btn)=>`<div class="mc-empty"><div class="mc-eic">${ic}</div><b>${t}</b><span>${s}</span>${btn||""}</div>`;
  const matchCard=m=>{const k=mcCat(m),ch=(m.challenged||"").toLowerCase()===em;let i={};try{i=scInfo({...m,history:m.history||[]});}catch{}
    const lbl=k==="l"?"LIVE":k==="p"?"COMPLETED":ch?"⚔️ CHALLENGE":"UPCOMING";
    const sc=k==="u"?(m.when?when(m.when):"Not started yet"):`${m.runs||0}-${i.w||0} <small>(${ovs(m.balls||0)} ov)</small>`;
    return`<div class="mc-match ${k}" role="button" tabindex="0" data-cmid="${esc(m.id)}"><div class="mc-mh"><span class="mc-st ${k}">${k==="l"?'<i class="mc-dot"></i>':""}${lbl}</span><span class="mc-tn">${esc(tname(m.tid))} · ${m.overs} ov</span></div><div class="mc-vs"><div class="mc-tm"><b>${esc(abbr(m.n1))}</b><span>${esc(m.n1)}</span></div><div class="mc-mid">VS</div><div class="mc-tm"><b>${esc(abbr(m.n2))}</b><span>${esc(m.n2)}</span></div></div><div class="mc-mf"><span class="mc-sc">${sc}</span><span class="mc-go">${k==="l"?"Watch live":k==="p"?"Scorecard":"Details"} ›</span></div></div>`;};
  let body="";
  if(seg==="teams")body=myT.map(t=>{const lk=(SqTeams.find(y=>y.id===t.id)||{}).locked;return`<div class="mc-team" role="button" tabindex="0" data-cteam="${esc(t.id)}" data-lock="${lk?1:0}"><div class="mc-av">${esc(abbr(t.name))}</div><div class="mc-ti"><b>${esc(t.name)}</b><span>${esc(tname(t.tid))}</span></div><span class="mc-open">Open ›</span></div>`;}).join("")||empty("🛡️","No teams yet","Create a team to add players and join tournaments.",`<button class="btn sm auto" data-cgo="team">+ Create team</button>`);
  else if(seg==="matches"){const opts=[["l","Live"],["u","Upcoming"],["p","Past"]];
    body=`<div class="mc-selwrap"><label for="mc-mf">Show</label><select id="mc-mf" class="mc-sel">${opts.map(([k,x])=>`<option value="${k}" ${mf===k?"selected":""}>${x} (${g[k].length})</option>`).join("")}</select></div>`+(g[mf].map(matchCard).join("")||empty("🏏",`No ${opts.find(o=>o[0]===mf)[1].toLowerCase()} matches`,"Matches you play, score or follow will appear here."));}
  else body=mT.map(t=>{const own=tourOwner(t.id)===em,nm=myM.filter(m=>m.tid===t.id).length,nt=myT.filter(x=>x.tid===t.id).length;return`<div class="mc-team tour" role="button" tabindex="0" data-ctour="${esc(t.id)}" data-own="${own?1:0}"><div class="mc-av">🏆</div><div class="mc-ti"><b>${esc(t.name)}</b><span>${esc(tourSeasonYear(t.id))} · ${nt} team${nt===1?"":"s"} · ${nm} match${nm===1?"":"es"}</span></div><span class="mc-tag">${own?"Owner":"Member"}</span><span class="mc-open">Open ›</span></div>`;}).join("")||empty("🏆","No tournaments yet","Join one with a code or create your own.",`<button class="btn sm auto" data-cgo="join">Join with code</button>`);
  const segs=[["teams","🛡️","Teams",myT.length],["matches","🏏","Matches",myM.length],["tours","🏆","Tourneys",mT.length]];
  $("#home-app").innerHTML=`<div class="hm-wrap mc"><div class="mc-head"><div class="mc-ttl">My Cricket</div><div class="mc-sub">Your teams, matches & tournaments</div></div><button class="mc-score" id="mc-score">🏏 Score a Match</button><div class="mc-seg">${segs.map(([k,ic,x,n])=>`<button class="${seg===k?"on":""}" data-cseg="${k}"><span class="mc-sic">${ic}</span><span>${x}</span><em>${n}</em></button>`).join("")}</div><div class="mc-list">${body}</div></div>`;
  const R=$("#home-app"),act=(el,fn)=>{el.onclick=fn;el.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();fn();}};};
  const mcs=R.querySelector("#mc-score");if(mcs)mcs.onclick=()=>{ScS.playNext=true;setView("scorer");};
  R.querySelectorAll("[data-cseg]").forEach(b=>b.onclick=()=>{ScS.cseg=b.dataset.cseg;cricketView();});
  R.querySelectorAll("[data-cteam]").forEach(b=>act(b,()=>{setView("squad");sqOpen(b.dataset.cteam,!!+b.dataset.lock);}));
  R.querySelectorAll("[data-ctour]").forEach(b=>act(b,()=>{if(+b.dataset.own)myTours();else{ScS.tour=b.dataset.ctour;ScS.tab="m";setView("scorer");}}));
  R.querySelectorAll("[data-cmid]").forEach(b=>act(b,()=>{setView("scorer");scOpenMatch(b.dataset.cmid);}));
  R.querySelectorAll("[data-cgo]").forEach(b=>b.onclick=()=>{if(b.dataset.cgo==="team"){if(needAccount())return;guideGo("team");}else joinByCodeView();});
  const sel=$("#mc-mf");if(sel)sel.onchange=()=>{ScS.mcf=sel.value;cricketView();};
}
function accountView(){
  setCssForHome();
  const u=Auth.user,em=myEmail(),th=curTheme();
  const role=!u?(Auth.guest?"Guest":"Signed out"):Auth.admin?"Admin":(assignedScorer()||(Auth.tids||[]).length)?"Scorer":"Player";
  const opt=(k,ic,x)=>`<button class="th-opt ${th===k?"on":""}" data-th="${k}"><span>${ic}</span>${x}</button>`;
  $("#home-app").innerHTML=`<div class="hm-wrap mc"><div class="mc-head"><div class="mc-ttl">Account</div></div><div class="mc-team ac-me"><div class="mc-av">${esc((em||"G")[0].toUpperCase())}</div><div class="mc-ti"><b>${esc(em||"Guest session")}</b><span>Signed in as</span></div><span class="mc-tag">${role}</span></div><div class="mc-panel"><div class="mc-ph">Appearance</div><div class="th-seg">${opt("dark","🌙","Dark")}${opt("light","☀️","Light")}${opt("green","🌿","Green")}</div></div><div class="mc-panel">${u?`<button class="btn sec" id="ac-out">Sign Out</button>`:`<button class="btn" id="ac-in">Sign In</button>`}</div><div class="mc-credit">Created by Amanullah Khan</div></div>`;
  $("#home-app").querySelectorAll("[data-th]").forEach(b=>b.onclick=()=>{setTheme(b.dataset.th);accountView();});
  const ou=$("#ac-out");if(ou)ou.onclick=async()=>{await signOut(auth);Auth.guest=false;await refreshRole(null);setView("home");};
  const si=$("#ac-in");if(si)si.onclick=()=>{Auth.guest=false;setView("home");};
}

// ---------- slide-in menu drawer (static shell, survives view re-renders) ----------
function drawerOpen(){return $("#hm-drawer")?.classList.contains("open");}
function openDrawer(){renderDrawer();$("#hm-drawer")?.classList.add("open");$("#hm-scrim")?.classList.add("open");try{document.body.style.overflow="hidden";}catch{}}
function closeDrawer(){if(!drawerOpen())return;$("#hm-drawer")?.classList.remove("open");$("#hm-scrim")?.classList.remove("open");try{document.body.style.overflow="";}catch{}}
function renderDrawer(){
  const host=$("#hm-drawer-body");if(!host)return;
  const u=Auth.user,em=myEmail();
  const myTours=Tours.filter(t=>t.id!=="default"&&tourOwner(t.id)===em);
  const myM=ScMatches.filter(m=>(Auth.tids||[]).includes(m.tid)||tourScorers(m.tid).includes(em)||(em&&((m.owner||"").toLowerCase()===em))||tourOwns(m));
  const liveN=myM.filter(m=>m.status==="live").length;
  const mySq=SqTeams.filter(t=>canEditSquad(t.id)).length;
  const item=(go,icon,label,badge)=>`<button class="hm-gitem ${CurView===go?"on":""}" data-go="${go}"><span class="hm-dic">${icon}</span><span class="hm-dlabel">${label}</span>${badge||'<span class="hm-chev">›</span>'}</button>`;
  const sec=(t,inner)=>`<div class="hm-dsec">${t}</div><div class="hm-group">${inner}</div>`;
  const livecard=n=>`<button class="hm-livecard" data-go="live"><span class="hm-dic"><span class="hm-dot"></span></span><span class="hm-dlabel">Live Matches</span>${n?`<span class="hm-count red">${n}</span>`:""}<span class="hm-chev">›</span></button>`;
  const count=n=>n?`<span class="hm-count">${n}</span>`:"";
  const signBtn=u?`<button class="hm-dsign" data-go="signout" title="Sign out">⏻ Sign Out</button>`:`<button class="hm-dsign" data-go="signin" title="Sign in">🔑 Sign In</button>`;
  let h=`<div class="hm-dhead"><div><div class="hm-dapp">SmartCric</div><div class="hm-duser">${u?esc(u.email)+(Auth.admin?" · Admin":""):Auth.guest?"Guest":"Not signed in"}</div>${signBtn}</div><button class="hm-dx" id="hm-drawer-x" title="Close">✕</button></div>`;
  if(!u&&!Auth.guest){
    h+=sec("Now",livecard(ScMatches.filter(m=>m.status==="live").length));
    h+=sec("Welcome",item("home","<span class='hm-hic'>"+HOME_SVG+"</span>","Home")+item("signin","🔑","Sign In"));
  }else if(!u){
    h+=sec("Now",livecard(liveN));
    h+=sec("Play",item("home","<span class='hm-hic'>"+HOME_SVG+"</span>","Home")+item("scorer","🏏","Score a Match")+item("squad","👥","Squads & Teams")+item("join","🔗","Join a Tournament"));
  }else{
    h+=sec("Now",livecard(liveN));
    h+=sec("Play",item("home","<span class='hm-hic'>"+HOME_SVG+"</span>","Home"));
    h+=sec("My Stuff",item("scorer","🏏","Score a Match")+item("join","🔗","Join a Tournament")+item("mytours","🏆","My Tournaments",count(myTours.length))+item("mymatches","📋","My Matches",count(myM.length))+item("mysquads","👥","My Teams",count(mySq)));
    h+=sec("Create",item("newt","➕","New Tournament")+item("newteam","➕","New Team")+item("newmatch","➕","New Match"));
    if(Auth.admin)h+=sec("Admin",item("admint","🏆","Tournaments")+item("admins","👥","Scorers")+item("admine","✏️","Squad Editors")+item("adminu","👤","Users")+item("adminf","🗓️","Fixtures"));
  }
  h+=`<div class="hm-dfoot">`+sec("Display",`<button class="hm-gitem" data-go="theme"><span class="hm-dlabel">Theme: ${curTheme()[0].toUpperCase()+curTheme().slice(1)}</span><span class="hm-count">Switch</span></button>`)+`</div>`;
  host.innerHTML=h;
  host.querySelector("#hm-drawer-x").onclick=closeDrawer;
  host.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>drawerGo(b.dataset.go));
}
async function drawerGo(go){
  const u=Auth.user;
  if(go==="theme"){toggleTheme();renderDrawer();return;}
  if(go==="signin"){closeDrawer();Auth.guest=false;await refreshRole(null);setView("home");return;}
  if(go==="signout"){closeDrawer();await signOut(auth);Auth.guest=false;await refreshRole(null);setView("home");return;}
  closeDrawer();
  if(go==="home")setView("home");
  else if(go==="live"){ScS.tab="m";setView("scorer");}
  else if(go==="scorer"){ScS.playNext=true;setView("scorer");}
  else if(go==="squad")setView("squad");
  else if(go==="mytours")myTours();
  else if(go==="mymatches"){ScS.tab="m";ScS.tour="";setView("scorer");}
  else if(go==="mysquads")setView("squad");
  else if(go==="join"){closeDrawer();joinByCodeView();}
  else if(go==="newt"){if(!u)return setView("home");setView("squad");sqUserCreateTournament();}
  else if(go==="newteam"){if(!u)return setView("home");setView("squad");setTimeout(()=>sqUserAddTeam(),80);}
  else if(go==="newmatch"){if(!u)return setView("home");ScS.playNext=true;setView("scorer");}
  else if(go==="admint"){setView("squad");setTimeout(()=>sqAdmin(),80);}
  else if(go==="admins")usersAdmin("home");
  else if(go==="admine"){setView("squad");setTimeout(()=>squadEditors(),80);}
  else if(go==="adminu"){setView("squad");setTimeout(()=>usersPanel(),80);}
  else if(go==="adminf")fixturesView("");
}

// ---------- unified role: one admin for both ----------
const ADMIN_EMAIL="amankhanjis@gmail.com";
async function refreshRole(u){
  Auth.user=u||null;Auth.admin=false;Auth.tids=[];Auth.teamIds=[];
  if(!u)return;
  const em=(u.email||"").toLowerCase();
  if(!em)return;
  Auth.admin=(em===ADMIN_EMAIL);
  try{const d=await getDoc(doc(db,"scorers",em));if(d.exists()){Auth.tids=d.data().tids||[];Auth.teamIds=d.data().teamIds||[];}}catch{}
}
const isAdmin=()=>Auth.admin;
const myEmail=()=>((Auth.user&&Auth.user.email)||"").toLowerCase();
const isAnon=()=>!!(Auth.user&&Auth.user.isAnonymous);
const needAccount=()=>{if(!Auth.user||isAnon()){toast("Please sign in or create a free account first.");return true;}return false;};
async function ensureAuth(quiet=true){if(auth.currentUser)return true;try{await signInAnonymously(auth);return true;}catch(e){if(!quiet){const c=(e&&e.code)||"";toast(c==="auth/operation-not-allowed"||c==="auth/admin-restricted-operation"?"Enable Anonymous sign-in in Firebase Console under Authentication, then reload.":"Couldn't connect - check your internet and reload.");}return false;}}
const canScore=m=>{const em=myEmail();if(!em)return false;if((m.scoredBy||"").toLowerCase()===em)return true;if((m.grant||"").toLowerCase()===em)return true;if((Auth.tids||[]).includes(m.tid))return true;if(tourScorers(m.tid).includes(em))return true;if(tourOwns(m))return true;if((m.challenged||"")!==""&&(m.challenged||"").toLowerCase()===em)return true;if(teamPlays(m))return true;const o=(m.owner||"").toLowerCase();return!!o&&o===em;};
const canEditSquad=id=>{if(Auth.admin)return true;if((Auth.teamIds||[]).includes(id))return true;if(teamEditors(id).includes(myEmail()))return true;if(teamCoOwners(id).includes(myEmail()))return true;const t=SqTeams.find(x=>x.id===id);const o=(t&&t.owner||"").toLowerCase();return o&&o===myEmail();};
const canDeleteMatch=m=>{if(Auth.admin)return true;if(tourOwns(m))return true;const o=(m.owner||"").toLowerCase();return o&&o===myEmail();};
const tname=id=>{if(!id)return"Friendly";return(Tours.find(t=>t.id===id)||{}).name||id||"";};
const tourOwner=id=>((Tours.find(t=>t.id===id)||{}).owner||"").toLowerCase()||null;
const tourOwns=m=>{const o=tourOwner(m.tid);return o&&o===myEmail();};
const tourScorers=id=>((Tours.find(t=>t.id===id)||{}).scorerEmails||[]).map(e=>String(e).toLowerCase());
const teamEditors=id=>{const t=SqTeams.find(x=>x.id===id);return ((t&&t.editors)||[]).map(e=>String(e).toLowerCase());};
// co-owners: full owner powers on a team (edit squad, score its matches, take-overs, move it). Delete stays with the original owner.
const teamCoOwners=id=>{const t=SqTeams.find(x=>x.id===id);return ((t&&t.coOwners)||[]).map(e=>String(e).toLowerCase());};
const assignedScorer=()=>{const em=myEmail();return !!em&&((Auth.tids||[]).length>0||Tours.some(t=>tourScorers(t.id).includes(em)));};
const tourMeta=id=>Tours.find(t=>t.id===id)||{};
const tourSeason=id=>tourMeta(id).season||"";
const tourYear=id=>tourMeta(id).year||"";
const tourTagline=id=>tourMeta(id).tagline||"";
const tourStatus=id=>tourMeta(id).status||"active";
const tourDefOvers=id=>tourMeta(id).defOvers||"";
const tourSeasonYear=id=>{const s=tourSeason(id),y=tourYear(id);return[s,y].filter(Boolean).join(" ")||"Season 18 2026";};
const canManageTour=id=>id==="default"?Auth.admin:(Auth.admin||(tourOwner(id)&&tourOwner(id)===myEmail()));
const myCreatableTours=()=>Tours.filter(t=>tourStatus(t.id)!=="archived"&&(t.id==="default"?Auth.admin:(canManageTour(t.id)||(Auth.tids||[]).includes(t.id)||tourScorers(t.id).includes(myEmail()))));
const schedTours=()=>Tours.filter(t=>tourStatus(t.id)!=="archived"&&(Auth.admin||canManageTour(t.id)));
const canSched=()=>Auth.admin||Tours.some(t=>tourStatus(t.id)!=="archived"&&canManageTour(t.id));
const tourDoc=d=>({id:d.id,name:d.data().name||d.id,at:d.data().created||0,owner:(d.data().owner||"").toLowerCase(),season:d.data().season||"",year:d.data().year||"",tagline:d.data().tagline||"",city:d.data().city||"",desc:d.data().desc||"",status:d.data().status||"active",defOvers:d.data().defOvers||"",scorerEmails:(d.data().scorerEmails||[])});
async function loadTours(){
  try{const t=await getDocs(collection(db,"tournaments"));const docs=t.docs.map(tourDoc);const hasDef=docs.some(d=>d.id==="default");Tours=[...(hasDef?[]:[{id:"default",name:"Challenger's Cup",owner:"",season:"Season 18",year:"2026",tagline:"BUILD YOUR SQUAD",city:"",desc:"",status:"active",defOvers:""}]),...docs].sort((a,b)=>(a.at||0)-(b.at||0));}catch{}
}
function toast(msg){let e=$("#hm-toast");if(!e){e=document.createElement("div");e.id="hm-toast";e.className="hm-toast";document.body.appendChild(e);}e.textContent=msg;e.style.display="block";clearTimeout(e._t);e._t=setTimeout(()=>e.style.display="none",2600);}
// In-app form dialog (resolves values object, or null on cancel). No native prompt().
function appForm(o){
  return new Promise(res=>{
    const ov=document.createElement("div");ov.className="app-modal-ov";
    ov.innerHTML=`<div class="app-modal"><div class="app-modal-t">${esc(o.title||"")}</div>${(o.fields||[]).map(f=>f.type==="select"?`<label class="app-modal-l">${esc(f.label)}</label><select data-f="${f.id}">${(f.options||[]).map(p=>`<option value="${esc(p.v)}" ${p.v===(f.value??"")?"selected":""}>${esc(p.t)}</option>`).join("")}</select>`:`<label class="app-modal-l">${esc(f.label)}</label><input data-f="${f.id}" type="${f.type||"text"}" value="${esc(f.value||"")}" placeholder="${esc(f.placeholder||"")}">`).join("")}<div class="app-modal-btns"><button class="hm-btn sec" data-x="0">${esc(o.cancelText||"Cancel")}</button><button class="hm-btn" data-x="1">${esc(o.okText||"Save")}</button></div></div>`;
    document.body.appendChild(ov);
    const done=v=>{ov.remove();res(v);};
    ov.querySelector('[data-x="0"]').onclick=()=>done(null);
    const ok=()=>{const out={};for(const f of(o.fields||[])){const el=ov.querySelector(`[data-f="${f.id}"]`);out[f.id]=el?el.value:"";}done(out);};
    ov.querySelector('[data-x="1"]').onclick=ok;
    ov.addEventListener("mousedown",e=>{if(e.target===ov)done(null);});
    ov.addEventListener("keydown",e=>{if(e.key==="Escape")done(null);else if(e.key==="Enter"&&e.target.tagName==="INPUT")ok();});
    const first=ov.querySelector("input,select");if(first)first.focus();
  });
}
// In-app confirm dialog (resolves true/false). No native confirm().
function appConfirm(message,okText){
  return new Promise(res=>{
    const ov=document.createElement("div");ov.className="app-modal-ov";
    ov.innerHTML=`<div class="app-modal"><div class="app-modal-t">Please confirm</div><div class="app-modal-msg">${esc(message)}</div><div class="app-modal-btns"><button class="hm-btn sec" data-x="0">Cancel</button><button class="hm-btn" data-x="1">${esc(okText||"Confirm")}</button></div></div>`;
    document.body.appendChild(ov);
    const done=v=>{ov.remove();res(v);};
    ov.querySelector('[data-x="0"]').onclick=()=>done(false);
    ov.querySelector('[data-x="1"]').onclick=()=>done(true);
    ov.addEventListener("mousedown",e=>{if(e.target===ov)done(false);});
    ov.addEventListener("keydown",e=>{if(e.key==="Escape")done(false);else if(e.key==="Enter")done(true);});
    ov.querySelector('[data-x="1"]').focus();
  });
}
// In-app chooser sheet (players, colours, etc). Resolves the chosen value, or null on cancel.
function appPick(o){
  return new Promise(res=>{
    const opts=o.options||[];
    const ov=document.createElement("div");ov.className="app-modal-ov";
    ov.innerHTML=`<div class="app-modal"><div class="app-modal-t">${esc(o.title||"Select")}</div>${o.sub?`<div class="app-pick-sub">${esc(o.sub)}</div>`:""}<div class="app-pick-grid">${opts.map((p,i)=>`<button class="app-pick${p.v===(o.value??"")?" on":""}" data-i="${i}" ${p.off?"disabled":""}><span class="pk-t">${esc(p.t)}</span>${p.s?`<span class="pk-s">${esc(p.s)}</span>`:""}</button>`).join("")}</div><div class="app-modal-btns"><button class="hm-btn sec" data-x="0">Cancel</button></div></div>`;
    document.body.appendChild(ov);
    const done=v=>{ov.remove();res(v);};
    ov.querySelectorAll("[data-i]").forEach(b=>b.onclick=()=>{if(b.disabled)return;const p=opts[+b.dataset.i];if(p&&p.off)return;done(p?p.v:null);});
    ov.querySelector('[data-x="0"]').onclick=()=>done(null);
    ov.addEventListener("mousedown",e=>{if(e.target===ov)done(null);});
    ov.addEventListener("keydown",e=>{if(e.key==="Escape")done(null);});
  });
}
// In-app action sheet. Rows: {icon,t,s,on,off} — on() runs right after the sheet closes.
function appSheet(o){
  return new Promise(res=>{
    const rows=o.rows||[];
    const ov=document.createElement("div");ov.className="app-modal-ov";
    ov.innerHTML=`<div class="app-modal app-sheet"><div class="app-modal-t">${esc(o.title||"More")}</div>${o.sub?`<div class="app-pick-sub">${esc(o.sub)}</div>`:""}<div class="app-sheet-list">${rows.map((r,i)=>`<button class="app-sheet-row" data-i="${i}" ${r.off?"disabled":""}><span class="sh-i">${r.icon||""}</span><span class="sh-t">${esc(r.t)}${r.s?`<small>${esc(r.s)}</small>`:""}</span><span class="sh-c">›</span></button>`).join("")}</div><div class="app-modal-btns"><button class="hm-btn sec" data-x="0">Close</button></div></div>`;
    document.body.appendChild(ov);
    const done=()=>{ov.remove();res(true);};
    ov.querySelectorAll("[data-i]").forEach(b=>b.onclick=()=>{const r=rows[+b.dataset.i];done();try{if(r&&r.on)r.on();}catch{}});
    ov.querySelector('[data-x="0"]').onclick=done;
    ov.addEventListener("mousedown",e=>{if(e.target===ov)done();});
    ov.addEventListener("keydown",e=>{if(e.key==="Escape")done();});
  });
}
// In-app share sheet (keeps the chooser in our own style). o={title,text,link,waText,imageCanvas,imageName,shareTitle}
async function appShare(o){
  const link=o.link||"",text=o.text||"",wa=o.waText||[text,link].filter(Boolean).join("\n");
  const rows=[];
  if(link)rows.push({icon:"📋",t:"Copy link",s:link,on:()=>navigator.clipboard.writeText(link).then(()=>toast("Link copied.")).catch(()=>toast("Couldn't copy the link."))});
  rows.push({icon:"📲",t:"WhatsApp",on:()=>window.open("https://wa.me/?text="+encodeURIComponent(wa),"_blank")});
  if(navigator.share)rows.push({icon:"↗️",t:"More share options",s:o.imageCanvas?"Share with image":"",on:async()=>{try{if(o.imageCanvas&&await shareCanvas(o.imageCanvas,o.imageName||"share.jpg",o.shareTitle||o.title||"",wa))return;await navigator.share({title:o.shareTitle||o.title||"SmartCric",text:wa});}catch{}}});
  return appSheet({title:o.title||"Share",sub:o.sub,rows});
}
function downloadCanvas(canvas,filename){const a=document.createElement("a");a.download=filename;a.href=canvas.toDataURL("image/jpeg",.88);a.click();}
async function shareCanvas(canvas,filename,title,text){
  try{
    const blob=await new Promise(r=>canvas.toBlob(r,"image/jpeg",.88));
    const file=new File([blob],filename,{type:"image/jpeg"});
    if(navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file],title,text});return true;}
  }catch{}
  return false;
}
// Public web address of the hosted app (used for share links inside the native Play Store build, where location is localhost). Leave "" for web use.
const WEB_BASE="";
function basePage(){try{if(WEB_BASE&&window.Capacitor&&window.Capacitor.isNativePlatform&&window.Capacitor.isNativePlatform())return WEB_BASE;}catch{}return location.origin+location.pathname;}
function viewLinkFor(m){return basePage()+"?match="+m.id;}
function overlayLinkFor(m){return basePage()+"?mode=overlay&match="+m.id;}
function curTheme(){const b=document.body.classList;return b.contains("light")?"light":b.contains("green")?"green":"dark";}
function applyTheme(){try{const t=localStorage.getItem("cc-theme")||"dark";document.body.classList.toggle("light",t==="light");document.body.classList.toggle("green",t==="green");}catch{}}
function setTheme(t){try{localStorage.setItem("cc-theme",t);}catch{}applyTheme();toast(t==="light"?"Light mode on.":t==="green"?"Green theme on.":"Dark mode on.");}
function toggleTheme(){setTheme(curTheme()==="light"?"dark":"light");}
