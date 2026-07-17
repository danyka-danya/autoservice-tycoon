/* ============================================================
   ИГРА: время — сутки, сезоны, погода, инфляция.
   1 секунда реального времени = 1 игровая минута (×скорость).
   Ночью, когда сервис пуст, время летит в 20 раз быстрее.
   ============================================================ */
'use strict';

AST.time = (() => {
  const SEASONS = [
    { id: 0, name: 'Весна', ico: '🌱' },
    { id: 1, name: 'Лето',  ico: '☀️' },
    { id: 2, name: 'Осень', ico: '🍂' },
    { id: 3, name: 'Зима',  ico: '❄️' },
  ];

  const WEATHER = {
    sun:  { name: 'Ясно',   ico: '☀️', clientMult: 1.0 },
    rain: { name: 'Дождь',  ico: '🌧️', clientMult: 0.85 },
    snow: { name: 'Снег',   ico: '🌨️', clientMult: 0.75 },
    heat: { name: 'Жара',   ico: '🥵', clientMult: 1.1 },
    fog:  { name: 'Туман',  ico: '🌫️', clientMult: 0.9 },
  };

  /* Вероятности погоды по сезонам */
  const WEATHER_BY_SEASON = [
    [['sun', 55], ['rain', 30], ['fog', 15]],               // весна
    [['sun', 55], ['heat', 25], ['rain', 20]],              // лето
    [['sun', 35], ['rain', 40], ['fog', 25]],               // осень
    [['sun', 35], ['snow', 50], ['fog', 15]],               // зима
  ];

  function pickWeather(season) {
    return AST.u.pickW(WEATHER_BY_SEASON[season], (w) => w[1])[0];
  }

  function seasonOfDay(day) {
    return Math.floor(((day - 1) % AST.BAL.YEAR_DAYS) / AST.BAL.SEASON_DAYS);
  }

  /** Часы работы с учётом улучшений «ранние/вечерние часы» */
  function openHours() {
    const m = AST.mods();
    return {
      start: AST.BAL.OPEN_H - (m.hoursEarly || 0),
      end: AST.BAL.CLOSE_H + (m.hoursLate || 0),
    };
  }

  function isOpen() {
    const S = AST.state;
    const h = S.time.min / 60;
    const oh = openHours();
    return h >= oh.start && h < oh.end;
  }

  function isNight() {
    const h = AST.state.time.min / 60;
    return h < 6 || h >= 22;
  }

  function weatherMult() {
    return (WEATHER[AST.state.time.weather] || WEATHER.sun).clientMult;
  }

  /* Сезонный спрос: зима и межсезонье кормят шиномонтаж, лето — кондиционеры */
  function seasonClientMult() {
    return [1.05, 1.0, 1.05, 0.9][AST.state.time.season];
  }

  /** Главный тик времени. Возвращает счётчики пересечённых часов/дней. */
  function tick(dtMin) {
    const S = AST.state;
    const prevHour = Math.floor(S.time.min / 60);
    S.time.min += dtMin;
    S.time.abs += dtMin;

    let hoursCrossed = Math.floor(S.time.min / 60) - prevHour;
    let newDayHappened = false;

    if (S.time.min >= 1440) {
      S.time.min -= 1440;
      newDay();
      newDayHappened = true;
    }
    return { hoursCrossed: Math.max(0, hoursCrossed), newDayHappened };
  }

  function newDay() {
    const S = AST.state;
    AST.econ.dayClose();                    // финансовое закрытие прошедшего дня
    S.time.day++;
    AST.addC('days');
    S.time.season = seasonOfDay(S.time.day);
    const newYear = Math.floor((S.time.day - 1) / AST.BAL.YEAR_DAYS) + 1;
    if (newYear !== S.time.year) {
      S.time.year = newYear;
      S.inflation = +Math.pow(1 + AST.BAL.INFLATION_YEAR, newYear - 1).toFixed(3);
      AST.ui && AST.ui.toast('📈', `Год ${newYear}`, `Инфляция: цены выросли на ${Math.round((S.inflation - 1) * 100)}% от стартовых`, 'warn');
    }
    S.time.weather = pickWeather(S.time.season);
    AST.staffM.newDay();
    AST.missions.newDay();
    AST.garage.newDay();
    AST.contracts.newDay();
    AST._modsDirty = true;
    AST.save.save(false);
    AST.ui && AST.ui.dirtyAll();
    // утренняя сводка прошедшего дня
    if (S.settings.daySummary !== false && S.lastSummary) {
      AST.ui && AST.ui.showDaySummary(S.lastSummary);
    }
  }

  return { SEASONS, WEATHER, tick, openHours, isOpen, isNight, weatherMult, seasonClientMult, seasonOfDay };
})();
