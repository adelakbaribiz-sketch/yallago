import { NextResponse } from 'next/server'
import { apiHandler } from '@/lib/api'
import { createOrder } from '@/lib/dispatch'
import { db } from '@/lib/db'

export const POST = apiHandler(async ({ user }, body) => {
  if (user.role !== 'CUSTOMER') {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  }
  const {
    serviceCategoryId,
    vehicleCategoryId,
    serviceType,
    pickup, destination,
    details,
    paymentMethod,
    scheduledFor,
    weightKg, helpers, needsLoading, needsUnloading,
    requiresQuotation,
  } = body
  if (!serviceCategoryId || !pickup || !destination || !serviceType) {
    return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  }
  const result = await createOrder({
    customerId: user.id,
    serviceCategoryId,
    vehicleCategoryId,
    serviceType,
    pickup,
    destination,
    details,
    paymentMethod,
    scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
    weightKg, helpers, needsLoading, needsUnloading,
    requiresQuotation,
  })
  return result
})

export const GET = apiHandler(async ({ user }) => {
  // Customer: their orders. Driver: orders assigned to them. Admin: all orders.
  let where: any = {}
  if (user.role === 'CUSTOMER') where.customerId = user.id
  else if (user.role === 'DRIVER') where.driverId = user.driverId
  // Admin: no filter

  const orders = await db.order.findMany({
    where,
    include: {
      serviceCategory: true,
      customer: { select: { id: true, fullName: true, email: true, phone: true } },
      driver: { include: { user: { select: { fullName: true, phone: true } }, vehicles: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  return { orders }
})
