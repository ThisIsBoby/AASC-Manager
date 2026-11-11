import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, FileUp, Upload } from 'lucide-react'
import { RequireAdmin } from '@/core/auth/guards'
import { errMsg } from '@/core/supabase'
import { Badge, Field, PageHeader, StatTile, useToast } from '@/core/ui'
import { fmtDate } from '@/modules/stock/components/shared'
import { useAdherents, useImporterAdherents } from '../api'
import {
  CHAMPS, LIBELLES_CHAMPS, decoderFichier, detecterColonnes, diffImport, lignesDepuisCsv, parseCsv, saisonCourante,
  type Correspondance,
} from '../logic'

export function ImportAdherentsPage() {
  return <RequireAdmin><ImportAdherents /></RequireAdmin>
}

function ImportAdherents() {
  const existants = useAdherents().data ?? []
  const importer = useImporterAdherents()
  const toast = useToast()
  const [fichier, setFichier] = useState('')
  const [rows, setRows] = useState<string[][]>([])
  const [corr, setCorr] = useState<Correspondance | null>(null)
  const [saison, setSaison] = useState(saisonCourante())
  const [desactiver, setDesactiver] = useState(true)
  const [resultat, setResultat] = useState<{ crees: number; mis_a_jour: number; desactives: number } | null>(null)

  const entetes = rows[0] ?? []
  const { ok: lignes, ignorees } = useMemo(
    () => (corr ? lignesDepuisCsv(rows.slice(1), corr) : { ok: [], ignorees: 0 }), [rows, corr])
  const diff = useMemo(() => diffImport(existants, lignes), [existants, lignes])
  const sansDate = corr && corr.date_naissance >= 0 ? lignes.filter(l => !l.date_naissance).length : 0

  async function lire(f: File | undefined) {
    setResultat(null)
    if (!f) return
    try {
      const r = parseCsv(decoderFichier(await f.arrayBuffer()))
      if (r.length < 2) throw new Error('Le fichier ne contient pas de lignes de données.')
      setRows(r); setCorr(detecterColonnes(r[0])); setFichier(f.name)
    } catch (err) { toast(errMsg(err), 'err'); setRows([]); setCorr(null) }
  }

  async function lancer() {
    if (!corr || corr.nom < 0) return toast('Indiquez au moins la colonne « Nom ».', 'err')
    if (desactiver && diff.absents.length && !confirm(`${diff.absents.length} adhérent(s) absent(s) du fichier passeront en « anciens ». Continuer ?`)) return
    try {
      const r = await importer.mutateAsync({ saison: saison.trim(), lignes, desactiverAbsents: desactiver })
      setResultat(r); toast('Import terminé')
    } catch (err) { toast(errMsg(err), 'err') }
  }

  return (
    <div>
      <Link to="/adherents" className="mb-2 inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white"><ArrowLeft size={14} /> Adhérents</Link>
      <PageHeader kicker="Adhérents" title="Import CSV" />

      <div className="card mb-6 space-y-3 p-5">
        <p className="text-sm text-slate-400">
          Exportez la liste des licenciés (Poona, MyFFBaD, Excel « CSV séparateur point-virgule »…). Une ligne d'en-tête est attendue ;
          les colonnes sont reconnues automatiquement et modifiables ci-dessous. Réimporter le fichier de la saison met à jour les fiches existantes
          (reconnues par n° de licence, sinon nom + prénom + date de naissance) sans perdre l'historique des achats.
        </p>
        <label className="btn-primary inline-flex cursor-pointer">
          <FileUp size={18} /> {fichier ? 'Choisir un autre fichier' : 'Choisir le fichier CSV'}
          <input type="file" accept=".csv,text/csv,.txt" className="hidden" onChange={e => { lire(e.target.files?.[0]); e.target.value = '' }} />
        </label>
        {fichier && <p className="text-sm">Fichier : <b>{fichier}</b> · {rows.length - 1} ligne(s)</p>}
      </div>

      {corr && (
        <>
          <h2 className="title-sport mb-2 text-xl">1. Colonnes</h2>
          <div className="card mb-6 grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
            {CHAMPS.map(ch => (
              <Field key={ch} label={LIBELLES_CHAMPS[ch] + (ch === 'nom' ? ' *' : '')}>
                <select className="input" value={corr[ch]} onChange={e => setCorr({ ...corr, [ch]: Number(e.target.value) })}>
                  <option value={-1}>— Absente —</option>
                  {entetes.map((h, i) => <option key={i} value={i}>{h || `Colonne ${i + 1}`}</option>)}
                </select>
              </Field>
            ))}
          </div>

          <h2 className="title-sport mb-2 text-xl">2. Aperçu</h2>
          <div className="mb-3 grid gap-3 sm:grid-cols-3">
            <StatTile label="Nouveaux" value={diff.nouveaux.length} tone="green" />
            <StatTile label="Mis à jour" value={diff.misAJour.length} tone="blue" />
            <StatTile label="Absents du fichier" value={diff.absents.length} tone={desactiver && diff.absents.length ? 'orange' : 'blue'} />
          </div>
          {(ignorees > 0 || sansDate > 0) && (
            <p className="mb-3 text-sm text-aasc-orange-soft">
              {ignorees > 0 && <>{ignorees} ligne(s) sans nom ignorée(s). </>}
              {sansDate > 0 && <>{sansDate} date(s) de naissance illisible(s) ou vide(s).</>}
            </p>
          )}
          <div className="card mb-6 overflow-x-auto">
            <table className="table-sport">
              <thead><tr><th>Nom</th><th>Prénom</th><th>Licence</th><th>Naissance</th><th className="hidden md:table-cell">Catégorie</th><th className="hidden md:table-cell">E-mail</th><th /></tr></thead>
              <tbody>
                {lignes.slice(0, 15).map((l, i) => (
                  <tr key={i}>
                    <td className="font-semibold">{l.nom}</td><td>{l.prenom}</td><td className="tabular-nums">{l.licence || '—'}</td>
                    <td>{l.date_naissance ? fmtDate(l.date_naissance, 'dd/MM/yyyy') : '—'}</td>
                    <td className="hidden md:table-cell">{l.categorie || '—'}</td><td className="hidden md:table-cell">{l.email || '—'}</td>
                    <td>{diff.nouveaux.includes(l) ? <Badge tone="green">Nouveau</Badge> : <Badge tone="blue">Mise à jour</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {lignes.length > 15 && <p className="p-3 text-center text-xs text-slate-500">… et {lignes.length - 15} autre(s)</p>}
          </div>

          <h2 className="title-sport mb-2 text-xl">3. Importer</h2>
          <div className="card space-y-4 p-5">
            <Field label="Saison"><input className="input max-w-xs" value={saison} onChange={e => setSaison(e.target.value)} /></Field>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={desactiver} onChange={e => setDesactiver(e.target.checked)} className="mt-0.5 h-4 w-4 accent-aasc-orange" />
              <span>Passer en « anciens adhérents » ceux qui ne sont pas dans le fichier ({diff.absents.length})
                <span className="block text-xs text-slate-500">À décocher si le fichier ne contient qu'une partie des licenciés.</span></span>
            </label>
            <button className="btn-primary" disabled={importer.isPending || !lignes.length} onClick={lancer}>
              <Upload size={18} /> Importer {lignes.length} adhérent(s)
            </button>
            {resultat && (
              <p className="rounded-xl bg-emerald-500/15 px-4 py-3 text-sm text-emerald-300">
                Import terminé : {resultat.crees} créé(s), {resultat.mis_a_jour} mis à jour, {resultat.desactives} passé(s) en anciens.{' '}
                <Link to="/adherents" className="underline">Voir la liste</Link>
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
