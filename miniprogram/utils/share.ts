/** 分享产品入口，避免默认截图包含当前页面的个人健康数据。 */
export const productShareHandlers = {
  onShareAppMessage(): WechatMiniprogram.Page.ICustomShareContent {
    return {
      title: '食克有数｜食材配餐、训练计划，让每一天更有数',
      path: '/pages/login/index',
      imageUrl: '/assets/share-logo.png',
    }
  },
}
