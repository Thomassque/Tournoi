/* ==========================================================================
   Stockage des données du tournoi.
   - Mode "firebase" : scores en temps réel (si js/config.js contient une config Firebase).
   - Mode "fichier"  : lecture de data/tournoi.json (rafraîchi toutes les 20 s).
   - Mode "demo"     : données fictives (ajouter ?demo à l'adresse de la page).
   ========================================================================== */
(function () {
  "use strict";

  var cfg = window.TOURNOI_CONFIG || {};
  var FB_VERSION = "10.12.2";
  var DATA_URL = "data/tournoi.json";
  var LOCAL_KEY = "tournoi-petanque-local";
  var ROOT = "tournoi";
  var demo = /[?&]demo\b/.test(location.search) || cfg.demo === true;
  var firebaseOn = !!(cfg.firebase && cfg.firebase.apiKey && cfg.firebase.databaseURL);
  var mode = demo ? "demo" : (firebaseOn ? "firebase" : "fichier");

  var listeners = [];
  var statusListeners = [];
  var current = null;
  var raw = null;          // copie brute (mode fichier/admin local)
  var db = null, auth = null;
  var adminLocal = false;

  function emit() { listeners.forEach(function (cb) { cb(current); }); }
  function emitStatus(s, info) { statusListeners.forEach(function (cb) { cb(s, info); }); }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var el = document.createElement("script");
      el.src = src; el.onload = resolve; el.onerror = function () { reject(new Error("Chargement impossible : " + src)); };
      document.head.appendChild(el);
    });
  }

  var fbReady = null;
  function initFirebase(withAuth) {
    if (fbReady) return fbReady;
    var base = "https://www.gstatic.com/firebasejs/" + FB_VERSION + "/";
    fbReady = loadScript(base + "firebase-app-compat.js")
      .then(function () {
        return Promise.all([
          loadScript(base + "firebase-database-compat.js"),
          withAuth ? loadScript(base + "firebase-auth-compat.js") : null
        ]);
      })
      .then(function () {
        window.firebase.initializeApp(cfg.firebase);
        db = window.firebase.database();
        if (withAuth) auth = window.firebase.auth();
      });
    return fbReady;
  }

  function setCurrent(data) {
    raw = data || {};
    current = window.Tournoi.normalize(raw);
    emit();
  }

  /* --------------------------------------------------------- lecture */
  function pollFile() {
    return fetch(DATA_URL + "?t=" + Date.now(), { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (json) { setCurrent(json); emitStatus("fichier", new Date()); })
      .catch(function () {
        if (!current) setCurrent({});
        emitStatus("hors-ligne");
      });
  }

  function start(opts) {
    opts = opts || {};
    adminLocal = !!opts.admin && mode === "fichier";
    if (mode === "demo") {
      setTimeout(function () { setCurrent(window.Tournoi.demoState()); emitStatus("demo"); }, 0);
      return;
    }
    if (mode === "firebase") {
      initFirebase(!!opts.admin).then(function () {
        db.ref(ROOT).on("value", function (snap) { setCurrent(snap.val()); }, function (err) {
          emitStatus("erreur", err && err.message);
        });
        db.ref(".info/connected").on("value", function (snap) {
          emitStatus(snap.val() ? "direct" : "reconnexion");
        });
      }).catch(function (e) {
        emitStatus("erreur", e.message);
        mode = "fichier"; pollFile(); setInterval(pollFile, 20000);
      });
      return;
    }
    // mode fichier
    if (adminLocal) {
      var saved = null;
      try { saved = JSON.parse(localStorage.getItem(LOCAL_KEY) || "null"); } catch (e) { saved = null; }
      if (saved) { setCurrent(saved); emitStatus("local"); return; }
      pollFile().then(function () { emitStatus("local"); });
      return;
    }
    pollFile();
    setInterval(pollFile, 20000);
  }

  /* -------------------------------------------------------- écriture */
  function clean(v) { return v === undefined ? null : JSON.parse(JSON.stringify(v)); }

  function setPath(obj, path, value) {
    var parts = path.split("/");
    var o = obj;
    for (var i = 0; i < parts.length - 1; i++) {
      if (!o[parts[i]] || typeof o[parts[i]] !== "object") o[parts[i]] = {};
      o = o[parts[i]];
    }
    if (value === null) delete o[parts[parts.length - 1]];
    else o[parts[parts.length - 1]] = value;
  }

  // updates : { "matches/A-1": {...}, "annonce": "..." }
  function update(updates) {
    var stamped = {};
    Object.keys(updates).forEach(function (k) { stamped[k] = clean(updates[k]); });
    stamped.updatedAt = Date.now();
    if (mode === "firebase") {
      return db.ref(ROOT).update(stamped);
    }
    var copy = JSON.parse(JSON.stringify(raw || {}));
    Object.keys(stamped).forEach(function (k) { setPath(copy, k, stamped[k]); });
    if (adminLocal) { try { localStorage.setItem(LOCAL_KEY, JSON.stringify(copy)); } catch (e) { /* stockage plein */ } }
    setCurrent(copy);
    return Promise.resolve();
  }

  function replaceAll(data) {
    var d = clean(data);
    d.updatedAt = Date.now();
    if (mode === "firebase") return db.ref(ROOT).set(d);
    if (adminLocal) { try { localStorage.setItem(LOCAL_KEY, JSON.stringify(d)); } catch (e) { /* ignore */ } }
    setCurrent(d);
    return Promise.resolve();
  }

  function exportJSON() {
    var data = JSON.parse(JSON.stringify(raw || {}));
    return JSON.stringify(data, null, 2);
  }

  function resetLocal() {
    try { localStorage.removeItem(LOCAL_KEY); } catch (e) { /* ignore */ }
  }

  /* ------------------------------------------------------------ auth */
  function onAuth(cb) {
    if (mode !== "firebase") { cb({ local: true }); return; }
    initFirebase(true).then(function () { auth.onAuthStateChanged(function (u) { cb(u); }); })
      .catch(function () { cb(null); });
  }
  function signIn(email, pw) { return initFirebase(true).then(function () { return auth.signInWithEmailAndPassword(email, pw); }); }
  function signOut() { return auth ? auth.signOut() : Promise.resolve(); }

  window.TournoiStore = {
    get mode() { return mode; },
    get state() { return current; },
    start: start,
    subscribe: function (cb) { listeners.push(cb); if (current) cb(current); },
    onStatus: function (cb) { statusListeners.push(cb); },
    update: update, replaceAll: replaceAll, exportJSON: exportJSON, resetLocal: resetLocal,
    onAuth: onAuth, signIn: signIn, signOut: signOut
  };
})();
