/* ==========================================================================
   Moteur du tournoi : poules, classements, qualification, tableaux.
   Aucune dépendance : fonctionne côté public comme côté organisateurs.
   ========================================================================== */
(function () {
  "use strict";

  var LETTRES = "ABCDEFGHIJKL".split("");
  var TAILLE_POULE = 4;
  var TAILLE_PRINCIPAL = 32;   // tableau final : 16e de finale
  var TAILLE_CONSOLANTE = 16;  // consolante : 8e de finale
  var BYE = "__exempt__";

  // Ordre des rencontres dans une poule de 4 (positions 0..3) : 3 tours, 2 matchs par tour
  var RENCONTRES_POULE = [
    [0, 1], [2, 3],   // tour 1
    [0, 2], [1, 3],   // tour 2
    [0, 3], [1, 2]    // tour 3
  ];

  var ORDRE_CRENEAUX = ["poule1", "poule2", "poule3", "P1", "C1", "P2", "C2", "P3", "C3", "P4", "C4", "P5"];

  /* ------------------------------------------------------------------ utils */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function toArray(x, n) {
    var out = [];
    if (Array.isArray(x)) out = x.slice();
    else if (x && typeof x === "object") {
      Object.keys(x).forEach(function (k) { if (/^\d+$/.test(k)) out[+k] = x[k]; });
    }
    if (n != null) { out.length = Math.max(out.length, n); out = out.slice(0, n); }
    for (var i = 0; i < out.length; i++) if (out[i] == null) out[i] = "";
    return out;
  }

  function num(v) {
    if (v === "" || v == null) return null;
    var n = Number(v);
    return isFinite(n) ? n : null;
  }

  /* ------------------------------------------------------------------ état */
  function emptyState() {
    var poules = {};
    LETTRES.forEach(function (L) { poules[L] = ["", "", "", ""]; });
    return {
      public: false,
      annonce: "",
      teams: {},
      poules: poules,
      matches: {},
      brackets: { principal: [], consolante: [] },
      horaires: {},
      updatedAt: 0
    };
  }

  function normalize(raw) {
    var s = emptyState();
    if (!raw || typeof raw !== "object") return s;
    s.public = !!raw.public;
    s.annonce = raw.annonce || "";
    s.updatedAt = raw.updatedAt || 0;
    s.teams = {};
    if (raw.teams && typeof raw.teams === "object") {
      Object.keys(raw.teams).forEach(function (id) {
        var t = raw.teams[id];
        if (t && typeof t === "object") {
          s.teams[id] = { name: t.name || id, p1: t.p1 || "", p2: t.p2 || "", costume: t.costume || "" };
        }
      });
    }
    LETTRES.forEach(function (L) {
      var arr = toArray(raw.poules && raw.poules[L], TAILLE_POULE);
      s.poules[L] = arr.map(function (id) { return s.teams[id] ? id : ""; });
    });
    s.matches = {};
    if (raw.matches && typeof raw.matches === "object") {
      Object.keys(raw.matches).forEach(function (id) {
        var m = raw.matches[id] || {};
        s.matches[id] = {
          s1: num(m.s1), s2: num(m.s2),
          st: m.st === "live" || m.st === "done" ? m.st : "",
          terrain: m.terrain || "", h: m.h || ""
        };
      });
    }
    var b = raw.brackets || {};
    s.brackets = {
      principal: toArray(b.principal).slice(0, TAILLE_PRINCIPAL),
      consolante: toArray(b.consolante).slice(0, TAILLE_CONSOLANTE)
    };
    s.horaires = raw.horaires && typeof raw.horaires === "object" ? Object.assign({}, raw.horaires) : {};
    return s;
  }

  function horaire(state, creneau) {
    var cfg = (window.TOURNOI_CONFIG && window.TOURNOI_CONFIG.horaires) || {};
    return (state.horaires && state.horaires[creneau]) || cfg[creneau] || "";
  }

  function teamName(state, id) {
    if (!id) return "";
    if (id === BYE) return "Exempt";
    var t = state.teams[id];
    return t ? t.name : "?";
  }

  function pouleOf(state) {
    var map = {};
    LETTRES.forEach(function (L) { state.poules[L].forEach(function (id) { if (id) map[id] = L; }); });
    return map;
  }

  /* ------------------------------------------------------------- matchs */
  function finalizeMatch(state, m) {
    var rec = state.matches[m.id] || {};
    m.s1 = rec.s1 != null ? rec.s1 : null;
    m.s2 = rec.s2 != null ? rec.s2 : null;
    m.st = rec.st || "";
    if (rec.terrain) m.terrain = rec.terrain;
    m.time = rec.h || horaire(state, m.slot);
    m.winner = null; m.loser = null; m.bye = false;

    if (m.t1 === BYE || m.t2 === BYE) {
      m.bye = true;
      if (m.t1 === BYE && m.t2 === BYE) { m.winner = BYE; m.loser = BYE; m.st = "done"; }
      else if (m.t1 && m.t2) {
        m.winner = m.t1 === BYE ? m.t2 : m.t1;
        m.loser = BYE; m.st = "done";
      }
      return m;
    }
    if (m.t1 && m.t2 && m.st === "done" && m.s1 != null && m.s2 != null && m.s1 !== m.s2) {
      m.winner = m.s1 > m.s2 ? m.t1 : m.t2;
      m.loser = m.s1 > m.s2 ? m.t2 : m.t1;
    }
    return m;
  }

  function pouleMatches(state, L) {
    var ids = state.poules[L];
    var k = LETTRES.indexOf(L);
    var out = [];
    RENCONTRES_POULE.forEach(function (pair, i) {
      var t1 = ids[pair[0]], t2 = ids[pair[1]];
      if (!t1 || !t2) return;
      var tour = Math.floor(i / 2) + 1;
      out.push(finalizeMatch(state, {
        id: L + "-" + (i + 1), phase: "poule", group: L, round: tour,
        slot: "poule" + tour, label: "Poule " + L, roundLabel: "Tour " + tour,
        t1: t1, t2: t2, terrain: String(2 * k + 1 + (i % 2))
      }));
    });
    return out;
  }

  function nomTour(nbMatchs) {
    return ({ 16: "16e de finale", 8: "8e de finale", 4: "Quarts de finale", 2: "Demi-finales", 1: "Finale" })[nbMatchs] || ("Tour de " + nbMatchs * 2);
  }

  function bracket(state, kind) {
    var principal = kind === "principal";
    var size = principal ? TAILLE_PRINCIPAL : TAILLE_CONSOLANTE;
    var prefix = principal ? "P" : "C";
    var terrainBase = principal ? 1 : 17;
    var seeds = state.brackets[kind] || [];
    var generated = seeds.some(function (x) { return !!x; });
    var rounds = [];
    var nbRounds = Math.round(Math.log(size) / Math.LN2);

    for (var r = 1; r <= nbRounds; r++) {
      var n = size / Math.pow(2, r);
      var list = [];
      for (var i = 0; i < n; i++) {
        var t1, t2;
        if (r === 1) {
          t1 = seeds[2 * i] || (generated ? BYE : null);
          t2 = seeds[2 * i + 1] || (generated ? BYE : null);
        } else {
          t1 = rounds[r - 2].matches[2 * i].winner;
          t2 = rounds[r - 2].matches[2 * i + 1].winner;
        }
        list.push(finalizeMatch(state, {
          id: prefix + r + "-" + (i + 1), phase: kind, round: r, index: i,
          slot: prefix + r, label: principal ? "Tableau final" : "Consolante",
          roundLabel: nomTour(n), t1: t1, t2: t2, terrain: String(terrainBase + i)
        }));
      }
      rounds.push({ name: nomTour(n), slot: prefix + r, matches: list });
    }

    var semis = rounds[nbRounds - 2].matches;
    var finale = rounds[nbRounds - 1].matches[0];
    var petiteFinale = finalizeMatch(state, {
      id: prefix + "3e", phase: kind, round: nbRounds, index: 1, third: true,
      slot: prefix + nbRounds, label: principal ? "Tableau final" : "Consolante",
      roundLabel: "Match pour la 3e place",
      t1: semis[0].loser, t2: semis[1].loser, terrain: String(terrainBase + 1)
    });

    var podium = {
      first: finale.winner, second: finale.loser, third: petiteFinale.winner
    };
    return { kind: kind, size: size, generated: generated, rounds: rounds, third: petiteFinale, final: finale, podium: podium };
  }

  /* ----------------------------------------------------------- classements */
  function statsVide(id) { return { id: id, j: 0, v: 0, d: 0, pp: 0, pc: 0, diff: 0 }; }

  function comparerGlobal(a, b) {
    return (b.v - a.v) || (b.diff - a.diff) || (b.pp - a.pp);
  }

  function standings(state, L) {
    var ids = state.poules[L].filter(Boolean);
    var rows = {};
    ids.forEach(function (id) { rows[id] = statsVide(id); });
    var matches = pouleMatches(state, L);
    var complete = matches.length > 0;
    var started = false;
    matches.forEach(function (m) {
      if (m.st !== "done" || m.s1 == null || m.s2 == null) { complete = false; if (m.st === "live") started = true; return; }
      started = true;
      var a = rows[m.t1], b = rows[m.t2];
      a.j++; b.j++;
      a.pp += m.s1; a.pc += m.s2; b.pp += m.s2; b.pc += m.s1;
      if (m.s1 > m.s2) { a.v++; b.d++; } else if (m.s2 > m.s1) { b.v++; a.d++; }
    });
    var list = ids.map(function (id) { var r = rows[id]; r.diff = r.pp - r.pc; r.poule = L; return r; });
    list.sort(function (a, b) {
      var c = comparerGlobal(a, b);
      if (c) return c;
      // confrontation directe
      for (var i = 0; i < matches.length; i++) {
        var m = matches[i];
        if (m.winner && ((m.t1 === a.id && m.t2 === b.id) || (m.t1 === b.id && m.t2 === a.id))) {
          return m.winner === a.id ? -1 : 1;
        }
      }
      return teamName(state, a.id).localeCompare(teamName(state, b.id));
    });
    list.forEach(function (r, i) { r.rang = i + 1; });
    return { poule: L, rows: list, matches: matches, complete: complete, started: started };
  }

  function poulesActives(state) {
    return LETTRES.filter(function (L) { return state.poules[L].filter(Boolean).length >= 2; });
  }

  function qualification(state) {
    var parRang = [[], [], [], []];
    var complete = true;
    var actives = poulesActives(state);
    if (!actives.length) complete = false;
    var tables = {};
    actives.forEach(function (L) {
      var st = standings(state, L);
      tables[L] = st;
      if (!st.complete) complete = false;
      st.rows.forEach(function (r, i) { if (parRang[i]) parRang[i].push(r); });
    });
    parRang.forEach(function (list) { list.sort(comparerGlobal); });
    var directs = parRang[0].concat(parRang[1]);
    var nbTroisiemes = Math.max(0, Math.min(parRang[2].length, TAILLE_PRINCIPAL - directs.length));
    var principal = directs.concat(parRang[2].slice(0, nbTroisiemes)).slice(0, TAILLE_PRINCIPAL);
    var consolante = parRang[2].slice(nbTroisiemes).concat(parRang[3]).slice(0, TAILLE_CONSOLANTE);
    var statut = {};
    principal.forEach(function (r) { statut[r.id] = "principal"; });
    consolante.forEach(function (r) { statut[r.id] = "consolante"; });
    return {
      complete: complete, tables: tables, troisiemes: parRang[2], nbTroisiemes: nbTroisiemes,
      principal: principal, consolante: consolante, statut: statut
    };
  }

  /* -------------------------------------------------------- tirage tableau */
  function ordreTetesDeSerie(n) {
    var o = [1, 2];
    while (o.length < n) {
      var m = o.length * 2;
      o = o.reduce(function (acc, s) { acc.push(s, m + 1 - s); return acc; }, []);
    }
    return o;
  }

  function eviterMemePoule(slots, poule) {
    var nbPaires = slots.length / 2;
    for (var pass = 0; pass < 3; pass++) {
      for (var i = 0; i < nbPaires; i++) {
        var a = slots[2 * i], b = slots[2 * i + 1];
        if (!a || !b || poule[a] !== poule[b]) continue;
        var fait = false;
        for (var d = 1; d < nbPaires && !fait; d++) {
          [i + d, i - d].forEach(function (j) {
            if (fait || j < 0 || j >= nbPaires) return;
            var a2 = slots[2 * j], c = slots[2 * j + 1];
            if (!c || poule[c] === poule[a]) return;
            if (a2 && poule[a2] === poule[b]) return;
            slots[2 * i + 1] = c; slots[2 * j + 1] = b; fait = true;
          });
        }
      }
    }
    return slots;
  }

  function placer(listeClassee, size, poule) {
    var ordre = ordreTetesDeSerie(size);
    var slots = ordre.map(function (seed) { var r = listeClassee[seed - 1]; return r ? r.id : ""; });
    return eviterMemePoule(slots, poule);
  }

  function genererTableaux(state) {
    var q = qualification(state);
    var poule = pouleOf(state);
    return {
      qualification: q,
      principal: placer(q.principal, TAILLE_PRINCIPAL, poule),
      consolante: placer(q.consolante, TAILLE_CONSOLANTE, poule)
    };
  }

  /* ------------------------------------------------------- vue d'ensemble */
  function tousLesMatchs(state) {
    var out = [];
    LETTRES.forEach(function (L) { out = out.concat(pouleMatches(state, L)); });
    ["principal", "consolante"].forEach(function (k) {
      var b = bracket(state, k);
      b.rounds.forEach(function (r) { out = out.concat(r.matches); });
      out.push(b.third);
    });
    return out.filter(function (m) { return !(m.bye); });
  }

  function trierMatchs(list) {
    return list.slice().sort(function (a, b) {
      var ta = a.time || "99:99", tb = b.time || "99:99";
      if (ta !== tb) return ta < tb ? -1 : 1;
      var sa = ORDRE_CRENEAUX.indexOf(a.slot), sb = ORDRE_CRENEAUX.indexOf(b.slot);
      if (sa !== sb) return sa - sb;
      return (parseInt(a.terrain, 10) || 999) - (parseInt(b.terrain, 10) || 999);
    });
  }

  function slugTour(m) {
    return m.phase === "poule" ? ("Poule " + m.group + " · " + m.roundLabel) : (m.label + " · " + m.roundLabel);
  }

  /* ---------------------------------------------------------------- démo */
  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var NOMS_DEMO = [
    "Les Boules à Facettes", "Les Pointeurs Fous", "Tire-Bouchons", "Les Cochonnets Masqués",
    "Fanny & Clyde", "Les Carreaux d'As", "Les Mènes en Blanc", "Les Bérets Rouges",
    "Pétanque & Paillettes", "Les Tireurs d'Élite", "Les Pieds Tanqués", "Les Licornes du Carreau",
    "Team Mistral", "Les Supers Pointeurs", "Les Rois du Bouchon", "Boule de Neige",
    "Les Pirates du Rond", "Les Shérifs du Cercle", "Les Moustaches d'Or", "Les Flamands Roses",
    "Les Cow-boys STAPS", "Les Astronautes", "Les Dinos Tireurs", "Les Super Mamies",
    "Les Fées Clochettes", "Les Gladiateurs", "Les Vikings du Creusot", "Les Bananes en Pyjama",
    "Les Pingouins Pointeurs", "Les Schtroumpfs Tireurs", "Les Ninjas du Terrain", "Les Abeilles",
    "Les Chevaliers du Rond", "Les Hippies du Bouchon", "Les Momies", "Les Pompiers",
    "Les Mariés de l'Année", "Les Toreros", "Les Chats Bottés", "Les Rockeurs",
    "Les Clowns Pointus", "Les Lutins", "Les Marins d'Eau Douce", "Les Zombies",
    "Les Surfeurs", "Les Petits Princes", "Les Cuistots", "Les Profs de Sport"
  ];
  var PRENOMS = ["Léa", "Tom", "Inès", "Hugo", "Manon", "Lucas", "Chloé", "Nathan", "Jade", "Théo",
    "Camille", "Enzo", "Sarah", "Louis", "Emma", "Maxime", "Lina", "Noah", "Clara", "Jules",
    "Zoé", "Arthur", "Lola", "Mathis", "Anaïs", "Paul", "Eva", "Raphaël", "Julie", "Yanis"];
  var COSTUMES = ["Disco", "Pirates", "Super-héros", "Cow-boys", "Années 80", "Astronautes",
    "Licornes", "Vikings", "Hawaïens", "Gladiateurs", "Pyjama", "Animaux"];

  function scoreAleatoire(rand) {
    var perdant = Math.floor(rand() * 12);
    return rand() < 0.5 ? [13, perdant] : [perdant, 13];
  }

  function demoState() {
    var rand = rng(18032027);
    var s = emptyState();
    s.public = true;
    s.annonce = "Démo : les données affichées sont fictives.";
    var ids = [];
    NOMS_DEMO.forEach(function (nom, i) {
      var id = "e" + String(i + 1).padStart(2, "0");
      ids.push(id);
      s.teams[id] = {
        name: nom,
        p1: PRENOMS[Math.floor(rand() * PRENOMS.length)],
        p2: PRENOMS[Math.floor(rand() * PRENOMS.length)],
        costume: COSTUMES[Math.floor(rand() * COSTUMES.length)]
      };
    });
    var melange = ids.slice().sort(function () { return rand() - 0.5; });
    LETTRES.forEach(function (L, k) { s.poules[L] = melange.slice(k * 4, k * 4 + 4); });
    LETTRES.forEach(function (L) {
      pouleMatches(s, L).forEach(function (m) {
        var sc = scoreAleatoire(rand);
        s.matches[m.id] = { s1: sc[0], s2: sc[1], st: "done" };
      });
    });
    var g = genererTableaux(s);
    s.brackets.principal = g.principal;
    s.brackets.consolante = g.consolante;
    function jouer(kind, tours, enCours) {
      for (var r = 0; r < tours; r++) {
        bracket(s, kind).rounds[r].matches.forEach(function (m) {
          if (m.bye) return;
          var sc = scoreAleatoire(rand);
          s.matches[m.id] = { s1: sc[0], s2: sc[1], st: "done" };
        });
      }
      bracket(s, kind).rounds[tours].matches.forEach(function (m, i) {
        if (i < enCours) {
          s.matches[m.id] = { s1: Math.floor(rand() * 11), s2: Math.floor(rand() * 11), st: "live" };
        }
      });
    }
    jouer("principal", 1, 5);
    jouer("consolante", 1, 3);
    s.updatedAt = Date.now();
    return s;
  }

  window.Tournoi = {
    LETTRES: LETTRES, BYE: BYE, TAILLE_PRINCIPAL: TAILLE_PRINCIPAL, TAILLE_CONSOLANTE: TAILLE_CONSOLANTE,
    esc: esc, emptyState: emptyState, normalize: normalize, horaire: horaire,
    teamName: teamName, pouleOf: pouleOf, pouleMatches: pouleMatches, bracket: bracket,
    standings: standings, qualification: qualification, genererTableaux: genererTableaux,
    tousLesMatchs: tousLesMatchs, trierMatchs: trierMatchs, slugTour: slugTour, demoState: demoState,
    ORDRE_CRENEAUX: ORDRE_CRENEAUX
  };
})();
