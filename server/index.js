import http from 'node:http'
import { DatabaseSync } from 'node:sqlite'
import { spawn } from 'node:child_process'
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { createReadStream, existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const E = process.env
const BIND = E.BIND_HOST || '127.0.0.1'
const PORT_START = +E.APP_PORT_START || 4000
const DATA = E.DATA_DIR || './data'
const TOKEN = E.GITHUB_TOKEN || ''
const PASS = E.ADMIN_PASSWORD
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

route('POST', '/api/projects', ({ body }) => {
  const name = String(body.name || '').trim()
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 38)
  if (!SLUG.test(id) || ['api'].includes(id)) bad('Nom invalide ou réservé')
  if (db.prepare('select 1 from projects where id=?').get(id)) bad('Ce nom existe déjà', 409)
  const o = check({ ...body })
  const hostport = (db.prepare('select max(hostport) m from projects').get().m || PORT_START - 1) + 1
  db.prepare('insert into projects(id,name,source,repo,branch,image,port,domain,env,hook,created,hostport) values(?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(id, name, o.source, o.repo || '', o.branch || '', o.image || '', o.port, o.domain, JSON.stringify(o.env), randomBytes(16).toString('hex'), Date.now(), hostport)
  start(getP(id)); return { id }
})

route('GET', '/api/projects/:id', async ({ params }) => {
  const p = getP(params.id), c = await ctrs(p.id)
  const state = c[0] ? await out('docker', ['inspect', '-f', '{{.State.Status}}', c[0]]) : 'idle'
  return {
    ...p, url: urlOf(p), status: deploying.has(p.id) ? 'building' : state,
    deploys: db.prepare('select id,status,created,finished from deploys where project=? order by id desc limit 20').all(p.id),
  }
})

route('PATCH', '/api/projects/:id', ({ params, body }) => {
  const p = getP(params.id), o = check({ ...p, ...body, source: p.source })
  db.prepare('update projects set branch=?,image=?,port=?,domain=?,env=? where id=?')
    .run(o.branch, o.image, o.port, o.domain, JSON.stringify(o.env), p.id)
  if (body.redeploy) start(getP(p.id))
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
  db.prepare('delete from deploys where project=?').run(p.id); db.prepare('delete from projects where id=?').run(p.id)
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
}).listen(+E.PORT || 3000, () => console.log(`Shipyard prêt sur :${E.PORT || 3000}`))
