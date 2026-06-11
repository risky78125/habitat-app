import { getConversations, deleteConversation, type Conversation } from '../../utils/api'
import type { DisplayConversation } from '../../utils/types'
import { DEFAULT_GRADIENT } from '../../constants/categories'
import { formatRelativeTime } from '../../utils/util'
import { MSG as M, LOGIN_STATE } from '../../config'

const PAGE_SIZE = 20

Component({
  data: {
    conversations: [] as DisplayConversation[],
    loading: true,
    loadError: false,
    loginFailed: false,
    hasMore: true,
    refreshing: false,
  },

  lifetimes: {
    attached() {
      this.initAfterLogin()
    },
  },

  pageLifetimes: {
    show() {
      if (typeof this.getTabBar === 'function' && this.getTabBar()) {
        this.getTabBar().setData({ selected: 2 })
      }
      if (getApp().globalData.loginState === LOGIN_STATE.SUCCESS) {
        this.loadConversations()
      }
    },
  },

  methods: {
    async initAfterLogin() {
      const ok = await getApp().waitForLogin()
      if (!ok) { this.setData({ loginFailed: true, loading: false }); return }
      this.setData({ loginFailed: false })
      this.loadConversations()
    },

    async loadConversations(append = false, silent = false) {
      if (!append && !silent) this.setData({ loading: true, loadError: false })

      try {
        const page = append ? (this as any)._page || 1 : 1
        const res = await getConversations(page, PAGE_SIZE)
        const records = append
          ? [...this.data.conversations, ...(res.records || [])]
          : (res.records || [])

        ;(this as any)._page = page
        this.setData({
          conversations: records.map(c => ({
            ...c,
            displayTime: formatRelativeTime(c.lastMessageAt),
            displayIcon: '🤖',
            convGradient: DEFAULT_GRADIENT,
          })),
          hasMore: records.length < (res.total || 0),
          loading: false,
        })
      } catch {
        this.setData({ loading: false, loadError: !append })
      }
    },

    async onRetryLogin() {
      this.setData({ loginFailed: false, loading: true })
      const ok = await getApp().retryLogin()
      this.setData(ok ? { loginFailed: false } : { loginFailed: true, loading: false })
      if (ok) this.loadConversations()
    },

    onConversationTap(e: any) {
      const { id, agentId } = e.currentTarget.dataset
      wx.navigateTo({ url: `/pages/chat/detail/detail?conversationId=${id}&agentId=${agentId}` })
    },

    onDeleteConversation(e: any) {
      const id = e.currentTarget.dataset.id
      wx.showModal({
        title: M.DELETE_CONFIRM_TITLE,
        content: M.DELETE_CONFIRM_CONTENT,
        success: async (res) => {
          if (!res.confirm) return
          try {
            await deleteConversation(id)
            wx.showToast({ title: M.DELETED, icon: 'success' })
            this.loadConversations()
          } catch {
            wx.showToast({ title: M.DELETE_FAILED, icon: 'none' })
          }
        },
      })
    },

    onReachBottom() {
      if (!this.data.hasMore || this.data.loading) return
      this.setData({ loading: true })
      ;(this as any)._page = ((this as any)._page || 1) + 1
      this.loadConversations(true)
    },

    async onPullDownRefresh() {
      this.setData({ refreshing: true })
      ;(this as any)._page = 1
      await this.loadConversations(false, true)
      this.setData({ refreshing: false })
    },

    onRetryLoad() {
      this.loadConversations()
    },
  },
})
