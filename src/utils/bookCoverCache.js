const COVER_CACHE_STORAGE_KEY = 'epub-reader:cover-cache';
const COVER_CACHE_VERSION = 1;
const COVER_CACHE_LIMIT = 60;

let hydrated = false;
let cacheMap = new Map();

function ensureHydrated() {
  if (hydrated) return;
  hydrated = true;

  try {
    const raw = localStorage.getItem(COVER_CACHE_STORAGE_KEY);
    if (!raw) return;

    const parsed = JSON.parse(raw);
    if (parsed?.version !== COVER_CACHE_VERSION || !Array.isArray(parsed.items)) {
      return;
    }

    cacheMap = new Map(
      parsed.items
        .filter((item) => item?.path)
        .map((item) => [item.path, item])
    );
  } catch (error) {
    console.warn('读取封面缓存失败:', error);
  }
}

function persistCache() {
  const sortedItems = Array.from(cacheMap.values())
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .slice(0, COVER_CACHE_LIMIT);

  for (let count = sortedItems.length; count >= 0; count--) {
    const items = sortedItems.slice(0, count);

    try {
      if (items.length === 0) {
        localStorage.removeItem(COVER_CACHE_STORAGE_KEY);
      } else {
        localStorage.setItem(
          COVER_CACHE_STORAGE_KEY,
          JSON.stringify({
            version: COVER_CACHE_VERSION,
            items,
          })
        );
      }
      cacheMap = new Map(items.map((item) => [item.path, item]));
      return;
    } catch (error) {
      if (count === 0) {
        console.warn('写入封面缓存失败，已清空缓存:', error);
      }
    }
  }
}

export function getCachedCover(path, fingerprint) {
  ensureHydrated();
  const item = cacheMap.get(path);
  if (!item) return null;
  if (fingerprint && item.fingerprint !== fingerprint) {
    cacheMap.delete(path);
    persistCache();
    return null;
  }
  return item;
}

export function setCachedCover(path, { fingerprint, metadata, coverUrl }) {
  ensureHydrated();
  cacheMap.set(path, {
    path,
    fingerprint,
    metadata,
    coverUrl: coverUrl || null,
    updatedAt: Date.now(),
  });
  persistCache();
}
