import { useLayoutEffect, type RefObject } from 'react'

/**
 * Les feuilles imprimables (affiche, cartes) sont dessinées en grand, à --mm = 10 px,
 * puis réduites d'un bloc par `transform: scale(var(--s))`. Ainsi aucun texte n'est
 * sous la taille de police minimum que certains navigateurs imposent (sinon les petits
 * textes grossissent et débordent, à l'écran comme à l'impression).
 * Ce hook règle --s pour que la feuille (largeur dessinée en px) remplisse la largeur de l'élément.
 */
export function useEchelleFeuille(ref: RefObject<HTMLElement>, largeurDessin: number) {
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ajuster = () => el.style.setProperty('--s', String(el.clientWidth / largeurDessin))
    ajuster()
    const ro = new ResizeObserver(ajuster)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref, largeurDessin])
}
