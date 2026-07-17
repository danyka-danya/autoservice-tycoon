/* ============================================================
   ИГРА: B2B-контракты.
   Заказчик предлагает пакет: N машин за D дней, оплата оптом
   (аванс 30% сразу, остаток по завершении), штраф за срыв.
   Контрактные машины приезжают сами и не платят по счёту —
   деньги идут пакетом.
   ============================================================ */
'use strict';

AST.contracts = (() => {
  let spawnAccumMin = 0;

  const active = () => AST.state.contract;

  /** Сколько платят за одну контрактную машину (оптовая цена) */
  function perCarPay(cls) {
    const S = AST.state;
    const mult = AST.data.carClasses[cls].mult;
    return Math.round(130 * mult * S.inflation * (1 + AST.mods().income) * 0.9);
  }

  /** Сгенерировать предложение (вызывается в новый день) */
  function maybeOffer() {
    const S = AST.state;
    if (S.contract || S.contractOffer) return;
    if (S.time.day < 5 || S.rep < 15) return;
    if (!AST.u.chance(0.35)) return;

    const contractor = AST.u.pick(AST.data.contractors);
    // класс машин заказчика должен быть доступен по репутации
    const cls = S.rep >= AST.data.carClasses[contractor.cls].rep ? contractor.cls : 'eco';
    const scale = AST.u.clamp(Math.floor(S.garage.bays.length * 1.5), 3, 12);
    const cars = AST.u.ri(Math.max(3, scale - 2), scale + 2);
    const days = AST.u.ri(2, 4);
    const pay = perCarPay(cls) * cars;

    S.contractOffer = {
      id: AST.u.uid(),
      contractor: contractor.id,
      cls, cars, days,
      pay,
      advance: Math.round(pay * 0.3),
      penalty: Math.round(pay * 0.4),
      expiresDay: S.time.day + 1,
    };
    AST.audio.play('notify');
    AST.ui.toast(contractor.ico, 'Деловое предложение!', `${contractor.name}: ${cars} машин за ${days} ${AST.u.plural(days, 'день', 'дня', 'дней')} — ${AST.u.fmt(pay)}. Смотрите вкладку «Гараж»`, 'gold');
    AST.ui.dirty('garage');
  }

  function accept() {
    const S = AST.state;
    const o = S.contractOffer;
    if (!o) return false;
    S.contract = {
      ...o,
      done: 0,
      deadlineDay: S.time.day + o.days,
    };
    S.contractOffer = null;
    AST.econ.earn(o.advance, 'repair', 'Аванс по контракту');
    AST.audio.play('cash');
    const c = AST.data.contractors.find((x) => x.id === o.contractor);
    AST.ui.toast(c.ico, 'Контракт подписан!', `Аванс ${AST.u.fmt(o.advance)} получен. Машины начнут приезжать`, 'ok');
    AST.ui.dirty('garage');
    return true;
  }

  function decline() {
    AST.state.contractOffer = null;
    AST.ui.dirty('garage');
  }

  /** Тик: контрактные машины приезжают сами (вне обычного потока) */
  function tick(dtMin) {
    const S = AST.state;
    const c = S.contract;
    if (!c || !AST.time.isOpen()) return;
    // сколько ещё надо привезти
    const inWork = S.queue.filter((x) => x.contract).length +
                   S.jobs.filter((j) => j.client.contract).length;
    if (c.done + inWork >= c.cars) return;
    if (S.queue.length >= AST.clients.queueCap()) return;
    // примерно раз в 1.5–2.5 часа
    spawnAccumMin += dtMin;
    if (spawnAccumMin < AST.u.ri(90, 150)) return;
    spawnAccumMin = 0;
    const client = AST.clients.spawn(c.cls);
    if (client) {
      client.contract = true;
      client.patience *= 2;      // корпоративные машины никуда не спешат
      client.vip = false;
    }
  }

  /** Контрактная машина готова (зовётся из repair.finish) */
  function carDone() {
    const S = AST.state;
    const c = S.contract;
    if (!c) return;
    c.done++;
    AST.rep(0.4);
    if (c.done >= c.cars) {
      const rest = c.pay - c.advance;
      AST.econ.earn(rest, 'repair', 'Расчёт по контракту');
      AST.addC('contracts');
      AST.rep(3);
      const ctr = AST.data.contractors.find((x) => x.id === c.contractor);
      AST.audio.play('achievement');
      AST.fx && AST.fx.confetti();
      AST.ui.toast(ctr.ico, 'Контракт выполнен! 🎉', `${ctr.name} доволен: расчёт ${AST.u.fmt(rest)}, репутация +3`, 'gold');
      S.contract = null;
    }
    AST.ui.dirty('garage');
  }

  /** Новый день: дедлайны и новые предложения */
  function newDay() {
    const S = AST.state;
    // просрочка контракта
    if (S.contract && S.time.day > S.contract.deadlineDay) {
      const c = S.contract;
      const ctr = AST.data.contractors.find((x) => x.id === c.contractor);
      AST.econ.pay(c.penalty, 'fine', 'Штраф за срыв контракта');
      AST.rep(-4);
      AST.ui.toast(ctr.ico, 'Контракт сорван!', `Успели ${c.done} из ${c.cars}. Штраф ${AST.u.fmt(c.penalty)}, репутация −4`, 'err');
      S.contract = null;
      // недоделанные контрактные машины уезжают
      S.queue = S.queue.filter((x) => !x.contract);
    }
    // протухшее предложение
    if (S.contractOffer && S.time.day > S.contractOffer.expiresDay) {
      S.contractOffer = null;
    }
    maybeOffer();
  }

  return { active, tick, newDay, accept, decline, carDone, perCarPay };
})();
