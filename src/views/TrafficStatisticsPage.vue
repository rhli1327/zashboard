<template>
  <div class="relative flex h-full min-h-0 flex-col">
    <CtrlsBar>
      <div class="flex items-center justify-between gap-2 p-2">
        <select
          v-model="selectedRange"
          class="select select-sm min-w-36"
          :aria-label="$t('trafficTimeRange')"
          @change="load"
        >
          <option value="retained">{{ $t('trafficAllRetained') }}</option>
          <option value="24h">{{ $t('trafficLast24Hours') }}</option>
          <option value="7d">{{ $t('trafficLast7Days') }}</option>
          <option value="30d">{{ $t('trafficLast30Days') }}</option>
        </select>

        <button
          class="btn btn-sm"
          :disabled="trafficSummaryLoading"
          @click="load"
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

        <div
          v-if="trafficSummaryTruncated"
          class="alert alert-warning alert-soft"
        >
          {{ $t('trafficResultTruncated') }}
        </div>

        <section class="base-container overflow-hidden">
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
          >
            <table class="table-sm table">
              <thead>
                <tr>
                  <th>{{ $t('trafficRoutePath') }}</th>
                  <th>{{ $t('trafficNetwork') }}</th>
                  <th class="text-right">{{ $t('upload') }}</th>
                  <th class="text-right">{{ $t('download') }}</th>
                  <th class="text-right">{{ $t('trafficFlows') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(row, rowIndex) in trafficSummaryRows"
                  :key="rowKey(row, rowIndex)"
                >
                  <td>
                    <div class="flex min-w-max items-center gap-1">
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
                    <div class="text-base-content/40 mt-1 flex gap-2 text-xs">
                      <span v-if="row.actualOutboundType">{{ row.actualOutboundType }}</span>
                      <span v-if="row.configRevision">{{ row.configRevision }}</span>
                    </div>
                  </td>
                  <td>
                    <span class="badge badge-sm badge-ghost uppercase">{{ row.network }}</span>
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
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { queryTrafficSummary } from '@/assembly/traffic'
import CtrlsBar from '@/components/common/CtrlsBar.vue'
import { usePaddingForViews } from '@/composables/paddingViews'
import {
  trafficSummaryFailed,
  trafficSummaryLoading,
  trafficSummaryRows,
  trafficSummaryTotals,
  trafficSummaryTruncated,
  trafficSummaryWindow,
  type TrafficSummaryRow,
} from '@/store/trafficStatistics'
import { ArrowPathIcon, ChevronRightIcon } from '@heroicons/vue/24/outline'
import dayjs from 'dayjs'
import { onMounted, ref } from 'vue'

type RangePreset = 'retained' | '24h' | '7d' | '30d'

const selectedRange = ref<RangePreset>('retained')

const { padding } = usePaddingForViews({
  offsetTop: 8,
  offsetBottom: 8,
})

const load = () => {
  if (selectedRange.value === 'retained') {
    return queryTrafficSummary()
  }

  const duration = {
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
  }[selectedRange.value]
  const to = new Date()

  return queryTrafficSummary({
    from: new Date(to.getTime() - duration).toISOString(),
    to: to.toISOString(),
  })
}

const totals = trafficSummaryTotals

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
    row.configRevision,
    row.routeTag,
    row.groupPath.join('\u0000'),
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

onMounted(load)
</script>
