import { getUserProfile, getStarPowerBalance, getConversations, checkin, type UserProfile } from '../../utils/api'
import { clearAuth } from '../../utils/request'
import { MSG as M, LOGIN_STATE, DEFAULT_NICKNAME } from '../../config'

Component({
  data: {
    statusBarHeight: 0,
    userInfo: null as UserProfile | null,
    starPowerBalance: 0,
    hasCheckedIn: false,
    loading: true,
    loginFailed: false,
    showProfileSetup: false,
    avatarInitial: '',
    conversationCount: 0,
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
        this.getTabBar().setData({ selected: 3 })
      }
      if (getApp().globalData.loginState === LOGIN_STATE.SUCCESS) {
        this.loadData()
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
      this.loadData()
    },

    async loadData() {
      const app = getApp()
      try {
        const [profile, balance] = await Promise.all([
          getUserProfile(),
          getStarPowerBalance(),
        ])

        const today = new Date().toISOString().slice(0, 10)
        const hasCheckedIn = profile.lastCheckinDate === today
        const avatarInitial = (profile.nickname || DEFAULT_NICKNAME).charAt(0)

        this.setData({
          userInfo: profile,
          starPowerBalance: balance.balance,
          hasCheckedIn,
          avatarInitial,
          loading: false,
        })

        app.globalData.userInfo = profile
      } catch (e) {
        this.setData({ loading: false })
      }

      // Load conversation count
      try {
        const convRes = await getConversations(1, 1)
        this.setData({ conversationCount: convRes.total || 0 })
      } catch (e) {}
    },

    onRetryLogin() {
      this.setData({ loginFailed: false, loading: true })
      const app = getApp()
      app.retryLogin().then((ok: boolean) => {
        if (ok) {
          this.setData({ loginFailed: false })
          this.loadData()
        } else {
          this.setData({ loginFailed: true, loading: false })
        }
      })
    },

    async onCheckin() {
      if (this.data.hasCheckedIn) {
        wx.showToast({ title: M.ALREADY_CHECKED_IN, icon: 'none' })
        return
      }

      try {
        await checkin()
        this.setData({ hasCheckedIn: true })
        this.setData({ 'userInfo.checkinDays': this.data.userInfo.checkinDays + 1 })
        wx.showToast({ title: M.CHECKIN_SUCCESS, icon: 'success' })
        const balance = await getStarPowerBalance()
        this.setData({ starPowerBalance: balance.balance })
      } catch (e) {
        wx.showToast({ title: M.CHECKIN_FAIL, icon: 'none' })
      }
    },

    onEditProfile() {
      this.setData({ showProfileSetup: true })
    },

    onProfileSetupDone(e: any) {
      this.setData({ showProfileSetup: false })
      const profile = e && e.detail && e.detail.profile
      if (profile) {
        const avatarInitial = (profile.nickname || DEFAULT_NICKNAME).charAt(0)
        this.setData({
          userInfo: { ...this.data.userInfo, ...profile },
          avatarInitial,
        })
      }
    },

    onViewStarPowerHistory() {
      wx.navigateTo({ url: '/pages/star-power-history/star-power-history' })
    },

    onSettingTap(e: any) {
      const key = e.currentTarget.dataset.key
      switch (key) {
        case 'favorites':
          wx.navigateTo({ url: '/pages/favorites/favorites' })
          break
        case 'feedback':
          wx.navigateTo({ url: '/pages/feedback/feedback' })
          break
        case 'about':
          wx.navigateTo({ url: '/pages/about/about' })
          break
        case 'logout':
          wx.showModal({
            title: M.LOGOUT_TITLE,
            content: M.LOGOUT_CONTENT,
            success: (res) => {
              if (res.confirm) {
                clearAuth()
                const app = getApp()
                app.globalData.userInfo = null
                app.globalData.isLoggedIn = false
                app.globalData.loginState = 'failed'
                app._loginPromise = null
                wx.reLaunch({ url: '/pages/index/index' })
              }
            },
          })
          break
      }
    },
  },
})
