import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET() {
  const user = await getSessionUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })

  const [
    totalCustomers,
    totalDrivers,
    onlineDriversCount,
    activeRides,
    activeDeliveries,
    activeCargo,
    completedOrders,
    cancelledOrders,
  ] = await Promise.all([
    db.user.count({ where: { role: 'CUSTOMER' } }),
    db.driver.count(),
    db.driverLocation.count({ where: { isOnline: true, lastSeenAt: { gt: new Date(Date.now() - 60_000) } } }),
    db.order.count({ where: { serviceType: 'RIDE', status: { in: ['REQUESTED', 'SEARCHING', 'DRIVER_ASSIGNED', 'DRIVER_ARRIVING', 'DRIVER_ARRIVED', 'IN_PROGRESS'] } } }),
    db.order.count({ where: { serviceType: { in: ['PACKAGE_DELIVERY', 'MOTORCYCLE_RIDE'] }, status: { in: ['REQUESTED', 'SEARCHING', 'DRIVER_ASSIGNED', 'DRIVER_ARRIVING', 'DRIVER_ARRIVED', 'IN_PROGRESS', 'IN_TRANSIT'] } } }),
    db.order.count({ where: { serviceType: 'CARGO', status: { in: ['QUOTATION_REQUESTED', 'QUOTATION_APPROVED', 'REQUESTED', 'SEARCHING', 'DRIVER_ASSIGNED', 'LOADING', 'IN_TRANSIT', 'UNLOADING'] } } }),
    db.order.count({ where: { status: 'COMPLETED' } }),
    db.order.count({ where: { status: { in: ['CANCELLED_BY_CUSTOMER', 'CANCELLED_BY_DRIVER', 'CANCELLED_BY_SYSTEM'] } } }),
  ])

  // Gross transaction value (sum of finalFare for completed)
  const completedAgg = await db.order.aggregate({
    where: { status: 'COMPLETED' },
    _sum: { finalFare: true, estimatedFare: true }
  })
  const grossTxnValue = completedAgg._sum.finalFare || completedAgg._sum.estimatedFare || 0

  // Platform revenue = total commissions
  const commissionAgg = await db.ledgerEntry.aggregate({
    where: { entryType: 'PLATFORM_COMMISSION' },
    _sum: { amount: true }
  })
  const platformRevenue = commissionAgg._sum.amount || 0

  // Driver payouts (mock — sum of driver credits)
  const driverCreditAgg = await db.ledgerEntry.aggregate({
    where: { entryType: 'DRIVER_CREDIT' },
    _sum: { amount: true }
  })
  const driverPayouts = driverCreditAgg._sum.amount || 0

  // Pending quotations
  const pendingQuotations = await db.order.count({
    where: { quotationStatus: 'REQUESTED' }
  })

  // Pending driver verifications
  const pendingDrivers = await db.driver.count({
    where: { status: 'PENDING' }
  })

  // Recent orders (last 10)
  const recentOrders = await db.order.findMany({
    include: {
      serviceCategory: true,
      customer: { select: { fullName: true } },
      driver: { include: { user: { select: { fullName: true } } } },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })

  // Service-category performance
  const services = await db.serviceCategory.findMany({ where: { isActive: true } })
  const servicePerformance = []
  for (const s of services) {
    const completed = await db.order.count({ where: { serviceCategoryId: s.id, status: 'COMPLETED' } })
    const cancelled = await db.order.count({ where: { serviceCategoryId: s.id, status: { in: ['CANCELLED_BY_CUSTOMER', 'CANCELLED_BY_DRIVER', 'CANCELLED_BY_SYSTEM'] } } })
    const active = await db.order.count({ where: { serviceCategoryId: s.id, status: { in: ['REQUESTED', 'SEARCHING', 'DRIVER_ASSIGNED', 'IN_PROGRESS', 'IN_TRANSIT', 'LOADING', 'UNLOADING'] } } })
    const revenueAgg = await db.order.aggregate({
      where: { serviceCategoryId: s.id, status: 'COMPLETED' },
      _sum: { finalFare: true, estimatedFare: true }
    })
    servicePerformance.push({
      serviceId: s.id, code: s.code, name: s.name,
      completed, cancelled, active,
      revenue: revenueAgg._sum.finalFare || revenueAgg._sum.estimatedFare || 0
    })
  }

  return NextResponse.json({
    totalCustomers,
    totalDrivers,
    onlineDrivers: onlineDriversCount,
    activeRides,
    activeDeliveries,
    activeCargo,
    completedOrders,
    cancelledOrders,
    grossTxnValue,
    platformRevenue,
    driverPayouts,
    pendingQuotations,
    pendingDrivers,
    servicePerformance,
    recentOrders: recentOrders.map(o => ({
      id: o.id, code: o.code, serviceType: o.serviceType, status: o.status,
      customer: o.customer?.fullName,
      driver: o.driver?.user.fullName,
      estimatedFare: o.estimatedFare,
      finalFare: o.finalFare,
      createdAt: o.createdAt,
    }))
  })
}
