# Release v1.1.0

## GitHub Release Title

`Book Reader v1.1.0`

## GitHub Release Description

### English

Book Reader `v1.1.0` is a stability and usability release focused on local reading quality.

Highlights in this version:

- Added local `TXT` reading support
- Improved `PDF` bookshelf covers and packaging stability
- Improved `EPUB` compatibility for cover handling and chapter loading
- Added clearer error messages for DRM-protected EPUB files
- Reduced bookshelf startup cost with cover caching and lighter file-loading paths
- Fixed Electron development startup flow for the current project structure

Notes:

- `MOBI`, `AZW`, and `AZW3` are still not supported
- DRM-protected files are still not supported for reading
- This release remains focused on local desktop reading instead of cloud sync features

If you encounter a regression, please include the file type, operating system version, and a short reproduction path.

### 中文

Book Reader `v1.1.0` 是一个以稳定性和可用性为重点的版本，主要改进本地阅读体验。

本次更新重点：

- 新增本地 `TXT` 阅读支持
- 改进 `PDF` 书架封面展示与打包稳定性
- 改进 `EPUB` 的封面处理与章节加载兼容性
- 对受 DRM 保护的 EPUB 提供更明确的错误提示
- 通过封面缓存和更轻量的文件读取链路，降低书架启动开销
- 修复当前项目结构下的 Electron 开发启动流程

说明：

- 仍不支持 `MOBI`、`AZW`、`AZW3`
- 仍不支持阅读受 DRM 保护的文件
- 当前版本仍聚焦本地桌面阅读，不包含云同步能力

如果你遇到回归问题，建议附上文件类型、系统版本和简短复现路径。

### Release Assets

- `Book Reader-1.1.0-arm64.dmg`
- `Book Reader-1.1.0.dmg`

## Short Version

Use this if you want a shorter GitHub release body:

```md
Book Reader v1.1.0

- Added TXT reading
- Better PDF bookshelf covers
- Better EPUB cover/chapter compatibility
- Clearer DRM error messaging
- Faster bookshelf cover loading with cache

Known limitations:
- No MOBI / AZW / AZW3 support
- No DRM support
```
