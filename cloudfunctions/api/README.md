# api 云函数

统一承载用户资料、餐食、体重和用户双向绑定操作。所有集合均建议关闭客户端直接读写，仅允许通过本云函数访问。

需要创建的集合：

- `users`
- `meal_records`
- `weight_records`
- `coach_bindings`
- `coach_invites`

建议索引：

- `meal_records`: `ownerId + date`
- `weight_records`: `ownerId + date`（date 降序）
- `coach_bindings`: `userA`、`userB` 分别建立单字段索引
