// FORGE — Main Application Logic
// ================================

(function() {
  'use strict';

  // ===== STATE =====
  const state = {
    currentTab: 'home',
    cycleIndex: 0,          // DERIVED from completedDays, never stored. See deriveCycleIndex().
    workoutActive: false,
    workoutPhase: 'overview', // overview | warmup | exercise | complete
    currentExerciseIndex: 0,
    currentSetIndex: 0,
    editingSetIndex: null,
    skippedExercises: [],
    activeWorkoutLog: null,
    timerInterval: null,
    timerRemaining: 0,
    timerEndAt: 0,
    timerRunning: false,
    timerTotal: 0,           // full length of the current rest, for the progress bar
    bodyWeight: 180,         // default, configurable in settings
    workoutSize: 'normal',   // light | normal | extended -> which tiers load
    pickedDayId: null,       // an alternate chosen from the picker; null = scheduled
    countsAsSlot: null,      // true/false override for "counts toward the cycle"
    sheetsUrl: '',           // Google Sheets webhook URL
    weightUnit: 'lbs',
    workoutStartTime: null,
    calendarMonth: new Date().getMonth(),
    calendarYear: new Date().getFullYear(),
    stopwatchRunning: false,
    stopwatchStart: 0,
    stopwatchInterval: null,
    stopwatchElapsed: 0,
    plateCalc: { bar: 45, plates: [] }
  };

  // ===== SANDBOX =====
  // A throwaway copy of your data for showing the app off. While it's on, every
  // read and write goes to the copy, held in sessionStorage: it survives a reload
  // but dies when the app is closed. Real localStorage is never touched and
  // nothing syncs to Sheets. On or off is decided once, at boot.
  const Sandbox = {
    on: false,
    data: null,      // { key: JSON string }, mirrors how localStorage holds it
    frozen: false,   // set just before a reload so nothing writes on the way out
    load() {
      try {
        const raw = sessionStorage.getItem('forge_sandbox');
        if (raw) { this.data = JSON.parse(raw); this.on = true; }
      } catch (e) {}
    },
    save() {
      try { sessionStorage.setItem('forge_sandbox', JSON.stringify(this.data)); } catch (e) {}
    }
  };
  Sandbox.load();

  // ===== STORAGE =====
  const Store = {
    get(key) {
      try {
        const raw = Sandbox.on ? Sandbox.data[key] : localStorage.getItem('forge_' + key);
        return raw == null ? null : JSON.parse(raw);
      }
      catch { return null; }
    },
    set(key, val) {
      if (Sandbox.frozen) return;
      if (Sandbox.on) { Sandbox.data[key] = JSON.stringify(val); Sandbox.save(); return; }
      localStorage.setItem('forge_' + key, JSON.stringify(val));
    },
    remove(key) {
      if (Sandbox.frozen) return;
      if (Sandbox.on) { delete Sandbox.data[key]; Sandbox.save(); return; }
      localStorage.removeItem('forge_' + key);
    },
    clearAll() {
      if (Sandbox.frozen) return;
      if (Sandbox.on) { Sandbox.data = {}; Sandbox.save(); return; }
      localStorage.clear();
    },
    getLogs() { return this.get('logs') || {}; },
    saveLogs(logs) { this.set('logs', logs); },
    getPRs() { return this.get('prs') || {}; },
    savePRs(prs) { this.set('prs', prs); },
    getSettings() {
      return this.get('settings') || {
        bodyWeight: 180,
        workoutSize: 'normal',
        weightUnit: 'lbs',
        sheetsUrl: '',
        cycleStartDate: new Date().toISOString().split('T')[0]
      };
    },
    saveSettings(s) { this.set('settings', s); },
    getCompletedDays() { return this.get('completedDays') || []; },
    getActiveWorkout() { return this.get('activeWorkout'); },
    saveActiveWorkout(data) {
      if (data) this.set('activeWorkout', data);
      else this.remove('activeWorkout');
    }
  };

  function todayLocal() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  // Converts any stored ISO timestamp (UTC) to the LOCAL calendar date it happened on.
  // Fixes the family of bugs where evening workouts got stamped with tomorrow's date.
  function localDateOf(isoString) {
    const d = new Date(isoString);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  // ===== CALENDAR DATA MIGRATION =====
  // Rebuilds completedDays from the workout logs on every boot.
  // Why: old code stamped completed days with the WRONG cycle day (the +7 offset bug),
  // so Push A / Push B days were saved as type "rest" and never rendered an X mark.
  // Logs always carried the correct dayId, so they are the source of truth.
  // Runs in milliseconds, is safe to repeat, and self-heals after a Sheets restore.
  // ===== CYCLE DERIVATION =====
  // Cycle position is no longer a stored counter. It is recomputed from what
  // you actually logged, so it self-heals after a cache clear, a Sheets
  // restore, or a manual calendar edit. Nothing to count, nothing to drift.

  const CODE_FALLBACK = {
    'push-a': 'P1', 'pull-a': 'B1', 'legs-a': 'L1',
    'push-b': 'P2', 'pull-b': 'B2', 'legs-b': 'L2',
    'back-core': 'C', 'rest': '\u2715'
  };
  const SIZE_SUFFIX = { light: '\u2212', normal: '\u2731', extended: '+' };

  function cycleLen() { return FORGE_DATA.cycleDays.length; }

  // ===== WORKOUT SIZE =====
  // Every exercise carries tier 1, 2 or 3 and the sizes are cumulative:
  // light = tier 1, normal = 1+2, extended = everything. One list per day,
  // three views of it, so nothing is authored twice.
  const SIZE_TIERS = { light: 1, normal: 2, extended: 3 };
  const SIZE_ORDER = ['light', 'normal', 'extended'];

  function exercisesFor(workout, size) {
    if (!workout || !workout.exercises) return [];
    const max = SIZE_TIERS[size] || 2;
    const filtered = workout.exercises.filter(ex => (ex.tier || 1) <= max);
    return filtered.length ? filtered : workout.exercises;   // never serve an empty day
  }

  function minutesFor(workout, size) {
    if (workout && workout.minutesBySize && workout.minutesBySize[size]) {
      return workout.minutesBySize[size];
    }
    return workout ? workout.estimatedMinutes : 0;
  }

  // The exercise list the ACTIVE session is running. Locked in at start, so
  // changing size mid-workout can't renumber the exercises under you.
  function activeExercises() {
    const day = activeDay();
    const workout = FORGE_DATA.workouts[day.id];
    const size = (state.activeWorkoutLog && state.activeWorkoutLog.size) || state.workoutSize;
    return exercisesFor(workout, size);
  }

  function setWorkoutSize(size) {
    if (!SIZE_TIERS[size]) return;
    state.workoutSize = size;
    const settings = Store.getSettings();
    settings.workoutSize = size;
    Store.saveSettings(settings);
    renderHome(document.getElementById('main-content'));
  }

  function dayById(id) {
    return FORGE_DATA.cycleDays.find(d => d.id === id)
        || (FORGE_DATA.alternates && FORGE_DATA.alternates[id])
        || null;
  }

  // The day the ACTIVE workout belongs to. Every render used to look this up
  // via cycleDays[cycleIndex], which silently renders the wrong exercises the
  // moment the cycle moves mid-session or an alternate is chosen.
  function activeDay() {
    if (state.activeWorkoutLog) {
      const d = dayById(state.activeWorkoutLog.dayId);
      if (d) return d;
    }
    return FORGE_DATA.cycleDays[state.cycleIndex] || FORGE_DATA.cycleDays[0];
  }

  function nextDay() {
    return FORGE_DATA.cycleDays[state.cycleIndex] || FORGE_DATA.cycleDays[0];
  }

  // What the START button will actually run: the scheduled day, unless an
  // alternate has been picked. The scheduled slot is unchanged either way.
  function selectedDay() {
    if (state.pickedDayId) {
      const d = dayById(state.pickedDayId);
      if (d) return d;
    }
    return nextDay();
  }

  // Does finishing this count as the scheduled slot? The alternate's own
  // default unless the toggle has overridden it this session.
  function selectedAdvances() {
    if (state.countsAsSlot !== null) return state.countsAsSlot;
    if (!state.pickedDayId) return true;                 // the scheduled day always does
    const d = dayById(state.pickedDayId);
    return d && d.advancesByDefault !== false;
  }

  function pickDay(dayId) {
    state.pickedDayId = (dayId === 'scheduled') ? null : dayId;
    state.countsAsSlot = null;                           // reset to the new day's default
    closeInfoPanel();
    renderHome(document.getElementById('main-content'));
  }

  function toggleCountsAs() {
    state.countsAsSlot = !selectedAdvances();
    renderHome(document.getElementById('main-content'));
  }

  // Calisthenics days get their own colour so they read apart from the
  // amber/cyan power-vs-hypertrophy split at a glance.
  const COLOR_TONE = { green: 'cal', violet: 'core', cyan: 'hyp', amber: 'pwr', gray: 'rest' };

  function toneOf(typeOrEntry) {
    if (typeOrEntry && typeof typeOrEntry === 'object') {
      // A calendar entry stores only dayId and type, so look the day up to
      // recover its colour. Back & Core is type "power" but reads violet.
      const d = typeOrEntry.color ? typeOrEntry : (typeOrEntry.dayId ? dayById(typeOrEntry.dayId) : null);
      if (d && d.color && COLOR_TONE[d.color]) return COLOR_TONE[d.color];
    }
    const t = typeof typeOrEntry === 'string' ? typeOrEntry : (typeOrEntry && typeOrEntry.type);
    if (t === 'rest') return 'rest';
    if (t === 'calisthenics') return 'cal';
    if (t === 'hypertrophy') return 'hyp';
    return 'pwr';
  }

  function codeFor(dayId) {
    const d = dayById(dayId);
    if (d && d.code) return d.code;
    return CODE_FALLBACK[dayId] || (dayId || '?').slice(0, 2).toUpperCase();
  }

  function labelFor(entry) {
    if (entry.type === 'rest') return '\u2715';
    return codeFor(entry.dayId) + (SIZE_SUFFIX[entry.size] || SIZE_SUFFIX.normal);
  }

  // Sortable timestamp. Manual calendar entries get noon on their date so they
  // order sanely against real workouts logged the same day.
  function sortKey(c) {
    return c.completedAt || (c.date + 'T12:00:00.000Z');
  }

  function entryUid(c) {
    return (c.dayId || 'x') + '|' + sortKey(c);
  }

  // Walks backwards through everything you have done and finds the most recent
  // entry that counts as a cycle slot. Rest days and bonus workouts carry
  // slotId === null and are stepped over.
  function deriveCycleIndex() {
    const len = cycleLen();
    if (!len) return 0;
    const entries = Store.getCompletedDays()
      .slice()
      .sort((a, b) => (sortKey(a) < sortKey(b) ? -1 : 1));

    for (let i = entries.length - 1; i >= 0; i--) {
      const c = entries[i];
      if (c.type === 'rest') continue;
      if (c.slotId === null) continue;          // explicit bonus workout
      const id = c.slotId || c.dayId;           // legacy entries have no slotId
      const idx = FORGE_DATA.cycleDays.findIndex(d => d.id === id);
      if (idx !== -1) return (idx + 1) % len;
    }
    return 0;
  }

  function refreshCycle() {
    state.cycleIndex = deriveCycleIndex();
  }

  // Rebuilds the calendar from logs on every launch. Two changes from the old
  // version: entries are no longer collapsed one-per-date (so two workouts in
  // one day both survive), and anything flagged manual:true is preserved
  // because no log backs it.
  function migrateCompletedDays() {
    const logs = Store.getLogs();
    const existing = Store.getCompletedDays();
    const todayStr = todayLocal();
    const byUid = {};

    // 1. Rebuild workout entries from logs, one entry per logged session
    Object.keys(logs).forEach(dayId => {
      const dayInfo = dayById(dayId);
      if (!dayInfo) return;
      logs[dayId].forEach(log => {
        if (!log.completedAt) return;
        const entry = {
          date: localDateOf(log.completedAt),
          type: dayInfo.type,
          dayId: dayId,
          size: log.size || 'normal',
          completedAt: log.completedAt
        };
        if (log.slotId !== undefined) entry.slotId = log.slotId;
        byUid[entryUid(entry)] = entry;
      });
    });

    // 2. Preserve manual entries and legacy rest marks. Nothing in logs backs
    //    these, so without this they would vanish on next launch.
    existing.forEach(c => {
      if (c.manual || c.dayId === 'rest' || c.type === 'rest') {
        const entry = {
          date: c.date,
          type: c.type === 'rest' ? 'rest' : c.type,
          dayId: c.dayId || 'rest',
          size: c.size || 'normal',
          completedAt: sortKey(c),
          manual: true
        };
        if (c.slotId !== undefined) entry.slotId = c.slotId;
        else if (entry.type === 'rest') entry.slotId = null;
        const uid = entryUid(entry);
        if (!byUid[uid]) byUid[uid] = entry;
      }
    });

    // 3. Drop future-dated ghosts and save, ordered by time
    const rebuilt = Object.values(byUid)
      .filter(c => c.date <= todayStr)
      .sort((a, b) => (sortKey(a) < sortKey(b) ? -1 : 1));

    Store.set('completedDays', rebuilt);
  }

  // ===== INIT =====
  function init() {
    playSplash();   // start the logo strike right away
    var settings = Store.getSettings();
    state.bodyWeight = settings.bodyWeight || 180;
    state.workoutSize = settings.workoutSize || 'normal';
    state.weightUnit = settings.weightUnit || 'lbs';
    state.sheetsUrl = settings.sheetsUrl || FORGE_DATA.sheetsWebhookUrl || '';
    if (Sandbox.on) state.sheetsUrl = '';   // sandbox never talks to Sheets
    setupSandboxChrome();
    requestPersist();

    // Rebuild calendar data from logs, then derive cycle position from it
    migrateCompletedDays();
    applyBwModes();
    migratePRs();
    rebuildBwPRs();
    refreshCycle();

    // If localStorage is empty, try restoring from Sheets backup
    var logs = Store.getLogs();
    if (Object.keys(logs).length === 0 && FORGE_DATA.sheetsWebhookUrl && !Sandbox.on) {
      restoreFromSheets().then(function(restored) {
        if (restored) {
          var s = Store.getSettings();
          state.bodyWeight = s.bodyWeight || 180;
          state.weightUnit = s.weightUnit || 'lbs';
        }
        migrateCompletedDays(); // restored backup may contain old poisoned entries
        applyBwModes();
        migratePRs();
        rebuildBwPRs();
        refreshCycle();
        setupNavigation();
        restoreActiveWorkout();
        renderTab('home');
        hideSplash();
        registerSW();
      });
      return;
    }

    setupNavigation();
    restoreActiveWorkout();
    renderTab('home');
    hideSplash();
    registerSW();
  }

  // v0.22: ask the browser to keep FORGE's storage when the phone runs low on
  // space. Without this the data sits in the "best effort" bin, which Chrome
  // may clear on its own. Installed apps are usually granted it silently.
  function requestPersist() {
    try {
      if (!navigator.storage || !navigator.storage.persist) return;
      navigator.storage.persisted().then(function(p) {
        if (!p) navigator.storage.persist();
      }).catch(function() {});
    } catch (e) {}
  }

  // Safety net: persist the active workout the instant the app is backgrounded
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') persistWorkoutState();
  });

  function restoreFromSheets() {
    return fetch(FORGE_DATA.sheetsWebhookUrl)
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.status === 'empty') return false;
        if (data.logs) Store.saveLogs(data.logs);
        if (data.prs) Store.savePRs(data.prs);
        if (data.settings) Store.saveSettings(data.settings);
        if (data.completedDays) Store.set('completedDays', data.completedDays);
        console.log('FORGE: Restored from Sheets backup');
        return true;
      })
      .catch(function(e) {
        console.error('FORGE: Restore failed:', e);
        return false;
      });
  }

  function restoreActiveWorkout() {
    const saved = Store.getActiveWorkout();
    if (!saved || !saved.activeWorkoutLog) return;
    // Verify the saved workout still points at a day that exists. Comparing
    // against cycle position was wrong: an alternate or a bonus workout is
    // legitimately not the scheduled day.
    if (!dayById(saved.activeWorkoutLog.dayId)) {
      Store.saveActiveWorkout(null);
      return;
    }
    state.workoutActive = true;
    state.workoutPhase = saved.workoutPhase || 'overview';
    state.currentExerciseIndex = saved.currentExerciseIndex || 0;
    state.currentSetIndex = saved.currentSetIndex || 0;
    state.skippedExercises = saved.skippedExercises || [];
    state.activeWorkoutLog = saved.activeWorkoutLog;
    state.workoutStartTime = saved.workoutStartTime || null;
  }

  function persistWorkoutState() {
    if (!state.workoutActive) {
      Store.saveActiveWorkout(null);
      return;
    }
Store.saveActiveWorkout({
      dayId: state.activeWorkoutLog ? state.activeWorkoutLog.dayId : null,
      workoutPhase: state.workoutPhase,
      currentExerciseIndex: state.currentExerciseIndex,
      currentSetIndex: state.currentSetIndex,
      skippedExercises: state.skippedExercises,
      activeWorkoutLog: state.activeWorkoutLog,
      workoutStartTime: state.workoutStartTime
    });
  }

  function hideSplash() {
    setTimeout(() => {
      const splash = document.getElementById('splash');
      if (splash) { splash.classList.add('hidden'); setTimeout(() => splash.remove(), 600); }
    }, 2000);
  }

  function registerSW() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  // ===== SANDBOX: ENTER, EXIT, CHROME =====
  // Hidden door: tap the FORGE logo in the header five times, quickly.
  let brandTaps = [];
  function onBrandTap() {
    const now = Date.now();
    brandTaps = brandTaps.filter(t => now - t < 1500);
    brandTaps.push(now);
    if (brandTaps.length < 5) return;
    brandTaps = [];
    if (Sandbox.on) return;   // already in; the header pill is the way out
    if (confirm('Enter sandbox?\n\nA copy of your data to play with. Nothing you log is saved or synced. Exit from the header.')) {
      enterSandbox();
    }
  }

  function enterSandbox() {
    persistWorkoutState();   // capture a live workout in the real store first
    const copy = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.indexOf('forge_') === 0) copy[k.slice(6)] = localStorage.getItem(k);
    }
    try { sessionStorage.setItem('forge_sandbox', JSON.stringify(copy)); }
    catch (e) { alert('Could not start the sandbox on this device.'); return; }
    Sandbox.frozen = true;   // the reload below must not write anything
    location.reload();
  }

  function exitSandbox() {
    Sandbox.frozen = true;   // freeze first: the unload handler tries to persist
    try { sessionStorage.removeItem('forge_sandbox'); } catch (e) {}
    location.reload();       // boots clean from real data, onto Home
  }

  function setupSandboxChrome() {
    const brand = document.querySelector('.header-brand');
    if (brand) brand.addEventListener('click', onBrandTap);
    if (!Sandbox.on) return;
    document.body.classList.add('sandbox');
    const header = document.querySelector('.header');
    if (!header || document.getElementById('sandbox-pill')) return;
    const pill = document.createElement('button');
    pill.id = 'sandbox-pill';
    pill.className = 'sandbox-pill';
    pill.innerHTML = '<i class="ti ti-flask"></i> Sandbox <span class="sandbox-x"><i class="ti ti-x"></i> Exit</span>';
    pill.addEventListener('click', exitSandbox);
    header.appendChild(pill);
  }

  // ===== NAVIGATION =====
  // ===== PANELS & THE BACK GESTURE =====
  // Installed as a PWA there is no browser chrome, so a back-swipe with nothing
  // on the history stack closes the app outright. Opening a panel pushes one
  // history entry; the gesture pops that instead and simply dismisses the sheet.
  // Every close routes through history.back() so the two paths cannot disagree.
  let panelPushed = false;

  function showPanel(panelId) {
    document.getElementById(panelId).classList.add('open');
    document.getElementById('info-backdrop').classList.add('open');
    if (!panelPushed) {
      panelPushed = true;
      try { history.pushState({ forgePanel: true }, ''); } catch (e) {}
    }
  }

  function hidePanels() {
    const info = document.getElementById('info-panel');
    const plate = document.getElementById('plate-panel');
    if (info) info.classList.remove('open');
    if (plate) plate.classList.remove('open');
    const bd = document.getElementById('info-backdrop');
    if (bd) bd.classList.remove('open');
    if (window.ForgeFigures) window.ForgeFigures.stopAll();
    state._sheetDate = null;
  }

  function dismissPanel() {
    if (panelPushed) {
      history.back();          // popstate below does the hiding
    } else {
      hidePanels();
    }
  }

  window.addEventListener('popstate', function() {
    if (panelPushed) {
      panelPushed = false;
      hidePanels();
    }
  });

  function setupNavigation() {
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        renderTab(btn.dataset.tab);
      });
    });
    document.getElementById('info-backdrop').addEventListener('click', () => {
      dismissPanel();
    });

    // Enter on any number input closes the phone keyboard instead of forcing a
    // swipe-back. Attached to #main-content rather than the inputs themselves
    // because every render destroys and rebuilds them.
    document.getElementById('main-content').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
        e.preventDefault();
        e.target.blur();
      }
    });
  }

  function renderTab(tab) {
    state.currentTab = tab;
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    const activeBtn = document.querySelector(`.nav-item[data-tab="${tab}"]`);
    if (activeBtn) activeBtn.classList.add('active');
    updateHeaderDate();

    const main = document.getElementById('main-content');
    main.scrollTop = 0;
    switch(tab) {
      case 'home': renderHome(main); break;
      case 'tracker': renderTracker(main); break;
      case 'prs': renderPRs(main); break;
      case 'settings': renderSettings(main); break;
    }
  }

  // Header readout: 2026.09.29 · TUE
  function updateHeaderDate() {
    const el = document.getElementById('header-date');
    if (!el) return;
    const d = new Date();
    const dow = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][d.getDay()];
    el.textContent = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} · ${dow}`;
  }

  // ===== HOME SCREEN =====
  function renderHome(el) {
    refreshCycle();
    const scheduled = nextDay();
    // While a session runs, Home describes that session, not the next pick.
    const day = state.workoutActive ? activeDay() : selectedDay();
    const workout = FORGE_DATA.workouts[day.id];
    const typeClass = toneClass(day);
    setAppTone(typeClass);
    const isAlt = !state.workoutActive && !!state.pickedDayId;
    const exs = state.workoutActive ? activeExercises() : exercisesFor(workout, state.workoutSize);

    // Anything already logged today, so a second session shows context
    const todayStr = todayLocal();
    const todayEntries = Store.getCompletedDays().filter(c => c.date === todayStr);
    const doneLine = todayEntries.length
      ? `<div class="today-done-line">Already logged today ${todayEntries.map(c => `<span class="cal-code ${toneOf(c)}">${labelFor(c)}</span>`).join(' ')}</div>`
      : '';
    const label = state.workoutActive ? 'In progress' : isAlt ? 'Swapped in' : todayEntries.length ? 'Next up' : 'Today';
    const pad2 = n => String(n).padStart(2, '0');

    el.innerHTML = `
      <section class="home-readout ${typeClass}">
        <div class="ro-label"><span class="ro-accent">${label}</span> · Cycle ${pad2(state.cycleIndex + 1)} / ${pad2(cycleLen())}</div>
        <div class="ro-row">
          <h1 class="ro-name${day.name.length > 12 ? ' long' : ''}">${day.name}</h1>
          <span class="ro-code">${codeFor(day.id)}</span>
        </div>
        <div class="ro-meta">${day.label} · ${exs.length} movements · ~${minutesFor(workout, (state.activeWorkoutLog && state.activeWorkoutLog.size) || state.workoutSize)} min</div>
        ${doneLine}
      </section>
      ${renderBackupNudge()}
      ${renderWeekStrip(typeClass)}
      ${renderDayPicker(scheduled, day, typeClass)}
      ${renderMoveTable(exs, typeClass)}
      ${renderSizePicker(workout, typeClass)}
      ${buildActionArea(typeClass)}
    `;
  }

  // ===== v0.16 HOME HELPERS =====
  // One tone name per day: power (amber), hypertrophy (cyan), calisthenics
  // (green) or core (violet). The CSS turns it into the accent colour.
  function toneClass(day) {
    const t = toneOf(day);
    return t === 'hyp' ? 'hypertrophy' : t === 'cal' ? 'calisthenics' : t === 'core' ? 'core' : 'power';
  }

  // Tints the whole app (nav underline, header) with the day in front of you.
  function setAppTone(tone) {
    const app = document.getElementById('app');
    if (!app) return;
    app.classList.remove('power', 'hypertrophy', 'calisthenics', 'core');
    app.classList.add(tone);
  }

  // Which cycle slot lands on a day this many days from today. If today
  // already has a workout or a rest logged, tomorrow is the next slot;
  // if not, today is still the scheduled slot and tomorrow is the one after.
  function projectedIndex(daysAhead) {
    const len = cycleLen();
    const todayStr = todayLocal();
    const todayUsed = Store.getCompletedDays().some(c =>
      c.date === todayStr && (c.type === 'rest' || c.slotId !== null));
    const step = todayUsed ? daysAhead - 1 : daysAhead;
    return ((state.cycleIndex + step) % len + len) % len;
  }

  function entriesByDate() {
    const byDate = {};
    Store.getCompletedDays().forEach(c => {
      if (!byDate[c.date]) byDate[c.date] = [];
      byDate[c.date].push(c);
    });
    Object.keys(byDate).forEach(d => byDate[d].sort((a, b) => (sortKey(a) < sortKey(b) ? -1 : 1)));
    return byDate;
  }

  function dateStrOf(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // Rolling week: two days back, today, four ahead. Past days and today open
  // the day sheet (same as the calendar); future days show the projection.
  function renderWeekStrip(typeClass) {
    const byDate = entriesByDate();
    const now = new Date();
    const DOW = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
    let cells = '';
    for (let off = -2; off <= 4; off++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + off);
      const ds = dateStrOf(d);
      const entries = byDate[ds] || [];
      let codes;
      if (entries.length) {
        codes = `<span class="cal-code ${toneOf(entries[0])}">${labelFor(entries[0])}</span>` +
          (entries.length > 1 ? `<span class="cal-code more">+${entries.length - 1}</span>` : '');
      } else if (off < 0) {
        codes = '<span class="cal-code blank">·</span>';
      } else {
        const fd = FORGE_DATA.cycleDays[projectedIndex(off)];
        codes = `<span class="cal-code ${toneOf(fd)} projected">${codeFor(fd.id)}</span>`;
      }
      const cls = off === 0 ? 'wk-day today' : off > 0 ? 'wk-day future' : 'wk-day';
      const inner = `<span class="wk-dow">${DOW[d.getDay()]}</span><span class="wk-date">${String(d.getDate()).padStart(2, '0')}</span><span class="wk-codes">${codes}</span>`;
      cells += off > 0
        ? `<div class="${cls}">${inner}</div>`
        : `<button class="${cls}" onclick="FORGE.openDaySheet('${ds}')" aria-label="${ds}">${inner}</button>`;
    }
    return `
      <section class="week ${typeClass}">
        <div class="week-head">
          <span class="week-head-label">This week</span>
          <span class="week-head-links">
            <button class="link-btn" onclick="FORGE.openKeySheet()"><i class="ti ti-help-circle"></i>Key</button>
            <button class="link-btn acc" onclick="FORGE.openTracker()">Month <i class="ti ti-chevron-right"></i></button>
          </span>
        </div>
        <div class="week-strip">${cells}</div>
      </section>
    `;
  }

  function shortReps(r) {
    const s = String(r);
    if (/fail/i.test(s)) return 'F';
    if (/max/i.test(s)) return 'MAX';
    return s.replace(/\s*reps?/i, '').replace(/ dir x /i, 'D×').replace(/\s+/g, '');
  }
  function shortRest(label) {
    return String(label || '').replace(/\s*sec(onds)?/i, 's');
  }

  // Today's movements as a spec table. During a session, finished rows grey out.
  function renderMoveTable(exs, typeClass) {
    const log = state.workoutActive && state.activeWorkoutLog ? state.activeWorkoutLog.exercises : null;
    const rows = exs.map((ex, i) => {
      const done = log && log[i] && log[i].completed;
      const tag = ex.isPrimer ? '<span class="primer-tag">Primer</span>' : ex.isFinisher ? '<span class="finisher-tag">Finisher</span>' : '';
      return `
        <div class="mt-row${done ? ' done' : ''}">
          <span class="mt-n">${String(i + 1).padStart(2, '0')}</span>
          <span class="mt-name"><span class="mt-name-text">${ex.name}</span>${tag}</span>
          <span class="mt-sr">${ex.sets}×${shortReps(ex.reps)}</span>
          <span class="mt-rest">${shortRest(ex.restLabel)}</span>
        </div>`;
    }).join('');
    return `
      <section class="move-table ${typeClass}">
        <div class="mt-head"><span>#</span><span>Movement</span><span>S×R</span><span>Rest</span></div>
        ${rows}
      </section>
    `;
  }

  // Row under the today card: which workout, and whether it counts.
  function renderDayPicker(scheduled, day, typeClass) {
    if (state.workoutActive) return '';
    const advances = selectedAdvances();
    const isAlt = !!state.pickedDayId;
    return `
      <div class="day-picker-row ${typeClass}">
        <button class="day-picker-btn" onclick="FORGE.openPickerSheet()">
          <span class="dp-code">${codeFor(day.id)}</span>
          <span class="dp-name">${day.name}</span>
          <span class="dp-swap">SWAP</span>
          <i class="ti ti-chevron-down"></i>
        </button>
        ${isAlt ? `
        <button class="counts-toggle ${advances ? 'on' : ''}" onclick="FORGE.toggleCountsAs()">
          <i class="ti ti-${advances ? 'square-check' : 'square'}"></i>
          ${advances ? `Counts as ${scheduled.name}` : `Bonus · cycle stays on ${scheduled.name}`}
        </button>` : ''}
      </div>
    `;
  }

  function openPickerSheet() {
    const scheduled = nextDay();
    const alts = FORGE_DATA.alternates || {};
    const current = selectedDay().id;

    const row = (d, sub) => {
      const w = FORGE_DATA.workouts[d.id];
      const n = w ? exercisesFor(w, state.workoutSize).length : 0;
      const m = w ? minutesFor(w, state.workoutSize) : 0;
      return `
        <button class="pick-row ${toneOf(d)} ${d.id === current ? 'selected' : ''}"
                onclick="FORGE.pickDay('${d.id === scheduled.id && !state.pickedDayId ? 'scheduled' : d.id}')">
          <span class="cal-code ${toneOf(d)}">${codeFor(d.id)}</span>
          <span class="pick-body">
            <span class="pick-name">${d.name}</span>
            <span class="pick-sub">${sub} \u00b7 ${n} ex \u00b7 ~${m}m</span>
          </span>
          ${d.id === current ? '<i class="ti ti-check"></i>' : ''}
        </button>`;
    };

    const calis = Object.values(alts).filter(a => a.type === 'calisthenics');
    const other = Object.values(alts).filter(a => a.type !== 'calisthenics');

    document.getElementById('info-panel-content').innerHTML = `
      <div class="info-panel-title">Today's workout</div>

      <div class="sheet-section-label">Scheduled</div>
      ${row(scheduled, 'On the cycle')}

      <div class="sheet-section-label">No gym</div>
      ${calis.map(a => row(a, 'Bodyweight')).join('')}

      <div class="sheet-section-label">Extra</div>
      ${other.map(a => row(a, a.advancesByDefault === false ? 'Bonus, does not advance' : 'Counts as the slot')).join('')}

      <div class="sheet-section-label">Other cycle days</div>
      ${FORGE_DATA.cycleDays.filter(d => d.id !== scheduled.id).map(d => row(d, 'Out of order')).join('')}

      <div class="sheet-note">
        Picking a bodyweight or out-of-order day still counts as
        <strong>${scheduled.name}</strong> by default, so tomorrow serves the next
        workout in the cycle. Back &amp; Core is a bonus and leaves the cycle where it is.
        Either way the toggle beside the picker overrides it before you start.
      </div>
    `;
    showPanel('info-panel');
  }

  const SIZE_META = {
    light:    { mark: '\u2212', label: 'Light' },
    normal:   { mark: '\u2731', label: 'Normal' },
    extended: { mark: '+',      label: 'Extended' }
  };

  function renderSizePicker(workout, typeClass, handler) {
    if (state.workoutActive) return '';   // size is locked once you start
    const fn = handler || 'FORGE.setWorkoutSize';
    return `
      <div class="size-picker">
        ${SIZE_ORDER.map(sz => {
          const m = SIZE_META[sz];
          const on = state.workoutSize === sz;
          return `
            <button class="size-btn ${on ? 'active ' + typeClass : ''}" onclick="${fn}('${sz}')">
              <span class="size-mark">${m.mark}</span>
              <span class="size-label">${m.label}</span>
              <span class="size-detail">${exercisesFor(workout, sz).length} ex \u00b7 ~${minutesFor(workout, sz)}m</span>
            </button>`;
        }).join('')}
      </div>
    `;
  }

  // Decides what sits below the today card: a resume card if a workout is
  // in progress, otherwise the normal START / REST button.
  function buildActionArea(typeClass) {
    if (state.workoutActive && state.activeWorkoutLog) {
      const wLog = state.activeWorkoutLog;
      const wDay = dayById(wLog.dayId);
      const wTone = wDay ? toneClass(wDay) : 'power';
      const doneEx = wLog.exercises.filter(e => e.completed).length;
      const setsLogged = wLog.exercises.reduce((s, e) => s + e.sets.length, 0);
      return `
        <div class="resume-card ${wTone}" onclick="FORGE.resumeWorkout()">
          <div>
            <div class="resume-label">Workout in progress</div>
            <div class="resume-name">${wDay ? wDay.name : wLog.dayId}</div>
            <div class="resume-detail">${doneEx}/${wLog.exercises.length} exercises · ${setsLogged} sets logged</div>
          </div>
          <div class="resume-btn">RESUME</div>
        </div>
      `;
    }
    return `
      <div class="action-row ${typeClass}">
        <button class="rest-link-btn" onclick="FORGE.logRestToday()" aria-label="Log today as a rest day">
          ✕ Rest
        </button>
        <button class="start-btn" onclick="FORGE.openStartSheet()">
          START WORKOUT <i class="ti ti-arrow-right"></i>
        </button>
      </div>
    `;
  }

  // Jumps back into the active workout exactly where you left off
  // (phase and exercise index live in state, restored on boot if needed)
  function resumeWorkout() {
    if (!state.workoutActive) { renderTab('home'); return; }
    renderWorkoutView();
  }

  function renderCycleBar() {
    return FORGE_DATA.cycleDays.map((d, i) => {
      let cls = d.type;
      if (i < state.cycleIndex) cls += ' past';
      else if (i === state.cycleIndex) cls += ' current';
      else cls += ' future';
      return `<div class="cycle-dot ${cls}"></div>`;
    }).join('');
  }

  function renderCalendar() {
    const today = new Date();
    const year = state.calendarYear;
    const month = state.calendarMonth;
    const monthName = new Date(year, month).toLocaleString('default', { month: 'short', year: 'numeric' });
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const isCurrentMonth = (year === today.getFullYear() && month === today.getMonth());
    const todayDate = today.getDate();
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    // A date can hold several entries (a workout plus a bonus core session, say).
    const byDate = entriesByDate();

    let grid = '<div class="calendar-grid">';
    ['S','M','T','W','T','F','S'].forEach(d => { grid += `<div class="cal-day-header">${d}</div>`; });
    for (let i = 0; i < firstDay; i++) grid += '<div class="cal-day empty"></div>';

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const entries = byDate[dateStr] || [];
      const thisDate = new Date(year, month, d);
      const isToday = isCurrentMonth && d === todayDate;
      const isPast = thisDate < todayMidnight;
      const isFuture = !isPast && !isToday;

      let cls = 'cal-day';
      if (isToday) cls += ' today-ring';
      if (isFuture) cls += ' future';

      let body = `<div class="cal-date">${d}</div>`;

      if (entries.length) {
        // Two codes fit at phone width. Beyond that, show one and a count.
        const shown = entries.length > 2 ? entries.slice(0, 1) : entries;
        const chips = shown.map(c =>
          `<span class="cal-code ${toneOf(c)}">${labelFor(c)}</span>`
        ).join('');
        const more = entries.length > 2 ? `<span class="cal-code more">+${entries.length - 1}</span>` : '';
        body += `<div class="cal-codes">${chips}${more}</div>`;
      } else if (!isPast) {
        // Projected schedule for today and ahead
        const daysAhead = Math.round((thisDate - todayMidnight) / (1000 * 60 * 60 * 24));
        const fd = FORGE_DATA.cycleDays[projectedIndex(daysAhead)];
        body += `<div class="cal-codes"><span class="cal-code ${toneOf(fd)} projected">${codeFor(fd.id)}</span></div>`;
      } else {
        body += `<div class="cal-codes"><span class="cal-code blank">·</span></div>`;
      }

      grid += `<div class="${cls}" onclick="FORGE.openDaySheet('${dateStr}')">${body}</div>`;
    }
    grid += '</div>';

    return `
      <div class="calendar-section">
        <div class="calendar-header">
          <button class="calendar-nav-btn" onclick="FORGE.calendarPrev()" aria-label="Previous month"><i class="ti ti-chevron-left"></i></button>
          <div class="calendar-month">${monthName}</div>
          <button class="calendar-nav-btn" onclick="FORGE.calendarNext()" aria-label="Next month"><i class="ti ti-chevron-right"></i></button>
        </div>
        ${grid}
        <div class="calendar-legend">
          <div><span class="legend-dot" style="background:var(--amber)"></span>Pwr</div>
          <div><span class="legend-dot" style="background:var(--cyan)"></span>Hyp</div>
          <div><span class="legend-dot" style="background:var(--green)"></span>Cal</div>
          <div><span class="legend-dot" style="background:var(--violet)"></span>Core</div>
          <div style="color:var(--gray)">✕ Rest</div>
          <button class="legend-key-btn" onclick="FORGE.openKeySheet()">
            <i class="ti ti-help-circle"></i> Key
          </button>
        </div>
      </div>
    `;
  }

  // Full code key. Lives behind a button rather than on the home screen,
  // because a permanent nine-row legend costs more space than it earns.
  function openKeySheet() {
    const keyRow = d =>
      `<div class="key-row"><span class="cal-code ${toneOf(d)}">${codeFor(d.id)}</span><span>${d.name}</span></div>`;
    const rows = FORGE_DATA.cycleDays.map(keyRow).join('');
    const altRows = Object.values(FORGE_DATA.alternates || {}).map(keyRow).join('');

    document.getElementById('info-panel-content').innerHTML = `
      <div class="info-panel-title">Calendar key</div>

      <div class="sheet-section-label">Cycle</div>
      <div class="key-grid">
        ${rows}
        <div class="key-row"><span class="cal-code rest">\u2715</span><span>Rest day</span></div>
      </div>

      <div class="sheet-section-label">Alternates</div>
      <div class="key-grid">${altRows}</div>

      <div class="sheet-section-label">Size</div>
      <div class="key-grid">
        <div class="key-row"><span class="cal-code pwr">\u2212</span><span>Light \u00b7 ~30 min</span></div>
        <div class="key-row"><span class="cal-code pwr">\u2731</span><span>Normal \u00b7 ~60 min</span></div>
        <div class="key-row"><span class="cal-code pwr">+</span><span>Extended \u00b7 ~90 min</span></div>
      </div>

      <div class="sheet-section-label">Colour</div>
      <div class="key-grid">
        <div class="key-row"><span class="key-swatch" style="background:var(--amber)"></span><span>Power</span></div>
        <div class="key-row"><span class="key-swatch" style="background:var(--cyan)"></span><span>Hypertrophy</span></div>
        <div class="key-row"><span class="key-swatch" style="background:var(--green, #10B981)"></span><span>Calisthenics</span></div>
        <div class="key-row"><span class="key-swatch" style="background:var(--violet, #8B5CF6)"></span><span>Back &amp; Core</span></div>
        <div class="key-row"><span class="key-swatch" style="background:var(--gray)"></span><span>Rest</span></div>
      </div>

      <div class="sheet-note">
        So <strong>B1\u2212</strong> is a light Pull A, and <strong>L2+</strong> is an extended Legs B.
        A day can hold more than one entry; a cell showing <strong>+2</strong> has more than fits.
        Faded codes on future days are the projected schedule, not something you did.
      </div>
    `;
    showPanel('info-panel');
  }

  // ===== CALENDAR DAY SHEET =====
  // Tap any day to record what actually happened. This is the override: the
  // cycle follows the calendar, so correcting a day here corrects what the app
  // serves you next.
  function openDaySheet(dateStr) {
    const todayStr = todayLocal();
    if (dateStr > todayStr) return;   // nothing to record in the future

    state._sheetDate = dateStr;
    const entries = Store.getCompletedDays()
      .filter(c => c.date === dateStr)
      .sort((a, b) => (sortKey(a) < sortKey(b) ? -1 : 1));

    const pretty = new Date(dateStr + 'T12:00:00').toLocaleDateString('default',
      { weekday: 'long', month: 'short', day: 'numeric' });

    const logged = entries.length ? `
      <div class="sheet-section-label">Logged</div>
      ${entries.map(c => {
        const d = dayById(c.dayId);
        const nm = c.type === 'rest' ? 'Rest day' : (d ? d.name : c.dayId);
        const sz = c.type === 'rest' ? '' : ` · ${c.size || 'normal'}`;
        return `
          <div class="sheet-row">
            <div>
              <div class="sheet-row-name">${nm}</div>
              <div class="sheet-row-detail">${labelFor(c)}${sz}${c.manual ? ' · added manually' : ''}</div>
            </div>
            <button class="sheet-del" onclick="FORGE.clearDayEntry('${entryUid(c).replace(/'/g, "\\'")}')">
              <i class="ti ti-trash"></i>
            </button>
          </div>`;
      }).join('')}
    ` : '<div class="sheet-empty">Nothing logged this day.</div>';

    const allDays = FORGE_DATA.cycleDays.concat(Object.values(FORGE_DATA.alternates || {}));
    const options = allDays.map(d => `
      <button class="sheet-add ${toneOf(d)}"
              onclick="FORGE.markDay('${d.id}')">${codeFor(d.id)} ${d.name}</button>
    `).join('');

    document.getElementById('info-panel-content').innerHTML = `
      <div class="info-panel-title">${pretty}</div>
      ${logged}
      <div class="sheet-section-label">Add</div>
      <button class="sheet-add rest" onclick="FORGE.markDay('rest')">\u2715 Rest day</button>
      <div class="sheet-add-grid">${options}</div>
      <div class="sheet-note">Manually added workouts count toward your cycle position. Rest days do not.</div>
    `;
    showPanel('info-panel');
  }

  function closeDaySheet() {
    dismissPanel();
  }

  // Writes the entry. Kept separate from the sheet UI so "Log rest day" on
  // the home screen doesn't have to open and immediately close a panel.
  function addDayEntry(dateStr, dayId) {
    if (!dateStr) return;
    const isRest = dayId === 'rest';
    const d = isRest ? null : dayById(dayId);
    const completed = Store.getCompletedDays();

    // Noon on the chosen date keeps ordering sane against same-day workouts
    const stamp = new Date(dateStr + 'T12:00:00').toISOString();

    // An alternate that does not advance (Back & Core) is logged as a bonus.
    // Anything on the cycle takes its own slot.
    let slot = null;
    if (!isRest) {
      const onCycle = FORGE_DATA.cycleDays.some(c => c.id === dayId);
      slot = onCycle ? dayId : (d && d.advancesByDefault !== false ? nextDay().id : null);
    }
    completed.push({
      date: dateStr,
      type: isRest ? 'rest' : d.type,
      dayId: isRest ? 'rest' : dayId,
      size: 'normal',
      completedAt: stamp,
      manual: true,
      slotId: slot
    });
    completed.sort((a, b) => (sortKey(a) < sortKey(b) ? -1 : 1));
    Store.set('completedDays', completed);

    refreshCycle();
    state._calendarNavActive = true;
  }

  function markDay(dayId) {
    const dateStr = state._sheetDate;
    if (!dateStr) return;
    addDayEntry(dateStr, dayId);
    openDaySheet(dateStr);
    refreshView();
  }

  // Re-render whichever tab is showing. The day sheet opens from both Home
  // (week strip) and Tracker (calendar), so edits must refresh the right one.
  function refreshView() {
    renderTab(state.currentTab || 'home');
  }

  function clearDayEntry(uid) {
    const completed = Store.getCompletedDays();
    const target = completed.find(c => entryUid(c) === uid);
    if (!target) return;

    // A logged workout also owns rows in forge_logs. Drop those too, or the
    // next launch rebuilds the entry straight back onto the calendar.
    if (!target.manual && target.dayId && target.dayId !== 'rest') {
      const logs = Store.getLogs();
      if (logs[target.dayId]) {
        logs[target.dayId] = logs[target.dayId].filter(l => l.completedAt !== target.completedAt);
        if (!logs[target.dayId].length) delete logs[target.dayId];
        Store.saveLogs(logs);
      }
    }

    Store.set('completedDays', completed.filter(c => entryUid(c) !== uid));
    refreshCycle();
    state._calendarNavActive = true;
    openDaySheet(state._sheetDate);
    refreshView();
  }

  function logRestToday() {
    addDayEntry(todayLocal(), 'rest');
    renderHome(document.getElementById('main-content'));
  }

  function calendarPrev() {
    state.calendarMonth--;
    if (state.calendarMonth < 0) { state.calendarMonth = 11; state.calendarYear--; }
    state._calendarNavActive = true;
    renderTab('tracker');
  }

  function calendarNext() {
    state.calendarMonth++;
    if (state.calendarMonth > 11) { state.calendarMonth = 0; state.calendarYear++; }
    state._calendarNavActive = true;
    renderTab('tracker');
  }

  // ===== WORKOUT FLOW =====
  // START opens this sheet instead of starting cold. The size on Home is
  // remembered from last time, so an untouched default is exactly how a
  // session starts at the wrong size. The confirm button names the size,
  // so even a tap-through reads it.
  function openStartSheet() {
    const day = selectedDay();
    const workout = FORGE_DATA.workouts[day.id];
    if (!workout) return;
    const tone = toneClass(day);
    const m = SIZE_META[state.workoutSize];
    document.getElementById('info-panel-content').innerHTML = `
      <div class="info-panel-title">Start ${day.name}?</div>
      <div class="start-sheet-note">Check the size. It locks once you start.</div>
      ${renderSizePicker(workout, tone, 'FORGE.pickStartSize')}
      <button class="save-set-btn start-confirm ${tone}" onclick="FORGE.confirmStart()">
        <span>Start ${m.label} ${m.mark}</span> <i class="ti ti-arrow-right"></i>
      </button>
      <button class="start-cancel" onclick="FORGE.dismissPanel()">Cancel</button>
    `;
    showPanel('info-panel');
  }

  // Changing size inside the sheet saves it like the Home picker does,
  // then redraws the sheet so the button text follows.
  function pickStartSize(size) {
    setWorkoutSize(size);
    openStartSheet();
  }

  function confirmStart() {
    dismissPanel();
    startWorkout();
  }

  function startWorkout() {
    const day = selectedDay();
    const scheduled = nextDay();
    const advances = selectedAdvances();
    const workout = FORGE_DATA.workouts[day.id];
    if (!workout) return;

    state.workoutActive = true;
    state.workoutPhase = 'overview';
    state.currentExerciseIndex = 0;
    state.currentSetIndex = 0;
    state.skippedExercises = [];
    state.workoutStartTime = Date.now(); // start the duration clock
    const plan = exercisesFor(workout, state.workoutSize);
    state.activeWorkoutLog = {
      dayId: day.id,
      slotId: advances ? scheduled.id : null,   // cycle slot this counts as; null = bonus
      size: state.workoutSize,   // locked in here; the calendar code reads it
      date: new Date().toISOString(),
      exercises: plan.map(ex => ({
        id: ex.id,
        name: ex.name,
        sets: [],
        completed: false
      }))
    };
    renderWorkoutView();
    persistWorkoutState();
  }

  function renderWorkoutView() {
    const main = document.getElementById('main-content');
    setAppTone(toneClass(activeDay()));
    switch(state.workoutPhase) {
      case 'overview': renderWorkoutOverview(main); break;
      case 'warmup': renderWarmup(main); break;
      case 'exercise': renderExercise(main); break;
      case 'complete': renderComplete(main); break;
    }
  }

  function renderWorkoutOverview(el) {
    const day = activeDay();
    const workout = FORGE_DATA.workouts[day.id];
    const typeClass = toneClass(day);

    let items = `
      <div class="wo-item" onclick="FORGE.goToWarmup()">
        <div class="wo-num warmup"><i class="ti ti-flame" style="font-size:14px"></i></div>
        <div class="wo-item-info">
          <div class="wo-item-name">Warm-Up</div>
          <div class="wo-item-detail">${workout.warmup.duration} · Dynamic stretches</div>
        </div>
        <div class="wo-item-status"><i class="ti ti-chevron-right"></i></div>
      </div>
    `;

    activeExercises().forEach((ex, i) => {
      const log = state.activeWorkoutLog.exercises[i];
      const done = log.completed;
      const skipped = state.skippedExercises.includes(i);
      let numCls = done ? 'wo-num done' : 'wo-num';
      let itemCls = done ? 'wo-item completed' : skipped ? 'wo-item skipped' : 'wo-item';

      items += `
        <div class="${itemCls}" onclick="FORGE.goToExercise(${i})">
          <div class="${numCls}">${done ? '<i class="ti ti-check" style="font-size:14px"></i>' : String(i + 1).padStart(2, '0')}</div>
          <div class="wo-item-info">
            <div class="wo-item-name">${ex.name}${ex.isFinisher ? `<span class="finisher-tag">Finisher</span>` : ex.isPrimer ? `<span class="primer-tag">Primer</span>` : ''}</div>
            <div class="wo-item-detail">${ex.sets} × ${shortReps(ex.reps)} · rest ${shortRest(ex.restLabel)}</div>
          </div>
          <div class="wo-item-status"><i class="ti ti-chevron-right"></i></div>
        </div>
      `;
    });

    const allDone = state.activeWorkoutLog.exercises.every(e => e.completed);

    el.innerHTML = `
      <div class="ov-head ${typeClass}">
        <div>
          <div class="exercise-day-label">${day.name} · ${day.label}</div>
          <div class="ov-goal">${workout.goal}</div>
        </div>
        <button class="skip-btn" onclick="FORGE.endWorkout()">End</button>
      </div>
      <div class="workout-overview-list ${typeClass}">${items}</div>
      ${allDone ? `<button class="save-set-btn ${typeClass}" onclick="FORGE.completeWorkout()">Complete workout <i class="ti ti-check"></i></button>` : ''}
    `;
  }

  function renderWarmup(el) {
    const day = activeDay();
    const workout = FORGE_DATA.workouts[day.id];
    const typeClass = toneClass(day);

    el.innerHTML = `
      <div class="exercise-header ${typeClass}">
        <button class="back-btn" onclick="FORGE.backToOverview()" aria-label="Back to overview"><i class="ti ti-chevron-left"></i></button>
        <div class="exercise-header-mid">
          <div class="exercise-day-label">${day.name} · ${day.label}</div>
          <div class="exercise-position">Warm-up</div>
        </div>
        <span style="width:44px"></span>
      </div>
      <div class="warmup-card ${typeClass}">
        <div class="warmup-title">${workout.warmup.name}</div>
        <div class="warmup-duration">${workout.warmup.duration}</div>
        ${workout.warmup.movements.map(m => `<div class="warmup-movement">${m}</div>`).join('')}
      </div>
      <button class="warmup-done-btn ${typeClass}" onclick="FORGE.warmupDone()">
        Warm-up complete <i class="ti ti-arrow-right"></i>
      </button>
    `;
  }

  // Converts a stored set back into the number you actually typed.
  // BW+/BW- sets store TOTAL load (bodyweight +/- the added amount), but the
  // input box expects only the added amount. Without this, set 2 prefills with
  // the total and the number snowballs on every set after it.
  function enteredOf(set, ex) {
    if (!set || set.weight === undefined || set.weight === null) return '';
    if (typeof set.entered === 'number') return set.entered;
    if (ex.weightMode === 'bw-plus') return Math.max(0, set.weight - state.bodyWeight);
    if (ex.weightMode === 'bw-minus') return Math.max(0, state.bodyWeight - set.weight);
    return set.weight;
  }

  function renderExercise(el) {
    const day = activeDay();
    const workout = FORGE_DATA.workouts[day.id];
    const plan = activeExercises();
    const ex = plan[state.currentExerciseIndex];
    const log = state.activeWorkoutLog.exercises[state.currentExerciseIndex];
    const typeClass = toneClass(day);
    const totalExercises = plan.length;

    // Get previous data for this exercise
    const prevData = getPreviousExerciseData(ex.id, day.id);
    const prData = getPR(ex.id);
    const trendData = getTrend(ex.id, day.id);

    // Determine number of sets (for 'to failure' exercises, use the defined sets count)
    const numSets = ex.sets;
    const currentSet = state.currentSetIndex;

    // Build set indicators
    let setIndicators = '';
    for (let s = 0; s < numSets; s++) {
      const loggedSet = log.sets[s];
      let cls = 'set-indicator';
      if (loggedSet) cls += ' done';
      else if (s === currentSet) cls += ' current';
      else cls += ' upcoming';

      const isEditing = state.editingSetIndex === s;
      setIndicators += `
        <div class="${cls}${isEditing ? ' editing' : ''}" ${loggedSet ? `onclick="FORGE.editSet(${s})" style="cursor:pointer;"` : ''}>
          <div class="si-label">${loggedSet ? (isEditing ? `Set ${s+1} ✎` : `Set ${s+1} ✓`) : s === currentSet ? `Set ${s+1} · now` : `Set ${s+1}`}</div>
          <div class="si-data">${loggedSet ? `${loggedSet.display}` : '—'}</div>
        </div>
      `;
    }

    // Progress ticks, one per exercise in today's plan
    const ticks = plan.map((p, i) => {
      const done = state.activeWorkoutLog.exercises[i] && state.activeWorkoutLog.exercises[i].completed;
      return `<span class="${done ? 'done' : i === state.currentExerciseIndex ? 'current' : ''}"></span>`;
    }).join('');

    // Weight input based on mode
    const isBW = ex.weightMode === 'bw';
    const isBWPlus = ex.weightMode === 'bw-plus';
    const isBWMinus = ex.weightMode === 'bw-minus';
    const hasBWModes = isBW || isBWPlus || isBWMinus;
    const editingSet = state.editingSetIndex !== null ? log.sets[state.editingSetIndex] : null;
    const lastWeight = editingSet
      ? enteredOf(editingSet, ex)
      : (log.sets.length > 0
          ? enteredOf(log.sets[log.sets.length - 1], ex)
          : (prevData ? enteredOf({ weight: prevData.weight }, ex) : ''));
    const unit = state.weightUnit === 'kg' ? 'kg' : 'lb';
    const loadLabel = isBWPlus ? `Added · ${unit}` : isBWMinus ? `Assist · ${unit}` : `Load · ${unit}`;

    // Build rep options (or seconds for time-tracked exercises)
    const isTimeMode = ex.trackMode === 'time';
    const repsValue = isTimeMode ? 0 : (editingSet ? (parseInt(editingSet.reps) || 0) : (log.sets.length > 0 ? (parseInt(log.sets[log.sets.length - 1].reps) || getDefaultReps(ex.reps)) : getDefaultReps(ex.reps)));
    const lastSeconds = isTimeMode ? (editingSet ? editingSet.reps : (log.sets.length > 0 ? log.sets[log.sets.length - 1].reps : 30)) : 0;
    const allSetsDone = currentSet >= numSets;

    const trendCell = (t) => `
        <div class="stat-card">
          <div class="stat-label">Trend</div>
          <div class="stat-value ${t ? (t.direction === 'up' ? 'trend-up' : t.direction === 'down' ? 'trend-down' : '') : ''}">
            ${t ? `${t.direction === 'up' ? '↑' : t.direction === 'down' ? '↓' : '→'} ${t.percent}` : '—'}
          </div>
          <div class="stat-detail">${t ? t.detail : 'Need 3+ sessions'}</div>
        </div>`;

    const nextIdx = state.currentExerciseIndex + 1;
    const nextEx = nextIdx < plan.length ? plan[nextIdx] : null;
    const running = state.timerRunning;
    const restPct = running && state.timerTotal ? Math.round(100 * state.timerRemaining / state.timerTotal) : 0;

    el.innerHTML = `
      <div class="${typeClass}">
        <div class="exercise-header">
          <button class="back-btn" onclick="FORGE.backToOverview()" aria-label="Back to overview"><i class="ti ti-chevron-left"></i></button>
          <div class="exercise-header-mid">
            <div class="exercise-day-label">${day.name} · ${day.label}</div>
            <div class="exercise-position">Exercise ${state.currentExerciseIndex + 1} of ${totalExercises}</div>
          </div>
          <button class="skip-btn" onclick="FORGE.skipExercise()">Skip <i class="ti ti-arrow-right"></i></button>
        </div>
        <div class="ex-progress">${ticks}</div>
      </div>

      <div class="${typeClass}">
        <h1 class="exercise-name">${ex.name}</h1>
        <div class="exercise-params">${ex.sets} sets · ${ex.reps} reps${ex.rpe !== '-' ? ` · RPE ${ex.rpe}` : ''} · Rest ${ex.restLabel}</div>
      </div>

      <div class="exercise-actions">
        <button class="action-btn" onclick="FORGE.showInfo()">
          <i class="ti ti-info-circle"></i> Tips
        </button>
        <button class="action-btn" onclick="window.open('${ex.video}', '_blank')">
          <i class="ti ti-player-play"></i> Demo
        </button>
        ${!isBW && !isTimeMode ? `
        <button class="action-btn" onclick="FORGE.openPlateCalc()">
          <i class="ti ti-barbell"></i> Plates
        </button>` : ''}
      </div>

      <div class="stats-row ${typeClass}">
        ${isTimeMode ? `
        <div class="stat-card">
          <div class="stat-label">Last time</div>
          <div class="stat-value">${(() => { const td = getTimePreviousData(ex.id, day.id); return td ? td.display : '—'; })()}</div>
          <div class="stat-detail">${(() => { const td = getTimePreviousData(ex.id, day.id); return td ? td.detail : 'No data'; })()}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Best time</div>
          <div class="stat-value pr">${(() => { const tp = getTimePR(ex.id); return tp ? tp.display : '—'; })()}</div>
          <div class="stat-detail">${(() => { const tp = getTimePR(ex.id); return tp ? tp.detail : 'No data'; })()}</div>
        </div>
        ${trendCell(getTimeTrend(ex.id, day.id))}
        ` : `
        <div class="stat-card">
          <div class="stat-label">Last time</div>
          <div class="stat-value">${prevData ? prevData.weight + ' ' + unit : '—'}</div>
          <div class="stat-detail">${prevData ? prevData.detail : 'No data'}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Best set</div>
          <div class="stat-value pr">${prData ? prData.display : '—'}</div>
          <div class="stat-detail">${prData ? prData.detail : 'No data'}</div>
        </div>
        ${trendCell(trendData)}
        `}
      </div>

      ${allSetsDone && state.editingSetIndex === null ? `
        <div class="set-indicators ${typeClass}">${setIndicators}</div>
        <button class="save-set-btn ${typeClass}" onclick="FORGE.finishExercise()">
          ${state.currentExerciseIndex < totalExercises - 1 ? 'Next exercise' : 'Finish last exercise'} <i class="ti ti-arrow-right"></i>
        </button>
      ` : `
        ${hasBWModes ? `
          <div class="bw-toggle ${typeClass}" id="bw-toggle">
            <button class="bw-btn ${isBW ? 'active' : ''}" onclick="FORGE.setBWMode('bw')">BW</button>
            <button class="bw-btn ${isBWPlus ? 'active' : ''}" onclick="FORGE.setBWMode('bw-plus')">BW+</button>
            <button class="bw-btn ${isBWMinus ? 'active' : ''}" onclick="FORGE.setBWMode('bw-minus')">BW−</button>
            <button class="bw-btn ${!hasBWModes ? 'active' : ''}" onclick="FORGE.setBWMode('free')">Free</button>
          </div>
        ` : ''}

        <div class="load-block ${typeClass}">
          ${isTimeMode ? `
            <div class="stopwatch-widget ${state.stopwatchRunning ? 'running' : ''}" onclick="FORGE.toggleStopwatch()" id="stopwatch-widget" role="button" aria-label="Start or stop the stopwatch">
              <i class="ti ti-${state.stopwatchRunning ? 'player-stop' : 'player-play'} stopwatch-icon"></i>
              <span class="stopwatch-time" id="stopwatch-display">${state.stopwatchRunning ? formatTime(state.stopwatchElapsed) : 'Tap to time'}</span>
            </div>
            <div class="reps-row">
              <button class="reps-adj" onclick="FORGE.adjSeconds(-5)" aria-label="Minus 5 seconds">−5</button>
              <label class="load-label" for="seconds-input">Seconds</label>
              <input type="number" class="reps-input" id="seconds-input" value="${lastSeconds}" inputmode="numeric" enterkeyhint="done" placeholder="0">
              <button class="reps-adj" onclick="FORGE.adjSeconds(5)" aria-label="Plus 5 seconds">+5</button>
            </div>
          ` : `
            <div class="load-row">
              ${isBW ? `
                <span style="width:56px"></span>
                <div class="load-center"><span class="load-label">Bodyweight</span><span class="load-bw">BW</span></div>
                <span style="width:56px"></span>
              ` : `
                <button class="load-adj" onclick="FORGE.adjWeight(-5)" aria-label="Minus 5">−5</button>
                <div class="load-center">
                  <label class="load-label" for="weight-input">${loadLabel}</label>
                  <input type="number" class="load-input" id="weight-input" value="${lastWeight}" inputmode="numeric" enterkeyhint="done" placeholder="0">
                </div>
                <button class="load-adj" onclick="FORGE.adjWeight(5)" aria-label="Plus 5">+5</button>
              `}
            </div>
            <div class="reps-row">
              <button class="reps-adj" onclick="FORGE.adjReps(-1)" aria-label="Minus 1 rep">−1</button>
              <label class="load-label" for="reps-input">Reps</label>
              <input type="number" class="reps-input" id="reps-input" value="${repsValue}" inputmode="numeric" enterkeyhint="done" placeholder="0">
              <button class="reps-adj" onclick="FORGE.adjReps(1)" aria-label="Plus 1 rep">+1</button>
            </div>
          `}
        </div>

        <div class="set-indicators ${typeClass}">${setIndicators}</div>

        <div class="rest-timer ${running ? 'active' : ''} ${typeClass}" id="rest-timer">
          <div class="rest-timer-top">
            <span class="rest-timer-label" id="timer-label">${running ? 'Resting' : 'Rest'}</span>
            <span class="rest-timer-display" id="timer-display">${formatTime(running ? state.timerRemaining : ex.rest)}</span>
            <span class="rest-spacer"></span>
            <button class="rest-extend" id="timer-extend" onclick="FORGE.extendTimer(15)" ${running ? '' : 'hidden'}>+15s</button>
            <button class="rest-timer-badge" id="timer-badge" data-label="Start ${ex.restLabel}" onclick="FORGE.toggleTimer(${ex.rest})">${running ? 'Stop' : 'Start ' + ex.restLabel}</button>
          </div>
          <div class="rest-bar"><div class="rest-bar-fill" id="timer-bar" style="width:${restPct}%"></div></div>
        </div>

        ${nextEx && state.editingSetIndex === null ? `
          <div class="up-next-preview">
            <span class="up-next-label">Up next ›</span>
            <span class="up-next-name">${nextEx.name}${nextEx.isFinisher ? ' 🔥' : ''}</span>
            <span class="up-next-detail">${nextEx.sets}×${shortReps(nextEx.reps)} · ${shortRest(nextEx.restLabel)}</span>
          </div>
        ` : ''}

        <button class="save-set-btn ${typeClass}" onclick="${state.editingSetIndex !== null ? 'FORGE.updateSet()' : 'FORGE.saveSet()'}">
          ${state.editingSetIndex !== null ? 'Update set' : 'Save set'}
          <span class="save-sub">${state.editingSetIndex !== null ? `SET ${state.editingSetIndex + 1}` : `${currentSet + 1} / ${numSets}`}</span>
        </button>
        ${state.editingSetIndex !== null ? `<button class="skip-btn cancel-edit-btn" onclick="FORGE.cancelEdit()">Cancel edit</button>` : ''}
      `}
    `;
  }

  // ===== SET LOGGING =====
  function saveSet() {
    const day = activeDay();
    const workout = FORGE_DATA.workouts[day.id];
    const ex = activeExercises()[state.currentExerciseIndex];
    const log = state.activeWorkoutLog.exercises[state.currentExerciseIndex];
    const isBW = ex.weightMode === 'bw';

   let weight, reps, display, entered = null;

    if (ex.trackMode === 'time') {
      weight = state.bodyWeight;
      const seconds = parseInt(document.getElementById('seconds-input').value) || 0;
      reps = String(seconds);
      display = `BW · ${seconds}s`;
    } else if (isBW) {
      weight = state.bodyWeight;
      reps = document.getElementById('reps-input').value;
      display = `BW × ${reps}`;
    } else {
      entered = parseFloat(document.getElementById('weight-input').value) || 0;
      reps = document.getElementById('reps-input').value;
      weight = entered;

      if (ex.weightMode === 'bw-plus') {
        display = `BW+${entered} × ${reps}`;
        weight = state.bodyWeight + entered;
      } else if (ex.weightMode === 'bw-minus') {
        display = `BW-${entered} × ${reps}`;
        weight = Math.max(0, state.bodyWeight - entered);
      } else {
        display = `${entered} × ${reps}`;
      }
    }

    const repsNum = reps === 'F' ? 0 : parseInt(reps) || 0;

    log.sets.push({
      weight: weight,
      entered: entered,
      reps: repsNum,
      repsDisplay: reps,
      display: display,
      timestamp: Date.now()
    });

    state.currentSetIndex++;
    stopTimer();
    stopStopwatch();

    // Auto-start rest timer after saving a set (if not the last set)
    if (state.currentSetIndex < ex.sets) {
      startTimer(ex.rest);
    }

    // Check for PR
    if (ex.trackMode === 'time') {
      const seconds = parseInt(reps) || 0;
      if (seconds > 0) {
        const isPR = checkAndUpdateTimePR(ex.id, ex.name, seconds);
        if (isPR) showPRCelebration(ex, isPR);
      }
    } else if (repsNum > 0 && (weight > 0 || ex.weightMode === 'bw')) {
      const isPR = checkAndUpdatePR(ex.id, ex.name, weight, repsNum, entered, ex);
      if (isPR) showPRCelebration(ex, isPR);
    }

    renderExercise(document.getElementById('main-content'));
    persistWorkoutState();
  }

  function editSet(setIndex) {
    const log = state.activeWorkoutLog.exercises[state.currentExerciseIndex];
    if (!log.sets[setIndex]) return;
    state.editingSetIndex = setIndex;
    renderExercise(document.getElementById('main-content'));
  }

  function updateSet() {
    const day = activeDay();
    const workout = FORGE_DATA.workouts[day.id];
    const ex = activeExercises()[state.currentExerciseIndex];
    const log = state.activeWorkoutLog.exercises[state.currentExerciseIndex];
    const idx = state.editingSetIndex;
    const isBW = ex.weightMode === 'bw';

    let weight, reps, display, entered = null;

    if (ex.trackMode === 'time') {
      weight = state.bodyWeight;
      const seconds = parseInt(document.getElementById('seconds-input').value) || 0;
      reps = String(seconds);
      display = `BW · ${seconds}s`;
    } else if (isBW) {
      weight = state.bodyWeight;
      reps = document.getElementById('reps-input').value;
      display = `BW × ${reps}`;
    } else {
      entered = parseFloat(document.getElementById('weight-input').value) || 0;
      reps = document.getElementById('reps-input').value;
      weight = entered;
      if (ex.weightMode === 'bw-plus') {
        display = `BW+${entered} × ${reps}`;
        weight = state.bodyWeight + entered;
      } else if (ex.weightMode === 'bw-minus') {
        display = `BW-${entered} × ${reps}`;
        weight = Math.max(0, state.bodyWeight - entered);
      } else {
        display = `${entered} × ${reps}`;
      }
    }

    const repsNum = reps === 'F' ? 0 : parseInt(reps) || 0;

    log.sets[idx] = {
      weight: weight,
      entered: entered,
      reps: repsNum,
      repsDisplay: reps,
      display: display,
      timestamp: Date.now()
    };

    if (ex.trackMode === 'time') {
      const seconds = parseInt(reps) || 0;
      if (seconds > 0) {
        const isPR = checkAndUpdateTimePR(ex.id, ex.name, seconds);
        if (isPR) showPRCelebration(ex, isPR);
      }
    } else if (repsNum > 0 && (weight > 0 || ex.weightMode === 'bw')) {
      const isPR = checkAndUpdatePR(ex.id, ex.name, weight, repsNum, entered, ex);
      if (isPR) showPRCelebration(ex, isPR);
    }

    state.editingSetIndex = null;
    renderExercise(document.getElementById('main-content'));
    persistWorkoutState(); // without this, an edited set reverts if the tab is killed
  }

  function cancelEdit() {
    state.editingSetIndex = null;
    renderExercise(document.getElementById('main-content'));
  }
  
  function finishExercise() {
    const log = state.activeWorkoutLog.exercises[state.currentExerciseIndex];
    log.completed = true;
    stopTimer();
    state.editingSetIndex = null;

    // Move to next incomplete exercise or back to overview
    const nextIndex = findNextExercise();
    if (nextIndex !== -1) {
      state.currentExerciseIndex = nextIndex;
      state.currentSetIndex = 0;
      renderExercise(document.getElementById('main-content'));
    } else {
      state.workoutPhase = 'overview';
      renderWorkoutView();
    }
    persistWorkoutState();
  }

  function findNextExercise() {
    const exercises = state.activeWorkoutLog.exercises;
    // First check sequential
    for (let i = state.currentExerciseIndex + 1; i < exercises.length; i++) {
      if (!exercises[i].completed) return i;
    }
    // Then check skipped
    for (let i = 0; i < exercises.length; i++) {
      if (!exercises[i].completed) return i;
    }
    return -1;
  }

  function skipExercise() {
    if (!state.skippedExercises.includes(state.currentExerciseIndex)) {
      state.skippedExercises.push(state.currentExerciseIndex);
    }
    stopTimer();
    const nextIndex = findNextExercise();
    if (nextIndex !== -1 && nextIndex !== state.currentExerciseIndex) {
      state.currentExerciseIndex = nextIndex;
      state.currentSetIndex = 0;
      state.workoutPhase = 'exercise';
      renderWorkoutView();
    } else {
      state.workoutPhase = 'overview';
      renderWorkoutView();
    }
    persistWorkoutState();
  }

  function goToExercise(index) {
    state.currentExerciseIndex = index;
    state.currentSetIndex = state.activeWorkoutLog.exercises[index].sets.length;
    state.workoutPhase = 'exercise';
    renderWorkoutView();
    persistWorkoutState();
  }

  function goToWarmup() {
    state.workoutPhase = 'warmup';
    renderWorkoutView();
    persistWorkoutState();
  }

  function warmupDone() {
    state.workoutPhase = 'exercise';
    state.currentExerciseIndex = 0;
    state.currentSetIndex = 0;
    renderWorkoutView();
    persistWorkoutState();
  }

  function backToOverview() {
    stopTimer();
    stopStopwatch();
    state.editingSetIndex = null;
    state.workoutPhase = 'overview';
    renderWorkoutView();
    persistWorkoutState();
  }

  function completeWorkout() {
    state.workoutPhase = 'complete';
    saveWorkoutToStorage();
    refreshCycle();
    renderWorkoutView();
  }

  function endWorkout() {
    if (confirm('End workout? Logged sets will be saved.')) {
      if (state.activeWorkoutLog.exercises.some(e => e.sets.length > 0)) {
        saveWorkoutToStorage();
      }
      resetWorkoutState();
      renderTab('home');
    }
  }

  function renderComplete(el) {
    const day = dayById(state.activeWorkoutLog.dayId) || nextDay();
    const typeClass = toneClass(day);
    const totalSets = state.activeWorkoutLog.exercises.reduce((sum, e) => sum + e.sets.length, 0);
    const totalReps = state.activeWorkoutLog.exercises.reduce((sum, e) =>
      sum + e.sets.reduce((s, set) => s + (set.reps || 0), 0), 0);
    const durationMs = state.workoutStartTime ? Date.now() - state.workoutStartTime : 0;
    const durationMin = Math.round(durationMs / 60000);

    el.innerHTML = `
      <div class="complete-screen ${typeClass}">
        <div class="complete-icon"><i class="ti ti-check"></i></div>
        <div class="complete-title">Forged</div>
        <div class="complete-detail">${day.name} · ${day.label} complete</div>
        <div class="complete-stats">
          <div><span class="cs-v">${durationMin > 0 ? durationMin : '—'}</span><span class="cs-l">Minutes</span></div>
          <div><span class="cs-v">${totalSets}</span><span class="cs-l">Sets</span></div>
          <div><span class="cs-v">${totalReps}</span><span class="cs-l">Reps</span></div>
        </div>
        <button class="complete-btn" onclick="FORGE.finishAndGoHome()">Done <i class="ti ti-check"></i></button>
      </div>
    `;
  }

  function finishAndGoHome() {
    resetWorkoutState();
    renderTab('home');
  }

  function resetWorkoutState() {
    state.pickedDayId = null;      // the swap applies to one session, not forever
    state.countsAsSlot = null;
    state.workoutActive = false;
    state.workoutPhase = 'overview';
    state.currentExerciseIndex = 0;
    state.currentSetIndex = 0;
    state.skippedExercises = [];
    state.activeWorkoutLog = null;
    state.workoutStartTime = null;
    stopTimer();
    stopStopwatch();
    persistWorkoutState();
  }

  // ===== STORAGE & SYNC =====
  function saveWorkoutToStorage() {
    const logs = Store.getLogs();
    const dateKey = todayLocal();
    const durationMs = state.workoutStartTime ? Date.now() - state.workoutStartTime : 0;
    const durationMin = Math.round(durationMs / 60000);
    const completedAt = new Date().toISOString();
    const logEntry = {
      ...state.activeWorkoutLog,
      completedAt: completedAt,
      durationMin: durationMin
    };

    if (!logs[state.activeWorkoutLog.dayId]) logs[state.activeWorkoutLog.dayId] = [];
    logs[state.activeWorkoutLog.dayId].push(logEntry);
    Store.saveLogs(logs);

    // Save completed day for calendar. Keyed by timestamp, not date, so a
    // second session the same day sits alongside the first instead of over it.
    const completed = Store.getCompletedDays();
    const day = dayById(state.activeWorkoutLog.dayId) || nextDay();
    completed.push({
      date: dateKey,
      type: day.type,
      dayId: day.id,
      size: state.activeWorkoutLog.size || 'normal',
      completedAt: completedAt,
      slotId: state.activeWorkoutLog.slotId !== undefined ? state.activeWorkoutLog.slotId : day.id
    });
    completed.sort((a, b) => (sortKey(a) < sortKey(b) ? -1 : 1));
    Store.set('completedDays', completed);

    // Sync to Google Sheets
    syncToSheets(logEntry);
    backupToSheets();
  }

  function syncToSheets(logEntry) {
    if (!state.sheetsUrl || Sandbox.on) return;
    try {
     const rows = [];
      logEntry.exercises.forEach(ex => {
        ex.sets.forEach((set, i) => {
          rows.push({
            date: logEntry.completedAt,
            day: logEntry.dayId,
            exercise: ex.name,
            set: i + 1,
            weight: set.weight,
            reps: set.reps,
            display: set.display,
            durationMin: logEntry.durationMin || 0
          });
        });
      });
      fetch(state.sheetsUrl, {
        method: 'POST',
        body: JSON.stringify({ rows })
      }).catch(e => console.error('Sheets sync failed:', e));
    } catch(e) {}
  }

  function backupToSheets() {
    if (!state.sheetsUrl || Sandbox.on) return;
    try {
      var backup = {
        logs: Store.getLogs(),
        prs: Store.getPRs(),
        settings: Store.getSettings(),
        completedDays: Store.getCompletedDays()
      };
      fetch(state.sheetsUrl, {
        method: 'POST',
        body: JSON.stringify({ backup: backup })
      }).catch(function(e) { console.error('Backup failed:', e); });
    } catch(e) {}
  }

  // ===== PR TRACKING =====
  // ===== PERSONAL RECORDS =====
  // The record is the heaviest set you actually performed. e1RM rides along as
  // a secondary number, and only where the formula holds. Epley is reliable to
  // about 10 reps; past 12 it inflates badly enough that a high-rep accessory
  // set could outrank a heavy single, so above that we do not print it.
  const E1RM_REP_LIMIT = 12;

  function e1rmOf(weight, reps) {
    if (!weight || !reps || reps > E1RM_REP_LIMIT) return null;
    return FORGE_DATA.calculateE1RM(weight, reps);
  }

  // Bodyweight exercises have no external load, so ranking them by weight
  // produced a phantom "252 lb" pike push-up. They are scored on reps instead.
  function prModeOf(ex) {
    if (!ex) return 'weight';
    if (ex.trackMode === 'time') return 'time';
    if (ex.weightMode === 'bw') return 'reps';
    return 'weight';
  }

  // One-time reshape of records written by the old scheme, using the exercise
  // definitions to spot the bodyweight ones whose stored weight was never real.
  function migratePRs() {
    const prs = Store.getPRs();
    const byId = {};
    Object.keys(FORGE_DATA.workouts).forEach(wid => {
      (FORGE_DATA.workouts[wid].exercises || []).forEach(ex => { byId[ex.id] = ex; });
    });

    let changed = false;
    Object.keys(prs).forEach(id => {
      const pr = prs[id];
      if (pr.prVersion >= 2) return;
      const mode = pr.isTime ? 'time' : prModeOf(byId[id]);
      const next = { name: pr.name, mode: mode, date: pr.date, prVersion: 2 };

      if (mode === 'time') {
        next.bestTime = pr.bestTime || 0;
        next.isTime = true;
      } else if (mode === 'reps') {
        // The old weight field was bodyweight, not load. Only the reps survive.
        next.bestReps = pr.reps || 0;
      } else {
        const ex = byId[id];
        next.weight = pr.weight || 0;
        next.reps = pr.reps || 0;
        next.weightMode = ex ? ex.weightMode : 'free';
        // Old records stored total load with no memory of what was typed.
        // Recover it so weighted dips read BW+25, not 205.
        if (next.weightMode === 'bw-plus') {
          next.entered = Math.max(0, next.weight - state.bodyWeight);
        } else if (next.weightMode === 'bw-minus') {
          next.entered = Math.max(0, state.bodyWeight - next.weight);
        } else {
          next.entered = next.weight;
        }
        next.e1rm = e1rmOf(next.weight, next.reps);
      }
      prs[id] = next;
      changed = true;
    });
    if (changed) Store.savePRs(prs);
  }

  // Where a set sits on one bodyweight scale: BW-80 is -80, BW+0 is 0, BW+25
  // is 25. Ranking BW+/BW- moves by total load broke when bodyweight changed:
  // BW-100 at 222 lb (122 total) outranked BW-80 at 185 lb (105 total).
  function addedLoad(rec) {
    if (!rec) return 0;
    if (rec.weightMode === 'bw-plus') return rec.entered || 0;
    if (rec.weightMode === 'bw-minus') return -(rec.entered || 0);
    return rec.weight || 0;
  }

  // The BW+ / BW- toggle used to reset to the data.js default every session.
  // The pick is now saved per exercise and applied everywhere that id appears.
  function applyBwModes() {
    const modes = Store.getSettings().bwModes || {};
    Object.keys(FORGE_DATA.workouts).forEach(wid => {
      (FORGE_DATA.workouts[wid].exercises || []).forEach(ex => {
        if (modes[ex.id]) ex.weightMode = modes[ex.id];
      });
    });
  }

  // Records migrated from v1 never knew a set was assisted, so every assisted
  // pull-up and dip came out as BW+0. Rebuild those records from the logged
  // sets, whose display text ("BW-60 x 5") still says what was typed.
  // Runs once per record: rebuilt and newly set records carry prVersion 3.
  function rebuildBwPRs() {
    const prs = Store.getPRs();
    const logs = Store.getLogs();
    const best = {}, signed = {};
    Object.keys(logs).forEach(dayId => {
      [].concat(logs[dayId] || []).forEach(entry => {
        (entry.exercises || []).forEach(exLog => {
          const cur = prs[exLog.id];
          if (cur && cur.prVersion >= 3) return;
          (exLog.sets || []).forEach(set => {
            const d = String(set.display || '');
            const m = /^BW([+-])(\d+(?:\.\d+)?)\s/.exec(d);
            const plain = /^BW \u00d7/.test(d);
            const reps = parseInt(set.reps) || 0;
            if ((!m && !plain) || reps <= 0) return;
            if (m) signed[exLog.id] = true;
            const rec = {
              name: exLog.name, mode: 'weight',
              weightMode: m && m[1] === '-' ? 'bw-minus' : 'bw-plus',
              entered: m ? parseFloat(m[2]) : 0,
              weight: set.weight || 0, reps: reps,
              date: set.timestamp ? new Date(set.timestamp).toISOString() : entry.date
            };
            const b = best[exLog.id];
            if (!b || addedLoad(rec) > addedLoad(b) ||
                (addedLoad(rec) === addedLoad(b) && reps > b.reps)) best[exLog.id] = rec;
          });
        });
      });
    });
    // Only moves logged with BW+ or BW- at least once. Plain "BW x 8" sets on
    // pike push-ups and the like stay reps records.
    const ids = Object.keys(best).filter(id => signed[id]);
    // Seed the saved toggle from the record, so the first session after this
    // fix opens on BW- instead of BW+ (a missed tap there logs BW+60 as a PR).
    const settings = Store.getSettings();
    settings.bwModes = settings.bwModes || {};
    ids.forEach(id => {
      const r = best[id];
      r.e1rm = e1rmOf(r.weight, r.reps);
      r.prVersion = 3;
      prs[id] = r;
      if (!settings.bwModes[id]) settings.bwModes[id] = r.weightMode;
    });
    if (ids.length) {
      Store.savePRs(prs);
      Store.saveSettings(settings);
      applyBwModes();
    }
  }

  function checkAndUpdatePR(exerciseId, exerciseName, weight, reps, entered, ex) {
    const prs = Store.getPRs();
    const mode = prModeOf(ex);
    const now = new Date().toISOString();

    if (mode === 'reps') {
      const prev = prs[exerciseId];
      const isFirst = !prev || prev.bestReps === undefined;
      if (isFirst || reps > prev.bestReps) {
        prs[exerciseId] = {
          name: exerciseName, mode: 'reps', bestReps: reps,
          date: now, prVersion: 3
        };
        Store.savePRs(prs);
        return isFirst ? false : prev;   // first entry records silently; a beaten record is handed back
      }
      return false;
    }

    const prev = prs[exerciseId];
    const isFirst = !prev || prev.weight === undefined;
    const now_ = addedLoad({ weightMode: ex ? ex.weightMode : 'free', entered: entered, weight: weight });
    const was_ = isFirst ? 0 : addedLoad(prev);
    const beaten = !isFirst && (
      now_ > was_ ||
      (now_ === was_ && reps > prev.reps)
    );

    if (isFirst || beaten) {
      prs[exerciseId] = {
        name: exerciseName, mode: 'weight',
        weight: weight,
        entered: (entered === null || entered === undefined) ? weight : entered,
        weightMode: ex ? ex.weightMode : 'free',
        reps: reps,
        e1rm: e1rmOf(weight, reps),
        date: now, prVersion: 3
      };
      Store.savePRs(prs);
      return isFirst ? false : prev;   // first entry records silently; a beaten record is handed back
    }
    return false;
  }

  // How a record reads on screen. BW+45 x 6 rather than 225 x 6, because the
  // second one says you dipped two plates of external load.
  function prSetDisplay(pr) {
    if (!pr) return '';
    if (pr.mode === 'reps') return `BW \u00d7 ${pr.bestReps}`;
    const shown = (pr.entered !== undefined && pr.entered !== null) ? pr.entered : pr.weight;
    if (pr.weightMode === 'bw-plus') return `BW+${shown} \u00d7 ${pr.reps}`;
    if (pr.weightMode === 'bw-minus') return `BW-${shown} \u00d7 ${pr.reps}`;
    return `${shown} \u00d7 ${pr.reps}`;
  }

  function getPR(exerciseId) {
    const prs = Store.getPRs();
    const pr = prs[exerciseId];
    if (!pr) return null;
    if (pr.mode === 'time' || pr.isTime) return null;
    return {
      display: prSetDisplay(pr),
      e1rm: pr.e1rm || null,
      detail: pr.e1rm ? `e1RM ${pr.e1rm}` : new Date(pr.date).toLocaleDateString()
    };
  }

  function getPreviousExerciseData(exerciseId, dayId) {
    const logs = Store.getLogs();
    if (!logs[dayId] || logs[dayId].length === 0) return null;
    const lastLog = logs[dayId][logs[dayId].length - 1];
    const exLog = lastLog.exercises.find(e => e.id === exerciseId);
    if (!exLog || exLog.sets.length === 0) return null;
    const lastSet = exLog.sets[exLog.sets.length - 1];
    const maxWeight = Math.max(...exLog.sets.map(set => set.weight));
    return {
      weight: maxWeight,
      detail: `${exLog.sets.length}×${lastSet.repsDisplay || lastSet.reps}`
    };
  }

  function getTrend(exerciseId, dayId) {
    const logs = Store.getLogs();
    if (!logs[dayId] || logs[dayId].length < 3) return null;
    const recent = logs[dayId].slice(-3);
    const e1rms = recent.map(log => {
      const exLog = log.exercises.find(e => e.id === exerciseId);
      if (!exLog || exLog.sets.length === 0) return 0;
      const bestSet = exLog.sets.reduce((best, s) => {
        const e1 = FORGE_DATA.calculateE1RM(s.weight, s.reps || 0);
        return e1 > best ? e1 : best;
      }, 0);
      return bestSet;
    }).filter(v => v > 0);

    if (e1rms.length < 2) return null;
    const first = e1rms[0];
    const last = e1rms[e1rms.length - 1];
    const change = ((last - first) / first * 100);
    return {
      direction: change > 1 ? 'up' : change < -1 ? 'down' : 'flat',
      percent: `${Math.abs(Math.round(change))}%`,
      detail: `${e1rms.length} sessions`
    };
  }

  // ===== TIME-BASED EXERCISE HELPERS =====
  function getTimePreviousData(exerciseId, dayId) {
    const logs = Store.getLogs();
    if (!logs[dayId] || logs[dayId].length === 0) return null;
    const lastLog = logs[dayId][logs[dayId].length - 1];
    const exLog = lastLog.exercises.find(e => e.id === exerciseId);
    if (!exLog || exLog.sets.length === 0) return null;
    const bestTime = Math.max(...exLog.sets.map(s => parseInt(s.reps) || 0));
    return {
      display: bestTime + 's',
      detail: `${exLog.sets.length} sets`
    };
  }

  function getTimePR(exerciseId) {
    const prs = Store.getPRs();
    if (!prs[exerciseId]) return null;
    const pr = prs[exerciseId];
    if (pr.bestTime) {
      return { display: pr.bestTime + 's', detail: new Date(pr.date).toLocaleDateString() };
    }
    return null;
  }

  function getTimeTrend(exerciseId, dayId) {
    const logs = Store.getLogs();
    if (!logs[dayId] || logs[dayId].length < 3) return null;
    const recent = logs[dayId].slice(-3);
    const times = recent.map(log => {
      const exLog = log.exercises.find(e => e.id === exerciseId);
      if (!exLog || exLog.sets.length === 0) return 0;
      return Math.max(...exLog.sets.map(s => parseInt(s.reps) || 0));
    }).filter(v => v > 0);

    if (times.length < 2) return null;
    const first = times[0];
    const last = times[times.length - 1];
    const change = ((last - first) / first * 100);
    return {
      direction: change > 5 ? 'up' : change < -5 ? 'down' : 'flat',
      percent: `${Math.abs(Math.round(change))}%`,
      detail: `${times.length} sessions`
    };
  }

  function checkAndUpdateTimePR(exerciseId, exerciseName, seconds) {
    const prs = Store.getPRs();
    const prev = prs[exerciseId];
    const isFirst = !prev || !prev.bestTime;
    if (isFirst || seconds > prev.bestTime) {
      prs[exerciseId] = {
        name: exerciseName,
        mode: 'time',
        bestTime: seconds,
        date: new Date().toISOString(),
        isTime: true,
        prVersion: 2
      };
      Store.savePRs(prs);
      return isFirst ? false : prev;   // first entry records silently; a beaten record is handed back
    }
    return false;
  }

  // ===== REST TIMER =====
  // Counts down from a fixed end TIMESTAMP instead of subtracting 1 per tick.
  // Phones throttle background timers, so the old way silently paused when the
  // screen locked. Clock math can't drift: remaining = endAt minus now.
  function startTimer(duration) {
    stopTimer();
    state.timerRemaining = duration;
    state.timerTotal = duration;
    state.timerEndAt = Date.now() + duration * 1000;
    state.timerRunning = true;
    scheduleRestSounds();
    syncTimerUI();
    state.timerInterval = setInterval(() => {
      const msLeft = state.timerEndAt - Date.now();
      state.timerRemaining = Math.max(0, Math.round(msLeft / 1000));
      syncTimerUI();
      // Buzz once, just before the first pip, so it lines up with the sound.
      if (!restBuzzed && msLeft <= 3600) {
        restBuzzed = true;
        buzzCountdown(msLeft);
      }
      if (msLeft <= 0) {
        stopTimer(true);   // true = let the final tone and buzz finish
        const display2 = document.getElementById('timer-display');
        if (display2) display2.textContent = 'Done!';
      }
    }, 500);
  }

  // Updates the rest timer on screen without re-rendering the page, so
  // numbers you have typed but not saved yet are left alone.
  function syncTimerUI() {
    const running = state.timerRunning;
    const box = document.getElementById('rest-timer');
    if (!box) return;
    box.classList.toggle('active', running);
    const display = document.getElementById('timer-display');
    if (display && running) display.textContent = formatTime(state.timerRemaining);
    const label = document.getElementById('timer-label');
    if (label) label.textContent = running ? 'Resting' : 'Rest';
    const badge = document.getElementById('timer-badge');
    if (badge) badge.textContent = running ? 'Stop' : (badge.dataset.label || 'Start');
    const ext = document.getElementById('timer-extend');
    if (ext) ext.hidden = !running;
    const bar = document.getElementById('timer-bar');
    if (bar) bar.style.width = (running && state.timerTotal ? Math.round(100 * state.timerRemaining / state.timerTotal) : 0) + '%';
  }

  // +15s: pushes the end time out. Works because the timer is clock-based.
  // The countdown is booked against the old end time, so rebook it.
  function extendTimer(sec) {
    if (!state.timerRunning) return;
    state.timerEndAt += sec * 1000;
    state.timerTotal = (state.timerTotal || 0) + sec;
    state.timerRemaining = Math.max(0, Math.round((state.timerEndAt - Date.now()) / 1000));
    scheduleRestSounds();
    syncTimerUI();
  }

  // finished = true only when the rest ran out on its own. Then the final
  // tone, booked for exactly zero, is allowed to play. Every other stop
  // (Stop button, saving a set, leaving the exercise) silences it.
  function stopTimer(finished) {
    if (state.timerInterval) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }
    if (finished === true) { restSounds = []; restBuzzed = false; }
    else cancelRestSounds();
    state.timerRunning = false;
    syncTimerUI();
  }

  function toggleTimer(duration) {
    if (state.timerRunning) {
      stopTimer();
      const display = document.getElementById('timer-display');
      if (display) display.textContent = formatTime(duration);
    } else {
      startTimer(duration);
    }
  }

  // ===== REST COUNTDOWN (v0.21) =====
  // Pips at 3, 2 and 1 seconds left, then a long high tone on zero.
  // All four are booked on the audio clock the moment the rest starts, so
  // they land on the exact second even if the phone slows the page down.
  // The vibration can't be booked that far ahead (browsers cap a pattern
  // at 10 s per step), so it goes out once, 3.6 s before the end.
  let restSounds = [];     // booked tones, kept so they can be cancelled
  let restBuzzed = false;  // has this rest's vibration gone out yet
  const REST_LEVEL = 0.63; // level-matched to the old siren in the audition

  function cancelRestSounds() {
    restSounds.forEach(o => { try { o.stop(); } catch (e) {} });
    restSounds = [];
    // Only cancel a vibration that actually went out.
    if (restBuzzed) { try { navigator.vibrate(0); } catch (e) {} }
    restBuzzed = false;
  }

  function scheduleRestSounds() {
    cancelRestSounds();
    try {
      const ctx = getAudio();   // the one shared audio context
      if (!ctx) return;
      const now = ctx.currentTime;
      const secLeft = (state.timerEndAt - Date.now()) / 1000;
      const out = ctx.createGain();
      out.gain.value = REST_LEVEL;
      const lp = ctx.createBiquadFilter();   // takes the fizz off the square wave
      lp.type = 'lowpass';
      lp.frequency.value = 3500;
      lp.connect(out);
      out.connect(fxMaster);
      // Pips: 1000 Hz, a sharp start that dies away in 0.12 s.
      [3, 2, 1].forEach(k => {
        const t = now + secLeft - k;
        if (t < now) return;
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'square';
        o.frequency.value = 1000;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.3, t + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
        o.connect(g); g.connect(lp);
        o.start(t); o.stop(t + 0.17);
        restSounds.push(o);
      });
      // Zero: an octave up, held for half a second.
      const t = now + Math.max(0, secLeft);
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'square';
      o.frequency.value = 2000;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.3, t + 0.005);
      g.gain.setValueAtTime(0.3, t + 0.5);
      g.gain.linearRampToValueAtTime(0.0001, t + 0.56);
      o.connect(g); g.connect(lp);
      o.start(t); o.stop(t + 0.6);
      restSounds.push(o);
    } catch (e) {}
  }

  // One vibration pattern covering the whole countdown: short buzzes on the
  // pips, a long one on zero. Patterns alternate buzz, pause, buzz, so it
  // starts with a 0 ms buzz to open on a pause. Screen-on only: browsers
  // refuse to vibrate a page that isn't showing.
  function buzzCountdown(msLeft) {
    try {
      if (!navigator.vibrate) return;
      const marks = [3000, 2000, 1000, 0].map(k => msLeft - k).filter(a => a >= 0);
      const pattern = [0];
      let cursor = 0;
      marks.forEach((a, i) => {
        const len = i === marks.length - 1 ? 500 : 100;
        pattern.push(Math.max(0, Math.round(a - cursor)), len);
        cursor = a + len;
      });
      navigator.vibrate(pattern);
    } catch (e) {}
  }

  function formatTime(seconds) {
    if (seconds <= 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  // ===== WEIGHT INPUT HELPERS =====
  function adjWeight(amount) {
    const input = document.getElementById('weight-input');
    if (!input) return;
    const current = parseFloat(input.value) || 0;
    input.value = Math.max(0, current + amount);
  }

  function adjSeconds(amount) {
    const input = document.getElementById('seconds-input');
    if (!input) return;
    const current = parseInt(input.value) || 0;
    input.value = Math.max(0, current + amount);
  }

  // ===== STOPWATCH =====
  function toggleStopwatch() {
    if (state.stopwatchRunning) {
      stopStopwatch();
      // Fill the seconds input with elapsed time — NO re-render, just update DOM directly
      const input = document.getElementById('seconds-input');
      if (input) input.value = state.stopwatchElapsed;
      // Reset widget appearance without rebuilding the page
      const display = document.getElementById('stopwatch-display');
      if (display) display.textContent = formatTime(state.stopwatchElapsed);
      const widget = document.getElementById('stopwatch-widget');
      if (widget) {
        widget.classList.remove('running');
        const icon = widget.querySelector('.stopwatch-icon');
        if (icon) { icon.classList.remove('ti-player-stop'); icon.classList.add('ti-player-play'); }
      }
    } else {
      startStopwatch();
    }
  }

  function startStopwatch() {
    state.stopwatchRunning = true;
    state.stopwatchStart = Date.now();
    state.stopwatchElapsed = 0;
    state.stopwatchInterval = setInterval(() => {
      state.stopwatchElapsed = Math.round((Date.now() - state.stopwatchStart) / 1000);
      const display = document.getElementById('stopwatch-display');
      if (display) display.textContent = formatTime(state.stopwatchElapsed);
      // Pulse the widget
      const widget = document.getElementById('stopwatch-widget');
      if (widget && !widget.classList.contains('running')) widget.classList.add('running');
    }, 250);
    // Update UI immediately
    const display = document.getElementById('stopwatch-display');
    if (display) display.textContent = '0:00';
    const widget = document.getElementById('stopwatch-widget');
    if (widget) widget.classList.add('running');
    const icon = widget ? widget.querySelector('.stopwatch-icon') : null;
    if (icon) { icon.classList.remove('ti-player-play'); icon.classList.add('ti-player-stop'); }
  }

  function stopStopwatch() {
    if (state.stopwatchInterval) {
      clearInterval(state.stopwatchInterval);
      state.stopwatchInterval = null;
    }
    if (state.stopwatchRunning) {
      state.stopwatchElapsed = Math.round((Date.now() - state.stopwatchStart) / 1000);
    }
    state.stopwatchRunning = false;
  }

  function setBWMode(mode) {
    const day = activeDay();
    const workout = FORGE_DATA.workouts[day.id];
    const ex = activeExercises()[state.currentExerciseIndex];
    ex.weightMode = mode;
    const s = Store.getSettings();
    s.bwModes = Object.assign({}, s.bwModes, { [ex.id]: mode });
    Store.saveSettings(s);
    applyBwModes();
    renderExercise(document.getElementById('main-content'));
  }

  function getDefaultReps(repsStr) {
    if (repsStr === 'to failure' || repsStr === 'max time' || repsStr === 'max each leg') return 8;
    const match = repsStr.match(/(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }

  function adjReps(amount) {
    const input = document.getElementById('reps-input');
    if (!input) return;
    const current = parseInt(input.value) || 0;
    input.value = Math.max(0, current + amount);
  }


  // ===== FORGE FX: shared audio, splash strike, PR celebration =====
  // One AudioContext for the whole app. Browsers cap how many can exist, and
  // the old code made a new one for every sound, so a long session could go
  // silent. Everything below (and the rest timer alert) shares this one.
  let audioCtx = null, fxMaster = null, fxNoiseBuf = null;
  function getAudio() {
    try {
      if (!audioCtx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        audioCtx = new AC();
        fxMaster = audioCtx.createGain();
        fxMaster.gain.value = 0.9;
        const comp = audioCtx.createDynamicsCompressor();
        comp.threshold.value = -14;
        comp.ratio.value = 4;
        fxMaster.connect(comp);
        comp.connect(audioCtx.destination);
        fxNoiseBuf = audioCtx.createBuffer(1, audioCtx.sampleRate * 2, audioCtx.sampleRate);
        const d = fxNoiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      if (audioCtx.state === 'suspended') audioCtx.resume();
      return audioCtx;
    } catch (e) { return null; }
  }
  // Browsers only allow sound after a tap. The first tap anywhere unlocks it,
  // so the rest timer alert can still sound when it fires on its own later.
  document.addEventListener('pointerdown', getAudio, { once: true });

  function fxEnv(g, t, peak, decay) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  }
  function fxTone(freq, peak, decay, t) {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.frequency.value = freq;
    fxEnv(g, t, peak, decay);
    o.connect(g); g.connect(fxMaster);
    o.start(t); o.stop(t + decay + 0.05);
  }
  function fxNoise(t, dur, freq, q, peak, decay) {
    const s = audioCtx.createBufferSource(), f = audioCtx.createBiquadFilter(), g = audioCtx.createGain();
    s.buffer = fxNoiseBuf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    fxEnv(g, t, peak, decay);
    s.connect(f); f.connect(g); g.connect(fxMaster);
    s.start(t, Math.random()); s.stop(t + dur);
  }
  // Struck steel: a pitch-dropping thud, a noise crack, then ringing partials
  // at mismatched frequencies. The 1318 / 1322.5 pair beats about 4.5 times a
  // second, which is the shimmer that makes it sound like metal.
  function soundClang(k) {
    if (!getAudio()) return;
    const t = audioCtx.currentTime + 0.004;
    const th = audioCtx.createOscillator(), tg = audioCtx.createGain();
    th.frequency.setValueAtTime(150, t);
    th.frequency.exponentialRampToValueAtTime(46, t + 0.16);
    fxEnv(tg, t, 0.5 * k, 0.24);
    th.connect(tg); tg.connect(fxMaster); th.start(t); th.stop(t + 0.3);
    fxNoise(t, 0.08, 3800, 0.7, 0.7 * k, 0.05);
    [[612, .07, .9], [1318, .13, 1.7], [1322.5, .10, 1.7], [3641, .07, .55], [5210, .035, .3], [7120, .02, .18]]
      .forEach(p => fxTone(p[0], p[1] * k, p[2] * (0.8 + 0.3 * k), t));
  }
  function soundTap() {
    if (!getAudio()) return;
    const t = audioCtx.currentTime + 0.004;
    fxNoise(t, 0.05, 4200, 0.9, 0.25, 0.03);
    [[1560, .07, .32], [1566, .05, .32], [4310, .03, .14]].forEach(p => fxTone(p[0], p[1], p[2], t));
  }
  function soundBoom() {
    if (!getAudio()) return;
    const t = audioCtx.currentTime + 0.004;
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.frequency.setValueAtTime(72, t);
    o.frequency.exponentialRampToValueAtTime(44, t + 0.5);
    fxEnv(g, t, 0.55, 0.6);
    o.connect(g); g.connect(fxMaster); o.start(t); o.stop(t + 0.7);
  }
  // Quench: the seam cooling. Filtered noise whose cutoff falls as it fades.
  function soundHiss(dur, k) {
    if (!getAudio()) return;
    const t = audioCtx.currentTime + 0.004;
    const s = audioCtx.createBufferSource(), f = audioCtx.createBiquadFilter(), g = audioCtx.createGain();
    s.buffer = fxNoiseBuf; f.type = 'highpass';
    f.frequency.setValueAtTime(7000, t);
    f.frequency.exponentialRampToValueAtTime(2400, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.05 * k, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(fxMaster);
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }

  // --- animation helpers
  const REDUCE_MOTION = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  let fxTimers = [];
  function fxLater(ms, fn) { fxTimers.push(setTimeout(fn, ms)); }
  function fxAnim(el, frames, delay, dur, easing) {
    if (!el || !el.animate) return null;
    return el.animate(frames, { delay: delay, duration: dur, easing: easing || 'linear', fill: 'both' });
  }
  function fxParts(mark) {
    const q = s => mark.querySelector(s);
    return { cold: q('.fx-cold'), seam: q('.fx-seam'), swing: q('.fx-swing'), shake: q('.fx-shake'), glow: q('.fx-glow') };
  }
  // The seam at the strike: white-hot, then cooling through amber to dark.
  function fxFlash(el, delay, dur) {
    return fxAnim(el, [
      { opacity: 1, fill: '#FFF8E6' }, { opacity: 0.95, fill: '#FFC266', offset: 0.25 },
      { opacity: 0.6, fill: '#FF7A1F', offset: 0.55 }, { opacity: 0, fill: '#FF5A1F' }], delay, dur);
  }
  function fxJolt(el, delay, amp) {
    if (REDUCE_MOTION) return;
    fxAnim(el, [
      { transform: 'translate(0,0)' }, { transform: 'translate(0,' + amp + 'px)', offset: 0.18 },
      { transform: 'translate(0,' + (-amp * 0.45) + 'px)', offset: 0.45 },
      { transform: 'translate(0,' + (amp * 0.2) + 'px)', offset: 0.7 }, { transform: 'translate(0,0)' }],
      delay, 240, 'ease-out');
  }

  // --- sparks: short streaks thrown from the strike point, with gravity.
  // The frame loop only runs while sparks are alive, so it costs nothing idle.
  const fxSystems = [];
  let fxRaf = null, fxLast = 0;
  function fxBurst(canvas, mark, n, power) {
    if (REDUCE_MOTION || !canvas || !mark) return;
    const host = canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(host.width * dpr), h = Math.round(host.height * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    let sys = fxSystems.find(s => s.canvas === canvas);
    if (!sys) { sys = { canvas: canvas, c2: canvas.getContext('2d'), parts: [] }; fxSystems.push(sys); }
    sys.dpr = dpr;
    const r = mark.getBoundingClientRect();
    const x = r.left - host.left + 0.442 * r.width, y = r.top - host.top + 0.61 * r.height;
    for (let i = 0; i < n; i++) {
      const a = (-172 + Math.random() * 150) * Math.PI / 180;
      const v = (160 + Math.random() * 380) * power;
      sys.parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0,
        max: 0.35 + Math.random() * 0.45, w: 1 + Math.random() * 1.4 });
    }
    if (!fxRaf) { fxLast = performance.now(); fxRaf = requestAnimationFrame(fxLoop); }
  }
  function fxLoop(now) {
    const dt = Math.min(0.05, (now - fxLast) / 1000);
    fxLast = now;
    let alive = false;
    fxSystems.forEach(s => {
      const c2 = s.c2;
      c2.setTransform(1, 0, 0, 1, 0, 0);
      c2.clearRect(0, 0, s.canvas.width, s.canvas.height);
      c2.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      s.parts = s.parts.filter(p => (p.life += dt) < p.max);
      s.parts.forEach(p => {
        p.vy += 900 * dt; p.vx *= (1 - 0.8 * dt);
        p.x += p.vx * dt; p.y += p.vy * dt;
        const k = p.life / p.max;
        const col = k < 0.25 ? '255,246,224' : k < 0.6 ? '255,190,90' : '255,110,30';
        c2.strokeStyle = 'rgba(' + col + ',' + (1 - k).toFixed(3) + ')';
        c2.lineWidth = p.w; c2.lineCap = 'round';
        c2.beginPath(); c2.moveTo(p.x, p.y); c2.lineTo(p.x - p.vx * 0.022, p.y - p.vy * 0.022); c2.stroke();
      });
      if (s.parts.length) alive = true;
    });
    fxRaf = alive ? requestAnimationFrame(fxLoop) : null;
  }

  // ===== SPLASH =====
  // Silent on purpose: a cold launch from the home screen has no tap yet, so
  // the browser would block the sound anyway.
  function playSplash() {
    const mark = document.getElementById('splash-mark');
    if (!mark) return;
    const p = fxParts(mark);
    fxAnim(mark, [{ opacity: 0, transform: 'scale(.96)' }, { opacity: 1, transform: 'scale(1)' }], 0, 300, 'ease-out');
    fxAnim(p.cold, [{ opacity: 0.5 }, { opacity: 0.5, offset: 620 / 900 }, { opacity: 0 }], 0, 900);
    if (REDUCE_MOTION) {
      fxAnim(p.swing, [{ transform: 'rotate(0deg)' }, { transform: 'rotate(0deg)' }], 0, 1);
    } else {
      fxAnim(p.swing, [
        { transform: 'rotate(58deg)', easing: 'cubic-bezier(.55,0,.95,.35)' },
        { transform: 'rotate(0deg)', offset: 320 / 700, easing: 'cubic-bezier(.2,.7,.3,1)' },
        { transform: 'rotate(7deg)', offset: 450 / 700, easing: 'cubic-bezier(.5,0,.8,.4)' },
        { transform: 'rotate(0deg)' }], 300, 700);
    }
    fxFlash(p.seam, 620, 900);
    fxJolt(p.shake, 620, 2.2);
    fxAnim(p.glow, [{ opacity: 0 }, { opacity: 0.9, offset: 0.08 }, { opacity: 0 }], 620, 1000, 'ease-out');
    fxAnim(document.getElementById('splash-word'), REDUCE_MOTION
      ? [{ opacity: 0 }, { opacity: 1 }]
      : [{ opacity: 0, letterSpacing: '40px', paddingLeft: '40px', filter: 'blur(6px)' },
         { opacity: 1, letterSpacing: '16px', paddingLeft: '16px', filter: 'blur(0px)' }],
      780, 520, 'cubic-bezier(.2,.8,.2,1)');
    fxAnim(document.getElementById('splash-tag'), [{ opacity: 0 }, { opacity: 1 }], 1250, 400, 'ease-out');
    fxLater(620, () => fxBurst(document.getElementById('splash-sparks'), mark, 18, 1));
  }

  // ===== PR CELEBRATION =====
  // prev is the record that just got beaten (the PR checks hand it back).
  // Reads the new record from storage and says what changed.
  function prInfo(ex, prev) {
    const cur = Store.getPRs()[ex.id] || {};
    prev = prev || {};
    const unit = state.weightUnit === 'kg' ? 'kg' : 'lb';
    if (cur.mode === 'time') {
      return { num: cur.bestTime + 's',
        delta: '<b>+' + (cur.bestTime - (prev.bestTime || 0)) + 's</b> over ' + (prev.bestTime || 0) + 's' };
    }
    if (cur.mode === 'reps') {
      const d = cur.bestReps - (prev.bestReps || 0);
      return { num: prSetDisplay(cur),
        delta: '<b>+' + d + ' rep' + (d === 1 ? '' : 's') + '</b> over BW × ' + (prev.bestReps || 0) };
    }
    const dW = Math.round((addedLoad(cur) - addedLoad(prev)) * 10) / 10;
    const dR = cur.reps - (prev.reps || 0);
    const gain = dW > 0 ? '+' + dW + ' ' + unit : '+' + dR + ' rep' + (dR === 1 ? '' : 's');
    return { num: prSetDisplay(cur),
      delta: '<b>' + gain + '</b> over ' + prSetDisplay(prev) + (cur.e1rm ? ' · e1RM ' + cur.e1rm : '') };
  }

  let prTimer = null;
  function showPRCelebration(ex, prev) {
    const ov = document.getElementById('pr-overlay');
    const mark = document.getElementById('pr-mark');
    if (!ov || !mark || !ex) return;
    const info = prInfo(ex, prev);
    document.getElementById('pr-lift').textContent = ex.name;
    document.getElementById('pr-num').textContent = info.num;
    document.getElementById('pr-delta').innerHTML = info.delta;

    clearTimeout(prTimer);
    fxTimers.forEach(clearTimeout); fxTimers = [];
    if (ov.getAnimations) ov.getAnimations({ subtree: true }).forEach(a => a.cancel());
    ov.classList.add('active');
    ov.onclick = dismissPR;

    const p = fxParts(mark);
    fxAnim(ov, [{ opacity: 0 }, { opacity: 1 }], 0, 160, 'ease-out');
    fxAnim(mark, [{ opacity: 0, transform: 'scale(.94)' }, { opacity: 1, transform: 'scale(1)' }], 40, 200, 'ease-out');
    fxAnim(p.cold, [{ opacity: 0.5 }, { opacity: 0.5, offset: 700 / 980 }, { opacity: 0 }], 0, 980);
    // Blacksmith rhythm: tap, tap, wind up, strike.
    fxAnim(p.swing, REDUCE_MOTION ? [{ transform: 'rotate(0deg)' }, { transform: 'rotate(0deg)' }] : [
      { transform: 'rotate(26deg)', easing: 'cubic-bezier(.55,0,1,.45)' },
      { transform: 'rotate(0deg)', offset: 200 / 980, easing: 'cubic-bezier(.2,.7,.4,1)' },
      { transform: 'rotate(14deg)', offset: 290 / 980, easing: 'cubic-bezier(.55,0,1,.45)' },
      { transform: 'rotate(0deg)', offset: 380 / 980, easing: 'cubic-bezier(.2,.7,.3,1)' },
      { transform: 'rotate(66deg)', offset: 560 / 980, easing: 'cubic-bezier(.6,0,1,.3)' },
      { transform: 'rotate(0deg)', offset: 700 / 980, easing: 'cubic-bezier(.2,.7,.3,1)' },
      { transform: 'rotate(8deg)', offset: 830 / 980, easing: 'cubic-bezier(.5,0,.8,.4)' },
      { transform: 'rotate(0deg)' }], 0, REDUCE_MOTION ? 1 : 980);
    fxAnim(p.seam, [{ opacity: 0 }, { opacity: 0.55, offset: 0.02 }, { opacity: 0, offset: 0.2 }, { opacity: 0 }], 200, 1000);
    fxAnim(p.seam, [{ opacity: 0 }, { opacity: 0.55, offset: 0.02 }, { opacity: 0, offset: 0.2 }, { opacity: 0 }], 380, 1000);
    fxFlash(p.seam, 700, 1200);
    fxJolt(p.shake, 700, 3.4);
    fxAnim(p.glow, [{ opacity: 0 }, { opacity: 1, offset: 0.06 }, { opacity: 0 }], 700, 1300, 'ease-out');
    fxAnim(document.getElementById('pr-title'), REDUCE_MOTION ? [{ opacity: 0 }, { opacity: 1 }] :
      [{ opacity: 0, transform: 'scale(1.4)', filter: 'blur(4px)' }, { opacity: 1, transform: 'scale(1)', filter: 'blur(0px)' }],
      720, 380, 'cubic-bezier(.2,.9,.3,1.15)');
    fxAnim(document.getElementById('pr-lift'), [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], 880, 300, 'ease-out');
    fxAnim(document.getElementById('pr-num'), [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], 920, 360, 'cubic-bezier(.2,.8,.2,1)');
    fxAnim(document.getElementById('pr-delta'), [{ opacity: 0 }, { opacity: 1 }], 1050, 300, 'ease-out');
    fxAnim(document.getElementById('pr-cont'), [{ opacity: 0 }, { opacity: 1 }], 1700, 400, 'ease-out');

    const sparks = document.getElementById('pr-sparks');
    fxLater(200, () => { soundTap(); fxBurst(sparks, mark, 4, 0.5); });
    fxLater(380, () => { soundTap(); fxBurst(sparks, mark, 5, 0.55); });
    fxLater(700, () => { soundClang(1.35); soundBoom(); fxBurst(sparks, mark, 34, 1.25); });
    fxLater(1050, () => soundHiss(1.3, 1));
    prTimer = setTimeout(dismissPR, 3400);
  }

  // Tap anywhere, or wait 3.4 seconds. Pending sounds are cancelled too, so an
  // early tap does not leave a clang ringing after the screen is gone.
  function dismissPR() {
    const ov = document.getElementById('pr-overlay');
    if (!ov || !ov.classList.contains('active')) return;
    clearTimeout(prTimer);
    fxTimers.forEach(clearTimeout); fxTimers = [];
    ov.onclick = null;
    const out = ov.animate([{ opacity: getComputedStyle(ov).opacity }, { opacity: 0 }], { duration: 220, fill: 'forwards' });
    out.onfinish = () => {
      ov.classList.remove('active');
      if (ov.getAnimations) ov.getAnimations({ subtree: true }).forEach(a => a.cancel());
    };
  }

  // ===== PLATE CALCULATOR =====
  // Slide-up panel. Tap a plate weight to load one on EACH side (symmetric),
  // tap a plate on the bar graphic to pull that pair back off.
  const PLATE_SIZES = [45, 35, 25, 15, 10, 5];

  function openPlateCalc() {
    renderPlateCalc();
    showPanel('plate-panel');
  }

  function closePlateCalc() {
    dismissPanel();
  }

  function renderPlateCalc() {
    const pc = state.plateCalc;
    const perSide = pc.plates.reduce((s, p) => s + p, 0);
    const total = pc.bar + perSide * 2;
    const day = activeDay();
    const typeClass = toneClass(day);

    const content = document.getElementById('plate-panel-content');
    if (!content) return;
    content.className = typeClass;   // plate calculator takes the day's accent
    content.innerHTML = `
      <div class="info-panel-title">Plate Calculator</div>
      <div class="plate-total font-mono">${total} <span class="plate-total-unit">${state.weightUnit}</span></div>
      <div class="plate-per-side">${perSide} ${state.weightUnit} per side · ${pc.bar} ${state.weightUnit} bar</div>
      <div class="plate-viz">
        <div class="plate-viz-bar"></div>
        ${pc.plates.map((p, i) => `<div class="plate-viz-plate p${p}" onclick="FORGE.plateRemoveAt(${i})">${p}</div>`).join('')}
        <div class="plate-viz-sleeve"></div>
      </div>
      <div class="plate-hint">${pc.plates.length > 0 ? 'Tap a plate to remove it from both sides' : 'Tap a weight below to load the bar'}</div>
      <div class="plate-btn-row">
        ${PLATE_SIZES.map(p => `<button class="plate-btn ${typeClass}" onclick="FORGE.plateAdd(${p})">${p}</button>`).join('')}
      </div>
      <div class="plate-bar-row">
        <span class="plate-bar-label">Bar</span>
        <button class="bw-btn ${pc.bar === 45 ? 'active' : ''} ${typeClass}" onclick="FORGE.plateBar(45)">45 lb</button>
        <button class="bw-btn ${pc.bar === 35 ? 'active' : ''} ${typeClass}" onclick="FORGE.plateBar(35)">35 lb</button>
        <button class="bw-btn ${pc.bar === 0 ? 'active' : ''} ${typeClass}" onclick="FORGE.plateBar(0)">No bar</button>
        <button class="bw-btn" style="color:var(--red);" onclick="FORGE.plateClear()">Clear</button>
      </div>
      <button class="save-set-btn ${typeClass}" style="margin-top:14px;" onclick="FORGE.plateApply()">USE ${total} ${state.weightUnit.toUpperCase()}</button>
    `;
  }

  function plateAdd(w) {
    state.plateCalc.plates.push(w);
    state.plateCalc.plates.sort((a, b) => b - a); // heaviest closest to the bar
    renderPlateCalc();
  }

  function plateRemoveAt(i) {
    state.plateCalc.plates.splice(i, 1);
    renderPlateCalc();
  }

  function plateBar(w) {
    state.plateCalc.bar = w;
    renderPlateCalc();
  }

  function plateClear() {
    state.plateCalc.plates = [];
    renderPlateCalc();
  }

  function plateApply() {
    const pc = state.plateCalc;
    const total = pc.bar + pc.plates.reduce((s, p) => s + p, 0) * 2;
    const input = document.getElementById('weight-input');
    if (input) input.value = total;
    closePlateCalc();
  }

  // ===== INFO PANEL =====
  function showInfo() {
    const day = activeDay();
    const workout = FORGE_DATA.workouts[day.id];
    const ex = activeExercises()[state.currentExerciseIndex];

    const panel = document.getElementById('info-panel');
    const content = document.getElementById('info-panel-content');
    const backdrop = document.getElementById('info-backdrop');

    content.innerHTML = `
      <div class="info-panel-title">${ex.name}</div>
      <div id="info-figure"></div>
      <div class="info-panel-tip">${ex.tip}</div>
      ${(ex.isFinisher || ex.isPrimer) && ex.finisherProgression ? `<div style="font-size:12px;color:var(--amber);margin-bottom:12px;">${ex.isPrimer ? '\u26a1' : '\ud83d\udd25'} ${ex.finisherProgression}</div>` : ''}
      <button class="info-panel-video-btn" onclick="window.open('${ex.video}', '_blank')">
        <i class="ti ti-player-play"></i> Watch demo video
      </button>
    `;

    // Animated figure in the day's colour. If there is no figure for this
    // exercise, or it fails to draw, the old image goes in its place.
    panel.classList.remove('power', 'hypertrophy', 'calisthenics', 'core');
    panel.classList.add(toneClass(day));
    const slot = document.getElementById('info-figure');
    const Figs = window.ForgeFigures;
    if (Figs) Figs.stopAll();
    const fig = Figs && Figs.has(ex.id) ? Figs.mount(slot, ex.id, { code: codeFor(day.id), name: ex.name }) : null;
    if (!fig && ex.image) {
      slot.outerHTML = `<img class="info-panel-image" src="${ex.image}" alt="${ex.name}" onerror="this.style.display='none'">`;
    }

    showPanel('info-panel');
  }

  function closeInfoPanel() {
    dismissPanel();
  }

  // ===== TRACKER TAB =====
  function renderTracker(el) {
    // Opening Tracker from the nav snaps the calendar to this month; paging
    // with the arrows or editing a day keeps you where you were.
    if (!state._calendarNavActive) {
      const today = new Date();
      state.calendarMonth = today.getMonth();
      state.calendarYear = today.getFullYear();
    }
    state._calendarNavActive = false;

    el.innerHTML = `
      <h1 class="page-title">Tracker</h1>
      ${renderCalendar()}
      ${FORGE_DATA.sheetsViewUrl ? `
      <button class="sheet-link-btn" onclick="window.open('${FORGE_DATA.sheetsViewUrl}', '_blank')">
        <i class="ti ti-table"></i> Open Google Sheet <i class="ti ti-external-link"></i>
      </button>` : ''}
      ${renderRecentWorkouts()}
    `;
  }

  function openTracker() {
    renderTab('tracker');
  }

  function renderRecentWorkouts() {
    const logs = Store.getLogs();
    const allLogs = [];
    Object.values(logs).forEach(dayLogs => {
      dayLogs.forEach(log => allLogs.push(log));
    });
    allLogs.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
    const recent = allLogs.slice(0, 10);

    if (recent.length === 0) return '<div class="empty-state"><div class="empty-state-icon"><i class="ti ti-chart-bar"></i></div><div class="empty-state-text">Complete a workout to see history here.</div></div>';

    let html = '<section class="history-list"><div class="section-header">Recent workouts</div>';
    recent.forEach((log, idx) => {
      const date = new Date(log.completedAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      const dayInfo = dayById(log.dayId);
      const tone = dayInfo ? toneClass(dayInfo) : 'power';
      const totalSets = log.exercises.reduce((s, e) => s + e.sets.length, 0);
      const totalReps = log.exercises.reduce((s, e) =>
        s + e.sets.reduce((r, set) => r + (set.reps || 0), 0), 0);
      const durStr = log.durationMin > 0 ? ` · ${log.durationMin} min` : '';
      const chip = `<span class="cal-code ${toneOf(dayInfo || { type: 'power' })}">${codeFor(log.dayId)}${SIZE_SUFFIX[log.size] || SIZE_SUFFIX.normal}</span>`;

      let detail = '';
      log.exercises.forEach(ex => {
        if (ex.sets.length === 0) return;
        const bestSet = ex.sets.reduce((best, s) => {
          const e1 = FORGE_DATA.calculateE1RM(s.weight, s.reps || 0);
          return e1 > best.e1rm ? { e1rm: e1, display: s.display } : best;
        }, { e1rm: 0, display: '' });

        detail += `
          <div class="detail-exercise">
            <div class="detail-exercise-header">
              <span class="detail-exercise-name">${ex.name}</span>
              ${bestSet.e1rm > 0 ? `<span class="detail-e1rm">e1RM ${bestSet.e1rm}</span>` : ''}
            </div>
            <div class="detail-sets">
              ${ex.sets.map((set, si) => `
                <div class="detail-set">
                  <span class="detail-set-num">S${si + 1}</span>
                  <span class="detail-set-data">${set.display}</span>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      });

      html += `
        <div class="workout-history-entry ${tone}">
          <button class="hist-row" onclick="FORGE.toggleWorkoutDetail(${idx})">
            <span class="hist-top">
              ${chip}
              <span class="hist-name">${dayInfo ? dayInfo.name : log.dayId}</span>
              <span class="hist-date">${date.toUpperCase()}</span>
              <i class="ti ti-chevron-down" id="workout-chevron-${idx}"></i>
            </span>
            <span class="hist-meta">${totalSets} sets · ${totalReps} reps${durStr}</span>
          </button>
          <div class="workout-detail" id="workout-detail-${idx}">${detail}</div>
        </div>
      `;
    });
    return html + '</section>';
  }

  function toggleWorkoutDetail(idx) {
    const detail = document.getElementById('workout-detail-' + idx);
    const chevron = document.getElementById('workout-chevron-' + idx);
    if (!detail) return;
    const isOpen = detail.classList.toggle('open');
    if (chevron) chevron.style.transform = isOpen ? 'rotate(180deg)' : 'rotate(0)';
  }
  
  // ===== PR TAB =====
  function renderPRs(el) {
    const prs = Store.getPRs();
    const all = Object.keys(prs).map(id => Object.assign({ id: id }, prs[id]));

    if (all.length === 0) {
      el.innerHTML = `
        <h1 class="page-title">Personal records</h1>
        <div class="empty-state">
          <div class="empty-state-icon"><i class="ti ti-trophy"></i></div>
          <div class="empty-state-text">Complete your first workout to start tracking PRs.</div>
        </div>
      `;
      return;
    }

    // Three kinds of record that no single sort order can rank honestly, so
    // they get their own sections instead of pretending to be comparable.
    const weighted = all.filter(p => p.mode === 'weight' || (!p.mode && !p.isTime))
                        .sort((x, y) => (y.weight || 0) - (x.weight || 0));
    const byReps   = all.filter(p => p.mode === 'reps')
                        .sort((x, y) => (y.bestReps || 0) - (x.bestReps || 0));
    const byTime   = all.filter(p => p.mode === 'time' || p.isTime)
                        .sort((x, y) => (y.bestTime || 0) - (x.bestTime || 0));

    const row = (pr, value, sub) => `
      <div class="pr-item">
        <div>
          <div class="pr-item-name">${pr.name}</div>
          <div class="pr-item-detail">${sub}</div>
        </div>
        <div class="pr-item-value">${value}</div>
      </div>`;

    const section = (title, items, render) => items.length ? `
      <section class="section-block">
        <div class="section-header">${title}</div>
        <div class="pr-list">${items.map(render).join('')}</div>
      </section>` : '';

    el.innerHTML = `
      <h1 class="page-title">Personal records</h1>

      ${section('Weighted', weighted, pr => row(
        pr,
        prSetDisplay(pr),
        `${new Date(pr.date).toLocaleDateString()}${pr.e1rm ? ` · e1RM ${pr.e1rm} ${state.weightUnit}` : ''}`
      ))}

      ${section('Bodyweight', byReps, pr => row(
        pr,
        `${pr.bestReps} reps`,
        new Date(pr.date).toLocaleDateString()
      ))}

      ${section('Time', byTime, pr => row(
        pr,
        `${pr.bestTime}s`,
        new Date(pr.date).toLocaleDateString()
      ))}

      <div class="sheet-note">
        The big number is the best set you actually did. e1RM is an estimate of
        your one-rep max from that set, and it only appears at 12 reps or fewer
        because the formula stops meaning anything above that.
      </div>
    `;
  }

  // ===== SETTINGS TAB =====
  function renderSettings(el) {
    const settings = Store.getSettings();
    el.innerHTML = `
      <h1 class="page-title">Settings</h1>
      <div class="settings-list">
        ${Sandbox.on ? `
        <div class="warmup-card sandbox-card">
          <span class="settings-k"><i class="ti ti-flask"></i> Sandbox</span>
          <div class="settings-help">
            You're working on a copy. Everything here, clearing data included, touches only the copy and vanishes when you exit or close the app.
          </div>
          <button class="action-btn" onclick="FORGE.exitSandbox()">
            <i class="ti ti-x"></i> Exit sandbox
          </button>
        </div>` : ''}
        <div class="warmup-card settings-field">
          <label for="settings-bw">Body weight (${state.weightUnit})</label>
          <input type="number" class="weight-input" id="settings-bw" value="${settings.bodyWeight}" inputmode="numeric">
        </div>
        <div class="warmup-card settings-field">
          <span class="settings-k">Next up</span>
          <div class="settings-next">${nextDay().name}</div>
          <div class="settings-help">
            Worked out from your log. To correct it, tap the day on the calendar and fix what you actually did.
          </div>
        </div>
        <button class="start-btn" onclick="FORGE.saveSettings()">Save settings</button>
        <div class="section-header" style="margin-top:10px;">Data</div>
        <button class="action-btn" onclick="FORGE.exportData()">
          <i class="ti ti-share"></i> Back up data
        </button>
        ${renderBackupStatus()}
        <input type="file" id="import-file" accept=".json,.txt,application/json,text/plain" style="display:none;" onchange="FORGE.importData(this)">
        <button class="action-btn" onclick="document.getElementById('import-file').click()">
          <i class="ti ti-upload"></i> Import data from JSON
        </button>
        <button class="action-btn warn" onclick="FORGE.clearToday()">
          <i class="ti ti-rotate-2"></i> Clear today's workout
        </button>
        <button class="action-btn danger" onclick="FORGE.clearData()">
          <i class="ti ti-trash"></i> Clear all data
        </button>
      </div>
    `;
  }

  function saveSettings() {
    const bw = parseFloat(document.getElementById('settings-bw').value) || 180;
    state.bodyWeight = bw;

    // Merge into the saved settings. The old version wrote only these two
    // fields, which silently wiped the saved workout size.
    const settings = Store.getSettings();
    settings.bodyWeight = bw;
    settings.weightUnit = state.weightUnit;
    Store.saveSettings(settings);

    alert('Settings saved.');
    renderTab('home');
  }

  // ===== BACKUP (v0.22) =====
  // Export opens the phone's share menu, so the backup leaves the phone
  // (Drive, Gmail, a text). Android refuses to share .json files, so the
  // shared copy is a .txt holding the same JSON; Import reads either.
  // Where sharing isn't available (most desktops) it downloads a .json.
  function exportData() {
    const data = {
      logs: Store.getLogs(),
      prs: Store.getPRs(),
      settings: Store.getSettings(),
      completedDays: Store.getCompletedDays()
    };
    const json = JSON.stringify(data, null, 2);
    const stamp = todayLocal();

    let file = null;
    try { file = new File([json], `forge-backup-${stamp}.txt`, { type: 'text/plain' }); } catch (e) {}

    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: 'FORGE backup ' + stamp })
        .then(function() { markBackedUp(); })
        .catch(function(err) {
          // Cancelled from the share menu: not a backup. Anything else: download instead.
          if (err && err.name === 'AbortError') return;
          downloadBackup(json, stamp);
        });
      return;
    }
    downloadBackup(json, stamp);
  }

  function downloadBackup(json, stamp) {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `forge-backup-${stamp}.json`;
    a.click();
    setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
    markBackedUp();
  }

  function markBackedUp() {
    Store.set('lastBackup', new Date().toISOString());
    if (state.currentTab === 'settings' || state.currentTab === 'home') renderTab(state.currentTab);
  }

  // Whole days since an ISO time, by local calendar date.
  function daysSince(iso) {
    const then = new Date(localDateOf(iso) + 'T00:00:00');
    const now = new Date(todayLocal() + 'T00:00:00');
    return Math.round((now - then) / 86400000);
  }

  // Overdue: something to lose and no backup in 14 days. A first backup gets
  // a week of grace from the first logged workout.
  const BACKUP_DUE_DAYS = 14;
  const FIRST_BACKUP_GRACE = 7;
  function backupInfo() {
    const last = Store.get('lastBackup');
    const firsts = [];
    Object.values(Store.getLogs()).forEach(list => (list || []).forEach(l => { if (l && l.completedAt) firsts.push(l.completedAt); }));
    const hasData = firsts.length > 0;
    if (last) {
      const d = daysSince(last);
      return { hasData, last, days: d, overdue: hasData && d >= BACKUP_DUE_DAYS };
    }
    const firstLog = firsts.sort()[0];
    return { hasData, last: null, days: null,
             overdue: hasData && daysSince(firstLog) >= FIRST_BACKUP_GRACE };
  }

  function agoText(days) {
    return days === 0 ? 'today' : days === 1 ? 'yesterday' : days + ' days ago';
  }

  function renderBackupStatus() {
    const b = backupInfo();
    const text = b.last ? 'Last backup: ' + agoText(b.days) : 'Never backed up';
    return `<div class="settings-help backup-status${b.overdue ? ' overdue' : ''}">
      ${text}. Sends a copy to Drive, email or a text, so a lost phone doesn't take your history with it.
    </div>`;
  }

  // Home nudge: only for copies with no Google Sheet behind them (the sheet
  // already is the backup), never in the sandbox, and only when overdue.
  function renderBackupNudge() {
    if (FORGE_DATA.sheetsWebhookUrl || Sandbox.on || state.workoutActive) return '';
    const b = backupInfo();
    if (!b.overdue) return '';
    const text = b.last ? 'No backup in ' + b.days + ' days' : 'Not backed up yet';
    return `<button class="backup-nudge" onclick="FORGE.exportData()">
      <i class="ti ti-alert-triangle"></i><span>${text}</span><span class="backup-nudge-go">Back up now</span>
    </button>`;
  }

  function importData(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const data = JSON.parse(e.target.result);

        // Validate structure
        const validKeys = ['logs', 'prs', 'settings', 'completedDays'];
        const found = validKeys.filter(k => data[k] !== undefined);
        if (found.length === 0) {
          alert('Invalid backup file. No recognized data found.');
          input.value = '';
          return;
        }

        const parts = [];
        if (data.logs) parts.push('workout logs');
        if (data.prs) parts.push('PRs');
        if (data.settings) parts.push('settings');
        if (data.completedDays) parts.push('calendar history');

        if (!confirm(`This will replace your current: ${parts.join(', ')}.\n\nContinue?`)) {
          input.value = '';
          return;
        }

        if (data.logs) Store.saveLogs(data.logs);
        if (data.prs) Store.savePRs(data.prs);
        if (data.completedDays) Store.set('completedDays', data.completedDays);
        if (data.settings) {
          Store.saveSettings(data.settings);
          state.bodyWeight = data.settings.bodyWeight || 180;
          state.weightUnit = data.settings.weightUnit || 'lbs';
          state.sheetsUrl = Sandbox.on ? '' : (data.settings.sheetsUrl || FORGE_DATA.sheetsWebhookUrl || '');
        }

        migrateCompletedDays(); // imported backups may contain old poisoned entries
        applyBwModes();
        migratePRs();
        rebuildBwPRs();
        refreshCycle();
        alert('Data imported successfully.');
        renderTab('home');
      } catch (err) {
        alert('Could not read file. Make sure it is a valid FORGE backup JSON.');
      }
      input.value = '';
    };
    reader.readAsText(file);
  }
  
  function clearToday() {
    const today = todayLocal();
    const completed = Store.getCompletedDays();
    const todayEntries = completed.filter(c => c.date === today);

    // Active session with nothing saved yet: just kill the session
    if (!todayEntries.length && state.workoutActive) {
      if (confirm('Cancel the current workout in progress?')) {
        resetWorkoutState();
        renderTab('home');
      }
      return;
    }

    if (!todayEntries.length) {
      alert('Nothing logged today.');
      return;
    }

    const names = todayEntries.map(c => labelFor(c)).join(', ');
    if (confirm(`Clear everything logged today (${names})? Cycle position recalculates on its own.`)) {
      const logs = Store.getLogs();
      todayEntries.forEach(c => {
        if (c.dayId && c.dayId !== 'rest' && logs[c.dayId]) {
          // Compare LOCAL dates. completedAt is UTC, so an evening workout's
          // raw string starts with tomorrow's date and never matched.
          logs[c.dayId] = logs[c.dayId].filter(
            log => !log.completedAt || localDateOf(log.completedAt) !== today
          );
          if (!logs[c.dayId].length) delete logs[c.dayId];
        }
      });
      Store.saveLogs(logs);
      Store.set('completedDays', completed.filter(c => c.date !== today));

      refreshCycle();          // no manual rollback; it recomputes
      resetWorkoutState();
      renderTab('home');
    }
  }

  function clearData() {
    if (confirm('This will delete ALL workout data, PRs, and settings. Are you sure?')) {
      if (confirm('Really? This cannot be undone.')) {
        Store.clearAll();   // in the sandbox, this wipes only the copy
        state.bodyWeight = 180;
        refreshCycle();
        resetWorkoutState();
        renderTab('home');
      }
    }
  }

  // ===== PUBLIC API =====
  window.FORGE = {
    startWorkout,
    openStartSheet,
    pickStartSize,
    confirmStart,
    dismissPanel,
    logRestToday,
    openDaySheet,
    closeDaySheet,
    openKeySheet,
    setWorkoutSize,
    openPickerSheet,
    pickDay,
    toggleCountsAs,
    markDay,
    clearDayEntry,
    calendarPrev,
    calendarNext,
    goToWarmup,
    goToExercise,
    warmupDone,
    backToOverview,
    skipExercise,
    saveSet,
    editSet,
    updateSet,
    cancelEdit,
    finishExercise,
    completeWorkout,
    endWorkout,
    finishAndGoHome,
    showInfo,
    toggleTimer: toggleTimer,
    extendTimer,
    openTracker,
    adjWeight,
    adjReps,
    adjSeconds,
    toggleStopwatch,
    setBWMode,
    saveSettings,
    exportData,
    clearData,
    clearToday,
    toggleWorkoutDetail,
    importData,
    resumeWorkout,
    openPlateCalc,
    closePlateCalc,
    plateAdd,
    plateRemoveAt,
    plateBar,
    plateClear,
    plateApply,
    exitSandbox
  };

  // ===== BOOT =====
  document.addEventListener('DOMContentLoaded', init);

})();
