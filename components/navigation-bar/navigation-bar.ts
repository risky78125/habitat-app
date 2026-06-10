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
    background: {
      type: String,
      value: '#fff',
    },
    color: {
      type: String,
      value: 'rgba(0, 0, 0, .9)',
    },
  },

  data: {
    statusBarHeight: 0,
    navBarHeight: 44,
    innerPaddingRight: '',
    leftWidth: '',
    displayStyle: '',
  },

  lifetimes: {
    attached() {
      const sysInfo = wx.getSystemInfoSync()
      const rect = wx.getMenuButtonBoundingClientRect()
      this.setData({
        statusBarHeight: sysInfo.statusBarHeight,
        navBarHeight: rect.bottom + rect.top - sysInfo.statusBarHeight,
        innerPaddingRight: `padding-right: ${sysInfo.windowWidth - rect.left}px`,
        leftWidth: `width: ${sysInfo.windowWidth - rect.left}px`,
      })
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
