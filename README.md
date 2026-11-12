# WDock

Mini-PaaS auto-hébergé : déploie un repo GitHub ou une image Docker sur ton VPS.
Chaque projet est publié sur un port local (4000, 4001…) et **WDock gère ton Caddy tout seul** : il écrit les blocs `reverse_proxy` dans ton Caddyfile et recharge Caddy à chaque ajout, changement de domaine ou suppression de projet.

## Prérequis

- Docker sur le VPS
- Caddy en Docker avec `network_mode: host`, un dossier `~/caddy` qui contient `docker-compose.yml` et `Caddyfile`, et un conteneur nommé `caddy`
- Un nom DuckDNS (ou un domaine) par site, qui pointe vers l'IP du VPS (les sous-domaines DuckDNS fonctionnent tous)
- Les ports 80 et 443 ouverts

## Installation

```bash
cd ~
git clone https://github.com/Wallacecleaver/Wallace-docker.git wdock
cd wdock
cp .env.example .env
nano .env        # ADMIN_PASSWORD, SESSION_SECRET (openssl rand -hex 32), PANEL_DOMAIN
docker compose up -d --build
```

Au démarrage, WDock ajoute le domaine du panel (`PANEL_DOMAIN`) dans le Caddyfile et recharge Caddy. Ouvre ensuite `https://ton-panel.duckdns.org`.

Les blocs gérés par WDock sont placés entre deux lignes de commentaire à la fin du Caddyfile. Ne les modifie pas à la main : tout ce qui est en dehors (tes réglages globaux, tes blocs perso) est conservé.
Si le Caddyfile devient invalide (par exemple un domaine déjà déclaré à la main), WDock annule la modification, garde l'ancienne config et affiche l'erreur dans l'onglet Paramètres du projet.

## Connexion GitHub

Dans « Nouveau projet », le panel propose de se connecter à GitHub : tes repos apparaissent alors dans une liste déroulante (tu peux aussi coller un lien).
Deux façons de se connecter :

- **Bouton « Se connecter avec GitHub »** : sur GitHub, Settings > Developer settings > OAuth Apps > New OAuth App (adresses au choix), coche **Enable Device Flow**, puis mets le Client ID dans `GITHUB_CLIENT_ID` du `.env`.
- **Coller un token** : dans le panel, aucune configuration nécessaire.

Le token est enregistré dans la base du panel (`data/`) et sert aussi à cloner tes repos privés.

## Adresses (DuckDNS)

Chaque projet a sa propre adresse `nom.duckdns.org` et son propre port. Le panel vérifie en direct que l'adresse pointe vers ton VPS et te dit quoi faire sinon. Un compte DuckDNS gratuit a 5 noms ; un sous-domaine d'un nom existant (`addon.monnom.duckdns.org`) ne demande rien de plus.

## Ajouter un projet

Dans le panel : nouveau projet, repo GitHub ou image Docker, port interne, domaine. WDock build, lance le conteneur sur un port local, ajoute le domaine dans Caddy et recharge.

Redéploiement automatique : copie l'URL du webhook (Paramètres) dans GitHub → Settings → Webhooks. Si le nouveau déploiement plante, l'ancienne version est relancée.
Si l'image définit un `HEALTHCHECK`, WDock attend qu'il soit « sain » avant d'annoncer « En ligne » : s'il échoue, la raison s'affiche dans les logs du déploiement et l'ancienne version est remise (délai réglable avec `HEALTH_TIMEOUT`).
Un push reçu pendant un déploiement n'est pas perdu : il déclenche un redéploiement dès que le premier est fini. Le message de test (`ping`) de GitHub est ignoré.

## Terminal du projet

L'onglet **Terminal** d'un projet lance des commandes dans son conteneur (`docker exec`) : `ls`, `cat package.json`, `env`, `node -v`… La sortie arrive au fur et à mesure, `cd` est conservé d'une commande à l'autre, ↑ ↓ rappellent l'historique, **Interrompre** (ou Ctrl+C) arrête la commande en cours.
Limites : une commande à la fois, pas de saisie interactive (`vim`, `top`, mot de passe demandé…), 3 commandes en parallèle au maximum, arrêt automatique après 120 s (réglable avec `EXEC_TIMEOUT`, en secondes) ou 1 Mo de sortie. Le conteneur doit tourner et contenir un `sh`.
Ce terminal donne le même pouvoir que le panel : garde un `ADMIN_PASSWORD` solide.

## Synchroniser les variables avec le .env.example

Dans l'onglet **Variables** d'un projet GitHub, le bouton **Synchroniser avec .env.example** lit le `.env.example` (ou `.env.sample`…) du repo et **ajoute à la liste les variables qui n'y sont pas encore**. Celles que tu as déjà ne sont jamais modifiées, `PORT` est ignoré (il est ajouté automatiquement). Les lignes ajoutées reprennent les valeurs d'exemple : remplace-les, puis enregistre. Les variables commentées (`#NOM=…`) ne sont pas ajoutées.

## Sans gestion automatique de Caddy

Si tu retires la ligne `CADDYFILE` du `docker-compose.yml`, le panel te montre à la place le bloc à copier dans ton Caddyfile (puis `docker exec -w /etc/caddy caddy caddy reload`).
