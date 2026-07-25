<template>
  <div class="flex min-w-0 flex-col gap-1.5">
    <label
      :for="inputId"
      class="text-base-content/60 text-xs font-medium"
    >
      {{ label }}
    </label>
    <div
      class="bg-base-100 flex min-h-9 flex-wrap items-center gap-1 rounded-lg border px-2 py-1 transition-colors"
      :class="
        errorMessage
          ? 'border-error focus-within:border-error'
          : 'border-base-300 focus-within:border-primary'
      "
    >
      <span
        v-for="value in model"
        :key="value"
        class="badge badge-sm badge-soft max-w-full gap-1"
        :title="value"
      >
        <span class="min-w-0 flex-1 truncate">{{ value }}</span>
        <button
          type="button"
          class="hover:text-error shrink-0"
          :aria-label="`${removeLabel}: ${value}`"
          @click="removeValue(value)"
        >
          <XMarkIcon class="h-3 w-3" />
        </button>
      </span>
      <input
        :id="inputId"
        v-model="inputValue"
        type="text"
        class="min-w-28 flex-1 bg-transparent py-0.5 text-xs outline-none"
        :placeholder="model.length ? '' : placeholder"
        :aria-label="label"
        :aria-invalid="errorMessage ? 'true' : undefined"
        :aria-describedby="errorMessage ? errorId : hintId"
        @blur="commitInput"
        @input="clearError"
        @keydown.backspace="removeLastValue"
        @keydown.enter="commitOnEnter"
        @keydown.escape="inputValue = ''"
        @paste="pasteValues"
      />
    </div>
    <span
      v-if="errorMessage"
      :id="errorId"
      class="text-error text-[11px]"
      role="alert"
    >
      {{ errorMessage }}
    </span>
    <span
      v-else
      :id="hintId"
      class="text-base-content/40 text-[11px]"
    >
      {{ hint }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { XMarkIcon } from '@heroicons/vue/24/outline'
import { ref, useId } from 'vue'

const props = defineProps<{
  label: string
  placeholder: string
  hint: string
  removeLabel: string
  tooManyError: string
  tooLongError: string
}>()

const emit = defineEmits<{
  change: [values: string[]]
}>()
const model = defineModel<string[]>({ required: true })
const inputId = useId()
const hintId = `${inputId}-hint`
const errorId = `${inputId}-error`
const inputValue = ref('')
const errorMessage = ref('')

const maximumValues = 256
const maximumValueBytes = 1024
const utf8Encoder = new TextEncoder()

const appendValues = (values: string[]) => {
  const additions: string[] = []
  const seen = new Set(model.value)

  for (const candidate of values) {
    const value = candidate.trim()
    if (!value || seen.has(value)) continue
    if (utf8Encoder.encode(value).byteLength > maximumValueBytes) {
      errorMessage.value = props.tooLongError
      return false
    }
    seen.add(value)
    additions.push(value)
  }

  if (model.value.length + additions.length > maximumValues) {
    errorMessage.value = props.tooManyError
    return false
  }

  errorMessage.value = ''
  if (additions.length) {
    const next = [...model.value, ...additions]
    model.value = next
    emit('change', next)
  }
  return true
}

const commitInput = () => {
  if (appendValues([inputValue.value])) {
    inputValue.value = ''
  }
}

const commitOnEnter = (event: KeyboardEvent) => {
  if (event.isComposing) return
  event.preventDefault()
  commitInput()
}

const pasteValues = (event: ClipboardEvent) => {
  const content = event.clipboardData?.getData('text') ?? ''
  if (!/[\r\n]/.test(content)) return

  event.preventDefault()
  if (appendValues([inputValue.value, ...content.split(/\r\n?|\n/)])) {
    inputValue.value = ''
  }
}

const removeValue = (value: string) => {
  errorMessage.value = ''
  model.value = model.value.filter((item) => item !== value)
  emit('change', model.value)
}

const removeLastValue = (event: KeyboardEvent) => {
  if (event.isComposing) return
  if (inputValue.value || !model.value.length) return
  event.preventDefault()
  errorMessage.value = ''
  model.value = model.value.slice(0, -1)
  emit('change', model.value)
}

const clearError = () => {
  errorMessage.value = ''
}
</script>
