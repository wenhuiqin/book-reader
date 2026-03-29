# Book Reader

[English](#english) | [中文](#中文)

A local-first desktop reader for `EPUB` and `PDF`, built with Electron and React.

一个本地优先的极简桌面阅读器，支持 `EPUB` 与 `PDF`。

[Download for macOS](https://github.com/wenhuiqin/book-reader/releases/download/v1.0.0/Book%20Reader-1.0.0-arm64.dmg) · [GitHub Releases](https://github.com/wenhuiqin/book-reader/releases) · [Report an Issue](https://github.com/wenhuiqin/book-reader/issues)

![Bookshelf Preview](./docs/assets/bookshelf-preview.svg)

## English

### Why Book Reader

Most desktop readers are either too heavy, too file-manager-like, or too generic.

Book Reader is built around a simpler idea:

- a calm bookshelf for local books
- an independent floating reader window
- local reading progress that stays with you
- support for both `EPUB` and `PDF`

If you want a focused reading app instead of a document management tool, this project is for you.

### Highlights

- Import local `EPUB` and `PDF` files
- Open books in an independent reader window
- Restore reading position and reader preferences locally
- Parse EPUB metadata, cover, table of contents, and chapters
- Read PDF files with basic page navigation
- Use fine-grained auto-scroll speed control down to `0.1`

### Preview

| Bookshelf | Reader |
| --- | --- |
| ![Bookshelf UI](./docs/assets/bookshelf-preview.svg) | ![Reader UI](./docs/assets/reader-preview.svg) |

### Download

- macOS Apple Silicon: [Book Reader-1.0.0-arm64.dmg](https://github.com/wenhuiqin/book-reader/releases/download/v1.0.0/Book%20Reader-1.0.0-arm64.dmg)
- All releases: [GitHub Releases](https://github.com/wenhuiqin/book-reader/releases)

If the direct download link does not work yet, publish the `v1.0.0` GitHub Release and upload the DMG from `dist/`.

### Supported Formats

- `EPUB`: EPUB 2 / EPUB 3, metadata, table of contents, cover image, chapter rendering
- `PDF`: page reading, page switching, theme switching, progress restore

Not supported:

- `MOBI`
- `AZW / AZW3`
- DRM-protected ebook files

### Getting Started

Install dependencies:

```bash
pnpm install
```

Run the Electron development environment:

```bash
npm run electron:start
```

`npm start` only launches the React development server and does not expose Electron APIs.

### Build

Build the frontend bundle:

```bash
npm run build
```

Package the desktop app for macOS:

```bash
npm run dist:mac
```

Pack without generating an installer:

```bash
npm run electron:pack
```

### Roadmap

- Real screenshots captured from packaged builds
- App icon and release branding
- Better PDF controls such as jump-to-page and zoom
- Improved bookshelf organization and recent-reading entry points

### Contributing

Issues and pull requests are welcome.

If you find a bug, include your app version, macOS version, and a short reproduction path.

### Release Notes

Draft release notes for the first public version are available in `docs/release-v1.0.0.md`.

### License

MIT

## 中文

### 为什么做这个项目

很多桌面阅读器要么太重，要么更像文件管理器，要么缺少清晰的阅读体验重点。

Book Reader 想做得更简单一些：

- 一个安静的本地书架
- 一个独立的悬浮阅读窗口
- 稳定的本地阅读进度保存
- 同时支持 `EPUB` 和 `PDF`

如果你想要的是一个更专注的阅读工具，而不是一整套复杂的文档管理系统，这个项目就是为此设计的。

### 核心特性

- 导入本地 `EPUB` 和 `PDF` 文件
- 在独立阅读窗口中打开书籍
- 本地保存阅读位置与阅读偏好
- 支持 EPUB 的元数据、封面、目录与章节解析
- 支持 PDF 的基础分页阅读与进度恢复
- 自动滚动速度支持更细颗粒控制，最低可到 `0.1`

### 效果展示

| 书架界面 | 阅读器界面 |
| --- | --- |
| ![书架预览](./docs/assets/bookshelf-preview.svg) | ![阅读器预览](./docs/assets/reader-preview.svg) |

### 下载

- macOS Apple Silicon: [Book Reader-1.0.0-arm64.dmg](https://github.com/wenhuiqin/book-reader/releases/download/v1.0.0/Book%20Reader-1.0.0-arm64.dmg)
- 所有版本: [GitHub Releases](https://github.com/wenhuiqin/book-reader/releases)

如果上面的直链暂时无法访问，说明 `v1.0.0` 的 GitHub Release 还没有正式发布。发布后上传 `dist/` 下的 DMG 即可生效。

### 支持格式

- `EPUB`：支持 EPUB 2 / EPUB 3、元数据、目录、封面和章节渲染
- `PDF`：支持基础分页阅读、翻页、主题切换和进度恢复

暂不支持：

- `MOBI`
- `AZW / AZW3`
- 受 DRM 保护的电子书文件

### 本地开发

安装依赖：

```bash
pnpm install
```

启动 Electron 开发环境：

```bash
npm run electron:start
```

`npm start` 只会启动 React 开发服务器，无法访问 Electron 的本地文件与窗口能力。

### 构建命令

构建前端资源：

```bash
npm run build
```

打包 macOS 应用：

```bash
npm run dist:mac
```

仅输出未封装安装器的应用目录：

```bash
npm run electron:pack
```

### 后续计划

- 补真实应用截图与发布页素材
- 补应用图标与品牌元素
- 增强 PDF 控件，例如跳页与缩放
- 改善书架组织方式与最近阅读入口

### 参与贡献

欢迎提交 issue 和 PR。

如果反馈 bug，建议一并提供应用版本、macOS 版本和复现步骤。

### Release 文案

首个公开版本的 GitHub Release 文案草稿见 `docs/release-v1.0.0.md`。

### 许可证

MIT
