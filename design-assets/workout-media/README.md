# 训练动作媒体上传包

这里保存精选动作的缩略图和 GIF，不会打进微信小程序主包。

1. 将 `images/`、`videos/`、`muscles/` 和 `equipment/` 原样上传到微信云存储的 `workout-media/` 目录。
2. 在 `miniprogram/config/workout-media.ts` 中维护云存储 FileID 前缀。
3. 更换云环境时，只需修改 `cloudRoot`，不需要逐页替换素材地址。

`manifest.json` 是动作媒体清单。上述四个目录的结构不要改，否则已有媒体相对路径会失效。

媒体版权归 Gym visual 所有，项目页面保留署名：

© Gym visual — https://gymvisual.com/
