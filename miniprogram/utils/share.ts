/** 分享产品入口，避免默认截图包含当前页面的个人健康数据。 */
export const productShareHandlers = {
  onReady(): void {
    wx.showShareMenu({
      menus: ['shareAppMessage', 'shareTimeline'],
    })
  },

  onShareAppMessage(): WechatMiniprogram.Page.ICustomShareContent {
    return {
      title: '食克有数｜食材配餐、训练计划，让每一天更有数',
      path: '/pages/home/index',
      imageUrl: '/assets/share-logo.png',
    }
  },

  onShareTimeline(): WechatMiniprogram.Page.ICustomTimelineContent {
    return {
      title: '食克有数｜选食材、算克重、记饮食和训练',
      query: 'from=timeline',
      imageUrl: '/assets/share-logo.png',
    }
  },
}
