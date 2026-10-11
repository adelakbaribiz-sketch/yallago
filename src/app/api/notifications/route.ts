import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const notifications = await db.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  return NextResponse.json({ notifications })
}

export async function PATCH(req: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const body = await req.json()
  const { id, markAsRead } = body
  if (markAsRead && id) {
    await db.notification.update({
      where: { id, userId: user.id },
      data: { status: 'READ', readAt: new Date() }
    })
  } else if (markAsRead && !id) {
    // Mark all as read
    await db.notification.updateMany({
      where: { userId: user.id, status: { not: 'READ' } },
      data: { status: 'READ', readAt: new Date() }
    })
  }
  return NextResponse.json({ ok: true })
}
