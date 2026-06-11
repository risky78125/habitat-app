import { getAgents, getAgentCategories, type Agent, type Category } from '../../utils/api'
import type { DisplayAgent } from '../../utils/types'
import { DEFAULT_GRADIENT } from '../../constants/categories'
import { PAGE, FALLBACK_ICON } from '../../config'

Component({
  data: {
    searchQuery: '',
    selectedCategory: 'all',
    categories: [] as { key: string; label: string }[],
    categoryPages: [] as { key: string; label: string }[][],
    agents: [] as DisplayAgent[],
    loading: true,
    hasMore: true,
    total: 0,
    page: 1,
  },

  _catMap: {} as Record<string, Category>, // 仅用于查找，不需要触发视图更新

  lifetimes: {
    attached() {
      this.init()
    },
  },

  pageLifetimes: {
    show() {
      const tabBar = this.getTabBar()
      if (tabBar) tabBar.setData({ selected: 1 })
      const app = getApp()
      if (app.globalData._pendingCategory) {
        this.setData({ selectedCategory: app.globalData._pendingCategory })
        app.globalData._pendingCategory = null
        this.init()
      }
    },
  },

  methods: {
    async init() {
      await this.loadCategories()
      await this.loadAgents()
    },

    async loadCategories() {
      try {
        const cats = await getAgentCategories()
        const map: Record<string, Category> = {}
        cats.forEach(function (c: Category) { map[c.categoryKey] = c })
        this._catMap = map
        const all = [
          { key: 'all', label: '全部' },
          ...cats.map(c => ({ key: c.categoryKey, label: c.name })),
        ]
        const PER_PAGE = 4
        const categoryPages: { key: string; label: string }[][] = []
        for (let i = 0; i < all.length; i += PER_PAGE) {
          categoryPages.push(all.slice(i, i + PER_PAGE))
        }
        this.setData({ categories: all, categoryPages })
      } catch (e) {}
    },

    _enrichAgent(a: Agent): DisplayAgent {
      const cat = this._catMap[a.category]
      return {
        ...a,
        displayIcon: (cat && cat.icon) || FALLBACK_ICON,
        displayCategory: (cat && cat.name) || a.category,
        cardGradient: (cat && cat.gradient) || DEFAULT_GRADIENT,
      }
    },

    async loadAgents(append = false) {
      const { selectedCategory, searchQuery, page } = this.data
      this.setData({ loading: !append })

      try {
        const res = await getAgents({
          category: selectedCategory === 'all' ? undefined : selectedCategory,
          keyword: searchQuery || undefined,
          page: append ? page : 1,
          size: PAGE.AGENTS,
        })
        const items = (res.records || []).map(a => this._enrichAgent(a))
        this.setData({
          agents: append ? [...this.data.agents, ...items] : items,
          total: res.total || 0,
          page: append ? page : 1,
          hasMore: (append ? this.data.agents.length + items.length : items.length) < (res.total || 0),
          loading: false,
        })
      } catch (e) {
        this.setData({ loading: false })
      }
    },

    onSearchInput(e: any) {
      this.setData({ searchQuery: e.detail.value })
    },

    onSearchConfirm() {
      this.setData({ page: 1, loading: true })
      this.loadAgents()
    },

    onSearchClear() {
      this.setData({ searchQuery: '', page: 1, loading: true })
      this.loadAgents()
    },

    onCategoryTap(e: any) {
      const key = e.currentTarget.dataset.category
      if (key === this.data.selectedCategory) return
      this.setData({ selectedCategory: key, page: 1, loading: true })
      this.loadAgents()
    },

    onAgentTap(e: any) {
      wx.navigateTo({ url: `/pages/chat/detail/detail?agentId=${e.currentTarget.dataset.id}` })
    },

    onScrollToLower() {
      if (this.data.hasMore && !this.data.loading) {
        this.setData({ page: this.data.page + 1 })
        this.loadAgents(true)
      }
    },
  },
})
