import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET() {
  const user = await getSessionUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const configs = await db.pricingConfiguration.findMany({
    where: { isActive: true },
    include: {
      serviceCategory: true,
    },
    orderBy: [{ serviceCategoryId: 'asc' }, { vehicleCategoryId: 'asc' }]
  })
  // Manually fetch vehicle categories for the configs
  const vehicleCategoryIds = [...new Set(configs.map(c => c.vehicleCategoryId).filter(Boolean) as string[])]
  const vehicleCategories = vehicleCategoryIds.length > 0
    ? await db.vehicleCategory.findMany({ where: { id: { in: vehicleCategoryIds } } })
    : []
  const vcMap = new Map(vehicleCategories.map(vc => [vc.id, vc]))
  return NextResponse.json({ configs: configs.map(c => ({
    id: c.id,
    serviceCategory: c.serviceCategory,
    vehicleCategory: c.vehicleCategoryId ? vcMap.get(c.vehicleCategoryId) : null,
    version: c.version,
    config: JSON.parse(c.configJson),
    effectiveFrom: c.effectiveFrom,
    effectiveTo: c.effectiveTo,
  })) })
}

export async function POST(req: Request) {
  const user = await getSessionUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const body = await req.json()
  const { serviceCategoryId, vehicleCategoryId, regionId, config } = body
  if (!serviceCategoryId || !config) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })

  // Find current active config to determine next version
  const current = await db.pricingConfiguration.findFirst({
    where: { serviceCategoryId, vehicleCategoryId: vehicleCategoryId || null, isActive: true },
    orderBy: { version: 'desc' }
  })
  const nextVersion = (current?.version || 0) + 1

  // Deactivate current
  if (current) {
    await db.pricingConfiguration.update({
      where: { id: current.id },
      data: { isActive: false, effectiveTo: new Date() }
    })
  }

  // Create new versioned config
  const created = await db.pricingConfiguration.create({
    data: {
      serviceCategoryId,
      vehicleCategoryId: vehicleCategoryId || null,
      regionId: regionId || null,
      version: nextVersion,
      configJson: JSON.stringify(config),
      isActive: true,
      effectiveFrom: new Date(),
      createdById: user.id,
    }
  })
  await db.auditLog.create({
    data: {
      actorId: user.id, actorType: 'ADMIN',
      action: 'PRICING_CONFIG_CREATED',
      resourceType: 'PRICING_CONFIGURATION', resourceId: created.id,
      metadataJson: JSON.stringify({ version: nextVersion, serviceCategoryId, vehicleCategoryId })
    }
  })
  return NextResponse.json({ config: created })
}
