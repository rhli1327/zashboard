import { IP_INFO_API, LANG } from '@/constant'
import {
  geoipASNDatabaseURL,
  geoipCityDatabaseURL,
  geoipIPInfoToken,
  IPInfoAPI,
  language,
} from '@/store/settings'
import { watchDebounced } from '@vueuse/core'
import { Buffer } from 'buffer'
import * as ipaddr from 'ipaddr.js'
import type { AsnResponse, CityResponse, Reader } from 'mmdb-lib'
import { reactive } from 'vue'

// mmdb-lib relies on the global Buffer at module-eval time.
if (!(globalThis as { Buffer?: unknown }).Buffer) {
  ;(globalThis as { Buffer?: unknown }).Buffer = Buffer
}

export interface IPInfo {
  ip: string
  country: string
  region: string
  city: string
  asn: string
  organization: string
}

export const formatGeoIPInfo = ({ country, region, city, organization }: IPInfo): string =>
  [region || city || country, organization].filter(Boolean).join(' / ')

// china
export const getIPFromIpipnetAPI = async () => {
  const response = await fetch('https://myip.ipip.net/json?t=' + Date.now())

  return (await response.json()) as {
    data: {
      ip: string
      location: string[]
    }
  }
}

// global
const getIPFromIpsbAPI = async (ip = '') => {
  const response = await fetch(
    'https://api.ip.sb/geoip' + (ip ? `/${ip}` : '') + '?t=' + Date.now(),
  )

  return (await response.json()) as {
    organization: string
    longitude: number
    city: string
    region: string
    timezone: string
    isp: string
    offset: number
    asn: number
    asn_organization: string
    country: string
    ip: string
    latitude: number
    postal_code: string
    continent_code: string
    country_code: string
    region_code: string
  }
}

const getIPFromIPWhoisAPI = async (ip = '') => {
  const response = await fetch('https://ipwho.is' + (ip ? `/${ip}` : '') + '?t=' + Date.now())

  return (await response.json()) as {
    ip: string
    success: boolean
    type: string
    continent: string
    continent_code: string
    country: string
    country_code: string
    region: string
    region_code: string
    city: string
    latitude: number
    longitude: number
    is_eu: boolean
    postal: string
    calling_code: string
    capital: string
    borders: string
    flag: {
      img: string
      emoji: string
      emoji_unicode: string
    }
    connection: {
      asn: number
      org: string
      isp: string
      domain: string
    }
    timezone: {
      id: string
      abbr: string
      is_dst: boolean
      offset: number
      utc: string
      current_time: string
    }
  }
}

const getIPFromIPapiisAPI = async (ip = '') => {
  const response = await fetch(
    'https://api.ipapi.is' + (ip ? `/?q=${ip}` : '') + (ip ? '&' : '?') + 't=' + Date.now(),
  )

  return (await response.json()) as {
    ip: string
    rir: string
    is_bogon: boolean
    is_mobile: boolean
    is_satellite: boolean
    is_crawler: boolean
    is_datacenter: boolean
    is_tor: boolean
    is_proxy: boolean
    is_vpn: boolean
    is_abuser: boolean
    datacenter: {
      datacenter: string
      network: string
      region: string
      service: string
      network_border_group: string
    }
    company: {
      name: string
      abuser_score: string
      domain: string
      type: string
      network: string
      whois: string
    }
    abuse: {
      name: string
      address: string
      email: string
      phone: string
    }
    asn: {
      asn: number
      abuser_score: string
      route: string
      descr: string
      country: string
      active: boolean
      org: string
      domain: string
      abuse: string
      type: string
      created: string
      updated: string
      rir: string
      whois: string
    }
    location: {
      is_eu_member: boolean
      calling_code: string
      currency_code: string
      continent: string
      country: string
      country_code: string
      state: string
      city: string
      latitude: number
      longitude: number
      zip: string
      timezone: string
      local_time: string
      local_time_unix: number
      is_dst: boolean
    }
    elapsed_ms: number
  }
}

export const getIPInfo = async (ip = ''): Promise<IPInfo> => {
  switch (IPInfoAPI.value) {
    case IP_INFO_API.IPAPI:
      const ipapi = await getIPFromIPapiisAPI(ip)

      return {
        ip: ipapi.ip,
        country: ipapi.location.country,
        region: ipapi.location.state,
        city: ipapi.location.city,
        asn: ipapi.asn.asn?.toString(),
        organization: ipapi.asn.org,
      }
    case IP_INFO_API.IPWHOIS:
      const ipwhois = await getIPFromIPWhoisAPI(ip)

      return {
        ip: ipwhois.ip,
        region: ipwhois.region,
        country: ipwhois.country,
        city: ipwhois.city,
        asn: ipwhois.connection.asn?.toString(),
        organization: ipwhois.connection.org,
      }
    case IP_INFO_API.IPSB:
    default:
      const ipsb = await getIPFromIpsbAPI(ip)

      return {
        ip: ipsb.ip,
        country: ipsb.country,
        region: ipsb.region,
        city: ipsb.city,
        asn: ipsb.asn?.toString(),
        organization: ipsb.organization,
      }
  }
}

/**
 * Local GeoIP lookup backed by GeoIP databases (City for country/region/city,
 * ASN for the autonomous system / organization).
 *
 * Each database is downloaded once, cached in IndexedDB (which, unlike the
 * Cache API, also works over plain HTTP), and queried in the browser. IPinfo is
 * used only as a cached fallback for public IPs missing both region and city.
 */
const GEOIP_IDB_NAME = 'zashboard-geoip'
const GEOIP_IDB_VERSION = 2
const GEOIP_DATABASE_IDB_STORE = 'mmdb'
const GEOIP_IPINFO_IDB_STORE = 'ipinfo'
const GEOIP_DATABASE_TTL = 30 * 24 * 60 * 60 * 1000
const GEOIP_IPINFO_TTL = 7 * 24 * 60 * 60 * 1000

interface CachedGeoIPDatabase {
  buffer: ArrayBuffer
  updatedAt: number
}

const openGeoIPDB = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(GEOIP_IDB_NAME, GEOIP_IDB_VERSION)

    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(GEOIP_DATABASE_IDB_STORE)) {
        request.result.createObjectStore(GEOIP_DATABASE_IDB_STORE)
      }
      if (!request.result.objectStoreNames.contains(GEOIP_IPINFO_IDB_STORE)) {
        request.result.createObjectStore(GEOIP_IPINFO_IDB_STORE)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

const readCachedValue = async <T>(storeName: string, key: string): Promise<T | undefined> => {
  const db = await openGeoIPDB()

  return new Promise<T | undefined>((resolve, reject) => {
    const request = db.transaction(storeName, 'readonly').objectStore(storeName).get(key)

    request.onsuccess = () => resolve(request.result as T | undefined)
    request.onerror = () => reject(request.error)
  }).finally(() => db.close())
}

const writeCachedValue = async <T>(storeName: string, key: string, value: T): Promise<void> => {
  const db = await openGeoIPDB()

  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite')

    transaction.objectStore(storeName).put(value, key)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  }).finally(() => db.close())
}

type GeoIPResponse = CityResponse | AsnResponse

const loadReader = async (url: string): Promise<Reader<GeoIPResponse>> => {
  let cached = await readCachedValue<CachedGeoIPDatabase>(GEOIP_DATABASE_IDB_STORE, url).catch(
    () => undefined,
  )

  if (!cached || Date.now() - cached.updatedAt > GEOIP_DATABASE_TTL) {
    try {
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error(`Failed to download GeoIP database: ${response.status}`)
      }

      cached = { buffer: await response.arrayBuffer(), updatedAt: Date.now() }
      await writeCachedValue(GEOIP_DATABASE_IDB_STORE, url, cached).catch(() => {})
    } catch (error) {
      // Fall back to a stale cache when refreshing fails; only rethrow when we
      // have nothing usable at all.
      if (!cached) {
        throw error
      }
    }
  }

  const { Reader } = await import('mmdb-lib')

  return new Reader<GeoIPResponse>(Buffer.from(cached.buffer))
}

// Cap the in-memory reader cache. Normally only two databases (city + ASN)
// are live at once; the headroom absorbs transient URL edits before the stale
// entries are evicted (least-recently-used first).
const GEOIP_READER_CACHE_MAX = 4
const readerCache = new Map<string, Promise<Reader<GeoIPResponse>>>()

const getReader = <T extends GeoIPResponse>(url: string): Promise<Reader<T>> => {
  const cached = readerCache.get(url)

  if (cached) {
    // Mark as most-recently-used.
    readerCache.delete(url)
    readerCache.set(url, cached)

    return cached as Promise<Reader<T>>
  }

  const reader = loadReader(url).catch((error) => {
    // Drop the failed entry so a later lookup can retry the download.
    readerCache.delete(url)
    throw error
  })

  readerCache.set(url, reader)

  // Evict the least-recently-used entries beyond the cap.
  while (readerCache.size > GEOIP_READER_CACHE_MAX) {
    const oldest = readerCache.keys().next().value

    if (oldest === undefined) {
      break
    }

    readerCache.delete(oldest)
  }

  return reader as Promise<Reader<T>>
}

const localizedName = (names?: { en: string; 'zh-CN'?: string }): string => {
  if (!names) {
    return ''
  }

  const preferChinese = language.value === LANG.ZH_CN || language.value === LANG.ZH_TW

  return preferChinese ? (names['zh-CN'] ?? names.en) : names.en
}

// Look up a single IP. A failure to load the database propagates (so the caller
// can retry later); only a lookup miss / decode error for this IP becomes null.
const lookup = async <T extends GeoIPResponse>(url: string, ip: string): Promise<T | null> => {
  const reader = await getReader<T>(url)

  try {
    return reader.get(ip)
  } catch {
    return null
  }
}

interface IPInfoLocation {
  country: string
  region: string
  city: string
}

interface CachedIPInfoLocation {
  location: IPInfoLocation
  updatedAt: number
  authenticated: boolean
}

interface IPInfoJSONResponse {
  country?: string
  region?: string
  city?: string
  bogon?: boolean
}

const isPublicIP = (ip: string): boolean => ipaddr.parse(ip).range() === 'unicast'

const requestIPInfoLocation = async (ip: string, token: string): Promise<IPInfoLocation> => {
  const url = new URL(`https://ipinfo.io/${encodeURIComponent(ip)}/json`)

  if (token) {
    url.searchParams.set('token', token)
  }

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Failed to query IPinfo: ${response.status}`)
  }

  const result = (await response.json()) as IPInfoJSONResponse
  const location = {
    country: result.country ?? '',
    region: result.region ?? '',
    city: result.city ?? '',
  }

  if (result.bogon || !Object.values(location).some(Boolean)) {
    throw new Error('IPinfo returned no usable location')
  }

  return location
}

const getIPInfoLocation = async (ip: string): Promise<IPInfoLocation> => {
  const token = geoipIPInfoToken.value.trim()
  const cached = await readCachedValue<CachedIPInfoLocation>(GEOIP_IPINFO_IDB_STORE, ip).catch(
    () => undefined,
  )
  const isFresh = cached && Date.now() - cached.updatedAt <= GEOIP_IPINFO_TTL

  // A newly configured token gets one chance to replace anonymous cached data.
  if (isFresh && (!token || cached.authenticated)) {
    return cached.location
  }

  let location: IPInfoLocation
  let authenticated = Boolean(token)

  try {
    location = await requestIPInfoLocation(ip, token)
  } catch (error) {
    if (cached) {
      return cached.location
    }
    if (!token) {
      throw error
    }

    // A missing, expired, or under-scoped token must not make the anonymous
    // fallback less reliable than leaving the setting empty.
    location = await requestIPInfoLocation(ip, '')
    authenticated = false
  }

  await writeCachedValue<CachedIPInfoLocation>(GEOIP_IPINFO_IDB_STORE, ip, {
    location,
    updatedAt: Date.now(),
    authenticated,
  }).catch(() => {})

  return location
}

const getGeoIPInfo = async (ip: string, useIPInfoFallback: boolean): Promise<IPInfo> => {
  const [city, asn] = await Promise.all([
    lookup<CityResponse>(geoipCityDatabaseURL.value, ip),
    lookup<AsnResponse>(geoipASNDatabaseURL.value, ip),
  ])
  const subdivision = city?.subdivisions?.[0]

  const localInfo: IPInfo = {
    ip,
    // Real countries carry localized names; category ranges (e.g. GOOGLE) only
    // have an iso_code, so fall back to that.
    country: localizedName(city?.country?.names) || (city?.country?.iso_code ?? ''),
    region: localizedName(subdivision?.names) || (subdivision?.iso_code ?? ''),
    city: localizedName(city?.city?.names),
    asn: asn?.autonomous_system_number?.toString() ?? '',
    organization: asn?.autonomous_system_organization ?? '',
  }

  if (!useIPInfoFallback || localInfo.region || localInfo.city || !isPublicIP(ip)) {
    return localInfo
  }

  const fallback = await getIPInfoLocation(ip).catch(() => undefined)

  if (!fallback) {
    return localInfo
  }

  return {
    ...localInfo,
    country: localInfo.country || fallback.country,
    region: fallback.region,
    city: fallback.city,
  }
}

const EMPTY_GEOIP_INFO: IPInfo = {
  ip: '',
  country: '',
  region: '',
  city: '',
  asn: '',
  organization: '',
}
// Cap the resolved-info cache; a session may touch many distinct IPs, and each
// entry is tiny, so this only guards against unbounded growth.
const GEOIP_INFO_CACHE_MAX = 4096
const geoInfoCache = reactive(new Map<string, IPInfo>())
const geoInfoPending = new Set<string>()

/**
 * Reactive, synchronous GeoIP lookup for render paths (e.g. table cells).
 *
 * Returns the cached info immediately, or empty values while the async lookup
 * runs in the background; once resolved the reactive cache updates and dependent
 * views re-render. Enable IPinfo only for low-cardinality source-IP views.
 */
export const getGeoIPInfoSync = (ip: string, useIPInfoFallback = false): IPInfo => {
  if (!ip || !ipaddr.isValid(ip)) {
    return EMPTY_GEOIP_INFO
  }

  const cacheKey = `${useIPInfoFallback ? 'ipinfo' : 'local'}:${ip}`
  const cached = geoInfoCache.get(cacheKey)

  if (cached) {
    return cached
  }

  if (!geoInfoPending.has(cacheKey)) {
    geoInfoPending.add(cacheKey)
    getGeoIPInfo(ip, useIPInfoFallback)
      .then((info) => {
        geoInfoCache.set(cacheKey, info)

        // Evict oldest entries beyond the cap (FIFO; safe here since this runs
        // in a microtask, not during a render read of the reactive cache).
        while (geoInfoCache.size > GEOIP_INFO_CACHE_MAX) {
          const oldest = geoInfoCache.keys().next().value

          if (oldest === undefined) {
            break
          }

          geoInfoCache.delete(oldest)
        }
      })
      .catch(() => {})
      .finally(() => geoInfoPending.delete(cacheKey))
  }

  return EMPTY_GEOIP_INFO
}

// When the database URLs change, drop the cached readers and resolved results so
// the new databases are (re)downloaded and take effect. Clearing the reactive
// result cache makes any visible GeoIP cells re-query immediately; if nothing is
// shown, nothing is downloaded. Debounced so editing the URL character by
// character does not trigger a download per keystroke.
watchDebounced(
  [geoipCityDatabaseURL, geoipASNDatabaseURL],
  () => {
    readerCache.clear()
    geoInfoCache.clear()
    geoInfoPending.clear()
  },
  { debounce: 800 },
)

// Re-run unresolved lookups after the optional token changes. MMDB readers stay
// warm because the token only affects the remote fallback.
watchDebounced(
  geoipIPInfoToken,
  () => {
    geoInfoCache.clear()
    geoInfoPending.clear()
  },
  { debounce: 800 },
)
