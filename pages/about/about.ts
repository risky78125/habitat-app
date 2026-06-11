import { APP_VERSION, MSG as M } from '../../config'

Component({
  data: {
    statusBarHeight: 0,
    version: APP_VERSION,
    features: [
      { icon: '/assets/icons/user-group.svg', title: '多样的 AI Agent', desc: '提供多种专业领域的 AI 助手' },
      { icon: '/assets/icons/message.svg', title: '深度对话', desc: '支持多轮对话，理解上下文' },
      { icon: '/assets/icons/usd.svg', title: '星力结算', desc: '灵活的星力系统，签到获取' },
    ],
    links: [
      { key: 'feedback', title: '意见反馈', desc: '帮助我们做得更好' },
      { key: 'privacy', title: '隐私政策', desc: '了解我们如何保护您的数据' },
      { key: 'terms', title: '用户协议', desc: '使用条款与条件' },
    ],
  },

  lifetimes: {
    attached() {
      this.setData({ statusBarHeight: wx.getWindowInfo().statusBarHeight })
    },
  },

  methods: {
    onBack() {
      wx.navigateBack({ delta: 1 })
    },

    onLinkTap(e: any) {
      const key = e.currentTarget.dataset.key
      const routes: Record<string, string> = {
        feedback: '/pages/feedback/feedback',
        privacy: '/pages/privacy/privacy',
        terms: '/pages/terms/terms',
      }
      const url = routes[key]
      if (url) {
        wx.navigateTo({ url })
      } else {
        wx.showToast({ title: M.FEATURE_WIP, icon: 'none' })
      }
    },
  },
})
