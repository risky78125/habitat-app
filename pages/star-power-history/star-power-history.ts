import { getStarPowerTransactions, type StarPowerTransaction } from '../../utils/api'
import { formatRelativeTime } from '../../utils/util'
import { PAGE, MSG as M } from '../../config'

interface DisplayTransaction extends StarPowerTransaction {
  displayTime: string
}

Component({
  data: {
    transactions: [] as StarPowerTransaction[],
    filteredTransactions: [] as DisplayTransaction[],
    loading: true,
    loadingMore: false,
    hasMore: true,
    page: 1,
    pageSize: PAGE.TRANSACTIONS,
    filter: 'all' as 'all' | 'income' | 'expense',
  },

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
      const { transactions, filter } = this.data
      let filtered = transactions
      if (filter === 'income') {
        filtered = transactions.filter(t => t.amount > 0)
      } else if (filter === 'expense') {
        filtered = transactions.filter(t => t.amount < 0)
      }
      const display = filtered.map(t => ({
        ...t,
        displayTime: formatRelativeTime(t.createdAt),
      }))
      this.setData({ filteredTransactions: display })
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
