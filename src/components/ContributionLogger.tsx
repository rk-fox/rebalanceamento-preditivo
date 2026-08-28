/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Asset } from '../types';
import { getHistory, saveHistory, logAutomatedContribution, HistorySnapshot, PT_MONTHS } from '../utils/history';
import { 
  DollarSign, 
  TrendingUp, 
  Trash2, 
  Clock, 
  Calculator, 
  Edit2, 
  Check, 
  X,
  PlusCircle
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend
} from 'recharts';

interface ContributionLoggerProps {
  assets: Asset[];
  usdToBrlRate: number;
}

export default function ContributionLogger({
  assets,
  usdToBrlRate,
}: ContributionLoggerProps) {
  const [history, setHistory] = useState<HistorySnapshot[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDeposit, setEditDeposit] = useState<string>('');
  const [editEquity, setEditEquity] = useState<string>('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Manual contribution modal/form state
  const [isAdding, setIsAdding] = useState(false);
  const now = new Date();
  const [newMonth, setNewMonth] = useState<string>(PT_MONTHS[now.getMonth()]);
  const [newYear, setNewYear] = useState<number>(now.getFullYear());
  const [newDepositAmount, setNewDepositAmount] = useState<string>('');
  const [newTotalEquity, setNewTotalEquity] = useState<string>('');

  const loadData = () => {
    setHistory(getHistory());
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener('pe_history_updated', handleUpdate);
    
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'pe_portfolio_history') {
        loadData();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('pe_history_updated', handleUpdate);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const handleEditClick = (item: HistorySnapshot) => {
    setEditingId(item.id);
    setEditDeposit(item.depositAmount.toString());
    setEditEquity(item.totalEquity.toString());
    setDeletingId(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const handleSaveEdit = (id: string) => {
    const updated = history.map(item => {
      if (item.id === id) {
        return {
          ...item,
          depositAmount: Math.max(0, parseFloat(editDeposit) || 0),
          totalEquity: Math.max(0, parseFloat(editEquity) || 0)
        };
      }
      return item;
    });
    saveHistory(updated);
    setHistory(getHistory());
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    const updated = history.filter(item => item.id !== id);
    saveHistory(updated);
    setHistory(getHistory());
    setDeletingId(null);
  };

  const handleAddManual = (e: React.FormEvent) => {
    e.preventDefault();
    const deposit = parseFloat(newDepositAmount);
    if (!deposit || isNaN(deposit) || deposit <= 0) {
      alert('Por favor, insira um valor válido para o aporte.');
      return;
    }

    const monthStr = `${newMonth} ${newYear}`;
    const equityVal = parseFloat(newTotalEquity) || 0;

    logAutomatedContribution(deposit, equityVal, monthStr);
    setHistory(getHistory());

    // Reset form
    setNewDepositAmount('');
    setNewTotalEquity('');
    setIsAdding(false);
  };

  const getBrlValue = (asset: Asset): number => {
    if (asset.currentValue !== undefined && asset.currentValue !== null) {
      return asset.currentValue;
    }
    const nativeVal = asset.invested_amount || 0;
    return asset.currency === 'USD' ? nativeVal * usdToBrlRate : nativeVal;
  };

  const calculatedCurrentEquity = assets.reduce((sum, item) => sum + getBrlValue(item), 0);
  const totalDeposited = history.reduce((sum, item) => sum + item.depositAmount, 0);
  const averageDeposit = history.length > 0 ? totalDeposited / history.length : 0;
  const lastEquity = calculatedCurrentEquity;

  let runningTotal = 0;
  const processedHistory = history.map((item, index) => {
    if (index === 0) {
      runningTotal = item.totalEquity > 0 ? item.totalEquity : item.depositAmount;
    } else {
      runningTotal += item.depositAmount;
    }
    return {
      ...item,
      aportesAnteriores: Math.max(0, runningTotal - item.depositAmount),
      aportesAcumulados: runningTotal,
      computedTotalEquity: runningTotal
    };
  });

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-zinc-950 border border-zinc-800 p-3 rounded-lg shadow-xl z-50 relative">
          <p className="text-zinc-300 font-bold mb-2 text-sm">{label}</p>
          <div className="space-y-1.5 text-xs font-mono">
            <p className="text-[#3b82f6]">Aporte do Mês: R$ {data.depositAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            <p className="text-[#10b981]">Aportes Anteriores: R$ {data.aportesAnteriores.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            <div className="border-t border-zinc-800 my-1.5 pt-1.5"></div>
            <p className="text-zinc-100 font-bold">
              Total Acumulado: R$ {data.aportesAcumulados.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  const legendPayload = [
    { value: 'Aporte do Mês', type: 'circle', id: 'depositAmount', color: '#3b82f6' },
    { value: 'Aportes Anteriores', type: 'circle', id: 'aportesAnteriores', color: '#10b981' }
  ] as any;

  return (
    <div className="space-y-6">
      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex items-center gap-3 shadow-lg">
          <div className="p-2 bg-indigo-600/10 border border-indigo-500/20 rounded-lg text-indigo-400">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-zinc-500 uppercase font-mono font-bold tracking-wider block">Total em Aportes</span>
            <span className="text-base font-bold text-zinc-100 font-mono">
              R$ {totalDeposited.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex items-center gap-3 shadow-lg">
          <div className="p-2 bg-emerald-600/10 border border-emerald-500/20 rounded-lg text-emerald-400">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-zinc-500 uppercase font-mono font-bold tracking-wider block">Patrimônio Registrado</span>
            <span className="text-base font-bold text-zinc-100 font-mono">
              R$ {lastEquity.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex items-center gap-3 col-span-1 sm:col-span-1 shadow-lg">
          <div className="p-2 bg-amber-600/10 border border-amber-500/20 rounded-lg text-amber-400">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-zinc-500 uppercase font-mono font-bold tracking-wider block">Média por Aporte</span>
            <span className="text-base font-bold text-zinc-100 font-mono">
              R$ {averageDeposit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-3 mb-4">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-indigo-400" />
              Histórico de Lançamentos
            </h3>
            <p className="text-[10px] text-zinc-500 mt-1">
              Os aportes são capturados automaticamente ao adicionar ou importar novos ativos e consolidados por mês.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAdding(!isAdding)}
              className="text-[11px] font-semibold bg-indigo-600 hover:bg-indigo-500 text-white px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors cursor-pointer shadow-sm"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>{isAdding ? 'Fechar' : 'Novo Aporte'}</span>
            </button>
            <span className="text-[10px] font-mono bg-zinc-950 px-2 py-1 rounded text-zinc-500 border border-zinc-800">
              {history.length} {history.length === 1 ? 'Mês' : 'Meses'}
            </span>
          </div>
        </div>

        {/* Formulário Manual de Novo Aporte */}
        {isAdding && (
          <form onSubmit={handleAddManual} className="bg-zinc-950/80 border border-indigo-500/30 rounded-xl p-4 mb-6 shadow-inner animate-in fade-in duration-200">
            <div className="flex items-center justify-between mb-3 border-b border-zinc-800/80 pb-2">
              <span className="text-xs font-bold text-indigo-300 uppercase tracking-wide flex items-center gap-1.5">
                <PlusCircle className="w-3.5 h-3.5" /> Adicionar / Ajustar Aporte Mensal
              </span>
              <button 
                type="button" 
                onClick={() => setIsAdding(false)} 
                className="text-zinc-500 hover:text-zinc-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-[10px] text-zinc-400 font-semibold block mb-1">Mês</label>
                <select
                  value={newMonth}
                  onChange={(e) => setNewMonth(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                >
                  {PT_MONTHS.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] text-zinc-400 font-semibold block mb-1">Ano</label>
                <input
                  type="number"
                  value={newYear}
                  onChange={(e) => setNewYear(parseInt(e.target.value, 10) || now.getFullYear())}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-[10px] text-zinc-400 font-semibold block mb-1">Valor Aportado (R$)</label>
                <input
                  type="number"
                  step="any"
                  placeholder="Ex: 1500.00"
                  value={newDepositAmount}
                  onChange={(e) => setNewDepositAmount(e.target.value)}
                  required
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="text-[10px] text-zinc-400 font-semibold block mb-1">Patrimônio Total (Opcional)</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="Ex: 20000.00"
                    value={newTotalEquity}
                    onChange={(e) => setNewTotalEquity(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors h-[34px] cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" /> Salvar
                </button>
              </div>
            </div>
          </form>
        )}

        {history.length > 0 && (
          <div className="h-64 w-full mb-8">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={processedHistory}
                margin={{ top: 10, right: 10, left: -10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="date" stroke="#71717a" fontSize={10} axisLine={false} tickLine={false} />
                <YAxis stroke="#71717a" fontSize={10} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#27272a', opacity: 0.4 }} />
                <Legend payload={legendPayload} iconType="circle" wrapperStyle={{ fontSize: '12px', color: '#a1a1aa' }} />
                <Bar name="Aporte do Mês" dataKey="depositAmount" stackId="a" fill="#3b82f6" radius={[0, 0, 4, 4]} maxBarSize={50} />
                <Bar name="Aportes Anteriores" dataKey="aportesAnteriores" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={50} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {history.length === 0 ? (
          <div className="py-12 text-center text-zinc-500 text-xs flex flex-col items-center justify-center gap-2">
            <Clock className="w-8 h-8 opacity-40 text-zinc-500" />
            <span>Nenhum aporte lançado no histórico local.</span>
            <p className="text-[10px] text-zinc-600 max-w-xs">
              Adicione ativos através da aba "Minha Carteira" ou utilize o botão "Novo Aporte" acima para registrar suas contribuições.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-400">
              <thead className="bg-zinc-950 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="p-3 rounded-l-lg">Mês/Ano</th>
                  <th className="p-3">Valor Aportado (R$)</th>
                  <th className="p-3">Aportes Consolidados (R$)</th>
                  <th className="p-3 rounded-r-lg text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 font-mono">
                {[...processedHistory].reverse().map((item) => (
                  <tr key={item.id} className="hover:bg-zinc-950/40 transition-colors">
                    <td className="p-3 font-semibold text-zinc-300">
                      <div className="flex items-center gap-2">
                        {item.date}
                        {editingId === item.id && (
                          <span className="text-[9px] bg-indigo-900/50 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-700/50 uppercase font-sans">
                            Editando
                          </span>
                        )}
                      </div>
                    </td>
                    
                    <td className="p-3">
                      {editingId === item.id ? (
                        <input
                          type="number"
                          step="any"
                          value={editDeposit}
                          onChange={(e) => setEditDeposit(e.target.value)}
                          className="w-24 bg-zinc-950 border border-indigo-500/50 rounded px-2 py-1 text-zinc-100 focus:outline-none focus:border-indigo-500"
                        />
                      ) : (
                        <span className="text-emerald-400 font-semibold">
                          {item.depositAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      )}
                    </td>

                    <td className="p-3">
                      {editingId === item.id ? (
                        <input
                          type="number"
                          step="any"
                          value={editEquity}
                          onChange={(e) => setEditEquity(e.target.value)}
                          className="w-28 bg-zinc-950 border border-indigo-500/50 rounded px-2 py-1 text-zinc-100 focus:outline-none focus:border-indigo-500"
                        />
                      ) : (
                        <span className="text-zinc-200">
                          {item.computedTotalEquity.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      )}
                    </td>

                    <td className="p-3 text-right">
                      {editingId === item.id ? (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleSaveEdit(item.id)}
                            className="p-1 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 rounded transition-colors cursor-pointer"
                            title="Salvar alterações"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="p-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 rounded transition-colors cursor-pointer"
                            title="Cancelar edição"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : deletingId === item.id ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="text-[10px] text-zinc-500 font-semibold uppercase font-sans">Excluir?</span>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="px-2 py-0.5 bg-red-600 hover:bg-red-500 text-white rounded font-sans text-[10px] font-bold transition-colors cursor-pointer"
                          >
                            Sim
                          </button>
                          <button
                            onClick={() => setDeletingId(null)}
                            className="px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 rounded font-sans text-[10px] font-bold transition-colors cursor-pointer"
                          >
                            Não
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleEditClick(item)}
                            className="text-zinc-500 hover:text-indigo-400 transition-colors p-1.5 rounded hover:bg-indigo-950/30 cursor-pointer"
                            title="Editar lançamento"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeletingId(item.id)}
                            className="text-zinc-500 hover:text-red-400 transition-colors p-1.5 rounded hover:bg-red-950/20 cursor-pointer"
                            title="Excluir lançamento"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
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
  );
}
