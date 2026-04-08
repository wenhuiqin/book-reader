import React, { useState, useEffect, useRef } from 'react';
import JSZip from 'jszip';
import { getBookBaseName, getBookFormat } from '../utils/bookFormat';
import { getFileFingerprint, toUint8Array } from '../utils/binaryData';
import { getCachedCover, setCachedCover } from '../utils/bookCoverCache';
import * as pdfjsLib from 'pdfjs-dist';

// PDF worker 配置
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

const metadataCache = new Map();
const THUMB_MAX_WIDTH = 240;
const THUMB_MAX_HEIGHT = 320;
const THUMB_QUALITY = 0.82;

function getThumbnailSize(width, height) {
  const scale = Math.min(1, THUMB_MAX_WIDTH / width, THUMB_MAX_HEIGHT / height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

async function renderPdfCover(bytes) {
  let pdf = null;

  try {
    pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1 });
    const thumbSize = getThumbnailSize(viewport.width, viewport.height);
    const scale = thumbSize.width / viewport.width;
    const scaledViewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    canvas.width = scaledViewport.width;
    canvas.height = scaledViewport.height;

    await page.render({
      canvasContext: context,
      viewport: scaledViewport,
    }).promise;

    return canvas.toDataURL('image/jpeg', THUMB_QUALITY);
  } catch (error) {
    console.error('渲染 PDF 封面失败:', error);
    return null;
  } finally {
    if (pdf) {
      pdf.destroy().catch(() => {});
    }
  }
}

function blobToThumbnailDataUrl(blob) {
  return new Promise((resolve) => {
    if (!blob) {
      resolve(null);
      return;
    }

    const objectUrl = URL.createObjectURL(blob);
    const image = new Image();

    image.onload = () => {
      const thumbSize = getThumbnailSize(image.naturalWidth || image.width, image.naturalHeight || image.height);
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');

      canvas.width = thumbSize.width;
      canvas.height = thumbSize.height;
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL('image/jpeg', THUMB_QUALITY));
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(null);
    };

    image.src = objectUrl;
  });
}

function BookCard({ book, onClick, onDelete }) {
  const [metadata, setMetadata] = useState(null);
  const [coverUrl, setCoverUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [shouldLoad, setShouldLoad] = useState(false);
  const cardRef = useRef(null);
  const loadTokenRef = useRef(0);

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

  const resolveFileMetadata = async () => {
    if (Number.isFinite(Number(book.size)) && Number.isFinite(Number(book.mtimeMs))) {
      return {
        path: book.path,
        name: book.name,
        size: Number(book.size),
        mtimeMs: Number(book.mtimeMs),
      };
    }

    if (!window.electronAPI?.getFileMetadata) return null;

    const result = await window.electronAPI.getFileMetadata(book.path);
    return result?.error ? null : result;
  };

  const applyCacheEntry = (entry) => {
    setMetadata(entry.metadata || null);
    setCoverUrl(entry.coverUrl || null);
    setLoading(false);
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
    const loadToken = loadTokenRef.current + 1;
    loadTokenRef.current = loadToken;
    loadBookMetadata(loadToken);
  }, [book.path, shouldLoad]);

  const loadBookMetadata = async (loadToken) => {
    let fingerprint = getFileFingerprint(book);

    try {
      const fileMetadata = await resolveFileMetadata();
      fingerprint = getFileFingerprint(fileMetadata || book);
      const cached = metadataCache.get(cacheKey);
      if (cached?.fingerprint === fingerprint) {
        applyCacheEntry(cached);
        return;
      }

      const persisted = getCachedCover(cacheKey, fingerprint);
      if (persisted) {
        metadataCache.set(cacheKey, persisted);
        applyCacheEntry(persisted);
        return;
      }

      setLoading(true);

      if (format === 'pdf') {
        const fallbackMetadata = {
          title: getBookBaseName(book.name),
          creator: 'PDF 文档',
        };
        const result = await window.electronAPI.readFile(book.path);
        if (result.error) {
          console.error('读取文件失败:', result.error);
          setLoading(false);
          return;
        }

        const bytes = toUint8Array(result.content);
        const coverUrl = bytes.length > 0 ? await renderPdfCover(bytes) : null;
        if (loadToken !== loadTokenRef.current) return;

        const entry = { fingerprint, metadata: fallbackMetadata, coverUrl };
        metadataCache.set(cacheKey, entry);
        setCachedCover(cacheKey, entry);
        applyCacheEntry(entry);
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

      const bytes = toUint8Array(result.content);

      const zip = await JSZip.loadAsync(bytes);
      const EPUBParser = (await import('../utils/EPUBParser')).default;
      const parser = new EPUBParser();
      const epubData = await parser.parseFromZip(zip);

      // 加载封面（优先元数据，失败则自动兜底）
      let coverFilePath = epubData.metadata.coverPath || epubData.metadata.coverHref;
      let coverFile = coverFilePath ? zip.file(coverFilePath) : null;
      if (!coverFile) {
        const fallbackPath = await pickFallbackCoverPath(zip, epubData, parser);
        coverFile = fallbackPath ? zip.file(fallbackPath) : null;
      }

      let nextCoverUrl = null;
      if (coverFile) {
        const coverBlob = await coverFile.async('blob');
        nextCoverUrl = await blobToThumbnailDataUrl(coverBlob);
      }

      if (loadToken !== loadTokenRef.current) return;

      const entry = {
        fingerprint,
        metadata: epubData.metadata,
        coverUrl: nextCoverUrl,
      };
      metadataCache.set(cacheKey, entry);
      setCachedCover(cacheKey, entry);
      applyCacheEntry(entry);
    } catch (error) {
      if (error?.code === 'EPUB_DRM_UNSUPPORTED') {
        const entry = {
          fingerprint,
          metadata: {
            title: getBookBaseName(book.name),
            creator: '受保护 EPUB',
          },
          coverUrl: null,
        };
        metadataCache.set(cacheKey, entry);
        setCachedCover(cacheKey, entry);
        applyCacheEntry(entry);
      } else {
        console.error('解析 EPUB 失败:', error);
        setLoading(false);
      }
    }
  };

  return (
    <div className="book-card" onClick={onClick} ref={cardRef}>
      <div className="book-card-glow" aria-hidden="true" />
      {onDelete && (
        <button className="book-delete-btn" onClick={(e) => { e.stopPropagation(); onDelete(); }} title="删除书籍">×</button>
      )}
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
