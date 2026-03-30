# Release v1.0.0

## GitHub Release Title

`Book Reader v1.0.0`

## GitHub Release Description

### English

Book Reader `v1.0.0` is the first public release of a minimalist desktop reading app built with Electron and React.

This version focuses on the core local reading workflow:

- Import local `EPUB` and `PDF` files
- Browse books from a clean bookshelf interface
- Open books in an independent reader window
- Restore reading progress and reader preferences locally
- Read EPUB chapters with metadata, cover, and table of contents support
- Read PDF files with basic page navigation
- Use fine-grained auto-scroll speed control for long-form reading

Current limitations:

- `MOBI`, `AZW`, and `AZW3` are not supported
- DRM-protected files are not supported
- PDF controls are still intentionally minimal in this release

If you encounter bugs or packaging issues, please open an issue with your operating system version, app version, and a short reproduction path.

### 中文

Book Reader `v1.0.0` 是这个项目的首个公开版本。它是一个基于 Electron 和 React 构建的极简桌面阅读器。

这个版本优先完成了最核心的本地阅读流程：

- 导入本地 `EPUB` 和 `PDF` 文件
- 在简洁的书架界面中管理书籍
- 在独立阅读窗口中打开书籍
- 本地保存阅读进度与阅读器偏好
- 支持 EPUB 的元数据、封面、目录与章节阅读
- 支持 PDF 的基础分页阅读

当前限制：

- 暂不支持 `MOBI`、`AZW`、`AZW3`
- 暂不支持受 DRM 保护的文件
- 当前版本中的 PDF 控件仍然保持极简

如果你遇到 bug 或打包分发相关问题，欢迎提交 issue，并附上系统版本、应用版本和复现步骤。

### Release Asset

- `Book.Reader-1.0.0-arm64.dmg`

## Short Version

Use this if you want a shorter GitHub release body:

```md
First public release of Book Reader.

- Local-first desktop reader for EPUB and PDF
- Clean bookshelf interface
- Independent floating reader window
- Local reading progress restore
- EPUB metadata, cover, TOC, and chapter rendering
- Basic PDF page reading

Known limitations:
- No MOBI / AZW / AZW3 support
- No DRM support
```
