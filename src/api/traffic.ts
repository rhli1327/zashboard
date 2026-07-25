import axios from 'axios'

export const TRAFFIC_CAPABILITIES_PATH = '/mbox/v2/traffic/capabilities'
export const TRAFFIC_QUERY_PATH = '/mbox/v2/traffic/query'

export type TrafficMetricScope = 'logical_payload' | (string & {})

export type TrafficGroupBy =
  'route_path' | 'destination' | 'destination_domain' | 'outbound_group' | 'actual_outbound'

export type TrafficDestinationType = '' | 'domain' | 'ip'

export type TrafficSortBy =
  'name' | 'total_bytes' | 'uplink_bytes' | 'downlink_bytes' | 'connections'

export type TrafficSortOrder = 'asc' | 'desc'

export type TrafficFeatureSet = {
  summary: boolean
  series: boolean
  targets: boolean
  pagination: boolean
  sorting: boolean
  filtering: boolean
}

export type TrafficCapabilitiesResponse = {
  api_version: string
  metric_scope: TrafficMetricScope
  features: TrafficFeatureSet
  dimensions: string[]
  groupings: TrafficGroupBy[]
  sort_fields: TrafficSortBy[]
  max_page_size: number
  bucket_seconds: number
  retention_seconds: number
  destination_available_from?: string
  target_available_from?: string
}

export type TrafficSummaryQueryRequest = {
  from?: string
  to?: string
  group_by?: TrafficGroupBy
  page?: number
  page_size?: number
  sort_by?: TrafficSortBy
  sort_order?: TrafficSortOrder
  search?: string
  route_tags?: string[]
  group_tags?: string[]
  actual_outbound_tags?: string[]
  destinations?: string[]
  destination_domains?: string[]
  networks?: string[]
}

export type TrafficSummaryRowResponse = {
  config_revision: string
  route_tag: string
  group_path: string[]
  destination: string
  destination_type: TrafficDestinationType
  destination_domain: string
  outbound_group: string
  actual_outbound_tag: string
  actual_outbound_type: string
  network: string
  uplink_bytes: string
  downlink_bytes: string
  connections: string
}

export type TrafficSummaryQueryResponse = {
  group_by: TrafficGroupBy
  page: number
  page_size: number
  total_rows: number
  actual_from?: string
  actual_to?: string
  destination_available_from?: string
  target_available_from?: string
  totals: {
    uplink_bytes: string
    downlink_bytes: string
    connections: string
  }
  rows: TrafficSummaryRowResponse[]
}

export const fetchTrafficCapabilitiesAPI = async () => {
  const response = await axios.get<TrafficCapabilitiesResponse>(TRAFFIC_CAPABILITIES_PATH, {
    validateStatus: (status) => status === 200 || status === 404,
  })

  return response.status === 200 ? response.data : null
}

export const queryTrafficSummaryAPI = (request: TrafficSummaryQueryRequest) =>
  axios
    .post<TrafficSummaryQueryResponse>(TRAFFIC_QUERY_PATH, request)
    .then((response) => response.data)
