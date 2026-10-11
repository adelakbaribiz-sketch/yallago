/**
 * Zustand store for app-level UI state.
 * - current view (customer / driver / admin)
 * - currently focused order (for real-time tracking)
 * - toast queue
 */
import { create } from 'zustand'

export type AppView = 'customer' | 'driver' | 'admin'
export type CustomerScreen =
  | 'home'
  | 'booking'
  | 'requesting'
  | 'tracking'
  | 'completed'
  | 'history'
  | 'profile'

type AppState = {
  view: AppView
  setView: (v: AppView) => void

  // Customer state
  customerScreen: CustomerScreen
  setCustomerScreen: (s: CustomerScreen) => void
  activeOrderId: string | null
  setActiveOrderId: (id: string | null) => void

  // Selected service category (Car / Motorcycle / Cargo) for booking
  selectedServiceId: string | null
  setSelectedServiceId: (id: string | null) => void

  // Map center (for cross-component sync)
  mapCenter: { lat: number; lng: number }
  setMapCenter: (c: { lat: number; lng: number }) => void
}

export const useAppStore = create<AppState>((set) => ({
  view: 'customer',
  setView: (view) => set({ view }),

  customerScreen: 'home',
  setCustomerScreen: (customerScreen) => set({ customerScreen }),
  activeOrderId: null,
  setActiveOrderId: (activeOrderId) => set({ activeOrderId }),

  selectedServiceId: null,
  setSelectedServiceId: (selectedServiceId) => set({ selectedServiceId }),

  mapCenter: { lat: 35.7008, lng: 51.3914 }, // Tehran center
  setMapCenter: (mapCenter) => set({ mapCenter }),
}))
