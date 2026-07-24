/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Asset, Currency } from '../types';
import { ShieldCheck, ShieldAlert, Plus, Trash2, Folder, DollarSign, Sparkles, TrendingUp, TrendingDown, Star, AlertCircle, ChevronUp, ChevronDown } from 'lucide-react';

interface AssetListProps {
  assets: Asset[];
  onToggleQuarantine: (id: string) => void;
  onUpdateScore: (id: string, score: number) => void;
  onAddAsset: (asset: Omit<Asset, 'id'>) => void;
  onDeleteAsset: (id: string) => void;
  categories: string[];
  usdToBrlRate: number;
  isLoadingQuotes: boolean;
}

export default function AssetList({
  assets,
  onToggleQuarantine,
  onUpdateScore,
  onAddAsset,
  onDeleteAsset,
  categories,
  usdToBrlRate,
  isLoadingQuotes,
}: AssetListProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [ticker, setTicker] = useState('');
  const [category, setCategory] = useState(categories[0] || '');
  const [quantity, setQuantity] = useState<number | ''>('');
  const [currency, setCurrency] = useState<Currency>('BRL');
  const [investedAmount, setInvestedAmount] = useState<number | ''>('');
  const [score, setScore] = useState<number>(10);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<string>('ticker');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  const toggleCategory = (catName: string) => {
    setCollapsedCategories(prev => ({
      ...prev,
      [catName]: !prev[catName]
    }));
  };

  // Helper to calculate total value of all assets (in BRL)
  const calculateAssetBrlValues = (item: Asset) => {
    const livePrice = item.livePrice;
    const qty = item.quantity || 0;
    
    // Live current value or fallback to invested amount
    const valNative = livePrice !== undefined && livePrice !== null && livePrice > 0
      ? qty * livePrice
      : item.invested_amount || 0;

    const valBrl = item.currency === 'USD' ? valNative * usdToBrlRate : valNative;
    const costBrl = item.currency === 'USD' ? (item.invested_amount || 0) * usdToBrlRate : (item.invested_amount || 0);

    const variation = costBrl > 0 ? ((valBrl / costBrl) - 1) * 100 : 0;

    return {
      currentValBrl: valBrl,
      costBrl,
      variation,
      livePriceNative: livePrice,
    };
  };

  const getSortValue = (item: Asset, field: string) => {
    const { currentValBrl, costBrl, variation, livePriceNative } = calculateAssetBrlValues(item);
    switch (field) {
      case 'ticker':
        return item.ticker.toUpperCase();
      case 'quantity':
        return item.quantity || 0;
      case 'invested_amount':
        return costBrl || 0;
      case 'livePrice':
        return livePriceNative !== undefined && livePriceNative !== null ? (item.currency === 'USD' ? livePriceNative * usdToBrlRate : livePriceNative) : -Infinity;
      case 'currentValBrl':
        return currentValBrl || 0;
      case 'variation':
        return livePriceNative !== undefined && livePriceNative !== null ? variation : -Infinity;
      case 'score':
        return item.score !== undefined ? item.score : 10;
      case 'quarantine':
        return item.is_quarantined ? 1 : 0;
      default:
        return 0;
    }
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Sort assets, then group them by category
  const sortedAssets = [...assets].sort((a, b) => {
    const valA = getSortValue(a, sortField);
    const valB = getSortValue(b, sortField);

    if (typeof valA === 'string' && typeof valB === 'string') {
      return sortDirection === 'asc' 
        ? valA.localeCompare(valB) 
        : valB.localeCompare(valA);
    } else {
      const numA = Number(valA);
      const numB = Number(valB);
      if (numA === numB) return 0;
      return sortDirection === 'asc' ? numA - numB : numB - numA;
    }
  });

  // Group assets by category (preserving sorted order)
  const groupedAssets = sortedAssets.reduce((acc, asset) => {
    if (!acc[asset.category]) {
      acc[asset.category] = [];
    }
    acc[asset.category].push(asset);
    return acc;
  }, {} as Record<string, Asset[]>);

  const totalPortfolioValue = assets.reduce((sum, item) => {
    const { currentValBrl } = calculateAssetBrlValues(item);
    return sum + currentValBrl;
  }, 0);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticker.trim() || !category || quantity === '' || investedAmount === '') return;

    onAddAsset({
      ticker: ticker.trim().toUpperCase(),
      category,
      quantity: parseFloat(quantity.toString()) || 0,
      currency,
      invested_amount: parseFloat(investedAmount.toString()) || 0,
      score: Math.min(10, Math.max(1, score)),
      is_quarantined: false,
    });

    // Reset Form
    setTicker('');
    setQuantity('');
    setInvestedAmount('');
    setScore(10);
    setShowAddForm(false);
  };

  const renderSortableHeader = (label: string, field: string, align: 'left' | 'right' | 'center' = 'left', extraClass: string = '') => {
    const isCurrent = sortField === field;
    const alignClass = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
    const flexAlignClass = align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start';

    return (
      <th 
        className={`p-3 cursor-pointer hover:bg-zinc-800/40 hover:text-zinc-300 transition-colors select-none font-sans group ${alignClass} ${extraClass}`}
        onClick={() => handleSort(field)}
      >
        <div className={`inline-flex items-center gap-1 w-full ${flexAlignClass}`}>
          <span>{label}</span>
          <span className="shrink-0 text-indigo-400">
            {isCurrent ? (
              sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3 opacity-0 group-hover:opacity-40 transition-opacity" />
            )}
          </span>
        </div>
      </th>
    );
  };

  return (
    <div id="asset-list-container" className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl space-y-6">
      {/* List Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2">
          <Folder className="w-5 h-5 text-indigo-400" />
          <h2 className="text-lg font-semibold text-zinc-100 font-sans">Inventário da Carteira</h2>
        </div>
        <button
          id="add-asset-btn"
          onClick={() => {
            setShowAddForm(!showAddForm);
            if (!category && categories.length > 0) setCategory(categories[0]);
          }}
          className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          Adicionar Ativo Manualmente
        </button>
      </div>

      {/* Manual Asset Creation Form */}
      {showAddForm && (
        <form onSubmit={handleAddSubmit} className="bg-zinc-950 p-4 border border-zinc-800 rounded-lg space-y-4 animate-fade-in">
          <div className="text-xs font-semibold text-zinc-300 font-sans border-b border-zinc-800/80 pb-1.5 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            Adicionar Posição de Ativo Manualmente
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
            <div>
              <label className="block text-[10px] text-zinc-400 font-medium mb-1 uppercase font-sans">Ticker</label>
              <input
                id="asset-ticker-input"
                type="text"
                placeholder="WEGE3"
                value={ticker}
                onChange={(e) => setTicker(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500 uppercase font-mono"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] text-zinc-400 font-medium mb-1 uppercase font-sans">Categoria</label>
              <select
                id="asset-category-select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
                required
              >
                <option value="" disabled>Selecione a categoria</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
                {!categories.includes(category) && category && (
                  <option value={category}>{category}</option>
                )}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-zinc-400 font-medium mb-1 uppercase font-sans">Quantidade</label>
              <input
                id="asset-qty-input"
                type="number"
                step="any"
                placeholder="100"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500 font-mono"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] text-zinc-400 font-medium mb-1 uppercase font-sans">Moeda</label>
              <select
                id="asset-currency-select"
                value={currency}
                onChange={(e) => setCurrency(e.target.value as Currency)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500 font-mono"
              >
                <option value="BRL">BRL (R$)</option>
                <option value="USD">USD (US$)</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-zinc-400 font-medium mb-1 uppercase font-sans">
                Custo Investido ({currency === 'USD' ? 'US$' : 'R$'})
              </label>
              <input
                id="asset-invested-input"
                type="number"
                step="any"
                placeholder="4000"
                value={investedAmount}
                onChange={(e) => setInvestedAmount(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500 font-mono"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] text-zinc-400 font-medium mb-1 uppercase font-sans">Nota/Score (1-10)</label>
              <select
                value={score}
                onChange={(e) => setScore(parseInt(e.target.value) || 10)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500 font-mono"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                  <option key={num} value={num} className="bg-zinc-900 text-zinc-100">
                    {num}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {currency === 'USD' && investedAmount !== '' && (
            <p className="text-[10px] text-zinc-500 italic mt-1 font-mono">
              * Custo equivalente em BRL: R$ {((Number(investedAmount) || 0) * usdToBrlRate).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2 border-t border-zinc-900">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-4 py-1.5 rounded font-medium transition-colors"
            >
              Adicionar Ativo
            </button>
          </div>
        </form>
      )}

      {/* Asset Display grouped by categories */}
      {assets.length === 0 ? (
        <div className="text-center py-8 text-zinc-500 text-xs">
          Sua carteira está vazia no momento. Importe dados ou adicione ativos manualmente acima!
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedAssets).map(([catName, catAssets]) => {
            const categoryTotalValue = catAssets.reduce((sum, item) => {
              const { currentValBrl } = calculateAssetBrlValues(item);
              return sum + currentValBrl;
            }, 0);
            const categoryWeight = totalPortfolioValue > 0 ? (categoryTotalValue / totalPortfolioValue) * 100 : 0;

            return (
              <div key={catName} className="border border-zinc-800/80 rounded-lg overflow-hidden bg-zinc-950/20">
                {/* Category Header */}
                <div 
                  className="bg-zinc-950 px-4 py-2.5 border-b border-zinc-800 flex items-center justify-between cursor-pointer hover:bg-zinc-900 transition-colors select-none group"
                  onClick={() => toggleCategory(catName)}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-500" />
                    <span className="text-xs font-semibold text-zinc-300 font-sans uppercase tracking-wider">{catName}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-[11px] text-zinc-400 font-mono">
                      Valor Atual (BRL): <span className="text-zinc-200 font-semibold">R$ {categoryTotalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      <span className="text-zinc-500 ml-1.5">({categoryWeight.toFixed(1)}%)</span>
                    </div>
                    {collapsedCategories[catName] ? (
                      <ChevronDown className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
                    ) : (
                      <ChevronUp className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
                    )}
                  </div>
                </div>

                {/* Assets Table */}
                {!collapsedCategories[catName] && (
                  <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-900/30 text-zinc-500 font-medium text-[10px] uppercase font-sans">
                        {renderSortableHeader('Ticker', 'ticker', 'left', 'pl-4')}
                        {renderSortableHeader('Quantidade', 'quantity', 'left')}
                        {renderSortableHeader('Custo Investido', 'invested_amount', 'right')}
                        {renderSortableHeader('Preço Atual', 'livePrice', 'right')}
                        {renderSortableHeader('Valor Atual (BRL)', 'currentValBrl', 'right')}
                        {renderSortableHeader('Var %', 'variation', 'center')}
                        {renderSortableHeader('Nota (1-10)', 'score', 'center')}
                        {renderSortableHeader('Quarentena', 'quarantine', 'center')}
                        <th className="p-3 text-center pr-4 select-none">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/40">
                      {catAssets.map((asset) => {
                        const { currentValBrl, variation, livePriceNative } = calculateAssetBrlValues(asset);

                        return (
                          <tr
                            key={asset.id}
                            className={`hover:bg-zinc-800/10 transition-colors font-mono ${
                              asset.is_quarantined ? 'opacity-40 bg-zinc-950/40' : ''
                            }`}
                          >
                            {/* Ticker */}
                            <td className="p-3 pl-4">
                              <div className="font-semibold text-zinc-200 text-sm flex flex-col sm:flex-row sm:items-center gap-1.5">
                                <span className="flex items-center gap-1.5">
                                  {asset.ticker}
                                  {asset.quoteFailed && (
                                    <div className="relative group inline-flex items-center cursor-help select-none">
                                      <AlertCircle 
                                        className="w-3.5 h-3.5 text-amber-500 hover:text-amber-400 transition-colors shrink-0" 
                                        title="Preço não pôde ser atualizado no Yahoo Finance. Foi calculado com base no valor investido."
                                      />
                                      <span className="hidden sm:block pointer-events-none absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-52 p-2.5 bg-zinc-950 text-[10px] text-amber-300 border border-amber-800/40 rounded-lg shadow-xl font-sans normal-case tracking-normal leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10 text-center">
                                        Cotação indisponível no Yahoo Finance. Usando o valor investido como fallback.
                                        {/* Little arrow at the bottom of tooltip */}
                                        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-zinc-950" />
                                      </span>
                                    </div>
                                  )}
                                </span>
                                {asset.is_quarantined && (
                                  <span className="text-[8px] tracking-wider leading-none bg-amber-500/15 text-amber-500 border border-amber-500/20 px-1 py-0.5 rounded font-sans uppercase">
                                    Quarentena
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Quantity */}
                            <td className="p-3 text-zinc-300 text-xs">
                              {asset.quantity > 0 && asset.quantity < 0.01 ? (
                                asset.quantity.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 8 })
                              ) : (
                                (Math.floor(asset.quantity * 100) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
                              )}
                            </td>

                            {/* Invested Cost */}
                            <td className="p-3 text-right text-zinc-400">
                              {asset.currency === 'USD' ? 'US$' : 'R$'}{' '}
                              {(asset.invested_amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>

                            {/* Live Price */}
                            <td className="p-3 text-right">
                              {livePriceNative !== undefined && livePriceNative !== null ? (
                                <div className="text-emerald-400 font-semibold font-mono">
                                  {asset.currency === 'USD' ? 'US$' : 'R$'}{' '}
                                  {livePriceNative.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                              ) : (
                                <div className="text-zinc-600 italic text-[11px]">
                                  {isLoadingQuotes ? 'Carregando...' : '---'}
                                </div>
                              )}
                            </td>

                            {/* Current Value in BRL */}
                            <td className="p-3 text-right font-semibold text-zinc-200">
                              R$ {currentValBrl.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>

                            {/* Variation % */}
                            <td className="p-3 text-center">
                              {livePriceNative !== undefined && livePriceNative !== null ? (
                                <div className={`flex items-center justify-center gap-0.5 font-bold ${
                                  variation >= 0 ? 'text-emerald-500' : 'text-red-400'
                                }`}>
                                  {variation >= 0 ? (
                                    <TrendingUp className="w-3.5 h-3.5" />
                                  ) : (
                                    <TrendingDown className="w-3.5 h-3.5" />
                                  )}
                                  <span>{variation >= 0 ? '+' : ''}{variation.toFixed(1)}%</span>
                                </div>
                              ) : (
                                <span className="text-zinc-600 font-mono">---</span>
                              )}
                            </td>

                            {/* Inline Score Selector (1-10) */}
                            <td className="p-3 text-center">
                              <div className="inline-flex items-center gap-1 bg-zinc-950 px-2 py-1 rounded border border-zinc-800">
                                <Star className="w-3 h-3 text-amber-500 shrink-0 fill-amber-500/30" />
                                <select
                                  value={asset.score !== undefined ? asset.score : 10}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value) || 10;
                                    onUpdateScore(asset.id, val);
                                  }}
                                  className="bg-transparent text-center border-none focus:outline-none font-bold text-zinc-100 text-xs font-mono cursor-pointer pr-1"
                                  title="Weight score 1 to 10"
                                >
                                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                                    <option key={num} value={num} className="bg-zinc-950 text-zinc-100">
                                      {num}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </td>

                            {/* Quarantine Toggle Switch */}
                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center">
                                <label className="relative inline-flex items-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={!!asset.is_quarantined}
                                    onChange={() => onToggleQuarantine(asset.id)}
                                    className="sr-only peer"
                                  />
                                  <div className="w-8 h-4 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-400 after:border-zinc-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-amber-600/70 peer-checked:after:bg-zinc-100"></div>
                                </label>
                                <span className="ml-1.5 shrink-0">
                                  {asset.is_quarantined ? (
                                    <ShieldAlert className="w-3.5 h-3.5 text-amber-500" title="Quarantined" />
                                  ) : (
                                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" title="Active" />
                                  )}
                                </span>
                              </div>
                            </td>

                            {/* Delete Action */}
                            <td className="p-3 text-center pr-4">
                              {confirmDeleteId === asset.id ? (
                                <div className="flex items-center justify-center gap-1.5 animate-fade-in">
                                  <button
                                    onClick={() => {
                                      onDeleteAsset(asset.id);
                                      setConfirmDeleteId(null);
                                    }}
                                    className="text-[10px] bg-red-600 hover:bg-red-500 text-white px-2 py-1 rounded font-sans transition-colors cursor-pointer font-bold uppercase"
                                    title="Confirmar exclusão"
                                  >
                                    Confirmar
                                  </button>
                                  <button
                                    onClick={() => setConfirmDeleteId(null)}
                                    className="text-[10px] text-zinc-400 hover:text-zinc-200 px-1.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 transition-colors cursor-pointer font-sans"
                                    title="Cancelar"
                                  >
                                    X
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setConfirmDeleteId(asset.id)}
                                  className="text-zinc-600 hover:text-red-400 p-1.5 rounded hover:bg-zinc-800 transition-colors cursor-pointer"
                                  title="Delete Asset"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
