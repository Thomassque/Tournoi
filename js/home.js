/* Page d'accueil : compte à rebours */
(function () {
  "use strict";
  var cfg = window.TOURNOI_CONFIG || {};
  var box = document.getElementById("countdown");
  if (!box) return;
  var debut = new Date(cfg.dateDebut || "2027-03-18T08:30:00+01:00").getTime();
  var fin = new Date(cfg.dateFin || "2027-03-18T18:00:00+01:00").getTime();
  var champs = {};
  box.querySelectorAll("[data-cd]").forEach(function (el) { champs[el.getAttribute("data-cd")] = el; });

  function deux(n) { return n < 10 ? "0" + n : String(n); }

  function message(html) {
    box.innerHTML = '<p class="eyebrow" style="font-size:.95rem">' + html + "</p>";
    clearInterval(timer);
  }

  function tick() {
    var now = Date.now();
    if (now >= fin) return message("Merci à tous pour cette édition&nbsp;! 🎉 <a href=\"direct.html\">Voir les résultats</a>");
    if (now >= debut) return message("<span class=\"dot dot-live\"></span> C'est aujourd'hui&nbsp;! <a href=\"direct.html\">Suivre les scores en direct</a>");
    var d = Math.floor((debut - now) / 1000);
    champs.j.textContent = Math.floor(d / 86400);
    champs.h.textContent = deux(Math.floor(d % 86400 / 3600));
    champs.m.textContent = deux(Math.floor(d % 3600 / 60));
    champs.s.textContent = deux(d % 60);
  }
  var timer = setInterval(tick, 1000);
  tick();
})();
