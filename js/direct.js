/* Page "Direct" : programme, poules, tableau final, consolante, équipes */
(function () {
  "use strict";
  var T = window.Tournoi, S = window.TournoiStore, esc = T.esc;
  var $ = function (id) { return document.getElementById(id); };

  var state = null;
  var onglet = "programme";
  var filtre = "avenir";
  var KEY_EQUIPE = "tournoi-mon-equipe";
  var monEquipe = "";
  try { monEquipe = localStorage.getItem(KEY_EQUIPE) || ""; } catch (e) { /* navigation privée */ }

  /* ------------------------------------------------------------ helpers */
  function fmtH(h) { return h ? h.replace(/^0/, "").replace(":", "h") : ""; }
  function nom(id) { return T.teamName(state, id); }

  function ligne(m, cote) {
    var id = cote === 1 ? m.t1 : m.t2;
    var sc = cote === 1 ? m.s1 : m.s2;
    var cls = "ligne-equipe";
    if (m.winner && m.winner !== T.BYE) cls += m.winner === id ? " gagnant" : " perdant";
    var label = id ? esc(nom(id)) : '<span class="tbd">À déterminer</span>';
    var montrerScore = (m.st === "live" || m.st === "done") && sc != null && !m.bye;
    return '<div class="' + cls + '"><span class="nom">' + label + (id && id === monEquipe ? " ⭐" : "") +
      '</span><span class="score">' + (montrerScore ? sc : "") + "</span></div>";
  }

  function etat(m) {
    if (m.st === "live") return '<span class="etat etat-live"><span class="dot dot-live"></span> En cours</span>';
    if (m.winner) return '<span class="etat etat-done">Terminé</span>';
    return '<span class="etat">' + (m.time ? fmtH(m.time) : "À venir") + "</span>";
  }

  function carteMatch(m, opts) {
    opts = opts || {};
    var cls = "match";
    if (m.st === "live") cls += " live";
    if (monEquipe && (m.t1 === monEquipe || m.t2 === monEquipe)) cls += " mine";
    var contexte = opts.contexte === false ? "" : " · " + esc(opts.contexte || T.slugTour(m));
    return '<article class="' + cls + '"><div class="match-top">' + etat(m) + contexte +
      (m.terrain ? '<span class="terrain">Terrain ' + esc(m.terrain) + "</span>" : "") + "</div>" +
      ligne(m, 1) + ligne(m, 2) + "</article>";
  }

  /* -------------------------------------------------------------- statut */
  S.onStatus(function (s) {
    var el = $("statut");
    var map = {
      direct: ['<span class="dot dot-live"></span> En direct', ""],
      reconnexion: ['<span class="dot" style="color:var(--soleil-fonce)"></span> Reconnexion…', ""],
      fichier: ['<span class="dot" style="color:var(--vert)"></span> Actualisation automatique', ""],
      demo: ['<span class="dot" style="color:var(--soleil-fonce)"></span> Mode démo (données fictives)', ""],
      "hors-ligne": ['<span class="dot" style="color:var(--gris)"></span> Hors ligne : nouvel essai dans 20 s', ""],
      erreur: ['<span class="dot" style="color:var(--rouge)"></span> Connexion impossible', ""]
    };
    el.innerHTML = (map[s] || map.fichier)[0];
  });

  /* -------------------------------------------------------------- onglets */
  var tabs = document.querySelectorAll(".tab");
  function choisirOnglet(nomOnglet, scroll) {
    if (!$("panel-" + nomOnglet)) nomOnglet = "programme";
    onglet = nomOnglet;
    tabs.forEach(function (t) { t.setAttribute("aria-selected", t.getAttribute("data-tab") === nomOnglet ? "true" : "false"); });
    document.querySelectorAll(".panel").forEach(function (p) { p.classList.toggle("hidden", p.id !== "panel-" + nomOnglet); });
    try { history.replaceState(null, "", location.pathname + location.search + "#" + nomOnglet); } catch (e) { /* cadre restreint */ }
    if (scroll) {
      var top = document.querySelector(".tabs").getBoundingClientRect().top + window.scrollY - 64;
      if (window.scrollY > top) window.scrollTo(0, top);
    }
  }
  tabs.forEach(function (t) { t.addEventListener("click", function () { choisirOnglet(t.getAttribute("data-tab"), true); }); });
  choisirOnglet((location.hash || "#programme").slice(1), false);

  $("filtres").addEventListener("click", function (e) {
    var b = e.target.closest(".chip");
    if (!b) return;
    filtre = b.getAttribute("data-f");
    majChips();
    renderProgramme();
  });
  function majChips() {
    document.querySelectorAll("#filtres .chip").forEach(function (c) { c.setAttribute("aria-pressed", c.getAttribute("data-f") === filtre ? "true" : "false"); });
  }

  $("mon-equipe").addEventListener("change", function () { suivre(this.value); });
  function suivre(id) {
    monEquipe = id;
    try { if (id) localStorage.setItem(KEY_EQUIPE, id); else localStorage.removeItem(KEY_EQUIPE); } catch (e) { /* ignore */ }
    if (!id && filtre === "moi") { filtre = "avenir"; majChips(); }
    render();
  }

  $("recherche").addEventListener("input", renderEquipes);
  $("equipes-liste").addEventListener("click", function (e) {
    var c = e.target.closest("[data-team]");
    if (c) { suivre(c.getAttribute("data-team")); window.scrollTo({ top: 0, behavior: "smooth" }); }
  });

  /* ------------------------------------------------------------- rendu */
  function render() {
    if (!state) return;
    var ouvert = state.public || S.mode === "demo";
    $("ferme").classList.toggle("hidden", ouvert);
    $("ouvert").classList.toggle("hidden", !ouvert);
    $("annonce").classList.toggle("hidden", !state.annonce);
    $("annonce-texte").textContent = state.annonce || "";
    $("maj").textContent = state.updatedAt ? "Mis à jour à " + new Date(state.updatedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "";
    if (!ouvert) return;
    if (monEquipe && !state.teams[monEquipe]) monEquipe = "";
    renderSelect();
    renderSuivi();
    renderProgramme();
    renderPoules();
    renderTableau("principal", "tableau-liste");
    renderTableau("consolante", "consolante-liste");
    renderEquipes();
  }

  function equipesTriees() {
    return Object.keys(state.teams).sort(function (a, b) { return nom(a).localeCompare(nom(b), "fr"); });
  }

  function renderSelect() {
    var sel = $("mon-equipe");
    var html = '<option value="">Choisir une équipe…</option>' + equipesTriees().map(function (id) {
      return '<option value="' + esc(id) + '"' + (id === monEquipe ? " selected" : "") + ">" + esc(nom(id)) + "</option>";
    }).join("");
    if (sel.innerHTML !== html) sel.innerHTML = html;
    sel.value = monEquipe;
    document.querySelector('[data-f="moi"]').classList.toggle("hidden", !monEquipe);
  }

  function renderSuivi() {
    var box = $("suivi-info");
    if (!monEquipe) { box.innerHTML = ""; return; }
    var t = state.teams[monEquipe];
    var poule = T.pouleOf(state)[monEquipe];
    var tous = T.trierMatchs(T.tousLesMatchs(state)).filter(function (m) { return m.t1 === monEquipe || m.t2 === monEquipe; });
    var prochain = tous.filter(function (m) { return !m.winner; })[0];
    var joues = tous.filter(function (m) { return m.winner; });
    var v = joues.filter(function (m) { return m.winner === monEquipe; }).length;
    var kpis = [];
    if (t.p1 || t.p2) kpis.push("👥 " + esc([t.p1, t.p2].filter(Boolean).join(" & ")));
    if (poule) {
      var st = T.standings(state, poule);
      var row = st.rows.filter(function (r) { return r.id === monEquipe; })[0];
      kpis.push("Poule <b>" + poule + "</b>" + (row && row.j ? " · " + row.rang + "<sup>e</sup>" : ""));
    }
    kpis.push("<b>" + v + "</b> V · <b>" + (joues.length - v) + "</b> D");
    var q = T.qualification(state);
    if (state.brackets.principal.indexOf(monEquipe) >= 0) kpis.push("🏆 Tableau final");
    else if (state.brackets.consolante.indexOf(monEquipe) >= 0) kpis.push("🎉 Consolante");
    else if (q.complete && q.statut[monEquipe]) kpis.push(q.statut[monEquipe] === "principal" ? "🏆 Qualifiée pour le tableau final" : "🎉 Qualifiée pour la consolante");
    ["principal", "consolante"].forEach(function (k) {
      var p = T.bracket(state, k).podium;
      var titre = k === "principal" ? "du tableau final" : "de la consolante";
      if (p.first === monEquipe) kpis.push("🥇 Vainqueur " + titre);
      else if (p.second === monEquipe) kpis.push("🥈 2e " + titre);
      else if (p.third === monEquipe) kpis.push("🥉 3e " + titre);
    });

    var html = '<div class="suivi-kpis">' + kpis.map(function (k) { return '<span class="kpi">' + k + "</span>"; }).join("") + "</div>";
    if (prochain && prochain.t1 && prochain.t2) {
      html += "<div><b>" + (prochain.st === "live" ? "Match en cours" : "Prochain match") + "</b>" +
        (prochain.time ? " · " + fmtH(prochain.time) : "") + "</div>" + carteMatch(prochain);
    } else if (prochain) {
      html += '<p class="muted small" style="margin:0">Prochain match : ' + esc(T.slugTour(prochain)) +
        (prochain.time ? " à " + fmtH(prochain.time) : "") + " — adversaire à déterminer.</p>";
    } else if (joues.length) {
      html += '<p class="muted small" style="margin:0">Plus de match à jouer. Merci et bravo&nbsp;! 👏</p>';
    }
    box.innerHTML = html;
  }

  function renderProgramme() {
    if (!state) return;
    var list = T.trierMatchs(T.tousLesMatchs(state));
    var live = list.filter(function (m) { return m.st === "live"; });
    var liveChip = document.querySelector('[data-f="live"]');
    liveChip.innerHTML = '<span class="dot dot-live"></span> En cours' + (live.length ? ' <span class="count">' + live.length + "</span>" : "");

    var f = list.filter(function (m) {
      if (filtre === "live") return m.st === "live";
      if (filtre === "avenir") return !m.winner;
      if (filtre === "fini") return !!m.winner;
      if (filtre === "moi") return m.t1 === monEquipe || m.t2 === monEquipe;
      return true;
    });
    if (!f.length) {
      $("programme-liste").innerHTML = '<div class="vide-etat"><h2>Aucun match</h2><p>' +
        (filtre === "live" ? "Aucun match n'est en cours pour le moment." : "Aucun match ne correspond à ce filtre.") + "</p></div>";
      return;
    }
    var groupes = [];
    f.forEach(function (m) {
      var cle = m.time || "—";
      var g = groupes[groupes.length - 1];
      if (!g || g.cle !== cle) { g = { cle: cle, matchs: [], labels: [] }; groupes.push(g); }
      g.matchs.push(m);
      var l = m.phase === "poule" ? "Poules · " + m.roundLabel.toLowerCase() : (m.phase === "consolante" ? "Consolante · " : "") + m.roundLabel;
      if (g.labels.indexOf(l) < 0) g.labels.push(l);
    });
    $("programme-liste").innerHTML = groupes.map(function (g) {
      return '<section class="creneau"><div class="creneau-head"><time>' + esc(fmtH(g.cle)) + "</time><span>" +
        esc(g.labels.join(" · ")) + '</span></div><div class="matchs">' +
        g.matchs.map(function (m) { return carteMatch(m, { contexte: m.phase === "poule" ? "Poule " + m.group : (m.phase === "principal" ? "Tableau · " : "Conso · ") + m.roundLabel }); }).join("") +
        "</div></section>";
    }).join("");
  }

  function renderPoules() {
    var q = T.qualification(state);
    var actives = T.LETTRES.filter(function (L) { return state.poules[L].some(Boolean); });
    if (!actives.length) {
      $("poules-liste").innerHTML = '<div class="vide-etat"><h2>Poules à venir</h2><p>Le tirage au sort des poules aura lieu après le pointage des équipes.</p></div>';
      return;
    }
    var html = '<div class="poules-grid">' + actives.map(function (L) {
      var st = T.standings(state, L);
      var etatPoule = st.complete ? "Terminée" : (st.started ? "En cours" : "À venir");
      var rows = st.rows.map(function (r) {
        var badge = "";
        if (st.complete) {
          var s = q.complete ? q.statut[r.id] : (r.rang <= 2 ? "principal" : (r.rang === 4 ? "consolante" : ""));
          if (s === "principal") badge = '<span class="q q-p">TABLEAU</span>';
          else if (s === "consolante") badge = '<span class="q q-c">CONSO</span>';
        }
        return "<tr" + (r.id === monEquipe ? ' class="mine"' : "") + '><td class="rang">' + r.rang + '</td><td class="eq" title="' + esc(nom(r.id)) + '">' +
          esc(nom(r.id)) + badge + "</td><td>" + r.v + "</td><td>" + r.d + "</td><td>" + (r.diff > 0 ? "+" : "") + r.diff + "</td></tr>";
      }).join("");
      var matchs = "";
      var tourPrec = 0;
      st.matches.forEach(function (m) {
        if (m.round !== tourPrec) { matchs += '<div class="pm-tour">Tour ' + m.round + (m.time ? " · " + fmtH(m.time) : "") + " · terrains " + esc(terrainsTour(st.matches, m.round)) + "</div>"; tourPrec = m.round; }
        var score = m.st === "live" || m.st === "done" ? (m.s1 == null ? "" : m.s1) + " – " + (m.s2 == null ? "" : m.s2) : "vs";
        matchs += '<div class="pm"><span class="a' + (m.winner === m.t1 ? " w" : "") + '">' + esc(nom(m.t1)) + '</span><span class="s' + (m.st === "live" ? " live" : "") + '">' + score +
          '</span><span class="b' + (m.winner === m.t2 ? " w" : "") + '">' + esc(nom(m.t2)) + "</span></div>";
      });
      return '<article class="poule"><div class="poule-head"><h3>Poule ' + L + "</h3><span>" + etatPoule + '</span></div>' +
        '<table class="classement"><thead><tr><th>#</th><th>Équipe</th><th>V</th><th>D</th><th>+/-</th></tr></thead><tbody>' + rows + "</tbody></table>" +
        '<div class="poule-matchs">' + matchs + "</div></article>";
    }).join("") + "</div>";

    if (q.troisiemes.length) {
      html += '<div class="troisiemes"><h2>Classement des 3es de poule</h2><p class="muted">Les ' + q.nbTroisiemes +
        " meilleurs 3es rejoignent le tableau final, les autres la consolante." + (q.complete ? "" : " Classement provisoire.") + '</p><div class="card table-scroll" style="border:0">' +
        '<table class="classement"><thead><tr><th>#</th><th>Équipe</th><th>Poule</th><th>V</th><th>+/-</th><th>Pts</th></tr></thead><tbody>' +
        q.troisiemes.map(function (r, i) {
          var cls = (i === q.nbTroisiemes - 1 ? "coupure" : "") + (r.id === monEquipe ? " mine" : "");
          return '<tr class="' + cls + '"><td class="rang">' + (i + 1) + '</td><td class="eq">' + esc(nom(r.id)) +
            (i < q.nbTroisiemes ? ' <span class="q q-p">TABLEAU</span>' : ' <span class="q q-c">CONSO</span>') + "</td><td>" + r.poule + "</td><td>" + r.v + "</td><td>" +
            (r.diff > 0 ? "+" : "") + r.diff + "</td><td>" + r.pp + "</td></tr>";
        }).join("") + "</tbody></table></div></div>";
    }
    $("poules-liste").innerHTML = html;
  }

  function terrainsTour(matches, tour) {
    return matches.filter(function (m) { return m.round === tour; }).map(function (m) { return m.terrain; }).join(" & ");
  }

  function renderTableau(kind, cible) {
    var el = $(cible);
    var ancien = el.querySelector(".bracket-scroll");
    var scrollLeft = ancien ? ancien.scrollLeft : 0;
    var b = T.bracket(state, kind);
    var principal = kind === "principal";
    var html = "";
    if (!b.generated) {
      html += '<div class="alerte alerte-info">' + (principal
        ? "Le tableau final (32 équipes) sera publié à la fin des poules : 1ers et 2es de poule + les 8 meilleurs 3es."
        : "La consolante (16 équipes) sera publiée à la fin des poules : les 4 autres 3es et les 4es de poule.") + "</div>";
    }
    html += '<p class="scroll-hint">Faites glisser horizontalement pour voir tout le tableau →</p>';
    html += '<div class="bracket-scroll"><div class="bracket">' + b.rounds.map(function (r, i) {
      var h = r.matches[0] && r.matches[0].time;
      return '<div class="b-round' + (i === b.rounds.length - 1 ? " b-final" : "") + '"><h3>' + esc(r.name) + (h ? "<time>" + fmtH(h) + "</time>" : "") + '</h3><div class="b-matches">' +
        r.matches.map(function (m) {
          return '<div class="b-cell">' + carteMatch(m, { contexte: false }) + "</div>";
        }).join("") + "</div></div>";
    }).join("") + "</div></div>";

    var p = b.podium;
    var medaille = function (rang, id) {
      return '<div class="p' + rang + '"><span class="medaille">' + rang + "</span>" + (id && id !== T.BYE ? esc(nom(id)) : '<span class="tbd">À déterminer</span>') + "</div>";
    };
    html += '<div class="bracket-extra">' +
      '<div class="extra-card"><h3>Match pour la 3e place' + (b.third.time ? " · " + fmtH(b.third.time) : "") + "</h3>" + carteMatch(b.third, { contexte: false }) + "</div>" +
      '<div class="extra-card"><h3>Podium ' + (principal ? "du tableau final" : "de la consolante") + '</h3><div class="podium-live">' +
      medaille(1, p.first) + medaille(2, p.second) + medaille(3, p.third) + "</div></div></div>";
    el.innerHTML = html;
    var nouveau = el.querySelector(".bracket-scroll");
    if (nouveau && scrollLeft) nouveau.scrollLeft = scrollLeft;
  }

  function renderEquipes() {
    if (!state) return;
    var qStr = ($("recherche").value || "").trim().toLowerCase();
    var poules = T.pouleOf(state);
    var ids = equipesTriees().filter(function (id) {
      if (!qStr) return true;
      var t = state.teams[id];
      return [t.name, t.p1, t.p2, t.costume].join(" ").toLowerCase().indexOf(qStr) >= 0;
    });
    var total = Object.keys(state.teams).length;
    if (!total) {
      $("equipes-liste").innerHTML = '<div class="vide-etat"><h2>Pas encore d\'équipes</h2><p>La liste des équipes apparaîtra ici.</p></div>';
      return;
    }
    $("equipes-liste").innerHTML = '<p class="muted small">' + total + " équipe" + (total > 1 ? "s" : "") + " · touchez une équipe pour la suivre</p>" +
      '<div class="equipes-grid">' + ids.map(function (id) {
        var t = state.teams[id];
        var L = poules[id];
        var details = [t.p1, t.p2].filter(Boolean).join(" & ");
        return '<button type="button" class="equipe' + (id === monEquipe ? " mine" : "") + '" data-team="' + esc(id) + '" style="text-align:left;cursor:pointer;font:inherit;color:inherit">' +
          '<span class="badge-poule' + (L ? "" : " vide") + '">' + (L || "?") + "</span><span><b>" + esc(t.name) + "</b>" +
          (details ? "<span>" + esc(details) + "</span>" : "") + (t.costume ? "<span> · 🎭 " + esc(t.costume) + "</span>" : "") + "</span></button>";
      }).join("") + "</div>";
  }

  S.subscribe(function (s) { state = s; render(); });
  S.start();
})();
