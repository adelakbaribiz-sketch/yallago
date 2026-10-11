'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { AuthApi } from '@/lib/api-client'

type SessionUser = {
  id: string
  email: string
  fullName: string
  role: 'CUSTOMER' | 'DRIVER' | 'ADMIN'
  driverId?: string
}

type AuthContextValue = {
  user: SessionUser | null
  loading: boolean
  refresh: () => Promise<void>
  setUser: (u: SessionUser | null) => void
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  refresh: async () => {},
  setUser: () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    try {
      const { user } = await AuthApi.me()
      setUser(user || null)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, refresh, setUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
