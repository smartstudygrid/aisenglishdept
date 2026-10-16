// squad.js — split from index.single.html (no logic changes).
// Classic script: shares global scope with the other js/*.js files (same as the old single <script type="module">).
// Firebase symbols (db, auth, collection, doc, ...) come from js/firebase-init.js via window.
// user-level create: tournament + team (any signed-in user owns what they create)
async function sqUserCreateTournament(){
  if(needAccount())return;
  const v=await appForm({title:"New Tournament",okText:"Create",fields:[{id:"name",label:"Tournament name",placeholder:"e.g. Champions Trophy"},{id:"season",label:"Season",value:"Season 18"},{id:"year",label:"Year",value:String(new Date().getFullYear())}]});
  if(!v)return;
  const name=(v.name||"").trim();if(!name)return toast("Enter a tournament name.");
  const id=name.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"t"+Date.now();
  if(Tours.some(t=>t.id===id))return toast("That tournament already exists.");
  const season=(v.season||"").trim(),year=(v.year||"").trim();
  try{
    await setDoc(doc(db,"tournaments",id),{name,season,year,tagline:"",city:"",desc:"",status:"active",defOvers:"",created:Date.now(),owner:myEmail()});
    await refreshRole(Auth.user);await loadTours();await sqLoadTeams();toast(`Tournament "${name}" created.`);
    if(!Auth.admin&&Tours.some(t=>t.id!=="default"&&tourOwner(t.id)===myEmail()))myTours();else sqHome();
  }catch(e){toast("Couldn't create tournament: "+(e.message||e.code||"unknown error"));}
}
async function sqUserAddTeam(forceTid){
  if(needAccount())return;
  await sqLoadTeams();await loadTours();
  let tn="",tid="";
  if(forceTid){
    if(!canManageTour(forceTid))return toast("Not allowed.");
    const v=await appForm({title:"New Team in "+tname(forceTid),okText:"Create",fields:[{id:"name",label:"Team name",placeholder:"e.g. Falcons XI"}]});
    if(!v)return;
    tn=cleanName(v.name);if(!tn)return toast("Enter a team name.");
    tid=forceTid;
  }else{
    const v=await appForm({title:"New Team",okText:"Create",fields:[{id:"name",label:"Team name",placeholder:"e.g. Falcons XI"},{id:"tid",label:"Tournament",type:"select",value:"",options:[...myCreatableTours().map(t=>({v:t.id,t:`${t.name}${tourSeasonYear(t.id)?` (${tourSeasonYear(t.id)})`:""}`})),{v:"",t:"⭐ Friendly / Individual (no tournament)"}]}]});
    if(!v)return;
    tn=cleanName(v.name);if(!tn)return toast("Enter a team name.");
    tid=v.tid||"";
    if(tid!==""&&!myCreatableTours().some(t=>t.id===tid))return toast("Not allowed for this tournament.");
  }
  const did=tid===""?"F__"+tn:tid==="default"?tn:tid+"__"+tn;
  if(SqTeams.some(t=>t.id.toLowerCase()===did.toLowerCase()||(t.tid===tid&&normName(t.name)===normName(tn))))return toast("That team already exists.");
  try{
    await setDoc(doc(db,"squads",did),{team_name:tn,tournament:tid,pw_hash:TEAM_HASH,is_locked:false,player_list:Array(17).fill(""),squad_pics:{},captain_name:"",cap_pic:null,team_logo:null,teamCode:mintTeamCode(),owner:myEmail(),created:Date.now()});
    ScSquadsCache=null;await refreshRole(Auth.user);await sqLoadTeams();toast(`Team "${tn}" created — you can edit it now.`);
    if(forceTid)myTours();else sqHome();
  }catch(e){toast("Couldn't create team: "+(e.message||e.code||"unknown error"));}
}
function setCssForHome(){const sq=$("#css-squad"),sc=$("#css-scorer");if(sq)sq.disabled=true;if(sc)sc.disabled=true;}

// ================= SQUAD (no UI change, per-user editors + pw fallback) =================
const normName=s=>String(s||"").trim().replace(/\s+/g," ").toLowerCase();
const cleanName=s=>String(s||"").trim().replace(/\s+/g," ");
const mintTeamCode=()=>{let c="";do{c=Array.from({length:6},()=>"ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.random()*32|0]).join("");}while(SqTeams.some(t=>(t.code||"")===c));return c;};
function resolveTeam(q){
  q=String(q||"").trim();if(!q)return{err:"Enter a team code or name."};
  const byCode=SqTeams.find(t=>(t.code||"")===q.toUpperCase());
  if(byCode)return{team:byCode};
  const byId=SqTeams.find(t=>t.id===q);
  if(byId)return{team:byId};
  const hits=SqTeams.filter(t=>normName(t.name).includes(normName(q)));
  if(hits.length===1)return{team:hits[0]};
  if(!hits.length)return{err:"No team matches that code or name."};
  return{err:"Several teams match — be more specific: "+hits.slice(0,5).map(t=>t.name).join(", ")};
}
const mtAllowed=(t,tid,viaJoin)=>{const targetOk=tid!==""&&Tours.some(x=>x.id===tid);const tOwn=((t.owner||"")!==""&&(t.owner||"")===myEmail())||((t.coOwners||[]).map(e=>String(e).toLowerCase()).includes(myEmail()));return Auth.admin||(targetOk&&tourOwner(tid)===myEmail())||(tOwn&&(tid===""||(targetOk&&viaJoin)));};
function sqRoot(){return $("#squad-app");}
async function sqLoadTeams(){
  try{
    const[snap,ts]=await Promise.all([getDocs(collection(db,"squads")),getDocs(collection(db,"tournaments"))]);
    const docs=ts.docs.map(tourDoc);const hasDef=docs.some(d=>d.id==="default");
    Tours=[...(hasDef?[]:[{id:"default",name:"Challenger's Cup",owner:"",season:"Season 18",year:"2026",tagline:"BUILD YOUR SQUAD",city:"",desc:"",status:"active",defOvers:""}]),...docs].sort((a,b)=>(a.at||0)-(b.at||0));
    SqTeams=snap.docs.map(d=>{const x=d.data()||{};return{id:d.id,name:x.team_name||d.id,tid:x.tournament===undefined?"default":x.tournament,locked:!!x.is_locked,pw:x.pw_hash||TEAM_HASH,owner:(x.owner||"").toLowerCase(),editors:(x.editorEmails||[]),coOwners:(x.coOwners||[]),code:x.teamCode||""};}).sort((a,b)=>a.name.localeCompare(b.name));
    SqSeeded=SqTeams.length>0;
    if(!SqSeeded)SqTeams=DEFAULT_TEAMS.map(id=>({id,name:id,tid:"default",locked:false,pw:TEAM_HASH}));
    SqErr="";
  }catch(e){Tours=[{id:"default",name:"Challenger's Cup",owner:"",season:"Season 18",year:"2026",tagline:"BUILD YOUR SQUAD",city:"",desc:"",status:"active",defOvers:""}];SqTeams=DEFAULT_TEAMS.map(id=>({id,name:id,tid:"default",locked:false,pw:TEAM_HASH}));SqErr=e.message;}
}
function sqHome(){
  const sq=$("#css-squad");if(sq)sq.disabled=false;const sc=$("#css-scorer");if(sc)sc.disabled=true;
  document.body.classList.remove("sq");
  const u=Auth.user;
  sqRoot().innerHTML=`<div class="wrap"><div class="hdr"><div class="s" id="sq-h-s">&#9670; Season 18 2026 &#9670;</div><div class="n gold" id="sq-h-n">Challenger's Cup</div><div class="t" id="sq-h-t">BUILD YOUR SQUAD</div><div class="line"></div></div>
  <div id="sq-body"></div></div><div class="vt"><span class="gold" id="vts"></span></div>`;
  const b=$("#sq-body");
  const isMine=t=>canEditSquad(t.id);
  const memberTours=()=>{const em=myEmail();return Tours.filter(t=>tourOwner(t.id)===em||(Auth.tids||[]).includes(t.id)||tourScorers(t.id).includes(em)||SqTeams.some(x=>x.tid===t.id&&canEditSquad(x.id)));};
  if(u&&!Auth.admin){
    // Members see their tournaments and teams as separate lists (no all-tournaments dropdown)
    const mTours=memberTours();
    const mTeams=SqTeams.filter(t=>canEditSquad(t.id));
    b.innerHTML=`
    <div class="panel"><div class="ph">🏆 My Tournaments (${mTours.length})</div>
    ${mTours.map(t=>{const tc=SqTeams.filter(x=>x.tid===t.id).length;return`<div class="row"><b>${esc(t.name)} <small style="opacity:.65">· ${esc(tourSeasonYear(t.id))} · ${tc} team${tc===1?"":"s"}</small></b><button class="btn sm auto" data-goto-tour="${esc(t.id)}">Open</button></div>`;}).join("")||`<div class="mut c">No tournaments yet — create one below.</div>`}</div>
    <div class="panel"><div class="ph">👥 My Teams (${mTeams.length})</div>
    ${mTeams.map(t=>`<div class="row"><b style="flex:1;min-width:130px">${t.locked?"🔒 ":""}${esc(t.name)} <small style="opacity:.65">· ${esc(tname(t.tid))}</small></b><span style="display:flex;gap:6px;margin-left:auto;flex-wrap:wrap"><button class="btn sm auto" data-open-team="${esc(t.id)}">✏️ Manage Squad</button><button class="btn sm sec auto" data-team-own="${esc(t.id)}">👑 Manage Team</button></span></div>`).join("")||`<div class="mut c">No teams yet — create one below.</div>`}</div>
    <div class="hint c">Signed in as ${esc(u.email)}</div>
    <div style="display:flex;gap:8px;margin-top:10px"><button class="btn sec auto" id="ct2" style="flex:1">🏆 New Tournament</button><button class="btn sec auto" id="nt3" style="flex:1">👥 New Team</button></div>
    <div class="msg err" id="m">${esc(SqErr)}</div>`;
    setBack(()=>setView("home"));
    b.querySelectorAll("[data-goto-tour]").forEach(x=>x.onclick=()=>{ScS.tour=x.dataset.gotoTour;ScS.tab="m";setView("scorer");});
    b.querySelectorAll("[data-open-team]").forEach(x=>x.onclick=()=>{const t=SqTeams.find(y=>y.id===x.dataset.openTeam);sqOpen(x.dataset.openTeam,!!(t&&t.locked));});
    b.querySelectorAll("[data-team-own]").forEach(x=>x.onclick=()=>{ScS.profTab="manage";ScS.profBack=()=>sqHome();teamProfileView(x.dataset.teamOwn);});
    $("#sq-h-n").textContent="My Teams & Tournaments";$("#sq-h-s").textContent="";$("#sq-h-t").textContent="Manage your game";const vv=$("#vts");if(vv)vv.textContent="My Teams";
  }else{
  b.innerHTML=`<div class="login"><div class="lt">⚡ Enter Your Squad</div>
    <label class="l">Select Tournament</label><select id="tour">${Tours.map(t=>`<option value="${esc(t.id)}" ${SqS.hT===t.id?"selected":""}>${esc(t.name)}</option>`).join("")}<option value="" ${SqS.hT===""?"selected":""}>⭐ Friendly / Independent Teams</option></select>
    <label class="l">Select Your Team</label><select id="team"></select>
    ${u?`<div class="hint" style="margin:6px 0">Signed in as ${esc(u.email)} (Admin — can edit all)</div>`:`<label class="l">Team Password (legacy fallback — assigned users skip this)</label><input type="password" id="pw" placeholder="Enter team password…">`}
    <button class="btn" id="enter">Open Squad</button>
    <button class="btn sec" id="view">👁️ View Squad</button>
    ${Auth.admin?`<button class="btn sec" id="adm" style="margin-top:12px">🛠 Squad Admin</button>`:""}
    ${u?`<div style="display:flex;gap:8px;margin-top:10px"><button class="btn sec auto" id="ct2" style="flex:1">🏆 New Tournament</button><button class="btn sec auto" id="nt3" style="flex:1">👥 New Team</button></div>`:""}
    <div class="msg err" id="m">${esc(SqErr)}</div></div>`;
  setBack(()=>setView("home"));
  const updHdr=()=>{const tid=$("#tour").value;$("#sq-h-n").textContent=tname(tid)||"Challenger's Cup";$("#sq-h-s").textContent=`◈ ${tourSeasonYear(tid)} ◈`;$("#sq-h-t").textContent=tourTagline(tid)||"BUILD YOUR SQUAD";const v=$("#vts");if(v)v.textContent=tname(tid);};
  const friendlyHdr=()=>{if(!$("#tour").value){$("#sq-h-n").textContent="Friendly Cricket";const s=$("#sq-h-s");if(s)s.textContent="INDIVIDUAL - NO TOURNAMENT";const t=$("#sq-h-t");if(t)t.textContent="PICK A TEAM BELOW";const v=$("#vts");if(v)v.textContent="Friendly";}};
  const fill=()=>{
    const tid=$("#tour").value;
    updHdr();friendlyHdr();
    let list=SqTeams.filter(t=>t.tid===tid);
    if(u&&!Auth.admin){
      const mine=list.filter(isMine);
      const others=list.filter(t=>!isMine(t));
      list=[...mine,...others];
    }
    $("#team").innerHTML=list.map(t=>`<option value="${esc(t.id)}">${esc(t.name)}${u&&!isMine(t)?" (view)":""}</option>`).join("")||`<option value="">No teams yet — create one below</option>`;
    if(SqS.hTm&&[...$("#team").options].some(o=>o.value===SqS.hTm))$("#team").value=SqS.hTm;
    SqS.hTm=$("#team").value||"";SqS.hT=$("#tour").value;
  };
  $("#tour").onchange=()=>{SqS.hT=$("#tour").value;SqS.hTm="";fill();};
  $("#team").onchange=()=>{SqS.hTm=$("#team").value||"";};
  fill();
  const msg=t=>{$("#m").textContent=t;};
  $("#enter").onclick=async()=>{
    SqS.hT=$("#tour").value;SqS.hTm=$("#team").value||"";
    const id=$("#team").value;if(!id)return;
    if(canEditSquad(id)){sqOpen(id,false);return;}
    const pwEl=$("#pw");
    const t=SqTeams.find(x=>x.id===id);
    if(t&&pwEl&&await sha(pwEl.value)===t.pw){sqOpen(id,false);}else msg(u?"You are not assigned to this squad. View only, or create your own team.":"Incorrect password.");
  };
  $("#view").onclick=()=>{SqS.hT=$("#tour").value;SqS.hTm=$("#team").value||"";if($("#team").value)sqOpen($("#team").value,true);};
  }
  if($("#adm"))$("#adm").onclick=()=>sqAdmin();
  if($("#ct2"))$("#ct2").onclick=()=>sqUserCreateTournament();
  if($("#nt3"))$("#nt3").onclick=()=>sqUserAddTeam();
}
function sqCrop(file,ratio,circle,w=192,q=.62){
  return new Promise((res,rej)=>{
    const url=URL.createObjectURL(file),im=new Image();
    im.onerror=()=>{URL.revokeObjectURL(url);rej();};
    im.onload=()=>{
      const W=w,H=Math.round(W/ratio);
      const ov=document.createElement("div");ov.className="modal";
      ov.innerHTML=`<div class="mb"><div class="mt">Frame face + shoulders</div><canvas width="${W}" height="${H}" class="cv ${circle?"rc":""}"></canvas><input type="range" id="z" min="1" max="6" step="0.01" value="1"><div class="hint">Drag to move · slider or scroll to zoom</div><div style="display:flex;gap:10px"><button class="btn sec auto" id="cx">Cancel</button><button class="btn auto" id="ck">Use photo</button></div></div>`;
      sqRoot().append(ov);
      const c=ov.querySelector("canvas"),g=c.getContext("2d"),zs=ov.querySelector("#z");
      const base=Math.max(W/im.width,H/im.height);
      let z=1,x=0,y=0,drag=null;
      const draw=()=>{const s=base*z,mx=(im.width*s-W)/2,my=(im.height*s-H)/2;x=Math.max(-mx,Math.min(mx,x));y=Math.max(-my,Math.min(my,y));g.fillStyle="#000";g.fillRect(0,0,W,H);g.drawImage(im,W/2+x-im.width*s/2,H/2+y-im.height*s/2,im.width*s,im.height*s);};
      const done=v=>{URL.revokeObjectURL(url);ov.remove();res(v);};
      zs.oninput=()=>{z=+zs.value;draw();};
      c.onwheel=e=>{e.preventDefault();z=Math.min(6,Math.max(1,z-e.deltaY*.003));zs.value=z;draw();};
      c.onpointerdown=e=>{drag=[e.clientX,e.clientY];c.setPointerCapture(e.pointerId);};
      c.onpointermove=e=>{if(!drag)return;const k=W/c.getBoundingClientRect().width;x+=(e.clientX-drag[0])*k;y+=(e.clientY-drag[1])*k;drag=[e.clientX,e.clientY];draw();};
      c.onpointerup=()=>drag=null;
      ov.querySelector("#cx").onclick=()=>done(null);
      ov.querySelector("#ck").onclick=()=>done(c.toDataURL("image/jpeg",q).split(",")[1]);
      draw();
    };
    im.src=url;
  });
}
async function sqOpen(team,viewOnly){
  sqRoot().querySelector("#sq-body")&&(sqRoot().querySelector("#sq-body").innerHTML=`<div class="msg">Loading…</div>`);
  if(!sqRoot().querySelector("#sq-body"))sqHome();
  try{window.scrollTo(0,0);}catch{}
  try{
    const snap=await getDoc(doc(db,"squads",team));
    const x=snap.exists()?snap.data():{};
    SqS.d={is_locked:!!x.is_locked,names:Array.from({length:17},(_,i)=>(x.player_list||[])[i]||""),pics:x.squad_pics||{},cap_name:x.captain_name||"",cap_pic:x.cap_pic||null,logo:x.team_logo||null};
  }catch(e){sqRoot().querySelector("#sq-body").innerHTML=`<div class="login"><div class="msg err">Connection error: ${esc(e.message)}</div></div>`;return;}
  const tm=SqTeams.find(x=>x.id===team);
  const ttid=(tm&&tm.tid!=null)?tm.tid:"default";
  Object.assign(SqS,{team,tname:tm?tm.name:team,tour:ttid?(Tours.find(x=>x.id===ttid)||{}).name||tname(ttid):"Friendly",tourSY:ttid?tourSeasonYear(ttid):"Friendly",viewOnly,edit:false,msg:""});
  sqRender();
}
async function sqDownloadImg(){
  const d=SqS.d,W=1600,H=1010,c=document.createElement("canvas");c.width=W;c.height=H;const g=c.getContext("2d");
  try{await Promise.all([document.fonts.load("700 40px Oswald"),document.fonts.load("700 20px Rajdhani")]);}catch{}
  const load=b=>b?new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.onerror=()=>r(null);i.src="data:image/jpeg;base64,"+b;}):null;
  const capT=(d.cap_name||"").trim();
  const capIdx=capT?d.names.findIndex(n=>(n||"").trim()===capT):-1;
  const capSrc=capIdx>=0?(d.pics[capIdx]||d.cap_pic):d.cap_pic;
  const[logo,cap,...pl]=await Promise.all([load(d.logo),load(capSrc),...Array.from({length:17},(_,i)=>load(d.pics[i]))]);
  const GOLD="#f5d073";const bg=g.createLinearGradient(0,0,0,H);bg.addColorStop(0,"#020818");bg.addColorStop(.55,"#061535");bg.addColorStop(1,"#03100d");g.fillStyle=bg;g.fillRect(0,0,W,H);
  const rr=(x,y,w,h,r)=>{g.beginPath();g.roundRect(x,y,w,h,r);};
  const cover=(im,x,y,w,h)=>{const k=Math.max(w/im.width,h/im.height),sw=w/k,sh=h/k;g.drawImage(im,(im.width-sw)/2,(im.height-sh)/2,sw,sh,x,y,w,h);};
  const fit=(t,wt,fam,size,max)=>{while(size>10){g.font=`${wt} ${size}px ${fam}`;if(g.measureText(t).width<=max)break;size-=2;}};
  const ghost=(cx,cy,r,col)=>{g.strokeStyle=col;g.lineWidth=3;g.beginPath();g.arc(cx,cy-r*.5,r*.5,0,7);g.stroke();g.beginPath();g.arc(cx,cy+r*1.2,r*.95,Math.PI*1.1,Math.PI*1.9);g.stroke();};
  const card=(x,y,w,top,imgH,barH,im,name,num,o)=>{const h=top+imgH+barH;g.save();g.shadowColor=o.glow;g.shadowBlur=20;g.fillStyle=o.fill;rr(x,y,w,h,10);g.fill();g.restore();g.save();rr(x,y,w,h,10);g.clip();g.fillStyle="#050f1e";g.fillRect(x,y+top,w,imgH);if(im)cover(im,x,y+top,w,imgH);else ghost(x+w/2,y+top+imgH/2,w*.16,o.ghost);g.fillStyle="rgba(0,10,30,.95)";g.fillRect(x,y+top+imgH,w,barH);if(top){g.fillStyle="rgba(0,30,10,.95)";g.fillRect(x,y,w,top);g.fillStyle="#c8a84b";g.font="400 16px Oswald";g.textAlign="center";g.textBaseline="middle";g.fillText("★  CAPTAIN  ★",x+w/2,y+top/2);}g.restore();g.strokeStyle=o.border;g.lineWidth=o.bw;rr(x,y,w,h,10);g.stroke();g.textAlign="left";g.textBaseline="alphabetic";g.fillStyle="rgba(200,168,75,.95)";g.font="700 16px Oswald";g.fillText(num,x+10,y+top+24);g.textAlign="center";g.textBaseline="middle";const t=(name||"Player").toUpperCase();g.fillStyle=name?o.col:"rgba(100,150,255,.45)";fit(t,700,o.fam,o.size,w-20);g.fillText(t,x+w/2,y+top+imgH+barH/2+1);};
  g.save();g.beginPath();g.arc(120,110,60,0,7);g.clip();g.fillStyle="#0a1a3a";g.fillRect(60,50,120,120);if(logo)cover(logo,60,50,120,120);g.restore();g.strokeStyle="rgba(200,168,75,.8)";g.lineWidth=3;g.beginPath();g.arc(120,110,60,0,7);g.stroke();
  g.textAlign="left";g.textBaseline="alphabetic";g.fillStyle="#7ab3ff";g.font="600 20px Oswald";g.fillText(`◆ ${SqS.tour.toUpperCase()} · ${(SqS.tourSY||"Season 18 2026").toUpperCase()} ◆`,210,80);
  g.fillStyle=GOLD;const tn=SqS.tname.toUpperCase();fit(tn,700,"Oswald",76,1300);g.fillText(tn,210,160);
  const ln=g.createLinearGradient(60,0,1540,0);ln.addColorStop(0,"rgba(200,168,75,0)");ln.addColorStop(.5,"rgba(200,168,75,.9)");ln.addColorStop(1,"rgba(200,168,75,0)");g.fillStyle=ln;g.fillRect(60,205,1480,2);
  const po={glow:"#1a6fff",fill:"#0a1628",border:"rgba(100,180,255,.6)",bw:2,ghost:"rgba(64,96,160,.5)",col:"#fff",fam:"Rajdhani",size:22};
  // Themed-broadcast row bands behind the 17-card grid (captain card stays gold).
  [0,1,2].forEach(r=>{const by=240+r*226-9;g.fillStyle=r%2===0?"rgba(20,88,52,.5)":"rgba(11,56,34,.55)";rr(44,by,1132,228,14);g.fill();g.fillStyle="#2fbf71";rr(44,by,5,228,3);g.fill();});
  for(let i=0;i<17;i++)card(60+(i%6)*186,240+Math.floor(i/6)*226,170,0,170,40,pl[i],d.names[i],i+1,po);
  card(1200,240,340,36,317,58,cap,d.cap_name||"Captain",18,{glow:"#c8a84b",fill:"#0e1a08",border:"#c8a84b",bw:3,ghost:"rgba(200,168,75,.4)",col:GOLD,fam:"Oswald",size:30});
  g.textAlign="center";g.textBaseline="alphabetic";g.fillStyle="rgba(255,255,255,.75)";g.font="600 18px Rajdhani";g.fillText("SmartCric",W/2,H-30);
  c.toBlob(b=>{const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=(SqS.tname.replace(/[^\w-]+/g,"_")||"squad")+"_squad.jpg";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),3000);},"image/jpeg",.88);
}
function sqRender(){
  document.body.classList.add("sq");
  const host=sqRoot().querySelector("#sq-body")||sqRoot();
  const vts=$("#vts");if(vts)vts.textContent=SqS.tour;
  const d=SqS.d,canEdit=canEditSquad(SqS.team),edit=SqS.edit&&!SqS.viewOnly&&!d.is_locked&&canEdit;
  const up=id=>edit?`<label class="up">📷 ${(id==="cap"?d.cap_pic:d.pics[id])?"Change":"Add"} Photo<input type="file" accept="image/*" data-up="${id}"></label>`:"";
  let cards="";
  for(let i=0;i<17;i++){const p=d.pics[i];cards+=`<div><div class="card"><div class="glow"></div><div class="inner"><div class="num">${i+1}</div><div class="img">${p?`<img src="data:image/jpeg;base64,${p}">`:`<svg viewBox="0 0 24 24" fill="none" style="width:50%;opacity:.25"><circle cx="12" cy="8" r="4" stroke="#4060a0" stroke-width="1.5"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="#4060a0" stroke-width="1.5" stroke-linecap="round"/></svg>`}</div>${d.names[i]?`<div class="nb">${esc(d.names[i])}</div>`:`<div class="nb e">Player</div>`}</div></div>${edit?`<div class="ed"><input type="text" data-n="${i}" value="${esc(d.names[i])}" placeholder="Player ${i+1}">${up(i)}</div>`:""}</div>`;}
  const capTrim=(d.cap_name||"").trim();
  const capIdx=capTrim?d.names.findIndex(n=>(n||"").trim()===capTrim):-1;
  const capImg=capIdx>=0?(d.pics[capIdx]||d.cap_pic):d.cap_pic;
  const capOpts=d.names.map(n=>n.trim()).filter(Boolean);
  const capSel=`<input type="text" id="cn" list="cn-list" value="${esc(d.cap_name||"")}" placeholder="Type a name or pick from squad" autocomplete="off" style="width:100%"><datalist id="cn-list">${capOpts.map(n=>`<option value="${esc(n)}"></option>`).join("")}</datalist>`;
  host.innerHTML=`<div class="wrap"><div class="th"><div class="logo ${d.logo?"has":""}">${d.logo?`<img src="data:image/jpeg;base64,${d.logo}">`:""}</div><div><div class="tn gold">${esc(SqS.tname)}</div><div class="ts">${esc(SqS.tourSY||"Season 18 2026")}</div></div></div>
  ${d.is_locked&&!SqS.viewOnly?`<div class="lock">🔒 Squad is Locked</div>`:""}
  ${!canEdit&&!SqS.viewOnly?`<div class="lock">View only — ask admin to assign you</div>`:""}
  ${edit?`<div style="margin-bottom:14px"><label class="l">Team Logo</label><label class="up" style="display:inline-flex;padding:7px 18px">📷 ${d.logo?"Change":"Upload"} Logo<input type="file" accept="image/*" data-up="logo"></label></div>`:""}
  <div class="main"><div class="grid">${cards}</div><div><div class="card cap"><div class="glow"></div><div class="inner"><div class="cl">★ CAPTAIN ★</div><div class="num" style="top:36px;font-size:13px">18</div><div class="img">${capImg?`<img src="data:image/jpeg;base64,${capImg}">`:`<svg viewBox="0 0 24 24" fill="none" style="width:45%;opacity:.25"><circle cx="12" cy="8" r="4" stroke="#c8a84b" stroke-width="1.5"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="#c8a84b" stroke-width="1.5" stroke-linecap="round"/></svg>`}</div><div class="nb">${esc(d.cap_name||"Captain")}</div></div></div>${edit?`<div class="ed"><label class="l">Captain (squad player or type any name)</label>${capSel}${up("cap")}</div>`:""}</div></div>
  <div class="bar">${SqS.viewOnly?`<div class="badge">👁 View Only</div>`:`<div class="seg"><button id="vw" class="${edit?"":"on"}">👁 View</button><button id="ed" class="${edit?"on":""}" ${(d.is_locked||!canEdit)?"disabled":""}>✏️ Edit</button></div>`}<div class="sp"></div><button class="btn sec auto" id="sq-more" title="More actions">⋯ More</button>${edit?`<button class="btn auto" id="save" title="Save all changes">💾 Save</button>`:""}</div></div>`;
  setBack(()=>sqHome());
  const goStats=()=>{if(sqRoot().querySelector("#prof-body")){ScS.profTab="stats";sqRoot().querySelectorAll("[data-pt]").forEach(x=>x.classList.toggle("on",x.dataset.pt==="stats"));profTabRender(SqS.team);}else{ScS.profTab="stats";ScS.profBack=()=>sqOpen(SqS.team,!!SqS.viewOnly);teamProfileView(SqS.team);}};
  const goOwn=()=>{if(sqRoot().querySelector("#prof-body")){ScS.profTab="manage";sqRoot().querySelectorAll("[data-pt]").forEach(x=>x.classList.toggle("on",x.dataset.pt==="manage"));profTabRender(SqS.team);}else{ScS.profTab="manage";ScS.profBack=()=>sqOpen(SqS.team,!!SqS.viewOnly);teamProfileView(SqS.team);}};
  $("#sq-more").onclick=()=>appSheet({title:"Team actions",sub:SqS.tname,rows:[
    {icon:"📥",t:"Download squad image",s:"Poster with logo and players",on:()=>{toast("Building squad image…");sqDownloadImg().catch(()=>toast("Could not create image."));}},
    {icon:"🔗",t:"Team link & QR",on:()=>teamLinkView(SqS.team)},
    {icon:"📊",t:"Team stats",on:goStats},
    {icon:"👑",t:"Manage team owners & editors",on:goOwn},
  ]});
  if($("#vw")){$("#vw").onclick=()=>{SqS.edit=false;sqRender();};$("#ed").onclick=()=>{SqS.edit=true;sqRender();};}
  host.querySelectorAll("[data-n]").forEach(el=>el.oninput=()=>{d.names[+el.dataset.n]=el.value;const dl=$("#cn-list");if(dl){const opts=d.names.map(n=>(n||"").trim()).filter(Boolean);dl.innerHTML=opts.map(n=>`<option value="${esc(n)}"></option>`).join("");}});
  if($("#cn"))$("#cn").oninput=e=>{d.cap_name=e.target.value;};
  host.querySelectorAll("[data-up]").forEach(el=>el.onchange=async()=>{
    if(!el.files[0])return;
    try{const k=el.dataset.up;const b=await sqCrop(el.files[0],1,k==="logo",k==="logo"?224:192,k==="logo"?.7:.62);el.value="";if(!b)return;if(k==="logo")d.logo=b;else if(k==="cap")d.cap_pic=b;else d.pics[k]=b;sqRender();}
    catch{toast("Could not read image.");sqRender();}
  });
  if($("#save"))$("#save").onclick=async()=>{
    $("#save").disabled=true;$("#save").textContent="Saving…";
    const _ct=SqTeams.find(x=>x.id===SqS.team);SqS.tname=cleanName(SqS.tname);if(_ct&&SqTeams.some(x=>x.id!==SqS.team&&x.tid===_ct.tid&&normName(x.name)===normName(SqS.tname))){toast("Another team already uses that name here.");sqRender();return;}
    try{const cap=(d.cap_name||"").trim();await setDoc(doc(db,"squads",SqS.team),{team_name:SqS.tname,captain_name:cap,player_list:d.names,squad_pics:d.pics,cap_pic:d.cap_pic,team_logo:d.logo},{merge:true});toast("✅ Squad saved successfully!");}
    catch(e){toast("Save failed: "+e.message);}
    sqRender();
  };
}
async function sqAdmin(){
  document.body.classList.remove("sq");
  sqRoot().innerHTML=`<div class="wrap"><div class="msg">Loading…</div></div>`;
  if(!SqSeeded){
    try{const b=writeBatch(db);DEFAULT_TEAMS.forEach(t=>b.set(doc(db,"squads",t),{team_name:t,pw_hash:TEAM_HASH,is_locked:false},{merge:true}));await b.commit();SqSeeded=true;}catch(e){SqErr=e.message;}
  }
  await sqLoadTeams();sqAdminRender(SqErr,"err");
}
// Tournament editor (super admin = Auth.admin; owners can edit their own)
function sqTourEdit(id){
  const t=tourMeta(id);
  if(!t||!t.id){toast("Unknown tournament.");return;}
  if(!canManageTour(id)){toast("Not allowed.");return;}
  document.body.classList.remove("sq");
  const tc=SqTeams.filter(x=>x.tid===id).length,mc=ScMatches.filter(x=>x.tid===id).length;
  sqRoot().innerHTML=`<div class="wrap"><div class="th"><div><div class="tn gold">Edit Tournament</div><div class="ts">${esc(t.name)} · ${tc} teams · ${mc} matches</div></div></div>
  <div class="panel"><div class="ph">Details</div>
    <label class="l">Name</label><input type="text" id="te-n" value="${esc(t.name)}">
    <div style="display:flex;gap:8px"><div style="flex:1"><label class="l">Season</label><input type="text" id="te-s" value="${esc(t.season||"")}" placeholder="Season 18"></div><div style="flex:1"><label class="l">Year</label><input type="text" id="te-y" value="${esc(t.year||"")}" placeholder="2026"></div></div>
    <label class="l">Tagline (shown under name)</label><input type="text" id="te-t" value="${esc(t.tagline||"")}" placeholder="BUILD YOUR SQUAD">
    <div style="display:flex;gap:8px"><div style="flex:1"><label class="l">City / Venue</label><input type="text" id="te-c" value="${esc(t.city||"")}" placeholder="Riyadh"></div><div style="flex:1"><label class="l">Default overs</label><input type="number" id="te-o" min="1" max="50" value="${esc(t.defOvers||"")}" placeholder="10"></div></div>
    <label class="l">Status</label><select id="te-st"><option value="active" ${tourStatus(id)!=="archived"?"selected":""}>Active</option><option value="archived" ${tourStatus(id)==="archived"?"selected":""}>Archived (hidden from new-team / schedule pickers)</option></select>
    <label class="l">Description</label><input type="text" id="te-d" value="${esc(t.desc||"")}" placeholder="Short description">
    ${Auth.admin?`<div class="hint">ID: ${esc(t.id)} · Owner: ${esc(t.owner||"—")}</div>`:""}
  </div>
  <div class="bar"><div class="sp"></div><button class="btn auto" id="te-save" title="Save tournament">💾 Save</button></div>
  <div class="panel"><div class="ph">Stages & Groups</div><div id="te-stages"><div class="mut">Loading stages...</div></div></div>
  <div class="msg" id="te-m"></div></div>`;
  renderStages(id);
  setBack(()=>{Auth.admin?sqAdminRender():myTours();});
  $("#te-save").onclick=async()=>{
    const n=$("#te-n").value.trim();if(!n){$("#te-m").textContent="Name required.";return;}
    $("#te-save").disabled=true;$("#te-save").textContent="Saving…";
    try{
      await setDoc(doc(db,"tournaments",id),{name:n,season:$("#te-s").value.trim(),year:$("#te-y").value.trim(),tagline:$("#te-t").value.trim(),city:$("#te-c").value.trim(),defOvers:$("#te-o").value.trim(),status:$("#te-st").value,desc:$("#te-d").value.trim()},{merge:true});
      await sqLoadTeams();toast(`Tournament "${n}" saved.`);sqAdminRender(`"${n}" saved.`,"ok");
    }catch(e){$("#te-save").disabled=false;$("#te-save").textContent="💾 Save Tournament";$("#te-m").textContent=e.message;}
  };
}
async function renderStages(tid){
  const host=$("#te-stages");if(!host)return;
  let sts=[];try{sts=await loadStages(tid);}catch{sts=[];}
  const teams=[];{const seen=new Set();SqTeams.filter(t=>t.tid===tid).sort((a,b)=>a.name.localeCompare(b.name)).forEach(t=>{const k=normName(t.name);if(seen.has(k))return;seen.add(k);teams.push(t);});}
  const save=async(sid,fn)=>{const st=(ScStagesCache[tid]||[]).find(x=>x.id===sid);if(!st)return;const groups=(st.groups||[]).map(g=>({id:g.id,name:g.name,teamIds:[...(g.teamIds||[])]}));fn(groups);await setDoc(doc(db,"tournaments",tid,"stages",sid),{groups},{merge:true});ScStagesCache[tid]=null;renderStages(tid);};
  const box=s=>{
    const grps=s.groups||[];const _asg=new Set();grps.forEach(g=>{(g.teamIds||[]).forEach(x=>_asg.add(x));});const _un=teams.filter(t=>!_asg.has(t.id));
    return`<div class="panel"><div class="ph">#${s.order||0} ${esc(s.name)} <small style="opacity:.65">| ${esc(stageTypeLabel(s.type))} | ${grps.length} group${grps.length===1?"":"s"}</small></div>`
    +(s.type==="SINGLE_ELIMINATION"?`<div class="mut">Knockout stage - teams decided on qualification, no groups needed.</div>`:(_un.length?`<div class="mut">Unassigned (${_un.length}): ${esc(_un.map(t=>t.name).join(", "))}</div>`:"")+grps.map(g=>{const ids=g.teamIds||[];return`<div style="margin-bottom:8px"><div class="row"><b>${esc(g.name)} <small style="opacity:.65">| ${ids.length} team${ids.length===1?"":"s"}</small></b><button class="btn sm sec auto" data-sgdel="${esc(s.id)}|${esc(g.id)}">Delete</button></div><div style="display:flex;gap:6px 12px;flex-wrap:wrap;margin-top:6px">${teams.map(t=>`<label style="display:flex;gap:4px;align-items:center;font-size:13px"><input type="checkbox" data-steamid="${esc(s.id)}" data-grpid="${esc(g.id)}" value="${esc(t.id)}" ${ids.includes(t.id)?"checked":""}>${esc(t.name)}</label>`).join("")||`<div class="mut">No teams in this tournament yet.</div>`}</div></div>`;}).join("")
    +`<div class="row"><input type="text" id="ng-${esc(s.id)}" placeholder="New group name" style="flex:1;min-width:120px"><button class="btn sm auto" data-sgadd="${esc(s.id)}">Add Group</button><button class="btn sm sec auto" data-sdel="${esc(s.id)}" style="color:#ff7b7b;border-color:#ff7b7b66">Delete Stage</button></div></div>`);
  };
  host.innerHTML=(sts.map(box).join("")||`<div class="mut">No stages yet - add one below. Matches without a stage keep working as before.</div>`)
  +`<div class="panel"><div class="ph">Add Stage</div><div class="row" style="border:none"><button class="btn sm auto" id="ns-quick">Quick setup: 1 group stage, all teams in Group A</button></div><div class="row"><input type="text" id="ns-n" placeholder="Stage name (e.g. Group Stage)" style="flex:2;min-width:140px"><select id="ns-t" style="flex:1;min-width:120px">${STAGE_TYPES.map(([v,t])=>`<option value="${v}">${t}</option>`).join("")}</select><input type="number" id="ns-o" placeholder="Order" value="${sts.length+1}" style="flex:0 0 70px"><button class="btn sm auto" id="ns-add">Add</button></div></div>`;
  $("#ns-quick").onclick=async()=>{await setDoc(doc(db,"tournaments",tid,"stages",rid("s")),{name:"Group Stage",type:"ROUND_ROBIN",order:sts.length+1,groups:[{id:rid("g"),name:"Group A",teamIds:teams.map(t=>t.id)}],created:Date.now()});ScStagesCache[tid]=null;toast("Quick setup done.");renderStages(tid);};
  $("#ns-add").onclick=async()=>{const n=$("#ns-n").value.trim();if(!n)return toast("Stage name required.");await setDoc(doc(db,"tournaments",tid,"stages",rid("s")),{name:n,type:$("#ns-t").value,order:+$("#ns-o").value||(sts.length+1),groups:[],created:Date.now()});ScStagesCache[tid]=null;toast("Stage added.");renderStages(tid);};
  host.querySelectorAll("[data-sdel]").forEach(b=>b.onclick=async()=>{if(!await appConfirm("Delete this stage and its groups? Matches keep their data.","Delete"))return;await deleteDoc(doc(db,"tournaments",tid,"stages",b.dataset.sdel));ScStagesCache[tid]=null;renderStages(tid);});
  host.querySelectorAll("[data-sgadd]").forEach(b=>b.onclick=async()=>{const inp=$("#ng-"+b.dataset.sgadd);const n=(inp.value||"").trim();const _s0=stageOf(tid,b.dataset.sgadd);const nn=n||("Group "+String.fromCharCode(65+(((_s0&&_s0.groups)||[]).length)));await save(b.dataset.sgadd,grps=>{const has=new Set();grps.forEach(g=>{(g.teamIds||[]).forEach(x=>has.add(x));});grps.push({id:rid("g"),name:nn,teamIds:teams.filter(t=>!has.has(t.id)).map(t=>t.id)});});toast("Group added.");});
  host.querySelectorAll("[data-sgdel]").forEach(b=>b.onclick=async()=>{const parts=b.dataset.sgdel.split("|");if(!await appConfirm("Delete this group? Matches keep their data.","Delete"))return;await save(parts[0],grps=>{const i=grps.findIndex(g=>g.id===parts[1]);if(i>=0)grps.splice(i,1);});});
  host.querySelectorAll("[data-steamid]").forEach(c=>c.onchange=async()=>{const sid2=c.dataset.steamid,gid=c.dataset.grpid,tm=c.value;await save(sid2,grps=>{grps.forEach(g=>{let a=(g.teamIds||[]).filter(x=>x!==tm);if(g.id===gid&&c.checked)a.push(tm);g.teamIds=a;});});});
}
function sqAdminRender(msg="",cls="ok"){
  if(!isAdmin()){setView("home");return;}
  const cur=(SqS.tour===undefined||SqS.tour===null)?"default":SqS.tour;
  sqRoot().innerHTML=`<div class="wrap"><div class="th"><div><div class="tn gold">Admin Panel</div><div class="ts">Teams · Tournaments · Locks</div></div></div>
  <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap"><button class="btn sec auto" id="a-users">👥 Scorers</button><button class="btn sec auto" id="a-eds">✏️ Squad Editors</button><button class="btn sec auto" id="a-musers">👤 Users</button></div>
  <div class="panel"><div class="ph">🏆 Create Tournament</div><div class="row" style="border:none"><input type="text" id="tn" placeholder="Tournament name" style="flex:2;min-width:160px"><input type="text" id="tn-s" placeholder="Season" style="flex:1;min-width:90px"><input type="text" id="tn-y" placeholder="Year" style="flex:1;min-width:70px"><button class="btn sm auto" id="ct">Create</button></div></div>
  <div class="panel"><div class="ph">🏆 Tournaments (${Tours.length})</div>
  ${Tours.map(t=>{const tc=SqTeams.filter(x=>x.tid===t.id).length,mc=ScMatches.filter(x=>x.tid===t.id).length;const st=tourStatus(t.id);return`<div class="row"><b>${st==="archived"?"🗄️":"🏆"} ${esc(t.name)} <small style="opacity:.65">· ${esc(tourSeasonYear(t.id))}${t.city?` · ${esc(t.city)}`:""} · ${tc} teams · ${mc} matches · ${st}</small></b><button class="btn sm auto" data-tedit="${esc(t.id)}">Edit</button><button class="btn sm sec auto" data-tarch="${esc(t.id)}">${st==="archived"?"Unarchive":"Archive"}</button><button class="btn sm sec auto" data-tdel="${esc(t.id)}" style="color:#ff7b7b;border-color:#ff7b7b66">Delete</button></div>`;}).join("")}
  </div>
  <div class="panel"><div class="ph">➕ Add Team</div><div class="row"><select id="nto" style="width:200px">${Tours.map(t=>`<option value="${esc(t.id)}" ${t.id===cur?"selected":""}>${esc(t.name)}</option>`).join("")}<option value="" ${cur===""?"selected":""}>⭐ Friendly (no tournament)</option></select><input type="text" id="nt" placeholder="Team name"><input type="password" id="np" placeholder="Legacy password (optional)"><button class="btn sm auto" id="add">Add Team</button><button class="btn sm auto" id="find">Find Team</button></div><div class="hint">Squad editors are assigned under ✏️ Squad Editors. Scorers under 👥 Scorers. Password is legacy fallback only.</div></div>
  <div class="panel"><div class="ph">Teams (${SqTeams.filter(t=>t.tid===cur).length})</div>
  ${SqTeams.map((t,i)=>t.tid!==cur?"":`<div class="row"><b>${t.locked?"🔒":"🔓"} ${esc(t.name)}${SqTeams.filter(x=>x.tid===cur&&x.id!==t.id&&normName(x.name)===normName(t.name)).length?` <small style="color:#ff7b7b">(DUPLICATE?)</small>`:""}</b><button class="btn sm auto" data-act="lock" data-i="${i}">${t.locked?"Unlock":"Lock"}</button><button class="btn sm auto" data-act="view" data-i="${i}">View</button>${cur?`<button class="btn sm auto" data-act="rmv" data-i="${i}">Remove</button>`:""}<button class="btn sm auto" data-act="page" data-i="${i}">Team Page</button></div>`).join("")}
  <div class="row" style="border:none"><button class="btn sm auto" id="lall">🔒 Lock All</button><button class="btn sm auto" id="uall">🔓 Unlock All</button></div></div>
  <div class="bar"><div class="msg ${cls}" id="am" style="margin:0">${esc(msg)}</div></div></div>`;
  const flash=(t,c)=>{$("#am").className="msg "+c;$("#am").textContent=t;};
  setBack(()=>setView("home"));
  const run=async(fn,ok)=>{try{await fn();await sqLoadTeams();sqAdminRender(ok,"ok");}catch(e){flash(e.message||"Error","err");}};
  $("#a-users").onclick=()=>usersAdmin("squad");$("#a-eds").onclick=()=>squadEditors();$("#a-musers").onclick=()=>usersPanel();
  $("#nto").onchange=()=>{SqS.tour=$("#nto").value;sqAdminRender();};
  if($("#find"))$("#find").onclick=()=>findTeamForTour($("#nto").value,()=>sqAdminRender());
  $("#ct").onclick=()=>{const n=$("#tn").value.trim(),s=$("#tn-s").value.trim(),y=$("#tn-y").value.trim(),id=n.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"t"+Date.now();if(!n||id==="default")return flash("Enter a valid tournament name.","err");if(Tours.some(t=>t.id===id))return flash("That tournament already exists.","err");run(()=>setDoc(doc(db,"tournaments",id),{name:n,season:s,year:y,tagline:"",city:"",desc:"",status:"active",defOvers:"",created:Date.now(),owner:myEmail()}),`Tournament "${n}" created.`);};
  sqRoot().querySelectorAll("[data-tedit]").forEach(b=>b.onclick=()=>sqTourEdit(b.dataset.tedit));
  sqRoot().querySelectorAll("[data-tarch]").forEach(b=>b.onclick=()=>{const t=tourMeta(b.dataset.tarch);run(()=>setDoc(doc(db,"tournaments",b.dataset.tarch),{status:tourStatus(b.dataset.tarch)==="archived"?"active":"archived"},{merge:true}),`"${t.name}" ${tourStatus(b.dataset.tarch)==="archived"?"unarchived":"archived"}.`);});
  sqRoot().querySelectorAll("[data-tdel]").forEach(b=>b.onclick=async()=>{const t=tourMeta(b.dataset.tdel);const tc=SqTeams.filter(x=>x.tid===t.id).length,mc=ScMatches.filter(x=>x.tid===t.id).length;if(t.id==="default")return flash("The default tournament can't be deleted — archive it instead.","err");if(!await appConfirm(`Delete tournament "${t.name}"?\n${tc} team(s), ${mc} match(es) will be left orphaned (not deleted). Consider Archive instead.`,"Delete"))return;run(async()=>{await deleteDoc(doc(db,"tournaments",t.id));try{const sn=await getDocs(collection(db,"tournaments",t.id,"stages"));await Promise.all(sn.docs.map(d=>deleteDoc(d.ref)));}catch{}},`"${t.name}" deleted.`);});
  const setAll=v=>run(async()=>{const b=writeBatch(db);SqTeams.forEach(t=>b.set(doc(db,"squads",t.id),{is_locked:v},{merge:true}));await b.commit();},v?"All squads LOCKED.":"All squads UNLOCKED.");
  $("#lall").onclick=()=>setAll(true);$("#uall").onclick=()=>setAll(false);
  $("#add").onclick=()=>{
    const n=cleanName($("#nt").value),p=$("#np").value;
    if(!n||n.includes("/"))return flash("Enter a valid team name (no slashes).","err");
    const tid=$("#nto").value,did=tid===""?"F__"+n:tid==="default"?n:tid+"__"+n;
    if(SqTeams.some(t=>t.id.toLowerCase()===did.toLowerCase()||(t.tid===tid&&normName(t.name)===normName(n))))return flash("That team already exists in this tournament.","err");
    run(async()=>setDoc(doc(db,"squads",did),{team_name:n,tournament:tid,pw_hash:p?await sha(p):TEAM_HASH,is_locked:false,player_list:Array(17).fill(""),squad_pics:{},captain_name:"",cap_pic:null,team_logo:null,teamCode:mintTeamCode()}),`Team "${n}" added. Assign editors in Manage Users.`);
  };
  sqRoot().querySelectorAll("[data-act]").forEach(b=>b.onclick=async()=>{
    const t=SqTeams[+b.dataset.i],a=b.dataset.act;
    if(a==="lock")run(()=>setDoc(doc(db,"squads",t.id),{is_locked:!t.locked},{merge:true}),`${t.name} ${t.locked?"unlocked":"locked"}.`);
    else if(a==="view")sqOpen(t.id,true);
    else if(a==="page"){ScS.profBack=()=>sqAdminRender();teamProfileView(t.id);return;}
    else if(a==="rmv"){if(await appConfirm(`Remove "${t.name}" from this tournament? The squad stays intact under Friendly teams.`,"Remove"))run(async()=>{await setDoc(doc(db,"squads",t.id),{tournament:""},{merge:true});await stripTeamFromStages(cur,t.id);},`${t.name} removed from tournament.`);return;}
    else return;
  });
}

// ================= MANAGE SCORERS (tournament -> score-only users) =================
// Scorers can ONLY score matches in their tournament. No create/delete/schedule.
// Owners manage their own tournaments via usersAdmin("mine", tid).
async function usersAdmin(from,forceTid){
  const host=(from==="squad"||from==="mine")?sqRoot():$("#scorer-app");
  if(from!=="squad"&&from!=="mine"){CurView="scorer";document.body.dataset.view="scorer";$("#home-app").hidden=true;$("#squad-app").hidden=true;$("#scorer-app").hidden=false;const sc=$("#css-scorer");if(sc)sc.disabled=false;const sq=$("#css-squad");if(sq)sq.disabled=true;}
  if(from==="mine"){
    if(!forceTid||!canManageTour(forceTid)){toast("Not allowed.");return myTours();}
    CurView="squad";document.body.dataset.view="squad";$("#home-app").hidden=true;$("#squad-app").hidden=false;$("#scorer-app").hidden=true;
    const sq2=$("#css-squad");if(sq2)sq2.disabled=false;const sc2=$("#css-scorer");if(sc2)sc2.disabled=true;document.body.classList.remove("sq");
  }
  host.innerHTML=`<div class="${from==="scorer"?"w":"wrap"}"><div class="msg">Loading scorers…</div></div>`;
  let users=[];
  const isMine=from==="mine";
  if(!isMine){
    try{users=(await getDocs(collection(db,"scorers"))).docs.map(d=>({id:d.id,...d.data()}));}catch(e){host.innerHTML=`<div class="${from==="scorer"?"w":"wrap"}"><div class="msg">Couldn't load scorers — sign in as admin, or ask for access (Firestore rules may block this).</div></div>`;setBack(()=>setView("home"));return;}
  }
  await loadTours();
  let selT=forceTid||ScS.tour||Tours[0]?.id||"default";
  if(!Tours.some(t=>t.id===selT))selT=Tours[0]?.id||"default";
  let fq="";
  const inTour=u=>(u.tids||[]).includes(selT);
  const render=(fmsg="",isOk=false)=>{
    const SQ=from!=="scorer";
    {const a=$("#css-squad"),b=$("#css-scorer");if(SQ){if(a)a.disabled=false;if(b)b.disabled=true;}else{if(a)a.disabled=true;if(b)b.disabled=false;}}
    const srcList=isMine?tourScorers(selT).map(em=>({id:em})):users.filter(inTour);
    const list=srcList.filter(u=>!fq||u.id.includes(fq));
    host.innerHTML=`<div class="${from==="scorer"?"w":"wrap"}">
    <div class="th"><div><div class="tn gold">Scorers</div></div></div>
    <div class="ts" style="margin-bottom:8px">Score-only access - scorers can score matches, nothing else.</div>
    ${forceTid?`<div class="lock">🏆 ${esc(tname(selT))} (your tournament)</div>`:`<label class="l">Tournament</label><select id="us-t">${Tours.map(t=>`<option value="${esc(t.id)}" ${t.id===selT?"selected":""}>${esc(t.name)}</option>`).join("")}</select>`}
    ${SQ?`<div class="panel" style="margin-top:10px"><div class="ush">Add scorer</div>`:`<div class="xm" style="margin-top:10px"><h3>Add scorer</h3>`}
      <label class="l">Email</label><input id="ue" type="text" autocomplete="off" placeholder="scorer@email.com">
      <label class="l">Temp password <span class="mut">(min 6 — blank if they already have an account)</span></label><input id="up" type="password" autocomplete="new-password" placeholder="Set once, they can reset later">
      <button class="btn" id="ua">Add Scorer</button>
      <div class="hint">They sign in on Home → can only open &amp; score ${esc(tname(selT))} matches. No scheduling, no delete, no tournaments/teams.</div>
    </div>
    <label class="l" style="margin-top:10px">Scorers in ${esc(tname(selT))} (${srcList.length})</label>
    <input id="uq" type="text" placeholder="🔍 Filter by email…" value="${esc(fq)}">
    ${list.map(u=>`<div class="row"><b>${esc(u.id)}</b><span style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn sm auto" data-rs="${esc(u.id)}">Send reset email</button><button class="btn sm sec auto" data-rm="${esc(u.id)}">Remove</button></div></div>`).join("")||`<div class="mut c" style="margin:14px 0">No scorers in this tournament yet.</div>`}
    <div id="msg" class="msg" style="color:${isOk?"#6be58c":""}">${esc(fmsg)}</div></div>`;
    if($("#us-t"))$("#us-t").onchange=e=>{selT=e.target.value;render();};
    $("#uq").oninput=e=>{fq=e.target.value.toLowerCase();const pos=e.target.selectionStart;render();const q=$("#uq");if(q){q.focus();q.setSelectionRange(pos,pos);}};
    setBack(()=>{if(from==="mine")myTours();else if(from==="squad")sqAdmin();else if(from==="home")setView("home");else scList();});
    $("#ua").onclick=async()=>{
      const em=$("#ue").value.trim().toLowerCase(),pw=$("#up").value;
      const flash=(t,ok)=>{const m=$("#msg");m.textContent=t;m.style.color=ok?"#6be58c":"";};
      if(!em.includes("@"))return flash("Enter a valid email.");
      if(pw&&pw.length<6)return flash("Password must be at least 6 characters.");
      $("#ua").disabled=true;
      try{
        if(pw){
          try{const a2=getAuth(getApps().find(a=>a.name==="sec")||initializeApp(cfg,"sec"));await createUserWithEmailAndPassword(a2,em,pw);await signOut(a2);}
          catch(e){if(e.code!=="auth/email-already-in-use")throw e;}
        }
        // ADD-ONLY: admin writes the scorer doc; owners write the tournament array
        if(isMine){
          await setDoc(doc(db,"tournaments",selT),{scorerEmails:arrayUnion(em)},{merge:true});
          await loadTours();
          render(`Scorer ${em} added to ${tname(selT)}.`,true);
        }else{
          await setDoc(doc(db,"scorers",em),{email:em,tids:arrayUnion(selT)},{merge:true});
          users=(await getDocs(collection(db,"scorers"))).docs.map(d=>({id:d.id,...d.data()}));
          render(pw?`Scorer ${em} added to ${tname(selT)}.`:`${em} added to ${tname(selT)} (existing account kept).`,true);
        }
      }catch(e){$("#ua").disabled=false;flash(e.message);}
    };
    host.querySelectorAll("[data-rm]").forEach(b=>b.onclick=async()=>{
      const id=b.dataset.rm;
      if(!await appConfirm(`Remove ${id} from ${tname(selT)}? They lose scoring access here.`,"Remove"))return;
      // REMOVE-ONLY from this tournament; keep everything else intact
      if(isMine){
        updateDoc(doc(db,"tournaments",selT),{scorerEmails:arrayRemove(id)}).then(async()=>{
          await loadTours();
          render("Removed.",true);
        }).catch(e=>{const m=$("#msg");m.textContent=e.message;});
      }else{
        updateDoc(doc(db,"scorers",id),{tids:arrayRemove(selT)}).then(async()=>{
          users=(await getDocs(collection(db,"scorers"))).docs.map(d=>({id:d.id,...d.data()}));
          render("Removed.",true);
        }).catch(e=>{const m=$("#msg");m.textContent=e.message;});
      }
    });
    host.querySelectorAll("[data-rs]").forEach(b=>b.onclick=async()=>{try{await sendPasswordResetEmail(auth,b.dataset.rs);const m=$("#msg");m.textContent="Reset email sent.";m.style.color="#6be58c";}catch(e){const m=$("#msg");m.textContent=e.message;}});
  };
  render();
}

// ================= SQUAD EDITORS (team -> can-edit users, separate from scorers) =================
// Owners manage their own tournament via squadEditors(tid, "mine").
async function squadEditors(forceTid,from){
  {const a=$("#css-squad"),b=$("#css-scorer");if(a)a.disabled=false;if(b)b.disabled=true;}
  if(forceTid&&!canManageTour(forceTid)){toast("Not allowed.");return myTours();}
  const host=sqRoot();
  host.innerHTML=`<div class="wrap"><div class="msg">Loading editors…</div></div>`;
  let users=[];
  const isMineEd=from==="mine";
  if(!isMineEd){
    try{users=(await getDocs(collection(db,"scorers"))).docs.map(d=>({id:d.id,...d.data()}));}catch(e){host.innerHTML=`<div class="wrap"><div class="msg">Couldn't load editors — sign in as admin, or ask for access (Firestore rules may block this).</div></div>`;setBack(()=>from==="mine"?myTours():sqAdmin());return;}
  }
  await sqLoadTeams();await loadTours();
  let selTour=forceTid||((SqS.tour===undefined||SqS.tour===null)?"default":SqS.tour),selTeam="";
  const teamsIn=()=>SqTeams.filter(t=>t.tid===selTour);
  if(!teamsIn().some(t=>t.id===selTeam))selTeam=teamsIn()[0]?.id||"";
  const render=(fmsg="",isOk=false)=>{
    const eds=(isMineEd?teamEditors(selTeam).map(em=>({id:em})):users.filter(u=>(u.teamIds||[]).includes(selTeam)));
    const selT=SqTeams.find(t=>t.id===selTeam);
    host.innerHTML=`<div class="wrap">
    <div class="th"><div><div class="tn gold">Squad Editors</div><div class="ts">Team · Can edit squad only</div></div></div>
    <div class="panel"><label class="l">Tournament</label>${forceTid?`<div class="lock">🏆 ${esc(tname(selTour))} (your tournament)</div>`:`<select id="et">${Tours.map(t=>`<option value="${esc(t.id)}" ${t.id===selTour?"selected":""}>${esc(t.name)}</option>`).join("")}<option value="" ${selTour===""?"selected":""}>⭐ Friendly (no tournament)</option></select>`}
    <label class="l">Team</label><select id="em-t">${teamsIn().map(t=>`<option value="${esc(t.id)}" ${t.id===selTeam?"selected":""}>${t.locked?"🔒 ":""}${esc(t.name)}</option>`).join("")||`<option value="">No teams</option>`}</select>
    ${selTeam?`<div class="row" style="border:none"><b>${selT&&selT.locked?"🔒 Locked — editors and admins can't update this squad until unlocked.":"🔓 Unlocked — assigned editors can update."}</b><button class="btn sm auto" id="e-lock">${selT&&selT.locked?"Unlock Team":"Lock Team"}</button>${selT&&selT.tid?`<button class="btn sm auto" id="e-rmv">Remove from Tournament</button>`:""}<button class="btn sm auto" id="e-page">Team Page</button></div>`:""}</div>
    <div class="panel"><div class="ush">Add editor to ${esc(selTeam||"—")}</div>
      <div class="row"><input type="text" id="ee" placeholder="user@email.com" style="flex:1;min-width:180px"><input type="password" id="ep" placeholder="Temp password (blank if exists)" style="flex:1;min-width:180px"><button class="btn sm auto" id="ea">Add Editor</button></div>
      <div class="hint">Editors can edit this squad only. No scoring unless also added as scorer.</div></div>
    <div class="panel"><div class="ush">Editors (${eds.length})</div>
    ${eds.map(u=>`<div class="row"><b>${esc(u.id)}</b><button class="btn sm auto" data-ers="${esc(u.id)}">Send reset</button><button class="btn sm sec auto" data-erm="${esc(u.id)}">Remove</button></div>`).join("")||`<div class="mut c">No editors yet.</div>`}
    </div><div class="msg ${isOk?"ok":"err"}">${esc(fmsg)}</div></div>`;
    setBack(()=>from==="mine"?myTours():sqAdmin());
    if($("#et"))$("#et").onchange=e=>{selTour=e.target.value;SqS.tour=selTour;selTeam=teamsIn()[0]?.id||"";render();};
    $("#em-t").onchange=e=>{selTeam=e.target.value;render();};
    if($("#e-rmv"))$("#e-rmv").onclick=async()=>{const nm=(SqTeams.find(x=>x.id===selTeam)||{}).name||"Team";if(await appConfirm(`Remove "${nm}" from this tournament? The squad stays intact.`,"Remove")){await setDoc(doc(db,"squads",selTeam),{tournament:""},{merge:true});await stripTeamFromStages(selTour,selTeam);await sqLoadTeams();render("Team removed from tournament.",true);}};
    if($("#e-page"))$("#e-page").onclick=()=>{ScS.profBack=()=>squadEditors(selTour,from);teamProfileView(selTeam);};
    if($("#e-lock"))$("#e-lock").onclick=async()=>{const t=SqTeams.find(x=>x.id===selTeam);if(!t)return;await setDoc(doc(db,"squads",selTeam),{is_locked:!t.locked},{merge:true});await sqLoadTeams();render(!t.locked?"Team locked — nobody can update this squad until unlocked.":"Team unlocked — editors can update again.",true);};
    $("#ea").onclick=async()=>{
      const em=$("#ee").value.trim().toLowerCase(),pw=$("#ep").value;
      const f=t=>{const m=host.querySelector(".msg");m.textContent=t;};
      if(!selTeam)return f("Pick a team first.");
      if(!em.includes("@"))return f("Enter a valid email.");
      if(pw&&pw.length<6)return f("Password min 6.");
      try{
        if(pw){try{const a2=getAuth(getApps().find(a=>a.name==="sec")||initializeApp(cfg,"sec"));await createUserWithEmailAndPassword(a2,em,pw);await signOut(a2);}catch(e){if(e.code!=="auth/email-already-in-use")throw e;}}
        if(isMineEd){
          await setDoc(doc(db,"squads",selTeam),{editorEmails:arrayUnion(em)},{merge:true});
          await sqLoadTeams();
          render(`Editor ${em} added.`,true);
        }else{
          await setDoc(doc(db,"scorers",em),{email:em,teamIds:arrayUnion(selTeam)},{merge:true});
          users=(await getDocs(collection(db,"scorers"))).docs.map(d=>({id:d.id,...d.data()}));
          render(`Editor ${em} added.`,true);
        }
      }catch(e){f(e.message);}
    };
    host.querySelectorAll("[data-erm]").forEach(b=>b.onclick=async()=>{if(!await appConfirm(`Remove ${b.dataset.erm} from ${selTeam}?`,"Remove"))return;if(isMineEd){updateDoc(doc(db,"squads",selTeam),{editorEmails:arrayRemove(b.dataset.erm)}).then(async()=>{await sqLoadTeams();render("Removed.",true);});}else{updateDoc(doc(db,"scorers",b.dataset.erm),{teamIds:arrayRemove(selTeam)}).then(async()=>{users=(await getDocs(collection(db,"scorers"))).docs.map(d=>({id:d.id,...d.data()}));render("Removed.",true);});}});
    host.querySelectorAll("[data-ers]").forEach(b=>b.onclick=async()=>{try{await sendPasswordResetEmail(auth,b.dataset.ers);toast("Reset email sent.");}catch(e){toast(e.message);}});
  };
  render();
}

// Admin: all users + key data (view/edit assignments, reset, remove)
async function usersPanel(){
  if(!Auth.admin){setView("home");return;}
  CurView="squad";document.body.dataset.view="squad";
  $("#home-app").hidden=true;$("#squad-app").hidden=false;$("#scorer-app").hidden=true;
  const sq=$("#css-squad");if(sq)sq.disabled=false;const sc=$("#css-scorer");if(sc)sc.disabled=true;document.body.classList.remove("sq");
  sqRoot().innerHTML=`<div class="wrap"><div class="msg">Loading users…</div></div>`;
  let users=[];
  try{users=(await getDocs(collection(db,"scorers"))).docs.map(d=>({id:d.id,...d.data()}));}catch(e){sqRoot().innerHTML=`<div class="wrap"><div class="msg">Couldn't load users.</div></div>`;return;}
  await sqLoadTeams();await loadTours();
  const liveN=ScMatches.filter(m=>m.status==="live").length;
  let fq="",openEdit=null;
  const tnameOf=id=>(Tours.find(t=>t.id===id)||{}).name||id;
  const render=(fmsg="",isOk=false)=>{
    const list=users.filter(u=>!fq||u.id.includes(fq)).sort((a,b)=>a.id.localeCompare(b.id));
    sqRoot().innerHTML=`<div class="wrap"><div class="th"><div><div class="tn gold">Users</div><div class="ts">${users.length} users · ${Tours.length} tournaments · ${SqTeams.length} teams · ${ScMatches.length} matches · ${liveN} live</div></div></div>
    <div class="panel"><label class="l">Filter by email</label><input type="text" id="uu-q" placeholder="🔍 email…" value="${esc(fq)}"></div>
    ${list.map(u=>{
      const owns=SqTeams.filter(t=>(t.owner||"")===u.id).length;
      const ed=openEdit===u.id?`<div class="panel" style="margin-top:8px"><div class="ph">Tournaments (score)</div><div style="max-height:130px;overflow-y:auto;border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:8px">${Tours.map(t=>`<label style="display:flex;gap:8px;align-items:center;padding:3px 0;font-size:14px"><input type="checkbox" data-ut="${esc(t.id)}" ${((u.tids||[]).includes(t.id))?"checked":""} style="width:16px;height:16px"> ${esc(t.name)}</label>`).join("")}</div>
      <div class="ph" style="margin-top:8px">Teams (edit squad)</div><div style="max-height:130px;overflow-y:auto;border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:8px">${SqTeams.map(t=>`<label style="display:flex;gap:8px;align-items:center;padding:3px 0;font-size:14px"><input type="checkbox" data-um="${esc(t.id)}" ${((u.teamIds||[]).includes(t.id))?"checked":""} style="width:16px;height:16px"> ${esc(t.name)}</label>`).join("")}</div>
      <div style="display:flex;gap:8px;margin-top:8px"><button class="btn sm auto" data-usv="${esc(u.id)}">Save</button><button class="btn sm sec auto" data-ucx="${esc(u.id)}">Cancel</button></div></div>`:"";
      return`<div class="card" style="cursor:default"><div class="row"><b>${esc(u.id)}</b></div><div class="mut" style="font-size:13px">Score: ${esc((u.tids||[]).map(tnameOf).join(", ")||"—")} · Edit: ${(u.teamIds||[]).length} team(s) · Owns: ${owns} team(s)</div><div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap"><button class="btn s sm" data-ued="${esc(u.id)}">Edit</button><button class="btn s sm" data-urs="${esc(u.id)}">Reset email</button><button class="btn s sm" data-urm="${esc(u.id)}">Remove</button></div>${ed}</div>`;}).join("")||`<div class="mut c">No users found.</div>`}
    <div class="bar"><div class="msg ${isOk?"ok":"err"}" id="uu-m" style="margin:0">${esc(fmsg)}</div></div></div>`;
    setBack(()=>sqAdmin());
    $("#uu-q").oninput=e=>{fq=e.target.value.toLowerCase();const pos=e.target.selectionStart;render();const q=$("#uu-q");if(q){q.focus();q.setSelectionRange(pos,pos);}};
    sqRoot().querySelectorAll("[data-ued]").forEach(b=>b.onclick=()=>{openEdit=b.dataset.ued;render();});
    sqRoot().querySelectorAll("[data-ucx]").forEach(b=>b.onclick=()=>{openEdit=null;render();});
    sqRoot().querySelectorAll("[data-usv]").forEach(b=>b.onclick=async()=>{
      const id=b.dataset.usv;
      const tids=[...sqRoot().querySelectorAll("[data-ut]")].filter(c=>c.checked).map(c=>c.dataset.ut);
      const teamIds=[...sqRoot().querySelectorAll("[data-um]")].filter(c=>c.checked).map(c=>c.dataset.um);
      try{await setDoc(doc(db,"scorers",id),{tids,teamIds},{merge:true});users=(await getDocs(collection(db,"scorers"))).docs.map(d=>({id:d.id,...d.data()}));openEdit=null;render("Saved.",true);}
      catch(e){const m=$("#uu-m");m.textContent=e.message;m.className="msg err";}
    });
    sqRoot().querySelectorAll("[data-urs]").forEach(b=>b.onclick=async()=>{try{await sendPasswordResetEmail(auth,b.dataset.urs);toast("Reset email sent.");}catch(e){toast(e.message);}});
    sqRoot().querySelectorAll("[data-urm]").forEach(b=>b.onclick=async()=>{if(!await appConfirm(`Remove ${b.dataset.urm}? Their login still exists — only app access is removed.`,"Remove"))return;try{await deleteDoc(doc(db,"scorers",b.dataset.urm));users=(await getDocs(collection(db,"scorers"))).docs.map(d=>({id:d.id,...d.data()}));render("Removed.",true);}catch(e){toast(e.message);}});
  };
  render();
}

// Tournament owners manage their own tournaments (scorers, teams, locks, matches, details)
async function findTeamForTour(tid,done){
  await sqLoadTeams();await loadTours();
  const t=tourMeta(tid);
  const ov=document.createElement("div");ov.className="app-modal-ov";
  ov.innerHTML=`<div class="app-modal" style="max-width:440px"><div class="app-modal-t">Add Team to ${esc(t.name||tid)}</div>
    <label class="app-modal-l">Paste team link or code</label><div style="display:flex;gap:8px"><input id="ft-c" type="text" placeholder="Team link or code" style="flex:1"><button class="hm-btn sec" style="width:auto" id="ft-go">Add</button></div>
    <div class="hint" style="margin-top:8px">Ask the team to share it (Team page → Team Code), or scan their QR below.</div>
    <button class="hm-btn sec" id="ft-scan" style="margin-top:8px">Scan QR Code</button>
    <div class="app-modal-btns"><button class="hm-btn sec" data-x="0">Close</button></div></div>`;
  sqRoot().appendChild(ov);
  const close=()=>ov.remove();
  ov.querySelector('[data-x="0"]').onclick=close;
  ov.addEventListener("mousedown",e=>{if(e.target===ov)close();});
  const useCode=async txt=>{
    const r=parseInvite(txt);
    if(!r||r.kind!=="team"){toast("That isn't a team link or code.");return;}
    await moveTeamToTour(r.id,tid);await sqLoadTeams();if(done)done();
  };
  ov.querySelector("#ft-go").onclick=()=>useCode(ov.querySelector("#ft-c").value);
  ov.querySelector("#ft-scan").onclick=async()=>{const txt=await scanQRCode();if(txt)useCode(txt);};
}
async function myTours(){
  if(needAccount()){setView("home");return;}
  CurView="squad";document.body.dataset.view="squad";
  $("#home-app").hidden=true;$("#squad-app").hidden=false;$("#scorer-app").hidden=true;
  const sq=$("#css-squad");if(sq)sq.disabled=false;const sc=$("#css-scorer");if(sc)sc.disabled=true;
  document.body.classList.remove("sq");
  setBack(()=>setView("home"));
  sqRoot().innerHTML=`<div class="wrap"><div class="msg">Loading your tournaments…</div></div>`;
  await sqLoadTeams();await loadTours();
  const mine=Tours.filter(t=>t.id!=="default"&&tourOwner(t.id)===myEmail());
  if(!mine.length){sqRoot().innerHTML=`<div class="wrap"><div class="th"><div><div class="tn gold">My Tournaments</div><div class="ts">Manage what you created</div></div></div><div class="msg">You don't own any tournament yet.</div><button class="btn" id="mt-ct">🏆 Create Tournament</button></div>`;$("#mt-ct").onclick=()=>sqUserCreateTournament();return;}
  sqRoot().innerHTML=`<div class="wrap"><div class="th"><div><div class="tn gold">My Tournaments</div><div class="ts">Manage what you created</div></div></div>
  ${mine.map(t=>{const tc=SqTeams.filter(x=>x.tid===t.id).length,mc=ScMatches.filter(x=>x.tid===t.id).length;return`<div class="panel"><div class="ph">🏆 ${esc(t.name)} <small style="opacity:.65">· ${esc(tourSeasonYear(t.id))} · ${tc} teams · ${mc} matches</small></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm auto" data-msc="${esc(t.id)}">👥 Scorers</button><button class="btn sm auto" data-mtm="${esc(t.id)}">👥 Teams &amp; Locks</button><button class="btn sm auto" data-mat="${esc(t.id)}">➕ Add Team</button><button class="btn sm auto" data-mjl="${esc(t.id)}">🔗 Join Link</button><button class="btn sm auto" data-mft="${esc(t.id)}">Find Team</button><button class="btn sm auto" data-mma="${esc(t.id)}">🏏 Matches</button><button class="btn sm sec auto" data-med="${esc(t.id)}">✎ Edit</button><button class="btn sm sec auto" data-mtdel="${esc(t.id)}" style="color:#ff7b7b;border-color:#ff7b7b66">Delete</button></div></div>`;}).join("")}
  </div>`;
  sqRoot().querySelectorAll("[data-msc]").forEach(b=>b.onclick=()=>usersAdmin("mine",b.dataset.msc));
  sqRoot().querySelectorAll("[data-mtm]").forEach(b=>b.onclick=()=>squadEditors(b.dataset.mtm,"mine"));
  sqRoot().querySelectorAll("[data-mat]").forEach(b=>b.onclick=()=>sqUserAddTeam(b.dataset.mat));
  sqRoot().querySelectorAll("[data-mjl]").forEach(b=>b.onclick=()=>joinLinkView(b.dataset.mjl));
  sqRoot().querySelectorAll("[data-mft]").forEach(b=>b.onclick=()=>findTeamForTour(b.dataset.mft,()=>myTours()));
  sqRoot().querySelectorAll("[data-mma]").forEach(b=>b.onclick=()=>{ScS.tour=b.dataset.mma;ScS.tab="m";setView("scorer");});
  sqRoot().querySelectorAll("[data-med]").forEach(b=>b.onclick=()=>sqTourEdit(b.dataset.med));
  sqRoot().querySelectorAll("[data-mtdel]").forEach(b=>b.onclick=async()=>{const t=tourMeta(b.dataset.mtdel);const tc=SqTeams.filter(x=>x.tid===t.id).length,mc=ScMatches.filter(x=>x.tid===t.id).length;if(t.id==="default")return toast("The default tournament can't be deleted.");if(!canManageTour(t.id))return toast("Not allowed.");if(!await appConfirm(`Delete tournament "${t.name}"?\n${tc} team(s), ${mc} match(es) will be left orphaned (not deleted).`,"Delete"))return;try{await deleteDoc(doc(db,"tournaments",t.id));try{const sn=await getDocs(collection(db,"tournaments",t.id,"stages"));await Promise.all(sn.docs.map(d=>deleteDoc(d.ref)));}catch{}toast(`"${t.name}" deleted.`);}catch(e){toast(e.message||"Couldn't delete.");}myTours();});
}

function joinLinkFor(tid){return basePage()+"?join="+encodeURIComponent(tid);}
// Owner shares this: anyone signed in can add their own team to the tournament.
async function joinLinkView(tid){
  CurView="squad";document.body.dataset.view="squad";
  $("#home-app").hidden=true;$("#squad-app").hidden=false;$("#scorer-app").hidden=true;
  const sq=$("#css-squad");if(sq)sq.disabled=false;const sc=$("#css-scorer");if(sc)sc.disabled=true;document.body.classList.remove("sq");
  await sqLoadTeams();await loadTours();
  const t=tourMeta(tid);
  if(!t||!t.id||t.id==="default"){toast("Invalid tournament.");return myTours();}
  const link=joinLinkFor(tid);
  const tc=SqTeams.filter(x=>x.tid===tid).length;
  sqRoot().innerHTML=`<div class="wrap"><div class="th"><div><div class="tn gold">Join Link</div><div class="ts">${esc(t.name)} · ${tc} team${tc===1?"":"s"} joined</div></div></div>
  <div class="panel"><div class="ph">Share this with teams</div>
    <div class="mut" style="word-break:break-all;font-size:13px;margin-bottom:8px">${esc(link)}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px"><button class="btn sm auto" id="jl-sh">📤 Share Invite</button></div>
    <div id="join-qr" style="display:flex;justify-content:center;padding:8px;background:#fff;border-radius:12px;max-width:232px;margin:0 auto"></div>
    <div class="hint" style="margin-top:10px;text-align:center">Anyone signed in can scan or open the link to add their own team. No approval needed.</div></div></div>`;
  setBack(()=>myTours());
  $("#jl-sh").onclick=()=>appShare({title:"Invite teams",sub:`${t.name} · ${tc} team${tc===1?"":"s"} joined`,link,waText:`🏏 Join "${t.name}" on SmartCric — add your team here:\n${link}`});
  try{
    if(window.QRCode){new QRCode($("#join-qr"),{text:link,width:200,height:200,correctLevel:QRCode.CorrectLevel.M});}
    else{$("#join-qr").innerHTML=`<div class="mut c">QR unavailable offline — share the link above.</div>`;}
  }catch{$("#join-qr").innerHTML=`<div class="mut c">QR unavailable — share the link above.</div>`;}
}
// Self-join: signed-in user adds their own team via shared link (?join=tid).
async function joinTeamView(tid){
  CurView="squad";document.body.dataset.view="squad";
  $("#home-app").hidden=true;$("#squad-app").hidden=false;$("#scorer-app").hidden=true;
  const sq=$("#css-squad");if(sq)sq.disabled=false;const sc=$("#css-scorer");if(sc)sc.disabled=true;document.body.classList.remove("sq");
  setBack(()=>setView("home"));
  if(!Auth.user){sqRoot().innerHTML=`<div class="wrap"><div class="login"><div class="lt">Join Tournament</div><div class="msg err">Please sign in (or create an account) first — then you'll continue automatically.</div><button class="btn" id="jt-si">Go to Sign In</button></div></div>`;$("#jt-si").onclick=()=>setView("home");return;}
  sqRoot().innerHTML=`<div class="wrap"><div class="msg">Loading tournament…</div></div>`;
  await loadTours();await sqLoadTeams();
  if(tid!=="default"){
    let snap=null;try{snap=await getDoc(doc(db,"tournaments",tid));}catch(e){snap=null;}
    if(!snap||!snap.exists()){sqRoot().innerHTML=`<div class="wrap"><div class="login"><div class="lt">Join Tournament</div><div class="msg err">This invite link is invalid or expired.</div><button class="btn sec" id="jt-h">🏠 Home</button></div></div>`;$("#jt-h").onclick=()=>setView("home");return;}
    if((snap.data().status||"active")==="archived"){sqRoot().innerHTML=`<div class="wrap"><div class="login"><div class="lt">${esc(snap.data().name||"Tournament")}</div><div class="msg err">Joining is closed for this tournament.</div><button class="btn sec" id="jt-h">🏠 Home</button></div></div>`;$("#jt-h").onclick=()=>setView("home");return;}
  }
  const t=tourMeta(tid);
  const mine=SqTeams.filter(x=>canEditSquad(x.id)&&x.tid!==tid);
  sqRoot().innerHTML=`<div class="wrap"><div class="hdr"><div class="s">YOU'RE INVITED</div><div class="n gold">${esc(t.name||tid)}</div><div class="t">${esc(tourSeasonYear(tid))}</div><div class="line"></div></div>
  ${mine.length?`<div class="login"><div class="lt">Your Teams — Tap to Join</div>${mine.map(x=>`<div class="row"><b>${esc(x.name)}</b><button class="btn sm auto" data-join-team="${esc(x.id)}">Join</button></div>`).join("")}<div class="hint">Or create a brand-new team below.</div></div>`:""}
  <div class="login"><div class="lt">➕ Add Your Team</div>
    <label class="l">Team name</label><input type="text" id="jt-n" placeholder="e.g. Falcons XI" autocomplete="off">
    <button class="btn" id="jt-go">Join Tournament</button>
    <div class="msg err" id="jt-m"></div></div></div>`;
  sqRoot().querySelectorAll("[data-join-team]").forEach(b=>b.onclick=()=>joinWithTeam(b.dataset.joinTeam,tid));
  $("#jt-go").onclick=async()=>{
    if(needAccount())return;
    const tn=cleanName($("#jt-n").value);
    if(!tn){$("#jt-m").textContent="Enter a team name.";return;}
    const did=tid==="default"?tn:tid+"__"+tn;
    if(SqTeams.some(x=>x.id.toLowerCase()===did.toLowerCase()||(x.tid===tid&&normName(x.name)===normName(tn)))){$("#jt-m").textContent="That team name is taken in this tournament.";return;}
    try{
      await setDoc(doc(db,"squads",did),{team_name:tn,tournament:tid,pw_hash:TEAM_HASH,is_locked:false,player_list:Array(17).fill(""),squad_pics:{},captain_name:"",cap_pic:null,team_logo:null,teamCode:mintTeamCode(),owner:myEmail(),created:Date.now()});
      ScSquadsCache=null;await sqLoadTeams();toast(`"${tn}" joined ${tname(tid)}!`);
      sqRoot().innerHTML=`<div class="wrap"><div class="login"><div class="lt">✅ You're In!</div><div class="msg ok">"${esc(tn)}" joined ${esc(tname(tid))}.</div><button class="btn" id="jt-open">Open My Squad</button><button class="btn sec" id="jt-h2">🏠 Home</button></div></div>`;
      $("#jt-open").onclick=()=>sqOpen(did,false);
      $("#jt-h2").onclick=()=>setView("home");
    }catch(e){$("#jt-m").textContent=e.message||"Couldn't join.";}
  };
}

// Camera QR scanner (resolves scanned text, or null). Needs HTTPS/localhost for camera.
function camErr(e){
  const n=(e&&e.name)||"";
  if(n==="NotAllowedError"||n==="SecurityError")return "Camera blocked - allow camera access in the browser site settings, then retry. Or type the code.";
  if(n==="NotFoundError"||n==="OverconstrainedError")return "No camera found on this device - type the code instead.";
  if(n==="NotReadableError")return "Camera is busy in another app - close it and retry, or type the code.";
  if(n==="TypeError")return "Camera needs a secure page (open the hosted HTTPS link) - type the code instead.";
  return "Camera unavailable ("+((e&&e.message)||"unknown error")+") - type the code instead.";
}
function scanQRCode(){
  return new Promise(res=>{
    if(window.isSecureContext===false){toast("Camera needs a secure page - open the hosted HTTPS link, or type the code.");return res(null);}
    if(!window.jsQR||!navigator.mediaDevices?.getUserMedia){
      toast("Camera scanning unavailable here — type the code instead.");return res(null);
    }
    const ov=document.createElement("div");ov.className="app-modal-ov";
    ov.innerHTML=`<div class="app-modal"><div class="app-modal-t">📷 Scan QR</div><video id="qr-v" playsinline muted style="width:100%;border-radius:10px;background:#000"></video><div class="app-modal-msg" id="qr-m">Point the camera at the QR code…</div><div class="app-modal-btns"><button class="hm-btn sec" data-x="0">Cancel</button></div></div>`;
    document.body.appendChild(ov);
    const video=ov.querySelector("#qr-v"),msg=ov.querySelector("#qr-m");
    let stop=false,stream=null,raf=0;
    const done=v=>{stop=true;cancelAnimationFrame(raf);if(stream)stream.getTracks().forEach(t=>t.stop());ov.remove();res(v);};
    ov.querySelector('[data-x="0"]').onclick=()=>done(null);
    ov.addEventListener("mousedown",e=>{if(e.target===ov)done(null);});
    const canvas=document.createElement("canvas"),g=canvas.getContext("2d",{willReadFrequently:true});
    const tick=()=>{
      if(stop)return;
      if(video.readyState===video.HAVE_ENOUGH_DATA){
        canvas.width=video.videoWidth;canvas.height=video.videoHeight;
        g.drawImage(video,0,0);
        try{
          const code=window.jsQR(g.getImageData(0,0,canvas.width,canvas.height).data,canvas.width,canvas.height);
          if(code&&code.data){done(code.data.trim());return;}
        }catch{}
      }
      raf=requestAnimationFrame(tick);
    };
    navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"}}).then(s=>{stream=s;video.srcObject=s;video.play().catch(()=>{});tick();}).catch((e)=>{msg.textContent=camErr(e);});
  });
}
function parseInvite(txt){
  txt=(txt||"").trim();if(!txt)return null;
  let m=txt.match(/[?&]join=([^&#]+)/);
  if(m)return{kind:"tour",id:decodeURIComponent(m[1])};
  m=txt.match(/[?&]team=([^&#]+)/);
  if(m)return{kind:"team",id:decodeURIComponent(m[1])};
  if(Tours.some(t=>t.id===txt))return{kind:"tour",id:txt};
  if(SqTeams.some(t=>t.id===txt))return{kind:"team",id:txt};
  const byCode=SqTeams.find(t=>(t.code||"")===txt.toUpperCase());
  if(byCode)return{kind:"team",id:byCode.id};
  return null;
}
// Join via pasted link/code or scanned QR (tournament invites + team codes).
async function joinByCodeView(){
  CurView="squad";document.body.dataset.view="squad";
  $("#home-app").hidden=true;$("#squad-app").hidden=false;$("#scorer-app").hidden=true;
  const sq=$("#css-squad");if(sq)sq.disabled=false;const sc=$("#css-scorer");if(sc)sc.disabled=true;document.body.classList.remove("sq");
  setBack(()=>setView("home"));
  sqRoot().innerHTML=`<div class="wrap"><div class="th"><div><div class="tn gold">Join</div><div class="ts">Tournament invite or team code</div></div></div>
  <div class="panel"><div class="ph">Paste link or code</div>
    <div class="row" style="border:none"><input type="text" id="jb-t" placeholder="Paste invite link or code" autocomplete="off" style="flex:1;min-width:180px"><button class="btn sm auto" id="jb-go">Join</button></div>
    <button class="btn sec" id="jb-scan">📷 Scan QR Code</button>
    <div class="hint">Tournament links add YOUR team · Team codes/links open that team (owners can pull it into their tournament).</div></div></div>`;
  const stash=(k,v)=>{try{localStorage.setItem(k,v);}catch{}};
  const needAuth=(k,v)=>{stash(k,v);setView("home");toast("Sign in (or create an account) first — then you'll continue automatically.");};
  const route=async txt=>{
    txt=(txt||"").trim();if(!txt)return;
    await loadTours();await sqLoadTeams();
    const r=parseInvite(txt);
    if(!r){toast("Code not recognised - check it and try again.");return;}
    if(r.kind==="tour"){if(!Auth.user||isAnon())return needAuth("scPendingJoin",r.id);joinTeamView(r.id);return;}
    if(!Auth.user||isAnon())return needAuth("scPendingTeam",r.id);teamProfileView(r.id);return;
  };
  $("#jb-go").onclick=()=>route($("#jb-t").value);
  $("#jb-scan").onclick=async()=>{const txt=await scanQRCode();if(txt)route(txt);};
}

function teamLinkFor(teamId){return basePage()+"?team="+encodeURIComponent(teamId);}
// Every team has its own link / QR / code — tournament owners use it to pull the team in.
async function teamLinkView(teamId){
  await sqLoadTeams();
  const t=SqTeams.find(x=>x.id===teamId);
  if(!t){toast("Team not found.");return;}
  let code=t.code||"";
  if(!code&&canEditSquad(teamId)){code=mintTeamCode();try{await setDoc(doc(db,"squads",teamId),{teamCode:code},{merge:true});await sqLoadTeams();}catch{code="";}}
  const link=teamLinkFor(teamId);
  sqRoot().innerHTML=`<div class="wrap"><div class="th"><div><div class="tn gold">🔗 Team Link</div><div class="ts">${esc(t.name)} · ${esc(tname(t.tid))}</div></div></div>
  <div class="panel"><div class="ph">Team code (share or type it)</div>
    <div class="mut" style="word-break:break-all;font-size:15px;font-weight:700;margin-bottom:8px">${esc(code||teamId)}</div>
    <button class="btn sm auto" id="tl-cp-code">📋 Copy Code</button></div>
  <div class="panel"><div class="ph">Link + QR</div>
    <div class="mut" style="word-break:break-all;font-size:13px;margin-bottom:8px">${esc(link)}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px"><button class="btn sm auto" id="tl-sh">📤 Share</button></div>
    <div id="team-qr" style="display:flex;justify-content:center;padding:8px;background:#fff;border-radius:12px;max-width:232px;margin:0 auto"></div>
    <div class="hint" style="margin-top:10px;text-align:center">Tournament owners: open this link (or enter the code in Join) to pull "${esc(t.name)}" into your tournament.</div></div></div>`;
  setBack(()=>sqOpen(teamId,SqS.viewOnly));
  $("#tl-cp-code").onclick=()=>navigator.clipboard.writeText(code||teamId).then(()=>toast("Team code copied."));
  $("#tl-sh").onclick=()=>appShare({title:"Share team link",sub:t.name,link,waText:`🏏 "${t.name}" on SmartCric — view the squad / pull it into your tournament:\n${link}`});
  try{
    if(window.QRCode){new QRCode($("#team-qr"),{text:link,width:200,height:200,correctLevel:QRCode.CorrectLevel.M});}
    else{$("#team-qr").innerHTML=`<div class="mut c">QR unavailable offline — share the link above.</div>`;}
  }catch{$("#team-qr").innerHTML=`<div class="mut c">QR unavailable — share the link above.</div>`;}
}
// Public team profile (?team=ID): view squad + owners can pull it into their tournament.
async function teamProfileView(teamId){
  CurView="squad";document.body.dataset.view="squad";
  $("#home-app").hidden=true;$("#squad-app").hidden=false;$("#scorer-app").hidden=true;
  const sq=$("#css-squad");if(sq)sq.disabled=false;const sc=$("#css-scorer");if(sc)sc.disabled=true;document.body.classList.remove("sq");
  await loadTours();await sqLoadTeams();
  const t=SqTeams.find(x=>x.id===teamId);
  if(!t){sqRoot().innerHTML=`<div class="wrap"><div class="login"><div class="lt">Team</div><div class="msg err">This team link is invalid or the team was removed.</div></div></div>`;setBack(()=>setView("home"));return;}
  const tab=ScS.profTab||"squad";
  sqRoot().innerHTML=`<div class="wrap"><div class="mc-head"><div class="mc-ttl">${esc(t.name)}</div><div class="mc-sub">${esc(tname(t.tid))} ${esc(tourSeasonYear(t.tid))}</div></div>
  <div class="tabs"><button class="btn s sm ${tab==="squad"?"on":""}" data-pt="squad" style="flex:1;padding:8px 4px">Squad</button><button class="btn s sm ${tab==="stats"?"on":""}" data-pt="stats" style="flex:1;padding:8px 4px">Stats</button><button class="btn s sm ${tab==="matches"?"on":""}" data-pt="matches" style="flex:1;padding:8px 4px">Matches</button><button class="btn s sm ${tab==="manage"?"on":""}" data-pt="manage" style="flex:1;padding:8px 4px">👑 Manage</button></div>
  <div id="prof-body"><div class="mut c">Loading...</div></div></div>`;
  try{window.scrollTo(0,0);}catch{}
  setBack(()=>{const f=ScS.profBack;ScS.profBack=null;if(f)f();else setView("home");});
  sqRoot().querySelectorAll("[data-pt]").forEach(b=>b.onclick=()=>{ScS.profTab=b.dataset.pt;sqRoot().querySelectorAll("[data-pt]").forEach(x=>x.classList.toggle("on",x.dataset.pt===ScS.profTab));try{window.scrollTo(0,0);}catch{}profTabRender(teamId);});
  profTabRender(teamId);
}
function teamOwnerOf(id){const t=SqTeams.find(x=>x.id===id);return((t&&t.owner)||"").toLowerCase();};
async function profManage(teamId){
  const host=$("#prof-manage");if(!host)return;
  const t=SqTeams.find(x=>x.id===teamId);if(!t){host.innerHTML="";return;}
  const em=myEmail(),mine=em!==""&&(t.owner||"")===em,admin=Auth.admin;
  const cos=(t.coOwners||[]).map(e=>String(e).toLowerCase());
  const coOf=em!==""&&cos.includes(em);
  const tourOwn=em!==""&&t.tid&&t.tid!=="default"&&tourOwner(t.tid)===em;
  const canDel=mine||admin||tourOwn,canManage=mine||admin||coOf;
  const eds=(t.editors||[]);
  const canSq=canEditSquad(teamId);
  let h=`<div style="display:flex;gap:8px;flex-wrap:wrap">`;
  if(canSq)h+=`<button class="btn sm auto" id="pm-sq">✏️ Manage Squad</button>`;
  if(canManage)h+=`<button class="btn s sm auto" id="pm-code">🔗 Team Code</button>`;
  if(canDel)h+=`<button class="btn s sm sec auto" id="pm-del" style="color:#ff7b7b;border-color:#ff7b7b66">Delete Team</button>`;
  h+=`</div>`;
  h+=`<div class="panel" style="margin-top:10px"><div class="ph">👑 Co-owners (${cos.length})</div>`
    +cos.map(x=>`<div class="row"><b>${esc(x)}</b>${canManage?`<button class="btn sm sec auto" data-pmrc="${esc(x)}">Remove</button>`:""}</div>`).join("")
    +(cos.length?"":`<div class="mut" style="padding:4px 0">No co-owners yet.</div>`)
    +(canManage?`<div class="row"><input type="text" id="pm-coem" placeholder="user@email.com" style="flex:1;min-width:160px"><button class="btn sm auto" id="pm-coadd">Add</button></div>`:"")
    +`<div class="hint">Co-owners have full owner powers — edit this squad, manage co-admins &amp; co-owners and move the team. The team can be deleted by its original owner, the tournament owner or an admin.</div><div class="msg err" id="pm-com"></div></div>`;
  if(canManage){
    h+=`<div class="panel" style="margin-top:10px"><div class="ph">👥 Co-admins (${eds.length})</div>`
      +eds.map(x=>`<div class="row"><b>${esc(x)}</b><button class="btn sm sec auto" data-pmrm="${esc(x)}">Remove</button></div>`).join("")
      +(eds.length?"":`<div class="mut" style="padding:4px 0">No co-admins yet.</div>`)
      +`<div class="row"><input type="text" id="pm-em" placeholder="user@email.com" style="flex:1;min-width:160px"><button class="btn sm auto" id="pm-add">Add</button></div>`
      +`<div class="hint">Co-admins can edit this squad. The team can be deleted by its owner, the tournament owner or an admin — removing it from a tournament never deletes it.</div><div class="msg err" id="pm-m"></div></div>`;
  }
  host.innerHTML=h;
  if($("#pm-sq"))$("#pm-sq").onclick=async()=>{await sqOpen(teamId,false);if(SqS.d&&!SqS.d.is_locked){SqS.edit=true;sqRender();}};
  if($("#pm-code"))$("#pm-code").onclick=()=>teamLinkView(teamId);
  if($("#pm-del"))$("#pm-del").onclick=async()=>{
    if(!await appConfirm(`Delete "${t.name}" and its whole squad? This cannot be undone.`,"Delete"))return;
    try{await deleteDoc(doc(db,"squads",teamId));await stripTeamFromStages(t.tid,teamId);await sqLoadTeams();toast(`"${t.name}" deleted.`);}catch(e){return toast(e.message||"Couldn't delete team.");}
    setView("home");
  };
  if($("#pm-add"))$("#pm-add").onclick=async()=>{
    const x=($("#pm-em").value||"").trim().toLowerCase(),msg=$("#pm-m");
    if(!x.includes("@")){msg.textContent="Enter a valid email.";return;}
    if(x===em){msg.textContent="That's already the owner.";return;}
    try{await setDoc(doc(db,"squads",teamId),{editorEmails:arrayUnion(x)},{merge:true});await sqLoadTeams();profManage(teamId);toast("Co-admin added.");}
    catch(e){msg.textContent=e.message||"Couldn't add.";}
  };
  if($("#pm-coadd"))$("#pm-coadd").onclick=async()=>{
    const x=($("#pm-coem").value||"").trim().toLowerCase(),msg=$("#pm-com");
    if(!x.includes("@")){msg.textContent="Enter a valid email.";return;}
    if(x===(t.owner||"").toLowerCase()){msg.textContent="That's already the owner.";return;}
    if(cos.includes(x)){msg.textContent="Already a co-owner.";return;}
    try{await setDoc(doc(db,"squads",teamId),{coOwners:arrayUnion(x)},{merge:true});await sqLoadTeams();profManage(teamId);toast("Co-owner added.");}
    catch(e){msg.textContent=e.message||"Couldn't add.";}
  };
  host.querySelectorAll("[data-pmrc]").forEach(b=>b.onclick=async()=>{
    if(!await appConfirm(`Remove ${b.dataset.pmrc} as co-owner?`,"Remove"))return;
    try{await updateDoc(doc(db,"squads",teamId),{coOwners:arrayRemove(b.dataset.pmrc)});await sqLoadTeams();profManage(teamId);}
    catch(e){toast(e.message||"Couldn't remove.");}
  });
  host.querySelectorAll("[data-pmrm]").forEach(b=>b.onclick=async()=>{
    if(!await appConfirm(`Remove ${b.dataset.pmrm} as co-admin?`,"Remove"))return;
    try{await updateDoc(doc(db,"squads",teamId),{editorEmails:arrayRemove(b.dataset.pmrm)});await sqLoadTeams();profManage(teamId);}
    catch(e){toast(e.message||"Couldn't remove.");}
  });
}
async function profTabRender(teamId){
  const tab=ScS.profTab||"squad",host=$("#prof-body");if(!host)return;
  if(tab==="squad"){host.innerHTML=`<div id="sq-body"><div class="mut c">Loading squad...</div></div>`;await sqOpen(teamId,true);profPull(teamId);return;}
  if(tab==="stats"){host.innerHTML=teamStatsHtml(teamId);return;}
  if(tab==="manage"){host.innerHTML=`<div id="prof-manage"></div>`;await profManage(teamId);return;}
  const ms=ScMatches.filter(m=>m.t1===teamId||m.t2===teamId).sort((a,b)=>(b.when||0)-(a.when||0));
  host.innerHTML=ms.map(m=>{const ii=scInfo({...m,history:m.history||[]});const res=ii.done?ii.res:when(m.when);return`<div class="card" data-mid="${m.id}" role="button" tabindex="0" style="cursor:pointer"><div class="row"><span class="badge ${(m.status==="live"&&!ii.done)?"live":(m.status==="completed"||ii.done)?"completed":"scheduled"}">${(m.status==="live"&&!ii.done)?"LIVE":(m.status==="completed"||ii.done)?"COMPLETED":"UPCOMING"}</span><span class="mut">${esc(tname(m.tid))} - ${m.overs} ov${m.kind?" - "+esc(kindLabel(m.kind)):""}</span></div><div class="vs"><b>${esc(m.n1)}</b> vs <b>${esc(m.n2)}</b></div><div class="mut">${esc(res)}</div></div>`;}).join("")||`<div class="mut c">No matches yet.</div>`;
  host.querySelectorAll("[data-mid]").forEach(c=>{c.onclick=()=>{ScS.profBack=()=>teamProfileView(teamId);scOpenMatch(c.dataset.mid);};c.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();c.onclick();}};});
}
async function profPull(teamId){
  const t=SqTeams.find(x=>x.id===teamId);if(!t)return;
  const em=myEmail();
  const mine=Auth.admin?Tours.filter(x=>x.id!==""&&tourStatus(x.id)!=="archived"):Tours.filter(x=>x.id!==""&&x.id!=="default"&&tourOwner(x.id)===em);
  if(Auth.admin)mine.push({id:"",name:"Friendly"});
  if(!(Auth.user&&mine.length&&t.tid!==undefined))return;
  const host=$("#sq-body")||sqRoot();
  const opts=mine.filter(x=>x.id!==t.tid);
  host.insertAdjacentHTML("beforeend",`<div class="panel"><div class="ph">Pull into my tournament</div>${opts.length?`<div class="row"><select id="tm-t" style="flex:1;min-width:160px">${opts.map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join("")}</select><button class="btn sm auto" id="tm-go">Add Team</button></div><div class="hint">Moves "${esc(t.name)}" (players + history stay intact). Team owner keeps edit access.</div>`:`<div class="hint">This team already plays in all your tournaments.</div>`}</div>`);
  if($("#tm-go"))$("#tm-go").onclick=async()=>{await moveTeamToTour(teamId,$("#tm-t").value);teamProfileView(teamId);};
}
function teamBatInnings(m,T){
  const aide=T===m.t1?1:2,first=((m.bat1==null?1:m.bat1)===aide);
  const h1=m.hist1||[],h2=m.history||[];
  if(m.innings===2)return first?{bat:h1,bowl:h2}:{bat:h2,bowl:h1};
  return first?{bat:h2,bowl:[]}:{bat:[],bowl:h2};
}
function teamStatsHtml(teamId){
  const ms=ScMatches.filter(m=>(m.t1===teamId||m.t2===teamId)&&m.status==="completed");
  if(!ms.length)return`<div class="mut c" style="margin:24px 0">No completed matches yet - stats appear here after games finish.</div>`;
  let W=0,L=0,T=0,NR=0,rf=0,ra=0,hs=0;
  const P={},prow=n=>P[n]??={n,m:0,inns:0,r:0,b:0,f4:0,f6:0,hs:0,w:0,bo:0,br:0,ct:0,st:0,ro:0};let ballsSeen=0;
  ms.forEach(m=>{
    const aide=teamId===m.t1?1:2,anm=aide===1?m.n1:m.n2,first=(m.bat1===aide);
    if(m.endType==="walkover"){const w=m.walkoverWinner;if(w===anm)W++;else if(w)L++;else NR++;}
    else if(m.endType==="abandoned"||m.endType==="noresult")NR++;
    else if(m.runs>m.inn1){first?L++:W++;}
    else if(m.runs<m.inn1){first?W++:L++;}
    else T++;
    const fr=first?(m.inn1||0):(m.runs||0),ag=first?(m.runs||0):(m.inn1||0);
    rf+=fr;ra+=ag;if(fr>hs)hs=fr;
    const bb=teamBatInnings(m,teamId),ri={},seen=new Set();
    bb.bat.forEach(x=>{ballsSeen++;if(!x.s)return;seen.add(x.s);const p=prow(x.s);p.inns++;p.r+=x.br||0;if(x.e!=="wd")p.b++;if((x.br||0)===4)p.f4++;if((x.br||0)===6)p.f6++;ri[x.s]=(ri[x.s]||0)+(x.br||0);});
    Object.entries(ri).forEach(([n,v])=>{const p=prow(n);if(v>p.hs)p.hs=v;});
    bb.bowl.forEach(x=>{ballsSeen++;if(x.o){seen.add(x.o);const o=prow(x.o);o.bo+=x.b||0;o.br+=((x.e==="by"||x.e==="lb")?0:(x.r||0));if(x.w&&x.k!=="ro")o.w++;}if(x.f&&["c","st","ro"].includes(x.k)){seen.add(x.f);const f=prow(x.f);if(x.k==="c")f.ct++;else if(x.k==="st")f.st++;else f.ro++;}});
    seen.forEach(n=>prow(n).m++);
  });
  const all=Object.values(P).sort((a,b)=>b.r-a.r);
  const mvp=all.map(p=>({...p,score:p.r+20*p.w+10*(p.ct+p.st+p.ro)})).sort((a,b)=>b.score-a.score).slice(0,5);
  const pc=ms.length,wp=pc?Math.round(W/pc*100):0;
  const top=mvp.length?mvp[0].score:0;
  const medal=i=>["🥇","🥈","🥉"][i]||`#${i+1}`;
  return`<div class="ts-card ts-hero"><div class="ts-kicker">Team Record</div><div class="ts-rec"><div class="ts-big"><b>${pc}</b><span>Played</span></div><div class="ts-big ts-win"><b>${wp}%</b><span>Won</span></div><div class="ts-big"><b>${hs}</b><span>Best</span></div></div><div class="ts-strip"><span><b>${W}</b>Won</span><span><b>${L}</b>Lost</span><span><b>${T}</b>Tied</span><span><b>${NR}</b>NR</span><span><b>${rf}</b>For</span><span><b>${ra}</b>Against</span></div>${!ballsSeen?`<div class="mut">Ball-by-ball data missing - player stats need fully scored matches.</div>`:""}</div>`
  +`<div class="ts-card"><div class="ts-kicker">⭐ Team MVPs</div>${mvp.map((p,i)=>`<div class="ts-mvp"><span class="ts-medal">${medal(i)}</span><span class="ts-mvp-n">${esc(p.n)}<small>${p.r} runs · ${p.w} wkts</small></span><span class="ts-bar"><u style="width:${top?Math.round(p.score/top*100):0}%"></u></span><span class="ts-mvp-s">${p.score}<small>pts</small></span></div>`).join("")}</div>`
  +`<div class="ts-card"><div class="ts-kicker">Players (${all.length})</div><div style="overflow-x:auto"><table class="ts-table"><thead><tr><th>#</th><th>PLAYER</th><th>M</th><th>R</th><th>B</th><th>4s</th><th>6s</th><th>HS</th><th>W</th><th>OV</th><th>Rc</th><th>Ct</th></tr></thead><tbody>${all.map((p,i)=>`<tr><td>${i+1}</td><td style="text-align:left"><b>${esc(p.n)}</b></td><td>${p.m}</td><td>${p.r}</td><td>${p.b}</td><td>${p.f4}</td><td>${p.f6}</td><td>${p.hs}</td><td>${p.w}</td><td>${Math.floor(p.bo/6)}.${p.bo%6}</td><td>${p.br}</td><td>${p.ct+p.st+p.ro}</td></tr>`).join("")}</tbody></table></div><div class="pt-legend">M matches - R runs - HS high score - W wickets - OV overs - Rc runs conceded - Ct catches+stumpings+runouts</div></div>`;
}
async function stripTeamFromStages(tid,teamId){try{const sn=await getDocs(collection(db,"tournaments",tid,"stages"));const ops=[];sn.docs.forEach(d=>{const gs=d.data().groups||[];if(gs.some(g=>(g.teamIds||[]).includes(teamId)))ops.push(setDoc(doc(db,"tournaments",tid,"stages",d.id),{groups:gs.map(g=>({id:g.id,name:g.name,teamIds:(g.teamIds||[]).filter(x=>x!==teamId)}))},{merge:true}));});await Promise.all(ops);}catch{}}
// Move a team into a tournament. Target must be owned/managed, reached via a shared
// join link (viaJoin), or be Friendly ("") to leave. Team owners can always leave.
async function moveTeamToTour(teamId,tid,viaJoin=false){
  await sqLoadTeams();await loadTours();
  const t=SqTeams.find(x=>x.id===teamId);
  if(!t)return toast("Team not found.");
  const tOwner=((t.owner||"")!==""&&(t.owner||"")===myEmail())||teamCoOwners(t.id).includes(myEmail());
  const targetOk=tid!==""&&Tours.some(x=>x.id===tid);
  const allowed=Auth.admin||(targetOk&&tourOwner(tid)===myEmail())||(tOwner&&(tid===""||(targetOk&&viaJoin)));
  if(needAccount())return;
  if(tid==="default"&&!Auth.admin)return toast("Challenger's Cup is locked — only the app admin can add teams.");
  if(!allowed)return toast("Not allowed.");
  if(t.tid===tid)return toast("Team is already there.");
  if(targetOk&&tid!==""&&tid!=="default"&&tourStatus(tid)==="archived"&&!Auth.admin&&tourOwner(tid)!==myEmail())return toast("Joining is closed for this tournament.");
  if(t.locked&&!tOwner&&!Auth.admin)return toast("That squad is locked — ask its owner to unlock first.");
  if(SqTeams.some(x=>x.id!==teamId&&x.tid===tid&&normName(x.name)===normName(t.name)))return toast("A team with that name already plays there.");
  try{
    const patch={tournament:tid};
    if(!Auth.admin)patch.editorEmails=arrayUnion(myEmail());
    await updateDoc(doc(db,"squads",teamId),patch);
    ScSquadsCache=null;await sqLoadTeams();
    toast(`"${t.name}" moved to ${tid===""?"Friendly":tname(tid)}.`);
  }catch(e){toast(e.message||"Couldn't move team.");}
}

async function joinWithTeam(teamId,tid){
  await moveTeamToTour(teamId,tid,true);

  await sqLoadTeams();
  const t=SqTeams.find(x=>x.id===teamId);
  if(t&&t.tid===tid){
    sqRoot().innerHTML=`<div class="wrap"><div class="login"><div class="lt">✅ You're In!</div><div class="msg ok">"${esc(t.name)}" joined ${esc(tname(tid))}.</div><button class="btn" id="jt-open">Open My Squad</button><button class="btn sec" id="jt-h2">🏠 Home</button></div></div>`;
    $("#jt-open").onclick=()=>sqOpen(teamId,false);
    $("#jt-h2").onclick=()=>setView("home");
  }
}

// Challenge another team to a friendly: opponent found by code/ID or name search.
async function challengeView(oppId){
  if(needAccount())return;
  CurView="squad";document.body.dataset.view="squad";
  $("#home-app").hidden=true;$("#squad-app").hidden=false;$("#scorer-app").hidden=true;
  const sq=$("#css-squad");if(sq)sq.disabled=false;const sc=$("#css-scorer");if(sc)sc.disabled=true;document.body.classList.remove("sq");
  setBack(()=>setView("home"));
  await sqLoadTeams();await loadTours();
  const mine=SqTeams.filter(t=>canEditSquad(t.id));
  if(!mine.length){sqRoot().innerHTML=`<div class="wrap"><div class="login"><div class="lt">⚔️ Challenge</div><div class="msg err">Create your team first.</div></div></div>`;return;}
  const S=ScS.ch={opp:oppId||"",q:"",my:mine[0].id,ov:10,dt:"",vn:""};
  const oppTeam=()=>SqTeams.find(t=>t.id===S.opp);
  const render=()=>{
    const o=oppTeam();
    sqRoot().innerHTML=`<div class="wrap"><div class="th"><div><div class="tn gold">⚔️ Challenge</div><div class="ts">Friendly vs another team</div></div></div>`
    +(o?`<div class="panel"><div class="ph">Opponent</div><div class="row"><b>${esc(o.name)} <small style="opacity:.65">· ${esc(o.code||o.id)}</small></b><button class="btn sm sec auto" id="ch-ch">Change</button></div></div>`
    :`<div class="panel"><div class="ph">Find opponent (code, ID or name)</div><div class="row"><input type="text" id="ch-q" placeholder="Team code or name" style="flex:1;min-width:160px" value="${esc(S.q||"")}"><button class="btn sm auto" id="ch-go">Find</button></div><div class="msg err" id="ch-m"></div><div class="hint">Ask the other team for their code (Team page → Team Code).</div></div>`)
    +(o?`<div class="panel"><div class="ph">Your challenge</div><label class="l">Your team</label><select id="ch-my">${mine.filter(t=>t.id!==o.id).map(t=>`<option value="${esc(t.id)}" ${S.my===t.id?"selected":""}>${esc(t.name)}</option>`).join("")}</select><label class="l">Overs</label><input id="ch-ov" type="number" min="1" max="50" value="${S.ov}"><label class="l">Date &amp; time (blank = TBD)</label><input id="ch-dt" type="datetime-local" value="${esc(S.dt)}"><label class="l">Venue (optional)</label><input id="ch-vn" type="text" value="${esc(S.vn)}" placeholder="Ground"><button class="btn" id="ch-send" style="margin-top:12px">Send Challenge</button><div class="msg err" id="ch-m"></div><div class="hint">A scheduled friendly is created and appears in the other team's My Cricket → Matches.</div></div>`:"")
    +`</div>`;
    const ch=$("#ch-ch");if(ch)ch.onclick=()=>{S.opp="";render();};
    const go=$("#ch-go");if(go)go.onclick=()=>{
      S.q=$("#ch-q").value;const r=resolveTeam(S.q),mm=$("#ch-m");
      if(r.err){mm.textContent=r.err;return;}
      S.opp=r.team.id;S.my=(mine.find(t=>t.id!==S.opp)||mine[0]).id;render();
    };
    const my=$("#ch-my");if(my)my.onchange=()=>S.my=my.value;
    const ov=$("#ch-ov");if(ov)ov.onchange=()=>S.ov=Math.max(1,Math.min(50,+ov.value||10));
    const dt=$("#ch-dt");if(dt)dt.onchange=()=>S.dt=dt.value;
    const vn=$("#ch-vn");if(vn)vn.onchange=()=>S.vn=vn.value;
    const send=$("#ch-send");if(send)send.onclick=()=>challengeSend();
  };
  render();
}
async function challengeSend(){
  const S=ScS.ch||{};if(needAccount())return;
  const o=SqTeams.find(t=>t.id===S.opp);
  const mine=SqTeams.filter(t=>canEditSquad(t.id)&&t.id!==S.opp);
  const a=mine.find(t=>t.id===S.my)||mine[0];
  if(!o)return toast("Pick an opponent first.");
  if(!a)return toast("Create your team first.");
  const to=((o.owner||"").toLowerCase())||(teamCoOwners(o.id)[0]||"")||(teamEditors(o.id)[0]||"");
  if(!to)return toast("This team has no owner or co-admin account yet — the challenge can't reach anyone. Ask them to open SmartCric and claim their team first.");
  const get=async id=>{try{return(await getDoc(doc(db,"squads",id))).data()||{};}catch{return{};}};
  const mk=d=>[...new Set([d.captain_name,...(d.player_list||[])].filter(Boolean))];
  const[da,db]=[await get(a.id),await get(o.id)];
  const id=rid("");
  try{
    await setDoc(doc(db,"matches",id),{tid:"",t1:a.id,t2:o.id,n1:a.name,n2:o.name,pl1:mk(da),pl2:mk(db),c1:da.captain_name||"",c2:db.captain_name||"",overs:Math.max(1,Math.min(50,+S.ov||10)),ball:"Leather",when:S.dt?new Date(S.dt).getTime():0,venue:(S.vn||"").trim(),city:"",tossWon:"",tossDec:"",status:"scheduled",bat1:null,innings:1,runs:0,balls:0,history:[],inn1:0,inn1w:0,inn1b:0,challenged:to,created:Date.now(),owner:myEmail()});
    toast("Challenge sent — scheduled as a friendly.");
  }catch(e){return toast(e.message||"Couldn't send challenge.");}
  setView("scorer");scOpenMatch(id);
}
