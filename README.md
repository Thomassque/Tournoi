# Tournoi de pétanque déguisé — L2 STAPS

Site du tournoi de pétanque déguisé organisé par les étudiants de L2 STAPS à **la NEF du Creusot**, le **jeudi 18 mars 2027**.

- **48 doublettes** réparties en **12 poules de 4** (chaque équipe joue 3 matchs).
- **Tableau final** (32 équipes, dès les 16es) : 1ers + 2es de poule + 8 meilleurs 3es.
- **Consolante** (16 équipes, dès les 8es) : les 4 autres 3es + les 4es de poule.
- Match pour la 3e place et podium dans les deux tableaux, tombola, lots.
- Inscription **5 € par équipe** via HelloAsso.

Site statique (HTML/CSS/JavaScript, sans outil de compilation) : il s'héberge gratuitement sur GitHub Pages.

## Les pages

| Page | Contenu |
|---|---|
| `index.html` | Accueil, compte à rebours, infos pratiques, format, programme, déguisement, lots & tombola, inscription HelloAsso, règlement, FAQ |
| `direct.html` | Le jour J : programme des matchs (horaire, terrain, équipes, score), poules et classements, classement des 3es, tableau final, consolante, liste des équipes, « Suivre mon équipe » |
| `admin.html` | Espace organisateurs : équipes, tirage des poules, saisie des scores en direct, génération des tableaux, horaires, annonces |

**Voir une démo du direct avec des données fictives :** ouvrir `direct.html?demo`.

## 1. Personnaliser le site

1. **`js/config.js`** : c'est ici que tout se règle.
   - `lienHelloAsso` → **à remplacer** par le lien de votre billetterie HelloAsso (5 € / équipe).
   - `adresse` → l'adresse exacte de la NEF (laisser vide pour la masquer) et `lienCarte` si besoin.
   - `instagram`, `email` → vos contacts (laisser vide pour masquer).
   - `horaires` → heure de début de chaque tour (utilisée sur la page Direct).
2. **`index.html`** : les textes sont directement modifiables. Les passages marqués `<!-- À VÉRIFIER -->` contiennent des infos proposées par défaut à confirmer :
   - matériel (boules à apporter ?), buvette, prix du ticket et lots de la tombola ;
   - horaires du programme (à garder cohérents avec `js/config.js`) ;
   - règlement (durée des parties, forfaits…).
3. **Logo** : `assets/logo.png` (fond transparent), `assets/favicon-32.png`, `assets/apple-touch-icon.png`.

## 2. Mettre le site en ligne (GitHub Pages, gratuit)

1. Fusionner la branche du site dans `main`.
2. Sur GitHub : **Settings → Pages → Build and deployment → Source : Deploy from a branch**, branche `main`, dossier `/ (root)`.
3. Après une minute, le site est en ligne à l'adresse `https://<votre-compte>.github.io/Tournoi/`.

Astuce : imprimez un **QR code** vers `…/direct.html` et affichez-le à la NEF le jour J.

## 3. Le direct du jour J

Deux modes possibles :

### Mode A — Firebase (recommandé : scores en temps réel)

Les scores saisis par les organisateurs (sur téléphone) apparaissent **instantanément** chez tout le monde, et plusieurs organisateurs peuvent saisir en même temps. L'offre gratuite de Firebase suffit largement.

1. Créer un projet sur <https://console.firebase.google.com> (Google Analytics inutile).
2. **Build → Realtime Database → Créer une base de données** (région `europe-west1`), en mode verrouillé.
3. Onglet **Règles** de la base, coller puis publier :
   ```json
   {
     "rules": {
       "tournoi": {
         ".read": true,
         ".write": "auth != null && root.child('organisateurs').child(auth.uid).val() === true"
       },
       "organisateurs": { ".read": false, ".write": false }
     }
   }
   ```
4. **Build → Authentication → Commencer → Adresse e-mail/Mot de passe** : activer. Onglet **Users → Ajouter un utilisateur** pour chaque organisateur, puis copier son **UID**.
5. Onglet **Données** de la Realtime Database : ajouter un nœud `organisateurs` contenant, pour chaque UID, la valeur `true` :
   ```
   organisateurs
     └─ AbCdEf123456… : true
   ```
   (Seuls ces comptes pourront modifier les scores.)
6. **Paramètres du projet (⚙) → Vos applications → Web (</>)** : enregistrer une application, puis copier les valeurs `apiKey`, `authDomain`, `databaseURL`, `projectId`, `appId` dans le bloc `firebase` de `js/config.js`.
   (Ces valeurs ne sont pas secrètes : la sécurité est assurée par les règles de l'étape 3.)
7. Ouvrir `admin.html`, se connecter, et c'est parti.

### Mode B — Sans Firebase (fichier)

Si `js/config.js` ne contient pas de configuration Firebase, le site lit le fichier `data/tournoi.json` (rafraîchi automatiquement toutes les 20 s sur la page Direct). L'espace organisateurs enregistre alors les modifications **dans le navigateur** : pour les publier, **Réglages → Exporter** puis remplacer `data/tournoi.json` dans le dépôt (GitHub Pages met ~1 min à se mettre à jour). Pratique pour préparer les équipes, moins pour des scores en direct.

## 4. Déroulé conseillé dans l'espace organisateurs

1. **Équipes** : coller la liste des inscrits (export HelloAsso / Excel : `Nom ; Joueur 1 ; Joueur 2 ; Déguisement`), corriger les noms si besoin.
2. **Poules** : après le pointage, **Tirage au sort automatique** (ou placement manuel ; choisir une équipe déjà placée l'échange de place).
3. **Réglages** : cocher **« Ouvrir la page Direct au public »**. Avant cela, la page Direct affiche « Rendez-vous le 18 mars ».
4. **Scores** : filtrer par tour, utiliser + / − pendant la partie (le match passe « En cours »), puis **Terminé**. Le terrain de chaque match est modifiable.
5. **Tableaux** : quand les 12 poules sont terminées, **Générer le tableau final et la consolante**. Le placement suit le classement (1ers, 2es, meilleurs 3es) et évite que deux équipes d'une même poule se croisent au 1er tour ; chaque match reste modifiable à la main.
6. Les vainqueurs avancent automatiquement dans les tableaux ; les perdants des demies jouent le match pour la 3e place. Les podiums s'affichent tout seuls.
7. **Réglages → Annonce** pour afficher un message en haut de la page Direct (retard, appel d'une équipe, tirage de la tombola…). En cas de retard, décaler l'horaire d'un tour dans **Réglages → Horaires**.

**Classement des poules :** victoires, puis différence de points, puis points marqués, puis confrontation directe. Les 3es sont départagés entre eux par victoires, différence de points puis points marqués.

**Terrains par défaut :** poule A → terrains 1-2, poule B → 3-4, … poule L → 23-24 ; tableau final sur les terrains 1 à 16, consolante sur les terrains 17 à 24.

## Structure

```
index.html          page d'accueil / infos pratiques
direct.html         poules, tableaux, programme et scores en direct
admin.html          espace organisateurs
css/style.css       styles
js/config.js        réglages (HelloAsso, adresse, horaires, Firebase)
js/tournament.js    logique du tournoi (poules, classements, tableaux)
js/store.js         lecture / écriture des données (Firebase ou fichier)
js/direct.js        page Direct
js/admin.js         espace organisateurs
js/home.js, js/common.js
data/tournoi.json   données du tournoi (mode fichier)
assets/             logo et icônes
```

Pour tester en local : `python3 -m http.server` dans le dossier, puis ouvrir <http://localhost:8000>.
