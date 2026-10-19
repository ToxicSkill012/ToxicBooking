// ╔══════════════════════════════════════════════════════════════╗
// ║     TOXICSKILL — Google Apps Script Backend v7               ║
// ║                                                              ║
// ║  ЧТО НОВОГО В v7:                                            ║
// ║  • Цена считается на сервере по тарифу (TARIFF ниже):        ║
// ║    пакеты + «своё время» (за каждые начатые 30 минут)        ║
// ║  • Строгая проверка брони: ПК из зоны, окна пакетов, прошлое,║
// ║    лимиты, нельзя занять два ПК на одно время в обход        ║
// ║  • Бронь для команды: несколько ПК одной операцией —         ║
// ║    всё или ничего, баллы один раз, отмена всей командой      ║
// ║  v6: токены — в «Свойствах скрипта», подпись Telegram,       ║
// ║      Gizmo «сколько осталось», брони до минуты               ║
// ║                                                              ║
// ║  ИНСТРУКЦИЯ:                                                 ║
// ║  1. Замени ВЕСЬ код в Apps Script на этот                    ║
// ║  2. ⚙️ Настройки проекта → Свойства скрипта → добавь:        ║
// ║     BOT_TOKEN, USER_BOT_TOKEN, ADMIN_KEY, BRIDGE_KEY         ║
// ║     (или впиши их в setupSecrets() ниже и запусти её)        ║
// ║     Без токенов не работают админка и уведомления!           ║
// ║  3. Запусти setupAllSheets() и setupTriggers()               ║
// ║  4. Развернуть → Управление развёртываниями → ✏️ →           ║
// ║     Версия: «Новая версия» → Развернуть                      ║
// ║  5. Запусти testTelegram() — проверит бота                   ║
// ╚══════════════════════════════════════════════════════════════╝

// ════════════════════════════════
// 🔐 СЕКРЕТЫ — В «СВОЙСТВАХ СКРИПТА», НЕ В КОДЕ
// ════════════════════════════════
const PROPS = PropertiesService.getScriptProperties()
const BOT_TOKEN      = PROPS.getProperty('BOT_TOKEN') || ''       // toxicskill_booking_bot — сообщения АДМИНУ (брони, репорты)
const USER_BOT_TOKEN = PROPS.getProperty('USER_BOT_TOKEN') || ''  // toxicskill_bot — сообщения ПОЛЬЗОВАТЕЛЯМ (напоминания, ДР, бонусы, рассылка)
const ADMIN_KEY      = PROPS.getProperty('ADMIN_KEY') || ''       // запасной вход владельца (🔑 в приложении)
const BRIDGE_KEY     = PROPS.getProperty('BRIDGE_KEY') || ''      // ключ Gizmo Bridge (пусто = мост пускается без ключа)
const ADMIN_CHAT_ID  = PROPS.getProperty('ADMIN_CHAT_ID') || '8523093520'

// ════════════════════════════════
// НАСТРОЙКИ — МЕНЯЙ ТОЛЬКО ЗДЕСЬ
// ════════════════════════════════
const SHEET_PROMOS   = 'Promos'
const SHEET_BOOKINGS = 'Bookings'
const SHEET_POINTS   = 'PointsLog'
const SHEET_REWARDS  = 'Rewards'
const SHEET_GIZMO    = 'GizmoStatus'
const SHEET_PROMOLOG = 'PromoLog'
const SHEET_REVIEWS  = 'Reviews'
const SHEET_USERS    = 'Users'
const CLUB_TZ        = 'Europe/Minsk'
const BACKEND_V      = '7.2'  // версия бэкенда (видна в диагностике панели)

// 🔒 Действия клиента (баллы, отмена, профиль…) только с подписью Telegram.
// Без подписи клиент считается гостем. Ставь false только на время перехода.
const REQUIRE_TG_SIGNATURE = true

// 🖥️ Gizmo: сколько минут считать ПК занятым, если мост не прислал время окончания
const GIZMO_UNKNOWN_BUSY_MIN = 60
// Данные Gizmo старше этого — не учитываем (мост выключен)
const GIZMO_STALE_MIN = 5

// ════════════════════════════════════════
// ⭐ БАЛЛЫ — настройки (можно менять)
// ════════════════════════════════════════
const PTS = {
  perHour:         1,   // за каждый час пакета
  vipBonus:        2,   // бонус за VIP/Bootcamp
  tgBonus:         1,   // бонус за Telegram
  firstMonthBonus: 5,   // первая бронь месяца (крупный «щедрый» бонус)
  maxBookPerDay:   2,   // макс. бронирований в день с баллами
  maxPtsPerDay:    10,  // потолок баллов за сутки
  minHoursBetween: 1,   // мин. часов между начислениями
  voucherExpiry:   24,  // часов действия ваучера
  maxVouchers:     2,   // макс. активных ваучеров
}

// ════════════════════════════════════════
// 🎁 КАТАЛОГ НАГРАД (можно менять)
// ════════════════════════════════════════
const REWARDS = [
  { id:'R1', cost:40,  hours:1, zone:'std', label:'1 час Standard' },
  { id:'R2', cost:100, hours:3, zone:'std', label:'3 часа Standard' },
  { id:'R3', cost:170, hours:5, zone:'std', label:'5 часов Standard' },
  { id:'R4', cost:300, hours:5, zone:'vip', label:'5 часов VIP / Bootcamp' },
]

// ════════════════════════════════════════════
// SETUP — запусти setupAllSheets() один раз
// ════════════════════════════════════════════
function setupAllSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet()

  function ensure(name, headers) {
    let s = ss.getSheetByName(name)
    if (!s) {
      s = ss.insertSheet(name)
      s.appendRow(headers)
      s.getRange(1,1,1,headers.length).setFontWeight('bold')
      Logger.log('✅ ' + name + ' создан')
    } else { Logger.log('ℹ️ ' + name + ' уже есть') }
  }

  ensure(SHEET_PROMOS,   ['code','name','bonus','disc','uses','used','on'])
  ensure(SHEET_BOOKINGS, ['id','user','phone','pc','zone','date','start','end','pkg','price','status','created','tgId','source','group'])
  // v7: колонка «group» (бронь для команды) — добавляем заголовок в старую таблицу
  var bs = ss.getSheetByName(SHEET_BOOKINGS)
  if (!String(bs.getRange(1, 15).getValue())) bs.getRange(1, 15).setValue('group').setFontWeight('bold')
  ensure(SHEET_POINTS,   ['timestamp','tgId','user','phone','action','amount','reason','bookingId','balance'])
  ensure(SHEET_REWARDS,  ['voucherId','tgId','user','phone','rewardId','label','hours','zone','cost','createdAt','expiresAt','status','usedAt'])
  ensure(SHEET_GIZMO,    ['pc','zone','busy','online','user','until','updatedAt'])
  ensure(SHEET_PROMOLOG, ['timestamp','code','tgId','user','phone','bonus','disc'])
  ensure(SHEET_REVIEWS,  ['timestamp','tgId','user','rating','text','replied'])
  ensure(SHEET_USERS,    ['tgId','name','phone','birthday','lastBdayBonus','updatedAt','banned','tempBanUntil','notifPrefs'])

  // Дефолтный промокод
  const ps = ss.getSheetByName(SHEET_PROMOS)
  if (ps.getLastRow() <= 1) {
    ps.appendRow(['TOXIC2025','Приветственный бонус',2,0,100,0,true])
  }

  Logger.log('🎉 Все листы готовы!')
}

// 🔐 Вариант без интерфейса: впиши значения, нажми ▶ Run, ПОТОМ СОТРИ ИХ ОТСЮДА.
// Пустые поля не трогаются. BRIDGE_KEY создастся сам, если его ещё нет.
function setupSecrets() {
  var s = {
    BOT_TOKEN:      '',  // токен @toxicskill_booking_bot
    USER_BOT_TOKEN: '',  // токен @toxicskill_bot
    ADMIN_KEY:      '',  // свой длинный секрет для входа по 🔑
    BRIDGE_KEY:     '',  // секрет Gizmo Bridge (можно оставить пустым)
  }
  var pr = PropertiesService.getScriptProperties()
  Object.keys(s).forEach(function(k){ if (s[k]) pr.setProperty(k, s[k]) })
  if (!pr.getProperty('BRIDGE_KEY')) pr.setProperty('BRIDGE_KEY', Utilities.getUuid().replace(/-/g,''))
  Logger.log('✅ Свойства сохранены. BRIDGE_KEY для моста: ' + pr.getProperty('BRIDGE_KEY'))
  Logger.log('⚠️ Теперь сотри токены из функции setupSecrets()')
}

// ════════════════════════════════════
// RATE LIMITING
// ════════════════════════════════════
function rateOk(key, max) {
  try {
    const c = CacheService.getScriptCache(), k = 'rl_' + key, now = Date.now()
    let h = JSON.parse(c.get(k) || '[]').filter(t => now - t < 60000)
    if (h.length >= max) return false
    h.push(now); c.put(k, JSON.stringify(h), 120)
    return true
  } catch(e) { return true }
}

// ════════════════════
// SANITIZE
// ════════════════════
// Безопасный decodeURIComponent (не падает на одиноких %)
function safeDec(s) { try { return decodeURIComponent(s) } catch(e) { return String(s||'') } }

// Санитайзер для Telegram HTML: экранируем всё, возвращаем только разрешённые теги
function sanTgHtml(s, n) {
  s = String(s||'').substring(0, n||2000)
  s = s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  s = s.replace(/&lt;(\/?(?:b|i|u|s|code))&gt;/gi,'<$1>')
  return s.trim()
}

function san(s, n) { return typeof s === 'string' ? s.replace(/[<>"']/g,'').substring(0,n||200).trim() : '' }

// ═══════════════════════════════════════════════
// 🔐 ПОДПИСЬ TELEGRAM (initData) — кто на самом деле прислал запрос
// ═══════════════════════════════════════════════
function checkInitData_(raw) {
  if (!raw) return { ok:false, why:'no_initdata' }
  try {
    var pairs = String(raw).split('&')
    var hash = '', itemsDec = [], itemsRaw = []
    for (var i = 0; i < pairs.length; i++) {
      var eq = pairs[i].indexOf('=')
      if (eq < 0) continue
      var k = pairs[i].substring(0, eq)
      var vRaw = pairs[i].substring(eq + 1)
      var vDec = vRaw
      try { vDec = decodeURIComponent(vRaw.replace(/\+/g, '%20')) } catch(de) {}
      if (k === 'hash') { hash = vDec } else { itemsDec.push(k + '=' + vDec); itemsRaw.push(k + '=' + vRaw) }
    }
    if (!hash) return { ok:false, why:'no_hash' }
    itemsDec.sort(); itemsRaw.sort()
    var target = hash.toLowerCase()
    // Приложение могут открыть через любого из двух ботов — проверяем оба токена
    var tokens = [USER_BOT_TOKEN, BOT_TOKEN].filter(function(t){ return !!t })
    var matched = false
    for (var t = 0; t < tokens.length && !matched; t++) {
      var secretKey = Utilities.computeHmacSha256Signature(tokens[t], 'WebAppData')
      var hexOf = function(str){
        var sig = Utilities.computeHmacSha256Signature(Utilities.newBlob(str).getBytes(), secretKey)
        return sig.map(function(b){ var x=(b<0?b+256:b).toString(16); return x.length===1?'0'+x:x }).join('')
      }
      // Вариант 1 (по спеке): значения раскодированы. Вариант 2: как пришли.
      if (hexOf(itemsDec.join('\n')) === target || hexOf(itemsRaw.join('\n')) === target) matched = true
    }
    if (!matched) return { ok:false, why: tokens.length ? 'hash_mismatch' : 'no_token' }
    var authDate = 0, userJson = ''
    for (var j = 0; j < itemsDec.length; j++) {
      if (itemsDec[j].indexOf('auth_date=') === 0) authDate = parseInt(itemsDec[j].substring(10)) || 0
      if (itemsDec[j].indexOf('user=') === 0) userJson = itemsDec[j].substring(5)
    }
    if (!authDate || (Date.now()/1000 - authDate) > 172800) return { ok:false, why:'stale' }
    var u = JSON.parse(userJson || '{}')
    if (!u.id) return { ok:false, why:'no_user' }
    return { ok:true, user:u }
  } catch(e) { return { ok:false, why:'parse_error' } }
}

// tgId, которому можно верить: из подписи Telegram. Без подписи — гость ('').
function trustedTgId_(p) {
  var v = checkInitData_(p.initData || '')
  if (v.ok) return String(v.user.id)
  return REQUIRE_TG_SIGNATURE ? '' : san(String(p.tgId||''), 20)
}

// 🔑 Gizmo Bridge: если BRIDGE_KEY задан — без него мост не пускаем
// Старый мост (тот, что запускается из консоли) шлёт статус ПК без ключа. Принимаем его, как раньше,
// чтобы занятость в приложении не пропадала. Чужой/неверный ключ — отказ.
// Строгий режим: свойство скрипта BRIDGE_STRICT = 1 — тогда мост пускается только с ключом.
const BRIDGE_STRICT = PROPS.getProperty('BRIDGE_STRICT') === '1'
function bridgeKeyed_(p) { return !!BRIDGE_KEY && String(p.key||'') === BRIDGE_KEY }
function bridgeOk_(p) {
  if (!BRIDGE_KEY || bridgeKeyed_(p)) return true
  if (!p.key && !BRIDGE_STRICT) {
    try { CacheService.getScriptCache().put('bridge_legacy', new Date().toISOString(), 21600) } catch(e) {}
    return true
  }
  return false
}
// Мост постучался без ключа или с чужим — запоминаем, чтобы владелец увидел это в панели
function bridgeReject_(p, action) {
  try { CacheService.getScriptCache().put('bridge_rej', JSON.stringify({ at:new Date().toISOString(), action:action, hadKey:!!(p && p.key) }), 21600) } catch(e) {}
  return { ok:false, error:'bridge_key' }
}

// ═══════════════════════════════════════════════
// GET
// ═══════════════════════════════════════════════
function doGet(e) {
  const p = (e && e.parameter) || {}, a = p.action || ''
  const isWrite = ['createBooking','redeemReward','cancelBooking'].includes(a)
  if (!rateOk((p.tgId||'x')+'_'+a, isWrite ? 8 : 30)) {
    return json({ ok: false, error: 'Слишком часто' })
  }

  if (a === 'getPromos')       return json(getPromos())
  if (a === 'getBookings')     return json(getBookingsPublic(p.date, p.zone))
  if (a === 'getMyBookings')   return json(getMyBookings(trustedTgId_(p)))
  if (a === 'getPoints')       return json(getPoints(trustedTgId_(p)))
  if (a === 'getRewards')      return json(getActiveVouchers(trustedTgId_(p)))
  if (a === 'getRewardsTable') return json({ ok:true, rewards:REWARDS, expiry:PTS.voucherExpiry })
  if (a === 'getGizmoStatus') return json(getGizmoStatus())
  if (a === 'gizmoSync') {
    if (!bridgeOk_(p)) return json(bridgeReject_(p, a))
    return json(gizmoSyncCompact(p.hosts, p.total, p.busy, p.free))
  }
  if (a === 'getPendingBookings' || a === 'markGizmoSynced') {
    var adm = verifyAdmin(p)
    if (!bridgeOk_(p) && !adm) return json(bridgeReject_(p, a))
    // Телефоны клиентов — только мосту с ключом или админу
    if (a === 'getPendingBookings') return json(getPendingBookings(bridgeKeyed_(p) || adm))
    return json(markGizmoSynced(p.id))
  }
  if (a === 'awardGroupPoints') return json(awardGroupPoints(trustedTgId_(p), san(p.user,60), p.isTg==='1'))
  if (a === 'saveNotifPrefs') return json(saveNotifPrefs(trustedTgId_(p), safeDec(p.prefs||'')))
  if (a === 'getNotifPrefs')  return json({ ok:true, prefs:getNotifPrefs(trustedTgId_(p)) })
  if (a === 'saveUserProfile') return json(saveUserProfile(trustedTgId_(p), san(p.user,60), san(p.phone,20), san(p.birthday,12)))
  // 🔐 Админ-эндпоинты — только с валидным Telegram initData
  // 🩺 Диагностика доступа: версия бэкенда + точная причина (само не требует доступа)
  if (a === 'adminDiag') {
    var dg = verifyAdminEx(p)
    var bu = CacheService.getScriptCache().get('botuser')
    if (!bu) {
      try {
        var gm = JSON.parse(UrlFetchApp.fetch('https://api.telegram.org/bot'+USER_BOT_TOKEN+'/getMe',{muteHttpExceptions:true}).getContentText())
        bu = gm.ok ? ('@'+gm.result.username) : '⚠️ токен невалиден'
      } catch(e) { bu = '?' }
      CacheService.getScriptCache().put('botuser', bu, 600)
    }
    // 🖥️ Состояние моста Gizmo: когда последний раз прислал данные и не стучится ли без ключа
    var gzs = { hosts:[], updatedAt:'' }, rej = null
    try { gzs = gizmoLoad_() } catch(e) {}
    try { rej = JSON.parse(CacheService.getScriptCache().get('bridge_rej') || 'null') } catch(e) {}
    return json({ ok:true, v:BACKEND_V, access:dg.ok, why:dg.why, hasInit:!!p.initData, hasKey:!!p.adminKey, bot:bu,
      secrets:{ bot:!!BOT_TOKEN, userBot:!!USER_BOT_TOKEN, adminKey:!!ADMIN_KEY, bridgeKey:!!BRIDGE_KEY },
      gizmo:{ updatedAt:gzs.updatedAt || '', hosts:gzs.hosts.length, busy:gzs.hosts.filter(function(h){ return h.busy }).length, staleMin:GIZMO_STALE_MIN, rejected:rej,
        legacyAt: CacheService.getScriptCache().get('bridge_legacy') || '', strict: BRIDGE_STRICT },
      // Ключ моста — только подтверждённому владельцу, чтобы вписать его в адрес моста
      bridgeKey: dg.ok ? BRIDGE_KEY : '' })
  }
  if (a === 'adminFind' || a === 'adminPoints' || a === 'adminBan' || a === 'adminBroadcast' || a === 'adminMaint' || a === 'adminMsg' || a === 'adminSetBal' || a === 'adminTempBan' || a === 'adminClubStats' || a === 'adminRunBday' || a === 'adminBookings') {
    var av = verifyAdminEx(p)
    if (!av.ok) return json({ ok:false, error:'Доступ запрещён ('+av.why+')' })
    if (a === 'adminFind')      return json(adminFindUser(san(p.q,60)))
    if (a === 'adminPoints')    return json(adminAdjustPoints(san(p.tgId,20), p.amount, san(safeDec(p.reason||''),100)))
    if (a === 'adminBan')       return json(adminSetBan(san(p.tgId,20), p.on === '1'))
    if (a === 'adminBroadcast') return json(adminBroadcast(san(safeDec(p.text||''),500)))
    if (a === 'adminMaint')     return json(setMaintenance(p.on === '1', san(safeDec(p.msg||''),200), san(String(p.eta||''),5)))
    if (a === 'adminMsg')       return json(adminMessage(san(p.tgId,20), san(safeDec(p.text||''),500)))
    if (a === 'adminSetBal')    return json(adminSetBalance(san(p.tgId,20), p.target))
    if (a === 'adminTempBan')   return json(adminTempBan(san(p.tgId,20), p.days))
    if (a === 'adminClubStats') return json(adminClubStats())
    if (a === 'adminRunBday')   return json({ ok:true, sent:sendBirthdayBonuses() })
    if (a === 'adminBookings')  return json(getBookingsFull(p.all === '1'))
  }
  if (a === 'getMaint') {
    var mt = getMaintenance()
    var mTg = trustedTgId_(p) || san(String(p.tgId||''), 20)
    mt.banned = mTg ? isBanned(mTg) : false
    return json(mt)
  }
  if (a === 'validatePromo') {
    // 🔒 Промокоды: защита от перебора — не больше 8 попыток за 10 минут
    var pTg = trustedTgId_(p) || 'anon'
    var pc = CacheService.getScriptCache(), pKey = 'promo_' + pTg
    var tries = parseInt(pc.get(pKey)||'0')
    if (tries >= 8) return json({ ok:false, error:'Слишком много попыток. Попробуй через 10 минут.' })
    pc.put(pKey, String(tries+1), 600)
    return json(validatePromo(p.code, san(p.user,60), san(p.phone,20), pTg === 'anon' ? '' : pTg))
  }
  if (a === 'submitReview') {
    // 🔒 Отзывы: только с Telegram ID, оценка 1–5, не чаще 1 в час
    var rTg = trustedTgId_(p)
    if (!rTg) return json({ ok:false, error:'Нужен Telegram' })
    var rRate = parseInt(p.rating)||0
    if (rRate < 1 || rRate > 5) return json({ ok:false, error:'Оценка от 1 до 5' })
    var rc = CacheService.getScriptCache(), rKey = 'rev_' + rTg
    if (rc.get(rKey)) return json({ ok:false, error:'Отзыв уже отправлен, спасибо!' })
    rc.put(rKey, '1', 3600)
    return json(submitReview(rTg, san(p.user,60), rRate, san(p.text,500)))
  }
  if (a === 'ping')            return json({ ok:true, v:BACKEND_V })

  if (a === 'createBooking') return json(createBookingFromParams_(p))
  if (a === 'cancelBooking') return json(cancelBooking(san(p.id,30), trustedTgId_(p), verifyAdmin(p), p.all === '1'))
  if (a === 'redeemReward')  return json(redeemReward(san(p.rewardId,10), trustedTgId_(p), san(p.user,60), san(p.phone,20)))
  if (a === 'notify') {
    // 🔒 Анти-спам: не больше 12 уведомлений в минуту суммарно
    var nc = CacheService.getScriptCache()
    var nKey = 'notify_' + Math.floor(Date.now()/60000)
    var nCnt = parseInt(nc.get(nKey)||'0')
    if (nCnt >= 12) return json({ ok:false, error:'rate_limited' })
    nc.put(nKey, String(nCnt+1), 90)
    return json(sendTg(sanTgHtml(safeDec(p.msg||''),2000)))
  }

  return ContentService.createTextOutput('ToxicSkill v' + BACKEND_V + ' OK')
}

// ═══════════════════════════════════════════════
// POST
// ═══════════════════════════════════════════════
function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents), a = d.action
    if (!rateOk((d.tgId||'x')+'_'+a, 10)) return json({ ok:false, error:'Rate limit' })

    if (a==='notify')        return json(sendTg(sanTgHtml(String(d.msg||''),2000)))
    if (a==='bugReport')     return json(sendBugReport(d.caption, d.photo))
    if (a==='getBookings')   return json(getBookingsPublic(d.date||null, d.zone||null))
    if (a==='getPromos')     return json(getPromos())
    if (a==='getPoints')     return json(getPoints(trustedTgId_(d)))
    if (a==='createBooking') return json(createBookingFromParams_(d))
    if (a==='cancelBooking') return json(cancelBooking(san(String(d.id||''),30), trustedTgId_(d), verifyAdmin(d), String(d.all) === '1'))
    if (a==='redeemReward')  return json(redeemReward(san(String(d.rewardId||''),10), trustedTgId_(d), san(String(d.user||''),60), san(String(d.phone||''),20)))
    if (a==='gizmoSync') {
      if (!bridgeOk_(d)) return json(bridgeReject_(d, a))
      return json(gizmoSync(d.hosts))
    }

    // 🔐 Промокоды меняет только админ
    if (['usePromo','syncPromos','createPromo','togglePromo','deletePromo'].indexOf(a) >= 0) {
      var av = verifyAdminEx(d)
      if (!av.ok) return json({ ok:false, error:'Доступ запрещён ('+av.why+')' })
      if (a==='usePromo')      return json(markPromoUsed(d.code))
      if (a==='syncPromos')    return json(syncPromos(d.promos))
      if (a==='createPromo')   return json(createPromo(d.promo))
      if (a==='togglePromo')   return json(togglePromo(d.code,d.on))
      if (a==='deletePromo')   return json(deletePromo(d.code))
    }

    return json({ ok:false, error:'Unknown action' })
  } catch(err) { return json({ ok:false, error:err.toString() }) }
}

// ═══════════════════════════════════════════════
// TELEGRAM (токен ТОЛЬКО В СВОЙСТВАХ СКРИПТА!)
// ═══════════════════════════════════════════════
function sendTg(text) {
  if (!text || !BOT_TOKEN) return { ok:false }
  try {
    const r = UrlFetchApp.fetch('https://api.telegram.org/bot'+BOT_TOKEN+'/sendMessage', {
      method:'post', contentType:'application/json',
      payload:JSON.stringify({ chat_id:ADMIN_CHAT_ID, text:text, parse_mode:'HTML' }),
      muteHttpExceptions:true
    })
    return { ok: JSON.parse(r.getContentText()).ok }
  } catch(e) { return { ok:false } }
}

function testTelegram() {
  if (!BOT_TOKEN) { Logger.log('❌ Нет BOT_TOKEN в свойствах скрипта'); return }
  const r = sendTg('✅ <b>ToxicSkill v' + BACKEND_V + '</b>\n\n🔒 Токены в свойствах скрипта\n⭐ Баллы серверные\n🖥 Gizmo: время до конца сессии')
  Logger.log(r.ok ? '✅ OK!' : '❌ Fail')
}

// ═══════════════════════════════════════════════
// ⭐ БАЛЛЫ — СЕРВЕРНАЯ ЛОГИКА
// ═══════════════════════════════════════════════

function ptsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  return ss.getSheetByName(SHEET_POINTS) || (setupAllSheets(), ss.getSheetByName(SHEET_POINTS))
}

function getPoints(tgId) {
  if (!tgId) return { ok:true, balance:0, history:[] }
  try {
    const rows = ptsSheet().getDataRange().getValues()
    let bal = 0; const hist = []
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][1]) !== String(tgId)) continue
      const amt = parseInt(rows[i][5])||0; bal += amt
      hist.push({ date:String(rows[i][0]), action:String(rows[i][4]), amount:amt, reason:String(rows[i][6]) })
    }
    return { ok:true, balance:Math.max(0,bal), history:hist.slice(-20) }
  } catch(e) { return { ok:true, balance:0, history:[] } }
}

function logPts(tgId, user, phone, action, amount, reason, bkId) {
  const cur = getPoints(tgId)
  const newBal = Math.max(0, cur.balance + amount)
  ptsSheet().appendRow([new Date().toISOString(), String(tgId), user||'', phone||'', action, amount, reason, bkId||'', newBal])
  return { ok:true, balance:newBal }
}

// ── Начислить баллы за бронь (С АНТИ-ФАРМОМ) ──
function awardPoints(bk, bkId) {
  if (!bk.tgId) return { ok:false, reason:'no_tg' }

  const tz = CLUB_TZ
  const today = Utilities.formatDate(new Date(), tz, 'dd.MM.yyyy')
  const rows = ptsSheet().getDataRange().getValues()

  let dayCount=0, dayPts=0, lastTime=null
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][1])!==String(bk.tgId) || String(rows[i][4])!=='earn') continue
    const ts = new Date(String(rows[i][0]))
    if (Utilities.formatDate(ts, tz, 'dd.MM.yyyy') === today) {
      dayCount++; dayPts += parseInt(rows[i][5])||0
    }
    if (!lastTime || ts > lastTime) lastTime = ts
  }

  // 🔒 Макс N начислений/день
  if (dayCount >= PTS.maxBookPerDay) return { ok:false, msg:'Лимит: '+PTS.maxBookPerDay+' начисления/день' }

  // 🔒 Мин. интервал
  if (lastTime && (Date.now()-lastTime.getTime()) < PTS.minHoursBetween*3600000)
    return { ok:false, msg:'Мин. '+PTS.minHoursBetween+'ч между начислениями' }

  // Расчёт
  const hrs = parseHours(bk.start, bk.end)
  let pts = hrs * PTS.perHour

  const z = String(bk.zone||'').toLowerCase()
  if (z==='vip'||z==='bc'||z==='bootcamp') pts += PTS.vipBonus
  if (bk.isTg) pts += PTS.tgBonus

  const curMonth = new Date().getMonth()
  const had = rows.some((r,i) => i>0 && String(r[1])===String(bk.tgId) && String(r[4])==='earn' && new Date(String(r[0])).getMonth()===curMonth)
  if (!had) pts += PTS.firstMonthBonus

  // 🔒 Потолок
  if (dayPts+pts > PTS.maxPtsPerDay) pts = Math.max(0, PTS.maxPtsPerDay-dayPts)
  if (pts <= 0) return { ok:false, msg:'Дневной лимит баллов' }

  const tags = [hrs+'ч']
  if (z==='vip'||z==='bc'||z==='bootcamp') tags.push('VIP')
  if (bk.isTg) tags.push('TG')
  if (!had) tags.push('1й/мес')

  const res = logPts(bk.tgId, bk.user, bk.phone, 'earn', pts, 'Бронь: '+tags.join(' · '), bkId)
  return { ok:true, earned:pts, balance:res.balance, tags:tags.join(' · ') }
}

// ── Баллы за групповое бронирование (как за 1 ПК, анти-абуз) ──
// 🔒 Только за НАСТОЯЩУЮ свежую бронь клиента, за которую ещё не начисляли
function awardGroupPoints(tgId, user, isTg) {
  if (!tgId) return { ok:false, reason:'no_tg' }
  var rows = bookSheet().getDataRange().getValues()
  var awarded = {}
  ptsSheet().getDataRange().getValues().forEach(function(r){ if (String(r[7])) awarded[String(r[7])] = 1 })
  var cutoff = Date.now() - 2*3600000, row = null
  for (var i = rows.length-1; i >= 1; i--) {
    if (String(rows[i][12]) !== String(tgId)) continue
    if (String(rows[i][10]) === 'cancelled') continue
    var created = new Date(String(rows[i][11])).getTime()
    if (!(created > cutoff)) continue
    var id = String(rows[i][0])
    if (awarded[id] || awarded['GRP'+id]) continue
    row = rows[i]; break
  }
  if (!row) return { ok:false, msg:'Нет новой брони для начисления' }
  var bk = {
    tgId: tgId, user: user || String(row[1]) || 'Гость', phone: '',
    zone: String(row[4]||'std'), start: fmtTime(row[6]), end: fmtTime(row[7]),
    isTg: !!isTg
  }
  return awardPoints(bk, 'GRP'+String(row[0]))
}
function pad2(n){ return (n<10?'0':'')+n }

// ── Списать баллы при отмене ──
function revokePoints(bkId, tgId) {
  if (!bkId||!tgId) return { ok:true, revoked:0 }
  const rows = ptsSheet().getDataRange().getValues()
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][7])===String(bkId) && String(rows[i][4])==='earn') {
      const amt = parseInt(rows[i][5])||0
      if (amt > 0) {
        logPts(tgId, String(rows[i][2]), String(rows[i][3]), 'cancel', -amt, 'Отмена '+bkId, bkId)
        return { ok:true, revoked:amt }
      }
    }
  }
  return { ok:true, revoked:0 }
}

// ═══════════════════════════════════════════════
// 🎁 НАГРАДЫ — ОБМЕН БАЛЛОВ НА ЧАСЫ
// ═══════════════════════════════════════════════

function rwSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  return ss.getSheetByName(SHEET_REWARDS) || (setupAllSheets(), ss.getSheetByName(SHEET_REWARDS))
}

function getActiveVouchers(tgId) {
  if (!tgId) return { ok:true, vouchers:[] }
  try {
    const rows = rwSheet().getDataRange().getValues()
    const now = new Date(), out = []
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][1])!==String(tgId)) continue
      const st = String(rows[i][11]), exp = new Date(String(rows[i][10]))
      if (st==='active' && now > exp) { rwSheet().getRange(i+1,12).setValue('expired'); continue }
      if (st==='active') {
        out.push({
          voucherId:String(rows[i][0]), label:String(rows[i][5]),
          hours:parseInt(rows[i][6])||0, zone:String(rows[i][7]),
          expiresAt:exp.toISOString(),
          hoursLeft:Math.max(0, Math.round((exp-now)/3600000))
        })
      }
    }
    return { ok:true, vouchers:out }
  } catch(e) { return { ok:true, vouchers:[] } }
}

function redeemReward(rewardId, tgId, user, phone) {
  if (!rewardId) return { ok:false, error:'Нет данных' }
  if (!tgId) return { ok:false, error:'Открой приложение через Telegram-бота клуба' }

  const rw = REWARDS.find(r => r.id === rewardId)
  if (!rw) return { ok:false, error:'Награда не найдена' }

  // 🔒 Два одновременных обмена не должны потратить баллы дважды
  var lock = LockService.getScriptLock()
  try { lock.waitLock(10000) } catch(e) { return { ok:false, error:'Сервер занят, попробуй ещё раз' } }
  try {
    const pts = getPoints(tgId)
    if (pts.balance < rw.cost) return { ok:false, error:'Не хватает: '+pts.balance+'/'+rw.cost+' ⭐' }

    const active = getActiveVouchers(tgId)
    if (active.vouchers.length >= PTS.maxVouchers) return { ok:false, error:'Макс '+PTS.maxVouchers+' ваучера. Используй текущие.' }

    // Списываем
    var spend = logPts(tgId, user, phone, 'spend', -rw.cost, 'Награда: '+rw.label, '')

    // Ваучер
    var now = new Date()
    var exp = new Date(now.getTime() + PTS.voucherExpiry*3600000)
    var vid = 'VCH' + Date.now()
    rwSheet().appendRow([vid,String(tgId),user||'',phone||'',rw.id,rw.label,rw.hours,rw.zone,rw.cost,now.toISOString(),exp.toISOString(),'active',''])
  } finally { lock.releaseLock() }

  const tz = CLUB_TZ

  // ── TG: кто, что, где, когда ──
  sendTg(
    '🎁 <b>НАГРАДА АКТИВИРОВАНА!</b>\n\n'+
    '👤 <b>'+(user||'Гость')+'</b>\n'+
    '📱 '+(phone||'—')+'\n'+
    '🆔 TG: '+tgId+'\n\n'+
    '🏆 <b>'+rw.label+'</b>\n'+
    '⏱ '+rw.hours+' часов · Зона: '+rw.zone+'\n'+
    '⭐ Списано: '+rw.cost+' баллов\n'+
    '💰 Остаток: '+spend.balance+' ⭐\n\n'+
    '🎫 Ваучер: <code>'+vid+'</code>\n'+
    '📅 Создан: '+Utilities.formatDate(now,tz,'dd.MM.yyyy HH:mm')+'\n'+
    '⏰ Истекает: <b>'+Utilities.formatDate(exp,tz,'dd.MM.yyyy HH:mm')+'</b>\n\n'+
    '⚠️ Клиент покажет ваучер — проверь!\n#награда #баллы'
  )

  // 📲 Сообщение КЛИЕНТУ
  sendTgTyped(tgId,
    '🎁 <b>Ваучер активирован!</b>\n\n'+
    '🏆 <b>'+rw.label+'</b>\n'+
    '⏱ '+rw.hours+' часов · Зона: '+rw.zone+'\n\n'+
    '🎫 Ваучер: <code>'+vid+'</code>\n'+
    '⏰ Действует до: <b>'+Utilities.formatDate(exp,tz,'dd.MM.yyyy HH:mm')+'</b>\n\n'+
    '📍 Покажи этот ваучер администратору в <b>ToxicSkill</b>\n'+
    '📞 +375 33 665-66-52'
  , 'bookings')

  return {
    ok:true, voucherId:vid, label:rw.label, hours:rw.hours, zone:rw.zone,
    expiresAt:exp.toISOString(), hoursLeft:PTS.voucherExpiry, balance:spend.balance
  }
}

// ═══════════════════════════════════════════════
// ПРОМОКОДЫ
// ═══════════════════════════════════════════════
function promoSheet() {
  const s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_PROMOS)
  if (!s) throw new Error('Нет листа Promos — запусти setupAllSheets()')
  return s
}

function getPromos() {
  try {
    const rows = promoSheet().getDataRange().getValues()
    return { ok:true, promos: rows.slice(1).filter(r=>String(r[0]).trim()).map(r=>({
      code:String(r[0]).trim().toUpperCase(), name:String(r[1]||''),
      bonus:parseFloat(r[2])||0, disc:0, uses:parseInt(r[4])||100,
      used:parseInt(r[5])||0, on:r[6]===true||String(r[6]).toLowerCase()==='true'
    }))}
  } catch(e) { return { ok:false, promos:[] } }
}

function markPromoUsed(code) {
  if (!code) return { ok:false }
  var sh=promoSheet(), rows=sh.getDataRange().getValues()
  for (var i=1;i<rows.length;i++) {
    if (String(rows[i][0]).trim().toUpperCase()===code.toUpperCase()) {
      var n=(parseInt(rows[i][5])||0)+1; sh.getRange(i+1,6).setValue(n); return { ok:true, used:n }
    }
  }
  return { ok:false }
}

// 🔒 Проверка промокода — 1 человек = 1 активация
function validatePromo(code, userName, userPhone, tgId) {
  if (!code) return { ok:false, error:'Введи промокод' }
  code = String(code).trim().toUpperCase()
  tgId = String(tgId||'').trim()

  var sh = promoSheet()
  var rows = sh.getDataRange().getValues()

  for (var i = 1; i < rows.length; i++) {
    var r = rows[i]
    var rCode = String(r[0]).trim().toUpperCase()
    if (rCode !== code) continue

    var isOn = r[6] === true || String(r[6]).toLowerCase() === 'true'
    if (!isOn) return { ok:false, error:'Промокод неактивен' }

    var uses = parseInt(r[4]) || 100
    var used = parseInt(r[5]) || 0
    if (used >= uses) return { ok:false, error:'Промокод исчерпан' }

    // 🔒 Проверяем: этот человек уже использовал этот промокод?
    if (tgId) {
      var logSh = promoLogSheet()
      var logRows = logSh.getDataRange().getValues()
      for (var j = 1; j < logRows.length; j++) {
        var logCode = String(logRows[j][1]).trim().toUpperCase()
        var logTgId = String(logRows[j][2]).trim()
        if (logCode === code && logTgId === tgId) {
          return { ok:false, error:'Ты уже использовал этот промокод' }
        }
      }
    }

    // ✅ Промокод валиден — увеличиваем счётчик
    sh.getRange(i+1, 6).setValue(used + 1)
    SpreadsheetApp.flush()

    var name = String(r[1] || '')
    var bonus = parseFloat(r[2]) || 0
    var disc = parseInt(r[3]) || 0

    // 📝 Записываем в PromoLog (кто, когда, какой промокод)
    promoLogSheet().appendRow([
      new Date().toISOString(),
      code,
      tgId || '',
      userName || 'Гость',
      userPhone || '',
      bonus,
      disc
    ])

    // TG админу
    sendTg(
      '🎟 <b>Промокод!</b>\n' +
      '👤 ' + (userName||'Гость') + (userPhone ? ' · '+userPhone : '') + '\n' +
      '🆔 TG: ' + (tgId||'—') + '\n' +
      '🏷 <code>' + code + '</code> · ' + name + '\n' +
      (bonus ? '⏱ +'+bonus+'ч ' : '') + (disc ? '💸 -'+disc+'%' : '') + '\n' +
      '📊 ' + (used+1) + '/' + uses + '\n#промокод'
    )

    return {
      ok:true,
      name:name, bonus:bonus, disc:disc,
      used:used+1, uses:uses
    }
  }

  return { ok:false, error:'Промокод не найден' }
}

function promoLogSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet()
  return ss.getSheetByName(SHEET_PROMOLOG) || (setupAllSheets(), ss.getSheetByName(SHEET_PROMOLOG))
}

// ═══════════════════════════════════════════════
// ⭐ ОТЗЫВЫ
// ═══════════════════════════════════════════════
function submitReview(tgId, user, rating, text) {
  if (!rating || rating < 1 || rating > 5) return { ok:false, error:'Поставь оценку 1-5' }

  // Не более 1 отзыва в сутки от одного пользователя
  if (tgId) {
    var ss = SpreadsheetApp.getActiveSpreadsheet()
    var sh = ss.getSheetByName(SHEET_REVIEWS)
    if (sh) {
      var rows = sh.getDataRange().getValues()
      var now = new Date()
      for (var i = 1; i < rows.length; i++) {
        if (String(rows[i][1]).trim() === String(tgId).trim()) {
          var ts = new Date(String(rows[i][0]))
          if (!isNaN(ts.getTime()) && (now.getTime() - ts.getTime()) < 24*60*60*1000) {
            return { ok:false, error:'Ты уже оставил отзыв сегодня' }
          }
        }
      }
    }
  }

  // Записываем
  var rvSh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_REVIEWS) || (setupAllSheets(), SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_REVIEWS))
  rvSh.appendRow([new Date().toISOString(), tgId||'', user||'Гость', rating, text||'', ''])

  // Звёзды для красоты
  var stars = ''
  for (var s = 0; s < 5; s++) stars += (s < rating ? '⭐' : '☆')

  // TG админу
  sendTg(
    '📝 <b>Новый отзыв!</b>\n\n' +
    '👤 <b>' + (user||'Гость') + '</b>\n' +
    '🆔 TG: ' + (tgId||'—') + '\n\n' +
    stars + ' <b>' + rating + '/5</b>\n\n' +
    (text ? '💬 <i>' + text + '</i>\n\n' : '') +
    '#отзыв'
  )

  return { ok:true }
}

function createPromo(p) {
  if (!p||!p.code) return { ok:false }
  const sh=promoSheet(), rows=sh.getDataRange().getValues()
  for (let i=1;i<rows.length;i++) { if (String(rows[i][0]).trim().toUpperCase()===p.code.toUpperCase()) return { ok:false, error:'Уже есть' } }
  sh.appendRow([san(String(p.code),30).toUpperCase(),san(String(p.name||''),80),parseFloat(p.bonus)||0,0,parseInt(p.uses)||100,0,true])
  return { ok:true }
}

function togglePromo(code, on) {
  const sh=promoSheet(), rows=sh.getDataRange().getValues()
  for (let i=1;i<rows.length;i++) { if (String(rows[i][0]).trim().toUpperCase()===String(code).toUpperCase()) { sh.getRange(i+1,7).setValue(!!on); return { ok:true } } }
  return { ok:false }
}

function deletePromo(code) {
  const sh=promoSheet(), rows=sh.getDataRange().getValues()
  for (let i=1;i<rows.length;i++) { if (String(rows[i][0]).trim().toUpperCase()===String(code).toUpperCase()) { sh.deleteRow(i+1); return { ok:true } } }
  return { ok:false }
}

function syncPromos(promos) {
  if (!promos || !Array.isArray(promos)) return { ok:false }
  const sh=promoSheet()
  const values=[['code','name','bonus','disc','uses','used','on']]
  promos.forEach(p=>values.push([san(String(p.code||''),30).toUpperCase(),san(String(p.name||''),80),parseFloat(p.bonus)||0,0,parseInt(p.uses)||100,parseInt(p.used)||0,!!p.on]))
  sh.clearContents()
  sh.getRange(1,1,values.length,7).setValues(values)
  return { ok:true }
}

// ═══════════════════════════════════════════════
// БРОНИ
// ═══════════════════════════════════════════════
function bookSheet() {
  const ss=SpreadsheetApp.getActiveSpreadsheet()
  return ss.getSheetByName(SHEET_BOOKINGS) || (setupAllSheets(), ss.getSheetByName(SHEET_BOOKINGS))
}

// Форматировать значение из Sheets в строку даты dd.MM.yyyy
function fmtDate(val) {
  if (!val) return ''
  if (val instanceof Date) {
    var d = val.getDate(), m = val.getMonth() + 1, y = val.getFullYear()
    if (y < 1900) return String(val)
    return (d < 10 ? '0' : '') + d + '.' + (m < 10 ? '0' : '') + m + '.' + y
  }
  var s = String(val).trim()
  // Уже в формате dd.MM.yyyy?
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(s)) return s
  // Пробуем распарсить
  var dt = new Date(s)
  if (!isNaN(dt.getTime()) && dt.getFullYear() > 1900) {
    var d2 = dt.getDate(), m2 = dt.getMonth() + 1, y2 = dt.getFullYear()
    return (d2 < 10 ? '0' : '') + d2 + '.' + (m2 < 10 ? '0' : '') + m2 + '.' + y2
  }
  return s
}

// Форматировать значение из Sheets в строку времени HH:MM
function fmtTime(val) {
  if (!val) return ''
  if (val instanceof Date) {
    var h = val.getHours(), m = val.getMinutes()
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m
  }
  var s = String(val).trim()
  // Уже в формате HH:MM?
  if (/^\d{2}:\d{2}$/.test(s)) return s
  // Пробуем распарсить Date string
  var dt = new Date(s)
  if (!isNaN(dt.getTime())) {
    var h2 = dt.getHours(), m2 = dt.getMinutes()
    return (h2 < 10 ? '0' : '') + h2 + ':' + (m2 < 10 ? '0' : '') + m2
  }
  return s
}

// ── ⏱ Время брони как отрезок в «абсолютных минутах» (верно через полночь) ──
function dayNum_(dateStr) {
  var p = String(dateStr||'').split('.')
  if (p.length !== 3) return NaN
  return Math.floor(Date.UTC(+p[2], +p[1]-1, +p[0]) / 86400000)
}
function bookingRange_(dateStr, start, end) {
  var day = dayNum_(dateStr)
  if (isNaN(day)) return null
  var s = timeToMin(start), e = timeToMin(end)
  if (e <= s) e += 1440 // ночная бронь заканчивается на следующий день
  return [day*1440 + s, day*1440 + e]
}
function rangesOverlap_(a, b) { return !!(a && b && a[0] < b[1] && b[0] < a[1]) }
function nowAbsMin_() {
  var now = new Date()
  return dayNum_(Utilities.formatDate(now, CLUB_TZ, 'dd.MM.yyyy'))*1440 + timeToMin(Utilities.formatDate(now, CLUB_TZ, 'HH:mm'))
}
function absToHm_(abs) { var m = ((abs % 1440) + 1440) % 1440; return pad2(Math.floor(m/60)) + ':' + pad2(m%60) }

// Все брони (полные строки) — для админа и внутренних проверок
function readBookings_(includeAll) {
  var rows = bookSheet().getDataRange().getValues()
  var bks = []
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i]
    if (!String(r[0]).trim()) continue
    var st = String(r[10]).trim()
    if (!includeAll && (st === 'cancelled' || st === 'completed' || st === 'offline')) continue
    bks.push({
      id: String(r[0]),
      user: String(r[1]),
      phone: String(r[2]),
      pc: String(r[3]),
      zone: String(r[4]),
      date: fmtDate(r[5]),
      start: fmtTime(r[6]),
      end: fmtTime(r[7]),
      pkg: String(r[8]),
      price: String(r[9]),
      status: st,
      created: String(r[11]||''),
      tgId: String(r[12]||''),
      source: String(r[13]||'online'),
      group: String(r[14]||'')
    })
  }
  return bks
}

// 🔓 Публичная занятость ПК — БЕЗ имён, телефонов и Telegram ID
function getBookingsPublic(date, zone) {
  try {
    var c = CacheService.getScriptCache(), list = null
    var hit = c.get('pub_bk_v6')
    if (hit) { try { list = JSON.parse(hit) } catch(e) { list = null } }
    if (!list) {
      var today = dayNum_(Utilities.formatDate(new Date(), CLUB_TZ, 'dd.MM.yyyy'))
      list = readBookings_(false)
        .filter(function(b) { return dayNum_(b.date) >= today - 1 })
        .map(function(b) {
          return { id:b.id, pc:b.pc, zone:b.zone, date:b.date, start:b.start, end:b.end, status:b.status, source:b.source }
        })
      try { c.put('pub_bk_v6', JSON.stringify(list), 20) } catch(e) {}
    }
    if (date) list = list.filter(function(b) { return b.date === date })
    if (zone) list = list.filter(function(b) { return b.zone === zone })
    return { ok: true, bookings: list }
  } catch(e) { return { ok: false, bookings: [] } }
}
// Сбрасываем кэш после любого изменения броней
function bookingsChanged_() { try { CacheService.getScriptCache().remove('pub_bk_v6') } catch(e) {} }

// 🔐 Полный список — только админу
function getBookingsFull(includeAll) {
  try { return { ok:true, bookings: readBookings_(!!includeAll) } }
  catch(e) { return { ok:false, bookings:[] } }
}

// 🔐 Брони самого клиента (по подписи Telegram) — со статусами
function getMyBookings(tgId) {
  if (!tgId) return { ok:false, error:'Нужен Telegram', bookings:[] }
  try {
    var cutoff = dayNum_(Utilities.formatDate(new Date(), CLUB_TZ, 'dd.MM.yyyy')) - 60
    var mine = readBookings_(true).filter(function(b) {
      return b.tgId === String(tgId) && dayNum_(b.date) >= cutoff
    }).map(function(b) {
      return { id:b.id, pc:b.pc, zone:b.zone, date:b.date, start:b.start, end:b.end, pkg:b.pkg, price:b.price, status:b.status, group:b.group }
    })
    return { ok:true, bookings:mine }
  } catch(e) { return { ok:false, bookings:[] } }
}

// Совместимость со старыми вызовами
function getBookings(date, zone) { return getBookingsPublic(date, zone) }

function isOfflineSrc(b){ return b && b.source === 'offline' }

// ═══════════════════════════════════════════════
// 💰 ТАРИФЫ И КОМПЬЮТЕРЫ — цена считается ТОЛЬКО здесь, на сервере
// (то же самое — в js/core/config.js; меняешь цены — поменяй в обоих местах)
// ═══════════════════════════════════════════════
const TARIFF = {
  std: { hour:6, pre:'ST',  pcs:13, pkgs:[
    { id:'s0', n:'1 час',   h:1,  p:6  },
    { id:'s1', n:'3 часа',  h:3,  p:15 },
    { id:'s2', n:'5 часов', h:5,  p:21 },
    { id:'s3', n:'Утро',    h:3,  p:15, from:8,  to:11 },
    { id:'s4', n:'День',    h:6,  p:18, from:11, to:17 },
    { id:'s5', n:'Ночь',    h:10, p:25, from:22, to:8  } ] },
  vip: { hour:8, pre:'VIP', pcs:3, pkgs:[
    { id:'v0', n:'1 час',   h:1,  p:8  },
    { id:'v1', n:'3 часа',  h:3,  p:20 },
    { id:'v2', n:'5 часов', h:5,  p:25 },
    { id:'v3', n:'Утро',    h:3,  p:20, from:8,  to:11 },
    { id:'v4', n:'День',    h:6,  p:23, from:11, to:17 },
    { id:'v5', n:'Ночь',    h:10, p:30, from:22, to:8  } ] },
  bc:  { hour:8, pre:'BC',  pcs:5, pkgs:[
    { id:'b0', n:'1 час',   h:1,  p:8  },
    { id:'b1', n:'3 часа',  h:3,  p:20 },
    { id:'b2', n:'5 часов', h:5,  p:25 },
    { id:'b3', n:'Утро',    h:3,  p:20, from:8,  to:11 },
    { id:'b4', n:'День',    h:6,  p:23, from:11, to:17 },
    { id:'b5', n:'Ночь',    h:10, p:30, from:22, to:8  } ] }
}
// Правила брони
const RULES = {
  freeMin: 30, freeMax: 720, freeStep: 30, // «своё время»: от 30 мин до 12 ч, шаг 30 мин
  maxTeam: 8,          // ПК в одной брони для команды
  daysAhead: 30,       // на сколько дней вперёд можно бронировать
  pastGraceMin: 30,    // начало можно поставить не раньше чем «сейчас − 30 мин»
  maxActive: 6,        // активных броней на клиента
  maxPerDay: 5         // броней на клиента на одну дату
}

function zoneKey_(z) {
  z = String(z||'').toLowerCase()
  if (z === 'bootcamp' || z === 'boot') return 'bc'
  return TARIFF[z] ? z : ''
}
function zoneOfPc_(pc) {
  var m = /^(ST|VIP|BC)-(\d{2})$/.exec(String(pc||'').trim().toUpperCase())
  if (!m) return ''
  for (var k in TARIFF) if (TARIFF[k].pre === m[1]) { var n = +m[2]; return n >= 1 && n <= TARIFF[k].pcs ? k : '' }
  return ''
}
// Цена «своего времени»: каждые начатые 30 мин по часовому тарифу.
// Лучшая цена: если пакет не короче и дешевле — берём цену пакета.
function freePrice_(zone, mins) {
  var t = TARIFF[zone], price = Math.ceil(mins / 30) * t.hour / 2, viaPkg = null
  t.pkgs.forEach(function(p) { if (p.from === undefined && p.h * 60 >= mins && p.p < price) { price = p.p; viaPkg = p } })
  return { price: price, viaPkg: viaPkg }
}
function durRu_(mins) { var h = Math.floor(mins/60), m = mins % 60; return (h ? h + ' ч' : '') + (h && m ? ' ' : '') + (m ? m + ' мин' : '') }
function normPhone_(s) {
  var d = String(s||'').replace(/\D/g, '')
  if (d.length === 12 && d.indexOf('375') === 0) return '+375 ' + d.substr(3,2) + ' ' + d.substr(5,3) + '-' + d.substr(8,2) + '-' + d.substr(10,2)
  return ''
}

// Разобрать и проверить запрос брони (без обращения к таблице)
function planBooking_(p, pcsList) {
  var offline = String(p.source||'') === 'offline'
  var pcs = (pcsList || [p.pc]).map(function(x){ return String(x||'').trim().toUpperCase() }).filter(String)
  if (!pcs.length) return { ok:false, error:'Выбери компьютер' }
  var seen = {}
  for (var i = 0; i < pcs.length; i++) {
    if (seen[pcs[i]]) return { ok:false, error:'Компьютер выбран дважды: ' + pcs[i] }
    seen[pcs[i]] = 1
  }
  if (pcs.length > RULES.maxTeam) return { ok:false, error:'Максимум ' + RULES.maxTeam + ' ПК в одной брони' }
  var zone = zoneOfPc_(pcs[0])
  if (!zone) return { ok:false, error:'Неверный компьютер' }
  for (var j = 1; j < pcs.length; j++) if (zoneOfPc_(pcs[j]) !== zone) return { ok:false, error:'Все ПК должны быть в одной зоне' }
  var zIn = zoneKey_(p.zone)
  if (p.zone && zIn !== zone) return { ok:false, error:'Компьютер не из этой зоны' }

  var date = String(p.date||'').trim(), start = String(p.start||'').trim(), end = String(p.end||'').trim()
  if (!/^\d{2}\.\d{2}\.\d{4}$/.test(date) || isNaN(dayNum_(date))) return { ok:false, error:'Неверная дата' }
  var dd = new Date(dayNum_(date) * 86400000) // 31.02 и подобное — не дата
  if (pad2(dd.getUTCDate()) + '.' + pad2(dd.getUTCMonth() + 1) + '.' + dd.getUTCFullYear() !== date) return { ok:false, error:'Неверная дата' }
  // Конец «24:00» — для совместимости со старыми версиями приложения
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(start) || !/^(([01]\d|2[0-3]):[0-5]\d|24:00)$/.test(end) || start === end) return { ok:false, error:'Неверное время' }
  if (end === '24:00') end = '00:00'
  var range = bookingRange_(date, start, end), mins = range[1] - range[0]

  // Пакет: по id, у старых версий приложения — по названию
  var t = TARIFF[zone], pkg = null, pid = String(p.pkgId||''), pname = String(p.pkg||'').trim()
  t.pkgs.forEach(function(k) { if (pid ? k.id === pid : (pname && k.n === pname && k.h * 60 === mins)) pkg = k })
  if (pid && !pkg) return { ok:false, error:'Такого пакета нет в этой зоне' }

  var price, label, nowAbs = nowAbsMin_()
  if (pkg) {
    if (mins !== pkg.h * 60) return { ok:false, error:'Пакет «' + pkg.n + '» — ровно ' + durRu_(pkg.h * 60) }
    if (pkg.from !== undefined) {
      if (timeToMin(start) !== pkg.from * 60 || timeToMin(end) !== pkg.to * 60) return { ok:false, error:'Пакет «' + pkg.n + '» действует ' + pad2(pkg.from) + ':00–' + pad2(pkg.to) + ':00' }
      // Пакет с окном можно взять, пока до конца окна больше 30 минут
      if (range[1] - 30 <= nowAbs) return { ok:false, error:'Пакет «' + pkg.n + '» на сегодня уже закончился' }
    }
    price = pkg.p; label = pkg.n
  } else {
    if (mins < RULES.freeMin || mins > RULES.freeMax) return { ok:false, error:'Своё время — от ' + durRu_(RULES.freeMin) + ' до ' + durRu_(RULES.freeMax) }
    if (mins % RULES.freeStep) return { ok:false, error:'Своё время выбирается шагом ' + RULES.freeStep + ' мин' }
    var fp = freePrice_(zone, mins)
    price = fp.price; label = 'Своё время ' + durRu_(mins) + (fp.viaPkg ? ' (цена пакета «' + fp.viaPkg.n + '»)' : '')
  }
  if (!(pkg && pkg.from !== undefined) && range[0] < nowAbs - RULES.pastGraceMin) return { ok:false, error:'Это время уже прошло — выбери время позже' }
  if (range[1] <= nowAbs) return { ok:false, error:'Это время уже прошло — выбери время позже' }
  if (range[0] > nowAbs + RULES.daysAhead * 1440) return { ok:false, error:'Бронь возможна максимум на ' + RULES.daysAhead + ' дней вперёд' }

  var user = san(String(p.user||''), 40)
  var phone = normPhone_(p.phone)
  if (!offline) {
    if (!phone) return { ok:false, error:'Укажи номер телефона в формате +375 XX XXX-XX-XX' }
    if (user.length < 2) return { ok:false, error:'Укажи имя (минимум 2 буквы)' }
  }
  var tgId = String(p.tgId||'')
  return {
    ok:true, zone:zone, pcs:pcs, pkg:pkg, label:(offline ? 'Оффлайн · ' : '') + label, mins:mins, price:price,
    range:range, date:date, start:start, end:end, nowAbs:nowAbs,
    user:user || (offline ? 'Гость (клуб)' : 'Гость'), phone:phone, tgId:tgId, isTg:!!tgId, offline:offline,
    source: offline ? 'offline' : (san(String(p.source||''), 12) || 'online')
  }
}

// Общая точка входа для брони (GET и POST)
function createBookingFromParams_(p) {
  var isAdminCall = verifyAdmin(p)
  // 🔐 Оффлайн-брони (без телефона) может создавать только верифицированный админ
  if (p.source === 'offline' && !isAdminCall) return { ok:false, error:'Доступ запрещён' }
  var q = {}
  Object.keys(p).forEach(function(k){ q[k] = p[k] })
  q.tgId = trustedTgId_(p)
  var list = null
  if (p.pcs) list = String(p.pcs).split(',')
  var plan = planBooking_(q, list)
  if (!plan.ok) return plan
  plan.silent = String(p.silent) === '1'
  return createBookings_(plan)
}
// Совместимость: вызов изнутри скрипта объектом брони
function createBooking(b) {
  var plan = planBooking_(b, b.pcs || null)
  if (!plan.ok) return plan
  plan.silent = !!b.silent
  return createBookings_(plan)
}

// Создать бронь на один или несколько ПК (команда) — всё или ничего, под блокировкой
function createBookings_(plan) {
  if (plan.tgId && isBanned(plan.tgId)) return { ok:false, error:'Бронирование недоступно. Обратись к администратору клуба.' }
  if (!plan.offline && getMaintenance().on) return { ok:false, error:'⚙️ Технические работы — бронирование временно недоступно' }

  var lock = LockService.getScriptLock()
  try { lock.waitLock(15000) } catch(lockErr) { return { ok:false, error:'Сервер занят, попробуй через 5 секунд' } }
  try {
    SpreadsheetApp.flush()
    var sh = bookSheet(), rows = sh.getDataRange().getValues()
    var mine = plan.range, myDay = dayNum_(plan.date), nowAbs = plan.nowAbs
    var want = {}; plan.pcs.forEach(function(pc){ want[pc] = 1 })
    var busy = [], why = {}, curEnd = {}, active = 0, dayGroups = {}, ownClash = null

    for (var i = 1; i < rows.length; i++) {
      var r = rows[i]
      if (!String(r[0]).trim()) continue
      var st = String(r[10]).trim().toLowerCase()
      if (st === 'cancelled' || st === 'completed') continue
      var rDate = fmtDate(r[5]), rDay = dayNum_(rDate)
      var their = bookingRange_(rDate, fmtTime(r[6]), fmtTime(r[7]))
      var rPc = String(r[3]).trim().toUpperCase()
      // Брони самого клиента: лимиты и «двойная бронь на одно время»
      if (plan.tgId && !plan.offline && String(r[12]).trim() === plan.tgId) {
        if (their && their[1] > nowAbs) active++
        if (rDate === plan.date) dayGroups[String(r[14]||'') || String(r[0])] = 1
        if (!ownClash && rangesOverlap_(mine, their)) ownClash = rPc + ' ' + fmtTime(r[6]) + '–' + fmtTime(r[7])
      }
      if (!want[rPc] || isNaN(rDay) || Math.abs(rDay - myDay) > 1) continue
      if (their && their[0] <= nowAbs && nowAbs < their[1]) curEnd[rPc] = Math.max(curEnd[rPc] || 0, their[1])
      if (rangesOverlap_(mine, their) && busy.indexOf(rPc) < 0) { busy.push(rPc); why[rPc] = rPc + ' уже забронирован на ' + fmtTime(r[6]) + '–' + fmtTime(r[7]) }
    }

    var fail = null
    if (!plan.offline && plan.tgId) {
      if (active >= RULES.maxActive) fail = { ok:false, error:'Слишком много активных броней. Отмени лишние или обратись к админу.' }
      else if (Object.keys(dayGroups).length >= RULES.maxPerDay) fail = { ok:false, error:'Максимум ' + RULES.maxPerDay + ' броней в день' }
      else if (ownClash) fail = { ok:false, conflict:true, own:true, error:'У тебя уже есть бронь на это время: ' + ownClash + '. Несколько ПК сразу — через «Бронь для команды».' }
    }
    // 🖥️ Gizmo: мешает только пересечение с ИДУЩЕЙ сессией
    if (!fail) plan.pcs.forEach(function(pc) {
      if (busy.indexOf(pc) >= 0) return
      var gz = gizmoHost_(pc)
      if (!gz || !gz.busy) return
      // Остаток неизвестен: если сейчас идёт бронь на этот ПК — сессия по ней, иначе берём запас
      var sessEnd = gz.left !== null ? nowAbs + gz.left : (curEnd[pc] || nowAbs + GIZMO_UNKNOWN_BUSY_MIN)
      if (rangesOverlap_(mine, [nowAbs, sessEnd])) { busy.push(pc); why[pc] = pc + ' сейчас занят в клубе' + (gz.left !== null || curEnd[pc] ? ' до ' + absToHm_(sessEnd) : '') }
    })
    if (!fail && busy.length) {
      fail = { ok:false, conflict:true, busy:busy,
        error: plan.pcs.length > 1 ? 'Уже заняты на это время: ' + busy.join(', ') : why[busy[0]] }
    }
    if (fail) { lock.releaseLock(); return fail }

    // ✅ Записываем все ПК одной операцией (телефон с апострофом — чтобы Sheets не считал формулой)
    var stamp = Date.now(), team = plan.pcs.length > 1 ? 'GR' + stamp : ''
    var created = new Date().toISOString(), ids = []
    var out = plan.pcs.map(function(pc, k) {
      var id = 'BK' + (stamp + k); ids.push(id)
      return [id, plan.user, plan.phone ? "'" + plan.phone : '', pc, plan.zone, plan.date, plan.start, plan.end,
        plan.label, plan.price, 'confirmed', created, plan.tgId || '', plan.source, team]
    })
    sh.getRange(sh.getLastRow() + 1, 1, out.length, 15).setValues(out)
    SpreadsheetApp.flush()
    bookingsChanged_()
    lock.releaseLock()

    var total = plan.price * plan.pcs.length
    var res = { ok:true, id:ids[0], ids:ids, group:team, price:plan.price, total:total, pkg:plan.label, pcs:plan.pcs }
    if (plan.silent) return res

    // ⭐ Баллы — как за одну бронь, даже если ПК несколько (анти-абуз)
    var pr = plan.tgId ? awardPoints({ tgId:plan.tgId, user:plan.user, phone:plan.phone, zone:plan.zone, start:plan.start, end:plan.end, isTg:plan.isTg }, team || ids[0]) : null
    var pl = pr && pr.ok ? '\n⭐ +' + pr.earned + ' (=' + pr.balance + ') · ' + pr.tags : (pr && pr.msg ? '\n⭐ ' + pr.msg : '')
    var pcsTxt = plan.pcs.join(', ') + (plan.pcs.length > 1 ? ' (команда ×' + plan.pcs.length + ')' : '')
    var money = plan.pcs.length > 1 ? total + ' BYN (' + plan.pcs.length + '×' + plan.price + ')' : plan.price + ' BYN'
    sendTg(
      (plan.offline ? '📞 <b>Оффлайн-бронь</b>\n' : plan.pcs.length > 1 ? '👥 <b>Бронь для команды!</b>\n' : '📅 <b>Бронь!</b>\n') +
      '👤 <b>' + plan.user + '</b>' + (plan.phone ? ' · ' + plan.phone : '') + '\n' +
      '🖥 <b>' + pcsTxt + '</b> · ' + plan.zone + '\n' +
      '📆 ' + plan.date + ' · ' + plan.start + '–' + plan.end + '\n' +
      '📦 ' + plan.label + ' · ' + money + '\n' +
      '🆔 ' + (team || ids[0]) + pl + '\n#бронь'
    )
    if (plan.tgId) {
      sendTgTyped(plan.tgId,
        '✅ <b>Бронь подтверждена!</b>\n\n' +
        '🖥 <b>' + pcsTxt + '</b>\n' +
        '📆 ' + plan.date + ' · ' + plan.start + '–' + plan.end + '\n' +
        '📦 ' + plan.label + ' · ' + money + '\n\n' +
        '📍 <b>ToxicSkill</b>\n📞 +375 33 665-66-52\n\n⏰ Приходи вовремя — ждём тебя! 🎮'
      , 'bookings')
    }
    res.points = pr && pr.ok ? { earned:pr.earned, balance:pr.balance, tags:pr.tags } : null
    res.pointsMsg = pr ? pr.msg || null : null
    return res
  } catch(e) {
    try { lock.releaseLock() } catch(le) {}
    return { ok:false, error:e.toString() }
  }
}

// Отмена брони. all=true — отменить всю бронь команды (все её ПК)
function cancelBooking(id, tgId, adminOk, all) {
  if (!id) return { ok:false }
  var lock = LockService.getScriptLock()
  try { lock.waitLock(10000) } catch(e) { return { ok:false, error:'Lock timeout' } }
  try {
    var sh = bookSheet(), rows = sh.getDataRange().getValues(), hit = -1
    for (var i = 1; i < rows.length; i++) if (String(rows[i][0]) === String(id)) { hit = i; break }
    if (hit < 0) { lock.releaseLock(); return { ok:false, error:'Бронь не найдена' } }
    // 🔒 Бронь с владельцем отменяет только владелец (по подписи Telegram) или админ; оффлайн-бронь — только админ
    var owner = String(rows[hit][12]||'').trim(), caller = String(tgId||'').trim(), isAdminCaller = !!adminOk
    if (owner ? (caller !== owner && !isAdminCaller) : !isAdminCaller) {
      lock.releaseLock()
      return { ok:false, error: owner ? 'Можно отменить только свою бронь' : 'Эту бронь может снять только администратор' }
    }
    var team = String(rows[hit][14]||'')
    var targets = [hit]
    if (all && team) {
      targets = []
      for (var j = 1; j < rows.length; j++) if (String(rows[j][14]||'') === team && String(rows[j][12]||'').trim() === owner) targets.push(j)
    }
    var done = targets.filter(function(k){ var st = String(rows[k][10]).trim().toLowerCase(); return st !== 'cancelled' && st !== 'completed' })
    if (!done.length) { lock.releaseLock(); return { ok:false, error:'Бронь уже отменена' } }
    done.forEach(function(k){ sh.getRange(k+1, 11).setValue('cancelled'); rows[k][10] = 'cancelled' })
    SpreadsheetApp.flush()
    bookingsChanged_()
    // Остались ли живые ПК в брони команды
    var teamLeft = 0
    if (team) for (var t = 1; t < rows.length; t++) {
      if (String(rows[t][14]||'') !== team) continue
      var s2 = String(rows[t][10]).trim().toLowerCase()
      if (s2 !== 'cancelled' && s2 !== 'completed') teamLeft++
    }
    lock.releaseLock()

    // Баллы за команду начислялись один раз — списываем, только когда отменён последний ПК
    var rev = 0
    if (owner && (!team || !teamLeft)) { var rv = revokePoints(team || id, owner); rev = rv.revoked || 0 }
    var r0 = rows[hit], pcs = done.map(function(k){ return String(rows[k][3]) }).join(', ')
    sendTg('🗑 <b>Отмена</b>\n🆔 ' + (team && all ? team : id) + '\n👤 ' + String(r0[1]) + '\n🖥 ' + pcs + (rev ? '\n⭐ −' + rev + ' баллов' : '') + (isAdminCaller && caller !== owner ? '\n👑 отменил админ' : '') + '\n#отмена')
    if (owner) {
      sendTgTyped(owner,
        '🗑 <b>Бронь отменена</b>\n\n🖥 <b>' + pcs + '</b>\n' +
        '📆 ' + fmtDate(r0[5]) + ' · ' + fmtTime(r0[6]) + '–' + fmtTime(r0[7]) + '\n\n' +
        (rev ? '⭐ Списано: ' + rev + ' баллов\n\n' : '') + 'Забронировать снова → toxicskill.cfd'
      , 'bookings')
    }
    return { ok:true, revoked:rev, cancelled:done.map(function(k){ return String(rows[k][0]) }) }
  } catch(e) { try { lock.releaseLock() } catch(le) {} return { ok:false, error:e.toString() } }
}

// Получить брони для синхронизации в Gizmo (confirmed, не synced)
function getPendingBookings(withPhones) {
  try {
    var sh = bookSheet()
    var rows = sh.getDataRange().getValues()
    var pending = []
    for (var i = 1; i < rows.length; i++) {
      var r = rows[i]
      var status = String(r[10]).trim()
      if (status !== 'confirmed' && status !== 'gizmo_synced' && status !== 'offline') continue
      pending.push({
        id: String(r[0]), user: String(r[1]), phone: withPhones ? String(r[2]) : '',
        pc: String(r[3]), zone: String(r[4]), date: fmtDate(r[5]),
        start: fmtTime(r[6]), end: fmtTime(r[7]),
        pkg: String(r[8]), price: String(r[9]),
        synced: status === 'gizmo_synced'
      })
    }
    return { ok:true, bookings:pending }
  } catch(e) { return { ok:true, bookings:[] } }
}

// Пометить бронь как синхронизированную с Gizmo
function markGizmoSynced(id) {
  if (!id) return { ok:false }
  try {
    var sh = bookSheet()
    var rows = sh.getDataRange().getValues()
    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === String(id)) {
        sh.getRange(i+1, 11).setValue('gizmo_synced')
        bookingsChanged_()
        return { ok:true }
      }
    }
    return { ok:false }
  } catch(e) { return { ok:false } }
}

// ═══════════════════════════════════════════════
// 🖥️ GIZMO — СИНХРОНИЗАЦИЯ СТАТУСА ПК
// ═══════════════════════════════════════════════
// Мост на ПК клуба присылает: ПК, занят ли, и (если знает) сколько минут осталось.
// Храним в кэше (быстро) и в листе GizmoStatus (видно глазами).

function gizmoSheet() {
  const ss=SpreadsheetApp.getActiveSpreadsheet()
  return ss.getSheetByName(SHEET_GIZMO) || (setupAllSheets(), ss.getSheetByName(SHEET_GIZMO))
}

function detectZone_(pc) {
  pc = String(pc||'').toUpperCase()
  if (pc.indexOf('VIP') === 0) return 'vip'
  if (pc.indexOf('BC') === 0) return 'bc'
  return 'std'
}

// Окончание сессии → ISO-время. Понимает: left (минуты), until (ISO или HH:MM по Минску)
function gizmoUntil_(left, until, nowMs) {
  var l = parseFloat(left)
  if (left !== undefined && left !== null && String(left) !== '' && !isNaN(l) && l >= 0) {
    return new Date(nowMs + Math.round(l)*60000).toISOString()
  }
  var u = String(until||'').trim()
  if (!u) return ''
  if (/^\d{1,2}:\d{2}$/.test(u)) {
    var nowAbs = nowAbsMin_(), target = Math.floor(nowAbs/1440)*1440 + timeToMin(u)
    if (target < nowAbs - 5) target += 1440
    return new Date(nowMs + (target - nowAbs)*60000).toISOString()
  }
  var d = new Date(u)
  return isNaN(d.getTime()) ? '' : d.toISOString()
}

function gizmoSave_(hosts) {
  var now = new Date().toISOString()
  var values = [['pc','zone','busy','online','user','until','updatedAt']]
  hosts.forEach(function(h) { values.push([h.pc, h.zone, !!h.busy, h.online !== false, h.user || '', h.until || '', now]) })
  // Одной записью вместо appendRow на каждый ПК — в разы быстрее
  var sh = gizmoSheet()
  sh.clearContents()
  sh.getRange(1, 1, values.length, 7).setValues(values)
  try { CacheService.getScriptCache().put('gizmo_v6', JSON.stringify({ hosts:hosts, updatedAt:now }), 21600) } catch(e) {}
}

function gizmoLoad_() {
  try {
    var hit = CacheService.getScriptCache().get('gizmo_v6')
    if (hit) return JSON.parse(hit)
  } catch(e) {}
  var rows = gizmoSheet().getDataRange().getValues()
  var hosts = rows.slice(1).filter(function(r){ return String(r[0]).trim() }).map(function(r) {
    return {
      pc:String(r[0]), zone:String(r[1]),
      busy:r[2]===true||String(r[2]).toLowerCase()==='true',
      online:r[3]!==false&&String(r[3]).toLowerCase()!=='false',
      user:String(r[4]||''), until:(r[5] instanceof Date) ? r[5].toISOString() : String(r[5]||'')
    }
  })
  return { hosts:hosts, updatedAt: rows.length > 1 ? String(rows[1][6]) : '' }
}

// Состояние одного ПК для проверки брони: { busy, left (мин или null) }
function gizmoHost_(pc) {
  try {
    var st = gizmoLoad_()
    var age = st.updatedAt ? (Date.now() - new Date(st.updatedAt).getTime())/60000 : 999
    if (age > GIZMO_STALE_MIN) return null
    for (var i = 0; i < st.hosts.length; i++) {
      var h = st.hosts[i]
      if (String(h.pc).trim() !== String(pc).trim()) continue
      var left = null
      if (h.until) { var t = new Date(h.until).getTime(); if (!isNaN(t)) left = Math.max(0, Math.ceil((t - Date.now())/60000)) }
      return { busy: !!h.busy, left: left }
    }
  } catch(e) {}
  return null
}

// Принять компактный статус от Gizmo Bridge (GET)
// Формат: hosts=ST-01:0,ST-02:1:45,VIP-01:1:120   (ПК:занят[:минут осталось])
function gizmoSyncCompact(hostsStr, total, busy, free) {
  if (!hostsStr) return { ok:false, error:'No data' }
  try {
    var nowMs = Date.now(), hosts = []
    String(hostsStr).split(',').forEach(function(pair) {
      var parts = pair.split(':')
      if (parts.length < 2 || !parts[0]) return
      var pc = san(parts[0], 20).toUpperCase(), isBusy = parts[1] === '1'
      hosts.push({ pc:pc, zone:detectZone_(pc), busy:isBusy, online:true, user:'',
        until: isBusy ? gizmoUntil_(parts[2], '', nowMs) : '' })
    })
    gizmoSave_(hosts)
    return { ok:true, count:hosts.length }
  } catch(e) { return { ok:false, error:e.toString() } }
}

// Принять статус от Gizmo Bridge (POST)
// hosts: [{ pc, busy, online, user, left (мин) | until (ISO / HH:MM) }]
function gizmoSync(hostsJson) {
  if (!hostsJson) return { ok:false, error:'No data' }
  try {
    const list = typeof hostsJson === 'string' ? JSON.parse(hostsJson) : hostsJson
    if (!Array.isArray(list)) return { ok:false, error:'Invalid format' }
    var nowMs = Date.now()
    var hosts = list.filter(function(h){ return h && h.pc }).map(function(h) {
      var pc = san(String(h.pc), 20).toUpperCase(), isBusy = h.busy === true || h.busy === 1 || String(h.busy) === 'true'
      return { pc:pc, zone:h.zone ? san(String(h.zone),10) : detectZone_(pc), busy:isBusy, online:h.online !== false,
        user:san(String(h.user||''),40), until: isBusy ? gizmoUntil_(h.left, h.until, nowMs) : '' }
    })
    gizmoSave_(hosts)
    return { ok:true, count:hosts.length }
  } catch(e) { return { ok:false, error:e.toString() } }
}

// Получить текущий статус ПК (публично — без имён игроков)
function getGizmoStatus() {
  try {
    var st = gizmoLoad_()
    if (!st.hosts.length) return { ok:true, hosts:[], source:'none' }
    var nowMs = Date.now()
    var hosts = st.hosts.map(function(h) {
      var left = null
      if (h.busy && h.until) { var t = new Date(h.until).getTime(); if (!isNaN(t)) left = Math.max(0, Math.ceil((t - nowMs)/60000)) }
      return { pc:String(h.pc), zone:String(h.zone), busy:!!h.busy, online:h.online !== false,
        until: left !== null ? h.until : '', left: left }
    })
    var ageMin = st.updatedAt ? Math.round((nowMs - new Date(st.updatedAt).getTime())/60000) : 999
    return {
      ok:true, hosts:hosts, source:'gizmo',
      updatedAt:st.updatedAt,
      fresh: ageMin < 2, // данные свежие если менее 2 минут
      total:hosts.length,
      busy:hosts.filter(function(h){ return h.busy }).length,
      free:hosts.filter(function(h){ return !h.busy }).length
    }
  } catch(e) { return { ok:true, hosts:[], source:'error' } }
}

// ═══════════════════════════════════════════════
// 📲 TG СООБЩЕНИЕ КЛИЕНТУ (после брони)
// ═══════════════════════════════════════════════

function sendTgToUser(tgChatId, text) {
  if (!tgChatId || !text || !USER_BOT_TOKEN) return { ok:false }
  try {
    // 📲 Пользователям пишем с toxicskill_bot (через него они открывают приложение)
    const r = UrlFetchApp.fetch('https://api.telegram.org/bot'+USER_BOT_TOKEN+'/sendMessage', {
      method:'post', contentType:'application/json',
      payload:JSON.stringify({ chat_id:String(tgChatId), text:text, parse_mode:'HTML' }),
      muteHttpExceptions:true
    })
    return { ok: JSON.parse(r.getContentText()).ok }
  } catch(e) { return { ok:false } }
}

// ═══════════════════
// HELPERS
// ═══════════════════
function json(d) { return ContentService.createTextOutput(JSON.stringify(d)).setMimeType(ContentService.MimeType.JSON) }
function timeToMin(t) { t = String(t||''); if (!t.includes(':')) return 0; const[h,m]=t.split(':').map(Number); return h*60+(m||0) }
function parseHours(s,e) { let a=timeToMin(s),b=timeToMin(e); if(b<=a)b+=1440; return Math.max(1,Math.round((b-a)/60)) }

// ═══════════════════════════════════════════════
// 🧹 АВТООЧИСТКА СТАРЫХ БРОНИРОВАНИЙ (30+ дней)
// ═══════════════════════════════════════════════
function cleanupOldBookings() {
  var sh = bookSheet()
  var rows = sh.getDataRange().getValues()
  var now = new Date()
  var cutoff = 30 * 24 * 60 * 60 * 1000 // 30 дней в мс
  var deleted = 0

  // Идём снизу вверх чтобы удаление строк не сбивало индексы
  for (var i = rows.length - 1; i >= 1; i--) {
    var r = rows[i]
    if (!String(r[0]).trim()) continue
    var status = String(r[10]).trim().toLowerCase()
    var created = r[11]

    // Парсим дату создания
    var createdDate = null
    if (created instanceof Date) {
      createdDate = created
    } else if (created) {
      createdDate = new Date(String(created))
    }

    if (!createdDate || isNaN(createdDate.getTime())) continue

    var age = now.getTime() - createdDate.getTime()

    // Удаляем: отменённые/завершённые старше 7 дней, остальные старше 30 дней
    if ((status === 'cancelled' || status === 'completed') && age > 7 * 24 * 60 * 60 * 1000) {
      sh.deleteRow(i + 1)
      deleted++
    } else if (age > cutoff) {
      sh.deleteRow(i + 1)
      deleted++
    }
  }

  if (deleted > 0) {
    bookingsChanged_()
    Logger.log('🧹 Удалено ' + deleted + ' старых бронирований')
  }
  return { ok: true, deleted: deleted }
}

// ═══════════════════════════════════════════════
// ⏰ НАПОМИНАНИЯ ЗА ~30 МИНУТ ДО БРОНИ
// ═══════════════════════════════════════════════
function sendBookingReminders() {
  var sh = bookSheet()
  var rows = sh.getDataRange().getValues()
  var nowAbs = nowAbsMin_()
  var sent = 0

  var cache = CacheService.getScriptCache()

  for (var i = 1; i < rows.length; i++) {
    var r = rows[i]
    var id = String(r[0]).trim()
    if (!id) continue
    var status = String(r[10]).trim().toLowerCase()
    if (status === 'cancelled' || status === 'completed') continue

    var range = bookingRange_(fmtDate(r[5]), fmtTime(r[6]), fmtTime(r[7]))
    if (!range) continue
    var diff = range[0] - nowAbs

    // Напоминание за ~30 минут (окно 22-45 мин ловит при триггере раз в 15 мин)
    if (diff < 22 || diff > 45) continue

    var tgId = String(r[12]).trim()
    if (!tgId) continue

    var cacheKey = 'remind_' + id
    if (cache.get(cacheKey)) continue

    sendTgTyped(tgId,
      '⏰ <b>Напоминание!</b>\n\n' +
      '🖥 <b>' + String(r[3]) + '</b> (' + String(r[4]) + ')\n' +
      '📆 Сегодня · ' + fmtTime(r[6]) + '–' + fmtTime(r[7]) + '\n' +
      '📦 ' + String(r[8]) + '\n\n' +
      '🏃 Через ~' + diff + ' минут — не опаздывай!\n' +
      '📍 <b>ToxicSkill</b> · +375 33 665-66-52'
    , 'bookings')

    cache.put(cacheKey, '1', 7200)
    sent++
  }

  if (sent > 0) Logger.log('⏰ Отправлено ' + sent + ' напоминаний')

  // После напоминаний — авто-завершаем просроченные брони
  autoCompleteBookings()

  return { ok: true, sent: sent }
}

// ═══════════════════════════════════════════════
// ✅ АВТОЗАВЕРШЕНИЕ БРОНИРОВАНИЙ (время вышло)
// ═══════════════════════════════════════════════
function autoCompleteBookings() {
  var sh = bookSheet()
  var rows = sh.getDataRange().getValues()
  var nowAbs = nowAbsMin_()
  var completed = 0

  for (var i = 1; i < rows.length; i++) {
    var r = rows[i]
    var id = String(r[0]).trim()
    if (!id) continue
    var status = String(r[10]).trim().toLowerCase()
    if (status !== 'confirmed' && status !== 'gizmo_synced' && status !== 'offline') continue

    // Завершаем через 15 минут после окончания (ночные — на следующий день, это учтено в range)
    var range = bookingRange_(fmtDate(r[5]), fmtTime(r[6]), fmtTime(r[7]))
    if (range && nowAbs >= range[1] + 15) {
      sh.getRange(i+1, 11).setValue('completed')
      completed++
    }
  }

  if (completed > 0) {
    SpreadsheetApp.flush()
    bookingsChanged_()
    Logger.log('✅ Автозавершено ' + completed + ' бронирований')
  }
  return { ok: true, completed: completed }
}

// ═══════════════════════════════════════════════
// 🔐 ВЕРИФИКАЦИЯ АДМИНА (Telegram initData HMAC)
// Возвращает {ok, why} — why помогает диагностировать отказ
// Запасной вход: ADMIN_KEY (задай в свойствах скрипта и введи его в приложении через 🔑)
// ═══════════════════════════════════════════════
function verifyAdminEx(p) {
  // Запасной ключ — работает всегда (хранится в свойствах скрипта и у тебя в приложении)
  if (p.adminKey && ADMIN_KEY && String(p.adminKey) === ADMIN_KEY) return { ok:true, why:'key' }
  var v = checkInitData_(p.initData || '')
  if (!v.ok) return { ok:false, why:v.why }
  if (String(v.user.id) !== String(ADMIN_CHAT_ID)) return { ok:false, why:'not_admin' }
  return { ok:true, why:'hmac' }
}
function verifyAdmin(p) { return verifyAdminEx(p).ok }

// ═══════════════════════════════════════════════
// 🚫 БАН-СИСТЕМА (Users, колонка 7)
// ═══════════════════════════════════════════════
function isBanned(tgId) {
  if (!tgId) return false
  try {
    var rows = usersSheet().getDataRange().getValues()
    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) !== String(tgId)) continue
      if (String(rows[i][6]||'').toUpperCase() !== 'TRUE') return false
      // ⏳ Временный бан закончился — снимаем сам
      var until = rows[i][7] ? new Date(String(rows[i][7])).getTime() : 0
      if (until && Date.now() > until) {
        usersSheet().getRange(i+1, 7).setValue('')
        usersSheet().getRange(i+1, 8).setValue('')
        return false
      }
      return true
    }
  } catch(e) {}
  return false
}
function adminSetBan(tgId, on) {
  if (!tgId) return { ok:false, error:'no_tg' }
  var sh = usersSheet(), rows = sh.getDataRange().getValues()
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(tgId)) {
      sh.getRange(i+1, 7).setValue(on ? 'TRUE' : '')
      if (!on) sh.getRange(i+1, 8).setValue('')
      if (on) sendTgToUser(tgId, '🚫 <b>Доступ к бронированию ограничен.</b>\nЕсли это ошибка — обратись к администратору клуба.')
      return { ok:true, banned:!!on }
    }
  }
  sh.appendRow([String(tgId), '', '', '', '', new Date().toISOString(), on ? 'TRUE' : ''])
  return { ok:true, banned:!!on }
}

// ═══════════════════════════════════════════════
// 👤 АДМИН: поиск клиента + баллы
// ═══════════════════════════════════════════════
function adminFindUser(q) {
  q = String(q||'').trim()
  if (!q) return { ok:false, error:'Пустой запрос' }
  var qd = q.replace(/\D/g,'')
  var found = null
  var us = usersSheet().getDataRange().getValues()
  for (var i = 1; i < us.length; i++) {
    var tg = String(us[i][0]), ph = String(us[i][2]||'').replace(/\D/g,''), nm = String(us[i][1]||'')
    if (tg === q || (qd.length >= 9 && ph.indexOf(qd) >= 0) || (q.length >= 3 && nm.toLowerCase().indexOf(q.toLowerCase()) >= 0)) {
      found = { tgId:tg, name:nm, phone:String(us[i][2]||''), banned:String(us[i][6]||'').toUpperCase()==='TRUE' }
      break
    }
  }
  if (!found) {
    var bs = bookSheet().getDataRange().getValues()
    for (var k = bs.length-1; k >= 1; k--) {
      var btg = String(bs[k][12]||''), bph = String(bs[k][2]||'').replace(/\D/g,''), bnm = String(bs[k][1]||'')
      if (!btg) continue
      if (btg === q || (qd.length >= 9 && bph.indexOf(qd) >= 0) || (q.length >= 3 && bnm.toLowerCase().indexOf(q.toLowerCase()) >= 0)) {
        found = { tgId:btg, name:bnm, phone:String(bs[k][2]||''), banned:isBanned(btg) }
        break
      }
    }
  }
  if (!found) return { ok:false, error:'Клиент не найден' }
  found.balance = getPoints(found.tgId).balance
  // 📊 Полная статистика клиента из броней
  try {
    var allB = bookSheet().getDataRange().getValues()
    var total = 0, active = 0, cancelled = 0, spent = 0, hours = 0, lastVisit = '', firstSeen = ''
    for (var bi = 1; bi < allB.length; bi++) {
      if (String(allB[bi][12]) !== String(found.tgId)) continue
      total++
      var stt = String(allB[bi][10])
      if (stt === 'cancelled') cancelled++
      else {
        active++
        spent += parseFloat(allB[bi][9]) || 0
        hours += parseHours(fmtTime(allB[bi][6]), fmtTime(allB[bi][7]))
      }
      var dt = fmtDate(allB[bi][5])
      if (!firstSeen) firstSeen = dt
      lastVisit = dt
    }
    found.stats = { total:total, active:active, cancelled:cancelled, spent:spent, hours:hours, lastVisit:lastVisit, firstSeen:firstSeen }
  } catch(e) { found.stats = null }
  found.ok = true
  return found
}

// 🛠 ТЕХНИЧЕСКИЕ РАБОТЫ (Script Properties)
function getMaintenance() {
  var pr = PropertiesService.getScriptProperties()
  return { ok:true, on: pr.getProperty('MAINT') === '1', msg: pr.getProperty('MAINT_MSG') || '',
    eta: pr.getProperty('MAINT_ETA') || '', since: pr.getProperty('MAINT_SINCE') || '' }
}
// eta — «вернёмся к HH:MM» по времени клуба (необязательно)
function setMaintenance(on, msg, eta) {
  var pr = PropertiesService.getScriptProperties()
  eta = /^([01]\d|2[0-3]):[0-5]\d$/.test(String(eta||'')) ? String(eta) : ''
  var wasOn = pr.getProperty('MAINT') === '1'
  pr.setProperty('MAINT', on ? '1' : '')
  pr.setProperty('MAINT_MSG', msg || '')
  pr.setProperty('MAINT_ETA', on ? eta : '')
  // С какого момента идут работы — для полоски прогресса до «вернёмся к»
  if (on && (!wasOn || !pr.getProperty('MAINT_SINCE'))) pr.setProperty('MAINT_SINCE', new Date().toISOString())
  if (!on) pr.setProperty('MAINT_SINCE', '')
  return { ok:true, on:!!on, msg:msg||'', eta:on ? eta : '' }
}

// 💬 Личное сообщение клиенту через бота
function adminMessage(tgId, text) {
  text = String(text||'').trim()
  if (!tgId || !text) return { ok:false, error:'Укажи клиента и текст' }
  if (text.length > 500) return { ok:false, error:'Максимум 500 символов' }
  var r = sendTgToUser(tgId, '💬 <b>Сообщение от ToxicSkill</b>\n\n' + text)
  return r.ok ? { ok:true } : { ok:false, error:'Клиент не запускал бота или заблокировал его' }
}

// 📣 Рассылка всем клиентам (кроме забаненных)
function adminBroadcast(text) {
  text = String(text||'').trim()
  if (!text) return { ok:false, error:'Пустое сообщение' }
  if (text.length > 500) return { ok:false, error:'Максимум 500 символов' }
  var rows = usersSheet().getDataRange().getValues()
  var sent = 0
  for (var i = 1; i < rows.length; i++) {
    var tg = String(rows[i][0]).trim()
    if (!tg) continue
    if (String(rows[i][6]||'').toUpperCase() === 'TRUE') continue
    try { var r = sendTgTyped(tg, '📣 <b>ToxicSkill</b>\n\n' + text, 'events'); if (r.ok && !r.skipped) sent++ } catch(e) {}
    Utilities.sleep(60)
  }
  return { ok:true, sent:sent }
}

// 🎯 Установить ТОЧНЫЙ баланс баллов (разница логируется)
function adminSetBalance(tgId, target) {
  target = parseInt(target); if (isNaN(target) || target < 0) return { ok:false, error:'Некорректное число' }
  if (target > 100000) return { ok:false, error:'Слишком много' }
  var cur = getPoints(tgId).balance
  var diff = target - cur
  if (diff === 0) return { ok:true, balance:cur }
  var r = logPts(tgId, '', '', 'admin_set', diff, 'Установка баланса администратором', '')
  sendTgTyped(tgId, '⚙️ Твой баланс баллов обновлён: <b>' + r.balance + ' ⭐</b>', 'promos')
  return { ok:true, balance:r.balance }
}

// ⏳ Временный бан на N дней (0 = снять)
function adminTempBan(tgId, days) {
  days = parseInt(days) || 0
  var sh = usersSheet(), rows = sh.getDataRange().getValues()
  var until = days > 0 ? (Date.now() + days*86400000) : 0
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(tgId)) {
      sh.getRange(i+1, 7).setValue(days>0 ? 'TRUE' : '')
      sh.getRange(i+1, 8).setValue(until ? new Date(until).toISOString() : '')
      if (days>0) sendTgToUser(tgId, '🚫 <b>Доступ к бронированию ограничен на ' + days + ' дн.</b>\nВопросы — к администратору клуба.')
      return { ok:true, banned:days>0, days:days }
    }
  }
  sh.appendRow([String(tgId), '', '', '', '', new Date().toISOString(), days>0?'TRUE':'', until?new Date(until).toISOString():''])
  return { ok:true, banned:days>0, days:days }
}

// 📊 Сводка по клубу (для дашборда — всё одним запросом)
function adminClubStats() {
  try {
    var b = bookSheet().getDataRange().getValues()
    var u = usersSheet().getDataRange().getValues()
    var tz = CLUB_TZ, now = new Date()
    var today = Utilities.formatDate(now, tz, 'dd.MM.yyyy')
    var clients = {}, revToday = 0, revAll = 0, bkToday = 0, bkAll = 0, cancel = 0
    for (var i = 1; i < b.length; i++) {
      var st = String(b[i][10]); if (st === 'cancelled') { cancel++; continue }
      bkAll++; var pr = parseFloat(b[i][9]) || 0; revAll += pr
      if (String(b[i][12])) clients[String(b[i][12])] = 1
      if (fmtDate(b[i][5]) === today) { bkToday++; revToday += pr }
    }
    var banned = 0
    for (var k = 1; k < u.length; k++) if (String(u[k][6]||'').toUpperCase() === 'TRUE') banned++
    return { ok:true, clients:Object.keys(clients).length, registered:Math.max(0,u.length-1), banned:banned, revToday:revToday, revAll:revAll, bkToday:bkToday, bkAll:bkAll, cancelled:cancel }
  } catch(e) { return { ok:false, error:e.toString() } }
}

function adminAdjustPoints(tgId, amount, reason) {
  amount = parseInt(amount) || 0
  if (!tgId || !amount) return { ok:false, error:'Укажи клиента и сумму' }
  if (Math.abs(amount) > 10000) return { ok:false, error:'Максимум ±10000 за раз' }
  var r = logPts(tgId, '', '', amount > 0 ? 'admin_add' : 'admin_sub', amount, reason || 'Корректировка администратором', '')
  sendTgTyped(tgId, (amount > 0 ? '🎁 <b>+' + amount : '⚠️ <b>−' + Math.abs(amount)) + ' ⭐ баллов</b>\n' + (reason || 'Корректировка администратором') + '\nБаланс: ' + r.balance + ' ⭐', 'promos')
  return { ok:true, balance:r.balance }
}

// ═══════════════════════════════════════════════
// 👤 ПРОФИЛЬ ПОЛЬЗОВАТЕЛЯ + 🎂 ДЕНЬ РОЖДЕНИЯ
// ═══════════════════════════════════════════════
function usersSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet()
  return ss.getSheetByName(SHEET_USERS) || (setupAllSheets(), ss.getSheetByName(SHEET_USERS))
}

// ═══════════════════════════════════════════════
// 🐛 БАГ-РЕПОРТ СО СКРИНШОТОМ
// ═══════════════════════════════════════════════
function sendBugReport(caption, photoB64) {
  var text = sanTgHtml(String(caption||''), 3500)
  if (!text) return { ok:false, error:'empty' }
  if (!photoB64) return sendTg(text)
  try {
    var raw = String(photoB64)
    var b64 = raw.indexOf(',') > 0 ? raw.substring(raw.indexOf(',')+1) : raw
    var blob = Utilities.newBlob(Utilities.base64Decode(b64), 'image/jpeg', 'bug.jpg')
    var shortCap = text.length > 1000 ? text.substring(0, 990) + '…' : text
    var r = UrlFetchApp.fetch('https://api.telegram.org/bot'+BOT_TOKEN+'/sendPhoto', {
      method: 'post',
      payload: { chat_id: String(ADMIN_CHAT_ID), caption: shortCap, parse_mode: 'HTML', photo: blob },
      muteHttpExceptions: true
    })
    var res = JSON.parse(r.getContentText())
    if (!res.ok) { sendTg(text + '\n\n⚠️ Скриншот не удалось прикрепить'); return { ok:true, photo:false } }
    if (text.length > 1000) sendTg('🐛 <b>Полный текст репорта</b>\n\n' + text)
    return { ok:true, photo:true }
  } catch(e) {
    sendTg(text + '\n\n⚠️ Скриншот не обработан')
    return { ok:true, photo:false }
  }
}

// ═══════════════════════════════════════════════
// 🔔 НАСТРОЙКИ УВЕДОМЛЕНИЙ (Users, колонка 9 = JSON)
// bookings — подтверждения/напоминания, promos — акции/баллы, events — рассылка
// ═══════════════════════════════════════════════
function getNotifPrefs(tgId) {
  var def = { bookings:true, promos:true, events:true }
  if (!tgId) return def
  try {
    var rows = usersSheet().getDataRange().getValues()
    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) !== String(tgId)) continue
      var raw = String(rows[i][8]||'').trim()
      if (!raw) return def
      var p = JSON.parse(raw)
      return {
        bookings: p.bookings !== false,
        promos:   p.promos   !== false,
        events:   p.events   !== false
      }
    }
  } catch(e) {}
  return def
}
function saveNotifPrefs(tgId, prefsJson) {
  if (!tgId) return { ok:false, error:'no_tg' }
  try {
    var p = JSON.parse(prefsJson || '{}')
    var clean = JSON.stringify({
      bookings: p.bookings !== false,
      promos:   p.promos   !== false,
      events:   p.events   !== false
    })
    var sh = usersSheet(), rows = sh.getDataRange().getValues()
    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === String(tgId)) {
        sh.getRange(i+1, 9).setValue(clean)
        return { ok:true }
      }
    }
    sh.appendRow([String(tgId), '', '', '', '', new Date().toISOString(), '', '', clean])
    return { ok:true, created:true }
  } catch(e) { return { ok:false, error:e.toString() } }
}
// Отправка пользователю С УЧЁТОМ его настроек
// kind: 'bookings' | 'promos' | 'events' | 'system' (system игнорирует настройки — баны и т.п.)
function sendTgTyped(tgId, text, kind) {
  if (!tgId) return { ok:false }
  if (kind && kind !== 'system') {
    var pr = getNotifPrefs(tgId)
    if (pr[kind] === false) return { ok:true, skipped:true }
  }
  return sendTgToUser(tgId, text)
}

function saveUserProfile(tgId, name, phone, birthday) {
  if (!tgId) return { ok:false, error:'no_tg' }
  try {
    var sh = usersSheet()
    var rows = sh.getDataRange().getValues()
    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === String(tgId)) {
        if (name) sh.getRange(i+1, 2).setValue(name)
        if (phone) sh.getRange(i+1, 3).setValue(phone)
        if (birthday) sh.getRange(i+1, 4).setValue(birthday)
        sh.getRange(i+1, 6).setValue(new Date().toISOString())
        return { ok:true, updated:true }
      }
    }
    sh.appendRow([String(tgId), name||'', phone||'', birthday||'', '', new Date().toISOString()])
    return { ok:true, created:true }
  } catch(e) { return { ok:false, error:e.toString() } }
}

function sendBirthdayBonuses() {
  try {
    var sh = usersSheet()
    var rows = sh.getDataRange().getValues()
    var now = new Date()
    var tz = CLUB_TZ
    var todayDM = Utilities.formatDate(now, tz, 'dd.MM')
    var year = Utilities.formatDate(now, tz, 'yyyy')
    var BDAY_BONUS = 50
    var sent = 0
    for (var i = 1; i < rows.length; i++) {
      var tgId = String(rows[i][0]).trim()
      var name = String(rows[i][1]).trim()
      // ⚠️ Таблицы могут хранить дату как объект Date — приводим к «дд.ММ»
      var bdayRaw = rows[i][3]
      var bdayDM = ''
      if (bdayRaw instanceof Date) {
        bdayDM = Utilities.formatDate(bdayRaw, tz, 'dd.MM')
      } else {
        var bs = String(bdayRaw||'').trim()
        if (!bs) continue
        var mm = bs.match(/(\d{1,2})[.\-\/](\d{1,2})/)
        if (mm) bdayDM = ('0'+mm[1]).slice(-2) + '.' + ('0'+mm[2]).slice(-2)
        else {
          var dt = new Date(bs)
          if (!isNaN(dt.getTime())) bdayDM = Utilities.formatDate(dt, tz, 'dd.MM')
        }
      }
      var lastBonus = String(rows[i][4]||'').trim()
      if (!tgId || !bdayDM) continue
      if (bdayDM !== todayDM) continue
      if (lastBonus === year) continue
      logPts(tgId, name, '', 'birthday', BDAY_BONUS, 'День рождения', '')
      sendTgTyped(tgId,
        '🎂 <b>С Днём Рождения' + (name ? ', ' + name : '') + '!</b>\n\n' +
        'Команда ToxicSkill поздравляет тебя! 🎉\n\n' +
        '🎁 Лови подарок — <b>+' + BDAY_BONUS + ' ⭐ баллов</b> на счёт!\n' +
        'Потрать их на бесплатные часы игры 🎮\n\n' +
        '📍 <b>ToxicSkill</b> · ждём тебя!'
      , 'promos')
      sendTg('🎂 <b>День рождения у клиента!</b>\n👤 ' + (name||tgId) + '\n🎁 Начислено +' + BDAY_BONUS + ' ⭐')
      sh.getRange(i+1, 5).setValue(year)
      sent++
    }
    if (sent > 0) Logger.log('🎂 Поздравлено: ' + sent)
    return { ok:true, sent:sent }
  } catch(e) { return { ok:false, error:e.toString() } }
}

// ═══════════════════════════════════════════════
// 🔧 НАСТРОЙКА АВТОМАТИЧЕСКИХ ЗАДАЧ
// ═══════════════════════════════════════════════
// Запусти setupTriggers() ОДИН РАЗ — создаст автоматические задачи
function setupTriggers() {
  var triggers = ScriptApp.getProjectTriggers()
  for (var i = 0; i < triggers.length; i++) {
    ScriptApp.deleteTrigger(triggers[i])
  }
  ScriptApp.newTrigger('sendBookingReminders').timeBased().everyMinutes(15).create()
  ScriptApp.newTrigger('cleanupOldBookings').timeBased().atHour(4).everyDays(1).create()
  ScriptApp.newTrigger('sendBirthdayBonuses').timeBased().atHour(10).everyDays(1).create()
  Logger.log('✅ Триггеры установлены: напоминания (15мин), очистка (4:00), ДР (10:00)')
}

// ═══════════════════
// ТЕСТЫ
// ═══════════════════
function testAll() { setupAllSheets(); testTelegram(); Logger.log('✅ Готово!') }
