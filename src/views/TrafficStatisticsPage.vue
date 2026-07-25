<template>
  <div class="relative flex h-full min-h-0 flex-col">
    <CtrlsBar>
      <div class="flex h-12 items-center justify-between gap-3 px-3 md:h-auto md:p-2">
        <h1
          class="text-base-content/60 min-w-0 truncate text-xs font-semibold tracking-wider uppercase"
        >
          {{ $t('trafficStatistics') }}
        </h1>
        <button
          class="btn btn-sm h-10 min-h-10 w-10 shrink-0 md:h-8 md:min-h-8 md:w-auto"
          :disabled="trafficSummaryLoading"
          :aria-label="$t('refresh')"
          @click="refresh"
        >
          <ArrowPathIcon
            class="h-4 w-4"
            :class="{ 'animate-spin': trafficSummaryLoading }"
          />
          <span class="hidden md:inline">{{ $t('refresh') }}</span>
        </button>
      </div>
    </CtrlsBar>

    <div
      class="min-h-0 flex-1 overflow-y-auto"
      :style="padding"
    >
      <div class="flex flex-col gap-2 p-2 md:gap-3 md:p-3">
        <section class="base-container overflow-hidden">
          <div class="need-blur p-4 pb-3">
            <p class="text-base-content/60 max-w-3xl text-sm">
              {{ $t('trafficStatisticsDescription') }}
            </p>
          </div>

          <div class="need-blur px-4 pb-4">
            <div class="bg-base-200/30 rounded-xl p-3 md:p-4">
              <div class="grid gap-3 md:grid-cols-2 md:gap-4">
                <label class="min-w-0">
                  <span
                    class="text-base-content/60 mb-1.5 block text-xs font-semibold tracking-wider uppercase"
                  >
                    {{ $t('trafficGrouping') }}
                  </span>
                  <select
                    v-model="selectedGroupBy"
                    class="select select-bordered select-sm h-10 min-h-10 w-full min-w-0 md:h-8 md:min-h-8"
                    @change="changeGrouping"
                  >
                    <option value="route_path">
                      {{
                        $t('trafficGroupByOption', {
                          dimension: $t('trafficGroupRoutePath'),
                        })
                      }}
                    </option>
                    <option value="destination">
                      {{
                        $t('trafficGroupByOption', {
                          dimension: $t('trafficGroupDestination'),
                        })
                      }}
                    </option>
                    <option value="outbound_group">
                      {{
                        $t('trafficGroupByOption', {
                          dimension: $t('trafficGroupOutboundGroup'),
                        })
                      }}
                    </option>
                    <option value="actual_outbound">
                      {{
                        $t('trafficGroupByOption', {
                          dimension: $t('trafficGroupActualOutbound'),
                        })
                      }}
                    </option>
                  </select>
                </label>

                <label class="min-w-0">
                  <span
                    class="text-base-content/60 mb-1.5 block text-xs font-semibold tracking-wider uppercase"
                  >
                    {{ $t('trafficTimeRange') }}
                  </span>
                  <select
                    v-model="selectedRange"
                    class="select select-bordered select-sm h-10 min-h-10 w-full min-w-0 md:h-8 md:min-h-8"
                    @change="changeTimeRange"
                  >
                    <option value="retained">{{ $t('trafficAllRetained') }}</option>
                    <option value="24h">{{ $t('trafficLast24Hours') }}</option>
                    <option value="7d">{{ $t('trafficLast7Days') }}</option>
                    <option value="30d">{{ $t('trafficLast30Days') }}</option>
                  </select>
                </label>
              </div>

              <div class="border-base-300 mt-3 border-t pt-3">
                <div class="flex items-start gap-2">
                  <InformationCircleIcon class="text-primary mt-0.5 h-4 w-4 shrink-0" />
                  <div class="min-w-0">
                    <div class="text-sm font-medium">{{ groupingTitle }}</div>
                    <p class="text-base-content/55 mt-0.5 text-xs leading-relaxed">
                      {{ groupingDescription }}
                    </p>
                  </div>
                </div>

                <div
                  v-if="trafficSummaryWindow"
                  class="text-base-content/45 mt-2 text-xs"
                >
                  {{
                    $t('trafficActualRange', {
                      from: formatTimestamp(trafficSummaryWindow.actualFrom),
                      to: formatTimestamp(trafficSummaryWindow.actualTo),
                    })
                  }}
                </div>
                <details class="text-base-content/45 mt-1 text-xs">
                  <summary class="hover:text-base-content cursor-pointer select-none">
                    {{ $t('trafficMetricScopeDetails') }}
                  </summary>
                  <div class="mt-1.5 space-y-1 pl-1 leading-relaxed">
                    <p>{{ $t('trafficTimeRangeHint') }}</p>
                    <p>{{ $t('trafficMetricScopeHint') }}</p>
                  </div>
                </details>
              </div>
            </div>
          </div>

          <div
            v-if="
              (selectedGroupBy === 'destination' || selectedDestinations.length) &&
              destinationAvailableFrom
            "
            class="text-info mx-4 mb-4 flex items-start gap-1.5 text-xs"
          >
            <InformationCircleIcon class="mt-0.5 h-4 w-4 shrink-0" />
            {{
              $t('trafficDestinationAvailableFrom', {
                time: formatTimestamp(destinationAvailableFrom),
              })
            }}
          </div>

          <div class="need-blur grid grid-cols-2 gap-2 px-4 pb-4 sm:grid-cols-5 md:gap-3">
            <div class="bg-base-200/30 flex min-w-0 flex-col gap-1 rounded-xl p-3 md:p-4">
              <div
                class="text-base-content/60 truncate text-[10px] font-semibold tracking-wider uppercase md:text-xs"
                :title="groupingCountLabel"
              >
                {{ groupingCountLabel }}
              </div>
              <div class="truncate text-xl font-extralight tabular-nums md:text-2xl">
                {{ trafficSummaryPage.totalRows.toLocaleString() }}
              </div>
            </div>
            <div class="bg-base-200/30 flex min-w-0 flex-col gap-1 rounded-xl p-3 md:p-4">
              <div
                class="text-base-content/60 truncate text-[10px] font-semibold tracking-wider uppercase md:text-xs"
              >
                {{ $t('trafficTotalTraffic') }}
              </div>
              <div
                class="truncate text-xl font-extralight tabular-nums md:text-2xl"
                :title="formatBytes(totalTraffic)"
              >
                {{ formatBytes(totalTraffic) }}
              </div>
            </div>
            <div class="bg-base-200/30 flex min-w-0 flex-col gap-1 rounded-xl p-3 md:p-4">
              <div
                class="text-base-content/60 truncate text-[10px] font-semibold tracking-wider uppercase md:text-xs"
              >
                {{ $t('download') }}
              </div>
              <div
                class="truncate text-xl font-extralight tabular-nums md:text-2xl"
                :title="formatBytes(totals.downlink)"
              >
                {{ formatBytes(totals.downlink) }}
              </div>
            </div>
            <div class="bg-base-200/30 flex min-w-0 flex-col gap-1 rounded-xl p-3 md:p-4">
              <div
                class="text-base-content/60 truncate text-[10px] font-semibold tracking-wider uppercase md:text-xs"
              >
                {{ $t('upload') }}
              </div>
              <div
                class="truncate text-xl font-extralight tabular-nums md:text-2xl"
                :title="formatBytes(totals.uplink)"
              >
                {{ formatBytes(totals.uplink) }}
              </div>
            </div>
            <div
              class="bg-base-200/30 col-span-2 flex min-w-0 items-center justify-between gap-3 rounded-xl p-3 sm:col-span-1 sm:flex-col sm:items-start sm:justify-start md:p-4"
            >
              <div
                class="text-base-content/60 truncate text-[10px] font-semibold tracking-wider uppercase md:text-xs"
              >
                {{ $t('trafficFlows') }}
              </div>
              <div
                class="truncate text-xl font-extralight tabular-nums md:text-2xl"
                :title="totals.connections.toLocaleString()"
              >
                {{ totals.connections.toLocaleString() }}
              </div>
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
          <div class="border-base-300 border-b p-3 md:p-4">
            <div class="flex flex-wrap items-start justify-between gap-2">
              <div class="min-w-0">
                <h2 class="text-sm font-semibold">
                  {{ $t('trafficResultsBy', { dimension: groupingTitle }) }}
                </h2>
                <p class="text-base-content/45 mt-0.5 text-xs">
                  {{
                    $t('trafficResultCount', {
                      count: trafficSummaryPage.totalRows.toLocaleString(),
                    })
                  }}
                </p>
              </div>
              <span class="badge badge-soft badge-primary shrink-0">
                {{ groupingTitle }}
              </span>
            </div>

            <div class="relative mt-3 min-w-0">
              <MagnifyingGlassIcon
                class="text-base-content/35 pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
              />
              <input
                v-model="searchInput"
                type="search"
                class="input input-sm h-10 min-h-10 w-full pr-10 pl-9 md:h-8 md:min-h-8 md:max-w-md"
                :aria-label="$t('trafficSearch')"
                :placeholder="searchPlaceholder"
                @input="scheduleSearch"
                @keydown.enter.prevent="applySearchNow"
              />
              <button
                v-if="searchInput"
                type="button"
                class="btn btn-ghost btn-circle absolute top-1/2 right-0 h-10 min-h-10 w-10 -translate-y-1/2"
                :aria-label="$t('trafficClearSearch')"
                @click="clearSearch"
              >
                <XMarkIcon class="h-3.5 w-3.5" />
              </button>
            </div>

            <button
              type="button"
              class="bg-base-200/30 mt-3 flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left md:hidden"
              :aria-expanded="queryControlsExpanded"
              aria-controls="traffic-query-controls"
              @click="queryControlsExpanded = !queryControlsExpanded"
            >
              <div class="min-w-0">
                <div class="flex items-center gap-2 text-sm font-medium">
                  <FunnelIcon class="h-4 w-4 shrink-0" />
                  <span>{{ $t('trafficFilterAndSort') }}</span>
                  <span
                    v-if="activeFilterCount"
                    class="badge badge-sm badge-primary"
                  >
                    {{ activeFilterCount }}
                  </span>
                </div>
                <p class="text-base-content/45 mt-0.5 truncate text-xs">
                  {{ queryControlSummary }}
                </p>
              </div>
              <ChevronDownIcon
                class="h-4 w-4 shrink-0 transition-transform"
                :class="{ 'rotate-180': queryControlsExpanded }"
              />
            </button>

            <div
              v-if="activeConditionChips.length"
              class="mt-2 flex min-w-0 flex-wrap gap-1.5"
              :aria-label="$t('trafficActiveConditions', { count: activeFilterCount })"
            >
              <span
                v-for="condition in visibleActiveConditionChips"
                :key="condition.key"
                class="badge badge-soft badge-sm h-auto max-w-full gap-1 py-1"
              >
                <span class="text-base-content/55 shrink-0">{{ condition.label }}:</span>
                <span class="min-w-0 truncate">{{ condition.value }}</span>
                <button
                  type="button"
                  class="-my-1 -mr-1 ml-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full md:h-6 md:w-6"
                  :aria-label="
                    $t('trafficRemoveCondition', {
                      label: condition.label,
                      value: condition.value,
                    })
                  "
                  @click="removeActiveCondition(condition)"
                >
                  <XMarkIcon class="h-3 w-3" />
                </button>
              </span>
              <span
                v-if="hiddenActiveConditionCount"
                class="badge badge-ghost badge-sm h-auto py-1"
              >
                {{ $t('trafficMoreConditions', { count: hiddenActiveConditionCount }) }}
              </span>
            </div>

            <div
              id="traffic-query-controls"
              class="mt-3"
              :class="queryControlsExpanded ? 'block' : 'hidden md:block'"
            >
              <div class="bg-base-200/30 rounded-xl p-3">
                <div class="text-base-content/60 text-xs font-semibold tracking-wider uppercase">
                  {{ $t('trafficCommonFilters') }}
                </div>

                <div class="mt-2 grid grid-cols-2 gap-3 md:grid-cols-4">
                  <label class="min-w-0">
                    <span class="text-base-content/55 mb-1 block text-xs">
                      {{ $t('trafficNetwork') }}
                    </span>
                    <select
                      v-model="selectedNetwork"
                      class="select select-sm h-10 min-h-10 w-full min-w-0 md:h-8 md:min-h-8"
                      @change="resetPageAndLoad"
                    >
                      <option value="">{{ $t('trafficAllNetworks') }}</option>
                      <option value="tcp">TCP</option>
                      <option value="udp">UDP</option>
                    </select>
                  </label>

                  <label class="min-w-0">
                    <span class="text-base-content/55 mb-1 block text-xs">
                      {{ $t('trafficSortField') }}
                    </span>
                    <select
                      v-model="selectedSortBy"
                      class="select select-sm h-10 min-h-10 w-full min-w-0 md:h-8 md:min-h-8"
                      @change="resetPageAndLoad"
                    >
                      <option value="name">{{ groupingTitle }}</option>
                      <option value="total_bytes">{{ $t('trafficTotalTraffic') }}</option>
                      <option value="uplink_bytes">{{ $t('upload') }}</option>
                      <option value="downlink_bytes">{{ $t('download') }}</option>
                      <option value="connections">{{ $t('trafficFlows') }}</option>
                    </select>
                  </label>

                  <label class="min-w-0">
                    <span class="text-base-content/55 mb-1 block text-xs">
                      {{ $t('trafficSortOrder') }}
                    </span>
                    <select
                      v-model="selectedSortOrder"
                      class="select select-sm h-10 min-h-10 w-full min-w-0 md:h-8 md:min-h-8"
                      @change="resetPageAndLoad"
                    >
                      <option value="asc">{{ $t('trafficAscending') }}</option>
                      <option value="desc">{{ $t('trafficDescending') }}</option>
                    </select>
                  </label>

                  <label class="min-w-0">
                    <span class="text-base-content/55 mb-1 block text-xs">
                      {{ $t('trafficPageSize') }}
                    </span>
                    <select
                      v-model.number="selectedPageSize"
                      class="select select-sm h-10 min-h-10 w-full min-w-0 md:h-8 md:min-h-8"
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
                  </label>
                </div>

                <div class="border-base-300 mt-3 border-t pt-3">
                  <div class="flex flex-wrap items-start justify-between gap-2">
                    <button
                      type="button"
                      class="min-h-10 min-w-0 flex-1 text-left"
                      :aria-expanded="filtersExpanded"
                      aria-controls="traffic-exact-filter-fields"
                      @click="filtersExpanded = !filtersExpanded"
                    >
                      <span class="flex items-center gap-2 text-sm font-medium">
                        <span>{{ $t('trafficExactFilters') }}</span>
                        <span
                          v-if="exactFilterCount"
                          class="badge badge-sm badge-primary"
                        >
                          {{ exactFilterCount }}
                        </span>
                        <ChevronDownIcon
                          class="h-4 w-4 shrink-0 transition-transform"
                          :class="{ 'rotate-180': filtersExpanded }"
                        />
                      </span>
                      <span class="text-base-content/45 mt-0.5 block text-xs">
                        {{ $t('trafficExactFiltersHint') }}
                      </span>
                    </button>
                    <button
                      v-if="exactFilterCount"
                      type="button"
                      class="btn btn-ghost btn-sm h-10 min-h-10 shrink-0 md:h-8 md:min-h-8"
                      @click="clearExactFilters"
                    >
                      {{ $t('trafficClearExactFilters') }}
                    </button>
                  </div>

                  <div
                    id="traffic-exact-filter-fields"
                    class="mt-3 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4"
                    :class="filtersExpanded ? 'grid' : 'hidden'"
                  >
                    <TrafficExactValueFilter
                      v-model="selectedRouteTags"
                      :label="$t('trafficRouteTagFilter')"
                      :placeholder="$t('trafficRouteTagFilterPlaceholder')"
                      :hint="$t('trafficExactValueHint')"
                      :remove-label="$t('trafficRemoveExactValue')"
                      :too-many-error="$t('trafficExactValueTooMany')"
                      :too-long-error="$t('trafficExactValueTooLong')"
                      @change="resetPageAndLoad"
                    />
                    <TrafficExactValueFilter
                      v-model="selectedGroupTags"
                      :label="$t('trafficGroupTagFilter')"
                      :placeholder="$t('trafficGroupTagFilterPlaceholder')"
                      :hint="$t('trafficExactValueHint')"
                      :remove-label="$t('trafficRemoveExactValue')"
                      :too-many-error="$t('trafficExactValueTooMany')"
                      :too-long-error="$t('trafficExactValueTooLong')"
                      @change="resetPageAndLoad"
                    />
                    <TrafficExactValueFilter
                      v-model="selectedActualOutboundTags"
                      :label="$t('trafficActualOutboundTagFilter')"
                      :placeholder="$t('trafficActualOutboundTagFilterPlaceholder')"
                      :hint="$t('trafficExactValueHint')"
                      :remove-label="$t('trafficRemoveExactValue')"
                      :too-many-error="$t('trafficExactValueTooMany')"
                      :too-long-error="$t('trafficExactValueTooLong')"
                      @change="resetPageAndLoad"
                    />
                    <TrafficExactValueFilter
                      v-model="selectedDestinations"
                      :label="$t('trafficDestinationFilter')"
                      :placeholder="$t('trafficDestinationFilterPlaceholder')"
                      :hint="$t('trafficExactValueHint')"
                      :remove-label="$t('trafficRemoveExactValue')"
                      :too-many-error="$t('trafficExactValueTooMany')"
                      :too-long-error="$t('trafficExactValueTooLong')"
                      @change="resetPageAndLoad"
                    />
                  </div>
                </div>
              </div>
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
            :class="{ 'opacity-60': trafficSummaryLoading }"
          >
            <div
              class="grid gap-2 p-2 md:hidden"
              role="list"
            >
              <div
                v-for="(row, rowIndex) in trafficSummaryRows"
                :key="`mobile:${rowKey(row, rowIndex)}`"
                class="bg-base-200/30 min-w-0 rounded-xl p-3"
                role="listitem"
              >
                <div class="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div class="min-w-0 flex-1">
                    <template v-if="selectedGroupBy === 'route_path'">
                      <div
                        v-if="!routePath(row).length"
                        class="text-base-content/45 mb-1.5 text-xs"
                      >
                        {{ $t('trafficNoRoutePath') }}
                      </div>
                      <dl class="space-y-1.5">
                        <div
                          v-if="row.routeTag"
                          class="grid min-w-0 grid-cols-[4.25rem_minmax(0,1fr)] items-start gap-2"
                        >
                          <dt class="text-base-content/45 pt-0.5 text-[11px]">
                            {{ $t('trafficRouteSelected') }}
                          </dt>
                          <dd class="min-w-0">
                            <span
                              class="bg-base-200 inline-block max-w-full rounded-full px-2 py-0.5 text-xs break-all"
                            >
                              {{ row.routeTag }}
                            </span>
                          </dd>
                        </div>
                        <div
                          v-if="row.groupPath.length"
                          class="grid min-w-0 grid-cols-[4.25rem_minmax(0,1fr)] items-start gap-2"
                        >
                          <dt class="text-base-content/45 pt-0.5 text-[11px]">
                            {{ $t('trafficGroupPath') }}
                          </dt>
                          <dd class="flex min-w-0 flex-wrap items-center gap-1">
                            <template
                              v-for="(tag, tagIndex) in row.groupPath"
                              :key="`${tagIndex}:${tag}`"
                            >
                              <ChevronRightIcon
                                v-if="tagIndex"
                                class="text-base-content/30 h-3 w-3 shrink-0"
                              />
                              <span
                                class="bg-base-200 inline-block max-w-full rounded-full px-2 py-0.5 text-xs break-all"
                              >
                                {{ tag }}
                              </span>
                            </template>
                          </dd>
                        </div>
                        <div
                          v-if="row.actualOutboundTag || row.actualOutboundType"
                          class="grid min-w-0 grid-cols-[4.25rem_minmax(0,1fr)] items-start gap-2"
                        >
                          <dt class="text-base-content/45 pt-0.5 text-[11px]">
                            {{ $t('trafficGroupActualOutbound') }}
                          </dt>
                          <dd class="flex min-w-0 flex-wrap items-center gap-1.5">
                            <span
                              class="bg-primary/12 text-primary inline-block max-w-full rounded-full px-2 py-0.5 text-xs font-medium break-all"
                            >
                              {{ row.actualOutboundTag || $t('trafficNoActualOutbound') }}
                            </span>
                            <span
                              v-if="row.actualOutboundType"
                              class="text-base-content/45 text-[11px]"
                            >
                              {{ row.actualOutboundType }}
                            </span>
                          </dd>
                        </div>
                        <div
                          class="grid min-w-0 grid-cols-[4.25rem_minmax(0,1fr)] items-start gap-2"
                        >
                          <dt class="text-base-content/45 pt-0.5 text-[11px]">
                            {{ $t('trafficNetwork') }}
                          </dt>
                          <dd>
                            <span class="badge badge-xs badge-ghost uppercase">
                              {{ row.network || selectedNetwork || '—' }}
                            </span>
                          </dd>
                        </div>
                        <div
                          v-if="row.configRevision"
                          class="grid min-w-0 grid-cols-[4.25rem_minmax(0,1fr)] items-start gap-2"
                        >
                          <dt class="text-base-content/45 pt-0.5 text-[11px]">
                            {{ $t('trafficConfigRevision') }}
                          </dt>
                          <dd
                            class="text-base-content/45 min-w-0 truncate font-mono text-[11px]"
                            :title="row.configRevision"
                          >
                            {{ formatConfigRevision(row.configRevision) }}
                          </dd>
                        </div>
                      </dl>
                    </template>

                    <template v-else>
                      <div
                        class="text-base-content/45 text-[10px] font-semibold tracking-wider uppercase"
                      >
                        {{ groupingTitle }}
                      </div>

                      <div
                        v-if="selectedGroupBy === 'destination'"
                        class="mt-1 flex min-w-0 flex-wrap items-center gap-1.5"
                      >
                        <span class="min-w-0 text-sm font-medium break-all">
                          {{ row.destination || $t('trafficNoDestination') }}
                        </span>
                        <span
                          v-if="row.destinationType"
                          class="badge badge-xs badge-ghost shrink-0 uppercase"
                        >
                          {{ destinationTypeLabel(row.destinationType) }}
                        </span>
                      </div>

                      <span
                        v-else-if="selectedGroupBy === 'outbound_group'"
                        class="mt-1 block max-w-full text-sm font-medium break-all"
                        :title="row.outboundGroup || $t('trafficNoOutboundGroup')"
                      >
                        {{ row.outboundGroup || $t('trafficNoOutboundGroup') }}
                      </span>

                      <div
                        v-else
                        class="mt-1 flex min-w-0 flex-wrap items-center gap-1.5"
                      >
                        <span
                          class="text-primary block max-w-full text-sm font-medium break-all"
                          :title="row.actualOutboundTag || $t('trafficNoActualOutbound')"
                        >
                          {{ row.actualOutboundTag || $t('trafficNoActualOutbound') }}
                        </span>
                        <span
                          v-if="row.actualOutboundType"
                          class="text-base-content/45 text-xs"
                        >
                          {{ $t('trafficOutboundType') }}: {{ row.actualOutboundType }}
                        </span>
                      </div>
                    </template>
                  </div>

                  <div class="shrink-0 text-right">
                    <div class="text-base-content/45 text-[10px] uppercase">
                      {{ $t('trafficTotalTraffic') }}
                    </div>
                    <div
                      class="mt-0.5 font-mono text-sm font-medium whitespace-nowrap tabular-nums"
                      :title="formatBytes(row.uplinkBytes + row.downlinkBytes)"
                    >
                      {{ formatBytes(row.uplinkBytes + row.downlinkBytes) }}
                    </div>
                  </div>
                </div>

                <div
                  class="text-base-content/45 mt-3 flex items-center justify-between text-[10px]"
                >
                  <span>{{ $t('trafficShareOfTotal') }}</span>
                  <span class="tabular-nums">{{ formatTrafficShare(row) }}</span>
                </div>
                <progress
                  class="progress progress-primary mt-1 h-1.5 w-full"
                  :value="trafficSharePercent(row)"
                  max="100"
                  :aria-label="$t('trafficShareOfTotal')"
                ></progress>

                <div class="border-base-300 mt-2 grid grid-cols-3 gap-2 border-t pt-2">
                  <div class="min-w-0">
                    <div class="text-base-content/45 text-[10px] uppercase">
                      {{ $t('upload') }}
                    </div>
                    <div
                      class="truncate font-mono text-xs tabular-nums"
                      :title="formatBytes(row.uplinkBytes)"
                    >
                      {{ formatBytes(row.uplinkBytes) }}
                    </div>
                  </div>
                  <div class="min-w-0">
                    <div class="text-base-content/45 text-[10px] uppercase">
                      {{ $t('download') }}
                    </div>
                    <div
                      class="truncate font-mono text-xs tabular-nums"
                      :title="formatBytes(row.downlinkBytes)"
                    >
                      {{ formatBytes(row.downlinkBytes) }}
                    </div>
                  </div>
                  <div class="min-w-0 text-right">
                    <div class="text-base-content/45 text-[10px] uppercase">
                      {{ $t('trafficFlows') }}
                    </div>
                    <div
                      class="truncate font-mono text-xs tabular-nums"
                      :title="row.connections.toLocaleString()"
                    >
                      {{ row.connections.toLocaleString() }}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="hidden overflow-x-auto md:block">
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

                      <div
                        v-else-if="selectedGroupBy === 'destination'"
                        class="flex items-center gap-2"
                      >
                        <span class="font-medium">
                          {{ row.destination || $t('trafficNoDestination') }}
                        </span>
                        <span
                          v-if="row.destinationType"
                          class="badge badge-sm badge-ghost uppercase"
                        >
                          {{ destinationTypeLabel(row.destinationType) }}
                        </span>
                      </div>

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
                        <span v-if="row.actualOutboundType">
                          {{ $t('trafficOutboundType') }}: {{ row.actualOutboundType }}
                        </span>
                        <span
                          v-if="row.configRevision"
                          :title="row.configRevision"
                        >
                          {{ $t('trafficConfigRevision') }}:
                          {{ formatConfigRevision(row.configRevision) }}
                        </span>
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
          </div>

          <div
            class="border-base-300 flex flex-col items-stretch gap-2 border-t p-3 md:flex-row md:flex-wrap md:items-center md:justify-between"
          >
            <span class="text-base-content/50 text-center text-xs tabular-nums md:text-left">
              {{
                $t('trafficRowsRange', {
                  from: firstVisibleRow,
                  to: lastVisibleRow,
                  total: trafficSummaryPage.totalRows.toLocaleString(),
                })
              }}
            </span>

            <div
              class="grid w-full grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center gap-2 md:flex md:w-auto"
            >
              <button
                type="button"
                class="btn btn-sm h-10 min-h-10 w-10 md:h-8 md:min-h-8 md:w-auto"
                :disabled="trafficSummaryLoading || currentPage <= 1"
                :aria-label="$t('trafficPreviousPage')"
                @click="previousPage"
              >
                <ChevronLeftIcon class="h-4 w-4" />
                <span class="hidden md:inline">{{ $t('trafficPreviousPage') }}</span>
              </button>
              <span class="text-center text-sm tabular-nums">
                {{
                  $t('trafficPageStatus', {
                    page: currentPage,
                    pages: totalPages,
                  })
                }}
              </span>
              <button
                type="button"
                class="btn btn-sm h-10 min-h-10 w-10 md:h-8 md:min-h-8 md:w-auto"
                :disabled="trafficSummaryLoading || currentPage >= totalPages"
                :aria-label="$t('trafficNextPage')"
                @click="nextPage"
              >
                <span class="hidden md:inline">{{ $t('trafficNextPage') }}</span>
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
import TrafficExactValueFilter from '@/components/traffic/TrafficExactValueFilter.vue'
import { usePaddingForViews } from '@/composables/paddingViews'
import { isMiddleScreen } from '@/helper/utils'
import {
  clearTrafficSummaryResult,
  trafficCapabilities,
  trafficDestinationAvailableFrom,
  trafficSummaryFailed,
  trafficSummaryLoading,
  trafficSummaryPage,
  trafficSummaryRows,
  trafficSummaryTotals,
  trafficSummaryWindow,
  type TrafficSummaryRow,
} from '@/store/trafficStatistics'
import {
  ArrowDownIcon,
  ArrowPathIcon,
  ArrowUpIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpDownIcon,
  FunnelIcon,
  InformationCircleIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from '@heroicons/vue/24/outline'
import dayjs from 'dayjs'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

type RangePreset = 'retained' | '24h' | '7d' | '30d'
type NetworkFilter = '' | 'tcp' | 'udp'
type ActiveConditionKind = 'network' | 'route' | 'group' | 'outbound' | 'destination'
type ActiveCondition = {
  key: string
  kind: ActiveConditionKind
  label: string
  value: string
  index?: number
}

const { t } = useI18n()
const selectedRange = ref<RangePreset>('retained')
const selectedGroupBy = ref<TrafficGroupBy>('route_path')
const selectedNetwork = ref<NetworkFilter>('')
const selectedRouteTags = ref<string[]>([])
const selectedGroupTags = ref<string[]>([])
const selectedActualOutboundTags = ref<string[]>([])
const selectedDestinations = ref<string[]>([])
const queryControlsExpanded = ref(false)
const filtersExpanded = ref(false)
const selectedPageSize = ref(isMiddleScreen.value ? 25 : 50)
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
    destination: t('trafficGroupDestination'),
    destination_domain: t('trafficGroupDestinationDomain'),
    outbound_group: t('trafficGroupOutboundGroup'),
    actual_outbound: t('trafficGroupActualOutbound'),
  }

  return labels[selectedGroupBy.value]
})

const groupingDescription = computed(() => {
  const descriptions: Record<TrafficGroupBy, string> = {
    route_path: t('trafficGroupRoutePathDescription'),
    destination: t('trafficGroupDestinationDescription'),
    destination_domain: t('trafficGroupDestinationDescription'),
    outbound_group: t('trafficGroupOutboundGroupDescription'),
    actual_outbound: t('trafficGroupActualOutboundDescription'),
  }

  return descriptions[selectedGroupBy.value]
})

const groupingCountLabel = computed(() => {
  const labels: Record<TrafficGroupBy, string> = {
    route_path: t('trafficGroupRoutePathCount'),
    destination: t('trafficGroupDestinationCount'),
    destination_domain: t('trafficGroupDestinationCount'),
    outbound_group: t('trafficGroupOutboundGroupCount'),
    actual_outbound: t('trafficGroupActualOutboundCount'),
  }

  return labels[selectedGroupBy.value]
})

const searchPlaceholder = computed(() => {
  const placeholders: Record<TrafficGroupBy, string> = {
    route_path: t('trafficSearchRoutePath'),
    destination: t('trafficSearchDestination'),
    destination_domain: t('trafficSearchDestination'),
    outbound_group: t('trafficSearchOutboundGroup'),
    actual_outbound: t('trafficSearchActualOutbound'),
  }

  return placeholders[selectedGroupBy.value]
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
const totalTraffic = computed(() => totals.value.uplink + totals.value.downlink)
const destinationAvailableFrom = computed(
  () =>
    trafficDestinationAvailableFrom.value ||
    trafficCapabilities.value?.destination_available_from ||
    '',
)
const exactFilterCount = computed(
  () =>
    selectedRouteTags.value.length +
    selectedGroupTags.value.length +
    selectedActualOutboundTags.value.length +
    selectedDestinations.value.length,
)
const activeFilterCount = computed(() => exactFilterCount.value + (selectedNetwork.value ? 1 : 0))
const activeConditionChips = computed<ActiveCondition[]>(() => {
  const conditions: ActiveCondition[] = []

  if (selectedNetwork.value) {
    conditions.push({
      key: 'network',
      kind: 'network',
      label: t('trafficNetwork'),
      value: selectedNetwork.value.toUpperCase(),
    })
  }
  selectedRouteTags.value.forEach((value, index) => {
    conditions.push({
      key: `route:${index}:${value}`,
      kind: 'route',
      label: t('trafficRouteSelected'),
      value,
      index,
    })
  })
  selectedGroupTags.value.forEach((value, index) => {
    conditions.push({
      key: `group:${index}:${value}`,
      kind: 'group',
      label: t('trafficGroupOutboundGroup'),
      value,
      index,
    })
  })
  selectedActualOutboundTags.value.forEach((value, index) => {
    conditions.push({
      key: `outbound:${index}:${value}`,
      kind: 'outbound',
      label: t('trafficGroupActualOutbound'),
      value,
      index,
    })
  })
  selectedDestinations.value.forEach((value, index) => {
    conditions.push({
      key: `destination:${index}:${value}`,
      kind: 'destination',
      label: t('trafficGroupDestination'),
      value,
      index,
    })
  })

  return conditions
})
const maximumVisibleActiveConditions = 6
const visibleActiveConditionChips = computed(() =>
  activeConditionChips.value.slice(0, maximumVisibleActiveConditions),
)
const hiddenActiveConditionCount = computed(() =>
  Math.max(0, activeConditionChips.value.length - maximumVisibleActiveConditions),
)
const sortFieldLabel = computed(() => {
  const labels: Record<TrafficSortBy, string> = {
    name: groupingTitle.value,
    total_bytes: t('trafficTotalTraffic'),
    uplink_bytes: t('upload'),
    downlink_bytes: t('download'),
    connections: t('trafficFlows'),
  }

  return labels[selectedSortBy.value]
})
const queryControlSummary = computed(() =>
  [
    selectedNetwork.value ? selectedNetwork.value.toUpperCase() : t('trafficAllNetworks'),
    sortFieldLabel.value,
    selectedSortOrder.value === 'asc' ? t('trafficAscending') : t('trafficDescending'),
  ].join(' · '),
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
  ...(selectedRouteTags.value.length ? { route_tags: selectedRouteTags.value } : {}),
  ...(selectedGroupTags.value.length ? { group_tags: selectedGroupTags.value } : {}),
  ...(selectedActualOutboundTags.value.length
    ? { actual_outbound_tags: selectedActualOutboundTags.value }
    : {}),
  ...(selectedDestinations.value.length ? { destinations: selectedDestinations.value } : {}),
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

const changeGrouping = () => {
  if (searchTimer !== undefined) {
    clearTimeout(searchTimer)
    searchTimer = undefined
  }
  searchInput.value = ''
  appliedSearch.value = ''
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

const clearExactFilters = () => {
  if (!exactFilterCount.value) return

  selectedRouteTags.value = []
  selectedGroupTags.value = []
  selectedActualOutboundTags.value = []
  selectedDestinations.value = []
  void resetPageAndLoad()
}

const removeActiveCondition = (condition: ActiveCondition) => {
  if (condition.kind === 'network') {
    selectedNetwork.value = ''
  } else if (condition.kind === 'route' && condition.index !== undefined) {
    selectedRouteTags.value = selectedRouteTags.value.filter(
      (_, index) => index !== condition.index,
    )
  } else if (condition.kind === 'group' && condition.index !== undefined) {
    selectedGroupTags.value = selectedGroupTags.value.filter(
      (_, index) => index !== condition.index,
    )
  } else if (condition.kind === 'outbound' && condition.index !== undefined) {
    selectedActualOutboundTags.value = selectedActualOutboundTags.value.filter(
      (_, index) => index !== condition.index,
    )
  } else if (condition.kind === 'destination' && condition.index !== undefined) {
    selectedDestinations.value = selectedDestinations.value.filter(
      (_, index) => index !== condition.index,
    )
  } else {
    return
  }

  void resetPageAndLoad()
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

const destinationTypeLabel = (type: TrafficSummaryRow['destinationType']) => {
  if (type === 'domain') return t('trafficDestinationTypeDomain')
  if (type === 'ip') return t('trafficDestinationTypeIP')
  return ''
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

const trafficSharePercent = (row: TrafficSummaryRow) => {
  if (totalTraffic.value <= 0n) return 0

  const rowTotal = row.uplinkBytes + row.downlinkBytes
  const tenths = (rowTotal * 1000n) / totalTraffic.value
  return Math.min(100, Number(tenths) / 10)
}

const formatTrafficShare = (row: TrafficSummaryRow) => `${trafficSharePercent(row).toFixed(1)}%`

const rowKey = (row: TrafficSummaryRow, index: number) =>
  [
    selectedGroupBy.value,
    row.configRevision,
    row.routeTag,
    row.groupPath.join('\u0000'),
    row.destination,
    row.destinationType,
    row.destinationDomain,
    row.outboundGroup,
    row.actualOutboundTag,
    row.network,
    index,
  ].join('\u0001')

const formatTimestamp = (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm')

const formatConfigRevision = (value: string) =>
  value.length > 12 ? `${value.slice(0, 8)}…` : value

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
