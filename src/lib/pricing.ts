/**
 * Pricing Engine
 * Computes fare estimates for rides, deliveries, and cargo.
 * All pricing is calculated on the backend using the versioned
 * PricingConfiguration table.
 */
import { db } from '@/lib/db'

export type PriceBreakdown = {
  baseFare: number
  distanceCharge: number
  durationCharge: number
  bookingFee: number
  surcharges: number
  helpersFee: number
  loadingFee: number
  unloadingFee: number
  weightSurcharge: number
  scheduledServiceFee: number
  estimatedFare: number
  minFare: number
  finalEstimate: number
  currency: string
  configVersion: number
  breakdown: { label: string; amount: number }[]
}

export type PricingInput = {
  serviceCategoryId: string
  vehicleCategoryId?: string
  regionId?: string
  distanceKm: number
  durationMinutes: number
  // Cargo / delivery specific
  weightKg?: number
  helpers?: number
  needsLoading?: boolean
  needsUnloading?: boolean
  scheduled?: boolean
  // Motorcycle delivery
  packageDelivery?: boolean
  oversizedPackage?: boolean
}

const DEFAULT_CURRENCY = 'IRR'

export async function getPricingConfig(
  serviceCategoryId: string,
  vehicleCategoryId?: string,
  regionId?: string
) {
  // First try with the specific vehicleCategoryId
  if (vehicleCategoryId) {
    const specific = await db.pricingConfiguration.findFirst({
      where: {
        serviceCategoryId,
        vehicleCategoryId,
        isActive: true,
        effectiveFrom: { lte: new Date() },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }],
      },
      orderBy: { version: 'desc' },
    })
    if (specific) return specific
  }
  // Fallback: any active config for this service category (covers both
  // null-vehicleCategoryId configs and cases where the caller didn't pass one)
  return db.pricingConfiguration.findFirst({
    where: {
      serviceCategoryId,
      isActive: true,
      effectiveFrom: { lte: new Date() },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }],
    },
    orderBy: { version: 'desc' },
  })
}

export async function calculateFareEstimate(input: PricingInput): Promise<PriceBreakdown> {
  const config = await getPricingConfig(input.serviceCategoryId, input.vehicleCategoryId, input.regionId)
  if (!config) throw new Error('NO_PRICING_CONFIG')
  const cfg = JSON.parse(config.configJson) as Record<string, number>

  const baseFare = cfg.baseFare ?? 0
  const perKm = cfg.perKm ?? 0
  const perMinute = cfg.perMinute ?? 0
  const bookingFee = cfg.bookingFee ?? 0
  const minFare = cfg.minFare ?? 0

  const distanceCharge = Math.round(perKm * Math.max(0, input.distanceKm))
  const durationCharge = Math.round(perMinute * Math.max(0, input.durationMinutes))

  let surcharges = 0
  if (input.packageDelivery && cfg.packageDeliverySurcharge) {
    surcharges += cfg.packageDeliverySurcharge
  }
  if (input.oversizedPackage && cfg.oversizedPackageSurcharge) {
    surcharges += cfg.oversizedPackageSurcharge
  }

  const helpersFee = input.helpers
    ? Math.round((cfg.helperFeePerHour ?? 0) * input.helpers * 1)
    : 0
  const loadingFee = input.needsLoading ? (cfg.loadingFee ?? 0) : 0
  const unloadingFee = input.needsUnloading ? (cfg.unloadingFee ?? 0) : 0
  const weightSurcharge = input.weightKg
    ? Math.round((cfg.weightSurchargePerKg ?? 0) * input.weightKg)
    : 0
  const scheduledServiceFee = input.scheduled ? (cfg.scheduledServiceFee ?? 0) : 0

  const rawEstimate =
    baseFare + distanceCharge + durationCharge + bookingFee + surcharges +
    helpersFee + loadingFee + unloadingFee + weightSurcharge + scheduledServiceFee

  const estimatedFare = Math.max(minFare, rawEstimate)

  const breakdown: { label: string; amount: number }[] = [
    { label: 'Base fare', amount: baseFare },
    { label: `Distance (${input.distanceKm.toFixed(1)} km)`, amount: distanceCharge },
    { label: `Duration (${Math.round(input.durationMinutes)} min)`, amount: durationCharge },
    { label: 'Booking fee', amount: bookingFee },
  ]
  if (surcharges > 0) breakdown.push({ label: 'Surcharges', amount: surcharges })
  if (helpersFee > 0) breakdown.push({ label: `Helpers (${input.helpers})`, amount: helpersFee })
  if (loadingFee > 0) breakdown.push({ label: 'Loading fee', amount: loadingFee })
  if (unloadingFee > 0) breakdown.push({ label: 'Unloading fee', amount: unloadingFee })
  if (weightSurcharge > 0) breakdown.push({ label: `Weight surcharge (${input.weightKg}kg)`, amount: weightSurcharge })
  if (scheduledServiceFee > 0) breakdown.push({ label: 'Scheduled service fee', amount: scheduledServiceFee })

  return {
    baseFare,
    distanceCharge,
    durationCharge,
    bookingFee,
    surcharges,
    helpersFee,
    loadingFee,
    unloadingFee,
    weightSurcharge,
    scheduledServiceFee,
    estimatedFare,
    minFare,
    finalEstimate: estimatedFare,
    currency: DEFAULT_CURRENCY,
    configVersion: config.version,
    breakdown,
  }
}

export function getCommissionRate(cfg: Record<string, number>): number {
  return cfg.commissionRate ?? 0.2
}

/**
 * For completed orders, compute the driver earnings (fare - commission).
 */
export function computeDriverEarnings(fare: number, commissionRate: number): {
  commission: number
  driverNet: number
} {
  const commission = Math.round(fare * commissionRate)
  return {
    commission,
    driverNet: fare - commission,
  }
}
