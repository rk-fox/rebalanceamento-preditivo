const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Replace imports
content = content.replace(
  /import \{ fetchAssets, fetchAllocations, saveAsset, deleteAssetFromDb, saveAllocations, isSupabaseConfigured, resetLocalData \} from '\.\/lib\/supabase';/,
  `import { fetchAssets, fetchAllocations, saveAsset, deleteAssetFromDb, saveAllocations, resetLocalData, googleSignIn, logout, syncToDrive, syncFromDrive, initAuth } from './lib/storage';`
);

content = content.replace(
  /import \{ RefreshCw, RotateCcw, Database, CheckCircle2 \} from 'lucide-react';/,
  `import { RefreshCw, RotateCcw, Database, CheckCircle2, Cloud, LogOut } from 'lucide-react';\nimport { User } from 'firebase/auth';`
);

// Add auth state
content = content.replace(
  `const [syncStatus, setSyncStatus] = useState<{ status: 'idle' | 'syncing' | 'success' | 'error'; message?: string }>({ status: 'idle' });`,
  `const [syncStatus, setSyncStatus] = useState<{ status: 'idle' | 'syncing' | 'success' | 'error'; message?: string }>({ status: 'idle' });\n  const [user, setUser] = useState<User | null>(null);\n  const [isLoggingIn, setIsLoggingIn] = useState(false);`
);

// Init auth inside App and add handlers
content = content.replace(
  `  // Initial load`,
  `  useEffect(() => {
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
    setSyncStatus({ status: 'syncing' });
    const ok = await syncToDrive();
    if (ok) setSyncStatus({ status: 'success', message: 'Backup salvo no Google Drive!' });
    else setSyncStatus({ status: 'error', message: 'Erro ao salvar no Drive.' });
  };

  const handleSyncFromDrive = async () => {
    setSyncStatus({ status: 'syncing' });
    const ok = await syncFromDrive();
    if (ok) {
      setSyncStatus({ status: 'success', message: 'Dados restaurados do Drive!' });
      const loadedAssets = await fetchAssets();
      const loadedAllocations = await fetchAllocations();
      setAssets(loadedAssets);
      setAllocations(loadedAllocations);
    } else {
      setSyncStatus({ status: 'error', message: 'Nenhum backup encontrado ou erro ao restaurar.' });
    }
  };

  // Initial load`
);

// Remove all isSupabaseConfigured usages inside handlers
// e.g. if (isSupabaseConfigured) { setSyncStatus(...) }
content = content.replace(/^[ \t]*if \(isSupabaseConfigured\) \{[\s\S]*?\n[ \t]*\}\n/gm, '');
content = content.replace(/^[ \t]*if \(isSupabaseConfigured\) [^\n]*\n/gm, '');

// Replace the UI for DB status
const uiRegex = /\{\/\* Database Connection Status Banner \*\/\}\s*<div className="max-w-7xl w-full mx-auto px-4 sm:px-6 md:px-8 mt-4">\s*<div className=\{`p-4 rounded-xl border flex flex-col md:flex-row md:items-start justify-between gap-4 text-xs \$\{\s*isSupabaseConfigured[\s\S]*?\{\/\* Right: Market Prices updater \*\/\}/;

const newUI = `{/* Database Connection Status Banner */}
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 md:px-8 mt-4">
        <div className={\`p-4 rounded-xl border flex flex-col md:flex-row md:items-start justify-between gap-4 text-xs \${
          user 
            ? 'bg-blue-950/10 border-blue-800/20 text-blue-400' 
            : 'bg-amber-950/10 border-amber-800/20 text-amber-400'
        }\`}>
          {/* Left: DB Status info */}
          <div className="flex items-start gap-2.5 flex-1">
            <Cloud className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <span className="font-semibold block text-zinc-200">
                  {user ? 'Conectado ao Google Drive' : 'Modo de Armazenamento Local (Offline-first)'}
                </span>
                {user ? (
                  <button onClick={handleLogout} className="flex items-center gap-1 px-2 py-1 bg-zinc-900 border border-zinc-800 rounded-md text-[10px] hover:bg-zinc-800 transition-colors">
                    <LogOut className="w-3 h-3" /> Desconectar
                  </button>
                ) : (
                  <button onClick={handleLogin} disabled={isLoggingIn} className="flex items-center gap-1.5 px-3 py-1 bg-white text-black font-medium rounded-md hover:bg-zinc-200 transition-colors">
                    {isLoggingIn ? 'Conectando...' : 'Conectar com Google'}
                  </button>
                )}
              </div>
              <p className="text-[10px] text-zinc-500 mt-1.5 leading-relaxed max-w-lg">
                {user 
                  ? \`Logado como \${user.email}. Você pode fazer backup ou restaurar seus dados a qualquer momento.\` 
                  : 'Para ativar o backup em nuvem, faça login com sua conta Google.'}
              </p>

              {/* Sync Status Overlay */}
              {syncStatus.status !== 'idle' && (
                <div className={\`mt-2.5 text-[10px] flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border w-fit \${
                  syncStatus.status === 'syncing' ? 'bg-zinc-900/60 border-zinc-800/60 text-zinc-400' :
                  syncStatus.status === 'success' ? 'bg-emerald-950/60 border-emerald-900/40 text-emerald-300' :
                  'bg-red-950/60 border-red-900/40 text-red-300'
                }\`}>
                  <div className={\`w-1.5 h-1.5 rounded-full \${
                    syncStatus.status === 'syncing' ? 'bg-zinc-400 animate-pulse' :
                    syncStatus.status === 'success' ? 'bg-emerald-400 animate-pulse' :
                    'bg-red-400 animate-pulse'
                  }\`} />
                  <span className="font-mono">
                    {syncStatus.status === 'syncing' && 'Sincronizando...'}
                    {syncStatus.status === 'success' && (syncStatus.message || 'Sincronizado!')}
                    {syncStatus.status === 'error' && (syncStatus.message || 'Erro de sincronização.')}
                  </span>
                </div>
              )}
            </div>
          </div>
          
          {user && (
            <div className="flex flex-row items-center gap-2">
              <button onClick={handleSyncToDrive} className="px-3 py-1.5 bg-blue-900/40 text-blue-200 border border-blue-800/50 rounded-lg hover:bg-blue-900/60 transition-colors font-medium">
                Fazer Backup
              </button>
              <button onClick={handleSyncFromDrive} className="px-3 py-1.5 bg-zinc-900 text-zinc-300 border border-zinc-800 rounded-lg hover:bg-zinc-800 transition-colors font-medium">
                Restaurar
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Right: Market Prices updater */}`;

content = content.replace(uiRegex, newUI);

fs.writeFileSync('src/App.tsx', content);
