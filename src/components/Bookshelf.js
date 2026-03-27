import React from 'react';
import BookCard from './BookCard';

function Bookshelf({ books, onOpenBook, onAddBook }) {
  const handleAddFromLocal = async () => {
    try {
      if (!window.electronAPI) {
        alert('请在 Electron 环境中运行此应用（运行：npm run electron:start）');
        return;
      }
      const result = await window.electronAPI.selectEpubFile();
      if (result && result.path) {
        onAddBook({
          id: Date.now(),
          path: result.path,
          name: result.name,
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
            <h1>我的书架</h1>
            {books.length > 0 && <span className="book-count">{books.length} 本</span>}
          </div>
          <div className="bookshelf-actions">
            <button className="btn btn-primary" onClick={handleAddFromLocal}>
              📁 添加书籍
            </button>
          </div>
        </div>

        {books.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📚</div>
            <h2>书架空空如也</h2>
            <p>点击上方按钮添加 EPUB 格式的电子书，开始您的阅读之旅吧！</p>
          </div>
        ) : (
          <div className="books-grid">
            {books.map((book) => (
              <BookCard key={book.id} book={book} onClick={() => onOpenBook(book)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Bookshelf;
