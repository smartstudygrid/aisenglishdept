// fixtures.js — tournament fixtures: manage, auto-generate, posters.
// Classic script: shares global scope with fellow scripts (loaded after scorer.js).
const FX_CAP=60;
const fxAll=t=>ScMatches.filter(m=>m.tid===t&&m.status==="scheduled");
const fxPubs=t=>fxAll(t).filter(m=>(m.fixtureStatus||"published")!=="draft");
async function fxEnsureSquads(){
  if(!ScSquadsCache){
    const sn=await getDocs(collection(db,"squads"));
    ScSquadsCache=sn.docs.map(d=>{const x=d.data()||{};return{id:d.id,name:x.team_name||d.id,tid:x.tournament===undefined?"default":x.tournament,cap:x.captain_name||"",pl:[...new Set([x.captain_name,...(x.player_list||[])].filter(Boolean))]};});
  }
  return ScSquadsCache;
}
const fxTeams=t=>(ScSquadsCache||[]).filter(x=>x.tid===t).slice().sort((a,b)=>a.name.localeCompare(b.name));
const fxPairKey=(a,b)=>[a,b].slice().sort().join("|");
function circlePairings(ids){
  const arr=ids.slice();
  if(arr.length%2)arr.push(null);
  const n=arr.length,rounds=[];
  for(let r=0;r<n-1;r++){
    const pairs=[];
    for(let i=0;i<n/2;i++){const a=arr[i],b=arr[n-1-i];if(a&&b)pairs.push([a,b]);}
    rounds.push(pairs);
    arr.splice(1,0,arr.pop());
  }
  return rounds;
}
function fxGroupRounds(list){
  const g={};
  list.forEach(m=>{const k=((m.round||"").trim()||"Scheduled");(g[k]=g[k]||[]).push(m);});
  const keys=Object.keys(g).sort((a,b)=>{
    const ra=a.match(/^R(\d+)/i),rb=b.match(/^R(\d+)/i);
    if(ra&&rb&&+ra[1]!==+rb[1])return+ra[1]-+rb[1];
    if(ra&&rb)return a<b?-1:1;
    if(ra)return-1;if(rb)return 1;
    return a<b?-1:1;
  });
  keys.forEach(k=>g[k].sort((a,b)=>((a.when||Infinity)-(b.when||Infinity))));
  return{keys,g};
}
function fxDayKey(m){
  if(!m.when)return"TBD";
  const d=new Date(m.when);
  return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
}
function fxDayLabel(day){
  if(day==="TBD")return"TBD";
  const p=day.split("-").map(Number);
  return new Date(p[0],p[1]-1,p[2]).toLocaleDateString([],{weekday:"long",day:"numeric",month:"long"});
}
function fxRR(tid){if(scRoot().querySelector("#fx-host"))fixturesView(tid);else scMatchList();}
function fixturesBody(tid){
  const canM=canManageTour(tid);
  const all=fxAll(tid);
  const pubs=all.filter(m=>(m.fixtureStatus||"published")!=="draft");
  const now=Date.now()-36e5;
  const up=pubs.filter(m=>!m.when||m.when>=now).sort((a,b)=>((a.when||Infinity)-(b.when||Infinity))).slice(0,5);
  const stages=ScStagesCache[tid]||[];
  const fs=ScS.fxStage||"";
  const days=[...new Set(pubs.filter(m=>m.when).map(fxDayKey))].sort();
  if(!ScS.fxDay||(ScS.fxDay!=="TBD"&&!days.includes(ScS.fxDay)))ScS.fxDay=days[0]||"TBD";
  const list=all.filter(m=>!fs||(m.stageId||"")===fs);
  const gr=fxGroupRounds(list);
  const chip=(v,x)=>`<button class="pp-chip ${fs===v?"on":""}" data-fxstage="${esc(v)}">${esc(x)}</button>`;
  const row=m=>{
    const draft=(m.fixtureStatus||"published")==="draft";
    return`<div class="card fx-card" data-fx="${m.id}" role="button" tabindex="0" style="cursor:pointer"><div class="row"><span class="badge scheduled">${draft?"DRAFT":"UPCOMING"}</span><span class="mut">${esc(m.when?when(m.when):"TBD")}${m.venue?" · "+esc(m.venue):""}</span></div><div class="vs"><b>${esc(m.n1)}</b> vs <b>${esc(m.n2)}</b></div><div class="mut">${m.overs} ov${m.kind?" · "+esc(kindLabel(m.kind)):""}${m.stageId?" · "+esc(stageName(tid,m.stageId)):""}${m.round?" · "+esc(m.round):""}</div>${canM?`<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap" onclick="event.stopPropagation()"><button class="btn s sm" data-fxe="${m.id}">Edit</button><button class="btn s sm" data-fxpub="${m.id}">${draft?"Publish":"To draft"}</button><button class="btn s sm" data-fxd="${m.id}">Delete</button></div>`:""}</div>`;
  };
  return`${canM?`<div style="display:flex;gap:8px;margin-bottom:10px"><button class="btn" style="flex:1" id="fx-add">＋ Add Fixture</button><button class="btn s" style="flex:1" id="fx-gen">⚙️ Auto-Generate</button></div>`:""}`
  +`<div class="fx-strip-h">Upcoming fixtures <span class="mut">· ${pubs.length} published</span></div>`
  +(up.length?`<div class="fx-strip">`+up.map(m=>`<button class="fx-chip" data-fx="${m.id}"><b>${esc(m.n1)} vs ${esc(m.n2)}</b><span>${esc(m.when?when(m.when):"TBD")}${m.venue?" · "+esc(m.venue):""}</span></button>`).join("")+`</div>`:`<div class="mut">No upcoming fixtures yet.</div>`)
  +`<div class="fx-dl"><div class="mut">Poster${fs?" · "+esc(((stageOf(tid,fs)||{}).name)||""):" · full schedule"}</div><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px"><button class="btn s sm" id="fx-p-ls">🖼️ Poster</button><button class="btn s sm" id="fx-p-st">📱 Story</button><button class="btn s sm" id="fx-p-sh">↗️ Share</button></div><div class="row" style="margin-top:8px"><b>Matchday</b><select id="fx-day" style="flex:1;min-width:140px">${days.map(d=>`<option value="${d}" ${ScS.fxDay===d?"selected":""}>${esc(fxDayLabel(d))}</option>`).join("")}<option value="TBD" ${ScS.fxDay==="TBD"?"selected":""}>TBD</option></select><button class="btn s sm auto" id="fx-p-day">🖼️ Card</button></div></div>`
  +(stages.length?`<div class="pp-pick"><div class="pp-lab">Stage</div><div class="pp-row">${chip("", "All stages")}${stages.map(s=>chip(s.id, s.name)).join("")}</div></div>`:"")
  +(gr.keys.length?gr.keys.map(k=>`<div class="fx-round">${esc(k)} <span class="mut">· ${gr.g[k].length}</span></div>`+gr.g[k].map(row).join("")).join(""):`<div class="mut c" style="margin:24px 0">No fixtures yet${canM?" — add one manually or auto-generate.":"."}</div>`);
}
function wireFixtures(tid){
  const R=scRoot();
  R.querySelectorAll("[data-fxstage]").forEach(b=>b.onclick=()=>{ScS.fxStage=b.dataset.fxstage;fxRR(tid);});
  R.querySelectorAll("[data-fx]").forEach(c=>{
    c.onclick=e=>{const nb=e.target.closest("button");if(nb&&nb!==c)return;scOpenMatch(c.dataset.fx);};
    c.onkeydown=e=>{if((e.key==="Enter"||e.key===" ")&&e.target===c){e.preventDefault();scOpenMatch(c.dataset.fx);}};
  });
  R.querySelectorAll("[data-fxe]").forEach(b=>b.onclick=e=>{e.stopPropagation();const m=ScMatches.find(x=>x.id===b.dataset.fxe);if(m)fxForm(tid,m);});
  R.querySelectorAll("[data-fxpub]").forEach(b=>b.onclick=e=>{e.stopPropagation();fxTogglePub(tid,b.dataset.fxpub);});
  R.querySelectorAll("[data-fxd]").forEach(b=>b.onclick=e=>{e.stopPropagation();fxDel(tid,b.dataset.fxd);});
  const add=R.querySelector("#fx-add");if(add)add.onclick=()=>fxForm(tid,null);
  const gen=R.querySelector("#fx-gen");if(gen)gen.onclick=()=>fxGenerate(tid);
  const pls=R.querySelector("#fx-p-ls");if(pls)pls.onclick=()=>scDownloadFixturesImage(tid,{sid:ScS.fxStage||"",format:"ls",share:false});
  const pst=R.querySelector("#fx-p-st");if(pst)pst.onclick=()=>scDownloadFixturesImage(tid,{sid:ScS.fxStage||"",format:"story",share:false});
  const psh=R.querySelector("#fx-p-sh");if(psh)psh.onclick=()=>scDownloadFixturesImage(tid,{sid:ScS.fxStage||"",format:"ls",share:true});
  const pday=R.querySelector("#fx-p-day");if(pday)pday.onclick=()=>{const d=(R.querySelector("#fx-day")||{}).value||ScS.fxDay||"TBD";scDownloadMatchdayImage(tid,d,{share:false});};
}
async function fixturesView(tid){
  CurView="scorer";document.body.dataset.view="scorer";
  $("#home-app").hidden=true;$("#squad-app").hidden=true;$("#scorer-app").hidden=false;
  const sq=$("#css-squad");if(sq)sq.disabled=true;const sc=$("#css-scorer");if(sc)sc.disabled=false;
  await fxEnsureSquads();
  const list=Tours.filter(t=>tourStatus(t.id)!=="archived");
  if(!tid||!list.some(t=>t.id===tid))tid=(ScS.tour&&ScS.tour!=="friendly"&&list.some(t=>t.id===ScS.tour))?ScS.tour:((list.filter(t=>t.id!=="default")[0]||list[0]||{}).id||"");
  if(ScS.fxTid!==tid)ScS.fxStage="";
  ScS.fxTid=tid;
  renderChrome();
  if(!tid){scRoot().innerHTML=`<div class="w"><div class="mc-head"><div class="mc-ttl">Fixtures</div><div class="mc-sub">Matches by tournament</div></div><div class="mut c" style="margin:24px 0">No tournaments yet.</div></div>`;setBack(()=>{ScS.tab="m";scList();});return;}
  await loadStages(tid);
  scRoot().innerHTML=`<div class="w"><div class="mc-head"><div class="mc-ttl">Fixtures</div><div class="mc-sub">Matches by tournament</div></div><label>Tournament</label><select id="fx-pick">${list.map(t=>`<option value="${esc(t.id)}" ${t.id===tid?"selected":""}>${esc(t.name)}${tourSeasonYear(t.id)?` - ${esc(tourSeasonYear(t.id))}`:""}</option>`).join("")}</select><div id="fx-host">${fixturesBody(tid)}</div><div id="msg" class="msg"></div></div>`;
  scRoot().querySelector("#fx-pick").onchange=e=>fixturesView(e.target.value);
  setBack(()=>{ScS.tab="m";scList();});
  wireFixtures(tid);
}
const fxLocalDt=ts=>{const d=new Date((ts||Date.now())-new Date().getTimezoneOffset()*6e4);return d.toISOString().slice(0,16);};
async function fxForm(tid,ex){
  if(!canManageTour(tid))return toast("Not allowed.");
  await fxEnsureSquads();await loadStages(tid);
  const teams=fxTeams(tid);
  if(teams.length<2&&!ex)return toast("Need at least two teams in this tournament.");
  const sts=ScStagesCache[tid]||[];
  const balls=["Leather","Tennis","Synthetic","Other"];
  const v=await appForm({title:(ex?"Edit":"New")+" Fixture - "+tname(tid),okText:"Save",fields:[
    {id:"a",label:"Team 1",type:"select",options:teams.map(t=>({v:t.id,t:t.name})),value:(ex&&ex.t1)||(teams[0]||{}).id||""},
    {id:"b",label:"Team 2",type:"select",options:teams.map(t=>({v:t.id,t:t.name})),value:(ex&&ex.t2)||(teams[1]||{}).id||""},
    {id:"dt",label:"Date & time (blank = TBD)",value:ex?(ex.when?fxLocalDt(ex.when):""):fxLocalDt(Date.now()+7*864e5)},
    {id:"vn",label:"Venue",value:(ex&&ex.venue)||"",placeholder:"e.g. King Fahd Stadium"},
    {id:"ov",label:"Overs",type:"number",value:String((ex&&ex.overs)||tourDefOvers(tid)||10)},
    {id:"st",label:"Stage",type:"select",options:[{v:"",t:"No stage"},...sts.map(s=>({v:s.id,t:(s.order||0)+" - "+s.name}))],value:(ex&&ex.stageId)||""},
    {id:"kind",label:"Match label",type:"select",options:MATCH_KINDS.map(([x,y])=>({v:x,t:y})),value:(ex&&ex.kind)||"GROUP_MATCH"},
    {id:"round",label:"Round (e.g. R1)",value:(ex&&ex.round)||"",placeholder:"R1"},
    {id:"pub",label:"Status",type:"select",options:[{v:"published",t:"Published"},{v:"draft",t:"Draft"}],value:(ex&&ex.fixtureStatus)||"published"},
    {id:"ball",label:"Ball",type:"select",options:balls.map(x=>({v:x,t:x})),value:(ex&&ex.ball)||"Leather"}
  ]});
  if(!v)return;
  const a=teams.find(t=>t.id===v.a),b=teams.find(t=>t.id===v.b);
  if(!a||!b||a.id===b.id)return toast("Pick two different teams.");
  const st=stageOf(tid,v.st||"");
  const gOf=tm=>{for(const g of((st&&st.groups)||[])){if((g.teamIds||[]).includes(tm))return g.id;}return"";};
  const gg1=gOf(a.id),gg2=gOf(b.id);
  const getPl=async id=>{try{const d=(await getDoc(doc(db,"squads",id))).data()||{};return{pl:[...new Set([d.captain_name,...(d.player_list||[])].filter(Boolean))],cap:d.captain_name||""};}catch{return{pl:[],cap:""};}};
  const[pa,pb]=await Promise.all([getPl(a.id),getPl(b.id)]);
  const dt=v.dt?new Date(v.dt).getTime():0;
  const base={tid,t1:a.id,t2:b.id,n1:a.name,n2:b.name,pl1:pa.pl,pl2:pb.pl,c1:pa.cap,c2:pb.cap,overs:Math.max(1,Math.min(50,+v.ov||10)),ball:v.ball||"Leather",when:dt||0,venue:(v.vn||"").trim(),city:"",tossWon:"",tossDec:"",stageId:v.st||"",groupId:(gg1&&gg1===gg2)?gg1:"",g1:gg1,g2:gg2,kind:v.kind||"",round:(v.round||"").trim(),fixtureStatus:v.pub||"published",status:"scheduled",bat1:null,innings:1,runs:0,balls:0,history:[],inn1:0,inn1w:0,inn1b:0};
  try{
    if(ex){if(!canManageTour(tid))return toast("Not allowed.");await updateDoc(doc(db,"matches",ex.id),base);toast("Fixture updated.");}
    else{await setDoc(doc(db,"matches",rid("")),{...base,created:Date.now(),owner:myEmail()});toast("Fixture added.");}
  }catch(e){return toast(e.message||"Couldn't save fixture.");}
  fxRR(tid);
}
async function fxTogglePub(tid,id){
  if(!canManageTour(tid))return toast("Not allowed.");
  const m=ScMatches.find(x=>x.id===id);if(!m)return;
  const to=(m.fixtureStatus||"published")==="draft"?"published":"draft";
  try{await updateDoc(doc(db,"matches",id),{fixtureStatus:to});toast(to==="published"?"Fixture published.":"Moved to drafts.");}catch(e){return toast(e.message||"Couldn't update.");}
  fxRR(tid);
}
async function fxDel(tid,id){
  if(!canManageTour(tid))return toast("Not allowed.");
  const m=ScMatches.find(x=>x.id===id);if(!m)return;
  if(m.status!=="scheduled")return toast("Only scheduled fixtures can be deleted here.");
  if(!await appConfirm(`Delete fixture "${m.n1} vs ${m.n2}"? This cannot be undone.`,"Delete"))return;
  try{await deleteDoc(doc(db,"matches",id));toast("Fixture deleted.");}catch(e){return toast(e.message||"Couldn't delete.");}
  fxRR(tid);
}
const fxAddDays=(ds,n)=>{if(!ds)return"";const d=new Date(ds+"T00:00");if(isNaN(d))return"";d.setDate(d.getDate()+n);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");};
function fxCompute(tid,G){
  const sts=ScStagesCache[tid]||[];
  const st=stageOf(tid,G.sid);
  const nameOf=id=>(ScSquadsCache.find(x=>x.id===id)||{}).name||id;
  const pools=(st&&st.groups&&st.groups.length)?st.groups.map(g=>({gid:g.id,gname:g.name,ids:(g.teamIds||[]).filter(id=>ScSquadsCache.some(x=>x.id===id))})):[{gid:"",gname:"",ids:fxTeams(tid).map(t=>t.id)}];
  const warns=[],rows=[];
  const seen=new Set(ScMatches.filter(m=>m.tid===tid&&m.status==="scheduled").map(m=>fxPairKey(m.t1,m.t2)+"@"+(m.stageId||"")));
  const slots=(G.slots||"").split(",").map(s=>s.trim()).filter(Boolean);
  if(!slots.length)return{rows:[],warns:["Add at least one time slot."],skipped:0};
  const per=Math.max(1,+G.per||1);
  let idx=0,skipped=0;
  for(const p of pools){
    if(p.ids.length<2){warns.push((p.gname||"Tournament")+" needs at least 2 teams - skipped.");continue;}
    let rounds=circlePairings(p.ids);
    const base=rounds.length;
    if(G.dbl)rounds=rounds.concat(rounds.map(r=>r.map(([a,b])=>[b,a])));
    rounds.forEach((pairs,ri)=>{
      const rno=ri+1;
      const round=G.dbl?(ri<base?`R${rno}`:`R${rno} (2nd leg)`):`R${rno}`;
      pairs.forEach(([a,b])=>{
        if(seen.has(fxPairKey(a,b)+"@"+(G.sid||""))){skipped++;return;}
        const day=fxAddDays(G.date,Math.floor(idx/per));
        const t=slots[idx%slots.length];
        rows.push({a,b,na:nameOf(a),nb:nameOf(b),round,gid:p.gid,gname:p.gname,date:day,time:t,venue:G.venue,when:(day&&t)?(new Date(day+"T"+t).getTime()||0):0});
        idx++;
      });
    });
    if(p.ids.length%2)warns.push((p.gname||"Tournament")+" has an odd team count - one bye per round.");
  }
  const dc={};
  rows.forEach(r=>{if(!r.date)return;[r.a,r.b].forEach(t=>{const k=t+"@"+r.date;dc[k]=(dc[k]||0)+1;});});
  Object.keys(dc).forEach(k=>{if(dc[k]>1){const[t,d]=k.split("@");warns.push(nameOf(t)+" plays "+dc[k]+"x on "+d+".");}});
  const vc={};
  rows.forEach(r=>{if(!r.date||!r.time||!r.venue)return;const k=r.venue+" @ "+r.date+" "+r.time;vc[k]=(vc[k]||0)+1;});
  Object.keys(vc).forEach(k=>{if(vc[k]>1)warns.push("Venue clash: "+k+" booked "+vc[k]+"x.");});
  if(rows.length>FX_CAP){warns.push("Capped at "+FX_CAP+" fixtures ("+(rows.length-FX_CAP)+" dropped).");rows.length=FX_CAP;}
  return{rows,warns,skipped};
}
const fxDefDate=()=>{const d=new Date(Date.now()+7*864e5);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");};
async function fxGenerate(tid){
  if(!canManageTour(tid))return toast("Not allowed.");
  CurView="scorer";document.body.dataset.view="scorer";
  $("#home-app").hidden=true;$("#squad-app").hidden=true;$("#scorer-app").hidden=false;
  const sq=$("#css-squad");if(sq)sq.disabled=true;const sc=$("#css-scorer");if(sc)sc.disabled=false;
  await fxEnsureSquads();await loadStages(tid);
  const G=(ScS.fxGen&&ScS.fxGen.tid===tid)?ScS.fxGen:(ScS.fxGen={tid,sid:"",dbl:false,date:fxDefDate(),per:2,slots:"16:00, 18:30",venue:"",ov:tourDefOvers(tid)||10,ball:"Leather",pub:true,prev:null});
  const sts=ScStagesCache[tid]||[];
  const P=G.prev;
  scRoot().innerHTML=`<div class="w"><div class="mc-head"><div class="mc-ttl">Auto-Generate</div><div class="mc-sub">${esc(tname(tid))} · round-robin per group</div></div>
  <label>Stage (empty = all teams, one pool)</label><select id="fxg-st"><option value="">All teams</option>${sts.map(s=>`<option value="${esc(s.id)}" ${G.sid===s.id?"selected":""}>${s.order||0} - ${esc(s.name)} - ${esc(stageTypeLabel(s.type))}</option>`).join("")}</select>
  <div class="row"><b>Double round</b><input id="fxg-dbl" type="checkbox" ${G.dbl?"checked":""} style="width:auto;min-width:22px;min-height:22px"></div>
  <div class="row"><b>Published (else drafts)</b><input id="fxg-pub" type="checkbox" ${G.pub?"checked":""} style="width:auto;min-width:22px;min-height:22px"></div>
  <label>Start date</label><input id="fxg-date" type="date" value="${esc(G.date||"")}">
  <label>Matches per day</label><input id="fxg-per" type="number" min="1" max="10" value="${G.per}">
  <label>Time slots (comma separated, cycles)</label><input id="fxg-slots" type="text" value="${esc(G.slots)}" placeholder="16:00, 18:30">
  <label>Venue</label><input id="fxg-vn" type="text" value="${esc(G.venue)}" placeholder="Ground (optional)">
  <div class="row"><b>Overs</b><input id="fxg-ov" type="number" min="1" max="50" value="${G.ov}" style="width:110px"></div>
  <label>Ball</label><select id="fxg-ball">${["Leather","Tennis","Synthetic","Other"].map(x=>`<option ${G.ball===x?"selected":""}>${x}</option>`).join("")}</select>
  <button class="btn" id="fxg-pv" style="margin-top:12px">👁️ Preview</button>
  <div id="fxg-out">${P?fxPreviewHtml(tid,P):""}</div>
  <div id="msg" class="msg"></div></div>`;
  setBack(()=>fixturesView(tid));
  const pull=()=>{G.sid=scRoot().querySelector("#fxg-st").value;G.dbl=scRoot().querySelector("#fxg-dbl").checked;G.pub=scRoot().querySelector("#fxg-pub").checked;G.date=scRoot().querySelector("#fxg-date").value;G.per=Math.max(1,+scRoot().querySelector("#fxg-per").value||1);G.slots=scRoot().querySelector("#fxg-slots").value;G.venue=scRoot().querySelector("#fxg-vn").value.trim();G.ov=Math.max(1,Math.min(50,+scRoot().querySelector("#fxg-ov").value||10));G.ball=scRoot().querySelector("#fxg-ball").value;};
  scRoot().querySelector("#fxg-st").onchange=()=>{pull();G.prev=null;fxGenerate(tid);};
  scRoot().querySelector("#fxg-pv").onclick=()=>{pull();G.prev=fxCompute(tid,G);fxGenerate(tid);};
  const sv=scRoot().querySelector("#fxg-sv");if(sv)sv.onclick=()=>fxSaveGen(tid);
}
function fxPreviewHtml(tid,P){
  if(!P.rows.length&&!P.warns.length)return`<div class="mut">Nothing to generate.</div>`;
  return`${P.warns.map(w=>`<div class="fx-warn">⚠️ ${esc(w)}</div>`).join("")}`
  +`${P.skipped?`<div class="mut">Skipped ${P.skipped} already-scheduled pairing(s).</div>`:""}`
  +`${P.rows.length?`<div style="overflow-x:auto"><table class="fx-prev"><tr><th>#</th><th>Date</th><th>Time</th><th>Fixture</th><th>Round</th><th>Venue</th></tr>${P.rows.map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r.date||"TBD")}</td><td>${esc(r.time||"-")}</td><td><b>${esc(r.na)}</b> vs <b>${esc(r.nb)}</b>${r.gname?`<br><span class="mut">${esc(r.gname)}</span>`:""}</td><td>${esc(r.round)}</td><td>${esc(r.venue||"-")}</td></tr>`).join("")}</table></div><button class="btn" id="fxg-sv" style="margin-top:10px">✅ Save ${P.rows.length} fixture(s)</button>`:""}`;
}
async function fxSaveGen(tid){
  const G=ScS.fxGen;
  if(!G||G.tid!==tid||!G.prev||!G.prev.rows.length)return toast("Preview first.");
  if(!canManageTour(tid))return toast("Not allowed.");
  toast("Saving fixtures…");
  const ids=[...new Set(G.prev.rows.flatMap(r=>[r.a,r.b]))];
  const pls={};
  await Promise.all(ids.map(async id=>{try{const d=(await getDoc(doc(db,"squads",id))).data()||{};pls[id]={pl:[...new Set([d.captain_name,...(d.player_list||[])].filter(Boolean))],cap:d.captain_name||""};}catch{pls[id]={pl:[],cap:""};}}));
  try{
    const b=writeBatch(db);
    G.prev.rows.forEach(r=>{
      b.set(doc(db,"matches",rid("")),{tid,t1:r.a,t2:r.b,n1:r.na,n2:r.nb,pl1:(pls[r.a]||{}).pl||[],pl2:(pls[r.b]||{}).pl||[],c1:(pls[r.a]||{}).cap||"",c2:(pls[r.b]||{}).cap||"",overs:G.ov||10,ball:G.ball||"Leather",when:r.when||0,venue:(r.venue||"").trim(),city:"",tossWon:"",tossDec:"",stageId:G.sid||"",groupId:r.gid||"",g1:r.gid||"",g2:r.gid||"",kind:"GROUP_MATCH",round:r.round,fixtureStatus:G.pub?"published":"draft",status:"scheduled",bat1:null,innings:1,runs:0,balls:0,history:[],inn1:0,inn1w:0,inn1b:0,created:Date.now(),owner:myEmail()});
    });
    await b.commit();
    toast(`Saved ${G.prev.rows.length} fixture(s)${G.prev.skipped?`, skipped ${G.prev.skipped} existing`:""}.`);
  }catch(e){return toast(e.message||"Couldn't save fixtures.");}
  ScS.fxGen.prev=null;
  fixturesView(tid);
}
function fxPosterHTML(tid,list,sub){
  const gr=fxGroupRounds(list);
  const rows=gr.keys.map(k=>`<div class="fx2-sec">${esc(k.toUpperCase())}</div>`+gr.g[k].map((m,i)=>`<div class="fx2-row${i%2?" alt":""}"><span class="fx2-dt">${esc(m.when?when(m.when):"TBD")}</span><span class="fx2-mt"><b>${esc(m.n1)}</b><em>VS</em><b>${esc(m.n2)}</b></span><span class="fx2-vn">${esc(([m.venue,m.city].filter(Boolean).join(", "))||(m.overs+" OVERS"))}</span></div>`).join("")).join("");
  return`<div class="fx2-top"><div class="fx2-tour">${esc(tname(tid))}</div><div class="fx2-sub">${esc(sub)}</div></div>${rows}<div class="fx2-ftr">SmartCric</div>`;
}
function fxScopeSub(tid,sid,gid,n){
  return[tourSeasonYear(tid),"FIXTURES",sid?stageName(tid,sid):"",gid?groupName(tid,sid,gid):"",n+" MATCH"+(n===1?"":"ES")].filter(Boolean).join(" · ");
}
async function fxCapture(W){
  if(!window.html2canvas){$("#sumImg").innerHTML="";$("#sumImg").classList.remove("ls");return null;}
  const boxH=Math.ceil($("#sumImg").firstChild.getBoundingClientRect().height);
  const canvas=await html2canvas($("#sumImg"),{backgroundColor:"#06170d",scale:2,useCORS:true,width:W,height:boxH});
  $("#sumImg").innerHTML="";$("#sumImg").classList.remove("ls");
  return canvas;
}
async function scDownloadFixturesImage(tid,o={}){
  const fmt=o.format||"ls",share=!!o.share;
  const list=fxPubs(tid).filter(m=>(!o.sid||(m.stageId||"")===o.sid)&&(!o.gid||(m.groupId||"")===o.gid));
  if(!list.length)return toast("No published fixtures for this scope.");
  toast("Building fixtures poster…");
  const inner=fxPosterHTML(tid,list,fxScopeSub(tid,o.sid,o.gid,list.length));
  if(fmt==="story")$("#sumImg").classList.remove("ls");else $("#sumImg").classList.add("ls");
  $("#sumImg").innerHTML=`<div class="${fmt==="story"?"sx fx2-story fx2-poster":"sx sx-ls fx2-poster"}">${inner}</div>`;
  const canvas=await fxCapture(fmt==="story"?540:1200);
  if(!canvas)return;
  const fn=`fixtures-${tid}${o.sid?"-"+o.sid:""}${o.gid?"-"+o.gid:""}-${fmt}.jpg`;
  if(share){const ok=await shareCanvas(canvas,fn,"Fixtures",`${tname(tid)} fixtures`);if(!ok){downloadCanvas(canvas,fn);appShare({title:"Share fixtures",sub:"Image saved to your downloads — attach it in the share sheet.",waText:`🏏 ${tname(tid)} fixtures`});}}
  else{downloadCanvas(canvas,fn);toast("Poster downloaded.");}
}
async function scDownloadMatchdayImage(tid,day,o={}){
  const list=fxPubs(tid).filter(m=>fxDayKey(m)===day);
  if(!list.length)return toast("No fixtures on this date.");
  toast("Building matchday card…");
  const inner=fxPosterHTML(tid,list,fxScopeSub(tid,"","",list.length)+" · "+fxDayLabel(day).toUpperCase());
  const fmt=o.format||"ls";
  if(fmt==="story")$("#sumImg").classList.remove("ls");else $("#sumImg").classList.add("ls");
  $("#sumImg").innerHTML=`<div class="${fmt==="story"?"sx fx2-story fx2-poster":"sx sx-ls fx2-poster"}">${inner}</div>`;
  const canvas=await fxCapture(fmt==="story"?540:1200);
  if(!canvas)return;
  const fn=`matchday-${tid}-${day}.jpg`;
  if(o.share){const ok=await shareCanvas(canvas,fn,"Matchday",`${tname(tid)} matchday ${fxDayLabel(day)}`);if(!ok){downloadCanvas(canvas,fn);appShare({title:"Share matchday card",sub:"Image saved to your downloads — attach it in the share sheet.",waText:`🏏 ${tname(tid)} matchday ${fxDayLabel(day)}`});}}
  else{downloadCanvas(canvas,fn);toast("Card downloaded.");}
}
