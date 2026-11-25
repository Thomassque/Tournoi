/* Espace organisateurs : saisie des scores, équipes, poules, tableaux, réglages */
(function () {
  "use strict";
  var T = window.Tournoi, S = window.TournoiStore, esc = T.esc;
  var cfg = window.TOURNOI_CONFIG || {};
  var $ = function (id) { return document.getElementById(id); };

  var state = null;
  var onglet = "scores";
  var renduEnAttente = false;
  var CRENEAUX = [
    ["poule1", "Poules · tour 1"], ["poule2", "Poules · tour 2"], ["poule3", "Poules · tour 3"],
    ["P1", "Tableau · 16es"], ["C1", "Consolante · 8es"],
    ["P2", "Tableau · 8es"], ["C2", "Consolante · quarts"],
    ["P3", "Tableau · quarts"], ["C3", "Consolante · demies"],
    ["P4", "Tableau · demies"], ["C4", "Consolante · finale & 3e"],
    ["P5", "Tableau · finale & 3e"]
  ];

  /* ------------------------------------------------------------- toast */
  var toastTimer;
  function toast(msg, err) {
    var el = $("toast");
    el.textContent = msg;
    el.classList.toggle("err", !!err);
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove("show"); }, err ? 5000 : 1800);
  }

  function save(updates, msg) {
    return S.update(updates).then(function () { if (msg) toast(msg); }).catch(function (e) {
      var txt = e && e.message ? e.message : String(e);
      if (/permission/i.test(txt)) txt = "Permission refusée : ce compte n'est pas autorisé à modifier les données (voir README, étape « organisateurs »).";
      toast(txt, true);
      throw e;
    });
  }

  /* ---------------------------------------------------------- démarrage */
  var modeTexte = {
    firebase: "🟢 Mode direct (Firebase) : les modifications sont visibles instantanément.",
    fichier: "🟠 Mode fichier : modifications locales, à exporter vers data/tournoi.json.",
    demo: "🟡 Mode démo : rien n'est enregistré."
  };
  $("mode-info").textContent = modeTexte[S.mode] || "";
  if (S.mode === "fichier") { $("local-warn").classList.remove("hidden"); $("fichier-btn").classList.remove("hidden"); }

  var demarre = false;
  S.onAuth(function (user) {
    if (user) {
      $("login").classList.add("hidden");
      $("app").classList.remove("hidden");
      if (!user.local) {
        $("user-info").textContent = user.email || "";
        $("logout").classList.remove("hidden");
      }
      if (!demarre) { demarre = true; S.start({ admin: true }); }
    } else {
      $("login").classList.remove("hidden");
      $("app").classList.add("hidden");
      $("logout").classList.add("hidden");
      $("user-info").textContent = "";
    }
  });
  $("login-form").addEventListener("submit", function (e) {
    e.preventDefault();
    $("login-err").classList.add("hidden");
    S.signIn($("email").value, $("pw").value).catch(function (err) {
      $("login-err").textContent = "Connexion impossible : vérifiez l'e-mail et le mot de passe. (" + (err.code || err.message) + ")";
      $("login-err").classList.remove("hidden");
    });
  });
  $("logout").addEventListener("click", function () { S.signOut(); });

  S.subscribe(function (s) {
    state = s;
    var actif = document.activeElement;
    if (actif && $("app").contains(actif) && /INPUT|TEXTAREA|SELECT/.test(actif.tagName)) {
      renduEnAttente = true;   // on ne casse pas une saisie en cours
      renderLeger();
      return;
    }
    render();
  });
  document.addEventListener("focusout", function () {
    setTimeout(function () {
      var a = document.activeElement;
      if (renduEnAttente && !(a && /INPUT|TEXTAREA|SELECT/.test(a.tagName))) { renduEnAttente = false; render(); }
    }, 50);
  });

  /* ------------------------------------------------------------ onglets */
  document.querySelectorAll(".tab").forEach(function (t) {
    t.addEventListener("click", function () {
      onglet = t.getAttribute("data-tab");
      document.querySelectorAll(".tab").forEach(function (x) { x.setAttribute("aria-selected", x === t ? "true" : "false"); });
      document.querySelectorAll(".panel").forEach(function (p) { p.classList.toggle("hidden", p.id !== "panel-" + onglet); });
      render();
    });
  });

  function nom(id) { return T.teamName(state, id); }
  function equipesTriees() {
    return Object.keys(state.teams).sort(function (a, b) { return nom(a).localeCompare(nom(b), "fr"); });
  }

  function render() {
    if (!state) return;
    renderLeger();
    if (onglet === "scores") renderScores();
    if (onglet === "equipes") renderEquipes();
    if (onglet === "poules") renderPoules();
    if (onglet === "tableaux") renderTableaux();
    if (onglet === "reglages") renderReglages();
  }

  function renderLeger() {
    $("nb-equipes").textContent = Object.keys(state.teams).length;
    $("public-info").textContent = state.public ? "· Direct ouvert au public" : "· Direct fermé au public";
  }

  /* ============================================================ SCORES */
  var selCreneau = $("f-creneau");
  selCreneau.innerHTML = '<option value="">Tous les tours</option>' + CRENEAUX.map(function (c) {
    return '<option value="' + c[0] + '">' + c[1] + "</option>";
  }).join("");
  [selCreneau, $("f-masquer")].forEach(function (el) { el.addEventListener("change", function () { renderScores(); el.blur(); }); });
  $("f-texte").addEventListener("input", renderScores);

  function recordDe(id) {
    var r = state.matches[id] || {};
    return { s1: r.s1 != null ? r.s1 : null, s2: r.s2 != null ? r.s2 : null, st: r.st || "", terrain: r.terrain || "", h: r.h || "" };
  }

  function renderScores() {
    if (!state) return;
    var creneau = selCreneau.value;
    var masquer = $("f-masquer").checked;
    var texte = ($("f-texte").value || "").trim().toLowerCase();
    var list = T.trierMatchs(T.tousLesMatchs(state)).filter(function (m) {
      if (creneau && m.slot !== creneau) return false;
      if (masquer && m.winner) return false;
      if (texte) {
        var hay = [nom(m.t1), nom(m.t2), "terrain " + m.terrain, m.group ? "poule " + m.group : ""].join(" ").toLowerCase();
        if (hay.indexOf(texte) < 0) return false;
      }
      return true;
    });
    if (!list.length) {
      $("score-list").innerHTML = '<div class="vide-etat" style="grid-column:1/-1"><h2>Aucun match</h2><p>' +
        (Object.keys(state.teams).length ? "Aucun match pour ce filtre. Les matchs apparaissent une fois les poules remplies." : "Commencez par ajouter les équipes puis tirer les poules.") + "</p></div>";
      return;
    }
    $("score-list").innerHTML = list.map(function (m) {
      var pret = m.t1 && m.t2;
      var cls = "score-card" + (m.st === "live" ? " live" : "") + (m.st === "done" ? " done" : "");
      var top = '<div class="match-top"><span>' + esc(T.slugTour(m)) + " · " + esc((m.time || "").replace(":", "h")) + '</span>' +
        '<span class="terrain">T <input data-terrain="' + m.id + '" value="' + esc(m.terrain) + '" aria-label="Terrain" inputmode="numeric"></span></div>';
      if (!pret) {
        return '<div class="' + cls + '">' + top + '<p class="muted small" style="margin:6px 0 0">En attente : ' +
          esc(m.t1 ? nom(m.t1) : "à déterminer") + " vs " + esc(m.t2 ? nom(m.t2) : "à déterminer") + "</p></div>";
      }
      function row(cote) {
        var id = cote === 1 ? m.t1 : m.t2, sc = cote === 1 ? m.s1 : m.s2;
        return '<div class="score-row"><span class="nom">' + esc(nom(id)) + '</span><span class="stepper">' +
          '<button type="button" data-step="' + m.id + '" data-cote="' + cote + '" data-d="-1" aria-label="Moins">−</button>' +
          '<input data-score="' + m.id + '" data-cote="' + cote + '" value="' + (sc == null ? "" : sc) + '" inputmode="numeric" aria-label="Score ' + esc(nom(id)) + '">' +
          '<button type="button" data-step="' + m.id + '" data-cote="' + cote + '" data-d="1" aria-label="Plus">+</button></span></div>';
      }
      var seg = '<span class="seg">' + [["", "À venir", "s-todo"], ["live", "En cours", "s-live"], ["done", "Terminé", "s-done"]].map(function (s) {
        return '<button type="button" class="' + s[2] + '" data-st="' + m.id + '" data-val="' + s[0] + '" aria-pressed="' + (m.st === s[0] ? "true" : "false") + '">' + s[1] + "</button>";
      }).join("") + "</span>";
      return '<div class="' + cls + '">' + top + row(1) + row(2) + '<div class="score-actions">' + seg + "</div></div>";
    }).join("");
  }

  function majMatch(id, changes, msg) {
    var rec = recordDe(id);
    Object.keys(changes).forEach(function (k) { rec[k] = changes[k]; });
    var upd = {};
    upd["matches/" + id] = rec;
    return save(upd, msg);
  }

  $("score-list").addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    if (b.hasAttribute("data-step")) {
      var id = b.getAttribute("data-step"), cote = b.getAttribute("data-cote"), d = +b.getAttribute("data-d");
      var rec = recordDe(id);
      var k = "s" + cote;
      var v = Math.max(0, Math.min(99, (rec[k] || 0) + d));
      var ch = {}; ch[k] = v;
      var autre = cote === "1" ? "s2" : "s1";
      if (rec[autre] == null) ch[autre] = 0;
      if (!rec.st) ch.st = "live";
      majMatch(id, ch);
    }
    if (b.hasAttribute("data-st")) {
      var mid = b.getAttribute("data-st"), val = b.getAttribute("data-val");
      var r = recordDe(mid);
      if (val === "done") {
        if (r.s1 == null || r.s2 == null) return toast("Saisissez les deux scores avant de terminer le match.", true);
        if (r.s1 === r.s2) return toast("Égalité impossible : il faut un vainqueur.", true);
        // Si le résultat d'un match de tableau change alors que le tour suivant a commencé, on prévient
      }
      majMatch(mid, { st: val }, val === "done" ? "Match terminé ✔" : null);
    }
  });
  $("score-list").addEventListener("change", function (e) {
    var el = e.target;
    if (el.hasAttribute("data-score")) {
      var id = el.getAttribute("data-score"), k = "s" + el.getAttribute("data-cote");
      var v = el.value.trim() === "" ? null : Math.max(0, Math.min(99, parseInt(el.value, 10) || 0));
      var ch = {}; ch[k] = v;
      if (!recordDe(id).st && v != null) ch.st = "live";
      majMatch(id, ch);
    }
    if (el.hasAttribute("data-terrain")) {
      majMatch(el.getAttribute("data-terrain"), { terrain: el.value.trim() }, "Terrain modifié");
    }
  });
  $("score-list").addEventListener("keydown", function (e) {
    if (e.key === "Enter" && e.target.tagName === "INPUT") e.target.blur();
  });

  /* =========================================================== ÉQUIPES */
  function nouvelId(existants) {
    var max = 0;
    Object.keys(existants).forEach(function (id) { var n = parseInt(id.replace(/\D/g, ""), 10); if (n > max) max = n; });
    return "e" + String(max + 1).padStart(2, "0");
  }

  function renderEquipes() {
    var poules = T.pouleOf(state);
    var ids = Object.keys(state.teams).sort(function (a, b) { return (parseInt(a.slice(1), 10) || 0) - (parseInt(b.slice(1), 10) || 0); });
    $("equipes-body").innerHTML = ids.length ? ids.map(function (id, i) {
      var t = state.teams[id];
      function champ(k, ph) { return '<td><input data-team="' + id + '" data-k="' + k + '" value="' + esc(t[k]) + '" placeholder="' + ph + '"></td>'; }
      return "<tr><td>" + (i + 1) + "</td>" + champ("name", "Nom") + champ("p1", "Joueur 1") + champ("p2", "Joueur 2") + champ("costume", "Déguisement") +
        "<td><b>" + (poules[id] || "—") + '</b></td><td><button class="btn btn-sm" style="background:var(--rouge-clair);color:var(--rouge)" type="button" data-suppr="' + id + '" aria-label="Supprimer">✕</button></td></tr>';
    }).join("") : '<tr><td colspan="7" class="muted" style="padding:18px">Aucune équipe pour l\'instant.</td></tr>';
  }

  $("equipes-body").addEventListener("change", function (e) {
    var el = e.target;
    if (!el.hasAttribute("data-team")) return;
    var id = el.getAttribute("data-team"), k = el.getAttribute("data-k");
    var v = el.value.trim();
    if (k === "name" && !v) { toast("Le nom de l'équipe est obligatoire.", true); el.value = state.teams[id].name; return; }
    var upd = {}; upd["teams/" + id + "/" + k] = v;
    save(upd, "Enregistré");
  });
  $("equipes-body").addEventListener("click", function (e) {
    var b = e.target.closest("[data-suppr]");
    if (!b) return;
    var id = b.getAttribute("data-suppr");
    if (!confirm("Supprimer l'équipe « " + nom(id) + " » ? Elle sera retirée des poules et des tableaux.")) return;
    var upd = {}; upd["teams/" + id] = null;
    T.LETTRES.forEach(function (L) {
      if (state.poules[L].indexOf(id) >= 0) upd["poules/" + L] = state.poules[L].map(function (x) { return x === id ? "" : x; });
    });
    ["principal", "consolante"].forEach(function (k) {
      if (state.brackets[k].indexOf(id) >= 0) upd["brackets/" + k] = state.brackets[k].map(function (x) { return x === id ? "" : x; });
    });
    save(upd, "Équipe supprimée");
  });
  $("ajout-btn").addEventListener("click", function () {
    var id = nouvelId(state.teams);
    var upd = {}; upd["teams/" + id] = { name: "Nouvelle équipe " + id.slice(1), p1: "", p2: "", costume: "" };
    save(upd, "Équipe ajoutée").then(function () { onglet = "equipes"; render(); });
  });
  $("import-btn").addEventListener("click", function () {
    var lignes = $("import-texte").value.split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
    if (!lignes.length) return toast("Collez au moins une ligne.", true);
    var existants = Object.assign({}, state.teams);
    var upd = {};
    lignes.forEach(function (l) {
      var sep = l.indexOf("\t") >= 0 ? "\t" : (l.indexOf(";") >= 0 ? ";" : ",");
      var p = l.split(sep).map(function (x) { return x.trim(); });
      if (!p[0]) return;
      var id = nouvelId(existants);
      existants[id] = true;
      upd["teams/" + id] = { name: p[0], p1: p[1] || "", p2: p[2] || "", costume: p[3] || "" };
    });
    var n = Object.keys(upd).length;
    save(upd, n + " équipe(s) ajoutée(s)").then(function () { $("import-texte").value = ""; render(); });
  });

  /* ============================================================ POULES */
  function scoresPoulesSaisis() {
    return Object.keys(state.matches).some(function (id) { return /^[A-L]-\d$/.test(id) && state.matches[id].st; });
  }
  function scoresTableauxSaisis() {
    return Object.keys(state.matches).some(function (id) { return /^[PC]/.test(id) && state.matches[id].st; });
  }
  function effacerScores(upd, regex) {
    Object.keys(state.matches).forEach(function (id) { if (regex.test(id)) upd["matches/" + id] = null; });
  }

  function renderPoules() {
    var poules = T.pouleOf(state);
    var ids = equipesTriees();
    var nonPlacees = ids.filter(function (id) { return !poules[id]; }).length;
    $("poules-info").textContent = ids.length + " équipes · " + (ids.length - nonPlacees) + " placées · " + nonPlacees + " non placées";
    $("poules-admin").innerHTML = T.LETTRES.map(function (L) {
      return '<div class="poule-admin"><h3>Poule ' + L + "</h3>" + [0, 1, 2, 3].map(function (pos) {
        var cur = state.poules[L][pos];
        return '<select class="select" data-poule="' + L + '" data-pos="' + pos + '" aria-label="Poule ' + L + " place " + (pos + 1) + '"><option value="">— vide —</option>' +
          ids.map(function (id) {
            var ailleurs = poules[id] && id !== cur ? " (poule " + poules[id] + ")" : "";
            return '<option value="' + id + '"' + (id === cur ? " selected" : "") + ">" + esc(nom(id)) + ailleurs + "</option>";
          }).join("") + "</select>";
      }).join("") + "</div>";
    }).join("");
  }

  $("poules-admin").addEventListener("change", function (e) {
    var el = e.target;
    if (!el.hasAttribute("data-poule")) return;
    var L = el.getAttribute("data-poule"), pos = +el.getAttribute("data-pos"), id = el.value;
    var poules = JSON.parse(JSON.stringify(state.poules));
    var ancien = poules[L][pos];
    // si l'équipe est déjà ailleurs, on échange
    T.LETTRES.forEach(function (M) {
      poules[M].forEach(function (x, i) { if (id && x === id && !(M === L && i === pos)) poules[M][i] = ancien || ""; });
    });
    poules[L][pos] = id;
    var upd = {};
    T.LETTRES.forEach(function (M) { if (JSON.stringify(poules[M]) !== JSON.stringify(state.poules[M])) upd["poules/" + M] = poules[M]; });
    save(upd, "Poules mises à jour").then(function () { el.blur(); });
  });

  $("tirage-btn").addEventListener("click", function () {
    var ids = Object.keys(state.teams);
    if (!ids.length) return toast("Ajoutez d'abord les équipes.", true);
    if (ids.length > 48 && !confirm(ids.length + " équipes inscrites : seules 48 seront placées. Continuer ?")) return;
    if (scoresPoulesSaisis() && !confirm("Des scores de poule ont déjà été saisis. Un nouveau tirage les effacera. Continuer ?")) return;
    if (!scoresPoulesSaisis() && !confirm("Lancer le tirage au sort des " + Math.min(48, ids.length) + " équipes dans les 12 poules ?")) return;
    var melange = ids.slice();
    for (var i = melange.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = melange[i]; melange[i] = melange[j]; melange[j] = tmp;
    }
    var upd = {};
    // Répartition en "serpentin" pour équilibrer les poules si moins de 48 équipes
    var poules = {};
    T.LETTRES.forEach(function (L) { poules[L] = ["", "", "", ""]; });
    melange.slice(0, 48).forEach(function (id, k) {
      var tour = Math.floor(k / 12), idx = k % 12;
      var L = T.LETTRES[tour % 2 === 0 ? idx : 11 - idx];
      poules[L][tour] = id;
    });
    T.LETTRES.forEach(function (L) { upd["poules/" + L] = poules[L]; });
    effacerScores(upd, /^[A-L]-\d$/);
    save(upd, "Tirage effectué 🎲");
  });
  $("vider-poules-btn").addEventListener("click", function () {
    if (!confirm("Vider toutes les poules" + (scoresPoulesSaisis() ? " et effacer les scores de poule" : "") + " ?")) return;
    var upd = {};
    T.LETTRES.forEach(function (L) { upd["poules/" + L] = ["", "", "", ""]; });
    effacerScores(upd, /^[A-L]-\d$/);
    save(upd, "Poules vidées");
  });

  /* ========================================================== TABLEAUX */
  function renderTableaux() {
    var q = T.qualification(state);
    var actives = T.LETTRES.filter(function (L) { return state.poules[L].filter(Boolean).length >= 2; });
    var finies = actives.filter(function (L) { return q.tables[L] && q.tables[L].complete; }).length;
    $("qualif-info").innerHTML = "Poules terminées : <b>" + finies + " / " + actives.length + "</b>. " +
      (q.complete ? "✅ Toutes les poules sont terminées : vous pouvez générer les tableaux." : "⏳ Attendez la fin de toutes les poules avant de générer les tableaux.");
    renderBracketAdmin("principal", q);
    renderBracketAdmin("consolante", q);
  }

  function renderBracketAdmin(kind, q) {
    var size = kind === "principal" ? T.TAILLE_PRINCIPAL : T.TAILLE_CONSOLANTE;
    var seeds = state.brackets[kind].slice();
    while (seeds.length < size) seeds.push("");
    var poules = T.pouleOf(state);
    var qualifies = (kind === "principal" ? q.principal : q.consolante).map(function (r) { return r.id; });
    var autres = equipesTriees().filter(function (id) { return qualifies.indexOf(id) < 0; });
    function options(cur) {
      function opt(id) { return '<option value="' + id + '"' + (id === cur ? " selected" : "") + ">" + esc(nom(id)) + (poules[id] ? " (" + poules[id] + ")" : "") + "</option>"; }
      return '<option value="">— exempt / vide —</option>' +
        (qualifies.length ? '<optgroup label="Qualifiées">' + qualifies.map(opt).join("") + "</optgroup>" : "") +
        '<optgroup label="Autres équipes">' + autres.map(opt).join("") + "</optgroup>";
    }
    var html = "";
    for (var i = 0; i < size / 2; i++) {
      var a = seeds[2 * i], b = seeds[2 * i + 1];
      var conflit = a && b && poules[a] && poules[a] === poules[b];
      html += '<div class="pair' + (conflit ? " conflit" : "") + '"><b>' + (i + 1) + "</b>" +
        '<select class="select" data-kind="' + kind + '" data-slot="' + (2 * i) + '" aria-label="Match ' + (i + 1) + ' équipe 1">' + options(a) + "</select>" +
        '<select class="select" data-kind="' + kind + '" data-slot="' + (2 * i + 1) + '" aria-label="Match ' + (i + 1) + ' équipe 2">' + options(b) + "</select></div>";
    }
    $("ba-" + kind).innerHTML = html;
  }

  document.querySelectorAll(".bracket-admin").forEach(function (box) {
    box.addEventListener("change", function (e) {
      var el = e.target;
      if (!el.hasAttribute("data-kind")) return;
      var kind = el.getAttribute("data-kind"), slot = +el.getAttribute("data-slot"), id = el.value;
      var size = kind === "principal" ? T.TAILLE_PRINCIPAL : T.TAILLE_CONSOLANTE;
      var seeds = state.brackets[kind].slice();
      while (seeds.length < size) seeds.push("");
      var ancien = seeds[slot];
      var j = id ? seeds.indexOf(id) : -1;
      if (j >= 0 && j !== slot) seeds[j] = ancien;   // échange
      seeds[slot] = id;
      var upd = {}; upd["brackets/" + kind] = seeds;
      save(upd, "Tableau mis à jour").then(function () { el.blur(); });
    });
  });

  $("generer-btn").addEventListener("click", function () {
    var q = T.qualification(state);
    if (!q.complete && !confirm("Toutes les poules ne sont pas terminées. Générer quand même avec le classement actuel ?")) return;
    if (scoresTableauxSaisis() && !confirm("Des scores de tableau ont déjà été saisis : ils seront effacés. Continuer ?")) return;
    var g = T.genererTableaux(state);
    var upd = { "brackets/principal": g.principal, "brackets/consolante": g.consolante };
    effacerScores(upd, /^[PC]/);
    save(upd, "Tableaux générés 🏆");
  });
  $("vider-tableaux-btn").addEventListener("click", function () {
    if (!confirm("Vider le tableau final et la consolante" + (scoresTableauxSaisis() ? " (les scores de tableau seront effacés)" : "") + " ?")) return;
    var upd = { "brackets/principal": [], "brackets/consolante": [] };
    effacerScores(upd, /^[PC]/);
    save(upd, "Tableaux vidés");
  });

  /* ========================================================== RÉGLAGES */
  function renderReglages() {
    $("public-check").checked = !!state.public;
    if (document.activeElement !== $("annonce-texte")) $("annonce-texte").value = state.annonce || "";
    $("horaires").innerHTML = CRENEAUX.map(function (c) {
      return "<label>" + c[1] + '<input class="input" type="time" data-slot="' + c[0] + '" value="' + esc(T.horaire(state, c[0])) + '"></label>';
    }).join("");
  }
  $("public-check").addEventListener("change", function () {
    save({ "public": this.checked }, this.checked ? "Direct ouvert au public" : "Direct fermé au public");
  });
  $("annonce-btn").addEventListener("click", function () { save({ annonce: $("annonce-texte").value.trim() }, "Annonce publiée"); });
  $("annonce-effacer").addEventListener("click", function () { $("annonce-texte").value = ""; save({ annonce: "" }, "Annonce effacée"); });
  $("horaires").addEventListener("change", function (e) {
    var el = e.target;
    if (!el.hasAttribute("data-slot")) return;
    var upd = {}; upd["horaires/" + el.getAttribute("data-slot")] = el.value || null;
    save(upd, "Horaire mis à jour");
  });

  $("export-btn").addEventListener("click", function () {
    var blob = new Blob([S.exportJSON()], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "tournoi.json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  });
  $("import-file").addEventListener("change", function () {
    var f = this.files[0];
    if (!f) return;
    var lecteur = new FileReader();
    lecteur.onload = function () {
      try {
        var data = JSON.parse(lecteur.result);
        if (!confirm("Remplacer toutes les données actuelles par celles du fichier ?")) return;
        S.replaceAll(data).then(function () { toast("Données importées"); });
      } catch (err) { toast("Fichier invalide : " + err.message, true); }
    };
    lecteur.readAsText(f);
    this.value = "";
  });
  $("demo-btn").addEventListener("click", function () {
    var msg = S.mode === "firebase"
      ? "ATTENTION : cela remplace les VRAIES données du tournoi (visibles par tous) par des données fictives. Continuer ?"
      : "Remplacer les données de ce navigateur par des données de démo ?";
    if (!confirm(msg)) return;
    S.replaceAll(T.demoState()).then(function () { toast("Démo chargée"); });
  });
  $("fichier-btn").addEventListener("click", function () {
    if (!confirm("Abandonner les modifications locales et recharger data/tournoi.json ?")) return;
    S.resetLocal();
    location.reload();
  });
  $("reset-btn").addEventListener("click", function () {
    if (!confirm("Tout effacer (équipes, poules, scores, tableaux) ?")) return;
    if (!confirm("Vraiment tout effacer ? Cette action est irréversible.")) return;
    S.replaceAll({ public: false, annonce: "" }).then(function () { toast("Données réinitialisées"); });
  });
})();
