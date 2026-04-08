import React, { useEffect, useRef, useState } from 'react';

function TXTReader({ book, onClose, savedProgress, onProgressChange }) {
  const [content, setContent] = useState('');
  const [theme, setTheme] = useState('light');
  const [loading, setLoading] = useState(true);
  const [fontSize, setFontSize] = useState(16);
  const [showSettings, setShowSettings] = useState(false);

  const contentRef = useRef(null);
  const settingsRef = useRef(null);
  const persistTimerRef = useRef(null);

  const isDarkTheme = theme === 'dark';

  const persistProgress = (force = false) => {
    const el = contentRef.current;
    if (!onProgressChange || !el) return;

    const scrollTop = el.scrollTop;
    const maxScrollTop = Math.max(0, el.scrollHeight - el.clientHeight);
    const scrollPercent = maxScrollTop > 0 ? Math.round((scrollTop / maxScrollTop) * 100) : 0;

    onProgressChange(book.path, {
      theme,
      fontSize,
      scrollTop,
      scrollPercent,
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
    const loadTxt = async () => {
      try {
        setLoading(true);

        // 直接读取文件内容为文本（让 Node.js 处理编码）
        const result = await window.electronAPI.readTextFile(book.path);

        if (result.error) {
          alert('读取文件失败：' + result.error);
          onClose();
          return;
        }

        setContent(result.content);
        setTheme(savedProgress?.theme || 'light');
        setFontSize(savedProgress?.fontSize || 16);
        setLoading(false);
      } catch (error) {
        console.error('加载 TXT 失败:', error);
        alert('无法打开 TXT 文件：' + error.message);
        onClose();
      }
    };

    loadTxt();

    return () => {
      if (persistTimerRef.current) {
        window.clearTimeout(persistTimerRef.current);
      }
    };
  }, [book.path]);

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
  }, [theme, fontSize]);

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

  // 恢复滚动位置
  useEffect(() => {
    if (!contentRef.current || !savedProgress) return;
    const el = contentRef.current;
    const maxScrollTop = Math.max(0, el.scrollHeight - el.clientHeight);
    const nextScrollTop = typeof savedProgress?.scrollPercent === 'number'
      ? Math.round(maxScrollTop * savedProgress.scrollPercent / 100)
      : Math.max(0, savedProgress?.scrollTop || 0);
    el.scrollTop = Math.min(maxScrollTop, nextScrollTop);
  }, [content, savedProgress]);

  const handleCloseReader = () => {
    persistProgress(true);
    onClose();
  };

  const paragraphs = content.split('\n').filter(p => p.trim());
  const progress = contentRef.current && contentRef.current.scrollHeight > contentRef.current.clientHeight
    ? Math.round((contentRef.current.scrollTop / (contentRef.current.scrollHeight - contentRef.current.clientHeight)) * 100)
    : 0;

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
            <button className="icon-btn" disabled>TXT</button>
            <span className="book-title-mini">{book.name}</span>
            <div className="top-bar-actions">
              <button className="icon-btn" onClick={() => setTheme(isDarkTheme ? 'light' : 'dark')}>
                {isDarkTheme ? '☀' : '☾'}
              </button>
              <button className="icon-btn" onClick={() => setShowSettings((value) => !value)}>⚙</button>
              <button className="icon-btn close-btn" onClick={handleCloseReader}>✕</button>
            </div>
          </div>

          <div className="reader-content txt-reader-content" ref={contentRef}>
            {paragraphs.map((para, i) => (
              <p key={i} style={{ fontSize: `${fontSize}px` }}>{para}</p>
            ))}
          </div>

          <div className="reader-bottom-bar">
            <div style={{ width: 40 }}></div>
            <div className="progress-wrap">
              <div className="progress-bar" aria-hidden="true">
                <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
              </div>
              <div className="progress-meta">
                {progress}%
              </div>
            </div>
            <div style={{ width: 40 }}></div>
          </div>

          {showSettings && (
            <div className="settings-panel" ref={settingsRef}>
              <div className="settings-row">
                <span className="font-label">格式</span>
                <span className="font-value">TXT</span>
              </div>
              <div className="settings-row">
                <span className="font-label">字体</span>
                <div className="font-controls">
                  <button className="font-btn" onClick={() => setFontSize(f => Math.max(f - 2, 12))}>A-</button>
                  <span className="font-value">{fontSize}</span>
                  <button className="font-btn" onClick={() => setFontSize(f => Math.min(f + 2, 24))}>A+</button>
                </div>
              </div>
              <button className="settings-close" onClick={() => setShowSettings(false)}>完成</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default TXTReader;
