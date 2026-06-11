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

  let buffer = ''                   // 文本缓冲区（尚未形成完整行的字符）
  let byteRemainder: number[] = []   // UTF-8 多字节字符跨 chunk 截断的残留字节

  const dispatch = (event: string, data: string) => {
    if (!data) return
    if (data === SSE.DONE_SIGNAL) { (callbacks.onDone) && callbacks.onDone(); return }
    switch (event) {
      case 'thinking': (callbacks.onThinkingStart) && callbacks.onThinkingStart(); break
      case 'thinking_done': (callbacks.onThinkingEnd) && callbacks.onThinkingEnd(); break
      case 'message':
        // data 是 LLM 流式输出的纯文本（JSON 已由后端转义，前端拿到的是原文）
        ;(callbacks.onMessage) && callbacks.onMessage(data)
        break
      case 'error':
        (callbacks.onError) && callbacks.onError(data)
        break
    }
  }

  if (typeof reqTask.onChunkReceived === 'function') { reqTask.onChunkReceived((res: any) => {
    try {
      const chunkBytes = new Uint8Array(res.data)
      // 拼接上一轮截断残留的字节
      const combined = new Uint8Array(byteRemainder.length + chunkBytes.length)
      combined.set(byteRemainder, 0)
      combined.set(chunkBytes, byteRemainder.length)
      const { text: chunk, remainder } = arrayBufferToString(combined)
      byteRemainder = remainder
      buffer += chunk

      // JSON Lines: 每行是一个完整的 {"event":"...","data":"..."}
      // 按 \n 切分，最后一段（不完整行）留在 buffer
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line) continue // 跳过空行
        try {
          const msg = JSON.parse(line)
          dispatch(msg.event || SSE.DEFAULT_EVENT, msg.data || '')
        } catch {
          // 非 JSON 行，忽略（可能是 chunk 边界噪声）
        }
      }
    } catch (e) {}
  }); }

  return reqTask
}

function arrayBufferToString(array: Uint8Array): { text: string; remainder: number[] } {
  // 手写 UTF-8 解码器，返回 decoded 文本 + 未完成的尾部字节（供下一 chunk 拼接）
  const bytes = array
  const len = bytes.length
  const parts: string[] = []
  let i = 0

  while (i < len) {
    const b0 = bytes[i]
    let cp: number
    let seqLen: number

    if (b0 < 0x80) {
      // 1-byte ASCII (包括空格 0x20)
      cp = b0
      seqLen = 1
    } else if ((b0 & 0xE0) === 0xC0) {
      // 2-byte
      cp = ((b0 & 0x1F) << 6) | (bytes[i + 1] & 0x3F)
      seqLen = 2
    } else if ((b0 & 0xF0) === 0xE0) {
      // 3-byte (中文等)
      cp = ((b0 & 0x0F) << 12) | ((bytes[i + 1] & 0x3F) << 6) | (bytes[i + 2] & 0x3F)
      seqLen = 3
    } else if ((b0 & 0xF8) === 0xF0) {
      // 4-byte (emoji 等)
      cp = ((b0 & 0x07) << 18) | ((bytes[i + 1] & 0x3F) << 12) | ((bytes[i + 2] & 0x3F) << 6) | (bytes[i + 3] & 0x3F)
      seqLen = 4
    } else {
      // 非法字节（可能是截断后的 continuation byte），跳过
      i++
      continue
    }

    // 字节数不足 → 多字节字符被 chunk 边界截断，保留残留字节给下一轮
    if (i + seqLen > len) {
      const remainder: number[] = []
      for (let j = i; j < len; j++) remainder.push(bytes[j])
      return { text: parts.join(''), remainder }
    }

    // 转成 UTF-16，处理超出 BMP 的字符（如 emoji）
    if (cp > 0xFFFF) {
      cp -= 0x10000
      parts.push(String.fromCharCode(0xD800 + (cp >> 10), 0xDC00 + (cp & 0x3FF)))
    } else {
      parts.push(String.fromCharCode(cp))
    }
    i += seqLen
  }
  return { text: parts.join(''), remainder: [] }
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
