<template>
  <div class="relative flex h-full min-h-0 flex-col">
    <CtrlsBar>
      <div class="flex flex-wrap items-center justify-between gap-2 p-2">
        <div class="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <select
            v-model="selectedRange"
            class="select select-sm min-w-36"
            :aria-label="$t('trafficTimeRange')"
            @change="changeTimeRange"
          >
            <option value="retained">{{ $t('trafficAllRetained') }}</option>
            <option value="24h">{{ $t('trafficLast24Hours') }}</option>
            <option value="7d">{{ $t('trafficLast7Days') }}</option>
            <option value="30d">{{ $t('trafficLast30Days') }}</option>
          </select>

          <select
            v-model="selectedGroupBy"
            class="select select-sm min-w-32"
            :aria-label="$t('trafficGrouping')"
            @change="resetPageAndLoad"
          >
            <option value="route_path">{{ $t('trafficGroupRoutePath') }}</option>
            <option value="destination_domain">
              {{ $t('trafficGroupDestinationDomain') }}
            </option>
            <option value="outbound_group">{{ $t('trafficGroupOutboundGroup') }}</option>
            <option value="actual_outbound">{{ $t('trafficGroupActualOutbound') }}</option>
          </select>
        </div>

        <button
          class="btn btn-sm"
          :disabled="trafficSummaryLoading"
          @click="refresh"
        >
          <ArrowPathIcon
            class="h-4 w-4"
            :class="{ 'animate-spin': trafficSummaryLoading }"
          />
          <span class="hidden sm:inline">{{ $t('refresh') }}</span>
        </button>
      </div>
    </CtrlsBar>

    <div
      class="min-h-0 flex-1 overflow-y-auto"
      :style="padding"
    >
      <div class="flex flex-col gap-3 p-3">
        <section class="base-container p-4">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 class="text-lg font-semibold">{{ $t('trafficStatistics') }}</h1>
              <p class="text-base-content/55 mt-1 text-sm">
                {{ $t('trafficStatisticsDescription') }}
              </p>
            </div>
            <span class="badge badge-soft badge-primary">
              {{ $t('trafficLogicalPayload') }}
            </span>
          </div>

          <div
            v-if="trafficSummaryWindow"
            class="text-base-content/45 mt-3 text-xs"
          >
            {{
              $t('trafficActualRange', {
                from: formatTimestamp(trafficSummaryWindow.actualFrom),
                to: formatTimestamp(trafficSummaryWindow.actualTo),
              })
            }}
          </div>
          <div
            v-if="selectedGroupBy === 'destination_domain' && targetAvailableFrom"
            class="text-info mt-2 flex items-center gap-1.5 text-xs"
          >
            <InformationCircleIcon class="h-4 w-4 shrink-0" />
            {{
              $t('trafficDomainAvailableFrom', {
                time: formatTimestamp(targetAvailableFrom),
              })
            }}
          </div>
        </section>

        <section class="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div class="base-container p-4">
            <div class="text-base-content/50 text-xs font-medium tracking-wide uppercase">
              {{ $t('upload') }}
            </div>
            <div class="mt-2 text-2xl font-light tabular-nums">
              {{ formatBytes(totals.uplink) }}
            </div>
          </div>
          <div class="base-container p-4">
            <div class="text-base-content/50 text-xs font-medium tracking-wide uppercase">
              {{ $t('download') }}
            </div>
            <div class="mt-2 text-2xl font-light tabular-nums">
              {{ formatBytes(totals.downlink) }}
            </div>
          </div>
          <div class="base-container p-4">
            <div class="text-base-content/50 text-xs font-medium tracking-wide uppercase">
              {{ $t('trafficFlows') }}
            </div>
            <div class="mt-2 text-2xl font-light tabular-nums">
              {{ totals.connections.toLocaleString() }}
            </div>
          </div>
        </section>

        <div
          v-if="trafficSummaryFailed"
          class="alert alert-error alert-soft"
        >
          {{ $t('trafficLoadFailed') }}
        </div>

        <section class="base-container overflow-hidden">
          <div class="border-base-300 flex flex-col gap-2 border-b p-3 sm:flex-row">
            <div class="relative min-w-0 flex-1">
              <MagnifyingGlassIcon
                class="text-base-content/35 pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
              />
              <input
                v-model="searchInput"
                type="search"
                class="input input-sm w-full pr-8 pl-9 sm:max-w-sm"
                :aria-label="$t('trafficSearch')"
                :placeholder="$t('trafficSearchPlaceholder')"
                @input="scheduleSearch"
                @keydown.enter.prevent="applySearchNow"
              />
              <button
                v-if="searchInput"
                type="button"
                class="btn btn-ghost btn-circle btn-xs absolute top-1/2 right-2 -translate-y-1/2"
                :aria-label="$t('trafficClearSearch')"
                @click="clearSearch"
              >
                <XMarkIcon class="h-3.5 w-3.5" />
              </button>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <select
                v-model="selectedNetwork"
                class="select select-sm"
                :aria-label="$t('trafficNetworkFilter')"
                @change="resetPageAndLoad"
              >
                <option value="">{{ $t('trafficAllNetworks') }}</option>
                <option value="tcp">TCP</option>
                <option value="udp">UDP</option>
              </select>

              <select
                v-model.number="selectedPageSize"
                class="select select-sm"
                :aria-label="$t('trafficPageSize')"
                @change="resetPageAndLoad"
              >
                <option
                  v-for="size in pageSizeOptions"
                  :key="size"
                  :value="size"
                >
                  {{ $t('trafficRowsPerPage', { count: size }) }}
                </option>
              </select>
            </div>
          </div>

          <div
            v-if="trafficSummaryLoading && !trafficSummaryRows.length"
            class="flex min-h-40 items-center justify-center"
          >
            <span class="loading loading-spinner loading-md"></span>
          </div>
          <div
            v-else-if="!trafficSummaryRows.length"
            class="text-base-content/45 flex min-h-40 items-center justify-center text-sm"
          >
            {{ $t('noData') }}
          </div>
          <div
            v-else
            class="overflow-x-auto"
            :class="{ 'opacity-60': trafficSummaryLoading }"
          >
            <table class="table-sm table">
              <thead>
                <tr>
                  <th
                    v-for="column in tableColumns"
                    :key="column.key"
                    :class="{ 'text-right': column.alignRight }"
                    :aria-sort="column.sortBy ? ariaSort(column.sortBy) : undefined"
                  >
                    <button
                      v-if="column.sortBy"
                      type="button"
                      class="inline-flex w-full items-center gap-1 whitespace-nowrap"
                      :class="{ 'justify-end': column.alignRight }"
                      :aria-label="sortButtonLabel(column.label, column.sortBy)"
                      @click="toggleSort(column.sortBy)"
                    >
                      <span>{{ column.label }}</span>
                      <span
                        v-if="selectedSortBy === column.sortBy"
                        class="text-[10px] font-normal opacity-60"
                      >
                        {{
                          selectedSortOrder === 'asc'
                            ? $t('trafficAscending')
                            : $t('trafficDescending')
                        }}
                      </span>
                      <component
                        :is="sortIcon(column.sortBy)"
                        class="h-3.5 w-3.5 shrink-0"
                        :class="{
                          'text-base-content/30': selectedSortBy !== column.sortBy,
                        }"
                      />
                    </button>
                    <span v-else>{{ column.label }}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(row, rowIndex) in trafficSummaryRows"
                  :key="rowKey(row, rowIndex)"
                >
                  <td>
                    <template v-if="selectedGroupBy === 'route_path'">
                      <div
                        v-if="routePath(row).length"
                        class="flex min-w-max items-center gap-1"
                      >
                        <template
                          v-for="(tag, tagIndex) in routePath(row)"
                          :key="`${tagIndex}:${tag}`"
                        >
                          <ChevronRightIcon
                            v-if="tagIndex"
                            class="text-base-content/30 h-3.5 w-3.5 shrink-0"
                          />
                          <span
                            class="rounded-full px-2 py-0.5 text-xs"
                            :class="
                              tagIndex === routePath(row).length - 1
                                ? 'bg-primary/12 text-primary font-medium'
                                : 'bg-base-200'
                            "
                          >
                            {{ tag }}
                          </span>
                        </template>
                      </div>
                      <span
                        v-else
                        class="text-base-content/45"
                      >
                        {{ $t('trafficNoRoutePath') }}
                      </span>
                    </template>

                    <span
                      v-else-if="selectedGroupBy === 'destination_domain'"
                      class="font-medium"
                    >
                      {{ row.destinationDomain || $t('trafficNoDestinationDomain') }}
                    </span>

                    <span
                      v-else-if="selectedGroupBy === 'outbound_group'"
                      class="badge badge-ghost"
                    >
                      {{ row.outboundGroup || $t('trafficNoOutboundGroup') }}
                    </span>

                    <div
                      v-else
                      class="flex items-center gap-2"
                    >
                      <span class="badge badge-soft badge-primary">
                        {{ row.actualOutboundTag || $t('trafficNoActualOutbound') }}
                      </span>
                      <span
                        v-if="row.actualOutboundType"
                        class="text-base-content/45 text-xs"
                      >
                        {{ row.actualOutboundType }}
                      </span>
                    </div>

                    <div
                      v-if="
                        selectedGroupBy === 'route_path' &&
                        (row.actualOutboundType || row.configRevision)
                      "
                      class="text-base-content/40 mt-1 flex gap-2 text-xs"
                    >
                      <span v-if="row.actualOutboundType">{{ row.actualOutboundType }}</span>
                      <span v-if="row.configRevision">{{ row.configRevision }}</span>
                    </div>
                  </td>
                  <td v-if="selectedGroupBy === 'route_path'">
                    <span class="badge badge-sm badge-ghost uppercase">
                      {{ row.network || selectedNetwork || '—' }}
                    </span>
                  </td>
                  <td class="text-right font-mono text-xs tabular-nums">
                    {{ formatBytes(row.uplinkBytes + row.downlinkBytes) }}
                  </td>
                  <td class="text-right font-mono text-xs tabular-nums">
                    {{ formatBytes(row.uplinkBytes) }}
                  </td>
                  <td class="text-right font-mono text-xs tabular-nums">
                    {{ formatBytes(row.downlinkBytes) }}
                  </td>
                  <td class="text-right font-mono text-xs tabular-nums">
                    {{ row.connections.toLocaleString() }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div
            class="border-base-300 flex flex-wrap items-center justify-between gap-2 border-t p-3"
          >
            <span class="text-base-content/50 text-xs tabular-nums">
              {{
                $t('trafficRowsRange', {
                  from: firstVisibleRow,
                  to: lastVisibleRow,
                  total: trafficSummaryPage.totalRows.toLocaleString(),
                })
              }}
            </span>

            <div class="flex items-center gap-2">
              <button
                type="button"
                class="btn btn-sm"
                :disabled="trafficSummaryLoading || currentPage <= 1"
                :aria-label="$t('trafficPreviousPage')"
                @click="previousPage"
              >
                <ChevronLeftIcon class="h-4 w-4" />
                <span class="hidden sm:inline">{{ $t('trafficPreviousPage') }}</span>
              </button>
              <span class="text-sm tabular-nums">
                {{
                  $t('trafficPageStatus', {
                    page: currentPage,
                    pages: totalPages,
                  })
                }}
              </span>
              <button
                type="button"
                class="btn btn-sm"
                :disabled="trafficSummaryLoading || currentPage >= totalPages"
                :aria-label="$t('trafficNextPage')"
                @click="nextPage"
              >
                <span class="hidden sm:inline">{{ $t('trafficNextPage') }}</span>
                <ChevronRightIcon class="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type {
  TrafficGroupBy,
  TrafficSortBy,
  TrafficSortOrder,
  TrafficSummaryQueryRequest,
} from '@/api/traffic'
import { queryTrafficSummary } from '@/assembly/traffic'
import CtrlsBar from '@/components/common/CtrlsBar.vue'
import { usePaddingForViews } from '@/composables/paddingViews'
import {
  clearTrafficSummaryResult,
  trafficCapabilities,
  trafficSummaryFailed,
  trafficSummaryLoading,
  trafficSummaryPage,
  trafficSummaryRows,
  trafficSummaryTotals,
  trafficSummaryWindow,
  trafficTargetAvailableFrom,
  type TrafficSummaryRow,
} from '@/store/trafficStatistics'
import {
  ArrowDownIcon,
  ArrowPathIcon,
  ArrowUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpDownIcon,
  InformationCircleIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from '@heroicons/vue/24/outline'
import dayjs from 'dayjs'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

type RangePreset = 'retained' | '24h' | '7d' | '30d'
type NetworkFilter = '' | 'tcp' | 'udp'

const { t } = useI18n()
const selectedRange = ref<RangePreset>('retained')
const selectedGroupBy = ref<TrafficGroupBy>('route_path')
const selectedNetwork = ref<NetworkFilter>('')
const selectedPageSize = ref(50)
const selectedSortBy = ref<TrafficSortBy>('total_bytes')
const selectedSortOrder = ref<TrafficSortOrder>('desc')
const searchInput = ref('')
const appliedSearch = ref('')
const frozenWindow = ref<Pick<TrafficSummaryQueryRequest, 'from' | 'to'>>({})
let searchTimer: ReturnType<typeof setTimeout> | undefined

const { padding } = usePaddingForViews({
  offsetTop: 8,
  offsetBottom: 8,
})

const pageSizeOptions = computed(() => {
  const maxPageSize = trafficCapabilities.value?.max_page_size ?? 100
  const options = [25, 50, 100].filter((size) => size <= maxPageSize)

  return options.length ? options : [maxPageSize]
})

const groupingTitle = computed(() => {
  const labels: Record<TrafficGroupBy, string> = {
    route_path: t('trafficGroupRoutePath'),
    destination_domain: t('trafficGroupDestinationDomain'),
    outbound_group: t('trafficGroupOutboundGroup'),
    actual_outbound: t('trafficGroupActualOutbound'),
  }

  return labels[selectedGroupBy.value]
})

const tableColumns = computed<
  {
    key: string
    label: string
    sortBy?: TrafficSortBy
    alignRight?: boolean
  }[]
>(() => {
  const columns = [
    { key: 'name', label: groupingTitle.value, sortBy: 'name' as TrafficSortBy },
    ...(selectedGroupBy.value === 'route_path'
      ? [{ key: 'network', label: t('trafficNetwork') }]
      : []),
    {
      key: 'total',
      label: t('trafficTotalTraffic'),
      sortBy: 'total_bytes' as TrafficSortBy,
      alignRight: true,
    },
    {
      key: 'uplink',
      label: t('upload'),
      sortBy: 'uplink_bytes' as TrafficSortBy,
      alignRight: true,
    },
    {
      key: 'downlink',
      label: t('download'),
      sortBy: 'downlink_bytes' as TrafficSortBy,
      alignRight: true,
    },
    {
      key: 'connections',
      label: t('trafficFlows'),
      sortBy: 'connections' as TrafficSortBy,
      alignRight: true,
    },
  ]

  return columns
})

const totals = trafficSummaryTotals
const targetAvailableFrom = computed(
  () => trafficTargetAvailableFrom.value || trafficCapabilities.value?.target_available_from || '',
)
const currentPage = computed(() => trafficSummaryPage.value.page)
const totalPages = computed(() =>
  Math.max(1, Math.ceil(trafficSummaryPage.value.totalRows / trafficSummaryPage.value.pageSize)),
)
const firstVisibleRow = computed(() =>
  trafficSummaryPage.value.totalRows
    ? (currentPage.value - 1) * trafficSummaryPage.value.pageSize + 1
    : 0,
)
const lastVisibleRow = computed(() =>
  Math.min(
    currentPage.value * trafficSummaryPage.value.pageSize,
    trafficSummaryPage.value.totalRows,
  ),
)

const rebuildQueryWindow = () => {
  const bucketMilliseconds = (trafficCapabilities.value?.bucket_seconds ?? 60) * 1000
  const to = new Date(Math.floor(Date.now() / bucketMilliseconds) * bucketMilliseconds)
  if (selectedRange.value === 'retained') {
    frozenWindow.value = { to: to.toISOString() }
    return
  }
  const duration = {
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
  }[selectedRange.value]

  frozenWindow.value = {
    from: new Date(to.getTime() - duration).toISOString(),
    to: to.toISOString(),
  }
}

const buildQuery = (page: number): TrafficSummaryQueryRequest => ({
  ...frozenWindow.value,
  group_by: selectedGroupBy.value,
  page,
  page_size: selectedPageSize.value,
  sort_by: selectedSortBy.value,
  sort_order: selectedSortOrder.value,
  ...(appliedSearch.value ? { search: appliedSearch.value } : {}),
  ...(selectedNetwork.value ? { networks: [selectedNetwork.value] } : {}),
})

const load = async (page: number = currentPage.value) => {
  const loaded = await queryTrafficSummary(buildQuery(page))

  if (loaded) {
    selectedPageSize.value = trafficSummaryPage.value.pageSize
  }
  return loaded
}

const resetPageAndLoad = () => {
  clearTrafficSummaryResult()
  return load(1)
}

const changeTimeRange = () => {
  rebuildQueryWindow()
  return resetPageAndLoad()
}

const refresh = () => {
  rebuildQueryWindow()
  return resetPageAndLoad()
}

const applySearchNow = () => {
  if (searchTimer !== undefined) {
    clearTimeout(searchTimer)
    searchTimer = undefined
  }

  const nextSearch = searchInput.value.trim()
  if (nextSearch === appliedSearch.value) return
  appliedSearch.value = nextSearch
  void resetPageAndLoad()
}

const scheduleSearch = () => {
  if (searchTimer !== undefined) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    searchTimer = undefined
    applySearchNow()
  }, 300)
}

const clearSearch = () => {
  searchInput.value = ''
  applySearchNow()
}

const toggleSort = (sortBy: TrafficSortBy) => {
  if (selectedSortBy.value === sortBy) {
    selectedSortOrder.value = selectedSortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    selectedSortBy.value = sortBy
    selectedSortOrder.value = sortBy === 'name' ? 'asc' : 'desc'
  }
  void resetPageAndLoad()
}

const previousPage = () => {
  if (currentPage.value <= 1) return
  void load(currentPage.value - 1)
}

const nextPage = () => {
  if (currentPage.value >= totalPages.value) return
  void load(currentPage.value + 1)
}

const ariaSort = (sortBy: TrafficSortBy) => {
  if (selectedSortBy.value !== sortBy) return 'none' as const
  return selectedSortOrder.value === 'asc' ? ('ascending' as const) : ('descending' as const)
}

const sortButtonLabel = (label: string, sortBy: TrafficSortBy) => {
  if (selectedSortBy.value !== sortBy) {
    return t('trafficSortBy', { field: label })
  }
  return t('trafficSortDirection', {
    field: label,
    direction: selectedSortOrder.value === 'asc' ? t('trafficAscending') : t('trafficDescending'),
  })
}

const sortIcon = (sortBy: TrafficSortBy) => {
  if (selectedSortBy.value !== sortBy) return ChevronUpDownIcon
  return selectedSortOrder.value === 'asc' ? ArrowUpIcon : ArrowDownIcon
}

const routePath = (row: TrafficSummaryRow) => {
  const path = row.groupPath.filter(Boolean)

  if (row.routeTag && path[0] !== row.routeTag) {
    path.unshift(row.routeTag)
  }
  if (row.actualOutboundTag && path[path.length - 1] !== row.actualOutboundTag) {
    path.push(row.actualOutboundTag)
  }
  return path
}

const rowKey = (row: TrafficSummaryRow, index: number) =>
  [
    selectedGroupBy.value,
    row.configRevision,
    row.routeTag,
    row.groupPath.join('\u0000'),
    row.destinationDomain,
    row.outboundGroup,
    row.actualOutboundTag,
    row.network,
    index,
  ].join('\u0001')

const formatTimestamp = (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm')

const formatBytes = (value: bigint) => {
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB']
  let divisor = 1n
  let unitIndex = 0

  while (unitIndex < units.length - 1 && value >= divisor * 1024n) {
    divisor *= 1024n
    unitIndex++
  }
  if (unitIndex === 0) return `${value.toLocaleString()} B`

  const tenths = (value * 10n) / divisor
  const fraction = tenths % 10n
  const formatted = fraction === 0n ? (tenths / 10n).toString() : `${tenths / 10n}.${fraction}`

  return `${formatted} ${units[unitIndex]}`
}

onMounted(() => {
  if (!pageSizeOptions.value.includes(selectedPageSize.value)) {
    selectedPageSize.value = pageSizeOptions.value[0]
  }
  rebuildQueryWindow()
  void load()
})

onUnmounted(() => {
  if (searchTimer !== undefined) clearTimeout(searchTimer)
})
</script>
