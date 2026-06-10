import {
  getAgentDetail,
  createConversation,
  getConversationDetail,
  getMessages,
  sendMessage,
  type Agent,
  type Conversation,
} from '../../../utils/api'
import { waitForAppLogin } from '../../../utils/request'
import { formatTime } from '../../../utils/util'
import { TIMEOUT, MSG as M, DEFAULT_CHAT_INITIAL } from '../../../config'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const towxml = require('../../../towxml/index')

const STREAM_RENDER_INTERVAL = 48

function parseTowxml(md: string) {
  if (!md) return null
  return towxml(md, 'markdown')
}

interface DisplayMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  time: string
  isStreaming?: boolean
  markdownNodes?: Record<string, any> | null
}

function enrichMessage(m: DisplayMessage): DisplayMessage {
  if (m.role === 'assistant' && m.content) {
    return { ...m, markdownNodes: parseTowxml(m.content) }
  }
  return m
}

function getTime(): string {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('请求超时')), ms)
    p.then((v) => { clearTimeout(timer); resolve(v) })
     .catch((e) => { clearTimeout(timer); reject(e) })
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
    showTypingIndicator: false,
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
      // attached 不带 options，等 onLoad 初始化；若 onLoad 未触发则兜底
      setTimeout(() => {
        if (!this.data._initialized) {
          console.warn('[chat-detail] onLoad not fired, using attached fallback')
          this._init({ agentId: '0', conversationId: '0' })
        }
      }, TIMEOUT.CHAT_ONLOAD_FALLBACK)

      // 监听键盘高度变化
      if (wx.onKeyboardHeightChange) {
        wx.onKeyboardHeightChange((res) => {
          this.setData({ keyboardHeight: res.height })
          if (res.height > 0) {
            this.scrollToBottom()
          }
        })
      }
    },
  },

  methods: {
    /** 页面 onLoad，必须在 methods 里才能收到 options */
    onLoad(options: any) {
      console.log('[chat-detail] onLoad, options=', JSON.stringify(options))
      this._init(options || {})
    },

    _init(options: any) {
      if (this.data._initialized) return
      this.setData({ _initialized: true })

      const agentId = Number(options.agentId) || 0
      const conversationId = Number(options.conversationId) || 0

      console.log('[chat-detail] _init, agentId=', agentId, 'conversationId=', conversationId)
      this.setData({ agentId, conversationId })

      if (agentId) {
        this.loadAgent(agentId)
      } else {
        this.setData({ loading: false })
      }

      if (conversationId) {
        this.loadConversation(conversationId, agentId)
      }

      this.checkLoginState()

      // 兜底：8 秒后停止 loading
      setTimeout(() => {
        if (this.data.loading) {
          console.warn('[chat-detail] loading timeout')
          this.setData({ loading: false })
        }
      }, TIMEOUT.CHAT_LOADING_GUARD)
    },

    async loadAgent(agentId: number) {
      console.log('[chat-detail] loadAgent, agentId=', agentId)
      try {
        const agent = await withTimeout(getAgentDetail(agentId), TIMEOUT.AGENT_DETAIL)
        console.log('[chat-detail] loadAgent success:', agent.name)
        this.setData({ agent, loading: false })

      if (agent.welcomeMessage) {
        this.setData({
          messages: [{
            id: 'welcome',
            role: 'assistant',
            content: agent.welcomeMessage,
            time: getTime(),
            markdownNodes: parseTowxml(agent.welcomeMessage),
          }],
        })
      }
      } catch (e) {
        console.error('[chat-detail] loadAgent failed:', e)
        this.setData({ loading: false })
        wx.showToast({ title: M.AGENT_LOAD_FAIL, icon: 'none' })
      }
    },

    async checkLoginState() {
      try {
        const loggedIn = await waitForAppLogin()
        this.setData({ isLoggedIn: loggedIn, loginFailed: !loggedIn })
        if (loggedIn) {
          this.loadUserAvatar()
        }
      } catch (e) {
        this.setData({ isLoggedIn: false, loginFailed: true })
      }
    },

    loadUserAvatar() {
      const app = getApp()
      const userInfo = app.globalData && app.globalData.userInfo
      if (userInfo) {
        this.setData({
          userAvatarUrl: userInfo.avatarUrl || '',
          userAvatarInitial: (userInfo.nickname || DEFAULT_CHAT_INITIAL).charAt(0),
        })
      } else {
        // Fallback: use first char
        this.setData({ userAvatarInitial: DEFAULT_CHAT_INITIAL })
      }
    },

    async loadConversation(convId: number, agentId: number) {
      const loggedIn = await waitForAppLogin()
      if (!loggedIn) {
        this.setData({ loading: false })
        return
      }

      try {
        const [conversation, msgRes] = await Promise.all([
          withTimeout(getConversationDetail(convId), TIMEOUT.CONVERSATION_DETAIL),
          withTimeout(getMessages(convId), TIMEOUT.MESSAGES_LOAD),
        ])

        this.setData({ conversation, conversationId: convId })

        if (!this.data.agent && (agentId || conversation.agentId)) {
          await this.loadAgent(agentId || conversation.agentId)
        }

        const messages: DisplayMessage[] = (msgRes.records || []).map((msg) => enrichMessage({
          id: String(msg.id),
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
          time: formatTime(msg.createdAt),
        }))

        if (messages.length > 0) {
          this.setData({ messages, loading: false })
          this.scrollToBottom()
        } else {
          this.setData({ loading: false })
        }
      } catch (e) {
        this.setData({ loading: false })
        wx.showToast({ title: M.CONVERSATION_LOAD_FAIL, icon: 'none' })
      }
    },

    onRetryLogin() {
      this.setData({ loginFailed: false })
      const app = getApp()
      app.retryLogin().then((ok: boolean) => {
        this.setData({ isLoggedIn: ok, loginFailed: !ok })
      })
    },

    onInputText(e: any) {
      this.setData({ inputText: e.detail.value })
    },

    onInputFocus(e: any) {
      const { height } = e.detail
      this.setData({ keyboardHeight: height })
      this.scrollToBottom()
    },

    onInputBlur() {
      this.setData({ keyboardHeight: 0 })
    },

    findMessageIndex(id: string): number {
      return this.data.messages.findIndex((m: DisplayMessage) => m.id === id)
    },

    updateMessage(id: string, patch: Partial<DisplayMessage>) {
      const index = this.findMessageIndex(id)
      if (index < 0) return

      const data: Record<string, any> = {}
      Object.keys(patch).forEach((key) => {
        data[`messages[${index}].${key}`] = (patch as Record<string, any>)[key]
      })
      this.setData(data)
    },

    clearStreamRenderTimer() {
      const ctx = this as any
      if (ctx._streamRenderTimer) {
        clearTimeout(ctx._streamRenderTimer)
        ctx._streamRenderTimer = null
      }
    },

    flushStreamingMarkdown(aiMsgId: string, isStreaming = true) {
      const ctx = this as any
      const content = ctx._pendingStreamContent || ''
      if (!content) return

      this.updateMessage(aiMsgId, {
        content,
        markdownNodes: parseTowxml(content),
      })
      this.setData({ isThinking: false })
      this.scrollToBottom()
    },

    scheduleStreamingMarkdown(aiMsgId: string, content: string, immediate = false) {
      const ctx = this as any
      ctx._pendingStreamContent = content

      if (immediate) {
        this.clearStreamRenderTimer()
        this.flushStreamingMarkdown(aiMsgId, true)
        return
      }

      if (ctx._streamRenderTimer) return
      ctx._streamRenderTimer = setTimeout(() => {
        ctx._streamRenderTimer = null
        this.flushStreamingMarkdown(aiMsgId, true)
      }, STREAM_RENDER_INTERVAL)
    },

    async onSendMessage() {
      const content = this.data.inputText.trim()
      if (!content || this.data.isTyping) return

      if (!this.data.isLoggedIn) {
        const loggedIn = await waitForAppLogin()
        if (!loggedIn) {
          this.setData({ loginFailed: true })
          return
        }
        this.setData({ isLoggedIn: true, loginFailed: false })
      }

      const agentId = this.data.agentId
      if (!agentId) {
        wx.showToast({ title: M.AGENT_INFO_ERROR, icon: 'none' })
        return
      }

      const userMsg: DisplayMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content,
        time: getTime(),
      }
      const messages = [...this.data.messages, userMsg]
      this.setData({ messages, inputText: '' })
      this.scrollToBottom()

      let conversationId: number
      try {
        if (this.data.conversationId) {
          conversationId = this.data.conversationId
        } else {
          const conv = await createConversation(agentId)
          this.setData({ conversation: conv, conversationId: conv.id })
          conversationId = conv.id
        }
      } catch (e: any) {
        wx.showToast({ title: e.message || '创建对话失败', icon: 'none' })
        return
      }

      const aiMsgId = `ai-${Date.now()}`
      const aiMsg: DisplayMessage = {
        id: aiMsgId,
        role: 'assistant',
        content: '',
        time: getTime(),
        isStreaming: true,
      }
      this.setData({
        messages: [...messages, aiMsg],
        isTyping: true,
        showTypingIndicator: false,
      })
      this.scrollToBottom()

      let fullContent = ''
      let finished = false
      ;(this as any)._pendingStreamContent = ''

      const finishStream = (fallbackContent?: string) => {
        if (finished) return
        finished = true
        this.clearStreamRenderTimer()

        const finalContent = fullContent || fallbackContent || ''
        if (finalContent) {
          this.updateMessage(aiMsgId, {
            content: finalContent,
            markdownNodes: parseTowxml(finalContent),
            isStreaming: false,
            time: getTime(),
          })
        } else {
          this.updateMessage(aiMsgId, {
            content: '回复失败，请重试',
            markdownNodes: parseTowxml('回复失败，请重试'),
            isStreaming: false,
            time: getTime(),
          })
        }

        this.setData({ isTyping: false, isThinking: false, showTypingIndicator: false })
        this.scrollToBottom()
      }

      sendMessage(conversationId, content, {
        onMessage: (text: string) => {
          if (finished || !text) return
          fullContent += text
          this.scheduleStreamingMarkdown(aiMsgId, fullContent, fullContent === text)
        },
        onThinkingStart: () => {
          if (finished) return
          this.setData({ isThinking: true })
          this.scrollToBottom()
        },
        onThinkingEnd: () => {
          if (finished) return
          this.setData({ isThinking: false })
        },
        onDone: () => {
          finishStream()
        },
        onError: () => {
          finishStream('回复失败，请重试')
        },
      })
    },

    scrollToBottom() {
      const ctx = this as any
      if (ctx._scrollTimer) return
      
      ctx._scrollTimer = setTimeout(() => {
        ctx._scrollTimer = null
        this.setData({ scrollIntoViewId: 'bottom-anchor' })
      }, 150)
    },

    onBack() {
      wx.navigateBack({ delta: 1 })
    },

    onCopyMessage(e: any) {
      const content = e.currentTarget.dataset.content
      const role = e.currentTarget.dataset.role
      if (role !== 'user') return

      wx.setClipboardData({
        data: content,
        success: () => {
          wx.showToast({ title: M.COPIED, icon: 'success' })
        },
      })
    },
  },
})
