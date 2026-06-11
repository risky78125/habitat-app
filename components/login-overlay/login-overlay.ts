Component({
  properties: {
    show: {
      type: Boolean,
      value: false,
    },
    desc: {
      type: String,
      value: '登录后即可使用完整功能',
    },
  },

  methods: {
    onRetry() {
      this.triggerEvent('retry')
    },
  },
})
