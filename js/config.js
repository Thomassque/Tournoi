/* ==========================================================================
   CONFIGURATION DU SITE — c'est ici que vous modifiez les infos principales.
   ========================================================================== */
window.TOURNOI_CONFIG = {
  // --- Informations générales -------------------------------------------
  nom: "Tournoi de pétanque déguisé",
  organisateurs: "Les étudiants de L2 STAPS",
  dateTexte: "Jeudi 18 mars 2027",
  // Heure d'ouverture (accueil des équipes) — utilisée pour le compte à rebours
  dateDebut: "2027-03-18T08:30:00+01:00",
  dateFin: "2027-03-18T18:00:00+01:00",

  lieu: "La NEF",
  ville: "Le Creusot (71200)",
  // À COMPLÉTER : l'adresse exacte de la NEF
  adresse: "",
  // Lien Google Maps (recherche par défaut, à remplacer par le lien exact si besoin)
  lienCarte: "https://www.google.com/maps/search/?api=1&query=La+Nef+Le+Creusot",

  // --- Inscription -------------------------------------------------------
  // À REMPLACER par le lien de votre boutique / billetterie HelloAsso
  lienHelloAsso: "https://www.helloasso.com/",
  prixEquipe: "5 €",
  nbEquipes: 48,

  // --- Contact (laisser vide pour masquer) --------------------------------
  instagram: "",   // ex : "https://www.instagram.com/votre_compte"
  email: "",       // ex : "tournoi.petanque@exemple.fr"

  // --- Horaires par défaut des tours (modifiables le jour J depuis l'espace orga)
  horaires: {
    poule1: "09:30",
    poule2: "10:15",
    poule3: "11:00",
    P1: "13:00", C1: "13:00",
    P2: "13:45", C2: "13:45",
    P3: "14:30", C3: "14:30",
    P4: "15:15", C4: "15:15",
    P5: "16:00"
  },

  // --- Direct : Firebase (optionnel, voir README.md) ----------------------
  // Tant que ce bloc est vide (apiKey: ""), le site lit le fichier data/tournoi.json.
  firebase: {
    apiKey: "",
    authDomain: "",
    databaseURL: "",
    projectId: "",
    appId: ""
  }
};
