# X 媒体推文抓取服务

这个服务用于抓取 X（Twitter）用户的媒体推文，通过调用 Python 脚本使用 `twikit` 库来获取数据。

## 📋 功能概述

- 通过用户名或用户 ID 获取 X 用户的媒体推文
- 支持分页获取（使用 cursor）
- 返回推文的详细信息，包括媒体文件（图片、视频）
- 使用 Deno + Python 混合架构

## 🛠️ 环境要求

### Python 环境
- **Python 版本**: 3.8+
- **必需依赖**: `twikit`

### Deno 环境
- **Deno 版本**: 2.x（与主项目保持一致）

## 📦 安装配置

### 1. 安装 Python 依赖

```bash
# 安装 twikit 库
pip install twikit

# 或者使用 pip3
pip3 install twikit

# 如果使用虚拟环境（推荐）
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install twikit
```

### 2. 配置 X Cookie

为了访问 X API，需要提供有效的 Cookie：

1. **获取 Cookie**：
   - 在浏览器中登录 X.com
   - 打开开发者工具（F12）
   - 进入 Application/Storage → Cookies → https://x.com
   - 复制所有相关 Cookie

2. **创建 cookies.json 文件**：
   ```bash
   # 复制示例文件
   cp cookies.example.json cookies.json
   ```

3. **编辑 cookies.json**：
   将 cookies.json 中的每一项填充为你的实际值

> ⚠️ **重要**: Cookie 包含敏感信息，请勿提交到版本控制系统

## 🚀 使用方法

### TypeScript 调用

```typescript
import { runFetchXMediaCmd } from './index.ts'

// 通过用户名获取
const result = await runFetchXMediaCmd('elonmusk')

// 通过用户ID获取
const result = await runFetchXMediaCmd(null, '44196397')

// 分页获取
const result = await runFetchXMediaCmd('elonmusk', null, 'cursor_string')
```

### 直接使用 Python 脚本

```bash
# 通过用户名获取
python fetch_x_media.py --user elonmusk --limit 20

# 通过用户ID获取
python fetch_x_media.py --userid 44196397 --limit 40

# 使用分页
python fetch_x_media.py --user elonmusk --cursor "cursor_string"
```

### 命令行参数说明

| 参数 | 说明 | 必需 | 默认值 |
|------|------|------|--------|
| `--user` | X 用户名（如 elonmusk） | 与 `--userid` 二选一 | - |
| `--userid` | X 用户 ID（数字） | 与 `--user` 二选一 | - |
| `--limit` | 获取推文数量限制 | 否 | 40 |
| `--cursor` | 分页游标 | 否 | - |

## 📊 返回数据格式

```json
{
  "results": [
    {
      "id": "推文ID",
      "text": "推文内容",
      "full_text": "完整推文内容",
      "created_at": "创建时间",
      "favorite_count": "点赞数",
      "view_count": "浏览数",
      "media": [
        {
          "id": "媒体ID",
          "media_url": "媒体URL",
          "type": "媒体类型(photo/video)",
          "width": "宽度",
          "height": "高度",
          "stream_url": "视频流URL（如适用）"
        }
      ]
    }
  ],
  "next_cursor": "下一页游标",
  "user_id": "用户ID"
}
```

## 🔧 故障排除

### 常见问题

1. **Cookie 过期**
   ```
   错误: Run fetch_x_media cmd failed
   解决: 重新获取最新的 Cookie 并更新 cookies.json
   ```

2. **twikit 未安装**
   ```
   ModuleNotFoundError: No module named 'twikit'
   解决: pip install twikit
   ```

3. **用户不存在**
   ```
   解决: 检查用户名或用户ID是否正确
   ```

4. **权限问题**
   ```
   解决: 确保 cookies.json 文件权限正确，包含有效的认证信息
   ```

### 调试技巧

1. **查看详细错误信息**：
   ```bash
   python fetch_x_media.py --user 用户名 2>&1
   ```

2. **验证 Cookie 有效性**：
   - 在浏览器中访问 X.com 确保登录状态
   - 检查 Cookie 是否包含所有必要的认证信息

3. **测试 twikit 功能**：
   ```python
   from twikit import Client
   client = Client('en-US')
   # 测试加载 Cookie 是否成功
   ```

## 📝 注意事项

1. **API 限制**: X API 有调用频率限制，请合理控制请求频率
2. **Cookie 有效期**: Cookie 可能会过期，需要定期更新
3. **数据准确性**: 媒体 URL 可能有时效性，建议及时保存
4. **隐私合规**: 使用时请遵守 X 的使用条款和相关法律法规

## 🔄 维护建议

1. **定期更新 Cookie**: 建议每周检查并更新 Cookie
2. **错误处理**: 在生产环境中添加适当的错误处理和重试机制
3. **缓存策略**: 考虑添加缓存以减少 API 调用
4. **监控日志**: 添加日志记录以便监控服务状态

## 📚 相关资源

- [twikit 官方文档](https://github.com/d60/twikit)
- [X API 文档](https://developer.twitter.com/en/docs/twitter-api)
- [Deno 官方文档](https://deno.land/)

## 🤝 贡献

如发现问题或有改进建议，请提交 Issue 或 Pull Request。
