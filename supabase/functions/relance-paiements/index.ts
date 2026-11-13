// =====================================================================
// Fonction Edge « relance-paiements »
// Envoie à chaque adhérent demandé UN e-mail récapitulant tous ses impayés
// (ventes + cordages), via l'API Resend, puis note la date de relance.
//
// Secrets (supabase secrets set …) :
//   RESEND_API_KEY     clé API Resend
//   RELANCE_FROM       expéditeur, ex. « AASC Badminton <relances@mondomaine.fr> »
//   RELANCE_REPLY_TO   (optionnel) adresse de réponse, ex. trésorier
// SUPABASE_URL, SUPABASE_ANON_KEY et SUPABASE_SERVICE_ROLE_KEY sont fournis par Supabase.
// =====================================================================
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const euro = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: n % 1 ? 2 : 0 })
const date = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Paris' })
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

type Ligne = { date: string; libelle: string; montant: number }

function composer(prenom: string, nom: string, lignes: Ligne[], total: number, message: string) {
  const bonjour = `Bonjour ${prenom || nom},`
  const intro = `Sauf erreur de notre part, il reste ${euro(total)} à régler au club AASC Badminton :`
  const fin = 'Vous pouvez régler en espèces, par chèque ou par virement auprès d\'un membre du bureau lors d\'un créneau.\n' +
    'Si vous avez déjà réglé, merci de ne pas tenir compte de ce message.'
  const text = [bonjour, '', intro, ...lignes.map(l => `  • ${date(l.date)} — ${l.libelle} : ${euro(l.montant)}`), '',
    message ? message + '\n' : '', fin, '', 'Sportivement,', 'AASC Cléry St-André Badminton'].join('\n')
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#1e293b;line-height:1.5">
<p>${esc(bonjour)}</p><p>${esc(intro)}</p>
<table style="border-collapse:collapse;margin:8px 0">${lignes.map(l =>
    `<tr><td style="padding:4px 12px 4px 0;color:#64748b">${date(l.date)}</td><td style="padding:4px 12px 4px 0">${esc(l.libelle)}</td><td style="padding:4px 0;text-align:right;white-space:nowrap">${euro(l.montant)}</td></tr>`).join('')}
<tr><td></td><td style="padding:6px 12px 0 0;font-weight:bold;border-top:1px solid #cbd5e1">Total</td><td style="padding:6px 0 0;font-weight:bold;text-align:right;border-top:1px solid #cbd5e1">${euro(total)}</td></tr></table>
${message ? `<p>${esc(message).replace(/\n/g, '<br>')}</p>` : ''}
<p>${esc(fin).replace(/\n/g, '<br>')}</p><p>Sportivement,<br>AASC Cléry St-André Badminton</p></div>`
  return { subject: `Rappel : ${euro(total)} restant à régler au club`, text, html }
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405)

  const apiKey = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('RELANCE_FROM')
  const replyTo = Deno.env.get('RELANCE_REPLY_TO') || undefined
  if (!apiKey || !from) return json({ error: 'Envoi d\'e-mails non configuré : secrets RESEND_API_KEY et RELANCE_FROM manquants.' }, 500)

  // 1. L'appelant doit être un utilisateur actif de l'application
  const url = Deno.env.get('SUPABASE_URL')!
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: actif, error: errActif } = await userClient.rpc('is_actif')
  if (errActif || !actif) return json({ error: 'Accès refusé : compte non actif.' }, 403)

  let body: { adherent_ids?: unknown; message?: unknown }
  try { body = await req.json() } catch { return json({ error: 'Requête invalide' }, 400) }
  const ids = Array.isArray(body.adherent_ids) ? [...new Set(body.adherent_ids.filter((x): x is string => typeof x === 'string' && x.length > 0))] : []
  const message = typeof body.message === 'string' ? body.message.trim().slice(0, 2000) : ''
  if (!ids.length) return json({ error: 'Aucun adhérent à relancer.' }, 400)
  if (ids.length > 500) return json({ error: 'Trop d\'adhérents en une fois (500 max).' }, 400)

  // 2. Lecture des impayés avec la clé service (après le contrôle ci-dessus)
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const [ad, ve, co] = await Promise.all([
    admin.from('adherents').select('id, nom, prenom, email').in('id', ids),
    admin.from('ventes').select('id, adherent_id, libelle, quantite, total, created_at').in('adherent_id', ids).eq('paye', false).eq('annulee', false).gt('total', 0),
    admin.from('cordages').select('id, adherent_id, offre_nom, raquette, prix, depose_le').in('adherent_id', ids).eq('paye', false).gt('prix', 0),
  ])
  const errLecture = ad.error ?? ve.error ?? co.error
  if (errLecture) return json({ error: errLecture.message }, 500)

  const res = { envoyes: [] as { adherent_id: string; email: string; montant: number }[], sans_email: [] as string[], erreurs: [] as { adherent_id: string; message: string }[] }
  const aEnvoyer: { adherent_id: string; email: string; montant: number; ventes: string[]; cordages: string[]; mail: ReturnType<typeof composer> }[] = []

  for (const a of ad.data ?? []) {
    const ventes = (ve.data ?? []).filter(v => v.adherent_id === a.id)
    const cordages = (co.data ?? []).filter(c => c.adherent_id === a.id)
    if (!ventes.length && !cordages.length) continue
    const email = String(a.email ?? '').trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { res.sans_email.push(a.id); continue }
    const lignes: Ligne[] = [
      ...ventes.map(v => ({ date: v.created_at, libelle: (v.quantite > 1 ? `${v.quantite} × ` : '') + v.libelle, montant: Number(v.total) })),
      ...cordages.map(c => ({ date: c.depose_le, libelle: `Cordage ${c.offre_nom}${c.raquette ? ` (${c.raquette})` : ''}`, montant: Number(c.prix) })),
    ].sort((x, y) => x.date.localeCompare(y.date))
    const total = Math.round(lignes.reduce((s, l) => s + l.montant, 0) * 100) / 100
    aEnvoyer.push({ adherent_id: a.id, email, montant: total, ventes: ventes.map(v => v.id), cordages: cordages.map(c => c.id), mail: composer(a.prenom, a.nom, lignes, total, message) })
  }

  // 3. Envoi par lots de 100 (API batch de Resend)
  const maintenant = new Date().toISOString()
  for (let i = 0; i < aEnvoyer.length; i += 100) {
    const lot = aEnvoyer.slice(i, i + 100)
    const r = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(lot.map(x => ({ from, to: [x.email], reply_to: replyTo, ...x.mail }))),
    })
    if (!r.ok) {
      const detail = await r.text().catch(() => '')
      lot.forEach(x => res.erreurs.push({ adherent_id: x.adherent_id, message: `Resend ${r.status} ${detail}`.slice(0, 300) }))
      continue
    }
    const vIds = lot.flatMap(x => x.ventes), cIds = lot.flatMap(x => x.cordages)
    await Promise.all([
      vIds.length ? admin.from('ventes').update({ relance_le: maintenant }).in('id', vIds) : null,
      cIds.length ? admin.from('cordages').update({ relance_le: maintenant }).in('id', cIds) : null,
    ])
    lot.forEach(x => res.envoyes.push({ adherent_id: x.adherent_id, email: x.email, montant: x.montant }))
  }

  return json(res)
})
