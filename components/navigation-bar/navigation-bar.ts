Component({
  options: {
    multipleSlots: true,
    
  },

  properties: {
    title: {
      type: String,
      value: '',
    },
    back: {
      type: Boolean,
      value: true,
    },
  },

  data: {
    statusBarHeight: 0,
  },

  lifetimes: {
    attached() {
      const sysInfo = wx.getWindowInfo()
      this.setData({ statusBarHeight: sysInfo.statusBarHeight })
    },
  },

  methods: {
    onBack() {
      const pages = getCurrentPages()
      if (pages.length > 1) {
        wx.navigateBack({ delta: 1 })
      } else {
        wx.switchTab({ url: '/pages/index/index' })
      }
      this.triggerEvent('back')
    },
  },
})
