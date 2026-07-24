/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { CategoryAllocation } from '../types';
import { Settings, Plus, Trash2, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';

interface SettingsPanelProps {
  allocations: CategoryAllocation[];
  onUpdateAllocations: (allocations: CategoryAllocation[]) => void;
  usdToBrlRate: number;
  onUpdateUsdRate: (rate: number) => void;
  availableCategories: string[];
}

export default function SettingsPanel({
  allocations,
  onUpdateAllocations,
  usdToBrlRate,
  onUpdateUsdRate,
  availableCategories,
}: SettingsPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'targets' | 'decimals'>('targets');
  const [newCategory, setNewCategory] = useState('');
  const [newPercentage, setNewPercentage] = useState(0);

  const totalPercentage = allocations.reduce((sum, item) => sum + item.target_percentage, 0);
  const isValidTotal = Math.abs(totalPercentage - 100) < 0.01;

  const handlePercentageChange = (category: string, value: number) => {
    const updated = allocations.map(item => {
      if (item.category === category) {
        return { ...item, target_percentage: Math.max(0, value) };
      }
      return item;
    });
    onUpdateAllocations(updated);
  };

  const handleDecimalPlacesChange = (category: string, value: number) => {
    const updated = allocations.map(item => {
      if (item.category === category) {
        return { ...item, decimal_places: value };
      }
      return item;
    });
    onUpdateAllocations(updated);
  };

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategory.trim()) return;
    
    // Check if category already exists
    if (allocations.some(item => item.category.toLowerCase() === newCategory.trim().toLowerCase())) {
      alert('Esta categoria já existe!');
      return;
    }

    onUpdateAllocations([
      ...allocations,
      { category: newCategory.trim(), target_percentage: newPercentage }
    ]);
    setNewCategory('');
    setNewPercentage(0);
  };

  const handleRemoveCategory = (category: string) => {
    const updated = allocations.filter(item => item.category !== category);
    onUpdateAllocations(updated);
  };

  return (
    <div id="settings-panel" className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl transition-all duration-300">
      <div className="flex items-center justify-between mb-4 border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-indigo-400" />
          <h2 className="text-lg font-semibold text-zinc-100 font-sans">Configuração de Macro-Alocação</h2>
        </div>
        <button
          id="toggle-settings-btn"
          onClick={() => setIsOpen(!isOpen)}
          className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded-lg transition-colors"
        >
          {isOpen ? 'Minimizar' : 'Configurar Metas'}
        </button>
      </div>

      <div className="space-y-4">
        {/* USD Exchange Rate Setting (Always Visible for quick check) */}
        <div className="flex items-center justify-between bg-zinc-950/60 p-3 rounded-lg border border-zinc-800/80">
          <div>
            <div className="text-xs font-medium text-zinc-300">Cotação do Dólar (USD/BRL)</div>
            <div className="text-[10px] text-zinc-500 leading-relaxed">
              Atualizada automaticamente via Yahoo Finance nas consultas, mas pode ser personalizada manualmente para simulações.
            </div>
          </div>
          <div className="flex items-center gap-2 select-none">
            <span className="text-zinc-500 text-xs font-semibold">R$</span>
            <input
              id="usd-rate-input"
              type="number"
              step="0.01"
              value={usdToBrlRate}
              onChange={(e) => onUpdateUsdRate(Math.max(0.1, parseFloat(e.target.value) || 0))}
              className="w-20 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-right text-sm text-zinc-100 focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>
        </div>

        {/* Current Allocation Stats Banner */}
        <div className={`flex items-center justify-between p-3 rounded-lg border ${
          isValidTotal 
            ? 'bg-emerald-950/20 border-emerald-800/50 text-emerald-400' 
            : 'bg-amber-950/20 border-amber-800/50 text-amber-400'
        }`}>
          <div className="flex items-center gap-2">
            {isValidTotal ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            )}
            <div className="text-xs">
              <span className="font-semibold">Soma Atual das Metas: {totalPercentage}%</span>
              {!isValidTotal && <p className="text-[10px] text-zinc-400 mt-0.5">A soma das metas de alocação precisa ser exatamente 100%.</p>}
            </div>
          </div>
        </div>

        {/* Detailed Category Target Configurations */}
        {isOpen && (
          <div className="space-y-4 pt-2 border-t border-zinc-800/60 animate-fade-in">
            {/* Tab Selection Navigation */}
            <div className="flex border-b border-zinc-800/80 gap-4 pb-1">
              <button
                type="button"
                onClick={() => setActiveTab('targets')}
                className={`pb-2 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                  activeTab === 'targets'
                    ? 'border-indigo-500 text-indigo-400 font-bold'
                    : 'border-transparent text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Metas (%)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('decimals')}
                className={`pb-2 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                  activeTab === 'decimals'
                    ? 'border-indigo-500 text-indigo-400 font-bold'
                    : 'border-transparent text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Casas Decimais
              </button>
            </div>

            {/* Content Tab 1: Percentage Targets */}
            {activeTab === 'targets' && (
              <div className="space-y-3 max-h-60 overflow-y-auto pr-1 animate-fade-in">
                {allocations.map((item) => (
                  <div key={item.category} className="flex items-center gap-3 bg-zinc-950/30 p-2.5 rounded-lg border border-zinc-800/40">
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-medium text-zinc-300 block truncate">{item.category}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={item.target_percentage}
                        onChange={(e) => handlePercentageChange(item.category, parseInt(e.target.value) || 0)}
                        className="w-24 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                      />
                      <div className="flex items-center">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={item.target_percentage}
                          onChange={(e) => handlePercentageChange(item.category, parseInt(e.target.value) || 0)}
                          className="w-12 bg-zinc-900 border border-zinc-700 rounded px-1.5 py-0.5 text-center text-xs text-zinc-100 font-mono"
                        />
                        <span className="text-zinc-500 text-xs ml-1">%</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveCategory(item.category)}
                        className="text-zinc-500 hover:text-red-400 p-1 rounded hover:bg-zinc-800 transition-colors"
                        title="Excluir categoria"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Content Tab 2: Rounding / Decimal Places */}
            {activeTab === 'decimals' && (
              <div className="space-y-3 max-h-60 overflow-y-auto pr-1 animate-fade-in font-sans">
                {allocations.map((item) => (
                  <div key={item.category} className="flex items-center justify-between bg-zinc-950/30 p-2.5 rounded-lg border border-zinc-800/40">
                    <div className="flex-1 min-w-0 pr-3">
                      <span className="text-xs font-medium text-zinc-300 block truncate">{item.category}</span>
                      <p className="text-[10px] text-zinc-500 mt-0.5">
                        {item.decimal_places === 0 
                          ? 'Comprar apenas em números inteiros' 
                          : `Comprar com até ${item.decimal_places !== undefined ? item.decimal_places : 2} casas decimais`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <select
                        value={item.decimal_places !== undefined ? item.decimal_places : 2}
                        onChange={(e) => handleDecimalPlacesChange(item.category, parseInt(e.target.value) || 0)}
                        className="bg-zinc-900 border border-zinc-750 text-zinc-200 rounded text-xs px-2.5 py-1 focus:outline-none focus:border-indigo-500 font-sans"
                      >
                        <option value="0">0 (Inteiro - Ações / FIIs / ETFs locais)</option>
                        <option value="1">1 Casa Decimal</option>
                        <option value="2">2 Casas Decimais (Tesouro Direto)</option>
                        <option value="3">3 Casas Decimais</option>
                        <option value="4">4 Casas Decimais (Reits/Stocks)</option>
                        <option value="5">5 Casas Decimais</option>
                        <option value="6">6 Casas Decimais (Cripto)</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => handleRemoveCategory(item.category)}
                        className="text-zinc-500 hover:text-red-400 p-1 rounded hover:bg-zinc-800 transition-colors"
                        title="Excluir categoria"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Form to add custom category */}
            <form onSubmit={handleAddCategory} className="bg-zinc-950/50 p-3 rounded-lg border border-zinc-800/80 space-y-2">
              <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Adicionar Categoria</div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ex: Criptoativos"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
                  list="category-suggestions"
                />
                <datalist id="category-suggestions">
                  {availableCategories
                    .filter(cat => !allocations.some(a => a.category === cat))
                    .map(cat => (
                      <option key={cat} value={cat} />
                    ))}
                </datalist>
                <div className="flex items-center bg-zinc-900 border border-zinc-700 rounded px-1.5 py-1">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="0"
                    value={newPercentage || ''}
                    onChange={(e) => setNewPercentage(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-10 bg-transparent border-none text-xs text-center text-zinc-100 focus:outline-none font-mono"
                  />
                  <span className="text-zinc-500 text-xs font-mono">%</span>
                </div>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white p-1 rounded transition-colors flex items-center justify-center shrink-0 w-8 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
