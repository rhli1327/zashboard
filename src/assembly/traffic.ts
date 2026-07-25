import {
  fetchTrafficCapabilitiesAPI,
  queryTrafficSummaryAPI,
  type TrafficSummaryQueryRequest,
  type TrafficSummaryRowResponse,
} from '@/api/traffic'
import { getBackendConnectionKey } from '@/helper/utils'
import { activeBackend } from '@/store/setup'
import {
  clearTrafficStatisticsState,
  clearTrafficSummaryResult,
  isTrafficCapabilitiesCurrent,
  lastTrafficSummaryQuery,
  trafficCapabilities,
  trafficCapabilitiesChecked,
  trafficCapabilitiesConnectionKey,
  trafficCapabilitiesLoading,
  trafficStatisticsSupported,
  trafficSummaryFailed,
  trafficSummaryLoading,
  trafficSummaryRows,
  trafficSummaryTotals,
  trafficSummaryTruncated,
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
  actualOutboundTag: row.actual_outbound_tag,
  actualOutboundType: row.actual_outbound_type,
  network: row.network,
  uplinkBytes: parseUint64(row.uplink_bytes, 'uplink_bytes'),
  downlinkBytes: parseUint64(row.downlink_bytes, 'downlink_bytes'),
  connections: parseUint64(row.connections, 'connections'),
})

const byTotalTrafficDescending = (left: TrafficSummaryRow, right: TrafficSummaryRow) => {
  const leftTotal = left.uplinkBytes + left.downlinkBytes
  const rightTotal = right.uplinkBytes + right.downlinkBytes

  if (leftTotal === rightTotal) return 0
  return leftTotal > rightTotal ? -1 : 1
}

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
  clearTrafficSummaryResult()
  trafficSummaryLoading.value = true
  trafficSummaryFailed.value = false
  lastTrafficSummaryQuery.value = { ...query }

  try {
    const response = await queryTrafficSummaryAPI(query)
    if (request !== summaryRequest || !isCurrentBackend(backendKey)) return false

    const rows = response.rows.map(normalizeRow).sort(byTotalTrafficDescending)
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
    trafficSummaryWindow.value = window
    trafficSummaryTruncated.value = response.truncated === true
    return true
  } catch {
    if (request !== summaryRequest || !isCurrentBackend(backendKey)) return false

    clearTrafficSummaryResult()
    trafficSummaryFailed.value = true
    return false
  } finally {
    if (request === summaryRequest && isCurrentBackend(backendKey)) {
      trafficSummaryLoading.value = false
    }
  }
}
