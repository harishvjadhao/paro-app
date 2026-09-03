import { useState } from 'react'
import { Check, Palette, Trash2 } from 'lucide-react'
import { clearLocalPrefs, getDefaultSegment, setDefaultSegment, type TradeSegment } from '../theme/prefs'
import { themeLabels, type ThemeName } from '../theme/themes'
import { getStoredTheme, setTheme } from '../theme/theme'

export function SettingsScreen() {
  const [theme, setThemeState] = useState<ThemeName>(getStoredTheme())
  const [segment, setSegmentState] = useState<TradeSegment>(getDefaultSegment())
  const [clearConfirm, setClearConfirm] = useState(false)
  const [toast, setToast] = useState('')

  const onThemeChange = (next: ThemeName) => {
    setTheme(next)
    setThemeState(next)
  }

  const onSegmentChange = (next: TradeSegment) => {
    setDefaultSegment(next)
    setSegmentState(next)
  }

  const onClear = () => {
    clearLocalPrefs()
    setThemeState('default')
    setSegmentState('Delivery')
    setClearConfirm(false)
    setToast('Local preferences cleared. Server data was not touched.')
    window.setTimeout(() => setToast(''), 2800)
  }

  return (
    <section className='screen settings-screen'>
      <div className='settings-wrap'>
        <div className='settings-intro'>
          <h1 className='screen-title'>Settings</h1>
          <p className='screen-subtitle'>Appearance, defaults, and saved data.</p>
        </div>

        <div className='settings-card'>
          <div className='settings-card-title'>
            <Palette size={18} />
            <span>Theme</span>
          </div>
          <div className='theme-choice-grid'>
            {(
              [
                { value: 'default', swatch: '#3C2CDA' },
                { value: 'sky', swatch: '#1D86FF' },
                { value: 'dark', swatch: '#1e222b' },
              ] as const
            ).map((item) => (
              <button
                key={item.value}
                type='button'
                className={`theme-choice ${theme === item.value ? 'active' : ''}`}
                onClick={() => onThemeChange(item.value)}
              >
                <span className='theme-swatch' style={{ background: item.swatch }} />
                <span>{themeLabels[item.value]}</span>
                {theme === item.value ? <Check size={15} /> : null}
              </button>
            ))}
          </div>
        </div>

        <div className='settings-card'>
          <div className='settings-card-heading'>Default trade segment</div>
          <p className='settings-card-copy'>Pre-selected when logging a new trade.</p>
          <div className='settings-seg'>
            <button
              type='button'
              className={segment === 'Delivery' ? 'active' : ''}
              onClick={() => onSegmentChange('Delivery')}
            >
              Delivery
            </button>
            <button
              type='button'
              className={segment === 'Intraday' ? 'active' : ''}
              onClick={() => onSegmentChange('Intraday')}
            >
              Intraday
            </button>
          </div>
        </div>

        <div className='settings-card'>
          <div className='settings-card-heading'>Saved data</div>
          <p className='settings-card-copy'>
            Clears UI preferences stored in this browser (theme, filters, chart toggles, default segment). This does
            not delete trades, comments, or other server data.
          </p>
          {clearConfirm ? (
            <div className='settings-clear-confirm'>
              <div>Clear local preferences? Server journal, comments, and universe stay intact.</div>
              <div className='settings-clear-actions'>
                <button type='button' className='danger' onClick={onClear}>
                  Yes, clear local data
                </button>
                <button type='button' onClick={() => setClearConfirm(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button type='button' className='settings-clear-btn' onClick={() => setClearConfirm(true)}>
              <Trash2 size={14} />
              Clear saved data
            </button>
          )}
        </div>
      </div>

      {toast ? <div className='list-toast'>{toast}</div> : null}
    </section>
  )
}
