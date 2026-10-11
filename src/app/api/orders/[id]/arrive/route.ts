import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { transitionOrder } from '@/lib/dispatch'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getSessionUser()
  if (!user || user.role !== 'DRIVER') return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const order = await db.order.findUnique({ where: { id } })
  if (!order) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  if (order.driverId !== user.driverId) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  // Transition to DRIVER_ARRIVING -> DRIVER_ARRIVED based on current status
  const target = order.status === 'DRIVER_ASSIGNED' ? 'DRIVER_ARRIVING' : 'DRIVER_ARRIVED'
  try {
    const result = await transitionOrder(id, target, { id: user.id, type: 'DRIVER' })
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
