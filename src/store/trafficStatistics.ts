import type { TrafficCapabilitiesResponse, TrafficSummaryQueryRequest } from '@/api/traffic'
import { computed, ref, shallowRef } from 'vue'

export type TrafficSummaryRow = {
  configRevision: string
  routeTag: string
  groupPath: string[]
  actualOutboundTag: string
  actualOutboundType: string
  network: string
  uplinkBytes: bigint
  downlinkBytes: bigint
  connections: bigint
}

export type TrafficSummaryWindow = {
  actualFrom: string
  actualTo: string
}

export type TrafficSummaryTotals = {
  uplink: bigint
  downlink: bigint
  connections: bigint
}

const emptyTrafficSummaryTotals = (): TrafficSummaryTotals => ({
  uplink: 0n,
  downlink: 0n,
  connections: 0n,
})

const requiredDimensions = [
  'config_revision',
  'route_tag',
  'group_path',
  'actual_outbound_tag',
  'actual_outbound_type',
  'network',
] as const

export const trafficCapabilities = shallowRef<TrafficCapabilitiesResponse | null>(null)
export const trafficCapabilitiesConnectionKey = ref('')
export const trafficCapabilitiesChecked = ref(false)
export const trafficCapabilitiesLoading = ref(false)

export const isTrafficCapabilitiesCurrent = (connectionKey: string) =>
  trafficCapabilitiesChecked.value && trafficCapabilitiesConnectionKey.value === connectionKey

export const trafficStatisticsSupported = computed(() => {
  const value = trafficCapabilities.value

  return (
    value?.api_version === '1' &&
    value.metric_scope === 'logical_payload' &&
    value.features?.summary === true &&
    Number.isSafeInteger(value.bucket_seconds) &&
    value.bucket_seconds > 0 &&
    Number.isSafeInteger(value.retention_seconds) &&
    value.retention_seconds > 0 &&
    Array.isArray(value.dimensions) &&
    requiredDimensions.every((dimension) => value.dimensions.includes(dimension))
  )
})

export const trafficSummaryRows = shallowRef<TrafficSummaryRow[]>([])
export const trafficSummaryTotals = shallowRef<TrafficSummaryTotals>(emptyTrafficSummaryTotals())
export const trafficSummaryWindow = shallowRef<TrafficSummaryWindow | null>(null)
export const trafficSummaryLoading = ref(false)
export const trafficSummaryFailed = ref(false)
export const trafficSummaryTruncated = ref(false)
export const lastTrafficSummaryQuery = shallowRef<TrafficSummaryQueryRequest>({})

export const clearTrafficSummaryResult = () => {
  trafficSummaryRows.value = []
  trafficSummaryTotals.value = emptyTrafficSummaryTotals()
  trafficSummaryWindow.value = null
  trafficSummaryTruncated.value = false
}

export const clearTrafficStatisticsState = () => {
  trafficCapabilities.value = null
  trafficCapabilitiesConnectionKey.value = ''
  trafficCapabilitiesChecked.value = false
  trafficCapabilitiesLoading.value = false
  clearTrafficSummaryResult()
  trafficSummaryLoading.value = false
  trafficSummaryFailed.value = false
  lastTrafficSummaryQuery.value = {}
}
