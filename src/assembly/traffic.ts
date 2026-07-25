import {
  fetchTrafficCapabilitiesAPI,
  queryTrafficSummaryAPI,
  type TrafficSummaryQueryRequest,
  type TrafficSummaryQueryResponse,
  type TrafficSummaryRowResponse,
} from '@/api/traffic'
import { getBackendConnectionKey } from '@/helper/utils'
import { activeBackend } from '@/store/setup'
import {
  clearTrafficStatisticsState,
  isTrafficCapabilitiesCurrent,
  lastTrafficSummaryQuery,
  trafficCapabilities,
  trafficCapabilitiesChecked,
  trafficCapabilitiesConnectionKey,
  trafficCapabilitiesLoading,
  trafficDestinationAvailableFrom,
  trafficStatisticsSupported,
  trafficSummaryFailed,
  trafficSummaryLoading,
  trafficSummaryPage,
  trafficSummaryRows,
  trafficSummaryTotals,
  trafficSummaryWindow,
  type TrafficSummaryRow,
} from '@/store/trafficStatistics'

const UINT64_MAX = 18_446_744_073_709_551_615n
const UINT64_PATTERN = /^\d+$/

let capabilityRequest = 0
let summaryRequest = 0
let capabilityRetryTimer: ReturnType<typeof setTimeout> | undefined
let capabilityRetryDelay = 2_000

const clearCapabilityRetry = (resetDelay: boolean) => {
  if (capabilityRetryTimer !== undefined) {
    clearTimeout(capabilityRetryTimer)
    capabilityRetryTimer = undefined
  }
  if (resetDelay) {
    capabilityRetryDelay = 2_000
  }
}

const scheduleCapabilityRetry = (backendKey: string) => {
  clearCapabilityRetry(false)
  const delay = capabilityRetryDelay
  capabilityRetryDelay = Math.min(capabilityRetryDelay * 2, 60_000)
  capabilityRetryTimer = setTimeout(() => {
    capabilityRetryTimer = undefined
    if (isCurrentBackend(backendKey) && !isTrafficCapabilitiesCurrent(backendKey)) {
      void probeTrafficStatisticsCapabilities()
    }
  }, delay)
}

const parseUint64 = (value: string, field: string) => {
  if (!UINT64_PATTERN.test(value)) {
    throw new TypeError(`${field} is not a decimal uint64`)
  }

  const parsed = BigInt(value)
  if (parsed > UINT64_MAX) {
    throw new RangeError(`${field} exceeds uint64`)
  }
  return parsed
}

const normalizeRow = (row: TrafficSummaryRowResponse): TrafficSummaryRow => ({
  configRevision: row.config_revision,
  routeTag: row.route_tag,
  groupPath: [...row.group_path],
  destination: row.destination,
  destinationType: row.destination_type,
  destinationDomain: row.destination_domain,
  outboundGroup: row.outbound_group,
  actualOutboundTag: row.actual_outbound_tag,
  actualOutboundType: row.actual_outbound_type,
  network: row.network,
  uplinkBytes: parseUint64(row.uplink_bytes, 'uplink_bytes'),
  downlinkBytes: parseUint64(row.downlink_bytes, 'downlink_bytes'),
  connections: parseUint64(row.connections, 'connections'),
})

const parseSafeInteger = (value: number, field: string, minimum: number) => {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new TypeError(`${field} is not a valid integer`)
  }
  return value
}

const parseTrafficSummaryPage = (response: TrafficSummaryQueryResponse) => ({
  groupBy: response.group_by,
  page: parseSafeInteger(response.page, 'page', 1),
  pageSize: parseSafeInteger(response.page_size, 'page_size', 1),
  totalRows: parseSafeInteger(response.total_rows, 'total_rows', 0),
})

const isCurrentBackend = (backendKey: string) =>
  getBackendConnectionKey(activeBackend.value) === backendKey

export const resetTrafficStatistics = () => {
  capabilityRequest++
  summaryRequest++
  clearCapabilityRetry(true)
  clearTrafficStatisticsState()
}

export const probeTrafficStatisticsCapabilities = async () => {
  clearCapabilityRetry(false)
  const backendKey = getBackendConnectionKey(activeBackend.value)
  const request = ++capabilityRequest

  trafficCapabilities.value = null
  trafficCapabilitiesConnectionKey.value = backendKey
  trafficCapabilitiesChecked.value = false
  trafficCapabilitiesLoading.value = !!backendKey

  if (!backendKey) {
    trafficCapabilitiesChecked.value = true
    return false
  }

  try {
    const response = await fetchTrafficCapabilitiesAPI()
    if (request !== capabilityRequest || !isCurrentBackend(backendKey)) return false

    clearCapabilityRetry(true)
    trafficCapabilities.value = response
    trafficCapabilitiesChecked.value = true
    return trafficStatisticsSupported.value
  } catch {
    if (request !== capabilityRequest || !isCurrentBackend(backendKey)) return false

    trafficCapabilities.value = null
    trafficCapabilitiesChecked.value = false
    scheduleCapabilityRetry(backendKey)
    return false
  } finally {
    if (request === capabilityRequest && isCurrentBackend(backendKey)) {
      trafficCapabilitiesLoading.value = false
    }
  }
}

export const ensureTrafficStatisticsCapabilities = async () => {
  for (let attempt = 0; attempt < 2; attempt++) {
    const backendKey = getBackendConnectionKey(activeBackend.value)
    if (!backendKey) return false

    if (isTrafficCapabilitiesCurrent(backendKey)) {
      return trafficStatisticsSupported.value
    }

    await probeTrafficStatisticsCapabilities()
    if (
      backendKey === getBackendConnectionKey(activeBackend.value) &&
      isTrafficCapabilitiesCurrent(backendKey)
    ) {
      return trafficStatisticsSupported.value
    }
  }

  return false
}

export const queryTrafficSummary = async (query: TrafficSummaryQueryRequest = {}) => {
  const backendKey = getBackendConnectionKey(activeBackend.value)
  if (
    !backendKey ||
    !isTrafficCapabilitiesCurrent(backendKey) ||
    !trafficStatisticsSupported.value
  ) {
    return false
  }

  const request = ++summaryRequest
  trafficSummaryLoading.value = true
  trafficSummaryFailed.value = false
  lastTrafficSummaryQuery.value = { ...query }

  try {
    let effectiveQuery = { ...query }
    let response = await queryTrafficSummaryAPI(effectiveQuery)
    if (request !== summaryRequest || !isCurrentBackend(backendKey)) return false

    let page = parseTrafficSummaryPage(response)
    for (let fallbackAttempt = 0; ; fallbackAttempt++) {
      const lastPage = Math.max(1, Math.ceil(page.totalRows / page.pageSize))
      if (page.page <= lastPage) break
      if (fallbackAttempt >= 2) {
        throw new RangeError('traffic summary page remained out of range')
      }

      effectiveQuery = {
        ...effectiveQuery,
        page: lastPage,
        page_size: page.pageSize,
      }
      response = await queryTrafficSummaryAPI(effectiveQuery)
      if (request !== summaryRequest || !isCurrentBackend(backendKey)) return false
      page = parseTrafficSummaryPage(response)
    }

    const rows = response.rows.map(normalizeRow)
    const totals = {
      uplink: parseUint64(response.totals.uplink_bytes, 'totals.uplink_bytes'),
      downlink: parseUint64(response.totals.downlink_bytes, 'totals.downlink_bytes'),
      connections: parseUint64(response.totals.connections, 'totals.connections'),
    }
    const window =
      response.actual_from && response.actual_to
        ? {
            actualFrom: response.actual_from,
            actualTo: response.actual_to,
          }
        : null

    trafficSummaryRows.value = rows
    trafficSummaryTotals.value = totals
    trafficSummaryPage.value = page
    trafficSummaryWindow.value = window
    trafficDestinationAvailableFrom.value = response.destination_available_from ?? ''
    lastTrafficSummaryQuery.value = effectiveQuery
    return true
  } catch {
    if (request !== summaryRequest || !isCurrentBackend(backendKey)) return false

    trafficSummaryFailed.value = true
    return false
  } finally {
    if (request === summaryRequest && isCurrentBackend(backendKey)) {
      trafficSummaryLoading.value = false
    }
  }
}
