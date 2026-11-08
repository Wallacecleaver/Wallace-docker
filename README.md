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

## Ajouter un projet

Dans le panel : nouveau projet, repo GitHub ou image Docker, port interne, domaine. WDock build, lance le conteneur sur un port local, ajoute le domaine dans Caddy et recharge.

Redéploiement automatique : copie l'URL du webhook (Paramètres) dans GitHub → Settings → Webhooks. Si le nouveau déploiement plante, l'ancienne version est relancée.

## Sans gestion automatique de Caddy

Si tu retires la ligne `CADDYFILE` du `docker-compose.yml`, le panel te montre à la place le bloc à copier dans ton Caddyfile (puis `docker exec -w /etc/caddy caddy caddy reload`).
