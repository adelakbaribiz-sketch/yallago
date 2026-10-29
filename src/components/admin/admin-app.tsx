'use client'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import {
  Users, Car, Truck, Bike, LayoutDashboard, Settings, ShieldCheck, DollarSign,
  CheckCircle2, XCircle, Clock, AlertCircle, Star, TrendingUp, FileText, Loader2, Search, RefreshCw
} from 'lucide-react'
import { AdminApi, ServiceApi } from '@/lib/api-client'
import { useAuth } from '@/components/shared/auth-provider'
import { ThemeToggle } from '@/components/shared/theme-toggle'
import { toast } from 'sonner'
import {
  formatCurrency, formatDateTime, formatDate, ORDER_STATUS_LABELS, SERVICE_TYPE_LABELS,
  DRIVER_STATUS_LABELS, statusColor,
} from '@/lib/format'

export function AdminApp() {
  const user = useAuth().user!
  const [tab, setTab] = useState<'dashboard' | 'customers' | 'drivers' | 'orders' | 'pricing'>('dashboard')
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-bold">YallaGo Admin</span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <div className="text-xs text-right">
              <div className="font-medium">{user.fullName}</div>
              <div className="text-muted-foreground">Administrator</div>
            </div>
          </div>
        </div>
      </header>
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 flex flex-col lg:flex-row gap-6">
        {/* Sidebar */}
        <aside className="lg:w-56 shrink-0">
          <nav className="flex lg:flex-col gap-1 overflow-x-auto">
            <NavButton active={tab === 'dashboard'} onClick={() => setTab('dashboard')} icon={<LayoutDashboard className="h-4 w-4" />}>Dashboard</NavButton>
            <NavButton active={tab === 'customers'} onClick={() => setTab('customers')} icon={<Users className="h-4 w-4" />}>Customers</NavButton>
            <NavButton active={tab === 'drivers'} onClick={() => setTab('drivers')} icon={<Car className="h-4 w-4" />}>Drivers</NavButton>
            <NavButton active={tab === 'orders'} onClick={() => setTab('orders')} icon={<Truck className="h-4 w-4" />}>Orders</NavButton>
            <NavButton active={tab === 'pricing'} onClick={() => setTab('pricing')} icon={<DollarSign className="h-4 w-4" />}>Pricing</NavButton>
          </nav>
        </aside>
        <main className="flex-1 min-w-0">
          {tab === 'dashboard' && <AdminDashboard />}
          {tab === 'customers' && <AdminCustomers />}
          {tab === 'drivers' && <AdminDrivers />}
          {tab === 'orders' && <AdminOrders />}
          {tab === 'pricing' && <AdminPricing />}
        </main>
      </div>
    </div>
  )
}

function NavButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors whitespace-nowrap ${
        active ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
      }`}
    >
      {icon}
      <span>{children}</span>
    </button>
  )
}

// ============================================================
// Dashboard
// ============================================================
function AdminDashboard() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const refresh = async () => {
    setLoading(true)
    try { setData(await AdminApi.dashboard()) } finally { setLoading(false) }
  }
  useEffect(() => { refresh() }, [])

  if (loading || !data) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Button variant="outline" size="sm" onClick={refresh}><RefreshCw className="h-4 w-4 mr-1" /> Refresh</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Total customers" value={data.totalCustomers} icon={<Users className="h-5 w-5" />} />
        <KpiCard label="Total drivers" value={data.totalDrivers} icon={<Car className="h-5 w-5" />} />
        <KpiCard label="Online drivers" value={data.onlineDrivers} icon={<Car className="h-5 w-5 text-emerald-500" />} />
        <KpiCard label="Pending drivers" value={data.pendingDrivers} icon={<Clock className="h-5 w-5 text-amber-500" />} />
        <KpiCard label="Active rides" value={data.activeRides} icon={<Car className="h-5 w-5" />} />
        <KpiCard label="Active deliveries" value={data.activeDeliveries} icon={<Bike className="h-5 w-5" />} />
        <KpiCard label="Active cargo" value={data.activeCargo} icon={<Truck className="h-5 w-5" />} />
        <KpiCard label="Completed" value={data.completedOrders} icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />} />
        <KpiCard label="Cancelled" value={data.cancelledOrders} icon={<XCircle className="h-5 w-5 text-red-500" />} />
        <KpiCard label="Pending quotations" value={data.pendingQuotations} icon={<FileText className="h-5 w-5 text-amber-500" />} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Financial summary</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Row label="Gross transaction value" value={formatCurrency(data.grossTxnValue)} />
            <Row label="Platform revenue" value={formatCurrency(data.platformRevenue)} highlight />
            <Row label="Driver payouts (credits)" value={formatCurrency(data.driverPayouts)} />
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Service performance</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground text-left border-b">
                  <th className="py-2">Service</th>
                  <th className="text-right">Active</th>
                  <th className="text-right">Completed</th>
                  <th className="text-right">Cancelled</th>
                  <th className="text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {data.servicePerformance.map((s: any) => (
                  <tr key={s.serviceId} className="border-b last:border-0">
                    <td className="py-2 font-medium">{s.name}</td>
                    <td className="text-right">{s.active}</td>
                    <td className="text-right">{s.completed}</td>
                    <td className="text-right">{s.cancelled}</td>
                    <td className="text-right font-medium">{formatCurrency(s.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Recent orders</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground text-left border-b">
                  <th className="py-2">Code</th>
                  <th>Service</th>
                  <th>Customer</th>
                  <th>Driver</th>
                  <th>Status</th>
                  <th className="text-right">Fare</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {data.recentOrders.map((o: any) => (
                  <tr key={o.id} className="border-b last:border-0">
                    <td className="py-2 font-medium">{o.code}</td>
                    <td><Badge variant="outline">{SERVICE_TYPE_LABELS[o.serviceType] || o.serviceType}</Badge></td>
                    <td>{o.customer}</td>
                    <td>{o.driver || '—'}</td>
                    <td><Badge className={statusColor(o.status)}>{ORDER_STATUS_LABELS[o.status] || o.status}</Badge></td>
                    <td className="text-right font-medium">{formatCurrency(o.finalFare || o.estimatedFare)}</td>
                    <td className="text-xs text-muted-foreground">{formatDateTime(o.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function KpiCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold">{value.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
          </div>
          {icon}
        </div>
      </CardContent>
    </Card>
  )
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={highlight ? 'font-bold text-primary' : 'font-medium'}>{value}</span>
    </div>
  )
}

// ============================================================
// Customers
// ============================================================
function AdminCustomers() {
  const [search, setSearch] = useState('')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    setLoading(true)
    try { setData(await AdminApi.customers(search, 1, 50)) } finally { setLoading(false) }
  }
  useEffect(() => {
    const t = setTimeout(refresh, 250)
    return () => clearTimeout(t)
  }, [search])

  const setStatus = async (id: string, status: string) => {
    try {
      await AdminApi.setCustomerStatus(id, status)
      toast.success(`Customer ${status === 'ACTIVE' ? 'reactivated' : 'suspended'}.`)
      refresh()
    } catch (err: any) {
      toast.error('Failed', { description: err?.error })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Customers</h1>
        <div className="relative w-64">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6"><Skeleton className="h-20" /></div>
          ) : data?.customers?.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No customers found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground text-left border-b">
                    <th className="p-3">Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Orders</th>
                    <th>Status</th>
                    <th>Joined</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.customers?.map((c: any) => (
                    <tr key={c.id} className="border-b last:border-0 hover:bg-accent/50">
                      <td className="p-3 font-medium">{c.fullName}</td>
                      <td>{c.email}</td>
                      <td>{c.phone || '—'}</td>
                      <td>{c.orderCount} ({c.completedCount} done)</td>
                      <td><Badge variant="outline">{c.status}</Badge></td>
                      <td className="text-xs text-muted-foreground">{formatDate(c.createdAt)}</td>
                      <td>
                        {c.status === 'ACTIVE' ? (
                          <Button size="sm" variant="ghost" onClick={() => setStatus(c.id, 'SUSPENDED')}>Suspend</Button>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={() => setStatus(c.id, 'ACTIVE')}>Reactivate</Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================
// Drivers
// ============================================================
function AdminDrivers() {
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [rejectingDriver, setRejectingDriver] = useState<any>(null)

  const refresh = async () => {
    setLoading(true)
    try { setData(await AdminApi.drivers(statusFilter === 'ALL' ? undefined : statusFilter, 1, 50)) } finally { setLoading(false) }
  }
  useEffect(() => { refresh() }, [statusFilter])

  const approve = async (id: string) => {
    try {
      await AdminApi.approveDriver(id)
      toast.success('Driver approved.')
      refresh()
    } catch (err: any) {
      toast.error('Failed', { description: err?.error })
    }
  }
  const reject = async (id: string, reason: string) => {
    try {
      await AdminApi.rejectDriver(id, reason)
      toast.success('Driver rejected.')
      setRejectingDriver(null)
      refresh()
    } catch (err: any) {
      toast.error('Failed', { description: err?.error })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Drivers</h1>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
            <SelectItem value="SUSPENDED">Suspended</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6"><Skeleton className="h-20" /></div>
          ) : data?.drivers?.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No drivers found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground text-left border-b">
                    <th className="p-3">Name</th>
                    <th>Email</th>
                    <th>License</th>
                    <th>Rating</th>
                    <th>Completed</th>
                    <th>Vehicles</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.drivers?.map((d: any) => (
                    <tr key={d.id} className="border-b last:border-0 hover:bg-accent/50">
                      <td className="p-3 font-medium">{d.user.fullName}</td>
                      <td>{d.user.email}</td>
                      <td className="font-mono text-xs">{d.licenseNumber}<br />
                        <span className="text-muted-foreground">exp {formatDate(d.licenseExpiry)}</span>
                      </td>
                      <td><span className="inline-flex items-center gap-1"><Star className="h-3 w-3 fill-amber-500 text-amber-500" />{d.rating?.toFixed(1)}</span></td>
                      <td>{d.totalCompleted}</td>
                      <td className="text-xs">
                        {d.vehicles?.map((v: any) => (
                          <div key={v.id}>{v.plateNumber} ({v.make} {v.model}) <Badge variant="outline" className="text-xs">{v.status}</Badge></div>
                        )) || '—'}
                      </td>
                      <td><Badge variant="outline" className={statusColor(d.status === 'APPROVED' ? 'COMPLETED' : d.status === 'PENDING' ? 'QUOTATION_REQUESTED' : 'CANCELLED_BY_SYSTEM')}>{DRIVER_STATUS_LABELS[d.status] || d.status}</Badge></td>
                      <td>
                        {d.status === 'PENDING' && (
                          <div className="flex gap-1">
                            <Button size="sm" onClick={() => approve(d.id)}>Approve</Button>
                            <Button size="sm" variant="outline" onClick={() => setRejectingDriver(d)}>Reject</Button>
                          </div>
                        )}
                        {d.status === 'APPROVED' && (
                          <Button size="sm" variant="ghost" onClick={() => reject(d.id, 'Administrative action')}>Suspend</Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      {rejectingDriver && (
        <Dialog open onOpenChange={() => setRejectingDriver(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject driver application</DialogTitle>
              <DialogDescription>Provide a reason for rejecting {rejectingDriver.user.fullName}.</DialogDescription>
            </DialogHeader>
            <RejectForm onSubmit={(reason) => reject(rejectingDriver.id, reason)} onCancel={() => setRejectingDriver(null)} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

function RejectForm({ onSubmit, onCancel }: { onSubmit: (reason: string) => void; onCancel: () => void }) {
  const [reason, setReason] = useState('')
  return (
    <>
      <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for rejection" />
      <DialogFooter>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button variant="destructive" onClick={() => onSubmit(reason || 'Application rejected')}>Reject</Button>
      </DialogFooter>
    </>
  )
}

// ============================================================
// Orders
// ============================================================
function AdminOrders() {
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [typeFilter, setTypeFilter] = useState<string>('ALL')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState<any>(null)
  const [quotationAmount, setQuotationAmount] = useState<number>(0)
  const [quotationDialog, setQuotationDialog] = useState<any>(null)

  const refresh = async () => {
    setLoading(true)
    try { setData(await AdminApi.orders(statusFilter === 'ALL' ? undefined : statusFilter, typeFilter === 'ALL' ? undefined : typeFilter, 1, 50)) } finally { setLoading(false) }
  }
  useEffect(() => { refresh() }, [statusFilter, typeFilter])

  const setStatus = async (id: string, status: string) => {
    try {
      await AdminApi.setOrderStatus(id, status)
      toast.success('Order status updated.')
      refresh()
    } catch (err: any) {
      toast.error('Failed', { description: err?.error })
    }
  }

  const approveQuotation = async (orderId: string, amount: number) => {
    try {
      const { OrderApi } = await import('@/lib/api-client')
      await OrderApi.quotation(orderId, 'approve', amount)
      toast.success('Quotation approved & dispatching…')
      setQuotationDialog(null)
      refresh()
    } catch (err: any) {
      toast.error('Failed', { description: err?.error })
    }
  }
  const rejectQuotation = async (orderId: string) => {
    try {
      const { OrderApi } = await import('@/lib/api-client')
      await OrderApi.quotation(orderId, 'reject')
      toast.success('Quotation rejected.')
      setQuotationDialog(null)
      refresh()
    } catch (err: any) {
      toast.error('Failed', { description: err?.error })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Orders</h1>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="All statuses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              <SelectItem value="REQUESTED">Requested</SelectItem>
              <SelectItem value="SEARCHING">Searching</SelectItem>
              <SelectItem value="DRIVER_ASSIGNED">Driver assigned</SelectItem>
              <SelectItem value="IN_PROGRESS">In progress</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
              <SelectItem value="QUOTATION_REQUESTED">Quotation pending</SelectItem>
              <SelectItem value="CANCELLED_BY_CUSTOMER">Cancelled (customer)</SelectItem>
              <SelectItem value="CANCELLED_BY_DRIVER">Cancelled (driver)</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="All services" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              <SelectItem value="RIDE">Car rides</SelectItem>
              <SelectItem value="MOTORCYCLE_RIDE">Moto rides</SelectItem>
              <SelectItem value="PACKAGE_DELIVERY">Package</SelectItem>
              <SelectItem value="CARGO">Cargo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6"><Skeleton className="h-20" /></div>
          ) : data?.orders?.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No orders found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground text-left border-b">
                    <th className="p-3">Code</th>
                    <th>Type</th>
                    <th>Customer</th>
                    <th>Driver</th>
                    <th>From → To</th>
                    <th className="text-right">Fare</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.orders?.map((o: any) => (
                    <tr key={o.id} className="border-b last:border-0 hover:bg-accent/50 cursor-pointer" onClick={() => setSelectedOrder(o)}>
                      <td className="p-3 font-medium">{o.code}</td>
                      <td><Badge variant="outline">{SERVICE_TYPE_LABELS[o.serviceType] || o.serviceType}</Badge></td>
                      <td>{o.customer?.fullName}</td>
                      <td>{o.driver?.user?.fullName || '—'}</td>
                      <td className="text-xs max-w-xs truncate">{o.pickupAddress} → {o.destinationAddress}</td>
                      <td className="text-right font-medium">{formatCurrency(o.finalFare || o.estimatedFare, o.currency)}</td>
                      <td><Badge className={statusColor(o.status)}>{ORDER_STATUS_LABELS[o.status] || o.status}</Badge></td>
                      <td className="text-xs text-muted-foreground">{formatDateTime(o.createdAt)}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        {o.status === 'QUOTATION_REQUESTED' && (
                          <Button size="sm" onClick={() => { setQuotationDialog(o); setQuotationAmount(o.estimatedFare) }}>Review quotation</Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order details */}
      {selectedOrder && (
        <Dialog open onOpenChange={() => setSelectedOrder(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Order {selectedOrder.code}</DialogTitle>
              <DialogDescription>{SERVICE_TYPE_LABELS[selectedOrder.serviceType] || selectedOrder.serviceType} · {formatDateTime(selectedOrder.createdAt)}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <Detail label="Customer" value={selectedOrder.customer?.fullName} />
                <Detail label="Driver" value={selectedOrder.driver?.user?.fullName || '—'} />
                <Detail label="Pickup" value={selectedOrder.pickupAddress} />
                <Detail label="Destination" value={selectedOrder.destinationAddress} />
                <Detail label="Distance" value={`${(selectedOrder.distanceKm || 0).toFixed(1)} km`} />
                <Detail label="Duration" value={`${Math.round(selectedOrder.durationMinutes || 0)} min`} />
                <Detail label="Estimated fare" value={formatCurrency(selectedOrder.estimatedFare, selectedOrder.currency)} />
                <Detail label="Final fare" value={selectedOrder.finalFare ? formatCurrency(selectedOrder.finalFare, selectedOrder.currency) : '—'} />
                <Detail label="Payment method" value={selectedOrder.paymentMethod} />
                <Detail label="Payment status" value={selectedOrder.paymentStatus} />
              </div>
              {selectedOrder.events?.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground">Event history</Label>
                  <div className="mt-1 max-h-40 overflow-y-auto border rounded-md p-2 scroll-thin space-y-1">
                    {selectedOrder.events.map((e: any) => (
                      <div key={e.id} className="text-xs flex justify-between">
                        <span><Badge variant="outline" className="text-xs">{e.eventType}</Badge> by {e.actorType}</span>
                        <span className="text-muted-foreground">{formatDateTime(e.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-2 pt-3 border-t">
                {!selectedOrder.status.startsWith('CANCELLED') && selectedOrder.status !== 'COMPLETED' && (
                  <Button variant="destructive" size="sm" onClick={() => setStatus(selectedOrder.id, 'CANCELLED_BY_SYSTEM')}>
                    Cancel order
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Quotation dialog */}
      {quotationDialog && (
        <Dialog open onOpenChange={() => setQuotationDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Review quotation · {quotationDialog.code}</DialogTitle>
              <DialogDescription>
                Cargo request from {quotationDialog.customer?.fullName}. Adjust the approved amount if needed.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="text-sm">
                <div><span className="text-muted-foreground">Pickup:</span> {quotationDialog.pickupAddress}</div>
                <div><span className="text-muted-foreground">Destination:</span> {quotationDialog.destinationAddress}</div>
                <div><span className="text-muted-foreground">Distance:</span> {(quotationDialog.distanceKm || 0).toFixed(1)} km</div>
                <div><span className="text-muted-foreground">Estimated fare:</span> {formatCurrency(quotationDialog.estimatedFare, quotationDialog.currency)}</div>
              </div>
              <div>
                <Label>Approved quotation amount</Label>
                <Input type="number" value={quotationAmount} onChange={(e) => setQuotationAmount(Number(e.target.value))} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="destructive" onClick={() => rejectQuotation(quotationDialog.id)}>Reject</Button>
              <Button onClick={() => approveQuotation(quotationDialog.id, quotationAmount)}>Approve & dispatch</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  )
}

// ============================================================
// Pricing Configuration
// ============================================================
function AdminPricing() {
  const [configs, setConfigs] = useState<any[]>([])
  const [services, setServices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<any>(null)

  const refresh = async () => {
    setLoading(true)
    try {
      const [pricing, svc] = await Promise.all([AdminApi.pricing.list(), ServiceApi.list()])
      setConfigs(pricing.configs)
      setServices(svc.services)
    } finally { setLoading(false) }
  }
  useEffect(() => { refresh() }, [])

  const saveConfig = async (config: any) => {
    try {
      await AdminApi.pricing.update({
        serviceCategoryId: config.serviceCategoryId,
        vehicleCategoryId: config.vehicleCategoryId,
        config: config.config,
      })
      toast.success('Pricing updated. New version created.')
      setEditing(null)
      refresh()
    } catch (err: any) {
      toast.error('Failed', { description: err?.error })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pricing configuration</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        All pricing changes are versioned. Updating creates a new version; the previous version is preserved for historical invoicing.
      </p>
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6"><Skeleton className="h-20" /></div>
          ) : (
            <div className="divide-y">
              {configs.map((c) => (
                <div key={c.id} className="p-4 flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline">{c.serviceCategory.name}</Badge>
                      {c.vehicleCategory && <Badge variant="secondary">{c.vehicleCategory.name}</Badge>}
                      <Badge variant="outline">v{c.version}</Badge>
                      {c.isActive && <Badge className={statusColor('COMPLETED')}>Active</Badge>}
                    </div>
                    <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 text-xs">
                      {Object.entries(c.config).filter(([k]) => k !== 'commissionRate').map(([k, v]: any) => (
                        <div key={k} className="flex justify-between">
                          <span className="text-muted-foreground">{k}:</span>
                          <span className="font-mono">{typeof v === 'number' ? v.toLocaleString() : String(v)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setEditing(c)}>Edit</Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      {editing && (
        <Dialog open onOpenChange={() => setEditing(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit pricing · {editing.serviceCategory.name}{editing.vehicleCategory ? ` / ${editing.vehicleCategory.name}` : ''}</DialogTitle>
              <DialogDescription>Current version: v{editing.version}. Saving creates a new version.</DialogDescription>
            </DialogHeader>
            <PricingEditForm config={editing} onSave={saveConfig} onCancel={() => setEditing(null)} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

function PricingEditForm({ config, onSave, onCancel }: {
  config: any
  onSave: (c: any) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState<any>({ ...config.config })
  const fields = Object.keys(draft)
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        {fields.map((k) => (
          <div key={k}>
            <Label className="text-xs font-mono">{k}</Label>
            <Input
              type="number"
              step="0.01"
              value={draft[k]}
              onChange={(e) => setDraft({ ...draft, [k]: Number(e.target.value) })}
            />
          </div>
        ))}
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSave({ ...config, config: draft })}>Save new version</Button>
      </DialogFooter>
    </>
  )
}
