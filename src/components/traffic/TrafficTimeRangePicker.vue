<template>
  <VueDatePicker
    ref="picker"
    v-model="draftRange"
    class="traffic-time-picker"
    range
    :max-date="maximumDate"
    :locale="datePickerLocale"
    :week-start="1"
    :centered="isMiddleScreen"
    :teleport="true"
    :formats="formats"
    :time-config="timeConfig"
    :action-row="actionRow"
    :config="pickerConfig"
    :floating="floatingConfig"
    :ui="pickerUI"
    @open="handleOpen"
    @closed="menuOpen = false"
    @update:model-value="applyCustomRange"
  >
    <template #trigger>
      <button
        type="button"
        class="btn btn-sm border-base-border bg-base-100 hover:border-base-content/20 h-10 min-h-10 w-full min-w-0 justify-between px-3 font-normal shadow-none md:h-8 md:min-h-8"
        :aria-label="$t('trafficSelectTimeRange')"
        :aria-expanded="menuOpen"
      >
        <span class="flex min-w-0 items-center gap-2">
          <CalendarDaysIcon class="text-base-content/45 h-4 w-4 shrink-0" />
          <span class="truncate">{{ selectedLabel }}</span>
        </span>
        <ChevronDownIcon
          class="text-base-content/45 h-4 w-4 shrink-0 transition-transform"
          :class="{ 'rotate-180': menuOpen }"
        />
      </button>
    </template>

    <template #left-sidebar>
      <div class="traffic-time-presets">
        <div class="traffic-time-preset-title">
          {{ $t('trafficRollingTimeRanges') }}
        </div>
        <button
          v-for="preset in rollingPresets"
          :key="preset.value"
          type="button"
          class="traffic-time-preset"
          :class="{ 'traffic-time-preset-active': selectedRange === preset.value }"
          @click="selectPreset(preset.value)"
        >
          {{ preset.label }}
        </button>

        <div class="traffic-time-preset-title traffic-time-preset-title-spaced">
          {{ $t('trafficCalendarTimeRanges') }}
        </div>
        <button
          v-for="preset in calendarPresets"
          :key="preset.value"
          type="button"
          class="traffic-time-preset"
          :class="{ 'traffic-time-preset-active': selectedRange === preset.value }"
          @click="selectPreset(preset.value)"
        >
          {{ preset.label }}
        </button>

        <button
          type="button"
          class="traffic-time-preset traffic-time-preset-retained"
          :class="{ 'traffic-time-preset-active': selectedRange === 'retained' }"
          @click="selectPreset('retained')"
        >
          {{ $t('trafficAllRetained') }}
        </button>
      </div>
    </template>
  </VueDatePicker>
</template>

<script setup lang="ts">
import { LANG } from '@/constant'
import { isMiddleScreen } from '@/helper/utils'
import { language } from '@/store/settings'
import { VueDatePicker } from '@vuepic/vue-datepicker'
import '@vuepic/vue-datepicker/dist/main.css'
import { CalendarDaysIcon, ChevronDownIcon } from '@heroicons/vue/24/outline'
import { enUS, ru, zhCN, zhTW } from 'date-fns/locale'
import dayjs from 'dayjs'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

type TrafficRangePreset =
  | 'retained'
  | '1h'
  | '6h'
  | '24h'
  | '7d'
  | '30d'
  | 'today'
  | 'yesterday'
  | 'week'
  | 'month'
  | 'last_month'
  | 'custom'

const props = defineProps<{
  selectedRange: TrafficRangePreset
  from?: string
  to?: string
}>()

const emit = defineEmits<{
  change: [range: TrafficRangePreset, from?: string, to?: string]
}>()

const { t } = useI18n()
const picker = ref<InstanceType<typeof VueDatePicker> | null>(null)
const draftRange = ref<Date[] | null>(null)
const maximumDate = ref(new Date())
const menuOpen = ref(false)

const rollingPresets = computed(() => [
  { value: '1h' as const, label: t('trafficLastHour') },
  { value: '6h' as const, label: t('trafficLast6Hours') },
  { value: '24h' as const, label: t('trafficLast24Hours') },
  { value: '7d' as const, label: t('trafficLast7Days') },
  { value: '30d' as const, label: t('trafficLast30Days') },
])

const calendarPresets = computed(() => [
  { value: 'today' as const, label: t('trafficToday') },
  { value: 'yesterday' as const, label: t('trafficYesterday') },
  { value: 'week' as const, label: t('trafficThisWeek') },
  { value: 'month' as const, label: t('trafficThisMonth') },
  { value: 'last_month' as const, label: t('trafficLastMonth') },
])

const allPresets = computed(() => [
  { value: 'retained' as const, label: t('trafficAllRetained') },
  ...rollingPresets.value,
  ...calendarPresets.value,
])

const selectedLabel = computed(() => {
  const preset = allPresets.value.find((item) => item.value === props.selectedRange)
  if (preset) return preset.label
  if (!props.from || !props.to) return t('trafficCustomTimeRange')

  const from = dayjs(props.from)
  const to = dayjs(props.to)
  if (from.isSame(to, 'day')) {
    return `${from.format('YYYY-MM-DD HH:mm')} – ${to.format('HH:mm')}`
  }
  return `${from.format('YYYY-MM-DD HH:mm')} – ${to.format('YYYY-MM-DD HH:mm')}`
})

const datePickerLocale = computed(() => {
  switch (language.value) {
    case LANG.ZH_CN:
      return zhCN
    case LANG.ZH_TW:
      return zhTW
    case LANG.RU_RU:
      return ru
    default:
      return enUS
  }
})

const formats = computed(() => ({
  input: (dates: Date[]) => formatRange(dates),
  preview: (dates: Date[]) => formatRange(dates),
}))

const timeConfig = computed(() => ({
  enableTimePicker: true,
  enableSeconds: false,
  is24: true,
  minutesIncrement: 5,
  timePickerInline: true,
  startTime: [
    { hours: 0, minutes: 0 },
    { hours: maximumDate.value.getHours(), minutes: maximumDate.value.getMinutes() },
  ],
}))

const actionRow = computed(() => ({
  showPreview: true,
  showSelect: true,
  showCancel: true,
  selectBtnLabel: t('trafficApplyTimeRange'),
  cancelBtnLabel: t('trafficCancel'),
}))

const pickerConfig = {
  closeOnScroll: false,
  mobileBreakpoint: 768,
}

const floatingConfig = {
  placement: 'bottom-end' as const,
  offset: 8,
}

const pickerUI = {
  menu: 'traffic-time-picker-menu',
}

const formatRange = (dates: Date[]) => {
  if (!dates?.length) return ''
  if (dates.length === 1) return dayjs(dates[0]).format('YYYY-MM-DD HH:mm')
  return `${dayjs(dates[0]).format('YYYY-MM-DD HH:mm')} – ${dayjs(dates[1]).format(
    'YYYY-MM-DD HH:mm',
  )}`
}

const syncDraftRange = () => {
  if (props.from && props.to) {
    draftRange.value = [new Date(props.from), new Date(props.to)]
    return
  }

  const now = new Date()
  draftRange.value = [new Date(now.getFullYear(), now.getMonth(), now.getDate()), now]
}

const handleOpen = () => {
  maximumDate.value = new Date()
  syncDraftRange()
  menuOpen.value = true
}

const selectPreset = (range: Exclude<TrafficRangePreset, 'custom'>) => {
  emit('change', range)
  picker.value?.closeMenu()
}

const applyCustomRange = (range: Date[] | null) => {
  if (!range || range.length !== 2 || !range[0] || !range[1]) return

  const from = range[0]
  const to = range[1] > maximumDate.value ? maximumDate.value : range[1]
  if (from >= to) return

  emit('change', 'custom', from.toISOString(), to.toISOString())
}
</script>

<style>
.traffic-time-picker-menu {
  --dp-font-family: inherit;
  --dp-font-size: 0.8125rem;
  --dp-preview-font-size: 0.75rem;
  --dp-border-radius: var(--radius-field);
  --dp-cell-border-radius: 0.5rem;
  --dp-background-color: var(--color-base-100);
  --dp-text-color: var(--color-base-content);
  --dp-hover-color: color-mix(in srgb, var(--color-base-content) 8%, transparent);
  --dp-hover-text-color: var(--color-base-content);
  --dp-hover-icon-color: var(--color-base-content);
  --dp-primary-color: var(--color-primary);
  --dp-primary-disabled-color: color-mix(in srgb, var(--color-primary) 45%, transparent);
  --dp-primary-text-color: var(--color-primary-content);
  --dp-secondary-color: color-mix(in srgb, var(--color-base-content) 38%, transparent);
  --dp-border-color: var(--color-base-border);
  --dp-menu-border-color: var(--color-base-border);
  --dp-border-color-hover: color-mix(in srgb, var(--color-base-content) 20%, transparent);
  --dp-border-color-focus: var(--color-primary);
  --dp-disabled-color: color-mix(in srgb, var(--color-base-content) 6%, transparent);
  --dp-disabled-color-text: color-mix(in srgb, var(--color-base-content) 30%, transparent);
  --dp-icon-color: color-mix(in srgb, var(--color-base-content) 55%, transparent);
  --dp-range-between-dates-background-color: color-mix(
    in srgb,
    var(--color-primary) 13%,
    transparent
  );
  --dp-range-between-dates-text-color: var(--color-base-content);
  --dp-range-between-border-color: transparent;
  --dp-menu-padding: 0.5rem;
  --dp-cell-size: 2.25rem;
  --dp-row-margin: 0.125rem 0;
  --dp-action-row-padding: 0.625rem;
  box-shadow: 0 18px 48px color-mix(in srgb, #000 18%, transparent);
}

.traffic-time-picker-menu .dp--sidebar-left {
  border-color: var(--color-base-border);
  padding: 0.5rem;
}

.traffic-time-picker-menu .dp--action-row {
  border-top: 1px solid var(--color-base-border);
}

.traffic-time-picker-menu .dp--action-button {
  min-height: 2rem;
  padding-inline: 0.75rem;
}

.traffic-time-presets {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  width: 14rem;
  gap: 0.25rem;
}

.traffic-time-preset-title {
  grid-column: 1 / -1;
  padding: 0.25rem 0.5rem;
  color: color-mix(in srgb, var(--color-base-content) 48%, transparent);
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.traffic-time-preset-title-spaced,
.traffic-time-preset-retained {
  margin-top: 0.375rem;
}

.traffic-time-preset-retained {
  grid-column: 1 / -1;
}

.traffic-time-preset {
  min-height: 2rem;
  padding: 0.375rem 0.5rem;
  border: 0;
  border-radius: var(--radius-field);
  color: var(--color-base-content);
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.traffic-time-preset:hover {
  background: color-mix(in srgb, var(--color-base-content) 8%, transparent);
}

.traffic-time-preset-active {
  color: var(--color-primary-content);
  background: var(--color-primary);
}

.traffic-time-preset-active:hover {
  background: var(--color-primary);
}

@media (max-width: 767px) {
  .traffic-time-picker-menu {
    width: min(32rem, calc(100vw - 1rem));
    max-height: calc(100dvh - 1rem);
    overflow-y: auto;
  }

  .traffic-time-picker-menu .dp--sidebar-left {
    border-right: 0;
    border-bottom: 1px solid var(--color-base-border);
  }

  .traffic-time-presets {
    width: 100%;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
