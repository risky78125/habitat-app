import { getStarPowerTransactions, type StarPowerTransaction } from '../../utils/api'
import { PAGE, MSG as M } from '../../config'

Component({
  data: {
    statusBarHeight: 0,
    transactions: [] as StarPowerTransaction[],
    filteredTransactions: [] as StarPowerTransaction[],
    loading: true,
    loadingMore: false,
    hasMore: true,
    page: 1,
    pageSize: PAGE.TRANSACTIONS,
    filter: 'all' as 'all' | 'income' | 'expense',
  },

  lifetimes: {
    attached() {
      this.setData({ statusBarHeight: wx.getWindowInfo().statusBarHeight })
      this.loadTransactions()
    },
  },

  methods: {
    onBack() {
      wx.navigateBack()
    },

    onFilterChange(e: any) {
      const filter = e.currentTarget.dataset.filter
      this.setData({ filter })
      this.applyFilter()
    },

    applyFilter() {
      const { transactions, filter } = this.data
      let filtered = transactions
      if (filter === 'income') {
        filtered = transactions.filter(t => t.amount > 0)
      } else if (filter === 'expense') {
        filtered = transactions.filter(t => t.amount < 0)
      }
      this.setData({ filteredTransactions: filtered })
    },

    async loadTransactions(append = false) {
      if (this.data.loadingMore) return
      this.setData({ [append ? 'loadingMore' : 'loading']: true })

      try {
        const page = append ? this.data.page + 1 : 1
        const res = await getStarPowerTransactions(page, this.data.pageSize)
        const records = res.records || []
        const all = append ? [...this.data.transactions, ...records] : records
        this.setData({
          transactions: all,
          page,
          hasMore: records.length >= this.data.pageSize,
          loading: false,
          loadingMore: false,
        })
        this.applyFilter()
      } catch (e) {
        this.setData({ loading: false, loadingMore: false })
        wx.showToast({ title: M.LOAD_FAILED, icon: 'none' })
      }
    },

    onReachBottom() {
      if (this.data.hasMore && !this.data.loadingMore) {
        this.loadTransactions(true)
      }
    },
  },
})
