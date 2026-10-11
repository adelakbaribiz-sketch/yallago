/**
 * Refreshes the demo driver's lastSeenAt so they remain discoverable
 * for dispatch without having to log in. Run after seeding.
 */
import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()

async function main() {
  const result = await db.driverLocation.updateMany({
    where: { id: 'driver-loc-1' },
    data: {
      isOnline: true,
      lastSeenAt: new Date(),
      latitude: 35.7150,
      longitude: 51.4050,
    }
  })
  console.log(`Refreshed ${result.count} driver location(s).`)
}

main().catch(console.error).finally(() => db.$disconnect())
