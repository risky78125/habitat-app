import {
  getAgentDetail, createConversation, getConversationDetail, getMessages, sendMessage,
  type Agent, type Conversation,
} from '../../../utils/api'
import { waitForAppLogin } from '../../../utils/request'
import { formatTime } from '../../../utils/util'
import { TIMEOUT, MSG as M, DEFAULT_CHAT_INITIAL } from '../../../config'

const mdParser = require('../../../towxml/parse/markdown/index')
const md2html = (md: string) => {
  if (!md) return ''
  try {
    const html = mdParser(md)
    // 转换失败（残缺 markdown）时返回空，让模板走 <text> 兜底
    if (!html || html === md) return md
    return html
  } catch {
    return md
  }
}
const now = () => `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`

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
      setTimeout(() => {
        if (!this.data._initialized) this._init({ agentId: '0', conversationId: '0' })
      }, TIMEOUT.CHAT_ONLOAD_FALLBACK)

      wx.onKeyboardHeightChange?.((res: any) => {
        this.setData({ keyboardHeight: res.height })
        if (res.height > 0) this.scrollToBottom()
      })
    },
  },

  methods: {
    onLoad(options: any) { this._init(options || {}) },

    async _init(options: any) {
      if (this.data._initialized) return
      this.setData({ _initialized: true })

      const agentId = Number(options.agentId) || 0
      const conversationId = Number(options.conversationId) || 0
      this.setData({ agentId, conversationId })

      await this.checkLoginState()

      if (agentId) this.loadAgent(agentId)
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
          this.setData({ messages: [{ id: 'welcome', role: 'assistant', content: agent.welcomeMessage, time: now(), htmlContent: md2html(agent.welcomeMessage) }] })
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
          withTimeout(getMessages(convId), TIMEOUT.MESSAGES_LOAD),
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

      const userMsg: DisplayMessage = { id: `u-${Date.now()}`, role: 'user', content, time: now() }
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
      const aiMsg: DisplayMessage = { id: aiMsgId, role: 'assistant', content: '', time: now(), isStreaming: true }
      this.setData({ messages: [...this.data.messages, aiMsg], isTyping: true })
      this.scrollToBottom()

      let full = '', done = false

      sendMessage(conversationId, content, {
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
          this.updateMsg(aiMsgId, { content: full, htmlContent: md2html(full), isStreaming: false, time: now() })
          this.setData({ isTyping: false, isThinking: false })
          this.scrollToBottom()
        },
        onError: () => {
          done = true
          this.updateMsg(aiMsgId, { content: '回复失败，请重试', htmlContent: md2html('回复失败，请重试'), isStreaming: false, time: now() })
          this.setData({ isTyping: false, isThinking: false })
          this.scrollToBottom()
        },
      })
    },

    scrollToBottom() {
      const ctx = this as any
      if (ctx._scrollTimer) return
      ctx._scrollTimer = setTimeout(() => { ctx._scrollTimer = null; this.setData({ scrollIntoViewId: 'bottom-anchor' }) }, 150)
    },

    onCopyMessage(e: any) {
      if (e.currentTarget.dataset.role !== 'user') return
      wx.setClipboardData({ data: e.currentTarget.dataset.content, success: () => wx.showToast({ title: M.COPIED, icon: 'success' }) })
    },
  },
})
