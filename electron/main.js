const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');

let shelfWindow = null;
let readerWindow = null;

const WINDOW_PRESETS = {
  shelf: { width: 1440, height: 920, minWidth: 1100, minHeight: 720, resizable: true },
  reader: { width: 430, height: 930, minWidth: 390, minHeight: 740, resizable: true },
};

function getResourcePath() {
  // 生产环境：app.asar 内部
  // 开发环境：electron 目录
  if (app.isPackaged) {
    // app.asar 内部路径：Resources/app.asar/build/electron/main.js
    // __dirname 指向 app.asar/build/electron
    // index.html 在 app.asar/build/index.html
    return path.join(__dirname, '..');
  }
  return path.join(__dirname, '..');
}

function getIndexHtmlPath() {
  const basePath = getResourcePath();
  // build/index.html 路径
  return `file://${path.join(basePath, 'index.html')}`;
}

function toArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

async function getFileStatPayload(filePath) {
  const stat = await fs.promises.stat(filePath);
  return {
    path: filePath,
    name: path.basename(filePath),
    size: stat.size,
    mtimeMs: stat.mtimeMs,
  };
}

async function readBinaryFile(filePath) {
  const [content, statPayload] = await Promise.all([
    fs.promises.readFile(filePath),
    getFileStatPayload(filePath),
  ]);

  return {
    ...statPayload,
    content: toArrayBuffer(content),
  };
}

function createShelfWindow() {
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  const url = isDev ? 'http://localhost:3000?window=shelf' : getIndexHtmlPath() + '?window=shelf';

  shelfWindow = new BrowserWindow({
    width: WINDOW_PRESETS.shelf.width,
    height: WINDOW_PRESETS.shelf.height,
    minWidth: WINDOW_PRESETS.shelf.minWidth,
    minHeight: WINDOW_PRESETS.shelf.minHeight,
    resizable: WINDOW_PRESETS.shelf.resizable,
    center: true,
    frame: true,
    backgroundColor: '#ffffff',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(getResourcePath(), 'electron/preload.js'),
    },
  });

  shelfWindow.loadURL(url);

  if (isDev) {
    shelfWindow.webContents.openDevTools();
  }

  shelfWindow.on('closed', () => {
    shelfWindow = null;
  });
}

function createReaderWindow(book) {
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

  const bookData = encodeURIComponent(JSON.stringify(book));
  let url;
  if (isDev) {
    url = `http://localhost:3000?window=reader&book=${bookData}`;
  } else {
    url = `${getIndexHtmlPath()}?window=reader&book=${bookData}`;
  }

  readerWindow = new BrowserWindow({
    width: WINDOW_PRESETS.reader.width,
    height: WINDOW_PRESETS.reader.height,
    minWidth: WINDOW_PRESETS.reader.minWidth,
    minHeight: WINDOW_PRESETS.reader.minHeight,
    resizable: WINDOW_PRESETS.reader.resizable,
    center: true,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(getResourcePath(), 'electron/preload.js'),
    },
  });

  readerWindow.loadURL(url);

  if (isDev) {
    readerWindow.webContents.openDevTools();
  }

  readerWindow.on('closed', () => {
    readerWindow = null;
  });
}

app.whenReady().then(() => {
  createShelfWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createShelfWindow();
  } else if (!shelfWindow) {
    createShelfWindow();
  }
});

// 打开阅读器窗口
ipcMain.handle('open-reader-window', async (event, book) => {
  if (shelfWindow) {
    shelfWindow.hide();
  }

  if (readerWindow) {
    readerWindow.close();
  }

  createReaderWindow(book);

  return { ok: true };
});

// 关闭阅读器窗口，返回书架
ipcMain.handle('close-reader-window', async () => {
  if (readerWindow) {
    readerWindow.close();
    readerWindow = null;
  }
  if (shelfWindow) {
    shelfWindow.show();
    shelfWindow.focus();
  }
  return { ok: true };
});

// 选择本地书籍文件
ipcMain.handle('select-book-file', async () => {
  const result = await dialog.showOpenDialog(shelfWindow, {
    filters: [{ name: 'Books', extensions: ['epub', 'pdf', 'txt'] }],
    properties: ['openFile'],
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const filePath = result.filePaths[0];
    return getFileStatPayload(filePath);
  }
  return null;
});

// 下载网络 EPUB 文件
ipcMain.handle('download-epub', async (event, url, savePath) => {
  return new Promise((resolve) => {
    const fileName = path.basename(url.split('?')[0]);
    const filePath = path.join(savePath, fileName);
    const file = fs.createWriteStream(filePath);

    https
      .get(url, (response) => {
        if (response.statusCode !== 200) {
          resolve({ error: `下载失败：HTTP ${response.statusCode}` });
          return;
        }
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve({ path: filePath, name: fileName });
        });
      })
      .on('error', (err) => {
        fs.unlink(filePath, () => {});
        resolve({ error: err.message });
      });
  });
});

// 在文件管理器中显示文件
ipcMain.handle('show-in-finder', async (event, filePath) => {
  shell.showItemInFolder(filePath);
});

// 读取文件元信息（用于缓存校验）
ipcMain.handle('get-file-metadata', async (event, filePath) => {
  try {
    return await getFileStatPayload(filePath);
  } catch (error) {
    return { error: error.message, path: filePath };
  }
});

// 读取 EPUB 文件内容（用于解析）
ipcMain.handle('read-epub-file', async (event, filePath) => {
  try {
    return await readBinaryFile(filePath);
  } catch (error) {
    return { error: error.message, path: filePath };
  }
});

// 读取任意文件（用于 PDF 等二进制文件）
ipcMain.handle('read-file', async (event, filePath) => {
  try {
    const [content, statPayload] = await Promise.all([
      fs.promises.readFile(filePath),
      getFileStatPayload(filePath),
    ]);

    return {
      ...statPayload,
      content: content.toString('base64'),
    };
  } catch (error) {
    return { error: error.message, path: filePath };
  }
});

// 读取文本文件（自动检测编码，支持中文）
ipcMain.handle('read-text-file', async (event, filePath) => {
  try {
    // 尝试多种编码读取中文文本
    const iconv = require('iconv-lite');
    const buffer = await fs.promises.readFile(filePath);

    // 先尝试 UTF-8
    let text = buffer.toString('utf8');
    if (!/^[\x00-\x7F\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef\s\p{P}]*$/u.test(text) && text.includes('ï') || text.includes('')) {
      // 如果不是有效文本，尝试 GBK/GB18030
      try {
        text = iconv.decode(buffer, 'gbk');
      } catch (e) {
        text = iconv.decode(buffer, 'gb18030');
      }
    }

    return { content: text, path: filePath };
  } catch (error) {
    return { error: error.message, path: filePath };
  }
});

// 窗口控制（书架窗口）
ipcMain.handle('window-action', async (event, action) => {
  if (!shelfWindow || shelfWindow.isDestroyed()) return { ok: false };

  switch (action) {
    case 'close':
      app.quit();
      break;
    case 'minimize':
      shelfWindow.minimize();
      break;
    case 'fullscreen':
      shelfWindow.setFullScreen(!shelfWindow.isFullScreen());
      break;
    default:
      return { ok: false, error: '未知操作' };
  }
  return { ok: true };
});

ipcMain.handle('get-current-window-bounds', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || win.isDestroyed()) return null;
  return win.getBounds();
});

ipcMain.handle('set-current-window-bounds', async (event, nextBounds) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || win.isDestroyed() || !nextBounds) return { ok: false };

  const currentBounds = win.getBounds();
  const minWidth = WINDOW_PRESETS.reader.minWidth;
  const minHeight = WINDOW_PRESETS.reader.minHeight;

  const width = Math.max(minWidth, Math.round(nextBounds.width ?? currentBounds.width));
  const height = Math.max(minHeight, Math.round(nextBounds.height ?? currentBounds.height));
  const x = Math.round(nextBounds.x ?? currentBounds.x);
  const y = Math.round(nextBounds.y ?? currentBounds.y);

  win.setBounds({ x, y, width, height });
  return { ok: true, bounds: win.getBounds() };
});
