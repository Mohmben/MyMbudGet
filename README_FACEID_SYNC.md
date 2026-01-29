# MyMbudGet — Full App (Face ID + Import CSV Synchronisé)

Version: 3.5.1-gh-nosw-tabs-importcsv-bio

## Inclus
- **Onglets** : Accueil / Graphiques / Récurrences & Budgets
- **Catégorie** Assurances
- **Import CSV** avec **mode synchronisation** (ajout / mise à jour / suppression)
- **Verrouillage biométrique** (Face ID / Touch ID / Windows Hello via WebAuthn) + **PIN** secours
- **No Service Worker** (NoSW)

## Icônes
Le ZIP contient `icon-192.png` et `icon-512.png` en **placeholders**. Remplacez-les par vos nouveaux fichiers (mêmes noms) avant upload si nécessaire.

## CSV attendu
En‑têtes : `label,amount,type,category,start_date,frequency,end_type,end_date,count,notes` (+ optionnel `key`).
- `type`: income|expense ; `frequency`: monthly|weekly|daily ; `end_type`: none|until|count ; dates `YYYY-MM-DD`.
- **Mode synchronisation** (case cochée) :
  - **ajoute** ce qui n'existe pas,
  - **met à jour** les récurrences au **même key** (par défaut `slug(label)|category|frequency`, ou colonne `key` si présente),
  - **supprime** ce qui n'est plus présent dans le CSV.
- Si la case est décochée : **ajout uniquement** (aucune suppression / mise à jour).

## Déploiement
1. Nettoyez le dépôt si besoin, puis **Upload files** → glissez **tous les fichiers** du ZIP
2. **Commit changes**
3. PC : Ctrl+F5 • iPhone : réinstallez l'icône si nécessaire
