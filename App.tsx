
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
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [maxPriceFilter, setMaxPriceFilter] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    setError(null);
    setAppState(AppState.SCANNING);
    try {
      const result = await scanWebsite(url);
      if (result.products.length === 0) {
        throw new Error("No products could be identified on this website. Please try another URL.");
      }
      setCatalog(result.products);
      setScanStats(result.stats);
      setAppState(AppState.CATALOG);
      setSelectedCategory('All');
      setMaxPriceFilter(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred while scanning the website.");
      setAppState(AppState.IDLE);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError("Please upload a valid image file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Image file is too large. Please upload an image smaller than 5MB.");
      return;
    }

    setError(null);
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setUploadedImage(base64String);
      performMatch(base64String);
    };
    reader.onerror = () => {
      setError("Failed to read the uploaded image. Please try again.");
    };
    reader.readAsDataURL(file);
  };

  const performMatch = async (imageBase64: string) => {
    setIsSearching(true);
    setMatchResult(null);
    setError(null);
    
    const base64Data = imageBase64.split(',')[1];
    
    try {
      const result = await matchProductByImage(base64Data, catalog);
      if (!result || !result.productId) {
        setError("No clear match found in the current inventory. Try a clearer photo.");
      } else {
        setMatchResult(result);
      }
    } catch (err) {
      console.error("Match error:", err);
      setError("The AI encountered an issue while analyzing your image. Please try again in a few moments.");
    } finally {
      setIsSearching(false);
    }
  };

  const categories = useMemo(() => {
    const cats = new Set(catalog.map(p => p.category));
    return ['All', ...Array.from(cats)].sort();
  }, [catalog]);

  const maxAvailablePrice = useMemo(() => {
    return Math.max(...catalog.map(p => p.numericPrice), 0);
  }, [catalog]);

  const filteredCatalog = useMemo(() => {
    return catalog.filter(p => {
      const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
      const matchesPrice = maxPriceFilter === null || p.numericPrice <= maxPriceFilter;
      return matchesCategory && matchesPrice;
    });
  }, [catalog, selectedCategory, maxPriceFilter]);

  const matchedProduct = catalog.find(p => p.id === matchResult?.productId);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Navbar */}
      <nav className="glass sticky top-0 z-40 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 text-white p-2 rounded-lg">
              <i className="fas fa-eye"></i>
            </div>
            <span className="font-bold text-xl tracking-tight">LensInventory</span>
          </div>
          {appState === AppState.CATALOG && (
            <button 
              onClick={() => {
                setAppState(AppState.IDLE);
                setCatalog([]);
                setScanStats(null);
                setMatchResult(null);
                setUploadedImage(null);
                setError(null);
                setSelectedCategory('All');
                setMaxPriceFilter(null);
              }}
              className="text-sm font-medium text-gray-500 hover:text-indigo-600 transition-colors"
            >
              Reset Session
            </button>
          )}
        </div>
      </nav>

      <main className="flex-grow max-w-7xl mx-auto px-4 py-12 w-full">
        {/* Step 1: URL Entry */}
        {appState === AppState.IDLE && (
          <div className="max-w-2xl mx-auto text-center animate-fade-in">
            <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-6 leading-tight">
              Turn any website into an <span className="text-indigo-600">AI-searchable</span> inventory.
            </h1>
            <p className="text-xl text-gray-600 mb-10">
              Input a shop URL, scan its products, and use visual search to find what you're looking for instantly.
            </p>
            <form onSubmit={handleScan} className="relative group">
              <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                <i className="fas fa-link text-gray-400"></i>
              </div>
              <input 
                type="url" 
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://shop.example.com"
                className="block w-full pl-12 pr-32 py-5 text-lg border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 transition-all outline-none"
              />
              <button 
                type="submit"
                className="absolute right-2 top-2 bottom-2 bg-indigo-600 text-white px-8 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-md active:scale-95"
              >
                Scan Now
              </button>
            </form>
            {error && (
              <div className="mt-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-600 text-sm font-medium animate-bounce">
                <i className="fas fa-exclamation-triangle"></i>
                {error}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Catalog View & Search */}
        {appState === AppState.CATALOG && (
          <div className="space-y-8">
            {/* Statistics Dashboard */}
            {scanStats && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
                <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center text-xl">
                    <i className="fas fa-boxes"></i>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Total Products</p>
                    <p className="text-2xl font-black text-gray-900">{scanStats.totalCount}</p>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center text-xl">
                    <i className="fas fa-tags"></i>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Category</p>
                    <p className="text-2xl font-black text-gray-900 truncate">{scanStats.category}</p>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center text-xl">
                    <i className="fas fa-bolt"></i>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Scan Speed</p>
                    <p className="text-2xl font-black text-gray-900">{scanStats.scanDuration}</p>
                  </div>
                </div>
                <div className="bg-indigo-600 p-6 rounded-3xl shadow-lg flex items-center gap-4 text-white">
                  <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-xl">
                    <i className="fas fa-check-double"></i>
                  </div>
                  <div>
                    <p className="text-xs text-white/70 font-bold uppercase tracking-wider">Status</p>
                    <p className="text-2xl font-black">Indexed</p>
                  </div>
                </div>
              </div>
            )}

            {/* Header / Search bar */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
              <div className="w-full md:w-auto">
                <h2 className="text-2xl font-bold text-gray-900">Inventory Explorer</h2>
                <p className="text-gray-500 text-sm">Browsing items from {new URL(url).hostname}</p>
              </div>
              
              <div className="flex items-center gap-4 w-full md:w-auto">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*" 
                  onChange={handleImageUpload}
                />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSearching}
                  className={`flex-grow md:flex-grow-0 flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-4 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg active:scale-95 ${isSearching ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <i className="fas fa-camera"></i>
                  {isSearching ? 'Analyzing...' : 'Visual Search'}
                </button>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-3">
                  <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">Filter by Category</span>
                  <div className="flex flex-wrap gap-2">
                    {categories.map(cat => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                          selectedCategory === cat 
                            ? 'bg-indigo-600 text-white shadow-md' 
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 min-w-[250px]">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">Max Price</span>
                    <span className="text-indigo-600 font-bold">${maxPriceFilter === null ? maxAvailablePrice.toFixed(0) : maxPriceFilter}</span>
                  </div>
                  <input 
                    type="range"
                    min="0"
                    max={maxAvailablePrice}
                    step="1"
                    value={maxPriceFilter === null ? maxAvailablePrice : maxPriceFilter}
                    onChange={(e) => setMaxPriceFilter(Number(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                  <div className="flex justify-between text-[10px] text-gray-400 font-bold">
                    <span>$0</span>
                    <span>${maxAvailablePrice.toFixed(0)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
              <div className="lg:col-span-3">
                {isSearching ? (
                  <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-gray-300">
                    <div className="relative mb-6">
                      <div className="w-24 h-24 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                      <i className="fas fa-bolt absolute inset-0 flex items-center justify-center text-indigo-600 text-2xl animate-pulse"></i>
                    </div>
                    <h3 className="text-xl font-bold">Matching Image...</h3>
                    <p className="text-gray-500">Comparing visual signatures against {catalog.length} items</p>
                  </div>
                ) : matchedProduct ? (
                  <div className="space-y-8 animate-fade-in">
                    <div className="flex items-center gap-3 text-green-600 font-bold bg-green-50 w-fit px-4 py-2 rounded-full border border-green-100">
                      <i className="fas fa-check-circle"></i>
                      <span>Match Found! ({(matchResult!.confidence * 100).toFixed(0)}% Confidence)</span>
                    </div>
                    
                    <div className="bg-white rounded-3xl overflow-hidden border border-gray-200 shadow-xl flex flex-col md:flex-row">
                      <div className="md:w-1/2 aspect-square">
                        <img 
                          src={matchedProduct.imageUrl} 
                          alt={matchedProduct.name} 
                          className="w-full h-full object-cover"
                          onError={(e) => {(e.target as HTMLImageElement).src = `https://picsum.photos/seed/${matchedProduct.id}/800/800`}}
                        />
                      </div>
                      <div className="md:w-1/2 p-8 flex flex-col justify-center">
                        <span className="text-indigo-600 font-bold uppercase tracking-widest text-xs mb-2">{matchedProduct.category}</span>
                        <h2 className="text-3xl font-bold text-gray-900 mb-4">{matchedProduct.name}</h2>
                        <div className="text-2xl font-black text-indigo-600 mb-6">{matchedProduct.price}</div>
                        <p className="text-gray-600 mb-8 leading-relaxed">
                          {matchResult?.reasoning || matchedProduct.description}
                        </p>
                        <div className="flex flex-wrap gap-4">
                          <a 
                            href={matchedProduct.sourceUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="bg-gray-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-black transition-all text-center flex-grow"
                          >
                            Buy This Item
                          </a>
                          <button 
                            onClick={() => {
                              setMatchResult(null);
                              setUploadedImage(null);
                              setError(null);
                            }}
                            className="bg-gray-100 text-gray-600 px-8 py-3 rounded-xl font-bold hover:bg-gray-200 transition-all text-center"
                          >
                            Clear Results
                          </button>
                        </div>
                      </div>
                    </div>

                    <h3 className="text-xl font-bold pt-8">Filtered Results ({filteredCatalog.length} items)</h3>
                    {filteredCatalog.length > 0 ? (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                        {filteredCatalog.filter(p => p.id !== matchedProduct.id).map(product => (
                          <ProductCard key={product.id} product={product} />
                        ))}
                      </div>
                    ) : (
                      <div className="py-20 text-center bg-white rounded-3xl border border-dashed border-gray-200">
                        <p className="text-gray-400">No products match your current filters.</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-bold">Filtered Inventory ({filteredCatalog.length})</h3>
                      {(selectedCategory !== 'All' || maxPriceFilter !== null) && (
                        <button 
                          onClick={() => {setSelectedCategory('All'); setMaxPriceFilter(null);}}
                          className="text-xs font-bold text-indigo-600 hover:underline"
                        >
                          Reset Filters
                        </button>
                      )}
                    </div>
                    {filteredCatalog.length > 0 ? (
                      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
                        {filteredCatalog.map(product => (
                          <ProductCard key={product.id} product={product} />
                        ))}
                      </div>
                    ) : (
                      <div className="py-20 text-center bg-white rounded-3xl border border-dashed border-gray-200">
                        <i className="fas fa-filter text-3xl text-gray-200 mb-4"></i>
                        <p className="text-gray-400">No products match your current filters.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="lg:col-span-1">
                <div className="sticky top-24 space-y-6">
                  {/* Grounding Sources as required by guidelines */}
                  {scanStats?.sources && scanStats.sources.length > 0 && (
                    <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
                      <h3 className="font-bold mb-4 text-xs uppercase tracking-widest text-gray-400">Verified Sources</h3>
                      <ul className="space-y-3">
                        {scanStats.sources.map((source, idx) => (
                          <li key={idx}>
                            <a 
                              href={source.uri} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-xs text-indigo-600 hover:underline flex items-start gap-2"
                            >
                              <i className="fas fa-external-link-alt mt-0.5"></i>
                              <span className="line-clamp-2">{source.title || source.uri}</span>
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
                    <h3 className="font-bold mb-4">Search Context</h3>
                    {uploadedImage ? (
                      <div className="space-y-4">
                        <div className="aspect-square rounded-2xl overflow-hidden border bg-gray-50 relative group">
                          <img src={uploadedImage} alt="Uploaded" className="w-full h-full object-cover" />
                          {!isSearching && (
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <button 
                                onClick={() => fileInputRef.current?.click()}
                                className="bg-white text-gray-900 px-4 py-2 rounded-lg text-sm font-bold shadow-lg"
                              >
                                Change Photo
                              </button>
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 text-center italic">Uploaded search image</p>
                      </div>
                    ) : (
                      <div className="aspect-square rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center p-6 text-center text-gray-400">
                        <i className="fas fa-cloud-upload-alt text-4xl mb-3"></i>
                        <p className="text-sm">Upload a photo to see visual search results</p>
                      </div>
                    )}
                  </div>
                  <div className="bg-indigo-900 text-white p-6 rounded-3xl shadow-xl">
                    <h4 className="font-bold mb-2">How it works</h4>
                    <p className="text-sm text-indigo-100/70 leading-relaxed">
                      Our vision model compares your photo against the shapes, colors, and textures of the products we just indexed. Use the filters to narrow down the search space!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {appState === AppState.SCANNING && <ScannerOverlay />}

      <footer className="py-10 border-t border-gray-200 mt-20">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 text-gray-400">
            <i className="fas fa-eye"></i>
            <span className="font-semibold">LensInventory</span>
            <span className="text-xs">&copy; 2024</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
