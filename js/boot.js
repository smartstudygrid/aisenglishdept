// boot.js — split from index.single.html (no logic changes).
// Classic script: shares global scope with the other js/*.js files (same as the old single <script type="module">).
// Firebase symbols (db, auth, collection, doc, ...) come from js/firebase-init.js via window.
(async () => {
  // Wait for firebase-init module (deferred) before touching db/auth.
  await window.__firebaseReady;
// ---------- BOOT (overlay + match compat) ----------
const q=new URLSearchParams(location.search),mid=(q.get("match")||"").trim().toUpperCase(),joinTid=(q.get("join")||"").trim(),teamTid=(q.get("team")||"").trim(),trMid=(q.get("transfer")||"").trim().toUpperCase(),trTok=(q.get("token")||"").trim();
const netUpd=()=>{const off=!navigator.onLine;document.body.classList.toggle("offline",off);const nb=$("#netbar");if(nb)nb.hidden=!off;};
window.addEventListener("online",()=>{netUpd();toast("Back online — syncing.");});
window.addEventListener("offline",netUpd);
netUpd();
// A link can arrive while the app is already open. The native side hands us the query and
// the same routing the boot below does runs, without reloading the app.
window.__sqDeepLink=async qs=>{
  const dq=new URLSearchParams(qs||"");
  const dmid=(dq.get("match")||"").trim().toUpperCase(),djoin=(dq.get("join")||"").trim(),dteam=(dq.get("team")||"").trim();
  if(!dmid&&!djoin&&!dteam)return false;
  try{await auth.authStateReady;}catch{}
  if(djoin){if(auth.currentUser)joinTeamView(djoin);else{try{localStorage.setItem("scPendingJoin",djoin);}catch{}setView("home");toast("Sign in (or create an account) to join — you'll continue automatically.");}return true;}
  if(dteam){if(auth.currentUser)teamProfileView(dteam);else{try{localStorage.setItem("scPendingTeam",dteam);}catch{}setView("home");toast("Sign in (or create an account) to view the team — you'll continue automatically.");}return true;}
  if(dmid){setView("scorer");scOpenMatch(dmid);return true;}
  return false;
};
if(q.get("mode")==="overlay"&&mid){scOverlay(mid);}
else{
  applyTheme();
  const mm=$("#hm-menu");if(mm)mm.onclick=()=>{renderDrawer();openDrawer();};
  const hb=$("#hm-back");
  if(hb){
    const backEls=()=>[...document.querySelectorAll(".bkbtn,#bk")].filter(x=>!x.disabled&&x.getClientRects().length);
    const canBack=()=>!!(typeof backNow==="function"&&backNow())||backEls().length>0;
    const updBack=()=>{hb.hidden=!canBack();};
    window.__updBack=updBack;
    hb.onclick=()=>{const f=(typeof backNow==="function")?backNow():null;if(f){f();return;}const b=backEls()[0];if(b)b.click();};
    let pend=false;const soon=()=>{if(pend)return;pend=true;requestAnimationFrame(()=>{pend=false;updBack();});};
    const mo=new MutationObserver(soon);
    ["#home-app","#squad-app","#scorer-app"].forEach(s=>{const el=document.querySelector(s);if(el)mo.observe(el,{childList:true,subtree:true,attributes:true,attributeFilter:["hidden","class","style"]});});
    window.addEventListener("resize",soon);
    updBack();
  }
  const sr=$("#hm-scrim");if(sr)sr.onclick=closeDrawer;
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&drawerOpen()&&!document.querySelector(".app-modal-ov"))closeDrawer();});
  await auth.authStateReady?.();
  if(!auth.currentUser)await ensureAuth(true);
  if(auth.currentUser&&auth.currentUser.isAnonymous)Auth.guest=true;
  await refreshRole(auth.currentUser);
  if(needsVerify(auth.currentUser))showVerifyGate();else if(auth.currentUser&&!auth.currentUser.isAnonymous)ensureScorerDoc();
  await loadTours();await sqLoadTeams();
  ScS.sumParam=q.get("summary")==="1";
  if(mid&&!auth.currentUser)Auth.guest=true;
  onAuthStateChanged(auth,async u=>{await refreshRole(u);renderChrome();if(u&&u.isAnonymous)Auth.guest=true;if(needsVerify(u)){showVerifyGate();return;}hideVerifyGate();if(u&&!u.isAnonymous)ensureScorerDoc();if(drawerOpen())renderDrawer();if(u)setTimeout(()=>{try{scAlerts();}catch{}},400);if(u&&pendingNav())return;afterAuthRender();});
  onSnapshot(collection(db,"matches"),s=>{ScMatches=s.docs.map(d=>({...d.data(),id:d.id}));try{scAlerts();}catch{}if(CurView==="scorer"&&ScS.view==="list")scMatchList();else if(CurView==="scorer"&&ScS.view==="play")scPlay();if(drawerOpen())renderDrawer();if(CurView==="home"||CurView==="cricket"||CurView==="account"){const ae=document.activeElement;if(!ae||!$("#home-app").contains(ae)){if(CurView==="cricket")cricketView();else if(CurView==="account")accountView();else renderHome();}}});
  if(trMid&&trTok){claimTransfer(trMid,trTok);}
  else if(teamTid){if(auth.currentUser){teamProfileView(teamTid);}else{try{localStorage.setItem("scPendingTeam",teamTid);}catch{}setView("home");toast("Sign in (or create an account) to view the team — you'll continue automatically.");}}
  else if(joinTid){if(auth.currentUser){joinTeamView(joinTid);}else{try{localStorage.setItem("scPendingJoin",joinTid);}catch{}setView("home");toast("Sign in (or create an account) to join — you'll continue automatically.");}}
  else if(mid){setView("scorer");scOpenMatch(mid);}else{setView("home");}
}
})();
