/* ============================================================
   UI: живая сцена автосервиса.
   Небо с солнцем/луной, здание с боксами, парковка-очередь,
   дорога с анимированными машинами, погода, день/ночь, сезоны.
   ============================================================ */
'use strict';

AST.scene = (() => {
  let el = null;             // #scene
  let refs = {};             // ссылки на слои
  let lastWeather = null;
  let roadCars = {};         // clientId → элемент машины на дороге
  let baysKey = '';          // структурный ключ боксов (перестройка только при изменении)
  let parkKey = '';          // структурный ключ парковки
  let facKey = '';           // ключ мини-построек
  let lastSeason = -1;       // для перерисовки деревьев
  let nextTrafficAt = 0;     // фоновый трафик

  /* ---------- SVG машин ---------- */
  const CLS_SHAPE = {
    eco: 'sedan', mid: 'sedan', biz: 'sedan', prem: 'sedan',
    sport: 'sport', suv: 'suv', pickup: 'pickup', van: 'van',
    ev: 'sedan', rare: 'classic',
  };

  function carSvg(color, cls) {
    const shape = CLS_SHAPE[cls] || 'sedan';
    const dark = shadeColor(color, -25);
    const glass = 'rgba(180,215,240,.85)';
    let body = '';
    if (shape === 'sedan') {
      body = `<path d="M4 22 Q4 15 12 14 L20 13 L27 6 Q28 5 31 5 L48 5 Q51 5 52 7 L57 13 L66 15 Q70 16 70 20 L70 22 Q70 24 67 24 L7 24 Q4 24 4 22 Z" fill="${color}"/>
        <path d="M29 7 L26 13 L37 13 L37 7 Z M40 7 L40 13 L53 13 L49 7 Z" fill="${glass}"/>`;
    } else if (shape === 'sport') {
      body = `<path d="M3 22 Q3 17 10 16 L22 14 L30 9 Q32 8 36 8 L50 8 Q54 8 56 10 L60 14 L68 16 Q71 17 71 20 L71 22 Q71 24 68 24 L6 24 Q3 24 3 22 Z" fill="${color}"/>
        <path d="M32 10 L28 14 L40 14 L40 10 Z M43 10 L43 14 L55 14 L51 10 Z" fill="${glass}"/>`;
    } else if (shape === 'suv') {
      body = `<path d="M4 22 Q4 13 10 12 L18 11 L23 4 Q24 3 27 3 L52 3 Q55 3 56 5 L60 11 L67 12 Q70 13 70 19 L70 22 Q70 24 67 24 L7 24 Q4 24 4 22 Z" fill="${color}"/>
        <path d="M26 5 L23 11 L36 11 L36 5 Z M39 5 L39 11 L54 11 L50 5 Z" fill="${glass}"/>`;
    } else if (shape === 'pickup') {
      body = `<path d="M4 22 Q4 14 9 13 L16 12 L21 5 Q22 4 25 4 L38 4 Q41 4 41 7 L41 12 L66 13 Q70 14 70 19 L70 22 Q70 24 67 24 L7 24 Q4 24 4 22 Z" fill="${color}"/>
        <rect x="42" y="8" width="26" height="5" rx="1.5" fill="${dark}"/>
        <path d="M24 6 L21 12 L38 12 L38 6 Z" fill="${glass}"/>`;
    } else if (shape === 'van') {
      body = `<path d="M4 22 Q4 12 9 10 L14 4 Q15 3 19 3 L60 3 Q66 3 67 8 L69 14 Q70 16 70 20 L70 22 Q70 24 67 24 L7 24 Q4 24 4 22 Z" fill="${color}"/>
        <path d="M18 5 L14 11 L26 11 L26 5 Z M29 5 L29 11 L42 11 L42 5 Z M45 5 L45 11 L58 11 L58 5 Z" fill="${glass}"/>`;
    } else { // classic
      body = `<path d="M4 21 Q4 15 12 14 L22 13 Q24 7 30 6 L45 6 Q51 7 53 13 L64 15 Q70 16 70 20 L70 22 Q70 24 66 24 L8 24 Q4 24 4 21 Z" fill="${color}"/>
        <path d="M31 8 L28 13 L37 13 L37 8 Z M40 8 L40 13 L50 13 L47 8 Z" fill="${glass}"/>
        <circle cx="66" cy="14" r="2.4" fill="#f5e6b0"/>`;
    }
    return `<svg viewBox="0 0 74 30" xmlns="http://www.w3.org/2000/svg">
      ${body}
      <circle cx="19" cy="24" r="5.2" fill="#1d2330"/><circle cx="19" cy="24" r="2.3" fill="#9aa7bd"/>
      <circle cx="55" cy="24" r="5.2" fill="#1d2330"/><circle cx="55" cy="24" r="2.3" fill="#9aa7bd"/>
      <rect x="4" y="18" width="4" height="3" rx="1" fill="#ffd166" opacity=".9"/>
    </svg>`;
  }

  function shadeColor(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const r = AST.u.clamp((n >> 16) + amt, 0, 255);
    const g = AST.u.clamp(((n >> 8) & 0xff) + amt, 0, 255);
    const b = AST.u.clamp((n & 0xff) + amt, 0, 255);
    return `rgb(${r},${g},${b})`;
  }

  function carHtml(client, extraCls = '') {
    const car = AST.data.carById[client.carId];
    return `<div class="car-sprite ${extraCls}" title="${AST.u.esc(car.name)}">${carSvg(client.color, car.cls)}</div>`;
  }

  /* ---------- Монтирование сцены ---------- */
  function mount() {
    el = AST.u.byId('scene');
    if (!el) return;
    el.innerHTML = `
      <div class="scene-sky">
        <div class="scene-city" id="sc-city"></div>
        <div class="scene-sun" id="sc-sun"></div>
        <div id="sc-clouds"></div>
      </div>
      <div class="scene-stars" id="sc-stars"></div>
      <div class="scene-building" id="sc-building">
        <div class="scene-sign" id="sc-sign"></div>
        <div class="fac-row" id="sc-facs"></div>
        <div class="bays-row" id="sc-bays"></div>
      </div>
      <div class="scene-ground">
        <div class="fac-town" id="sc-town"></div>
        <div class="parking-row" id="sc-park"></div>
        <div class="lamp" style="left:16%"></div>
        <div class="lamp" style="left:50%"></div>
        <div class="lamp" style="left:84%"></div>
        <div class="scene-road"><div class="road-mark"></div><div id="sc-road"></div></div>
      </div>
      <div id="sc-trees"></div>
      <div class="scene-night" id="sc-night"></div>
      <div class="weather-layer" id="sc-weather"></div>
      <div class="scene-hint hidden" id="sc-hint"></div>
    `;
    refs = {
      sun: AST.u.byId('sc-sun'), clouds: AST.u.byId('sc-clouds'),
      building: AST.u.byId('sc-building'),
      stars: AST.u.byId('sc-stars'), sign: AST.u.byId('sc-sign'),
      facs: AST.u.byId('sc-facs'), bays: AST.u.byId('sc-bays'),
      park: AST.u.byId('sc-park'), road: AST.u.byId('sc-road'),
      night: AST.u.byId('sc-night'), weather: AST.u.byId('sc-weather'),
      hint: AST.u.byId('sc-hint'),
      city: AST.u.byId('sc-city'), town: AST.u.byId('sc-town'),
      trees: AST.u.byId('sc-trees'),
    };
    // облака и звёзды один раз
    let clouds = '';
    for (let i = 0; i < 3; i++) {
      clouds += `<div class="scene-cloud" style="top:${8 + i * 16}px;width:${AST.u.ri(46, 90)}px;animation-duration:${AST.u.ri(50, 110)}s;animation-delay:-${AST.u.ri(0, 60)}s"></div>`;
    }
    refs.clouds.innerHTML = clouds;
    let stars = '';
    for (let i = 0; i < 26; i++) {
      stars += `<div class="scene-star" style="left:${AST.u.ri(1, 99)}%;top:${AST.u.ri(2, 90)}%;animation-delay:${(Math.random() * 2).toFixed(1)}s"></div>`;
    }
    refs.stars.innerHTML = stars;
    // силуэт города на горизонте
    let city = '';
    for (let i = 0; i < 11; i++) {
      const w = AST.u.ri(28, 64);
      const h = AST.u.ri(18, 78);
      city += `<div class="city-b" style="left:${Math.round(i * 9 + AST.u.rf(-2, 2))}%;width:${w}px;height:${h}px;opacity:${AST.u.rf(0.22, 0.42).toFixed(2)}"></div>`;
    }
    refs.city.innerHTML = city;
    lastWeather = null;
    lastSeason = -1;
    facKey = '';
    roadCars = {};
    baysKey = '';
    parkKey = '';
    update(true);
  }

  const mounted = () => el && document.body.contains(el);

  /* ---------- Обновление (каждый тик UI) ---------- */
  function update(force = false) {
    if (!mounted()) return;
    const S = AST.state;
    const h = S.time.min / 60;

    // вывеска и фасад по статусу компании
    refs.sign.textContent = S.meta.logo + ' ' + S.meta.name;
    const tierCls = 'scene-building tier-' + (S.tier || 0);
    if (refs.building.className !== tierCls) refs.building.className = tierCls;

    // здание сжимается под число боксов и стоит по центру
    // (иначе на широких экранах — пустой ангар во весь экран)
    const sw = el.clientWidth;
    if (sw > 0) {
      const mobile = sw < 700;
      const bayW = mobile ? 118 : 162;                     // бокс + зазор
      const need = S.garage.bays.length * bayW + 66;       // + поля здания
      const bw = Math.round(Math.min(sw * 0.94, Math.max(mobile ? 230 : 320, need)));
      const bl = Math.round((sw - bw) / 2);
      if (refs.building._bw !== bw || refs.building._bl !== bl) {
        refs.building._bw = bw; refs.building._bl = bl;
        refs.building.style.width = bw + 'px';
        refs.building.style.left = bl + 'px';
      }
    }

    // солнце/луна: дуга с 6 до 21
    const dayT = AST.u.clamp((h - 6) / 15, 0, 1);
    const isNight = h < 6 || h >= 21;
    refs.sun.classList.toggle('moon', isNight);
    const t = isNight ? AST.u.clamp(((h < 6 ? h + 24 : h) - 21) / 9, 0, 1) : dayT;
    const x = 6 + t * 84;
    const y = 62 - Math.sin(t * Math.PI) * 52;
    refs.sun.style.left = x + '%';
    refs.sun.style.top = y + '%';

    // ночь
    const nightAmount = (h >= 21 || h < 5) ? 1 : (h < 7 ? (7 - h) / 2 : (h > 19 ? (h - 19) / 2 : 0));
    refs.night.style.opacity = AST.u.clamp(nightAmount, 0, 1) * 0.92;
    refs.stars.classList.toggle('on', nightAmount > 0.5);
    el.classList.toggle('is-night', nightAmount > 0.5);   // фонари включаются

    // деревья по сезону
    if (lastSeason !== S.time.season) {
      lastSeason = S.time.season;
      renderTrees();
    }

    // фоновый трафик: чужие машины проезжают мимо
    const now = performance.now();
    if (now > nextTrafficAt) {
      nextTrafficAt = now + AST.u.ri(5000, 14000) * (nightAmount > 0.5 ? 2.2 : 1);
      spawnBgCar();
    }

    // погода
    if (force || lastWeather !== S.time.weather) {
      lastWeather = S.time.weather;
      renderWeather(S.time.weather);
    }

    renderFacs();
    renderTown();
    renderBays();
    renderPark();
    renderHint();
  }

  /** Деревья по краям: зимой — только ели */
  function renderTrees() {
    const S = AST.state;
    const kinds = S.time.season === 3 ? ['🌲'] : S.time.season === 2 ? ['🌲', '🍂'] : ['🌳', '🌲', '🌳'];
    const spots = [
      { left: '1.5%', size: 26 }, { left: '6%', size: 20 },
      { right: '2%', size: 25 }, { right: '7.5%', size: 19 },
    ];
    refs.trees.innerHTML = spots.map((s, i) => {
      const pos = s.left ? `left:${s.left}` : `right:${s.right}`;
      return `<div class="scene-tree" style="${pos};top:calc(56% - ${s.size - 4}px);font-size:${s.size}px">${kinds[i % kinds.length]}</div>`;
    }).join('');
  }

  /** Фоновая машина проезжает мимо (не клиент) */
  function spawnBgCar() {
    if (!mounted()) return;
    const toRight = AST.u.chance(0.5);
    const fake = {
      carId: AST.u.pick(AST.data.cars).id,
      color: AST.u.pick(AST.data.carColors),
    };
    const div = AST.u.el('div', 'road-car bg-car instant');
    div.innerHTML = carHtml(fake, toRight ? '' : 'flip');
    div.style.left = toRight ? '-14%' : '110%';
    div.style.bottom = toRight ? '4px' : '18px';   // две «полосы» движения
    refs.road.appendChild(div);
    const dur = AST.u.rf(5, 9);
    requestAnimationFrame(() => {
      div.classList.remove('instant');
      div.style.transition = `left ${dur.toFixed(1)}s linear`;
      div.style.left = toRight ? '110%' : '-14%';
    });
    setTimeout(() => div.remove(), dur * 1000 + 400);
  }

  /** Мини-постройки на территории (визуализация зданий) */
  function renderTown() {
    const S = AST.state;
    const built = AST.data.facilities.filter((f) => (S.garage.fac[f.id] || 0) > 0).slice(0, 8);
    const key = built.map((f) => f.id + (S.garage.fac[f.id] || 0)).join(',');
    if (key === facKey) return;
    facKey = key;
    const half = Math.ceil(built.length / 2);
    const side = (list) => list.map((f) => {
      const lvl = S.garage.fac[f.id];
      return `<div class="ft-b" data-fac="${f.id}" title="${AST.u.esc(f.name)} — уровень ${lvl}">
        <div class="ft-roof"></div>
        <div class="ft-body">${f.ico}</div>
        <div class="ft-lv">${'●'.repeat(lvl)}</div>
      </div>`;
    }).join('');
    refs.town.innerHTML = `
      <div class="ft-side">${side(built.slice(0, half))}</div>
      <div class="ft-side">${side(built.slice(half))}</div>`;
  }

  /** Зелёные «+$» над мини-постройкой (пассивный доход сервисов) */
  function serviceCash(facId, amount) {
    if (!mounted() || !refs.town) return;
    const b = refs.town.querySelector(`.ft-b[data-fac="${facId}"]`);
    if (!b || !b.offsetParent) return;   // на мобиле домики скрыты
    const sceneR = el.getBoundingClientRect();
    const r = b.getBoundingClientRect();
    const d = AST.u.el('div', 'scene-cash', '+' + AST.u.fmt(amount));
    d.style.fontSize = '11px';
    d.style.left = (r.left - sceneR.left + r.width / 2 - 14) + 'px';
    d.style.top = (r.top - sceneR.top - 12) + 'px';
    el.appendChild(d);
    setTimeout(() => d.remove(), 1500);
  }

  /** Зелёные «+$» над боксом при оплате */
  function cashAt(bayId, amount) {
    if (!mounted()) return;
    const S = AST.state;
    const i = S.garage.bays.findIndex((b) => b.id === bayId);
    const bayEl = i >= 0 && refs.bays.children[i];
    if (!bayEl) return;
    const sceneR = el.getBoundingClientRect();
    const r = bayEl.getBoundingClientRect();
    const d = AST.u.el('div', 'scene-cash', '+' + AST.u.fmt(amount));
    d.style.left = (r.left - sceneR.left + r.width / 2 - 18) + 'px';
    d.style.top = (r.top - sceneR.top - 4) + 'px';
    el.appendChild(d);
    setTimeout(() => d.remove(), 1500);
  }

  function renderWeather(w) {
    el.classList.remove('w-rain', 'w-snow');
    let html = '';
    if (w === 'rain') {
      el.classList.add('w-rain');
      for (let i = 0; i < 42; i++) {
        html += `<div class="rain-drop" style="left:${AST.u.ri(0, 100)}%;animation-duration:${AST.u.rf(0.5, 0.9).toFixed(2)}s;animation-delay:-${AST.u.rf(0, 1).toFixed(2)}s"></div>`;
      }
    } else if (w === 'snow') {
      el.classList.add('w-snow');
      for (let i = 0; i < 32; i++) {
        const s = AST.u.ri(2, 5);
        html += `<div class="snow-flake" style="left:${AST.u.ri(0, 100)}%;width:${s}px;height:${s}px;animation-duration:${AST.u.rf(3, 7).toFixed(1)}s;animation-delay:-${AST.u.rf(0, 5).toFixed(1)}s"></div>`;
      }
    } else if (w === 'heat') {
      html = '<div class="heat-wave"></div>';
    } else if (w === 'fog') {
      html = '<div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(200,210,225,.28),rgba(200,210,225,.12))"></div>';
    }
    refs.weather.innerHTML = html;
  }

  function renderFacs() {
    const S = AST.state;
    let html = '';
    for (const f of AST.data.facilities) {
      const lvl = S.garage.fac[f.id] || 0;
      if (lvl > 0) html += `<div class="fac-chip" title="${AST.u.esc(f.name)} — уровень ${lvl}">${f.ico}${lvl > 1 ? '·' + lvl : ''}</div>`;
    }
    if (refs.facs.innerHTML !== html) refs.facs.innerHTML = html;
  }

  /** Текст статуса бокса (обновляется без пересборки DOM) */
  function bayStatusText(job) {
    if (!AST.time.isOpen()) return '🌙 продолжим утром';
    if (job.phase === 'diag') return '🔍 диагностика';
    if (job.waiting && job.waiting.courier) return `🛵 деталь в пути (${AST.u.fmtDur(job.waiting.etaMin)})`;
    if (job.waiting) {
      const p = AST.data.partById[job.waiting.pid];
      return `⏳ нет: ${p ? p.name : '?'}`;
    }
    const jf = job.client.faults[job.faultIdx];
    const f = jf && AST.data.faultById[jf.fid];
    return f ? f.name : 'ремонт';
  }

  /* Боксы: DOM пересобирается ТОЛЬКО при смене состава (иначе машинка
     пересоздавалась каждый тик и мерцала из-за анимации появления).
     Прогресс, статус и значки обновляются точечно. */
  function renderBays() {
    const S = AST.state;
    // структурный ключ: что стоит в боксах
    const key = S.garage.bays.map((bay) => {
      const job = S.jobs.find((j) => j.bayId === bay.id);
      const broken = bay.brokenUntil > S.time.abs;
      return [bay.id, bay.tier, broken ? 'br' : '', job ? job.id : '', job ? job.mechId : ''].join(':');
    }).join('|');

    if (key !== baysKey) {
      baysKey = key;
      let html = '';
      S.garage.bays.forEach((bay, i) => {
        const job = S.jobs.find((j) => j.bayId === bay.id);
        const broken = bay.brokenUntil > S.time.abs;
        let inner = `<div class="bay-num">№${i + 1}${bay.tier > 1 ? ' ⚙️' + bay.tier : ''}</div>`;
        if (broken) {
          inner += `<div class="bay-status">СЛОМАН</div><div class="bay-alert">🛠️</div>`;
        } else if (job) {
          const mech = S.staff.find((s) => s.id === job.mechId);
          inner += `
            ${mech ? `<div class="bay-mech">${mech.emoji}</div>` : ''}
            <div class="bay-status ellip" style="padding:0 4px"></div>
            <div class="bay-alert hidden">📦</div>
            <div class="bay-spark hidden" style="left:${20 + (i % 3) * 18}%">✨</div>
            <div class="bay-car">${carHtml(job.client)}</div>
            <div class="bay-progress"><div class="bp-fill"></div></div>`;
        } else {
          inner += `<div class="bay-status" style="top:40%">свободен</div>`;
        }
        html += `<div class="bay ${job ? '' : 'empty'}">${inner}</div>`;
      });
      refs.bays.innerHTML = html;
    }

    // динамика: прогресс, статус, значки — без пересоздания элементов
    S.garage.bays.forEach((bay, i) => {
      const bayEl = refs.bays.children[i];
      if (!bayEl) return;
      const job = S.jobs.find((j) => j.bayId === bay.id);
      if (!job || bay.brokenUntil > S.time.abs) return;
      const st = bayEl.querySelector('.bay-status');
      if (st) {
        const txt = bayStatusText(job);
        if (st.textContent !== txt) st.textContent = txt;
      }
      const fill = bayEl.querySelector('.bp-fill');
      if (fill) fill.style.width = Math.min(100, (job.progress / Math.max(1, job.total)) * 100) + '%';
      const alert = bayEl.querySelector('.bay-alert');
      if (alert) alert.classList.toggle('hidden', !(job.waiting && !job.waiting.courier));
      const spark = bayEl.querySelector('.bay-spark');
      if (spark) spark.classList.toggle('hidden', !(job.phase === 'repair' && !job.waiting && AST.time.isOpen()));
    });
  }

  /* Парковка: та же схема — пересборка только при смене машин в очереди,
     таймеры терпения обновляются текстом. */
  function renderPark() {
    const S = AST.state;
    const cap = Math.min(AST.clients.queueCap(), 8);
    const extra = S.queue.length > 8;
    const key = cap + '|' + S.queue.slice(0, 8).map((c) => c.id).join(',') + '|' + S.queue.length;

    if (key !== parkKey) {
      parkKey = key;
      let html = '';
      for (let i = 0; i < cap; i++) {
        const c = S.queue[i];
        html += c
          ? `<div class="park-slot"><div class="pk-timer"></div>${carHtml(c)}</div>`
          : '<div class="park-slot"></div>';
      }
      if (extra) html += `<div class="park-slot"><div class="pk-timer">+${S.queue.length - 8} в очереди</div></div>`;
      refs.park.innerHTML = html;
    }

    // таймеры терпения
    for (let i = 0; i < cap; i++) {
      const c = S.queue[i];
      const slot = refs.park.children[i];
      if (!c || !slot) continue;
      const t = slot.querySelector('.pk-timer');
      if (!t) continue;
      const left = Math.max(0, c.patience - c.waitedMin);
      const txt = `${c.emoji} ${AST.u.fmtDur(left)}`;
      if (t.textContent !== txt) t.textContent = txt;
      slot.classList.toggle('angry', left < c.patience * 0.25);
    }
  }

  function renderHint() {
    const S = AST.state;
    if (!AST.time.isOpen()) {
      refs.hint.classList.remove('hidden');
      const oh = AST.time.openHours();
      refs.hint.textContent = `🌙 Закрыто. Работаем с ${String(Math.round(oh.start)).padStart(2, '0')}:00 до ${String(Math.round(oh.end)).padStart(2, '0')}:00`;
    } else {
      refs.hint.classList.add('hidden');
    }
  }

  /* ---------- Машины на дороге (анимация приезда/отъезда) ---------- */
  function carArrived(client) {
    if (!mounted()) return;
    const div = AST.u.el('div', 'road-car instant');
    div.innerHTML = carHtml(client);
    div.style.left = '105%';
    refs.road.appendChild(div);
    roadCars[client.id] = div;
    requestAnimationFrame(() => {
      div.classList.remove('instant');
      div.style.left = AST.u.ri(30, 60) + '%';
    });
    // машина «паркуется» — с дороги исчезает
    setTimeout(() => removeRoadCar(client.id), 2600);
  }

  function carToBay() { /* парковка обновится сама через renderPark/renderBays */ }

  function carLeft(client, angry) {
    if (!mounted()) return;
    removeRoadCar(client.id);
    const startLeft = AST.u.ri(35, 60);
    const div = AST.u.el('div', 'road-car instant');
    div.innerHTML = carHtml(client, 'flip');
    div.style.left = startLeft + '%';
    refs.road.appendChild(div);
    // облачка выхлопа позади машины
    for (let i = 0; i < 3; i++) {
      const puff = AST.u.el('div', 'exhaust-puff');
      puff.style.left = `calc(${startLeft}% + ${64 + i * 7}px)`;
      puff.style.bottom = (12 + AST.u.ri(-2, 3)) + 'px';
      puff.style.animationDelay = (i * 0.14) + 's';
      refs.road.appendChild(puff);
      setTimeout(() => puff.remove(), 1600);
    }
    requestAnimationFrame(() => {
      div.classList.remove('instant');
      div.style.left = '-15%';
    });
    AST.audio.play('car_out');
    setTimeout(() => div.remove(), 2600);
  }

  function removeRoadCar(id) {
    if (roadCars[id]) { roadCars[id].remove(); delete roadCars[id]; }
  }

  function bayAlert() { /* мигание уже есть через статус ошибки */ }

  function refresh() { if (mounted()) update(true); }

  return { mount, update, refresh, carArrived, carToBay, carLeft, bayAlert, carSvg, carHtml, cashAt, serviceCash };
})();
