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

const AppState = (() => {
  const DEFAULT_ROSTER_SIZE = 5;
  const state = {
    started: false,
    leaderDetails: {}
  };

  const ensureLeaderDetails = () => {
    if (!state.leaderDetails || typeof state.leaderDetails !== 'object') {
      state.leaderDetails = {};
    }
  };

  const normalizeLeader = (source) => ({
    name: source?.name || '',
    roles: Array.isArray(source?.roles) && source.roles.length
      ? [...source.roles]
      : (source?.role ? [source.role] : []),
    role: source?.role || (Array.isArray(source?.roles) && source.roles.length ? source.roles[0] : null),
    tier: source?.tier || null,
    image: source?.image || null,
    description: source?.description || ''
  });

  const replace = (nextState = {}) => {
    Object.keys(state).forEach((key) => delete state[key]);
    Object.assign(state, nextState);
    ensureLeaderDetails();
  };

  const update = (partial = {}) => {
    Object.assign(state, partial);
    ensureLeaderDetails();
  };

  const hydrateTeamLeaderInfo = () => {
    ensureLeaderDetails();
    if (!Array.isArray(state.teams)) return;

    state.teams.forEach((team) => {
      if (!team) return;
      if (!Array.isArray(team.roster)) {
        team.roster = [];
      }

      const leaderName = team.leader;
      if (!leaderName) return;

      let info = getLeaderInfo(leaderName) || team.leaderInfo || null;
      if (!info) {
        const fromRoster = team.roster.find((player) => player?.name === leaderName);
        if (fromRoster) {
          info = normalizeLeader(fromRoster);
        }
      }

      if (info) {
        setLeaderInfo(leaderName, info);
        team.leaderInfo = info;
      }
    });
  };

  const getLeaderInfo = (leaderName) => {
    ensureLeaderDetails();
    return leaderName ? state.leaderDetails[leaderName] || null : null;
  };

  const setLeaderInfo = (leaderName, info) => {
    if (!leaderName || !info) return;
    ensureLeaderDetails();
    state.leaderDetails[leaderName] = info;
  };

  const getRosterCapacity = () => state.rosterSize || DEFAULT_ROSTER_SIZE;

  const getMemberCount = (team) => {
    if (!team) return 0;
    const rosterList = Array.isArray(team.roster) ? team.roster : [];
    const leaderName = team.leader;
    const leaderAlreadyOnRoster = leaderName && rosterList.some((player) => player?.name === leaderName);
    return rosterList.length + (leaderName && !leaderAlreadyOnRoster ? 1 : 0);
  };

  return {
    get: () => state,
    replace,
    update,
    hydrateTeamLeaderInfo,
    getLeaderInfo,
    setLeaderInfo,
    normalizeLeader,
    getRosterCapacity,
    getMemberCount
  };
})();

const state = AppState.get();
const App = (() => {

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

    // Team introduction elements
    teamIntroduction: document.getElementById('teamIntroduction'),
    leadersGrid: document.getElementById('leadersGrid'),

    // Auction elements
    auction: document.getElementById('auction'),
    auctionComplete: document.getElementById('auctionComplete'),
    teamsLeft: document.getElementById('teamsLeft'),
    teamsRight: document.getElementById('teamsRight'),
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

    buildRoleIconsHtml(roles = [], large = false) {
      const iconClass = large ? 'role-icon-large' : 'role-icon';
      return roles
        .map(role => {
          const imgSrc = CONSTANTS.ROLE_IMG_MAP[role];
          return imgSrc
            ? `<img class="${iconClass}" src="assets/roles/${imgSrc}" alt="${role}" title="${role}"/>`
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

    // 현재 라운드가 끝났는지 확인
    if (!cp && state.currentIndex >= (state.queue?.length || 0)) {
      handleRoundEnd();
      return;
    }

    // 라운드 정보 업데이트
    const roundTextEl = document.getElementById('roundText');
    if (roundTextEl && state.roundNames) {
      roundTextEl.textContent = state.roundNames[state.round] || '본경매';
    }

    // 라운드 설명 업데이트
    const roundDescEl = document.getElementById('roundDescription');
    if (roundDescEl) {
      const descriptions = {
        1: '모든 선수를 경매합니다',
        2: '1라운드 유찰 선수를 재경매합니다',
        3: '2라운드 유찰 선수를 재경매합니다'
      };
      roundDescEl.textContent = descriptions[state.round] || '경매 진행 중';
    }

    if (els.currentPlayer) {
      const currentPlayerNameEl = document.getElementById('currentPlayerNameAndRole');
      if (cp) {
        els.currentPlayer.textContent = cp.name;
        if (currentPlayerNameEl) {
          currentPlayerNameEl.textContent = `${cp.name} ${cp.roles ? `(${cp.roles.join('/')})` : ''}`;
        }
      } else {
        els.currentPlayer.textContent = '모두 완료';
        if (currentPlayerNameEl) {
          currentPlayerNameEl.textContent = '라운드 완료';
        }
      }
    }

    if (els.remainingCount) {
      const remaining = Math.max(0, (state.queue?.length || 0) - (state.currentIndex + (cp ? 1 : 0)));
      els.remainingCount.textContent = remaining;

      // 유찰 정보도 표시
      if (state.roundUnsold && state.roundUnsold.length > 0) {
        els.remainingCount.textContent += ` (유찰: ${state.roundUnsold.length})`;
      }
    }
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
    // 티어 이미지 업데이트
    if (els.currentTier) {
      if (cp && cp.tier) {
        console.log('Setting tier image for:', cp.tier);
        els.currentTier.innerHTML = `<img src="assets/tiers/${cp.tier}.png" alt="${cp.tier}" title="${cp.tier}" class="tier-icon-large" />`;
      } else {
        console.log('No tier data, cp:', cp);
        els.currentTier.textContent = '-';
      }
    }
    if (els.currentRoles) els.currentRoles.innerHTML = cp ? UIManager.buildRoleIconsHtml(cp.roles, true) : '-';
    if (els.highestText) els.highestText.textContent = state.highest ? `${(state.teams.find(t => t.id === state.highest.teamId)?.name || '?')} - ${state.highest.amount}` : '-';
    // 팀들을 좌우로 분할해서 렌더링
    renderTeamsInSideLayout();
    if (els.bidTeam) {
        updateBidTeamDropdown();
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

  // ===== BID TEAM DROPDOWN =====
  function updateBidTeamDropdown() {
    if (!els.bidTeam) return;

    const currentPlayer = state.queue?.[state.currentIndex];
    if (!currentPlayer) {
      els.bidTeam.innerHTML = '<option value="">선수가 없습니다</option>';
      return;
    }

    const rosterCapacity = AppState.getRosterCapacity();

    // 팀 순서 가져오기 (teamOrder 또는 기본 순서)
    const teamOrder = state.teamOrder || state.teams.map(t => t.id);

    // 팀을 순서대로 정렬
    const orderedTeams = teamOrder.map(id => state.teams.find(t => t.id === id)).filter(Boolean);

    // 입찰 가능한 팀 필터링
    const eligibleTeams = orderedTeams.filter(team => {
      // 1. 로스터가 5명 미만인지 확인
      const rosterCount = AppState.getMemberCount(team);
      if (rosterCount >= rosterCapacity) {
        return false;
      }


      // 2. 최소 입찰 금액 이상의 예산이 있는지 확인
      const openingMin = state.openingMin || 5;
      const minNextBid = state.highest ? (state.highest.amount + (state.bidStep || 5)) : openingMin;
      if (team.budgetLeft < minNextBid) {
        return false;
      }

      // 3. 포지션 중복 방지 설정이 켜져있다면 포지션 충돌 확인
      if (state.enforceRoles && AuctionManager._isRoleConflict(currentPlayer, team)) {
        return false;
      }

      return true;
    });

    // 옵션 생성
    if (eligibleTeams.length === 0) {
      els.bidTeam.innerHTML = '<option value="">입찰 가능한 팀이 없습니다</option>';
    } else {
      const options = eligibleTeams.map(team => {
        const rosterCount = AppState.getMemberCount(team);
        const status = `잔액 ${team.budgetLeft.toLocaleString()} (${rosterCount}/${rosterCapacity}명)`;

        return `<option value="${team.id}">${Utils.escapeHtml(team.name)} - ${status}</option>`;
      }).join('');

      els.bidTeam.innerHTML = options;
    }

    // 첫 번째 유효한 팀을 기본 선택으로 설정
    if (eligibleTeams.length > 0) {
      els.bidTeam.value = eligibleTeams[0].id;
    }

    // 입찰 금액 기본값 설정
    updateBidAmount();
  }

  function updateBidAmount() {
    const bidAmountEl = document.getElementById('bidAmount');
    if (!bidAmountEl) return;

    const openingMin = state.openingMin || 5;
    const bidStep = state.bidStep || 5;
    const minNextBid = state.highest ? (state.highest.amount + bidStep) : openingMin;

    bidAmountEl.value = minNextBid;
    bidAmountEl.min = minNextBid;
    bidAmountEl.step = bidStep;
  }

  // ===== TEAM LAYOUT RENDERING =====
  function renderTeamsInSideLayout() {
    if (!els.teamsLeft || !els.teamsRight || !state.teams) return;

    AppState.hydrateTeamLeaderInfo();

    const midpoint = Math.ceil(state.teams.length / 2);
    const leftTeams = state.teams.slice(0, midpoint);
    const rightTeams = state.teams.slice(midpoint);

    els.teamsLeft.innerHTML = leftTeams.map(renderCompactTeamCard).join('');
    els.teamsRight.innerHTML = rightTeams.map(renderCompactTeamCard).join('');
  }

  function renderCompactTeamCard(team) {
    const members = [];
    const rosterCapacity = AppState.getRosterCapacity();
    const rosterList = Array.isArray(team?.roster) ? team.roster : [];
    const leaderName = team?.leader;
    const leaderInfo = leaderName ? AppState.getLeaderInfo(leaderName) || team.leaderInfo || null : null;

    if (leaderName) {
      const info = leaderInfo || AppState.normalizeLeader({
        ...rosterList.find((player) => player?.name === leaderName),
        name: leaderName
      });
      AppState.setLeaderInfo(leaderName, info);
      members.push({
        name: info.name || leaderName,
        cost: '-',
        isLeader: true,
        image: info.image || null,
        description: info.description || '',
        tier: info.tier || null,
        roles: Array.isArray(info.roles) && info.roles.length
          ? info.roles
          : (info.role ? [info.role] : [])
      });
    }

    rosterList.forEach((player) => {
      if (!player) return;
      members.push({
        name: player.name || '-',
        cost: typeof player.cost === 'number' ? player.cost : (player.cost ?? '-'),
        isLeader: false,
        image: player.image || null,
        description: player.description || '',
        tier: player.tier || null,
        roles: Array.isArray(player.roles) && player.roles.length
          ? player.roles
          : (player.role ? [player.role] : [])
      });
    });

    const emptySlots = Math.max(0, rosterCapacity - members.length);

    const membersHtml = members.map((member) => {
      const safeName = Utils.escapeHtml(member.name || '');
      const safeDescription = Utils.escapeHtml(member.description || '');
      const roles = Array.isArray(member.roles) ? member.roles.filter(Boolean) : [];
      const rolesIcons = roles.length ? UIManager.buildRoleIconsHtml(roles, true) : '';
      const rolesLabel = roles.length ? Utils.escapeHtml(roles.join('/')) : '-';
      const rolesMarkup = `<span class=\"member-roles${roles.length ? '' : ' member-roles-empty'}\">${rolesIcons}${roles.length ? `<span class=\"member-roles-label\">${rolesLabel}</span>` : '<span class=\"member-roles-label\">-</span>'}</span>`;
      const tierMarkup = member.tier
        ? `<span class=\"member-tier\">${UIManager.buildTierIconHtml(member.tier)}<span class=\"member-tier-label\">${Utils.escapeHtml(member.tier)}</span></span>`
        : '<span class=\"member-tier member-tier-empty\">-</span>';
      const costDisplay = typeof member.cost === 'number' ? member.cost.toLocaleString() : (member.cost ?? '-');

      return `
      <div class=\"member-item-compact\" title=\"${safeDescription}\">
        ${member.image ? `<img class=\"member-image-compact\" src=\"${member.image}\" alt=\"${safeName}\" />` : '<div class=\"member-image-placeholder\"></div>'}
        <div class=\"member-info\">
          <span class=\"member-name-compact ${member.isLeader ? 'leader-name' : ''}\">${safeName}</span>
          <div class=\"member-meta\">
            ${tierMarkup}
            <span class=\"member-meta-sep\">|</span>
            ${rolesMarkup}
          </div>
        </div>
        <span class=\"member-cost-compact\">${costDisplay}</span>
      </div>
      `;
    }).join('');

    const emptyHtml = Array.from({ length: emptySlots }, () => `
      <div class=\"member-item-compact\">
        <div class=\"member-image-placeholder\"></div>
        <div class=\"member-info\">
          <span class=\"empty-slot-compact\">빈 자리</span>
          <div class=\"member-meta\">
            <span class=\"member-tier member-tier-empty\">-</span>
            <span class=\"member-meta-sep\">|</span>
            <span class=\"member-roles member-roles-empty\"><span class=\"member-roles-label\">-</span></span>
          </div>
        </div>
        <span class=\"empty-cost-compact\">-</span>
      </div>
    `).join('');

    const isHighestBidder = state.highest && state.highest.teamId === team.id;
    const highlightClass = isHighestBidder ? 'highlighted' : '';

    return `
      <div class=\"team-card-compact ${highlightClass}\" data-team-id=\"${team.id}\">
        <div class=\"team-header-compact\">
          <div class=\"team-name-compact\">${Utils.escapeHtml(team.name)}</div>
          <div class=\"budget-compact\">${team.budgetLeft.toLocaleString()}</div>
        </div>
        <div class=\"roster-compact\">
          ${membersHtml}
          ${emptyHtml}
        </div>
      </div>
    `;
  }

  // ===== DATA MANAGEMENT =====
  const DataManager = {
    collectPlayersFromCards() {
      const players = [];
      const leaders = [];
      const leaderDetails = {};

      if (!els.playerCards) return { players, leaders, leaderDetails };

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

        if (isLeader) {
          leaders.push(name);
          leaderDetails[name] = AppState.normalizeLeader({ name, roles, role: roles[0] || null, tier, image, description });
        }
      });

      return { players, leaders, leaderDetails };
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
          const restoredState = JSON.parse(saved);
          AppState.replace(restoredState);
          AppState.hydrateTeamLeaderInfo();
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
      if (!team) {
        alert('유효하지 않은 팀입니다.');
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

    // 현재 라운드의 유찰 선수로 추가
    state.roundUnsold.push(currentPlayer);
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
        state.roundUnsold.pop();
        state.currentIndex = lastAction.index;
        state.highest = lastAction.prevHighest ? { ...lastAction.prevHighest } : null;
        break;
    }

    updateAuctionUI();
    DataManager.saveState();
  };

  // ===== ROUND MANAGEMENT =====
  function handleRoundEnd() {
    console.log(`라운드 ${state.round} 종료, 유찰 선수: ${state.roundUnsold.length}명`);

    if (state.round === 1) {
      // 본경매 종료 -> 유찰라운드 1 시작
      if (state.roundUnsold.length > 0) {
        startUnsoldRound(2);
      } else {
        // 유찰 선수가 없으면 바로 완료
        showAuctionComplete();
      }
    } else if (state.round === 2) {
      // 유찰라운드 1 종료 -> 유찰라운드 2 시작
      if (state.roundUnsold.length > 0) {
        startUnsoldRound(3);
      } else {
        // 유찰 선수가 없으면 완료
        showAuctionComplete();
      }
    } else if (state.round === 3) {
      // 유찰라운드 2 종료 -> 랜덤 배정
      if (state.roundUnsold.length > 0) {
        performRandomAssignment();
      }
      showAuctionComplete();
    }
  }

  function startUnsoldRound(roundNumber) {
    console.log(`유찰라운드 ${roundNumber - 1} 시작, 대상 선수: ${state.roundUnsold.length}명`);

    // 유찰된 선수들로 새 큐 구성
    state.queue = [...state.roundUnsold];
    state.roundUnsold = []; // 새 라운드 시작이므로 초기화
    state.currentIndex = 0;
    state.round = roundNumber;
    state.highest = null;

    // 선수 순서 랜덤화 (선택사항)
    if (state.randomizeOrder) {
      state.queue = Utils.shuffle(state.queue);
    }

    updateAuctionUI();
    DataManager.saveState();

    // 라운드 시작 알림
    alert(`${state.roundNames[state.round]} 시작! 대상 선수: ${state.queue.length}명`);
  }

  function performRandomAssignment() {
    console.log(`랜덤 배정 시작, 대상 선수: ${state.roundUnsold.length}명`);

    if (state.roundUnsold.length === 0) return;

    // 5명 미만인 팀들 찾기
    const incompleteTeams = state.teams.filter(team => (team.roster?.length || 0) < 5);

    if (incompleteTeams.length === 0) {
      // 모든 팀이 5명이면 unsoldCollector에 추가
      state.unsoldCollector.push(...state.roundUnsold);
      state.roundUnsold = [];
      return;
    }

    // 랜덤 배정
    const playersToAssign = [...state.roundUnsold];
    state.roundUnsold = [];

    playersToAssign.forEach(player => {
      const availableTeams = state.teams.filter(team => {
        const currentSize = team.roster?.length || 0;
        if (currentSize >= 5) return false;

        // 포지션 중복 체크 (설정이 켜져있는 경우)
        if (state.enforceRoles) {
          return !AuctionManager._isRoleConflict(player, team);
        }

        return true;
      });

      if (availableTeams.length > 0) {
        // 랜덤하게 팀 선택
        const randomTeam = availableTeams[Math.floor(Math.random() * availableTeams.length)];
        randomTeam.roster.push({ ...player, cost: 0 }); // 랜덤 배정은 비용 0

        console.log(`${player.name} -> ${randomTeam.name} (랜덤 배정)`);
      } else {
        // 배정할 수 있는 팀이 없으면 완전 미판매
        state.unsoldCollector.push(player);
      }
    });

    // 랜덤 배정 완료 알림
    if (playersToAssign.length > 0) {
      alert(`랜덤 배정 완료! ${playersToAssign.length}명의 선수가 배정되었습니다.`);
    }
  }

  function startAuction() {
    // 팀장 소개 페이지로 먼저 이동
    return showTeamIntroduction();
  }

  function startAuctionFromIntro() {
    const teamCount = Math.max(1, Math.ceil(parseInt(els.totalPlayers.value || '20', 10) / 5));
    const gathered = DataManager.collectPlayersFromCards();
    const leaderDetailsMap = gathered.leaderDetails || {};

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

    AppState.replace({
        started: true,
        enforceRoles: document.getElementById('enforceRoles').checked,
        rosterSize: 5,
        randomizeOrder: document.getElementById('randomizeOrder').checked,
        randomizeTeamOrder,
        nominationMode: document.getElementById('nominationMode').checked,
        round: 1, // 1: 본경매, 2: 유찰 라운드 1, 3: 유찰 라운드 2, 4: 종료
        roundNames: ['설정', '본경매', '유찰 라운드 1', '유찰 라운드 2', '종료'],
        reauctionMax: 2,
        teams: teamsData.map((teamData, id) => {
            const leaderName = gathered.leaders[id] || null;
            return {
                id,
                name: teamData.name,
                leader: leaderName,
                leaderInfo: leaderName ? leaderDetailsMap[leaderName] || null : null,
                budgetLeft: teamData.budget,
                roster: []
            };
        }),
        leaderDetails: leaderDetailsMap,
        originalQueue: document.getElementById('randomizeOrder').checked ? Utils.shuffle(filteredPlayers) : filteredPlayers,
        queue: document.getElementById('randomizeOrder').checked ? Utils.shuffle(filteredPlayers) : filteredPlayers,
        leaders: gathered.leaders,
        teamOrder: randomizeTeamOrder ? Utils.shuffle(baseOrder) : baseOrder,
        currentIndex: 0,
        highest: null,
        history: [],
        unsoldCollector: [],
        roundUnsold: [], // 현재 라운드에서 유찰된 선수들
    });

    AppState.hydrateTeamLeaderInfo();

  els.teamIntroduction.classList.add('hidden');
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

    // Auction complete buttons
    const exportFinalCsvBtn = document.getElementById('exportFinalCsvBtn');
    const exportFinalJsonBtn = document.getElementById('exportFinalJsonBtn');
    const startNewAuctionBtn = document.getElementById('startNewAuctionBtn');

    if (exportFinalCsvBtn) exportFinalCsvBtn.addEventListener('click', exportToCSV);
    if (exportFinalJsonBtn) exportFinalJsonBtn.addEventListener('click', exportToJSON);
    if (startNewAuctionBtn) startNewAuctionBtn.addEventListener('click', startNewAuction);

    // Team introduction buttons
    const backToConfigBtn = document.getElementById('backToConfigBtn');
    const startAuctionFromIntroBtn = document.getElementById('startAuctionFromIntroBtn');

    if (backToConfigBtn) backToConfigBtn.addEventListener('click', backToConfig);
    if (startAuctionFromIntroBtn) startAuctionFromIntroBtn.addEventListener('click', startAuctionFromIntro);


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

    // Bid team selection change event
    const bidTeamSelect = document.getElementById('bidTeam');
    if (bidTeamSelect) {
      bidTeamSelect.addEventListener('change', () => {
        updateBidAmount();
      });
    }

    // Timer and Sound controls
    bindTimerEvents();

    // Debug buttons
    bindDebugEvents();

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

  function bindDebugEvents() {
    // Debug panel toggle
    const debugToggle = document.getElementById('debugToggle');
    const debugButtons = document.getElementById('debugButtons');

    if (debugToggle && debugButtons) {
      debugToggle.addEventListener('click', () => {
        debugButtons.classList.toggle('hidden');
      });
    }

    // Debug navigation buttons
    const debugGoToConfigBtn = document.getElementById('debugGoToConfig');
    const debugGoToIntroBtn = document.getElementById('debugGoToIntro');
    const debugGoToAuctionBtn = document.getElementById('debugGoToAuction');
    const debugGoToCompleteBtn = document.getElementById('debugGoToComplete');
    const debugCreateSampleDataBtn = document.getElementById('debugCreateSampleData');

    if (debugGoToConfigBtn) debugGoToConfigBtn.addEventListener('click', debugGoToConfig);
    if (debugGoToIntroBtn) debugGoToIntroBtn.addEventListener('click', debugGoToIntro);
    if (debugGoToAuctionBtn) debugGoToAuctionBtn.addEventListener('click', debugGoToAuction);
    if (debugGoToCompleteBtn) debugGoToCompleteBtn.addEventListener('click', debugGoToComplete);
    if (debugCreateSampleDataBtn) debugCreateSampleDataBtn.addEventListener('click', debugCreateSampleData);
  }

  // ===== AUCTION COMPLETE FUNCTIONS =====
  function showAuctionComplete() {
    els.auction.classList.add('hidden');
    els.auctionComplete.classList.remove('hidden');
    renderAuctionCompleteUI();
  }

  function renderAuctionCompleteUI() {
    console.log('Rendering auction complete UI with state:', state);

    if (!state.teams || state.teams.length === 0) {
      console.warn('No teams data available for auction complete');
      alert('팀 데이터가 없습니다.');
      return;
    }

    // 통계 계산
    const stats = calculateAuctionStats();
    console.log('Calculated stats:', stats);

    // 통계 표시
    document.getElementById('totalPlayersCount').textContent = stats.totalSoldPlayers;
    document.getElementById('averagePrice').textContent = stats.averagePrice.toLocaleString();
    document.getElementById('highestPrice').textContent = stats.highestPrice.toLocaleString();

    // 팀별 최종 구성 표시
    renderFinalTeams();

    // 미판매 선수 표시
    renderUnsoldPlayers();
  }

  function calculateAuctionStats() {
    const allSoldPlayers = [];
    state.teams.forEach(team => {
      if (team.roster) {
        allSoldPlayers.push(...team.roster);
      }
    });

    const totalSoldPlayers = allSoldPlayers.length;
    const totalCost = allSoldPlayers.reduce((sum, player) => sum + (player.cost || 0), 0);
    const averagePrice = totalSoldPlayers > 0 ? Math.round(totalCost / totalSoldPlayers) : 0;
    const highestPrice = allSoldPlayers.reduce((max, player) => Math.max(max, player.cost || 0), 0);

    return { totalSoldPlayers, averagePrice, highestPrice };
  }

  function renderFinalTeams() {
    const finalTeamsEl = document.getElementById('finalTeams');
    if (!finalTeamsEl) {
      console.error('finalTeams element not found');
      alert('finalTeams 엘리먼트를 찾을 수 없습니다.');
      return;
    }

    console.log('Rendering final teams, state.teams:', state.teams);

    const teamsHtml = state.teams.map(team => {
      const rosterHtml = (team.roster || []).map(player => `
        <div class="final-player-row ${player.cost === 0 ? 'random-assigned' : ''}">
          ${player.image ? `<img class="final-player-image" src="${player.image}" alt="${Utils.escapeHtml(player.name)}" />` : '<div class="final-player-image-placeholder"></div>'}
          <span class="final-player-name ${player.name === team.leader ? 'leader-name' : ''}">${Utils.escapeHtml(player.name)}</span>
          ${player.tier ? `<img class="final-player-tier-image" src="assets/tiers/${player.tier}.png" alt="${player.tier}" title="${player.tier}" />` : '<div class="final-player-tier-placeholder"></div>'}
          <div class="final-player-roles">
            ${UIManager.buildRoleIconsHtml(player.roles)}
          </div>
          <div class="final-player-cost">${player.cost === 0 ? '랜덤배정' : (player.cost || 0).toLocaleString()}</div>
          ${player.cost === 0 ? '<span class="random-badge">랜덤</span>' : ''}
        </div>
      `).join('');

      const emptySlots = Math.max(0, 5 - (team.roster?.length || 0));
      const emptyHtml = Array.from({ length: emptySlots }, () => `
        <div class="final-player-row" style="opacity: 0.3;">
          <div class="final-player-name">빈 자리</div>
          <div class="final-player-roles">-</div>
          <div class="final-player-cost">-</div>
        </div>
      `).join('');

      return `
        <div class="final-team-card">
          <div class="final-team-header">
            <div>
              <div class="final-team-name">${Utils.escapeHtml(team.name)}</div>
              ${team.leader ? `<div class="final-team-leader">팀장: ${Utils.escapeHtml(team.leader)}</div>` : ''}
            </div>
            <div class="final-budget">잔액: ${team.budgetLeft.toLocaleString()}</div>
          </div>
          <div class="final-roster">
            ${rosterHtml}
            ${emptyHtml}
          </div>
        </div>
      `;
    }).join('');

    finalTeamsEl.innerHTML = teamsHtml;
  }

  function renderUnsoldPlayers() {
    const unsoldSection = document.getElementById('unsoldPlayersSection');
    const unsoldList = document.getElementById('unsoldPlayersList');

    if (!unsoldSection || !unsoldList) return;

    if (state.unsoldCollector && state.unsoldCollector.length > 0) {
      unsoldSection.classList.remove('hidden');

      const unsoldHtml = state.unsoldCollector.map(player => `
        <div class="unsold-player">
          <div class="unsold-player-name">${Utils.escapeHtml(player.name)}</div>
          <div class="unsold-player-info">
            ${player.tier ? `${player.tier} • ` : ''}
            ${player.roles ? player.roles.join('/') : '-'}
          </div>
        </div>
      `).join('');

      unsoldList.innerHTML = unsoldHtml;
    } else {
      unsoldSection.classList.add('hidden');
    }
  }

  function startNewAuction() {
    if (confirm('새 경매를 시작하시겠습니까? 현재 데이터가 모두 삭제됩니다.')) {
      localStorage.removeItem(CONSTANTS.LS_KEY);
      window.location.reload();
    }
  }

  // ===== TEAM INTRODUCTION FUNCTIONS =====
  function showTeamIntroduction() {
    const teamCount = Math.max(1, Math.ceil(parseInt(els.totalPlayers.value || '20', 10) / 5));
    const gathered = DataManager.collectPlayersFromCards();

    if (!gathered.players.length) {
      alert('선수 카드를 입력해주세요.');
      return false;
    }

    if (gathered.leaders.length !== teamCount) {
      alert(`팀장 수가 맞지 않습니다. (필요: ${teamCount}명, 선택됨: ${gathered.leaders.length}명)`);
      return false;
    }

    // 설정에서 팀 데이터 수집
    const teamsData = [];
    const useLeadersAsTeamNames = document.getElementById('useLeadersAsTeamNames').checked;

    for (let i = 0; i < teamCount; i++) {
      const name = useLeadersAsTeamNames
        ? gathered.leaders[i]
        : document.getElementById(`team_name_${i}`)?.value || `팀 ${i + 1}`;
      const budget = Math.max(1, Number(document.getElementById(`team_budget_${i}`)?.value || 1000));
      teamsData.push({ name, budget, leader: gathered.leaders[i] });
    }

    // 페이지 전환
    els.config.classList.add('hidden');
    els.playersSection.classList.add('hidden');
    els.teamIntroduction.classList.remove('hidden');

    // 팀장 정보 렌더링
    renderTeamIntroduction(gathered, teamsData);

    return true;
  }

  function renderTeamIntroduction(gathered, teamsData) {
    // 팀장 카드들 렌더링
    renderLeaderCards(gathered, teamsData);

    // 경매 규칙 업데이트
    updateAuctionRules();
  }

  function renderLeaderCards(gathered, teamsData) {
    if (!els.leadersGrid) return;

    const leaderCards = teamsData.map((team, index) => {
      const leaderName = team.leader;
      const leaderData = gathered.players.find(p => p.name === leaderName) || {};

      const imageHtml = leaderData.image
        ? `<img src="${Utils.escapeHtml(leaderData.image)}" alt="${Utils.escapeHtml(leaderName)}" />`
        : `<div class="no-image">이미지 없음</div>`;

      const tierHtml = leaderData.tier
        ? `<div class="leader-tier">${UIManager.buildTierIconHtml(leaderData.tier)} ${leaderData.tier}</div>`
        : '<div class="leader-tier">티어 미설정</div>';

      const rolesHtml = leaderData.roles && leaderData.roles.length > 0
        ? `<div class="leader-roles">${UIManager.buildRoleIconsHtml(leaderData.roles)} ${leaderData.roles.join('/')}</div>`
        : '<div class="leader-roles">포지션 미설정</div>';

      return `
        <div class="leader-card">
          <div class="leader-image-frame ${leaderData.image ? '' : 'no-image'}">
            ${imageHtml}
          </div>

          <div class="leader-name">${Utils.escapeHtml(team.name)}</div>
          <div class="leader-subtitle">팀장: ${Utils.escapeHtml(leaderName)}</div>

          <div class="leader-info">
            ${tierHtml}
            ${rolesHtml}
          </div>

          <div class="leader-budget">
            <div class="budget-label">팀 예산</div>
            <div class="budget-amount">${team.budget.toLocaleString()}포인트</div>
          </div>

          <div class="leader-quote">
            ${leaderData.description ? `"${Utils.escapeHtml(leaderData.description)}"` : '각오 한마디를 남겨보세요!'}
          </div>
        </div>
      `;
    }).join('');

    els.leadersGrid.innerHTML = leaderCards;
  }

  function updateAuctionRules() {
    // 경매 순서 규칙
    const randomizeOrder = document.getElementById('randomizeOrder').checked;
    const auctionOrderRuleEl = document.getElementById('auctionOrderRule');
    if (auctionOrderRuleEl) {
      auctionOrderRuleEl.textContent = randomizeOrder ? '선수 순서를 무작위로 섞습니다' : '선수 순서는 카드 순서대로 진행됩니다';
    }

    // 포지션 제한 규칙
    const enforceRoles = document.getElementById('enforceRoles').checked;
    const roleEnforcementTextEl = document.getElementById('roleEnforcementText');
    if (roleEnforcementTextEl) {
      roleEnforcementTextEl.textContent = enforceRoles ? '같은 포지션 중복 불가' : '포지션 중복 제한 없음';
    }
  }

  function backToConfig() {
    els.teamIntroduction.classList.add('hidden');
    els.config.classList.remove('hidden');
    els.playersSection.classList.remove('hidden');
  }

  // ===== DEBUG FUNCTIONS =====
  function debugGoToConfig() {
    createAndApplySampleData();
    hideAllSections();
    els.config.classList.remove('hidden');
    els.playersSection.classList.remove('hidden');
  }

  function debugGoToIntro() {
    createAndApplySampleData();
    // 팀장 소개 페이지로 이동
    showTeamIntroduction();
  }

  function debugGoToAuction() {
    try {
      createAndApplySampleData();
      // 경매 시작 시뮬레이션
      startAuctionFromIntro();
    } catch (error) {
      console.error('Debug auction error:', error);
      alert('본경매 페이지 로드 중 오류가 발생했습니다.');
    }
  }

  function debugGoToComplete() {
    try {
      // 샘플 데이터 생성
      createAndApplySampleData();

      // 경매 상태 직접 설정
      state.started = true;
      state.teams = [
        {
          id: 0,
          name: 'Gen.G',
          leader: 'Chovy',
          budgetLeft: 0,
          roster: [
            { name: 'Chovy', roles: ['Mid'], tier: 'Challenger', description: 'Gen.G 미드라이너', cost: 35 },
            { name: 'Kiin', roles: ['Top'], tier: 'Challenger', description: 'Gen.G 탑라이너', cost: 30 },
            { name: 'Canyon', roles: ['Jungle'], tier: 'Challenger', description: 'Gen.G 정글러', cost: 25 },
            { name: 'Peyz', roles: ['ADC'], tier: 'Master', description: 'Gen.G 원딜', cost: 20 },
            { name: 'Lehends', roles: ['Support'], tier: 'Master', description: 'Gen.G 서포터', cost: 15 }
          ]
        },
        {
          id: 1,
          name: '한화생명',
          leader: 'Zeka',
          budgetLeft: 0,
          roster: [
            { name: 'Zeka', roles: ['Mid'], tier: 'Grandmaster', description: '한화생명 미드라이너', cost: 30 },
            { name: 'Zeus', roles: ['Top'], tier: 'Challenger', description: '한화생명 탑라이너', cost: 30 },
            { name: 'Peanut', roles: ['Jungle'], tier: 'Grandmaster', description: '한화생명 정글러', cost: 25 },
            { name: 'Viper', roles: ['ADC'], tier: 'Challenger', description: '한화생명 원딜', cost: 35 },
            { name: 'Delight', roles: ['Support'], tier: 'Master', description: '한화생명 서포터', cost: 15 }
          ]
        },
        {
          id: 2,
          name: 'T1',
          leader: 'Faker',
          budgetLeft: 0,
          roster: [
            { name: 'Faker', roles: ['Mid'], tier: 'Challenger', description: '전설의 미드라이너', cost: 40 },
            { name: 'Doran', roles: ['Top'], tier: 'Grandmaster', description: 'T1 탑라이너', cost: 25 },
            { name: 'Oner', roles: ['Jungle'], tier: 'Grandmaster', description: 'T1 정글러', cost: 25 },
            { name: 'Gumayusi', roles: ['ADC'], tier: 'Master', description: 'T1 원딜', cost: 20 },
            { name: 'Keria', roles: ['Support'], tier: 'Master', description: 'T1 서포터', cost: 15 }
          ]
        },
        {
          id: 3,
          name: 'KT',
          leader: 'Bdd',
          budgetLeft: 30,
          roster: [
            { name: 'Bdd', roles: ['Mid'], tier: 'Master', description: 'KT 미드라이너', cost: 25 },
            { name: 'Sword', roles: ['Top'], tier: 'Master', description: 'KT 탑라이너', cost: 15 },
            { name: 'Cuzz', roles: ['Jungle'], tier: 'Master', description: 'KT 정글러', cost: 20 },
            { name: 'Smash', roles: ['ADC'], tier: 'Master', description: 'KT 원딜', cost: 15 },
            { name: 'Beryl', roles: ['Support'], tier: 'Master', description: 'KT 서포터', cost: 20 }
          ]
        }
      ];

      AppState.update({ leaderDetails: {} });
      AppState.hydrateTeamLeaderInfo();

      // 경매 완료 상태 설정
      state.round = 4;
      state.currentIndex = -1;
      state.queue = [];

      // 화면 전환 (직접 처리)
      els.config.classList.add('hidden');
      els.playersSection.classList.add('hidden');
      els.teamIntroduction.classList.add('hidden');
      els.auction.classList.add('hidden');
      els.auctionComplete.classList.remove('hidden');
      showAuctionComplete();

    } catch (error) {
      console.error('Debug complete error:', error);
      alert('경매 결과 페이지 로드 중 오류가 발생했습니다: ' + error.message);
    }
  }

  function createMockAuctionResults() {
    // 먼저 경매를 시작하여 기본 상태 설정
    startAuctionFromIntro();

    // 각 팀에 직접 선수 배정 (간단한 방식)
    const teamRosters = [
      // Gen.G 팀 (팀장: Chovy)
      [
        { name: 'Chovy', roles: ['Mid'], tier: 'Challenger', description: 'Gen.G 미드라이너', cost: 35 },
        { name: 'Kiin', roles: ['Top'], tier: 'Challenger', description: 'Gen.G 탑라이너', cost: 30 },
        { name: 'Canyon', roles: ['Jungle'], tier: 'Challenger', description: 'Gen.G 정글러', cost: 25 },
        { name: 'Peyz', roles: ['ADC'], tier: 'Master', description: 'Gen.G 원딜', cost: 20 },
        { name: 'Lehends', roles: ['Support'], tier: 'Master', description: 'Gen.G 서포터', cost: 15 }
      ],
      // 한화생명 팀 (팀장: Zeka)
      [
        { name: 'Zeka', roles: ['Mid'], tier: 'Grandmaster', description: '한화생명 미드라이너', cost: 30 },
        { name: 'Zeus', roles: ['Top'], tier: 'Challenger', description: '한화생명 탑라이너', cost: 30 },
        { name: 'Peanut', roles: ['Jungle'], tier: 'Grandmaster', description: '한화생명 정글러', cost: 25 },
        { name: 'Viper', roles: ['ADC'], tier: 'Challenger', description: '한화생명 원딜', cost: 35 },
        { name: 'Delight', roles: ['Support'], tier: 'Master', description: '한화생명 서포터', cost: 15 }
      ],
      // T1 팀 (팀장: Faker)
      [
        { name: 'Faker', roles: ['Mid'], tier: 'Challenger', description: '전설의 미드라이너', cost: 40 },
        { name: 'Doran', roles: ['Top'], tier: 'Grandmaster', description: 'T1 탑라이너', cost: 25 },
        { name: 'Oner', roles: ['Jungle'], tier: 'Grandmaster', description: 'T1 정글러', cost: 25 },
        { name: 'Gumayusi', roles: ['ADC'], tier: 'Master', description: 'T1 원딜', cost: 20 },
        { name: 'Keria', roles: ['Support'], tier: 'Master', description: 'T1 서포터', cost: 15 }
      ],
      // KT 팀 (팀장: Bdd)
      [
        { name: 'Bdd', roles: ['Mid'], tier: 'Master', description: 'KT 미드라이너', cost: 25 },
        { name: 'Sword', roles: ['Top'], tier: 'Master', description: 'KT 탑라이너', cost: 15 },
        { name: 'Cuzz', roles: ['Jungle'], tier: 'Master', description: 'KT 정글러', cost: 20 },
        { name: 'Smash', roles: ['ADC'], tier: 'Master', description: 'KT 원딜', cost: 15 },
        { name: 'Beryl', roles: ['Support'], tier: 'Master', description: 'KT 서포터', cost: 20 }
      ]
    ];

    // 각 팀에 로스터 직접 할당
    state.teams.forEach((team, teamIndex) => {
      team.roster = teamRosters[teamIndex] || [];

      // 예산 계산 (총 125포인트에서 사용한 만큼 차감)
      const totalCost = team.roster.reduce((sum, player) => sum + player.cost, 0);
      team.budgetLeft = 125 - totalCost;
    });
    AppState.hydrateTeamLeaderInfo();

    // 경매 완료 상태로 설정
    state.round = 4; // 경매 완료
    state.currentIndex = -1;
    state.queue = []; // 모든 선수가 배정되었으므로 큐 비우기
  }

  function createAndApplySampleData() {
    // 2025시즌 프로팀 4팀 데이터
    const sampleTeamNames = ['Gen.G', '한화생명', 'T1', 'KT'];
    const samplePlayers = [
      // Gen.G 선수들
      { name: 'Kiin', roles: ['Top'], tier: 'Challenger', description: 'Gen.G 탑라이너' },
      { name: 'Canyon', roles: ['Jungle'], tier: 'Challenger', description: 'Gen.G 정글러' },
      { name: 'Chovy', roles: ['Mid'], tier: 'Challenger', description: 'Gen.G 미드라이너', isLeader: true },
      { name: 'Ruler', roles: ['ADC'], tier: 'Master', description: 'Gen.G 원딜' },
      { name: 'Duro', roles: ['Support'], tier: 'Master', description: 'Gen.G 서포터' },

      // 한화생명 선수들
      { name: 'Zeus', roles: ['Top'], tier: 'Challenger', description: '한화생명 탑라이너' },
      { name: 'Peanut', roles: ['Jungle'], tier: 'Grandmaster', description: '한화생명 정글러' },
      { name: 'Zeka', roles: ['Mid'], tier: 'Grandmaster', description: '한화생명 미드라이너', isLeader: true },
      { name: 'Viper', roles: ['ADC'], tier: 'Challenger', description: '한화생명 원딜' },
      { name: 'Delight', roles: ['Support'], tier: 'Master', description: '한화생명 서포터' },

      // T1 선수들
      { name: 'Doran', roles: ['Top'], tier: 'Grandmaster', description: 'T1 탑라이너' },
      { name: 'Oner', roles: ['Jungle'], tier: 'Grandmaster', description: 'T1 정글러' },
      { name: 'Faker', roles: ['Mid'], tier: 'Challenger', description: '전설의 미드라이너', isLeader: true },
      { name: 'Gumayusi', roles: ['ADC'], tier: 'Master', description: 'T1 원딜' },
      { name: 'Keria', roles: ['Support'], tier: 'Master', description: 'T1 서포터' },

      // KT 선수들
      { name: 'Perfect', roles: ['Top'], tier: 'Master', description: 'KT 탑라이너' },
      { name: 'Cuzz', roles: ['Jungle'], tier: 'Master', description: 'KT 정글러' },
      { name: 'Bdd', roles: ['Mid'], tier: 'Master', description: 'KT 미드라이너', isLeader: true },
      { name: 'Duckdam', roles: ['ADC'], tier: 'Master', description: 'KT 원딜' },
      { name: 'Peter', roles: ['Support'], tier: 'Master', description: 'KT 서포터' }
    ];

    // 전체 인원 설정 (20명)
    document.getElementById('totalPlayers').value = 20;
    buildPlayerCardsUI();

    // 팀명 설정
    els.teamNames.innerHTML = '';
    sampleTeamNames.forEach((name, i) => {
      const div = document.createElement('div');
      div.className = 'team-input';
      div.innerHTML = `<input type="text" placeholder="팀 ${i + 1}" value="${name}" />`;
      els.teamNames.appendChild(div);
    });

    // 선수 카드 설정
    const playerCardElements = document.querySelectorAll('.player-card');
    samplePlayers.forEach((player, i) => {
      if (playerCardElements[i]) {
        const card = playerCardElements[i];
        const nameInput = card.querySelector('.pc-input-name');
        const tierSelect = card.querySelector('.tier-select');
        const descInput = card.querySelector('.pc-desc');
        const leaderCheckbox = card.querySelector('.pc-input-leader');

        if (nameInput) nameInput.value = player.name;
        if (tierSelect) tierSelect.value = player.tier;
        if (descInput) descInput.value = player.description;
        if (leaderCheckbox) leaderCheckbox.checked = player.isLeader || false;

        // 기존 역할 체크박스 초기화
        card.querySelectorAll('.role-chip').forEach(chip => chip.classList.remove('active'));
        // 기존 티어 체크박스 초기화
        card.querySelectorAll('.tier-chip').forEach(chip => chip.classList.remove('active'));

        // 역할 체크박스 설정
        player.roles.forEach(role => {
          const roleChip = card.querySelector(`[data-role="${role}"]`);
          if (roleChip) roleChip.classList.add('active');
        });

        // 티어 체크박스 설정
        if (player.tier) {
          const tierChip = card.querySelector(`[data-tier="${player.tier}"]`);
          if (tierChip) tierChip.classList.add('active');
        }
      }
    });
  }

  function debugCreateSampleData() {
    createAndApplySampleData();
    alert('샘플 데이터가 생성되었습니다!');
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
