// scorer.js — split from index.single.html (no logic changes).
// Classic script: shares global scope with the other js/*.js files (same as the old single <script type="module">).
// Firebase symbols (db, auth, collection, doc, ...) come from js/firebase-init.js via window.
// ================= SCORER (ported, admin-only delete kept) =================
const scWk=m=>(m.history||[]).filter(x=>x.w).length;
function scInfo(m){
  const maxb=m.overs*6,w=scWk(m),inn=m.innings||1;
  const first=m.bat1===2?m.n2:m.n1,second=m.bat1===2?m.n1:m.n2;
  const bat=inn===1?first:second,bowl=inn===1?second:first;
  const i1over=!m.endType&&inn===1&&(m.balls>=maxb||w>=10);
  const done=!!m.endType||(inn===2&&(m.runs>m.inn1||m.balls>=maxb||w>=10));
  let res="";
  if(m.endType==="walkover")res=`${m.walkoverWinner||"Team"} won by walkover`;
  else if(m.endType==="abandoned")res="Match abandoned";
  else if(m.endType==="noresult")res="No result";
  else if(done){
    if(m.runs>m.inn1)res=`${bat} won by ${10-w} wicket${10-w>1?"s":""}`;
    else if(m.runs<m.inn1)res=`${bowl} won by ${m.inn1-m.runs} run${m.inn1-m.runs>1?"s":""}`;
    else res="Match tied";
  }
  if(res&&m.endNote)res+=` (${m.endNote})`;
  return{maxb,w,inn,bat,bowl,i1over,done,res};
}
function scRateStrip(m){
  const i=scInfo(m);
  if(m.status!=="live"||i.done)return"";
  const ob=m.balls||0;
  const crr=ob>0?(m.runs/(ob/6)):null;
  const f2=v=>v==null?"-":v.toFixed(2);
  if(i.inn!==2)return`<div class="rr-strip"><div class="rr-tile"><span>CRR</span><b>${f2(crr)}</b></div></div>`;
  const left=i.maxb-m.balls;
  const need=m.inn1-m.runs+1;
  const rrr=(left>0&&need>0)?(need/(left/6)):null;
  const cls=(crr!=null&&rrr!=null)?(crr>=rrr?"ahead":"behind"):"";
  return`<div class="rr-strip"><div class="rr-tile ${cls}"><span>CRR</span><b>${f2(crr)}</b></div><div class="rr-tile"><span>RRR</span><b>${f2(rrr)}</b></div><div class="rr-tile need"><span>Need</span><b>${Math.max(0,need)} off ${Math.max(0,left)}</b></div></div>`;
}
// Ball-by-ball strip: the deliveries of the current over (or the one that just ended).
function scOverStrip(m){
  if(m.status!=="live")return"";
  const i=scInfo(m);if(i.done)return"";
  const h=m.history||[];if(!h.length)return"";
  const bm=m.balls||0,kk=bm%6,lt=bm-(kk===0?6:kk);
  const arr=[];let legal=0;
  for(const x of h){if(legal>=lt)arr.push(x);if(x.b===1)legal++;}
  if(!arr.length)return"";
  const chip=x=>{
    if(x.e==="ret")return`<i class="bbs-i x">rtd</i>`;
    if(x.w)return`<i class="bbs-i wk">W</i>`;
    const ex=x.e||"";
    if(ex==="wd"||ex==="nb"){const extra=(x.r||0)-1;return`<i class="bbs-i x">${ex}${extra>0?" +"+extra:""}</i>`;}
    if(ex==="by")return`<i class="bbs-i x">b${x.r||0}</i>`;
    if(ex==="lb")return`<i class="bbs-i x">lb${x.r||0}</i>`;
    if(ex)return`<i class="bbs-i x">${esc(ex)}</i>`;
    const r=x.br||0;
    return r===0?`<i class="bbs-i d">•</i>`:r===4?`<i class="bbs-i r4">4</i>`:r===6?`<i class="bbs-i r6">6</i>`:`<i class="bbs-i">${r}</i>`;
  };
  return`<div class="bbs"><span class="bbs-l">This over</span><div class="bbs-r">${arr.map(chip).join("")}</div></div>`;
}
function scTicker(m,ov){
  const i=scInfo(m),ws=i.bat.trim().split(/\s+/),cls="tk"+(ov?" ov":"");
  if(i.done)return`<div class="${cls}" style="justify-content:center"><i class="gb"></i><div class="res">🏆 ${esc(i.res.toUpperCase())}</div></div>`;
  const need=m.inn1-m.runs+1;
  const chase=ov&&i.inn===2?`<u></u><div class="tc"><small style="color:#ffd700">CHASE</small><div class="os" style="font-size:18px;font-weight:700;color:${need>0?"#ff6b6b":"#6fcf97"}">${Math.max(0,need)} off ${Math.max(0,i.maxb-m.balls)}</div></div>`:"";
  return`<div class="${cls}"><i class="gb"></i><div class="tc tm"><b>${esc((ws[0]||"").toUpperCase())}</b><span>${esc((ws[1]||"").toUpperCase())}</span></div><u></u><div class="tc"><div class="sc">${m.runs}/${i.w}</div></div><u></u><div class="tc"><small>OVERS</small><div class="ov2">${ovs(m.balls)}</div></div><u></u><div class="tc"><div class="mx">(${String(m.overs).padStart(2,"0")})</div></div>${chase}</div>`;
}
const scBStat=(h,n)=>{let r=0,b=0;h.forEach(x=>{if(x.s===n){r+=x.br||0;if(x.e!=="wd")b++;}});return[r,b];};
const scBowlerRuns=x=>((x.e==="by"||x.e==="lb")?0:(x.r||0));
const scWStat=(h,n)=>{let r=0,b=0,w=0;h.forEach(x=>{if(x.o===n){r+=scBowlerRuns(x);b+=x.b;if(x.w&&x.k!=="ro")w++;}});return`${Math.floor(b/6)}.${b%6}-${r}-${w}`;};
// Inline cricket ball marker — leather ball with seam + gloss (Unicode has no cricket-ball emoji).
const CBALL=`<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" style="vertical-align:-2px"><defs><radialGradient id="cbg" cx="34%" cy="28%" r="80%"><stop offset="0" stop-color="#e2574c"/><stop offset=".55" stop-color="#bf2226"/><stop offset="1" stop-color="#700d10"/></radialGradient></defs><circle cx="12" cy="12" r="10.6" fill="url(#cbg)"/><path d="M8.9 3.2c4.7 2.8 4.7 14.8 0 17.6" fill="none" stroke="#f6f0e0" stroke-width="1.5" stroke-linecap="round"/><path d="M15.1 3.2c-4.7 2.8-4.7 14.8 0 17.6" fill="none" stroke="#f6f0e0" stroke-width="1.5" stroke-linecap="round"/><ellipse cx="8.4" cy="6.4" rx="3" ry="1.6" fill="#fff" opacity=".16" transform="rotate(-33 8.4 6.4)"/></svg>`;
// Inline bat marker — bat only (the 🏏 emoji draws a bat AND ball).
const CBAT=`<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" style="vertical-align:-2px"><rect x="10.7" y="1.6" width="2.6" height="7.6" rx="1.3" fill="#8a5a2b"/><path d="M10.7 3.5h2.6M10.7 5.5h2.6" stroke="#4a3416" stroke-width=".8"/><rect x="8.4" y="8.4" width="7.2" height="14" rx="2.7" fill="#e9c46a" stroke="#4a3416" stroke-width="1.1"/></svg>`;
// Short display name: first name; ambiguous lists fall back to "First L." then the full name.
const shortName=(n,list)=>{n=String(n||"").trim();if(!n)return"";const f=n.split(/\s+/)[0];
  const others=(list||[]).map(x=>String(x||"").trim()).filter(x=>x&&x!==n);
  if(!others.some(x=>x.split(/\s+/)[0]===f))return f;
  const l=(n.split(/\s+/)[1]||"")[0]||"";if(!l)return f;
  const sh=f+" "+l+".";
  return others.some(x=>x.split(/\s+/)[0]===f&&((x.split(/\s+/)[1]||"")[0]||"")===l)?n:sh;};
function scPlayers(m){
  const c=m.cur;if(!c||(!c.s&&!c.n&&!c.b)||scInfo(m).done)return"";
  const trio=[c.s,c.n,c.b].filter(Boolean);
  const kb=(m.innings||1)===1?(m.bat1===2?2:1):(m.bat1===2?1:2),bp=m["pl"+kb]||m["xi"+kb]||[],wp=m["pl"+(3-kb)]||m["xi"+(3-kb)]||[];
  const nPool=n=>{const p=n===c.b?wp:bp;return p.length?p:trio;};
  const st=n=>{if(!n)return"";const[r,b]=scBStat(m.history,n);return`<span>${n===c.s?CBAT+" ":""}<b>${esc(shortName(n,nPool(n)))}</b> ${r}(${b})</span>`;};
  return`<div class="pl">${st(c.s)}${st(c.n)}${c.b?`<span>${CBALL} <b>${esc(shortName(c.b,nPool(c.b)))}</b> ${scWStat(m.history,c.b)}</span>`:""}</div>`;
}
const STAGE_TYPES=[["ROUND_ROBIN","Groups / Round robin"],["LEAGUE","League"],["SINGLE_ELIMINATION","Knockout"]];
const MATCH_KINDS=[["GROUP_MATCH","Group match"],["LEAGUE","League"],["QUARTER_FINAL","Quarter-final"],["SEMI_FINAL","Semi-final"],["FINAL","Final"],["THIRD_PLACE","3rd place"],["QUALIFIER_1","Qualifier 1"],["ELIMINATOR","Eliminator"]];
const stageTypeLabel=v=>(STAGE_TYPES.find(x=>x[0]===v)||[v,v])[1];
const kindLabel=v=>{if(!v)return"";return(MATCH_KINDS.find(x=>x[0]===v)||[v,v])[1];};
const rid=p=>p+Array.from({length:6},()=>"ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.random()*32|0]).join("");
async function loadStages(tid){if(!tid||tid==="friendly")return[];if(ScStagesCache[tid])return ScStagesCache[tid];let a=[];try{const sn=await getDocs(collection(db,"tournaments",tid,"stages"));a=sn.docs.map(d=>({id:d.id,...d.data()}));}catch{}a.sort((x,y)=>(x.order||0)-(y.order||0));ScStagesCache[tid]=a;return a;}
const stageOf=(tid,sid)=>(ScStagesCache[tid]||[]).find(s=>s.id===sid)||null;
const groupOf=(st,gid)=>((st&&st.groups)||[]).find(g=>g.id===gid)||null;
const stageName=(tid,sid)=>{const s=stageOf(tid,sid);return s?s.name:"";};
const groupName=(tid,sid,gid)=>{const g=groupOf(stageOf(tid,sid),gid);return g?g.name:"";};
const groupTeams=(tid,sid,gid)=>{const g=groupOf(stageOf(tid,sid),gid);return g?(g.teamIds||[]):[];};
function scPointsData(stageId,groupId){
  const T={},row=(id,n)=>T[id]??={id,n,p:0,w:0,l:0,t:0,nr:0,pts:0,rf:0,bf:0,ra:0,ba:0,form:[]};
  const ms=ScMatches.filter(m=>m.tid===ScS.tour&&(!stageId||(m.stageId||"")===stageId)&&(!groupId||(m.g1||m.groupId||"")===groupId||(m.g2||m.groupId||"")===groupId)).sort((a,b)=>(a.when||0)-(b.when||0));
  const seed=new Set();
  if(groupId)groupTeams(ScS.tour,stageId,groupId).forEach(id=>seed.add(id));
  else if(stageId)((stageOf(ScS.tour,stageId)||{}).groups||[]).forEach(g=>(g.teamIds||[]).forEach(id=>seed.add(id)));
  else{(ScStagesCache[ScS.tour]||[]).forEach(st=>(st.groups||[]).forEach(g=>(g.teamIds||[]).forEach(id=>seed.add(id))));SqTeams.filter(t=>t.tid===ScS.tour).forEach(t=>seed.add(t.id));}
  seed.forEach(id=>{if(T[id])return;const tm=SqTeams.find(x=>x.id===id);let nm=tm?tm.name:"";if(!nm){const mm=ScMatches.find(m=>m.t1===id||m.t2===id);if(mm)nm=mm.t1===id?mm.n1:mm.n2;}row(id,nm||"Team");});
  ms.forEach(m=>{const h1=m.g1||m.groupId||"",h2=m.g2||m.groupId||"";if(m.t1&&(!groupId||h1===groupId))row(m.t1,m.n1);if(m.t2&&(!groupId||h2===groupId))row(m.t2,m.n2);});
    ms.filter(m=>m.status==="completed").forEach(m=>{
    const f=m.bat1===2?2:1,aid=f===1?m.t1:m.t2,bid=f===1?m.t2:m.t1,anm=f===1?m.n1:m.n2,bnm=f===1?m.n2:m.n1;
    const gg1=m.g1||m.groupId||"",gg2=m.g2||m.groupId||"";
    const ka=!groupId||(f===1?gg1:gg2)===groupId,kb=!groupId||(f===1?gg2:gg1)===groupId;
    const a=ka?row(aid,anm):null,b=kb?row(bid,bnm):null;
    const nrrAcc=()=>{if(m.inn1b!=null){const mb=(m.overs||0)*6||6,M=Math.max(m.inn1b,m.balls||0),L=M>mb?M:0,ab=L||(m.inn1w>=10?mb:m.inn1b),bb=L||((m.history||[]).filter(x=>x.w).length>=10?mb:m.balls);if(ka){a.rf+=m.inn1;a.bf+=ab;a.ra+=m.runs;a.ba+=bb;}if(kb){b.rf+=m.runs;b.bf+=bb;b.ra+=m.inn1;b.ba+=ab;}}};
    if(m.endType==="walkover"){
      const wIsA=m.walkoverWinner===m.n1,wIsB=m.walkoverWinner===m.n2;
      if(ka){a.p++;if(wIsA){a.w++;a.pts+=2;a.form.push("W");}else if(wIsB){a.l++;a.form.push("L");}else a.form.push("-");}
      if(kb){b.p++;if(wIsB){b.w++;b.pts+=2;b.form.push("W");}else if(wIsA){b.l++;b.form.push("L");}else b.form.push("-");}
    }else if(m.endType==="abandoned"||m.endType==="noresult"){
      if(ka){a.p++;a.pts++;a.nr++;a.form.push("A");}
      if(kb){b.p++;b.pts++;b.nr++;b.form.push("A");}
    }else{
      if(ka)a.p++;if(kb)b.p++;
      if(m.runs>m.inn1){if(kb){b.w++;b.pts+=2;b.form.push("W");}if(ka){a.l++;a.form.push("L");}}
      else if(m.runs<m.inn1){if(ka){a.w++;a.pts+=2;a.form.push("W");}if(kb){b.l++;b.form.push("L");}}
      else{if(ka){a.t++;a.nr++;a.pts++;a.form.push("T");}if(kb){b.t++;b.nr++;b.pts++;b.form.push("T");}}
      nrrAcc();
    }
  });
  const nrr=x=>x.bf&&x.ba?x.rf/(x.bf/6)-x.ra/(x.ba/6):null;
  return Object.values(T).map(x=>({...x,nrr:nrr(x),form:x.form.slice(-5)})).sort((a,b)=>b.pts-a.pts||(b.nrr??-99)-(a.nrr??-99));
}
function scPoints(stageId,groupId){
  if(!ScS.tour)return`<div class="mc-empty"><div class="mc-eic">🏆</div><span>Select a tournament above.</span></div>`;
  const rows=scPointsData(stageId,groupId);
  if(!rows.length)return`<div class="mut c" style="margin:24px 0">No teams in this tournament yet.</div>`;
  return`<div class="pt-card"><table class="pt"><tr><th>#</th><th>TEAM</th><th>P</th><th>W</th><th>L</th><th>T</th><th>NR</th><th>NRR</th><th>PTS</th></tr>${rows.map((x,i)=>`<tr class="${i===0?"pt-top":""}"><td>${i+1}</td><td style="text-align:left"><b><span data-tprof="${x.id}" style="cursor:pointer;text-decoration:underline dotted">${esc(x.n)}</span></b></td><td>${x.p}</td><td>${x.w}</td><td>${x.l}</td><td>${x.t}</td><td>${x.nr}</td><td>${x.nrr==null?"–":(x.nrr>0?"+":"")+x.nrr.toFixed(3)}</td><td><b>${x.pts}</b></td></tr>`).join("")}</table><div class="pt-legend">Win 2 · Tie / Abandoned / No-result 1 · Walkover: winner 2</div></div>`;
}
// ---- tournament leaders: best batters / bowlers / MVP (from ball-by-ball history) ----
function scTourStats(){
  const ms=ScMatches.filter(m=>m.tid===ScS.tour);
  const bat={},bowl={},P={};
  ms.forEach(m=>{[m.hist1||null,m.history||[]].forEach(h=>{
    if(!h||!h.length)return;
    const seenBat=new Set(),seenBowl=new Set(),runsInn={};
    h.forEach(x=>{
      if(x.s){seenBat.add(x.s);runsInn[x.s]=(runsInn[x.s]||0)+(x.br||0);}
      if(x.p){if(x.p[0])seenBat.add(x.p[0]);if(x.p[1])seenBat.add(x.p[1]);}
      if(x.o)seenBowl.add(x.o);
      const b=x.s?bat[x.s]??={n:x.s,r:0,b:0,f4:0,f6:0,inns:0,outs:0,hs:0,fifties:0,hundreds:0}:null;
      if(b){b.r+=x.br||0;if(x.e!=="wd")b.b++;if((x.br||0)===4)b.f4++;if((x.br||0)===6)b.f6++;}
      if(x.o){const o=bowl[x.o]??={n:x.o,b:0,r:0,w:0,inns:0};o.r+=scBowlerRuns(x);o.b+=x.b||0;if(x.w&&x.k!=="ro")o.w++;}
      if(x.w&&(x.d||x.s)){const dn=x.d||x.s;const db=bat[dn]??={n:dn,r:0,b:0,f4:0,f6:0,inns:0,outs:0,hs:0,fifties:0,hundreds:0};db.outs++;}
    });
    seenBat.forEach(n=>{const b=bat[n]??={n,r:0,b:0,f4:0,f6:0,inns:0,outs:0,hs:0,fifties:0,hundreds:0};b.inns++;const ir=runsInn[n]||0;if(ir>b.hs)b.hs=ir;if(ir>=100)b.hundreds++;else if(ir>=50)b.fifties++;});
    seenBowl.forEach(n=>{(bowl[n]??={n,b:0,r:0,w:0,inns:0}).inns++;});
    // The same points system the Man of the Match and the MVP race use.
    const ip=scPtsInn(h);
    Object.entries(ip).forEach(([n,v])=>{const g=P[n]??(P[n]={p:0,f4:0,f6:0,dots:0,w:0,ct:0,st:0});g.p+=v.p;g.f4+=v.f4;g.f6+=v.f6;g.dots+=v.dots;g.w+=v.w;g.ct+=v.ct;g.st+=v.st;});
  });});
  const batters=Object.values(bat).filter(b=>b.b>0).map(b=>({...b,avg:b.outs?b.r/b.outs:null,sr:b.b?b.r/b.b*100:0,p:(P[b.n]||{}).p||0})).sort((a,b)=>b.r-a.r).slice(0,5);
  const bowlers=Object.values(bowl).filter(o=>o.b>0).map(o=>({...o,ov:`${Math.floor(o.b/6)}.${o.b%6}`,eco:o.b?o.r/(o.b/6):0,avg:o.w?o.r/o.w:null,p:(P[o.n]||{}).p||0})).sort((a,b)=>b.w-a.w||a.r-b.r).slice(0,5);
  const mvps=Object.entries(P).map(([n,v])=>({n,p:v.p,r:(bat[n]||{}).r||0,w:v.w,f:v.ct+v.st,f4:v.f4,f6:v.f6,dots:v.dots})).sort((a,b)=>b.p-a.p||b.r-a.r).slice(0,5);
  return{batters,bowlers,mvps,played:ms.filter(m=>(m.history||[]).length||(m.hist1||[]).length).length};
}
function scStatsHtml(){
  if(!ScS.tour)return`<div class="mc-empty"><div class="mc-eic">🏆</div><span>Select a tournament above.</span></div>`;
  const s=scTourStats();
  if(!s.played)return`<div class="mc-empty"><div class="mc-eic">🏏</div><span>No balls bowled yet in ${esc(tname(ScS.tour))}.</span></div>`;
  const sel=ScS.statSel||"bat";
  const avgFmt=v=>v==null?"–":v.toFixed(2);
  let body="";
  if(sel==="bat")body=`<div class="os gold" style="font-size:16px;margin:10px 0 4px">🏏 BEST BATTERS</div><table class="st-table st-bat">${s.batters.map((b,i)=>`<tr><td>${i+1}. <b>${esc(b.n)}</b><br><span class="mut" style="font-size:12px">${b.inns} inns · HS ${b.hs} · ${b.fifties}×50 ${b.hundreds}×100</span></td><td><b>${b.r}</b> <span class="mut">(${b.b})</span> <span class="pts-chip">${b.p} pts</span><br><span class="mut" style="font-size:12px">Avg ${avgFmt(b.avg)} · SR ${b.sr.toFixed(1)} · ${b.f4}×4 ${b.f6}×6</span></td></tr>`).join("")||`<tr><td class="mut">—</td></tr>`}</table>`;
  else if(sel==="bowl")body=`<div class="os gold" style="font-size:16px;margin:10px 0 4px">${CBALL} BEST BOWLERS</div><table class="st-table st-bowl">${s.bowlers.map((o,i)=>`<tr><td>${i+1}. <b>${esc(o.n)}</b><br><span class="mut" style="font-size:12px">${o.inns} inns · ${o.ov} ov</span></td><td><b>${o.w}</b> <span class="mut">wkts</span> <span class="pts-chip">${o.p} pts</span><br><span class="mut" style="font-size:12px">Avg ${avgFmt(o.avg)} · Econ ${o.eco.toFixed(2)} · ${o.dots} dots</span></td></tr>`).join("")||`<tr><td class="mut">—</td></tr>`}</table>`;
  else body=`<div class="os gold" style="font-size:16px;margin:10px 0 4px">⭐ MVP RACE</div><table class="st-table st-mvp">${s.mvps.map((p,i)=>`<tr><td>${i+1}. <b>${esc(p.n)}</b><br><span class="mut" style="font-size:12px">${p.r} runs · ${p.f4}×4 · ${p.f6}×6 · ${p.dots} dots · ${p.w} wkts · ${p.f} Ct/St</span></td><td><b>${p.p}</b> <span class="mut">pts</span></td></tr>`).join("")}</table><div class="mut c" style="margin-top:6px;font-size:12px">Points = 4×2.5 · 6×3.5 · 50×3.5 · 100×5 · dot×1 · wkt×3.5 · 3wkt×3.5 · 5wkt×5 · catch×2.5 · stumping×2.5</div><div class="mut c" style="margin-top:4px;font-size:12px"><button class="btn sec sm" id="st-pts">⭐ See the full points system</button></div>`;
  return`<label>Leaderboard</label><select id="stat-sel" class="mc-sel"><option value="bat" ${sel==="bat"?"selected":""}>🏏 Batting</option><option value="bowl" ${sel==="bowl"?"selected":""}>Bowling</option><option value="mvp" ${sel==="mvp"?"selected":""}>⭐ MVP</option></select>${body}<div class="sc-row"><button class="btn sec sm" id="st-dl">📥 Stats Image</button><button class="btn sec sm" id="st-sh">📲 Share Stats</button></div>`;
}
async function scDownloadStatsImage(share=false){
  if(!ScS.tour)return toast("Select a tournament first.");
  const s=scTourStats();
  if(!s.played)return toast("No stats yet.");
  const sel=ScS.statSel||"bat";
  const link=basePage();
  const title=sel==="bat"?"BEST BATTERS":sel==="bowl"?"BEST BOWLERS":"MVP RACE";
  const banner=sel==="bat"?"Batting Leaders":sel==="bowl"?"Bowling Leaders":"MVP Race";
  const avgFmt=v=>v==null?"–":v.toFixed(2);
  const cols=sel==="bat"?[["#","q-rk"],["Player","q-tm"],["R","q-n"],["B","q-n"],["4s","q-n"],["6s","q-n"],["Pts","q-pt"]]
    :sel==="bowl"?[["#","q-rk"],["Player","q-tm"],["O","q-n"],["Dots","q-n"],["Wkts","q-n"],["Pts","q-pt"]]
    :[["#","q-rk"],["Player","q-tm"],["Runs","q-n"],["Wkts","q-n"],["Ct/St","q-n"],["Pts","q-pt"]];
  const cells=(x,i)=>{
    const v=sel==="bat"?[i+1,x.n,x.r,x.b,x.f4,x.f6,x.p]
      :sel==="bowl"?[i+1,x.n,x.ov,x.dots,x.w,x.p]
      :[i+1,x.n,x.r,x.w,x.f,x.p];
    return`<tr class="${i===0?"p1":i===1?"p2":i===2?"p3":(i%2?"alt":"")}">${v.map((c,j)=>`<td class="${cols[j][1]}">${j===0?c:(j===v.length-1?`<span class="qx-pbox">${c}</span>`:c)}</td>`).join("")}</tr>`;
  };
  const list=sel==="bat"?s.batters:sel==="bowl"?s.bowlers:s.mvps;
  const rows=list.map(cells).join("");
  toast("Building stats image…");
  $("#sumImg").innerHTML=`<div class="sx sx-ls sx-qx qx-lb"><div class="qx-top"><div class="qx-tour">${esc(tname(ScS.tour))}</div><div class="qx-sub">${esc(tourSeasonYear(ScS.tour))} · ${esc(title)}</div></div><div class="qx-bar">${esc(banner)}</div><table class="qx-t"><tr>${cols.map(c=>`<th class="${c[1]}">${c[0]}</th>`).join("")}</tr>${rows||'<tr><td class="mut">—</td></tr>'}</table><div class="qx-ftr">Points = 4×2.5 · 6×3.5 · 50×3.5 · 100×5 · dot×1 · wkt×3.5 · 3wkt×3.5 · 5wkt×5 · catch×2.5 · stumping×2.5</div><div class="sx-link">🔗 ${esc(link)}</div><div class="sx-ftr">SquareCut</div></div>`;
  if(!window.html2canvas){$("#sumImg").innerHTML="";$("#sumImg").classList.remove("ls");return toast("html2canvas not loaded.");}
  const boxH=Math.ceil($("#sumImg").firstChild.getBoundingClientRect().height);
  const canvas=await html2canvas($("#sumImg"),{backgroundColor:"#1d2230",scale:2,useCORS:true,width:1200,height:boxH});
  $("#sumImg").innerHTML="";$("#sumImg").classList.remove("ls");
  if(share){const ok=await shareCanvas(canvas,`stats-${ScS.tour}-${sel}.jpg`,title,`${tname(ScS.tour)} ${title} ${link}`);if(!ok){downloadCanvas(canvas,`stats-${ScS.tour}-${sel}.jpg`);toast("Stats image downloaded.");}}
  else{downloadCanvas(canvas,`stats-${ScS.tour}-${sel}.jpg`);toast("Stats image downloaded.");}
}
let scWl;const scLock=async()=>{try{scWl=await navigator.wakeLock.request("screen");}catch{}};
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&CurView==="scorer"&&ScS.m)scLock();});
function scRoot(){return $("#scorer-app");}
const scRef=id=>doc(db,"matches",id);
const scFlash=(t,ok)=>{const e=$("#scorer-app #msg")||$("#msg");if(e){e.textContent=t;e.style.color=ok?"#6be58c":"";}};
const scAct=async fn=>{try{await fn();}catch(e){scFlash(e.code==="permission-denied"?"Not allowed — sign in as admin.":e.message);}};
function scList(){
  if(ScS.lockT){clearInterval(ScS.lockT);ScS.lockT=null;}
  const sq=$("#css-squad");if(sq)sq.disabled=true;const sc=$("#css-scorer");if(sc)sc.disabled=false;
  ScS.view="list";ScS.ex=false;if(ScS.unsubM)ScS.unsubM();
  setBack(null);
  const vt=Tours;
  if(ScS.tour&&ScS.tour!=="friendly"&&!vt.some(t=>t.id===ScS.tour))ScS.tour="";
  const ownedTour=Tours.some(t=>tourOwner(t.id)===myEmail());
  const ownedMatch=ScMatches.some(m=>((m.owner||"").toLowerCase()===myEmail()));
  const ownTeam=SqTeams.some(t=>((t.owner||"").toLowerCase())===myEmail()||teamEditors(t.id).includes(myEmail())||teamCoOwners(t.id).includes(myEmail()));
  const scoreOnly=!Auth.admin&&!!Auth.user&&assignedScorer()&&!ownedTour&&!ownedMatch&&!ownTeam;
  scRoot().innerHTML=`<div class="w schub"><div class="mc-head"><div class="mc-ttl">Tournament</div><div class="mc-sub">Matches · Points · Stats · Fixtures</div></div>
    ${scoreOnly?`<div class="tg">👋 You are a scorer — open a match below and score. No scheduling or deleting.</div>`:""}
    <div class="mc-selwrap"><label for="ft">Tournament</label><select id="ft" class="mc-sel" data-pick-title="Tournament"><option value="">All tournaments</option>${vt.map(t=>`<option value="${esc(t.id)}" ${t.id===ScS.tour?"selected":""}>${esc(t.name)}</option>`).join("")}<option value="friendly" ${ScS.tour==="friendly"?"selected":""}>⭐ Friendly</option></select><button class="btn sm sec" id="ft-mng" style="flex:none">⚙ Manage</button></div>
    <div class="mc-selwrap" style="margin-top:8px"><label for="fq">Search</label><input id="fq" class="mc-sel" type="text" placeholder="Team or venue…" value="${esc(ScS.fq||"")}"></div>
    <div class="mc-seg sc-seg4"><button class="${ScS.tab==="m"?"on":""}" id="tm"><span class="mc-sic">🏏</span><span>Matches</span></button><button class="${ScS.tab==="p"?"on":""}" id="tp"><span class="mc-sic">📊</span><span>Points</span></button><button class="${ScS.tab==="s"?"on":""}" id="ts"><span class="mc-sic">🏆</span><span>Stats</span></button><button class="${ScS.tab==="f"?"on":""}" id="tfx"><span class="mc-sic">🗓️</span><span>Fixtures</span></button></div>
    ${Auth.user&&!scoreOnly?`<div class="sc-acts">${canSched()?`<button class="mc-score" id="sch">＋ Schedule Match</button>`:""}<div class="sc-acts2"><button class="btn sec" id="ct3">👥 Teams</button>${Auth.admin?`<button class="btn sec" id="scr">👥 Scorers</button>`:""}</div></div>`:Auth.admin?`<div class="sc-acts2"><button class="btn sec" id="scr">👥 Scorers</button></div>`:""}<div id="ml"></div><div id="msg" class="msg"></div></div>`;
  $("#ft").onchange=e=>{ScS.tour=e.target.value;scMatchList();};
  if($("#ft-mng"))$("#ft-mng").onclick=()=>tourHub();
  $("#fq").oninput=e=>{ScS.fq=e.target.value;scMatchList();};
  $("#tm").onclick=()=>{ScS.tab="m";scList();};$("#tp").onclick=()=>{ScS.tab="p";scList();};$("#ts").onclick=()=>{ScS.tab="s";scList();};$("#tfx").onclick=()=>{ScS.tab="f";scList();};
  if($("#sch"))$("#sch").onclick=()=>scSchedule();
  if($("#ct3"))$("#ct3").onclick=()=>{const tid=(ScS.tour&&ScS.tour!=="friendly")?ScS.tour:"";if(!tid)return toast("Pick a tournament first, then tap Teams.");sqTourTeams(tid,()=>{ScS.tour=tid;ScS.tab="s";setView("scorer");});};
  if($("#scr"))$("#scr").onclick=()=>usersAdmin("scorer");
  scMatchList();
}
// Score hub — My Cricket → 🏏 Score a Match: play actions plus the matches you can score.
function scPlay(){
  ScS.playNext=false;ScS.view="play";
  const sq=$("#css-squad");if(sq)sq.disabled=true;const sc=$("#css-scorer");if(sc)sc.disabled=false;
  ScS.ex=false;if(ScS.unsubM)ScS.unsubM();
  setBack(()=>setView("home"));
  const signed=Auth.user&&!isAnon();
  const my=ScMatches.filter(m=>canScore(m));
  const dn=m=>{try{return scInfo({...m,history:m.history||[]}).done;}catch{return m.status==="completed";}};
  const live=my.filter(m=>m.status==="live"&&!dn(m)).sort((a,b)=>(b.when||0)-(a.when||0));
  const up=my.filter(m=>m.status==="scheduled").sort((a,b)=>(a.when||0)-(b.when||0));
  const past=my.filter(m=>m.status==="completed"||(m.status==="live"&&dn(m))).sort((a,b)=>(b.when||0)-(a.when||0)).slice(0,8);
  const card=(m,k)=>{let i={};try{i=scInfo({...m,history:m.history||[]});}catch{}
    const lk=k==="l"&&claimActive(m)&&!claimMine(m);const line=k==="u"?"":`<div class="os gold" style="font-size:16px">${k==="p"?(i.done&&i.res?"🏆 "+esc(i.res):"Completed"):`${esc(i.bat||m.n1)} ${m.runs||0}/${i.w||0} (${ovs(m.balls||0)})`}</div>`;
    return`<div class="card" data-plid="${esc(m.id)}" role="button" tabindex="0"><div class="row"><span class="badge ${k==="l"?"live":k==="p"?"completed":"scheduled"}">${k==="l"?"● LIVE":k==="p"?"COMPLETED":"UPCOMING"}</span><span class="mut">${esc(tname(m.tid))} · ${m.overs} ov</span></div><div class="vs"><b>${esc(m.n1)}</b> vs <b>${esc(m.n2)}</b></div><div class="mut">${when(m.when)}${m.venue?" · "+esc(m.venue):""}</div>${line}<div class="mut" style="margin-top:6px;font-weight:700">${lk?"Watch live 🔒":k==="l"?"Continue scoring":k==="u"?"Start scoring":"View scorecard"} ›</div></div>`;};
  scRoot().innerHTML=`<div class="w"><div class="mc-head"><div class="mc-ttl">Score</div><div class="mc-sub">Start a match or continue scoring</div></div>
    ${signed?"":`<div class="tg">Sign in to score — open the menu (☰) → Sign In.</div>`}
    <button class="btn" id="pl-fr">＋ Friendly Match</button>
    ${canSched()?`<button class="btn s" id="pl-tm" style="margin-top:8px">🏆 Tournament Match</button>`:""}
    ${live.length?`<div class="os gold" style="margin:16px 0 6px;font-size:16px">Live — yours to score</div>${live.map(m=>card(m,"l")).join("")}`:""}
    ${up.length?`<div class="os gold" style="margin:16px 0 6px;font-size:16px">Upcoming — ready to start</div>${up.map(m=>card(m,"u")).join("")}`:""}
    ${past.length?`<div class="os gold" style="margin:16px 0 6px;font-size:16px">Recent</div>${past.map(m=>card(m,"p")).join("")}`:""}
    ${(!live.length&&!up.length&&!past.length)?`<div class="mut c" style="margin:24px 0">Nothing to score yet — start a ＋ Friendly Match or a 🏆 Tournament Match.</div>`:""}
    <div id="msg" class="msg"></div></div>`;
  const on=(sel,fn)=>{const el=scRoot().querySelector(sel);if(el)el.onclick=fn;};
  on("#pl-fr",()=>scSchedule(true));
  on("#pl-tm",()=>scSchedule());
  scRoot().querySelectorAll("[data-plid]").forEach(c=>{const go=()=>scOpenMatch(c.dataset.plid);c.onclick=e=>{if(e.target.closest("button"))return;go();};c.onkeydown=e=>{if((e.key==="Enter"||e.key===" ")&&e.target===c){e.preventDefault();go();}};});
}
function scMatchList(){
  if(!scRoot().querySelector("#ml"))return;

  if(ScS.tab==="p"){if(ScS.tour==="friendly"){scRoot().querySelector("#ml").innerHTML=`<div class="mc-empty"><div class="mc-eic">📊</div><span>Points table doesn't apply to friendly matches — each game stands alone.</span></div>`;return;}const _t=ScS.tour;if(ScS.ptour!==_t){ScS.ptour=_t;ScS.pstage="";ScS.pgroup="";}const _sts=ScStagesCache[_t]||[];if(ScS.pstage&&ScStagesCache[_t]&&!_sts.some(s=>s.id===ScS.pstage)){ScS.pstage="";ScS.pgroup="";}const _st=stageOf(_t,ScS.pstage);const _gr=((_st&&_st.groups)||[]);if(ScS.pgroup&&!_gr.some(g=>g.id===ScS.pgroup))ScS.pgroup="";const _chips=(att,cur,items)=>items.map(([v,x])=>`<button class="pp-chip ${cur===v?"on":""}" ${att}="${esc(v)}">${esc(x)}</button>`).join("");const _ph=_sts.length?`<div class="pp-pick"><div class="pp-lab">Stage</div><div class="pp-row">${_chips("data-pps",ScS.pstage,[["","All stages"],..._sts.map(s=>[s.id,s.name])])}</div>${_gr.length?`<div class="pp-lab">Group</div><div class="pp-row">${_chips("data-ppg",ScS.pgroup,[["","All groups"],..._gr.map(g=>[g.id,g.name])])}</div>`:""}</div>`:"";scRoot().querySelector("#ml").innerHTML=_ph+(ScS.pstage&&!ScS.pgroup&&_gr.length?_gr.map(g=>`<div class="panel"><div class="ph">${esc(g.name)}</div>`+scPoints(ScS.pstage,g.id)+`<div class="sc-row"><button class="btn sec sm" data-gdl="${esc(ScS.pstage)}|${esc(g.id)}">Download ${esc(g.name)} image</button></div></div>`).join("")+`<div class="sc-row"><button class="btn sec sm" id="pt-all">Download all groups</button></div>`:scPoints(ScS.pstage,ScS.pgroup))+`<div class="sc-row"><button class="btn sec sm" id="pt-dl">📥 Points Image</button><button class="btn sec sm" id="pt-sh">📲 Share Points</button></div>`;scRoot().querySelectorAll("[data-pps]").forEach(b=>b.onclick=()=>{ScS.pstage=b.dataset.pps;ScS.pgroup="";scMatchList();});scRoot().querySelectorAll("[data-ppg]").forEach(b=>b.onclick=()=>{ScS.pgroup=b.dataset.ppg;scMatchList();});if(ScS.tour&&!ScStagesCache[ScS.tour])loadStages(ScS.tour).then(()=>{if(ScS.tab==="p")scMatchList();});scRoot().querySelectorAll("[data-gdl]").forEach(b=>b.onclick=()=>{const pc=b.dataset.gdl.split("|");scDownloadPointsImage(false,pc[0],pc[1]);});const _pa=$("#pt-all");if(_pa)_pa.onclick=async()=>{for(const g of _gr){await scDownloadPointsImage(false,ScS.pstage,g.id);}};$("#pt-dl").onclick=()=>scDownloadPointsImage(false);$("#pt-sh").onclick=()=>scDownloadPointsImage(true);scRoot().querySelectorAll("[data-tprof]").forEach(b=>b.onclick=()=>{ScS.profBack=()=>scMatchList();teamProfileView(b.dataset.tprof);});return;}
  if(ScS.tab==="s"){if(ScS.tour==="friendly"){scRoot().querySelector("#ml").innerHTML=`<div class="mc-empty"><div class="mc-eic">🏆</div><span>Stats need a tournament — pick one above.</span></div>`;return;}scRoot().querySelector("#ml").innerHTML=scStatsHtml();$("#stat-sel").onchange=e=>{ScS.statSel=e.target.value;scMatchList();};if($("#st-pts"))$("#st-pts").onclick=()=>setView("points");$("#st-dl").onclick=()=>scDownloadStatsImage(false);$("#st-sh").onclick=()=>scDownloadStatsImage(true);return;}
  if(ScS.tab==="f"){if(!ScS.tour||ScS.tour==="friendly"){scRoot().querySelector("#ml").innerHTML=`<div class="mc-empty"><div class="mc-eic">🗓️</div><span>Fixtures need a tournament — pick one above.</span></div>`;return;}if(ScS.tour&&!ScStagesCache[ScS.tour]){loadStages(ScS.tour).then(()=>{if(ScS.tab==="f"&&scRoot().querySelector("#ml"))scMatchList();});}scRoot().querySelector("#ml").innerHTML=fixturesBody(ScS.tour);wireFixtures(ScS.tour);return;}
  let all=ScMatches.filter(m=>(ScS.tour==="friendly"?(m.tid||"")==="":(!ScS.tour||m.tid===ScS.tour)));
  const fq=(ScS.fq||"").toLowerCase().trim();
  if(fq)all=all.filter(m=>(m.n1+" "+m.n2+" "+(m.venue||"")).toLowerCase().includes(fq));
  const asc=(a,b)=>(a.when||0)-(b.when||0);
  const isDone=m=>{try{return scInfo({...m,history:m.history||[]}).done;}catch{return m.status==="completed";}};
  const G={u:all.filter(m=>m.status==="scheduled").sort(asc),l:all.filter(m=>m.status==="live"&&!isDone(m)).sort(asc),p:all.filter(m=>m.status==="completed"||(m.status==="live"&&isDone(m))).sort((a,b)=>asc(b,a))};
  const mt=ScS.mt||(G.l.length?"l":"u");
  const card=m=>{
    const i=scInfo({...m,history:m.history||[]});
    const k=(m.status==="live"&&!i.done)?"l":(m.status==="completed"||i.done)?"p":"u";
    const canDel=canDeleteMatch(m);const lk=k==="l"&&claimActive(m)&&!claimMine(m);
    const lbl=k==="l"?"● LIVE":k==="p"?"COMPLETED":"UPCOMING";
    const sc=k==="u"?"<small>Not started yet</small>":(i.done?"🏆 "+esc(i.res):`${esc(i.bat)} ${m.runs}/${i.w} <small>(${ovs(m.balls)} ov)</small>`);
    const meta=[when(m.when),m.venue,m.city,m.ball].filter(Boolean).map(esc).join(" · ");
    return`<div class="mc-match ${k}" data-id="${m.id}" role="button" tabindex="0"><div class="mc-mh"><span class="mc-st ${k}">${k==="l"?'<i class="mc-dot"></i>':""}${lbl}</span><span class="mc-tn">${esc(tname(m.tid))} · ${m.overs} ov${m.kind?" · "+kindLabel(m.kind):""}</span></div><div class="mc-vs"><div class="mc-tm"><b>${esc(abbr(m.n1))}</b><span>${esc(m.n1)}</span></div><div class="mc-mid">VS</div><div class="mc-tm"><b>${esc(abbr(m.n2))}</b><span>${esc(m.n2)}</span></div></div><div class="mc-mf"><span class="mc-sc">${sc}</span><span class="mc-go">${lk?"Watch live 🔒":k==="l"?"Score now":k==="p"?"Scorecard":"Details"} ›</span></div>${meta?`<div class="sc-meta">${meta}</div>`:""}${canDel?`<div class="sc-delrow"><button class="sc-del" data-del="${m.id}">🗑 Delete</button></div>`:""}</div>`;
  };
  const tabs=`<div class="sc-mt">${[["u","Upcoming"],["l","Live"],["p","Past"]].map(([k,t])=>`<button class="sc-mtb ${mt===k?"on":""}" data-mt="${k}">${t}<em>${G[k].length}</em></button>`).join("")}</div>`;
  scRoot().querySelector("#ml").innerHTML=tabs+(G[mt].map(card).join("")||`<div class="mc-empty"><div class="mc-eic">🏏</div><b>No ${{u:"upcoming",l:"live",p:"past"}[mt]} matches</b><span>Matches appear here once they're scheduled or start.</span>${canSched()?`<div class="sc-row"><button class="btn sec sm" id="em-sch">＋ Schedule Match</button></div>`:""}</div>`);
  scRoot().querySelectorAll("[data-mt]").forEach(b=>b.onclick=()=>{ScS.mt=b.dataset.mt;scMatchList();});
  if($("#em-sch"))$("#em-sch").onclick=()=>scSchedule();
  scRoot().querySelectorAll("[data-tprof]").forEach(b=>b.onclick=e=>{e.stopPropagation();ScS.profBack=()=>scMatchList();teamProfileView(b.dataset.tprof);});
  scRoot().querySelectorAll("[data-id]").forEach(c=>{c.onclick=e=>{if(e.target.closest("button"))return;scOpenMatch(c.dataset.id);};c.onkeydown=e=>{if((e.key==="Enter"||e.key===" ")&&e.target===c){e.preventDefault();scOpenMatch(c.dataset.id);}};});
  scRoot().querySelectorAll("[data-del]").forEach(b=>b.onclick=async e=>{e.stopPropagation();if(await appConfirm("Delete this match? This can't be undone.","Delete"))scAct(()=>deleteDoc(scRef(b.dataset.del)));});
}
async function quickScore(){
  if(needAccount())return;
  const mine=SqTeams.filter(t=>canEditSquad(t.id));
  if(!mine.length)return toast("Create your team first.");
  if(SqTeams.length<2)return toast("Need at least two teams — create or join another.");
  const v=await appForm({title:"⚡ Quick Score",okText:"Start Scoring",fields:[
    {id:"a",label:"Your team",type:"select",options:mine.map(t=>({v:t.id,t:t.name}))},
    {id:"b",label:"Opponent (team code, ID or name)",placeholder:"e.g. KX7Q2P or Falcons XI"},
    {id:"ov",label:"Overs",value:"10"},
    {id:"bat",label:"Batting first",type:"select",options:[{v:"a",t:"My team bats first"},{v:"b",t:"Opponent bats first"}]}
  ]});
  if(!v||!v.a||!v.b)return;
  const rb=resolveTeam(v.b);
  if(rb.err)return toast(rb.err);
  const opp=rb.team,bid=opp.id;
  if(bid===v.a)return toast("Pick two different teams.");
  const get=async id=>{try{return (await getDoc(doc(db,"squads",id))).data()||{};}catch{return{};}};
  const mk=d=>[...new Set([d.captain_name,...(d.player_list||[])].filter(Boolean))];
  const[da,db]=[await get(v.a),await get(bid)];
  const pa=mk(da),pb=mk(db);
  const na=(SqTeams.find(t=>t.id===v.a)||{}).name||"Team A",nb=opp.name||"Team B";
  if(pa.length<2)return toast(na+" needs at least 2 players — open the squad and add names.");
  if(pb.length<2)return toast(nb+" needs at least 2 players.");
  const firstBat=v.bat!=="b";
  const fa=firstBat?{id:v.a,d:da,n:na}:{id:bid,d:db,n:nb};
  const fb=firstBat?{id:bid,d:db,n:nb}:{id:v.a,d:da,n:na};
  const p1=mk(fa.d),p2=mk(fb.d);
  const ta=SqTeams.find(t=>t.id===fa.id)||{},tb=SqTeams.find(t=>t.id===fb.id)||{};
  const tid=[ta.tid,tb.tid].find(t=>t&&schedTours().some(x=>x.id===t))||"";
  const oppContact=((opp.owner||"").toLowerCase())||(teamCoOwners(bid)[0]||"")||(teamEditors(bid)[0]||"");
  const id=Array.from({length:6},()=>"ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.random()*32|0]).join("");
  try{
    await setDoc(scRef(id),{tid,t1:fa.id,t2:fb.id,n1:fa.n,n2:fb.n,pl1:p1,pl2:p2,c1:fa.d.captain_name||"",c2:fb.d.captain_name||"",challenged:oppContact,overs:Math.max(1,Math.min(50,+v.ov||10)),ball:"Leather",when:Date.now(),venue:"",city:"",tossWon:"",tossDec:"",status:"live",bat1:1,innings:1,runs:0,balls:0,history:[],inn1:0,inn1w:0,inn1b:0,cur:null,created:Date.now(),owner:myEmail()});
  }catch(e){return toast(e.message||"Couldn't start match.");}
  setView("scorer");scOpenMatch(id);
}
async function scSchedule(forceFr){
  const stnOpts=schedTours();
  const frMode=!!forceFr||(!Auth.admin&&!stnOpts.length);
  ScS.view="schedule";
  setBack(scList);
  scRoot().innerHTML=`<div class="w"><div class="mut c">Loading teams…</div></div>`;
  try{
    if(!ScSquadsCache){const sn=await getDocs(collection(db,"squads"));ScSquadsCache=sn.docs.map(d=>{const x=d.data()||{};return{id:d.id,name:x.team_name||d.id,tid:x.tournament===undefined?"default":x.tournament,cap:x.captain_name||"",pl:[...new Set([x.captain_name,...(x.player_list||[])].filter(Boolean))]};});}
  }catch(e){scRoot().innerHTML=`<div class="w"><div class="msg">${esc(e.message)}</div></div>`;return;}
    const now=new Date(Date.now()-new Date().getTimezoneOffset()*6e4).toISOString().slice(0,16);
  const S={step:1,fr:frMode,tid:frMode?"":(stnOpts[0]||{}).id||"",sid:"",kind:"GROUP_MATCH",t1:"",t2:"",oppQ:"",ov:10,bl:"Leather",dt:now,vn:"",cy:"",tw:"",td:""};
  const SNS=["Context","Teams","Settings","Review"];
  const gOf=tm=>{const st=stageOf(S.tid,S.sid);for(const g of((st&&st.groups)||[])){if((g.teamIds||[]).includes(tm))return g.id;}return "";};
  const pool=()=>{const pl=(S.fr||!S.tid?ScSquadsCache:ScSquadsCache.filter(x=>x.tid===S.tid)).slice().sort((x,y)=>x.name.localeCompare(y.name));const best=new Map();pl.forEach(x=>{const k=(S.fr?x.tid+"|":"")+normName(x.name);const mc=ScMatches.filter(m=>m.t1===x.id||m.t2===x.id).length;const sc=(gOf(x.id)?1000000:0)+mc*1000+((x.pl||[]).length||0);if(!best.has(k)||sc>best.get(k).sc)best.set(k,{t:x,sc});});return[...best.values()].map(v=>v.t);};
  const tnameOf=id=>{const x=pool().find(y=>y.id===id);return x?x.name:"";};
  const head=t=>`<div class="w"><div class="mc-head"><div class="mc-ttl">Schedule Match</div><div class="mc-sub">Step ${S.step} of 4 · ${t}</div></div><div id="msg" class="msg"></div>`;
  const backRow=(nx,back)=>`<div style="display:flex;gap:8px;margin-top:12px">${back?`<button class="btn s" id="st-b" style="flex:1">Back</button>`:""}<button class="btn" id="st-n" style="flex:2">${nx}</button></div></div>`;
  const wire=()=>{setBack(()=>{if(S.step>1){S.step--;render();}else scList();});const b=scRoot().querySelector("#st-b");if(b)b.onclick=()=>{S.step--;render();};};
  const render=()=>{({1:r1,2:r2,3:r3,4:r4})[S.step]();};
  const fillSsg=async()=>{const s=$("#ssg");if(!s)return;let sts=[];try{sts=await loadStages(S.fr?"":S.tid);}catch{}const cur=S.sid;s.innerHTML=`<option value="">No stage - standalone / league match</option>`+sts.map(x=>`<option value="${esc(x.id)}" ${cur===x.id?"selected":""}>${x.order||0} - ${esc(x.name)} - ${esc(stageTypeLabel(x.type))}</option>`).join("");s.value=cur;};
  const r1=()=>{
    scRoot().innerHTML=head(SNS[0])+`<label>Match type</label>${(stnOpts.length||Auth.admin)?`<div style="display:flex;gap:8px;margin:4px 0 10px"><button class="btn s sm${S.fr?" on":""}" id="mk-fr" style="flex:1">Friendly</button><button class="btn s sm${S.fr?"":" on"}" id="mk-tr" style="flex:1">Tournament</button></div>`:`<div class="tg" style="margin:4px 0 10px">Friendly match — you don't manage a tournament.</div>`}<div id="stn-w" style="${S.fr?"display:none":""}"><label>Tournament</label><select id="stn">${stnOpts.map(x=>`<option value="${esc(x.id)}" ${S.tid===x.id?"selected":""}>${esc(x.name)}${tourSeasonYear(x.id)?` - ${esc(tourSeasonYear(x.id))}`:""}</option>`).join("")}</select></div><div id="ssg-w" style="${S.fr?"display:none":""}"><label>Stage (optional)</label><select id="ssg"><option value="">No stage - standalone / league match</option></select></div><div id="skd-w" style="${S.fr?"display:none":""}"><label>Match label</label><select id="skd">${MATCH_KINDS.map(([v,x])=>`<option value="${v}" ${S.kind===v?"selected":""}>${x}</option>`).join("")}</select></div>`+backRow("Next",false);
    wire();
    const bf=$("#mk-fr");if(bf)bf.onclick=()=>{S.fr=true;S.tid="";S.sid="";render();};
    const bt=$("#mk-tr");if(bt)bt.onclick=()=>{S.fr=false;S.tid=(stnOpts[0]||{}).id||"";S.sid="";render();};
    const stn=$("#stn");if(stn)stn.onchange=()=>{S.tid=stn.value;S.sid="";fillSsg();};
    const ssg=$("#ssg");if(ssg)ssg.onchange=()=>{S.sid=ssg.value;};
    const skd=$("#skd");if(skd)skd.onchange=()=>{S.kind=skd.value;};
    scRoot().querySelector("#st-n").onclick=()=>{if(!S.fr){const a=$("#stn"),g=$("#ssg"),k=$("#skd");S.tid=a?a.value:"";S.sid=g?g.value:"";S.kind=k?k.value:S.kind;if(!S.tid)return scFlash("Pick a tournament or go Friendly.");}else{S.tid="";S.sid="";S.kind=($("#skd")||{}).value||S.kind;}const d=tourDefOvers(S.tid);if(d)S.ov=d;S.t1="";S.t2="";S.step=2;render();};
    fillSsg();
  };
  const lbl=t=>{const st=stageOf(S.tid,S.sid);const g=groupOf(st,gOf(t.id));return `${esc(t.name)}${S.fr&&t.tid?` (${esc(tname(t.tid))})`:""}${g?` (${esc(g.name)})`:""}`;};
  const r2=()=>{
    if(S.fr){
      const p=pool().filter(x=>canEditSquad(x.id));
      if(!p.length){scRoot().innerHTML=head(SNS[1])+`<div class="msg">Create your team first.</div>`+backRow("Next");wire();scRoot().querySelector("#st-n").onclick=()=>scFlash("Create your team first.");return;}
      if(!p.some(x=>x.id===S.t1))S.t1=p[0].id;
      scRoot().innerHTML=head(SNS[1])+`<div class="mut c">Friendly match</div><label>Your team</label><select id="ta">${p.map(x=>`<option value="${esc(x.id)}" ${S.t1===x.id?"selected":""}>${lbl(x)}</option>`).join("")}</select><label>Opponent (team code, ID or name)</label><input id="tbq" type="text" placeholder="e.g. KX7Q2P or Falcons XI" value="${esc(S.oppQ||"")}"><div class="hint">Ask the other team for their code (Team page → Team Code).</div>`+backRow("Next");
      wire();
      $("#ta").onchange=()=>{S.t1=$("#ta").value;};
      $("#tbq").oninput=()=>{S.oppQ=$("#tbq").value;};
      scRoot().querySelector("#st-n").onclick=()=>{S.t1=$("#ta").value;S.oppQ=$("#tbq").value;const r=resolveTeam(S.oppQ);if(r.err)return scFlash(r.err);if(r.team.id===S.t1)return scFlash("Pick two different teams.");S.t2=r.team.id;S.step=3;render();};
      return;
    }
    const p=pool();
    if(!p.length){scRoot().innerHTML=head(SNS[1])+`<div class="msg">No teams available - create teams first.</div>`+backRow("Next");wire();scRoot().querySelector("#st-n").onclick=()=>scFlash("No teams available.");return;}
    if(!p.some(x=>x.id===S.t1))S.t1=p[0].id;
    const t2p=p.filter(x=>x.id!==S.t1);
    if(!t2p.some(x=>x.id===S.t2))S.t2=(t2p[0]||{}).id||"";
    scRoot().innerHTML=head(SNS[1])+`<div class="mut c">${S.fr?"Friendly match":esc(tname(S.tid))}${S.sid?" - "+esc(stageName(S.tid,S.sid)):""} - any group, incl. cross-group</div><label>Team 1</label><select id="ta">${p.map(x=>`<option value="${esc(x.id)}" ${S.t1===x.id?"selected":""}>${lbl(x)}</option>`).join("")}</select><label>Team 2</label><select id="tb">${t2p.map(x=>`<option value="${esc(x.id)}" ${S.t2===x.id?"selected":""}>${lbl(x)}</option>`).join("")}</select>`+backRow("Next");
    wire();
    $("#ta").onchange=()=>{S.t1=$("#ta").value;S.t2="";render();};
    $("#tb").onchange=()=>{S.t2=$("#tb").value;};
    scRoot().querySelector("#st-n").onclick=()=>{S.t1=$("#ta").value;S.t2=$("#tb").value;if(!S.t1||!S.t2||S.t1===S.t2)return scFlash("Pick two different teams.");S.step=3;render();};
  };
  const r3=()=>{
    const n1=tnameOf(S.t1)||"Team 1",n2=tnameOf(S.t2)||"Team 2";
    scRoot().innerHTML=head(SNS[2])+`<label>Match overs</label><div style="display:flex;gap:6px;margin:4px 0 10px;flex-wrap:wrap">${[5,10,15,20,50].map(o=>`<button class="btn s sm${S.ov===o?" on":""}" data-ov="${o}" style="flex:1">T${o>=50?"50":o}</button>`).join("")}</div><input id="ov" type="number" min="1" max="50" value="${S.ov}"><label>Ball type</label><select id="bl">${["Leather","Tennis","Synthetic","Other"].map(x=>`<option ${S.bl===x?"selected":""}>${x}</option>`).join("")}</select><label>Date &amp; time</label><input id="dt" type="datetime-local" value="${esc(S.dt)}"><label>Ground name</label><input id="vn" type="text" placeholder="e.g. King Fahd Stadium" value="${esc(S.vn)}"><label>City</label><input id="cy" type="text" placeholder="e.g. Riyadh" value="${esc(S.cy)}"><label>Toss won by (optional)</label><select id="tw"><option value="">Not decided yet</option>${[n1,n2].map(n=>`<option ${S.tw===n?"selected":""}>${esc(n)}</option>`).join("")}</select><label>Toss decision</label><select id="td"><option value="">-</option>${["Bat","Bowl"].map(x=>`<option ${S.td===x?"selected":""}>${x}</option>`).join("")}</select>`+backRow("Next");
    wire();
    scRoot().querySelectorAll("[data-ov]").forEach(b=>b.onclick=()=>{S.ov=+b.dataset.ov;render();});
    scRoot().querySelector("#st-n").onclick=()=>{S.ov=Math.max(1,+$("#ov").value||10);S.bl=$("#bl").value;S.dt=$("#dt").value||S.dt;S.vn=$("#vn").value.trim();S.cy=$("#cy").value.trim();S.tw=$("#tw").value;S.td=$("#td").value;S.step=4;render();};
  };
  const r4=()=>{
    const st=stageOf(S.tid,S.sid);
    const gn=id=>{const g=groupOf(st,id);return g?g.name:"no group";};
    const g1=gOf(S.t1),g2=gOf(S.t2);
    const rows=[["Match",S.fr?"Friendly":tname(S.tid)],["Stage",st?st.name+" ("+stageTypeLabel(st.type)+")":"-"],["Type",kindLabel(S.kind)],["Team 1",tnameOf(S.t1)+(S.sid?" ("+gn(g1)+")":"")],["Team 2",tnameOf(S.t2)+(S.sid?" ("+gn(g2)+")":"")],["Overs",S.ov],["Ball",S.bl],["When",S.dt],["Venue",[S.vn,S.cy].filter(Boolean).join(", ")||"-"],["Toss",S.tw?S.tw+" ("+(S.td||"no decision")+")":"-"]];
    scRoot().innerHTML=head(SNS[3])+rows.map(([k,v])=>`<div class="row"><b>${k}</b><span>${esc(String(v))}</span></div>`).join("")+`<button class="btn" id="pn">Play Now</button><div style="display:flex;gap:8px;margin-top:8px"><button class="btn s" id="st-b" style="flex:1">Back</button><button class="btn" id="st-n" style="flex:2">Schedule</button></div></div>`;
    wire();
    scRoot().querySelector("#st-n").onclick=()=>doSave(false);
    scRoot().querySelector("#pn").onclick=()=>doSave(true);
  };
  const doSave=open=>{
    if(needAccount())return scFlash("Sign in to schedule matches.");
    if(S.tid&&!schedTours().some(t=>t.id===S.tid))return scFlash("Not allowed in this tournament.");
    const sq=id=>ScSquadsCache.find(x=>x.id===id);
    const a=sq(S.t1),b=sq(S.t2);
    if(!S.t1||!S.t2||S.t1===S.t2||!a||!b)return scFlash("Pick two different teams.");
    if(open&&((a.pl||[]).length<2||(b.pl||[]).length<2))return scFlash("Both squads need at least 2 players to start now - or Schedule it and add players later.");
    const gg1=S.fr?"":gOf(S.t1),gg2=S.fr?"":gOf(S.t2);
    const oppT=SqTeams.find(x=>x.id===S.t2)||{};
    const contact=S.fr?(((oppT.owner||"").toLowerCase())||(teamCoOwners(S.t2)[0]||"")||(teamEditors(S.t2)[0]||"")):"";
    const id=rid("");
    scAct(async()=>{
      await setDoc(scRef(id),{tid:S.fr?"":S.tid,t1:S.t1,t2:S.t2,n1:a.name,n2:b.name,pl1:a.pl,pl2:b.pl,c1:a.cap,c2:b.cap,overs:S.ov,ball:S.bl,when:new Date(S.dt).getTime()||Date.now(),venue:S.vn,city:S.cy,tossWon:S.tw,tossDec:S.td,challenged:contact,stageId:S.fr?"":S.sid,groupId:(gg1&&gg1===gg2)?gg1:"",g1:gg1,g2:gg2,kind:S.fr?"":S.kind,status:"scheduled",bat1:null,innings:1,runs:0,balls:0,history:[],inn1:0,inn1w:0,created:Date.now(),owner:myEmail()});
      ScSquadsCache=null;
      if(open){toast("Match ready - good luck!");scOpenMatch(id);}else{if(S.fr&&!contact)toast("Scheduled — but the opponent team has no owner account, so only you can score it. Ask them to claim their team.");else toast("Match scheduled - share the fixture card.");ScS.tab="m";ScS.mt="u";ScS.fq="";ScS.tour=S.fr?"friendly":S.tid;scList();}
    });
  };
  render();
}
function transferModal(m){
  if(m.status!=="live"||scInfo(m).done)return toast("Only live matches can be transferred.");
  const tok=Array.from({length:8},()=>"ABCDEFGHJKMNPQRSTUVWXYZ23456789"[Math.random()*32|0]).join("");
  const exp=Date.now()+15*60*1000;
  scAct(()=>updateDoc(scRef(m.id),{transferToken:tok,transferExp:exp}).then(()=>{
    const link=basePage()+"?transfer="+m.id+"&token="+tok;
    const ov=document.createElement("div");ov.className="app-modal-ov";
    ov.innerHTML=`<div class="app-modal"><div class="app-modal-t">🔄 Transfer Scoring</div><div class="app-modal-msg">One-time link or QR, valid 15 minutes. Whoever opens or scans it and signs in takes over scoring from you.</div><div class="mut" style="word-break:break-all;font-size:13px;margin-bottom:8px">${esc(link)}</div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px"><button class="hm-btn sec" style="width:auto" id="tf-cp">📋 Copy</button><button class="hm-btn sec" style="width:auto" id="tf-sh">📤 Share</button><button class="hm-btn sec" style="width:auto" id="tf-rv">Revoke</button></div><div id="tf-qr" style="display:flex;justify-content:center;padding:8px;background:#fff;border-radius:12px;max-width:232px;margin:0 auto"></div><div class="app-modal-btns"><button class="hm-btn sec" data-x="0">Close</button></div></div>`;
    document.body.appendChild(ov);
    ov.querySelector('[data-x="0"]').onclick=()=>ov.remove();
    ov.addEventListener("mousedown",e=>{if(e.target===ov)ov.remove();});
    ov.querySelector("#tf-cp").onclick=()=>navigator.clipboard.writeText(link).then(()=>toast("Transfer link copied."));
    ov.querySelector("#tf-sh").onclick=()=>appShare({title:"Transfer scoring",sub:"One-time link, valid 15 minutes",link,waText:"Score this match with me:\n"+link});
    ov.querySelector("#tf-rv").onclick=()=>{scAct(()=>updateDoc(scRef(m.id),{transferToken:"",transferExp:0}).then(()=>{toast("Transfer revoked.");ov.remove();}));};
    try{if(window.QRCode)new QRCode(ov.querySelector("#tf-qr"),{text:link,width:200,height:200,correctLevel:QRCode.CorrectLevel.M});}catch{}
  }));
}
async function claimTransfer(mid,tok){
  if(!auth.currentUser||auth.currentUser.isAnonymous){try{const cur=localStorage.getItem("scPendingTransfer");if(cur!==mid+"|"+tok){localStorage.setItem("scPendingTransfer",mid+"|"+tok);toast("Sign in to accept the scoring handover — you'll continue automatically.");}}catch{}setView("home");return;}
  let snap=null;try{snap=await getDoc(scRef(mid));}catch(e){snap=null;}
  if(!snap||!snap.exists()){setView("home");toast("Transfer link invalid.");return;}
  const m={...snap.data(),id:snap.id,history:snap.data().history||[]};
  if(m.status!=="live"||scInfo(m).done){setView("home");toast("That match is no longer live.");return;}
  if(!m.transferToken||m.transferToken!==tok||(m.transferExp||0)<Date.now()){setView("home");toast("Transfer link expired or already used.");return;}
  try{
    await updateDoc(scRef(mid),{scoredBy:myEmail(),scoredAt:Date.now(),grant:myEmail(),transferToken:"",transferExp:0,reqBy:"",reqAt:0});
    ScS.claimed=true;
    try{history.replaceState(null,"",location.pathname+"?match="+mid);}catch{}
    setView("scorer");scOpenMatch(mid);toast("Scoring handed over to you.");
  }catch(e){setView("home");toast(e.message||"Couldn't accept transfer.");}
}
function scOpenMatch(id){
  try{window.scrollTo(0,0);}catch{}
  ScS.view="match";ScS.ex=false;ScS.editInfo=false;ScS.endMenu=false;ScS.claimed=false;ScS.sel={1:[],2:[]};ScS.sumOpen=undefined;ScS.out=null;ScS.cb=false;ScS.pk={};ScS.pkOpenKey="";ScS.pkBatKey="";ScS.pkBowlKey="";if(ScS.unsubM)ScS.unsubM();
  ScS.unsubM=onSnapshot(scRef(id),s=>{
    if(!s.exists()){scRoot().innerHTML=`<div class="w"><div class="msg">Match not found.</div></div>`;setBack(scList);return;}
    ScS.m={...s.data(),id:s.id,history:s.data().history||[]};manageClaim();scMatchView();
  });
  ensureLockTick();
}
// Scoring lock: one live scorer at a time. The scorer keeps the pad until they hand it over (Transfer scoring) or approve a take-over request.
const claimActive=m=>{const by=(m.scoredBy||"").toLowerCase();return !!by&&by!==myEmail();};
const claimMine=m=>((m.scoredBy||"").toLowerCase()===myEmail());
// Take-over requests: requester writes reqBy/reqAt; active scorer approves or denies; expires after 2 minutes.
const REQ_MS=120000;
const reqLive=m=>{const b=(m.reqBy||"").toLowerCase();return!!b&&(Date.now()-(m.reqAt||0))<REQ_MS;};
const reqMine=m=>reqLive(m)&&(m.reqBy||"").toLowerCase()===myEmail();
const reqWho=e=>{const em=String(e||"").toLowerCase();const t=SqTeams.find(x=>((x.owner||"").toLowerCase())===em||teamEditors(x.id).includes(em)||teamCoOwners(x.id).includes(em));return t?t.name:(em||"Someone");};
// While in a match view, re-check the lock and request state every 15s so an expired request clears itself.
function ensureLockTick(){
  if(ScS.lockT)return;
  ScS.lockT=setInterval(()=>{
    if(ScS.view!=="match"||!ScS.m){clearInterval(ScS.lockT);ScS.lockT=null;return;}
    const m=ScS.m;if(m.status!=="live")return;
    if(ScS.editInfo||ScS.endMenu||ScS.out||ScS.cb||ScS.ex)return;
    const lock=m.status==="live"&&!scInfo(m).done&&claimActive(m),rq=reqLive(m);
    if(lock!==ScS.lockSeen||rq!==ScS.reqLive){ScS.lockSeen=lock;ScS.reqLive=rq;manageClaim();scMatchView();}
  },15000);
}
// In-app Allow/Deny dialog for the active scorer when someone requests take-over.
function scReqDialog(mid,by){
  if(document.querySelector(".req-ov"))return;
  const ov=document.createElement("div");ov.className="app-modal-ov req-ov";
  ov.innerHTML=`<div class="app-modal"><div class="app-modal-t">✊ Take Over Request</div><div class="app-modal-msg">${esc(reqWho(by))} wants to take over scoring of this match. Allow?</div><div class="app-modal-btns"><button class="hm-btn sec" data-x="0">Deny</button><button class="hm-btn" data-x="1">✊ Allow</button></div></div>`;
  document.body.appendChild(ov);
  const done=v=>{ov.remove();if(v){ScS.claimed=false;}scAct(()=>updateDoc(scRef(mid),v?{scoredBy:by,scoredAt:Date.now(),grant:by,reqBy:"",reqAt:0}:{reqBy:"",reqAt:0}));};
  ov.querySelector('[data-x="0"]').onclick=()=>done(false);
  ov.querySelector('[data-x="1"]').onclick=()=>done(true);
  ov.addEventListener("mousedown",e=>{if(e.target===ov)done(false);});
  ov.addEventListener("keydown",e=>{if(e.key==="Escape")done(false);else if(e.key==="Enter")done(true);});
}
// App-wide alerts: take-over requests aimed at the active scorer, and challenges aimed at me.
function scAlerts(){
  if(!Auth.user||isAnon())return;
  const em=myEmail();if(!em)return;
  const seen=ScS.reqSeen||(ScS.reqSeen={});
  ScMatches.forEach(m=>{
    if(m.status!=="live"||!claimMine(m)||!reqLive(m)||reqMine(m))return;
    if(seen[m.id]===(m.reqAt||0))return;
    seen[m.id]=m.reqAt||0;
    scReqDialog(m.id,(m.reqBy||"").toLowerCase());
  });
  ScMatches.forEach(m=>{
    if((m.challenged||"").toLowerCase()!==em||m.status!=="scheduled")return;
    let sm={};try{sm=JSON.parse(localStorage.getItem("scChalSeen")||"{}");}catch{}
    const k=em+"|"+m.id;if(sm[k])return;
    sm[k]=1;const ks=Object.keys(sm);if(ks.length>150)ks.slice(0,ks.length-150).forEach(x=>delete sm[x]);
    try{localStorage.setItem("scChalSeen",JSON.stringify(sm));}catch{}
    const mt2=[m.t1,m.t2].find(id=>SqTeams.some(t=>t.id===id&&canEditSquad(t.id)));
    toast("⚔️ "+(mt2?(mt2===m.t1?m.n2:m.n1):"A team")+" challenged you — see My Cricket → Matches.");
  });
}
function manageClaim(){
  const m=ScS.m;if(!m)return;
  if(m.status!=="live"||!canScore(m)||!Auth.user){ScS.claimed=claimMine(m);return;}
  if(claimMine(m)){ScS.claimed=true;return;}
  if(!claimActive(m)&&!ScS.claimed){ScS.claimed=true;scAct(async()=>{await updateDoc(scRef(m.id),{scoredBy:myEmail(),scoredAt:Date.now()});if((m.reqBy||"").toLowerCase()===myEmail())await updateDoc(scRef(m.id),{reqBy:"",reqAt:0}).catch(()=>{});});return;}
  ScS.claimed=false;
}
const scBall=(kind,v,w)=>scAct(()=>{
  const m=ScS.m,c=m.cur,by=kind==="by"||kind==="lb",legal=(kind&&!by)?0:1,r=by?v:(kind?v+1:v);
  const e={r,b:legal,w:w?1:0,e:kind,br:(kind==="wd"||by)?0:v};
  const u={runs:m.runs+r,balls:m.balls+legal};
  if(c){Object.assign(e,{s:c.s??null,o:c.b??null,p:[c.s??null,c.n??null,c.b??null,c.lb??null]});let s=c.s,n=c.n,b=c.b,lb=c.lb??null;if(v%2)[s,n]=[n,s];if(w)s=null;if(legal&&u.balls%6===0){[s,n]=[n,s];lb=b;b=null;}u.cur={s:s??null,n:n??null,b:b??null,lb};}
  u.history=[...m.history,e];return updateDoc(scRef(m.id),u);
});
const scUndo=()=>scAct(()=>{
  const h=[...ScS.m.history],l=h.pop();
  if(!l&&!ScS.m.endType)return;
  const u={runs:Math.max(0,ScS.m.runs-(l?l.r:0)),balls:Math.max(0,ScS.m.balls-(l?l.b:0)),history:h,status:"live"};
  if(l&&l.p)u.cur={s:l.p[0],n:l.p[1],b:l.p[2],lb:l.p[3]};
  if(ScS.m.endType){u.endType="";u.walkoverWinner="";u.endNote="";}
  return updateDoc(scRef(ScS.m.id),u);
});
const scWicket=(k,d,v=0,f=null)=>scAct(()=>{
  const m=ScS.m,c=m.cur;
  const e={r:v,b:1,w:1,e:"",br:v,s:c.s??null,o:c.b??null,d,k,f,p:[c.s??null,c.n??null,c.b??null,c.lb??null]};
  const u={runs:m.runs+v,balls:m.balls+1};
  let s=c.s,n=c.n,b=c.b,lb=c.lb??null;
  if(v%2)[s,n]=[n,s];
  if(s===d)s=null;else if(n===d)n=null;
  if(u.balls%6===0){[s,n]=[n,s];lb=b;b=null;}
  u.cur={s:s??null,n:n??null,b:b??null,lb};u.history=[...m.history,e];
  return updateDoc(scRef(m.id),u);
});
const scWicketEx=(k,d,v=0,f=null,ex="wd")=>scAct(()=>{
  const m=ScS.m,c=m.cur;
  const e={r:v+1,b:0,w:1,e:ex,br:k==="ro"?v:0,s:c.s??null,o:c.b??null,d,k,f,p:[c.s??null,c.n??null,c.b??null,c.lb??null]};
  const u={runs:m.runs+v+1,balls:m.balls};
  let s=c.s,n=c.n,b=c.b,lb=c.lb??null;
  if(v%2)[s,n]=[n,s];
  if(s===d)s=null;else if(n===d)n=null;
  u.cur={s:s??null,n:n??null,b:b??null,lb};u.history=[...m.history,e];
  return updateDoc(scRef(m.id),u);
});
const scRetire=(k,d)=>scAct(()=>{
  const m=ScS.m,c=m.cur;let s=c.s,n=c.n;
  if(s===d)s=null;else n=null;
  const e={r:0,b:0,w:k==="rtd"?1:0,e:"ret",br:0,s:null,o:null,d,k,f:null,p:[c.s??null,c.n??null,c.b??null,c.lb??null]};
  return updateDoc(scRef(m.id),{cur:{s:s??null,n:n??null,b:c.b??null,lb:c.lb??null},history:[...m.history,e]});
});
function scInn(h,cur){
  const order=[],seen=new Set(),add=n=>{if(n&&!seen.has(n)){seen.add(n);order.push(n);}};
  h.forEach(x=>{if(x.p){add(x.p[0]);add(x.p[1]);}});
  if(cur){add(cur.s);add(cur.n);}
  const outs=new Set(h.filter(x=>x.w).map(x=>x.d||x.s)),bw=[];
  const how=n=>{
    if(cur&&(cur.s===n||cur.n===n))return"";
    const x=[...h].reverse().find(y=>(y.d||y.s)===n&&(y.w||y.k==="rth"));if(!x)return"";
    const o=x.o||"",f=x.f;
    return({b:`b ${o}`,c:f?(f===o?`c & b ${o}`:`c ${f} b ${o}`):`caught b ${o}`,lbw:`lbw b ${o}`,st:`st ${f||""} b ${o}`,hw:`hit wicket b ${o}`,ro:`run out${f?` (${f})`:""}`,rtd:"retired out",rth:"retired hurt"})[x.k]||"out";
  };
  h.forEach(x=>{if(x.o&&!bw.includes(x.o))bw.push(x.o);});
  const bs={};
  h.forEach(x=>{if(!x.s)return;const s=bs[x.s]??={r:0,b:0,f4:0,f6:0};s.r+=x.br||0;if(x.e!=="wd")s.b++;if((x.br||0)===4)s.f4++;if((x.br||0)===6)s.f6++;});
  return{bats:order.map(n=>{const s=bs[n]||{r:0,b:0,f4:0,f6:0};return{n,r:s.r,b:s.b,f4:s.f4,f6:s.f6,out:outs.has(n),how:how(n)};}),bows:bw.map(n=>({n,f:scWStat(h,n)})),wd:h.filter(x=>x.e==="wd").reduce((a,x)=>a+x.r,0),nb:h.filter(x=>x.e==="nb").length,by:h.filter(x=>x.e==="by").reduce((a,x)=>a+x.r,0),lb:h.filter(x=>x.e==="lb").reduce((a,x)=>a+x.r,0)};
}
// ---- admin corrections: two players whose names got crossed on a scorecard ----
// A remap renames players inside one innings and touches nothing else. Every delivery keeps
// its runs, balls and wicket, so the team total, the overs, the result and the points table
// are all unchanged - only the names attached to each delivery move. That is what makes a
// swap safe: the figures each player is given travel with the name, so a crossed card can be
// put right without editing a single number.
const scRemapNames=(hist,cur,pairs,kind,only)=>{
  const map={};
  (pairs||[]).forEach(p=>{if(p&&p[0]&&p[1]&&p[0]!==p[1])map[p[0]]=p[1];});
  const rem=v=>{if(!v||!Object.prototype.hasOwnProperty.call(map,v))return v;return map[v];};
  // Only a key that is already there is renamed. A delivery the scoring pad wrote has no
  // d/k/f at all unless it was a wicket, and never has an n, so touching those blindly
  // would invent them with an undefined value - which Firestore refuses to store.
  const rename=(y,key)=>{
    if(!Object.prototype.hasOwnProperty.call(y,key))return;
    const nv=rem(y[key]);
    if(nv===undefined)delete y[key];else y[key]=nv;
  };
  const idx=[];
  const history=(hist||[]).map((x,i)=>{
    if(only&&!only.includes(i))return x;
    const y={...x};
    if(kind==="bowl"){
      rename(y,"o");
      if(Array.isArray(y.p))y.p=y.p.map((v,k)=>{const nv=(k===2||k===3)?rem(v):v;return nv===undefined?null:nv;});
    }else{
      rename(y,"s");rename(y,"n");rename(y,"d");
      if(Array.isArray(y.p))y.p=y.p.map((v,k)=>{const nv=(k<2)?rem(v):v;return nv===undefined?null:nv;});
    }
    if(JSON.stringify(y)!==JSON.stringify(x))idx.push(i);
    return y;
  });
  const c=cur?{...cur}:null;
  if(c){
    if(kind==="bowl"){rename(c,"b");rename(c,"lb");}
    else{rename(c,"s");rename(c,"n");}
  }
  return{history,cur:c,idx};
};
// Firestore refuses to store undefined, so anything that was never written has to stay
// absent. This is the last line of defence before a write. Array elements count too - an
// undefined inside an array is rejected just as firmly as an undefined field.
const scClean=v=>{
  if(Array.isArray(v))return v.map(x=>x===undefined?null:scClean(x));
  if(v&&typeof v==="object"){const o={};Object.keys(v).forEach(k=>{if(v[k]!==undefined)o[k]=scClean(v[k]);});return o;}
  return v;
};
// Finds anything Firestore will refuse: an undefined value, or an array whose own element
// is another array. The writer rejects both, and neither error names the field. The nested
// array is the one to watch - a list of pairs written into the audit log is the natural way
// to record a rename, and it is exactly what Firestore will not take.
const scBadPaths=(v,p,out)=>{
  if(v===undefined){out.push((p||"(root)")+" = undefined");return out;}
  if(v===null||typeof v!=="object")return out;
  if(Array.isArray(v)){
    v.forEach((x,i)=>{
      if(Array.isArray(x)){out.push((p||"(root)")+"["+i+"] = nested array");return;}
      scBadPaths(x,p+"["+i+"]",out);
    });
    return out;
  }
  Object.keys(v).forEach(k=>scBadPaths(v[k],p?p+"."+k:k,out));
  return out;
};
// Which array holds a given innings. hist1 keeps the first innings once the second has
// started; history always holds the innings in progress, and cur belongs to that one only.
const scInnState=(m,inn)=>{
  if(m.innings===2&&inn===1)return{key:"hist1",hist:m.hist1||[],cur:null,current:false};
  return{key:"history",hist:m.history||[],cur:m.cur||null,current:true};
};
// The batting and bowling sides of a given innings.
const scInnTeams=(m,inn)=>{
  const fi=m.bat1===2?2:1;
  const kb=inn===1?fi:3-fi;
  return{bat:kb,bowl:3-kb};
};
const scRunsOf=h=>(h||[]).reduce((a,x)=>a+(x.r||0),0);
const scBallsOf=h=>(h||[]).reduce((a,x)=>a+(x.b||0),0);
// The players who appear in one innings, with the figures they currently have.
const scInnPlayers=(m,inn,kind)=>{
  const s=scInnState(m,inn);
  const d=scInn(s.hist,s.current?s.cur:null);
  if(kind==="bowl")return d.bows.map(x=>({n:x.n,s:x.f}));
  return d.bats.map(x=>({n:x.n,s:`${x.r} (${x.b})${x.out?" · out":""}`}));
};
// Everyone who could take the other slot: the players in this innings, plus anyone in that
// side's squad who did not take part. Swapping with one of those is a rename, because they
// have no deliveries of their own to move.
const scInnCandidates=(m,inn,kind,exclude)=>{
  const s=scInnState(m,inn);
  const d=scInn(s.hist,s.current?s.cur:null);
  const seen=new Set(),out=[];
  const add=(n,sub)=>{if(!n||seen.has(n)||n===exclude)return;seen.add(n);out.push({v:n,t:n,s:sub||""});};
  if(kind==="bowl")d.bows.forEach(x=>add(x.n,x.f));
  else d.bats.forEach(x=>add(x.n,`${x.r} (${x.b})${x.out?" · out":""}`));
  const tk=scInnTeams(m,inn);
  const k=kind==="bowl"?tk.bowl:tk.bat;
  const squad=[...(m["xi"+k]||[]),...(m["pl"+k]||[])];
  squad.forEach(p=>add(p,""));
  return out;
};
// One player's card line, as it reads now and as it will read after the swap.
const scCardLine=(d,kind,n)=>{
  if(kind==="bowl"){const x=d.bows.find(y=>y.n===n);return x?`${x.n}  ${x.f}`:`${n}  -`;}
  const x=d.bats.find(y=>y.n===n);return x?`${x.n}  ${x.r} (${x.b})${x.out?" out":""}`:`${n}  -`;
};
// The confirmation text: what each of the two players' lines becomes, and the promise that
// the totals do not move.
const scSwapMessage=(m,inn,kind,a,b)=>{
  const s=scInnState(m,inn);
  const pairs=[[a,b],[b,a]];
  const before=scInn(s.hist,s.current?s.cur:null);
  const r=scRemapNames(s.hist,s.current?s.cur:null,pairs,kind);
  const after=scInn(r.history,r.current?r.cur:null);
  const rb=scRunsOf(s.hist),bb=scBallsOf(s.hist),ra=scRunsOf(r.history);
  return`Swap ${a} and ${b} in innings ${inn}?\n\n${scCardLine(before,kind,a)}   →   ${scCardLine(after,kind,a)}\n${scCardLine(before,kind,b)}   →   ${scCardLine(after,kind,b)}\n\nTeam total ${rb} runs from ${bb} balls stays ${ra}. The result and the points table do not change.`;
};
// Writes the swap and records it, so it can be audited and put back.
// When a swap cannot be saved, the reason is written into the match itself. The record is
// made only of plain strings and arrays, so this write always goes through - which is the
// whole point: the app can be asked what it tried to save instead of leaving it to be
// guessed at.
const scSwapFail=(m,inn,kind,pairs,stage,paths,sample)=>updateDoc(scRef(m.id),{
  fixLog:(m.fixLog||[]).concat([{at:Date.now(),by:myEmail(),what:"swap-failed",inn:inn||0,kind:kind||"",stage:stage||"",paths:(paths||[]).slice(0,8).map(String),pairs:JSON.stringify(pairs||[]),sample:String(sample||"").slice(0,3000)}]).slice(-20)
}).catch(()=>{}).then(()=>{
  throw new Error("Swap not saved"+(paths&&paths[0]?": "+paths[0]:"")+" ("+(stage||"write")+")");
});
const scApplySwap=(m,inn,kind,a,b)=>{
  const s=scInnState(m,inn);
  const pairs=[[a,b],[b,a]];
  const r=scRemapNames(s.hist,s.current?s.cur:null,pairs,kind);
  const u={};
  u[s.key]=r.history;
  if(s.current&&r.cur)u.cur=r.cur;
  // The rename is kept as two flat lists of names, never as a list of pairs: Firestore
  // refuses an array whose element is another array, and a list of pairs is the obvious
  // way to write it down.
  u.fixLog=(m.fixLog||[]).concat([{at:Date.now(),by:myEmail(),what:"swap",inn,kind,pf:[a,b],pt:[b,a],idx:r.idx,undone:false}]).slice(-20);
  // Preflight: never hand Firestore a payload it will reject. If something is undefined or
  // nested the exact path is recorded, so the problem can be named instead of hunted for.
  const bad=scBadPaths(u,"",[]);
  if(bad.length)return scSwapFail(m,inn,kind,pairs,"preflight",bad,JSON.stringify(u).slice(0,3000));
  // Firestore throws synchronously on a bad payload and rejects the promise on a failed
  // write, so both have to be caught or the reason is lost.
  try{
    return updateDoc(scRef(m.id),scClean(u)).catch(e=>scSwapFail(m,inn,kind,pairs,"write",[e.message],JSON.stringify(u).slice(0,3000)));
  }catch(e){
    return scSwapFail(m,inn,kind,pairs,"write",[e.message],JSON.stringify(u).slice(0,3000));
  }
};
// Puts a swap back. The inverse map is applied only to the deliveries that swap touched, so
// a rename that merged two lines merges them apart again.
const scUndoSwap=(m)=>{
  const log=m.fixLog||[];
  let at=-1;
  for(let i=log.length-1;i>=0;i--){if(log[i].what==="swap"&&!log[i].undone){at=i;break;}}
  if(at<0)return Promise.resolve();
  const e=log[at];
  const s=scInnState(m,e.inn);
  const inv=(e.pf&&e.pt)?e.pt.map((t,i)=>[t,e.pf[i]]):(e.pairs||[]).map(p=>[p[1],p[0]]);
  const r=scRemapNames(s.hist,s.current?s.cur:null,inv,e.kind,e.idx);
  const u={};
  u[s.key]=r.history;
  if(s.current&&r.cur)u.cur=r.cur;
  const next=log.slice();
  next[at]={...e,undone:true,undoneAt:Date.now(),undoneBy:myEmail()};
  u.fixLog=next;
  const bad=scBadPaths(u,"",[]);
  if(bad.length)return scSwapFail(m,e.inn,e.kind,inv,"preflight",bad,JSON.stringify(u).slice(0,3000));
  return updateDoc(scRef(m.id),scClean(u)).catch(e2=>scSwapFail(m,e.inn,e.kind,inv,"write",[e2.message],JSON.stringify(u).slice(0,3000)));
};
// Admin flow: pick the innings, pick the role, pick the two players, preview, confirm.
async function scSwapFlow(m){
  let inn=1;
  if(m.innings===2){
    const first=m.bat1===2?m.n2:m.n1,second=m.bat1===2?m.n1:m.n2;
    const v=await appPick({title:"Which innings?",sub:"A name is fixed inside one innings",options:[{v:"1",t:"1st innings",s:first},{v:"2",t:"2nd innings",s:second}]});
    if(!v)return;
    inn=+v;
  }
  const kind=await appPick({title:"Who got crossed?",options:[{v:"bat",t:"Batters",s:"Two batsmen's scores are mixed up"},{v:"bowl",t:"Bowlers",s:"Two bowlers' figures are mixed up"}]});
  if(!kind)return;
  const list=scInnPlayers(m,inn,kind);
  if(!list.length)return toast("Nobody has taken part in that innings yet.");
  const a=await appPick({title:kind==="bowl"?"Which bowler is wrong?":"Which batter is wrong?",sub:"Pick the one whose name is wrong",options:list.map(x=>({v:x.n,t:x.n,s:x.s}))});
  // appPick resolves undefined as well as null when a sheet is dismissed, so a plain
  // null check would let an undefined name slip through into the pairs.
  if(!a)return;
  const cands=scInnCandidates(m,inn,kind,a);
  if(!cands.length)return toast("There is nobody else to swap with.");
  const b=await appPick({title:"Who was it really?",sub:"Pick who it should say",options:cands});
  if(!b||b===a)return;
  if(!await appConfirm(scSwapMessage(m,inn,kind,a,b),"Swap"))return;
  scAct(()=>scApplySwap(m,inn,kind,a,b).then(()=>toast("Players swapped.")));
}
const tvFirst=n=>String(n||"").trim().split(/\s+/)[0]||"";
const tvName=(n,pool)=>pool&&pool.length?shortName(n,pool):tvFirst(n);
const tvSR=x=>x.b?((x.r/x.b*100).toFixed(2)):"–";
function tvTopBat(bats){return[...bats].sort((a,b)=>b.r-a.r).slice(0,3);}
function tvTopBowl(bows){return bows.map(x=>{const p=String(x.f||"").split("-");return{n:x.n,o:p[0]||"0.0",r:+(p[1]||0),w:+(p[2]||0)};}).sort((a,b)=>b.w-a.w||a.r-b.r).slice(0,3);}
function tvBlock(o){
  let body;
  if(o.yet){body=`<div class="tv-yet">YET TO BAT</div>`;}
  else{
    const br=(o.bats.length?o.bats.map((x,i)=>`<div class="tv-row bat${i%2?2:1}${i===0?" lead":""}"><span class="tv-nm">${esc(tvName(x.n,o.roster||[])).toUpperCase()}${x.out?"":"*"}</span><span class="tv-gd">${x.r}</span><span>${x.b}</span><span>${x.f4}</span><span>${x.f6}</span><span class="tv-hi tv-sr">${tvSR(x)}</span></div>`).join(""):`<div class="tv-row bat1"><span class="tv-nm">${o.batYet?"YET TO BAT":"–"}</span><span>–</span><span>–</span><span>–</span><span>–</span><span>–</span></div>`);
    const wr=(o.bowls.length?o.bowls.map((x,i)=>`<div class="tv-row bowl${i%2?2:1}"><span class="tv-nm">${esc(tvName(x.n,o.roster||[])).toUpperCase()}</span><span class="tv-hi">${x.o}</span><span>${x.r}</span><span class="tv-gd">${x.w}</span></div>`).join(""):`<div class="tv-row bowl1"><span class="tv-nm">${o.bowlYet?"YET TO BOWL":"–"}</span><span>–</span><span>–</span><span>–</span><span>–</span></div>`);
    body=`<div class="tv-grid"><div class="tv-bat"><div class="tv-hrow"><span>BATTER</span><span>R</span><span>B</span><span>4s</span><span>6s</span><span>SR</span></div>${br}</div><div class="tv-bowl"><div class="tv-hrow"><span>BOWLER</span><span>O</span><span>R</span><span>W</span></div>${wr}</div></div>`;
  }
  // The innings label is optional: the export poster leaves it out because the first
  // innings is always on top and the second below it. The total can be a plain string or
  // a main figure with a smaller qualifier, so the score reads big and the overs small.
  const sub=o.sub?`<span class="tv-sub">${esc(o.sub)}</span>`:"";
  const tot=o.total&&typeof o.total==="object"?`${esc(o.total.main)}<span class="tv-tot-sub">${esc(o.total.sub)}</span>`:esc(o.total||"");
  return`<div class="tv-team"><span class="tv-tn">${esc(o.team).toUpperCase()}</span>${sub}<span class="tv-tot">${tot}</span></div>${body}`;
}
function scSummary(m){
  const i=scInfo(m),first=m.bat1===2?m.n2:m.n1,second=m.bat1===2?m.n1:m.n2;
  const k1=m.bat1===2?2:1,k2=3-k1,xiOf=k=>m["xi"+k]||[];
  const tot=(r,w,b)=>`${r}/${w??0} (${ovs(b??0)} ov)`;
  const t1=m.innings===2?tot(m.inn1,m.inn1w,m.inn1b):tot(m.runs,i.w,m.balls);
  const t2=m.innings===2?tot(m.runs,i.w,m.balls):"";
  const full=(team,h,cur,xi,live,line)=>{
    const d=scInn(h,cur);
    const dnb=(xi||[]).filter(p=>!d.bats.some(x=>x.n===p));
    return`<div class="sm1"><div class="row"><b class="os">${esc(team)}</b>${line?`<span class="sm-tot">${esc(line)}</span>`:""}</div>${d.bats.length?`<div class="tv-scroll"><table class="pt pt-bat">${d.bats.map(x=>`<tr><td>${esc(x.n)}<br><span class="mut" style="font-size:12px">${esc(x.how||"not out")} · SR ${x.b?(x.r/x.b*100).toFixed(1):"–"} · 4×${x.f4} · 6×${x.f6}</span></td><td><b>${x.r}</b></td><td class="mut">${x.b}b</td></tr>`).join("")}</table></div>`:""}${d.bows.length?`<div class="mut" style="margin-top:6px">Bowling (O-R-W)</div><div class="tv-scroll"><table class="pt pt-bowl">${d.bows.map(x=>`<tr><td>${esc(x.n)}</td><td>${x.f}</td></tr>`).join("")}</table></div>`:""}<div class="mut" style="margin-top:6px">Extras: wides ${d.wd}, no-balls ${d.nb}, byes ${d.by}, leg-byes ${d.lb}</div>${h.length&&dnb.length?`<div class="mut" style="margin-top:4px">${live?"Yet to bat":"Did not bat"}: ${esc(dnb.join(", "))}</div>`:""}</div>`;
  };
  return(m.mom?`<div class="mom-sum">⭐ Man of the Match: <b>${esc(m.mom)}</b></div>`:"")+(i.done?`<div class="res">🏆 ${esc(i.res.toUpperCase())}</div>`:"")+(m.innings===2?full(first,m.hist1||[],null,xiOf(k1),false,t1)+full(second,m.history,m.cur,xiOf(k2),!i.done,t2):full(first,m.history,m.cur,xiOf(k1),!i.done,t1)+`<div class="sm1"><div class="row"><b class="os">${esc(second)}</b></div><div class="mut">Yet to bat</div></div>`);
}
function scSummaryText(m,link){
  const i=scInfo(m),first=m.bat1===2?m.n2:m.n1,second=m.bat1===2?m.n1:m.n2;
  const L=[`🏏 ${m.n1} vs ${m.n2} — ${tname(m.tid)}`];
  if(m.innings===2)L.push(`${first}: ${m.inn1}/${m.inn1w??0} (${ovs(m.inn1b??0)})`,`${second}: ${m.runs}/${i.w} (${ovs(m.balls)})`);
  else L.push(`${first}: ${m.runs}/${i.w} (${ovs(m.balls)})`);
  L.push(i.done?`🏆 ${i.res}`:"⏳ In progress");
  const top=[...scInn(m.hist1||[],null).bats,...scInn(m.history,null).bats].sort((a,b)=>b.r-a.r)[0];
  if(top&&top.r>0)L.push(`⭐ Top score: ${top.n} ${top.r}(${top.b})`);
  return L.join("\n")+"\n"+link;
}
const scLogoCache={};
const scMaxBalls=m=>Math.ceil((m.overs||1)/5)*6;
const scBowlerBalls=(h,n)=>{let b=0;(h||[]).forEach(x=>{if(x.o===n)b+=x.b||0;});return b;};
const ovFmt=b=>`${Math.floor(b/6)}.${b%6}`;
function bowlSel(arr,m,exclude){
  const max=scMaxBalls(m);
  const info=arr.map(p=>({p,b:scBowlerBalls(m.history,p)}));
  const notLast=info.filter(x=>!exclude.includes(x.p));
  const list=notLast.length?notLast:info;
  let over=false;
  if(!list.some(x=>x.b<max)){over=true;if(ScS.capW!==m.balls){ScS.capW=m.balls;toast("All bowlers have reached their usual limit — anyone may bowl now.");}}
  const names=list.map(x=>x.p);
  return{over,list:list.map(({p,b})=>({v:p,t:shortName(p,names),s:`${ovFmt(b)} ov${b>=max?" • MAX":""}`,off:!over&&b>=max}))};
}
async function scTeamLogo(id){
  if(!id)return"";if(id in scLogoCache)return scLogoCache[id];
  let src="";
  try{
    const d=(await getDoc(doc(db,"squads",id))).data()||{};
    const key=Object.keys(d).find(k=>/logo/i.test(k)&&typeof d[k]==="string"&&d[k]);
    if(key){const v=d[key];if(/^https?:/.test(v)){const blob=await(await fetch(v)).blob();src=await new Promise(res=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>res("");r.readAsDataURL(blob);});}else src=v.startsWith("data:")?v:`data:image/${v.startsWith("iVBOR")?"png":"jpeg"};base64,${v}`;}
  }catch{}
  return scLogoCache[id]=src;
}
async function scDownloadSummaryImage(m,share=false){
  const i=scInfo(m),k1=m.bat1===2?2:1,k2=3-k1;
  const first=m["n"+k1],second=m["n"+k2];
  const link=viewLinkFor(m);
  toast("Building summary image…");
  const[lg1,lg2]=await Promise.all([scTeamLogo(m["t"+k1]),scTeamLogo(m["t"+k2])]);
  const inA=scInn(m.innings===2?(m.hist1||[]):m.history,m.innings===2?null:m.cur);
  const inB=m.innings===2?scInn(m.history,m.cur):null;
  const crest=(lg,nm)=>lg?`<span class="tv-crest"><img src="${lg}" alt=""></span>`:`<span class="tv-crest">${esc(abbr(nm))}</span>`;
  const sub=[tname(m.tid),tourSeasonYear(m.tid)].filter(Boolean).join(" · ");
  const tot=(r,w,b)=>({main:`${r}/${w}`,sub:`(${ovs(b)} ov)`});
  const b1=tvBlock({team:first,sub:"",total:(m.innings===2?tot(m.inn1,m.inn1w??0,m.inn1b??0):tot(m.runs,i.w,m.balls)),bats:tvTopBat(inA.bats),batYet:!inA.bats.length,bowls:inB?tvTopBowl(inB.bows):[],bowlYet:!inB,roster:m["pl"+k1]||m["xi"+k1]||[]});
  const b2=tvBlock({team:second,sub:"",total:inB?tot(m.runs,i.w,m.balls):"",bats:inB?tvTopBat(inB.bats):[],batYet:!inB,bowls:tvTopBowl(inA.bows),bowlYet:!inA.bows.length,roster:m["pl"+k2]||m["xi"+k2]||[]});
  const ftr=i.done?`🏆 ${i.res.toUpperCase()}`:`${i.bat} ${m.runs}/${i.w} (${ovs(m.balls)})`;
  $("#sumImg").classList.add("ls");
  $("#sumImg").innerHTML=`<div class="sx sx-ls tv-shot"><div class="tv-head">${crest(k1===1?lg1:lg2,first)}<span class="tv-title"><b>MATCH SUMMARY</b><small>${esc(sub)}</small></span>${crest(k1===1?lg2:lg1,second)}</div>${b1}${b2}${m.mom?`<div class="tv-mom">⭐ MAN OF THE MATCH · ${esc(m.mom)}</div>`:""}<div class="tv-ftr">${esc(ftr)}</div><div class="tv-brand">SquareCut</div></div>`;
  if(!window.html2canvas){$("#sumImg").innerHTML="";$("#sumImg").classList.remove("ls");return scFlash("html2canvas not loaded. Check internet.");}
  // The poster is allowed to grow when there is more to show, so the canvas is sized from
  // the element. A fixed height would crop the third batter and the third bowler.
  const boxH=Math.ceil($("#sumImg").firstChild.getBoundingClientRect().height);
  const canvas=await html2canvas($("#sumImg"),{backgroundColor:"#151c26",scale:2,useCORS:true,width:1200,height:boxH});
  $("#sumImg").innerHTML="";$("#sumImg").classList.remove("ls");
  if(share){
    const ok=await shareCanvas(canvas,`match-summary-${m.id}.jpg`,"Match Summary",`${m.n1} vs ${m.n2} — ${i.res||"Live"} ${link}`);
    if(!ok){downloadCanvas(canvas,`match-summary-${m.id}.jpg`);appShare({title:"Share summary",sub:"Image saved to your downloads — attach it in the share sheet.",link,waText:`🏏 ${m.n1} vs ${m.n2} — ${i.res||"Live"} ${link}`});}
  }else{downloadCanvas(canvas,`match-summary-${m.id}.jpg`);toast("Summary image downloaded.");}
}
async function scDownloadFullImage(m,share=false){
  const i=scInfo(m);
  const link=viewLinkFor(m);
  toast("Building full scorecard…");
  const inA=scInn(m.innings===2?(m.hist1||[]):m.history,m.innings===2?null:m.cur);
  const inB=m.innings===2?scInn(m.history,m.cur):null;
  const first=m.bat1===2?m.n2:m.n1,second=m.bat1===2?m.n1:m.n2;
  const k1=m.bat1===2?2:1,k2=3-k1,xiOf=k=>m["xi"+k]||[];
  const batBlock=(list,dnb,lbl)=>{const top=list.reduce((a,x)=>Math.max(a,x.r||0),0);const li=top>0?list.findIndex(x=>(x.r||0)===top):-1;return`<div class="tv-grid"><div class="tv-bat" style="flex:1"><div class="tv-hrow"><span>BATTER</span><span>R</span><span>B</span><span>4s</span><span>6s</span><span>SR</span></div>${list.length?list.map((x,i)=>`<div class="tv-row bat${i%2?2:1}${i===li?" lead":""}"><span class="tv-nm">${esc(x.n)}${x.out?"":"*"}</span><span class="tv-gd">${x.r}</span><span>${x.b}</span><span>${x.f4}</span><span>${x.f6}</span><span>${x.b?((x.r/x.b*100).toFixed(1)):"–"}</span></div>`).join(""):`<div class="tv-row bat1"><span class="tv-nm">–</span><span>–</span><span>–</span><span>–</span><span>–</span><span>–</span></div>`}${dnb&&dnb.length?`<div class="fx-full-ex" style="margin-top:4px">${esc(lbl)}: ${esc(dnb.join(", "))}</div>`:""}</div></div>`;};
  const bowlBlock=list=>`<div class="tv-grid"><div class="tv-bowl" style="flex:1"><div class="tv-hrow"><span>BOWLER</span><span>O</span><span>R</span><span>W</span></div>${list.length?list.map((x,i)=>{const p=String(x.f).split("-");return`<div class="tv-row bowl${i%2?2:1}"><span class="tv-nm">${esc(x.n)}</span><span>${p[0]}</span><span>${p[1]}</span><span class="tv-gd">${p[2]}</span></div>`;}).join(""):`<div class="tv-row bowl1"><span class="tv-nm">–</span><span>–</span><span>–</span><span>–</span></div>`}</div></div>`;
  const innBlock=(team,sub,total,d,xi,done)=>{const dnb=(xi||[]).filter(p=>!d.bats.some(x=>x.n===p));return`<div class="tv-team"><span class="tv-tn">${esc(team).toUpperCase()}</span><span class="tv-sub">${esc(sub)}</span><span class="tv-tot">${esc(total)}</span></div>`+batBlock(d.bats,dnb,done?"Did not bat":"Yet to bat")+bowlBlock(d.bows)+`<div class="fx-full-ex">Extras: wides ${d.wd}, no-balls ${d.nb}, byes ${d.by}, leg-byes ${d.lb}</div>`;};
  const sy=[tourSeason(m.tid),tourYear(m.tid)].filter(Boolean).join(" ");
  const meta=[tname(m.tid),when(m.when),m.venue,sy].filter(Boolean).join("  ·  ");
  const body=(m.innings===2?innBlock(first,"1st INNINGS",`${m.inn1}/${m.inn1w??0} (${ovs(m.inn1b??0)} ov)`,inA,xiOf(k1),true)+innBlock(second,"2nd INNINGS",`${m.runs}/${i.w} (${ovs(m.balls)} ov)`,inB,xiOf(k2),i.done):innBlock(first,"1st INNINGS",`${m.runs}/${i.w} (${ovs(m.balls)} ov)`,inA,xiOf(k1),i.done));
  $("#sumImg").innerHTML=`<div class="sx fx-full"><div class="sx-top"><span class="sx-tour">FULL SCORECARD</span><div class="sx-meta">${esc(meta)}</div></div>${body}<div class="sx-ftr">SquareCut</div></div>`;
  if(!window.html2canvas){$("#sumImg").innerHTML="";return scFlash("html2canvas not loaded. Check internet.");}
  const boxH=Math.ceil($("#sumImg").firstChild.getBoundingClientRect().height);
  const canvas=await html2canvas($("#sumImg"),{backgroundColor:"#05060f",scale:2,useCORS:true,width:540,height:boxH});
  $("#sumImg").innerHTML="";
  if(share){
    const ok=await shareCanvas(canvas,`full-scorecard-${m.id}.jpg`,"Full Scorecard",`${m.n1} vs ${m.n2} — full scorecard ${link}`);
    if(!ok){downloadCanvas(canvas,`full-scorecard-${m.id}.jpg`);appShare({title:"Share scorecard",sub:"Image saved to your downloads — attach it in the share sheet.",link,waText:`🏏 ${m.n1} vs ${m.n2} — full scorecard ${link}`});}
  }else{downloadCanvas(canvas,`full-scorecard-${m.id}.jpg`);toast("Full scorecard downloaded.");}
}
async function scDownloadPointsImage(share=false,osid,ogid){
  if(!ScS.tour)return toast("Select a tournament first.");
      const sid=osid!==undefined?osid:(ScS.pstage||""),gid=ogid!==undefined?ogid:(ScS.pgroup||"");
  const rows=scPointsData(sid,gid);
  if(!rows.length)return toast("No teams yet.");
  const link=basePage();
  toast("Building points-table image...");
  $("#sumImg").classList.add("ls");
  const many=rows.length>7?" qx-many":"";
  const ctx=[sid?stageName(ScS.tour,sid):"",gid?groupName(ScS.tour,sid,gid):""].filter(Boolean).join(" - ");
  const tag=(sid||gid)?" - "+ctx:"";
  $("#sumImg").innerHTML=`<div class="sx sx-ls sx-qx${many}"><div class="qx-top"><div class="qx-tour">${esc(tname(ScS.tour))}</div><div class="qx-sub">${esc(tourSeasonYear(ScS.tour))} ${esc(new Date().toLocaleDateString())}</div></div><div class="qx-bar">Points Table${esc(tag)}</div><table class="qx-t"><tr><th class="q-rk">#</th><th class="q-tm">Team</th><th class="q-n">Played</th><th class="q-n">Won</th><th class="q-n">Lost</th><th class="q-n">No Result</th><th class="q-pt">Points</th><th class="q-nrr">NRR</th></tr>${rows.map((x,i)=>`<tr class="${i===0?"p1":i===1?"p2":i===2?"p3":(i%2?"alt":"")}"><td class="q-rk">${i+1}</td><td class="q-tm"><b>${esc(nm2(x.n))}</b></td><td class="q-n">${x.p}</td><td class="q-n">${x.w}</td><td class="q-n">${x.l}</td><td class="q-n">${x.nr}</td><td class="q-pt"><span class="qx-pbox">${x.pts}</span></td><td class="q-nrr"><span class="qx-nbox ${x.nrr==null?"na":x.nrr>0?"pos":"neg"}">${x.nrr==null?"-":(x.nrr>0?"+":"")+x.nrr.toFixed(3)}</span></td></tr>`).join("")}</table><div class="qx-ftr">Win 2 | Tie / Abandoned 1 | Walkover: winner 2</div><div class="sx-ftr">SquareCut</div></div>`;
  if(!window.html2canvas){$("#sumImg").innerHTML="";return toast("html2canvas not loaded.");}
  const boxH=Math.ceil($("#sumImg").firstChild.getBoundingClientRect().height);
  const canvas=await html2canvas($("#sumImg"),{backgroundColor:"#1d2230",scale:2,useCORS:true,width:1200,height:boxH});
  $("#sumImg").innerHTML="";$("#sumImg").classList.remove("ls");
  if(share){const ok=await shareCanvas(canvas,`points-${ScS.tour}${sid?"-"+sid:""}${gid?"-"+gid:""}.jpg`,"Points Table",`${tname(ScS.tour)} points table ${link}`);if(!ok){downloadCanvas(canvas,`points-${ScS.tour}${sid?"-"+sid:""}${gid?"-"+gid:""}.jpg`);toast("Points image downloaded.");}}
  else{downloadCanvas(canvas,`points-${ScS.tour}${sid?"-"+sid:""}${gid?"-"+gid:""}.jpg`);toast("Points image downloaded.");}
}
async function scDownloadFixtureImage(m,share=false){
  const link=viewLinkFor(m);
  toast("Building fixture image…");
  const[lg1,lg2]=await Promise.all([scTeamLogo(m.t1),scTeamLogo(m.t2)]);
  const ylogo=(n,lg)=>`<div class="yt-logo"${lg?` style="background-image:url('${lg}')"`:""}>${lg?"":esc(abbr(n))}</div>`;
  const seas=[tourSeason(m.tid),tourYear(m.tid)].filter(Boolean).join(" ");
  $("#sumImg").classList.add("ls");$("#sumImg").innerHTML=`<div class="sx sx-ls yt-banner"><div class="yt-ribbon">★ UPCOMING FIXTURE ★</div>
  <div class="yt-tour">${esc(tname(m.tid))}${seas?` <span>· ${esc(seas)}</span>`:""}</div>
  <div class="yt-mid"><div class="yt-tm">${ylogo(m.n1,lg1)}<div class="yt-nm">${esc(nm2(m.n1))}</div></div><div class="yt-vs">VS</div><div class="yt-tm">${ylogo(m.n2,lg2)}<div class="yt-nm">${esc(nm2(m.n2))}</div></div></div>
  <div class="yt-info">📅 ${esc(when(m.when))} &nbsp;·&nbsp; ${m.overs} OVERS${m.venue?` &nbsp;·&nbsp; 📍 ${esc(m.venue)}${m.city?", "+esc(m.city):""}`:m.city?` &nbsp;·&nbsp; 📍 ${esc(m.city)}`:""}${m.ball?` &nbsp;·&nbsp; ${esc(m.ball)}`:""}${m.tossWon?` &nbsp;·&nbsp; 🪙 ${esc(m.tossWon)}${m.tossDec?" ("+esc(m.tossDec)+")":""}`:""}</div>
  <div class="yt-brand">SquareCut</div></div>`;
  if(!window.html2canvas){$("#sumImg").innerHTML="";return toast("html2canvas not loaded.");}
  const canvas=await html2canvas($("#sumImg"),{backgroundColor:"#04100a",scale:2,useCORS:true,width:1280,height:720});
  $("#sumImg").innerHTML="";$("#sumImg").classList.remove("ls");
  const waText=`🏏 ${m.n1} vs ${m.n2}\n${tname(m.tid)} · ${m.overs} overs${m.ball?" · "+m.ball+" ball":""}\n📅 ${when(m.when)}${m.venue?"\n📍 "+m.venue+(m.city?", "+m.city:""):m.city?"\n📍 "+m.city:""}${m.tossWon?"\n🪙 "+m.tossWon+" won the toss"+(m.tossDec?" ("+m.tossDec+")":""):""}\n🔗 ${link}`;
  if(share){
    const ok=await shareCanvas(canvas,`fixture-${m.id}.jpg`,m.n1+" vs "+m.n2,waText);
    if(!ok){downloadCanvas(canvas,`fixture-${m.id}.jpg`);appShare({title:"Share fixture",sub:"Image saved to your downloads — attach it in the share sheet.",link,waText,imageCanvas:canvas,imageName:`fixture-${m.id}.jpg`});}
  }else{downloadCanvas(canvas,`fixture-${m.id}.jpg`);toast("Fixture image downloaded.");}
}
// ---- Man of the Match: the players with the most points in this match ----
const scMomList=m=>Object.values(scPtsOf([m.hist1||[],m.history||[]])).filter(p=>p.p>0).sort((a,b)=>b.p-a.p||b.r-a.r||a.n.localeCompare(b.n));
function scMomRow(m){
  if(m.status!=="completed")return "";
  if(!m.mom&&!scMomList(m).length)return "";
  const can=Auth.admin||canDeleteMatch(m);
  return`<div class="mom-row"><div class="mom-l"><span class="mom-k">⭐ MAN OF THE MATCH</span><span class="mom-v">${m.mom?esc(m.mom):"not chosen yet"}</span></div>${can?`<button class="btn s sm" id="mom-pick">${m.mom?"Change":"Choose"}</button>`:""}</div>`;
}
async function scMomPick(m){
  const list=scMomList(m);
  if(!list.length)return toast("No points scored in this match yet.");
  const v=await appPick({title:"Man of the Match",sub:"Ranked by the points system",options:list.map((p,i)=>({v:p.n,t:`${i+1}. ${p.n}`,s:`${p.p} pts · ${p.r} runs · ${p.w} wkts · ${p.f4}×4 ${p.f6}×6`}))});
  if(v===null)return;
  scAct(()=>updateDoc(scRef(m.id),{mom:v}).then(()=>toast(`${v} is the Man of the Match.`)));
}
function scMatchView(){
  const m=ScS.m,i=scInfo(m),canS=canScore(m),base=basePage();
  const watching=m.status==="live"&&!i.done&&claimActive(m)&&!claimMine(m);
  const lockedOut=canS&&watching;
  const rqNow=reqLive(m),rqMineNow=rqNow&&(m.reqBy||"").toLowerCase()===myEmail();
  if(ScS.reqMine&&ScS.reqMine.mid===m.id&&ScS.reqMine.live&&!rqMineNow&&myEmail()){
    if(claimMine(m))setTimeout(()=>toast("✅ Take-over approved — you're now scoring this match."),60);
    else if(m.status==="live"&&!i.done)setTimeout(()=>toast("Take-over request declined or expired — you're still watching."),60);
  }
  ScS.reqMine={mid:m.id,live:rqMineNow};
  ScS.lockSeen=watching;ScS.reqLive=rqNow;
  const A=i.done?Auth.admin:(canS&&!lockedOut);
  const view=base+"?match="+m.id,ovSt=m.overlayStyle||"",ov=base+"?mode=overlay&match="+m.id+(ovSt?"&style="+ovSt:"");
  const P=!!(m.pl1&&m.pl1.length),fi=m.bat1===2?2:1,kb=i.inn===1?fi:3-fi;
  const xiB=m["xi"+kb]||[],xiW=m["xi"+(3-kb)]||[],c=m.cur;
  const outs=new Set(m.history.filter(x=>x.w).map(x=>x.d||x.s));
  if((canS||Auth.admin)&&m.status==="live"&&i.done)scAct(()=>updateDoc(scRef(m.id),{status:"completed",scoredBy:"",scoredAt:0}));
  if(m.status==="live"&&claimMine(m)&&reqLive(m)&&!reqMine(m)){const rs=ScS.reqSeen||(ScS.reqSeen={});if(rs[m.id]!==(m.reqAt||0)){rs[m.id]=m.reqAt||0;const rqby=(m.reqBy||"").toLowerCase();setTimeout(()=>scReqDialog(m.id,rqby),80);}}
  const stage=A&&m.status==="live"&&m.xi1&&!i.done&&!i.i1over?(!c?"open":(!c.s||!c.n)?"bat":!c.b?"bowl":""):"";
  const needPick=A&&m.status==="live"&&!m.xi1&&!i.done;
  const fl=[...xiW,...(m["s"+(3-kb)]?[m["s"+(3-kb)]]:[])],cb2=c?[c.s,c.n].filter(Boolean):[];
  const KINDS=[["b","Bowled"],["c","Caught"],["lbw","LBW"],["ro","Run Out"],["st","Stumped"],["hw","Hit Wicket"],["rtd","Retired Out"],["rth","Retired Hurt"]];
  // --- in-app pickers: batter/bowler are chosen by the scorer, never pre-selected ---
  ScS.pk=ScS.pk||{};
  if(stage==="open"){const k=m.id+":"+m.innings;if(ScS.pkOpenKey!==k){ScS.pkOpenKey=k;ScS.pk.ps="";ScS.pk.pn="";ScS.pk.pb="";}if(ScS.pk.ps&&!xiB.includes(ScS.pk.ps))ScS.pk.ps="";if(ScS.pk.pn&&!xiB.includes(ScS.pk.pn))ScS.pk.pn="";if(ScS.pk.pb&&!xiW.includes(ScS.pk.pb))ScS.pk.pb="";}
  if(stage==="bat"){const k=m.history.length+":"+m.balls;if(ScS.pkBatKey!==k){ScS.pkBatKey=k;ScS.pk.pa="";}if(ScS.pk.pa&&!xiB.includes(ScS.pk.pa))ScS.pk.pa="";}
  if(stage==="bowl"){if(ScS.pkBowlKey!==m.balls){ScS.pkBowlKey=m.balls;ScS.pk.pb2="";}if(ScS.pk.pb2&&!xiW.includes(ScS.pk.pb2))ScS.pk.pb2="";}
  const pickBtn=(key,label)=>`<button type="button" class="pkb ${ScS.pk[key]?"on":""}" data-pk="${key}"><span class="pkb-l">${esc(label)}</span><span class="pkb-v">${ScS.pk[key]?esc(ScS.pk[key]):"Select"}</span></button>`;
  const batMeta=p=>{const[r,b]=scBStat(m.history||[],p);return{t:p,s:`${r} (${b}b)`};};
  const pkOpts=key=>{
    if(key==="ps"||key==="pn"){const other=key==="ps"?ScS.pk.pn:ScS.pk.ps;return xiB.map(p=>({v:p,...batMeta(p),off:!!other&&p===other}));}
    if(key==="pa"||key==="cw"){const skip=new Set([c&&c.s,c&&c.n,key==="cw"?ScS.pk.cr:null].filter(Boolean));return xiB.filter(p=>!outs.has(p)&&!skip.has(p)).map(p=>({v:p,...batMeta(p)}));}
    if(key==="cr"||key==="od")return cb2.map(p=>({v:p,...batMeta(p)}));
    if(key==="pb"||key==="pb2")return bowlSel(xiW,m,key==="pb2"&&c.lb?[c.lb]:[]).list;
    if(key==="fl")return[{v:"",t:"No fielder",s:"optional"}].concat(fl.map(p=>({v:p,t:p,s:""})));
    return[];
  };
  const pkTitle=key=>({ps:"Opening striker",pn:"Opening non-striker",pb:"Opening bowler",pa:"New batter",pb2:"Bowler for over "+(Math.floor(m.balls/6)+1),cr:"Batter to replace",cw:"New batter",od:ScS.out==="ro"?"Batter out":"Batter",fl:"Fielder"})[key]||"Select player";
  const pkBowlHint=`<div class="mut c">Max ${Math.ceil((m.overs||1)/5)} overs per bowler</div>`;
  const outUI=()=>ScS.out==="menu"?`<div class="xm"><h3>HOW OUT?</h3><div class="xg" style="grid-template-columns:repeat(2,1fr)">${KINDS.map(([k,t])=>`<button class="sb" style="font-size:17px" data-ok="${k}">${t}</button>`).join("")}</div><button class="btn s" id="oc">Cancel</button></div>`:`<div class="xm"><h3>${KINDS.find(x=>x[0]===ScS.out)[1].toUpperCase()}</h3>${["ro","rtd","rth"].includes(ScS.out)?pickBtn("od",ScS.out==="ro"?"Batter out":"Batter"):""}${ScS.out==="ro"?`<div class="pkl">Runs completed</div><div>${[0,1,2,3].map(v=>`<button type="button" class="pkchip ${+(ScS.pk.orr||0)===v?"on":""}" data-orr="${v}">${v}</button>`).join("")}</div>`:""}${["c","st","ro"].includes(ScS.out)?pickBtn("fl","Fielder (optional)"):""}<button class="btn" id="ocf">Confirm</button><button class="btn s" id="oc">Cancel</button></div>`;
  const cbUI=()=>`<div class="xm"><h3>CHANGE BATTER</h3>${pickBtn("cr","Batter to replace (score carries)")}${pickBtn("cw","New batter")}<button class="btn" id="cbc">Confirm</button><button class="btn s" id="cbx">Cancel</button></div>`;
  const exOutUI=()=>{const[k,e]=ScS.outEx.split("-");const ttl=(k==="st"?"STUMPED":"RUN OUT")+" OFF "+(e==="wd"?"WIDE":"NO-BALL");return`<div class="xm"><h3>${ttl}</h3>${k==="ro"?pickBtn("od","Batter out"):""}<div class="pkl">Runs completed${e==="wd"?" (wide adds 1)":" (no-ball adds 1)"}</div><div>${[0,1,2,3].map(v=>`<button type="button" class="pkchip ${+(ScS.pk.orr||0)===v?"on":""}" data-orr="${v}">${v}</button>`).join("")}</div>${pickBtn("fl","Fielder (optional)")}<button class="btn" id="oxf">Confirm</button><button class="btn s" id="oxc">Cancel</button></div>`;};
  const actRow=`<div class="ma-row"><button class="btn s sm auto" id="ma" title="Match actions">⋯ Match actions</button></div>`;
  let h=`<div class="w">`;
  if(watching)h+=`<div class="tg">🔒 ${esc(m.scoredBy||"Someone")} is scoring this match — you're watching live. Only they can hand it over (Transfer scoring) or approve a take-over request.</div>`+(reqMine(m)?`<button class="btn s" id="reqcancel">⏳ Waiting for the scorer to allow — tap to cancel</button>`:(Auth.user&&!isAnon()&&teamPlays(m))?`<button class="btn s" id="reqtake">✊ Request Take Over</button>`:"");
  if(A&&ScS.editInfo)h+=`<div class="xm"><h3>EDIT MATCH INFO</h3><div style="display:flex;gap:8px"><div style="flex:1"><label>Overs</label><input id="ei-ov" type="number" min="1" max="50" value="${m.overs}"></div><div style="flex:1"><label>Ball</label><select id="ei-bl">${["Leather","Tennis","Synthetic","Other"].map(b=>`<option ${m.ball===b?"selected":""}>${b}</option>`).join("")}</select></div></div><label>Ground</label><input id="ei-vn" type="text" value="${esc(m.venue||"")}"><label>City</label><input id="ei-cy" type="text" value="${esc(m.city||"")}"><div style="display:flex;gap:8px"><div style="flex:1"><label>Toss won by</label><select id="ei-tw"><option value="">Not decided</option>${[m.n1,m.n2].map(n=>`<option ${m.tossWon===n?"selected":""}>${esc(n)}</option>`).join("")}</select></div><div style="flex:1"><label>Decision</label><select id="ei-td"><option value="">—</option>${["Bat","Bowl"].map(d=>`<option ${m.tossDec===d?"selected":""}>${d}</option>`).join("")}</select></div></div><label>Date &amp; time</label><input id="ei-dt" type="datetime-local" value="${new Date((m.when||Date.now())-new Date().getTimezoneOffset()*6e4).toISOString().slice(0,16)}"><div style="display:flex;gap:8px;margin-top:8px"><button class="btn" style="flex:1" id="ei-sv">Save</button><button class="btn s" style="flex:1" id="ei-x">Cancel</button></div></div>`;
  if(m.status==="scheduled"){
    h+=`<div class="card" style="cursor:default"><div class="vs c"><b>${esc(m.n1)}</b> vs <b>${esc(m.n2)}</b></div><div class="mut c">${esc(m.venue||"")}${m.city?" · "+esc(m.city):""}${m.ball?" · "+esc(m.ball)+" ball":""} · ${esc(when(m.when))}</div></div><div class="ib-row" style="margin-top:8px"><button class="btn s sm ib" id="fx-dl" title="Download fixture image">🖼️</button><button class="btn s sm ib" id="fx-sh" title="Share fixture + link">↗️</button></div>`;
    if((m.challenged||"").toLowerCase()===myEmail()){const mt2=[m.t1,m.t2].find(id=>SqTeams.some(t=>t.id===id&&canEditSquad(t.id)));const oppN=mt2?(mt2===m.t1?m.n2:m.n1):"The other team";h+=`<div class="tg">⚔️ ${esc(oppN)} challenged you — start it whenever you're ready.</div>`;}
    if(A)h+=`${P?scSquadPick(m,1)+scSquadPick(m,2):""}<button class="btn" id="st">Start Match</button>`;
    else h+=`<div class="tg">Match not started yet</div>`;
    h+=actRow;
  }else{
    h+=scTicker(m)+scRateStrip(m)+scOverStrip(m)+scPlayers(m);
    if(needPick){
      h+=`<div class="card" style="cursor:default;text-align:center"><div class="os gold" style="font-size:22px">Select Playing Squads</div><div class="mut">Pick 2 to 12 players per team, then start scoring.</div></div>`;
      if(P)h+=scSquadPick(m,1)+scSquadPick(m,2);
      else h+=`<div class="tg">Squads not loaded yet — reopen the match.</div>`;
      if(P)h+=`<button class="btn" id="st2">Start Scoring</button>`;
      else h+=`<div class="tg">Match not started yet</div>`;
    }else if(i.i1over){
      h+=`<div class="card" style="cursor:default;text-align:center"><div class="os gold" style="font-size:24px">Innings Over</div><div class="os" style="font-size:44px">${m.runs}/${i.w}</div><div class="mut">${esc(i.bat)} — 1st innings</div><div>${esc(i.bowl)} need ${m.runs+1} to win in ${m.overs} overs</div></div>`;
      if(A)h+=`<button class="btn" id="s2">Start 2nd Innings</button><button class="btn s ib" id="un" title="Undo last ball">↩️</button>`;
    }else if(stage==="open"){
      h+=`<div class="xm"><h3>OPENING PLAYERS</h3>${pickBtn("ps","Striker")}${pickBtn("pn","Non-striker")}${pickBtn("pb","Opening bowler")}${pkBowlHint}<button class="btn" id="cf">Confirm</button></div>`;
    }else if(stage==="bat"){
      const av=xiB.filter(p=>!outs.has(p)&&p!==c.s&&p!==c.n);
      h+=`<div class="xm"><h3>NEW BATTER</h3>${av.length?pickBtn("pa","New batter"):`<div class="msg err">No batters left — undo the last wicket or end the innings.</div>`}<button class="btn" id="cf">Confirm</button></div><button class="btn s ib" id="un" title="Undo last ball">↩️</button>`;
    }else if(stage==="bowl"){
      h+=`<div class="xm"><h3>BOWLER FOR OVER ${Math.floor(m.balls/6)+1}</h3>${pickBtn("pb2","Bowler")}${pkBowlHint}<button class="btn" id="cf">Confirm</button></div><div class="ib-row"><button class="btn s ib" id="sw" title="Switch strike">⇄</button><button class="btn s ib" id="un" title="Undo last ball">↩️</button></div>`;
    }else if(A&&!i.done&&!needPick){
      h+=ScS.outEx?exOutUI():ScS.out?outUI():ScS.cb?cbUI():ScS.ex?`<div class="xm"><h3>WIDE BALLS</h3><div class="xg" style="grid-template-columns:repeat(5,1fr)">${[0,1,2,3,4].map(v=>`<button class="sb" data-xk="wd" data-xv="${v}">W+${v}</button>`).join("")}</div><h3>NO BALLS</h3><div class="xg" style="grid-template-columns:repeat(6,1fr)">${[0,1,2,3,4,6].map(v=>`<button class="sb" data-xk="nb" data-xv="${v}">N+${v}</button>`).join("")}</div><h3>BYES</h3><div class="xg" style="grid-template-columns:repeat(4,1fr)">${[1,2,3,4].map(v=>`<button class="sb" data-xk="by" data-xv="${v}">B+${v}</button>`).join("")}</div><h3>LEG BYES</h3><div class="xg" style="grid-template-columns:repeat(4,1fr)">${[1,2,3,4].map(v=>`<button class="sb" data-xk="lb" data-xv="${v}">LB+${v}</button>`).join("")}</div><h3>OUT OFF EXTRA</h3><div class="xg" style="grid-template-columns:repeat(3,1fr)"><button class="sb" style="font-size:14px" data-oxk="st-wd">STUMPED<br>off wide</button><button class="sb" style="font-size:14px" data-oxk="ro-wd">RUN OUT<br>off wide</button><button class="sb" style="font-size:14px" data-oxk="ro-nb">RUN OUT<br>off no-ball</button></div><button class="btn s" id="xc">Cancel</button></div>`:`<div class="g4">${[0,1,2,3].map(v=>`<button class="sb" data-r="${v}">${v}</button>`).join("")}</div><div class="g4"><button class="sb f" data-r="4">4</button><button class="sb s6" data-r="6">6</button><button class="sb o" id="out">OUT</button><button class="sb u" id="un">UNDO</button></div><button class="sb" id="ex" style="width:100%;margin:0 0 8px;font-size:18px;letter-spacing:2px">ADD EXTRAS</button>${c?`<div class="g2"><button class="btn s" id="sw" title="Switch strike">⇄ Switch Strike</button><button class="btn s" id="cb" title="Replace batter">✎ Replace Batter</button></div>`:""}`;
    }else if(A&&i.done)h+=`<div class="ib-row"><button class="btn s ib" id="un" title="Undo last ball">↩️</button>${m.endType?`<button class="btn s ib" id="reopen" title="Reopen match">↪️</button>`:""}</div>`;
    if(A&&m.status==="live"&&!i.done&&!needPick&&ScS.endMenu)h+=`<div class="xm"><h3>END MATCH AS</h3><div class="xg" style="grid-template-columns:repeat(2,1fr)"><button class="sb" style="font-size:15px" data-end="abandoned">Abandoned</button><button class="sb" style="font-size:15px" data-end="noresult">No Result</button></div><label>Walkover winner</label><select id="wo-w"><option value="">— pick team —</option><option>${esc(m.n1)}</option><option>${esc(m.n2)}</option></select><label>Note (optional)</label><input id="end-note" type="text" placeholder="e.g. rain"><div style="display:flex;gap:8px;margin-top:8px"><button class="btn" style="flex:1" id="end-wo">Walkover Win</button><button class="btn s" style="flex:1" id="end-x">Cancel</button></div></div>`;
    h+=scMomRow(m);
    h+=actRow;
    if(!i.done)h+=`<div class="mut c">Live — updates automatically</div>`;
    h+=`<details id="sd" class="mut" style="margin-top:12px" ${(ScS.sumOpen??(m.status==="completed"||ScS.sumParam))?"open":""}><summary class="sd-btn">📊 Full Scorecard</summary><div style="margin-top:8px">${scSummary(m)}<div style="display:flex;gap:8px;margin-top:8px"><button class="btn" style="flex:1" id="dls">📥 Summary</button><button class="btn s" style="flex:1" id="dls-f">📄 Full Card</button></div></div></details>`;
    if(m.xi1)h+=`<details class="mut" style="margin-top:10px"><summary>Playing squads</summary>${[1,2].map(k=>`<div style="margin-top:6px"><b>${esc(m["n"+k])}</b> (${(m["xi"+k]||[]).length}): ${esc((m["xi"+k]||[]).join(", "))}${m["s"+k]?`<br>12th: ${esc(m["s"+k])}`:""}</div>`).join("")}</details>`;
  }
  h+=`</div>`;
  const y=scrollY;
  scRoot().innerHTML=h+`<div id="msg" class="msg"></div>`;
  scFitTicker(scRoot());const _bbr=scRoot().querySelector(".bbs-r");if(_bbr)_bbr.scrollLeft=_bbr.scrollWidth;scRoot().querySelectorAll("[data-tprof]").forEach(b=>b.onclick=()=>{ScS.profBack=()=>scMatchView();teamProfileView(b.dataset.tprof);});scrollTo(0,y);
  if(A&&m.status==="live")scLock();
  setBack(scList);
  scRoot().querySelectorAll("[data-pk]").forEach(b=>b.onclick=async()=>{const key=b.dataset.pk;const opts=pkOpts(key);if(!opts.length)return scFlash("No options available.");const v=await appPick({title:pkTitle(key),sub:(key==="pb"||key==="pb2")?`Max ${Math.ceil((m.overs||1)/5)} overs per bowler`:"",options:opts,value:ScS.pk[key]||""});if(v===null)return;ScS.pk[key]=v;scMatchView();});
  scRoot().querySelectorAll("[data-orr]").forEach(b=>b.onclick=()=>{ScS.pk.orr=+b.dataset.orr;scMatchView();});
  if($("#sd"))$("#sd").ontoggle=()=>{ScS.sumOpen=$("#sd").open;};
  const on=(s,fn)=>{const e=scRoot().querySelector(s);if(e)e.onclick=fn;};
  on("#ma",()=>{
    const rows=[];
    rows.push({icon:"📤",t:"Share match link",on:()=>appShare({title:"Share match",link:view,waText:`🏏 ${m.n1} vs ${m.n2} — live score:\n${view}`})});
    rows.push({icon:"📺",t:"Copy scoreticker link",s:"For the TV-style overlay window",on:()=>navigator.clipboard.writeText(ov).then(()=>toast("Scoreticker link copied.")).catch(()=>toast("Couldn't copy the link."))});
    if(A)rows.push({icon:"✏️",t:"Edit match info",s:"Overs, ground, toss, date",on:()=>{ScS.editInfo=true;scMatchView();}});
    if(Auth.admin&&((m.history&&m.history.length)||(m.hist1&&m.hist1.length)))rows.push({icon:"🔄",t:"Swap two players",s:"Fix two names that got crossed on the card",on:()=>scSwapFlow(m)});
    if(Auth.admin&&(m.fixLog||[]).some(e=>e.what==="swap"&&!e.undone))rows.push({icon:"↩️",t:"Undo last swap",s:"Put the last swap back",on:async()=>{if(!await appConfirm("Undo the last player swap?","Undo"))return;scAct(()=>scUndoSwap(m).then(()=>toast("Swap undone.")));}});
     if(A&&m.status==="live"&&!i.done)rows.push({icon:"\u{1F3AC}",t:"Scoreticker style",s:"Copy a different style",on:async()=>{const v=await appPick({title:"Scoreticker style",sub:"Pick a style - its link is copied for you",options:[{v:"",t:"Default",s:"The classic green ticker"},{v:"cyberpunk",t:"Cyberpunk",s:"Neon frames and glowing plates"},{v:"luxury",t:"Luxury Gold",s:"Gold broadcast frame"},{v:"lux2",t:"Luxury 2",s:"3D gold with ruby accents"},{v:"mt3",t:"Metallic 3D",s:"Shiny chrome and glass"}],value:m.overlayStyle||""});if(v===null)return;const nm=v===""?"Default":(v==="cyberpunk"?"Cyberpunk":(v==="lux2"?"Luxury 2":(v==="mt3"?"Metallic 3D":"Luxury Gold")));const u=base+"?mode=overlay&match="+m.id+(v?"&style="+v:"");if((m.overlayStyle||"")!==v)scAct(()=>updateDoc(scRef(m.id),{overlayStyle:v}));navigator.clipboard.writeText(u).then(()=>toast(nm+" scoreticker link copied - paste it into a browser, CameraFi or PrismLive.")).catch(()=>toast("Couldn't copy the link."));}});
    if(A&&m.status==="live"&&!i.done&&claimMine(m))rows.push({icon:"🔄",t:"Transfer scoring",s:"Hand the scoring pad to someone else",on:()=>transferModal(m)});
    if(A&&m.status==="live"&&!i.done&&!needPick)rows.push({icon:"🏁",t:"End match",s:"Abandoned, no result or walkover",on:()=>{ScS.endMenu=true;scMatchView();}});
    rows.push({icon:"🧾",t:"Full scorecard",s:"Jump to the detailed card",on:()=>{const sd=scRoot().querySelector("#sd");if(sd){sd.open=true;sd.scrollIntoView({behavior:"smooth",block:"start"});}}});
    appSheet({title:"Match actions",sub:`${m.n1} vs ${m.n2}`,rows});
  });
  on("#st",async()=>{
    if((m.pl1||[]).length<2||(m.pl2||[]).length<2){
      const f=await scRefreshSquads(m);
      if(f&&f.pl1.length>=2&&f.pl2.length>=2){toast("Squads refreshed — pick the playing squads (2–12 players), then tap Start.");return;}
      return scFlash("Each side needs at least 2 players - open each squad and add names.");
    }
    const u={status:"live",innings:1,runs:0,balls:0,history:[],cur:null};
    if(P){for(const k of[1,2]){const pl=m["pl"+k]||[];const ok=(ScS.sel[k]||[]).filter(p=>pl.includes(p));if(ok.length<2||ok.length>12)return scFlash("Select 2–12 players for both teams.");u["xi"+k]=ok;}}
    const bf=await appPick({title:"Who is batting first?",sub:"Toss winner's decision",options:[{v:"1",t:m.n1,s:"Batting first"},{v:"2",t:m.n2,s:"Batting first"}]});
    if(bf===null)return;
    u.bat1=+bf;
    scAct(()=>updateDoc(scRef(m.id),u));
  });
  on("#st2",()=>{const u={};for(const k of[1,2]){const pl=m["pl"+k]||[];const ok=(ScS.sel[k]||[]).filter(p=>pl.includes(p));if(ok.length<2||ok.length>12)return scFlash("Select 2–12 players for both teams.");u["xi"+k]=ok;}scAct(()=>updateDoc(scRef(m.id),u));});
  on("#s2",()=>scAct(()=>updateDoc(scRef(m.id),{innings:2,inn1:m.runs,inn1w:i.w,inn1b:m.balls,hist1:m.history,runs:0,balls:0,history:[],cur:null})));
  on("#cf",()=>{
    if(stage==="open"){const s=ScS.pk.ps,n=ScS.pk.pn,b=ScS.pk.pb;if(!s||!n)return scFlash("Pick both opening batters.");if(!b)return scFlash("Pick the opening bowler.");if(s===n)return scFlash("Striker and non-striker must be different.");ScS.pk.ps="";ScS.pk.pn="";ScS.pk.pb="";scAct(()=>updateDoc(scRef(m.id),{cur:{s,n,b,lb:null}}));}
    else if(stage==="bat"){const p=ScS.pk.pa;if(!p)return scFlash("Pick the new batter.");ScS.pk.pa="";scAct(()=>updateDoc(scRef(m.id),{cur:{...c,[c.s?"n":"s"]:p}}));}
    else{const b=ScS.pk.pb2;if(!b)return scFlash("Pick the bowler for this over.");ScS.pk.pb2="";scAct(()=>updateDoc(scRef(m.id),{cur:{...c,b}}));}
  });
  on("#out",()=>{if(c){ScS.out="menu";ScS.pk.od="";ScS.pk.fl="";ScS.pk.orr=0;scMatchView();}else scBall("",0,1);});
  on("#un",scUndo);on("#oc",()=>{ScS.out=null;scMatchView();});if($("#mom-pick"))$("#mom-pick").onclick=()=>scMomPick(m);
  on("#end-x",()=>{ScS.endMenu=false;scMatchView();});
  on("#reopen",async()=>{if(!await appConfirm("Reopen this match? It goes back to live scoring.","Reopen"))return;scAct(()=>updateDoc(scRef(m.id),{status:"live",endType:"",walkoverWinner:"",endNote:""}));});
  scRoot().querySelectorAll("[data-end]").forEach(b=>b.onclick=async()=>{const t=b.dataset.end;const note=($("#end-note")||{}).value||"";if(!await appConfirm(`End this match as ${t==="abandoned"?"Abandoned":"No Result"}?`,t==="abandoned"?"Abandon":"End"))return;ScS.endMenu=false;scAct(()=>updateDoc(scRef(m.id),{status:"completed",endType:t,walkoverWinner:"",endNote:(note||"").trim(),scoredBy:"",scoredAt:0}));});
  on("#end-wo",()=>{const w=$("#wo-w").value;if(!w)return scFlash("Pick the walkover winner.");const note=($("#end-note")||{}).value||"";ScS.endMenu=false;scAct(()=>updateDoc(scRef(m.id),{status:"completed",endType:"walkover",walkoverWinner:w,endNote:(note||"").trim(),scoredBy:"",scoredAt:0}));});
  scRoot().querySelectorAll("[data-ok]").forEach(b=>b.onclick=()=>{const k=b.dataset.ok;if(["b","lbw","hw"].includes(k)){ScS.out=null;scWicket(k,c.s);}else{ScS.out=k;ScS.pk.od="";ScS.pk.fl="";ScS.pk.orr=0;scMatchView();}});
  on("#ocf",()=>{const k=ScS.out,need=["ro","rtd","rth"].includes(k),d=need?(ScS.pk.od||""):c.s;if(need&&!d)return scFlash("Pick the batter out.");const f=ScS.pk.fl||null,v=k==="ro"?+(ScS.pk.orr||0):0;ScS.out=null;ScS.pk.od="";ScS.pk.fl="";ScS.pk.orr=0;if(k==="rtd"||k==="rth")scRetire(k,d);else scWicket(k,d,v,f);});
  on("#sw",()=>scAct(()=>updateDoc(scRef(m.id),{cur:{...c,s:c.n,n:c.s}})));
  on("#cb",()=>{ScS.cb=true;ScS.pk.cr="";ScS.pk.cw="";scMatchView();});on("#cbx",()=>{ScS.cb=false;ScS.pk.cr="";ScS.pk.cw="";scMatchView();});
  on("#cbc",()=>{const r=ScS.pk.cr,w=ScS.pk.cw;if(!r)return scFlash("Pick the batter to replace.");if(!w)return scFlash("No batter available.");ScS.cb=false;ScS.pk.cr="";ScS.pk.cw="";scAct(()=>{const hist=(m.history||[]).map(x=>{if(x.s!==r&&x.n!==r&&!(Array.isArray(x.p)&&x.p.includes(r)))return x;const y={...x};if(y.s===r)y.s=w;if(y.n===r)y.n=w;if(Array.isArray(y.p))y.p=y.p.map(q=>q===r?w:q);return y;});return updateDoc(scRef(m.id),{history:hist,cur:{...c,[c.s===r?"s":"n"]:w}});});});
  on("#ex",()=>{ScS.ex=true;scMatchView();});on("#xc",()=>{ScS.ex=false;scMatchView();});
  on("#reqtake",()=>{if(reqLive(m)&&!reqMine(m))return toast("Another take-over request is already pending — try again in a moment.");scAct(()=>updateDoc(scRef(m.id),{reqBy:myEmail(),reqAt:Date.now()}).then(()=>toast("Take-over request sent to the active scorer.")));});
  on("#reqcancel",()=>{if(ScS.reqMine&&ScS.reqMine.mid===m.id)ScS.reqMine.live=false;scAct(()=>updateDoc(scRef(m.id),{reqBy:"",reqAt:0}).then(()=>toast("Take-over request cancelled.")));});
  on("#ei-x",()=>{ScS.editInfo=false;scMatchView();});
  on("#ei-sv",()=>{const u={overs:Math.max(1,+$("#ei-ov").value||m.overs),ball:$("#ei-bl").value,venue:$("#ei-vn").value.trim(),city:$("#ei-cy").value.trim(),tossWon:$("#ei-tw").value,tossDec:$("#ei-td").value};const dt=new Date($("#ei-dt").value).getTime();if(dt)u.when=dt;ScS.editInfo=false;scAct(()=>updateDoc(scRef(m.id),u).then(()=>toast("Match info updated.")));});
  on("#fx-dl",()=>scDownloadFixtureImage(m,false));
  on("#fx-sh",()=>scDownloadFixtureImage(m,true));
  on("#dls",()=>scDownloadSummaryImage(m,false));
  on("#dls-f",()=>scDownloadFullImage(m,false));
  scRoot().querySelectorAll("[data-r]").forEach(b=>b.onclick=()=>scBall("",+b.dataset.r,0));
  scRoot().querySelectorAll("[data-xk]").forEach(b=>b.onclick=()=>{ScS.ex=false;scBall(b.dataset.xk,+b.dataset.xv,0);});
  scRoot().querySelectorAll("[data-oxk]").forEach(b=>b.onclick=()=>{if(!c||!c.s||!c.b)return scFlash("Set openers first.");ScS.pk.od="";ScS.pk.fl="";ScS.pk.orr=0;ScS.outEx=b.dataset.oxk;ScS.ex=false;scMatchView();});
  on("#oxc",()=>{ScS.outEx=null;scMatchView();});
  on("#oxf",()=>{if(!ScS.outEx)return;const[k,e]=ScS.outEx.split("-");const d=k==="ro"?(ScS.pk.od||""):c.s;if(k==="ro"&&!d)return scFlash("Pick the batter out.");const f=ScS.pk.fl||null;const v=+(ScS.pk.orr||0);ScS.outEx=null;ScS.pk.od="";ScS.pk.fl="";ScS.pk.orr=0;scWicketEx(k,d,v,f,e);});
  scRoot().querySelectorAll("[data-k]").forEach(b=>b.onclick=()=>{
    const k=b.dataset.k,p=b.dataset.p,a=ScS.sel[k]||(ScS.sel[k]=[]),need=Math.min(12,(m["pl"+k]||[]).length);
    if(a.includes(p))ScS.sel[k]=a.filter(x=>x!==p);
    else if(a.length<need)a.push(p);
    else scFlash("Maximum 12 players per team.");
    scMatchView();
  });
  scRoot().querySelectorAll("[data-addpl]").forEach(b=>b.onclick=()=>sqAddFromMatch(m,+b.dataset.addpl));
}
async function scRefreshSquads(m){
  if(!m||!m.t1||!m.t2)return null;
  try{
    const[d1,d2]=await Promise.all([getDoc(doc(db,"squads",m.t1)),getDoc(doc(db,"squads",m.t2))]);
    const mk=d=>{const x=(d.data()||{});return{pl:[...new Set([x.captain_name,...(x.player_list||[])].filter(Boolean))],cap:x.captain_name||""};};
    const a=mk(d1),b=mk(d2);
    await updateDoc(scRef(m.id),{pl1:a.pl,pl2:b.pl,c1:a.cap,c2:b.cap});
    return{pl1:a.pl,pl2:b.pl};
  }catch{return null;}
}
async function sqAddFromMatch(m,k){
  const tid=m["t"+k];if(!tid||!canEditSquad(tid))return;
  const mid=m.id;
  setView("squad");await sqOpen(tid,false);
  SqS.backFn=async()=>{setView("scorer");await scRefreshSquads(m);scOpenMatch(mid);toast("Squad updated — pick the playing squads.");};
  if(SqS.team===tid&&SqS.d&&!SqS.d.is_locked){SqS.edit=true;sqRender();}
}
function scSquadPick(m,k){
  const pl=m["pl"+k]||[],sel=ScS.sel[k]||[],MAX=12,can=!!m["t"+k]&&canEditSquad(m["t"+k]);
  return`<div class="xm"><h3>${esc(m["n"+k])} — PLAYING SQUAD (${sel.length}/${Math.min(MAX,pl.length)})</h3><div class="chips">${pl.map(p=>`<button class="chip ${sel.includes(p)?"on":""}" data-k="${k}" data-p="${esc(p)}">${sel.includes(p)?"✓ ":""}${esc(shortName(p,pl))}</button>`).join("")}</div>${can?`<button class="btn s sm auto" data-addpl="${k}" style="margin-top:10px">+ Add Player</button>`:""}<div class="hint">Tap to select — minimum 2, maximum 12 players.</div></div>`;
}
const scTok=x=>x.w?`<i class="cw">W</i>`:x.e==="wd"?`<i class="cx">Wd${x.r>1?x.r-1:""}</i>`:x.e==="nb"?`<i class="cx">Nb${x.r>1?x.r-1:""}</i>`:x.r===4||x.r>=6?`<i class="cg">${x.r}</i>`:x.r===0?`<i class="c0">•</i>`:`<i>${x.r}</i>`;
function scLastOverBalls(h){const out=[];let legal=0;for(let k=(h||[]).length-1;k>=0;k--){const x=h[k];if(x.e==="ret")continue;out.unshift(x);if(x.b&&++legal>=6)break;}return out;}
function scInnPanel(m){
  const d=scInn(m.history||[],m.cur),i=scInfo(m),kb=i.inn===1?(m.bat1===2?2:1):(m.bat1===2?1:2),bp=m["pl"+kb]||m["xi"+kb]||[],wp=m["pl"+(3-kb)]||m["xi"+(3-kb)]||[];
  const bats=[...d.bats].sort((a,b)=>b.r-a.r).slice(0,3);
  const bows=d.bows.map(x=>{const p=x.f.split("-");return{n:x.n,w:+p[0],r:+p[1],o:p[2]};}).sort((a,b)=>b.w-a.w||a.r-b.r).slice(0,2);
  return`<div class="ob-over${ovTheme(m)}"><div class="ob-over-h">End of innings</div><div class="ob-over-s">${esc(obAbbr(i.bat))} ${m.runs}-${i.w} <small>(${ovs(m.balls)})</small></div>${bats.map(b=>`<div class="ob-over-p">${esc(tvName(b.n,bp))} <b>${b.r}(${b.b})</b>${b.out?"":"*"}</div>`).join("")}${bows.map(o=>`<div class="ob-over-p">${esc(tvName(o.n,wp))} <b>${o.w}-${o.r}</b> (${o.o})</div>`).join("")}</div>`;
}
function scEndPanel(m){
  const i=scInfo(m),k1=m.bat1===2?2:1,poolOf=nm=>{const a=m["pl"+k1]||m["xi"+k1]||[];return a.includes(nm)?a:m["pl"+(3-k1)]||m["xi"+(3-k1)]||[];};
  const inn1line=m.innings===2?`<div class="ob-over-p">${esc(m.bat1===2?m.n2:m.n1)} <b>${m.inn1}-${m.inn1w??0}</b> (${ovs(m.inn1b??0)})</div>`:"";
  const inn2line=`<div class="ob-over-p">${esc(i.bat)} <b>${m.runs}-${i.w}</b> (${ovs(m.balls)})</div>`;
  const allB={},allO={};
  [...(m.hist1||[]),...(m.history||[])].forEach(x=>{
    if(x.s){const b=allB[x.s]??={n:x.s,r:0,b:0};b.r+=x.br||0;if(x.e!=="wd")b.b++;}
    if(x.o){const o=allO[x.o]??={n:x.o,w:0,r:0};o.r+=scBowlerRuns(x);if(x.w&&x.k!=="ro")o.w++;}
  });
  const tb=Object.values(allB).sort((a,b)=>b.r-a.r)[0],to=Object.values(allO).sort((a,b)=>b.w-a.w||a.r-b.r)[0];
  return`<div class="ob-over${ovTheme(m)}"><div class="ob-over-h">End of match</div><div class="ob-over-r">🏆 ${esc((i.res||"").toUpperCase())}</div>${inn1line}${inn2line}${tb?`<div class="ob-over-p">⭐ ${esc(tvName(tb.n,poolOf(tb.n)))} <b>${tb.r}(${tb.b})</b></div>`:""}${to?`<div class="ob-over-p">${CBALL} ${esc(tvName(to.n,poolOf(to.n)))} <b>${to.w}-${to.r}</b></div>`:""}</div>`;
}
function scOverPanel(m){
  const i=scInfo(m),co=Math.floor((m.balls||0)/6);if(co<1)return"";
  const balls=scLastOverBalls(m.history||[]);
  const runs=balls.reduce((a,x)=>a+(x.r||0),0),wkts=balls.filter(x=>x.w).length;
  const c=m.cur||{},kb=i.inn===1?(m.bat1===2?2:1):(m.bat1===2?1:2),bp=m["pl"+kb]||m["xi"+kb]||[],wp=m["pl"+(3-kb)]||m["xi"+(3-kb)]||[];
  const bl=n=>{if(!n)return"";const[r,b]=scBStat(m.history||[],n);return`${esc(tvName(n,bp))} <b>${r}(${b})</b>`;};
  const bats=[c.s,c.n].filter(Boolean).map(bl).filter(Boolean).join(" · ");
  const lastO=[...(m.history||[])].reverse().find(x=>x.o);
  let bowl="";if(lastO&&lastO.o){let r=0,b=0,w=0;(m.history||[]).forEach(x=>{if(x.o===lastO.o){r+=x.r;b+=x.b;if(x.w&&x.k!=="ro")w++;}});bowl=`${esc(tvName(lastO.o,wp))} ${w}-${r} (${Math.floor(b/6)}.${b%6})`;}
  return`<div class="ob-over${ovTheme(m)}"><div class="ob-over-h">End of over ${co}</div><div class="ob-over-s">${esc(obAbbr(i.bat))} ${m.runs}-${i.w} <small>(${ovs(m.balls)})</small></div><div class="ob-over-b"><div class="cs">${balls.map(scTok).join("")}</div></div><div class="ob-over-r">${runs} RUN${runs===1?"":"S"} · ${wkts} WKT${wkts===1?"":"S"}</div>${bats?`<div class="ob-over-p">${bats}</div>`:""}${bowl?`<div class="ob-over-p">${bowl}</div>`:""}</div>`;
}
// Overlay-only team abbreviation: 3+ words = 3 initials, 2 words = 2 initials, 1 word = first 3 letters.
const obAbbr=n=>{const w=String(n||"").trim().split(/\s+/).filter(Boolean);if(!w.length)return"?";if(w.length>=3)return((w[0][0]||"")+(w[1][0]||"")+(w[2][0]||"")).toUpperCase();if(w.length===2)return((w[0][0]||"")+(w[1][0]||"")).toUpperCase();return(w[0]||"").slice(0,3).toUpperCase();};
function scFitTicker(root){if(!root||!root.querySelectorAll)return;
// the main score grows with the innings but must never spill out of its box, even at 300/1
root.querySelectorAll(".sc").forEach(el=>{el.style.fontSize="";let s=parseFloat(getComputedStyle(el).fontSize)||64;let g=0;while(g++<60&&s>20&&el.scrollWidth>el.clientWidth+1){s-=1;el.style.fontSize=s+"px";}});
// the batter names have to sit inside their own box, not slide under the photo
root.querySelectorAll(".ob.mt3 .name").forEach(el=>{el.style.fontSize="";const cs=getComputedStyle(el);let s=parseFloat(cs.fontSize)||16;const txt=(el.textContent||"").trim();if(!txt)return;const cx=document.createElement("canvas").getContext("2d");let g=0;while(g++<50&&s>8){cx.font=cs.fontStyle+" "+cs.fontWeight+" "+s+"px "+cs.fontFamily;const tw=cx.measureText(txt).width;const w=el.clientWidth;if(tw<=w+1)break;s-=1;el.style.fontSize=s+"px";}});
root.querySelectorAll(".bn.fit").forEach(bn=>{bn.querySelectorAll("b,span").forEach(el=>{el.style.fontSize="";let s=parseFloat(getComputedStyle(el).fontSize)||16;const fl=el.tagName==="B"?15:10;let g=0;while(g++<40&&s>fl&&el.scrollWidth>el.clientWidth+1){s-=1;el.style.fontSize=s+"px";}});});root.querySelectorAll(".tm2").forEach(tm=>{const b=tm.querySelector("b");if(!b)return;b.style.fontSize="";let s=parseFloat(getComputedStyle(b).fontSize)||40;let g=0;const mh=((tm.parentElement||{}).clientHeight||60)*0.92;const over=()=>[...b.querySelectorAll("span")].some(x=>x.scrollWidth>x.clientWidth+1)||b.scrollHeight>mh;while(g++<60&&s>19&&over()){s-=1;b.style.fontSize=s+"px";}});
scFitHook(root);
}
// The ticker is drawn in a web font, so a font that lands after the first paint leaves the
// names measured against the fallback and clipped. Measure again when the fonts are ready,
// and again whenever the window changes size, because the metallic ticker scales with --k.
function scFitHook(root){if(!root||root._fitHook)return;root._fitHook=1;const go=()=>{try{scFitTicker(root);}catch(e){}};
if(document.fonts&&document.fonts.ready&&document.fonts.ready.then)document.fonts.ready.then(go).catch(()=>{});
setTimeout(go,800);setTimeout(go,2000);
window.addEventListener("resize",go);
}
// Metallic 3D: the supplied design, rendered with the live match data. It has its own
// shape - the bowler sits in the top row with his own photo, and the stats lead the
// lower row - so it needs its own renderer.
function scBarMt3(m){
  const i=scInfo(m),h=m.history,c=m.cur||{};
  const kb=i.inn===1?(m.bat1===2?2:1):(m.bat1===2?1:2),bp=m["pl"+kb]||m["xi"+kb]||[],wp=m["pl"+(3-kb)]||m["xi"+(3-kb)]||[];
  const photo=(n,side)=>{const p=(ScS.pics[side]||{})[n];return p?'<img src="data:image/jpeg;base64,'+p+'" alt="">':"";};
  const avatar=(n,side)=>'<div class="avatar">'+photo(n,side)+'</div>';
  const bat=(n,on,side,roster)=>{const[r,b]=scBStat(h,n);return'<div class="bat">'+(on?'<span class="arrow"></span>':"")+'<span class="name">'+esc(tvName(n,roster))+'</span>'+avatar(n,side)+'<div class="runs">'+r+'<small>('+b+')</small></div></div>';};
  const mball=x=>x.w?'<span class="ball w">W</span>':x.e==="wd"?'<span class="ball">Wd'+(x.r>1?x.r-1:"")+'</span>':x.e==="nb"?'<span class="ball">Nb'+(x.r>1?x.r-1:"")+'</span>':(x.r===4||x.r>=6)?'<span class="ball">'+x.r+'</span>':x.r===0?'<span class="ball">&bull;</span>':'<span class="ball">'+x.r+'</span>';
  let ov=[],lc=0,full=false;
  h.forEach(x=>{if(x.e==="ret")return;if(full){ov=[];full=false;}ov.push(x);if(x.b&&++lc%6===0)full=true;});
  const circ=ov.map(mball);while(circ.length<6)circ.push('<span class="ball empty"></span>');
  const crr=m.balls?(m.runs/(m.balls/6)).toFixed(2):"0.00";
  const left=i.maxb-m.balls;
  let stats="";
  if(i.inn===1){const proj=crr>0?Math.round((crr*m.overs)).toFixed(0):m.runs;stats='CRR '+crr+'<span class="dot">&bull;</span>PROJ '+proj;}
  else{const need=m.inn1-m.runs+1;const rrr=left>0&&need>0?(need/(left/6)).toFixed(2):"0.00";stats='CRR '+crr+'<span class="dot">&bull;</span>RRR '+rrr+'<span class="dot">&bull;</span>Target '+(m.inn1+1)+(need>0?'<span class="dot">&bull;</span>NEED '+need+' OFF '+left:"");}
  let bowName="",bowFig="",bowOvers="";
  if(c.b){let r=0,b=0,w=0;h.forEach(x=>{if(x.o===c.b){r+=scBowlerRuns(x);b+=x.b;if(x.w&&x.k!=="ro")w++;}});bowName=tvName(c.b,wp);bowFig=w+"-"+r;bowOvers="("+Math.floor(b/6)+"."+(b%6)+")";}
  const wrap='<div class="ob-credit">SquareCut</div>';
  if(m.status==="scheduled"||i.done){
    const batFirst=m.bat1===2?m.n2:m.n1;
    const L=i.done?batFirst:(!m.tossWon?m.n1:(m.tossDec==="Bowl"?(m.tossWon===m.n1?m.n2:m.n1):m.tossWon));
    const R=(L===m.n1)?m.n2:m.n1;
    const txt=i.done?i.res:(L+" v "+R);
    return'<div class="ob mt3">'+wrap+'<div class="top"><div class="badge ws"><b>'+esc(obAbbr(L))+'</b></div><div class="lead"><div class="score">'+esc(txt)+'</div><div class="overs ovw"><i>When</i><strong>'+esc(when(m.when))+'</strong></div></div><div class="mid"></div><div class="bat bowl"></div><div class="badge rss"><b>'+esc(obAbbr(R))+'</b></div></div><div class="bottom"><div class="stats">'+esc(tname(m.tid))+'</div><div class="over"><span class="lbl">'+(i.done?"Result":"Start")+'</span></div></div></div>';
  }
  return'<div class="ob mt3">'+wrap+'<div class="top"><div class="badge ws"><b>'+esc(obAbbr(i.bat))+'</b></div><div class="lead"><div class="score">'+(m.runs)+'-'+(i.w)+'</div><div class="overs"><strong>'+ovs(m.balls)+'</strong><em>('+(m.overs)+')</em></div></div><div class="mid">'+(c.s?bat(c.s,true,kb,bp):"")+(c.n?bat(c.n,false,kb,bp):"")+'</div><div class="bat bowl">'+(bowName?avatar(c.b,3-kb)+'<div class="runs pink"><span class="fig">'+bowFig+'</span><small>'+bowOvers+'</small></div>':"")+'</div><div class="badge rss"><b>'+esc(obAbbr(i.bowl))+'</b></div></div><div class="bottom"><div class="stats">'+stats+'</div><div class="over">'+(bowName?'<span class="name bnm">'+esc(bowName)+'</span>':"")+'<span class="lbl">This<br>over</span>'+circ.join("")+'</div></div></div>';
}
function scBar(m){
  const i=scInfo(m),h=m.history,c=m.cur||{};
  const style=m.overlayStyle||"",theme=ovTheme(m);
  if(style==="mt3")return scBarMt3(m);
  if(m.status==="scheduled"||i.done){
    const batFirst=m.bat1===2?m.n2:m.n1;const L=i.done?batFirst:(!m.tossWon?m.n1:(m.tossDec==="Bowl"?(m.tossWon===m.n1?m.n2:m.n1):m.tossWon));const R=(L===m.n1)?m.n2:m.n1;const txt=i.done?`🏆 ${esc(i.res)}`:`${esc(L)} v ${esc(R)} (${esc(when(m.when))})`;
    const sub=i.done?`${esc(m.bat1===2?m.n2:m.n1)} ${m.inn1}/${m.inn1w??0} · ${esc(i.bat)} ${m.runs}/${i.w}`:"";
    return`<div class="ob${theme}" style="height:5rem"><div class="ob-credit">SquareCut</div><div class="ob1"><div class="lp"><div class="tm tm2"><b>${obAbbr(L)}</b></div></div><div class="bn fit"><b>${txt}</b><span>${sub}</span></div><div class="rp"><div class="tm tm2"><b>${obAbbr(R)}</b></div></div></div></div>`;
  }
  if(i.i1over){
    return`<div class="ob${theme}" style="height:5rem"><div class="ob-credit">SquareCut</div><div class="ob1"><div class="lp"><div class="tm tm2"><b>${obAbbr(i.bat)}</b></div></div><div class="bn fit"><b>END OF INNINGS</b><span>${esc(i.bat)} ${m.runs}/${i.w} (${ovs(m.balls)}) · TARGET ${m.runs+1} IN ${m.overs} OVERS</span></div><div class="rp"><div class="tm tm2"><b>${obAbbr(i.bowl)}</b></div></div></div></div>`;
  }
  const fig=n=>{let r=0,b=0,w=0;h.forEach(x=>{if(x.o===n){r+=scBowlerRuns(x);b+=x.b;if(x.w&&x.k!=="ro")w++;}});return`${w}-${r}<small>(${Math.floor(b/6)}.${b%6})</small>`;};
  let ov=[],lc=0,full=false;
  h.forEach(x=>{if(x.e==="ret")return;if(full){ov=[];full=false;}ov.push(x);if(x.b&&++lc%6===0)full=true;});
  const cc=x=>x.w?`<i class="cw">W</i>`:x.e==="wd"?`<i class="cx">Wd${x.r>1?x.r-1:""}</i>`:x.e==="nb"?`<i class="cx">Nb${x.r>1?x.r-1:""}</i>`:x.r===4||x.r>=6?`<i class="cg">${x.r}</i>`:x.r===0?`<i class="c0">•</i>`:`<i>${x.r}</i>`;
  const circ=ov.map(cc);while(circ.length<6)circ.push(`<i class="e"></i>`);
  const first=[];h.forEach(x=>{if(x.p)x.p.slice(0,2).forEach(n=>n&&!first.includes(n)&&first.push(n));});
  const idx=n=>first.includes(n)?first.indexOf(n):99;
  const bs=[c.s,c.n].filter(Boolean).sort((a,b)=>idx(a)-idx(b));
  const kb=i.inn===1?(m.bat1===2?2:1):(m.bat1===2?1:2),bp=m["pl"+kb]||m["xi"+kb]||[],wp=m["pl"+(3-kb)]||m["xi"+(3-kb)]||[];
  const pic=n=>{const p=(ScS.pics[kb]||{})[n];return p?`<span class="ph"><img src="data:image/jpeg;base64,${p}"></span>`:"";};
  const bt=(n,k)=>{const[r,b]=scBStat(h,n);return`<div class="bt" data-b="${k}"><span class="nm"><u class="${n===c.s?"on":""}"></u>${esc(tvName(n,bp))}</span>${pic(n)}<span class="rn">${r}<small>(${b})</small></span></div>`;};
  const crr=m.balls?(m.runs/(m.balls/6)).toFixed(2):"0.00";
  const left=i.maxb-m.balls;
  let mid="";
  if(i.inn===1){const proj=crr>0?Math.round((crr*m.overs)).toFixed(0):m.runs;mid=`CRR <u>${crr}</u> · PROJ <u>${proj}</u>`;}
  else{const need=m.inn1-m.runs+1;const rrr=left>0&&need>0?(need/(left/6)).toFixed(2):"0.00";const needTxt=need>0?`NEED ${need} OFF ${left}`:"TARGET ACHIEVED";mid=`CRR <u>${crr}</u> · RRR <u>${rrr}</u> · TGT <u class="tgt">${m.inn1+1}</u> · ${needTxt}`;}
  return`<div class="ob${theme}"><div class="ob-credit">SquareCut</div><div class="ob1"><div class="lp"><div class="tm tm2"><b>${obAbbr(i.bat)}</b></div></div><div class="sc">${m.runs}-${i.w}</div><div class="ovs"><small>OVERS</small><b>${ovs(m.balls)}</b><i>(${m.overs})</i></div>${[0,1].map(k=>bs[k]?bt(bs[k],k):`<div class="bt"></div>`).join("")}<div class="rp"><div class="tm tm2"><b>${obAbbr(i.bowl)}</b>${(style==="cyberpunk"||style==="luxury"||style==="mt3")&&i.inn===2?`<em>TARGET ${m.inn1+1}</em>`:""}</div></div></div><div class="ob2"><div class="to">THIS<br>OVER</div><div class="cs">${circ.join("")}</div><div class="mid">${mid}</div><div class="bw">${esc((c.b?tvName(c.b,wp):"—").toUpperCase())}${c.b?`<em>${fig(c.b)}</em>`:""}</div></div></div>`;
}
async function scLoadPics(m){
  if(ScS.picsFor===m.id)return;ScS.picsFor=m.id;ScS.pics={1:{},2:{}};
  for(const k of[1,2]){
    if(!m["t"+k])continue;
    try{const d=(await getDoc(doc(db,"squads",m["t"+k]))).data()||{};(d.player_list||[]).forEach((n,i)=>{const p=(d.squad_pics||{})[i];if(n&&p)ScS.pics[k][n]=p;});if(d.captain_name&&d.cap_pic)ScS.pics[k][d.captain_name]=d.cap_pic;}catch{}
  }
}
// The scoreticker style saved on a match. Only the two new ticker themes are offered now,
// but the old colour values still work if a match already has one saved.
const ovTheme=m=>{const s=(m&&m.overlayStyle)||"";return["gold","neon","red","blue","cyberpunk","luxury","lux2","mt3"].includes(s)?" "+s:"";};
function scSplashFor(m){
  const th=ovTheme(m);
  const h=m.history||[];if(!h.length)return"";

  const x=h[h.length-1];
  const kb=(m.innings||1)===1?(m.bat1===2?2:1):(m.bat1===2?1:2),bp=m["pl"+kb]||m["xi"+kb]||[];
  if(x.s&&!x.w){
    const[r,b]=scBStat(h,x.s),before=r-(x.br||0);
    if(before<100&&r>=100)return`<div class="ob-sp${th} hundred"><b>Hundred!</b><span>${esc(tvName(x.s,bp))} ${r} (${b})</span></div>`;
    if(before<50&&r>=50)return`<div class="ob-sp${th} fifty"><b>Fifty!</b><span>${esc(tvName(x.s,bp))} ${r} (${b})</span></div>`;
  }
  if(x.w)return`<div class="ob-sp${th} out"><b>Out!</b><span>${esc(tvName(x.d||x.s||"",bp))}</span></div>`;
  if((x.br||0)===6)return`<div class="ob-sp${th} six"><b>Six!</b><span>${esc(tvName(x.s||"",bp))}</span></div>`;
  if((x.br||0)===4)return`<div class="ob-sp${th} four"><b>Four!</b><span>${esc(tvName(x.s||"",bp))}</span></div>`;
  return"";
}
async function scOverlay(id){
  CurView="overlay";document.body.dataset.view="overlay";
  const usp=(new URLSearchParams(location.search).get("style")||"").trim();
  document.documentElement.classList.add("ovh");document.body.classList.add("ovb");
  document.body.classList.remove("light");
  $("#home-app").hidden=true;$("#squad-app").hidden=true;$("#scorer-app").hidden=false;
  const sq=$("#css-squad");if(sq)sq.disabled=true;const sc=$("#css-scorer");if(sc)sc.disabled=false;
  let last=null,prevLen=-1,prevOver=-1,prevDone=false,prevI1=false,splash="",splashT=null,overHtml="",overNum=0,overT=null,innHtml="",innT=null,endHtml="",endT=null;
  const paint=()=>{scRoot().innerHTML=`<div class="w">`+(last?scBar(last):"")+splash+overHtml+innHtml+endHtml+`</div>`;scFitTicker(scRoot());};
  const hideOver=()=>{overHtml="";clearTimeout(overT);};
  const hideInn=()=>{innHtml="";clearTimeout(innT);};
  const hideEnd=()=>{endHtml="";clearTimeout(endT);};
  onSnapshot(scRef(id),s=>{
    if(!s.exists()){last=null;prevLen=-1;prevOver=-1;prevDone=false;prevI1=false;splash="";overHtml="";innHtml="";endHtml="";clearTimeout(splashT);clearTimeout(overT);clearTimeout(innT);clearTimeout(endT);return paint();}
    last={...s.data(),id:s.id,history:s.data().history||[]};if(usp)last.overlayStyle=usp;
    const len=last.history.length,co=Math.floor((last.balls||0)/6),info=scInfo(last),doneNow=info.done,i1Now=info.i1over,innNow=last.innings||1;
    if(prevLen>=0){
      if(len>prevLen){
        splash=scSplashFor(last);clearTimeout(splashT);if(splash)splashT=setTimeout(()=>{splash="";paint();},6000);
        if(!prevDone&&doneNow){hideOver();hideInn();endHtml=scEndPanel(last);clearTimeout(endT);if(endHtml)endT=setTimeout(()=>{hideEnd();paint();},25000);}
        else if(!prevI1&&i1Now&&innNow===1){hideOver();innHtml=scInnPanel(last);clearTimeout(innT);if(innHtml)innT=setTimeout(()=>{hideInn();paint();},15000);}
        else{
          if(overHtml&&last.balls>overNum*6)hideOver();
          if(last.balls>0&&co>0&&co>prevOver){overNum=co;overHtml=scOverPanel(last);clearTimeout(overT);if(overHtml)overT=setTimeout(()=>{hideOver();paint();},12000);}
        }
      }
      else if(len<prevLen){splash="";hideOver();hideInn();hideEnd();clearTimeout(splashT);}
      if(innHtml&&(innNow!==1||!i1Now))hideInn();
      if(endHtml&&!doneNow)hideEnd();
      if(overHtml&&last.balls>overNum*6)hideOver();
    }
    prevLen=len;prevOver=co;prevDone=doneNow;prevI1=i1Now;paint();
    if(ScS.picsFor!==s.id)scLoadPics(last).then(paint);
  });
}
