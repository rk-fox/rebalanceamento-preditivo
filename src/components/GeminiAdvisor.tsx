/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Sparkles, Key, Eye, EyeOff, CheckCircle2, AlertTriangle, RefreshCw, BookOpen, ExternalLink, HelpCircle } from 'lucide-react';

interface RecommendedAsset {
  ticker: string;
  category: string;
  amount: number;
  currency: string;
}

interface GeminiAdvisorProps {
  recommendations: RecommendedAsset[];
}

export default function GeminiAdvisor({ recommendations }: GeminiAdvisorProps) {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState('');
  const [error, setError] = useState('');
  const [searchGroundingUsed, setSearchGroundingUsed] = useState(false);

  const selectedModel = 'gemini-3.1-flash-lite';

  // Load saved key from localStorage on mount
  useEffect(() => {
    const savedKey = localStorage.getItem('gemini_byok_key');
    if (savedKey) {
      setApiKey(savedKey);
      setIsSaved(true);
    }
  }, []);

  const handleSaveKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) {
      setError('Por favor, digite uma chave de API válida.');
      return;
    }
    localStorage.setItem('gemini_byok_key', apiKey.trim());
    setIsSaved(true);
    setError('');
  };

  const handleClearKey = () => {
    localStorage.removeItem('gemini_byok_key');
    setApiKey('');
    setIsSaved(false);
    setResponse('');
    setError('');
  };

  const handleAnalyze = async () => {
    if (!apiKey.trim()) {
      setError('Por favor, configure sua chave de API do Gemini para continuar.');
      return;
    }

    setIsLoading(true);
    setError('');
    setResponse('');
    setSearchGroundingUsed(false);

    const assetListText = recommendations
      .map(
        (r) =>
          `- **${r.ticker}** (${r.category}): Estimativa de aporte de ${
            r.currency === 'USD' ? 'US$' : 'R$'
          } ${r.amount.toLocaleString(r.currency === 'USD' ? 'en-US' : 'pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`
      )
      .join('\n');

    const promptText = `Olá Gemini! Sou um investidor Buy & Hold de longo prazo. Estou prestes a realizar aportes mensais para rebalancear minha carteira nos seguintes ativos recomendados pelo meu algoritmo:

${assetListText}

Por favor, faça uma análise rápida, séria e honesta especificamente sobre estes ativos. 
Há alguma mudança de fundamento recente, queda recorrente nos lucros, escândalo corporativo grave ou outro fator de peso que NÃO recomende o aporte em algum deles neste momento? 

Se todos estiverem saudáveis e com fundamentos mantidos, confirme isso de forma concisa. 
Se houver algum ponto de atenção real para o investidor de longo prazo, cite o ativo e explique de forma clara.

Responda em PORTUGUÊS (do Brasil), de forma extremamente clara, objetiva e direta, dividida em no máximo 3 parágrafos bem redigidos. Use marcações em negrito para facilitar a leitura rápida de nomes de ativos e conclusões importantes.`;

    try {
      const getApiUrl = (model: string) => 
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`;
      
      const payload = {
        contents: [
          {
            parts: [
              { text: promptText }
            ]
          }
        ],
        tools: [
          {
            googleSearch: {}
          }
        ]
      };

      let res = await fetch(getApiUrl(selectedModel), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      let isGroundingSuccessful = true;

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const errMsg = errJson?.error?.message || '';
        
        // If search grounding fails because of permissions/billing constraints, fallback to standard generation
        if (
          errMsg.toLowerCase().includes('permission') || 
          errMsg.toLowerCase().includes('caller') ||
          errMsg.toLowerCase().includes('quota') ||
          res.status === 403 ||
          res.status === 429
        ) {
          console.warn('Google Search Grounding requires a higher-tier key or is not supported. Retrying without search grounding...');
          isGroundingSuccessful = false;

          const retryPayload = {
            contents: [
              {
                parts: [
                  { text: promptText }
                ]
              }
            ]
          };

          res = await fetch(getApiUrl(selectedModel), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(retryPayload),
          });

          if (!res.ok) {
            const retryErrJson = await res.json().catch(() => ({}));
            const retryErrMsg = retryErrJson?.error?.message || `Erro HTTP ${res.status}`;
            throw new Error(retryErrMsg);
          }
        } else {
          throw new Error(errMsg || `Erro HTTP ${res.status}`);
        }
      }

      const data = await res.json();
      const textResult = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!textResult) {
        throw new Error('Nenhuma resposta gerada pelo modelo. Verifique se o formato da chave está correto.');
      }

      setResponse(textResult);
      setSearchGroundingUsed(isGroundingSuccessful);
    } catch (err: any) {
      console.error('Gemini API Error:', err);
      setError(
        err.message?.includes('API_KEY_INVALID') || err.message?.includes('API key not valid')
          ? 'Chave de API inválida. Verifique sua chave nas configurações do Google AI Studio.'
          : `Erro na consulta: ${err.message}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Helper to parse simple markdown bolding and list points cleanly in React without dangerous HTML
  const parseInlineStyle = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={idx} className="font-bold text-emerald-300">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  const renderResponse = (text: string) => {
    return text.split('\n\n').map((para, pIdx) => {
      const trimmed = para.trim();
      if (!trimmed) return null;

      // Check if it's a list item block
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const items = trimmed
          .split('\n')
          .map((item) => item.replace(/^[-*]\s+/, '').trim())
          .filter(Boolean);
        return (
          <ul key={pIdx} className="list-disc pl-5 space-y-1.5 mb-4 text-zinc-300 text-xs font-sans leading-relaxed">
            {items.map((item, iIdx) => (
              <li key={iIdx}>{parseInlineStyle(item)}</li>
            ))}
          </ul>
        );
      }

      return (
        <p key={pIdx} className="mb-4 text-xs text-zinc-300 font-sans leading-relaxed">
          {parseInlineStyle(trimmed)}
        </p>
      );
    });
  };

  return (
    <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-xl p-5 shadow-lg space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-900 pb-2.5">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4.5 h-4.5 text-indigo-400" />
          <h4 className="text-xs font-bold text-zinc-100 uppercase tracking-wider font-sans">
            Consultor de Fundamentos IA (Gemini 3.1)
          </h4>
        </div>
        <span className="text-[9px] text-zinc-500 font-mono uppercase tracking-widest bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
          BYOK (3.1 Lite)
        </span>
      </div>

      {/* Key Manager Box */}
      {!isSaved ? (
        <form onSubmit={handleSaveKey} className="bg-zinc-900/40 p-3.5 rounded-lg border border-zinc-800/60 space-y-2.5">
          <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-medium">
            <Key className="w-3.5 h-3.5 text-indigo-400" />
            <span>Configure sua API Key para habilitar análises gratuitas e em tempo real:</span>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showKey ? 'text' : 'password'}
                placeholder="Insira sua Gemini API Key (AI Studio)"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-[11px] font-mono text-zinc-100 focus:outline-none focus:border-indigo-500 pr-8"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-zinc-500 hover:text-zinc-300 cursor-pointer"
              >
                {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-[11px] px-3 py-1.5 rounded font-semibold transition-all cursor-pointer shrink-0"
            >
              Salvar Chave
            </button>
          </div>
          <p className="text-[10px] text-zinc-500 leading-snug flex items-center gap-1">
            <span>💡 Obtenha sua chave gratuita no</span>
            <a
              href="https://aistudio.google.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-400 hover:underline flex items-center gap-0.5"
            >
              Google AI Studio <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </p>
        </form>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-zinc-900/20 px-3 py-2 rounded-lg border border-zinc-800/50 text-[11px]">
            <div className="flex items-center gap-1.5 text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>Chave configurada e salva localmente (Gemini 3.1 Flash Lite)</span>
            </div>
            <button
              onClick={handleClearKey}
              className="text-zinc-500 hover:text-red-400 text-[10px] font-mono transition-colors underline cursor-pointer"
            >
              Remover chave
            </button>
          </div>
        </div>
      )}

      {/* Main Analysis trigger action */}
      {recommendations.length === 0 ? (
        <div className="text-center p-4 bg-zinc-900/10 border border-zinc-900/50 rounded-lg text-zinc-600 text-xs">
          Nenhuma recomendação de compra ativa no momento. Adicione um valor de aporte e clique em "Calculate Rebalancing" para gerar as sugestões.
        </div>
      ) : (
        <div className="space-y-3">
          {/* Action button */}
          {isSaved && !isLoading && !response && (
            <button
              onClick={handleAnalyze}
              className="w-full bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-medium text-sm px-6 py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
            >
              <Sparkles className="w-4 h-4 text-indigo-200" />
              Analisar Fundamentos dos Aportes Recomendados
            </button>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="bg-zinc-900/30 border border-zinc-800/60 rounded-lg p-5 flex flex-col items-center justify-center space-y-3">
              <RefreshCw className="w-6 h-6 text-indigo-400 animate-spin" />
              <div className="text-center">
                <p className="text-xs text-zinc-300 font-semibold">Consultando Inteligência Artificial...</p>
                <p className="text-[10px] text-zinc-500 mt-1 font-sans leading-relaxed max-w-sm">
                  O Gemini está realizando buscas em tempo real na web sobre os lucros recentes, fatos relevantes e saúde financeira de <strong>{recommendations.map(r => r.ticker).join(', ')}</strong>.
                </p>
              </div>
            </div>
          )}

          {/* Result Response block */}
          {response && (
            <div className="bg-zinc-900/30 border border-zinc-800/80 rounded-lg p-4.5 space-y-3.5">
              {/* Output Header */}
              <div className="flex items-center justify-between text-[10px] text-zinc-500 border-b border-zinc-900 pb-2">
                <span className="font-mono flex items-center gap-1 text-emerald-500/80">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  Análise de Fundamentos Concluída
                </span>
                {searchGroundingUsed && (
                  <span className="bg-emerald-950/40 text-emerald-400 border border-emerald-900/30 px-2 py-0.5 rounded text-[8px] font-mono uppercase tracking-wider">
                    Google Search Ativado
                  </span>
                )}
              </div>

              {/* Parsed Response */}
              <div className="prose prose-invert max-w-none">
                {renderResponse(response)}
              </div>

              {/* Action options after analysis is visible */}
              {!isLoading && (
                <div className="flex justify-end border-t border-zinc-900/60 pt-2.5">
                  <button
                    onClick={handleAnalyze}
                    className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 text-[10px] font-semibold uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Reanalisar Ativos
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Error display */}
          {error && (
            <div className="bg-red-950/30 border border-red-900/40 rounded-lg p-3 text-red-400 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold">Erro de Integração</p>
                <p className="text-zinc-400 text-[11px] leading-relaxed">{error}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
