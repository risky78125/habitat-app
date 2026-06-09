import { request } from '../../utils/request'
import { API, MSG as M, TIMEOUT, FEEDBACK_CATEGORIES, DEFAULT_FEEDBACK_CATEGORY } from '../../config'

Component({
  data: {
    statusBarHeight: 0,
    categories: FEEDBACK_CATEGORIES,
    selectedCategory: DEFAULT_FEEDBACK_CATEGORY,
    content: '',
    contact: '',
    submitting: false,
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

    onCategoryTap(e: any) {
      this.setData({ selectedCategory: e.currentTarget.dataset.key })
    },

    onContentInput(e: any) {
      this.setData({ content: e.detail.value })
    },

    onContactInput(e: any) {
      this.setData({ contact: e.detail.value })
    },

    async onSubmit() {
      const { selectedCategory, content, contact } = this.data
      if (!content.trim()) {
        wx.showToast({ title: M.FEEDBACK_EMPTY, icon: 'none' })
        return
      }

      this.setData({ submitting: true })
      try {
        await request({
          url: API.FEEDBACK,
          method: 'POST',
          data: {
            category: selectedCategory,
            content: content.trim(),
            contact: contact.trim() || undefined,
          },
        })
        wx.showToast({ title: M.FEEDBACK_SUCCESS, icon: 'success' })
        setTimeout(() => wx.navigateBack(), TIMEOUT.FEEDBACK_REDIRECT)
      } catch (e) {
        wx.showToast({ title: M.FEEDBACK_FAIL, icon: 'none' })
      } finally {
        this.setData({ submitting: false })
      }
    },
  },
})
