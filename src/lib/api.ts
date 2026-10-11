/**
 * Shared API utilities: typed response helpers, error handling,
 * JSON body parsing, and audit logging.
 */
import { NextResponse } from 'next/server'
import { getSessionUser, SessionUser } from '@/lib/auth'
import { db } from '@/lib/db'

export type ApiContext = {
  user: SessionUser
}

/**
 * Higher-order function: wraps an async handler with auth + error handling.
 * Returns a Next.js Route Handler.
 *
 * Usage:
 *   export const POST = apiHandler(async ({ user }, body) => { ... })
 *   export const GET = apiHandler(async ({ user }) => { ... })
 */
export function apiHandler<T = any>(
  handler: (ctx: ApiContext, body: any, req: Request) => Promise<T | NextResponse>
) {
  return async (req: Request): Promise<NextResponse> => {
    try {
      const user = await getSessionUser()
      if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

      let body: any = undefined
      const method = req.method.toUpperCase()
      if (method !== 'GET' && method !== 'DELETE') {
        try {
          body = await req.json()
        } catch {
          // Body may be empty; ignore
        }
      }

      const result = await handler({ user }, body, req)
      if (result instanceof NextResponse) return result
      return NextResponse.json(result)
    } catch (err: any) {
      const msg = err?.message || String(err)
      if (msg === 'UNAUTHORIZED') return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
      if (msg === 'FORBIDDEN') return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
      if (msg.startsWith('INVALID_TRANSITION')) {
        return NextResponse.json({ error: msg }, { status: 400 })
      }
      if (msg === 'NO_PRICING_CONFIG') {
        return NextResponse.json({ error: 'NO_PRICING_CONFIG' }, { status: 400 })
      }
      console.error('[API Error]', msg, err?.stack)
      return NextResponse.json({ error: 'INTERNAL_ERROR', detail: msg }, { status: 500 })
    }
  }
}

/**
 * Same as apiHandler but does not require authentication.
 */
export function publicApiHandler<T = any>(
  handler: (body: any, req: Request) => Promise<T | NextResponse>
) {
  return async (req: Request): Promise<NextResponse> => {
    try {
      let body: any = undefined
      const method = req.method.toUpperCase()
      if (method !== 'GET' && method !== 'DELETE') {
        try {
          body = await req.json()
        } catch {}
      }
      const result = await handler(body, req)
      if (result instanceof NextResponse) return result
      return NextResponse.json(result)
    } catch (err: any) {
      const msg = err?.message || String(err)
      console.error('[API Error]', msg, err?.stack)
      return NextResponse.json({ error: 'INTERNAL_ERROR', detail: msg }, { status: 500 })
    }
  }
}

export async function audit(action: string, actorId: string | null, actorType: string, meta?: Record<string, unknown>) {
  await db.auditLog.create({
    data: {
      actorId,
      actorType,
      action,
      metadataJson: meta ? JSON.stringify(meta) : null,
    }
  }).catch(() => {})
}

export function paginate(items: any[], page: number, pageSize: number) {
  const start = (page - 1) * pageSize
  return {
    items: items.slice(start, start + pageSize),
    page,
    pageSize,
    total: items.length,
    totalPages: Math.ceil(items.length / pageSize),
  }
}
