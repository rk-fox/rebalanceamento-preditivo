/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Asset, Currency } from '../types';
import { parseBrokerText, ParsedAssetResult, getImportValues } from '../utils/parser';
import { FileText, Clipboard, AlertCircle, Check, HelpCircle, CornerDownRight, RefreshCw, Layers } from 'lucide-react';

interface DataImporterProps {
  onImportAssets: (parsedAssets: ParsedAssetResult[], importMode: 'replace' | 'accumulate') => void;
  usdToBrlRate: number;
  categories: string[];
}

export default function DataImporter({ onImportAssets, usdToBrlRate, categories }: DataImporterProps) {
  const [inputText, setInputText] = useState('');
  const [parsedResults, setParsedResults] = useState<ParsedAssetResult[]>([]);
  const [importMode, setImportMode] = useState<'replace' | 'accumulate'>('replace');
  const [showHelp, setShowHelp] = useState(false);
  const [activeTab, setActiveTab] = useState<'text' | 'manual'>('text');
  
  // For manual accumulation
  const [manualTicker, setManualTicker] = useState('');
  const [manualCategory, setManualCategory] = useState('');
  const [manualQty, setManualQty] = useState<number | ''>('');
  const [manualCurrency, setManualCurrency] = useState<Currency>('BRL');
  const [manualValue, setManualValue] = useState<number | ''>('');
  const [manualDate, setManualDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Parse action
  const handleParse = () => {
    const results = parseBrokerText(inputText, usdToBrlRate);
    setParsedResults(results);
  };

  const loadSampleData = () => {
    const sample = `WEGE3
Ações
Compra
120
R$ 40,00
R$ 4.800,00
2,0%
25/06/2026
manual
HGLG11
FIIs
Compra
25
R$ 160,00
R$ 4.000,00
1,5%
25/06/2026
manual
O
Reits
Compra
15
US$ 60,00
US$ 900,00
1,8%
25/06/2026
manual`;
    setInputText(sample);
    const results = parseBrokerText(sample, usdToBrlRate);
    setParsedResults(results);
  };

  const handleImportCommit = () => {
    if (parsedResults.length === 0) return;
    onImportAssets(parsedResults, importMode);
    // Clear inputs
    setInputText('');
    setParsedResults([]);
    alert(`${parsedResults.length} ativos importados com sucesso!`);
  };

  const handleValueChange = (index: number, field: keyof ParsedAssetResult, value: any) => {
    const updated = [...parsedResults];
    const item = { ...updated[index], [field]: value };
    
    // Recalculate BRL total if original value or currency changed
    if (field === 'originalValue' || field === 'currency') {
      const isUSD = item.currency === 'USD';
      item.totalValueBRL = isUSD ? item.originalValue * usdToBrlRate : item.originalValue;
    }

    updated[index] = item as ParsedAssetResult;
    setParsedResults(updated);
  };

  const handleRemoveItem = (index: number) => {
    const updated = parsedResults.filter((_, i) => i !== index);
    setParsedResults(updated);
  };

  const handleManualAccumulate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTicker.trim() || !manualCategory || manualQty === '' || manualValue === '') return;

    const parsedAsset: ParsedAssetResult = {
      ticker: manualTicker.trim().toUpperCase(),
      category: manualCategory,
      action: 'compra',
      quantity: parseFloat(manualQty.toString()),
      currency: manualCurrency,
      originalValue: parseFloat(manualValue.toString()),
      totalValueBRL: manualCurrency === 'USD' ? parseFloat(manualValue.toString()) * usdToBrlRate : parseFloat(manualValue.toString()),
      date: manualDate,
    };

    onImportAssets([parsedAsset], 'accumulate');
    
    // Reset form
    setManualTicker('');
    setManualQty('');
    setManualValue('');
    alert(`Posição de ${parsedAsset.ticker} acumulada com sucesso!`);
  };

  return (
    <div id="data-importer" className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl transition-all duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 border-b border-zinc-800 pb-3 gap-3">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-indigo-400" />
          <h2 className="text-lg font-semibold text-zinc-100 font-sans">Adicionar / Importar</h2>
        </div>
        <div className="flex bg-zinc-950 p-1 rounded-lg border border-zinc-800">
          <button
            onClick={() => setActiveTab('text')}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${activeTab === 'text' ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            Leitura de Texto
          </button>
          <button
            onClick={() => {
              setActiveTab('manual');
              if (!manualCategory && categories && categories.length > 0) setManualCategory(categories[0]);
            }}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${activeTab === 'manual' ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            Lançamento Manual
          </button>
        </div>
      </div>

      {activeTab === 'text' && (
        <>
          <div className="flex justify-end mb-2">
            <button
              onClick={() => setShowHelp(!showHelp)}
              className="text-zinc-400 hover:text-zinc-200 p-1 rounded-lg flex items-center gap-1 text-xs"
              title="Ver formato suportado"
            >
              <HelpCircle className="w-4 h-4" />
              <span>Ver Formato</span>
            </button>
          </div>


      {showHelp && (
        <div className="bg-zinc-950 border border-zinc-800/80 p-3 rounded-lg text-xs text-zinc-400 mb-4 space-y-2 animate-fade-in leading-relaxed">
          <p className="font-semibold text-zinc-300">Formato esperado pelo leitor de texto:</p>
          <div className="bg-zinc-900 p-2 rounded text-[11px] font-mono whitespace-pre text-zinc-500 overflow-x-auto">
            [Ticker] (ex: VALE3)<br />
            [Categoria] (ex: Ações)<br />
            Compra<br />
            [Quantidade] (ex: 50)<br />
            [Preço Unitário] (ex: R$ 62,00)<br />
            [Valor Total] (ex: R$ 3.100,00)<br />
            [Porcentagem] (ex: 1,2%)<br />
            [Data] (ex: 25/06/2026)<br />
            manual
          </div>
          <p>
            O leitor identifica moedas <code className="text-indigo-400 font-mono">US$</code> e <code className="text-emerald-400 font-mono">R$</code>, converte USD para BRL usando a cotação configurada e permite conferir antes de salvar.
          </p>
        </div>
      )}

      {parsedResults.length === 0 ? (
        <div className="space-y-4">
          <div className="relative">
            <textarea
              id="raw-paste-textarea"
              placeholder="Cole o texto copiado da sua corretora/extrato aqui..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="w-full h-40 bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 font-mono resize-none"
            />
            {inputText === '' && (
              <button
                type="button"
                onClick={loadSampleData}
                className="absolute right-3 bottom-3 text-[10px] bg-zinc-800 hover:bg-zinc-700 text-indigo-400 border border-zinc-700 px-2 py-1 rounded transition-all flex items-center gap-1 font-mono"
              >
                <Clipboard className="w-3 h-3" />
                Carregar Exemplo
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handleParse}
            disabled={!inputText.trim()}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-medium text-xs py-2.5 rounded-lg transition-colors flex items-center justify-center gap-1.5"
          >
            Processar Texto
          </button>
        </div>
      ) : (
        <div className="space-y-4 animate-fade-in">
          {/* Review Banner */}
          <div className="flex items-center gap-2 bg-indigo-950/20 border border-indigo-800/40 p-3 rounded-lg text-xs text-indigo-400">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Revise as posições identificadas abaixo. Você pode alterar valores antes de confirmar a importação.</span>
          </div>

          {/* Table of Parsed Assets */}
          <div className="overflow-x-auto border border-zinc-800 rounded-lg max-h-64 overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-zinc-950 text-zinc-400 border-b border-zinc-800 font-sans font-medium">
                  <th className="p-2">Ativo</th>
                  <th className="p-2">Categoria</th>
                  <th className="p-2 text-center">Qtd</th>
                  <th className="p-2 text-right">Valor (Orig)</th>
                  <th className="p-2 text-right">Valor (BRL)</th>
                  <th className="p-2 text-center">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 font-mono">
                {parsedResults.map((item, idx) => {
                  const isUSD = item.currency === 'USD';
                  
                  // Compute display values using the robust getImportValues helper
                  const { quantity: displayQty, value: displayValue } = getImportValues(item, importMode);

                  const displayValueBRL = isUSD ? displayValue * usdToBrlRate : displayValue;

                  return (
                    <tr key={idx} className="hover:bg-zinc-800/30">
                      <td className="p-2">
                        <input
                          type="text"
                          value={item.ticker}
                          onChange={(e) => handleValueChange(idx, 'ticker', e.target.value.toUpperCase())}
                          className="w-16 bg-zinc-800 border border-zinc-700 rounded px-1 py-0.5 text-zinc-100 text-[11px] text-center uppercase"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={item.category}
                          onChange={(e) => handleValueChange(idx, 'category', e.target.value)}
                          className="w-24 bg-zinc-800 border border-zinc-700 rounded px-1.5 py-0.5 text-zinc-200 text-[11px]"
                        />
                      </td>
                      <td className="p-2 text-center">
                        <input
                          type="number"
                          step="any"
                          value={displayQty}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            handleValueChange(idx, 'quantity', val);
                          }}
                          className="w-12 bg-zinc-800 border border-zinc-700 rounded px-1 py-0.5 text-zinc-100 text-[11px] text-center"
                        />
                      </td>
                      <td className="p-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <select
                            value={item.currency}
                            onChange={(e) => handleValueChange(idx, 'currency', e.target.value as Currency)}
                            className="bg-zinc-850 border border-zinc-700 rounded text-[10px] py-0.5 px-0.5 text-zinc-300"
                          >
                            <option value="BRL">R$</option>
                            <option value="USD">US$</option>
                          </select>
                          <input
                            type="number"
                            step="any"
                            value={displayValue}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              handleValueChange(idx, 'originalValue', val);
                            }}
                            className="w-16 bg-zinc-800 border border-zinc-700 rounded px-1 py-0.5 text-zinc-100 text-[11px] text-right"
                          />
                        </div>
                      </td>
                      <td className="p-2 text-right text-zinc-300 font-medium">
                        R$ {displayValueBRL.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-2 text-center">
                        <button
                          onClick={() => handleRemoveItem(idx)}
                          className="text-zinc-500 hover:text-red-400 text-xs px-1 hover:bg-zinc-800 rounded transition-colors"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Import Modes and Actions */}
          <div className="flex flex-col gap-3 bg-zinc-950/40 p-3 rounded-lg border border-zinc-800/80">
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400 font-medium font-sans">Modo de Importação:</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setImportMode('replace')}
                  className={`px-2.5 py-1 text-[10px] rounded transition-all flex items-center gap-1 font-sans ${
                    importMode === 'replace'
                      ? 'bg-indigo-600 text-white font-medium shadow'
                      : 'bg-zinc-850 text-zinc-400 hover:bg-zinc-800'
                  }`}
                  title="Substituir posições existentes pelos valores importados"
                >
                  <RefreshCw className="w-3 h-3" />
                  Substituir Posições
                </button>
                <button
                  type="button"
                  onClick={() => setImportMode('accumulate')}
                  className={`px-2.5 py-1 text-[10px] rounded transition-all flex items-center gap-1 font-sans ${
                    importMode === 'accumulate'
                      ? 'bg-indigo-600 text-white font-medium shadow'
                      : 'bg-zinc-850 text-zinc-400 hover:bg-zinc-800'
                  }`}
                  title="Somar as novas posições às já existentes"
                >
                  <Layers className="w-3 h-3" />
                  Acumular Posições
                </button>
              </div>
            </div>
            
            <p className="text-[10px] text-zinc-500 italic leading-snug">
              {importMode === 'replace' 
                ? "* Sobrescreve quantidade e valor total dos tickers correspondentes. Cria novos se não existirem."
                : "* Soma quantidade e valor aos ativos existentes na carteira."
              }
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setParsedResults([])}
              className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs py-2 rounded-lg transition-colors font-medium font-sans"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleImportCommit}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs py-2 rounded-lg transition-colors font-medium font-sans flex items-center justify-center gap-1"
            >
              <Check className="w-4 h-4" />
              Confirmar {parsedResults.length} Ativos
            </button>
          </div>
        </div>
      )}
      </>
      )}

      {activeTab === 'manual' && (
        <form onSubmit={handleManualAccumulate} className="space-y-4 animate-fade-in">
          <div className="bg-indigo-950/20 border border-indigo-800/40 p-3 rounded-lg text-xs text-indigo-400 mb-4">
            Este formulário é focado em <strong>Acumular Posições</strong>. Os valores digitados aqui serão somados aos ativos já existentes na sua carteira. Se o ativo não existir, ele será criado.
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] text-zinc-400 font-medium mb-1 uppercase font-sans">Ticker</label>
              <input
                type="text"
                placeholder="WEGE3"
                value={manualTicker}
                onChange={(e) => setManualTicker(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500 uppercase font-mono"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] text-zinc-400 font-medium mb-1 uppercase font-sans">Categoria</label>
              <select
                value={manualCategory}
                onChange={(e) => setManualCategory(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
                required
              >
                <option value="" disabled>Selecione a categoria</option>
                {categories && categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
                {(!categories || !categories.includes(manualCategory)) && manualCategory && (
                  <option value={manualCategory}>{manualCategory}</option>
                )}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-zinc-400 font-medium mb-1 uppercase font-sans">Quantidade a Somar</label>
              <input
                type="number"
                step="any"
                placeholder="Ex: 50"
                value={manualQty}
                onChange={(e) => setManualQty(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500 font-mono"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] text-zinc-400 font-medium mb-1 uppercase font-sans">Moeda</label>
              <select
                value={manualCurrency}
                onChange={(e) => setManualCurrency(e.target.value as Currency)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500 font-mono"
              >
                <option value="BRL">BRL (R$)</option>
                <option value="USD">USD (US$)</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-zinc-400 font-medium mb-1 uppercase font-sans">Data do Lançamento</label>
              <input
                type="date"
                value={manualDate}
                onChange={(e) => setManualDate(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500 font-mono"
                required
              />
            </div>
            <div className="col-span-2">
              <label className="block text-[10px] text-zinc-400 font-medium mb-1 uppercase font-sans">
                Valor Total do Aporte ({manualCurrency === 'USD' ? 'US$' : 'R$'})
              </label>
              <input
                type="number"
                step="any"
                placeholder="Ex: 2000"
                value={manualValue}
                onChange={(e) => setManualValue(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500 font-mono"
                required
              />
            </div>
          </div>
          
          <button
            type="submit"
            className="w-full mt-4 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs py-2.5 rounded-lg transition-colors flex items-center justify-center gap-1.5"
          >
            <Layers className="w-4 h-4" />
            Acumular Lançamento
          </button>
        </form>
      )}
    </div>
  );
}
