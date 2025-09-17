// ===== CONSTANTS =====
const CONSTANTS = {
  LS_KEY: "lol_auction_state_v1",
  LS_UI: "lol_auction_ui_scale_v1",
  LS_SOUND: 'lol_auction_sound_enabled',
  LS_VOL: 'lol_auction_sound_volume',
  LS_TIMER: 'lol_auction_timer_enabled',
  ROLES: ["Top", "Jungle", "Mid", "ADC", "Support"],
  TIERS: ['Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Emerald', 'Diamond', 'Master', 'Grandmaster', 'Challenger'],
  ROLE_IMG_MAP: { Top: 'top.png', Jungle: 'jungler.png', Mid: 'mid.png', ADC: 'adc.png', Support: 'supporter.png' },
  get TIER_IMG_MAP() {
    return this.TIERS.reduce((acc, tier) => ({ ...acc, [tier]: `${tier}.png` }), {});
  }
};

const App = (() => {
  let state = { started: false };

  // ===== DOM ELEMENTS =====
  const els = {
    // Config elements
    config: document.getElementById('config'),
    playersSection: document.getElementById('playersSection'),
    playerCards: document.getElementById('playerCards'),
    teamNames: document.getElementById('teamNames'),
    startBtn: document.getElementById('startBtn'),
    uiScale: document.getElementById('uiScale'),
    totalPlayers: document.getElementById('totalPlayers'),

    // Auction elements
    auction: document.getElementById('auction'),
    currentPlayer: document.getElementById('currentPlayer'),
    remainingCount: document.getElementById('remainingCount'),
    currentImageWrap: document.getElementById('currentImageWrap'),
    currentImage: document.getElementById('currentImage'),
    currentImageCaption: document.getElementById('currentImageCaption'),
    currentQuote: document.getElementById('currentQuote'),
    currentTier: document.getElementById('currentTier'),
    currentRoles: document.getElementById('currentRoles'),
    highestText: document.getElementById('highestText'),
    teams: document.getElementById('teams'),
    bidTeam: document.getElementById('bidTeam'),
  };

  // ===== UTILITY FUNCTIONS =====
  const Utils = {
    escapeHtml: (str = '') => {
      return String(str)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
    },

    shuffle: (arr) => {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },

    debounce: (func, wait) => {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    }
  };

  // ===== SOUND SYSTEM =====
  const SoundManager = {
    _audioCtx: null,

    getAudioContext() {
      if (!this._audioCtx) {
        this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      return this._audioCtx;
    },

    getVolume() {
      const v = parseInt(localStorage.getItem(CONSTANTS.LS_VOL) ?? '70', 10);
      if (Number.isNaN(v)) return 0.7;
      return Math.max(0, Math.min(100, v)) / 100;
    },

    playBeep(ms = 180, freq = 880) {
      try {
        const ctx = this.getAudioContext();
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.value = freq;
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        const now = ctx.currentTime;
        const target = Math.max(0.0001, this.getVolume() * 0.6);

        gainNode.gain.setValueAtTime(0.0001, now);
        gainNode.gain.exponentialRampToValueAtTime(target, now + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + ms / 1000);

        oscillator.start(now);
        oscillator.stop(now + ms / 1000 + 0.02);
      } catch (e) {
        console.warn('Audio playback failed:', e);
      }
    },

    playBeepPattern() {
      const enabled = (localStorage.getItem(CONSTANTS.LS_SOUND) ?? '1') === '1';
      if (!enabled) return;

      this.playBeep(160, 880);
      setTimeout(() => this.playBeep(160, 880), 300);
      setTimeout(() => this.playBeep(160, 660), 600);
    }
  };

  // ===== TIMER SYSTEM =====
  const TimerManager = {
    _timer: null,
    _remainingTime: 0,

    render() {
      const el = document.getElementById('timerDisplay');
      if (!el) return;

      const minutes = String(Math.floor(this._remainingTime / 60)).padStart(2, '0');
      const seconds = String(this._remainingTime % 60).padStart(2, '0');
      el.textContent = `${minutes}:${seconds}`;
    },

    start() {
      const secEl = document.getElementById('timerSeconds');
      const seconds = Math.max(1, Number(secEl?.value || 30));

      this._remainingTime = seconds;
      this.render();

      this.stop(); // Clear any existing timer

      this._timer = setInterval(() => {
        this._remainingTime -= 1;

        if (this._remainingTime <= 0) {
          this.stop();
          this.render();
          SoundManager.playBeepPattern();
          return;
        }

        this.render();
      }, 1000);
    },

    stop() {
      if (this._timer) {
        clearInterval(this._timer);
        this._timer = null;
      }
    }
  };


  // ===== UI MANAGEMENT =====
  const UIManager = {
    applyScale(scale) {
      const scaleClasses = ["size-small", "size-normal", "size-large"];
      document.body.classList.remove(...scaleClasses);

      if (scale) {
        document.body.classList.add(`size-${scale}`);
      }

      try {
        localStorage.setItem(CONSTANTS.LS_UI, scale);
      } catch (e) {
        console.warn('Failed to save UI scale preference:', e);
      }

      // Sync footer UI scale select
      const uiScaleFooter = document.getElementById('uiScaleFooter');
      if (uiScaleFooter && uiScaleFooter.value !== scale) {
        uiScaleFooter.value = scale;
      }
    },

    buildRoleIconsHtml(roles = []) {
      return roles
        .map(role => {
          const imgSrc = CONSTANTS.ROLE_IMG_MAP[role];
          return imgSrc
            ? `<img class="role-icon" src="assets/roles/${imgSrc}" alt="${role}" title="${role}"/>`
            : '';
        })
        .join('');
    },

    buildTierIconHtml(tier) {
      const imgSrc = CONSTANTS.TIER_IMG_MAP[tier];
      return imgSrc
        ? `<img class="role-icon" src="assets/tiers/${imgSrc}" alt="${tier}" title="${tier}"/>`
        : '-';
    }
  };


  function renderTeamNames() {
    if (!els.teamNames) return;
    const teamCount = Math.max(1, Math.ceil(parseInt(els.totalPlayers.value || '20', 10) / 5));
    
    const prevNames = {};
    const prevBudgets = {};
    els.teamNames.querySelectorAll('input[id^="team_name_"]').forEach(i => {
        const id = i.id.split('_').pop();
        prevNames[id] = i.value;
    });
    els.teamNames.querySelectorAll('input[id^="team_budget_"]').forEach(i => {
        const id = i.id.split('_').pop();
        prevBudgets[id] = i.value;
    });

    const parts = [];
    for (let i = 0; i < teamCount; i++) {
        const nameId = `team_name_${i}`;
        const budgetId = `team_budget_${i}`;
        const nameVal = prevNames[i] || `팀 ${i + 1}`;
        const budgetVal = prevBudgets[i] || '1000';
        parts.push(`
            <div class="team-input-row">
                <input type="text" id="${nameId}" value="${Utils.escapeHtml(nameVal)}" placeholder="팀 이름"/>
                <input type="number" id="${budgetId}" value="${budgetVal}" placeholder="예산" min="1" />
            </div>
        `);
    }
    els.teamNames.innerHTML = parts.join('');
  }

  function buildPlayerCardsUI() {
    if (!els.playerCards) return;
    const prev = DataManager.collectPlayersFromCards();
    const count = Math.max(1, parseInt(els.totalPlayers?.value || '20', 10));
    
    const cards = Array.from({ length: count }, (_, i) => {
      const p = prev.players[i] || { name: `Player${String(i + 1).padStart(2, '0')}` };
      const playerRoles = p.roles || (p.role ? [p.role] : []);

      const roleChips = CONSTANTS.ROLES.map(r => `
        <button type="button" class="role-chip icon ${playerRoles.includes(r) ? 'active' : ''}" data-role="${r}" title="${r}">
          <img src="assets/roles/${CONSTANTS.ROLE_IMG_MAP[r]}" alt="${r}"/>
        </button>`).join('');

      const tierChips = CONSTANTS.TIERS.map(k => `
        <button type="button" class="tier-chip ${p.tier === k ? 'active' : ''}" data-tier="${k}" title="${k}">
          <img src="assets/tiers/${CONSTANTS.TIER_IMG_MAP[k]}" alt="${k}"/>
        </button>`).join('');

      return `
        <div class="player-card" data-index="${i}">
          <div class="pc-head">
            <div class="pc-name"><input type="text" class="pc-input-name" value="${Utils.escapeHtml(p.name)}" placeholder="이름"/></div>
            <label class="pc-leader"><input type="checkbox" class="pc-input-leader" ${prev.leaders.includes(p.name) ? 'checked' : ''}/> 팀장</label>
          </div>
          <div class="frame" data-data-url="${p.image ? Utils.escapeHtml(p.image) : ''}">${p.image ? `<img src="${Utils.escapeHtml(p.image)}"/>` : '<div class="upload-hint">이미지 드롭/클릭<br><small>권장: 4:3 비율</small></div>'}</div>
          <div class="pc-row">
            <div class="pc-full">
              <div class="ctrl-title">라인</div>
              <div class="role-chips">${roleChips}</div>
            </div>
            <div class="pc-full">
              <div class="ctrl-title">티어</div>
              <div class="tier-chips">${tierChips}</div>
            </div>
          </div>
          <div class="pc-full">
            <div class="ctrl-title">각오</div>
            <textarea class="pc-desc" placeholder="">${Utils.escapeHtml(p.description || '')}</textarea>
          </div>
        </div>
      `;
    }).join('');
    els.playerCards.innerHTML = cards;
  }

  function updateAuctionUI() {
    const cp = state.queue?.[state.currentIndex] || null;
    if (els.currentPlayer) els.currentPlayer.textContent = cp ? cp.name : '모두 완료';
    if (els.remainingCount) els.remainingCount.textContent = Math.max(0, (state.queue?.length || 0) - (state.currentIndex + (cp ? 1 : 0)));
    if (els.currentImageWrap) {
        if (cp && cp.image) {
            els.currentImageWrap.classList.remove('hidden');
            els.currentImage.src = cp.image;
            els.currentImageCaption.textContent = cp.name;
        } else {
            els.currentImageWrap.classList.add('hidden');
            els.currentImage.src = '';
            els.currentImageCaption.textContent = cp ? `${cp.name} - 이미지 없음` : '';
        }
    }
    if (els.currentQuote) els.currentQuote.textContent = cp?.description || '-';
    if (els.currentTier) els.currentTier.innerHTML = cp ? UIManager.buildTierIconHtml(cp.tier) : '-';
    if (els.currentRoles) els.currentRoles.innerHTML = cp ? UIManager.buildRoleIconsHtml(cp.roles) : '-';
    if (els.highestText) els.highestText.textContent = state.highest ? `${(state.teams.find(t => t.id === state.highest.teamId)?.name || '?')} - ${state.highest.amount}` : '-';
    if (els.teams) {
        els.teams.innerHTML = state.teams.map(t => {
            const rosterHtml = (t.roster || []).map(p => `
                <div class="player-row" title="${Utils.escapeHtml(p.description)}">
                    <div>${Utils.escapeHtml(p.name)}${p.tier ? `<span class="badge tier-badge">${Utils.escapeHtml(p.tier)}</span>` : ''}</div>
                    <div class="role role-icons">${UIManager.buildRoleIconsHtml(p.roles)}</div>
                    <div class="cost">${p.cost}</div>
                </div>`).join('') || `<div class="role">아직 없음</div>`;
            return `
                <div class="team-card">
                    <div class="team-header">
                        <div>
                            <div class="team-name">${Utils.escapeHtml(t.name)}</div>
                            ${t.leader ? `<div class="role">팀장: ${Utils.escapeHtml(t.leader)}</div>` : ''}
                        </div>
                        <div class="budget">잔액 ${t.budgetLeft}</div>
                    </div>
                    <div class="roster">${rosterHtml}</div>
                </div>`;
        }).join('');
    }
    if (els.bidTeam) {
        const order = state.teamOrder || state.teams.map(t => t.id);
        els.bidTeam.innerHTML = order.map(id => state.teams.find(t => t.id === id)).filter(Boolean).map(t => `<option value="${t.id}">${Utils.escapeHtml(t.name)} (잔액 ${t.budgetLeft})</option>`).join('');
    }

    // 지명 버튼과 관련 요소들을 지명 모드 설정에 따라 표시/숨김
    const nominateBtn = document.getElementById('nominateBtn');
    const nominatorBar = document.getElementById('nominatorBar');
    const nominateBox = document.getElementById('nominateBox');

    if (nominateBtn) {
      nominateBtn.style.display = state.nominationMode ? 'inline-block' : 'none';
    }
    if (nominatorBar) {
      nominatorBar.style.display = state.nominationMode ? 'block' : 'none';
    }
    if (nominateBox) {
      nominateBox.style.display = state.nominationMode ? 'block' : 'none';
    }
  }

  // ===== DATA MANAGEMENT =====
  const DataManager = {
    collectPlayersFromCards() {
      const players = [];
      const leaders = [];

      if (!els.playerCards) return { players, leaders };

      els.playerCards.querySelectorAll('.player-card').forEach((card) => {
        const name = card.querySelector('.pc-input-name')?.value?.trim() || '';
        if (!name) return;

        const roles = Array.from(card.querySelectorAll('.role-chip.active'))
          .map(button => button.dataset.role);
        const tier = card.querySelector('.tier-chip.active')?.dataset.tier || null;
        const description = card.querySelector('.pc-desc')?.value || '';
        const frame = card.querySelector('.frame');

        let image = frame?.dataset?.dataUrl || null;
        if (!image) {
          const img = frame?.querySelector('img');
          if (img) image = img.src;
        }

        const isLeader = card.querySelector('.pc-input-leader')?.checked || false;

        players.push({
          name,
          roles,
          role: roles[0] || null,
          tier,
          image,
          description
        });

        if (isLeader) leaders.push(name);
      });

      return { players, leaders };
    },

    saveState() {
      try {
        localStorage.setItem(CONSTANTS.LS_KEY, JSON.stringify(state));
      } catch (e) {
        console.warn('Failed to save state:', e);
      }
    },

    loadState() {
      try {
        const saved = localStorage.getItem(CONSTANTS.LS_KEY);
        if (saved) {
          state = JSON.parse(saved);
          els.config.classList.add('hidden');
          els.playersSection.classList.add('hidden');
          els.auction.classList.remove('hidden');
          updateAuctionUI();
        }
      } catch (e) {
        console.warn('Failed to load state:', e);
      }
    }
  };

  // ===== AUCTION LOGIC =====
  const AuctionManager = {
    placeBid() {
      const currentPlayer = state.queue?.[state.currentIndex];
      if (!currentPlayer) return;

      const teamSelect = document.getElementById('bidTeam');
      const amountInput = document.getElementById('bidAmount');
      const teamId = Number(teamSelect?.value);
      const openingMin = state.openingMin || 5;
      const amount = Math.max(openingMin, Number(amountInput?.value || openingMin));

      const team = state.teams?.find(t => t.id === teamId);
      if (!team) return;

      // Validation checks
      if (team.roster.length >= (state.rosterSize || 5)) {
        alert('해당 팀은 더 이상 선수를 가질 수 없습니다.');
        return;
      }

      if (amount > team.budgetLeft) {
        alert('예산 초과입니다.');
        return;
      }

      // Role enforcement check
      if (this._isRoleConflict(currentPlayer, team)) {
        alert('해당 선수의 가능한 포지션이 모두 중복입니다.');
        return;
      }

      // Bid amount validation
      const bidStep = state.bidStep || 5;
      const minNextBid = state.highest ? (state.highest.amount + bidStep) : openingMin;

      if (amount < minNextBid) {
        alert(`최소 입찰 금액은 ${minNextBid} 입니다.`);
        return;
      }

      const baseAmount = state.highest?.amount || 0;
      if ((amount - baseAmount) % bidStep !== 0 && state.highest) {
        alert(`입찰은 ${bidStep}포인트 단위로만 가능합니다.`);
        return;
      }

      // Place the bid
      state.history.push({
        type: 'bid',
        prevHighest: state.highest ? { ...state.highest } : null
      });
      state.highest = { teamId, amount };
      updateAuctionUI();
      DataManager.saveState();
    },

    _isRoleConflict(player, team) {
      if (!state.enforceRoles) return false;

      const playerRoles = player.roles?.length
        ? player.roles
        : (player.role && CONSTANTS.ROLES.includes(player.role) ? [player.role] : []);

      if (!playerRoles.length) return false;

      const usedRoles = new Set();
      team.roster?.forEach(p => {
        if (p.role) usedRoles.add(p.role);
        if (Array.isArray(p.roles)) {
          p.roles.forEach(r => usedRoles.add(r));
        }
      });

      return !playerRoles.some(role => !usedRoles.has(role));
    }
  };

  AuctionManager.assignPlayer = function() {
    const currentPlayer = state.queue?.[state.currentIndex];
    if (!currentPlayer) return;

    if (!state.highest) {
      alert('입찰이 없습니다.');
      return;
    }

    const { teamId, amount } = state.highest;
    const team = state.teams?.find(t => t.id === teamId);
    if (!team) return;

    team.budgetLeft -= amount;
    team.roster.push({ ...currentPlayer, cost: amount });

    state.history.push({
      type: 'assign',
      teamId,
      amount,
      player: currentPlayer,
      index: state.currentIndex
    });

    state.currentIndex = (state.currentIndex || 0) + 1;
    state.highest = null;
    updateAuctionUI();
    DataManager.saveState();
  };

  AuctionManager.nextPlayer = function() {
    const currentPlayer = state.queue?.[state.currentIndex];
    if (!currentPlayer) return;

    state.history.push({
      type: 'skip',
      index: state.currentIndex,
      player: currentPlayer,
      prevHighest: state.highest ? { ...state.highest } : null
    });

    state.unsoldCollector.push(currentPlayer);
    state.currentIndex = (state.currentIndex || 0) + 1;
    state.highest = null;
    updateAuctionUI();
    DataManager.saveState();
  };

  AuctionManager.undo = function() {
    if (!state.history?.length) return;

    const lastAction = state.history.pop();

    switch (lastAction.type) {
      case 'bid':
        state.highest = lastAction.prevHighest ? { ...lastAction.prevHighest } : null;
        break;

      case 'assign':
        const team = state.teams?.find(t => t.id === lastAction.teamId);
        if (team) {
          team.budgetLeft += lastAction.amount;
          team.roster.pop();
        }
        state.currentIndex = lastAction.index;
        state.highest = null;
        break;

      case 'skip':
        state.unsoldCollector.pop();
        state.currentIndex = lastAction.index;
        state.highest = lastAction.prevHighest ? { ...lastAction.prevHighest } : null;
        break;
    }

    updateAuctionUI();
    DataManager.saveState();
  };

  function startAuction() {
    const teamCount = Math.max(1, Math.ceil(parseInt(els.totalPlayers.value || '20', 10) / 5));
    const gathered = DataManager.collectPlayersFromCards();
    if (!gathered.players.length) return alert('선수 카드를 입력해주세요.');
    if (gathered.leaders.length !== teamCount) return alert(`팀장 수가 맞지 않습니다. (필요: ${teamCount}명, 선택됨: ${gathered.leaders.length}명)`);

    const useLeadersAsTeamNames = document.getElementById('useLeadersAsTeamNames').checked;
    
    const teamsData = [];
    for (let i = 0; i < teamCount; i++) {
        const name = useLeadersAsTeamNames 
            ? gathered.leaders[i] 
            : document.getElementById(`team_name_${i}`)?.value || `팀 ${i + 1}`;
        const budget = Math.max(1, Number(document.getElementById(`team_budget_${i}`)?.value || 1000));
        teamsData.push({ name, budget });
    }

    const leaderSet = new Set(gathered.leaders);
    const filteredPlayers = gathered.players.filter(p => !leaderSet.has(p.name));
    const baseOrder = Array.from({ length: teamCount }, (_, i) => i);
    const randomizeTeamOrder = document.getElementById('randomizeOrder').checked;

    state = {
        started: true,
        enforceRoles: document.getElementById('enforceRoles').checked,
        rosterSize: 5,
        randomizeOrder: document.getElementById('randomizeOrder').checked,
        randomizeTeamOrder,
        nominationMode: document.getElementById('nominationMode').checked,
        round: 0,
        reauctionMax: 2,
        teams: teamsData.map((teamData, id) => ({ 
            id, 
            name: teamData.name, 
            leader: gathered.leaders[id] || null, 
            budgetLeft: teamData.budget, 
            roster: [] 
        })),
        queue: document.getElementById('randomizeOrder').checked ? Utils.shuffle(filteredPlayers) : filteredPlayers,
        leaders: gathered.leaders,
        teamOrder: randomizeTeamOrder ? Utils.shuffle(baseOrder) : baseOrder,
        currentIndex: 0,
        highest: null,
        history: [],
        unsoldCollector: [],
    };

    els.config.classList.add('hidden');
    els.playersSection.classList.add('hidden');
    els.auction.classList.remove('hidden');
    updateAuctionUI();
    DataManager.saveState();
  }

  // --- Image Handling ---
  function handleImageFile(file, frame) {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      frame.innerHTML = `<img src="${reader.result}"/>`;
      frame.dataset.dataUrl = reader.result;
    };
    reader.readAsDataURL(file);
  }

  // ===== TIMER SETTINGS MANAGEMENT =====
  const TimerSettings = {
    isEnabled() {
      return (localStorage.getItem(CONSTANTS.LS_TIMER) ?? '1') === '1';
    },

    setEnabled(enabled) {
      localStorage.setItem(CONSTANTS.LS_TIMER, enabled ? '1' : '0');
      this.updateTimerUI();
    },

    updateTimerUI() {
      const isEnabled = this.isEnabled();
      const timerDisplaySection = document.querySelector('.timer-display-section');
      const timerSetting = document.querySelector('.timer-setting');
      const soundGroup = document.querySelectorAll('.setting-group')[1]; // Second setting group contains sound settings

      // Show/hide timer display section
      if (timerDisplaySection) {
        timerDisplaySection.style.display = isEnabled ? 'flex' : 'none';
      }

      // Enable/disable timer seconds input
      if (timerSetting) {
        const timerSecondsInput = timerSetting.querySelector('input[type="number"]');
        if (timerSecondsInput) {
          timerSecondsInput.disabled = !isEnabled;
          timerSecondsInput.style.opacity = isEnabled ? '1' : '0.5';
        }
      }

      // Show/hide sound settings group
      if (soundGroup) {
        soundGroup.style.display = isEnabled ? 'flex' : 'none';
      }

      // Stop timer if disabled
      if (!isEnabled) {
        TimerManager.stop();
      }
    },

    init() {
      const timerEnabledCheckbox = document.getElementById('timerEnabled');
      if (timerEnabledCheckbox) {
        timerEnabledCheckbox.checked = this.isEnabled();
        timerEnabledCheckbox.addEventListener('change', () => {
          this.setEnabled(timerEnabledCheckbox.checked);
        });
      }
      this.updateTimerUI();
    }
  };

  // --- Event Handlers & Binders ---
  function bindEvents() {
    // Config screen
    els.uiScale?.addEventListener('change', e => UIManager.applyScale(e.target.value));


    // Footer UI scale sync
    const uiScaleFooter = document.getElementById('uiScaleFooter');
    if (uiScaleFooter) {
      uiScaleFooter.addEventListener('change', e => UIManager.applyScale(e.target.value));
    }

    // Settings dropdown toggle
    const settingsToggle = document.getElementById('settingsToggle');
    const settingsPanel = document.getElementById('settingsPanel');
    if (settingsToggle && settingsPanel) {
      settingsToggle.addEventListener('click', () => {
        settingsPanel.classList.toggle('hidden');
      });

      // Close dropdown when clicking outside
      document.addEventListener('click', (e) => {
        if (!settingsToggle.contains(e.target) && !settingsPanel.contains(e.target)) {
          settingsPanel.classList.add('hidden');
        }
      });
    }
    document.getElementById('rebuildCardsBtn').addEventListener('click', () => { buildPlayerCardsUI(); renderTeamNames(); });
    els.totalPlayers.addEventListener('change', () => { buildPlayerCardsUI(); renderTeamNames(); });
    els.startBtn.addEventListener('click', startAuction);
    document.getElementById('loadStateBtn').addEventListener('click', DataManager.loadState);
    document.getElementById('resetBtn').addEventListener('click', () => { localStorage.removeItem(CONSTANTS.LS_KEY); window.location.reload(); });

    // Export buttons
    const saveBtn = document.getElementById('saveBtn');
    const exportCsvBtn = document.getElementById('exportCsvBtn');
    const exportJsonBtn = document.getElementById('exportJsonBtn');

    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        DataManager.saveState();
        alert('현재 상태가 저장되었습니다.');
      });
    }
    if (exportCsvBtn) exportCsvBtn.addEventListener('click', exportToCSV);
    if (exportJsonBtn) exportJsonBtn.addEventListener('click', exportToJSON);


    // Player cards
    els.playerCards.addEventListener('click', (e) => {
        const roleChip = e.target.closest('.role-chip');
        if (roleChip) return roleChip.classList.toggle('active');

        const tierChip = e.target.closest('.tier-chip');
        if (tierChip) {
            const parent = tierChip.parentElement;
            parent.querySelectorAll('.tier-chip').forEach(el => el.classList.remove('active'));
            tierChip.classList.add('active');
            return;
        }

        const frame = e.target.closest('.frame');
        if (frame) {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = () => {
                const f = input.files && input.files[0];
                if (!f) return;
                handleImageFile(f, frame);
            };
            input.click();
        }
    });

    // Drag and drop functionality
    els.playerCards.addEventListener('dragover', (e) => {
        e.preventDefault();
        const frame = e.target.closest('.frame');
        if (frame) {
            frame.classList.add('drag-over');
        }
    });

    els.playerCards.addEventListener('dragleave', (e) => {
        const frame = e.target.closest('.frame');
        if (frame && !frame.contains(e.relatedTarget)) {
            frame.classList.remove('drag-over');
        }
    });

    els.playerCards.addEventListener('drop', (e) => {
        e.preventDefault();
        const frame = e.target.closest('.frame');
        if (frame) {
            frame.classList.remove('drag-over');
            const files = e.dataTransfer.files;
            if (files && files[0] && files[0].type.startsWith('image/')) {
                handleImageFile(files[0], frame);
            }
        }
    });

    // Collapsible player section
    const toggleBtn = document.getElementById('togglePlayersSection');
    toggleBtn.addEventListener('click', () => {
        els.playersSection.classList.toggle('collapsed');
        toggleBtn.textContent = els.playersSection.classList.contains('collapsed') ? '펼치기' : '접기';
    });

    // Sub-option visibility
    const nominationModeCheckbox = document.getElementById('nominationMode');
    const randomizeTeamOrderContainer = document.getElementById('randomizeTeamOrderContainer');
    if (nominationModeCheckbox && randomizeTeamOrderContainer) {
        const syncVisibility = () => { randomizeTeamOrderContainer.classList.toggle('hidden', !nominationModeCheckbox.checked); };
        syncVisibility();
        nominationModeCheckbox.addEventListener('change', syncVisibility);
    }

    // Auction controls
    document.getElementById('placeBidBtn').addEventListener('click', (e) => { e.preventDefault(); AuctionManager.placeBid(); });
    document.getElementById('assignBtn').addEventListener('click', (e) => { e.preventDefault(); AuctionManager.assignPlayer(); });
    document.getElementById('skipBtn').addEventListener('click', (e) => { e.preventDefault(); AuctionManager.nextPlayer(); });
    document.getElementById('undoBtn').addEventListener('click', (e) => { e.preventDefault(); AuctionManager.undo(); });

    // Timer and Sound controls
    bindTimerEvents();

    // Sidebar Toggle
    const sidebarToggle = document.getElementById('sidebarToggle');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            els.auction.classList.toggle('sidebar-collapsed');
        });
    }
  }
  
  function bindTimerEvents() {
    document.getElementById('timerStart').addEventListener('click', (e) => { e.preventDefault(); TimerManager.start(); });
    document.getElementById('timerStop').addEventListener('click', (e) => { e.preventDefault(); TimerManager.stop(); });

    const soundEnabled = document.getElementById('soundEnabled');
    const soundTestBtn = document.getElementById('soundTestBtn');
    const soundVolume = document.getElementById('soundVolume');
    const soundVolumeLabel = document.getElementById('soundVolumeLabel');

    if (soundEnabled) {
        soundEnabled.checked = (localStorage.getItem(CONSTANTS.LS_SOUND) ?? '1') === '1';
        soundEnabled.addEventListener('change', () => {
            localStorage.setItem(CONSTANTS.LS_SOUND, soundEnabled.checked ? '1' : '0');
        });
    }
    if (soundTestBtn) {
        soundTestBtn.addEventListener('click', (e) => { e.preventDefault(); SoundManager.playBeepPattern(); });
    }
    if (soundVolume && soundVolumeLabel) {
        const initVol = Math.round(SoundManager.getVolume() * 100);
        soundVolume.value = String(initVol);
        soundVolumeLabel.textContent = initVol + '%';
        soundVolume.addEventListener('input', () => {
            localStorage.setItem(CONSTANTS.LS_VOL, String(soundVolume.value));
            soundVolumeLabel.textContent = `${soundVolume.value}%`;
        });
    }

    // Timer controls
    const timerStart = document.getElementById('timerStart');
    const timerStop = document.getElementById('timerStop');
    const timerSecondsInput = document.getElementById('timerSeconds');

    if (timerStart) {
      timerStart.addEventListener('click', () => {
        const seconds = parseInt(timerSecondsInput?.value || '30', 10);
        TimerManager.start(seconds);
      });
    }

    if (timerStop) {
      timerStop.addEventListener('click', () => {
        TimerManager.stop();
      });
    }
  }

  // ===== EXPORT FUNCTIONS =====
  function exportToCSV() {
    if (!state.started || !state.teams) {
      alert('경매가 진행되지 않았습니다.');
      return;
    }

    const headers = ['Team', 'Leader', 'Player', 'Roles', 'Tier', 'ImageURL', 'Description', 'Cost', 'BudgetLeftAfter'];
    const rows = [headers.join(',')];

    state.teams.forEach(team => {
      const budgetLeftAfter = team.budgetLeft;
      if (team.roster && team.roster.length > 0) {
        team.roster.forEach(player => {
          const row = [
            `"${team.name}"`,
            `"${team.leader || ''}"`,
            `"${player.name || ''}"`,
            `"${(player.roles || []).join('/')}"`,
            `"${player.tier || ''}"`,
            `"${player.image || ''}"`,
            `"${player.description || ''}"`,
            player.cost || 0,
            budgetLeftAfter
          ];
          rows.push(row.join(','));
        });
      } else {
        // 선수가 없는 팀도 표시
        const row = [
          `"${team.name}"`,
          `"${team.leader || ''}"`,
          '""', '""', '""', '""', '""', 0, budgetLeftAfter
        ];
        rows.push(row.join(','));
      }
    });

    const csvContent = rows.join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `auction_results_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  }

  function exportToJSON() {
    if (!state.started) {
      alert('경매가 진행되지 않았습니다.');
      return;
    }

    const exportData = {
      timestamp: new Date().toISOString(),
      teams: state.teams,
      settings: {
        enforceRoles: state.enforceRoles,
        rosterSize: state.rosterSize,
        randomizeOrder: state.randomizeOrder,
        nominationMode: state.nominationMode
      },
      queue: state.queue,
      currentIndex: state.currentIndex,
      history: state.history
    };

    const jsonContent = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `auction_data_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
  }

  // ===== INITIALIZATION =====
  function init() {
    UIManager.applyScale(localStorage.getItem(CONSTANTS.LS_UI) || 'normal');
    renderTeamNames();
    buildPlayerCardsUI();
    bindEvents();
    TimerSettings.init();
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', App.init);