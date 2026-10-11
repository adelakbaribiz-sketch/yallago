/**
 * Authentication library: session-based auth using signed tokens.
 * Avoids NextAuth complexity for a self-contained demo platform.
 */
import { db } from '@/lib/db'
import { hashPassword, verifyPassword } from '@/lib/crypto'
import { cookies } from 'next/headers'
import { randomBytes } from 'crypto'

export const SESSION_COOKIE = 'platform_session'
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 7 // 7 days

export type SessionUser = {
  id: string
  email: string
  fullName: string
  role: 'CUSTOMER' | 'DRIVER' | 'ADMIN'
  driverId?: string
}

export async function createSession(user: SessionUser): Promise<string> {
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS)
  await db.session.create({
    data: {
      userId: user.id,
      token,
      expiresAt,
    }
  })
  return token
}

export async function destroySession(token: string): Promise<void> {
  await db.session.deleteMany({ where: { token } }).catch(() => {})
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null
  const session = await db.session.findUnique({
    where: { token },
    include: { user: true }
  })
  if (!session) return null
  if (session.expiresAt < new Date()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => {})
    return null
  }
  const u = session.user
  let driverId: string | undefined
  if (u.role === 'DRIVER') {
    const d = await db.driver.findUnique({ where: { userId: u.id } })
    driverId = d?.id
  }
  return {
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    role: u.role as 'CUSTOMER' | 'DRIVER' | 'ADMIN',
    driverId,
  }
}

export async function requireUser(): Promise<SessionUser> {
  const u = await getSessionUser()
  if (!u) throw new Error('UNAUTHORIZED')
  return u
}

export async function requireRole(...roles: SessionUser['role'][]): Promise<SessionUser> {
  const u = await requireUser()
  if (!roles.includes(u.role)) throw new Error('FORBIDDEN')
  return u
}

export async function login(email: string, password: string): Promise<{ token: string; user: SessionUser } | null> {
  const user = await db.user.findUnique({ where: { email } })
  if (!user) return null
  if (user.status !== 'ACTIVE') return null
  const ok = verifyPassword(password, user.passwordHash)
  if (!ok) return null
  let driverId: string | undefined
  if (user.role === 'DRIVER') {
    const d = await db.driver.findUnique({ where: { userId: user.id } })
    driverId = d?.id
  }
  const sessionUser: SessionUser = {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role as 'CUSTOMER' | 'DRIVER' | 'ADMIN',
    driverId,
  }
  const token = await createSession(sessionUser)
  return { token, user: sessionUser }
}

export async function register(params: {
  email: string
  password: string
  fullName: string
  phone?: string
  role?: 'CUSTOMER' | 'DRIVER'
}): Promise<{ token: string; user: SessionUser }> {
  const role = params.role ?? 'CUSTOMER'
  const existing = await db.user.findUnique({ where: { email: params.email } })
  if (existing) throw new Error('EMAIL_TAKEN')
  const user = await db.user.create({
    data: {
      email: params.email,
      passwordHash: hashPassword(params.password),
      fullName: params.fullName,
      phone: params.phone,
      role,
      status: 'ACTIVE',
    }
  })
  if (role === 'CUSTOMER') {
    await db.customerProfile.create({ data: { userId: user.id } })
  } else if (role === 'DRIVER') {
    // Drivers are created with PENDING status; full driver registration handled separately.
    await db.driver.create({
      data: {
        userId: user.id,
        status: 'PENDING',
        licenseNumber: 'PENDING',
        licenseExpiry: new Date(),
      }
    })
  }
  const sessionUser: SessionUser = {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role,
  }
  if (role === 'DRIVER') {
    const d = await db.driver.findUnique({ where: { userId: user.id } })
    sessionUser.driverId = d?.id
  }
  const token = await createSession(sessionUser)
  return { token, user: sessionUser }
}

export function setSessionCookie(token: string): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DURATION_MS / 1000}`
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
}
