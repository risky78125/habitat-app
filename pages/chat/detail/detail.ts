import {
  getAgentDetail, createConversation, getConversationDetail, getMessages, sendMessage,
  type Agent, type Conversation,
} from '../../../utils/api'
import { waitForAppLogin } from '../../../utils/request'
import { formatTime } from '../../../utils/util'
import { TIMEOUT, MSG as M, DEFAULT_CHAT_INITIAL } from '../../../config'

import * as marked from '../../../libs/marked'

const S: Record<string, string> = {
  paragraph: 'margin:0 0 12rpx;line-height:1.65;',
  strong: 'font-weight:700;',
  em: 'font-style:italic;',
  codespan: 'font-family:Menlo,Consolas,monospace;font-size:24rpx;background:rgba(91,108,255,0.08);color:#5B6CFF;padding:2rpx 8rpx;border-radius:6rpx;',
  code: 'font-family:Menlo,Consolas,monospace;font-size:24rpx;background:#F5F6FA;color:#222;padding:16rpx 20rpx;border-radius:12rpx;display:block;overflow-x:auto;margin:10rpx 0;',
  blockquote: 'margin:10rpx 0;padding:8rpx 16rpx;border-left:6rpx solid #5B6CFF;background:rgba(91,108,255,0.04);color:#8B8FA8;',
  link: 'color:#5B6CFF;text-decoration:none;',
  heading: 'font-weight:700;margin:12rpx 0 8rpx;',
  hr: 'border:none;border-top:1rpx solid #E8E9F0;margin:16rpx 0;',
  image: 'max-width:100%;border-radius:12rpx;',
  table: 'width:100%;border-collapse:collapse;margin:10rpx 0;font-size:24rpx;',
  tablecell: 'border:1rpx solid #E8E9F0;padding:8rpx 12rpx;text-align:left;',
}

const HEADING_SIZE: Record<number, string> = { 1: '34rpx', 2: '32rpx', 3: '30rpx' }

const renderer = new marked.Renderer()

const origHeading = renderer.heading
renderer.heading = function (this: any, text: string, level: number, raw: string, slugger: any) {
  let html = origHeading.call(this, text, level, raw, slugger)
  const size = HEADING_SIZE[level] || '28rpx'
  return html.replace(/<h(\d)/, `<h$1 style="font-size:${size};${S.heading}"`)
}

const origList = renderer.list
renderer.list = function (this: any, body: string, ordered: boolean) {
  let html = origList.call(this, body, ordered)
  const tag = ordered ? 'ol' : 'ul'
  return html.replace(`<${tag}`, `<${tag} style="margin:8rpx 0;padding-left:32rpx;"`)
}

const origListItem = renderer.listitem
renderer.listitem = function (this: any, text: string) {
  let html = origListItem.call(this, text)
  return html.replace('<li', '<li style="margin:4rpx 0;line-height:1.6;"')
}

renderer.table = function (this: any, header: string, body: string) {
  const strip = (s: string) => s.replace(/<[^>]+>/g, '').trim()
  const parseCells = (html: string) => {
    const cells: string[] = []
    html.replace(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g, (_: string, c: string) => { cells.push(strip(c)); return '' })
    return cells
  }
  const headerCells = parseCells(header)
  const allBodyCells = parseCells(body)
  const colCount = headerCells.length || 1
  const bodyRows: string[][] = []
  for (let i = 0; i < allBodyCells.length; i += colCount) {
    bodyRows.push(allBodyCells.slice(i, i + colCount))
  }

  const rowStyle = 'display:flex;width:100%;'
  const cellStyle = (isHeader: boolean) =>
    `flex:1;padding:12rpx 16rpx;font-size:26rpx;line-height:1.5;word-break:break-all;` +
    (isHeader
      ? 'font-weight:600;background:rgba(91,108,255,0.06);color:#5B6CFF;'
      : 'color:#222;')

  let html = `<div style="margin:10rpx 0;border:1rpx solid #E8E9F0;border-radius:12rpx;overflow:hidden;">`
  if (headerCells.length) {
    html += `<div style="${rowStyle}border-bottom:1rpx solid #E8E9F0;">`
    headerCells.forEach(c => { html += `<div style="${cellStyle(true)}">${c}</div>` })
    html += `</div>`
  }
  bodyRows.forEach((row, ri) => {
    html += `<div style="${rowStyle}${ri < bodyRows.length - 1 ? 'border-bottom:1rpx solid #E8E9F0;' : ''}">`
    row.forEach(c => { html += `<div style="${cellStyle(false)}">${c}</div>` })
    html += `</div>`
  })
  html += `</div>`
  return html
}

renderer.tablerow = function (this: any, content: string) { return content }

renderer.tablecell = function (this: any, content: string, flags: any) { return `<t${flags.header ? 'h' : 'd'}>${content}</t${flags.header ? 'h' : 'd'}>` }

Object.keys(S).forEach((method) => {
  if (['heading', 'list', 'listitem', 'table', 'tablerow', 'tablecell'].includes(method)) return
  const orig = (renderer as any)[method]
  if (!orig) return
  ;(renderer as any)[method] = function (this: any) {
    const html = orig.apply(this, arguments)
    const style = S[method]
    if (!style || !html) return html
    const tag = method === 'paragraph' ? 'p' : method === 'codespan' ? 'code' : method
    return html.replace(`<${tag}`, `<${tag} style="${style}"`)
  }
})

marked.setOptions({ breaks: true, gfm: true, renderer })

const md2html = (md: string) => {
  if (!md) return ''
  try {
    const html = marked.parse(md) as string
    if (!html || html === md) return md
    return html
  } catch {
    return md
  }
}
const nowStr = () => formatTime(new Date().toISOString())

interface DisplayMessage {
  id: string; role: 'user' | 'assistant'; content: string; time: string
  isStreaming?: boolean; htmlContent?: string
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('请求超时')), ms)
    p.then(v => { clearTimeout(timer); resolve(v) }, e => { clearTimeout(timer); reject(e) })
  })
}

Component({
  data: {
    agent: null as Agent | null,
    conversation: null as Conversation | null,
    messages: [] as DisplayMessage[],
    inputText: '',
    isTyping: false,
    isThinking: false,
    agentId: 0,
    conversationId: 0,
    loading: true,
    loginFailed: false,
    isLoggedIn: false,
    scrollIntoViewId: '',
    userAvatarUrl: '',
    userAvatarInitial: '',
    keyboardHeight: 0,
    _initialized: false,
  },

  lifetimes: {
    attached() {
      const ctx = this as any
      ctx._initFallbackTimer = setTimeout(() => {
        if (!this.data._initialized) this._init({ agentId: '0', conversationId: '0' })
      }, TIMEOUT.CHAT_ONLOAD_FALLBACK)

      wx.onKeyboardHeightChange?.((res: any) => {
        this.setData({ keyboardHeight: res.height })
        if (res.height > 0) this.scrollToBottom()
      })
    },

    detached() {
      wx.offKeyboardHeightChange?.()
      const ctx = this as any
      if (ctx._initFallbackTimer) { clearTimeout(ctx._initFallbackTimer); ctx._initFallbackTimer = null }
      if (ctx._reqTask) { ctx._reqTask.abort(); ctx._reqTask = null }
    },
  },

  methods: {
    onLoad(options: any) {
      const ctx = this as any
      if (ctx._initFallbackTimer) { clearTimeout(ctx._initFallbackTimer); ctx._initFallbackTimer = null }
      this._init(options || {})
    },

    async _init(options: any) {
      if (this.data._initialized) return
      this.setData({ _initialized: true })

      const agentId = Number(options.agentId) || 0
      const conversationId = Number(options.conversationId) || 0
      this.setData({ agentId, conversationId })

      await this.checkLoginState()

      if (agentId) await this.loadAgent(agentId)
      else this.setData({ loading: false })

      if (conversationId) this.loadConversation(conversationId, agentId)

      setTimeout(() => { if (this.data.loading) this.setData({ loading: false }) }, TIMEOUT.CHAT_LOADING_GUARD)
    },

    // TODO: 优化 getAgentDetail API，只返回不敏感数据（name, welcomeMessage, category 等），
    // 避免暴露 prompt、model 配置等内部信息给前端
    async loadAgent(agentId: number) {
      try {
        const agent = await withTimeout(getAgentDetail(agentId), TIMEOUT.AGENT_DETAIL)
        this.setData({ agent, loading: false })
        if (agent.welcomeMessage) {
          this.setData({ messages: [{ id: 'welcome', role: 'assistant', content: agent.welcomeMessage, time: nowStr(), htmlContent: md2html(agent.welcomeMessage) }] })
        }
      } catch (e) {
        this.setData({ loading: false })
        wx.showToast({ title: M.AGENT_LOAD_FAIL, icon: 'none' })
      }
    },

    async checkLoginState() {
      try {
        const loggedIn = await waitForAppLogin()
        this.setData({ isLoggedIn: loggedIn, loginFailed: !loggedIn })
        if (loggedIn) this.loadUserAvatar()
      } catch { this.setData({ isLoggedIn: false, loginFailed: true }) }
    },

    loadUserAvatar() {
      const app = getApp()
      const user = app.globalData?.userInfo
      this.setData({
        userAvatarUrl: user?.avatarUrl || '',
        userAvatarInitial: (user?.nickname || DEFAULT_CHAT_INITIAL).charAt(0),
      })
    },

    async loadConversation(convId: number, agentId: number) {
      if (!this.data.isLoggedIn) { this.setData({ loading: false }); return }

      try {
        const [conversation, msgRes] = await Promise.all([
          withTimeout(getConversationDetail(convId), TIMEOUT.CONVERSATION_DETAIL),
          withTimeout(getMessages(convId, 0, PAGE.MESSAGES), TIMEOUT.MESSAGES_LOAD), // page=0 加载最后一页
        ])
        this.setData({ conversation, conversationId: convId })

        if (!this.data.agent && (agentId || conversation.agentId)) {
          await this.loadAgent(agentId || conversation.agentId)
        }

        const messages: DisplayMessage[] = (msgRes.records || []).map(msg => ({
          id: String(msg.id), role: msg.role as 'user' | 'assistant', content: msg.content,
          time: formatTime(msg.createdAt),
          htmlContent: msg.role === 'assistant' ? md2html(msg.content) : undefined,
        }))

        this.setData({ messages, loading: false })
        if (messages.length > 0) this.scrollToBottom()
      } catch {
        this.setData({ loading: false })
        wx.showToast({ title: M.CONVERSATION_LOAD_FAIL, icon: 'none' })
      }
    },

    onRetryLogin() {
      this.setData({ loginFailed: false })
      getApp().retryLogin().then((ok: boolean) => this.setData({ isLoggedIn: ok, loginFailed: !ok }))
    },

    onInputText(e: any) { this.setData({ inputText: e.detail.value }) },
    onInputFocus(e: any) { this.setData({ keyboardHeight: e.detail.height }); this.scrollToBottom() },
    onInputBlur() { this.setData({ keyboardHeight: 0 }) },

    updateMsg(id: string, patch: Partial<DisplayMessage>) {
      const idx = this.data.messages.findIndex(m => m.id === id)
      if (idx < 0) return
      const data: Record<string, any> = {}
      Object.keys(patch).forEach(k => { data[`messages[${idx}].${k}`] = (patch as any)[k] })
      this.setData(data)
    },

    async onSendMessage() {
      const content = this.data.inputText.trim()
      if (!content || this.data.isTyping) return

      if (!this.data.isLoggedIn) {
        this.setData({ loginFailed: true }); return
      }

      if (!this.data.agentId) { wx.showToast({ title: M.AGENT_INFO_ERROR, icon: 'none' }); return }

      const userMsg: DisplayMessage = { id: `u-${Date.now()}`, role: 'user', content, time: nowStr() }
      this.setData({ messages: [...this.data.messages, userMsg], inputText: '' })
      this.scrollToBottom()

      let conversationId = this.data.conversationId
      if (!conversationId) {
        try {
          const conv = await createConversation(this.data.agentId)
          this.setData({ conversation: conv, conversationId: conv.id })
          conversationId = conv.id
        } catch (e: any) {
          wx.showToast({ title: e.message || '创建对话失败', icon: 'none' }); return
        }
      }

      const aiMsgId = `ai-${Date.now()}`
      const aiMsg: DisplayMessage = { id: aiMsgId, role: 'assistant', content: '', time: nowStr(), isStreaming: true }
      this.setData({ messages: [...this.data.messages, aiMsg], isTyping: true })
      this.scrollToBottom()

      let full = '', done = false
      const ctx = this as any

      const reqTask = sendMessage(conversationId, content, {
        onMessage: (text: string) => {
          if (done || !text) return
          full += text
          this.updateMsg(aiMsgId, { content: full, htmlContent: md2html(full), isStreaming: true })
          this.scrollToBottom()
        },
        onThinkingStart: () => { if (!done) { this.setData({ isThinking: true }); this.scrollToBottom() } },
        onThinkingEnd: () => { if (!done) this.setData({ isThinking: false }) },
        onDone: () => {
          done = true
          ctx._reqTask = null
          this.updateMsg(aiMsgId, { content: full, htmlContent: md2html(full), isStreaming: false, time: nowStr() })
          this.setData({ isTyping: false, isThinking: false })
          this.scrollToBottom()
        },
        onError: () => {
          done = true
          if (ctx._reqTask) { ctx._reqTask.abort(); ctx._reqTask = null }
          this.updateMsg(aiMsgId, { content: '回复失败，请重试', htmlContent: md2html('回复失败，请重试'), isStreaming: false, time: nowStr() })
          this.setData({ isTyping: false, isThinking: false })
          this.scrollToBottom()
        },
      })
      ctx._reqTask = reqTask
    },

    scrollToBottom() {
      const ctx = this as any
      if (ctx._scrollTimer) return
      ctx._scrollTimer = setTimeout(() => { ctx._scrollTimer = null; this.setData({ scrollIntoViewId: 'bottom-anchor' }) }, 150)
    },

  },
})
