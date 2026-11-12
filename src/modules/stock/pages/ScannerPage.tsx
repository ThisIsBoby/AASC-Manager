import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Scanner, type IDetectedBarcode } from '@yudiel/react-qr-scanner'
import { CameraOff, ClipboardCheck, Search, X } from 'lucide-react'
import { PageHeader, useToast } from '@/core/ui'
import { useCaisses, useInventaire } from '../api'
import { parseScan } from '../logic'

export function ScannerPage() {
  const nav = useNavigate()
  const toast = useToast()
  const caisses = useCaisses().data ?? []
  // Mode inventaire : le scan ouvre le comptage de la caisse au lieu de sa fiche
  const [sp] = useSearchParams()
  const inventaireId = sp.get('inventaire') ?? undefined
  const inventaire = useInventaire(inventaireId).data
  const modeInventaire = inventaire?.statut === 'en_cours'
  const [flash, setFlash] = useState(false)
  const [camError, setCamError] = useState<string | null>(null)
  const [code, setCode] = useState('')

  function ouvrir(text: string) {
    const r = parseScan(text)
    const caisse = r.id ? caisses.find(c => c.id === r.id) : r.code ? caisses.find(c => c.code === r.code) : undefined
    if (!caisse) { toast(`Caisse introuvable : ${text.slice(0, 60)}`, 'err'); return false }
    setFlash(true)
    if (navigator.vibrate) navigator.vibrate(80)
    setTimeout(() => nav(modeInventaire ? `/stock/inventaire/${inventaire.id}/caisse/${caisse.id}` : `/stock/caisse/${caisse.id}`), 250)
    return true
  }

  function onScan(codes: IDetectedBarcode[]) {
    const v = codes[0]?.rawValue
    if (v) ouvrir(v)
  }

  function submit(e: FormEvent) { e.preventDefault(); if (code.trim()) ouvrir(code) }

  return (
    <div>
      <PageHeader kicker={modeInventaire ? 'Inventaire' : 'Stock'} title="Scanner" />
      <div className="mx-auto max-w-md">
        {modeInventaire && (
          <div className="card mb-4 flex items-center gap-3 border-aasc-orange/60 p-3">
            <ClipboardCheck size={20} className="shrink-0 text-aasc-orange" />
            <Link to={`/stock/inventaire/${inventaire.id}`} className="min-w-0 flex-1">
              <span className="block text-xs uppercase tracking-wider text-slate-400">Inventaire en cours</span>
              <span className="block truncate font-semibold">{inventaire.nom}</span>
            </Link>
            <Link to="/stock/scanner" className="btn-icon btn-ghost" title="Quitter le mode inventaire"><X size={16} /></Link>
          </div>
        )}
        <div className={`card relative aspect-square overflow-hidden p-0 ${flash ? 'animate-flash border-aasc-orange' : ''}`}>
          {camError ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-slate-400">
              <CameraOff size={40} />
              <p className="text-sm">{camError}</p>
            </div>
          ) : (
            <Scanner
              onScan={onScan}
              onError={e => setCamError(`Caméra indisponible (${(e as Error)?.message ?? 'autorisation refusée'}). Utilisez la saisie du code ci-dessous.`)}
              constraints={{ facingMode: 'environment' }}
              formats={['qr_code']}
              scanDelay={800}
              components={{ finder: false }}
              styles={{ container: { width: '100%', height: '100%' }, video: { objectFit: 'cover' } }}
            />
          )}
          {!camError && (
            <div aria-hidden className="pointer-events-none absolute inset-[14%]">
              {['left-0 top-0 border-l-4 border-t-4 rounded-tl-2xl', 'right-0 top-0 border-r-4 border-t-4 rounded-tr-2xl',
                'left-0 bottom-0 border-l-4 border-b-4 rounded-bl-2xl', 'right-0 bottom-0 border-r-4 border-b-4 rounded-br-2xl'].map(c => (
                <span key={c} className={`absolute h-12 w-12 border-aasc-orange ${c}`} />
              ))}
              <span className="absolute inset-x-4 top-1/2 h-0.5 bg-gradient-to-r from-transparent via-aasc-orange to-transparent opacity-80" />
            </div>
          )}
        </div>
        <p className="mt-3 text-center text-sm text-slate-400">Visez le QR code collé sur la caisse.</p>

        <form onSubmit={submit} className="card mt-5 flex gap-2 p-3">
          <input className="input" placeholder="…ou saisir le code (ex. C-001)" value={code} onChange={e => setCode(e.target.value)} />
          <button className="btn-secondary"><Search size={16} /> Ouvrir</button>
        </form>
      </div>
    </div>
  )
}
