import type {
  TrafficCapabilitiesResponse,
  TrafficGroupBy,
  TrafficSortBy,
  TrafficSummaryQueryRequest,
} from '@/api/traffic'
import { useStorage } from '@vueuse/core'
import { computed, ref, shallowRef } from 'vue'

export type TrafficSummaryRow = {
  configRevision: string
  routeTag: string
  groupPath: string[]
  destination: string
  destinationType: '' | 'domain' | 'ip'
  destinationDomain: string
  outboundGroup: string
  actualOutboundTag: string
  actualOutboundType: string
  network: string
  uplinkBytes: bigint
  downlinkBytes: bigint
  connections: bigint
}

export type TrafficSummaryPage = {
  groupBy: TrafficGroupBy
  page: number
  pageSize: number
  totalRows: number
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

const emptyTrafficSummaryPage = (): TrafficSummaryPage => ({
  groupBy: 'route_path',
  page: 1,
  pageSize: 25,
  totalRows: 0,
})

const requiredDimensions = [
  'config_revision',
  'route_tag',
  'group_path',
  'destination',
  'destination_type',
  'destination_domain',
  'outbound_group',
  'actual_outbound_tag',
  'actual_outbound_type',
  'network',
] as const

const requiredGroupings = [
  'route_path',
  'destination',
  'destination_domain',
  'outbound_group',
  'actual_outbound',
] satisfies TrafficGroupBy[]

const defaultTrafficGroupBy: TrafficGroupBy = 'route_path'

export const trafficGroupByByBackend = useStorage<Record<string, TrafficGroupBy>>(
  'config/traffic-statistics-group-by-by-backend',
  {},
)

export const getTrafficGroupByPreference = (backendUuid: string | null | undefined) => {
  if (!backendUuid) return defaultTrafficGroupBy

  const groupBy = trafficGroupByByBackend.value[backendUuid]
  return requiredGroupings.includes(groupBy) ? groupBy : defaultTrafficGroupBy
}

export const setTrafficGroupByPreference = (
  backendUuid: string | null | undefined,
  groupBy: TrafficGroupBy,
) => {
  if (!backendUuid || !requiredGroupings.includes(groupBy)) return

  trafficGroupByByBackend.value = {
    ...trafficGroupByByBackend.value,
    [backendUuid]: groupBy,
  }
}

const requiredSortFields = [
  'name',
  'total_bytes',
  'uplink_bytes',
  'downlink_bytes',
  'connections',
] satisfies TrafficSortBy[]

export const trafficCapabilities = shallowRef<TrafficCapabilitiesResponse | null>(null)
export const trafficCapabilitiesConnectionKey = ref('')
export const trafficCapabilitiesChecked = ref(false)
export const trafficCapabilitiesLoading = ref(false)

export const isTrafficCapabilitiesCurrent = (connectionKey: string) =>
  trafficCapabilitiesChecked.value && trafficCapabilitiesConnectionKey.value === connectionKey

export const trafficStatisticsSupported = computed(() => {
  const value = trafficCapabilities.value

  return (
    value?.api_version === '2' &&
    value.metric_scope === 'logical_payload' &&
    value.features?.summary === true &&
    value.features?.targets === true &&
    value.features?.pagination === true &&
    value.features?.sorting === true &&
    value.features?.filtering === true &&
    Number.isSafeInteger(value.bucket_seconds) &&
    value.bucket_seconds > 0 &&
    Number.isSafeInteger(value.retention_seconds) &&
    value.retention_seconds > 0 &&
    Number.isSafeInteger(value.max_page_size) &&
    value.max_page_size > 0 &&
    Array.isArray(value.dimensions) &&
    requiredDimensions.every((dimension) => value.dimensions.includes(dimension)) &&
    Array.isArray(value.groupings) &&
    requiredGroupings.every((grouping) => value.groupings.includes(grouping)) &&
    Array.isArray(value.sort_fields) &&
    requiredSortFields.every((sortField) => value.sort_fields.includes(sortField))
  )
})

export const trafficSummaryRows = shallowRef<TrafficSummaryRow[]>([])
export const trafficSummaryTotals = shallowRef<TrafficSummaryTotals>(emptyTrafficSummaryTotals())
export const trafficSummaryPage = shallowRef<TrafficSummaryPage>(emptyTrafficSummaryPage())
export const trafficSummaryWindow = shallowRef<TrafficSummaryWindow | null>(null)
export const trafficDestinationAvailableFrom = ref('')
export const trafficSummaryLoading = ref(false)
export const trafficSummaryFailed = ref(false)
export const lastTrafficSummaryQuery = shallowRef<TrafficSummaryQueryRequest>({})

export const clearTrafficSummaryResult = () => {
  trafficSummaryRows.value = []
  trafficSummaryTotals.value = emptyTrafficSummaryTotals()
  trafficSummaryPage.value = emptyTrafficSummaryPage()
  trafficSummaryWindow.value = null
  trafficDestinationAvailableFrom.value = ''
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
