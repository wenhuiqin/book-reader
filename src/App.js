import React, { useMemo, useState } from 'react';
import Bookshelf from './components/Bookshelf';
import Reader from './components/Reader';

const BOOKS_STORAGE_KEY = 'epub-reader:books';
const PROGRESS_STORAGE_KEY = 'epub-reader:progress';

function App() {
  // 从 URL 参数判断窗口类型
  const [windowType, setWindowType] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('window') || 'shelf';
  });

  // 从 URL hash 读取书籍数据（阅读器窗口）
  const [currentBook, setCurrentBook] = useState(() => {
    if (windowType !== 'reader') return null;
    try {
      const params = new URLSearchParams(window.location.search);
      const bookData = params.get('book');
      return bookData ? JSON.parse(decodeURIComponent(bookData)) : null;
    } catch (error) {
      console.error('解析书籍数据失败:', error);
      return null;
    }
  });

  const [books, setBooks] = useState(() => {
    try {
      const raw = localStorage.getItem(BOOKS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (error) {
      console.error('读取书架缓存失败:', error);
      return [];
    }
  });

  const [readingProgress, setReadingProgress] = useState(() => {
    try {
      const raw = localStorage.getItem(PROGRESS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (error) {
      console.error('读取阅读进度缓存失败:', error);
      return {};
    }
  });

  const handleOpenBook = (book) => {
    window.electronAPI?.openReaderWindow(book);
  };

  const handleCloseBook = () => {
    window.electronAPI?.closeReaderWindow();
  };

  const handleAddBook = (book) => {
    setBooks((prev) => {
      const existed = prev.find((item) => item.path === book.path);
      if (existed) return prev;
      const next = [...prev, book];
      localStorage.setItem(BOOKS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const handleProgressChange = (bookPath, patch) => {
    setReadingProgress((prev) => {
      const current = prev[bookPath] || {};
      const isSameProgress =
        current.currentChapter === patch.currentChapter &&
        current.fontSize === patch.fontSize &&
        current.theme === patch.theme &&
        current.autoScrollSpeed === patch.autoScrollSpeed &&
        current.scrollPercent === patch.scrollPercent &&
        Math.abs((current.scrollTop || 0) - (patch.scrollTop || 0)) < 12;

      if (isSameProgress) {
        return prev;
      }

      const next = {
        ...prev,
        [bookPath]: {
          ...current,
          ...patch,
          updatedAt: Date.now(),
        },
      };
      localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const currentProgress = useMemo(() => {
    if (!currentBook) return null;
    return readingProgress[currentBook.path] || null;
  }, [currentBook, readingProgress]);

  // 书架模式：只渲染 Bookshelf
  if (windowType === 'shelf') {
    return (
      <div className="app-container bookshelf-mode">
        <Bookshelf books={books} onOpenBook={handleOpenBook} onAddBook={handleAddBook} />
      </div>
    );
  }

  // 阅读器模式：只渲染 Reader
  if (windowType === 'reader' && currentBook) {
    return (
      <div className="app-container reader-mode">
        <Reader
          book={currentBook}
          onClose={handleCloseBook}
          savedProgress={currentProgress}
          onProgressChange={handleProgressChange}
        />
      </div>
    );
  }

  // 默认返回书架
  return (
    <div className="app-container bookshelf-mode">
      <Bookshelf books={books} onOpenBook={handleOpenBook} onAddBook={handleAddBook} />
    </div>
  );
}

export default App;
