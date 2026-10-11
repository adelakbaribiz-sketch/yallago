/**
 * Clean all transactional data (orders, events, ratings, ledger,
 * assignments, payments) but keep users, drivers, vehicles,
 * service catalog, pricing, and regions intact.
 */
import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()

async function main() {
  console.log('Cleaning transactional data...')
  await db.ledgerEntry.deleteMany()
  await db.payment.deleteMany()
  await db.rating.deleteMany()
  await db.driverAssignment.deleteMany()
  await db.orderEvent.deleteMany()
  await db.order.deleteMany()
  await db.driver.updateMany({ data: { totalCompleted: 0, totalRatings: 0, rating: 5.0 } })
  console.log('Done. Users, drivers, vehicles, pricing, and services preserved.')
}

main().catch(console.error).finally(() => db.$disconnect())
