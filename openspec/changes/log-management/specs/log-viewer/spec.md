## ADDED Requirements

### Requirement: 日志查看器页面
系统 SHALL 在 `/admin/logs` 路由下提供 Web 日志查看器页面。

#### Scenario: 页面可访问
- **WHEN** 已登录用户导航到 `/admin/logs`
- **THEN** 显示日志查看器页面，包含筛选栏和日志列表

#### Scenario: 侧边栏导航入口
- **WHEN** 用户查看侧边栏的「管理」导航组
- **THEN** 显示「系统日志」导航项，点击跳转到 `/admin/logs`

### Requirement: 筛选栏
系统 SHALL 在页面顶部提供筛选控件，支持按服务、模块、级别筛选日志。

#### Scenario: 服务筛选
- **WHEN** 用户在「服务」下拉中选择 `voc-service`
- **THEN** 日志列表仅显示来自 voc-service 的日志

#### Scenario: 模块筛选
- **WHEN** 用户在「模块」下拉中选择 `pipeline`
- **THEN** 日志列表仅显示 pipeline 模块的日志

#### Scenario: 级别筛选
- **WHEN** 用户在「级别」下拉中选择 `error`
- **THEN** 日志列表仅显示 error 级别的日志

#### Scenario: 筛选选项动态加载
- **WHEN** 筛选栏初始化
- **THEN** 从 `/api/platform/logs/filters` 加载可用的服务、模块、级别选项

### Requirement: 日志列表
系统 SHALL 以表格形式展示日志条目，每行显示关键字段。

#### Scenario: 列定义
- **WHEN** 日志列表渲染
- **THEN** 显示以下列：时间（timestamp）、级别（level）、服务（service）、模块（module）、消息（event）

#### Scenario: 级别颜色编码
- **WHEN** 日志条目的级别为 `error`
- **THEN** 级别标签显示为红色
- **WHEN** 日志条目的级别为 `warning`
- **THEN** 级别标签显示为琥珀色
- **WHEN** 日志条目的级别为 `info`
- **THEN** 级别标签显示为默认颜色
- **WHEN** 日志条目的级别为 `debug`
- **THEN** 级别标签显示为灰色

#### Scenario: 消息截断与展开
- **WHEN** 日志消息超过 200 字符
- **THEN** 默认截断显示，点击可展开查看完整消息

### Requirement: 自动刷新
系统 SHALL 支持自动轮询刷新日志列表。

#### Scenario: 默认自动刷新
- **WHEN** 页面加载完成
- **THEN** 每 5 秒自动查询最新日志并更新列表

#### Scenario: 暂停自动刷新
- **WHEN** 用户点击「暂停」按钮
- **THEN** 停止自动刷新，按钮变为「恢复」

#### Scenario: 恢复自动刷新
- **WHEN** 用户点击「恢复」按钮
- **THEN** 恢复 5 秒轮询刷新

### Requirement: 分页
系统 SHALL 支持日志列表分页浏览。

#### Scenario: 分页控件
- **WHEN** 查询结果超过单页显示量（默认 50 条）
- **THEN** 页面底部显示分页控件（上一页/下一页/页码）

#### Scenario: 切换页码
- **WHEN** 用户点击下一页
- **THEN** 加载对应页的日志数据
