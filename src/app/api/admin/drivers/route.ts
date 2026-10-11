import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(req: Request) {
  const user = await getSessionUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') || ''
  const page = parseInt(searchParams.get('page') || '1', 10)
  const pageSize = parseInt(searchParams.get('pageSize') || '20', 10)

  const where: any = {}
  if (status) where.status = status
  const [drivers, total] = await Promise.all([
    db.driver.findMany({
      where,
      include: {
        user: { select: { id: true, fullName: true, email: true, phone: true, status: true, createdAt: true } },
        vehicles: true
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.driver.count({ where })
  ])
  // Manually fetch service categories for vehicle lookups
  const serviceCategoryIds = [...new Set(drivers.flatMap(d => d.vehicles.map(v => v.serviceCategoryId)))]
  const serviceCategories = serviceCategoryIds.length > 0
    ? await db.serviceCategory.findMany({ where: { id: { in: serviceCategoryIds } } })
    : []
  const scMap = new Map(serviceCategories.map(sc => [sc.id, sc]))
  // Attach the service category to each vehicle
  drivers.forEach(d => {
    d.vehicles.forEach(v => {
      ;(v as any).serviceCategory = scMap.get(v.serviceCategoryId)
    })
  })
  const enriched = await Promise.all(drivers.map(async (d) => {
    const completedCount = await db.order.count({ where: { driverId: d.id, status: 'COMPLETED' } })
    return {
      id: d.id,
      status: d.status,
      rating: d.rating,
      totalRatings: d.totalRatings,
      totalCompleted: d.totalCompleted,
      licenseNumber: d.licenseNumber,
      licenseExpiry: d.licenseExpiry,
      backgroundCheckStatus: d.backgroundCheckStatus,
      createdAt: d.createdAt,
      approvedAt: d.approvedAt,
      user: d.user,
      vehicles: d.vehicles,
      completedCount,
    }
  }))
  return NextResponse.json({ drivers: enriched, total, page, pageSize })
}
