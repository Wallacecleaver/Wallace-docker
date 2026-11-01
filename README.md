# Shipyard

Mini-PaaS auto-hébergé : déploie un repo GitHub ou une image Docker sur ton VPS, avec HTTPS automatique (Traefik + Let's Encrypt).

## Installation (VPS avec Docker)

1. DNS : un enregistrement `A` pour `*.mondomaine.fr` et `panel.mondomaine.fr` vers l'IP du VPS.
2. `cp .env.example .env` puis remplis-le.
3. `docker compose up -d --build`
4. Ouvre `https://panel.mondomaine.fr`

## Utilisation

- **GitHub** : `owner/repo` + branche. Utilise le `Dockerfile` du repo, sinon en génère un pour les projets Node.
- **Docker** : n'importe quelle image (`nginx:alpine`, `ghcr.io/...`).
- Chaque projet est servi sur `<nom>.mondomaine.fr` (+ domaine perso optionnel).
- Webhook GitHub : copie l'URL depuis l'onglet Paramètres (content type `application/json`, événement `push`) → redéploiement auto.
- Déploiement sans coupure : le nouveau conteneur démarre, puis l'ancien est supprimé.

## Dev

`npm i && npm run dev:api` (avec ADMIN_PASSWORD défini, Node 22.5+) et `npm run dev:web`.
