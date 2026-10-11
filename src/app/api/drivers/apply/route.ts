import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { db } from '@/lib/db'

export async function POST(req: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const body = await req.json().catch(() => ({}))

  // Either: a logged-in DRIVER submits their full application,
  // or a new user is created.
  let userId = user.id
  if (body.email && body.password) {
    // Register new driver user
    const existing = await db.user.findUnique({ where: { email: body.email } })
    if (existing) return NextResponse.json({ error: 'EMAIL_TAKEN' }, { status: 400 })
    const { hashPassword } = await import('@/lib/crypto')
    const newUser = await db.user.create({
      data: {
        email: body.email,
        fullName: body.fullName,
        phone: body.phone,
        passwordHash: hashPassword(body.password),
        role: 'DRIVER',
      }
    })
    userId = newUser.id
  }

  const {
    licenseNumber, licenseExpiry, licenseImage,
    profileImage, nationalId,
    eligibleServiceCategories, operatingRegion,
    vehicle,
  } = body

  if (!licenseNumber || !licenseExpiry) {
    return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  }

  // Upsert driver record
  let driver = await db.driver.findUnique({ where: { userId } })
  if (driver) {
    driver = await db.driver.update({
      where: { id: driver.id },
      data: {
        licenseNumber, licenseExpiry: new Date(licenseExpiry),
        licenseImage, profileImage, nationalId,
        eligibleServiceCategories: JSON.stringify(eligibleServiceCategories || []),
        operatingRegion,
        status: 'PENDING',
      }
    })
  } else {
    driver = await db.driver.create({
      data: {
        userId,
        licenseNumber, licenseExpiry: new Date(licenseExpiry),
        licenseImage, profileImage, nationalId,
        eligibleServiceCategories: JSON.stringify(eligibleServiceCategories || []),
        operatingRegion,
        status: 'PENDING',
      }
    })
  }

  // Vehicle
  if (vehicle) {
    await db.vehicle.create({
      data: {
        driverId: driver.id,
        plateNumber: vehicle.plateNumber,
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year || new Date().getFullYear(),
        color: vehicle.color || 'Unknown',
        capacity: vehicle.capacity || 4,
        serviceCategoryId: vehicle.serviceCategoryId,
        registrationNumber: vehicle.registrationNumber,
        registrationExpiry: new Date(vehicle.registrationExpiry),
        insuranceNumber: vehicle.insuranceNumber,
        insuranceExpiry: vehicle.insuranceExpiry ? new Date(vehicle.insuranceExpiry) : null,
        imageUrl: vehicle.imageUrl,
        status: 'PENDING',
      }
    })
  }

  return NextResponse.json({ driver, status: 'PENDING' })
}

export async function GET() {
  const user = await getSessionUser()
  if (!user || user.role !== 'DRIVER') return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const driver = await db.driver.findUnique({
    where: { userId: user.id },
    include: {
      vehicles: true,
      user: { select: { fullName: true, email: true, phone: true } }
    }
  })
  return NextResponse.json({ driver })
}
