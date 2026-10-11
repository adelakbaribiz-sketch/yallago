import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { transitionOrder } from '@/lib/dispatch'
import { computeDriverEarnings } from '@/lib/pricing'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getSessionUser()
  if (!user || user.role !== 'DRIVER') return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const order = await db.order.findUnique({ where: { id } })
  if (!order) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  if (order.driverId !== user.driverId) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })

  // Determine target status for cargo (UNLOADING -> COMPLETED) vs others
  const target = order.status === 'IN_TRANSIT' && order.serviceType === 'CARGO' ? 'UNLOADING' : 'COMPLETED'

  try {
    const result = await transitionOrder(id, target, { id: user.id, type: 'DRIVER' })
    // If just completed, create financial ledger entries
    if (target === 'COMPLETED' && order.estimatedFare) {
      try {
        const config = await db.pricingConfiguration.findFirst({
          where: { serviceCategoryId: order.serviceCategoryId, isActive: true }
        })
        const cfg = config ? JSON.parse(config.configJson) : { commissionRate: 0.2 }
        const { commission, driverNet } = computeDriverEarnings(order.estimatedFare, cfg.commissionRate ?? 0.2)

        // Look up the driver's userId (LedgerEntry.userId references User.id, not Driver.id)
        const driver = order.driverId ? await db.driver.findUnique({ where: { id: order.driverId } }) : null
        const driverUserId = driver?.userId

        await db.ledgerEntry.create({
          data: {
            transactionRef: `TXN-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            orderId: id,
            userId: order.customerId,
            entryType: 'CUSTOMER_CHARGE',
            amount: order.estimatedFare,
            currency: order.currency,
            description: `Charge for order ${order.code}`,
            referenceType: 'ORDER',
            referenceId: id,
          }
        })
        if (driverUserId) {
          await db.ledgerEntry.create({
            data: {
              transactionRef: `TXN-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              orderId: id,
              userId: driverUserId,
              entryType: 'DRIVER_CREDIT',
              amount: driverNet,
              currency: order.currency,
              description: `Driver earnings for order ${order.code}`,
              referenceType: 'ORDER',
              referenceId: id,
            }
          })
        }
        // Update driver completed counter
        if (order.driverId) {
          await db.driver.update({
            where: { id: order.driverId },
            data: { totalCompleted: { increment: 1 } }
          })
        }
      } catch (ledgerErr: any) {
        console.error('[Ledger] Failed to create entries:', ledgerErr.message)
        // Don't fail the whole request — order is already COMPLETED
      }
    }
    // Re-fetch the order to include finalFare/completedAt
    const finalOrder = await db.order.findUnique({ where: { id } })
    return NextResponse.json({ order: finalOrder, event: result.event })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
