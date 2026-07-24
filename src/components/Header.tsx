/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Asset, CategoryAllocation } from '../types';
import { Landmark, TrendingUp, DollarSign, Wallet, ShieldCheck } from 'lucide-react';

interface HeaderProps {
  assets: Asset[];
  allocations: CategoryAllocation[];
  usdToBrlRate: number;
}

export default function Header({ assets, allocations, usdToBrlRate }: HeaderProps) {
  // Helper to safely get the current BRL value of an asset
  const getBrlValue = (asset: Asset): number => {
    if (asset.currentValue !== undefined && asset.currentValue !== null) {
      return asset.currentValue;
    }
    const nativeVal = asset.invested_amount || 0;
    return asset.currency === 'USD' ? nativeVal * usdToBrlRate : nativeVal;
  };

  const currentTotalEquity = assets.reduce((sum, item) => sum + getBrlValue(item), 0);
  const totalAssetsCount = assets.length;
  const quarantinedCount = assets.filter(a => a.is_quarantined).length;
  const activeCount = totalAssetsCount - quarantinedCount;

  return (
    <header className="bg-zinc-950 border-b border-zinc-900 py-6 px-4 sm:px-6 md:px-8">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        
        {/* Title */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600/10 border border-indigo-500/20 p-1.5 rounded-lg">
              <Landmark className="w-6 h-6 text-indigo-400" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-100 tracking-tight font-sans">
              Motor de Rebalanceamento Preditivo
            </h1>
          </div>
          <p className="text-xs text-zinc-400 font-sans max-w-xl">
            Uma ferramenta completa para estratégia <strong className="text-zinc-300">"Buy & Hold"</strong> focada em dividendos e acúmulo de patrimônio. Insira seu aporte e o algoritmo calculará a distribuição ideal para manter sua carteira em equilíbrio.
          </p>
        </div>

        {/* Top-Level Quick Statistics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 md:gap-6">
          
          {/* Portfolio Equity */}
          <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-3 px-4 min-w-[140px]">
            <div className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider mb-1 flex items-center gap-1">
              <Wallet className="w-3.5 h-3.5 text-zinc-500" />
              Patrimônio Total (BRL)
            </div>
            <div className="text-base sm:text-lg font-bold text-zinc-200 font-mono">
              R$ {currentTotalEquity.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          {/* Active Assets Count */}
          <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-3 px-4 min-w-[140px]">
            <div className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider mb-1 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-zinc-500" />
              Inventário de Ativos
            </div>
            <div className="text-base sm:text-lg font-bold text-zinc-200 font-mono">
              {activeCount} <span className="text-xs text-zinc-500 font-normal">ativos</span>
              {quarantinedCount > 0 && (
                <span className="text-xs text-amber-500 font-normal ml-1">({quarantinedCount} em quarentena)</span>
              )}
            </div>
          </div>

          {/* Exchange rate quick read */}
          <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-3 px-4 min-w-[140px] col-span-2 sm:col-span-1">
            <div className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider mb-1 flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5 text-zinc-500" />
              Cotação do Dólar
            </div>
            <div className="text-base sm:text-lg font-bold text-indigo-400 font-mono">
              R$ {usdToBrlRate.toFixed(2)}
            </div>
          </div>

        </div>

      </div>
    </header>
  );
}
