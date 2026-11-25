/* Comportements communs à toutes les pages : menu mobile + liens issus de config.js */
(function () {
  "use strict";
  var cfg = window.TOURNOI_CONFIG || {};

  // Menu mobile
  var btn = document.querySelector(".menu-btn");
  var nav = document.getElementById("mobile-nav");
  if (btn && nav) {
    btn.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    });
    nav.addEventListener("click", function (e) {
      if (e.target.closest("a")) { nav.classList.remove("open"); btn.setAttribute("aria-expanded", "false"); }
    });
  }

  // Liens et textes paramétrés dans js/config.js
  document.querySelectorAll("[data-cfg-href]").forEach(function (el) {
    var val = cfg[el.getAttribute("data-cfg-href")];
    if (!val) { if (el.hasAttribute("data-hide-empty")) el.remove(); return; }
    el.href = el.hasAttribute("data-mailto") ? "mailto:" + val : val;
  });
  document.querySelectorAll("[data-cfg-text]").forEach(function (el) {
    var val = cfg[el.getAttribute("data-cfg-text")];
    if (!val) { el.remove(); return; }
    el.textContent = val;
    if (el.hasAttribute("data-br")) el.insertAdjacentHTML("afterend", "<br>");
  });
})();
