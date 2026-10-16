// home.js — split from index.single.html (no logic changes).
// Classic script: shares global scope with the other js/*.js files (same as the old single <script type="module">).
// Firebase symbols (db, auth, collection, doc, ...) come from js/firebase-init.js via window.
// ---------- HOME (simple landing) ----------
function renderHome(){
  setCssForHome();
  const u=Auth.user;
  const live=ScMatches.filter(m=>m.status==="live");
  $("#home-app").innerHTML=`<div class="hm-wrap">
    <div class="hm-hero"><div class="hm-banner"><img src="SmartCric.png" class="hm-banner-logo" alt="SmartCric"></div>
    <div class="hm-t">Created by Amanullah Khan</div>
    <div class="hm-line"></div></div>
    <div class="hm-top"><span class="hm-user">${u?esc(u.email)+" · "+(Auth.admin?"Admin":"Signed in"):Auth.guest?"Guest — menu ☰ for options":"Not signed in"}</span></div>
    ${u&&!Auth.admin&&!guideHidden()&&!guideDone()?`<div class="hm-card" style="margin-top:14px;text-align:left"><div style="display:flex;justify-content:space-between;align-items:center"><h2>🚀 Get Started</h2><button class="hm-btn sec" style="width:auto;margin:0;padding:4px 12px" id="gs-x">✕</button></div>${guideSteps().map(s=>`<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:9px 0;border-top:1px solid rgba(255,255,255,.08);font-weight:700"><span>${s.done?"✅ ":s.n+". "}${esc(s.t)}<br><small class="mut">${esc(s.sub)}</small></span>${s.done?"":`<button class="hm-btn sec" style="width:auto;margin:0;padding:8px 16px" data-gs="${s.k}">Go</button>`}</div>`).join("")}</div>`:""}
    ${!u&&!Auth.guest?`<div class="hm-login"><div style="display:flex;gap:8px"><button class="hm-btn ${window._su?"sec":""}" id="tab-si" style="margin-top:0">Sign In</button><button class="hm-btn ${window._su?"":"sec"}" id="tab-su" style="margin-top:0">Sign Up</button></div>
      <label>Email</label><input id="hm-e" type="text" autocomplete="username"><label>Password ${window._su?"(min 6)":""}</label><input id="hm-p" type="password" autocomplete="current-password">
      <button class="hm-btn" id="hm-si">${window._su?"Create Account":"Sign In"}</button>
      <div style="display:flex;gap:10px;margin-top:8px"><button class="hm-btn sec" id="hm-g">Continue as Guest</button><button class="hm-btn sec" id="hm-f">Forgot?</button></div>
      <div class="hm-msg" id="hm-m"></div>
      ${window._su?`<div class="hint" style="text-align:center;margin-top:6px">New accounts can create their own tournaments, teams &amp; matches instantly.</div>`:""}</div>`:""}
    <div class="hm-card" style="margin-top:14px"><button class="hm-btn hm-live-btn" id="hm-live" style="margin:0"><span class="hm-live-dot"></span>Live Matches${live.length?`<b class="hm-live-n">${live.length}</b>`:""}</button></div>
    <div class="hm-grid">
      <div class="hm-card"><button class="hm-btn" id="hm-sc">🏏 Score a Match</button></div>
      <div class="hm-card"><button class="hm-btn" id="hm-sq">👥 Squads &amp; Teams</button></div>
    </div>
    <a class="hm-btn" style="text-align:center;text-decoration:none" href="https://smartstudygrid.github.io/Tournament-Fixtures-Creator/" target="_blank" rel="noopener">🗓️ Smart Fixtures Creator</a>
  </div>`;
  const m=t=>{const e=$("#hm-m");if(e){e.textContent=t;e.className="hm-msg hm-err";}};
  if($("#tab-si"))$("#tab-si").onclick=()=>{window._su=false;renderHome();};
  if($("#tab-su"))$("#tab-su").onclick=()=>{window._su=true;renderHome();};
  if($("#hm-si"))$("#hm-si").onclick=async()=>{
    const em=$("#hm-e").value.trim(),pw=$("#hm-p").value;
    if(!em.includes("@"))return m("Enter a valid email.");
    try{
      if(window._su){
        if(pw.length<6)return m("Password must be at least 6 characters.");
        const c=await createUserWithEmailAndPassword(auth,em,pw);
        await setDoc(doc(db,"scorers",em.toLowerCase()),{email:em.toLowerCase(),tids:[],teamIds:[],created:Date.now()},{merge:true});
        Auth.guest=false;await refreshRole(c.user);await loadTours();await sqLoadTeams();toast("Account created — you can now create tournaments, teams & matches.");routeHome();
      }else{
        await signInWithEmailAndPassword(auth,em,pw);Auth.guest=false;await refreshRole(auth.currentUser);await loadTours();await sqLoadTeams();routeHome();
      }
    }catch(e){$("#hm-p").value="";m(e.code==="auth/email-already-in-use"?"Email already registered. Sign in instead.":e.code==="auth/too-many-requests"?"Too many attempts. Try later.":e.message);}
  };
  if($("#hm-p"))$("#hm-p").onkeydown=e=>{if(e.key==="Enter")$("#hm-si").click();};
  if($("#hm-g"))$("#hm-g").onclick=async()=>{if(!auth.currentUser)await ensureAuth(true);Auth.guest=true;renderHome();};
  if($("#hm-f"))$("#hm-f").onclick=async()=>{
    const em=($("#hm-e").value||"").trim();if(!em.includes("@"))return m("Enter your email first, then Forgot.");
    try{await sendPasswordResetEmail(auth,em);const e=$("#hm-m");e.textContent="Reset email sent.";e.className="hm-msg hm-ok";}catch(e){m(e.message);}
  };
  $("#hm-sq").onclick=()=>setView("squad");
  $("#hm-sc").onclick=()=>{ScS.playNext=true;setView("scorer");};
  if($("#hm-live"))$("#hm-live").onclick=()=>{
    const lv=ScMatches.filter(m=>{try{return m.status==="live"&&!scInfo({...m,history:m.history||[]}).done;}catch{return m.status==="live";}}).sort((a,b)=>(b.when||0)-(a.when||0));
    if(lv.length)ScS.tour=lv[0].tid||"friendly";
    ScS.tab="m";ScS.mt="l";
    setView("scorer");
  };
  document.querySelectorAll("[data-gs]").forEach(b=>b.onclick=()=>guideGo(b.dataset.gs));
  if($("#gs-x"))$("#gs-x").onclick=()=>{try{localStorage.setItem("scGuideHide","1");}catch{}renderHome();};
  if(u&&!Auth.admin&&!guideHidden()&&!guideDone())ensureGuideData();
  renderChrome();
}
