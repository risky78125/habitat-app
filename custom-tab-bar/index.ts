Component({
  data: {
    selected: 0,
    tabs: [
      { index: 0, text: '首页', icon: '/assets/icons/home', pagePath: '/pages/index/index' },
      { index: 1, text: '探索', icon: '/assets/icons/discover', pagePath: '/pages/discover/discover' },
      { index: 2, text: '对话', icon: '/assets/icons/comment', pagePath: '/pages/chat/chat' },
      { index: 3, text: '我的', icon: '/assets/icons/my', pagePath: '/pages/profile/profile' },
    ],
  },
  methods: {
    switchTab(e: any) {
      const { index, path } = e.currentTarget.dataset
      if (index === this.data.selected) return
      wx.switchTab({ url: path })
    },
  },
})
