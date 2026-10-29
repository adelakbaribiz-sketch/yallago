'use client'
import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import {
  Car, Bike, Truck, MapPin, Navigation, Phone, Star, ArrowLeft, Loader2,
  Power, CheckCircle2, XCircle, Clock, TrendingUp, Wallet, FileText,
  AlertCircle,
} from 'lucide-react'
import { ServiceApi, DriverApi, OrderApi, GeoApi } from '@/lib/api-client'
import { useAuth } from '@/components/shared/auth-provider'
import { ThemeToggle } from '@/components/shared/theme-toggle'
import { toast } from 'sonner'
import { formatCurrency, formatDateTime, ORDER_STATUS_LABELS, SERVICE_TYPE_LABELS, DRIVER_STATUS_LABELS, statusColor } from '@/lib/format'
import { getSocket, authenticateSocket, broadcastDriverLocation } from '@/lib/realtime-client'
import dynamic from 'next/dynamic'

const MapView = dynamic(() => import('@/components/map/MapView'), { ssr: false })

export function DriverApp() {
  const user = useAuth().user!
  const [driver, setDriver] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'home' | 'apply' | 'orders' | 'earnings'>('home')

  useEffect(() => {
    DriverApi.me().then(({ driver }) => {
      setDriver(driver)
      setLoading(false)
      if (driver?.status === 'PENDING' && !driver.licenseNumber?.startsWith('DL-')) {
        setView('apply')
      }
    }).catch(() => setLoading(false))
  }, [])

  // Authenticate socket
  useEffect(() => {
    if (user?.id && user.driverId) {
      try { authenticateSocket(user.id, 'DRIVER', user.driverId) } catch {}
    }
  }, [user?.id, user?.driverId])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!driver || driver.status === 'PENDING' || view === 'apply') {
    return <DriverApplication user={user} driver={driver} onApplied={(d) => { setDriver(d); setView('home') }} onSkip={() => setView('home')} />
  }

  if (view === 'orders') {
    return <DriverOrders onBack={() => setView('home')} />
  }
  if (view === 'earnings') {
    return <DriverEarnings onBack={() => setView('home')} />
  }

  return <DriverHome driver={driver} user={user} onShowOrders={() => setView('orders')} onShowEarnings={() => setView('earnings')} onUpdated={setDriver} />
}

// ============================================================
// Driver Application Form
// ============================================================
function DriverApplication({ user, driver, onApplied, onSkip }: {
  user: any
  driver: any
  onApplied: (d: any) => void
  onSkip: () => void
}) {
  const [services, setServices] = useState<any[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    fullName: user.fullName,
    phone: user.phone || '',
    nationalId: '',
    licenseNumber: '',
    licenseExpiry: '',
    licenseImage: '',
    profileImage: '',
    eligibleServiceCategories: [] as string[],
    operatingRegion: '',
    vehicle: {
      plateNumber: '',
      make: '',
      model: '',
      year: new Date().getFullYear(),
      color: '',
      capacity: 4,
      serviceCategoryId: '',
      registrationNumber: '',
      registrationExpiry: '',
      insuranceNumber: '',
      insuranceExpiry: '',
      imageUrl: '',
    }
  })

  useEffect(() => {
    ServiceApi.list().then(({ services, regions }) => {
      setServices(services)
      if (regions[0]) setForm(f => ({ ...f, operatingRegion: regions[0].id }))
    })
  }, [])

  const toggleService = (id: string) => {
    setForm(f => ({
      ...f,
      eligibleServiceCategories: f.eligibleServiceCategories.includes(id)
        ? f.eligibleServiceCategories.filter(s => s !== id)
        : [...f.eligibleServiceCategories, id],
      vehicle: { ...f.vehicle, serviceCategoryId: f.eligibleServiceCategories.length === 0 ? id : f.vehicle.serviceCategoryId }
    }))
  }

  const submit = async () => {
    if (!form.licenseNumber || !form.licenseExpiry || !form.vehicle.plateNumber || !form.vehicle.make) {
      toast.error('Please fill in all required fields.')
      return
    }
    if (form.eligibleServiceCategories.length === 0) {
      toast.error('Please select at least one service category.')
      return
    }
    setSubmitting(true)
    try {
      const { driver } = await DriverApi.apply({
        ...form,
        vehicle: form.vehicle,
      })
      toast.success('Application submitted! You will be reviewed by an administrator.')
      onApplied(driver)
    } catch (err: any) {
      toast.error('Failed to submit application', { description: err?.error })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <h1 className="font-semibold">Driver application</h1>
          {driver?.status === 'PENDING' && <Button variant="ghost" size="sm" onClick={onSkip}>Skip</Button>}
        </div>
      </header>
      <div className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Personal information</CardTitle>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-3">
            <Field label="Full name" value={form.fullName} onChange={(v) => setForm({ ...form, fullName: v })} />
            <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
            <Field label="National ID (optional)" value={form.nationalId} onChange={(v) => setForm({ ...form, nationalId: v })} />
            <Field label="Profile photo URL" value={form.profileImage} onChange={(v) => setForm({ ...form, profileImage: v })} placeholder="https://…" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Driver license</CardTitle>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-3">
            <Field label="License number" value={form.licenseNumber} onChange={(v) => setForm({ ...form, licenseNumber: v })} />
            <div>
              <Label className="text-xs text-muted-foreground">License expiry</Label>
              <Input type="date" value={form.licenseExpiry} onChange={(e) => setForm({ ...form, licenseExpiry: e.target.value })} className="mt-1" />
            </div>
            <Field label="License photo URL" value={form.licenseImage} onChange={(v) => setForm({ ...form, licenseImage: v })} placeholder="https://…" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Service categories</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">Select which services you want to be eligible for.</p>
            <div className="grid sm:grid-cols-3 gap-3">
              {services.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleService(s.id)}
                  className={`border rounded-lg p-3 text-left transition-colors ${
                    form.eligibleServiceCategories.includes(s.id) ? 'border-primary bg-primary/5' : 'hover:bg-accent'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{s.name}</span>
                    {form.eligibleServiceCategories.includes(s.id) && <CheckCircle2 className="h-4 w-4 text-primary" />}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{s.description}</div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Vehicle</CardTitle>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-3">
            <Field label="Plate number" value={form.vehicle.plateNumber} onChange={(v) => setForm({ ...form, vehicle: { ...form.vehicle, plateNumber: v } })} />
            <Field label="Make" value={form.vehicle.make} onChange={(v) => setForm({ ...form, vehicle: { ...form.vehicle, make: v } })} placeholder="Toyota" />
            <Field label="Model" value={form.vehicle.model} onChange={(v) => setForm({ ...form, vehicle: { ...form.vehicle, model: v } })} placeholder="Camry" />
            <div>
              <Label className="text-xs text-muted-foreground">Year</Label>
              <Input type="number" value={form.vehicle.year} onChange={(e) => setForm({ ...form, vehicle: { ...form.vehicle, year: Number(e.target.value) } })} className="mt-1" />
            </div>
            <Field label="Color" value={form.vehicle.color} onChange={(v) => setForm({ ...form, vehicle: { ...form.vehicle, color: v } })} />
            <div>
              <Label className="text-xs text-muted-foreground">Vehicle service category</Label>
              <Select value={form.vehicle.serviceCategoryId} onValueChange={(v) => setForm({ ...form, vehicle: { ...form.vehicle, serviceCategoryId: v } })}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  {services.filter(s => form.eligibleServiceCategories.includes(s.id)).map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Field label="Registration number" value={form.vehicle.registrationNumber} onChange={(v) => setForm({ ...form, vehicle: { ...form.vehicle, registrationNumber: v } })} />
            <div>
              <Label className="text-xs text-muted-foreground">Registration expiry</Label>
              <Input type="date" value={form.vehicle.registrationExpiry} onChange={(e) => setForm({ ...form, vehicle: { ...form.vehicle, registrationExpiry: e.target.value } })} className="mt-1" />
            </div>
            <Field label="Insurance number (optional)" value={form.vehicle.insuranceNumber} onChange={(v) => setForm({ ...form, vehicle: { ...form.vehicle, insuranceNumber: v } })} />
            <div>
              <Label className="text-xs text-muted-foreground">Insurance expiry (optional)</Label>
              <Input type="date" value={form.vehicle.insuranceExpiry} onChange={(e) => setForm({ ...form, vehicle: { ...form.vehicle, insuranceExpiry: e.target.value } })} className="mt-1" />
            </div>
          </CardContent>
        </Card>

        {driver?.status === 'REJECTED' && driver.rejectionReason && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4 text-sm text-red-700">
              <AlertCircle className="inline h-4 w-4 mr-1" />
              Your previous application was rejected: {driver.rejectionReason}
            </CardContent>
          </Card>
        )}

        <Button className="w-full" size="lg" onClick={submit} disabled={submitting}>
          {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting…</> : 'Submit application'}
        </Button>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mt-1" />
    </div>
  )
}

// ============================================================
// Driver Home
// ============================================================
function DriverHome({ driver, user, onShowOrders, onShowEarnings, onUpdated }: {
  driver: any
  user: any
  onShowOrders: () => void
  onShowEarnings: () => void
  onUpdated: (d: any) => void
}) {
  const [availability, setAvailability] = useState<{ isOnline: boolean; location?: any }>({ isOnline: false })
  const [requests, setRequests] = useState<any[]>([])
  const [activeOrder, setActiveOrder] = useState<any>(null)
  const [loadingReq, setLoadingReq] = useState(true)
  const [incomingRequest, setIncomingRequest] = useState<any | null>(null)
  const [showRejectionDialog, setShowRejectionDialog] = useState<string | null>(null)

  // Poll for availability & requests
  const refresh = useCallback(async () => {
    try {
      const [availRes, reqRes] = await Promise.all([DriverApi.availability.get(), DriverApi.requests()])
      setAvailability(availRes)
      setRequests(reqRes.requests)
      // Find active assignment (ACCEPTED status) -> use it as active order
      const active = reqRes.requests.find((r: any) => r.status === 'ACCEPTED')
      if (active) {
        const ordRes = await OrderApi.get(active.orderId)
        setActiveOrder(ordRes.order)
      } else {
        setActiveOrder(null)
      }
      // Show incoming request modal for OFFERED assignment
      const offered = reqRes.requests.find((r: any) => r.status === 'OFFERED')
      setIncomingRequest(offered || null)
    } catch (err) {
      // ignore
    } finally {
      setLoadingReq(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    const i = setInterval(refresh, 3000)
    return () => clearInterval(i)
  }, [refresh])

  // Simulate driver location broadcast if online
  useEffect(() => {
    if (!availability.isOnline || !user.driverId) return
    let lat = availability.location?.lat ?? 35.7150
    let lng = availability.location?.lng ?? 51.4050
    const interval = setInterval(() => {
      // Jitter slightly
      lat += (Math.random() - 0.5) * 0.001
      lng += (Math.random() - 0.5) * 0.001
      DriverApi.availability.updateLocation(lat, lng).catch(() => {})
      try { broadcastDriverLocation(user.driverId!, lat, lng, activeOrder?.id) } catch {}
    }, 4000)
    return () => clearInterval(interval)
  }, [availability.isOnline, user.driverId, activeOrder?.id])

  const toggleOnline = async () => {
    try {
      const r = await DriverApi.availability.set(!availability.isOnline)
      setAvailability(r)
      toast.success(r.isOnline ? 'You are now online.' : 'You are now offline.')
    } catch (err: any) {
      toast.error('Failed to toggle availability', { description: err?.error })
    }
  }

  const acceptRequest = async (orderId: string) => {
    try {
      await OrderApi.accept(orderId)
      toast.success('Request accepted!')
      setIncomingRequest(null)
      refresh()
    } catch (err: any) {
      toast.error('Failed to accept', { description: err?.error })
      refresh()
    }
  }

  const rejectRequest = async (orderId: string, reason?: string) => {
    try {
      await OrderApi.reject(orderId, reason)
      toast.success('Request rejected.')
      setIncomingRequest(null)
      setShowRejectionDialog(null)
      refresh()
    } catch (err: any) {
      toast.error('Failed to reject', { description: err?.error })
    }
  }

  if (driver.status !== 'APPROVED') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <Clock className="h-10 w-10 mx-auto text-amber-500 mb-3" />
            <h2 className="font-semibold text-lg">Driver account {DRIVER_STATUS_LABELS[driver.status] || driver.status}</h2>
            <p className="text-sm text-muted-foreground mt-2">
              {driver.status === 'PENDING' && 'Your application is being reviewed by our team. Please check back later.'}
              {driver.status === 'REJECTED' && (driver.rejectionReason || 'Your application was not approved.')}
              {driver.status === 'SUSPENDED' && 'Your account has been suspended. Please contact support.'}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Car className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-bold">YallaGo Driver</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onShowOrders}><Clock className="h-4 w-4 mr-1" /> Jobs</Button>
            <Button variant="ghost" size="sm" onClick={onShowEarnings}><Wallet className="h-4 w-4 mr-1" /> Earnings</Button>
            <ThemeToggle />
            <div className="text-xs hidden sm:block">
              <div className="font-medium">{user.fullName}</div>
              <div className="text-muted-foreground flex items-center gap-1">
                <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                {driver.rating?.toFixed(1) || '5.0'}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-6xl w-full mx-auto px-4 py-6 space-y-4">
        {/* Availability card */}
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`h-3 w-3 rounded-full ${availability.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground'}`} />
              <div>
                <div className="font-semibold">{availability.isOnline ? 'Online' : 'Offline'}</div>
                <div className="text-xs text-muted-foreground">
                  {availability.isOnline ? 'Receiving requests' : 'Tap to go online'}
                </div>
              </div>
            </div>
            <Button onClick={toggleOnline} variant={availability.isOnline ? 'destructive' : 'default'}>
              <Power className="h-4 w-4 mr-1" />
              {availability.isOnline ? 'Go offline' : 'Go online'}
            </Button>
          </CardContent>
        </Card>

        {/* Active order */}
        {activeOrder && (
          <ActiveOrderCard order={activeOrder} onUpdated={refresh} />
        )}

        {/* Incoming requests (list) */}
        {!activeOrder && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Incoming requests {requests.filter(r => r.status === 'OFFERED').length > 0 && (
                <Badge variant="default" className="ml-2">{requests.filter(r => r.status === 'OFFERED').length} new</Badge>
              )}</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingReq ? (
                <div className="text-center py-6 text-muted-foreground">
                  <Loader2 className="h-6 w-6 mx-auto animate-spin" />
                </div>
              ) : requests.filter(r => r.status === 'OFFERED').length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {availability.isOnline
                    ? <><Clock className="h-8 w-8 mx-auto mb-2" /> Waiting for requests…</>
                    : <><Power className="h-8 w-8 mx-auto mb-2" /> Go online to receive requests</>}
                </div>
              ) : (
                <div className="space-y-3">
                  {requests.filter(r => r.status === 'OFFERED').map((r) => (
                    <RequestCard
                      key={r.id}
                      request={r}
                      onAccept={() => acceptRequest(r.orderId)}
                      onReject={() => setShowRejectionDialog(r.orderId)}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Completed" value={String(driver.totalCompleted || 0)} icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />} />
          <StatCard label="Rating" value={(driver.rating || 5).toFixed(1)} icon={<Star className="h-5 w-5 text-amber-500" />} />
          <StatCard label="Total ratings" value={String(driver.totalRatings || 0)} icon={<TrendingUp className="h-5 w-5 text-blue-500" />} />
          <StatCard label="Cancelled" value={String(driver.totalCancelled || 0)} icon={<XCircle className="h-5 w-5 text-red-500" />} />
        </div>
      </div>

      {/* Incoming request modal */}
      {incomingRequest && !activeOrder && (
        <Dialog open onOpenChange={() => setIncomingRequest(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New request!</DialogTitle>
              <DialogDescription>Accept or reject this request.</DialogDescription>
            </DialogHeader>
            <RequestDetails request={incomingRequest} />
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowRejectionDialog(incomingRequest.orderId)}>Reject</Button>
              <Button onClick={() => acceptRequest(incomingRequest.orderId)}>Accept</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Rejection dialog */}
      {showRejectionDialog && (
        <Dialog open onOpenChange={() => setShowRejectionDialog(null)}>
          <RejectionDialog
            onSubmit={(reason) => rejectRequest(showRejectionDialog, reason)}
            onCancel={() => setShowRejectionDialog(null)}
          />
        </Dialog>
      )}
    </div>
  )
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold">{value}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
          </div>
          {icon}
        </div>
      </CardContent>
    </Card>
  )
}

function RequestCard({ request, onAccept, onReject }: { request: any; onAccept: () => void; onReject: () => void }) {
  const order = request.order
  if (!order) return null
  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{SERVICE_TYPE_LABELS[order.serviceType] || order.serviceType}</Badge>
            <span className="text-xs text-muted-foreground">{order.code}</span>
          </div>
          <div className="mt-2 text-sm">
            <div className="flex items-start gap-1.5">
              <MapPin className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
              <span>{order.pickupAddress}</span>
            </div>
            <div className="flex items-start gap-1.5 mt-1">
              <Navigation className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
              <span>{order.destinationAddress}</span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="font-bold">{formatCurrency(order.estimatedFare, order.currency)}</div>
          <div className="text-xs text-muted-foreground">{(order.distanceKm || 0).toFixed(1)} km</div>
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={onReject}>Reject</Button>
        <Button size="sm" className="flex-1" onClick={onAccept}>Accept</Button>
      </div>
    </div>
  )
}

function RequestDetails({ request }: { request: any }) {
  const order = request.order
  if (!order) return null
  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center justify-between">
        <Badge variant="secondary">{SERVICE_TYPE_LABELS[order.serviceType] || order.serviceType}</Badge>
        <span className="font-semibold">{formatCurrency(order.estimatedFare, order.currency)}</span>
      </div>
      <div>
        <div className="flex items-start gap-1.5">
          <MapPin className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
          <div>
            <div className="text-xs text-muted-foreground">Pickup</div>
            <div>{order.pickupAddress}</div>
          </div>
        </div>
        <div className="flex items-start gap-1.5 mt-2">
          <Navigation className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
          <div>
            <div className="text-xs text-muted-foreground">Destination</div>
            <div>{order.destinationAddress}</div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div><span className="text-muted-foreground">Distance:</span> {(order.distanceKm || 0).toFixed(1)} km</div>
        <div><span className="text-muted-foreground">Duration:</span> {Math.round(order.durationMinutes || 0)} min</div>
      </div>
    </div>
  )
}

function RejectionDialog({ onSubmit, onCancel }: { onSubmit: (reason: string) => void; onCancel: () => void }) {
  const [reason, setReason] = useState('')
  return (
    <>
      <DialogHeader>
        <DialogTitle>Reject request?</DialogTitle>
        <DialogDescription>Optional: tell us why you can't take this request.</DialogDescription>
      </DialogHeader>
      <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" />
      <DialogFooter>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button variant="destructive" onClick={() => onSubmit(reason)}>Reject</Button>
      </DialogFooter>
    </>
  )
}

// ============================================================
// Active Order Card (with action buttons)
// ============================================================
function ActiveOrderCard({ order, onUpdated }: { order: any; onUpdated: () => void }) {
  const [working, setWorking] = useState(false)

  const action = async (kind: 'arrive' | 'start' | 'complete', label: string) => {
    setWorking(true)
    try {
      if (kind === 'arrive') await OrderApi.arrive(order.id)
      else if (kind === 'start') await OrderApi.start(order.id)
      else if (kind === 'complete') await OrderApi.complete(order.id)
      toast.success(label)
      onUpdated()
    } catch (err: any) {
      toast.error('Failed', { description: err?.error })
    } finally {
      setWorking(false)
    }
  }

  let primaryAction: { kind: 'arrive' | 'start' | 'complete'; label: string } | null = null
  if (order.status === 'DRIVER_ASSIGNED') primaryAction = { kind: 'arrive', label: 'Start navigating' }
  else if (order.status === 'DRIVER_ARRIVING') primaryAction = { kind: 'arrive', label: 'Mark arrived' }
  else if (order.status === 'DRIVER_ARRIVED') {
    if (order.serviceType === 'CARGO') primaryAction = { kind: 'start', label: 'Start loading' }
    else if (order.serviceType === 'PACKAGE_DELIVERY') primaryAction = { kind: 'start', label: 'Package collected' }
    else primaryAction = { kind: 'start', label: 'Start trip' }
  }
  else if (order.status === 'LOADING') primaryAction = { kind: 'start', label: 'Start transit' }
  else if (order.status === 'IN_PROGRESS' || order.status === 'IN_TRANSIT') {
    if (order.serviceType === 'CARGO') primaryAction = { kind: 'complete', label: 'Mark unloading' }
    else primaryAction = { kind: 'complete', label: 'Complete trip' }
  }
  else if (order.status === 'UNLOADING') primaryAction = { kind: 'complete', label: 'Complete' }

  return (
    <Card className="border-primary">
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span>Active job · {order.code}</span>
          <Badge className={statusColor(order.status)}>{ORDER_STATUS_LABELS[order.status] || order.status}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm">
          <div className="flex items-start gap-1.5">
            <MapPin className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
            <div>
              <div className="text-xs text-muted-foreground">Pickup</div>
              <div>{order.pickupAddress}</div>
            </div>
          </div>
          <div className="flex items-start gap-1.5 mt-2">
            <Navigation className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
            <div>
              <div className="text-xs text-muted-foreground">Destination</div>
              <div>{order.destinationAddress}</div>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between text-sm border-t pt-3">
          <div><span className="text-muted-foreground">Fare:</span> <span className="font-semibold">{formatCurrency(order.estimatedFare, order.currency)}</span></div>
          <div><span className="text-muted-foreground">Customer:</span> {order.customer?.fullName}</div>
        </div>
        {primaryAction && (
          <Button className="w-full" onClick={() => action(primaryAction!.kind, primaryAction!.label)} disabled={working}>
            {working ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            {primaryAction.label}
          </Button>
        )}
        <Button variant="outline" className="w-full" asChild>
          <a href={`tel:${order.customer?.phone}`}><Phone className="h-4 w-4 mr-2" /> Call customer</a>
        </Button>
      </CardContent>
    </Card>
  )
}

// ============================================================
// Driver Orders History
// ============================================================
function DriverOrders({ onBack }: { onBack: () => void }) {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    DriverApi.orders().then(({ orders }) => setOrders(orders)).finally(() => setLoading(false))
  }, [])
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
          <h1 className="font-semibold flex-1">Job history</h1>
        </div>
      </header>
      <div className="flex-1 max-w-3xl w-full mx-auto px-4 py-6 space-y-3">
        {loading ? <Skeleton className="h-20" /> :
         orders.length === 0 ? <Card><CardContent className="p-8 text-center text-muted-foreground">No jobs yet.</CardContent></Card> :
         orders.map(o => (
           <Card key={o.id}>
             <CardContent className="p-4">
               <div className="flex items-start justify-between">
                 <div>
                   <div className="flex items-center gap-2">
                     <span className="font-semibold">{o.code}</span>
                     <Badge variant="outline" className={statusColor(o.status)}>{ORDER_STATUS_LABELS[o.status] || o.status}</Badge>
                   </div>
                   <div className="text-xs text-muted-foreground mt-1">{o.pickupAddress} → {o.destinationAddress}</div>
                   <div className="text-xs text-muted-foreground">{formatDateTime(o.createdAt)}</div>
                 </div>
                 <div className="text-right">
                   <div className="font-semibold">{formatCurrency(o.finalFare || o.estimatedFare, o.currency)}</div>
                   <div className="text-xs text-muted-foreground">{(o.distanceKm || 0).toFixed(1)} km</div>
                 </div>
               </div>
             </CardContent>
           </Card>
         ))}
      </div>
    </div>
  )
}

// ============================================================
// Driver Earnings
// ============================================================
function DriverEarnings({ onBack }: { onBack: () => void }) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    DriverApi.earnings().then(setData).finally(() => setLoading(false))
  }, [])
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
          <h1 className="font-semibold flex-1">Earnings (last 30 days)</h1>
        </div>
      </header>
      <div className="flex-1 max-w-3xl w-full mx-auto px-4 py-6 space-y-4">
        {loading ? <Skeleton className="h-40" /> : data ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <EarningCard label="Gross fares" value={formatCurrency(data.grossFares, data.currency)} />
              <EarningCard label="Commission" value={`-${formatCurrency(data.commission, data.currency)}`} />
              <EarningCard label="Net earnings" value={formatCurrency(data.netEarnings, data.currency)} highlight />
              <EarningCard label="Adjustments" value={formatCurrency(data.adjustments, data.currency)} />
              <EarningCard label="Refunds" value={`-${formatCurrency(data.refunds, data.currency)}`} />
              <EarningCard label="Completed jobs" value={String(data.completedJobs)} />
            </div>
            <Card>
              <CardHeader><CardTitle className="text-base">Recent jobs</CardTitle></CardHeader>
              <CardContent className="space-y-2 max-h-96 overflow-y-auto scroll-thin">
                {data.recentOrders.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-6">No completed jobs in this period.</p>
                ) : data.recentOrders.map((o: any) => (
                  <div key={o.id} className="flex items-center justify-between text-sm border-b last:border-0 pb-2">
                    <div>
                      <div className="font-medium">{o.code}</div>
                      <div className="text-xs text-muted-foreground">{formatDateTime(o.completedAt)}</div>
                    </div>
                    <div className="font-semibold">{formatCurrency(o.finalFare, o.currency)}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </div>
  )
}

function EarningCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <Card className={highlight ? 'border-primary' : ''}>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-lg font-bold ${highlight ? 'text-primary' : ''}`}>{value}</div>
      </CardContent>
    </Card>
  )
}
