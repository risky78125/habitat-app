Component({
  data: {
    statusBarHeight: 0,
    updateDate: '2026年6月8日',
  },

  lifetimes: {
    attached() {
      const sysInfo = wx.getWindowInfo()
      this.setData({ statusBarHeight: sysInfo.statusBarHeight })
    },
  },

  methods: {
    onBack() {
      wx.navigateBack({ delta: 1 })
    },
  },
})
