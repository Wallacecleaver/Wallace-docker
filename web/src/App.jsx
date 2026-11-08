import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, Container, ExternalLink, GitBranch, Github, History, KeyRound, LogOut, Play, Plus, RefreshCw, Rocket, Settings, Square, Terminal, Trash2 } from 'lucide-react'

// ---------- utils ----------
const cx = (...a) => a.filter(Boolean).join(' ')
const ago = t => { const s = ((Date.now() - t) / 1e3) | 0; return s < 60 ? `${s}s` : s < 3600 ? `${(s / 60) | 0}m` : s < 86400 ? `${(s / 3600) | 0}h` : `${(s / 86400) | 0}j` }
const envToText = e => Object.entries(e || {}).map(([k, v]) => `${k}=${v}`).join('\n')
const textToEnv = t => Object.fromEntries(t.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#') && l.includes('=')).map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1)]))

async function api(url, opts = {}) {
  const r = await fetch('/api' + url, { credentials: 'same-origin', headers: { 'content-type': 'application/json' }, ...opts, body: opts.body && JSON.stringify(opts.body) })
  if (r.status === 401 && !/^\/(me|login)/.test(url)) location.reload()
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || r.statusText)
  return j
}

function useHash() {
  const [h, s] = useState(location.hash.slice(1) || '/')
  useEffect(() => { const f = () => s(location.hash.slice(1) || '/'); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f) }, [])
  return h
}
function usePoll(url, ms) {
  const [d, setD] = useState(null)
  const load = useCallback(() => api(url).then(setD).catch(() => {}), [url])
  useEffect(() => { setD(null); load(); const t = setInterval(load, ms); return () => clearInterval(t) }, [load, ms])
  return [d, load]
}

// ---------- ui ----------
const inp = 'w-full rounded-xl border border-zinc-800 bg-zinc-900/70 px-4 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-accent-blue/60'
const btn = 'inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-2 text-sm text-zinc-300 transition-all hover:border-zinc-600 hover:text-white disabled:opacity-50'
const btnPrimary = 'inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-medium text-white transition-all hover:shadow-lg hover:shadow-accent-blue/25 disabled:opacity-50'

const ST = { running: ['bg-emerald-400', 'En ligne'], building: ['bg-amber-400 pulse-dot', 'Build en cours'], exited: ['bg-zinc-500', 'Arrêté'], created: ['bg-zinc-500', 'Arrêté'], idle: ['bg-zinc-600', 'Inactif'], restarting: ['bg-red-400 pulse-dot', 'Crash / redémarre'], dead: ['bg-red-400', 'Erreur'] }
function Badge({ s }) {
  const [c, l] = ST[s] || ST.idle
  return <span className="inline-flex items-center gap-2 text-xs text-zinc-400"><i className={cx('h-2 w-2 rounded-full', c)} />{l}</span>
}

function Field({ label, children, hint }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-medium text-zinc-400">{label}</span>{children}{hint && <span className="mt-1 block text-xs text-zinc-600">{hint}</span>}</label>
}

function LogView({ url, h = 'h-96' }) {
  const [t, setT] = useState(''), ref = useRef()
  useEffect(() => {
    setT('')
    const es = new EventSource('/api' + url)
    es.onmessage = e => setT(p => (p + JSON.parse(e.data)).slice(-80000))
    es.addEventListener('end', () => es.close())
    return () => es.close()
  }, [url])
  useEffect(() => { ref.current?.scrollTo(0, ref.current.scrollHeight) }, [t])
  return <pre ref={ref} className={cx(h, 'overflow-auto whitespace-pre-wrap break-all rounded-xl border border-zinc-800 bg-black/60 p-4 font-mono text-xs leading-relaxed text-zinc-300')}>{t || '…'}</pre>
}

// ---------- pages ----------
function Login({ onOk }) {
  const [pw, setPw] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  const submit = async e => {
    e.preventDefault(); setBusy(true); setErr('')
    try { await api('/login', { method: 'POST', body: { password: pw } }); onOk() } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="orb -top-32 -left-32 h-[500px] w-[500px] bg-accent-blue/15" />
      <div className="orb -right-32 top-1/3 h-[400px] w-[400px] bg-accent-purple/10" />
      <form onSubmit={submit} className="fade-up w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900/70 p-8 backdrop-blur">
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-brand"><Rocket size={22} className="text-white" /></div>
        <h1 className="font-display text-3xl font-bold"><span className="gradient-text">Shipyard</span></h1>
        <p className="mb-6 mt-1 text-sm text-zinc-500">Déploie tes projets sur ton VPS.</p>
        <input type="password" autoFocus className={inp} placeholder="Mot de passe" value={pw} onChange={e => setPw(e.target.value)} />
        {err && <p className="mt-3 text-sm text-red-400">{err}</p>}
        <button className={cx(btnPrimary, 'mt-4 w-full')} disabled={busy || !pw}>Se connecter</button>
      </form>
    </main>
  )
}

function Dashboard() {
  const [ps] = usePoll('/projects', 4000), [stats] = usePoll('/stats', 10000)
  if (!ps) return null
  return (
    <div className="fade-up">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="font-display text-4xl font-bold">Projets</h1>
          <p className="mt-1 text-sm text-zinc-500">{ps.length} projet{ps.length > 1 ? 's' : ''}</p>
        </div>
        <a href="#/new" className={btnPrimary}><Plus size={16} /> Nouveau projet</a>
      </div>
      {!ps.length ? (
        <a href="#/new" className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-zinc-800 py-24 text-zinc-500 transition-colors hover:border-zinc-600 hover:text-zinc-300">
          <Rocket size={28} /> Déploie ton premier projet
        </a>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {ps.map(p => (
            <a key={p.id} href={`#/p/${p.id}`} className="group rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-zinc-700">
              <div className="mb-3 flex items-start justify-between gap-3">
                <h3 className="truncate font-display text-lg font-semibold text-white">{p.name}</h3>
                <Badge s={p.status} />
              </div>
              <p className="mb-4 flex items-center gap-2 truncate text-sm text-zinc-500">
                {p.source === 'github' ? <><Github size={14} className="shrink-0" /> {p.repo}<span className="text-zinc-700">·</span><GitBranch size={13} className="shrink-0" />{p.branch}</> : <><Container size={14} className="shrink-0" /> {p.image}</>}
              </p>
              <div className="flex items-center justify-between text-xs text-zinc-600">
                <span className="truncate">{p.url.replace(/^https?:\/\//, '')}</span>
                <span className="shrink-0">{stats?.[p.id] ? `${stats[p.id].cpu} · ${stats[p.id].mem}` : p.last ? `il y a ${ago(p.last.created)}` : ''}</span>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

function NewProject() {
  const [src, setSrc] = useState('github'), [f, setF] = useState({ name: '', repo: '', branch: 'main', image: '', port: 3000, domain: '', env: '' })
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  const set = k => e => setF({ ...f, [k]: e.target.value })
  const submit = async e => {
    e.preventDefault(); setBusy(true); setErr('')
    try {
      const { id } = await api('/projects', { method: 'POST', body: { ...f, source: src, env: textToEnv(f.env) } })
      location.hash = `/p/${id}`
    } catch (x) { setErr(x.message); setBusy(false) }
  }
  return (
    <form onSubmit={submit} className="fade-up mx-auto max-w-xl">
      <a href="#/" className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-white"><ArrowLeft size={15} /> Projets</a>
      <h1 className="mb-6 font-display text-4xl font-bold">Nouveau projet</h1>
      <div className="mb-6 grid grid-cols-2 gap-2 rounded-xl border border-zinc-800 bg-zinc-900/50 p-1">
        {[['github', Github, 'Repo GitHub'], ['docker', Container, 'Image Docker']].map(([k, I, l]) => (
          <button type="button" key={k} onClick={() => setSrc(k)} className={cx('flex items-center justify-center gap-2 rounded-lg py-2 text-sm transition-all', src === k ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300')}><I size={15} /> {l}</button>
        ))}
      </div>
      <div className="space-y-4">
        <Field label="Nom"><input className={inp} required placeholder="mon-site" value={f.name} onChange={set('name')} /></Field>
        {src === 'github' ? (
          <div className="grid grid-cols-[1fr_8rem] gap-3">
            <Field label="Repo"><input className={inp} required placeholder="Wallacecleaver/mon-repo" value={f.repo} onChange={set('repo')} /></Field>
            <Field label="Branche"><input className={inp} value={f.branch} onChange={set('branch')} /></Field>
          </div>
        ) : (
          <Field label="Image"><input className={inp} required placeholder="nginx:alpine" value={f.image} onChange={set('image')} /></Field>
        )}
        <div className="grid grid-cols-[8rem_1fr] gap-3">
          <Field label="Port interne"><input className={inp} type="number" value={f.port} onChange={set('port')} /></Field>
          <Field label="Domaine (optionnel)"><input className={inp} placeholder="mon-site.mondomaine.fr" value={f.domain} onChange={set('domain')} /></Field>
        </div>
        <Field label="Variables d’environnement" hint="Une par ligne : CLE=valeur"><textarea className={cx(inp, 'h-28 font-mono text-xs')} value={f.env} onChange={set('env')} /></Field>
      </div>
      {err && <p className="mt-4 text-sm text-red-400">{err}</p>}
      <button className={cx(btnPrimary, 'mt-6 w-full')} disabled={busy}><Rocket size={16} /> Déployer</button>
    </form>
  )
}

const TABS = [['deploys', History, 'Déploiements'], ['logs', Terminal, 'Logs'], ['env', KeyRound, 'Variables'], ['settings', Settings, 'Paramètres']]

function ProjectPage({ id }) {
  const [p, reload] = usePoll(`/projects/${id}`, 3000)
  const [tab, setTab] = useState('deploys'), [sel, setSel] = useState(null), [env, setEnv] = useState(null), [cfg, setCfg] = useState(null), [msg, setMsg] = useState('')
  useEffect(() => { if (p && env === null) { setEnv(envToText(p.env)); setCfg({ port: p.port, branch: p.branch, domain: p.domain }) } }, [p, env])
  if (!p || env === null) return null
  const act = async (path, opts = { method: 'POST' }, then) => { try { setMsg(''); await api(`/projects/${id}${path}`, opts); then?.() } catch (x) { setMsg(x.message) } reload() }
  const live = sel ?? p.deploys[0]?.id
  const hook = `${location.origin}/api/hooks/${id}/${p.hook}`
  const save = redeploy => act('', { method: 'PATCH', body: { ...cfg, env: textToEnv(env), redeploy } })

  return (
    <div className="fade-up">
      <a href="#/" className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-white"><ArrowLeft size={15} /> Projets</a>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold">{p.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-4">
            <Badge s={p.status} />
            {p.domain
              ? <a href={p.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-accent-blue hover:underline">{p.domain} <ExternalLink size={13} /></a>
              : <span className="text-sm text-zinc-500">localhost:{p.hostport}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          <button className={btnPrimary} disabled={p.status === 'building'} onClick={() => act('/deploy', { method: 'POST' }, () => { setSel(null); setTab('deploys') })}><RefreshCw size={15} /> Redéployer</button>
          {p.status === 'running'
            ? <button className={btn} onClick={() => act('/stop')}><Square size={14} /> Stop</button>
            : p.status !== 'building' && <button className={btn} onClick={() => act('/start')}><Play size={14} /> Start</button>}
        </div>
      </div>

      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-zinc-800/60">
        {TABS.map(([k, I, l]) => (
          <button key={k} onClick={() => setTab(k)} className={cx('flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm transition-colors', tab === k ? 'border-accent-blue text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300')}><I size={15} /> {l}</button>
        ))}
      </div>
      {msg && <p className="mb-4 text-sm text-red-400">{msg}</p>}

      {tab === 'deploys' && (
        <div className="grid gap-5 lg:grid-cols-[16rem_1fr]">
          <div className="space-y-1.5">
            {!p.deploys.length && <p className="text-sm text-zinc-600">Aucun déploiement.</p>}
            {p.deploys.map(d => (
              <button key={d.id} onClick={() => setSel(d.id)} className={cx('flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-sm transition-colors', live === d.id ? 'border-zinc-600 bg-zinc-800/60 text-white' : 'border-zinc-800 text-zinc-400 hover:border-zinc-700')}>
                <span>#{d.id}</span>
                <span className="flex items-center gap-2 text-xs"><i className={cx('h-2 w-2 rounded-full', d.status === 'success' ? 'bg-emerald-400' : d.status === 'failed' ? 'bg-red-400' : 'bg-amber-400 pulse-dot')} />{ago(d.created)}</span>
              </button>
            ))}
          </div>
          {live && <LogView key={live} url={`/deploys/${live}/log`} />}
        </div>
      )}
      {tab === 'logs' && <LogView url={`/projects/${id}/logs`} h="h-[28rem]" />}
      {tab === 'env' && (
        <div className="max-w-2xl">
          <textarea className={cx(inp, 'h-72 font-mono text-xs')} placeholder="CLE=valeur" value={env} onChange={e => setEnv(e.target.value)} />
          <div className="mt-4 flex gap-2">
            <button className={btn} onClick={() => save(false)}>Enregistrer</button>
            <button className={btnPrimary} onClick={() => save(true).then(() => setTab('deploys'))}>Enregistrer & redéployer</button>
          </div>
        </div>
      )}
      {tab === 'settings' && (
        <div className="max-w-xl space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Port interne"><input className={inp} type="number" value={cfg.port} onChange={e => setCfg({ ...cfg, port: e.target.value })} /></Field>
            {p.source === 'github' && <Field label="Branche"><input className={inp} value={cfg.branch} onChange={e => setCfg({ ...cfg, branch: e.target.value })} /></Field>}
          </div>
          <Field label="Domaine"><input className={inp} placeholder="mon-site.mondomaine.fr" value={cfg.domain} onChange={e => setCfg({ ...cfg, domain: e.target.value })} /></Field>
          <button className={btn} onClick={() => save(true).then(() => setTab('deploys'))}>Appliquer & redéployer</button>
          {p.caddy?.enabled
            ? (
              <Field label="Caddy" hint="Le Caddyfile est mis à jour et rechargé automatiquement quand tu appliques.">
                <div className={cx('rounded-xl border p-4 text-xs leading-relaxed', p.caddy.error ? 'border-red-500/40 bg-red-500/10 text-red-300' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300')}>
                  {p.caddy.error ? <pre className="whitespace-pre-wrap font-mono">{p.caddy.error}</pre> : 'Géré automatiquement ✓'}
                </div>
              </Field>
            )
            : (
              <Field label="À ajouter dans ton Caddyfile" hint="Puis : docker exec -w /etc/caddy caddy caddy reload">
                <pre onClick={e => navigator.clipboard?.writeText(e.currentTarget.textContent)} title="Cliquer pour copier" className="cursor-pointer rounded-xl border border-zinc-800 bg-black/60 p-4 font-mono text-xs leading-relaxed text-zinc-300">{`${cfg.domain || 'mon-site.mondomaine.fr'} {\n    reverse_proxy localhost:${p.hostport}\n}`}</pre>
              </Field>
            )}
          {p.source === 'github' && (
            <Field label="Webhook GitHub (push → redéploiement)" hint="Repo → Settings → Webhooks → content type application/json">
              <input readOnly className={cx(inp, 'font-mono text-xs')} value={hook} onFocus={e => e.target.select()} />
            </Field>
          )}
          <div className="border-t border-zinc-800/60 pt-6">
            <button className="inline-flex items-center gap-2 rounded-xl border border-red-900/60 px-4 py-2 text-sm text-red-400 transition-colors hover:bg-red-950/40" onClick={() => confirm(`Supprimer ${p.name} ?`) && act('', { method: 'DELETE' }, () => (location.hash = '/'))}><Trash2 size={15} /> Supprimer le projet</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------- shell ----------
export default function App() {
  const [authed, setAuthed] = useState(null), hash = useHash()
  useEffect(() => { api('/me').then(() => setAuthed(true)).catch(() => setAuthed(false)) }, [])
  if (authed === null) return null
  if (!authed) return <Login onOk={() => setAuthed(true)} />
  const m = /^\/p\/([\w-]+)/.exec(hash)
  return (
    <>
      <div className="orb -top-32 -left-32 h-[500px] w-[500px] bg-accent-blue/10" />
      <div className="orb -right-32 top-1/4 h-[400px] w-[400px] bg-accent-purple/10" />
      <div className="dot-grid fixed inset-0 -z-10 opacity-50" />
      <header className="sticky top-0 z-50 border-b border-zinc-800/30 bg-zinc-950/80 backdrop-blur-xl">
        <nav className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-6">
          <a href="#/" className="font-display text-xl font-bold"><span className="gradient-text">S</span><span className="text-white">hipyard</span><span className="text-zinc-600">.</span></a>
          <button className="flex items-center gap-2 text-sm text-zinc-500 transition-colors hover:text-white" onClick={async () => { await api('/logout', { method: 'POST' }); setAuthed(false) }}><LogOut size={15} /> Déconnexion</button>
        </nav>
      </header>
      <main className="mx-auto max-w-[1200px] px-6 py-10">
        {hash === '/new' ? <NewProject /> : m ? <ProjectPage key={m[1]} id={m[1]} /> : <Dashboard />}
      </main>
    </>
  )
}
