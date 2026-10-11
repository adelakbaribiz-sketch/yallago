/**
 * Frontend API client: typed wrappers around fetch that handle
 * JSON serialization, error responses, and the platform cookie auth.
 */
export type ApiError = { error: string; detail?: string; status?: number }

export async function apiGet<T = any>(path: string): Promise<T> {
  const res = await fetch(path, {
    method: 'GET',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' }
  })
  return handleResponse<T>(res)
}

export async function apiPost<T = any>(path: string, body?: any): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  return handleResponse<T>(res)
}

export async function apiPatch<T = any>(path: string, body?: any): Promise<T> {
  const res = await fetch(path, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  return handleResponse<T>(res)
}

export async function apiPut<T = any>(path: string, body?: any): Promise<T> {
  const res = await fetch(path, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  return handleResponse<T>(res)
}

async function handleResponse<T>(res: Response): Promise<T> {
  const text = await res.text()
  let data: any = null
  if (text) {
    try { data = JSON.parse(text) } catch { data = { raw: text } }
  }
  if (!res.ok) {
    const err: ApiError = { error: data?.error || 'UNKNOWN', detail: data?.detail, status: res.status }
    throw err
  }
  return data as T
}

// ----- Domain-typed API methods -----

export const AuthApi = {
  me: () => apiGet<{ user: any; driverInfo?: any }>('/api/auth'),
  login: (email: string, password: string) =>
    apiPost<{ user: any }>('/api/auth', { action: 'login', email, password }),
  register: (params: { email: string; password: string; fullName: string; phone?: string; role?: 'CUSTOMER' | 'DRIVER' }) =>
    apiPost<{ user: any }>('/api/auth', { action: 'register', ...params }),
  logout: () => apiPost('/api/auth', { action: 'logout' }),
}

export const ServiceApi = {
  list: () => apiGet<{ services: any[]; regions: any[] }>('/api/services'),
}

export const PricingApi = {
  estimate: (params: any) => apiPost<{ estimate: any; distanceKm: number; durationMinutes: number }>('/api/pricing/estimate', params),
}

export const OrderApi = {
  create: (params: any) => apiPost<{ order: any; estimate: any; dispatchResult: any }>('/api/orders', params),
  list: () => apiGet<{ orders: any[] }>('/api/orders'),
  get: (id: string) => apiGet<{ order: any; driverLocation?: any }>(`/api/orders/${id}`),
  update: (id: string, body: any) => apiPut<{ order: any }>(`/api/orders/${id}`, body),
  cancel: (id: string, reason?: string) => apiPost(`/api/orders/${id}/cancel`, { reason }),
  rate: (id: string, stars: number, comment?: string, tags?: string[]) =>
    apiPost(`/api/orders/${id}/rate`, { stars, comment, tags }),
  accept: (id: string) => apiPost(`/api/orders/${id}/accept`),
  reject: (id: string, reason?: string) => apiPost(`/api/orders/${id}/reject`, { reason }),
  arrive: (id: string) => apiPost(`/api/orders/${id}/arrive`),
  start: (id: string) => apiPost(`/api/orders/${id}/start`),
  complete: (id: string) => apiPost(`/api/orders/${id}/complete`),
  confirmDelivery: (id: string, code?: string) => apiPost(`/api/orders/${id}/confirm-delivery`, { code }),
  quotation: (id: string, action: 'approve' | 'reject', amount?: number) =>
    apiPost(`/api/orders/${id}/quotation`, { action, amount }),
}

export const DriverApi = {
  apply: (params: any) => apiPost('/api/drivers/apply', params),
  me: () => apiGet('/api/drivers/apply'),
  availability: {
    get: () => apiGet('/api/drivers/me/availability'),
    set: (isOnline: boolean) => apiPatch('/api/drivers/me/availability', { isOnline }),
    updateLocation: (lat: number, lng: number) => apiPost('/api/drivers/me/location', { latitude: lat, longitude: lng }),
  },
  requests: () => apiGet<{ requests: any[] }>('/api/drivers/me/requests'),
  orders: () => apiGet<{ orders: any[] }>('/api/drivers/me/orders'),
  earnings: (from?: string, to?: string) => {
    const q = from && to ? `?from=${from}&to=${to}` : ''
    return apiGet(`/api/drivers/me/earnings${q}`)
  },
  online: () => apiGet<{ drivers: any[] }>('/api/drivers/online'),
}

export const AdminApi = {
  dashboard: () => apiGet('/api/admin/dashboard'),
  customers: (search?: string, page = 1, pageSize = 20) =>
    apiGet(`/api/admin/customers?search=${encodeURIComponent(search || '')}&page=${page}&pageSize=${pageSize}`),
  setCustomerStatus: (id: string, status: string) =>
    apiPatch('/api/admin/customers', { id, status }),
  drivers: (status?: string, page = 1, pageSize = 20) =>
    apiGet(`/api/admin/drivers?${status ? `status=${status}&` : ''}page=${page}&pageSize=${pageSize}`),
  approveDriver: (id: string) => apiPost(`/api/admin/drivers/${id}/approve`),
  rejectDriver: (id: string, reason: string, action = 'reject') =>
    apiPost(`/api/admin/drivers/${id}/reject`, { reason, action }),
  orders: (status?: string, serviceType?: string, page = 1, pageSize = 50) =>
    apiGet(`/api/admin/orders?${status ? `status=${status}&` : ''}${serviceType ? `serviceType=${serviceType}&` : ''}page=${page}&pageSize=${pageSize}`),
  setOrderStatus: (id: string, status: string, cancelReason?: string) =>
    apiPatch('/api/admin/orders', { id, status, cancelReason }),
  pricing: {
    list: () => apiGet<{ configs: any[] }>('/api/admin/pricing'),
    update: (params: { serviceCategoryId: string; vehicleCategoryId?: string; regionId?: string; config: any }) =>
      apiPost('/api/admin/pricing', params),
    versions: (id: string) => apiGet<{ versions: any[] }>(`/api/admin/pricing/${id}`),
  },
}

export const GeoApi = {
  search: (q: string) => apiGet<{ results: any[] }>(`/api/geo/search?q=${encodeURIComponent(q)}`),
  route: (from: { lat: number; lng: number }, to: { lat: number; lng: number }) =>
    apiPost('/api/geo/route', { from, to }),
}
