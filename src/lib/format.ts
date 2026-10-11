/**
 * Shared formatting helpers used by all three UIs.
 */

export function formatCurrency(amount: number | null | undefined, currency = 'IRR'): string {
  if (amount == null) return '—'
  if (currency === 'IRR') {
    // Iranian Rial — no decimals, with thousands separator
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.round(amount)) + ' IRR'
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
}

export function formatDateTime(d: string | Date | null | undefined): string {
  if (!d) return '—'
  const date = typeof d === 'string' ? new Date(d) : d
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  }).format(date)
}

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return '—'
  const date = typeof d === 'string' ? new Date(d) : d
  return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(date)
}

export function formatTime(d: string | Date | null | undefined): string {
  if (!d) return '—'
  const date = typeof d === 'string' ? new Date(d) : d
  return new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit' }).format(date)
}

export function timeAgo(d: string | Date | null | undefined): string {
  if (!d) return 'never'
  const date = typeof d === 'string' ? new Date(d) : d
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

export const ORDER_STATUS_LABELS: Record<string, string> = {
  REQUESTED: 'Requested',
  SEARCHING: 'Searching',
  DRIVER_ASSIGNED: 'Driver assigned',
  DRIVER_ARRIVING: 'Driver arriving',
  DRIVER_ARRIVED: 'Driver arrived',
  IN_PROGRESS: 'In progress',
  LOADING: 'Loading',
  IN_TRANSIT: 'In transit',
  UNLOADING: 'Unloading',
  COMPLETED: 'Completed',
  CANCELLED_BY_CUSTOMER: 'Cancelled by customer',
  CANCELLED_BY_DRIVER: 'Cancelled by driver',
  CANCELLED_BY_SYSTEM: 'Cancelled by system',
  NO_DRIVER_AVAILABLE: 'No driver available',
  EXPIRED: 'Expired',
  QUOTATION_REQUESTED: 'Quotation requested',
  QUOTATION_APPROVED: 'Quotation approved',
  DELIVERY_FAILED: 'Delivery failed',
}

export const SERVICE_TYPE_LABELS: Record<string, string> = {
  RIDE: 'Car ride',
  MOTORCYCLE_RIDE: 'Motorcycle ride',
  PACKAGE_DELIVERY: 'Package delivery',
  CARGO: 'Cargo',
}

export const DRIVER_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  SUSPENDED: 'Suspended',
}

export const VEHICLE_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
}

export function statusColor(status: string): string {
  if (status === 'COMPLETED') return 'bg-emerald-100 text-emerald-700'
  if (status.startsWith('CANCELLED') || status === 'EXPIRED' || status === 'NO_DRIVER_AVAILABLE' || status === 'DELIVERY_FAILED') return 'bg-red-100 text-red-700'
  if (status === 'QUOTATION_REQUESTED') return 'bg-amber-100 text-amber-700'
  if (status === 'QUOTATION_APPROVED') return 'bg-blue-100 text-blue-700'
  if (['DRIVER_ASSIGNED', 'DRIVER_ARRIVING', 'DRIVER_ARRIVED'].includes(status)) return 'bg-blue-100 text-blue-700'
  if (['IN_PROGRESS', 'IN_TRANSIT', 'LOADING', 'UNLOADING', 'SEARCHING', 'REQUESTED'].includes(status)) return 'bg-primary/10 text-primary'
  return 'bg-muted text-muted-foreground'
}
