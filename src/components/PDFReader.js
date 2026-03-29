import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

function PDFReader({ book, onClose, savedProgress, onProgressChange }) {
  const [pdfDoc, setPdfDoc] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [theme, setTheme] = useState('light');
  const [loading, setLoading] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const contentRef = useRef(null);
  const settingsRef = useRef(null);
  const canvasRef = useRef(null);
  const renderTaskRef = useRef(null);
  const persistTimerRef = useRef(null);

  const isDarkTheme = theme === 'dark';

  const persistProgress = (force = false) => {
    const el = contentRef.current;
    if (!pdfDoc || !onProgressChange || !el) return;

    const scrollTop = el.scrollTop;
    const maxScrollTop = Math.max(0, el.scrollHeight - el.clientHeight);
    const scrollPercent = maxScrollTop > 0 ? Math.round((scrollTop / maxScrollTop) * 100) : 0;

    onProgressChange(book.path, {
      currentChapter: currentPage - 1,
      theme,
      scrollTop,
      scrollPercent,
      pageCount,
      force,
    });
  };

  const schedulePersist = (delay = 200, force = false) => {
    if (persistTimerRef.current) {
      window.clearTimeout(persistTimerRef.current);
    }
    persistTimerRef.current = window.setTimeout(() => {
      persistTimerRef.current = null;
      persistProgress(force);
    }, delay);
  };

  useEffect(() => {
    let cancelled = false;

    const loadPdf = async () => {
      try {
        setLoading(true);
        const result = await window.electronAPI.readEpubFile(book.path);
        if (result.error) {
          alert('读取文件失败：' + result.error);
          onClose();
          return;
        }

        const binaryString = atob(result.content);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        const loadingTask = pdfjsLib.getDocument({ data: bytes });
        const loadedDoc = await loadingTask.promise;
        if (cancelled) {
          await loadedDoc.destroy();
          return;
        }

        setPdfDoc(loadedDoc);
        setPageCount(loadedDoc.numPages);
        setCurrentPage(Math.min((savedProgress?.currentChapter || 0) + 1, loadedDoc.numPages));
        setTheme(savedProgress?.theme || 'light');
        setLoading(false);
      } catch (error) {
        console.error('加载 PDF 失败:', error);
        alert('无法打开 PDF 文件');
        onClose();
      }
    };

    loadPdf();

    return () => {
      cancelled = true;
      if (persistTimerRef.current) {
        window.clearTimeout(persistTimerRef.current);
      }
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
    };
  }, [book.path]);

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current || !contentRef.current) return undefined;

    let cancelled = false;

    const renderPage = async () => {
      try {
        setRendering(true);
        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
        }

        const page = await pdfDoc.getPage(currentPage);
        if (cancelled) return;

        const contentWidth = Math.max(280, contentRef.current.clientWidth - 56);
        const baseViewport = page.getViewport({ scale: 1 });
        const scale = contentWidth / baseViewport.width;
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        renderTaskRef.current = page.render({
          canvasContext: context,
          viewport,
        });
        await renderTaskRef.current.promise;
        if (cancelled) return;

        const el = contentRef.current;
        const savedPage = (savedProgress?.currentChapter || 0) + 1;
        if (savedPage === currentPage) {
          const maxScrollTop = Math.max(0, el.scrollHeight - el.clientHeight);
          const nextScrollTop = typeof savedProgress?.scrollPercent === 'number'
            ? Math.round(maxScrollTop * savedProgress.scrollPercent / 100)
            : Math.max(0, savedProgress?.scrollTop || 0);
          el.scrollTop = Math.min(maxScrollTop, nextScrollTop);
        } else {
          el.scrollTop = 0;
        }

        persistProgress(true);
      } catch (error) {
        if (error?.name !== 'RenderingCancelledException') {
          console.error('渲染 PDF 页面失败:', error);
        }
      } finally {
        if (!cancelled) {
          setRendering(false);
        }
      }
    };

    renderPage();

    const handleResize = () => {
      renderPage();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelled = true;
      window.removeEventListener('resize', handleResize);
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
    };
  }, [pdfDoc, currentPage]);

  useEffect(() => {
    if (!contentRef.current) return undefined;

    const handleScroll = () => {
      schedulePersist(180);
    };

    const el = contentRef.current;
    el.addEventListener('scroll', handleScroll);
    return () => {
      schedulePersist(0, true);
      el.removeEventListener('scroll', handleScroll);
    };
  }, [pdfDoc, currentPage, theme]);

  useEffect(() => {
    if (!showSettings) return undefined;
    const handleClickOutside = (event) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target)) {
        setShowSettings(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSettings]);

  const handlePrevPage = () => {
    if (currentPage > 1) {
      persistProgress(true);
      setCurrentPage((value) => value - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < pageCount) {
      persistProgress(true);
      setCurrentPage((value) => value + 1);
    }
  };

  const handleCloseReader = () => {
    persistProgress(true);
    onClose();
  };

  if (loading) {
    return (
      <div className={`reader-wrapper ${isDarkTheme ? 'dark-theme' : ''}`}>
        <div className="phone-frame">
          <div className="phone-display">
            <div className="loading"><div className="spinner"></div></div>
          </div>
        </div>
      </div>
    );
  }

  const progress = pageCount ? Math.round((currentPage / pageCount) * 100) : 0;

  return (
    <div className={`reader-wrapper ${isDarkTheme ? 'dark-theme' : ''}`}>
      <div className="phone-frame">
        <div
          className="drag-region"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '40px',
            zIndex: 1000,
            WebkitAppRegion: 'drag'
          }}
        />
        <div className="phone-notch"></div>
        <div className="phone-display">
          <div className="reader-top-bar" style={{ WebkitAppRegion: 'no-drag' }}>
            <button className="icon-btn" disabled>PDF</button>
            <span className="book-title-mini">{book.name}</span>
            <div className="top-bar-actions">
              <button className="icon-btn" onClick={() => setTheme(isDarkTheme ? 'light' : 'dark')}>
                {isDarkTheme ? '☀' : '☾'}
              </button>
              <button className="icon-btn" onClick={() => setShowSettings((value) => !value)}>⚙</button>
              <button className="icon-btn close-btn" onClick={handleCloseReader}>✕</button>
            </div>
          </div>

          <div className="reader-content pdf-reader-content" ref={contentRef}>
            <div className="pdf-page-shell">
              {rendering && <div className="pdf-loading-indicator">渲染中...</div>}
              <canvas ref={canvasRef} className="pdf-canvas" />
            </div>
          </div>

          <div className="reader-bottom-bar">
            <button className="nav-btn" onClick={handlePrevPage} disabled={currentPage <= 1}>‹</button>
            <div className="progress-wrap">
              <div className="progress-bar" aria-hidden="true">
                <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
              </div>
              <div className="progress-meta">
                {currentPage}/{pageCount} · {progress}%
              </div>
            </div>
            <button className="nav-btn" onClick={handleNextPage} disabled={currentPage >= pageCount}>›</button>
          </div>

          {showSettings && (
            <div className="settings-panel" ref={settingsRef}>
              <div className="settings-row">
                <span className="font-label">格式</span>
                <span className="font-value">PDF</span>
              </div>
              <div className="settings-row">
                <span className="font-label">页数</span>
                <span className="font-value">{pageCount}</span>
              </div>
              <button className="settings-close" onClick={() => setShowSettings(false)}>完成</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PDFReader;
