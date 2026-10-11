/**
 * Password hashing utilities. Uses PBKDF2 (sha256, 100k iterations) from node:crypto.
 * Suitable for development/demo. Production should use bcrypt/argon2.
 */
import { pbkdf2Sync, randomBytes, timingSafeEqual } from 'crypto'

const ITERATIONS = 100_000
const KEY_LEN = 64
const SALT_LEN = 16

export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LEN).toString('hex')
  const hash = pbkdf2Sync(password, salt, ITERATIONS, KEY_LEN, 'sha512').toString('hex')
  return `pbkdf2$${ITERATIONS}$${salt}$${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  if (!stored) return false
  const parts = stored.split('$')
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false
  const iterations = parseInt(parts[1], 10)
  const salt = parts[2]
  const storedHash = parts[3]
  const hash = pbkdf2Sync(password, salt, iterations, KEY_LEN, 'sha512').toString('hex')
  try {
    return timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(storedHash, 'hex'))
  } catch {
    return false
  }
}
