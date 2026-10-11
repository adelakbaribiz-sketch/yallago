import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET() {
  // List online approved drivers (used by admin / customer to see who's online)
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const onlineDrivers = await db.driverLocation.findMany({
    where: { isOnline: true, lastSeenAt: { gt: new Date(Date.now() - 5 * 60_000) } },
    include: {
      driver: {
        include: {
          user: { select: { id: true, fullName: true, phone: true } },
          vehicles: true
        }
      }
    }
  })
  // Fetch service categories for vehicle lookup
  const serviceCategoryIds = [...new Set(onlineDrivers.flatMap(d => d.driver.vehicles.map(v => v.serviceCategoryId)))]
  const serviceCategories = serviceCategoryIds.length > 0
    ? await db.serviceCategory.findMany({ where: { id: { in: serviceCategoryIds } } })
    : []
  const scMap = new Map(serviceCategories.map(sc => [sc.id, sc]))
  return NextResponse.json({
    drivers: onlineDrivers.map(d => ({
      driverId: d.driverId,
      name: d.driver.user.fullName,
      phone: d.driver.user.phone,
      lat: d.latitude,
      lng: d.longitude,
      lastSeenAt: d.lastSeenAt,
      eligibleServices: JSON.parse(d.driver.eligibleServiceCategories || '[]'),
      vehicles: d.driver.vehicles.map(v => ({
        id: v.id,
        serviceCategory: scMap.get(v.serviceCategoryId)?.code || 'UNKNOWN',
        plateNumber: v.plateNumber,
        make: v.make,
        model: v.model,
      }))
    }))
  })
}
