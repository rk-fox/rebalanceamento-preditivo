/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Asset, CategoryAllocation, RebalanceOutput, CategoryRebalanceResult } from '../types';
import { calculateRebalance } from '../utils/rebalancer';
import { DollarSign, Percent, TrendingUp, Sparkles, ShoppingCart, HelpCircle, ArrowRight } from 'lucide-react';
import GeminiAdvisor from './GeminiAdvisor';

interface RebalanceEngineProps {
  assets: Asset[];
  allocations: CategoryAllocation[];
  onCalculationTrigger: (output: RebalanceOutput) => void;
  rebalanceResult: RebalanceOutput | null;
  usdToBrlRate: number;
}

export default function RebalanceEngine({
  assets,
  allocations,
  onCalculationTrigger,
  rebalanceResult,
  usdToBrlRate,
}: RebalanceEngineProps) {
  const [depositText, setDepositText] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Helper to safely get the current BRL value of an asset
  const getBrlValue = (asset: Asset): number => {
    if (asset.currentValue !== undefined && asset.currentValue !== null) {
      return asset.currentValue;
    }
    const nativeVal = asset.invested_amount || 0;
    return asset.currency === 'USD' ? nativeVal * usdToBrlRate : nativeVal;
  };

  const currentTotalEquity = assets.reduce((sum, item) => sum + getBrlValue(item), 0);
  const totalTargetAllocation = allocations.reduce((sum, item) => sum + item.target_percentage, 0);
  const isAllocationValid = Math.abs(totalTargetAllocation - 100) < 0.01;

  // Recalculate if assets change and there's a previous calculation
  useEffect(() => {
    if (rebalanceResult && rebalanceResult.depositAmount > 0) {
      const recomputed = calculateRebalance(assets, allocations, rebalanceResult.depositAmount, usdToBrlRate);
      onCalculationTrigger(recomputed);
    }
  }, [assets, allocations, usdToBrlRate]);

  const handleCalculate = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const depositVal = parseFloat(depositText) || 0;
    if (depositVal <= 0) {
      setErrorMsg('Por favor, informe um valor de aporte válido maior que 0.');
      return;
    }

    if (!isAllocationValid) {
      setErrorMsg('Não é possível calcular o rebalanceamento. A soma das macro-alocações deve ser exatamente 100% (atualmente ' + totalTargetAllocation + '%). Por favor, ajuste nas configurações.');
      return;
    }

    const output = calculateRebalance(assets, allocations, depositVal, usdToBrlRate);
    onCalculationTrigger(output);
  };

  // Extract all recommendations across categories
  const allRecommendations = rebalanceResult
    ? rebalanceResult.results.flatMap(r => r.recommendations)
    : [];

  const totalAllocatedBuys = rebalanceResult
    ? rebalanceResult.results.reduce((sum, r) => sum + r.allocatedAmount, 0)
    : 0;

  const leftoverCash = rebalanceResult ? Math.max(0, rebalanceResult.depositAmount - totalAllocatedBuys) : 0;

  return (
    <div id="rebalance-engine" className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl space-y-6">
      {/* Title */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-indigo-400" />
          <h2 className="text-lg font-semibold text-zinc-100 font-sans">Calculadora de Aportes & Rebalanceamento</h2>
        </div>
      </div>

      {/* Input Form Card */}
      <form onSubmit={handleCalculate} className="bg-zinc-950 p-5 rounded-lg border border-zinc-800/80 space-y-4">
        <div className="flex flex-col md:flex-row md:items-end gap-4">
          <div className="flex-1">
            <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2 font-sans">
              Valor do Aporte Mensal (R$)
            </label>
            <div className="relative rounded-lg shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <span className="text-zinc-500 font-mono text-sm font-semibold">R$</span>
              </div>
              <input
                id="deposit-amount-input"
                type="number"
                step="any"
                min="0"
                placeholder="Ex: 2000"
                value={depositText}
                onChange={(e) => setDepositText(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg pl-10 pr-4 py-2.5 text-zinc-100 font-mono text-base focus:outline-none focus:border-indigo-500 placeholder-zinc-600"
              />
            </div>
          </div>
          <button
            id="calculate-rebalance-btn"
            type="submit"
            className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-medium text-sm px-6 py-2.5 rounded-lg transition-all flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4 text-indigo-200" />
            Calcular Rebalanceamento
          </button>
        </div>

        {errorMsg && (
          <p className="text-xs text-red-400 font-medium font-sans flex items-center gap-1">
            ⚠️ {errorMsg}
          </p>
        )}

        {/* Portfolio Valuation Header Info */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-zinc-900/60 text-xs font-mono">
          <div className="text-zinc-500">
            Patrimônio Atual: <span className="text-zinc-300 font-semibold">R$ {currentTotalEquity.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
          {rebalanceResult && (
            <>
              <div className="text-zinc-500 sm:text-center">
                Total Recomendado: <span className="text-emerald-400 font-semibold">R$ {totalAllocatedBuys.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="text-zinc-500 sm:text-right">
                Saldo Remanescente: <span className="text-amber-400 font-semibold">R$ {leftoverCash.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
            </>
          )}
        </div>
      </form>

      {/* Recommendations Output Block */}
      {rebalanceResult && (
        <div className="space-y-6 animate-fade-in">
          {/* Section: Recommendations Cards */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3 flex items-center gap-1.5 font-sans">
              <ShoppingCart className="w-4 h-4 text-indigo-400" />
              Ordens Recomendadas de Compra
            </h3>

            {allRecommendations.length === 0 ? (
              <div className="bg-zinc-950 p-5 rounded-lg text-center text-zinc-500 border border-zinc-800 text-xs leading-relaxed">
                Nenhum aporte recomendado no momento. Isso ocorre se todos os ativos de categorias abaixo da meta estiverem em Quarentena ou se a carteira já estiver em equilíbrio ideal.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {rebalanceResult.results
                    .filter(r => r.recommendations.length > 0)
                    .map((result) => (
                      <div
                        key={result.category}
                        className="bg-zinc-950/60 border border-zinc-800/80 rounded-lg p-4 space-y-3 shadow-md hover:border-zinc-700 transition-colors"
                      >
                        {/* Card Header */}
                        <div className="flex justify-between items-center border-b border-zinc-900 pb-2">
                          <span className="text-xs font-bold text-indigo-300 font-sans uppercase tracking-wider">
                            {result.category}
                          </span>
                          <span className="text-xs font-mono font-bold text-zinc-300 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                            Total: R$ {result.allocatedAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>

                        {/* Buy Recommendations List */}
                        <div className="space-y-2">
                          {result.recommendations.map((rec, rIdx) => (
                            <div key={rIdx} className="flex items-center justify-between font-mono text-xs py-1 border-b border-zinc-900/40 last:border-0">
                              <div className="flex items-center gap-2">
                                <ArrowRight className="w-3 h-3 text-emerald-400" />
                                <span className="font-bold text-emerald-400 text-sm">{rec.ticker}</span>
                                {rec.estimatedQuantityIncrease !== undefined && rec.estimatedQuantityIncrease > 0 && (
                                  <span className="text-[10px] text-zinc-500">
                                    (~{rec.estimatedQuantityIncrease.toLocaleString('pt-BR', { 
                                      minimumFractionDigits: 0, 
                                      maximumFractionDigits: 6 
                                    })} cotas/ações)
                                  </span>
                                )}
                              </div>
                              <div className="text-right">
                                <span className="text-zinc-500 text-[10px] mr-1">COMPRAR</span>
                                <span className="font-bold text-zinc-100">
                                  {rec.currency === 'USD' ? 'US$' : 'R$'}{' '}
                                  {rec.currency === 'USD' 
                                    ? (rec.amount / usdToBrlRate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                    : rec.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                                {rec.currency === 'USD' && (
                                  <p className="text-[9px] text-zinc-500">R$ {rec.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>

                {/* Gemini Advisor BYOK Embed */}
                <GeminiAdvisor recommendations={allRecommendations} />
              </div>
            )}
          </div>

          {/* Section: Rebalanced Weights Breakdown */}
          <div className="border border-zinc-800 rounded-lg overflow-hidden bg-zinc-950/20">
            <div className="bg-zinc-950 px-4 py-3 border-b border-zinc-800">
              <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider font-sans">
                Análise do Percentual Pós-Rebalanceamento
              </span>
            </div>
            <div className="p-4 space-y-4">
              {rebalanceResult.results.map((result) => (
                <div key={result.category} className="space-y-1">
                  {/* Label, Weights & Funds */}
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-medium text-zinc-300 font-sans">{result.category}</span>
                    <div className="flex items-center gap-4 text-zinc-400 font-mono">
                      <span>Meta: <strong className="text-zinc-300">{result.targetWeight}%</strong></span>
                      <div className="flex items-center gap-1 text-[11px]">
                        <span>{result.currentWeight.toFixed(1)}%</span>
                        <span>→</span>
                        <span className={result.allocatedAmount > 0 ? 'text-emerald-400 font-bold' : ''}>
                          {result.futureWeight.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Horizontal Bar Visualizer */}
                  <div className="relative h-2.5 w-full bg-zinc-800/80 rounded-full overflow-hidden border border-zinc-900/60">
                    {/* Current Weight Bar */}
                    <div
                      style={{ width: `${Math.min(100, result.currentWeight)}%` }}
                      className="absolute top-0 left-0 h-full bg-zinc-600 rounded-full transition-all duration-500"
                    />
                    {/* Future Increase Bar */}
                    {result.allocatedAmount > 0 && (
                      <div
                        style={{
                          left: `${Math.min(100, result.currentWeight)}%`,
                          width: `${Math.min(100 - result.currentWeight, result.futureWeight - result.currentWeight)}%`,
                        }}
                        className="absolute top-0 h-full bg-emerald-500 rounded-r-full transition-all duration-500"
                      />
                    )}
                    {/* Target Vertical line marker */}
                    <div
                      style={{ left: `${result.targetWeight}%` }}
                      className="absolute top-0 h-full w-0.5 bg-indigo-500/80 z-10"
                      title={`Meta: ${result.targetWeight}%`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
