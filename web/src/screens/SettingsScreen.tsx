import { Button, Card, Pill } from '../components/primitives'
import { themeLabels } from '../theme/themes'
import type { ThemeName } from '../theme/themes'
import { getStoredTheme, setTheme } from '../theme/theme'
import { useState } from 'react'

export function SettingsScreen() {
  const [theme, setThemeState] = useState<ThemeName>(getStoredTheme())

  const onThemeChange = (next: ThemeName) => {
    setTheme(next)
    setThemeState(next)
  }

  return (
    <section className='screen'>
      <h1 className='screen-title'>Settings</h1>
      <Card>
        <div className='settings-row'>
          <p className='screen-subtitle'>Theme</p>
          <Pill>{themeLabels[theme]}</Pill>
        </div>
        <div className='theme-grid'>
          {(['default', 'sky', 'dark'] as ThemeName[]).map((value) => (
            <Button key={value} kind={value === theme ? 'primary' : 'secondary'} onClick={() => onThemeChange(value)}>
              {themeLabels[value]}
            </Button>
          ))}
        </div>
      </Card>
    </section>
  )
}
