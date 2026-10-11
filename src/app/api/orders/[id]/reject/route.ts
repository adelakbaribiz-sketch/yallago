import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { rejectOrderOffer } from '@/lib/dispatch'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getSessionUser()
  if (!user || user.role !== 'DRIVER' || !user.driverId) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  }
  const body = await req.json().catch(() => ({}))
  await rejectOrderOffer(id, user.driverId, body.reason)
  return NextResponse.json({ ok: true })
}
