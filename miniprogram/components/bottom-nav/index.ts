Component({
  properties: {
    current: { type: String, value: '' },
  },

  data: {
    items: [
      { key: 'home', label: '首页', icon: '⌂', url: '/pages/home/index' },
      { key: 'report', label: '报告', icon: '▥', url: '/pages/report/index' },
      { key: 'partners', label: '伙伴', icon: '⇄', url: '/pages/coach/index' },
      { key: 'profile', label: '我的', icon: '◎', url: '/pages/profile/index' },
    ],
  },

  methods: {
    navigate(event: WechatMiniprogram.TouchEvent) {
      const { key, url } = event.currentTarget.dataset as { key: string; url: string }
      if (!url || key === this.data.current) return
      wx.reLaunch({ url })
    },
  },
})
