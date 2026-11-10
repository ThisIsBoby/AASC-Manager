const KEY = 'aasc-theme'
export type Theme = 'dark' | 'light'

export function getTheme(): Theme {
  try { return (localStorage.getItem(KEY) as Theme) || 'dark' } catch { return 'dark' }
}
export function applyTheme(t: Theme) {
  document.documentElement.classList.toggle('light', t === 'light')
  document.documentElement.classList.toggle('dark', t === 'dark')
  try { localStorage.setItem(KEY, t) } catch { /* stockage indisponible */ }
}
