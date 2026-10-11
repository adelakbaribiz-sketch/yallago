import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { db } from '@/lib/db'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getSessionUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const driver = await db.driver.findUnique({ where: { id } })
  if (!driver) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  const updated = await db.driver.update({
    where: { id },
    data: {
      status: body.action === 'suspend' ? 'SUSPENDED' : 'REJECTED',
      rejectionReason: body.reason || null,
    }
  })
  await db.auditLog.create({
    data: {
      actorId: user.id, actorType: 'ADMIN',
      action: body.action === 'suspend' ? 'DRIVER_SUSPENDED' : 'DRIVER_REJECTED',
      resourceType: 'DRIVER', resourceId: id,
      metadataJson: JSON.stringify({ reason: body.reason })
    }
  })
  return NextResponse.json({ driver: updated })
}
