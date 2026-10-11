import { NextResponse } from 'next/server'
import { simulateRoute, reverseGeocode, haversineKm, estimateDurationMinutes } from '@/lib/geo'

export async function POST(req: Request) {
  const body = await req.json()
  const { from, to } = body
  if (!from || !to) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const polyline = simulateRoute(from, to)
  const distanceKm = haversineKm(from, to)
  const durationMin = estimateDurationMinutes(distanceKm)
  return NextResponse.json({
    polyline,
    distanceKm,
    durationMinutes: durationMin,
    fromAddress: reverseGeocode(from.lat, from.lng),
    toAddress: reverseGeocode(to.lat, to.lng),
  })
}
