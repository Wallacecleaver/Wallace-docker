import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Activity, ArrowDown, ArrowDownUp, ArrowLeft, ArrowUp, Check, ChevronDown, CircleCheck, CircleX, Clock, Container, Copy, Cpu, ExternalLink, GitBranch, Github, Globe, Hash, HeartPulse, History, KeyRound, LoaderCircle, Lock, LogOut, MemoryStick, Play, Plus, RefreshCw, Rocket, Save, Search, Settings, ShieldCheck, Square, SquareTerminal, Terminal, Trash2, TriangleAlert } from 'lucide-react'

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

const ST = { running: ['bg-emerald-400', 'En ligne'], unhealthy: ['bg-red-400 pulse-dot', 'Défaillant'], starting: ['bg-amber-400 pulse-dot', 'Démarrage'], building: ['bg-amber-400 pulse-dot', 'Build en cours'], exited: ['bg-zinc-500', 'Arrêté'], created: ['bg-zinc-500', 'Arrêté'], idle: ['bg-zinc-600', 'Inactif'], restarting: ['bg-red-400 pulse-dot', 'Crash / redémarre'], dead: ['bg-red-400', 'Erreur'] }
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

const logCls = l => /^→/.test(l) ? 'text-accent-blue' : /^✓/.test(l) ? 'text-emerald-400' : /^✗|\b(error|failed|fatal)\b/i.test(l) ? 'text-red-400' : /^#\d+ (DONE|CACHED)|^\s*$/.test(l) ? 'text-zinc-600' : 'text-zinc-300'

function CopyBtn({ text, label, className }) {
  const [ok, setOk] = useState(false)
  return (
    <button type="button" title="Copier" onClick={() => { navigator.clipboard?.writeText(text); setOk(true); setTimeout(() => setOk(false), 1500) }}
      className={cx('inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 px-2.5 py-1.5 text-xs text-zinc-400 transition-colors hover:border-zinc-600 hover:text-white', className)}>
      {ok ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}{label}
    </button>
  )
}

function LogView({ url, h = 'h-[26rem]', title }) {
  const [t, setT] = useState(''), [follow, setFollow] = useState(true), [done, setDone] = useState(false), ref = useRef()
  useEffect(() => {
    setT(''); setDone(false); setFollow(true)
    const es = new EventSource('/api' + url)
    es.onmessage = e => setT(p => (p + JSON.parse(e.data)).slice(-80000))
    es.addEventListener('end', () => { setDone(true); es.close() })
    return () => es.close()
  }, [url])
  useEffect(() => { if (follow && ref.current) ref.current.scrollTop = ref.current.scrollHeight }, [t, follow])
  const lines = useMemo(() => t.replace(/\n$/, '').split('\n'), [t])
  const onScroll = e => { const el = e.currentTarget; setFollow(el.scrollHeight - el.scrollTop - el.clientHeight < 40) }
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-black/60">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-800/80 bg-zinc-900/60 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-3 text-xs text-zinc-400">
          <span className="flex gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-zinc-700" /><i className="h-2.5 w-2.5 rounded-full bg-zinc-700" /><i className="h-2.5 w-2.5 rounded-full bg-zinc-700" /></span>
          <span className="truncate font-medium text-zinc-300">{title}</span>
          {!done ? <span className="flex items-center gap-1.5 text-emerald-400"><i className="pulse-dot h-1.5 w-1.5 rounded-full bg-emerald-400" />en direct</span> : <span className="text-zinc-600">terminé</span>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!follow && <button type="button" onClick={() => setFollow(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-accent-blue/40 bg-accent-blue/10 px-2.5 py-1.5 text-xs text-accent-blue transition-colors hover:bg-accent-blue/20"><ArrowDown size={13} /> Suivre</button>}
          <CopyBtn text={t} label="Copier" />
        </div>
      </div>
      <div ref={ref} onScroll={onScroll} className={cx(h, 'overflow-auto p-4 font-mono text-xs leading-relaxed')}>
        {!t && <p className="text-zinc-600">En attente des logs…</p>}
        {t && lines.map((l, i) => {
          const m = /^(\d{4}-\d\d-\d\dT(\d\d:\d\d:\d\d)\S*)\s(.*)$/.exec(l)
          return <div key={i} className={cx('whitespace-pre-wrap break-all', logCls(m ? m[3] : l))}>{m && <span className="mr-3 select-none text-zinc-600">{m[2]}</span>}{m ? m[3] : l || ' '}</div>
        })}
      </div>
    </div>
  )
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

// « 12.43MiB » / « 1.2GiB » → Mio ; puis affichage lisible
const toMiB = s => { const m = /([\d.]+)\s*([KMGT]?i?B)/i.exec(s || ''); if (!m) return 0; const u = m[2].toUpperCase(); return +m[1] * ({ B: 1 / 1048576, KIB: 1 / 1024, KB: 1 / 1024, MIB: 1, MB: 1, GIB: 1024, GB: 1024, TIB: 1048576, TB: 1048576 }[u] || 0) }
const fmtMiB = v => v >= 1024 ? `${(v / 1024).toFixed(1)} Gio` : `${v < 10 ? v.toFixed(1) : Math.round(v)} Mio`
// L'état affiché tient compte du test de santé : « En ligne » ne ment plus quand le HEALTHCHECK échoue
const shownState = p => p.status === 'running' && (p.health === 'unhealthy' || p.health === 'starting') ? p.health : p.status
const BAD = ['unhealthy', 'restarting', 'dead']

function ProjectCard({ p, stat }) {
  const st = shownState(p), host = p.url.replace(/^https?:\/\//, ''), live = p.status === 'running'
  const failed = p.last?.status === 'failed' && p.status !== 'building'
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-zinc-700 hover:shadow-xl hover:shadow-black/30">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-accent-blue/[0.08] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      {/* lien étiré : toute la carte ouvre le projet, sauf l'adresse du site qui a son propre lien */}
      <a href={`#/p/${p.id}`} className="absolute inset-0 rounded-2xl" aria-label={`Ouvrir ${p.name}`} />
      <div className="pointer-events-none relative">
        <div className="mb-2.5 flex items-start justify-between gap-3">
          <h3 className="truncate font-display text-lg font-semibold text-white">{p.name}</h3>
          <span className={cx('shrink-0 rounded-full border px-2.5 py-0.5', BAD.includes(st) ? 'border-red-900/60 bg-red-950/30' : 'border-zinc-800 bg-zinc-950/40')}><Badge s={st} /></span>
        </div>
        <p className="flex items-center gap-2 truncate text-sm text-zinc-400">
          {p.source === 'github' ? <><Github size={14} className="shrink-0 text-zinc-500" /> {p.repo}<span className="text-zinc-700">·</span><GitBranch size={13} className="shrink-0 text-zinc-500" />{p.branch}</> : <><Container size={14} className="shrink-0 text-zinc-500" /> {p.image}</>}
        </p>
      </div>
      <div className="pointer-events-none relative mt-4 border-t border-zinc-800/70 pt-3.5">
        {p.domain
          ? <a href={p.url} target="_blank" rel="noopener noreferrer" className="pointer-events-auto relative inline-flex max-w-full items-center gap-1.5 text-sm text-zinc-300 transition-colors hover:text-accent-blue"><Globe size={14} className="shrink-0 text-zinc-500" /><span className="truncate">{host}</span><ExternalLink size={12} className="shrink-0 opacity-60" /></a>
          : <span className="inline-flex max-w-full items-center gap-1.5 text-sm text-zinc-400"><Globe size={14} className="shrink-0 text-zinc-500" /><span className="truncate">{host}</span></span>}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {live && stat && <><Chip icon={Cpu}>{(parseFloat(stat.cpu) || 0).toFixed(1)} %</Chip><Chip icon={MemoryStick}>{fmtMiB(toMiB(stat.mem))}</Chip></>}
          {failed
            ? <span className="inline-flex items-center gap-1.5 rounded-lg border border-red-900/50 bg-red-950/30 px-2.5 py-1 text-xs text-red-300"><CircleX size={13} /> Dernier déploiement échoué</span>
            : p.last && <Chip icon={Clock}>il y a {ago(p.last.created)}</Chip>}
        </div>
      </div>
    </div>
  )
}

function Dashboard() {
  const [ps] = usePoll('/projects', 4000), [stats] = usePoll('/stats', 10000)
  if (!ps) return (
    <div>
      <div className="mb-8"><div className="h-10 w-40 animate-pulse rounded-lg bg-zinc-900 motion-reduce:animate-none" /><div className="mt-3 h-4 w-24 animate-pulse rounded bg-zinc-900/70 motion-reduce:animate-none" /></div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map(i => <div key={i} className="h-[190px] animate-pulse rounded-2xl border border-zinc-800/70 bg-zinc-900/40 motion-reduce:animate-none" />)}</div>
    </div>
  )
  const up = ps.filter(p => p.status === 'running'), bad = ps.filter(p => BAD.includes(shownState(p))).length
  const cpu = up.reduce((a, p) => a + (parseFloat(stats?.[p.id]?.cpu) || 0), 0), mem = up.reduce((a, p) => a + toMiB(stats?.[p.id]?.mem), 0)
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
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="col-span-2 sm:col-span-1">
              <StatCard icon={Activity} label="En ligne" value={`${up.length} / ${ps.length}`}>
                {bad ? <p className="mt-1.5 flex items-center gap-1.5 text-xs text-red-400"><TriangleAlert size={12} /> {bad} à vérifier</p> : <p className="mt-1.5 text-xs text-zinc-500">{up.length === ps.length ? 'Tout fonctionne' : `${ps.length - up.length} arrêté${ps.length - up.length > 1 ? 's' : ''}`}</p>}
              </StatCard>
            </div>
            <StatCard icon={Cpu} label="CPU total" value={stats ? `${cpu.toFixed(1)} %` : '—'} />
            <StatCard icon={MemoryStick} label="Mémoire" value={stats ? fmtMiB(mem) : '—'} />
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {ps.map(p => <ProjectCard key={p.id} p={p} stat={stats?.[p.id]} />)}
            <a href="#/new" className="group flex min-h-[190px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-zinc-800 text-sm text-zinc-500 transition-all duration-300 hover:-translate-y-1 hover:border-accent-blue/50 hover:text-white">
              <span className="grid h-11 w-11 place-items-center rounded-xl border border-zinc-800 bg-zinc-900/70 transition-colors group-hover:border-accent-blue/50"><Plus size={20} /></span>
              Nouveau projet
            </a>
          </div>
        </>
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

// Terminal du projet : une commande à la fois dans le conteneur (pas de saisie interactive). Le serveur ajoute en fin de sortie un marqueur avec le code de sortie et le dossier courant.
const MARK = '\n__WDOCK__'
function parseRun(raw) {
  const i = raw.lastIndexOf(MARK)
  if (i === -1) { // un début de marqueur peut arriver coupé en deux : on ne l'affiche pas
    for (let n = Math.min(MARK.length - 1, raw.length); n > 0; n--) if (raw.endsWith(MARK.slice(0, n))) return { text: raw.slice(0, -n) }
    return { text: raw }
  }
  const m = /^__WDOCK__(\d+)__(.*)/.exec(raw.slice(i + 1))
  return { text: raw.slice(0, i), code: m ? +m[1] : undefined, cwd: m ? m[2].trim() : undefined }
}

function TermView({ id, name, running }) {
  const [items, setItems] = useState([]), [cmd, setCmd] = useState(''), [cwd, setCwd] = useState(''), [busy, setBusy] = useState(false)
  const ctl = useRef(null), box = useRef(), field = useRef(), hist = useRef({ list: [], i: -1 })
  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight }, [items])
  useEffect(() => { if (!busy) field.current?.focus({ preventScroll: true }) }, [busy])
  useEffect(() => () => ctl.current?.abort(), [])
  const run = async c => {
    const ac = new AbortController(); ctl.current = ac; setBusy(true)
    setItems(l => [...l, { cmd: c, cwd, out: '', busy: true }])
    const upd = f => setItems(l => l.map((x, i) => i === l.length - 1 ? f(x) : x))
    let raw = ''
    try {
      const r = await fetch(`/api/projects/${id}/exec`, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cmd: c, cwd }), signal: ac.signal })
      if (r.status === 401) { location.reload(); return }
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.statusText)
      const rd = r.body.getReader(), dec = new TextDecoder()
      for (;;) {
        const { done, value } = await rd.read(); if (done) break
        raw += dec.decode(value, { stream: true }); const v = parseRun(raw)
        upd(x => ({ ...x, out: v.text.slice(-200000) }))
      }
      raw += dec.decode(); const v = parseRun(raw)
      upd(x => ({ ...x, out: v.text.slice(-200000), code: v.code, busy: false })); if (v.cwd) setCwd(v.cwd)
    } catch (e) {
      upd(x => ({ ...x, out: parseRun(raw).text + (e.name === 'AbortError' ? '\n^C' : `\n✗ ${e.message}`), busy: false }))
    }
    ctl.current = null; setBusy(false)
  }
  const submit = e => {
    e.preventDefault(); const c = cmd.trim(); if (!c || busy || !running) return
    setCmd('')
    if (c === 'clear') { setItems([]); return }
    hist.current = { list: [c, ...hist.current.list.filter(x => x !== c)].slice(0, 50), i: -1 }
    run(c)
  }
  const onKey = e => {
    const h = hist.current
    if (e.key === 'ArrowUp' && h.list.length) { e.preventDefault(); h.i = Math.min(h.i + 1, h.list.length - 1); setCmd(h.list[h.i]) }
    else if (e.key === 'ArrowDown') { e.preventDefault(); h.i = Math.max(h.i - 1, -1); setCmd(h.i < 0 ? '' : h.list[h.i]) }
    else if (e.key === 'c' && e.ctrlKey && busy) { e.preventDefault(); ctl.current?.abort() }
  }
  const dir = d => d || '~'
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-black/60">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-800/80 bg-zinc-900/60 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-3 text-xs text-zinc-400">
          <span className="flex gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-zinc-700" /><i className="h-2.5 w-2.5 rounded-full bg-zinc-700" /><i className="h-2.5 w-2.5 rounded-full bg-zinc-700" /></span>
          <span className="truncate font-medium text-zinc-300">Terminal · {name}</span>
          {busy ? <span className="flex items-center gap-1.5 text-amber-300"><i className="pulse-dot h-1.5 w-1.5 rounded-full bg-amber-400" />en cours</span>
            : running ? <span className="text-emerald-400">prêt</span> : <span className="text-zinc-600">conteneur arrêté</span>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {busy && <button type="button" onClick={() => ctl.current?.abort()} className="inline-flex items-center gap-1.5 rounded-lg border border-red-900/60 px-2.5 py-1.5 text-xs text-red-400 transition-colors hover:bg-red-950/40"><Square size={12} /> Interrompre</button>}
          <button type="button" onClick={() => setItems([])} className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 px-2.5 py-1.5 text-xs text-zinc-400 transition-colors hover:border-zinc-600 hover:text-white">Effacer</button>
        </div>
      </div>
      <div ref={box} onClick={() => { if (!getSelection()?.toString()) field.current?.focus() }} className="h-[32rem] overflow-auto p-4 font-mono text-xs leading-relaxed">
        {!items.length && <p className="mb-3 text-zinc-600">{running ? 'Tape une commande (ex. ls, cat package.json, env). Une commande à la fois, sans saisie interactive ; ↑ ↓ pour l’historique.' : 'Le conteneur est arrêté : démarre-le pour utiliser le terminal.'}</p>}
        {items.map((x, i) => (
          <div key={i} className="mb-3">
            <div className="break-all text-accent-blue"><span className="select-none text-zinc-500">{dir(x.cwd)} $ </span>{x.cmd}</div>
            {x.out.replace(/\n$/, '') && <pre className="whitespace-pre-wrap break-all font-mono text-zinc-300">{x.out.replace(/\n$/, '')}</pre>}
            {x.busy ? <div className="text-zinc-600">…</div> : x.code ? <div className="text-red-400">code de sortie {x.code}</div> : null}
          </div>
        ))}
        <form onSubmit={submit} className="flex items-center gap-2">
          <span className="shrink-0 select-none text-zinc-500">{dir(cwd)} $</span>
          <input ref={field} value={cmd} onChange={e => setCmd(e.target.value)} onKeyDown={onKey} readOnly={busy || !running} autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false}
            className="min-w-0 flex-1 bg-transparent font-mono text-xs text-white outline-none" aria-label="Commande" />
        </form>
      </div>
    </div>
  )
}

const TABS = [['deploys', History, 'Déploiements'], ['logs', Terminal, 'Logs'], ['terminal', SquareTerminal, 'Terminal'], ['env', KeyRound, 'Variables'], ['settings', Settings, 'Paramètres']]
const span = ms => { const s = Math.max(0, Math.round(ms / 1000)), d = (s / 86400) | 0, h = ((s % 86400) / 3600) | 0, m = ((s % 3600) / 60) | 0; return d ? `${d}j ${h}h` : h ? `${h}h ${m}m` : m ? `${m}m ${s % 60}s` : `${s}s` }

function useStats(id) {
  const [s, setS] = useState(null), [h, setH] = useState({ cpu: [], mem: [] })
  useEffect(() => {
    let dead = false
    const load = () => api(`/projects/${id}/stats`).then(r => {
      if (dead) return
      setS(r)
      if (r.running) setH(o => ({ cpu: [...o.cpu, r.cpu].slice(-30), mem: [...o.mem, r.memPct].slice(-30) }))
    }).catch(() => {})
    load(); const t = setInterval(load, 4000)
    return () => { dead = true; clearInterval(t) }
  }, [id])
  return [s, h]
}

function Spark({ data, color, id }) {
  const W = 120, H = 36, N = 30
  if (data.length < 2) return <div className="h-9" />
  const max = Math.max(...data, 1) * 1.25
  const pts = data.map((v, i) => [W - (data.length - 1 - i) * (W / (N - 1)), H - 2 - (v / max) * (H - 6)])
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-9 w-full">
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".35" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <path d={`${line} L${pts.at(-1)[0].toFixed(1)} ${H} L${pts[0][0].toFixed(1)} ${H} Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

function StatCard({ icon: I, label, value, sub, children }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="mb-2.5 flex items-center justify-between text-xs text-zinc-500">
        <span className="flex items-center gap-2"><I size={14} />{label}</span>{sub && <span className="truncate pl-2 text-zinc-600">{sub}</span>}
      </div>
      <p className="truncate font-display text-2xl font-semibold text-white">{value}</p>
      {children}
    </div>
  )
}

function StatusPill({ s }) {
  const [c, l] = ST[s] || ST.idle
  return <span className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/70 px-3 py-1 text-xs text-zinc-300"><i className={cx('h-2 w-2 rounded-full', c)} />{l}</span>
}

function Chip({ icon: I, href, children }) {
  const c = 'inline-flex max-w-full items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/50 px-2.5 py-1 text-xs text-zinc-400'
  const body = <><I size={13} className="shrink-0" /><span className="truncate">{children}</span></>
  return href ? <a href={href} target="_blank" rel="noopener noreferrer" className={cx(c, 'transition-colors hover:border-zinc-600 hover:text-white')}>{body}</a> : <span className={c}>{body}</span>
}

function Card({ title, desc, children, tone }) {
  return (
    <section className={cx('rounded-2xl border p-5', tone === 'danger' ? 'border-red-900/40 bg-red-950/10' : 'border-zinc-800 bg-zinc-900/40')}>
      <h3 className={cx('text-sm font-semibold', tone === 'danger' ? 'text-red-300' : 'text-white')}>{title}</h3>
      {desc && <p className="mt-1 mb-4 text-xs text-zinc-500">{desc}</p>}
      {!desc && <div className="mb-4" />}
      {children}
    </section>
  )
}

function ProjectPage({ id }) {
  const conf = useConfig(), [stats, hist] = useStats(id)
  const [p, reload] = usePoll(`/projects/${id}`, 3000)
  const [tab, setTab] = useState('deploys'), [sel, setSel] = useState(null), [env, setEnv] = useState(null), [base, setBase] = useState(''), [cfg, setCfg] = useState(null), [msg, setMsg] = useState('')
  const [syncing, setSyncing] = useState(false), [syncMsg, setSyncMsg] = useState('')
  const [, tick] = useState(0)
  useEffect(() => { const t = setInterval(() => tick(n => n + 1), 1000); return () => clearInterval(t) }, [])
  useEffect(() => { if (p && env === null) { const e = envToText(p.env); setEnv(e); setBase(e); setCfg({ port: p.port, branch: p.branch, domain: p.domain }) } }, [p, env])
  if (!p || env === null) return null
  const act = async (path, opts = { method: 'POST' }, then) => { let ok = true; try { setMsg(''); await api(`/projects/${id}${path}`, opts); then?.() } catch (x) { ok = false; setMsg(x.message) } reload(); return ok }
  const live = sel ?? p.deploys[0]?.id
  const hook = `${location.origin}/api/hooks/${id}/${p.hook}`
  const save = async redeploy => { const ok = await act('', { method: 'PATCH', body: { ...cfg, env: textToEnv(env), redeploy } }); if (ok) setBase(env); return ok }
  const nVars = Object.keys(textToEnv(env)).length, dirty = env !== base
  // Ajoute à la liste les variables du .env.example du repo qui n'y sont pas encore (celles déjà présentes ne sont jamais touchées)
  const syncEnv = async () => {
    setSyncing(true); setSyncMsg('')
    try {
      const r = await api(`/github/env?repo=${encodeURIComponent(p.repo)}&branch=${encodeURIComponent(cfg.branch || p.branch || '')}`)
      if (!r.file) return setSyncMsg('Aucun fichier .env.example (ou .env.sample…) trouvé à la racine du repo. Pour un repo privé, connecte GitHub dans « Nouveau projet ».')
      const ex = textToEnv(r.text), have = textToEnv(env), added = Object.keys(ex).filter(k => k !== 'PORT' && !(k in have))
      if (!added.length) return setSyncMsg(`Rien à ajouter : toutes les variables de ${r.file} sont déjà dans ta liste.`)
      setEnv(e => e.replace(/\s*$/, '') + (e.trim() ? '\n' : '') + added.map(k => `${k}=${ex[k]}`).join('\n'))
      setSyncMsg(`${added.length} variable${added.length > 1 ? 's' : ''} ajoutée${added.length > 1 ? 's' : ''} depuis ${r.file} : ${added.join(', ')}. Remplace les valeurs d’exemple par les tiennes, puis enregistre.`)
    } catch (x) { setSyncMsg(x.message) } finally { setSyncing(false) }
  }
  const run = stats?.running, last = p.deploys[0], firstOk = p.deploys.find(d => d.status === 'success')?.id
  const memPct = Math.min(100, stats?.memPct || 0)

  return (
    <div className="fade-up">
      <a href="#/" className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-white"><ArrowLeft size={15} /> Projets</a>

      <div className="mb-8 flex flex-wrap items-start justify-between gap-5">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand font-display text-2xl font-bold text-white shadow-lg shadow-accent-blue/20">{p.name[0]?.toUpperCase()}</div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3"><h1 className="truncate font-display text-3xl font-bold sm:text-4xl">{p.name}</h1><StatusPill s={p.status} /></div>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {p.domain && <Chip icon={Globe} href={p.url}>{p.domain}</Chip>}
              {p.source === 'github' ? <><Chip icon={Github} href={`https://github.com/${p.repo}`}>{p.repo}</Chip><Chip icon={GitBranch}>{p.branch}</Chip></> : <Chip icon={Container}>{p.image}</Chip>}
              <Chip icon={Hash}>port {p.port}</Chip>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {p.domain && <a href={p.url} target="_blank" rel="noopener noreferrer" className={btn}><ExternalLink size={15} /> Ouvrir</a>}
          {p.status === 'running'
            ? <button className={btn} onClick={() => act('/stop')}><Square size={14} /> Stop</button>
            : p.status !== 'building' && <button className={btn} onClick={() => act('/start')}><Play size={14} /> Start</button>}
          <button className={btnPrimary} disabled={p.status === 'building'} onClick={() => act('/deploy', { method: 'POST' }, () => { setSel(null); setTab('deploys') })}><RefreshCw size={15} className={p.status === 'building' ? 'animate-spin' : ''} /> Redéployer</button>
        </div>
      </div>

      {run && stats.health === 'unhealthy' && (
        <div className="mb-4 rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
          <p className="flex items-center gap-2 font-medium"><HeartPulse size={15} /> Le test de santé (HEALTHCHECK) du conteneur échoue</p>
          {stats.healthOut
            ? <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-words font-mono text-xs text-red-200/80">{stats.healthOut}{stats.healthExit != null ? `\n(code de sortie ${stats.healthExit})` : ''}</pre>
            : <p className="mt-1 text-xs text-red-300/70">Aucune sortie du test : regarde l’onglet Logs.</p>}
        </div>
      )}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Cpu} label="CPU" value={run ? `${stats.cpu.toFixed(1)} %` : '—'}>
          {run ? <div className="mt-2"><Spark data={hist.cpu} color="#2e9bfb" id="sp-cpu" /></div> : <p className="mt-2 text-xs text-zinc-600">Conteneur arrêté</p>}
        </StatCard>
        <StatCard icon={MemoryStick} label="Mémoire" value={run ? stats.memUsed : '—'} sub={run ? `/ ${stats.memLimit}` : ''}>
          {run ? <>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-800"><div className="h-full rounded-full bg-brand transition-all duration-700" style={{ width: `${Math.max(2, memPct)}%` }} /></div>
            <div className="mt-1.5 flex justify-between text-[11px] text-zinc-600"><span>{stats.memPct.toFixed(1)} % utilisé</span><span>{stats.pids} processus</span></div>
          </> : <p className="mt-2 text-xs text-zinc-600">Conteneur arrêté</p>}
        </StatCard>
        <StatCard icon={ArrowDownUp} label="Réseau" value={run ? stats.rx : '—'} sub={run ? 'reçu' : ''}>
          {run ? <p className="mt-3 flex items-center gap-1.5 text-xs text-zinc-500"><ArrowUp size={12} className="text-accent-purple" /> {stats.tx} envoyés depuis le démarrage</p> : <p className="mt-2 text-xs text-zinc-600">Conteneur arrêté</p>}
        </StatCard>
        <StatCard icon={Activity} label="Disponibilité" value={run && stats.started ? span(Date.now() - new Date(stats.started).getTime()) : '—'} sub={run ? 'en ligne' : ''}>
          <div className="mt-3 space-y-1 text-xs text-zinc-500">
            <p className="flex items-center gap-1.5"><RefreshCw size={12} /> {stats?.restarts ?? 0} redémarrage{stats?.restarts > 1 ? 's' : ''}{stats?.health === 'healthy' && <span className="ml-1 inline-flex items-center gap-1 text-emerald-400"><HeartPulse size={12} /> sain</span>}{stats?.health === 'unhealthy' && <span className="ml-1 inline-flex items-center gap-1 text-red-400"><HeartPulse size={12} /> défaillant</span>}</p>
            {last && <p className="flex items-center gap-1.5"><Clock size={12} /> déployé il y a {ago(last.created)}{last.finished ? ` · ${span(last.finished - last.created)}` : ''}</p>}
          </div>
        </StatCard>
      </div>

      <div className="mb-6 inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/50 p-1">
        {TABS.map(([k, I, l]) => (
          <button key={k} onClick={() => setTab(k)} className={cx('flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm transition-all', tab === k ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300')}>
            <I size={15} /> {l}{k === 'env' && nVars > 0 && <span className="rounded-full bg-zinc-700/70 px-1.5 text-[10px] text-zinc-300">{nVars}</span>}
          </button>
        ))}
      </div>
      {msg && <p className="mb-4 rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">{msg}</p>}

      {tab === 'deploys' && (
        <div className="grid gap-5 lg:grid-cols-[17rem_1fr]">
          <div className="space-y-2">
            {!p.deploys.length && <p className="text-sm text-zinc-600">Aucun déploiement.</p>}
            {p.deploys.map(d => {
              const I = d.status === 'success' ? CircleCheck : d.status === 'failed' ? CircleX : LoaderCircle
              return (
                <button key={d.id} onClick={() => setSel(d.id)} className={cx('flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-all', live === d.id ? 'border-zinc-600 bg-zinc-800/60' : 'border-zinc-800 bg-zinc-900/30 hover:border-zinc-700')}>
                  <I size={18} className={cx('shrink-0', d.status === 'success' ? 'text-emerald-400' : d.status === 'failed' ? 'text-red-400' : 'animate-spin text-amber-400')} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-sm text-white">#{d.id}{d.id === firstOk && p.status === 'running' && <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">actif</span>}</span>
                    <span className="block text-xs text-zinc-500">il y a {ago(d.created)}{d.finished ? ` · ${span(d.finished - d.created)}` : ' · en cours'}</span>
                  </span>
                </button>
              )
            })}
          </div>
          {live && <LogView key={live} url={`/deploys/${live}/log`} title={`Déploiement #${live}`} />}
        </div>
      )}
      {tab === 'logs' && <LogView url={`/projects/${id}/logs`} h="h-[32rem]" title={`Logs du conteneur · ${p.name}`} />}
      <div className={tab === 'terminal' ? '' : 'hidden'}><TermView id={id} name={p.name} running={p.status === 'running'} /></div>
      {tab === 'env' && (
        <div className="max-w-3xl">
          <Card title="Variables d’environnement" desc="Une par ligne : CLE=valeur. Elles sont transmises au conteneur ; le port (PORT) est ajouté automatiquement. Un redéploiement est nécessaire pour les appliquer.">
            <textarea spellCheck={false} className={cx(inp, 'h-80 font-mono text-xs leading-relaxed')} placeholder="CLE=valeur" value={env} onChange={e => setEnv(e.target.value)} />
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button className={btn} disabled={!dirty} onClick={() => save(false)}><Save size={14} /> Enregistrer</button>
              <button className={btnPrimary} onClick={() => save(true).then(ok => ok && setTab('deploys'))}><Rocket size={15} /> Enregistrer & redéployer</button>
              {p.source === 'github' && <button className={btn} disabled={syncing} onClick={syncEnv} title="Ajoute les variables du .env.example du repo qui ne sont pas encore dans ta liste"><RefreshCw size={14} className={syncing ? 'animate-spin' : ''} /> Synchroniser avec .env.example</button>}
              {dirty && <span className="flex items-center gap-1.5 text-xs text-amber-300"><i className="pulse-dot h-1.5 w-1.5 rounded-full bg-amber-400" />modifications non enregistrées</span>}
            </div>
            {syncMsg && <p className="mt-3 text-xs leading-relaxed text-zinc-400">{syncMsg}</p>}
          </Card>
        </div>
      )}
      {tab === 'settings' && (
        <div className="grid max-w-4xl gap-5 lg:grid-cols-2">
          <Card title="Général" desc="Port sur lequel écoute ton addon dans le conteneur.">
            <div className="space-y-4">
              <Field label="Port de l’addon"><input className={inp} type="number" value={cfg.port} onChange={e => setCfg({ ...cfg, port: e.target.value })} /></Field>
              {p.source === 'github' && <Field label="Branche"><input className={inp} value={cfg.branch} onChange={e => setCfg({ ...cfg, branch: e.target.value })} /></Field>}
            </div>
          </Card>
          <Card title="Adresse" desc="Le nom de domaine qui pointe vers ton addon.">
            <Field label="Adresse de l’addon" hint={cfg.domain ? `https://${cfg.domain}` : undefined}><DomainField value={cfg.domain} onChange={d => setCfg({ ...cfg, domain: d })} suffix={conf.suffix} placeholder="mon-addon" /><DnsStatus domain={cfg.domain} ip={conf.ip} /></Field>
          </Card>
          <div className="lg:col-span-2"><button className={btnPrimary} onClick={() => save(true).then(ok => ok && setTab('deploys'))}><Rocket size={15} /> Appliquer & redéployer</button></div>
          <Card title="Caddy" desc={p.caddy?.enabled ? 'Le Caddyfile est mis à jour et rechargé automatiquement quand tu appliques.' : 'À ajouter dans ton Caddyfile, puis : docker exec -w /etc/caddy caddy caddy reload'}>
            {p.caddy?.enabled
              ? <div className={cx('flex items-start gap-2.5 rounded-xl border p-3.5 text-xs leading-relaxed', p.caddy.error ? 'border-red-500/40 bg-red-500/10 text-red-300' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300')}>
                {p.caddy.error ? <><TriangleAlert size={15} className="mt-0.5 shrink-0" /><pre className="whitespace-pre-wrap font-mono">{p.caddy.error}</pre></> : <><ShieldCheck size={15} className="shrink-0" /> Géré automatiquement</>}
              </div>
              : <pre onClick={e => navigator.clipboard?.writeText(e.currentTarget.textContent)} title="Cliquer pour copier" className="cursor-pointer rounded-xl border border-zinc-800 bg-black/60 p-4 font-mono text-xs leading-relaxed text-zinc-300">{`${cfg.domain || 'mon-site.mondomaine.fr'} {\n    reverse_proxy localhost:${p.hostport}\n}`}</pre>}
          </Card>
          {p.source === 'github' && (
            <Card title="Webhook GitHub" desc="Redéploie à chaque push. Repo → Settings → Webhooks → content type application/json.">
              <div className="flex gap-2"><input readOnly className={cx(inp, 'min-w-0 font-mono text-xs')} value={hook} onFocus={e => e.target.select()} /><CopyBtn text={hook} className="shrink-0 px-3" /></div>
            </Card>
          )}
          <div className="lg:col-span-2">
            <Card tone="danger" title="Zone dangereuse" desc="Supprime le projet, ses conteneurs, ses images et ses volumes de données. Cette action est définitive.">
              <button className="inline-flex items-center gap-2 rounded-xl border border-red-900/60 px-4 py-2 text-sm text-red-400 transition-colors hover:bg-red-950/40" onClick={() => confirm(`Supprimer ${p.name} et toutes ses données ?`) && act('', { method: 'DELETE' }, () => (location.hash = '/'))}><Trash2 size={15} /> Supprimer le projet</button>
            </Card>
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
