import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(req: Request) {
  const user = await getSessionUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') || ''
  const page = parseInt(searchParams.get('page') || '1', 10)
  const pageSize = parseInt(searchParams.get('pageSize') || '20', 10)

  const where: any = { role: 'CUSTOMER' }
  if (search) {
    where.OR = [
      { email: { contains: search } },
      { fullName: { contains: search } },
      { phone: { contains: search } },
    ]
  }
  const [customers, total] = await Promise.all([
    db.user.findMany({
      where,
      include: { customerProfile: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.user.count({ where })
  ])
  // For each customer, get order count
  const enriched = await Promise.all(customers.map(async (c) => {
    const orderCount = await db.order.count({ where: { customerId: c.id } })
    const completedCount = await db.order.count({ where: { customerId: c.id, status: 'COMPLETED' } })
    return {
      id: c.id, email: c.email, fullName: c.fullName, phone: c.phone,
      status: c.status, createdAt: c.createdAt,
      orderCount, completedCount,
    }
  }))
  return NextResponse.json({ customers: enriched, total, page, pageSize })
}

export async function PATCH(req: Request) {
  const user = await getSessionUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const body = await req.json()
  const { id, status } = body
  if (!id || !status) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const updated = await db.user.update({
    where: { id },
    data: { status }
  })
  await db.auditLog.create({
    data: {
      actorId: user.id, actorType: 'ADMIN',
      action: 'CUSTOMER_STATUS_CHANGE',
      resourceType: 'USER', resourceId: id,
      metadataJson: JSON.stringify({ status })
    }
  })
  return NextResponse.json({ user: updated })
}
