const sharp = require('sharp');
const path = require('path');

// 黑白极简风格 - 纯黑背景 + 白色 BOOK 文字 + macOS 圆角
async function createIcon() {
  const size = 1024;
  const cornerRadius = 180; // macOS 风格的圆角半径

  // 创建 SVG - 带圆角蒙版本身
  const svg = `
    <svg width="${size}" height="${size}" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <!-- 圆角矩形裁剪路径 -->
        <clipPath id="roundedRect">
          <rect x="0" y="0" width="1024" height="1024" rx="${cornerRadius}" ry="${cornerRadius}"/>
        </clipPath>
      </defs>

      <!-- 纯黑背景（带圆角） -->
      <rect x="0" y="0" width="1024" height="1024" rx="${cornerRadius}" ry="${cornerRadius}" fill="#0a0a0a" clip-path="url(#roundedRect)"/>

      <!-- BOOK 文字 - 使用粗体无衬线字体，更有设计感 -->
      <text x="50%" y="55%" font-family="-apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif"
            font-size="280" font-weight="800" fill="#ffffff" text-anchor="middle" letter-spacing="-8" clip-path="url(#roundedRect)">BOOK</text>

      <!-- 白色外边框（可选，增加层次感） -->
      <rect x="2" y="2" width="1020" height="1020" rx="${cornerRadius - 2}" ry="${cornerRadius - 2}" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="2"/>
    </svg>
  `;

  // 生成主图标
  await sharp(Buffer.from(svg))
    .png()
    .toFile(path.join(__dirname, '../build/icon.png'));

  // 生成 macOS 需要的各种尺寸
  const macSizes = [16, 32, 64, 128, 256, 512, 1024];
  for (const s of macSizes) {
    await sharp(path.join(__dirname, '../build/icon.png'))
      .resize(s, s)
      .png()
      .toFile(path.join(__dirname, `../build/icon_${s}x${s}.png`));
  }

  // 生成 Windows 图标
  await sharp(path.join(__dirname, '../build/icon.png'))
    .resize(256, 256)
    .png()
    .toFile(path.join(__dirname, '../build/icon-win.png'));
}

createIcon().catch(console.error);
