'use client'
import { useEffect, useState } from 'react'
import { AuthProvider, useAuth } from '@/components/shared/auth-provider'
import { AuthScreen } from '@/components/shared/auth-screen'
import { CustomerApp } from '@/components/customer/customer-app'
import { DriverApp } from '@/components/driver/driver-app'
import { AdminApp } from '@/components/admin/admin-app'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

export default function Home() {
  return (
    <AuthProvider>
      <RootRouter />
    </AuthProvider>
  )
}

function RootRouter() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!user) return <AuthScreen />

  // Route by role
  if (user.role === 'CUSTOMER') return <CustomerApp />
  if (user.role === 'DRIVER') return <DriverApp />
  if (user.role === 'ADMIN') return <AdminApp />

  return <AuthScreen />
}
