/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import SettingsPanel from './components/SettingsPanel';
import DataImporter from './components/DataImporter';
import AssetList from './components/AssetList';
import RebalanceEngine from './components/RebalanceEngine';
import PortfolioCharts from './components/PortfolioCharts';
import ContributionLogger from './components/ContributionLogger';
import { Asset, CategoryAllocation, RebalanceOutput } from './types';
import { ParsedAssetResult, getImportValues } from './utils/parser';
import { fetchAssets, fetchAllocations, saveAsset, deleteAssetFromDb, saveAllocations, resetLocalData, googleSignIn, logout, syncToDrive, syncFromDrive, initAuth } from './lib/storage';
import { RefreshCw, RotateCcw, Database, CheckCircle2, Cloud, LogOut, LayoutDashboard, Scale, Coins, Briefcase, Settings, Landmark } from 'lucide-react';
import { User } from 'firebase/auth';
import { getDefaultDecimals } from './utils/rebalancer';

export default function App() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [allocations, setAllocations] = useState<CategoryAllocation[]>([]);
  const [usdToBrlRate, setUsdToBrlRate] = useState<number>(5.50);
  const [rebalanceResult, setRebalanceResult] = useState<RebalanceOutput | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingQuotes, setIsLoadingQuotes] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ status: 'idle' | 'syncing' | 'success' | 'error'; message?: string }>({ status: 'idle' });
  const [user, setUser] = useState<User | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [activeTab, setActiveTab] = useState<'home' | 'rebalance' | 'contributions' | 'portfolio' | 'settings'>('home');

  // Clear success status after 4 seconds
  useEffect(() => {
    if (syncStatus.status === 'success') {
      const timer = setTimeout(() => {
        setSyncStatus({ status: 'idle' });
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [syncStatus.status]);

  // Sync / load USD rate locally
  useEffect(() => {
    const saved = localStorage.getItem('pe_usd_rate');
    if (saved) {
      setUsdToBrlRate(parseFloat(saved));
    }
  }, []);

  const handleUpdateUsdRate = (rate: number) => {
    setUsdToBrlRate(rate);
    localStorage.setItem('pe_usd_rate', rate.toString());
  };

  // Live quotes fetcher
  const fetchLiveQuotes = async (currentAssets: Asset[], currentUsdRate: number) => {
    if (currentAssets.length === 0) return;
    setIsLoadingQuotes(true);
    try {
      const response = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assets: currentAssets.map(a => ({ ticker: a.ticker, currency: a.currency, category: a.category })),
        }),
      });

      if (!response.ok) throw new Error('Failed to fetch live quotes');

      const data = await response.json() as { quotes: Record<string, number | null>; usdBrlRate: number };
      
      const newUsdRate = data.usdBrlRate || currentUsdRate;
      if (data.usdBrlRate) {
        handleUpdateUsdRate(newUsdRate);
      }

      setAssets(prev =>
        prev.map(asset => {
          const livePrice = (data.quotes && data.quotes[asset.ticker.toUpperCase()]) ?? null;
          if (livePrice !== undefined && livePrice !== null) {
            const currentValue = asset.currency === 'USD'
              ? asset.quantity * livePrice * newUsdRate
              : asset.quantity * livePrice;

            const investedBrl = asset.currency === 'USD'
              ? asset.invested_amount * newUsdRate
              : asset.invested_amount;

            const variationPercent = investedBrl > 0 ? ((currentValue / investedBrl) - 1) * 100 : 0;

            return {
              ...asset,
              livePrice,
              currentValue,
              variationPercent,
              quoteFailed: false,
            };
          } else {
            // Fallback for custom asset or fixed income (no Yahoo quote)
            const fallbackPrice = asset.quantity > 0 ? asset.invested_amount / asset.quantity : 0;
            const currentValue = asset.currency === 'USD'
              ? asset.invested_amount * newUsdRate
              : asset.invested_amount;

            return {
              ...asset,
              livePrice: fallbackPrice,
              currentValue,
              variationPercent: 0,
              quoteFailed: true,
            };
          }
        })
      );
    } catch (e) {
      console.warn('Could not fetch live market prices, calculating using fallback:', e);
      // Fallback calculation
      setAssets(prev =>
        prev.map(asset => {
          const fallbackPrice = asset.quantity > 0 ? asset.invested_amount / asset.quantity : 0;
          const currentValue = asset.currency === 'USD'
            ? asset.invested_amount * currentUsdRate
            : asset.invested_amount;

          return {
            ...asset,
            livePrice: asset.livePrice || fallbackPrice,
            currentValue: asset.currentValue || currentValue,
            variationPercent: asset.variationPercent || 0,
            quoteFailed: true,
          };
        })
      );
    } finally {
      setIsLoadingQuotes(false);
    }
  };

  useEffect(() => {
    initAuth((currentUser) => setUser(currentUser), () => setUser(null));
  }, []);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setSyncStatus({ status: 'success', message: 'Conectado ao Google Drive!' });
      }
    } catch (e) {
      console.error(e);
      setSyncStatus({ status: 'error', message: 'Erro ao conectar.' });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setSyncStatus({ status: 'idle' });
  };

  const handleSyncToDrive = async () => {
    setSyncStatus({ status: 'syncing', message: 'Verificando conexão...' });
    try {
      const ok = await syncToDrive();
      if (ok) {
        setSyncStatus({ status: 'success', message: 'Backup salvo no Google Drive!' });
      } else {
        setSyncStatus({ status: 'error', message: 'Erro ao salvar no Drive.' });
      }
    } catch (error: any) {
      if (error.message === 'TOKEN_EXPIRED') {
        setSyncStatus({ status: 'syncing', message: 'Sessão expirada. Reconectando ao Google Drive...' });
        try {
          const result = await googleSignIn();
          if (result) {
            setUser(result.user);
            setSyncStatus({ status: 'syncing', message: 'Conectado! Salvando backup...' });
            const ok = await syncToDrive();
            if (ok) {
              setSyncStatus({ status: 'success', message: 'Backup salvo no Google Drive!' });
            } else {
              setSyncStatus({ status: 'error', message: 'Erro ao salvar no Drive.' });
            }
          } else {
            setSyncStatus({ status: 'error', message: 'Erro ao re-autenticar.' });
          }
        } catch (authErr) {
          console.error('Auto-re-auth failed:', authErr);
          setSyncStatus({ status: 'error', message: 'Sessão expirada. Clique para Conectar novamente.' });
        }
      } else if (error.message === 'FORBIDDEN') {
        setSyncStatus({ status: 'error', message: 'Acesso Negado! Ative a "Google Drive API" no Google Cloud ou marque a caixa de permissão do Drive no login.' });
      } else {
        setSyncStatus({ status: 'error', message: 'Erro ao salvar no Drive.' });
      }
    }
  };

  const handleSyncFromDrive = async () => {
    setSyncStatus({ status: 'syncing', message: 'Verificando conexão...' });
    const runRestore = async () => {
      const ok = await syncFromDrive();
      if (ok) {
        setSyncStatus({ status: 'success', message: 'Dados restaurados do Drive!' });
        const loadedAssets = await fetchAssets();
        const loadedAllocations = await fetchAllocations();

        // Update decimals map in localStorage as well to keep them perfectly in sync
        const decimalsMap: Record<string, number> = {};
        loadedAllocations.forEach(alloc => {
          if (alloc.decimal_places !== undefined) {
            decimalsMap[alloc.category] = alloc.decimal_places;
          }
        });
        if (Object.keys(decimalsMap).length > 0) {
          localStorage.setItem('pe_category_decimals', JSON.stringify(decimalsMap));
        }

        setAssets(loadedAssets);
        setAllocations(loadedAllocations);
        return true;
      } else {
        setSyncStatus({ status: 'error', message: 'Nenhum backup encontrado ou erro ao restaurar.' });
        return false;
      }
    };

    try {
      await runRestore();
    } catch (error: any) {
      if (error.message === 'TOKEN_EXPIRED') {
        setSyncStatus({ status: 'syncing', message: 'Sessão expirada. Reconectando ao Google Drive...' });
        try {
          const result = await googleSignIn();
          if (result) {
            setUser(result.user);
            setSyncStatus({ status: 'syncing', message: 'Conectado! Restaurando dados...' });
            await runRestore();
          } else {
            setSyncStatus({ status: 'error', message: 'Erro ao re-autenticar.' });
          }
        } catch (authErr) {
          console.error('Auto-re-auth failed:', authErr);
          setSyncStatus({ status: 'error', message: 'Sessão expirada. Clique para Conectar novamente.' });
        }
      } else if (error.message === 'FORBIDDEN') {
        setSyncStatus({ status: 'error', message: 'Acesso Negado! Ative a "Google Drive API" no Google Cloud ou marque a caixa de permissão do Drive no login.' });
      } else {
        setSyncStatus({ status: 'error', message: 'Erro ao restaurar do Drive.' });
      }
    }
  };

  // Initial load
  useEffect(() => {
    const initData = async () => {
      setIsLoading(true);
      const loadedAssets = await fetchAssets();
      const loadedAllocations = await fetchAllocations();
      
      // Load custom decimals map from localStorage
      const savedDecimalsJson = localStorage.getItem('pe_category_decimals');
      const savedDecimals = savedDecimalsJson ? JSON.parse(savedDecimalsJson) : {};

      const mergedAllocations = loadedAllocations.map(alloc => {
        const dec = alloc.decimal_places !== undefined 
          ? alloc.decimal_places 
          : (savedDecimals[alloc.category] !== undefined 
              ? savedDecimals[alloc.category] 
              : getDefaultDecimals(alloc.category));
        return {
          ...alloc,
          decimal_places: dec
        };
      });

      setAssets(loadedAssets);
      setAllocations(mergedAllocations);
      setIsLoading(false);

      // Trigger quote update
      await fetchLiveQuotes(loadedAssets, usdToBrlRate);
    };
    initData();
  }, []);

  // List of unique categories derived from current assets and allocations
  const availableCategories = Array.from(
    new Set([
      ...allocations.map(a => a.category),
      ...assets.map(a => a.category),
    ])
  ).filter(cat => cat !== '');

  // Quarantine Toggle Handler
  const handleToggleQuarantine = async (id: string) => {
    const asset = assets.find(a => a.id === id);
    if (!asset) return;

    const updatedAsset = {
      ...asset,
      is_quarantined: !asset.is_quarantined,
    };

    // Optimistic UI
    setAssets(prev => prev.map(a => a.id === id ? updatedAsset : a));
    
    try {
      await saveAsset(updatedAsset);
    } catch (err: any) {
      console.error(err);
      setSyncStatus({ 
        status: 'error', 
        message: `Erro ao salvar quarentena no Supabase: ${err.message || err.details || JSON.stringify(err)}. Salvo apenas localmente.` 
      });
    }
  };

  // Update Score Handler
  const handleUpdateScore = async (id: string, newScore: number) => {
    const asset = assets.find(a => a.id === id);
    if (!asset) return;

    const updatedAsset = {
      ...asset,
      score: newScore,
    };

    // Optimistic UI
    setAssets(prev => prev.map(a => a.id === id ? updatedAsset : a));
    
    try {
      await saveAsset(updatedAsset);
    } catch (err: any) {
      console.error(err);
      setSyncStatus({ 
        status: 'error', 
        message: `Erro ao atualizar nota no Supabase: ${err.message || err.details || JSON.stringify(err)}. Salvo apenas localmente.` 
      });
    }
  };

  // Add Manual Asset Handler
  const handleAddAsset = async (newAsset: Omit<Asset, 'id'>) => {
    const id = String(Date.now()) + '-' + Math.random().toString(36).substring(2, 9);
    const assetWithId: Asset = {
      ...newAsset,
      id,
    };

    // UI State first for responsiveness
    setAssets(prev => {
      const idx = prev.findIndex(a => a.ticker.toUpperCase() === newAsset.ticker.toUpperCase());
      if (idx !== -1) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], ...newAsset };
        return copy;
      }
      return [...prev, assetWithId];
    });

    try {
      await saveAsset(assetWithId);
    } catch (err: any) {
      console.error(err);
      setSyncStatus({ 
        status: 'error', 
        message: `Erro ao salvar ativo no Supabase: ${err.message || err.details || JSON.stringify(err)}. Salvo apenas localmente.` 
      });
    }

    // Refresh quotes to fetch dynamic price
    const reloaded = await fetchAssets();
    setAssets(reloaded);
    await fetchLiveQuotes(reloaded, usdToBrlRate);
  };

  // Delete Asset Handler
  const handleDeleteAsset = async (id: string) => {
    // Optimistic UI
    setAssets(prev => prev.filter(a => a.id !== id));
    
    try {
      await deleteAssetFromDb(id);
    } catch (err: any) {
      console.error(err);
      setSyncStatus({ 
        status: 'error', 
        message: `Erro ao deletar no Supabase: ${err.message || err.details || JSON.stringify(err)}. Removido apenas localmente.` 
      });
    }
    
    const reloaded = await fetchAssets();
    setAssets(reloaded);
    await fetchLiveQuotes(reloaded, usdToBrlRate);
  };

  // Data Importer Merge Handler
  const handleImportAssets = async (parsedAssets: ParsedAssetResult[], importMode: 'replace' | 'accumulate') => {
    setIsLoadingQuotes(true);
    
    try {
      for (const parsed of parsedAssets) {
        const existing = assets.find(a => a.ticker.toUpperCase() === parsed.ticker.toUpperCase());
        const { quantity: importQty, value: importValue } = getImportValues(parsed, importMode);
        let finalAsset: Asset;

        if (existing) {
          if (importMode === 'replace') {
            finalAsset = {
              ...existing,
              category: parsed.category,
              quantity: importQty,
              invested_amount: importValue,
            };
          } else {
            finalAsset = {
              ...existing,
              category: parsed.category,
              quantity: existing.quantity + importQty,
              invested_amount: existing.invested_amount + importValue,
            };
          }
        } else {
          finalAsset = {
            id: String(Date.now()) + '-' + Math.random().toString(36).substring(2, 9),
            ticker: parsed.ticker.toUpperCase(),
            category: parsed.category,
            quantity: importQty,
            currency: parsed.currency,
            invested_amount: importValue,
            score: 10,
            is_quarantined: false,
          };
        }

        await saveAsset(finalAsset);
      }
      
    } catch (err: any) {
      console.error(err);
      setSyncStatus({ 
        status: 'error', 
        message: `Erro ao importar para o Supabase: ${err.message || err.details || JSON.stringify(err)}. Ativos salvos localmente.` 
      });
    }

    const reloaded = await fetchAssets();
    setAssets(reloaded);
    await fetchLiveQuotes(reloaded, usdToBrlRate);
  };

  // Save Allocations
  const handleUpdateAllocations = async (updated: CategoryAllocation[]) => {
    // Save decimals map to localStorage to preserve custom decimal settings
    const decimalsMap: Record<string, number> = {};
    const updatedWithDecimals = updated.map(alloc => {
      const dec = alloc.decimal_places !== undefined 
        ? alloc.decimal_places 
        : getDefaultDecimals(alloc.category);
      decimalsMap[alloc.category] = dec;
      return {
        ...alloc,
        decimal_places: dec
      };
    });

    setAllocations(updatedWithDecimals);
    localStorage.setItem('pe_category_decimals', JSON.stringify(decimalsMap));
    
    try {
      await saveAllocations(updatedWithDecimals);
    } catch (err: any) {
      console.error(err);
      setSyncStatus({ 
        status: 'error', 
        message: `Erro ao salvar alocações no Supabase: ${err.message || err.details || JSON.stringify(err)}. Alocações salvas apenas localmente.` 
      });
    }
  };

  // Refresh Trigger
  const handleRefreshQuotes = async () => {
    await fetchLiveQuotes(assets, usdToBrlRate);
  };

  // Reset to default pre-seeded demo data helper
  const handleResetDemoData = async () => {
    resetLocalData();
    const freshAssets = await fetchAssets();
    const freshAllocations = await fetchAllocations();
    setAssets(freshAssets);
    setAllocations(freshAllocations);
    setRebalanceResult(null);
    await fetchLiveQuotes(freshAssets, usdToBrlRate);
  };

  return (
    <div id="app-root" className="min-h-screen bg-zinc-950 text-zinc-300 flex flex-col lg:flex-row font-sans">
      
      {/* 1. Menu Lateral para Telas Grandes (Sidebar) */}
      <aside id="sidebar-nav" className="hidden lg:flex flex-col w-64 bg-zinc-950 border-r border-zinc-900 h-screen sticky top-0 p-6 z-40 shrink-0 justify-between">
        <div className="space-y-8">
          {/* Branding */}
          <div className="flex items-center gap-2.5">
            <div className="bg-indigo-600/10 border border-indigo-500/20 p-2 rounded-xl">
              <Landmark className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-zinc-100 tracking-tight font-sans">
                Rebalanceamento Preditivo
              </h1>
              <span className="text-[9px] text-zinc-500 font-mono block uppercase">Estratégia Buy & Hold</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            <button
              onClick={() => setActiveTab('home')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeTab === 'home'
                  ? 'bg-indigo-600 text-white shadow-lg'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Início</span>
            </button>
            <button
              onClick={() => setActiveTab('rebalance')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeTab === 'rebalance'
                  ? 'bg-indigo-600 text-white shadow-lg'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40'
              }`}
            >
              <Scale className="w-4 h-4" />
              <span>Sugestão de Compra</span>
            </button>
            <button
              onClick={() => setActiveTab('contributions')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeTab === 'contributions'
                  ? 'bg-indigo-600 text-white shadow-lg'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40'
              }`}
            >
              <Coins className="w-4 h-4" />
              <span>Lançar Aportes</span>
            </button>
            <button
              onClick={() => setActiveTab('portfolio')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeTab === 'portfolio'
                  ? 'bg-indigo-600 text-white shadow-lg'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40'
              }`}
            >
              <Briefcase className="w-4 h-4" />
              <span>Minha Carteira</span>
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-indigo-600 text-white shadow-lg'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Configurações</span>
            </button>
          </nav>
        </div>

        {/* Sync / Storage info summary */}
        <div className="pt-4 border-t border-zinc-900 space-y-3">
          <div className={`p-3 rounded-xl border text-[10px] ${
            user 
              ? 'bg-blue-950/10 border-blue-800/10 text-blue-400' 
              : 'bg-amber-950/10 border-amber-800/10 text-amber-400'
          }`}>
            <span className="font-semibold block text-zinc-300">
              {user ? 'Backup em Nuvem' : 'Armazenamento Local'}
            </span>
            <span className="text-[9px] text-zinc-500 block mt-1 truncate">
              {user ? user.email : 'Salvo apenas no navegador'}
            </span>
          </div>
          <div className="text-[9px] text-zinc-600 font-mono text-center">
            PREDICTIVE ENGINE v1.2
          </div>
        </div>
      </aside>

      {/* 2. Barra de Navegação Inferior para Celular (Bottom Navbar) */}
      <nav id="bottom-navbar" className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-zinc-950/95 border-t border-zinc-900 backdrop-blur-md px-3 py-2 flex items-center justify-around pb-safe">
        <button
          onClick={() => setActiveTab('home')}
          className={`flex flex-col items-center gap-1 p-1 transition-all cursor-pointer ${
            activeTab === 'home' ? 'text-indigo-400 font-bold' : 'text-zinc-500'
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[9px]">Início</span>
        </button>
        <button
          onClick={() => setActiveTab('rebalance')}
          className={`flex flex-col items-center gap-1 p-1 transition-all cursor-pointer ${
            activeTab === 'rebalance' ? 'text-indigo-400 font-bold' : 'text-zinc-500'
          }`}
        >
          <Scale className="w-5 h-5" />
          <span className="text-[9px]">Sugestão</span>
        </button>
        <button
          onClick={() => setActiveTab('contributions')}
          className={`flex flex-col items-center gap-1 p-1 transition-all cursor-pointer ${
            activeTab === 'contributions' ? 'text-indigo-400 font-bold' : 'text-zinc-500'
          }`}
        >
          <Coins className="w-5 h-5" />
          <span className="text-[9px]">Aportes</span>
        </button>
        <button
          onClick={() => setActiveTab('portfolio')}
          className={`flex flex-col items-center gap-1 p-1 transition-all cursor-pointer ${
            activeTab === 'portfolio' ? 'text-indigo-400 font-bold' : 'text-zinc-500'
          }`}
        >
          <Briefcase className="w-5 h-5" />
          <span className="text-[9px]">Carteira</span>
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex flex-col items-center gap-1 p-1 transition-all cursor-pointer ${
            activeTab === 'settings' ? 'text-indigo-400 font-bold' : 'text-zinc-500'
          }`}
        >
          <Settings className="w-5 h-5" />
          <span className="text-[9px]">Ajustes</span>
        </button>
      </nav>

      {/* Main Page Area */}
      <div className="flex-1 flex flex-col min-h-screen pb-24 lg:pb-0 overflow-x-hidden">
        
        {/* Barra Superior para Mobile */}
        <header id="mobile-header" className="lg:hidden bg-zinc-950 border-b border-zinc-900 px-4 py-3.5 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-2">
            <Landmark className="w-5 h-5 text-indigo-400" />
            <span className="text-sm font-bold text-zinc-100 tracking-tight font-sans">
              Predictive Engine
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefreshQuotes}
              disabled={isLoadingQuotes || assets.length === 0}
              className="p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-40 cursor-pointer flex items-center"
              title="Atualizar cotações"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingQuotes ? 'animate-spin text-indigo-400' : ''}`} />
            </button>
          </div>
        </header>

        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 text-zinc-500 gap-2">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
            <p className="text-xs font-mono">Carregando carteira de investimentos...</p>
          </div>
        ) : (
          <div className="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl w-full mx-auto space-y-6">
            
            {/* TAB 1: INÍCIO (DASHBOARD & PATRIMÔNIO) */}
            {activeTab === 'home' && (
              <div className="space-y-6">
                {/* Premium Strategy Header */}
                <Header
                  assets={assets}
                  allocations={allocations}
                  usdToBrlRate={usdToBrlRate}
                />

                {/* Quick Actions Row */}
                <div className="flex justify-between items-center bg-zinc-900/10 p-3 rounded-xl border border-zinc-900/60">
                  <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">
                    Estratégia Buy &amp; Hold &bull; Cotações em Tempo Real
                  </span>
                  <button
                    onClick={handleRefreshQuotes}
                    disabled={isLoadingQuotes || assets.length === 0}
                    className="bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 text-zinc-300 border border-zinc-800 rounded-lg px-4 py-1.5 flex items-center gap-2 transition-all font-semibold cursor-pointer text-xs"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingQuotes ? 'animate-spin text-indigo-400' : ''}`} />
                    {isLoadingQuotes ? 'Atualizando...' : 'Atualizar Cotações'}
                  </button>
                </div>

                {/* Portfolio Charts Visualizations */}
                <div className="w-full">
                  <PortfolioCharts
                    assets={assets}
                    allocations={allocations}
                    usdToBrlRate={usdToBrlRate}
                    rebalanceResult={rebalanceResult}
                  />
                </div>
              </div>
            )}

            {/* TAB 2: SUGESTÃO DE COMPRA (MATH ENGINE) */}
            {activeTab === 'rebalance' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-zinc-100 tracking-tight font-sans">
                    Sugestão de Compra & Rebalanceamento
                  </h2>
                  <p className="text-xs text-zinc-400 mt-1">
                    Defina o valor disponível para investir e deixe que o algoritmo de mochila (Knapsack) indique exatamente quanto e em quais ativos alocar os recursos para aproximar seu portfólio dos pesos alvo estabelecidos.
                  </p>
                </div>

                <div className="max-w-4xl">
                  <RebalanceEngine
                    assets={assets}
                    allocations={allocations}
                    onCalculationTrigger={setRebalanceResult}
                    rebalanceResult={rebalanceResult}
                    usdToBrlRate={usdToBrlRate}
                  />
                </div>
              </div>
            )}

            {/* TAB 3: LANÇAR APORTES (HISTORY RECORDER) */}
            {activeTab === 'contributions' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-zinc-100 tracking-tight font-sans">
                    Lançar Aportes & Histórico
                  </h2>
                  <p className="text-xs text-zinc-400 mt-1">
                    Registre os depósitos realizados em seu histórico pessoal de investimentos. Você pode definir os valores manualmente ou calcular as estimativas com base no patrimônio acumulado da sua carteira em cada período.
                  </p>
                </div>

                <ContributionLogger
                  assets={assets}
                  usdToBrlRate={usdToBrlRate}
                />
              </div>
            )}

            {/* TAB 4: CARTEIRA (ASSETS LIST & IMPORT) */}
            {activeTab === 'portfolio' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-zinc-100 tracking-tight font-sans">
                      Composição da Carteira
                    </h2>
                    <p className="text-xs text-zinc-400 mt-1">
                      Cadastre, altere a nota de relevância de cada ativo ou gerencie os bloqueios na quarentena. Você também pode colar as cotações diretamente do seu broker para carregar novos ativos.
                    </p>
                  </div>
                  
                  <button
                    onClick={handleRefreshQuotes}
                    disabled={isLoadingQuotes || assets.length === 0}
                    className="bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 text-zinc-200 border border-zinc-800 rounded-lg px-4 py-2 flex items-center justify-center gap-2 transition-all font-semibold cursor-pointer text-xs self-start sm:self-auto"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingQuotes ? 'animate-spin text-indigo-400' : ''}`} />
                    Forçar Recarga de Preços
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                  {/* Inventory List (Col Span 8) */}
                  <div className="lg:col-span-8">
                    <AssetList
                      assets={assets}
                      onToggleQuarantine={handleToggleQuarantine}
                      onUpdateScore={handleUpdateScore}
                      onAddAsset={handleAddAsset}
                      onDeleteAsset={handleDeleteAsset}
                      categories={allocations.map(a => a.category)}
                      usdToBrlRate={usdToBrlRate}
                      isLoadingQuotes={isLoadingQuotes}
                    />
                  </div>

                  {/* Broker Text Importer (Col Span 4) */}
                  <div className="lg:col-span-4 space-y-6">
                    <DataImporter
                      onImportAssets={handleImportAssets}
                      usdToBrlRate={usdToBrlRate}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: CONFIGURAÇÕES (PARAMETERS & TARGETS) */}
            {activeTab === 'settings' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-zinc-100 tracking-tight font-sans">
                    Parâmetros & Ajustes do Sistema
                  </h2>
                  <p className="text-xs text-zinc-400 mt-1">
                    Gerencie as alocações ideais do portfólio, configure as preferências de arredondamento de cotações para cada categoria e faça backup dos dados.
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                  {/* Targets & Decimal places (Col Span 7) */}
                  <div className="lg:col-span-7">
                    <SettingsPanel
                      allocations={allocations}
                      onUpdateAllocations={handleUpdateAllocations}
                      usdToBrlRate={usdToBrlRate}
                      onUpdateUsdRate={handleUpdateUsdRate}
                      availableCategories={availableCategories}
                    />
                  </div>

                  {/* Sync drive & utilities (Col Span 5) */}
                  <div className="lg:col-span-5 space-y-6">
                    
                    {/* Cloud Storage integration panel */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-xl space-y-4">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-300 border-b border-zinc-800 pb-2">
                        Integração Google Drive
                      </h3>
                      <p className="text-xs text-zinc-400 leading-relaxed">
                        Sua carteira pode ser sincronizada de forma segura com sua conta Google. Backups criptografados são salvos diretamente no seu espaço privado do Drive (App Data Folder).
                      </p>
                      
                      <div className="pt-2 flex flex-col gap-3">
                        {user ? (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between text-xs font-mono bg-zinc-950 p-3 rounded-lg border border-zinc-850">
                              <span className="text-zinc-500">Logado:</span>
                              <span className="text-zinc-200 font-semibold">{user.email}</span>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={handleSyncToDrive} className="flex-1 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors font-semibold text-xs cursor-pointer text-center">
                                Salvar Backup Now
                              </button>
                              <button onClick={handleSyncFromDrive} className="flex-1 px-3 py-2 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition-colors font-semibold text-xs cursor-pointer text-center">
                                Restaurar do Drive
                              </button>
                            </div>
                            <button onClick={handleLogout} className="w-full text-center text-xs text-red-400 hover:text-red-300 font-semibold py-1.5 transition-colors cursor-pointer">
                              Desconectar Conta Google
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={handleLogin}
                            disabled={isLoggingIn}
                            className="w-full bg-white text-black font-semibold py-2.5 rounded-lg hover:bg-zinc-200 transition-colors text-xs cursor-pointer flex items-center justify-center gap-2"
                          >
                            <Cloud className="w-4 h-4 text-black" />
                            {isLoggingIn ? 'Conectando ao Drive...' : 'Conectar com Conta Google'}
                          </button>
                        )}

                        {/* Sync Status Feedback */}
                        {syncStatus.status !== 'idle' && (
                          <div className={`text-xs flex items-start gap-2 p-3 rounded-lg border ${
                            syncStatus.status === 'syncing' ? 'bg-zinc-950 border-zinc-850 text-zinc-400' :
                            syncStatus.status === 'success' ? 'bg-emerald-950/50 border-emerald-900/30 text-emerald-300' :
                            'bg-red-950/50 border-red-900/30 text-red-300'
                          }`}>
                            <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                              syncStatus.status === 'syncing' ? 'bg-zinc-400 animate-pulse' :
                              syncStatus.status === 'success' ? 'bg-emerald-400' :
                              'bg-red-400'
                            }`} />
                            <div className="flex-1">
                              <span className="font-semibold block text-[11px] text-zinc-300 uppercase font-mono tracking-wider mb-0.5">
                                {syncStatus.status === 'syncing' && 'Sincronizando...'}
                                {syncStatus.status === 'success' && 'Sucesso!'}
                                {syncStatus.status === 'error' && 'Erro'}
                              </span>
                              <span className="text-[10px] text-zinc-400 font-sans block leading-relaxed">
                                {syncStatus.status === 'syncing' && 'Comunicação ativa com o Google Drive, por favor aguarde.'}
                                {syncStatus.status === 'success' && (syncStatus.message || 'Alterações persistidas com segurança.')}
                                {syncStatus.status === 'error' && (syncStatus.message || 'Verifique as permissões de acesso ou tente novamente.')}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>



                  </div>
                </div>
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
}
