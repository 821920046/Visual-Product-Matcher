# LensInventory 部署指南（Cloudflare Workers + Cloudflare Pages）

本指南介绍如何在 Cloudflare 平台上部署 LensInventory：使用 Cloudflare Workers 作为后端代理隐藏 API Key，使用 Cloudflare Pages 部署前端站点。

## 概览
- 架构
  - 后端：Cloudflare Workers 代理到 Google Gemini，隐藏 `API_KEY`
  - 前端：Cloudflare Pages 承载构建后的 Vite 应用
  - 路由：将 Workers 掛载到你的域名的 `/api/*`，使前端通过同域名访问后端
- 代码位置
  - Workers 代理：[worker.ts](file:///c:/Users/qh686/Desktop/google%20code/Visual-Product-Matcher/cf-worker/src/worker.ts)
  - Workers 配置：[wrangler.toml](file:///c:/Users/qh686/Desktop/google%20code/Visual-Product-Matcher/cf-worker/wrangler.toml)
  - 前端 API 基址注入：[vite.config.ts](file:///c:/Users/qh686/Desktop/google%20code/Visual-Product-Matcher/vite.config.ts#L13-L15)
  - 前端服务调用（已改为调用代理）：[geminiService.ts](file:///c:/Users/qh686/Desktop/google%20code/Visual-Product-Matcher/services/geminiService.ts)

## 前置要求
- Cloudflare 账号
- Node.js 18+
- Wrangler CLI：`npm i -g wrangler`
- Google AI Studio（Gemini）API Key

## 一、部署 Cloudflare Workers（后端代理）

### Quick Start（最快路径）
```bash
# 进入 Workers 目录
cd cf-worker

# 登录 Cloudflare
wrangler login

# 设置 Gemini API Key（Secret）
wrangler secret put API_KEY

# 部署
wrangler deploy
```
部署完成后复制你的 `workers.dev` 地址（例如 `https://lensinventory-proxy.<name>.workers.dev`），在前端 Pages 的环境变量里将 `API_BASE` 设置为 `<workers.dev>/api`。

### 无命令行：Cloudflare 控制台部署 Workers
如果不熟悉命令行，可以直接通过 Cloudflare 网页控制台部署：
1) 登录 Cloudflare 仪表盘，左侧进入 “Workers & Pages”
2) 点击 “Create Application” → 选择 “Create Worker”
3) 命名你的 Worker（例如 `lensinventory-proxy`），创建后进入 “Quick Edit”
4) 将代理代码复制到编辑器（参考：[worker.ts](file:///c:/Users/qh686/Desktop/google%20code/Visual-Product-Matcher/cf-worker/src/worker.ts)）
5) 点击 “Save and deploy”
6) 在 Worker 的 “Settings” → “Variables” → “Add variable”
   - 类型选择 “Secret”
   - 名称填 `API_KEY`，值填你的 Google AI Studio API Key
7) 在 Worker 的 “Triggers” → “Routes”
   - 添加路由：`你的域名/api/*`
   - 保存后生效（此时前端可使用 `API_BASE=/api` 同域访问）
8) 若暂时不绑定域名，也可以使用 `workers.dev` 地址；复制该地址并在前端环境变量设置 `API_BASE=<workers.dev>/api`

1) 进入目录  
```bash
cd cf-worker
```

2) 登录 Cloudflare  
```bash
wrangler login
```

3) 配置密钥  
```bash
wrangler secret put API_KEY
# 按提示输入你的 Google AI Studio API Key
```

4) 部署  
```bash
wrangler deploy
```

部署完成后会获得一个 `workers.dev` 的 URL，例如：  
```
https://lensinventory-proxy.<yourname>.workers.dev
```

### Workers 端点说明
- `POST /api/scan`
  - 请求体：`{ "targetUrl": "https://example.com" }`
  - 返回体：`{ products: Product[], stats: { totalCount, category, scanDuration, sources } }`
- `POST /api/match`
  - 请求体：`{ "imageBase64": "<JPEG base64>", "list": "ID:... Name:..." }`
  - 返回体：`{ "productId": string, "confidence": number, "reasoning": string }`

Workers 已处理 CORS 并对 JSON 文本做清洗，避免 ` ```json ` 与 `[1]` 这类内容导致解析失败。  
参考实现：  
- [worker.ts](file:///c:/Users/qh686/Desktop/google%20code/Visual-Product-Matcher/cf-worker/src/worker.ts)
- [wrangler.toml](file:///c:/Users/qh686/Desktop/google%20code/Visual-Product-Matcher/cf-worker/wrangler.toml)

### 验证 Workers
```bash
# 验证 scan
curl -X POST "<WORKERS_URL>/api/scan" \
  -H "Content-Type: application/json" \
  -d '{"targetUrl":"https://shop123.v.weidian.com/"}'

# 验证 match（示例，需替换 imageBase64 与 list）
curl -X POST "<WORKERS_URL>/api/match" \
  -H "Content-Type: application/json" \
  -d '{"imageBase64":"<base64>","list":"ID:p-1 Name:xxx"}'
```

## 二、部署 Cloudflare Pages（前端）

1) 上传仓库到 GitHub 或直接在 Pages 中连接本地仓库  

2) 创建 Pages 项目  
- Framework Preset：`Vite`
- Build Command：`npm run build`
- Output Directory：`dist`

3) 设置环境变量  
- `API_BASE`：后端 API 基址
  - 若使用 `workers.dev` 域名：例如 `https://lensinventory-proxy.<yourname>.workers.dev/api`
  - 若后续通过 Routes 挂载到同域：则可设为 `/api`

### 无命令行：Cloudflare 控制台部署 Pages
1) 在 Cloudflare 仪表盘进入 “Workers & Pages” → 选择 “Pages” → “Create project”
2) 选择 “Connect to Git” 并关联你的仓库
3) 在构建设置中：
   - Framework Preset：选择 `Vite`
   - Build command：`npm run build`
   - Output directory：`dist`
4) 在 Pages 项目的 “Settings” → “Environment variables” 添加：
   - `API_BASE`：如果已将 Worker 绑定到你的域名的 `/api/*`，设置为 `/api`
   - 如果使用 `workers.dev`，则设置为 `https://<yourname>.workers.dev/api`
5) 点击 “Save” 并触发部署（或推送代码自动触发）
6) 部署完成后访问你的 Pages 域名验证页面功能

前端在构建时会将 `process.env.API_BASE` 注入到代码中：  
- 参考： [vite.config.ts](file:///c:/Users/qh686/Desktop/google%20code/Visual-Product-Matcher/vite.config.ts#L13-L15)
- 前端调用代理的实现： [geminiService.ts](file:///c:/Users/qh686/Desktop/google%20code/Visual-Product-Matcher/services/geminiService.ts)

## 三、将 Workers 挂载到你的域名（推荐）

目的：让前端与后端同域，从而使用 `API_BASE=/api`，避免跨域与混合内容问题。

1) 在 Cloudflare 仪表盘中，进入你的域名的 `Workers Routes`  
2) 添加路由：  
- Route：`example.com/api/*`（替换为你的 Pages 绑定域名）
- Worker：选择刚部署的 `lensinventory-proxy`
3) 保存后即时生效。此时：
- 前端 `API_BASE` 设置为 `/api`
- 所有对 `/api/scan`、`/api/match` 的请求均由 Workers 处理

### 将 Workers 绑定到 Pages 项目（可选）
- 在 Pages 项目设置里选择 “Functions/Workers” 关联你的 Worker（若界面支持）
- 或使用 “Routes” 指向 Pages 的自定义域名

## 四、常见问题与排查

- 429 频率限制  
  - 出现高频调用时，后端可能返回 429。前端已包含冷却倒计时与错误提示。
- API Key 未配置  
  - Workers 返回 500 并提示 `API key not configured`。请通过 `wrangler secret put API_KEY` 设置。
- CORS 问题  
  - Workers 已返回 `Access-Control-Allow-Origin: *`。若你自定义策略，请确保允许前端域名。
- JSON 解析失败  
  - Workers 与前端均做了文本清洗；若仍报错，建议重试或确认目标站点内容规范。

## 五、环境变量一览
- Cloudflare Workers（Secrets）
  - `API_KEY`：Google AI Studio 的 API Key
- Cloudflare Pages（Environment Variables）
  - `API_BASE`：后端代理地址（`/api` 或完整 `https://.../api`）

## 六、Cloudflare Pages Functions 替代方案（可选）
如果希望后端逻辑跟随 Pages 项目一起部署，可使用 Pages Functions。在 Pages 仓库中添加 `functions/` 目录，提供最小端点实现。

```
functions/
  api/
    scan.ts
    match.ts
```

示例 `functions/api/scan.ts`：
```ts
export const onRequest: PagesFunction = async (context) => {
  const API_KEY = context.env.API_KEY;
  if (!API_KEY) return new Response("API key not configured", { status: 500 });
  const { targetUrl } = await context.request.json();
  if (!targetUrl) return new Response("Missing targetUrl", { status: 400 });

  const MODEL = "gemini-3-flash-preview";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;
  const payload = {
    contents: [{
      role: "user",
      parts: [{ text: `You are an expert shop scanner.\n1) Scan: ${targetUrl}\n2) Return JSON products + siteCategory.` }]
    }],
    generationConfig: { responseMimeType: "application/json" },
    tools: [{ googleSearch: {} }]
  };
  const upstream = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const resp = await upstream.json();
  const text = String(resp?.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text || resp?.text || "");
  const clean = text.replace(/```json\s*|\s*```/g, "").replace(/\[\d+\]/g, "");
  const data = JSON.parse(clean);
  const products = (data.products || []).map((p: any, idx: number) => ({
    ...p,
    id: p.id || `p-${idx}-${Date.now()}`,
    sourceUrl: targetUrl,
    numericPrice: typeof p.numericPrice === "number" ? p.numericPrice : Number(String(p.price || "").replace(/[^\d.]/g, "")) || NaN,
  }));
  return new Response(JSON.stringify({ products, stats: { totalCount: products.length, category: data.siteCategory || "Shop", scanDuration: "" } }), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
};
```

部署 Pages Functions：
- 将 `API_KEY` 设置为 Pages 项目的环境变量
- 构建与部署 Pages 后，端点将位于你的域名，例如：`https://<your-domain>/api/scan`
- 前端 `API_BASE` 可设置为 `/api`

## 七、更新与回滚
- 更新 Workers：在 `cf-worker` 目录开发后执行 `wrangler deploy`
- 前端更新：推送代码或在 Pages 中触发重新构建
- 如需回滚：Cloudflare 控制台支持回滚到历史部署版本

## 参考文件
- 代理端点逻辑：[worker.ts](file:///c:/Users/qh686/Desktop/google%20code/Visual-Product-Matcher/cf-worker/src/worker.ts)
- Workers 配置：[wrangler.toml](file:///c:/Users/qh686/Desktop/google%20code/Visual-Product-Matcher/cf-worker/wrangler.toml)
- 前端 API 注入：[vite.config.ts](file:///c:/Users/qh686/Desktop/google%20code/Visual-Product-Matcher/vite.config.ts)
- 前端服务调用：[geminiService.ts](file:///c:/Users/qh686/Desktop/google%20code/Visual-Product-Matcher/services/geminiService.ts)

