<template>
  <details
    ref="details"
    class="dropdown w-full"
    @toggle="handleToggle"
  >
    <summary
      class="btn btn-sm h-10 min-h-10 w-full min-w-0 list-none justify-between px-3 font-normal md:h-8 md:min-h-8 [&::-webkit-details-marker]:hidden"
      :aria-label="$t('trafficSelectTimeRange')"
    >
      <span class="flex min-w-0 items-center gap-2">
        <CalendarDaysIcon class="text-base-content/45 h-4 w-4 shrink-0" />
        <span class="truncate">{{ selectedLabel }}</span>
      </span>
      <ChevronDownIcon class="text-base-content/45 h-4 w-4 shrink-0" />
    </summary>

    <div
      class="dropdown-content border-base-300 bg-base-100 z-40 mt-2 w-full rounded-xl border p-3 shadow-lg"
    >
      <div class="grid grid-cols-2 gap-2">
        <button
          v-for="preset in presets"
          :key="preset.value"
          type="button"
          class="btn btn-sm h-9 min-h-9 justify-start px-3 font-normal"
          :class="selectedRange === preset.value ? 'btn-primary' : 'btn-ghost bg-base-200/40'"
          @click="selectPreset(preset.value)"
        >
          {{ preset.label }}
        </button>
      </div>

      <div class="border-base-300 mt-3 border-t pt-3">
        <div class="text-base-content/60 text-xs font-semibold tracking-wider uppercase">
          {{ $t('trafficCustomTimeRange') }}
        </div>
        <div class="mt-2 grid gap-2 sm:grid-cols-2">
          <label class="min-w-0">
            <span class="text-base-content/55 mb-1 block text-xs">
              {{ $t('trafficTimeRangeStart') }}
            </span>
            <input
              v-model="draftFrom"
              type="datetime-local"
              class="input input-sm h-10 min-h-10 w-full min-w-0 md:h-8 md:min-h-8"
              :max="draftTo || maximumLocalTime"
              @input="invalidRange = false"
            />
          </label>
          <label class="min-w-0">
            <span class="text-base-content/55 mb-1 block text-xs">
              {{ $t('trafficTimeRangeEnd') }}
            </span>
            <input
              v-model="draftTo"
              type="datetime-local"
              class="input input-sm h-10 min-h-10 w-full min-w-0 md:h-8 md:min-h-8"
              :min="draftFrom"
              :max="maximumLocalTime"
              @input="invalidRange = false"
            />
          </label>
        </div>
        <p
          v-if="invalidRange"
          class="text-error mt-2 text-xs"
        >
          {{ $t('trafficInvalidTimeRange') }}
        </p>
        <button
          type="button"
          class="btn btn-sm btn-primary mt-3 h-10 min-h-10 w-full md:h-8 md:min-h-8"
          @click="applyCustomRange"
        >
          {{ $t('trafficApplyTimeRange') }}
        </button>
      </div>
    </div>
  </details>
</template>

<script setup lang="ts">
import { CalendarDaysIcon, ChevronDownIcon } from '@heroicons/vue/24/outline'
import dayjs from 'dayjs'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

type TrafficRangePreset = 'retained' | '1h' | '24h' | '7d' | '30d' | 'custom'

const props = defineProps<{
  selectedRange: TrafficRangePreset
  from?: string
  to?: string
}>()

const emit = defineEmits<{
  change: [range: TrafficRangePreset, from?: string, to?: string]
}>()

const { t } = useI18n()
const details = ref<HTMLDetailsElement>()
const draftFrom = ref('')
const draftTo = ref('')
const invalidRange = ref(false)
const maximumLocalTime = ref(dayjs().format('YYYY-MM-DDTHH:mm'))

const presets = computed(() => [
  { value: 'retained' as const, label: t('trafficAllRetained') },
  { value: '1h' as const, label: t('trafficLastHour') },
  { value: '24h' as const, label: t('trafficLast24Hours') },
  { value: '7d' as const, label: t('trafficLast7Days') },
  { value: '30d' as const, label: t('trafficLast30Days') },
])

const selectedLabel = computed(() => {
  const preset = presets.value.find((item) => item.value === props.selectedRange)
  if (preset) return preset.label
  if (!props.from || !props.to) return t('trafficCustomTimeRange')

  return `${dayjs(props.from).format('YYYY-MM-DD HH:mm')} – ${dayjs(props.to).format(
    'YYYY-MM-DD HH:mm',
  )}`
})

const syncDraft = () => {
  draftFrom.value = props.from ? dayjs(props.from).format('YYYY-MM-DDTHH:mm') : ''
  draftTo.value = props.to ? dayjs(props.to).format('YYYY-MM-DDTHH:mm') : maximumLocalTime.value
  invalidRange.value = false
}

const close = () => {
  if (details.value) details.value.open = false
}

const handleToggle = () => {
  if (details.value?.open) {
    maximumLocalTime.value = dayjs().format('YYYY-MM-DDTHH:mm')
    syncDraft()
  }
}

const selectPreset = (range: Exclude<TrafficRangePreset, 'custom'>) => {
  emit('change', range)
  close()
}

const applyCustomRange = () => {
  const from = dayjs(draftFrom.value)
  const to = dayjs(draftTo.value)
  if (!from.isValid() || !to.isValid() || !from.isBefore(to) || to.isAfter(dayjs())) {
    invalidRange.value = true
    return
  }

  emit('change', 'custom', from.toISOString(), to.toISOString())
  close()
}
</script>
