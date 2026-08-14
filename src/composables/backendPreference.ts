import { useStorage } from '@vueuse/core'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'

export const useBackendPreference = <T>(
  storageKey: string,
  backendUuid: MaybeRefOrGetter<string | null | undefined>,
  defaultValue: T,
  isValid: (value: unknown) => value is T,
) => {
  const preferences = useStorage<Record<string, T>>(storageKey, {})

  return computed<T>({
    get: () => {
      const uuid = toValue(backendUuid)
      if (!uuid) return defaultValue

      const value = preferences.value[uuid]
      return isValid(value) ? value : defaultValue
    },
    set: (value) => {
      const uuid = toValue(backendUuid)
      if (!uuid || !isValid(value)) return

      preferences.value = {
        ...preferences.value,
        [uuid]: value,
      }
    },
  })
}
