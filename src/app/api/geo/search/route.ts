import { NextResponse } from 'next/server'
import { searchAddresses } from '@/lib/geo'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') || ''
  return NextResponse.json({ results: searchAddresses(q) })
}
