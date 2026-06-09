import { getConversations, deleteConversation, type Conversation } from '../../utils/api'
import { DEFAULT_GRADIENT } from '../../constants/categories'
import { formatRelativeTime } from '../../utils/util'
import { MSG as M, LOGIN_STATE } from '../../config'

interface DisplayConversation extends Conversation {
  displayTime: string
  displayIcon: string
  convGradient: string
}

Component({
  data: {
    statusBarHeight: 0,
    conversations: [] as DisplayConversation[],
    loading: true,
    loginFailed: false,
    page: 1,
    total: 0,
    hasMore: true,
    refreshing: false,
  },

  lifetimes: {
    attached() {
      const sysInfo = wx.getWindowInfo()
      this.setData({ statusBarHeight: sysInfo.statusBarHeight })
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
      const app = getApp()
      const loggedIn = await app.waitForLogin()
      if (!loggedIn) {
        this.setData({ loginFailed: true, loading: false })
        return
      }
      this.setData({ loginFailed: false })
      this.loadConversations()
    },

    async loadConversations(append = false) {
      if (!append) this.setData({ loading: true })

      try {
        const res = await getConversations(append ? this.data.page : 1, 20)
        const raw = append
          ? [...this.data.conversations, ...(res.records || [])]
          : (res.records || [])

        const conversations = raw.map(c => ({
          ...c,
          displayTime: formatRelativeTime(c.lastMessageAt),
          displayIcon: '🤖',
          convGradient: DEFAULT_GRADIENT,
        }))

        this.setData({
          conversations,
          total: res.total || 0,
          page: append ? this.data.page : 1,
          hasMore: conversations.length < (res.total || 0),
          loading: false,
        })
      } catch (e) {
        this.setData({ loading: false })
      }
    },

    onRetryLogin() {
      this.setData({ loginFailed: false, loading: true })
      const app = getApp()
      app.retryLogin().then((ok) => {
        if (ok) {
          this.setData({ loginFailed: false })
          this.loadConversations()
        } else {
          this.setData({ loginFailed: true, loading: false })
        }
      })
    },

    onConversationTap(e: any) {
      const { id, agentId } = e.currentTarget.dataset
      wx.navigateTo({
        url: `/pages/chat/detail/detail?conversationId=${id}&agentId=${agentId}`,
      })
    },

    onDeleteConversation(e: any) {
      const { id } = e.currentTarget.dataset
      wx.showModal({
        title: M.DELETE_CONFIRM_TITLE,
        content: M.DELETE_CONFIRM_CONTENT,
        success: async (res) => {
          if (res.confirm) {
            try {
              await deleteConversation(id)
              wx.showToast({ title: M.DELETED, icon: 'success' })
              this.loadConversations()
            } catch (e) {
              wx.showToast({ title: M.DELETE_FAILED, icon: 'none' })
            }
          }
        },
      })
    },

    onReachBottom() {
      if (this.data.hasMore && !this.data.loading) {
        this.setData({ page: this.data.page + 1 })
        this.loadConversations(true)
      }
    },

    async onPullDownRefresh() {
      this.setData({ page: 1, refreshing: true })
      await this.loadConversations()
      this.setData({ refreshing: false })
    },
  },
})
