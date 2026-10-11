import { NextResponse } from 'next/server'
import { calculateFareEstimate, PricingInput } from '@/lib/pricing'
import { haversineKm, estimateDurationMinutes } from '@/lib/geo'

export async function POST(req: Request) {
  const body = await req.json()
  const {
    serviceCategoryId,
    vehicleCategoryId,
    pickupLat, pickupLng,
    destinationLat, destinationLng,
    weightKg, helpers, needsLoading, needsUnloading,
    scheduled, packageDelivery, oversizedPackage,
  } = body
  if (!serviceCategoryId || pickupLat == null || pickupLng == null || destinationLat == null || destinationLng == null) {
    return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  }
  const distanceKm = haversineKm(
    { lat: pickupLat, lng: pickupLng },
    { lat: destinationLat, lng: destinationLng }
  )
  const durationMinutes = estimateDurationMinutes(distanceKm)
  const input: PricingInput = {
    serviceCategoryId,
    vehicleCategoryId,
    distanceKm,
    durationMinutes,
    weightKg, helpers, needsLoading, needsUnloading,
    scheduled, packageDelivery, oversizedPackage,
  }
  const estimate = await calculateFareEstimate(input)
  return NextResponse.json({ estimate, distanceKm, durationMinutes })
}
