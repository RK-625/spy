import { ThemeProvider } from 'next-themes'
import { DEFAULT_THEME_PREFERENCE, THEME_STORAGE_KEY } from './theme-preference'
import type { ReactNode } from 'react'

// Preserve the source app's React 19 script handling: the SSR script initializes
// the palette before paint, and its hydrated client copy stays inert.
const themeScriptProps =
  typeof window === 'undefined'
    ? undefined
    : ({ type: 'application/json' } as const)

export function AppThemeProvider({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme={DEFAULT_THEME_PREFERENCE}
      enableColorScheme={false}
      enableSystem
      disableTransitionOnChange
      scriptProps={themeScriptProps}
      storageKey={THEME_STORAGE_KEY}
    >
      {children}
    </ThemeProvider>
  )
}
