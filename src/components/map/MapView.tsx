'use client'
import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useTheme } from 'next-themes'

// Fix Leaflet default marker icon paths
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

;(L.Icon.Default.prototype as any)._getIconUrl = () => null
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x.src,
  iconUrl: markerIcon.src,
  shadowUrl: markerShadow.src,
})

export type LatLng = { lat: number; lng: number }

export type MapMarker = {
  id: string
  position: LatLng
  label?: string
  color?: string // 'green', 'red', 'blue', 'gold'
  icon?: 'pickup' | 'destination' | 'driver' | 'default'
  popup?: string
}

export type MapViewProps = {
  center?: LatLng
  zoom?: number
  markers?: MapMarker[]
  polyline?: LatLng[]
  className?: string
  onMapClick?: (lat: number, lng: number) => void
  driverMarkerId?: string // animated driver marker
}

const COLOR_ICONS: Record<string, L.DivIcon> = {}
function getColoredIcon(color: string, label?: string) {
  const key = `${color}-${label || ''}`
  if (COLOR_ICONS[key]) return COLOR_ICONS[key]
  const html = `
    <div style="position: relative;">
      <div style="
        background: ${color};
        width: 28px; height: 28px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        border: 2px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.4);
        display: flex; align-items: center; justify-content: center;
      ">
        <div style="transform: rotate(45deg); color: white; font-weight: bold; font-size: 12px;">
          ${label || ''}
        </div>
      </div>
    </div>
  `
  const icon = L.divIcon({
    html,
    className: 'custom-div-icon',
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
  })
  COLOR_ICONS[key] = icon
  return icon
}

export default function MapView({
  center = { lat: 35.7008, lng: 51.3914 },
  zoom = 13,
  markers = [],
  polyline = [],
  className = 'h-full w-full',
  onMapClick,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const tileLayerRef = useRef<L.TileLayer | null>(null)
  const markersLayerRef = useRef<L.LayerGroup | null>(null)
  const polylineRef = useRef<L.Polyline | null>(null)
  const { resolvedTheme } = useTheme()

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = L.map(containerRef.current, {
      center: [center.lat, center.lng],
      zoom,
      zoomControl: true,
    })
    const isDark = document.documentElement.classList.contains('dark')
    const tileUrl = isDark
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
    const attribution = isDark
      ? '&copy; OpenStreetMap contributors &copy; CARTO'
      : '&copy; OpenStreetMap contributors'
    tileLayerRef.current = L.tileLayer(tileUrl, { attribution, maxZoom: 19 }).addTo(map)
    markersLayerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map

    if (onMapClick) {
      map.on('click', (e: L.LeafletMouseEvent) => {
        onMapClick(e.latlng.lat, e.latlng.lng)
      })
    }

    setTimeout(() => map.invalidateSize(), 100)

    return () => {
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Swap tile layer when theme changes
  useEffect(() => {
    if (!mapRef.current) return
    const isDark = resolvedTheme === 'dark'
    if (tileLayerRef.current) {
      tileLayerRef.current.remove()
    }
    const tileUrl = isDark
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
    const attribution = isDark
      ? '&copy; OpenStreetMap contributors &copy; CARTO'
      : '&copy; OpenStreetMap contributors'
    tileLayerRef.current = L.tileLayer(tileUrl, { attribution, maxZoom: 19 })
    tileLayerRef.current.addTo(mapRef.current)
    // Move tile layer to bottom
    tileLayerRef.current.bringToBack()
  }, [resolvedTheme])

  // Update center
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.setView([center.lat, center.lng], zoom, { animate: true })
    }
  }, [center.lat, center.lng, zoom])

  // Update markers
  useEffect(() => {
    if (!mapRef.current || !markersLayerRef.current) return
    markersLayerRef.current.clearLayers()
    for (const m of markers) {
      let icon: L.Icon | L.DivIcon
      let color = m.color || 'blue'
      let label = m.label
      if (m.icon === 'pickup') { color = '#10b981'; label = label || 'A' }
      else if (m.icon === 'destination') { color = '#ef4444'; label = label || 'B' }
      else if (m.icon === 'driver') { color = '#f59e0b'; label = label || '🚗' }
      icon = getColoredIcon(color, label)
      const marker = L.marker([m.position.lat, m.position.lng], { icon })
      if (m.popup) marker.bindPopup(m.popup)
      marker.addTo(markersLayerRef.current!)
    }
  }, [markers])

  // Update polyline
  useEffect(() => {
    if (!mapRef.current) return
    if (polylineRef.current) {
      polylineRef.current.remove()
      polylineRef.current = null
    }
    if (polyline.length >= 2) {
      polylineRef.current = L.polyline(
        polyline.map(p => [p.lat, p.lng]),
        { color: '#0ea5e9', weight: 4, opacity: 0.7, dashArray: '1, 8', lineCap: 'round' }
      ).addTo(mapRef.current)
      // Fit bounds to polyline
      const bounds = L.latLngBounds(polyline.map(p => [p.lat, p.lng]))
      mapRef.current.fitBounds(bounds, { padding: [40, 40] })
    }
  }, [polyline])

  return <div ref={containerRef} className={className} />
}
