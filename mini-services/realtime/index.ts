/**
 * Realtime WebSocket service
 * -------------------------
 * Provides real-time events for:
 *   - Driver: incoming service requests, request expired, request cancelled
 *   - Customer: driver assigned, driver location updates, status changes
 *   - Driver location broadcasts: sent only to customers with an active order
 *     assigned to that driver.
 *
 * Port: 3003 (matches Caddyfile gateway forwarding rule).
 *
 * The Next.js backend emits events to this service via an internal HTTP
 * endpoint. The socket.io server then fans out to connected clients.
 *
 * Client connection:
 *   const socket = io("/?XTransformPort=3003")
 */
import { createServer } from 'http'
import { Server } from 'socket.io'

const httpServer = createServer()
const io = new Server(httpServer, {
  path: '/',
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
})

// Room helpers
function customerRoom(userId: string) { return `customer:${userId}` }
function driverRoom(driverId: string) { return `driver:${driverId}` }
function adminRoom() { return 'admin' }

// Map socket.id -> { userId, role, driverId? }
const socketInfo = new Map<string, { userId: string; role: string; driverId?: string }>()

io.on('connection', (socket) => {
  console.log(`[realtime] connected ${socket.id}`)

  socket.on('auth', (data: { userId: string; role: string; driverId?: string }) => {
    if (!data?.userId) return
    socketInfo.set(socket.id, data)
    if (data.role === 'CUSTOMER') socket.join(customerRoom(data.userId))
    if (data.role === 'DRIVER' && data.driverId) socket.join(driverRoom(data.driverId))
    if (data.role === 'ADMIN') socket.join(adminRoom())
    console.log(`[realtime] auth ${data.role} ${data.userId} driverId=${data.driverId ?? '-'}`)
    socket.emit('auth-ok', { ok: true })
  })

  // Internal: backend pushes events via HTTP POST /emit
  socket.on('server-emit', (data: { channel: string; room?: string; event: string; payload: any }) => {
    // Only used in dev/test; production uses the HTTP endpoint
    if (data.room) io.to(data.room).emit(data.event, data.payload)
    else io.emit(data.event, data.payload)
  })

  socket.on('driver-location', (data: { driverId: string; lat: number; lng: number; heading?: number; orderId?: string }) => {
    // Broadcast driver location only to:
    //  - the customer who has the active order with this driver
    //  - admins
    if (data.orderId) {
      io.to(`order:${data.orderId}`).emit('driver-location', data)
    }
    io.to(adminRoom()).emit('driver-location', data)
  })

  socket.on('join-order', (orderId: string) => {
    socket.join(`order:${orderId}`)
  })

  socket.on('leave-order', (orderId: string) => {
    socket.leave(`order:${orderId}`)
  })

  socket.on('disconnect', () => {
    socketInfo.delete(socket.id)
    console.log(`[realtime] disconnected ${socket.id}`)
  })

  socket.on('error', (err) => {
    console.error(`[realtime] socket error ${socket.id}:`, err)
  })
})

// ---- Internal HTTP endpoint for the Next.js backend to emit events ----
const emitServer = createServer((req, res) => {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' }))
    return
  }
  let body = ''
  req.on('data', (chunk) => (body += chunk))
  req.on('end', () => {
    try {
      const { room, event, payload, broadcast } = JSON.parse(body)
      if (broadcast) {
        io.emit(event, payload)
      } else if (room) {
        io.to(room).emit(event, payload)
      } else {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'MISSING_ROOM_OR_BROADCAST' }))
        return
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true }))
    } catch (err: any) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: err.message }))
    }
  })
})

emitServer.listen(3004, () => {
  console.log('[realtime] emit endpoint on :3004')
})

const PORT = 3003
httpServer.listen(PORT, () => {
  console.log(`[realtime] socket.io server on :${PORT}`)
})

process.on('SIGTERM', () => {
  console.log('[realtime] SIGTERM, shutting down')
  httpServer.close(() => process.exit(0))
  emitServer.close(() => {})
})
process.on('SIGINT', () => {
  console.log('[realtime] SIGINT, shutting down')
  httpServer.close(() => process.exit(0))
  emitServer.close(() => {})
})
