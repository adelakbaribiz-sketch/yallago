import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { acceptOrderOffer } from '@/lib/dispatch'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getSessionUser()
  if (!user || user.role !== 'DRIVER' || !user.driverId) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  }
  // Verify driver is approved
  const driver = await db.driver.findUnique({ where: { id: user.driverId } })
  if (!driver || driver.status !== 'APPROVED') {
    return NextResponse.json({ error: 'DRIVER_NOT_APPROVED' }, { status: 403 })
  }
  const result = await acceptOrderOffer(id, user.driverId)
  if (!result.success) {
    return NextResponse.json({ error: result.reason }, { status: 409 })
  }
  return NextResponse.json(result)
}
