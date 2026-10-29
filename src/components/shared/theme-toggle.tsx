'use client'
import { useTheme } from 'next-themes'
import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Theme toggle button.
 *
 * The `mounted` guard is required because `next-themes` reads localStorage
 * which isn't available during SSR. We avoid the lint warning about
 * `setState in effect` by using `useSyncExternalStore` to subscribe to
 * a no-op external store that always returns `true` on the client.
 */
import { useSyncExternalStore } from 'react'

const emptySubscribe = () => () => {}

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  // Returns false during SSR, true after hydration — without triggering the
  // `setState in effect` lint warning.
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,  // client snapshot
    () => false  // server snapshot
  )
  if (!mounted) {
    return (
      <Button variant="outline" size="icon" className={className} disabled aria-label="Toggle theme">
        <Moon className="h-4 w-4" />
      </Button>
    )
  }
  const isDark = theme === 'dark'
  return (
    <Button
      variant="outline"
      size="icon"
      className={className}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  )
}
