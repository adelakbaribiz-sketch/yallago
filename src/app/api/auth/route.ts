import { NextResponse } from 'next/server'
import { login, register, setSessionCookie, clearSessionCookie, getSessionUser } from '@/lib/auth'
import { db } from '@/lib/db'

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const { action } = body

  if (action === 'login') {
    const { email, password } = body
    if (!email || !password) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
    const result = await login(email, password)
    if (!result) return NextResponse.json({ error: 'INVALID_CREDENTIALS' }, { status: 401 })
    if (result.user.role === 'DRIVER') {
      const driver = await db.driver.findUnique({ where: { userId: result.user.id } })
      if (driver && driver.status === 'PENDING') {
        return NextResponse.json({ error: 'DRIVER_PENDING_APPROVAL' }, { status: 403 })
      }
      if (driver && driver.status === 'REJECTED') {
        return NextResponse.json({ error: 'DRIVER_REJECTED' }, { status: 403 })
      }
    }
    const res = NextResponse.json({ user: result.user })
    res.headers.set('Set-Cookie', setSessionCookie(result.token))
    return res
  }

  if (action === 'register') {
    const { email, password, fullName, phone, role } = body
    if (!email || !password || !fullName) {
      return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
    }
    try {
      const result = await register({ email, password, fullName, phone, role })
      const res = NextResponse.json({ user: result.user })
      res.headers.set('Set-Cookie', setSessionCookie(result.token))
      return res
    } catch (err: any) {
      if (err.message === 'EMAIL_TAKEN') {
        return NextResponse.json({ error: 'EMAIL_TAKEN' }, { status: 400 })
      }
      throw err
    }
  }

  if (action === 'logout') {
    const user = await getSessionUser()
    if (user) {
      await db.session.deleteMany({ where: { userId: user.id } }).catch(() => {})
    }
    const res = NextResponse.json({ ok: true })
    res.headers.set('Set-Cookie', clearSessionCookie())
    return res
  }

  return NextResponse.json({ error: 'INVALID_ACTION' }, { status: 400 })
}

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ user: null })
  let driverInfo: any = null
  if (user.role === 'DRIVER') {
    const d = await db.driver.findUnique({ where: { userId: user.id } })
    if (d) {
      driverInfo = { id: d.id, status: d.status, rating: d.rating, totalCompleted: d.totalCompleted }
      user.driverId = d.id
    }
  }
  return NextResponse.json({ user, driverInfo })
}
