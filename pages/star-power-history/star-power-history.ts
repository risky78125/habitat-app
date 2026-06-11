import { getStarPowerTransactions, type StarPowerTransaction } from '../../utils/api'
import { formatRelativeTime } from '../../utils/util'
import { PAGE, MSG as M } from '../../config'

interface DisplayTransaction extends StarPowerTransaction {
  displayTime: string
}

Component({
  data: {
    filteredTransactions: [] as DisplayTransaction[],
    loading: true,
    loadingMore: false,
    hasMore: true,
    page: 1,
    pageSize: PAGE.TRANSACTIONS,
    filter: 'all' as 'all' | 'income' | 'expense',
  },

  _allTransactions: [] as DisplayTransaction[],

  lifetimes: {
    attached() {
      this.loadTransactions()
    },
  },

  methods: {
    onFilterChange(e: any) {
      const filter = e.currentTarget.dataset.filter
      this.setData({ filter })
      this.applyFilter()
    },

    applyFilter() {
      const { filter } = this.data
      let filtered = this._allTransactions
      if (filter === 'income') {
        filtered = this._allTransactions.filter(t => t.amount > 0)
      } else if (filter === 'expense') {
        filtered = this._allTransactions.filter(t => t.amount < 0)
      }
      this.setData({ filteredTransactions: filtered })
    },

    async loadTransactions(append = false) {
      if (this.data.loadingMore) return
      this.setData({ [append ? 'loadingMore' : 'loading']: true })

      try {
        const page = append ? this.data.page + 1 : 1
        const res = await getStarPowerTransactions(page, this.data.pageSize)
        const records = (res.records || []).map(t => ({
          ...t,
          displayTime: formatRelativeTime(t.createdAt),
        }))
        this._allTransactions = append ? [...this._allTransactions, ...records] : records
        this.setData({
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
