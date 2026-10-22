// home.js — split from index.single.html (no logic changes).
// Classic script: shares global scope with the other js/*.js files (same as the old single <script type="module">).
// Firebase symbols (db, auth, collection, doc, ...) come from js/firebase-init.js via window.
// ---------- HOME (simple landing) ----------
function renderHome(){
  setCssForHome();
  const u=Auth.user;
  const live=ScMatches.filter(m=>m.status==="live");
  $("#home-app").innerHTML=`<div class="hm-wrap">
    <div class="hm-hero"><div class="hm-banner"><img src="SquareCut.png" class="hm-banner-logo" alt="SquareCut"></div>
    <div class="hm-t">Created by Amanullah Khan</div>
    <div class="hm-line"></div></div>
    <div class="hm-top"><span class="hm-user">${u?esc(u.email)+" · "+(Auth.admin?"Admin":"Signed in"):Auth.guest?"Guest — menu ☰ for options":"Not signed in"}</span></div>
    ${u&&!Auth.admin&&!guideHidden()&&!guideDone()?`<div class="hm-card" style="margin-top:14px;text-align:left"><div style="display:flex;justify-content:space-between;align-items:center"><h2>🚀 Get Started</h2><button class="hm-btn sec sm" id="gs-x">✕</button></div>${guideSteps().map(s=>`<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:9px 0;border-top:1px solid rgba(255,255,255,.08);font-weight:700"><span>${s.done?"✅ ":s.n+". "}${esc(s.t)}<br><small class="mut">${esc(s.sub)}</small></span>${s.done?"":`<button class="hm-btn sec sm" data-gs="${s.k}">Go</button>`}</div>`).join("")}</div>`:""}
    ${!u&&!Auth.guest?`<div class="hm-login"><div class="hm-row"><button class="hm-btn ${window._su?"sec":""}" id="tab-si">Sign In</button><button class="hm-btn ${window._su?"":"sec"}" id="tab-su">Sign Up</button></div>
      <label>Email</label><input id="hm-e" type="text" autocomplete="username"><label>Password ${window._su?"(min 6)":""}</label><input id="hm-p" type="password" autocomplete="current-password">
      <button class="hm-btn" id="hm-si">${window._su?"Create Account":"Sign In"}</button>
      <div class="hm-row" style="margin-top:8px"><button class="hm-btn sec" id="hm-g">Continue as Guest</button><button class="hm-btn sec" id="hm-f">Forgot?</button></div>
      <div class="hm-msg" id="hm-m"></div>
      ${window._su?`<div class="hint" style="text-align:center;margin-top:6px">New accounts get a verification email — open the link, then create your tournaments, teams &amp; matches.</div>`:""}</div>`:""}
    <div class="hm-tiles">
      <button class="hm-tile hm-tile-live" id="hm-live"><span class="hm-tile-ic">🔴</span><span class="hm-tile-b">Live Matches</span><span class="hm-tile-s">${live.length?live.length+" running right now":"Nothing running right now"}</span>${live.length?`<span class="hm-tile-n">${live.length}</span>`:""}</button>
    </div>
    <div class="hm-tiles hm-tiles-2">
      <button class="hm-tile" id="hm-sc"><span class="hm-tile-ic">🏏</span><span class="hm-tile-b">Score a Match</span><span class="hm-tile-s">Ball by ball</span></button>
      <button class="hm-tile" id="hm-cri"><span class="hm-tile-ic">📊</span><span class="hm-tile-b">My Cricket</span><span class="hm-tile-s">Teams, tours, matches</span></button>
      <button class="hm-tile" id="hm-sq"><span class="hm-tile-ic">👥</span><span class="hm-tile-b">Squads &amp; Teams</span><span class="hm-tile-s">Squads and players</span></button>
      <button class="hm-tile" id="hm-tour"><span class="hm-tile-ic">🏆</span><span class="hm-tile-b">Tournaments</span><span class="hm-tile-s">Points, fixtures, scorers</span></button>
    </div>
    <div class="hm-links">
      <a class="hm-link" href="https://smartstudygrid.github.io/Tournament-Fixtures-Creator/" target="_blank" rel="noopener">🗓️ Smart Fixtures Creator</a>
      <button class="hm-link" id="hm-pts">⭐ Points System</button>
    </div>
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
        Auth.guest=false;await refreshRole(c.user);try{await sendEmailVerification(c.user);}catch{}toast("Account created — we emailed you a verification link.");showVerifyGate();
        // account record is created after the email is verified (ensureScorerDoc)
      }else{
        await signInWithEmailAndPassword(auth,em,pw);Auth.guest=false;await refreshRole(auth.currentUser);if(needsVerify(auth.currentUser)){toast("Please verify your email first — we sent you a link.");showVerifyGate();return;}ensureScorerDoc();await loadTours();await sqLoadTeams();routeHome();
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
  $("#hm-pts").onclick=()=>setView("points");
  if($("#hm-cri"))$("#hm-cri").onclick=()=>{ScS.cseg=ScS.cseg||"teams";setView("cricket");};
  if($("#hm-tour"))$("#hm-tour").onclick=()=>tourHub();
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

// ---------- points system: explains the scoring, reachable from the home screen ----------
function renderPoints(){
  setCssForHome();
  setBack(()=>setView("home"));
  const grp=g=>`<div class="pts-card"><div class="pts-kicker">${esc(g.g)}</div><table class="pts-t"><tbody>${g.rows.map(r=>`<tr><td>${esc(r[0])}</td><td>+${r[1]}</td></tr>`).join("")}</tbody></table></div>`;
  $("#home-app").innerHTML=`<div class="hm-wrap">
    <div class="pts-top"><button class="btn sec sm" id="pts-back">← Back to Home</button><div class="pts-title">⭐ Points System</div><div class="pts-sub">How the Man of the Match, the MVP and the leaderboards are scored</div></div>
    ${MVP_TABLE.map(grp).join("")}
    <div class="pts-card"><div class="pts-kicker">How it works</div>
      <ul class="pts-ul">
        <li>A <b>dot ball</b> is a legal delivery where <b>no runs were scored</b> and no wicket fell.</li>
        <li>Milestone bonuses are earned <b>once per innings</b>. A fifty is worth 3.5 and a century 5; a three wicket haul is worth 3.5 and a five wicket haul 5. The higher tier replaces the lower one, so a century is 5 and not 3.5 plus 5.</li>
        <li>A catch and a stumping are worth the fielder, and the bowler also earns the wicket.</li>
        <li>A run out is not in the system, so it earns nothing.</li>
      </ul>
    </div>
    <div class="pts-foot">The Man of the Match for each match is chosen from the points the players earned in that match. The tournament MVP race and the best batter and best bowler lists all use these same points.</div>
  </div>`;
  $("#pts-back").onclick=()=>setView("home");
  renderChrome();
}
