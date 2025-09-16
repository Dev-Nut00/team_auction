// Minimal bootstrap; real logic will be appended via patches
const LS_KEY = "lol_auction_state_v1";
const LS_UI = "lol_auction_ui_scale_v1";

const rolesStd = ["Top","Jungle","Mid","ADC","Support"];

let state = { started:false };

const els = {
  config: document.getElementById('config'),
  auction: document.getElementById('auction'),
  players: document.getElementById('players'),
  startBtn: document.getElementById('startBtn'),
  uiScale: document.getElementById('uiScale'),
};

function applyScale(scale){
  const cls=["size-small","size-normal","size-large"];document.body.classList.remove(...cls);
  if(scale==='small')document.body.classList.add('size-small');
  else if(scale==='large')document.body.classList.add('size-large');
  else document.body.classList.add('size-normal');
  try{localStorage.setItem(LS_UI,scale);}catch{}
}

function init(){
  const savedScale = localStorage.getItem(LS_UI)||'normal';
  applyScale(savedScale);
  if(els.uiScale){ els.uiScale.value=savedScale; els.uiScale.addEventListener('change',e=>applyScale(e.target.value)); }
  bindCore();
}

init();

function bindCore(){
  // bind later-added controls when present
  const start = document.getElementById('startBtn');
  if(start){ start.addEventListener('click', startAuction); }
}

function startAuction(){
  const inputTeamNames = [0,1,2,3].map(i=> (document.getElementById('team'+i)?.value||'팀').trim());
  const budget = Math.max(1, Number((document.getElementById('budget')||{}).value||1000));
  const rosterSize = Math.max(1, Number((document.getElementById('rosterSize')||{}).value||5));
  const enforceRoles = !!(document.getElementById('enforceRoles')||{}).checked;
  const randomizeOrder = !!(document.getElementById('randomizeOrder')||{}).checked;
  const randomizeTeamOrder = !!(document.getElementById('randomizeTeamOrder')||{}).checked;
  const nominationMode = !!(document.getElementById('nominationMode')||{}).checked;
  const playersText = (document.getElementById('players')||{}).value||'';
  const leadersText = (document.getElementById('leaders')||{}).value||'';
  const useLeadersAsTeamNames = !!(document.getElementById('useLeadersAsTeamNames')||{}).checked;
  const players = parsePlayers(playersText);
  const leaders = leadersText.split(/\n+/).map(s=>s.trim()).filter(Boolean);
  if(!players.length){ alert('선수 목록을 입력해주세요.'); return; }
  const teamNames = (useLeadersAsTeamNames && leaders.length>=4) ? leaders.slice(0,4) : inputTeamNames;
  const leaderSet = new Set(leaders.map(s=>s.trim()));
  const filteredPlayers = players.filter(p=>!leaderSet.has((p.name||'').trim()));
  const baseOrder=[0,1,2,3]; const teamOrder = randomizeTeamOrder ? shuffle(baseOrder) : baseOrder;
  state = {
    started:true, enforceRoles, rosterSize, budget, bidStep:5, openingMin:5,
    randomizeOrder, randomizeTeamOrder, nominationMode,
    round:0, reauctionMax:2,
    teams: teamNames.map((name,id)=>({ id, name, leader: leaders[id]||null, budgetLeft:budget, roster:[] })),
    queue: randomizeOrder ? shuffle(filteredPlayers) : filteredPlayers,
    leaders, teamOrder, nominatorIndex:0,
    currentIndex:0, highest:null, history:[], unsoldCollector:[],
  };
  els.config?.classList.add('hidden'); els.auction?.classList.remove('hidden');
  refreshBidTeamOptions(); updateUI(); saveToStorage();
}

function parsePlayers(text){
  return String(text||'').split(/\n+/).map(l=>l.trim()).filter(Boolean).map(line=>{
    const parts=line.split(',').map(s=>s&&s.trim()).filter(Boolean);
    const name = parts[0]||''; const rest = parts.slice(1);
    let roles=[], role=null, image=null, description=null, tier=null;
    if(rest.length){
      if(rest[0] && (rest[0].includes('|')||rest[0].includes('/'))){ roles=parseRoles(rest[0]); role=roles[0]||null; rest.shift(); }
      else if(rest[0] && rolesStd.includes(rest[0])){ roles=parseRoles(rest[0]); role=roles[0]||null; rest.shift(); }
      const extras=[]; for(const token of rest){ if(!image && looksLikeImage(token)) image=token; else if(!tier){ const t=parseTier(token); if(t){ tier=t; continue;} extras.push(token);} else { extras.push(token);} }
      if(extras.length) description=extras.join(',');
    }
    return { name, role, roles, tier, image, description };
  });
}

function refreshBidTeamOptions(){
  const order = (state.teamOrder&&state.teamOrder.length) ? state.teamOrder : (state.teams||[]).map(t=>t.id);
  const sel = document.getElementById('bidTeam'); if(!sel) return;
  sel.innerHTML = order.map(id=> (state.teams||[]).find(t=>t.id===id)).filter(Boolean).map(t=>`<option value="${t.id}">${escapeHtml(t.name)} (잔액 ${t.budgetLeft})</option>`).join('');
}

function currentPlayer(){ return state.queue?.[state.currentIndex] || null; }

function updateUI(){
  const cp=currentPlayer();
  const roleText = cp && (cp.roles&&cp.roles.length? ` (${cp.roles.join('/')})` : (cp.role?` (${cp.role})`:''));
  const curEl = document.getElementById('currentPlayer'); if(curEl) curEl.textContent = cp? `${cp.name}${roleText}` : '모두 완료';
  const rem = document.getElementById('remainingCount'); if(rem) rem.textContent = Math.max(0, (state.queue?.length||0) - state.currentIndex - (cp?1:0));
  const imgWrap = document.getElementById('currentImageWrap'); const img = document.getElementById('currentImage'); const cap = document.getElementById('currentImageCaption');
  if(imgWrap){ if(cp && cp.image){ imgWrap.classList.remove('hidden'); img.src = cp.image; cap.textContent = cp.image||''; } else { imgWrap.classList.add('hidden'); img.src=''; cap.textContent=''; } }
  const quote = document.getElementById('currentQuote'); if(quote) quote.textContent = (cp&&cp.description)?cp.description:'-';
  const tierEl = document.getElementById('currentTier'); if(tierEl) tierEl.textContent = (cp&&cp.tier)?cp.tier:'-';
  const rolesEl = document.getElementById('currentRoles'); if(rolesEl) rolesEl.textContent = (cp&&(cp.roles&&cp.roles.length?cp.roles.join('/'):(cp.role||null))) || '-';
  const highestText = document.getElementById('highestText'); if(highestText){ highestText.textContent = state.highest ? ((state.teams||[]).find(t=>t.id===state.highest.teamId)?.name||'?') + ' - ' + state.highest.amount : '-'; }
  const teamsWrap = document.getElementById('teams'); if(teamsWrap){
    teamsWrap.innerHTML = (state.teams||[]).map(t=>{
      const rosterHtml = (t.roster||[]).map(p=>`
        <div class="player-row" title="${p.description?escapeHtml(p.description):''}">
          <div>${escapeHtml(p.name)}${p.tier?`<span class=\"badge tier-badge\">${escapeHtml(p.tier)}</span>`:''}</div>
          <div class="role">${(p.roles&&p.roles.length?escapeHtml(p.roles.join('/')):(p.role?escapeHtml(p.role):''))}</div>
          <div class="cost">${p.cost}</div>
        </div>
      `).join('') || `<div class="role">아직 없음</div>`;
      return `
        <div class="team-card">
          <div class="team-header">
            <div>
              <div class="team-name">${escapeHtml(t.name)}</div>
              ${t.leader?`<div class=\"role\">팀장: ${escapeHtml(t.leader)}</div>`:''}
            </div>
            <div class="budget">잔액 ${t.budgetLeft}</div>
          </div>
          <div class="roster">${rosterHtml}</div>
        </div>
      `;
    }).join('');
  }
}

// Helpers for parsing
function parseRoles(text){
  if(!text) return [];
  return Array.from(new Set(String(text).split(/[|/]/).map(s=>s&&s.trim()).filter(Boolean)));
}
function looksLikeImage(s){
  if(!s) return false;
  const lower = s.toLowerCase();
  if(lower.startsWith('http://')||lower.startsWith('https://')||lower.startsWith('data:')) return true;
  if(lower.includes('/')||lower.includes('\\')) return true;
  return ['.png','.jpg','.jpeg','.gif','.webp','.svg'].some(ext=>lower.endsWith(ext));
}
function parseTier(s){
  if(!s) return null; const str=String(s).trim(); const lower=str.toLowerCase();
  const base=["challenger","grandmaster","master","diamond","emerald","platinum","gold","silver","bronze","iron"]; for(const b of base){ if(lower.startsWith(b)) return capitalizeWords(str); }
  const map={c:"Challenger",gm:"Grandmaster",m:"Master",d:"Diamond",e:"Emerald",p:"Platinum",g:"Gold",s:"Silver",b:"Bronze",i:"Iron"};
  const m=lower.match(/^\s*([cgmdepsbi])\s*([1-4]|i{1,4}|v?i{0,3})?\s*$/); if(m){ const tier=map[m[1]]; const div=m[2]?normalizeDivision(m[2]):''; return `${tier}${div?" "+div:""}`; }
  const m2=lower.match(/^(diamond|emerald|platinum|gold|silver|bronze|iron)\s*([1-4]|i{1,4}|v?i{0,3})$/); if(m2){ const tier=capitalizeWords(m2[1]); const div=normalizeDivision(m2[2]); return `${tier} ${div}`; }
  return str;
}
function normalizeDivision(s){ const t=String(s).toUpperCase(); if(/^[1-4]$/.test(t)) return [null,'I','II','III','IV'][Number(t)]; if(/^I{1,4}$/.test(t)) return t; if(/^V?I{0,3}$/.test(t)) return t; return t; }
function capitalizeWords(s){ return String(s).replace(/\b[a-z]/g,ch=>ch.toUpperCase()); }
