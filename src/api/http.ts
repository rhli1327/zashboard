// api 层 · axios 实例的全局拦截器。
// 这是 api 层唯一允许依赖 store/setup 的地方:请求需要从 activeBackend 取得
// 当前连接目标(baseURL / 鉴权)。其余 api 文件不得依赖上层。
import { ROUTE_NAME } from '@/constant'
import { showNotification } from '@/helper/notification'
import { getBackendConnectionKey, getUrlFromBackend } from '@/helper/utils'
import { activeBackend, activeUuid } from '@/store/setup'
import axios, { AxiosError } from 'axios'
import { nextTick } from 'vue'

declare module 'axios' {
  interface InternalAxiosRequestConfig {
    zashboardBackendKey?: string
  }
}

axios.interceptors.request.use((config) => {
  if (activeBackend.value) {
    config.baseURL = getUrlFromBackend(activeBackend.value)
    config.headers['Authorization'] = 'Bearer ' + activeBackend.value.password
    config.zashboardBackendKey = getBackendConnectionKey(activeBackend.value)
  }
  return config
})

const resolvedErrorUrls = ['/delay', '/healthcheck', '/weights', '/storage/zashboard']
const silentRejectedUrls = ['/mbox/v2/traffic/capabilities']

axios.interceptors.response.use(
  null,
  async (
    error: AxiosError<{
      message?: string
      error?: string
    }>,
  ) => {
    const isCurrentBackendRequest =
      !!error.config?.zashboardBackendKey &&
      error.config.zashboardBackendKey === getBackendConnectionKey(activeBackend.value)

    if (error.config?.zashboardBackendKey && !isCurrentBackendRequest) {
      return Promise.reject(error)
    }

    if (error.status === 401 && activeUuid.value && isCurrentBackendRequest) {
      const failedBackendKey = error.config?.zashboardBackendKey
      const failedBackendUuid = activeUuid.value
      const { default: router } = await import('@/router')

      // Loading the router is asynchronous. The user may switch or edit the
      // backend in that window, so revalidate before logging anything out.
      if (
        failedBackendKey !== getBackendConnectionKey(activeBackend.value) ||
        failedBackendUuid !== activeUuid.value
      ) {
        return Promise.reject(error)
      }

      activeUuid.value = null
      router.push({
        name: ROUTE_NAME.setup,
        query: { editBackend: failedBackendUuid },
      })
      nextTick(() => {
        showNotification({ content: 'unauthorizedTip' })
      })
      return error
    } else if (
      ![...resolvedErrorUrls, ...silentRejectedUrls].some((url) => error.config?.url?.endsWith(url))
    ) {
      const errorMessage =
        error.response?.data?.message || error.response?.data?.error || error.message

      showNotification({
        key: errorMessage,
        content: `${decodeURIComponent(error.config?.url || '')} \n${errorMessage}`,
        type: 'alert-error',
      })
    }

    // Preserve the established caller contract for latency, smart-weight and
    // storage probes: they inspect the returned error-like status themselves.
    if (resolvedErrorUrls.some((url) => error.config?.url?.endsWith(url))) {
      return error
    }

    return Promise.reject(error)
  },
)
