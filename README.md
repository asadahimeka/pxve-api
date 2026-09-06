# Pxve API

[![Deno](https://img.shields.io/badge/Deno-2-blue.svg)](https://deno.land/)
[![Hono](https://img.shields.io/badge/Hono-E36002.svg?style=flat&logo=Hono&logoColor=white)](https://hono.dev/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/asadahimeka/pxve-api)
[![zread](https://img.shields.io/badge/Ask_Zread-_.svg?style=flat&color=00b0aa&labelColor=000000&logo=data%3Aimage%2Fsvg%2Bxml%3Bbase64%2CPHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTQuOTYxNTYgMS42MDAxSDIuMjQxNTZDMS44ODgxIDEuNjAwMSAxLjYwMTU2IDEuODg2NjQgMS42MDE1NiAyLjI0MDFWNC45NjAxQzEuNjAxNTYgNS4zMTM1NiAxLjg4ODEgNS42MDAxIDIuMjQxNTYgNS42MDAxSDQuOTYxNTZDNS4zMTUwMiA1LjYwMDEgNS42MDE1NiA1LjMxMzU2IDUuNjAxNTYgNC45NjAxVjIuMjQwMUM1LjYwMTU2IDEuODg2NjQgNS4zMTUwMiAxLjYwMDEgNC45NjE1NiAxLjYwMDFaIiBmaWxsPSIjZmZmIi8%2BCjxwYXRoIGQ9Ik00Ljk2MTU2IDEwLjM5OTlIMi4yNDE1NkMxLjg4ODEgMTAuMzk5OSAxLjYwMTU2IDEwLjY4NjQgMS42MDE1NiAxMS4wMzk5VjEzLjc1OTlDMS42MDE1NiAxNC4xMTM0IDEuODg4MSAxNC4zOTk5IDIuMjQxNTYgMTQuMzk5OUg0Ljk2MTU2QzUuMzE1MDIgMTQuMzk5OSA1LjYwMTU2IDE0LjExMzQgNS42MDE1NiAxMy43NTk5VjExLjAzOTlDNS42MDE1NiAxMC42ODY0IDUuMzE1MDIgMTAuMzk5OSA0Ljk2MTU2IDEwLjM5OTlaIiBmaWxsPSIjZmZmIi8%2BCjxwYXRoIGQ9Ik0xMy43NTg0IDEuNjAwMUgxMS4wMzg0QzEwLjY4NSAxLjYwMDEgMTAuMzk4NCAxLjg4NjY0IDEwLjM5ODQgMi4yNDAxVjQuOTYwMUMxMC4zOTg0IDUuMzEzNTYgMTAuNjg1IDUuNjAwMSAxMS4wMzg0IDUuNjAwMUgxMy43NTg0QzE0LjExMTkgNS42MDAxIDE0LjM5ODQgNS4zMTM1NiAxNC4zOTg0IDQuOTYwMVYyLjI0MDFDMTQuMzk4NCAxLjg4NjY0IDE0LjExMTkgMS42MDAxIDEzLjc1ODQgMS42MDAxWiIgZmlsbD0iI2ZmZiIvPgo8cGF0aCBkPSJNNCAxMkwxMiA0TDQgMTJaIiBmaWxsPSIjZmZmIi8%2BCjxwYXRoIGQ9Ik00IDEyTDEyIDQiIHN0cm9rZT0iI2ZmZiIgc3Ryb2tlLXdpZHRoPSIxLjUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgo8L3N2Zz4K&logoColor=ffffff)](https://zread.ai/asadahimeka/pxve-api)

中文 | [English](./README.en.md)

一个实现了 Pixiv 相关站点的易用化 API 的程序，供 [Pixiv Viewer](https://github.com/asadahimeka/pixiv-viewer) 使用。

Demo: [api.pxve.cc](https://api.pxve.cc)

API 文档：[api.pxve.cc/docs](https://api.pxve.cc/docs)

## ✨ 特性

- 🎨 **Pixiv API** - 支持 Pixiv App API 和 Web API
- 🔌 **HibiAPI 兼容** - Pixiv 部分与 [HibiAPI](https://github.com/mixmoe/HibiAPI) 格式兼容
- 🎬 **动图处理** - Ugoira 动图转换
- 📚 **小说翻译** - Pixiv 小说翻译支持
- 🖼️ **图片处理** - WebP 转换、图片代理
- 🔍 **以图搜图** - 集成 SauceNAO API
- 🔐 **安全防护** - 请求限流、域名白名单、UA 黑名单
- 📖 **API 文档** - 集成 Swagger UI 和 Scalar 文档
- 🐳 **Docker 支持** - 提供 Docker 部署方案

## 🚀 快速开始

### 环境要求

Deno 2.x / zip / unzip / ffmpeg

### 安装运行

1. **克隆项目**

```bash
git clone https://github.com/asadahimeka/pxve-api.git
cd pxve-api
```

2. **配置环境变量**

```bash
cp .env.example .env
# 编辑 .env 文件，填入必要的配置
```

3. **开发模式运行**

```bash
deno task dev
```

4. **生产模式运行**

```bash
deno task start
```

### Docker 部署

```bash
# 构建镜像
docker build -t pxve-api .

# 运行容器
docker run -d -p 3021:3021 --env-file .env pxve-api

# 如果需要 X 媒体获取功能则需要注入 cookies.json 并且此文件需要 644 权限
docker run -d \
  -v /path/to/cookies.json:/app/src/services/x-media/cookies.json:ro \
  -p 3021:3021 \
  --env-file .env \
  pxve-api
```

## 📝 配置说明

### 基础配置

| 环境变量       | 说明                        | 默认值 |
| -------------- | --------------------------- | ------ |
| `PORT`         | 服务监听端口                | `3021` |
| `ENABLE_CACHE` | 是否启用 GET 请求缓存 (1/0) | `0`    |

### 安全配置

| 环境变量         | 说明                           |
| ---------------- | ------------------------------ |
| `ACCEPT_DOMAINS` | 请求来源域名白名单（逗号分隔） |
| `UA_BLACKLIST`   | User-Agent 黑名单（逗号分隔）  |

### Pixiv 配置

> 获取 RefreshToken 参考教程：https://www.nanoka.top/posts/e78ef86/

| 环境变量                   | 说明                            | 必需 |
| -------------------------- | ------------------------------- | ---- |
| `PIXIV_COOKIE`             | Pixiv Web API Cookie            | 推荐 |
| `PIXIV_ACCOUNT_TOKEN`      | Pixiv App API Refresh Token     | 推荐 |
| `PIXIV_ACCOUNT_TOKEN_ALTS` | 备用 Refresh Tokens（逗号分隔） | 可选 |

### 第三方服务配置

| 环境变量               | 说明                  | 用途     |
| ---------------------- | --------------------- | -------- |
| `HIBIAPI_BASE`         | 备用 HibiAPI 服务域名 | API 转发 |
| `SAUCENAO_API_KEY`     | SauceNAO API Key      | 以图搜图 |
| `SILICONClOUD_APT_KEY` | 硅基流动 API Key      | 小说翻译 |

### 代理安全配置

| 环境变量               | 说明                                                       | 默认值          |
| ---------------------- | ---------------------------------------------------------- | --------------- |
| `PROXY_ALLOW_DOMAINS`  | 允许的代理域名白名单（逗号分隔，支持 `*.domain` 通配子域） | 无              |
| `PROXY_BLOCK_DOMAINS`  | 禁止的代理域名黑名单（逗号分隔，支持 `*.domain` 通配）     | 无              |
| `PROXY_BLOCK_PRIVATE`  | 禁止访问私网地址（1/0）                                    | `1`             |
| `MAX_DOWNLOAD_BYTES`   | 下载文件大小上限（字节）                                   | 52428800 (50MB) |
| `UGOIRA_MAX_ZIP_BYTES` | Ugoira ZIP 文件大小上限（字节）                            | 52428800 (50MB) |
| `API_TOKEN`            | API 访问令牌，设置后调用需传 `Authorization: Bearer <Token>` 头  | 无        |

### CORS 说明

- CORS 域名匹配（`ACCEPT_DOMAINS`）使用**精确匹配**，若需允许子域（如 `*.pxve.cc`），请配置为 `*.pxve.cc`
- 非浏览器客户端（如 curl）不发送 `Origin`/`Referer` 头，可能收到 403 响应——这是预期行为

## 📚 API 文档

启动服务后，可以通过以下地址访问 API 文档：

- **Scalar 文档（推荐）**: http://localhost:3021/docs
- **Swagger UI**: http://localhost:3021/swagger
- **HibiAPI 兼容文档**: http://localhost:3021/docs/hibiapi

## 🔗 API 端点

### Pixiv 相关

- `GET /api/pixiv/*` - Pixiv APP API（兼容 HibiAPI）
- `GET /api/pixivision` - Pixivision API
- `GET /api/pixiv-now/http` - Pixiv Web API
- `GET /api/pixiv-novel-translate` - 小说翻译
- `GET /pid` - 通过 PID 查找 pixiv 图片
- `GET /api/pid-recover` - 通过 PID 查找 pixiv 图片镜像

### 媒体处理

- `GET /api/ugoira` - Ugoira 动图处理
- `GET /api/webp` - WebP 转换
- `GET /pximg` - pximg 图片代理

### 第三方集成

- `GET /api/sauce/` - 以图搜图
- `GET /api/ai-image-detect` - AI 图像检测
- `GET /api/x/media` - 获取 X 用户媒体推文

### 其他接口

- `GET /proxy/*` - CORS 代理
- HibiAPI 兼容接口

## 🛠️ 开发命令

```bash
# 开发模式（热重载）
deno task dev

# 生产模式
deno task start

# 类型检查
deno task type-check

# 代码检查
deno task lint

# 缓存管理
deno task manage-cache
```

## 📁 项目结构

```
pxve-api/
├── src/
│   ├── app.ts             # 应用入口
│   ├── middlewares/       # 中间件
│   ├── routes/            # 路由定义
│   ├── services/          # 业务逻辑
│   └── lib/               # 工具库
├── scripts/               # 脚本工具
├── public/                # 静态资源
├── .env.example           # 环境变量模板
├── deno.json              # Deno 配置
├── Dockerfile             # Docker 配置
└── README.md              # 项目说明
```

## 🔧 技术栈

- **运行时**: Deno
- **框架**: Hono
- **API 文档**: Swagger UI + Scalar
- **图片处理**: Sharp
- **HTML 解析**: Cheerio
- **数据验证**: Zod
- **类型安全**: TypeScript

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 🔗 相关项目

- [Pixiv Viewer](https://github.com/asadahimeka/pixiv-viewer) - 前端应用
- [HibiAPI](https://github.com/mixmoe/HibiAPI) - 参考的 API 实现

## ⚠️ 注意事项

1. 请遵守 Pixiv 的使用条款和相关法律法规
2. 合理使用 API，避免过于频繁的请求
3. 部分功能需要相应的 API Key 或 Token
4. 建议在生产环境中启用缓存(Nginx/Cloudflare)以提高性能

## 📄 许可证

MIT License

![pxve-api](https://count.nanoka.top/@pxveapigh)
