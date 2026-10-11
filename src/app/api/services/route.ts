import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const services = await db.serviceCategory.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    include: {
      vehicleCategories: {
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' }
      }
    }
  })
  const regions = await db.serviceRegion.findMany({ where: { isActive: true } })
  return NextResponse.json({ services, regions })
}
