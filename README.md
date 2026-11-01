# Shipyard

Mini-PaaS auto-hébergé : déploie un repo GitHub ou une image Docker sur ton VPS.
Pas de proxy intégré : chaque projet est publié sur un port local (4000, 4001…) et tu le branches à ton Caddy.

## Installation

1. `cp .env.example .env` puis remplis `ADMIN_PASSWORD` et `SESSION_SECRET`.
2. `docker compose up -d --build`
3. Ajoute le panel dans ton Caddyfile :

```
panel.mondomaine.fr {
    reverse_proxy localhost:3000
}
```

4. `sudo systemctl reload caddy`

## Ajouter un projet

Dans l'onglet **Paramètres** du projet, le panel affiche le bloc à copier dans ton Caddyfile :

```
mon-site.mondomaine.fr {
    reverse_proxy localhost:4000
}
```

Redéploiement automatique : copie l'URL du webhook (Paramètres) dans GitHub → Settings → Webhooks.
Si le nouveau déploiement plante, l'ancienne version est relancée.
