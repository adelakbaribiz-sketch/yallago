import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { db } from '@/lib/db'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getSessionUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const driver = await db.driver.findUnique({ where: { id } })
  if (!driver) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  const updated = await db.driver.update({
    where: { id },
    data: {
      status: 'APPROVED',
      approvedAt: new Date(),
      approvedById: user.id,
      backgroundCheckStatus: 'PASSED',
    }
  })
  // Approve their pending vehicles
  await db.vehicle.updateMany({
    where: { driverId: id, status: 'PENDING' },
    data: { status: 'APPROVED' }
  })
  await db.auditLog.create({
    data: {
      actorId: user.id, actorType: 'ADMIN',
      action: 'DRIVER_APPROVED',
      resourceType: 'DRIVER', resourceId: id,
    }
  })
  return NextResponse.json({ driver: updated })
}
