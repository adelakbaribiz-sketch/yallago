import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { getDriverRequests } from '@/lib/dispatch'

export async function GET() {
  const user = await getSessionUser()
  if (!user || user.role !== 'DRIVER' || !user.driverId) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  }
  const driver = await (await import('@/lib/db')).db.driver.findUnique({ where: { id: user.driverId } })
  if (!driver || driver.status !== 'APPROVED') {
    return NextResponse.json({ error: 'DRIVER_NOT_APPROVED' }, { status: 403 })
  }
  const assignments = await getDriverRequests(user.driverId)
  return NextResponse.json({ requests: assignments })
}
