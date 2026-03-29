# Book Reader

[English](#english) | [中文](#中文)

A minimalist desktop reader built with Electron and React, focused on local-first reading with a clean bookshelf and a lightweight floating reader window.

一个基于 Electron 和 React 构建的极简桌面阅读器，强调本地优先、安静的书架体验，以及轻量的悬浮阅读窗口。

## English

### Overview

Book Reader is a local desktop reading app for EPUB and PDF files. It keeps the interaction model intentionally simple: import books from local files, open them in an independent reader window, and restore your reading progress automatically.

### Features

- Minimal bookshelf interface for local books
- Independent reader window with drag and resize support
- EPUB parsing with metadata, cover, table of contents, and chapter rendering
- PDF reading with page navigation and progress restore
- Local persistence for reading progress and reader preferences

### Supported Formats

- `EPUB`: EPUB 2 / EPUB 3, metadata, table of contents, cover image, chapter rendering
- `PDF`: basic page reading, page switching, theme switching, progress restore

Not supported at the moment:

- `MOBI`
- `AZW / AZW3`
- DRM-protected ebook files

### Tech Stack

- `Electron`
- `React 18`
- `JSZip`
- `pdfjs-dist`

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

### Project Structure

```text
book/
├── electron/
│   ├── main.js
│   └── preload.js
├── public/
│   ├── electron.json
│   └── index.html
├── src/
│   ├── components/
│   │   ├── BookCard.js
│   │   ├── Bookshelf.js
│   │   ├── PDFReader.js
│   │   └── Reader.js
│   ├── utils/
│   │   ├── EPUBParser.js
│   │   └── bookFormat.js
│   ├── App.js
│   ├── index.css
│   └── index.js
├── docs/
├── package.json
└── pnpm-lock.yaml
```

### Roadmap

- Application icon and release branding
- Screenshots for README and release assets
- Better PDF controls such as jump-to-page and zoom
- Improved bookshelf organization and recent-reading entry points

### Release Notes

Draft release notes for the first public version are available in `docs/release-v1.0.0.md`.

### License

MIT

## 中文

### 项目简介

Book Reader 是一个面向本地文件的桌面阅读应用，当前支持 EPUB 与 PDF。它刻意保持简洁的交互模型：从本地导入书籍，在独立阅读窗口中打开，并自动恢复阅读进度。

### 功能特性

- 极简书架视图，用于管理本地书籍
- 独立阅读窗口，支持拖拽和调整尺寸
- EPUB 解析能力，支持元数据、封面、目录与章节渲染
- PDF 分页阅读，支持页码切换与阅读进度恢复
- 本地持久化保存阅读进度与阅读器偏好

### 支持格式

- `EPUB`：支持 EPUB 2 / EPUB 3、元数据、目录、封面和章节内容渲染
- `PDF`：支持基础分页阅读、翻页、主题切换和进度恢复

暂不支持：

- `MOBI`
- `AZW / AZW3`
- 受 DRM 保护的电子书文件

### 技术栈

- `Electron`
- `React 18`
- `JSZip`
- `pdfjs-dist`

### 本地开发

安装依赖：

```bash
pnpm install
```

启动 Electron 开发环境：

```bash
npm run electron:start
```

`npm start` 只会启动 React 开发服务器，无法访问 Electron 提供的本地文件与窗口能力。

### 构建与打包

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

### 项目结构

```text
book/
├── electron/
│   ├── main.js
│   └── preload.js
├── public/
│   ├── electron.json
│   └── index.html
├── src/
│   ├── components/
│   │   ├── BookCard.js
│   │   ├── Bookshelf.js
│   │   ├── PDFReader.js
│   │   └── Reader.js
│   ├── utils/
│   │   ├── EPUBParser.js
│   │   └── bookFormat.js
│   ├── App.js
│   ├── index.css
│   └── index.js
├── docs/
├── package.json
└── pnpm-lock.yaml
```

### 后续计划

- 应用图标与发布品牌素材
- README 与 Release 页面截图素材
- 更完善的 PDF 控件，例如跳页和缩放
- 更好的书架组织方式与最近阅读入口

### Release 文案

首个公开版本的 GitHub Release 文案草稿见 `docs/release-v1.0.0.md`。

### 许可证

MIT
