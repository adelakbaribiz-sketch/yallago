/**
 * Realtime client: connects to the socket.io mini-service on
 * port 3003 via the gateway. Provides a singleton socket + helpers
 * to subscribe to events per role.
 */
'use client'
import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

export function getSocket(): Socket {
  if (typeof window === 'undefined') {
    throw new Error('socket.io can only be used in the browser')
  }
  if (!socket) {
    socket = io('/?XTransformPort=3003', {
      path: '/',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
    })
    socket.on('connect', () => console.log('[socket] connected', socket?.id))
    socket.on('disconnect', () => console.log('[socket] disconnected'))
    socket.on('connect_error', (err) => console.error('[socket] connect_error', err.message))
  }
  return socket
}

export function authenticateSocket(userId: string, role: string, driverId?: string) {
  const s = getSocket()
  s.emit('auth', { userId, role, driverId })
}

export function joinOrderRoom(orderId: string) {
  const s = getSocket()
  s.emit('join-order', orderId)
}

export function leaveOrderRoom(orderId: string) {
  const s = getSocket()
  s.emit('leave-order', orderId)
}

export function broadcastDriverLocation(driverId: string, lat: number, lng: number, orderId?: string) {
  const s = getSocket()
  s.emit('driver-location', { driverId, lat, lng, orderId })
}
