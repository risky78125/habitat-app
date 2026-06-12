import { getHotAgents, getConversations, getUserProfile, getAgentCategories, type Agent, type Conversation, type UserProfile, type Category } from '../../utils/api'
import type { DisplayAgent, DisplayConversation } from '../../utils/types'
import { FALLBACK_META, DEFAULT_GRADIENT } from '../../constants/categories'
import { formatRelativeTime } from '../../utils/util'
import { PAGE, DEFAULT_NICKNAME, DEFAULT_AVATAR_INITIAL, FALLBACK_ICON } from '../../config'

interface QuickCategory {
  key: string
  label: string
  icon: string
  color: string
  bg: string
  isImage?: boolean
}

Component({
  data: {
    statusBarHeight: 0,
    greeting: '',
    nickname: DEFAULT_NICKNAME,
    avatarInitial: DEFAULT_AVATAR_INITIAL,
    isLoggedIn: false,
    showProfileSetup: false,
    featuredAgent: null as DisplayAgent | null,
    featuredIcon: FALLBACK_ICON,
    featuredIconIsImage: false,
    hotAgents: [] as DisplayAgent[],
    quickCategories: [] as QuickCategory[],
    _catMap: {} as Record<string, Category>,
    recentConversations: [] as DisplayConversation[],
    loading: true,
    loadingConversations: false,
    _categories: [] as Category[],
  },

  lifetimes: {
    attached() {
      const sysInfo = wx.getWindowInfo()
      const hour = new Date().getHours()
      let greeting = '你好'
      if (hour < 6) greeting = '夜深了 🌙'
      else if (hour < 12) greeting = '早上好 ☀️'
      else if (hour < 18) greeting = '下午好 🌤'
      else greeting = '晚上好 🌙'
      this.setData({ statusBarHeight: sysInfo.statusBarHeight, greeting })

      this.loadPublicData()
      this.waitForLoginAndLoadPrivate()
    },
  },

  pageLifetimes: {
    show() {
      if (typeof this.getTabBar === 'function' && this.getTabBar()) {
        this.getTabBar().setData({ selected: 0 })
      }
      if (this.data.isLoggedIn) {
        this.loadConversations()
      }
    },
  },

  methods: {
    async loadPublicData() {
      try {
        // Fetch categories first for gradient lookup
        let cats: Category[] = []
        try { cats = await getAgentCategories() } catch (e) {}
        const quickCategories = cats.slice(0, PAGE.INDEX_QUICK_CATEGORIES).map((c: Category) => ({
          key: c.categoryKey,
          label: c.name,
          icon: c.icon || FALLBACK_META.icon,
          color: c.color || FALLBACK_META.color,
          bg: c.bg || FALLBACK_META.bg,
          isImage: !!(c.icon && (c.icon.startsWith('http://') || c.icon.startsWith('https://'))),
        }))

        const catMap: Record<string, Category> = {}
        cats.forEach((c: Category) => { catMap[c.categoryKey] = c })
        this.setData({ quickCategories, _categories: cats, _catMap: catMap })

        const hotRes = await getHotAgents()

        const featuredAgent = hotRes.length > 0 ? {
          ...hotRes[0],
          displayIcon: hotRes[0].avatarUrl || hotRes[0].icon || FALLBACK_ICON,
          chipGradient: (catMap[hotRes[0].category] || {}).gradient || DEFAULT_GRADIENT,
          isImage: !!hotRes[0].avatarUrl,
        } : null

        const hotAgents = hotRes.slice(0, PAGE.INDEX_HOT_AGENTS).map(a => ({
          ...a,
          displayIcon: a.avatarUrl || a.icon || FALLBACK_ICON,
          chipGradient: catMap[a.category] ? catMap[a.category].gradient : DEFAULT_GRADIENT,
          isImage: !!a.avatarUrl,
        }))

        const featuredIcon = featuredAgent ? (catMap[featuredAgent.category]?.icon || FALLBACK_ICON) : FALLBACK_ICON
        this.setData({
          featuredAgent,
          featuredIcon,
          featuredIconIsImage: featuredIcon.startsWith('http://') || featuredIcon.startsWith('https://'),
          hotAgents,
          loading: false,
        })
      } catch (e) {
        this.setData({ loading: false })
      }
    },

    async waitForLoginAndLoadPrivate() {
      const app = getApp()
      const loggedIn = await app.waitForLogin()
      if (!loggedIn) return

      this.setData({ isLoggedIn: true })

      // 获取用户资料
      try {
        const profile = await getUserProfile()
        app.globalData.userInfo = profile
        this.setData({ nickname: profile.nickname || '用户', avatarInitial: (profile.nickname || DEFAULT_NICKNAME).charAt(0) })

        // 昵称以"用户"开头说明是新用户，弹出完善信息
        if (!profile.nickname || profile.nickname.startsWith('用户')) {
          this.setData({ showProfileSetup: true })
        }
      } catch (e) {}

      this.loadConversations()
    },

    async loadConversations() {
      this.setData({ loadingConversations: true })
      try {
        const convRes = await getConversations(1, PAGE.INDEX_CONVERSATION_FETCH)
        const recentConversations = (convRes.records || []).slice(0, PAGE.INDEX_RECENT_CONVERSATIONS).map(c => ({
          ...c,
          displayIcon: c.agentAvatarUrl || c.agentIcon || FALLBACK_ICON,
          isImage: !!c.agentAvatarUrl,
          displayTime: formatRelativeTime(c.lastMessageAt),
          convGradient: DEFAULT_GRADIENT,
        }))
        this.setData({ recentConversations, loadingConversations: false })
      } catch (e) {
        this.setData({ loadingConversations: false })
      }
    },

    /** 个人信息设置完成 */
    onProfileSetupDone(e: any) {
      this.setData({ showProfileSetup: false })
      const profile = e && e.detail && e.detail.profile
      if (profile) {
        this.setData({ nickname: profile.nickname, avatarInitial: profile.nickname.charAt(0) })
      }
    },

    onFeaturedTap() {
      const agent = this.data.featuredAgent
      if (!agent) return
      wx.navigateTo({ url: `/pages/chat/detail/detail?agentId=${agent.id}` })
    },

    onCategoryTap(e: any) {
      const category = e.currentTarget.dataset.category
      const app = getApp()
      app.globalData._pendingCategory = category
      wx.switchTab({ url: '/pages/discover/discover' })
    },

    onAgentTap(e: any) {
      const agentId = e.currentTarget.dataset.id
      wx.navigateTo({ url: `/pages/chat/detail/detail?agentId=${agentId}` })
    },

    onConversationTap(e: any) {
      const convId = e.currentTarget.dataset.id
      const agentId = e.currentTarget.dataset.agentId
      wx.navigateTo({ url: `/pages/chat/detail/detail?conversationId=${convId}&agentId=${agentId}` })
    },

    onViewAllAgents() {
      wx.switchTab({ url: '/pages/discover/discover' })
    },
  },
})
