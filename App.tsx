
import React, { useState, useRef, useMemo } from 'react';
import { scanWebsite, matchProductByImage } from './services/geminiService';
import { Product, AppState, MatchResult, ScanStats } from './types';
import { ScannerOverlay } from './components/ScannerOverlay';
import { ProductCard } from './components/ProductCard';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [url, setUrl] = useState('');
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [scanStats, setScanStats] = useState<ScanStats | null>(null);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<{title: string, msg: string} | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url || isScanning) return;

    setError(null);
    setIsScanning(true);
    setAppState(AppState.SCANNING);
    
    try {
      const result = await scanWebsite(url);
      if (result.products.length === 0) {
        throw new Error("无法从该网站提取商品。可能是因为网站开启了反爬虫保护（如微店、淘宝等），建议尝试其他更开放的店面。");
      }
      setCatalog(result.products);
      setScanStats(result.stats);
      setAppState(AppState.CATALOG);
    } catch (err: any) {
      setError({
        title: "扫描失败",
        msg: err.message || "未知错误，请检查网络连接。"
      });
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
      setUploadedImage(base64String);
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
      setError({title: "分析失败", msg: "无法处理此图片，请尝试更清晰的照片。"});
    } finally {
      setIsSearching(false);
    }
  };

  const matchedProduct = catalog.find(p => p.id === matchResult?.productId);

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans">
      <nav className="glass sticky top-0 z-40 border-b border-gray-200 px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-600 text-white w-8 h-8 rounded-lg flex items-center justify-center">
            <i className="fas fa-search-plus"></i>
          </div>
          <span className="font-bold text-xl text-slate-800 tracking-tight">LensInventory</span>
        </div>
        {appState === AppState.CATALOG && (
          <button onClick={() => window.location.reload()} className="text-sm font-semibold text-indigo-600 hover:text-indigo-800">
            <i className="fas fa-redo-alt mr-1"></i> 重新开始
          </button>
        )}
      </nav>

      <main className="flex-grow max-w-5xl mx-auto w-full px-6 py-12">
        {appState === AppState.IDLE && (
          <div className="max-w-2xl mx-auto text-center space-y-8">
            <div className="space-y-4">
              <h1 className="text-5xl font-extrabold text-slate-900 leading-[1.1]">
                像用 <span className="text-indigo-600">Google Lens</span> 一样搜索任何店铺
              </h1>
              <p className="text-lg text-slate-500">
                输入网址扫描库存，上传照片即可找到店内同款商品。
              </p>
            </div>

            <form onSubmit={handleScan} className="relative group">
              <input 
                type="url" 
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="粘贴店铺网址 (例如: https://...)"
                className="w-full pl-6 pr-36 py-5 text-lg bg-white border-2 border-slate-200 rounded-2xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 transition-all outline-none shadow-sm group-hover:shadow-md"
              />
              <button 
                type="submit"
                className="absolute right-2 top-2 bottom-2 bg-indigo-600 text-white px-8 rounded-xl font-bold hover:bg-indigo-700 active:scale-95 transition-all"
              >
                开始扫描
              </button>
            </form>

            {error && (
              <div className="bg-red-50 border border-red-100 p-6 rounded-2xl text-left flex gap-4 animate-fade-in">
                <div className="text-red-500 text-xl"><i className="fas fa-exclamation-triangle"></i></div>
                <div>
                  <h4 className="font-bold text-red-800">{error.title}</h4>
                  <p className="text-red-600 text-sm mt-1">{error.msg}</p>
                  {error.msg.includes("API Key") && (
                    <a href="https://aistudio.google.com/" target="_blank" className="inline-block mt-3 text-xs font-bold text-indigo-600 hover:underline">
                      获取免费的 Gemini API Key →
                    </a>
                  )}
                </div>
              </div>
            )}

            <div className="pt-8 grid grid-cols-3 gap-4">
              <div className="p-4 bg-white rounded-xl border border-slate-100 text-center">
                <i className="fas fa-bolt text-amber-500 mb-2"></i>
                <p className="text-xs font-bold text-slate-400">极速扫描</p>
              </div>
              <div className="p-4 bg-white rounded-xl border border-slate-100 text-center">
                <i className="fas fa-robot text-indigo-500 mb-2"></i>
                <p className="text-xs font-bold text-slate-400">AI 视觉</p>
              </div>
              <div className="p-4 bg-white rounded-xl border border-slate-100 text-center">
                <i className="fas fa-check text-emerald-500 mb-2"></i>
                <p className="text-xs font-bold text-slate-400">免费使用</p>
              </div>
            </div>
          </div>
        )}

        {appState === AppState.CATALOG && (
          <div className="space-y-8 animate-fade-in">
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">库存浏览器</h2>
                <p className="text-slate-500">已成功从网站索引 {catalog.length} 件商品</p>
              </div>
              <div className="flex gap-4">
                <input type="file" id="visual-upload" className="hidden" accept="image/*" onChange={handleImageUpload} />
                <label 
                  htmlFor="visual-upload"
                  className="bg-indigo-600 text-white px-8 py-4 rounded-xl font-bold cursor-pointer hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-200"
                >
                  <i className="fas fa-camera"></i> 视觉匹配商品
                </label>
              </div>
            </div>

            {isSearching && (
              <div className="py-20 text-center">
                <div className="inline-block w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-slate-500 font-medium">正在分析图片并寻找匹配项...</p>
              </div>
            )}

            {!isSearching && matchedProduct && (
              <div className="bg-white rounded-3xl p-2 border border-indigo-200 shadow-2xl animate-fade-in">
                <div className="bg-indigo-50 p-3 rounded-2xl flex items-center justify-between px-6 mb-2">
                  <span className="font-bold text-indigo-600">匹配结果 ({(matchResult!.confidence * 100).toFixed(0)}%)</span>
                  <button onClick={() => setMatchResult(null)} className="text-slate-400 hover:text-slate-600 text-sm">清除结果</button>
                </div>
                <div className="flex flex-col md:flex-row">
                  <div className="md:w-1/3 aspect-square p-4">
                    <img src={matchedProduct.imageUrl} className="w-full h-full object-cover rounded-2xl" />
                  </div>
                  <div className="md:w-2/3 p-8 flex flex-col justify-center">
                    <h3 className="text-3xl font-bold mb-2">{matchedProduct.name}</h3>
                    <p className="text-indigo-600 font-black text-2xl mb-4">{matchedProduct.price}</p>
                    <p className="text-slate-500 mb-6">{matchResult?.reasoning || matchedProduct.description}</p>
                    <a href={matchedProduct.sourceUrl} target="_blank" className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold text-center inline-block">去原店购买</a>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {catalog.map(p => <ProductCard key={p.id} product={p} />)}
            </div>
          </div>
        )}
      </main>

      {appState === AppState.SCANNING && <ScannerOverlay />}
    </div>
  );
};

export default App;
