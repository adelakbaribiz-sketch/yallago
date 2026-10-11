import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(req: Request) {
  const user = await getSessionUser()
  if (!user || user.role !== 'DRIVER' || !user.driverId) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  }
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from') ? new Date(searchParams.get('from')!) : new Date(Date.now() - 30 * 24 * 3600 * 1000)
  const to = searchParams.get('to') ? new Date(searchParams.get('to')!) : new Date()

  // Completed orders in date range
  const orders = await db.order.findMany({
    where: {
      driverId: user.driverId,
      status: 'COMPLETED',
      completedAt: { gte: from, lte: to }
    },
    orderBy: { completedAt: 'desc' }
  })
  const grossFares = orders.reduce((s, o) => s + (o.finalFare || o.estimatedFare || 0), 0)

  // Ledger entries (use the driver's userId, not driverId, since LedgerEntry.userId FKs to User.id)
  const ledger = await db.ledgerEntry.findMany({
    where: {
      userId: user.id,
      createdAt: { gte: from, lte: to }
    },
    orderBy: { createdAt: 'desc' }
  })
  const commission = ledger.filter(l => l.entryType === 'PLATFORM_COMMISSION')
    .reduce((s, l) => s + l.amount, 0)
  const driverNet = ledger.filter(l => l.entryType === 'DRIVER_CREDIT')
    .reduce((s, l) => s + l.amount, 0)
  const adjustments = ledger.filter(l => l.entryType === 'ADJUSTMENT')
    .reduce((s, l) => s + l.amount, 0)
  const refunds = ledger.filter(l => l.entryType === 'REFUND')
    .reduce((s, l) => s + Math.abs(l.amount), 0)

  // Pending payouts (not implemented as records yet, just show 0)
  const pendingPayouts = 0
  const completedPayouts = 0

  return NextResponse.json({
    period: { from: from.toISOString(), to: to.toISOString() },
    completedJobs: orders.length,
    grossFares,
    commission,
    adjustments,
    refunds,
    netEarnings: driverNet + adjustments - refunds,
    pendingPayouts,
    completedPayouts,
    currency: orders[0]?.currency || 'IRR',
    recentOrders: orders.slice(0, 20).map(o => ({
      id: o.id, code: o.code, completedAt: o.completedAt,
      finalFare: o.finalFare || o.estimatedFare,
      currency: o.currency,
      serviceType: o.serviceType,
    }))
  })
}
