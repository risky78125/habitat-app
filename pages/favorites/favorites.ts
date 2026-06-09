import { type Agent } from '../../utils/api'
import { request } from '../../utils/request'
import { API, PAGE, MSG as M } from '../../config'

Component({
  data: {
    statusBarHeight: 0,
    favorites: [] as Agent[],
    loading: true,
    loadingMore: false,
    hasMore: true,
    page: 1,
    pageSize: PAGE.FAVORITES,
  },

  lifetimes: {
    attached() {
      this.setData({ statusBarHeight: wx.getWindowInfo().statusBarHeight })
      this.loadFavorites()
    },
  },

  methods: {
    onBack() {
      wx.navigateBack()
    },

    async loadFavorites(append = false) {
      if (this.data.loadingMore) return
      this.setData({ [append ? 'loadingMore' : 'loading']: true })

      try {
        const page = append ? this.data.page + 1 : 1
        const res = await request<{ records: Agent[]; total: number }>({
          url: `${API.FAVORITES}?page=${page}&size=${this.data.pageSize}`,
        })
        const records = res.records || []
        this.setData({
          favorites: append ? [...this.data.favorites, ...records] : records,
          page,
          hasMore: records.length >= this.data.pageSize,
          loading: false,
          loadingMore: false,
        })
      } catch (e) {
        this.setData({ loading: false, loadingMore: false })
        wx.showToast({ title: M.LOAD_FAILED, icon: 'none' })
      }
    },

    onReachBottom() {
      if (this.data.hasMore && !this.data.loadingMore) {
        this.loadFavorites(true)
      }
    },

    onAgentTap(e: any) {
      const id = e.currentTarget.dataset.id
      wx.navigateTo({ url: `/pages/chat/detail/detail?agentId=${id}` })
    },

    async onRemoveFavorite(e: any) {
      const agentId = e.currentTarget.dataset.id
      const agentName = e.currentTarget.dataset.name

      wx.showModal({
        title: '取消收藏',
        content: '确定要取消收藏"' + agentName + '"吗？',
        success: async (res) => {
          if (res.confirm) {
            try {
              await request({
                url: API.FAVORITE.replace('{id}', String(agentId)),
                method: 'DELETE',
              })
              this.setData({
                favorites: this.data.favorites.filter(function (a: Agent) { return a.id !== agentId })
              })
              wx.showToast({ title: M.UNFAVORITED, icon: 'success' })
            } catch (e) {
              wx.showToast({ title: M.OPERATION_FAILED, icon: 'none' })
            }
          }
        }
      })
    },
  },
})
