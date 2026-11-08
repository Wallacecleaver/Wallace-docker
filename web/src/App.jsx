import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, Check, ChevronDown, Container, ExternalLink, GitBranch, Github, History, KeyRound, Lock, LogOut, Play, Plus, RefreshCw, Rocket, Search, Settings, Square, Terminal, Trash2 } from 'lucide-react'

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

const slug = t => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 38)
const toDomain = (t, suffix) => { t = t.trim().toLowerCase().replace(/^https?:\/\//, ''); return !t ? '' : !suffix || t.endsWith('.' + suffix) ? t : `${t}.${suffix}` }
const DOMRE = /^([a-z0-9-]+\.)+[a-z]{2,}$/
function useConfig() {
  const [c, setC] = useState({ base: '', suffix: '', caddy: false, ip: '' })
  useEffect(() => { api('/config').then(setC).catch(() => {}) }, [])
  return c
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

function Logo({ size = 32 }) {
  const w = 'M15 19 24 47 32 29 40 47 49 19'
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="WDock" className="shrink-0">
      <defs><linearGradient id="wd-g" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#2e9bfb" /><stop offset="1" stopColor="#CE42FF" /></linearGradient></defs>
      <rect width="64" height="64" rx="16" fill="url(#wd-g)" />
      <path d={w} transform="translate(3 3)" fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d={w} fill="none" stroke="#fff" strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="32" cy="15.5" r="3.2" fill="#fff" />
    </svg>
  )
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

function RepoPicker({ value, onPick, repos, placeholder }) {
  const [open, setOpen] = useState(false), [hi, setHi] = useState(0), box = useRef(null), list = useRef(null)
  useEffect(() => {
    const f = e => { if (box.current && !box.current.contains(e.target)) setOpen(false) }
    addEventListener('mousedown', f); return () => removeEventListener('mousedown', f)
  }, [])
  const q = value.trim().toLowerCase(), exact = repos.some(r => r.name === value)
  const items = !q || exact ? repos : repos.filter(r => r.name.toLowerCase().includes(q))
  useEffect(() => { setHi(0) }, [value])
  useEffect(() => { list.current?.children[hi]?.scrollIntoView({ block: 'nearest' }) }, [hi, open])
  const pick = r => { onPick(r.name); setOpen(false) }
  const onKey = e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setHi(i => Math.min(i + 1, items.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' && open && items[hi]) { e.preventDefault(); pick(items[hi]) }
    else if (e.key === 'Escape') setOpen(false)
  }
  const has = repos.length > 0
  return (
    <div ref={box} className="relative">
      <div className={cx('flex items-center gap-2 rounded-xl border bg-zinc-900/70 px-3.5 transition-colors', open ? 'border-accent-blue/60' : 'border-zinc-800')}>
        <Search size={15} className="shrink-0 text-zinc-600" />
        <input className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-white outline-none placeholder:text-zinc-600" required placeholder={placeholder} value={value} autoComplete="off" spellCheck={false}
          onChange={e => { onPick(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)} onKeyDown={onKey} />
        {has && <button type="button" tabIndex={-1} onClick={() => setOpen(o => !o)} className="shrink-0 text-zinc-500 transition-colors hover:text-white"><ChevronDown size={16} className={cx('transition-transform duration-200', open && 'rotate-180')} /></button>}
      </div>
      {open && has && (
        <div className="fade-up absolute left-0 right-0 z-30 mt-2 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/95 shadow-2xl shadow-black/60 backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-zinc-800/80 px-3.5 py-2 text-[11px] uppercase tracking-wider text-zinc-600">
            <span>Tes repos</span><span>{items.length}/{repos.length}</span>
          </div>
          <div ref={list} className="max-h-72 overflow-y-auto p-1.5">
            {items.length === 0 && <p className="px-3 py-6 text-center text-sm text-zinc-600">Aucun repo ne correspond — tu peux coller un lien.</p>}
            {items.map((r, i) => {
              const [owner, name] = r.name.split('/'), sel = r.name === value
              return (
                <button type="button" key={r.name} onMouseEnter={() => setHi(i)} onClick={() => pick(r)}
                  className={cx('flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors', i === hi ? 'bg-zinc-800/80' : '')}>
                  <span className={cx('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', r.private ? 'bg-amber-400/10 text-amber-300' : 'bg-zinc-800 text-zinc-400')}>{r.private ? <Lock size={14} /> : <Github size={14} />}</span>
                  <span className="min-w-0 flex-1 truncate text-sm"><span className="text-zinc-500">{owner}/</span><span className="font-medium text-white">{name}</span></span>
                  <span className={cx('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium', r.private ? 'bg-amber-400/10 text-amber-300' : 'bg-emerald-400/10 text-emerald-300')}>{r.private ? 'privé' : 'public'}</span>
                  {sel && <Check size={15} className="shrink-0 text-accent-blue" />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function DomainField({ value, onChange, suffix, placeholder }) {
  const inSuffix = !!suffix && (value === '' || value.endsWith('.' + suffix))
  const shown = inSuffix && value ? value.slice(0, -(suffix.length + 1)) : value
  return (
    <div className="flex items-stretch overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/70 transition-colors focus-within:border-accent-blue/60">
      <input className="min-w-0 flex-1 bg-transparent px-4 py-2.5 text-sm text-white outline-none placeholder:text-zinc-600" placeholder={placeholder} value={shown} onChange={e => onChange(toDomain(e.target.value, suffix))} />
      {inSuffix && <span className="flex shrink-0 items-center pr-4 text-sm text-zinc-500">.{suffix}</span>}
    </div>
  )
}

function DnsStatus({ domain, ip }) {
  const [r, setR] = useState(null)
  useEffect(() => {
    setR(null); if (!DOMRE.test(domain || '')) return
    const t = setTimeout(() => api('/dns?domain=' + encodeURIComponent(domain)).then(setR).catch(() => setR(null)), 700)
    return () => clearTimeout(t)
  }, [domain])
  if (!r) return null
  const name = domain.replace(/\.duckdns\.org$/, '')
  const box = 'mt-2 rounded-lg border px-3 py-2 text-xs leading-relaxed '
  if (r.ok) return <p className={box + 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'}>✓ Cette adresse pointe bien vers ton VPS.</p>
  if (r.ips.length) return <p className={box + 'border-amber-500/30 bg-amber-500/10 text-amber-300'}>Cette adresse pointe vers {r.ips[0]}, pas vers ton VPS ({ip}). Soit le nom appartient à quelqu’un d’autre (choisis-en un autre), soit change son IP sur duckdns.org.</p>
  return (
    <p className={box + 'border-amber-500/30 bg-amber-500/10 text-amber-300'}>
      Cette adresse n’existe pas encore. Sur <a href="https://www.duckdns.org" target="_blank" rel="noopener noreferrer" className="underline">duckdns.org</a>, ajoute le nom « {name} » avec l’IP{' '}
      <code onClick={() => navigator.clipboard?.writeText(ip)} title="Cliquer pour copier" className="cursor-pointer rounded bg-black/40 px-1.5 py-0.5 font-mono">{ip}</code>.
    </p>
  )
}

function GitHubBox({ gh, reload }) {
  const [dev, setDev] = useState(null), [tok, setTok] = useState(''), [paste, setPaste] = useState(false), [err, setErr] = useState('')
  useEffect(() => {
    if (!dev) return
    const t = setInterval(() => api('/github/poll', { method: 'POST' }).then(r => { if (r.status === 'ok') { clearInterval(t); setDev(null); reload() } }).catch(x => { clearInterval(t); setDev(null); setErr(x.message) }), (dev.interval + 1) * 1000)
    return () => clearInterval(t)
  }, [dev, reload])
  const start = () => { setErr(''); api('/github/device', { method: 'POST' }).then(setDev).catch(x => setErr(x.message)) }
  const sendTok = () => { setErr(''); api('/github/token', { method: 'POST', body: { token: tok } }).then(() => { setTok(''); setPaste(false); reload() }).catch(x => setErr(x.message)) }
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 text-sm">
      <p className="mb-3 flex items-center gap-2 text-zinc-300"><Github size={15} /> Connecte GitHub pour choisir tes repos dans une liste (et utiliser tes repos privés).</p>
      {dev ? (
        <div className="space-y-2">
          <p className="text-zinc-400">Va sur <a href={dev.url} target="_blank" rel="noopener noreferrer" className="text-accent-blue underline">{dev.url}</a> et entre ce code :</p>
          <p onClick={() => navigator.clipboard?.writeText(dev.user_code)} title="Cliquer pour copier" className="cursor-pointer select-all font-mono text-2xl tracking-widest text-white">{dev.user_code}</p>
          <p className="text-xs text-zinc-500">En attente de ta validation…</p>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          {gh.deviceFlow && <button type="button" className={btnPrimary} onClick={start}><Github size={15} /> Se connecter avec GitHub</button>}
          <button type="button" className={btn} onClick={() => setPaste(!paste)}><KeyRound size={15} /> {gh.deviceFlow ? 'Ou coller un token' : 'Coller un token GitHub'}</button>
        </div>
      )}
      {paste && !dev && (
        <div className="mt-3 flex gap-2">
          <input type="password" className={inp} placeholder="ghp_… ou github_pat_…" value={tok} onChange={e => setTok(e.target.value)} />
          <button type="button" className={btn} disabled={!tok} onClick={sendTok}>Connecter</button>
        </div>
      )}
      {(err || gh.error) && <p className="mt-3 text-xs text-red-400">{err || gh.error}</p>}
    </div>
  )
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
        <div className="mb-6"><Logo size={52} /></div>
        <h1 className="font-display text-3xl font-bold"><span className="gradient-text">WDock</span></h1>
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
  const cfg = useConfig(), [touched, setTouched] = useState(false)
  const [gh, setGh] = useState(null), [repos, setRepos] = useState([])
  const loadGh = useCallback(() => api('/github').then(g => { setGh(g); if (g.connected) api('/github/repos').then(setRepos).catch(() => {}) }).catch(() => {}), [])
  useEffect(() => { loadGh() }, [loadGh])
  const [src, setSrc] = useState('github'), [f, setF] = useState({ name: '', repo: '', branch: 'main', image: '', port: 3000, domain: '', env: '' })
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  const [envFile, setEnvFile] = useState(''), [envEdited, setEnvEdited] = useState(false), [adv, setAdv] = useState(false)
  // Préremplit les variables d'environnement depuis le .env.example du repo choisi
  useEffect(() => {
    if (src !== 'github' || envEdited) return
    const m = f.repo.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/$/, '').match(/^([\w.-]+\/[\w.-]+)/)
    if (!m) { setEnvFile(''); return }
    let dead = false
    const t = setTimeout(() => {
      api(`/github/env?repo=${encodeURIComponent(m[1])}&branch=${encodeURIComponent(f.branch || '')}`).then(r => {
        if (dead) return
        if (!r.file) { setEnvFile(''); setF(x => x.env && x.envAuto ? { ...x, env: '', envAuto: false } : x); return }
        const vars = textToEnv(r.text), port = vars.PORT
        delete vars.PORT
        setEnvFile(r.file)
        setF(x => ({ ...x, env: envToText(vars), envAuto: true, port: port && /^\d{2,5}$/.test(port) && Number(x.port) === 3000 ? Number(port) : x.port }))
        if (Object.keys(vars).length) setAdv(true)
      }).catch(() => {})
    }, 500)
    return () => { dead = true; clearTimeout(t) }
  }, [f.repo, f.branch, src, envEdited])
  const autoDomain = name => touched || !cfg.suffix ? undefined : toDomain(slug(name), cfg.suffix)
  const set = k => e => { const v = e.target.value; setF(x => ({ ...x, [k]: v })) }
  const onName = e => { const name = e.target.value; setF(x => ({ ...x, name, domain: autoDomain(name) ?? x.domain })) }
  const onDomain = v => { setTouched(true); setF(x => ({ ...x, domain: v })) }
  const onRepo = e => {
    const v = e.target.value, m = repos.find(r => r.name === v)
    setF(x => {
      const y = { ...x, repo: v }
      if (m) { y.branch = m.branch; if (!x.name) { y.name = m.name.split('/')[1]; y.domain = autoDomain(y.name) ?? x.domain } }
      return y
    })
  }
  const submit = async e => {
    e.preventDefault(); setBusy(true); setErr('')
    try {
      const { id } = await api('/projects', { method: 'POST', body: { ...f, source: src, env: textToEnv(f.env) } })
      location.hash = `/p/${id}`
    } catch (x) { setErr(x.message); setBusy(false) }
  }
  const exemple = cfg.base && cfg.suffix && cfg.base.endsWith('.' + cfg.suffix) ? cfg.base.slice(0, -(cfg.suffix.length + 1)) : ''
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
        <Field label="Nom"><input className={inp} required placeholder="mon-addon" value={f.name} onChange={onName} /></Field>
        {src === 'github' ? (
          <>
            {gh && !gh.connected && <GitHubBox gh={gh} reload={loadGh} />}
            <div>
              <span className="mb-1.5 block text-xs font-medium text-zinc-400">Repo GitHub</span>
              <RepoPicker value={f.repo} repos={repos} placeholder="Wallacecleaver/mon-repo" onPick={v => onRepo({ target: { value: v } })} />
              <span className="mt-1 block text-xs text-zinc-600">{gh?.connected ? `Cherche, choisis dans la liste ou colle un lien · connecté : @${gh.login}` : 'Colle le lien du repo ou écris proprietaire/repo'}</span>
            </div>
            {gh?.connected && <button type="button" className="text-xs text-zinc-500 underline hover:text-white" onClick={() => api('/github', { method: 'DELETE' }).then(() => { setRepos([]); loadGh() })}>Déconnecter GitHub</button>}
          </>
        ) : (
          <Field label="Image Docker"><input className={inp} required placeholder="nginx:alpine" value={f.image} onChange={set('image')} /></Field>
        )}
        <Field label="Adresse de l’addon" hint={f.domain ? `https://${f.domain}` : 'Laisse vide pour ne pas publier le projet sur internet'}>
          <DomainField value={f.domain} onChange={onDomain} suffix={cfg.suffix} placeholder="mon-addon" />
          <DnsStatus domain={f.domain} ip={cfg.ip} />
          {exemple && <p className="mt-2 text-xs text-zinc-600">Astuce : écrire <span className="font-mono text-zinc-500">mon-addon.{exemple}</span> fonctionne sans rien créer sur DuckDNS.</p>}
        </Field>
        <Field label="Port de l’addon" hint="Le port utilisé par ton addon (ex. 7000). Dans le doute, laisse 3000 : il est aussi transmis à l’appli via la variable PORT.">
          <input className={inp} type="number" value={f.port} onChange={set('port')} />
        </Field>
        <details open={adv} onToggle={e => setAdv(e.currentTarget.open)} className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
          <summary className="cursor-pointer text-sm text-zinc-400 transition-colors hover:text-white">Options avancées (branche, variables)</summary>
          <div className="mt-4 space-y-4">
            {src === 'github' && <Field label="Branche"><input className={inp} value={f.branch} onChange={set('branch')} /></Field>}
            <Field label="Variables d’environnement" hint={envFile && !envEdited ? `Prérempli depuis ${envFile} — remplace les valeurs d’exemple par les tiennes` : 'Une par ligne : CLE=valeur'}><textarea className={cx(inp, 'h-28 font-mono text-xs')} value={f.env} onChange={e => { setEnvEdited(true); set('env')(e) }} /></Field>
          </div>
        </details>
      </div>
      {err && <p className="mt-4 text-sm text-red-400">{err}</p>}
      <button className={cx(btnPrimary, 'mt-6 w-full')} disabled={busy}><Rocket size={16} /> Déployer</button>
    </form>
  )
}

function ProjectPage({ id }) {
  const conf = useConfig()
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
            <Field label="Port de l’addon" hint="Celui sur lequel ton addon écoute"><input className={inp} type="number" value={cfg.port} onChange={e => setCfg({ ...cfg, port: e.target.value })} /></Field>
            {p.source === 'github' && <Field label="Branche"><input className={inp} value={cfg.branch} onChange={e => setCfg({ ...cfg, branch: e.target.value })} /></Field>}
          </div>
          <Field label="Adresse de l’addon" hint={cfg.domain ? `https://${cfg.domain}` : undefined}><DomainField value={cfg.domain} onChange={d => setCfg({ ...cfg, domain: d })} suffix={conf.suffix} placeholder="mon-addon" /><DnsStatus domain={cfg.domain} ip={conf.ip} /></Field>
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
          <a href="#/" className="flex items-center gap-2.5 font-display text-xl font-bold"><Logo size={30} /><span><span className="gradient-text">W</span><span className="text-white">Dock</span></span></a>
          <button className="flex items-center gap-2 text-sm text-zinc-500 transition-colors hover:text-white" onClick={async () => { await api('/logout', { method: 'POST' }); setAuthed(false) }}><LogOut size={15} /> Déconnexion</button>
        </nav>
      </header>
      <main className="mx-auto max-w-[1200px] px-6 py-10">
        {hash === '/new' ? <NewProject /> : m ? <ProjectPage key={m[1]} id={m[1]} /> : <Dashboard />}
      </main>
    </>
  )
}
