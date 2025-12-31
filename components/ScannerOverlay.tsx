
import React, { useState, useEffect } from 'react';

const MESSAGES = [
  "Fetching website content...",
  "Analyzing visual layout...",
  "Identifying product entities...",
  "Calculating price statistics...",
  "Generating inventory index...",
  "Verifying via Google Search..."
];

export const ScannerOverlay: React.FC = () => {
  const [msgIdx, setMsgIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIdx((prev) => (prev + 1) % MESSAGES.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full text-center relative overflow-hidden">
        <div className="scan-line"></div>
        <div className="mb-6 inline-flex items-center justify-center w-20 h-20 rounded-full bg-indigo-100 text-indigo-600 text-4xl">
          <i className="fas fa-search animate-pulse"></i>
        </div>
        <h2 className="text-2xl font-bold mb-2">Analyzing Website...</h2>
        <p className="text-gray-600 mb-6 h-12 flex items-center justify-center transition-all duration-500">
          {MESSAGES[msgIdx]}
        </p>
        <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4">
          <div className="bg-indigo-600 h-2.5 rounded-full animate-pulse" style={{ width: '65%' }}></div>
        </div>
        <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Gemini Flash Analysis in Progress</p>
      </div>
    </div>
  );
};
