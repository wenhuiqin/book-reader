# EPUB Reader

基于 Electron + React 的桌面 EPUB 阅读器。

## 功能特性

- 📚 **书架管理** - 可视化展示所有 EPUB 书籍
- 📖 **阅读功能** - 舒适的阅读界面，支持字体大小调节
- 📑 **目录导航** - 支持 EPUB 目录跳转
- 📁 **本地添加** - 从文件系统选择 EPUB 文件
- 📂 **目录扫描** - 批量扫描文件夹中的 EPUB
- 🔗 **网络下载** - 支持从 URL 下载 EPUB 文件

## 技术架构

### EPUB 格式解析
EPUB 文件本质上是 ZIP 压缩包，包含：
- `META-INF/container.xml` - 指向 content.opf 的位置
- `content.opf` - 书籍元数据和章节列表
- `*.xhtml` / `*.html` - 实际章节内容
- `toc.ncx` 或 `nav.xhtml` - 目录信息

### 核心技术栈
- **Electron** - 跨平台桌面应用框架
- **React 18** - 前端 UI 框架
- **JSZip** - 解析 EPUB (ZIP) 文件

## 快速开始

### 安装依赖
```bash
npm install
```

### 开发模式（推荐）
直接启动 Electron 开发环境：
```bash
npm run electron:start
```

> 注意：不要运行 `npm start`，因为那会只启动 React 开发服务器，无法使用 Electron API（文件选择、目录扫描等功能）

### 构建应用
```bash
npm run build
npm run electron:build
```

## 项目结构

```
book/
├── electron/
│   ├── main.js          # Electron 主进程
│   └── preload.js       # 预加载脚本
├── public/
│   └── index.html
├── src/
│   ├── components/
│   │   ├── App.js
│   │   ├── Bookshelf.js      # 书架视图
│   │   ├── BookCard.js       # 书籍卡片
│   │   ├── Reader.js         # 阅读器
│   │   └── AddBookModal.js   # 添加书籍模态框
│   ├── utils/
│   │   └── EPUBParser.js     # EPUB 解析器
│   ├── index.js
│   └── index.css
└── package.json
```

## 支持的 EPUB 特性

- ✅ EPUB 2 和 EPUB 3 格式
- ✅ 书籍元数据（标题、作者、出版社等）
- ✅ 目录导航（NCX 和 EPUB3 Nav）
- ✅ 章节内容解析
- ✅ 封面图片显示
- ✅ 字体大小调节
- ⏳ 书签功能（待实现）
- ⏳ 阅读进度同步（待实现）

## 许可证

MIT
