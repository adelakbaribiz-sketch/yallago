import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET() {
  const user = await getSessionUser()
  if (!user || user.role !== 'DRIVER' || !user.driverId) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  }
  const loc = await db.driverLocation.findFirst({
    where: { driverId: user.driverId },
    orderBy: { createdAt: 'desc' }
  })
  return NextResponse.json({
    isOnline: loc?.isOnline ?? false,
    lastSeenAt: loc?.lastSeenAt,
    location: loc ? { lat: loc.latitude, lng: loc.longitude } : null
  })
}

export async function PATCH(req: Request) {
  const user = await getSessionUser()
  if (!user || user.role !== 'DRIVER' || !user.driverId) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  }
  const body = await req.json().catch(() => ({}))
  const { isOnline, latitude, longitude } = body

  const driver = await db.driver.findUnique({ where: { id: user.driverId } })
  if (!driver) return NextResponse.json({ error: 'DRIVER_NOT_FOUND' }, { status: 404 })
  if (driver.status !== 'APPROVED') {
    return NextResponse.json({ error: 'DRIVER_NOT_APPROVED' }, { status: 403 })
  }

  const existing = await db.driverLocation.findFirst({
    where: { driverId: user.driverId },
    orderBy: { createdAt: 'desc' }
  })
  const newOnline = isOnline ?? !existing?.isOnline ?? true
  const newLat = latitude ?? existing?.latitude ?? 35.7150
  const newLng = longitude ?? existing?.longitude ?? 51.4050

  if (existing) {
    await db.driverLocation.update({
      where: { id: existing.id },
      data: {
        isOnline: newOnline,
        latitude: newLat,
        longitude: newLng,
        lastSeenAt: new Date(),
      }
    })
  } else {
    await db.driverLocation.create({
      data: {
        driverId: user.driverId,
        isOnline: newOnline,
        latitude: newLat,
        longitude: newLng,
        lastSeenAt: new Date(),
      }
    })
  }
  return NextResponse.json({ isOnline: newOnline, location: { lat: newLat, lng: newLng } })
}
