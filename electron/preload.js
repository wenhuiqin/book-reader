const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的 API 给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 选择 EPUB 文件
  selectBookFile: () => ipcRenderer.invoke('select-book-file'),

  // 下载 EPUB
  downloadEpub: (url, savePath) => ipcRenderer.invoke('download-epub', url, savePath),

  // 读取 EPUB 文件
  readEpubFile: (filePath) => ipcRenderer.invoke('read-epub-file', filePath),

  // 读取任意文件（用于 PDF 等）
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),

  // 读取文件元信息（用于缓存校验）
  getFileMetadata: (filePath) => ipcRenderer.invoke('get-file-metadata', filePath),

  // 读取文本文件（支持中文编码）
  readTextFile: (filePath) => ipcRenderer.invoke('read-text-file', filePath),

  // 在文件管理器中显示
  showInFinder: (filePath) => ipcRenderer.invoke('show-in-finder', filePath),

  // 打开阅读器窗口
  openReaderWindow: (book) => ipcRenderer.invoke('open-reader-window', book),

  // 关闭阅读器窗口
  closeReaderWindow: () => ipcRenderer.invoke('close-reader-window'),

  // 窗口控制（书架窗口）
  windowAction: (action) => ipcRenderer.invoke('window-action', action),
  getCurrentWindowBounds: () => ipcRenderer.invoke('get-current-window-bounds'),
  setCurrentWindowBounds: (bounds) => ipcRenderer.invoke('set-current-window-bounds', bounds),

  // 监听主进程消息
  onOpenBook: (callback) => {
    ipcRenderer.on('open-book', (event, book) => callback(book));
  },

  onCloseBook: (callback) => {
    ipcRenderer.on('close-book', () => callback());
  },
});
