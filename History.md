0.1.3
=====

- 增加 webot.domain ，可以为匹配规则按分组指定预处理方法

0.1.2
=====

- 增加 webot.beforeReply 和 webot.afterReply ，作为消息预处理和回复预处理
- 删除 session 相关的东西，如有需要，可以通过 webot.beforeReply 给 `info.session` 赋值实现
