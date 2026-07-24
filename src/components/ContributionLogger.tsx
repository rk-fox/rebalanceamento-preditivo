/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Asset, CategoryAllocation } from '../types';
import { 
  PlusCircle, 
  Calendar, 
  DollarSign, 
  TrendingUp, 
  Trash2, 
  CheckCircle2, 
  Clock,
  ArrowUpRight,
  Calculator,
  Briefcase
} from 'lucide-react';

interface HistorySnapshot {
  id: string;
  date: string;
  depositAmount: number;
  totalEquity: number;
}

interface ContributionLoggerProps {
  assets: Asset[];
  usdToBrlRate: number;
  onHistoryChange?: () => void;
}

const DEFAULT_HISTORY: HistorySnapshot[] = [
  { id: 'h1', date: 'Abr 2026', depositAmount: 1500, totalEquity: 12000 },
  { id: 'h2', date: 'Mai 2026', depositAmount: 2000, totalEquity: 14800 },
  { id: 'h3', date: 'Jun 2026', depositAmount: 1800, totalEquity: 17200 },
];

export default function ContributionLogger({
  assets,
  usdToBrlRate,
  onHistoryChange,
}: ContributionLoggerProps) {
  const [history, setHistory] = useState<HistorySnapshot[]>([]);
  const [depositAmount, setDepositAmount] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [customEquity, setCustomEquity] = useState('');
  const [useCalculatedEquity, setUseCalculatedEquity] = useState(true);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Load history from localStorage on mount and when it updates externally
  const loadHistory = () => {
    const saved = localStorage.getItem('pe_portfolio_history');
    if (saved) {
      setHistory(JSON.parse(saved));
    } else {
      setHistory(DEFAULT_HISTORY);
      localStorage.setItem('pe_portfolio_history', JSON.stringify(DEFAULT_HISTORY));
    }
  };

  useEffect(() => {
    loadHistory();
    
    // Set default date to current month
    const today = new Date();
    const formatter = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric' });
    const formatted = formatter.format(today);
    setDateStr(formatted.charAt(0).toUpperCase() + formatted.slice(1));

    // Handle storage event for cross-component updates
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'pe_portfolio_history') {
        loadHistory();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Helper to safely get the current BRL value of an asset
  const getBrlValue = (asset: Asset): number => {
    if (asset.currentValue !== undefined && asset.currentValue !== null) {
      return asset.currentValue;
    }
    const nativeVal = asset.invested_amount || 0;
    return asset.currency === 'USD' ? nativeVal * usdToBrlRate : nativeVal;
  };

  const calculatedCurrentEquity = assets.reduce((sum, item) => sum + getBrlValue(item), 0);

  const saveHistory = (newHistory: HistorySnapshot[]) => {
    setHistory(newHistory);
    localStorage.setItem('pe_portfolio_history', JSON.stringify(newHistory));
    if (onHistoryChange) onHistoryChange();
    // Dispatch local event so other components (e.g. PortfolioCharts) receive the update immediately
    window.dispatchEvent(new Event('storage'));
  };

  const handleAddContribution = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) {
      setErrorMsg('Por favor, insira um valor de aporte válido maior que zero.');
      return;
    }

    if (!dateStr.trim()) {
      setErrorMsg('Por favor, informe o mês/ano (ex: Out 2026).');
      return;
    }

    let finalEquity = calculatedCurrentEquity;
    if (!useCalculatedEquity) {
      const parsedEquity = parseFloat(customEquity);
      if (isNaN(parsedEquity) || parsedEquity < 0) {
        setErrorMsg('Por favor, insira um valor de patrimônio total válido.');
        return;
      }
      finalEquity = parsedEquity;
    } else {
      // If using calculated equity, the total equity after the contribution is calculatedEquity + contribution amount
      finalEquity = calculatedCurrentEquity + amount;
    }

    const newContribution: HistorySnapshot = {
      id: Math.random().toString(36).substring(2, 9),
      date: dateStr.trim(),
      depositAmount: amount,
      totalEquity: finalEquity,
    };

    const updatedHistory = [...history, newContribution];
    // Sort chronologically if we want, but sticking to addition order keeps it simple and matched with graph behavior
    saveHistory(updatedHistory);

    setDepositAmount('');
    setCustomEquity('');
    setSuccessMsg('Aporte lançado com sucesso no histórico!');
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const handleDeleteContribution = (id: string) => {
    const filtered = history.filter(item => item.id !== id);
    saveHistory(filtered);
    setDeletingId(null);
  };

  // Stats calculations
  const totalDeposited = history.reduce((sum, item) => sum + item.depositAmount, 0);
  const averageDeposit = history.length > 0 ? totalDeposited / history.length : 0;
  const lastEquity = history.length > 0 ? history[history.length - 1].totalEquity : calculatedCurrentEquity;

  return (
    <div className="space-y-6">
      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex items-center gap-3">
          <div className="p-2 bg-indigo-600/10 border border-indigo-500/20 rounded-lg text-indigo-400">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-zinc-500 uppercase font-mono font-bold tracking-wider block">Total em Aportes</span>
            <span className="text-base font-bold text-zinc-100 font-mono">
              R$ {totalDeposited.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex items-center gap-3">
          <div className="p-2 bg-emerald-600/10 border border-emerald-500/20 rounded-lg text-emerald-400">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-zinc-500 uppercase font-mono font-bold tracking-wider block">Patrimônio Registrado</span>
            <span className="text-base font-bold text-zinc-100 font-mono">
              R$ {lastEquity.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex items-center gap-3 col-span-1 sm:col-span-1">
          <div className="p-2 bg-amber-600/10 border border-amber-500/20 rounded-lg text-amber-400">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-zinc-500 uppercase font-mono font-bold tracking-wider block">Média por Aporte</span>
            <span className="text-base font-bold text-zinc-100 font-mono">
              R$ {averageDeposit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Formulário de Lançamento */}
        <div className="lg:col-span-5 bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-xl h-fit">
          <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-300 border-b border-zinc-800 pb-2 mb-4 flex items-center gap-1.5">
            <PlusCircle className="w-4 h-4 text-indigo-400" />
            Lançar Novo Aporte
          </h3>

          <form onSubmit={handleAddContribution} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5">
                Valor do Aporte (R$)
              </label>
              <div className="relative rounded-lg shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500 font-mono text-xs">
                  R$
                </div>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0,00"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="block w-full pl-9 pr-4 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors font-mono text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5">
                  Mês / Ano
                </label>
                <div className="relative rounded-lg shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                    <Calendar className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Out 2026"
                    value={dateStr}
                    onChange={(e) => setDateStr(e.target.value)}
                    className="block w-full pl-9 pr-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex flex-col justify-end">
                <span className="text-[10px] text-zinc-500 leading-tight">
                  Formatado como mês abreviado e ano.
                </span>
              </div>
            </div>

            <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-850 space-y-3">
              <span className="block text-[11px] font-bold uppercase text-zinc-400">Patrimônio Total do Histórico</span>
              
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={useCalculatedEquity}
                  onChange={() => setUseCalculatedEquity(true)}
                  className="mt-0.5 accent-indigo-500 text-indigo-600"
                />
                <span className="text-xs text-zinc-300 leading-tight">
                  Calcular automaticamente <br/>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    (Carteira atual R$ {calculatedCurrentEquity.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} + Aporte)
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={!useCalculatedEquity}
                  onChange={() => setUseCalculatedEquity(false)}
                  className="mt-0.5 accent-indigo-500 text-indigo-600"
                />
                <span className="text-xs text-zinc-300 leading-tight">
                  Definir valor de patrimônio customizado
                </span>
              </label>

              {!useCalculatedEquity && (
                <div className="pt-1.5">
                  <div className="relative rounded-lg shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500 font-mono text-xs">
                      R$
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Valor total consolidado"
                      value={customEquity}
                      onChange={(e) => setCustomEquity(e.target.value)}
                      className="block w-full pl-9 pr-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors font-mono text-xs"
                    />
                  </div>
                </div>
              )}
            </div>

            {errorMsg && (
              <p className="text-xs text-red-400 font-semibold bg-red-950/20 p-2.5 rounded border border-red-900/30">
                {errorMsg}
              </p>
            )}

            {successMsg && (
              <p className="text-xs text-emerald-400 font-semibold bg-emerald-950/20 p-2.5 rounded border border-emerald-900/30 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> {successMsg}
              </p>
            )}

            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer text-xs"
            >
              <PlusCircle className="w-4 h-4" />
              Lançar e Salvar Aporte
            </button>
          </form>
        </div>

        {/* Listagem do Histórico */}
        <div className="lg:col-span-7 bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-xl">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2 mb-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-indigo-400" />
              Histórico de Lançamentos
            </h3>
            <span className="text-[10px] font-mono bg-zinc-950 px-2 py-0.5 rounded text-zinc-500 border border-zinc-800">
              {history.length} Registros
            </span>
          </div>

          {history.length === 0 ? (
            <div className="py-12 text-center text-zinc-500 text-xs flex flex-col items-center justify-center gap-2">
              <Clock className="w-8 h-8 opacity-40 text-zinc-500" />
              <span>Nenhum aporte lançado no histórico local.</span>
              <p className="text-[10px] text-zinc-600 max-w-xs">
                Insira valores de aporte no formulário ao lado para começar a registrar sua evolução patrimonial.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-zinc-400">
                <thead className="bg-zinc-950 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th className="p-3 rounded-l-lg">Mês/Ano</th>
                    <th className="p-3">Valor Aportado</th>
                    <th className="p-3">Patrimônio Consolidado</th>
                    <th className="p-3 rounded-r-lg text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 font-mono">
                  {/* Show snapshots in reverse order (newest first) */}
                  {[...history].reverse().map((item) => (
                    <tr key={item.id} className="hover:bg-zinc-950/40 transition-colors">
                      <td className="p-3 font-semibold text-zinc-300">{item.date}</td>
                      <td className="p-3 text-emerald-400 font-semibold">
                        R$ {item.depositAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-zinc-200">
                        R$ {item.totalEquity.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-right">
                        {deletingId === item.id ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <span className="text-[10px] text-zinc-500 font-semibold uppercase">Excluir?</span>
                            <button
                              onClick={() => handleDeleteContribution(item.id)}
                              className="px-2 py-0.5 bg-red-600 hover:bg-red-500 text-white rounded font-sans text-[10px] font-bold cursor-pointer transition-colors"
                            >
                              Sim
                            </button>
                            <button
                              onClick={() => setDeletingId(null)}
                              className="px-2 py-0.5 bg-zinc-800 hover:bg-zinc-750 text-zinc-400 hover:text-zinc-200 rounded font-sans text-[10px] font-bold cursor-pointer transition-colors"
                            >
                              Não
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeletingId(item.id)}
                            className="text-zinc-600 hover:text-red-400 transition-colors p-1 rounded hover:bg-red-950/20"
                            title="Excluir lançamento"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
