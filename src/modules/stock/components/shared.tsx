import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { appBaseUrl } from '@/core/supabase'
import { Badge } from '@/core/ui'
import type { Caisse, Categorie, Produit, Profile } from '@/core/types'
import { useCaisses, useCategories, useMembres, useProduits } from '../api'
import { etatPeremption } from '../logic'

/** Dictionnaires id → objet, pour afficher les noms dans les listes */
export function useRefs() {
  const produits = useProduits().data
  const caisses = useCaisses().data
  const categories = useCategories().data
  const membres = useMembres().data
  return useMemo(() => ({
    produit: new Map<string, Produit>((produits ?? []).map(p => [p.id, p])),
    caisse: new Map<string, Caisse>((caisses ?? []).map(c => [c.id, c])),
    categorie: new Map<string, Categorie>((categories ?? []).map(c => [c.id, c])),
    membre: new Map<string, Profile>((membres ?? []).map(m => [m.id, m])),
  }), [produits, caisses, categories, membres])
}

export const fmtDate = (d: string | null | undefined, f = 'd MMM yyyy') => d ? format(new Date(d.length === 10 ? d + 'T00:00:00' : d), f, { locale: fr }) : '—'

export function PeremptionBadge({ date }: { date: string | null }) {
  const e = etatPeremption(date)
  if (e === 'aucune') return <Badge>Sans péremption</Badge>
  if (e === 'perime') return <Badge tone="red">Périmé · {fmtDate(date, 'dd/MM/yy')}</Badge>
  if (e === 'bientot') return <Badge tone="orange">Bientôt · {fmtDate(date, 'dd/MM/yy')}</Badge>
  return <Badge tone="green">{fmtDate(date, 'dd/MM/yy')}</Badge>
}

export function CategorieTag({ cat }: { cat?: Categorie | null }) {
  if (!cat) return null
  return (
    <span className="chip border" style={{ borderColor: cat.couleur + '66', color: cat.couleur, background: cat.couleur + '1a' }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: cat.couleur }} />{cat.nom}
    </span>
  )
}

/** URL encodée dans le QR : ouvre directement la fiche de la caisse */
export const caisseUrl = (id: string) => `${appBaseUrl()}#/stock/caisse/${id}`

export function useQrDataUrl(text: string, size = 512) {
  const [url, setUrl] = useState<string>('')
  useEffect(() => {
    QRCode.toDataURL(text, { width: size, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0B0F1A', light: '#FFFFFF' } })
      .then(setUrl).catch(() => setUrl(''))
  }, [text, size])
  return url
}

/** Étiquette imprimable aux couleurs du club */
export function EtiquetteCaisse({ caisse, cat }: { caisse: Caisse; cat?: Categorie | null }) {
  const qr = useQrDataUrl(caisseUrl(caisse.id))
  return (
    <div className="etiquette flex break-inside-avoid overflow-hidden rounded-xl border-2 border-[#0B0F1A] bg-white text-[#0B0F1A]">
      <div className="flex w-[42%] items-center justify-center p-2">{qr && <img src={qr} alt={`QR ${caisse.code}`} className="w-full" />}</div>
      <div className="relative flex flex-1 flex-col justify-between overflow-hidden p-3">
        <div className="absolute -right-6 top-3 h-2 w-28 -rotate-[16deg] -skew-x-[24deg] rounded-full bg-[#EE7D1F]" />
        <div className="absolute -right-6 top-7 h-1.5 w-20 -rotate-[16deg] -skew-x-[24deg] rounded-full bg-[#1A5A9A]" />
        <div>
          <p className="font-display text-[10px] font-bold uppercase tracking-[.2em] text-[#EE7D1F]">AASC Badminton</p>
          <p className="font-display text-3xl font-black italic leading-none">{caisse.code}</p>
          <p className="mt-1 text-sm font-semibold leading-tight">{caisse.nom}</p>
        </div>
        <div className="flex items-end justify-between gap-1">
          <p className="text-[10px] text-slate-600">{caisse.emplacement}{cat ? ` · ${cat.nom}` : ''}</p>
          <img src={`${import.meta.env.BASE_URL}logo-aasc.png`} alt="" className="h-9 w-9" />
        </div>
      </div>
    </div>
  )
}
