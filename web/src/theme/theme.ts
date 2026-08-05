import type { ThemeName } from './themes'

const THEME_KEY = 'paro.theme'

export function getStoredTheme(): ThemeName {
  const value = localStorage.getItem(THEME_KEY)
  if (value === 'default' || value === 'sky' || value === 'dark') {
    return value
  }
  return 'default'
}

export function applyThemeFromStorage(): void {
  applyTheme(getStoredTheme())
}

export function applyTheme(theme: ThemeName): void {
  document.documentElement.setAttribute('data-theme', theme)
}

export function setTheme(theme: ThemeName): void {
  localStorage.setItem(THEME_KEY, theme)
  applyTheme(theme)
}
