#!/bin/bash
set -e

echo "================================"
echo "构建所有平台版本"
echo "================================"
echo ""

# 1. 构建前端资源
echo "Step 1: 构建前端资源..."
npm run build

# 2. 复制 electron 文件
echo "Step 2: 复制 electron 主进程文件..."
cp -r electron build/

# 3. 准备图标
echo "Step 3: 准备图标文件..."
if [ ! -f "build/icon.icns" ]; then
  echo "图标不存在，运行生成脚本..."
  node scripts/generate-icon.js
fi

# 4. 构建 macOS ARM64 (Apple Silicon)
echo ""
echo "Step 4a: 构建 macOS Apple Silicon (M1/M2/M3)..."
npx electron-builder --mac --arm64

# 5. 构建 macOS x64 (Intel)
echo ""
echo "Step 4b: 构建 macOS Intel..."
npx electron-builder --mac --x64

# 6. 构建 Windows
echo ""
echo "Step 5: 构建 Windows x64..."
npx electron-builder --win --x64

echo ""
echo "================================"
echo "构建完成！"
echo "================================"
echo ""
echo "输出目录：dist/"
ls -lh dist/
