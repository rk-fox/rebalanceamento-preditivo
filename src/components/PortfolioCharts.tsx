/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Asset, CategoryAllocation, RebalanceOutput } from '../types';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';
import { BarChart3, PieChart as PieIcon, History, TrendingUp, PlusCircle, Trash2, CheckCircle2 } from 'lucide-react';
import { calculateRebalance } from '../utils/rebalancer';

interface PortfolioChartsProps {
  assets: Asset[];
  allocations: CategoryAllocation[];
  usdToBrlRate: number;
  rebalanceResult: RebalanceOutput | null;
}

interface HistorySnapshot {
  id: string;
  date: string;
  depositAmount: number;
  totalEquity: number;
}

const DEFAULT_HISTORY: HistorySnapshot[] = [
  { id: 'h1', date: 'Abr 2026', depositAmount: 1500, totalEquity: 12000 },
  { id: 'h2', date: 'Mai 2026', depositAmount: 2000, totalEquity: 14800 },
  { id: 'h3', date: 'Jun 2026', depositAmount: 1800, totalEquity: 17200 },
];

export default function PortfolioCharts({
  assets,
  allocations,
  usdToBrlRate,
  rebalanceResult,
}: PortfolioChartsProps) {
  const [activeTab, setActiveTab] = useState<'allocations' | 'history'>('allocations');
  const [history, setHistory] = useState<HistorySnapshot[]>([]);
  const [simulatedDeposit, setSimulatedDeposit] = useState<number>(5000);
  const [logSuccess, setLogSuccess] = useState(false);

  // Load history from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('pe_portfolio_history');
    if (saved) {
      setHistory(JSON.parse(saved));
    } else {
      setHistory(DEFAULT_HISTORY);
      localStorage.setItem('pe_portfolio_history', JSON.stringify(DEFAULT_HISTORY));
    }
  }, []);

  const saveHistoryToLocalStorage = (newHistory: HistorySnapshot[]) => {
    setHistory(newHistory);
    localStorage.setItem('pe_portfolio_history', JSON.stringify(newHistory));
  };

  // Helper to safely get the current BRL value of an asset
  const getBrlValue = (asset: Asset): number => {
    if (asset.currentValue !== undefined && asset.currentValue !== null) {
      return asset.currentValue;
    }
    const nativeVal = asset.invested_amount || 0;
    return asset.currency === 'USD' ? nativeVal * usdToBrlRate : nativeVal;
  };

  const currentTotalEquity = assets.reduce((sum, item) => sum + getBrlValue(item), 0);

  // Category wise computations
  const categoriesData = allocations.map(alloc => {
    const categoryAssets = assets.filter(a => a.category === alloc.category);
    const currentValue = categoryAssets.reduce((sum, a) => sum + getBrlValue(a), 0);
    const currentWeight = currentTotalEquity > 0 ? (currentValue / currentTotalEquity) * 100 : 0;
    
    // Find future weight if rebalanced
    let futureWeight = currentWeight;
    let allocatedAmount = 0;
    if (rebalanceResult) {
      const match = rebalanceResult.results.find(r => r.category === alloc.category);
      if (match) {
        futureWeight = match.futureWeight;
        allocatedAmount = match.allocatedAmount;
      }
    }

    return {
      category: alloc.category,
      targetWeight: alloc.target_percentage,
      currentWeight: parseFloat(currentWeight.toFixed(1)),
      futureWeight: parseFloat(futureWeight.toFixed(1)),
      currentValue: parseFloat(currentValue.toFixed(2)),
      allocatedAmount: parseFloat(allocatedAmount.toFixed(2)),
    };
  });

  // Simulator helper: calculates convergence error across simulated deposits
  const getConvergenceData = () => {
    const steps = [0, 2000, 5000, 10000, 20000, 50000];
    return steps.map(deposit => {
      const result = calculateRebalance(assets, allocations, deposit, usdToBrlRate);
      
      // Calculate mean squared error or absolute sum deviation from target
      let totalDeviation = 0;
      result.results.forEach(r => {
        totalDeviation += Math.abs(r.futureWeight - r.targetWeight);
      });

      return {
        depositLabel: `+R$ ${(deposit / 1000).toFixed(0)}k`,
        depositValue: deposit,
        deviation: parseFloat((totalDeviation).toFixed(1)),
        equity: parseFloat((currentTotalEquity + deposit).toFixed(0)),
      };
    });
  };

  const handleAddCurrentToHistory = () => {
    if (rebalanceResult && rebalanceResult.depositAmount > 0) {
      const today = new Date();
      const formatter = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric' });
      const dateStr = formatter.format(today);

      const newSnapshot: HistorySnapshot = {
        id: Math.random().toString(36).substring(2, 9),
        date: dateStr.charAt(0).toUpperCase() + dateStr.slice(1),
        depositAmount: rebalanceResult.depositAmount,
        totalEquity: currentTotalEquity + rebalanceResult.depositAmount,
      };

      const updated = [...history, newSnapshot];
      saveHistoryToLocalStorage(updated);
      setLogSuccess(true);
      setTimeout(() => setLogSuccess(false), 3000);
    }
  };

  const handleClearHistory = () => {
    if (window.confirm('Deseja realmente limpar o histórico registrado localmente?')) {
      saveHistoryToLocalStorage([]);
    }
  };

  // Color Palette for Pie Chart Cells
  const COLORS = [
    '#3b82f6', // Blue
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#ec4899', // Pink
    '#8b5cf6', // Violet
    '#ef4444', // Red
    '#06b6d4', // Cyan
    '#84cc16', // Lime
    '#f97316', // Orange
    '#6366f1', // Indigo
    '#14b8a6', // Teal
    '#eab308'  // Yellow
  ];

  return (
    <div id="portfolio-charts-container" className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl space-y-6">
      {/* Header Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-800 pb-3 gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-indigo-400" />
          <h2 className="text-lg font-semibold text-zinc-100 font-sans">Análise Visual do Portfólio</h2>
        </div>
        <div className="flex bg-zinc-950 p-1 rounded-lg border border-zinc-800 self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('allocations')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
              activeTab === 'allocations' ? 'bg-indigo-600 text-white shadow-md' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <PieIcon className="w-3.5 h-3.5" />
            Alocação Macro
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
              activeTab === 'history' ? 'bg-indigo-600 text-white shadow-md' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Histórico & Convergência
          </button>
        </div>
      </div>

      {activeTab === 'allocations' ? (
        <div className="space-y-6">
          {/* Charts Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column: Comparative Weights Bar Chart */}
            <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-lg p-4 flex flex-col justify-between">
              <div className="mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 font-sans">
                  Comparativo de Alocação (% do Total)
                </span>
                <p className="text-[10px] text-zinc-500 mt-1 leading-relaxed">
                  Pesos Atuais vs Alvos vs Peso Futuro estimado após aporte recomendado.
                </p>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={categoriesData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="category" stroke="#71717a" fontSize={10} />
                    <YAxis stroke="#71717a" fontSize={10} unit="%" />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '8px' }}
                      labelStyle={{ fontWeight: 'bold', color: '#f4f4f5' }}
                      itemStyle={{ color: '#a1a1aa' }}
                    />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                    <Bar name="Alvo %" dataKey="targetWeight" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    <Bar name="Atual %" dataKey="currentWeight" fill="#a1a1aa" radius={[4, 4, 0, 0]} />
                    <Bar name="Futuro %" dataKey="futureWeight" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Right Column: Portfolio Composition Doughnut */}
            <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-lg p-4 flex flex-col justify-between">
              <div className="mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 font-sans">
                  Composição do Patrimônio Atual
                </span>
                <p className="text-[10px] text-zinc-500 mt-1 leading-relaxed">
                  Distribuição monetária por macro-categoria (convertida em BRL).
                </p>
              </div>

              <div className="h-64 w-full flex flex-col sm:flex-row items-center justify-center gap-4">
                <div className="w-full sm:w-1/2 h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoriesData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="currentValue"
                        nameKey="category"
                      >
                        {categoriesData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: any) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                        contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '8px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-full sm:w-1/2 space-y-2">
                  {categoriesData.map((data, index) => (
                    <div key={data.category} className="flex items-center justify-between text-xs font-mono">
                      <div className="flex items-center gap-1.5">
                        <div
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="text-zinc-300 truncate max-w-[100px]">{data.category}</span>
                      </div>
                      <span className="font-semibold text-zinc-100">
                        R$ {data.currentValue.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* History Chart Row */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left: Historic deposits and equity growth line chart */}
            <div className="lg:col-span-8 bg-zinc-950/60 border border-zinc-800/80 rounded-lg p-4 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 font-sans">
                      Histórico de Aportes & Evolução do Patrimônio
                    </span>
                    <p className="text-[10px] text-zinc-500 mt-1 leading-relaxed">
                      Visualize a evolução total do seu patrimônio com cada depósito consolidado.
                    </p>
                  </div>
                  {history.length > 0 && (
                    <button
                      onClick={handleClearHistory}
                      className="text-[10px] font-semibold text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors px-2 py-1 bg-red-950/20 rounded border border-red-900/30"
                    >
                      <Trash2 className="w-3 h-3" /> Limpar
                    </button>
                  )}
                </div>

                {history.length === 0 ? (
                  <div className="h-64 flex flex-col items-center justify-center text-zinc-600 text-xs">
                    <History className="w-8 h-8 opacity-40 mb-2" />
                    <span>Nenhum aporte registrado.</span>
                    <p className="text-[10px] text-zinc-500 mt-1">Calcule um rebalanceamento e salve no histórico!</p>
                  </div>
                ) : (
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={history}
                        margin={{ top: 10, right: 10, left: -10, bottom: 5 }}
                      >
                        <defs>
                          <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                        <XAxis dataKey="date" stroke="#71717a" fontSize={10} />
                        <YAxis stroke="#71717a" fontSize={10} />
                        <Tooltip
                          formatter={(value: any) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                          contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '8px' }}
                        />
                        <Area name="Patrimônio Total" type="monotone" dataKey="totalEquity" stroke="#10b981" fillOpacity={1} fill="url(#colorEquity)" strokeWidth={2} />
                        <Line name="Aporte Realizado" type="monotone" dataKey="depositAmount" stroke="#3b82f6" strokeWidth={1.5} dot={{ r: 4 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Confirm Deposit into history helper widget */}
              {rebalanceResult && rebalanceResult.depositAmount > 0 && (
                <div className="mt-4 pt-4 border-t border-zinc-900 flex items-center justify-between text-xs bg-zinc-900/30 p-3 rounded-lg border border-zinc-800/40">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div>
                      <span className="font-semibold text-zinc-300 block">Registrar Novo Aporte?</span>
                      <span className="text-[10px] text-zinc-500">Salvar R$ {rebalanceResult.depositAmount.toLocaleString('pt-BR')} no seu histórico local</span>
                    </div>
                  </div>
                  {logSuccess ? (
                    <div className="flex items-center gap-1 text-emerald-400 font-bold bg-emerald-950/20 px-2.5 py-1.5 rounded border border-emerald-900/30 text-[11px]">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Registrado!
                    </div>
                  ) : (
                    <button
                      onClick={handleAddCurrentToHistory}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded font-medium flex items-center gap-1 transition-all cursor-pointer"
                    >
                      <PlusCircle className="w-3.5 h-3.5" /> Registrar Aporte
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Right: Convergence projection math simulator */}
            <div className="lg:col-span-4 bg-zinc-950/60 border border-zinc-800/80 rounded-lg p-4 flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 font-sans">
                  Simulador de Convergência
                </span>
                <p className="text-[10px] text-zinc-500 mt-1 leading-relaxed">
                  Demonstração matemática de como novos depósitos eliminam os desvios e reequilibram as categorias para o alvo de 100%.
                </p>

                <div className="h-56 w-full mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={getConvergenceData()}
                      margin={{ top: 10, right: 10, left: -25, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                      <XAxis dataKey="depositLabel" stroke="#71717a" fontSize={10} />
                      <YAxis stroke="#71717a" fontSize={10} unit="%" />
                      <Tooltip
                        formatter={(value: any, name: string) => 
                          name === 'Desvio Total %' ? `${value}% de desvio acumulado` : `R$ ${value.toLocaleString('pt-BR')}`
                        }
                        contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '8px' }}
                      />
                      <Bar name="Desvio Total %" dataKey="deviation" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="text-[10px] text-zinc-500 leading-relaxed bg-zinc-900/30 p-2.5 rounded-lg border border-zinc-800/40">
                <span className="font-semibold text-amber-400 block mb-0.5">💡 Como ler o gráfico:</span>
                À medida que o aporte aumenta, a linha de desvios (coluna amarela) aproxima-se de <strong className="text-emerald-400">0%</strong>, mostrando que a estratégia Buy & Hold inteligente foca apenas nos ativos retardatários até alcançar a harmonia ideal.
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
