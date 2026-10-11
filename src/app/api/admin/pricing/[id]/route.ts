import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getSessionUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  // Get all versions of this pricing config group (by service+vehicle)
  const config = await db.pricingConfiguration.findUnique({ where: { id } })
  if (!config) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  const versions = await db.pricingConfiguration.findMany({
    where: {
      serviceCategoryId: config.serviceCategoryId,
      vehicleCategoryId: config.vehicleCategoryId,
    },
    orderBy: { version: 'desc' }
  })
  return NextResponse.json({ versions: versions.map(v => ({
    id: v.id, version: v.version, isActive: v.isActive,
    config: JSON.parse(v.configJson),
    effectiveFrom: v.effectiveFrom, effectiveTo: v.effectiveTo,
    createdAt: v.createdAt,
  })) })
}
