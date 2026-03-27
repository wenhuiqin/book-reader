import React, { useState, useEffect, useRef } from 'react';
import EPUBParser from '../utils/EPUBParser';

function Reader({ book, onClose, savedProgress, onProgressChange }) {
  // 核心状态
  const [epubData, setEpubData] = useState(null);
  const [zip, setZip] = useState(null);
  const [parser, setParser] = useState(null);
  const [currentChapter, setCurrentChapter] = useState(0);
  const [chapterContent, setChapterContent] = useState('');
  const [coverImage, setCoverImage] = useState(null);
  const [loading, setLoading] = useState(true);

  // 阅读设置
  const [fontSize, setFontSize] = useState(16);
  const [theme, setTheme] = useState('light');
  const [autoScroll, setAutoScroll] = useState(false);
  const [autoScrollSpeed, setAutoScrollSpeed] = useState(1);
  const [showToc, setShowToc] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // refs
  const contentRef = useRef(null);
  const settingsRef = useRef(null);
  const autoScrollRef = useRef(null);
  const hasRestoredProgress = useRef(false);

  // 初始化：加载书籍和恢复进度
  useEffect(() => {
    loadBook();
    return () => {
      if (zip) zip.folder(null);
      if (coverImage) URL.revokeObjectURL(coverImage);
    };
  }, [book.path]);

  // 恢复阅读进度（只在初次加载时执行一次）
  useEffect(() => {
    if (!savedProgress || hasRestoredProgress.current) return;
    hasRestoredProgress.current = true;

    setFontSize(savedProgress.fontSize || 16);
    setTheme(savedProgress.theme || 'light');
    if (typeof savedProgress.autoScrollSpeed === 'number') {
      setAutoScrollSpeed(savedProgress.autoScrollSpeed);
    }
  }, []);

  // 封面加载完成后，恢复上次阅读的章节
  useEffect(() => {
    if (!coverImage || !epubData) return;
    const savedChapter = savedProgress?.currentChapter || 0;
    setCurrentChapter(Math.min(savedChapter + 1, epubData.spine.length));
  }, [coverImage, epubData]);

  // 加载章节内容
  useEffect(() => {
    if (epubData && currentChapter >= 0 && currentChapter <= epubData.spine.length) {
      loadChapter(currentChapter);
    }
  }, [currentChapter, epubData, coverImage]);

  // 自动保存进度
  useEffect(() => {
    if (!epubData || !onProgressChange) return;
    const savedChapterIndex = coverImage ? currentChapter - 1 : currentChapter;
    onProgressChange(book.path, {
      currentChapter: Math.max(0, savedChapterIndex),
      fontSize,
      theme,
      autoScrollSpeed
    });
  }, [book.path, currentChapter, fontSize, theme, autoScrollSpeed, epubData, onProgressChange, coverImage]);

  // 设置面板点击外部关闭
  useEffect(() => {
    if (!showSettings) return;
    const handleClickOutside = (event) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target)) {
        setShowSettings(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSettings]);

  // 自动滚动
  useEffect(() => {
    if (!autoScroll || !contentRef.current || loading) return undefined;

    const tick = () => {
      const el = contentRef.current;
      if (!el) return;

      const maxTop = el.scrollHeight - el.clientHeight;
      if (maxTop <= 0) return;

      if (el.scrollTop >= maxTop - 2) {
        if (epubData && currentChapter < epubData.spine.length) {
          setCurrentChapter((prev) => prev + 1);
          return;
        }
        setAutoScroll(false);
        return;
      }

      el.scrollTop += autoScrollSpeed;
      autoScrollRef.current = window.requestAnimationFrame(tick);
    };

    autoScrollRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (autoScrollRef.current) {
        window.cancelAnimationFrame(autoScrollRef.current);
        autoScrollRef.current = null;
      }
    };
  }, [autoScroll, autoScrollSpeed, currentChapter, epubData, loading]);

  // 处理书中链接点击
  useEffect(() => {
    if (!contentRef.current || !epubData || !zip) return;

    const handleClick = (e) => {
      const link = e.target.closest('a');
      if (!link) return;

      const href = link.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('data:')) {
        return;
      }

      e.preventDefault();

      // 解析 EPUB 内部链接
      const targetChapter = epubData.spine.findIndex(ch => {
        const chapterHref = ch.href?.split('#')[0];
        const linkPath = href.split('#')[0];
        return chapterHref === linkPath || chapterHref?.endsWith(linkPath);
      });

      if (targetChapter >= 0) {
        setCurrentChapter(targetChapter + (coverImage ? 2 : 1));
      }
    };

    contentRef.current.addEventListener('click', handleClick);
    return () => contentRef.current?.removeEventListener('click', handleClick);
  }, [epubData, zip, coverImage]);

  const loadBook = async () => {
    try {
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

      const JSZip = (await import('jszip')).default;
      const loadedZip = await JSZip.loadAsync(bytes);
      setZip(loadedZip);

      const newParser = new EPUBParser();
      const data = await newParser.parse(bytes);
      setEpubData(data);
      setParser(newParser);

      // 加载封面
      let coverFilePath = data.metadata.coverPath || data.metadata.coverHref;
      let coverFile = coverFilePath ? loadedZip.file(coverFilePath) : null;

      if (!coverFile) {
        const allFiles = Object.keys(loadedZip.files || {});
        const imagePattern = /\.(jpg|jpeg|png|webp|gif)$/i;
        const coverNamePattern = /(cover|fengmian|front|thumbnail|thumb)/i;
        const guessed = allFiles.find((filePath) =>
          imagePattern.test(filePath) && coverNamePattern.test(filePath)
        );
        if (guessed) {
          coverFile = loadedZip.file(guessed);
        }
      }

      if (coverFile) {
        const coverBlob = await coverFile.async('blob');
        const coverUrl = URL.createObjectURL(coverBlob);
        setCoverImage(coverUrl);
      }

      setLoading(false);
    } catch (error) {
      console.error('加载 EPUB 失败:', error);
      alert('无法打开 EPUB 文件');
      onClose();
    }
  };

  const loadChapter = async (index) => {
    if (!zip || !epubData || !parser) return;

    // 第 0 章显示封面
    if (index === 0 && coverImage) {
      const metadata = epubData.metadata;
      const coverHtml = `
        <div class="cover-page">
          <div class="cover-image-wrapper">
            <img src="${coverImage}" alt="封面" class="cover-image" />
          </div>
          <div class="cover-title">${metadata.title}</div>
          <div class="cover-author">${metadata.creator}</div>
        </div>
      `;
      setChapterContent(coverHtml);
      if (contentRef.current) contentRef.current.scrollTop = 0;
      return;
    }

    const spineIndex = coverImage ? index - 1 : index;
    const chapter = epubData.spine[spineIndex];

    if (!chapter) {
      console.warn('章节不存在:', spineIndex);
      return;
    }

    const content = await parser.getChapterContent(zip, chapter);
    setChapterContent(content);
    if (contentRef.current) contentRef.current.scrollTop = 0;
  };

  const handlePrevChapter = () => {
    if (currentChapter > 0) setCurrentChapter(currentChapter - 1);
  };

  const handleNextChapter = () => {
    const maxChapter = coverImage ? epubData.spine.length : epubData.spine.length - 1;
    if (currentChapter < maxChapter) {
      setCurrentChapter(currentChapter + 1);
    }
  };

  const handleTocClick = (index) => {
    setCurrentChapter(index);
    setShowToc(false);
  };

  const isDarkTheme = theme === 'dark';

  if (loading) {
    return (
      <div className="reader-wrapper">
        <div className="phone-frame">
          <div className="phone-notch"></div>
          <div className="phone-display">
            <div className="loading"><div className="spinner"></div></div>
          </div>
        </div>
      </div>
    );
  }

  if (!epubData) return null;

  const progress = Math.round(((currentChapter + 1) / epubData.spine.length) * 100);
  const displayChapter = currentChapter === 0 && coverImage ? '封面' : `${currentChapter + 1}/${epubData.spine.length}`;

  return (
    <div className={`reader-wrapper ${isDarkTheme ? 'dark-theme' : ''}`}>
      <div className="phone-frame">
        <div className="phone-notch"></div>
        <div className="phone-display">
          {/* 顶部导航 */}
          <div className="reader-top-bar">
            <button className="icon-btn" onClick={() => setShowToc(true)}>☰</button>
            <span className="book-title-mini">{epubData.metadata.title}</span>
            <div className="top-bar-actions">
              <button className="icon-btn" onClick={() => setTheme(isDarkTheme ? 'light' : 'dark')}>
                {isDarkTheme ? '☀' : '☾'}
              </button>
              <button className="icon-btn" onClick={() => setShowSettings(!showSettings)}>⚙</button>
              <button className="icon-btn close-btn" onClick={onClose}>✕</button>
            </div>
          </div>

          {/* 阅读内容 */}
          <div
            className="reader-content"
            ref={contentRef}
            dangerouslySetInnerHTML={{ __html: chapterContent }}
            style={{ fontSize: `${fontSize}px` }}
          />

          {/* 底部导航 */}
          <div className="reader-bottom-bar">
            <button className="nav-btn" onClick={handlePrevChapter} disabled={currentChapter === 0}>‹</button>
            <div className="progress-wrap">
              <div className="progress-bar" aria-hidden="true">
                <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
              </div>
              <div className="progress-meta">
                {displayChapter} · {progress}%
              </div>
            </div>
            <button className="nav-btn" onClick={handleNextChapter} disabled={currentChapter >= epubData.spine.length}>›</button>
          </div>

          {/* 设置面板 */}
          {showSettings && (
            <div className="settings-panel" ref={settingsRef}>
              <div className="settings-row">
                <span className="font-label">字体</span>
                <div className="font-controls">
                  <button className="font-btn" onClick={() => setFontSize(f => Math.max(f - 2, 12))}>A-</button>
                  <span className="font-value">{fontSize}</span>
                  <button className="font-btn" onClick={() => setFontSize(f => Math.min(f + 2, 24))}>A+</button>
                </div>
              </div>
              <div className="settings-row">
                <span className="font-label">自动翻页</span>
                <button className={`font-btn toggle-btn ${autoScroll ? 'on' : ''}`} onClick={() => setAutoScroll((v) => !v)}>
                  {autoScroll ? 'ON' : 'OFF'}
                </button>
              </div>
              {autoScroll && (
                <div className="settings-row">
                  <span className="font-label">滚动速度</span>
                  <div className="font-controls">
                    <button className="font-btn" onClick={() => setAutoScrollSpeed((s) => Math.max(0.5, Number((s - 0.5).toFixed(1))))}>-</button>
                    <span className="font-value">{autoScrollSpeed.toFixed(1)}</span>
                    <button className="font-btn" onClick={() => setAutoScrollSpeed((s) => Math.min(3, Number((s + 0.5).toFixed(1))))}>+</button>
                  </div>
                </div>
              )}
              <button className="settings-close" onClick={() => setShowSettings(false)}>完成</button>
            </div>
          )}

          {/* 目录 */}
          {showToc && (
            <div className="toc-overlay" onClick={() => setShowToc(false)}>
              <div className="toc-sidebar" onClick={(e) => e.stopPropagation()}>
                <div className="toc-header">
                  <h3>目录</h3>
                  <button className="toc-close" onClick={() => setShowToc(false)}>×</button>
                </div>
                <div className="toc-list">
                  {coverImage && (
                    <div
                      className={`toc-item ${currentChapter === 0 ? 'active' : ''}`}
                      onClick={() => handleTocClick(0)}
                    >
                      封面
                    </div>
                  )}
                  {epubData.toc.map((item, i) => (
                    <div
                      key={i}
                      className={`toc-item ${currentChapter === i + (coverImage ? 1 : 0) ? 'active' : ''}`}
                      onClick={() => handleTocClick(i + (coverImage ? 1 : 0))}
                    >
                      {item.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Reader;
