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
const nm2=s=>String(s||"").trim().split(/\s+/).slice(0,2).join(" ");

// ---------- shared admin layout ----------
// Every admin screen used to invent its own header, rows and buttons, which is why the admin
// area never looked like one app. These four helpers are now the single layout it uses.
const admHead=(title,sub)=>`<div class="adm-head"><div class="adm-t">${esc(title)}</div>${sub?`<div class="adm-s">${esc(sub)}</div>`:""}</div>`;
const admCard=(title,body)=>`<div class="adm-card">${title?`<div class="adm-c">${esc(title)}</div>`:""}${body||""}</div>`;
const admRow=(main,sub,actions)=>`<div class="adm-row"><div class="adm-m"><div class="adm-e">${main}</div>${sub?`<div class="adm-s">${sub}</div>`:""}</div>${actions?`<div class="adm-a">${actions}</div>`:""}</div>`;
const admActs=items=>`<div class="adm-acts">${items.map(i=>`<button class="btn sm ${i.sec?"sec":""} auto" data-adm="${i.k}">${i.t}</button>`).join("")}</div>`;

// ---------- MVP points system ----------
// The published points: four +2.5, six +3.5, a half century +3.5 and a century +5, a dot
// ball bowled +1, a wicket +3.5 with a three wicket haul +3.5 and a five wicket haul +5, a
// catch +2.5 and a stumping +2.5. The milestone bonuses are earned once per innings, and the
// higher tier replaces the lower one, so a century is worth 5 and not 3.5 plus 5.
const MVP_PTS={four:2.5,six:3.5,fifty:3.5,century:5,dot:1,wicket:3.5,haul3:3.5,haul5:5,ct:2.5,st:2.5};
// Runs carry no points in the published system. It sits here so one character turns them on
// for every leaderboard, the man of the match and the exported images at once.
const RUN_PTS=0;
// A dot ball is a legal delivery where nothing was scored and no wicket fell.
const scDotBall=x=>!!(x&&x.b===1&&!x.w&&(x.r||0)===0);
// Points for one innings.
const scPtsInn=(h)=>{
  const p={};
  const get=n=>p[n]??(p[n]={n,p:0,f4:0,f6:0,dots:0,w:0,ct:0,st:0,r:0,b:0});
  const batRuns={},bowlWkts={};
  (h||[]).forEach(x=>{
    if(x.s){
      const g=get(x.s);
      g.r+=x.br||0;if(x.e!=="wd")g.b++;
      g.p+=RUN_PTS*(x.br||0);
      if(x.br===4){g.f4++;g.p+=MVP_PTS.four;}
      if(x.br===6){g.f6++;g.p+=MVP_PTS.six;}
      batRuns[x.s]=(batRuns[x.s]||0)+(x.br||0);
    }
    if(x.o){
      const g=get(x.o);
      if(scDotBall(x)){g.dots++;g.p+=MVP_PTS.dot;}
      if(x.w&&x.k!=="ro"){g.w++;g.p+=MVP_PTS.wicket;bowlWkts[x.o]=(bowlWkts[x.o]||0)+1;}
    }
    if(x.f&&x.k==="c"){const g=get(x.f);g.ct++;g.p+=MVP_PTS.ct;}
    if(x.f&&x.k==="st"){const g=get(x.f);g.st++;g.p+=MVP_PTS.st;}
  });
  Object.entries(batRuns).forEach(([n,r])=>{if(r>=100)get(n).p+=MVP_PTS.century;else if(r>=50)get(n).p+=MVP_PTS.fifty;});
  Object.entries(bowlWkts).forEach(([n,w])=>{if(w>=5)get(n).p+=MVP_PTS.haul5;else if(w>=3)get(n).p+=MVP_PTS.haul3;});
  return p;
};
// Points across one innings, or across a list of them.
const scPtsOf=(inns)=>{
  const all={};
  (Array.isArray(inns)?inns:(inns?[inns]:[])).forEach(h=>{
    const p=scPtsInn(h);
    Object.entries(p).forEach(([n,v])=>{
      const g=all[n]??(all[n]={n,p:0,f4:0,f6:0,dots:0,w:0,ct:0,st:0,r:0,b:0});
      g.p+=v.p;g.f4+=v.f4;g.f6+=v.f6;g.dots+=v.dots;g.w+=v.w;g.ct+=v.ct;g.st+=v.st;g.r+=v.r;g.b+=v.b;
    });
  });
  return all;
};
// Points for the named players only, across the given innings.
const scPtsFor=(inns,names)=>{
  const all={};
  (inns||[]).forEach(h=>{
    const p=scPtsInn(h);
    Object.entries(p).forEach(([n,v])=>{
      if(names&&names.size&&!names.has(n))return;
      const g=all[n]??(all[n]={n,p:0,f4:0,f6:0,dots:0,w:0,ct:0,st:0});
      g.p+=v.p;g.f4+=v.f4;g.f6+=v.f6;g.dots+=v.dots;g.w+=v.w;g.ct+=v.ct;g.st+=v.st;
    });
  });
  return all;
};
// The points table, shown to the user on the home screen.
const MVP_TABLE=[
  {g:"Batting",k:"bat",rows:[["Four Hit",2.5],["Six Hit",3.5],["Half Century (50 runs)",3.5],["Century (100 runs)",5]]},
  {g:"Bowling",k:"bowl",rows:[["Dot Ball Bowled (0 runs scored)",1],["Wicket Taken",3.5],["3 Wicket Haul",3.5],["5 Wicket Haul",5]]},
  {g:"Fielding",k:"fld",rows:[["Catch Taken",2.5],["Stumping",2.5]]},
];

// ---------- shared state ----------
const Auth={user:null,admin:false,tids:[],teamIds:[],followIds:[],guest:false};
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
  $("#home-app").hidden=(v!=="home"&&v!=="cricket"&&v!=="account"&&v!=="points");
  $("#squad-app").hidden=(v!=="squad");
  $("#scorer-app").hidden=(v!=="scorer"&&v!=="overlay");
  document.body.classList.remove("sq","ovb");document.documentElement.classList.remove("ovh");
  if(v==="squad"){/* sq class managed by squad renderer */}
  if(v==="overlay"){document.documentElement.classList.add("ovh");document.body.classList.add("ovb");}
  if(v==="home")renderHome();
  if(v==="points")renderPoints();
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
    // The drawer is the only navigation. A permanent admin rail on a wide screen duplicated
    // the drawer and sat on top of the bottom tab bar, so it is never shown.
    sb.hidden=true;document.body.classList.remove("side-on");
    tb.hidden=false;document.body.classList.add("tabs-on");paintTabs();
  }else{
    sb.hidden=true;document.body.classList.remove("side-on");
    if((u||g)&&!ov){tb.hidden=false;document.body.classList.add("tabs-on");paintTabs();
    }else{tb.hidden=true;document.body.classList.remove("tabs-on");}
  }
}
function tabGo(t){if(t==="home")setView("home");else if(t==="cricket"){ScS.cseg=ScS.cseg||"teams";setView("cricket");}else if(t==="score"){ScS.playNext=false;ScS.tab="m";setView("scorer");}else if(t==="account")setView("account");}
function adminGo(k){ScS.adminMod=k;
  if(k==="atheme"){themePicker();return;}
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
const matchMine=m=>{const em=myEmail();return(Auth.tids||[]).includes(m.tid)||(!!em&&tourScorers(m.tid).includes(em))||tourOwns(m)||(!!em&&(m.owner||"").toLowerCase()===em)||(!!em&&(m.challenged||"").toLowerCase()===em)||(!!em&&(m.scoredBy||"").toLowerCase()===em)||(!!em&&(m.grant||"").toLowerCase()===em)||mcTeamIds().has(m.t1)||mcTeamIds().has(m.t2)||following(m.t1)||following(m.t2);};
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
  const myT=SqTeams.filter(t=>canEditSquad(t.id)||following(t.id)).sort((a,b)=>(canEditSquad(a.id)?0:1)-(canEditSquad(b.id)?0:1)||a.name.localeCompare(b.name));
  const myM=mcMatches(),mT=mcTours(myM);
  const g={l:[],u:[],p:[]};myM.forEach(m=>g[mcCat(m)].push(m));
  g.l.sort((a,b)=>(b.when||0)-(a.when||0));g.u.sort((a,b)=>(a.when||0)-(b.when||0));g.p.sort((a,b)=>(b.when||0)-(a.when||0));
  const mf=ScS.mcf&&g[ScS.mcf]?ScS.mcf:(g.l.length?"l":g.u.length?"u":g.p.length?"p":"l");
  const browse=seg==="tours"?Tours.filter(x=>x.id!==""&&tourStatus(x.id)!=="archived"&&!mT.some(y=>y.id===x.id)):[];
  const empty=(ic,t,s,btn)=>`<div class="mc-empty"><div class="mc-eic">${ic}</div><b>${t}</b><span>${s}</span>${btn||""}</div>`;
  const matchCard=m=>{const k=mcCat(m),ch=(m.challenged||"").toLowerCase()===em;let i={};try{i=scInfo({...m,history:m.history||[]});}catch{}
    const lbl=k==="l"?"LIVE":k==="p"?"COMPLETED":ch?"⚔️ CHALLENGE":"UPCOMING";
    const sc=k==="u"?(m.when?when(m.when):"Not started yet"):`${m.runs||0}-${i.w||0} <small>(${ovs(m.balls||0)} ov)</small>`;
    return`<div class="mc-match ${k}" role="button" tabindex="0" data-cmid="${esc(m.id)}"><div class="mc-mh"><span class="mc-st ${k}">${k==="l"?'<i class="mc-dot"></i>':""}${lbl}</span><span class="mc-tn">${esc(tname(m.tid))} · ${m.overs} ov</span></div><div class="mc-vs"><div class="mc-tm"><b>${esc(abbr(m.n1))}</b><span>${esc(m.n1)}</span></div><div class="mc-mid">VS</div><div class="mc-tm"><b>${esc(abbr(m.n2))}</b><span>${esc(m.n2)}</span></div></div><div class="mc-mf"><span class="mc-sc">${sc}</span><span class="mc-go">${k==="l"?"Watch live":k==="p"?"Scorecard":"Details"} ›</span></div></div>`;};
  let body="";
  if(seg==="teams")body=myT.map(t=>{const ed=canEditSquad(t.id),lk=(SqTeams.find(y=>y.id===t.id)||{}).locked;return`<div class="mc-team" role="button" tabindex="0" data-cteam="${esc(t.id)}" data-lock="${lk?1:0}"${ed?"":` data-prof="1"`}><div class="mc-av">${esc(abbr(t.name))}</div><div class="mc-ti"><b>${esc(t.name)}</b><span>${esc(tname(t.tid))}</span></div>${ed?"":`<span class="mc-tag">Following</span>`}<span class="mc-open">${ed?"Open":"View"} ›</span></div>`;}).join("")||empty("🛡️","No teams yet","Create a team to add players — or follow any team from its page.",`<button class="btn sm auto" data-cgo="team">+ Create team</button>`);
  else if(seg==="matches"){const opts=[["l","Live"],["u","Upcoming"],["p","Past"]];
    body=`<div class="mc-selwrap"><label for="mc-mf">Show</label><select id="mc-mf" class="mc-sel">${opts.map(([k,x])=>`<option value="${k}" ${mf===k?"selected":""}>${x} (${g[k].length})</option>`).join("")}</select></div>`+(g[mf].map(matchCard).join("")||empty("🏏",`No ${opts.find(o=>o[0]===mf)[1].toLowerCase()} matches`,"Matches you play, score or follow will appear here."));}
  else{
    // The tour list lives on the tournament hub now, so this segment is just the doorway.
    body=`<div class="mc-team tour" role="button" tabindex="0" data-hub="1"><div class="mc-av">🏆</div><div class="mc-ti"><b>Tournaments</b><span>Everything you run, in one place</span></div><span class="mc-open">Open ›</span></div>`;
  }
  const segs=[["teams","🛡️","My Teams",myT.length],["matches","🏏","Matches",myM.length],["tours","🏆","Tourneys",mT.length+browse.length]];
  // one secondary create action under the segment row, switching with the active segment
  const cnew={teams:["＋ Create New Team","team"],matches:["＋ Score a Match","match"],tours:["＋ Create New Tournament","tour"]}[seg];
  $("#home-app").innerHTML=`<div class="hm-wrap mc"><div class="mc-head"><div class="mc-ttl">My Cricket</div><div class="mc-sub">Your teams, matches & tournaments</div></div><button class="mc-score" id="mc-score">🏏 Score a Match</button><div class="mc-seg">${segs.map(([k,ic,x,n])=>`<button class="${seg===k?"on":""}" data-cseg="${k}"><span class="mc-sic">${ic}</span><span>${x}</span><em>${n}</em></button>`).join("")}</div><button class="mc-new" id="mc-new">${cnew[0]}</button><div class="mc-list">${body}</div></div>`;
  const R=$("#home-app"),act=(el,fn)=>{el.onclick=fn;el.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();fn();}};};
  const mcs=R.querySelector("#mc-score");if(mcs)mcs.onclick=()=>{ScS.playNext=true;setView("scorer");};
  const mcn=R.querySelector("#mc-new");if(mcn)mcn.onclick=()=>{if(cnew[1]==="match"){ScS.playNext=true;setView("scorer");}else if(cnew[1]==="team"){if(needAccount())return;guideGo("team");}else{if(needAccount())return;sqUserCreateTournament();}};
  R.querySelectorAll("[data-cseg]").forEach(b=>b.onclick=()=>{ScS.cseg=b.dataset.cseg;cricketView();});
  R.querySelectorAll("[data-cteam]").forEach(b=>act(b,()=>{const id=b.dataset.cteam;if(b.dataset.prof){ScS.profTab="squad";ScS.profBack=()=>{ScS.cseg="teams";setView("cricket");};teamProfileView(id);return;}setView("squad");sqOpen(id,!!+b.dataset.lock);}));
  R.querySelectorAll("[data-hub]").forEach(b=>act(b,()=>tourHub()));
  R.querySelectorAll("[data-cmid]").forEach(b=>act(b,()=>{setView("scorer");scOpenMatch(b.dataset.cmid);}));
  R.querySelectorAll("[data-cgo]").forEach(b=>b.onclick=()=>{if(b.dataset.cgo==="team"){if(needAccount())return;guideGo("team");}else joinByCodeView();});
  const sel=$("#mc-mf");if(sel)sel.onchange=()=>{ScS.mcf=sel.value;cricketView();};
}
function accountView(){
  setCssForHome();
  const u=Auth.user,em=myEmail(),th=curTheme();
  const role=!u?(Auth.guest?"Guest":"Signed out"):Auth.admin?"Admin":(assignedScorer()||(Auth.tids||[]).length)?"Scorer":"Player";
  const opt=(k,ic,x)=>`<button class="th-opt ${th===k?"on":""}" data-th="${k}"><span>${ic}</span>${x}</button>`;
  $("#home-app").innerHTML=`<div class="hm-wrap mc"><div class="mc-head"><div class="mc-ttl">Account</div></div><div class="mc-team ac-me"><div class="mc-av">${esc((em||"G")[0].toUpperCase())}</div><div class="mc-ti"><b>${esc(em||"Guest session")}</b><span>Signed in as</span></div><span class="mc-tag">${role}</span></div><div class="mc-panel"><div class="mc-ph">Appearance</div><div class="th-seg">${opt("dark","🌙","Dark")}${opt("light","☀️","Light")}${opt("green","🌿","Green")}</div></div><div class="mc-panel"><div class="mc-ph">Account</div>${u?`<button class="btn sec" id="ac-out">Sign Out</button>`:`<button class="btn" id="ac-in">Sign In</button>`}</div>${u&&u.email?`<div class="mc-panel ac-danger"><div class="mc-ph">Danger zone</div><div class="ac-danger-t">Deleting your account removes your teams, squads, player photos, tournaments, fixtures and matches. It cannot be undone.</div><button class="btn sec ac-danger-b" id="ac-del">Delete Account</button></div>`:""}<div class="mc-credit">Created by Amanullah Khan</div></div>`;
  $("#home-app").querySelectorAll("[data-th]").forEach(b=>b.onclick=()=>{setTheme(b.dataset.th);accountView();});
  const ou=$("#ac-out");if(ou)ou.onclick=async()=>{await signOut(auth);Auth.guest=false;await refreshRole(null);setView("home");};
  const si=$("#ac-in");if(si)si.onclick=()=>{Auth.guest=false;setView("home");};
  const dl=$("#ac-del");if(dl)dl.onclick=()=>deleteAccountFlow().catch(()=>toast("Could not delete the account."));
}

// ---------- delete account (Play requires an in-app deletion path) ----------
// Order matters: confirm + password -> erase owned data -> erase the scorer record -> erase the login.
// Nothing is deleted until the password is verified, so a mistap can never destroy data.
// Deletes only documents whose owner is this user; tournament "default" is never touched.
async function wipeOwned(col,em){
  try{
    const snap=await getDocs(collection(db,col));
    for(const d of snap.docs){
      if(col==="tournaments"&&d.id==="default")continue;
      const o=((d.data()||{}).owner||"").toLowerCase();
      if(o&&o===em)await deleteDoc(d.ref);
    }
  }catch{}
}
async function deleteAccountFlow(){
  const u=auth.currentUser;
  if(!u||!u.email)return toast("Sign in with an email account first.");
  const em=myEmail();
  const pw=await new Promise(res=>{
    const ov=document.createElement("div");ov.className="app-modal-ov";
    ov.innerHTML=`<div class="app-modal" style="max-width:460px"><div class="app-modal-t">Delete account</div><div class="app-modal-msg">This permanently deletes <b>${esc(em)}</b> and everything you created - your teams, squads, player photos, tournaments, fixtures and matches. This cannot be undone.</div><label class="app-modal-l">Confirm your password</label><input data-f="pw" type="password" autocomplete="current-password" placeholder="Your password"><div class="app-modal-btns"><button class="hm-btn sec" data-x="0">Cancel</button><button class="hm-btn" data-x="1" style="background:#c0392b;border-color:#c0392b">Delete my account</button></div></div>`;
    document.body.appendChild(ov);
    const done=v=>{ov.remove();res(v);};
    const val=()=>{const el=ov.querySelector('[data-f="pw"]');return el?el.value:"";};
    ov.querySelector('[data-x="0"]').onclick=()=>done(null);
    ov.querySelector('[data-x="1"]').onclick=()=>{if(val())done(val());};
    ov.addEventListener("mousedown",e=>{if(e.target===ov)done(null);});
    ov.addEventListener("keydown",e=>{if(e.key==="Escape")done(null);else if(e.key==="Enter"&&val())done(val());});
    const f=ov.querySelector("input");if(f)f.focus();
  });
  if(!pw)return;
  toast("Checking your password...");
  try{
    await reauthenticateWithCredential(u,EmailAuthProvider.credential(u.email,pw));
  }catch(e){
    return toast((e&&(e.code==="auth/wrong-password"||e.code==="auth/invalid-credential"))?"Wrong password - nothing was deleted.":"Could not confirm your password. Try again.");
  }
  toast("Deleting your account...");
  try{
    await wipeOwned("squads",em);
    await wipeOwned("matches",em);
    await wipeOwned("tournaments",em);
    try{const sr=doc(db,"scorers",em);if((await getDoc(sr)).exists())await deleteDoc(sr);}catch{}
    await deleteUser(u);
    Auth.guest=false;
    await refreshRole(null);
    setView("home");
    toast("Your account and your data have been deleted.");
  }catch(e){
    toast((e&&e.code==="auth/requires-recent-login")?"Please sign in again, then delete.":"Could not finish deleting. Email amankhanjis@gmail.com and we will do it for you.");
  }
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
  let h=`<div class="hm-dhead"><div><div class="hm-dapp">SquareCut</div><div class="hm-duser">${u?esc(u.email)+(Auth.admin?" · Admin":""):Auth.guest?"Guest":"Not signed in"}</div>${signBtn}</div><button class="hm-dx" id="hm-drawer-x" title="Close">✕</button></div>`;
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
  h+=`<div class="hm-dfoot">`+sec("Display",`<button class="hm-gitem" data-go="theme"><span class="hm-dlabel">Theme: ${curTheme()[0].toUpperCase()+curTheme().slice(1)}</span><span class="hm-count">Choose</span></button>`)+`<div class="hm-dver" id="hm-ver"></div></div>`;
  host.innerHTML=h;
  showAppVersion(host);
  host.querySelector("#hm-drawer-x").onclick=closeDrawer;
  host.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>drawerGo(b.dataset.go));
}
// The real version and build, read from the native shell so it can never drift from the
// package that is actually installed. On the hosted web build there is no shell, so the
// line stays empty rather than lying.
function showAppVersion(host){
  const el=host.querySelector("#hm-ver");
  if(!el)return;
  const put=i=>{el.textContent=i&&i.appVersion?`v${i.appVersion} (${i.appBuild||"?"})`:"";};
  try{
    const cap=window.Capacitor;
    if(!cap||typeof cap.getInfo!=="function")return;
    const info=cap.getInfo();
    if(info&&typeof info.then==="function"){info.then(put).catch(()=>{});return;}
    put(info);
  }catch{}
}
async function drawerGo(go){
  const u=Auth.user;
  if(go==="theme"){themePicker();return;}
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
  Auth.user=u||null;Auth.admin=false;Auth.tids=[];Auth.teamIds=[];Auth.followIds=[];
  if(!u)return;
  const em=(u.email||"").toLowerCase();
  if(!em)return;
  Auth.admin=(em===ADMIN_EMAIL);
  try{const d=await getDoc(doc(db,"scorers",em));if(d.exists()){Auth.tids=d.data().tids||[];Auth.teamIds=d.data().teamIds||[];Auth.followIds=d.data().followTeams||[];}}catch{}
}
const isAdmin=()=>Auth.admin;
const myEmail=()=>((Auth.user&&Auth.user.email)||"").toLowerCase();
const isAnon=()=>!!(Auth.user&&Auth.user.isAnonymous);
const needAccount=()=>{if(!Auth.user||isAnon()){toast("Please sign in or create a free account first.");return true;}return false;};
async function ensureAuth(quiet=true){if(auth.currentUser)return true;try{await signInAnonymously(auth);return true;}catch(e){if(!quiet){const c=(e&&e.code)||"";toast(c==="auth/operation-not-allowed"||c==="auth/admin-restricted-operation"?"Enable Anonymous sign-in in Firebase Console under Authentication, then reload.":"Couldn't connect - check your internet and reload.");}return false;}}
// ---------- email verification gate (unverified accounts see only this screen) ----------
const needsVerify=u=>!!u&&!u.isAnonymous&&!u.emailVerified;
let _vgBusy=false;
function showVerifyGate(){
  let g=$("#vgate");
  if(!g){
    g=document.createElement("div");g.id="vgate";g.hidden=true;
    g.style.cssText="position:fixed;inset:0;z-index:9750;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(3,7,14,.9)";
    g.innerHTML=`<div style="max-width:430px;width:100%;background:#0e1726;border:1px solid #253650;border-radius:18px;padding:24px 20px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.55);font-family:Outfit,system-ui,sans-serif;color:#eaf2ff">
      <div style="font-size:36px;line-height:1">✉️</div>
      <div style="font-weight:800;font-size:21px;letter-spacing:.3px;margin:10px 0 6px">Verify your email</div>
      <div style="font-size:13.5px;line-height:1.55;color:#9fb2c9">We sent a verification link to<br><b id="vg-em" style="color:#eaf2ff;word-break:break-all"></b><br>Open it, then tap the button below. Check the spam folder too.</div>
      <button id="vg-check" style="display:block;width:100%;margin-top:16px;cursor:pointer;border:none;border-radius:10px;padding:13px;font:700 14px Outfit,system-ui;letter-spacing:1px;text-transform:uppercase;background:linear-gradient(135deg,#c8a84b,#f5d073);color:#0a0a1a">✅ I've verified — continue</button>
      <button id="vg-resend" style="display:block;width:100%;margin-top:9px;cursor:pointer;border-radius:10px;padding:12px;font:700 12px Outfit,system-ui;letter-spacing:1px;text-transform:uppercase;background:transparent;border:1.5px solid #33455f;color:#c9d7ea">✉️ Resend email</button>
      <button id="vg-out" style="display:block;width:100%;margin-top:9px;cursor:pointer;border-radius:10px;padding:12px;font:700 12px Outfit,system-ui;letter-spacing:1px;text-transform:uppercase;background:transparent;border:1.5px solid #33455f;color:#c9d7ea">Sign out</button>
      <div style="font-size:12px;color:#8fa2b8;margin-top:12px">Wrong address? Sign out, then create the account with your real email.</div>
    </div>`;
    document.body.appendChild(g);
    g.querySelector("#vg-check").onclick=()=>verifyGateCheck(false);
    g.querySelector("#vg-resend").onclick=verifyResend;
    g.querySelector("#vg-out").onclick=verifyOut;
  }
  const em=$("#vg-em");if(em)em.textContent=(Auth.user&&Auth.user.email)||myEmail()||"";
  g.hidden=false;g.style.display="flex";
}
// #vgate is built with an inline display:flex, which outranks the browser's
// [hidden]{display:none} rule - so the attribute alone can never hide it.
// Both show and hide must set the inline display explicitly.
function hideVerifyGate(){const g=$("#vgate");if(g){g.hidden=true;g.style.display="none";}}
async function verifyGateCheck(silent){
  if(_vgBusy||isAnon()||!auth.currentUser)return;_vgBusy=true;
  try{
    await auth.currentUser.reload();
    const nu=auth.currentUser;
    if(nu&&!nu.isAnonymous&&nu.emailVerified){
      hideVerifyGate();toast("Email verified — welcome to SquareCut!");
      await refreshRole(nu);renderChrome();
      if(!pendingNav())afterAuthRender();
      ensureScorerDoc(); // never awaited — a slow or failed record write must not stall entry
    }else if(!silent)toast("Not verified yet — open the link in your email first.");
  }catch{if(!silent)toast("Couldn't check — are you online?");}
  finally{_vgBusy=false;}
}
async function verifyResend(){
  const u=auth.currentUser;if(!u||u.isAnonymous)return;
  const b=$("#vg-resend");if(b&&b.disabled)return;
  try{await sendEmailVerification(u);toast("Verification email sent — check your inbox.");
    if(b){b.disabled=true;b.style.opacity=".55";setTimeout(()=>{b.disabled=false;b.style.opacity="1";},60000);}}
  catch(e){toast((e&&e.code)==="auth/too-many-requests"?"Too many tries — wait a minute, then resend.":"Couldn't send the email — check your connection.");}
}
async function verifyOut(){try{await signOut(auth);}catch{}Auth.guest=false;hideVerifyGate();await refreshRole(null);setView("home");}
document.addEventListener("visibilitychange",()=>{const g=$("#vgate");if(g&&!g.hidden&&document.visibilityState==="visible")verifyGateCheck(true);});
// account record is created only after the email is verified (fake signups leave no trace in the admin list)
async function ensureScorerDoc(){
  try{const em=myEmail();if(!em)return;const d=await getDoc(doc(db,"scorers",em));
    if(!d.exists())await setDoc(doc(db,"scorers",em),{email:em,tids:[],teamIds:[],followTeams:[],created:Date.now()},{merge:true});}catch{}
}
function afterAuthRender(){if(CurView==="home")renderHome();else if(CurView==="points")renderPoints();else if(CurView==="cricket")cricketView();else if(CurView==="account")accountView();else if(CurView==="scorer"&&ScS.view==="list")scList();else if(CurView==="scorer"&&ScS.view==="match"&&ScS.m)scMatchView();else if(CurView==="scorer"&&ScS.view==="play")scPlay();}
function pendingNav(){
  if(!Auth.user)return false;let pj=null,pt=null,px=null;
  try{pj=localStorage.getItem("scPendingJoin");pt=localStorage.getItem("scPendingTeam");px=localStorage.getItem("scPendingTransfer");}catch{}
  if(px){try{localStorage.removeItem("scPendingTransfer");}catch{}closeDrawer();const[mid2,tok2]=px.split("|");claimTransfer(mid2,tok2);return true;}
  if(pj){try{localStorage.removeItem("scPendingJoin");}catch{}closeDrawer();joinTeamView(pj);return true;}
  if(pt){try{localStorage.removeItem("scPendingTeam");}catch{}closeDrawer();teamProfileView(pt);return true;}
  return false;
}
// ---------- follow teams (My Teams without edit rights) ----------
const following=id=>!!id&&(Auth.followIds||[]).includes(id);
async function followTeam(id,on){
  if(needAccount())return false;
  try{
    await setDoc(doc(db,"scorers",myEmail()),{followTeams:on?arrayUnion(id):arrayRemove(id)},{merge:true});
    const f=new Set(Auth.followIds||[]);if(on)f.add(id);else f.delete(id);Auth.followIds=[...f];
    return true;
  }catch(e){
    toast((e&&e.code)==="permission-denied"?"Couldn't save — Firestore rules not published yet.":"Couldn't update My Teams — try again.");
    return false;
  }
}
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
// With search:true the sheet gets a filter box, so a long list stays usable.
function appPick(o){
  return new Promise(res=>{
    const opts=o.options||[];
    const ov=document.createElement("div");ov.className="app-modal-ov";
    ov.innerHTML=`<div class="app-modal"><div class="app-modal-t">${esc(o.title||"Select")}</div>${o.sub?`<div class="app-pick-sub">${esc(o.sub)}</div>`:""}${o.search?`<input class="app-pick-q" type="text" placeholder="${esc(o.searchPlaceholder||"Search…")}" autocomplete="off">`:""}<div class="app-pick-grid">${opts.map((p,i)=>`<button class="app-pick${p.v===(o.value??"")?" on":""}" data-i="${i}" data-q="${esc(((p.t||"")+" "+(p.s||"")).toLowerCase())}" ${p.off?"disabled":""}><span class="pk-t">${esc(p.t)}</span>${p.s?`<span class="pk-s">${esc(p.s)}</span>`:""}</button>`).join("")}</div><div class="app-modal-btns"><button class="hm-btn sec" data-x="0">Cancel</button></div></div>`;
    document.body.appendChild(ov);
    const done=v=>{ov.remove();res(v);};
    const grid=ov.querySelector(".app-pick-grid");
    ov.querySelectorAll("[data-i]").forEach(b=>b.onclick=()=>{if(b.disabled)return;const p=opts[+b.dataset.i];if(p&&p.off)return;done(p?p.v:null);});
    if(o.search){
      const q=ov.querySelector(".app-pick-q");
      const filter=()=>{const term=q.value.trim().toLowerCase();
        ov.querySelectorAll("[data-i]").forEach(b=>{b.style.display=(!term||(b.dataset.q||"").includes(term))?"":"none";});};
      q.oninput=filter;q.onkeydown=e=>{if(e.key==="Enter"){const first=ov.querySelector('[data-i]:not([style*="none"])');if(first)first.click();}};
      setTimeout(()=>q.focus(),60);
    }
    ov.querySelector('[data-x="0"]').onclick=()=>done(null);
    ov.addEventListener("mousedown",e=>{if(e.target===ov)done(null);});
    ov.addEventListener("keydown",e=>{if(e.key==="Escape")done(null);});
  });
}
// A field that looks like the app's own select but opens the in-app searchable picker,
// so a long list is never a native dropdown.
const appField=(id,label,value,ph)=>`<label class="l">${esc(label)}</label><button class="mc-sel mc-sel-btn" id="${id}" type="button"><span>${esc(value||ph||"Choose…")}</span><span class="mc-sel-c">▾</span></button>`;
const appSelect=o=>appPick({title:o.title,sub:o.sub,search:true,searchPlaceholder:o.searchPlaceholder||"Search…",value:o.value,options:o.options||[]});
// A native select with a long list opens a generic scroll wheel. This makes every long
// select in the app open the app's own searchable picker instead, and still fires the
// change event the page already listens to, so no screen has to change.
function appStyleSelects(root){
  const scope=root||document;
  scope.querySelectorAll("select").forEach(sel=>{
    if(sel.dataset.appPick==="1")return;
    if(sel.options.length<5)return;
    sel.dataset.appPick="1";
    sel.addEventListener("mousedown",e=>{
      e.preventDefault();
      const opts=[...sel.options].map(o=>({v:o.value,t:(o.textContent||"").trim()}));
      appPick({title:sel.dataset.pickTitle||"Choose",sub:sel.dataset.pickSub||"",search:true,searchPlaceholder:sel.dataset.pickPh||"Search…",value:sel.value,options:opts}).then(v=>{
        if(v===null||v===undefined)return;
        sel.value=v;
        sel.dispatchEvent(new Event("change",{bubbles:true}));
      });
    });
  });
}
// Keep it applied to selects that appear later, since every screen renders its own.
(function(){
  const apply=()=>{try{appStyleSelects(document);}catch{}};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",apply);
  else apply();
  try{new MutationObserver(()=>apply()).observe(document.documentElement,{childList:true,subtree:true});}catch{}
})();
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
  if(navigator.share)rows.push({icon:"↗️",t:"More share options",s:o.imageCanvas?"Share with image":"",on:async()=>{try{if(o.imageCanvas&&await shareCanvas(o.imageCanvas,o.imageName||"share.jpg",o.shareTitle||o.title||"",wa))return;await navigator.share({title:o.shareTitle||o.title||"SquareCut",text:wa});}catch{}}});
  return appSheet({title:o.title||"Share",sub:o.sub,rows});
}
// Android's WebView silently ignores <a download> when the href is a data: URL, so the native
// build hands the JPEG to the SqCut bridge (MainActivity.SaveBridge), which saves it to the
// gallery. Browsers keep the anchor path, so the hosted web version is unchanged.
function downloadCanvas(canvas,filename){
  try{
    if(window.SqCut&&window.SqCut.saveImage){
      window.SqCut.saveImage(canvas.toDataURL("image/jpeg",.88).split(",")[1],filename);
      return;
    }
  }catch{}
  const a=document.createElement("a");a.download=filename;a.href=canvas.toDataURL("image/jpeg",.88);a.click();
}
async function shareCanvas(canvas,filename,title,text){
  try{
    const blob=await new Promise(r=>canvas.toBlob(r,"image/jpeg",.88));
    const file=new File([blob],filename,{type:"image/jpeg"});
    if(navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file],title,text});return true;}
  }catch{}
  return false;
}
// Public web address of the hosted app (used for share links inside the native Play Store build, where location is localhost). Leave "" for web use.
const WEB_BASE="https://smartcric.smartstudygrid.workers.dev/";
function basePage(){try{if(WEB_BASE&&window.Capacitor&&window.Capacitor.isNativePlatform&&window.Capacitor.isNativePlatform())return WEB_BASE;}catch{}return location.origin+location.pathname;}
// Links shared out of the app open the app itself. The scoreticker overlay stays a plain
// web link, because it has to work inside OBS and in a browser.
const APP_SCHEME="squarecut://";
const isNativeApp=()=>{try{return!!(window.Capacitor&&window.Capacitor.isNativePlatform&&window.Capacitor.isNativePlatform());}catch{return false;}};
const appLink=(kind,id)=>isNativeApp()?`${APP_SCHEME}${kind}/${encodeURIComponent(id)}`:`${basePage()}?${kind}=${encodeURIComponent(id)}`;
function viewLinkFor(m){return appLink("match",m.id);}
function overlayLinkFor(m){return basePage()+"?mode=overlay&match="+m.id;}
function curTheme(){const b=document.body.classList;return b.contains("light")?"light":b.contains("green")?"green":"dark";}
function applyTheme(){try{const t=localStorage.getItem("cc-theme")||"dark";document.body.classList.toggle("light",t==="light");document.body.classList.toggle("green",t==="green");}catch{}}
function setTheme(t){try{localStorage.setItem("cc-theme",t);}catch{}applyTheme();toast(t==="light"?"Light mode on.":t==="green"?"Green theme on.":"Dark mode on.");}
function toggleTheme(){setTheme(curTheme()==="light"?"dark":"light");}
// The theme menu offers all three looks, so the green pitch is reachable too.
function themePicker(){appPick({title:"Theme",sub:"Pick how SquareCut looks",options:[{v:"dark",t:"Dark",s:"The original night look"},{v:"light",t:"Light",s:"Bright and clean"},{v:"green",t:"Green",s:"Full green pitch"}],value:curTheme()}).then(v=>{if(v){setTheme(v);renderDrawer();renderChrome();}});}
