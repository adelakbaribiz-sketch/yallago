'use client'
import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { AuthApi } from '@/lib/api-client'
import { useAuth } from './auth-provider'
import { toast } from 'sonner'
import { Car, Bike, Truck, ShieldCheck } from 'lucide-react'

export function AuthScreen() {
  const { refresh } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [role, setRole] = useState<'CUSTOMER' | 'DRIVER'>('CUSTOMER')
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')

  const submit = async () => {
    setLoading(true)
    try {
      if (mode === 'login') {
        const { user } = await AuthApi.login(email, password)
        toast.success(`Welcome back, ${user.fullName}!`)
        await refresh()
      } else {
        const { user } = await AuthApi.register({ email, password, fullName, phone, role })
        toast.success(`Account created. Welcome, ${user.fullName}!`)
        await refresh()
      }
    } catch (err: any) {
      const msg = err?.error || 'Failed'
      if (msg === 'INVALID_CREDENTIALS') toast.error('Invalid email or password.')
      else if (msg === 'EMAIL_TAKEN') toast.error('Email already registered.')
      else if (msg === 'DRIVER_PENDING_APPROVAL') toast.error('Your driver account is pending admin approval.')
      else if (msg === 'DRIVER_REJECTED') toast.error('Your driver application was rejected.')
      else toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const fillDemo = (which: 'admin' | 'customer' | 'driver') => {
    setMode('login')
    if (which === 'admin') { setEmail('admin@platform.demo'); setPassword('admin123') }
    else if (which === 'customer') { setEmail('customer@platform.demo'); setPassword('customer123') }
    else { setEmail('driver@platform.demo'); setPassword('driver123') }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 grid lg:grid-cols-2">
        {/* Branding panel */}
        <div className="hidden lg:flex flex-col justify-between p-12 bg-primary text-primary-foreground">
          <div>
            <div className="flex items-center gap-2 text-2xl font-bold">
              <Logo />
              <span>YallaGo</span>
            </div>
            <p className="mt-2 text-primary-foreground/80">Ride. Deliver. Move.</p>
          </div>

          <div className="space-y-6 max-w-md">
            <h1 className="text-4xl font-bold leading-tight">
              One platform for car rides, motorcycle delivery & cargo transport.
            </h1>
            <p className="text-primary-foreground/80">
              Built with a real backend: persistent orders, atomic driver dispatch,
              versioned pricing, role-based admin controls, and live tracking.
            </p>
            <div className="grid grid-cols-3 gap-3">
              <FeatureCard icon={<Car className="h-6 w-6" />} label="Car rides" />
              <FeatureCard icon={<Bike className="h-6 w-6" />} label="Motorcycle" />
              <FeatureCard icon={<Truck className="h-6 w-6" />} label="Cargo" />
            </div>
          </div>

          <div className="text-sm text-primary-foreground/60">
            © 2026 YallaGo — Original platform inspired by industry-leading ride-hailing services.
          </div>
        </div>

        {/* Auth form panel */}
        <div className="flex items-center justify-center p-6 lg:p-12">
          <Card className="w-full max-w-md">
            <CardHeader className="space-y-1">
              <div className="flex items-center gap-2 mb-2 lg:hidden">
                <Logo />
                <span className="font-bold text-lg">YallaGo</span>
              </div>
              <CardTitle className="text-2xl">
                {mode === 'login' ? 'Welcome back' : 'Create your account'}
              </CardTitle>
              <CardDescription>
                {mode === 'login'
                  ? 'Sign in to your YallaGo account'
                  : 'Register as a customer or driver'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={mode} onValueChange={(v) => setMode(v as 'login' | 'register')}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="login">Sign in</TabsTrigger>
                  <TabsTrigger value="register">Register</TabsTrigger>
                </TabsList>

                <TabsContent value="login" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
                  </div>
                  <Button className="w-full" onClick={submit} disabled={loading}>
                    {loading ? 'Signing in…' : 'Sign in'}
                  </Button>
                </TabsContent>

                <TabsContent value="register" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>I want to register as</Label>
                    <RadioGroup value={role} onValueChange={(v) => setRole(v as 'CUSTOMER' | 'DRIVER')} className="grid grid-cols-2 gap-2">
                      <Label htmlFor="r-customer" className="flex items-center gap-2 border rounded-md p-3 cursor-pointer has-[:checked]:bg-primary/5 has-[:checked]:border-primary">
                        <RadioGroupItem id="r-customer" value="CUSTOMER" />
                        <span className="text-sm">Customer</span>
                      </Label>
                      <Label htmlFor="r-driver" className="flex items-center gap-2 border rounded-md p-3 cursor-pointer has-[:checked]:bg-primary/5 has-[:checked]:border-primary">
                        <RadioGroupItem id="r-driver" value="DRIVER" />
                        <span className="text-sm">Driver</span>
                      </Label>
                    </RadioGroup>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="r-fullName">Full name</Label>
                    <Input id="r-fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="r-email">Email</Label>
                    <Input id="r-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="r-phone">Phone (optional)</Label>
                    <Input id="r-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+98 912 000 0000" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="r-password">Password</Label>
                    <Input id="r-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                  </div>
                  <Button className="w-full" onClick={submit} disabled={loading}>
                    {loading ? 'Creating…' : 'Create account'}
                  </Button>
                  {role === 'DRIVER' && (
                    <p className="text-xs text-muted-foreground">
                      <ShieldCheck className="inline h-3 w-3 mr-1" />
                      Driver accounts require admin approval before going online.
                      After registration, complete your driver application in the driver panel.
                    </p>
                  )}
                </TabsContent>
              </Tabs>

              <div className="mt-6 pt-6 border-t">
                <p className="text-xs text-muted-foreground text-center mb-2">Try with demo accounts:</p>
                <div className="grid grid-cols-3 gap-2">
                  <Button variant="outline" size="sm" onClick={() => fillDemo('customer')}>Customer</Button>
                  <Button variant="outline" size="sm" onClick={() => fillDemo('driver')}>Driver</Button>
                  <Button variant="outline" size="sm" onClick={() => fillDemo('admin')}>Admin</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function FeatureCard({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="bg-primary-foreground/10 rounded-lg p-3 flex flex-col items-center gap-1 text-center">
      {icon}
      <span className="text-xs">{label}</span>
    </div>
  )
}

function Logo() {
  return (
    <div className="h-9 w-9 rounded-lg bg-primary-foreground flex items-center justify-center">
      <Car className="h-5 w-5 text-primary" />
    </div>
  )
}
