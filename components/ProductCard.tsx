
import React from 'react';
import { Product } from '../types';

interface ProductCardProps {
  product: Product;
  highlight?: boolean;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, highlight }) => {
  return (
    <div className={`group rounded-xl overflow-hidden bg-white border transition-all duration-300 ${highlight ? 'ring-4 ring-indigo-500 shadow-xl scale-105' : 'hover:shadow-lg'}`}>
      <div className="aspect-square relative overflow-hidden bg-gray-100">
        <img 
          src={product.imageUrl} 
          alt={product.name} 
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          onError={(e) => {
            (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${product.id}/400/400`;
          }}
        />
        <div className="absolute top-2 right-2 bg-black/70 text-white px-2 py-1 rounded text-xs font-bold">
          {product.price}
        </div>
        <div className="absolute bottom-2 left-2 bg-white/90 text-indigo-600 px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">
          {product.category}
        </div>
      </div>
      <div className="p-4">
        <h3 className="font-bold text-gray-900 line-clamp-1 mb-1">{product.name}</h3>
        <p className="text-xs text-gray-500 line-clamp-2 mb-3 h-8">{product.description}</p>
        <a 
          href={product.sourceUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
        >
          View Source <i className="fas fa-external-link-alt text-[10px]"></i>
        </a>
      </div>
    </div>
  );
};
