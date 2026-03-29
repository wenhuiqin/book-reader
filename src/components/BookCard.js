import React, { useState, useEffect, useRef } from 'react';
import JSZip from 'jszip';
import { getBookBaseName, getBookFormat } from '../utils/bookFormat';

const metadataCache = new Map();

function BookCard({ book, onClick }) {
  const [metadata, setMetadata] = useState(null);
  const [coverUrl, setCoverUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [shouldLoad, setShouldLoad] = useState(false);
  const cardRef = useRef(null);

  const cacheKey = book.path;
  const format = getBookFormat(book.path);

  const pickFallbackCoverPath = async (zip, epubData, parser) => {
    const allFiles = Object.keys(zip.files || {});
    const imagePattern = /\.(jpg|jpeg|png|webp|gif)$/i;
    const coverNamePattern = /(cover|fengmian|front|thumbnail|thumb)/i;

    // 兜底1：按文件名猜测封面
    const guessed = allFiles.find((filePath) => imagePattern.test(filePath) && coverNamePattern.test(filePath));
    if (guessed) return guessed;

    // 兜底2：从首章提取第一张图片
    const firstChapter = epubData?.spine?.[0];
    if (!firstChapter) return null;
    const chapterFile = zip.file(firstChapter.contentPath);
    if (!chapterFile) return null;

    const chapterText = await chapterFile.async('text');
    const doc = new DOMParser().parseFromString(chapterText, 'text/html');
    const firstImg = doc.querySelector('img[src]');
    if (!firstImg) return null;

    return parser.resolveRelativePath(firstChapter.contentPath, firstImg.getAttribute('src'));
  };

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: '240px' }
    );

    observer.observe(card);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!shouldLoad) return;
    loadBookMetadata();
  }, [book.path, shouldLoad]);

  const loadBookMetadata = async () => {
    try {
      const cached = metadataCache.get(cacheKey);
      if (cached) {
        setMetadata(cached.metadata);
        setCoverUrl(cached.coverUrl || null);
        setLoading(false);
        return;
      }

      setLoading(true);

      if (format === 'pdf') {
        const fallbackMetadata = {
          title: getBookBaseName(book.name),
          creator: 'PDF 文档',
        };
        setMetadata(fallbackMetadata);
        metadataCache.set(cacheKey, { metadata: fallbackMetadata, coverUrl: null });
        setLoading(false);
        return;
      }

      // 检查是否在 Electron 环境中
      if (!window.electronAPI) {
        console.warn('不在 Electron 环境中，无法读取 EPUB 文件');
        setLoading(false);
        return;
      }

      const result = await window.electronAPI.readEpubFile(book.path);
      if (result.error) {
        console.error('读取文件失败:', result.error);
        setLoading(false);
        return;
      }

      const binaryString = atob(result.content);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const zip = await JSZip.loadAsync(bytes);
      const EPUBParser = (await import('../utils/EPUBParser')).default;
      const parser = new EPUBParser();
      const epubData = await parser.parseFromZip(zip);

      setMetadata(epubData.metadata);

      // 加载封面（优先元数据，失败则自动兜底）
      let coverFilePath = epubData.metadata.coverPath || epubData.metadata.coverHref;
      let coverFile = coverFilePath ? zip.file(coverFilePath) : null;
      if (!coverFile) {
        const fallbackPath = await pickFallbackCoverPath(zip, epubData, parser);
        coverFile = fallbackPath ? zip.file(fallbackPath) : null;
      }
      if (coverFile) {
        const coverBlob = await coverFile.async('blob');
        const nextCoverUrl = URL.createObjectURL(coverBlob);
        setCoverUrl((prev) => {
          if (prev) {
            URL.revokeObjectURL(prev);
          }
          return nextCoverUrl;
        });
        metadataCache.set(cacheKey, {
          metadata: epubData.metadata,
          coverUrl: nextCoverUrl,
        });
      } else {
        metadataCache.set(cacheKey, {
          metadata: epubData.metadata,
          coverUrl: null,
        });
      }
      setLoading(false);
    } catch (error) {
      console.error('解析 EPUB 失败:', error);
      setLoading(false);
    }
  };

  return (
    <div className="book-card" onClick={onClick} ref={cardRef}>
      <div className="book-card-glow" aria-hidden="true" />
      <div className="book-cover">
        {loading ? (
          <div className="loading">
            <div className="spinner" style={{ width: 20, height: 20 }}></div>
          </div>
        ) : coverUrl ? (
          <img src={coverUrl} alt={metadata?.title || book.name} />
        ) : (
          <div className="book-cover-placeholder">📖</div>
        )}
      </div>
      <div className="book-info">
        <div className="book-title" title={metadata?.title || book.name}>
          {metadata?.title || book.name}
        </div>
        <div className="book-author">{metadata?.creator || '未知作者'}</div>
      </div>
    </div>
  );
}

export default BookCard;
