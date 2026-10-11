/**
 * Order & Dispatch Engine
 *
 * Implements:
 *  - Order creation (validates inputs, calculates fare estimate)
 *  - Driver matching (filter by eligibility, online status, region)
 *  - Atomic assignment (DB transactions to prevent duplicate assignment)
 *  - State machine validation (only legal transitions allowed)
 *  - Event recording (auditable OrderEvent trail)
 */
import { db } from '@/lib/db'
import { calculateFareEstimate, PricingInput } from '@/lib/pricing'
import { haversineKm, LatLng, estimateDurationMinutes } from '@/lib/geo'

const OFFER_TTL_SECONDS = 15
const DISPATCH_RADIUS_KM = 10

export type CreateOrderInput = {
  customerId: string
  serviceCategoryId: string
  vehicleCategoryId?: string
  serviceType: 'RIDE' | 'MOTORCYCLE_RIDE' | 'PACKAGE_DELIVERY' | 'CARGO'
  pickup: { lat: number; lng: number; address: string }
  destination: { lat: number; lng: number; address: string }
  details?: Record<string, unknown>
  paymentMethod?: 'CASH' | 'CARD' | 'WALLET' | 'INVOICE'
  scheduledFor?: Date | null
  requiresQuotation?: boolean
  weightKg?: number
  helpers?: number
  needsLoading?: boolean
  needsUnloading?: boolean
}

export async function generateOrderCode(): Promise<string> {
  const prefix = 'ORD'
  const n = Math.floor(Math.random() * 0xfffff).toString(36).toUpperCase().padStart(5, '0')
  const code = `${prefix}-${n}`
  const exists = await db.order.findUnique({ where: { code } })
  if (exists) return generateOrderCode()
  return code
}

/**
 * Create a new order with fare estimate, then trigger driver search.
 */
export async function createOrder(input: CreateOrderInput) {
  const distanceKm = haversineKm(input.pickup, input.destination)
  const durationMin = estimateDurationMinutes(distanceKm)

  const pricingInput: PricingInput = {
    serviceCategoryId: input.serviceCategoryId,
    vehicleCategoryId: input.vehicleCategoryId,
    distanceKm,
    durationMinutes: durationMin,
    weightKg: input.weightKg,
    helpers: input.helpers,
    needsLoading: input.needsLoading,
    needsUnloading: input.needsUnloading,
    scheduled: !!input.scheduledFor,
    packageDelivery: input.serviceType === 'PACKAGE_DELIVERY',
  }
  const estimate = await calculateFareEstimate(pricingInput)

  const serviceCat = await db.serviceCategory.findUnique({ where: { id: input.serviceCategoryId } })
  if (!serviceCat) throw new Error('INVALID_SERVICE_CATEGORY')

  const requiresQuotation = serviceCat.requiresQuotation || input.requiresQuotation

  const order = await db.order.create({
    data: {
      code: await generateOrderCode(),
      serviceCategoryId: input.serviceCategoryId,
      vehicleCategoryId: input.vehicleCategoryId,
      customerId: input.customerId,
      serviceType: input.serviceType,
      status: requiresQuotation ? 'QUOTATION_REQUESTED' : 'REQUESTED',
      pickupLat: input.pickup.lat,
      pickupLng: input.pickup.lng,
      pickupAddress: input.pickup.address,
      destinationLat: input.destination.lat,
      destinationLng: input.destination.lng,
      destinationAddress: input.destination.address,
      detailsJson: JSON.stringify(input.details ?? {}),
      estimatedFare: estimate.finalEstimate,
      currency: estimate.currency,
      distanceKm,
      durationMinutes: durationMin,
      pricingConfigVersion: estimate.configVersion,
      paymentMethod: input.paymentMethod ?? 'CASH',
      paymentStatus: 'PENDING',
      scheduledFor: input.scheduledFor,
      isImmediate: !input.scheduledFor,
      quotationStatus: requiresQuotation ? 'REQUESTED' : 'NOT_REQUIRED',
    },
  })

  await recordOrderEvent(order.id, {
    eventType: requiresQuotation ? 'QUOTATION_REQUESTED' : 'REQUESTED',
    fromStatus: null,
    toStatus: order.status,
    actorId: input.customerId,
    actorType: 'CUSTOMER',
    metadata: { estimate: estimate.finalEstimate, distanceKm },
  })

  // If quotation required, return without dispatching
  if (requiresQuotation) {
    return { order, estimate, dispatchResult: null as null | { offeredDrivers: number } }
  }

  // Trigger dispatch
  const dispatchResult = await dispatchOrder(order.id)
  return { order, estimate, dispatchResult }
}

/**
 * Dispatch an order: find eligible drivers, send offer to the closest one.
 * Returns the number of drivers offered (1 in this single-batch impl).
 */
export async function dispatchOrder(orderId: string): Promise<{ offeredDrivers: number; status: string }> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { serviceCategory: true }
  })
  if (!order) throw new Error('ORDER_NOT_FOUND')
  if (order.status !== 'REQUESTED') {
    return { offeredDrivers: 0, status: order.status }
  }

  // Mark as SEARCHING
  await db.order.update({ where: { id: orderId }, data: { status: 'SEARCHING' } })
  await recordOrderEvent(orderId, {
    eventType: 'SEARCHING',
    fromStatus: 'REQUESTED',
    toStatus: 'SEARCHING',
    actorId: null,
    actorType: 'SYSTEM',
  })

  const eligible = await findEligibleDrivers(order)
  if (eligible.length === 0) {
    await db.order.update({
      where: { id: orderId },
      data: { status: 'NO_DRIVER_AVAILABLE', cancelledAt: new Date(), cancelledBy: 'SYSTEM' },
    })
    await recordOrderEvent(orderId, {
      eventType: 'NO_DRIVER_AVAILABLE',
      fromStatus: 'SEARCHING',
      toStatus: 'NO_DRIVER_AVAILABLE',
      actorId: null,
      actorType: 'SYSTEM',
    })
    return { offeredDrivers: 0, status: 'NO_DRIVER_AVAILABLE' }
  }

  // Offer to the top candidate (closest). Multi-broadcast dispatch is
  // available via the WebSocket service when running in production.
  const top = eligible[0]
  await db.driverAssignment.create({
    data: {
      orderId,
      driverId: top.driverId,
      status: 'OFFERED',
      expiresAt: new Date(Date.now() + OFFER_TTL_SECONDS * 1000),
    }
  })
  await recordOrderEvent(orderId, {
    eventType: 'OFFER_SENT',
    fromStatus: 'SEARCHING',
    toStatus: 'SEARCHING',
    actorId: null,
    actorType: 'SYSTEM',
    metadata: { driverId: top.driverId, distanceKm: top.distanceKm },
  })

  return { offeredDrivers: 1, status: 'SEARCHING' }
}

type EligibleDriver = {
  driverId: string
  userId: string
  fullName: string
  distanceKm: number
  etaMinutes: number
  vehicleId: string
}

async function findEligibleDrivers(order: any): Promise<EligibleDriver[]> {
  // Find online approved drivers with an eligible vehicle.
  // The "lastSeenAt" cutoff is generous (5 min) to remain robust
  // even if the driver app's heartbeat is briefly interrupted.
  const onlineDrivers = await db.driverLocation.findMany({
    where: {
      isOnline: true,
      lastSeenAt: { gt: new Date(Date.now() - 5 * 60_000) },
    },
    include: {
      driver: {
        include: {
          user: true,
          vehicles: { where: { status: 'APPROVED' } },
        }
      }
    }
  })

  const pickup: LatLng = { lat: order.pickupLat, lng: order.pickupLng }
  const candidates: EligibleDriver[] = []

  for (const loc of onlineDrivers) {
    const driver = loc.driver
    if (!driver) continue
    if (driver.status !== 'APPROVED') continue
    // Eligibility: driver's eligibleServiceCategories must include the order's service category
    const eligibleCats: string[] = JSON.parse(driver.eligibleServiceCategories || '[]')
    if (!eligibleCats.includes(order.serviceCategoryId)) continue

    // Vehicle: must have an approved vehicle matching the service category
    const vehicle = driver.vehicles.find(v => v.serviceCategoryId === order.serviceCategoryId)
    if (!vehicle) continue
    if (order.vehicleCategoryId && vehicle.serviceCategoryId !== order.serviceCategoryId) continue

    const distance = haversineKm(pickup, { lat: loc.latitude, lng: loc.longitude })
    if (distance > DISPATCH_RADIUS_KM) continue

    candidates.push({
      driverId: driver.id,
      userId: driver.userId,
      fullName: driver.user.fullName,
      distanceKm: distance,
      etaMinutes: estimateDurationMinutes(distance),
      vehicleId: vehicle.id,
    })
  }

  // Sort by distance ascending (configurable ranking factor in production)
  candidates.sort((a, b) => a.distanceKm - b.distanceKm)
  return candidates
}

/**
 * Atomic driver acceptance. Uses a transaction + conditional update
 * to guarantee only one driver can accept a given order.
 */
export async function acceptOrderOffer(orderId: string, driverId: string): Promise<{ success: boolean; reason?: string; order?: any }> {
  return await db.$transaction(async (tx) => {
    // Lock the order row (SQLite doesn't support SELECT FOR UPDATE; rely on
    // the conditional update below for atomicity).
    const order = await tx.order.findUnique({ where: { id: orderId } })
    if (!order) return { success: false, reason: 'ORDER_NOT_FOUND' }
    if (order.status !== 'SEARCHING' && order.status !== 'REQUESTED') {
      return { success: false, reason: 'ORDER_NOT_DISPATCHABLE' }
    }
    if (order.driverId && order.driverId !== driverId) {
      return { success: false, reason: 'ALREADY_ASSIGNED' }
    }

    // Verify the driver has an OFFERED assignment that hasn't expired
    const assignment = await tx.driverAssignment.findFirst({
      where: {
        orderId,
        driverId,
        status: 'OFFERED',
        expiresAt: { gt: new Date() }
      }
    })
    if (!assignment) return { success: false, reason: 'NO_VALID_OFFER' }

    // Mark assignment ACCEPTED
    await tx.driverAssignment.update({
      where: { id: assignment.id },
      data: { status: 'ACCEPTED', respondedAt: new Date() }
    })

    // Cancel any other OFFERED assignments for this order
    await tx.driverAssignment.updateMany({
      where: { orderId, status: 'OFFERED', NOT: { id: assignment.id } },
      data: { status: 'CANCELLED', respondedAt: new Date() }
    })

    // Atomically assign the driver to the order — this is the critical
    // concurrency guard. The conditional update ensures that if two drivers
    // race to accept, only one wins.
    const updated = await tx.order.updateMany({
      where: { id: orderId, status: { in: ['REQUESTED', 'SEARCHING'] }, driverId: null },
      data: {
        driverId,
        status: 'DRIVER_ASSIGNED',
        assignedAt: new Date(),
      }
    })
    if (updated.count === 0) {
      // Someone else won the race — revert this assignment
      await tx.driverAssignment.update({
        where: { id: assignment.id },
        data: { status: 'REJECTED', respondedAt: new Date() }
      })
      return { success: false, reason: 'ALREADY_ASSIGNED' }
    }

    const finalOrder = await tx.order.findUnique({ where: { id: orderId } })
    await tx.orderEvent.create({
      data: {
        orderId,
        eventType: 'DRIVER_ASSIGNED',
        fromStatus: 'SEARCHING',
        toStatus: 'DRIVER_ASSIGNED',
        actorId: driverId,
        actorType: 'DRIVER',
      }
    })
    return { success: true, order: finalOrder }
  })
}

export async function rejectOrderOffer(orderId: string, driverId: string, reason?: string): Promise<void> {
  await db.driverAssignment.updateMany({
    where: { orderId, driverId, status: 'OFFERED' },
    data: { status: 'REJECTED', respondedAt: new Date(), rejectionReason: reason }
  })
  // Re-dispatch to find another driver
  await dispatchOrder(orderId).catch(() => {})
}

/**
 * State machine: allowed transitions per current status.
 */
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  REQUESTED: ['SEARCHING', 'CANCELLED_BY_CUSTOMER', 'CANCELLED_BY_SYSTEM', 'EXPIRED'],
  SEARCHING: ['DRIVER_ASSIGNED', 'NO_DRIVER_AVAILABLE', 'CANCELLED_BY_CUSTOMER', 'CANCELLED_BY_SYSTEM'],
  DRIVER_ASSIGNED: ['DRIVER_ARRIVING', 'CANCELLED_BY_CUSTOMER', 'CANCELLED_BY_DRIVER'],
  DRIVER_ARRIVING: ['DRIVER_ARRIVED', 'CANCELLED_BY_CUSTOMER', 'CANCELLED_BY_DRIVER'],
  DRIVER_ARRIVED: ['IN_PROGRESS', 'IN_TRANSIT', 'LOADING', 'CANCELLED_BY_CUSTOMER', 'CANCELLED_BY_DRIVER'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED_BY_DRIVER'],
  LOADING: ['IN_TRANSIT', 'CANCELLED_BY_DRIVER'],
  IN_TRANSIT: ['UNLOADING', 'COMPLETED', 'CANCELLED_BY_DRIVER'],
  UNLOADING: ['COMPLETED'],
  QUOTATION_REQUESTED: ['QUOTATION_APPROVED', 'CANCELLED_BY_CUSTOMER'],
  QUOTATION_APPROVED: ['SEARCHING', 'CANCELLED_BY_CUSTOMER'],
}

export function canTransition(from: string, to: string): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false
}

export async function transitionOrder(
  orderId: string,
  toStatus: string,
  actor: { id: string; type: 'CUSTOMER' | 'DRIVER' | 'ADMIN' | 'SYSTEM' }
): Promise<{ order: any; event: any }> {
  return await db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId } })
    if (!order) throw new Error('ORDER_NOT_FOUND')
    if (!canTransition(order.status, toStatus)) {
      throw new Error(`INVALID_TRANSITION:${order.status}->${toStatus}`)
    }
    const updateData: Record<string, unknown> = { status: toStatus }
    const now = new Date()
    switch (toStatus) {
      case 'DRIVER_ARRIVING':
        updateData.assignedAt = order.assignedAt ?? now
        break
      case 'DRIVER_ARRIVED':
        updateData.driverArrivedAt = now
        break
      case 'IN_PROGRESS':
      case 'IN_TRANSIT':
        updateData.startedAt = now
        break
      case 'COMPLETED':
        updateData.completedAt = now
        updateData.finalFare = order.estimatedFare
        updateData.paymentStatus = order.paymentMethod === 'CASH' ? 'PENDING' : 'CAPTURED'
        break
      case 'CANCELLED_BY_CUSTOMER':
      case 'CANCELLED_BY_DRIVER':
      case 'CANCELLED_BY_SYSTEM':
        updateData.cancelledAt = now
        updateData.cancelledBy = actor.type === 'CUSTOMER' ? 'CUSTOMER' : actor.type === 'DRIVER' ? 'DRIVER' : 'SYSTEM'
        break
    }
    const updated = await tx.order.update({ where: { id: orderId }, data: updateData })
    const event = await tx.orderEvent.create({
      data: {
        orderId,
        eventType: toStatus,
        fromStatus: order.status,
        toStatus,
        actorId: actor.id,
        actorType: actor.type,
      }
    })
    return { order: updated, event }
  })
}

export async function recordOrderEvent(
  orderId: string,
  event: {
    eventType: string
    fromStatus: string | null
    toStatus: string
    actorId: string | null
    actorType: 'CUSTOMER' | 'DRIVER' | 'ADMIN' | 'SYSTEM'
    metadata?: Record<string, unknown>
  }
) {
  return db.orderEvent.create({
    data: {
      orderId,
      eventType: event.eventType,
      fromStatus: event.fromStatus,
      toStatus: event.toStatus,
      actorId: event.actorId,
      actorType: event.actorType,
      metadataJson: event.metadata ? JSON.stringify(event.metadata) : null,
    }
  })
}

/**
 * Get pending incoming requests for a driver: any order they have
 * an OFFERED assignment for, plus their active assignment.
 */
export async function getDriverRequests(driverId: string) {
  const assignments = await db.driverAssignment.findMany({
    where: {
      driverId,
      status: { in: ['OFFERED', 'ACCEPTED'] }
    },
    include: { order: { include: { serviceCategory: true, customer: true } } },
    orderBy: { offeredAt: 'desc' }
  })
  return assignments
}
