import React from 'react';
import BookCard from './BookCard';
import { getBookFormat } from '../utils/bookFormat';

function Bookshelf({ books, onOpenBook, onAddBook }) {
  const handleAddFromLocal = async () => {
    try {
      if (!window.electronAPI) {
        alert('请在 Electron 环境中运行此应用（运行：npm run electron:start）');
        return;
      }
      const result = await window.electronAPI.selectBookFile();
      if (result && result.path) {
        onAddBook({
          id: Date.now(),
          path: result.path,
          name: result.name,
          format: getBookFormat(result.path),
          addedAt: new Date(),
        });
      }
    } catch (error) {
      console.error('选择文件失败:', error);
    }
  };

  return (
    <div className="bookshelf-wrapper">
      <div className="bookshelf-container">
        <div className="bookshelf-header">
          <div className="bookshelf-title-wrap">
            <div>
              <h1>书架</h1>
              <p className="bookshelf-subtitle">安静地收纳，直接开始阅读。</p>
            </div>
          </div>
          <div className="bookshelf-actions">
            <button className="btn btn-primary" onClick={handleAddFromLocal}>
              <span className="btn-icon">+</span>
              导入书籍
            </button>
          </div>
        </div>

        {books.length === 0 ? (
            <div className="empty-state">
            <div className="empty-state-icon">📚</div>
            <h2>书架空空如也</h2>
            <p>点击上方按钮添加 EPUB 或 PDF 文档，开始您的阅读之旅吧！</p>
          </div>
        ) : (
          <>
            <div className="books-grid">
              {books.map((book) => (
                <BookCard key={book.id} book={book} onClick={() => onOpenBook(book)} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Bookshelf;
