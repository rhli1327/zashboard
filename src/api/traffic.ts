import axios from 'axios'

export const TRAFFIC_CAPABILITIES_PATH = '/mbox/v1/traffic/capabilities'
export const TRAFFIC_QUERY_PATH = '/mbox/v1/traffic/query'

export type TrafficMetricScope = 'logical_payload' | (string & {})

export type TrafficFeatureSet = {
  summary: boolean
  series: boolean
  targets: boolean
}

export type TrafficCapabilitiesResponse = {
  api_version: string
  metric_scope: TrafficMetricScope
  features: TrafficFeatureSet
  dimensions: string[]
  bucket_seconds: number
  retention_seconds: number
}

export type TrafficSummaryQueryRequest = {
  from?: string
  to?: string
  route_tags?: string[]
  actual_outbound_tags?: string[]
  networks?: string[]
  limit?: number
}

export type TrafficSummaryRowResponse = {
  config_revision: string
  route_tag: string
  group_path: string[]
  actual_outbound_tag: string
  actual_outbound_type: string
  network: string
  uplink_bytes: string
  downlink_bytes: string
  connections: string
}

export type TrafficSummaryQueryResponse = {
  actual_from?: string
  actual_to?: string
  totals: {
    uplink_bytes: string
    downlink_bytes: string
    connections: string
  }
  rows: TrafficSummaryRowResponse[]
  truncated: boolean
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
