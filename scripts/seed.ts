/**
 * Seed script: creates initial service catalog, vehicle categories,
 * pricing configurations, demo customer/driver/admin accounts,
 * and a service region.
 */
import { PrismaClient } from '@prisma/client'
import { hashPassword } from '../src/lib/crypto'

const db = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // -------- Service Categories --------
  const car = await db.serviceCategory.upsert({
    where: { code: 'CAR' },
    update: {},
    create: {
      code: 'CAR',
      name: 'Car',
      description: 'Passenger transportation by car',
      supportsPassenger: true,
      supportsDelivery: false,
      requiresQuotation: false,
      sortOrder: 1,
    },
  })

  const motorcycle = await db.serviceCategory.upsert({
    where: { code: 'MOTORCYCLE' },
    update: {},
    create: {
      code: 'MOTORCYCLE',
      name: 'Motorcycle',
      description: 'Motorcycle passenger transport and small-package delivery',
      supportsPassenger: true,
      supportsDelivery: true,
      requiresQuotation: false,
      sortOrder: 2,
    },
  })

  const cargo = await db.serviceCategory.upsert({
    where: { code: 'CARGO' },
    update: {},
    create: {
      code: 'CARGO',
      name: 'Cargo',
      description: 'Local freight and moving services',
      supportsPassenger: false,
      supportsDelivery: true,
      requiresQuotation: true,
      sortOrder: 3,
    },
  })

  // -------- Vehicle Categories --------
  const carVehicles = [
    { code: 'STANDARD', name: 'Standard', capacity: 4, baseFareMultiplier: 1.0, sortOrder: 1 },
    { code: 'ECONOMY', name: 'Economy', capacity: 4, baseFareMultiplier: 0.85, sortOrder: 2 },
    { code: 'PREMIUM', name: 'Premium', capacity: 4, baseFareMultiplier: 1.6, sortOrder: 3 },
    { code: 'SUV', name: 'SUV (6-passenger)', capacity: 6, baseFareMultiplier: 1.4, sortOrder: 4 },
  ]
  for (const vc of carVehicles) {
    await db.vehicleCategory.upsert({
      where: { serviceCategoryId_code: { serviceCategoryId: car.id, code: vc.code } },
      update: {},
      create: { serviceCategoryId: car.id, ...vc },
    })
  }

  const motoVehicles = [
    { code: 'BIKE', name: 'Motorcycle', capacity: 1, baseFareMultiplier: 0.7, sortOrder: 1 },
  ]
  for (const vc of motoVehicles) {
    await db.vehicleCategory.upsert({
      where: { serviceCategoryId_code: { serviceCategoryId: motorcycle.id, code: vc.code } },
      update: {},
      create: { serviceCategoryId: motorcycle.id, ...vc },
    })
  }

  const cargoVehicles = [
    { code: 'SMALL_PICKUP', name: 'Small Pickup Truck', capacity: 1, baseFareMultiplier: 1.0, sortOrder: 1 },
    { code: 'PICKUP_ENCLOS', name: 'Pickup (Enclosed)', capacity: 1, baseFareMultiplier: 1.2, sortOrder: 2 },
    { code: 'LIGHT_VAN', name: 'Light Commercial Van', capacity: 2, baseFareMultiplier: 1.4, sortOrder: 3 },
    { code: 'SMALL_TRUCK', name: 'Small Cargo Truck', capacity: 2, baseFareMultiplier: 1.7, sortOrder: 4 },
    { code: 'MEDIUM_TRUCK', name: 'Medium Cargo Truck', capacity: 3, baseFareMultiplier: 2.1, sortOrder: 5 },
    { code: 'LARGE_TRUCK', name: 'Large Cargo Truck', capacity: 3, baseFareMultiplier: 2.6, sortOrder: 6 },
  ]
  for (const vc of cargoVehicles) {
    await db.vehicleCategory.upsert({
      where: { serviceCategoryId_code: { serviceCategoryId: cargo.id, code: vc.code } },
      update: {},
      create: { serviceCategoryId: cargo.id, ...vc },
    })
  }

  // -------- Service Region --------
  const region = await db.serviceRegion.upsert({
    where: { code: 'TEHRAN_DEMO' },
    update: {},
    create: {
      code: 'TEHRAN_DEMO',
      name: 'Tehran (Demo)',
      country: 'Iran',
      city: 'Tehran',
      currency: 'IRR',
      timezone: 'Asia/Tehran',
      enabledServiceCategories: JSON.stringify([car.id, motorcycle.id, cargo.id]),
    },
  })

  // -------- Pricing Configurations --------
  const carVcs = await db.vehicleCategory.findMany({ where: { serviceCategoryId: car.id } })
  for (const vc of carVcs) {
    const existing = await db.pricingConfiguration.findFirst({
      where: { serviceCategoryId: car.id, vehicleCategoryId: vc.id, isActive: true }
    })
    if (!existing) {
      const baseFare = 20000
      const multiplier = vc.baseFareMultiplier
      await db.pricingConfiguration.create({
        data: {
          serviceCategoryId: car.id,
          vehicleCategoryId: vc.id,
          regionId: region.id,
          version: 1,
          configJson: JSON.stringify({
            baseFare: Math.round(baseFare * multiplier),
            minFare: Math.round(25000 * multiplier),
            perKm: Math.round(3500 * multiplier),
            perMinute: Math.round(1500 * multiplier),
            bookingFee: 2000,
            cancellationFee: 5000,
            waitingFeePerMin: 1000,
            commissionRate: 0.2,
          }),
          isActive: true,
          createdById: 'system',
        }
      })
    }
  }

  const motoVcs = await db.vehicleCategory.findMany({ where: { serviceCategoryId: motorcycle.id } })
  for (const vc of motoVcs) {
    const existing = await db.pricingConfiguration.findFirst({
      where: { serviceCategoryId: motorcycle.id, vehicleCategoryId: vc.id, isActive: true }
    })
    if (!existing) {
      await db.pricingConfiguration.create({
        data: {
          serviceCategoryId: motorcycle.id,
          vehicleCategoryId: vc.id,
          regionId: region.id,
          version: 1,
          configJson: JSON.stringify({
            baseFare: 12000,
            minFare: 18000,
            perKm: 2200,
            perMinute: 900,
            bookingFee: 1500,
            cancellationFee: 3000,
            waitingFeePerMin: 600,
            commissionRate: 0.18,
            // package delivery surcharges
            packageDeliverySurcharge: 5000,
            oversizedPackageSurcharge: 8000,
          }),
          isActive: true,
          createdById: 'system',
        }
      })
    }
  }

  const cargoVcs = await db.vehicleCategory.findMany({ where: { serviceCategoryId: cargo.id } })
  for (const vc of cargoVcs) {
    const existing = await db.pricingConfiguration.findFirst({
      where: { serviceCategoryId: cargo.id, vehicleCategoryId: vc.id, isActive: true }
    })
    if (!existing) {
      await db.pricingConfiguration.create({
        data: {
          serviceCategoryId: cargo.id,
          vehicleCategoryId: vc.id,
          regionId: region.id,
          version: 1,
          configJson: JSON.stringify({
            baseFare: Math.round(80000 * vc.baseFareMultiplier),
            minFare: Math.round(120000 * vc.baseFareMultiplier),
            perKm: Math.round(6000 * vc.baseFareMultiplier),
            perMinute: Math.round(3000 * vc.baseFareMultiplier),
            bookingFee: 5000,
            cancellationFee: 15000,
            waitingFeePerMin: 2000,
            commissionRate: 0.15,
            // Cargo-specific
            helperFeePerHour: 80000,
            loadingFee: 30000,
            unloadingFee: 30000,
            weightSurchargePerKg: 500,
            scheduledServiceFee: 20000,
          }),
          isActive: true,
          createdById: 'system',
        }
      })
    }
  }

  // -------- Admin user --------
  const adminUser = await db.user.upsert({
    where: { email: 'admin@platform.demo' },
    update: {},
    create: {
      email: 'admin@platform.demo',
      fullName: 'System Administrator',
      passwordHash: hashPassword('admin123'),
      role: 'ADMIN',
    },
  })
  await db.adminProfile.upsert({
    where: { userId: adminUser.id },
    update: {},
    create: {
      userId: adminUser.id,
      adminRole: 'SUPER_ADMIN',
      permissions: JSON.stringify(['*']),
    },
  })

  // -------- Customer user --------
  const customerUser = await db.user.upsert({
    where: { email: 'customer@platform.demo' },
    update: {},
    create: {
      email: 'customer@platform.demo',
      fullName: 'Demo Customer',
      passwordHash: hashPassword('customer123'),
      role: 'CUSTOMER',
      phone: '+989120000001',
    },
  })
  await db.customerProfile.upsert({
    where: { userId: customerUser.id },
    update: {},
    create: {
      userId: customerUser.id,
      savedAddressesJson: JSON.stringify([
        { label: 'Home', address: 'Valiasr St, Tehran', lat: 35.7008, lng: 51.3914 },
        { label: 'Work', address: 'Saadat Abad, Tehran', lat: 35.7750, lng: 51.3740 },
      ]),
    },
  })

  // -------- Approved driver --------
  const driverUser = await db.user.upsert({
    where: { email: 'driver@platform.demo' },
    update: {},
    create: {
      email: 'driver@platform.demo',
      fullName: 'Demo Driver',
      passwordHash: hashPassword('driver123'),
      role: 'DRIVER',
      phone: '+989120000002',
    },
  })
  const driver = await db.driver.upsert({
    where: { userId: driverUser.id },
    update: {},
    create: {
      userId: driverUser.id,
      status: 'APPROVED',
      licenseNumber: 'DL-DEMO-001',
      licenseExpiry: new Date('2027-12-31'),
      licenseImage: '/mock/license.jpg',
      profileImage: '/mock/profile.jpg',
      backgroundCheckStatus: 'PASSED',
      eligibleServiceCategories: JSON.stringify([car.id, motorcycle.id]),
      operatingRegion: region.id,
      approvedAt: new Date(),
      rating: 4.8,
      totalRatings: 0,
    },
  })
  await db.vehicle.upsert({
    where: { id: 'vehicle-demo-1' },
    update: {},
    create: {
      id: 'vehicle-demo-1',
      driverId: driver.id,
      plateNumber: 'TEH-123-45',
      make: 'Toyota',
      model: 'Camry',
      year: 2022,
      color: 'White',
      capacity: 4,
      serviceCategoryId: car.id,
      registrationNumber: 'REG-001',
      registrationExpiry: new Date('2026-12-31'),
      status: 'APPROVED',
    },
  })
  await db.vehicle.upsert({
    where: { id: 'vehicle-demo-2' },
    update: {},
    create: {
      id: 'vehicle-demo-2',
      driverId: driver.id,
      plateNumber: 'TEH-999-12',
      make: 'Honda',
      model: 'PCX',
      year: 2023,
      color: 'Black',
      capacity: 1,
      serviceCategoryId: motorcycle.id,
      registrationNumber: 'REG-002',
      registrationExpiry: new Date('2026-12-31'),
      status: 'APPROVED',
    },
  })
  // Initial driver location (online, near Tehran center)
  await db.driverLocation.upsert({
    where: { id: 'driver-loc-1' },
    update: { latitude: 35.7150, longitude: 51.4050, isOnline: true, lastSeenAt: new Date() },
    create: {
      id: 'driver-loc-1',
      driverId: driver.id,
      latitude: 35.7150,
      longitude: 51.4050,
      isOnline: true,
      lastSeenAt: new Date(),
    },
  })

  // -------- Pending driver (for admin to approve) --------
  const pendingDriverUser = await db.user.upsert({
    where: { email: 'pending.driver@platform.demo' },
    update: {},
    create: {
      email: 'pending.driver@platform.demo',
      fullName: 'Pending Driver',
      passwordHash: hashPassword('driver123'),
      role: 'DRIVER',
      phone: '+989120000003',
    },
  })
  await db.driver.upsert({
    where: { userId: pendingDriverUser.id },
    update: {},
    create: {
      userId: pendingDriverUser.id,
      status: 'PENDING',
      licenseNumber: 'DL-PENDING-002',
      licenseExpiry: new Date('2027-06-30'),
      backgroundCheckStatus: 'PENDING',
      eligibleServiceCategories: JSON.stringify([car.id]),
      operatingRegion: region.id,
    },
  })

  console.log('Seed completed successfully.')
  console.log('--- Demo credentials ---')
  console.log('Admin:    admin@platform.demo / admin123')
  console.log('Customer: customer@platform.demo / customer123')
  console.log('Driver:   driver@platform.demo / driver123')
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
}).finally(async () => {
  await db.$disconnect()
})
