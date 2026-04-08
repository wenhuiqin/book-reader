import React, { useState, useEffect, useRef } from 'react';
import EPUBParser from '../utils/EPUBParser';
import PDFReader from './PDFReader';
import TXTReader from './TXTReader';
import { getBookFormat } from '../utils/bookFormat';
import { toUint8Array } from '../utils/binaryData';

const AUTO_SCROLL_MIN_SPEED = 0.1;
const AUTO_SCROLL_MAX_SPEED = 3;
const AUTO_SCROLL_STEP = 0.1;

function clampAutoScrollSpeed(speed) {
  const numericSpeed = Number(speed);
  if (!Number.isFinite(numericSpeed)) return 1;
  return Math.min(
    AUTO_SCROLL_MAX_SPEED,
    Math.max(AUTO_SCROLL_MIN_SPEED, Number(numericSpeed.toFixed(1)))
  );
}

function EPUBReader({ book, onClose, savedProgress, onProgressChange }) {
  // 核心状态
  const [epubData, setEpubData] = useState(null);
  const [zip, setZip] = useState(null);
  const [parser, setParser] = useState(null);
  const [currentChapter, setCurrentChapter] = useState(0);
  const [chapterContent, setChapterContent] = useState('');
  const [coverImage, setCoverImage] = useState(null);
  const [coverResolved, setCoverResolved] = useState(false);
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
  const autoScrollCarryRef = useRef(0);
  const hasRestoredProgress = useRef(false);
  const hasRestoredChapter = useRef(false);
  const scrollRestoreTimerRef = useRef(null);
  const chapterLoadTokenRef = useRef(0);
  const shouldPersistOnChapterLoadRef = useRef(false);
  const isRestoringProgressRef = useRef(false);
  const dragSessionRef = useRef(null);
  const persistTimerRef = useRef(null);
  const lastPersistedProgressRef = useRef(null);
  const boundsFrameRef = useRef(null);
  const pendingBoundsRef = useRef(null);

  const hasCoverPage = false; // 不再额外添加封面页，EPUB 通常自带封面
  const maxReaderChapter = epubData ? epubData.spine.length : 0;
  const toReaderChapterIndex = (spineIndex) => spineIndex;
  const toSpineChapterIndex = (readerIndex) => readerIndex;

  const persistProgress = (force = false) => {
    const el = contentRef.current;
    if (!epubData || !onProgressChange || !el || isRestoringProgressRef.current) return;

    const scrollTop = el.scrollTop;
    const scrollHeight = el.scrollHeight;
    const clientHeight = el.clientHeight;
    const scrollPercent = scrollHeight > clientHeight
      ? Math.round((scrollTop / (scrollHeight - clientHeight)) * 100)
      : 0;

    const nextProgress = {
      currentChapter: Math.max(0, toSpineChapterIndex(currentChapter)),
      fontSize,
      theme,
      autoScrollSpeed,
      scrollTop,
      scrollPercent
    };

    const lastProgress = lastPersistedProgressRef.current;
    const isSameProgress = lastProgress &&
      lastProgress.currentChapter === nextProgress.currentChapter &&
      lastProgress.fontSize === nextProgress.fontSize &&
      lastProgress.theme === nextProgress.theme &&
      lastProgress.autoScrollSpeed === nextProgress.autoScrollSpeed &&
      lastProgress.scrollPercent === nextProgress.scrollPercent &&
      Math.abs(lastProgress.scrollTop - nextProgress.scrollTop) < 12;

    if (!force && isSameProgress) return;

    lastPersistedProgressRef.current = nextProgress;
    onProgressChange(book.path, nextProgress);
  };

  const schedulePersistProgress = (delay = 220, force = false) => {
    if (persistTimerRef.current) {
      window.clearTimeout(persistTimerRef.current);
    }
    persistTimerRef.current = window.setTimeout(() => {
      persistTimerRef.current = null;
      persistProgress(force);
    }, delay);
  };

  const commitWindowBounds = (bounds) => {
    pendingBoundsRef.current = bounds;
    if (boundsFrameRef.current || !window.electronAPI?.setCurrentWindowBounds) return;
    boundsFrameRef.current = window.requestAnimationFrame(() => {
      boundsFrameRef.current = null;
      if (!pendingBoundsRef.current) return;
      window.electronAPI.setCurrentWindowBounds(pendingBoundsRef.current);
      pendingBoundsRef.current = null;
    });
  };

  // 初始化：加载书籍和恢复进度
  useEffect(() => {
    hasRestoredProgress.current = false;
    hasRestoredChapter.current = false;
    shouldPersistOnChapterLoadRef.current = false;
    isRestoringProgressRef.current = false;
    dragSessionRef.current = null;
    lastPersistedProgressRef.current = null;
    autoScrollCarryRef.current = 0;
    setCoverImage(null);
    setCoverResolved(false);
    setCurrentChapter(0);
    setChapterContent('');
    setLoading(true);
    loadBook();
    return () => {
      if (scrollRestoreTimerRef.current) {
        window.clearTimeout(scrollRestoreTimerRef.current);
      }
      if (persistTimerRef.current) {
        window.clearTimeout(persistTimerRef.current);
      }
      if (boundsFrameRef.current) {
        window.cancelAnimationFrame(boundsFrameRef.current);
      }
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
      setAutoScrollSpeed(clampAutoScrollSpeed(savedProgress.autoScrollSpeed));
    }
  }, [savedProgress]);

  // 解析完成后，恢复上次阅读的章节（如果没有进度则从第 0 章开始）
  useEffect(() => {
    if (!epubData || !coverResolved || hasRestoredChapter.current) return;
    hasRestoredChapter.current = true;
    shouldPersistOnChapterLoadRef.current = true;

    // 如果有封面且第一章节不是封面页，尝试找到封面章节
    let initialChapter = savedProgress?.currentChapter ?? 0;
    if (coverImage && epubData.spine.length > 0) {
      // 查找包含封面的章节（通过 href 匹配）
      const coverChapterIndex = epubData.spine.findIndex(ch => {
        const coverPath = epubData.metadata.coverPath || epubData.metadata.coverHref;
        if (!coverPath) return false;
        const chapterPath = ch.href?.split('#')[0] || ch.contentPath;
        const normalizedCover = coverPath.split('/').pop();
        const normalizedChapter = chapterPath?.split('/').pop();
        return normalizedCover && normalizedCover === normalizedChapter;
      });

      // 如果找到封面章节且它不是第一章，说明 spine 顺序可能有误
      // 但 EPUB 的 spine 通常是正确的阅读顺序，所以我们不强制跳到封面章
      // 只是确保封面图片能在需要时显示
    }

    setCurrentChapter(Math.min(initialChapter, epubData.spine.length - 1));
  }, [epubData, coverResolved]);

  // 加载章节内容
  useEffect(() => {
    if (epubData && coverResolved && currentChapter >= 0 && currentChapter <= epubData.spine.length) {
      loadChapter(currentChapter);
    }
  }, [currentChapter, epubData, coverResolved, coverImage]);

  // 自动保存进度（包括滚动位置）
  useEffect(() => {
    if (!epubData || !onProgressChange || !contentRef.current) return;

    const handleScroll = () => {
      schedulePersistProgress(autoScroll ? 120 : 240);
    };

    const el = contentRef.current;
    el.addEventListener('scroll', handleScroll);

    return () => {
      schedulePersistProgress(0, true);
      el.removeEventListener('scroll', handleScroll);
    };
  }, [book.path, currentChapter, fontSize, theme, autoScrollSpeed, epubData, onProgressChange, coverImage]);

  useEffect(() => {
    if (!chapterContent || !shouldPersistOnChapterLoadRef.current) return undefined;

    const timerId = window.setTimeout(() => {
      if (!isRestoringProgressRef.current) {
        persistProgress(true);
        shouldPersistOnChapterLoadRef.current = false;
      }
    }, 80);

    return () => window.clearTimeout(timerId);
  }, [chapterContent, currentChapter, fontSize, theme, autoScrollSpeed]);

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

    autoScrollCarryRef.current = 0;

    const tick = () => {
      const el = contentRef.current;
      if (!el) return;

      const maxTop = el.scrollHeight - el.clientHeight;
      if (maxTop <= 0) return;

      if (el.scrollTop >= maxTop - 2) {
        if (epubData && currentChapter < maxReaderChapter) {
          autoScrollCarryRef.current = 0;
          setCurrentChapter((prev) => prev + 1);
          return;
        }
        autoScrollCarryRef.current = 0;
        setAutoScroll(false);
        return;
      }

      autoScrollCarryRef.current += autoScrollSpeed;
      const scrollDelta = Math.floor(autoScrollCarryRef.current);

      if (scrollDelta > 0) {
        el.scrollTop = Math.min(maxTop, el.scrollTop + scrollDelta);
        autoScrollCarryRef.current -= scrollDelta;
      }

      autoScrollRef.current = window.requestAnimationFrame(tick);
    };

    autoScrollRef.current = window.requestAnimationFrame(tick);
    return () => {
      autoScrollCarryRef.current = 0;
      if (autoScrollRef.current) {
        window.cancelAnimationFrame(autoScrollRef.current);
        autoScrollRef.current = null;
      }
    };
  }, [autoScroll, autoScrollSpeed, currentChapter, epubData, loading, maxReaderChapter]);

  useEffect(() => {
    const handleMouseMove = (event) => {
      const session = dragSessionRef.current;
      if (!session || !window.electronAPI?.setCurrentWindowBounds) return;

      const deltaX = event.screenX - session.startScreenX;
      const deltaY = event.screenY - session.startScreenY;

      if (session.type === 'move') {
        commitWindowBounds({
          x: session.startBounds.x + deltaX,
          y: session.startBounds.y + deltaY,
        });
        return;
      }

      const nextBounds = { ...session.startBounds };
      if (session.type.includes('e')) nextBounds.width = session.startBounds.width + deltaX;
      if (session.type.includes('s')) nextBounds.height = session.startBounds.height + deltaY;
      if (session.type.includes('w')) {
        nextBounds.x = session.startBounds.x + deltaX;
        nextBounds.width = session.startBounds.width - deltaX;
      }
      if (session.type.includes('n')) {
        nextBounds.y = session.startBounds.y + deltaY;
        nextBounds.height = session.startBounds.height - deltaY;
      }

      const minWidth = 390;
      const minHeight = 740;
      if (nextBounds.width < minWidth) {
        if (session.type.includes('w')) nextBounds.x -= minWidth - nextBounds.width;
        nextBounds.width = minWidth;
      }
      if (nextBounds.height < minHeight) {
        if (session.type.includes('n')) nextBounds.y -= minHeight - nextBounds.height;
        nextBounds.height = minHeight;
      }

      commitWindowBounds(nextBounds);
    };

    const handleMouseUp = () => {
      dragSessionRef.current = null;
      if (pendingBoundsRef.current) {
        commitWindowBounds(pendingBoundsRef.current);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

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
        setCurrentChapter(toReaderChapterIndex(targetChapter));
      }
    };

    contentRef.current.addEventListener('click', handleClick);
    return () => contentRef.current?.removeEventListener('click', handleClick);
  }, [epubData, zip, hasCoverPage]);

  const loadBook = async () => {
    try {
      const result = await window.electronAPI.readEpubFile(book.path);
      if (result.error) {
        alert('读取文件失败：' + result.error);
        onClose();
        return;
      }

      const bytes = toUint8Array(result.content);
      if (!bytes.length) {
        alert('EPUB 数据格式错误');
        onClose();
        return;
      }

      const JSZip = (await import('jszip')).default;
      const loadedZip = await JSZip.loadAsync(bytes);
      setZip(loadedZip);

      const newParser = new EPUBParser();
      const data = await newParser.parseFromZip(loadedZip);
      setEpubData(data);
      setParser(newParser);

      // 加载封面 - 使用与 BookCard 相同的逻辑
      let coverFilePath = data.metadata.coverPath;
      let coverFile = coverFilePath ? loadedZip.file(coverFilePath) : null;

      if (!coverFile && data.metadata.coverHref) {
        // 尝试用 coverHref 直接查找（可能是相对路径）
        coverFile = loadedZip.file(data.metadata.coverHref);
      }

      if (!coverFile) {
        // 兜底：按文件名查找封面图片
        const allFiles = Object.keys(loadedZip.files || {});
        const imagePattern = /\.(jpg|jpeg|png|webp|gif)$/i;
        const coverNamePattern = /(cover|fengmian|front|thumbnail|thumb)/i;

        // 优先找文件名包含 cover 的图片
        const guessed = allFiles.find((filePath) =>
          imagePattern.test(filePath) && coverNamePattern.test(filePath)
        );
        if (guessed) {
          coverFile = loadedZip.file(guessed);
        } else {
          // 再兜底：找第一张图片
          const firstImage = allFiles.find((filePath) => imagePattern.test(filePath));
          if (firstImage) {
            coverFile = loadedZip.file(firstImage);
          }
        }
      }

      if (coverFile) {
        try {
          const coverBlob = await coverFile.async('blob');
          const coverUrl = URL.createObjectURL(coverBlob);
          setCoverImage(coverUrl);
        } catch (e) {
          console.error('[EPUB] 封面加载失败:', e);
        }
      }

      setCoverResolved(true);
      setLoading(false);
    } catch (error) {
      console.error('加载 EPUB 失败:', error);
      const message = error?.code === 'EPUB_DRM_UNSUPPORTED'
        ? error.message
        : '无法打开 EPUB 文件';
      alert(message);
      onClose();
    }
  };

  const loadChapter = async (index) => {
    if (!zip || !epubData || !parser) return;
    const loadToken = ++chapterLoadTokenRef.current;
    shouldPersistOnChapterLoadRef.current = true;

    // 加载章节内容
    const chapter = epubData.spine[index];

    if (!chapter) {
      console.warn('章节不存在:', index);
      return;
    }

    const content = await parser.getChapterContent(zip, chapter);

    // 如果是第一章节且没有图片，但我们有封面图，显示封面
    let finalContent = content || '';
    if (index === 0 && coverImage && (!content || !content.includes('<img'))) {
      finalContent = `<div style="text-align:center;padding:20px;"><img src="${coverImage}" alt="封面" style="max-width:100%;height:auto;border-radius:8px;" /></div>`;
    }

    if (loadToken !== chapterLoadTokenRef.current) return;
    setChapterContent(finalContent);

    // 恢复滚动位置（延迟执行，等待 DOM 渲染）
    if (scrollRestoreTimerRef.current) {
      window.clearTimeout(scrollRestoreTimerRef.current);
    }

    if (contentRef.current && savedProgress) {
      isRestoringProgressRef.current = true;
      scrollRestoreTimerRef.current = window.setTimeout(() => {
        const el = contentRef.current;
        const savedChapter = savedProgress.currentChapter || 0;
        if (el && savedChapter === index) {
          const maxScrollTop = Math.max(0, el.scrollHeight - el.clientHeight);
          const nextScrollTop = typeof savedProgress.scrollPercent === 'number'
            ? Math.round(maxScrollTop * savedProgress.scrollPercent / 100)
            : Math.max(0, savedProgress.scrollTop || 0);
          el.scrollTop = Math.min(maxScrollTop, nextScrollTop);
        } else if (el) {
          el.scrollTop = 0;
        }
        isRestoringProgressRef.current = false;
        persistProgress(true);
        shouldPersistOnChapterLoadRef.current = false;
      }, 50);
    } else if (contentRef.current) {
      contentRef.current.scrollTop = 0;
      isRestoringProgressRef.current = false;
    }
  };

  const handlePrevChapter = () => {
    if (currentChapter > 0) {
      persistProgress(true);
      setCurrentChapter(currentChapter - 1);
    }
  };

  const handleNextChapter = () => {
    if (currentChapter < maxReaderChapter) {
      persistProgress(true);
      setCurrentChapter(currentChapter + 1);
    }
  };

  const handleTocClick = (index) => {
    shouldPersistOnChapterLoadRef.current = true;
    persistProgress(true);
    setCurrentChapter(index);
    setShowToc(false);
  };

  const startWindowInteraction = async (type, event) => {
    if (!window.electronAPI?.getCurrentWindowBounds) return;
    event.preventDefault();
    event.stopPropagation();
    const startBounds = await window.electronAPI.getCurrentWindowBounds();
    if (!startBounds) return;
    dragSessionRef.current = {
      type,
      startBounds,
      startScreenX: event.screenX,
      startScreenY: event.screenY,
    };
  };

  const handleCloseReader = () => {
    persistProgress(true);
    onClose();
  };

  const isDarkTheme = theme === 'dark';

  if (loading) {
    return (
      <div className={`reader-wrapper ${isDarkTheme ? 'dark-theme' : ''}`}>
        <div className="phone-frame">
          <div className="shell-drag-zone shell-drag-top" />
          <div className="shell-drag-zone shell-drag-left" />
          <div className="shell-drag-zone shell-drag-right" />
          <div className="shell-drag-zone shell-drag-bottom" />
          <div className="shell-resize-handle shell-resize-nw" onMouseDown={(event) => startWindowInteraction('nw', event)} />
          <div className="shell-resize-handle shell-resize-ne" onMouseDown={(event) => startWindowInteraction('ne', event)} />
          <div className="shell-resize-handle shell-resize-sw" onMouseDown={(event) => startWindowInteraction('sw', event)} />
          <div className="shell-resize-handle shell-resize-se" onMouseDown={(event) => startWindowInteraction('se', event)} />
          <div className="phone-notch"></div>
          <div className="phone-display">
            <div className="loading"><div className="spinner"></div></div>
          </div>
        </div>
      </div>
    );
  }

  if (!epubData) return null;

  const progress = Math.min(100, Math.round(((currentChapter + 1) / epubData.spine.length) * 100));
  const displayChapter = `${currentChapter + 1}/${epubData.spine.length}`;

  return (
    <div className={`reader-wrapper ${isDarkTheme ? 'dark-theme' : ''}`}>
      <div className="phone-frame">
        <div className="shell-drag-zone shell-drag-top" />
        <div className="shell-drag-zone shell-drag-left" />
        <div className="shell-drag-zone shell-drag-right" />
        <div className="shell-drag-zone shell-drag-bottom" />
        <div className="shell-resize-handle shell-resize-nw" onMouseDown={(event) => startWindowInteraction('nw', event)} />
        <div className="shell-resize-handle shell-resize-ne" onMouseDown={(event) => startWindowInteraction('ne', event)} />
        <div className="shell-resize-handle shell-resize-sw" onMouseDown={(event) => startWindowInteraction('sw', event)} />
        <div className="shell-resize-handle shell-resize-se" onMouseDown={(event) => startWindowInteraction('se', event)} />
        {/* 顶部可拖拽区域 */}
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
          {/* 顶部导航 */}
          <div className="reader-top-bar" style={{ WebkitAppRegion: 'no-drag' }}>
            <button className="icon-btn" onClick={() => setShowToc(true)}>☰</button>
            <span className="book-title-mini">{epubData.metadata.title}</span>
            <div className="top-bar-actions">
              <button className="icon-btn" onClick={() => setTheme(isDarkTheme ? 'light' : 'dark')}>
                {isDarkTheme ? '☀' : '☾'}
              </button>
              <button className="icon-btn" onClick={() => setShowSettings(!showSettings)}>⚙</button>
              <button className="icon-btn close-btn" onClick={handleCloseReader}>✕</button>
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
            <button className="nav-btn" onClick={handleNextChapter} disabled={currentChapter >= maxReaderChapter}>›</button>
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
                    <button
                      className="font-btn"
                      onClick={() => setAutoScrollSpeed((s) => clampAutoScrollSpeed(s - AUTO_SCROLL_STEP))}
                    >
                      -
                    </button>
                    <span className="font-value">{autoScrollSpeed.toFixed(1)}</span>
                    <button
                      className="font-btn"
                      onClick={() => setAutoScrollSpeed((s) => clampAutoScrollSpeed(s + AUTO_SCROLL_STEP))}
                    >
                      +
                    </button>
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
                  {epubData.toc.map((item, i) => (
                    <div
                      key={i}
                      className={`toc-item ${currentChapter === i ? 'active' : ''}`}
                      onClick={() => handleTocClick(i)}
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

function Reader(props) {
  const format = getBookFormat(props.book?.path);
  if (format === 'pdf') {
    return <PDFReader {...props} />;
  }
  if (format === 'txt') {
    return <TXTReader {...props} />;
  }
  return <EPUBReader {...props} />;
}

export default Reader;
