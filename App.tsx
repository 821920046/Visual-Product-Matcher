
import React, { useState, useEffect } from 'react';
import { scanWebsite, matchProductByImage } from './services/geminiService';
import { Product, AppState, MatchResult, ScanStats } from './types';
import { ScannerOverlay } from './components/ScannerOverlay';
import { ProductCard } from './components/ProductCard';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [url, setUrl] = useState('');
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<{title: string, msg: string, type?: string} | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [stats, setStats] = useState<ScanStats | null>(null);
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('全部');

  // 持久化：加载状态
  useEffect(() => {
    const saved = localStorage.getItem('lens_inventory_data');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.catalog && parsed.catalog.length > 0) {
          setCatalog(parsed.catalog);
          setUrl(parsed.url || '');
          // 仅当确实有数据时才恢复到 CATALOG 视图
          setAppState(AppState.CATALOG);
          if (parsed.stats) setStats(parsed.stats);
        }
      } catch (e) {
        console.error("Failed to load saved state:", e);
      }
    }
  }, []);

  // 持久化：保存状态
  useEffect(() => {
    if (appState === AppState.CATALOG && catalog.length > 0) {
      localStorage.setItem('lens_inventory_data', JSON.stringify({
        catalog,
        url,
        stats,
        timestamp: Date.now()
      }));
    }
  }, [catalog, url, stats, appState]);

  const handleReset = () => {
    if (confirm('确定要清除所有缓存数据并重新开始吗？')) {
      localStorage.removeItem('lens_inventory_data');
      window.location.reload();
    }
  };

  // 倒计时逻辑
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url || isScanning || cooldown > 0) return;

    setError(null);
    setIsScanning(true);
    setAppState(AppState.SCANNING);
    
    try {
      const result = await scanWebsite(url);
      if (result.products.length === 0) {
        throw new Error("提取不到商品。此店可能由于反爬虫无法直接读取，请尝试其他链接。");
      }
      setCatalog(result.products);
      setStats(result.stats);
      setAppState(AppState.CATALOG);
    } catch (err: any) {
      if (err.message === "QUOTA_EXCEEDED") {
        setCooldown(60); // 触发限制时强制等待一分钟
        setError({
          title: "触发 API 频率限制",
          msg: "免费版 API 每分钟调用有限。请等待倒计时结束再试。",
          type: "QUOTA"
        });
      } else if (err.message === "INVALID_KEY") {
        setError({
          title: "API Key 无效",
          msg: "请检查 Cloudflare 环境变量中的 API_KEY 是否正确。",
          type: "KEY"
        });
      } else {
        setError({
          title: "扫描出错",
          msg: err.message || "请求失败，请检查网址是否正确。"
        });
      }
      setAppState(AppState.IDLE);
    } finally {
      setIsScanning(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      performMatch(base64String);
    };
    reader.readAsDataURL(file);
  };

  const performMatch = async (imageBase64: string) => {
    setIsSearching(true);
    setMatchResult(null);
    try {
      const base64Data = imageBase64.split(',')[1];
      const result = await matchProductByImage(base64Data, catalog);
      setMatchResult(result);
    } catch (err) {
      setError({title: "分析失败", msg: "无法处理此图片。"});
    } finally {
      setIsSearching(false);
    }
  };

  const matchedProduct = catalog.find(p => p.id === matchResult?.productId);
  const categories = Array.from(new Set(catalog.map(p => p.category).filter(Boolean)));
  const filteredCatalog = catalog.filter(p => {
    const np = typeof p.numericPrice === 'number' ? p.numericPrice : NaN;
    const minOk = minPrice ? np >= Number(minPrice) : true;
    const maxOk = maxPrice ? np <= Number(maxPrice) : true;
    const catOk = selectedCategory && selectedCategory !== '全部' ? p.category === selectedCategory : true;
    return minOk && maxOk && catOk;
  });

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans">
      <nav className="glass sticky top-0 z-40 border-b border-gray-200 px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-600 text-white w-8 h-8 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-100">
            <i className="fas fa-search-plus"></i>
          </div>
          <span className="font-bold text-xl text-slate-800 tracking-tight">LensInventory</span>
        </div>
        {appState === AppState.CATALOG && (
          <button onClick={handleReset} className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition-colors">
            <i className="fas fa-redo-alt mr-1"></i> 重新开始
          </button>
        )}
      </nav>

      <main className="flex-grow max-w-5xl mx-auto w-full px-6 py-12">
        {appState === AppState.IDLE && (
          <div className="max-w-2xl mx-auto text-center space-y-10">
            <div className="space-y-4">
              <div className="inline-block px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-sm font-bold tracking-wide uppercase mb-2">
                Powered by Gemini Flash
              </div>
              <h1 className="text-5xl font-extrabold text-slate-900 leading-[1.1] tracking-tight">
                像用 <span className="text-indigo-600">Google Lens</span><br/>一样搜索任何店铺
              </h1>
              <p className="text-lg text-slate-500 max-w-lg mx-auto">
                粘贴网址，AI 自动扫描全店库存。上传照片，AI 秒找店内同款。
              </p>
            </div>

            <form onSubmit={handleScan} className="relative group">
              <input 
                type="url" 
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://shop123.v.weidian.com/..."
                className="w-full pl-6 pr-44 py-5 text-lg bg-white border-2 border-slate-200 rounded-2xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 transition-all outline-none shadow-sm group-hover:shadow-md"
              />
              <button 
                type="submit"
                disabled={cooldown > 0 || isScanning}
                className={`absolute right-2 top-2 bottom-2 px-8 rounded-xl font-bold transition-all flex items-center gap-2 ${
                  cooldown > 0 
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                  : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 shadow-lg shadow-indigo-100'
                }`}
              >
                {cooldown > 0 ? `请等待 ${cooldown}s` : '开始扫描'}
              </button>
            </form>

            {error && (
              <div className={`border p-6 rounded-2xl text-left flex gap-4 animate-fade-in ${
                error.type === 'QUOTA' ? 'bg-amber-50 border-amber-100' : 'bg-red-50 border-red-100'
              }`}>
                <div className={error.type === 'QUOTA' ? 'text-amber-500' : 'text-red-500'}>
                  <i className={`fas ${error.type === 'QUOTA' ? 'fa-clock' : 'fa-exclamation-circle'} text-xl`}></i>
                </div>
                <div>
                  <h4 className={`font-bold ${error.type === 'QUOTA' ? 'text-amber-800' : 'text-red-800'}`}>{error.title}</h4>
                  <p className={`${error.type === 'QUOTA' ? 'text-amber-600' : 'text-red-600'} text-sm mt-1 leading-relaxed`}>
                    {error.msg}
                  </p>
                </div>
              </div>
            )}

            <div className="pt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-5 bg-white rounded-2xl border border-slate-100 text-left shadow-sm">
                <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center text-amber-500 mb-4">
                  <i className="fas fa-bolt"></i>
                </div>
                <h5 className="font-bold text-slate-800 mb-1">即时提取</h5>
                <p className="text-xs text-slate-400">无需爬虫代码，输入 URL 即可将网页转为商品库。</p>
              </div>
              <div className="p-5 bg-white rounded-2xl border border-slate-100 text-left shadow-sm">
                <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-500 mb-4">
                  <i className="fas fa-eye"></i>
                </div>
                <h5 className="font-bold text-slate-800 mb-1">视觉理解</h5>
                <p className="text-xs text-slate-400">基于多模态大模型，通过图片特征而非关键词搜索。</p>
              </div>
              <div className="p-5 bg-white rounded-2xl border border-slate-100 text-left shadow-sm">
                <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-500 mb-4">
                  <i className="fas fa-infinity"></i>
                </div>
                <h5 className="font-bold text-slate-800 mb-1">免费额度</h5>
                <p className="text-xs text-slate-400">使用官方免费接口，无需绑卡，适合轻量使用。</p>
              </div>
            </div>
          </div>
        )}

        {appState === AppState.CATALOG && (
          <div className="space-y-8 animate-fade-in">
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">库存目录</h2>
                <p className="text-slate-500 flex items-center gap-2">
                  <i className="fas fa-check-circle text-emerald-500"></i> 已索引 {catalog.length} 件商品
                </p>
                {stats && (
                  <div className="text-slate-400 text-sm mt-1">
                    类别 {stats.category} · 用时 {stats.scanDuration}
                  </div>
                )}
                {stats?.sources && stats.sources.length > 0 && (
                  <div className="mt-2 text-xs text-slate-400">
                    来源：
                    {stats.sources.slice(0, 3).map((s, i) => (
                      <a key={i} href={s.uri} target="_blank" className="ml-2 text-indigo-600 hover:underline">{s.title}</a>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-4 flex-wrap items-center">
                <input type="file" id="visual-upload" className="hidden" accept="image/*" onChange={handleImageUpload} />
                <label 
                  htmlFor="visual-upload"
                  className="bg-indigo-600 text-white px-8 py-4 rounded-xl font-bold cursor-pointer hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-100 active:scale-95"
                >
                  <i className="fas fa-camera"></i> 视觉匹配搜索
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    placeholder="最低价"
                    className="w-24 px-3 py-2 border border-slate-200 rounded-xl text-sm"
                  />
                  <span className="text-slate-400 text-sm">-</span>
                  <input
                    type="number"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    placeholder="最高价"
                    className="w-24 px-3 py-2 border border-slate-200 rounded-xl text-sm"
                  />
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white"
                  >
                    <option value="全部">全部</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <button
                    onClick={() => { setMinPrice(''); setMaxPrice(''); setSelectedCategory('全部'); }}
                    className="text-sm text-slate-600 hover:text-slate-800"
                  >
                    清除筛选
                  </button>
                </div>
              </div>
            </div>

            {isSearching && (
              <div className="py-16 text-center animate-pulse">
                <div className="inline-block w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-slate-500 font-medium">AI 正在根据图片进行匹配...</p>
              </div>
            )}

            {!isSearching && matchedProduct && (
              <div className="bg-white rounded-3xl p-2 border-2 border-indigo-200 shadow-2xl animate-fade-in overflow-hidden">
                <div className="bg-indigo-600 p-3 rounded-2xl flex items-center justify-between px-6 mb-2">
                  <span className="font-bold text-white text-sm">
                    ✨ 最优匹配 ({(matchResult!.confidence * 100).toFixed(0)}%)
                  </span>
                  <button onClick={() => setMatchResult(null)} className="text-indigo-100 hover:text-white transition-colors">
                    <i className="fas fa-times"></i>
                  </button>
                </div>
                <div className="flex flex-col md:flex-row">
                  <div className="md:w-2/5 aspect-square p-4">
                    <img src={matchedProduct.imageUrl} className="w-full h-full object-cover rounded-2xl shadow-inner border border-slate-100" alt="matched" />
                  </div>
                  <div className="md:w-3/5 p-8 flex flex-col justify-center">
                    <h3 className="text-3xl font-bold text-slate-900 mb-2 leading-tight">{matchedProduct.name}</h3>
                    <div className="text-indigo-600 font-black text-3xl mb-4">{matchedProduct.price}</div>
                    <div className="bg-slate-50 p-4 rounded-xl mb-6">
                      <p className="text-slate-600 italic text-sm">"{matchResult?.reasoning}"</p>
                    </div>
                    <a href={matchedProduct.sourceUrl} target="_blank" className="bg-slate-900 text-white px-8 py-4 rounded-xl font-bold text-center inline-block hover:bg-slate-800 transition-all shadow-lg">
                      前往购买 <i className="fas fa-chevron-right ml-1 text-xs"></i>
                    </a>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {filteredCatalog.map(p => <ProductCard key={p.id} product={p} highlight={p.id === matchResult?.productId} />)}
            </div>
          </div>
        )}
      </main>

      {appState === AppState.SCANNING && <ScannerOverlay />}
    </div>
  );
};

export default App;
