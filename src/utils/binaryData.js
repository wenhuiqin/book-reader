function decodeBase64ToUint8Array(base64) {
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    return bytes;
  } catch (error) {
    return new Uint8Array();
  }
}

export function toUint8Array(content) {
  if (!content) return new Uint8Array();
  if (typeof content === 'string') {
    return decodeBase64ToUint8Array(content);
  }
  if (content instanceof ArrayBuffer) {
    return new Uint8Array(content);
  }
  if (ArrayBuffer.isView(content)) {
    return new Uint8Array(content.buffer, content.byteOffset, content.byteLength);
  }
  if (Array.isArray(content)) {
    return Uint8Array.from(content);
  }
  if (typeof content === 'object' && Array.isArray(content.data)) {
    return Uint8Array.from(content.data);
  }
  return new Uint8Array();
}

export function getFileFingerprint(file = {}) {
  const size = Number(file.size) || 0;
  const mtimeMs = Math.round(Number(file.mtimeMs) || 0);
  return `${size}:${mtimeMs}`;
}
