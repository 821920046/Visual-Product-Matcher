
import React from 'react';

export const ScannerOverlay: React.FC = () => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full text-center relative overflow-hidden">
        <div className="scan-line"></div>
        <div className="mb-6 inline-flex items-center justify-center w-20 h-20 rounded-full bg-indigo-100 text-indigo-600 text-4xl">
          <i className="fas fa-search animate-pulse"></i>
        </div>
        <h2 className="text-2xl font-bold mb-2">Analyzing Website...</h2>
        <p className="text-gray-600 mb-6">
          Our AI is scanning the URL to build your inventory and calculate product statistics.
        </p>
        <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4">
          <div className="bg-indigo-600 h-2.5 rounded-full animate-[progress_3s_ease-in-out_infinite]" style={{ width: '45%' }}></div>
        </div>
        <p className="text-xs text-gray-400 uppercase tracking-widest">Compiling Statistics</p>
      </div>
    </div>
  );
};
