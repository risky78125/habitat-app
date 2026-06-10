import { BASE_URL, API, STORAGE, HTTP, AUTH_HEADER_PREFIX, SSE, LOGIN_STATE, MSG as M } from '../config'

interface RequestOptions {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: any
  header?: Record<string, string>
  needAuth?: boolean
}

interface ApiResponse<T = any> {
  code: number
  message: string
  data: T
}

interface PageResult<T = any> {
  total: number
  page: number
  size: number
  records: T[]
}

function getToken(): string {
  return wx.getStorageSync(STORAGE.TOKEN) || ''
}

function setToken(token: string) {
  wx.setStorageSync(STORAGE.TOKEN, token)
}

function clearAuth() {
  wx.removeStorageSync(STORAGE.TOKEN)
  wx.removeStorageSync(STORAGE.REFRESH_TOKEN)
  wx.removeStorageSync(STORAGE.USER_ID)
  try {
    const app = getApp()
    if (app && app.globalData) {
      app.globalData.isLoggedIn = false
      app.globalData.loginState = LOGIN_STATE.FAILED
      app.globalData.userInfo = null
      app._loginPromise = null
    }
  } catch (e) {}
}

/** 等 app 登录完成。onLaunch 期间 getApp() 可能为 undefined，直接检查 token */
function waitForAppLogin(): Promise<boolean> {
  try {
    const app = getApp()
    if (app && app.waitForLogin) {
      return app.waitForLogin()
    }
  } catch (e) {
    // getApp() 在 App() 构造函数内会抛错
  }
  return Promise.resolve(!!getToken())
}

function request<T = any>(options: RequestOptions): Promise<T> {
  const authRequired = options.needAuth !== false

  const doRequest = (): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      const header: Record<string, string> = {
        'Content-Type': 'application/json',
        ...options.header,
      }

      if (authRequired) {
        const token = getToken()
        if (token) {
          header['Authorization'] = AUTH_HEADER_PREFIX + token
        }
      }

      wx.request({
        url: `${BASE_URL}${options.url}`,
        method: options.method || 'GET',
        data: options.data,
        header,
        success(res: any) {
          const body = res.data as ApiResponse<T>
          if (res.statusCode === HTTP.UNAUTHORIZED) {
            refreshToken().then(() => {
              request(options).then(resolve).catch(reject)
            }).catch(() => {
              clearAuth()
              wx.showToast({ title: M.RELOAD_LOGIN, icon: 'none' })
              reject(new Error('auth expired'))
            })
            return
          }
          if (body.code === HTTP.OK) {
            resolve(body.data)
          } else {
            wx.showToast({ title: body.message || M.REQUEST_FAILED, icon: 'none' })
            reject(new Error(body.message))
          }
        },
        fail(err) {
          wx.showToast({ title: M.NETWORK_ERROR, icon: 'none' })
          reject(err)
        },
      })
    })
  }

  if (!authRequired) {
    return doRequest()
  }

  return waitForAppLogin().then((loggedIn) => {
    if (!loggedIn) {
      return Promise.reject(new Error('not logged in'))
    }
    return doRequest()
  })
}

function refreshToken(): Promise<void> {
  const rt = wx.getStorageSync(STORAGE.REFRESH_TOKEN)
  if (!rt) return Promise.reject(new Error('no refresh token'))

  return new Promise((resolve, reject) => {
    wx.request({
      url: `${BASE_URL}${API.AUTH_REFRESH}?refreshToken=${encodeURIComponent(rt)}`,
      method: 'POST',
      header: { 'Content-Type': 'application/json' },
      success(res: any) {
        const body = res.data as ApiResponse<{ token: string }>
        if (body.code === HTTP.OK && (body.data) && body.data.token) {
          setToken(body.data.token)
          resolve()
        } else {
          reject(new Error('refresh failed'))
        }
      },
      fail() {
        reject(new Error('refresh failed'))
      },
    })
  })
}

interface SSECallbacks {
  onMessage?: (text: string) => void
  onDone?: () => void
  onError?: (err: any) => void
  onThinkingStart?: () => void
  onThinkingEnd?: () => void
}

async function requestSSE(conversationId: number, content: string, callbacks: SSECallbacks) {
  await waitForAppLogin()

  const reqTask = wx.request({
    url: `${BASE_URL}${API.CONVERSATION_MESSAGES.replace('{id}', String(conversationId))}`,
    method: 'POST',
    data: { content },
    header: {
      'Content-Type': 'application/json',
      'Authorization': AUTH_HEADER_PREFIX + getToken(),
    },
    enableChunked: true,
    dataType: '其他',
    responseType: 'arraybuffer',
    success() {
      (callbacks.onDone) && callbacks.onDone()
    },
    fail(err) {
      (callbacks.onError) && callbacks.onError(err)
    },
  })

  let buffer = ''
  let currentEvent = SSE.DEFAULT_EVENT
  let currentData = ''

  const dispatch = (event: string, data: string) => {
    if (!data) return true
    if (data === SSE.DONE_SIGNAL) { (callbacks.onDone) && callbacks.onDone(); return false }
    switch (event) {
      case 'thinking': (callbacks.onThinkingStart) && callbacks.onThinkingStart(); break
      case 'thinking_done': (callbacks.onThinkingEnd) && callbacks.onThinkingEnd(); break
      case 'message':
        try {
          const parsed = JSON.parse(data)
          const text = parsed.content || parsed.data || parsed.text || data
          ;(callbacks.onMessage) && callbacks.onMessage(text)
        } catch { (callbacks.onMessage) && callbacks.onMessage(data) }
        break
      case 'error':
        try {
          const parsed = JSON.parse(data)
          ;(callbacks.onError) && callbacks.onError(parsed.message || parsed.error || data)
        } catch { (callbacks.onError) && callbacks.onError(data) }
        break
    }
    return true
  }

  if (typeof reqTask.onChunkReceived === 'function') { reqTask.onChunkReceived((res: any) => {
    try {
      const chunk = arrayBufferToString(res.data)
      buffer += chunk

      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        // 空行 = 事件结束
        if (line.trim() === '') {
          const data = currentData
          currentData = ''
          if (!dispatch(currentEvent, data)) return
          currentEvent = SSE.DEFAULT_EVENT
          continue
        }

        if (line.startsWith(SSE.EVENT_PREFIX)) {
          currentEvent = line.slice(SSE.EVENT_PREFIX.length).trim()
          continue
        }

        if (line.startsWith(SSE.DATA_PREFIX)) {
          // 多个 data: 行用 \n 拼接
          const d = line.slice(SSE.DATA_PREFIX.length).replace(/^ /, '')
          currentData += (currentData ? '\n' : '') + d
          continue
        }

        // 不匹配任何前缀 → JSON 内容内部的换行，拼到 currentData
        currentData += '\n' + line
      }
    } catch (e) {}
  }); }

  return reqTask
}

function arrayBufferToString(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let result = ''
  for (let i = 0; i < bytes.length; i++) {
    result += String.fromCharCode(bytes[i])
  }
  try {
    return decodeURIComponent(escape(result))
  } catch {
    return result
  }
}

export {
  BASE_URL,
  request,
  requestSSE,
  getToken,
  setToken,
  clearAuth,
  waitForAppLogin,
  type ApiResponse,
  type PageResult,
  type SSECallbacks,
}
