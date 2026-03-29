import JSZip from 'jszip';

/**
 * EPUB 解析器
 * EPUB 文件本质上是 ZIP 压缩包，包含：
 * - container.xml: 指向 content.opf 的位置
 * - content.opf: 书籍元数据和章节列表
 * - XHTML 文件：实际的章节内容
 */

class EPUBParser {
  async parse(arrayBuffer) {
    const zip = await JSZip.loadAsync(arrayBuffer);
    return this.parseFromZip(zip);
  }

  async parseFromZip(zip) {
    // 1. 读取 container.xml 找到 content.opf 的位置
    const containerXml = await zip.file('META-INF/container.xml').async('text');
    const containerDom = new DOMParser().parseFromString(containerXml, 'text/xml');
    const rootfilePath = containerDom
      .getElementsByTagName('rootfile')[0]
      .getAttribute('full-path');

    // 2. 读取 content.opf 获取书籍信息
    const opfContent = await zip.file(rootfilePath).async('text');
    const opfDom = new DOMParser().parseFromString(opfContent, 'text/xml');

    // 3. 解析书籍元数据
    const metadata = this.parseMetadata(opfDom, rootfilePath);

    // 4. 解析目录 (TOC)
    const toc = await this.parseToc(zip, opfDom, rootfilePath);

    // 5. 解析章节内容
    const spine = this.parseSpine(opfDom, toc, zip, rootfilePath);

    return {
      metadata,
      toc,
      spine,
    };
  }

  parseMetadata(opfDom, rootfilePath) {
    const metadataElem = opfDom.getElementsByTagName('metadata')[0];
    const metadata = {};

    // 提取各种元数据
    const title = this.getTextContent(metadataElem, 'dc:title');
    const creator = this.getTextContent(metadataElem, 'dc:creator');
    const publisher = this.getTextContent(metadataElem, 'dc:publisher');
    const language = this.getTextContent(metadataElem, 'dc:language');
    const date = this.getTextContent(metadataElem, 'dc:date');
    const identifier = this.getTextContent(metadataElem, 'dc:identifier');
    const description = this.getTextContent(metadataElem, 'dc:description');

    // 提取封面图片
    const manifest = opfDom.getElementsByTagName('manifest')[0];
    const coverHref = this.getCoverImage(opfDom, manifest, metadataElem);
    const coverPath = coverHref ? this.resolvePath(rootfilePath, coverHref) : null;

    return {
      title: title || '无标题',
      creator: creator || '未知作者',
      publisher: publisher || '',
      language: language || 'zh',
      date: date || '',
      identifier: identifier || '',
      description: description || '',
      coverHref,
      coverPath,
    };
  }

  getTextContent(parent, tagName) {
    const elems = parent.getElementsByTagName(tagName);
    return elems.length > 0 ? elems[0].textContent : '';
  }

  getCoverImage(opfDom, manifest, metadataElem) {
    // EPUB2: <meta name="cover" content="cover-image-id" />
    const metaElems = metadataElem.getElementsByTagName('meta');
    for (let i = 0; i < metaElems.length; i++) {
      const name = (metaElems[i].getAttribute('name') || '').toLowerCase();
      if (name === 'cover') {
        const coverId = metaElems[i].getAttribute('content');
        const item = coverId ? this.findItemById(opfDom, coverId) : null;
        if (item) return item.getAttribute('href');
      }
    }

    const items = manifest.getElementsByTagName('item');
    for (let item of items) {
      const properties = item.getAttribute('properties') || '';
      if (properties.includes('cover-image')) {
        return item.getAttribute('href');
      }
      // EPUB2 兜底：id 包含 cover 且媒体类型是图片
      const id = item.getAttribute('id');
      const mediaType = (item.getAttribute('media-type') || '').toLowerCase();
      if (id && id.toLowerCase().includes('cover') && mediaType.startsWith('image/')) {
        return item.getAttribute('href');
      }
    }
    return null;
  }

  async parseToc(zip, opfDom, rootfilePath) {
    const navMap = [];

    // 尝试解析 NCX 文件 (EPUB 2)
    const spine = opfDom.getElementsByTagName('spine')[0];
    const tocId = spine.getAttribute('toc');

    if (tocId) {
      const ncxFile = await this.findFileById(zip, opfDom, tocId, rootfilePath);
      if (ncxFile) {
        const ncxContent = await ncxFile.async('text');
        const ncxDom = new DOMParser().parseFromString(ncxContent, 'text/xml');
        return this.parseNcx(ncxDom, zip, rootfilePath);
      }
    }

    // 尝试解析 EPUB 3 的 nav 文件
    const manifest = opfDom.getElementsByTagName('manifest')[0];
    const items = manifest.getElementsByTagName('item');
    for (let item of items) {
      if (item.getAttribute('properties')?.includes('nav')) {
        const href = item.getAttribute('href');
        const navPath = this.resolvePath(rootfilePath, href);
        const navContent = await zip.file(navPath)?.async('text');
        if (navContent) {
          const navDom = new DOMParser().parseFromString(navContent, 'text/xml');
          return this.parseNav(navDom, zip, rootfilePath);
        }
      }
    }

    // 如果没有找到目录，从 spine 生成简单的目录
    return this.parseSpineAsToc(opfDom, zip, rootfilePath);
  }

  parseNcx(ncxDom, zip, rootfilePath) {
    const navMap = [];
    const navPoints = ncxDom.getElementsByTagName('navPoint');

    for (let i = 0; i < navPoints.length; i++) {
      const navPoint = navPoints[i];
      const labelElem = navPoint.getElementsByTagName('navLabel')[0];
      const text = labelElem?.getElementsByTagName('text')[0]?.textContent || '';
      const content = navPoint.getElementsByTagName('content')[0];
      const src = content?.getAttribute('src') || '';

      navMap.push({
        id: navPoint.getAttribute('id'),
        label: text,
        href: src,
        order: i,
      });
    }

    return navMap;
  }

  parseNav(navDom, zip, rootfilePath) {
    const navMap = [];
    const navLists = navDom.getElementsByTagName('nav');

    for (let nav of navLists) {
      const ol = nav.getElementsByTagName('ol')[0] || nav.getElementsByTagName('ul')[0];
      if (!ol) continue;

      const items = ol.getElementsByTagName('li');
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const a = item.getElementsByTagName('a')[0];
        if (a) {
          navMap.push({
            label: a.textContent.trim(),
            href: a.getAttribute('href'),
            order: i,
          });
        }
      }
    }

    return navMap;
  }

  parseSpineAsToc(opfDom, zip, rootfilePath) {
    const navMap = [];
    const spine = opfDom.getElementsByTagName('spine')[0];
    const itemrefs = spine.getElementsByTagName('itemref');

    for (let i = 0; i < itemrefs.length; i++) {
      const itemref = itemrefs[i];
      const idref = itemref.getAttribute('idref');
      const item = this.findItemById(opfDom, idref);
      if (item) {
        navMap.push({
          label: `第 ${i + 1} 章`,
          href: item.getAttribute('href'),
          order: i,
        });
      }
    }

    return navMap;
  }

  parseSpine(opfDom, toc, zip, rootfilePath) {
    const spine = opfDom.getElementsByTagName('spine')[0];
    const itemrefs = spine.getElementsByTagName('itemref');
    const chapters = [];

    for (let i = 0; i < itemrefs.length; i++) {
      const itemref = itemrefs[i];
      const idref = itemref.getAttribute('idref');
      const item = this.findItemById(opfDom, idref);

      if (item) {
        const href = item.getAttribute('href');
        const contentPath = this.resolvePath(rootfilePath, href);
        chapters.push({
          id: idref,
          index: i,
          href: href,
          contentPath,
        });
      }
    }

    return chapters;
  }

  findItemById(opfDom, id) {
    const manifest = opfDom.getElementsByTagName('manifest')[0];
    const items = manifest.getElementsByTagName('item');
    for (let item of items) {
      if (item.getAttribute('id') === id) {
        return item;
      }
    }
    return null;
  }

  async findFileById(zip, opfDom, id, rootfilePath) {
    const item = this.findItemById(opfDom, id);
    if (item) {
      const href = item.getAttribute('href');
      const path = this.resolvePath(rootfilePath, href);
      return zip.file(path);
    }
    return null;
  }

  resolvePath(basePath, relativePath) {
    const baseDir = basePath.substring(0, basePath.lastIndexOf('/') + 1);
    return this.normalizePath(baseDir + relativePath);
  }

  normalizePath(path) {
    const parts = path.split('/');
    const normalized = [];
    for (const part of parts) {
      if (!part || part === '.') continue;
      if (part === '..') {
        normalized.pop();
      } else {
        normalized.push(part);
      }
    }
    return normalized.join('/');
  }

  resolveRelativePath(baseFilePath, relativePath) {
    const cleanPath = (relativePath || '').split('#')[0];
    if (!cleanPath || cleanPath.startsWith('data:') || /^https?:\/\//i.test(cleanPath)) {
      return cleanPath;
    }
    const baseDir = baseFilePath.substring(0, baseFilePath.lastIndexOf('/') + 1);
    return this.normalizePath(baseDir + cleanPath);
  }

  getMimeType(filePath) {
    const ext = (filePath.split('.').pop() || '').toLowerCase();
    const mimeMap = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      svg: 'image/svg+xml',
      bmp: 'image/bmp',
      avif: 'image/avif',
    };
    return mimeMap[ext] || 'application/octet-stream';
  }

  async inlineImages(zip, body, basePath) {
    const images = body.getElementsByTagName('img');

    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      const src = img.getAttribute('src');
      const resolvedPath = this.resolveRelativePath(basePath, src);

      if (!resolvedPath || resolvedPath.startsWith('data:') || /^https?:\/\//i.test(resolvedPath)) {
        continue;
      }

      const imageFile = zip.file(resolvedPath);
      if (!imageFile) {
        // 尝试只用文件名查找
        const fileName = src.split('/').pop();
        const foundFile = Object.keys(zip.files).find(f => f.endsWith(fileName));
        if (foundFile) {
          const imgFile = zip.file(foundFile);
          try {
            const base64 = await imgFile.async('base64');
            img.setAttribute('src', `data:${this.getMimeType(foundFile)};base64,${base64}`);
          } catch (error) {
            console.warn('图片内联失败:', foundFile, error);
          }
        }
        continue;
      }

      try {
        const base64 = await imageFile.async('base64');
        img.setAttribute('src', `data:${this.getMimeType(resolvedPath)};base64,${base64}`);
      } catch (error) {
        console.warn('图片内联失败:', resolvedPath, error);
      }
    }
  }

  async getChapterContent(zip, chapter) {
    const file = zip.file(chapter.contentPath);
    if (!file) return '';

    const content = await file.async('text');

    // 解析 HTML 并提取 body 内容
    const doc = new DOMParser().parseFromString(content, 'text/html');
    const body = doc.getElementsByTagName('body')[0];

    if (body) {
      // 内联章节图片，避免阅读页出现裂图占位符
      await this.inlineImages(zip, body, chapter.contentPath);
      return body.innerHTML;
    }

    return content;
  }
}

export default EPUBParser;
