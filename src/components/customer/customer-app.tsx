'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Car, Bike, Truck, MapPin, Navigation, Clock, Phone, MessageSquare, Star, ArrowLeft, Package, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { ServiceApi, PricingApi, OrderApi, GeoApi } from '@/lib/api-client'
import { useAuth } from '@/components/shared/auth-provider'
import { toast } from 'sonner'
import { formatCurrency, formatDateTime, ORDER_STATUS_LABELS, SERVICE_TYPE_LABELS } from '@/lib/format'
import { useAppStore } from '@/stores/app-store'
import { getSocket, joinOrderRoom, authenticateSocket } from '@/lib/realtime-client'

const MapView = dynamic(() => import('@/components/map/MapView'), { ssr: false })

type ServiceCategory = {
  id: string
  code: string
  name: string
  description?: string
  supportsPassenger: boolean
  supportsDelivery: boolean
  requiresQuotation: boolean
  vehicleCategories: VehicleCategory[]
}

type VehicleCategory = {
  id: string
  code: string
  name: string
  capacity: number
  baseFareMultiplier: number
}

type Address = { label: string; address: string; lat: number; lng: number }

export function CustomerApp() {
  const user = useAuth().user!
  const [services, setServices] = useState<ServiceCategory[]>([])
  const [loadingServices, setLoadingServices] = useState(true)
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null)
  const [view, setView] = useState<'home' | 'booking' | 'requesting' | 'tracking' | 'history'>('home')
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null)
  const [orders, setOrders] = useState<any[]>([])
  const [loadingOrders, setLoadingOrders] = useState(false)

  useEffect(() => {
    ServiceApi.list().then(({ services }) => {
      setServices(services)
      setLoadingServices(false)
    })
  }, [])

  // Authenticate socket on mount
  useEffect(() => {
    if (user?.id) {
      try { authenticateSocket(user.id, 'CUSTOMER') } catch {}
    }
  }, [user?.id])

  const loadOrders = async () => {
    setLoadingOrders(true)
    try {
      const { orders } = await OrderApi.list()
      setOrders(orders)
    } finally {
      setLoadingOrders(false)
    }
  }

  useEffect(() => {
    if (view === 'history') loadOrders()
  }, [view])

  const selectedService = services.find((s) => s.id === selectedServiceId)

  if (view === 'tracking' && activeOrderId) {
    return (
      <CustomerTracking
        orderId={activeOrderId}
        onExit={() => {
          setActiveOrderId(null)
          setView('home')
        }}
      />
    )
  }

  if (view === 'booking' && selectedService) {
    return (
      <CustomerBooking
        service={selectedService}
        onBack={() => setView('home')}
        onRequested={(orderId) => {
          setActiveOrderId(orderId)
          setView('tracking')
        }}
      />
    )
  }

  if (view === 'history') {
    return (
      <CustomerHistory
        orders={orders}
        loading={loadingOrders}
        onBack={() => setView('home')}
        onRefresh={loadOrders}
        onTrack={(orderId) => {
          setActiveOrderId(orderId)
          setView('tracking')
        }}
      />
    )
  }

  return (
    <CustomerHome
      services={services}
      loading={loadingServices}
      user={user}
      onSelectService={(id) => {
        setSelectedServiceId(id)
        setView('booking')
      }}
      onShowHistory={() => setView('history')}
      onLogout={() => window.location.reload()}
    />
  )
}

// ============================================================
// Home screen with the three principal service categories
// ============================================================
function CustomerHome({
  services,
  loading,
  user,
  onSelectService,
  onShowHistory,
  onLogout,
}: {
  services: ServiceCategory[]
  loading: boolean
  user: any
  onSelectService: (id: string) => void
  onShowHistory: () => void
  onLogout: () => void
}) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Car className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-bold">YallaGo</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onShowHistory}>
              <Clock className="h-4 w-4 mr-1" /> History
            </Button>
            <div className="text-sm hidden sm:block">
              <div className="font-medium">{user.fullName}</div>
              <div className="text-xs text-muted-foreground">{user.email}</div>
            </div>
            <Button variant="outline" size="sm" onClick={onLogout}>Sign out</Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold">Where would you like to go?</h1>
          <p className="text-muted-foreground mt-1">Choose a service to get started.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {loading ? (
            <>
              <Skeleton className="h-44" />
              <Skeleton className="h-44" />
              <Skeleton className="h-44" />
            </>
          ) : (
            services.map((s) => <ServiceCard key={s.id} service={s} onSelect={() => onSelectService(s.id)} />)
          )}
        </div>

        {/* Map preview */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-3">Service area</h2>
          <div className="rounded-xl overflow-hidden border h-72">
            <MapView
              center={{ lat: 35.7008, lng: 51.3914 }}
              zoom={12}
              markers={[
                { id: 'center', position: { lat: 35.7008, lng: 51.3914 }, icon: 'pickup', popup: 'Tehran — Demo service area' },
              ]}
            />
          </div>
        </div>

        {/* How it works */}
        <div className="mt-8 grid md:grid-cols-4 gap-4">
          <Step n={1} title="Set destination" desc="Enter your pickup and drop-off locations." />
          <Step n={2} title="See your fare" desc="Get an upfront price estimate before booking." />
          <Step n={3} title="Match with a driver" desc="We dispatch the nearest eligible driver." />
          <Step n={4} title="Track live" desc="Follow your driver in real time until arrival." />
        </div>
      </main>

      <footer className="border-t mt-12 py-6 text-center text-sm text-muted-foreground">
        © 2026 YallaGo — A ride-hailing & logistics platform demo.
      </footer>
    </div>
  )
}

function ServiceCard({ service, onSelect }: { service: ServiceCategory; onSelect: () => void }) {
  const icon = service.code === 'CAR' ? <Car className="h-7 w-7" /> :
    service.code === 'MOTORCYCLE' ? <Bike className="h-7 w-7" /> :
    <Truck className="h-7 w-7" />

  return (
    <Card
      className="cursor-pointer hover:border-primary hover:shadow-md transition-all group"
      onClick={onSelect}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="h-14 w-14 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
            {icon}
          </div>
          {service.requiresQuotation && (
            <Badge variant="secondary">Quotation</Badge>
          )}
        </div>
        <h3 className="mt-4 font-bold text-lg">{service.name}</h3>
        <p className="text-sm text-muted-foreground mt-1">{service.description}</p>
        <div className="mt-4 flex flex-wrap gap-1">
          {service.supportsPassenger && <Badge variant="outline">Passenger</Badge>}
          {service.supportsDelivery && <Badge variant="outline">Delivery</Badge>}
          <Badge variant="outline">{service.vehicleCategories.length} options</Badge>
        </div>
      </CardContent>
    </Card>
  )
}

function Step({ n, title, desc }: { n: number; title: string; desc: string }) {
  return (
    <div className="flex gap-3">
      <div className="h-8 w-8 rounded-full bg-primary/10 text-primary text-sm font-bold flex items-center justify-center shrink-0">
        {n}
      </div>
      <div>
        <div className="font-medium text-sm">{title}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
      </div>
    </div>
  )
}

// ============================================================
// Booking form
// ============================================================
function CustomerBooking({
  service,
  onBack,
  onRequested,
}: {
  service: ServiceCategory
  onBack: () => void
  onRequested: (orderId: string) => void
}) {
  const user = useAuth().user!
  const [pickup, setPickup] = useState<Address | null>(null)
  const [destination, setDestination] = useState<Address | null>(null)
  const [vehicleCategoryId, setVehicleCategoryId] = useState<string>('')
  const [pickupQuery, setPickupQuery] = useState('')
  const [destQuery, setDestQuery] = useState('')
  const [pickupResults, setPickupResults] = useState<Address[]>([])
  const [destResults, setDestResults] = useState<Address[]>([])
  const [estimate, setEstimate] = useState<any>(null)
  const [polyline, setPolyline] = useState<{ lat: number; lng: number }[]>([])
  const [loadingEstimate, setLoadingEstimate] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Service-specific state
  const [packageInfo, setPackageInfo] = useState({
    description: '',
    recipientName: '',
    recipientPhone: '',
    weightKg: 1,
    dimensions: '',
    declaredValue: 0,
    specialInstructions: '',
    priority: 'STANDARD',
    requireCode: true,
  })
  const [cargoInfo, setCargoInfo] = useState({
    cargoCategory: 'STANDARD_LOCAL',
    cargoDescription: '',
    weightKg: 100,
    itemCount: 1,
    helpers: 0,
    needsLoading: false,
    needsUnloading: false,
    scheduled: false,
    scheduledFor: '',
    additionalInstructions: '',
  })
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'WALLET'>('CASH')

  useEffect(() => {
    if (service.vehicleCategories.length > 0) {
      setVehicleCategoryId(service.vehicleCategories[0].id)
    }
  }, [service.id])

  // Search addresses (debounced)
  useEffect(() => {
    if (pickupQuery.length < 2) return
    const t = setTimeout(async () => {
      const { results } = await GeoApi.search(pickupQuery)
      setPickupResults(results)
    }, 250)
    return () => clearTimeout(t)
  }, [pickupQuery])

  useEffect(() => {
    if (destQuery.length < 2) return
    const t = setTimeout(async () => {
      const { results } = await GeoApi.search(destQuery)
      setDestResults(results)
    }, 250)
    return () => clearTimeout(t)
  }, [destQuery])

  // Calculate estimate when pickup, destination, vehicle, or service-specific params change
  useEffect(() => {
    if (!pickup || !destination || !vehicleCategoryId) return
    setLoadingEstimate(true)
    setEstimate(null)
    const t = setTimeout(async () => {
      try {
        const params: any = {
          serviceCategoryId: service.id,
          vehicleCategoryId,
          pickupLat: pickup.lat, pickupLng: pickup.lng,
          destinationLat: destination.lat, destinationLng: destination.lng,
        }
        if (service.code === 'MOTORCYCLE') {
          params.packageDelivery = service.serviceType === 'PACKAGE_DELIVERY' || !!packageInfo.description
          if (packageInfo.weightKg > 5) params.oversizedPackage = true
        }
        if (service.code === 'CARGO') {
          params.weightKg = Number(cargoInfo.weightKg)
          params.helpers = Number(cargoInfo.helpers)
          params.needsLoading = cargoInfo.needsLoading
          params.needsUnloading = cargoInfo.needsUnloading
          params.scheduled = cargoInfo.scheduled
        }
        const res = await PricingApi.estimate(params)
        setEstimate(res.estimate)

        // Fetch route polyline
        const routeRes = await GeoApi.route(pickup, destination)
        setPolyline(routeRes.polyline)
      } catch (err: any) {
        toast.error('Could not calculate fare estimate', { description: err?.error })
      } finally {
        setLoadingEstimate(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [pickup, destination, vehicleCategoryId, service.id,
      packageInfo.description, packageInfo.weightKg,
      cargoInfo.weightKg, cargoInfo.helpers, cargoInfo.needsLoading, cargoInfo.needsUnloading, cargoInfo.scheduled])

  const submitOrder = async () => {
    if (!pickup || !destination || !vehicleCategoryId) {
      toast.error('Please set pickup and destination.')
      return
    }
    setSubmitting(true)
    try {
      const serviceType = service.code === 'CAR' ? 'RIDE' :
        service.code === 'MOTORCYCLE' ? (packageInfo.description ? 'PACKAGE_DELIVERY' : 'MOTORCYCLE_RIDE') :
        'CARGO'
      const params: any = {
        serviceCategoryId: service.id,
        vehicleCategoryId,
        serviceType,
        pickup: { lat: pickup.lat, lng: pickup.lng, address: pickup.address },
        destination: { lat: destination.lat, lng: destination.lng, address: destination.address },
        paymentMethod,
      }
      if (serviceType === 'PACKAGE_DELIVERY') {
        params.details = packageInfo
        params.requiresQuotation = false
      } else if (serviceType === 'CARGO') {
        params.details = cargoInfo
        params.weightKg = Number(cargoInfo.weightKg)
        params.helpers = Number(cargoInfo.helpers)
        params.needsLoading = cargoInfo.needsLoading
        params.needsUnloading = cargoInfo.needsUnloading
        params.scheduledFor = cargoInfo.scheduled && cargoInfo.scheduledFor ? new Date(cargoInfo.scheduledFor) : null
        params.requiresQuotation = !!service.requiresQuotation
      }
      const { order } = await OrderApi.create(params)
      toast.success('Order placed! Searching for available drivers…')
      onRequested(order.id)
    } catch (err: any) {
      toast.error('Failed to create order', { description: err?.error })
    } finally {
      setSubmitting(false)
    }
  }

  const isMotorcycle = service.code === 'MOTORCYCLE'
  const isCargo = service.code === 'CARGO'

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <h1 className="font-semibold">{service.name} booking</h1>
        </div>
      </header>

      <div className="flex-1 max-w-6xl w-full mx-auto px-4 py-6 grid lg:grid-cols-2 gap-6">
        {/* Form column */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Locations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <AddressField
                label="Pickup"
                value={pickupQuery}
                onChange={setPickupQuery}
                results={pickupResults}
                onSelect={(a) => { setPickup(a); setPickupQuery(a.address); setPickupResults([]) }}
                selected={pickup}
                iconColor="bg-emerald-500"
              />
              <AddressField
                label="Destination"
                value={destQuery}
                onChange={setDestQuery}
                results={destResults}
                onSelect={(a) => { setDestination(a); setDestQuery(a.address); setDestResults([]) }}
                selected={destination}
                iconColor="bg-red-500"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Service options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">Vehicle category</Label>
                <Select value={vehicleCategoryId} onValueChange={setVehicleCategoryId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {service.vehicleCategories.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name} · {v.capacity} ppl
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {isMotorcycle && (
                <MotorcyclePackageFields values={packageInfo} onChange={setPackageInfo} />
              )}

              {isCargo && (
                <CargoFields values={cargoInfo} onChange={setCargoInfo} />
              )}

              <div>
                <Label className="text-xs text-muted-foreground">Payment method</Label>
                <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as any)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">Cash</SelectItem>
                    <SelectItem value="CARD">Card (online)</SelectItem>
                    <SelectItem value="WALLET">Wallet</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {estimate && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Fare estimate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  {estimate.breakdown.map((row: any, i: number) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{row.label}</span>
                      <span>{formatCurrency(row.amount, estimate.currency)}</span>
                    </div>
                  ))}
                  <div className="border-t pt-2 mt-2 flex justify-between font-bold">
                    <span>Total estimate</span>
                    <span>{formatCurrency(estimate.finalEstimate, estimate.currency)}</span>
                  </div>
                </div>
                {service.requiresQuotation && (
                  <p className="text-xs text-muted-foreground mt-2">
                    This service requires an admin-approved quotation. Your request will be reviewed before dispatch.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          <Button
            className="w-full"
            size="lg"
            onClick={submitOrder}
            disabled={!pickup || !destination || !estimate || submitting || loadingEstimate}
          >
            {submitting ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Placing request…</>
            ) : service.requiresQuotation ? (
              'Request quotation'
            ) : (
              `Request ${service.name.toLowerCase()}`
            )}
          </Button>
        </div>

        {/* Map column */}
        <div className="lg:sticky lg:top-20 h-80 lg:h-[calc(100vh-7rem)] rounded-xl overflow-hidden border">
          <MapView
            center={pickup || destination || { lat: 35.7008, lng: 51.3914 }}
            zoom={12}
            markers={[
              ...(pickup ? [{ id: 'pickup', position: { lat: pickup.lat, lng: pickup.lng }, icon: 'pickup' as const, popup: `Pickup: ${pickup.address}` }] : []),
              ...(destination ? [{ id: 'dest', position: { lat: destination.lat, lng: destination.lng }, icon: 'destination' as const, popup: `Destination: ${destination.address}` }] : []),
            ]}
            polyline={polyline}
          />
          {loadingEstimate && pickup && destination && (
            <div className="absolute top-3 right-3 bg-background/95 rounded-md shadow px-3 py-2 text-xs flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" /> Calculating route…
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function AddressField({
  label, value, onChange, results, onSelect, selected, iconColor,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  results: Address[]
  onSelect: (a: Address) => void
  selected: Address | null
  iconColor: string
}) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="relative mt-1">
        <div className="absolute left-3 top-1/2 -translate-y-1/2">
          <div className={`h-3 w-3 rounded-full ${iconColor}`} />
        </div>
        <Input
          className="pl-9"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Search ${label.toLowerCase()} address…`}
        />
        {results.length > 0 && (
          <div className="absolute z-20 left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-y-auto scroll-thin">
            {results.map((r, i) => (
              <button
                key={i}
                className="w-full text-left px-3 py-2 hover:bg-accent flex items-start gap-2 text-sm"
                onClick={() => onSelect(r)}
              >
                <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                <div>
                  <div className="font-medium">{r.label}</div>
                  <div className="text-xs text-muted-foreground">{r.address}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      {selected && (
        <p className="text-xs text-muted-foreground mt-1">{selected.address}</p>
      )}
    </div>
  )
}

function MotorcyclePackageFields({
  values, onChange,
}: {
  values: any
  onChange: (v: any) => void
}) {
  return (
    <div className="space-y-3 border-t pt-3">
      <Label className="text-xs text-muted-foreground uppercase">Package delivery (optional)</Label>
      <div>
        <Label className="text-xs">Description</Label>
        <Input value={values.description} onChange={(e) => onChange({ ...values, description: e.target.value })} placeholder="e.g. Documents, small box" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Recipient name</Label>
          <Input value={values.recipientName} onChange={(e) => onChange({ ...values, recipientName: e.target.value })} />
        </div>
        <div>
          <Label className="text-xs">Recipient phone</Label>
          <Input value={values.recipientPhone} onChange={(e) => onChange({ ...values, recipientPhone: e.target.value })} placeholder="+98…" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Weight (kg)</Label>
          <Input type="number" min="0.1" step="0.1" value={values.weightKg} onChange={(e) => onChange({ ...values, weightKg: Number(e.target.value) })} />
        </div>
        <div>
          <Label className="text-xs">Dimensions</Label>
          <Input value={values.dimensions} onChange={(e) => onChange({ ...values, dimensions: e.target.value })} placeholder="30×20×10cm" />
        </div>
      </div>
      <div>
        <Label className="text-xs">Special instructions</Label>
        <Textarea rows={2} value={values.specialInstructions} onChange={(e) => onChange({ ...values, specialInstructions: e.target.value })} placeholder="Fragile, leave at door, etc." />
      </div>
      <div className="flex items-center justify-between">
        <Label className="text-xs">Require confirmation code</Label>
        <Switch checked={values.requireCode} onCheckedChange={(v) => onChange({ ...values, requireCode: v })} />
      </div>
    </div>
  )
}

function CargoFields({ values, onChange }: { values: any; onChange: (v: any) => void }) {
  return (
    <div className="space-y-3 border-t pt-3">
      <Label className="text-xs text-muted-foreground uppercase">Cargo details</Label>
      <div>
        <Label className="text-xs">Service type</Label>
        <Select value={values.cargoCategory} onValueChange={(v) => onChange({ ...values, cargoCategory: v })}>
          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="STANDARD_LOCAL">Standard local delivery</SelectItem>
            <SelectItem value="SAME_DAY">Same-day freight</SelectItem>
            <SelectItem value="SCHEDULED">Scheduled cargo transport</SelectItem>
            <SelectItem value="HOUSEHOLD">Household moving</SelectItem>
            <SelectItem value="BUSINESS">Business logistics</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs">Cargo description</Label>
        <Textarea rows={2} value={values.cargoDescription} onChange={(e) => onChange({ ...values, cargoDescription: e.target.value })} placeholder="Furniture, appliances, boxes…" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label className="text-xs">Weight (kg)</Label>
          <Input type="number" min="1" value={values.weightKg} onChange={(e) => onChange({ ...values, weightKg: Number(e.target.value) })} />
        </div>
        <div>
          <Label className="text-xs">Items</Label>
          <Input type="number" min="1" value={values.itemCount} onChange={(e) => onChange({ ...values, itemCount: Number(e.target.value) })} />
        </div>
        <div>
          <Label className="text-xs">Helpers</Label>
          <Input type="number" min="0" max="5" value={values.helpers} onChange={(e) => onChange({ ...values, helpers: Number(e.target.value) })} />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={values.needsLoading} onCheckedChange={(v) => onChange({ ...values, needsLoading: v })} /> Loading
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={values.needsUnloading} onCheckedChange={(v) => onChange({ ...values, needsUnloading: v })} /> Unloading
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={values.scheduled} onCheckedChange={(v) => onChange({ ...values, scheduled: v })} /> Scheduled
        </label>
      </div>
      {values.scheduled && (
        <div>
          <Label className="text-xs">Scheduled for</Label>
          <Input type="datetime-local" value={values.scheduledFor} onChange={(e) => onChange({ ...values, scheduledFor: e.target.value })} />
        </div>
      )}
      <div>
        <Label className="text-xs">Additional instructions</Label>
        <Textarea rows={2} value={values.additionalInstructions} onChange={(e) => onChange({ ...values, additionalInstructions: e.target.value })} placeholder="Building access, parking, etc." />
      </div>
    </div>
  )
}

// ============================================================
// Real-time tracking
// ============================================================
function CustomerTracking({ orderId, onExit }: { orderId: string; onExit: () => void }) {
  const [order, setOrder] = useState<any>(null)
  const [driverLocation, setDriverLocation] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [polyline, setPolyline] = useState<{ lat: number; lng: number }[]>([])
  const [rating, setRating] = useState(0)
  const [ratingComment, setRatingComment] = useState('')
  const [ratingSubmitted, setRatingSubmitted] = useState(false)
  const user = useAuth().user!

  const refresh = async () => {
    try {
      const res = await OrderApi.get(orderId)
      setOrder(res.order)
      setDriverLocation(res.driverLocation)
      if (res.driverLocation && res.order) {
        // Simulate route from driver to pickup, then pickup to destination
        const target = res.order.status === 'DRIVER_ARRIVING'
          ? { lat: res.order.pickupLat, lng: res.order.pickupLng }
          : res.order.status === 'IN_PROGRESS' || res.order.status === 'IN_TRANSIT'
            ? { lat: res.order.destinationLat, lng: res.order.destinationLng }
            : null
        if (target) {
          try {
            const r = await GeoApi.route({ lat: res.driverLocation.lat, lng: res.driverLocation.lng }, target)
            setPolyline(r.polyline)
          } catch {}
        }
      }
    } catch (err: any) {
      toast.error('Failed to load order', { description: err?.error })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 3000)
    // Subscribe to socket
    try {
      joinOrderRoom(orderId)
      const socket = getSocket()
      const onLocation = (data: any) => {
        if (data.driverId === order?.driverId) {
          setDriverLocation({ lat: data.lat, lng: data.lng, isOnline: true, lastSeenAt: new Date().toISOString() })
        }
      }
      socket.on('driver-location', onLocation)
      return () => {
        clearInterval(interval)
        socket.off('driver-location', onLocation)
      }
    } catch {
      return () => clearInterval(interval)
    }
  }, [orderId, order?.driverId])

  const cancel = async () => {
    if (!confirm('Cancel this order?')) return
    try {
      await OrderApi.cancel(orderId, 'Customer cancelled')
      toast.success('Order cancelled.')
      refresh()
    } catch (err: any) {
      toast.error('Failed to cancel', { description: err?.error })
    }
  }

  const submitRating = async () => {
    if (rating < 1) {
      toast.error('Please select a star rating.')
      return
    }
    try {
      await OrderApi.rate(orderId, rating, ratingComment)
      setRatingSubmitted(true)
      toast.success('Thanks for your feedback!')
    } catch (err: any) {
      toast.error('Failed to submit rating', { description: err?.error })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!order) return null

  const isCompleted = order.status === 'COMPLETED'
  const isCancelled = order.status.startsWith('CANCELLED') || order.status === 'NO_DRIVER_AVAILABLE' || order.status === 'EXPIRED'

  const markers: any[] = [
    { id: 'pickup', position: { lat: order.pickupLat, lng: order.pickupLng }, icon: 'pickup' as const, popup: `Pickup: ${order.pickupAddress}` },
    { id: 'dest', position: { lat: order.destinationLat, lng: order.destinationLng }, icon: 'destination' as const, popup: `Destination: ${order.destinationAddress}` },
  ]
  if (driverLocation && order.driverId) {
    markers.push({ id: 'driver', position: { lat: driverLocation.lat, lng: driverLocation.lng }, icon: 'driver' as const, popup: 'Your driver' })
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onExit}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <h1 className="font-semibold flex-1">Order {order.code}</h1>
          <Badge variant="outline">{ORDER_STATUS_LABELS[order.status] || order.status}</Badge>
        </div>
      </header>

      <div className="flex-1 max-w-6xl w-full mx-auto px-4 py-6 grid lg:grid-cols-2 gap-6">
        {/* Status column */}
        <div className="space-y-4">
          <Card>
            <CardContent className="p-6">
              <OrderStatusTimeline status={order.status} serviceType={order.serviceType} />
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <Info label="Service" value={SERVICE_TYPE_LABELS[order.serviceType] || order.serviceType} />
                <Info label="Estimated fare" value={formatCurrency(order.estimatedFare, order.currency)} />
                <Info label="Distance" value={`${(order.distanceKm || 0).toFixed(1)} km`} />
                <Info label="Duration" value={`${Math.round(order.durationMinutes || 0)} min`} />
              </div>
            </CardContent>
          </Card>

          {order.driver && order.driver.user && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                    {order.driver.user.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{order.driver.user.fullName}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                      {order.driver.rating?.toFixed(1) || '5.0'}
                      {order.driver.vehicles?.[0] && (
                        <span> · {order.driver.vehicles[0].plateNumber}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="icon"><Phone className="h-4 w-4" /></Button>
                    <Button variant="outline" size="icon"><MessageSquare className="h-4 w-4" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {(order.status === 'REQUESTED' || order.status === 'SEARCHING') && (
            <Card>
              <CardContent className="p-6 text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                <p className="mt-2 text-sm">Searching for available drivers…</p>
                <Button variant="outline" className="mt-3" onClick={cancel}>Cancel request</Button>
              </CardContent>
            </Card>
          )}

          {isCompleted && !ratingSubmitted && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" /> Trip completed
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between font-bold">
                  <span>Final fare</span>
                  <span>{formatCurrency(order.finalFare || order.estimatedFare, order.currency)}</span>
                </div>
                <div>
                  <Label className="text-xs">Rate your {order.driver ? 'driver' : 'service'}</Label>
                  <div className="flex gap-1 mt-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button
                        key={s}
                        onClick={() => setRating(s)}
                        className="p-1"
                      >
                        <Star className={`h-7 w-7 ${rating >= s ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground'}`} />
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Comment (optional)</Label>
                  <Textarea rows={2} value={ratingComment} onChange={(e) => setRatingComment(e.target.value)} />
                </div>
                <Button className="w-full" onClick={submitRating} disabled={!rating}>
                  Submit feedback
                </Button>
              </CardContent>
            </Card>
          )}

          {ratingSubmitted && (
            <Card>
              <CardContent className="p-6 text-center">
                <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-500" />
                <p className="mt-2 font-medium">Thank you for your feedback!</p>
              </CardContent>
            </Card>
          )}

          {isCancelled && (
            <Card>
              <CardContent className="p-6 text-center">
                <XCircle className="h-8 w-8 mx-auto text-red-500" />
                <p className="mt-2 font-medium">Order {order.status === 'NO_DRIVER_AVAILABLE' ? 'no drivers available' : 'cancelled'}</p>
                {order.cancelReason && <p className="text-sm text-muted-foreground mt-1">{order.cancelReason}</p>}
              </CardContent>
            </Card>
          )}

          {order.status === 'QUOTATION_REQUESTED' && (
            <Card>
              <CardContent className="p-6 text-center">
                <Package className="h-8 w-8 mx-auto text-primary" />
                <p className="mt-2 font-medium">Quotation pending</p>
                <p className="text-sm text-muted-foreground mt-1">An administrator will review your cargo request and approve the quotation shortly.</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Map column */}
        <div className="lg:sticky lg:top-20 h-80 lg:h-[calc(100vh-7rem)] rounded-xl overflow-hidden border">
          <MapView
            center={driverLocation || { lat: order.pickupLat, lng: order.pickupLng }}
            zoom={13}
            markers={markers}
            polyline={polyline}
          />
        </div>
      </div>
    </div>
  )
}

function OrderStatusTimeline({ status, serviceType }: { status: string; serviceType: string }) {
  const steps = serviceType === 'CARGO'
    ? ['REQUESTED', 'DRIVER_ASSIGNED', 'DRIVER_ARRIVING', 'DRIVER_ARRIVED', 'LOADING', 'IN_TRANSIT', 'UNLOADING', 'COMPLETED']
    : ['REQUESTED', 'DRIVER_ASSIGNED', 'DRIVER_ARRIVING', 'DRIVER_ARRIVED', 'IN_PROGRESS', 'COMPLETED']
  const currentIdx = steps.indexOf(status)
  const isCancelled = status.startsWith('CANCELLED') || status === 'EXPIRED' || status === 'NO_DRIVER_AVAILABLE'

  if (isCancelled) {
    return (
      <div className="text-center text-red-500 font-medium">
        Order {status === 'NO_DRIVER_AVAILABLE' ? 'expired' : 'cancelled'}
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between">
      {steps.map((s, i) => (
        <div key={s} className="flex-1 flex flex-col items-center relative">
          {i > 0 && (
            <div className={`absolute right-1/2 left-[-50%] top-2 h-0.5 ${i <= currentIdx ? 'bg-primary' : 'bg-muted'}`} />
          )}
          <div className={`relative z-10 h-4 w-4 rounded-full ${i <= currentIdx ? 'bg-primary' : 'bg-muted'}`} />
          <div className={`text-[10px] mt-1 text-center ${i === currentIdx ? 'font-bold text-foreground' : 'text-muted-foreground'}`}>
            {ORDER_STATUS_LABELS[s] || s}
          </div>
        </div>
      ))}
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  )
}

// ============================================================
// History
// ============================================================
function CustomerHistory({
  orders, loading, onBack, onRefresh, onTrack,
}: {
  orders: any[]
  loading: boolean
  onBack: () => void
  onRefresh: () => void
  onTrack: (id: string) => void
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <h1 className="font-semibold flex-1">Order history</h1>
          <Button variant="ghost" size="sm" onClick={onRefresh}>Refresh</Button>
        </div>
      </header>
      <div className="flex-1 max-w-3xl w-full mx-auto px-4 py-6 space-y-3">
        {loading ? (
          <>
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </>
        ) : orders.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <Clock className="h-8 w-8 mx-auto mb-2" />
              No orders yet. Book your first ride!
            </CardContent>
          </Card>
        ) : (
          orders.map((o) => (
            <Card key={o.id} className="cursor-pointer hover:border-primary" onClick={() => onTrack(o.id)}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{o.code}</span>
                    <Badge variant="outline">{ORDER_STATUS_LABELS[o.status] || o.status}</Badge>
                    <Badge variant="secondary">{SERVICE_TYPE_LABELS[o.serviceType] || o.serviceType}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {o.pickupAddress} → {o.destinationAddress}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{formatDateTime(o.createdAt)}</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{formatCurrency(o.finalFare || o.estimatedFare, o.currency)}</div>
                  <div className="text-xs text-muted-foreground">{(o.distanceKm || 0).toFixed(1)} km</div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
