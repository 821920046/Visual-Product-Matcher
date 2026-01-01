
# 🔍 LensInventory: AI-Powered Visual Search Engine

[English](#english) | [中文](#chinese)

---

<a name="english"></a>
## 🚀 Overview
LensInventory is a next-generation visual search tool built on **Gemini 3 Pro/Flash**. It bridges the gap between web cataloging and visual recognition. Users can scan any e-commerce website to create a real-time searchable inventory and then use their camera or local files to find matching products instantly.

### ✨ Key Features
- **Intelligent Cataloging**: Automatically extracts product names, prices, categories, and images from any URL.
- **Multimodal Search**: Leverages Gemini's vision capabilities to match uploaded photos with indexed data.
- **Smart Filtering**: Dynamic filtering by price range and category inferred by AI.
- **Google Search Grounding**: Uses real-time search data to verify product availability and pricing.

### 🛠️ Tech Stack
- **AI Platform**: Google Gemini 3 (Flash Preview)
- **Frontend**: React 19 + TypeScript
- **Styling**: Tailwind CSS
- **Bundler**: Vite (Optimized for Cloudflare)

### ✅ What's New
- Removed context truncation in matching; supports full catalog context.
- Added localStorage persistence; catalog survives refresh and can be cleared via “重新开始”.
- Hardened JSON parsing; strips Markdown code fences and grounding citations.
- Added price range and category filters; numericPrice fallback parsing from price text.
- Introduced Cloudflare Workers proxy to hide API Key.
- Injected API_BASE via Vite; frontend calls proxy endpoints instead of Gemini directly.

---

<a name="chinese"></a>
## 🚀 项目简介
LensInventory 是一款基于 **Gemini 3** 系列模型构建的智能视觉搜索工具。它能将任何网页转化为可视觉搜索的数据库。

### ✨ 核心功能
- **智能索引**：自动从指定 URL 提取商品名称、价格、分类及图片。
- **多模态匹配**：利用 Gemini 的视觉识别能力，将用户上传的照片与库存数据进行毫秒级匹配。
- **动态过滤**：支持 AI 自动推断的分类过滤及价格区间筛选。
- **实时联网**：集成 Google Search Grounding，确保扫描数据的时效性。

---

## 📦 Deployment / 部署指南 (Cloudflare Workers + Pages)

### 1. Preparation / 准备
Upload the repository to GitHub. Ensure `package.json` and `vite.config.ts` are in the root directory.

### 2. Configuration / 配置（前端 Pages）
- **Framework Preset**: `Vite`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`

### 3. Environment Variables / 环境变量
- 前端（Cloudflare Pages）：`API_BASE`（例如 `/api` 或你的 Workers 地址 `https://<your>.workers.dev/api`）
- 后端（Cloudflare Workers Secrets）：`API_KEY`（Google AI Studio / Gemini）

详细部署说明见文档：
- [DEPLOYMENT_CLOUDFLARE.md](file:///c:/Users/qh686/Desktop/google%20code/Visual-Product-Matcher/DEPLOYMENT_CLOUDFLARE.md)

---

## ⚙️ Development / 开发环境
```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build
```

## ⚠️ Limitations / 注意事项
- **API Limits**: Subject to Gemini's free/paid tier quotas.
- **Website Access**: The scanning capability depends on the target website's accessibility to Google Search crawlers.
- **Data Persistence**: Catalog persists in localStorage. Use “重新开始”按钮清除本地缓存。
