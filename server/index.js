import http from 'node:http'
import { DatabaseSync } from 'node:sqlite'
import { spawn } from 'node:child_process'
import dns from 'node:dns/promises'
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { createReadStream, existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const E = process.env
const BIND = E.BIND_HOST || '127.0.0.1'
const PORT_START = +E.APP_PORT_START || 4000
const DATA = E.DATA_DIR || './data'
const ENV_TOKEN = E.GITHUB_TOKEN || ''
const CLIENT_ID = E.GITHUB_CLIENT_ID || ''
const SUFFIX = E.DOMAIN_SUFFIX ?? 'duckdns.org'
const PASS = E.ADMIN_PASSWORD
const CADDYFILE = E.CADDYFILE || ''
const CADDY_CTR = E.CADDY_CONTAINER || 'caddy'
const PANEL_DOMAIN = (E.PANEL_DOMAIN || '').trim().toLowerCase()
const SECRET = E.SESSION_SECRET || randomBytes(32).toString('hex')
const WEB = path.join(path.dirname(fileURLToPath(import.meta.url)), '../dist')
if (!PASS) { console.error('ADMIN_PASSWORD manquant'); process.exit(1) }
await mkdir(DATA, { recursive: true })

const db = new DatabaseSync(path.join(DATA, 'db.sqlite'))
db.exec(`
pragma journal_mode=wal;
create table if not exists projects(id text primary key,name text,source text,repo text,branch text,image text,port int,domain text,env text default '{}',hook text,created int,hostport int);
create table if not exists deploys(id integer primary key autoincrement,project text,status text,log text default '',created int,finished int);
`)
db.exec('create table if not exists settings(k text primary key, v text)')
const setting = k => db.prepare('select v from settings where k=?').get(k)?.v
const setSetting = (k, v) => v == null ? db.prepare('delete from settings where k=?').run(k) : db.prepare('insert into settings(k,v) values(?,?) on conflict(k) do update set v=excluded.v').run(k, v)
const ghToken = () => setting('gh_token') || ENV_TOKEN

// ---------- helpers ----------
const bad = (m, status = 400) => { throw Object.assign(new Error(m), { status }) }
const sign = v => createHmac('sha256', SECRET).update(v).digest('base64url')
const same = (a, b) => timingSafeEqual(Buffer.from(sign(a)), Buffer.from(sign(b)))
const mkSession = () => { const e = Date.now() + 7 * 864e5; return `${e}.${sign(String(e))}` }
const okSession = c => {
  const m = /(?:^|; )sy=([^;]+)/.exec(c || ''); if (!m) return false
  const [e, s] = m[1].split('.'); return !!s && same(s, sign(e)) && +e > Date.now()
}
const json = (res, code, d) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(d)) }
const sse = res => res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', 'x-accel-buffering': 'no' })
const ev = s => `data: ${JSON.stringify(s)}\n\n`
const run = (cmd, args, { cwd, onData } = {}) => new Promise((ok, ko) => {
  const p = spawn(cmd, args, { cwd }); const f = d => onData?.(d.toString())
  p.stdout.on('data', f); p.stderr.on('data', f)
  p.on('error', ko); p.on('close', c => c === 0 ? ok() : ko(new Error(`${cmd} ${args[0]} a échoué (code ${c})`)))
})
const out = (cmd, args) => new Promise(ok => {
  let o = ''; const p = spawn(cmd, args)
  p.stdout.on('data', d => o += d); p.stderr.on('data', d => o += d)
  p.on('error', () => ok('')); p.on('close', () => ok(o.trim()))
})
const lines = s => s.split('\n').filter(Boolean)
const row = r => r && { ...r, env: JSON.parse(r.env) }
const getP = id => row(db.prepare('select * from projects where id=?').get(id)) || bad('Projet introuvable', 404)
const urlOf = p => p.domain ? `https://${p.domain}` : `http://localhost:${p.hostport}`
const ctrs = async id => lines(await out('docker', ['ps', '-a', '--filter', `label=shipyard.project=${id}`, '--format', '{{.Names}}']))

// ---------- validation ----------
const SLUG = /^[a-z0-9][a-z0-9-]{1,38}$/, DOM = /^([a-z0-9-]+\.)+[a-z]{2,}$/i
const REPO = /^[\w.-]+\/[\w.-]+$/, BR = /^\w[\w./-]*$/, IMG = /^\w[\w./:@-]*$/
function check(o) {
  if (o.source === 'github') {
    o.repo = String(o.repo || '').trim().replace(/^https?:\/\/github\.com\//, '').replace(/(\.git)?\/?$/, '')
    if (!REPO.test(o.repo)) bad('Repo invalide (format owner/repo)')
    o.branch = o.branch || 'main'; if (!BR.test(o.branch)) bad('Branche invalide')
  } else if (o.source === 'docker') {
    if (!IMG.test(o.image || '')) bad('Image invalide')
  } else bad('Source invalide')
  o.port = +o.port || 3000; if (o.port < 1 || o.port > 65535) bad('Port invalide')
  o.domain = (o.domain || '').trim().toLowerCase(); if (o.domain && !DOM.test(o.domain)) bad('Domaine invalide')
  if (!o.env || typeof o.env !== 'object') o.env = {}
  for (const k of Object.keys(o.env)) if (!/^[A-Za-z_]\w*$/.test(k)) bad(`Variable invalide : ${k}`)
  return o
}

const taken = (d, id = '') => !!d && (d === PANEL_DOMAIN || !!db.prepare('select 1 from projects where domain=? and id!=?').get(d, id))

// ---------- Caddy (géré automatiquement si CADDYFILE est défini) ----------
const BEGIN = '# >>> shipyard : bloc géré automatiquement, ne pas modifier >>>'
const END = '# <<< shipyard <<<'
const caddy = { enabled: !!CADDYFILE, error: '' }
if (PANEL_DOMAIN && !DOM.test(PANEL_DOMAIN)) { console.error('PANEL_DOMAIN invalide'); process.exit(1) }
let caddyQueue = Promise.resolve()
const syncCaddy = () => caddy.enabled ? (caddyQueue = caddyQueue.then(doSyncCaddy)) : Promise.resolve()

async function doSyncCaddy() {
  try {
    const blocks = []
    if (PANEL_DOMAIN) blocks.push(`# panel\n${PANEL_DOMAIN} {\n    reverse_proxy localhost:${+E.PORT || 3000}\n}`)
    for (const r of db.prepare("select id,domain,hostport from projects where domain != '' order by created").all())
      blocks.push(`# ${r.id}\n${r.domain} {\n    reverse_proxy localhost:${r.hostport}\n}`)
    const section = `${BEGIN}\n${blocks.join('\n\n')}${blocks.length ? '\n' : ''}${END}`
    const cur = existsSync(CADDYFILE) ? await readFile(CADDYFILE, 'utf8') : ''
    const a = cur.indexOf(BEGIN), b = cur.indexOf(END)
    const next = a !== -1 && b > a
      ? cur.slice(0, a) + section + cur.slice(b + END.length)
      : `${cur.replace(/\s*$/, '')}${cur.trim() ? '\n\n' : ''}${section}\n`
    if (next === cur) { caddy.error = ''; return }
    // Écriture sur place (même inode) pour que le bind mount du conteneur Caddy voie le changement
    await writeFile(CADDYFILE, next)
    let msg = ''; const onData = d => { msg += d }
    const cx = sub => ['exec', '-w', '/etc/caddy', CADDY_CTR, 'caddy', sub, '--config', '/etc/caddy/Caddyfile', '--adapter', 'caddyfile']
    try {
      await run('docker', cx('validate'), { onData })
      await run('docker', cx('reload'), { onData })
    } catch (e) {
      await writeFile(CADDYFILE, cur)
      throw new Error(`${e.message}\n${msg.trim().split('\n').slice(-6).join('\n')}`)
    }
    caddy.error = ''
  } catch (e) {
    caddy.error = e.message; console.error('[caddy]', e.message)
  }
}

// ---------- déploiement ----------
const logs = new Map(), deploying = new Set()
const NODE_DF = `FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci || npm install
COPY . .
RUN npm run build --if-present
ENV NODE_ENV=production
CMD ["npm","start"]
`

function start(p) {
  if (deploying.has(p.id)) bad('Déploiement déjà en cours', 409)
  deploying.add(p.id)
  deploy(p).catch(console.error).finally(() => deploying.delete(p.id))
}

async function deploy(p) {
  const TOKEN = ghToken()
  const id = Number(db.prepare('insert into deploys(project,status,created) values(?,?,?)').run(p.id, 'building', Date.now()).lastInsertRowid)
  const buf = { text: '', subs: new Set() }; logs.set(id, buf)
  const log = s => {
    s = s.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, ''); if (TOKEN) s = s.replaceAll(TOKEN, '***')
    buf.text += s; for (const r of buf.subs) r.write(ev(s))
  }
  const name = `sy-${p.id}-${id}`
  let status = 'failed', old = []
  try {
    let image = p.image
    if (p.source === 'github') {
      const dir = path.join(DATA, 'src', p.id)
      await rm(dir, { recursive: true, force: true }); await mkdir(dir, { recursive: true })
      const remote = TOKEN ? `https://x-access-token:${TOKEN}@github.com/${p.repo}.git` : `https://github.com/${p.repo}.git`
      log(`→ git clone ${p.repo}@${p.branch}\n`)
      await run('git', ['clone', '--depth', '1', '-b', p.branch, remote, dir], { onData: log })
      if (!existsSync(path.join(dir, 'Dockerfile'))) {
        if (!existsSync(path.join(dir, 'package.json'))) throw new Error('Ni Dockerfile ni package.json dans le repo')
        log('→ Pas de Dockerfile : génération d’un Dockerfile Node\n')
        await writeFile(path.join(dir, 'Dockerfile'), NODE_DF)
        if (!existsSync(path.join(dir, '.dockerignore'))) await writeFile(path.join(dir, '.dockerignore'), 'node_modules\n.git\n')
      }
      image = `shipyard/${p.id}:${id}`
      log(`→ docker build ${image}\n`)
      await run('docker', ['build', '--progress=plain', '-t', image, dir], { onData: log })
    } else {
      log(`→ docker pull ${image}\n`)
      await run('docker', ['pull', image], { onData: log })
    }

    old = await ctrs(p.id)
    if (old.length) { log('→ Arrêt de l’ancienne version\n'); await out('docker', ['stop', ...old]) }
    const args = ['run', '-d', '--name', name, '--restart', 'unless-stopped', '--memory', E.APP_MEMORY || '512m',
      '-l', `shipyard.project=${p.id}`, '-p', `${BIND}:${p.hostport}:${p.port}`, '-e', `PORT=${p.port}`]
    // Les VOLUME déclarés dans l'image (ex. VOLUME /app/data) deviennent des volumes nommés : les données survivent aux redéploiements
    let vols = {}; try { vols = JSON.parse(await out('docker', ['image', 'inspect', '-f', '{{json .Config.Volumes}}', image])) || {} } catch {}
    for (const dir of Object.keys(vols)) {
      const vol = `shipyard-${p.id}-${createHash('sha1').update(dir).digest('hex').slice(0, 6)}`
      await out('docker', ['volume', 'create', '--label', `shipyard.project=${p.id}`, vol])
      args.push('-v', `${vol}:${dir}`); log(`→ Volume ${vol} → ${dir}\n`)
    }
    for (const [k, v] of Object.entries(p.env)) args.push('-e', `${k}=${v}`)
    log(`→ Démarrage du conteneur (port ${p.hostport})\n`)
    await run('docker', [...args, image], { onData: log })

    await new Promise(r => setTimeout(r, 5000))
    if (await out('docker', ['inspect', '-f', '{{.State.Running}}', name]) !== 'true')
      throw new Error('Le conteneur a planté au démarrage :\n' + await out('docker', ['logs', '--tail', '40', name]))
    if (old.length) await out('docker', ['rm', '-f', ...old])
    for (const tag of lines(await out('docker', ['images', `shipyard/${p.id}`, '--format', '{{.Tag}}'])))
      if (tag !== String(id)) await out('docker', ['rmi', `shipyard/${p.id}:${tag}`])
    log(`✓ En ligne : ${urlOf(p)}\n`)
    status = 'success'
  } catch (e) {
    log(`\n✗ ${e.message}\n`); await out('docker', ['rm', '-f', name])
    if (old.length) { log('→ Retour à l’ancienne version\n'); await out('docker', ['start', old[0]]) }
  }
  db.prepare('update deploys set status=?,log=?,finished=? where id=?').run(status, buf.text, Date.now(), id)
  for (const r of buf.subs) { r.write(`event: end\ndata: "${status}"\n\n`); r.end() }
  logs.delete(id)
}

// ---------- routes ----------
const STREAM = Symbol(), routes = [], fails = new Map()
const route = (m, p, h, auth = true) =>
  routes.push({ m, re: new RegExp('^' + p.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), h, auth })

route('POST', '/api/login', ({ req, res, body }) => {
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress
  const f = fails.get(ip) || { n: 0, t: 0 }
  if (f.n >= 5 && Date.now() - f.t < 9e5) bad('Trop de tentatives, réessaie dans 15 min', 429)
  if (!same(String(body.password || ''), PASS)) { fails.set(ip, { n: f.n + 1, t: Date.now() }); bad('Mot de passe incorrect', 401) }
  fails.delete(ip)
  res.setHeader('set-cookie', `sy=${mkSession()}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : ''}`)
}, false)
route('POST', '/api/logout', ({ res }) => { res.setHeader('set-cookie', 'sy=; HttpOnly; Path=/; Max-Age=0') })
route('GET', '/api/me', () => ({ ok: true }))
route('GET', '/api/caddy', () => caddy)
let pubIp = E.PUBLIC_IP || ''
const publicIp = async () => {
  if (!pubIp) try { pubIp = (await (await fetch('https://api4.ipify.org')).text()).trim() } catch {}
  return pubIp
}
route('GET', '/api/config', async () => ({ base: PANEL_DOMAIN, suffix: SUFFIX, caddy: caddy.enabled, ip: await publicIp() }))
route('GET', '/api/dns', async ({ req }) => {
  const d = (new URL(req.url, 'http://x').searchParams.get('domain') || '').toLowerCase()
  if (!DOM.test(d)) bad('Adresse invalide')
  const ip = await publicIp(); let ips = []
  try { ips = await dns.resolve4(d) } catch {}
  return { ip, ips, ok: !!ip && ips.includes(ip) }
})

// ---------- GitHub ----------
const gh = async (path, token = ghToken()) => {
  const r = await fetch(`https://api.github.com${path}`, { headers: { accept: 'application/vnd.github+json', 'user-agent': 'wdock', ...(token ? { authorization: `Bearer ${token}` } : {}) } })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) bad(j.message || `GitHub a répondu ${r.status}`, r.status === 401 ? 400 : 502)
  return j
}
const ghPost = async (url, data) => {
  const r = await fetch(url, { method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json', 'user-agent': 'wdock' }, body: JSON.stringify(data) })
  return r.json().catch(() => ({}))
}
let device = null
route('GET', '/api/github', async () => {
  const t = ghToken(), base = { connected: false, deviceFlow: !!CLIENT_ID }
  if (!t) return base
  try { const u = await gh('/user', t); return { ...base, connected: true, login: u.login } }
  catch (e) { return { ...base, error: e.message } }
})
route('POST', '/api/github/device', async () => {
  if (!CLIENT_ID) bad('GITHUB_CLIENT_ID manquant dans le .env')
  const j = await ghPost('https://github.com/login/device/code', { client_id: CLIENT_ID, scope: 'repo' })
  if (!j.device_code) bad(j.error_description || 'Impossible de démarrer la connexion GitHub', 502)
  device = { code: j.device_code, until: Date.now() + j.expires_in * 1000 }
  return { user_code: j.user_code, url: j.verification_uri, interval: j.interval || 5 }
})
route('POST', '/api/github/poll', async () => {
  if (!device || Date.now() > device.until) bad('Connexion expirée, recommence')
  const j = await ghPost('https://github.com/login/oauth/access_token', { client_id: CLIENT_ID, device_code: device.code, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' })
  if (j.access_token) { setSetting('gh_token', j.access_token); device = null; return { status: 'ok' } }
  if (j.error === 'authorization_pending' || j.error === 'slow_down') return { status: 'pending' }
  device = null; bad(j.error_description || 'Connexion refusée')
})
route('POST', '/api/github/token', async ({ body }) => {
  const t = String(body.token || '').trim()
  if (!/^[\w-]{20,255}$/.test(t)) bad('Token invalide')
  await gh('/user', t); setSetting('gh_token', t)
})
route('DELETE', '/api/github', () => { setSetting('gh_token', null) })
route('GET', '/api/github/repos', async () => {
  const t = ghToken(); if (!t) bad('GitHub non connecté')
  const all = []
  for (let page = 1; page <= 3; page++) {
    const l = await gh(`/user/repos?per_page=100&sort=pushed&page=${page}`, t)
    all.push(...l.map(r => ({ name: r.full_name, private: r.private, branch: r.default_branch })))
    if (l.length < 100) break
  }
  return all
})

// Cherche un fichier d'exemple d'environnement (.env.example, .env.sample…) à la racine du repo
const ENV_FILES = ['.env.example', '.env.sample', '.env.template', '.env.dist', '.env.default', 'env.example', 'example.env', 'sample.env', '.env.local.example', '.env.production.example']
route('GET', '/api/github/env', async ({ req }) => {
  const q = new URL(req.url, 'http://x').searchParams
  const repo = String(q.get('repo') || ''), branch = String(q.get('branch') || '')
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) bad('Repo invalide')
  if (branch && !/^[\w./-]{1,100}$/.test(branch)) bad('Branche invalide')
  const ref = branch ? `?ref=${encodeURIComponent(branch)}` : ''
  let list
  try { list = await gh(`/repos/${repo}/contents${ref}`) } catch { return { file: null } }
  if (!Array.isArray(list)) return { file: null }
  const names = list.filter(f => f.type === 'file').map(f => f.name)
  const file = ENV_FILES.find(n => names.includes(n)) || names.find(n => /^\.?env.*\.(example|sample|template|dist)$|^(example|sample)\.env$/i.test(n))
  if (!file) return { file: null }
  const f = await gh(`/repos/${repo}/contents/${encodeURIComponent(file)}${ref}`)
  if (f.encoding !== 'base64' || f.size > 50000) return { file: null }
  return { file, text: Buffer.from(f.content, 'base64').toString('utf8') }
})

route('GET', '/api/projects', async () => {
  const state = {}
  for (const l of lines(await out('docker', ['ps', '-a', '--format', '{{.State}}|{{.Label "shipyard.project"}}']))) {
    const [s, id] = l.split('|'); if (id && !(id in state)) state[id] = s
  }
  return db.prepare('select * from projects order by created desc').all().map(r => {
    const p = row(r), last = db.prepare('select status,created from deploys where project=? order by id desc limit 1').get(p.id)
    const { env, hook, ...pub } = p
    return { ...pub, url: urlOf(p), status: deploying.has(p.id) ? 'building' : state[p.id] || 'idle', last }
  })
})

route('POST', '/api/projects', async ({ body }) => {
  const name = String(body.name || '').trim()
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 38)
  if (!SLUG.test(id) || ['api'].includes(id)) bad('Nom invalide ou réservé')
  if (db.prepare('select 1 from projects where id=?').get(id)) bad('Ce nom existe déjà', 409)
  const o = check({ ...body })
  if (taken(o.domain)) bad('Cette adresse est déjà utilisée', 409)
  const hostport = (db.prepare('select max(hostport) m from projects').get().m || PORT_START - 1) + 1
  db.prepare('insert into projects(id,name,source,repo,branch,image,port,domain,env,hook,created,hostport) values(?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(id, name, o.source, o.repo || '', o.branch || '', o.image || '', o.port, o.domain, JSON.stringify(o.env), randomBytes(16).toString('hex'), Date.now(), hostport)
  await syncCaddy(); start(getP(id)); return { id, caddy: caddy.error || undefined }
})

route('GET', '/api/projects/:id', async ({ params }) => {
  const p = getP(params.id), c = await ctrs(p.id)
  const state = c[0] ? await out('docker', ['inspect', '-f', '{{.State.Status}}', c[0]]) : 'idle'
  return {
    ...p, url: urlOf(p), status: deploying.has(p.id) ? 'building' : state, caddy,
    deploys: db.prepare('select id,status,created,finished from deploys where project=? order by id desc limit 20').all(p.id),
  }
})

route('PATCH', '/api/projects/:id', async ({ params, body }) => {
  const p = getP(params.id), o = check({ ...p, ...body, source: p.source })
  if (taken(o.domain, p.id)) bad('Cette adresse est déjà utilisée', 409)
  db.prepare('update projects set branch=?,image=?,port=?,domain=?,env=? where id=?')
    .run(o.branch, o.image, o.port, o.domain, JSON.stringify(o.env), p.id)
  await syncCaddy()
  if (body.redeploy) start(getP(p.id))
  return { ok: true, caddy: caddy.error || undefined }
})
route('POST', '/api/projects/:id/deploy', ({ params }) => { start(getP(params.id)) })
for (const act of ['stop', 'start'])
  route('POST', `/api/projects/:id/${act}`, async ({ params }) => {
    const [c] = await ctrs(getP(params.id).id); if (c) await out('docker', [act, c])
  })
route('DELETE', '/api/projects/:id', async ({ params }) => {
  const p = getP(params.id), c = await ctrs(p.id)
  if (c.length) await out('docker', ['rm', '-f', ...c])
  for (const tag of lines(await out('docker', ['images', `shipyard/${p.id}`, '--format', '{{.Tag}}']))) await out('docker', ['rmi', `shipyard/${p.id}:${tag}`])
  await rm(path.join(DATA, 'src', p.id), { recursive: true, force: true })
  const vols = lines(await out('docker', ['volume', 'ls', '-q', '--filter', `label=shipyard.project=${p.id}`]))
  if (vols.length) await out('docker', ['volume', 'rm', ...vols])
  db.prepare('delete from deploys where project=?').run(p.id); db.prepare('delete from projects where id=?').run(p.id)
  await syncCaddy()
})

route('GET', '/api/projects/:id/logs', async ({ req, res, params }) => {
  const [c] = await ctrs(getP(params.id).id); sse(res)
  if (!c) { res.write(ev('Aucun conteneur.\n')); return STREAM }
  const p = spawn('docker', ['logs', '-f', '--tail', '300', '-t', c]), f = d => res.write(ev(d.toString()))
  p.stdout.on('data', f); p.stderr.on('data', f); req.on('close', () => p.kill()); return STREAM
})
route('GET', '/api/deploys/:id/log', ({ req, res, params }) => {
  sse(res); const b = logs.get(+params.id)
  if (b) { res.write(ev(b.text)); b.subs.add(res); req.on('close', () => b.subs.delete(res)) }
  else { res.write(ev(db.prepare('select log from deploys where id=?').get(+params.id)?.log || '')); res.write('event: end\ndata: ""\n\n'); res.end() }
  return STREAM
})

// Stats détaillées d'un projet (page du projet) : CPU, mémoire, réseau, uptime, redémarrages
route('GET', '/api/projects/:id/stats', async ({ params }) => {
  const [c] = await ctrs(getP(params.id).id)
  if (!c) return { running: false }
  const [s, i] = await Promise.all([
    out('docker', ['stats', '--no-stream', '--format', '{{.CPUPerc}}|{{.MemUsage}}|{{.MemPerc}}|{{.NetIO}}|{{.PIDs}}', c]),
    out('docker', ['inspect', '-f', '{{.State.Running}}|{{.State.StartedAt}}|{{.RestartCount}}|{{if .State.Health}}{{.State.Health.Status}}{{end}}', c]),
  ])
  const [run, started, restarts, health] = i.split('|')
  if (run !== 'true') return { running: false, restarts: +restarts || 0 }
  const [cpu, mem = '', memp, net = '', pids] = s.split('|'), [used, limit] = mem.split(' / '), [rx, tx] = net.split(' / ')
  return { running: true, cpu: parseFloat(cpu) || 0, memUsed: used, memLimit: limit, memPct: parseFloat(memp) || 0, rx, tx, pids: +pids || 0, started, restarts: +restarts || 0, health: health || '' }
})

const st = { t: 0, v: {} }
route('GET', '/api/stats', async () => {
  if (Date.now() - st.t > 5000) {
    st.t = Date.now(); const v = {}
    for (const l of lines(await out('docker', ['stats', '--no-stream', '--format', '{{.Name}}|{{.CPUPerc}}|{{.MemUsage}}']))) {
      const [n, cpu, mem] = l.split('|'), m = /^sy-(.+)-\d+$/.exec(n)
      if (m) v[m[1]] = { cpu, mem: mem?.split(' / ')[0] }
    }
    st.v = v
  }
  return st.v
})

route('POST', '/api/hooks/:id/:token', ({ params, body }) => {
  const p = getP(params.id); if (!same(p.hook, params.token)) bad('Token invalide', 403)
  if (body.ref && body.ref !== `refs/heads/${p.branch}`) return { skipped: true }
  start(p); return { queued: true }
}, false)

// ---------- statique + serveur ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json', '.png': 'image/png' }
function serve(p, res) {
  let f = path.join(WEB, p)
  if (!f.startsWith(WEB) || !existsSync(f) || statSync(f).isDirectory()) f = path.join(WEB, 'index.html')
  const ext = path.extname(f), long = f.includes(`${path.sep}assets${path.sep}`) || ext === '.woff2'
  res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream', 'cache-control': long ? 'public,max-age=31536000,immutable' : 'no-cache' })
  createReadStream(f).pipe(res)
}
const readBody = req => new Promise((ok, ko) => {
  let s = ''
  req.on('data', c => { s += c; if (s.length > 1e6) { ko(Object.assign(new Error('Requête trop grosse'), { status: 413 })); req.destroy() } })
  req.on('end', () => { try { ok(s ? JSON.parse(s) : {}) } catch { ko(Object.assign(new Error('JSON invalide'), { status: 400 })) } })
})

syncCaddy()

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x')
  try {
    if (!url.pathname.startsWith('/api/')) return serve(url.pathname, res)
    const r = routes.find(r => r.m === req.method && r.re.test(url.pathname))
    if (!r) bad('Introuvable', 404)
    if (r.auth && !okSession(req.headers.cookie)) bad('Non autorisé', 401)
    const params = r.re.exec(url.pathname).groups || {}
    const body = req.method === 'GET' || req.method === 'DELETE' ? {} : await readBody(req)
    const o = await r.h({ req, res, params, body })
    if (o !== STREAM) json(res, 200, o ?? { ok: true })
  } catch (e) {
    if (res.headersSent) res.end(); else json(res, e.status || 500, { error: e.message })
  }
}).listen(+E.PORT || 3000, () => console.log(`WDock prêt sur :${E.PORT || 3000}`))
