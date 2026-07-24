import { Asset, CategoryAllocation } from '../types';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, signOut } from 'firebase/auth';
const firebaseConfig = {
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/drive.appdata');
provider.setCustomParameters({ prompt: 'consent' });

let isSigningIn = false;
let cachedAccessToken: string | null = typeof window !== 'undefined' ? localStorage.getItem('pe_drive_access_token') : null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (!cachedAccessToken) {
        cachedAccessToken = localStorage.getItem('pe_drive_access_token');
      }
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      localStorage.removeItem('pe_drive_access_token');
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Firebase Auth');
    }
    cachedAccessToken = credential.accessToken;
    localStorage.setItem('pe_drive_access_token', cachedAccessToken);
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  if (!cachedAccessToken) {
    cachedAccessToken = localStorage.getItem('pe_drive_access_token');
  }
  return cachedAccessToken;
};

export const logout = async () => {
  await signOut(auth);
  cachedAccessToken = null;
  localStorage.removeItem('pe_drive_access_token');
};

// Local fallback store keys
const ASSETS_STORAGE_KEY = 'pe_supabase_fallback_assets';
const ALLOCATIONS_STORAGE_KEY = 'pe_supabase_fallback_allocations';
const DRIVE_FILE_NAME = 'portfolio-data.json';

// Demo Data
const DEMO_ASSETS: Asset[] = [
  {
    id: '1e3de17b-48cf-48bb-bb78-da2d01fc93f1',
    ticker: 'WEGE3',
    category: 'Ações',
    quantity: 120,
    currency: 'BRL',
    invested_amount: 4000,
    score: 10,
    is_quarantined: false,
  },
  {
    id: '2e3de17b-48cf-48bb-bb78-da2d01fc93f2',
    ticker: 'VALE3',
    category: 'Ações',
    quantity: 50,
    currency: 'BRL',
    invested_amount: 3200,
    score: 8,
    is_quarantined: false,
  },
  {
    id: '3e3de17b-48cf-48bb-bb78-da2d01fc93f3',
    ticker: 'ITSA4',
    category: 'Ações',
    quantity: 200,
    currency: 'BRL',
    invested_amount: 2100,
    score: 9,
    is_quarantined: false,
  },
  {
    id: '4e3de17b-48cf-48bb-bb78-da2d01fc93f4',
    ticker: 'HGLG11',
    category: 'FIIs',
    quantity: 25,
    currency: 'BRL',
    invested_amount: 3800,
    score: 10,
    is_quarantined: false,
  },
  {
    id: '5e3de17b-48cf-48bb-bb78-da2d01fc93f5',
    ticker: 'XPML11',
    category: 'FIIs',
    quantity: 20,
    currency: 'BRL',
    invested_amount: 2000,
    score: 7,
    is_quarantined: false,
  },
  {
    id: '6e3de17b-48cf-48bb-bb78-da2d01fc93f6',
    ticker: 'O',
    category: 'Reits',
    quantity: 20,
    currency: 'USD',
    invested_amount: 1100, 
    score: 10,
    is_quarantined: false,
  },
  {
    id: '7e3de17b-48cf-48bb-bb78-da2d01fc93f7',
    ticker: 'AAPL',
    category: 'ETFs Internacionais',
    quantity: 10,
    currency: 'USD',
    invested_amount: 1800,
    score: 6,
    is_quarantined: true,
  }
];

const DEMO_ALLOCATIONS: CategoryAllocation[] = [
  { category: 'Ações', target_percentage: 40 },
  { category: 'FIIs', target_percentage: 30 },
  { category: 'Reits', target_percentage: 20 },
  { category: 'ETFs Internacionais', target_percentage: 10 },
];

export async function fetchAssets(): Promise<Asset[]> {
  const local = localStorage.getItem(ASSETS_STORAGE_KEY);
  if (local) {
    return JSON.parse(local);
  }
  localStorage.setItem(ASSETS_STORAGE_KEY, JSON.stringify(DEMO_ASSETS));
  return DEMO_ASSETS;
}

export async function saveAsset(asset: Omit<Asset, 'livePrice' | 'currentValue' | 'variationPercent'>): Promise<void> {
  const localAsset = {
    id: asset.id,
    ticker: asset.ticker.toUpperCase(),
    category: asset.category,
    quantity: asset.quantity,
    currency: asset.currency,
    invested_amount: asset.invested_amount,
    score: asset.score,
    is_quarantined: asset.is_quarantined,
  };

  const assets = await fetchAssets();
  const index = assets.findIndex(a => a.ticker.toUpperCase() === asset.ticker.toUpperCase());
  if (index !== -1) {
    assets[index] = { ...assets[index], ...localAsset };
  } else {
    assets.push({ ...localAsset });
  }
  localStorage.setItem(ASSETS_STORAGE_KEY, JSON.stringify(assets));
}

export async function deleteAssetFromDb(id: string): Promise<void> {
  const assets = await fetchAssets();
  const filtered = assets.filter(a => a.id !== id);
  localStorage.setItem(ASSETS_STORAGE_KEY, JSON.stringify(filtered));
}

export async function fetchAllocations(): Promise<CategoryAllocation[]> {
  const local = localStorage.getItem(ALLOCATIONS_STORAGE_KEY);
  if (local) {
    return JSON.parse(local);
  }
  localStorage.setItem(ALLOCATIONS_STORAGE_KEY, JSON.stringify(DEMO_ALLOCATIONS));
  return DEMO_ALLOCATIONS;
}

export async function saveAllocations(allocs: CategoryAllocation[]): Promise<void> {
  localStorage.setItem(ALLOCATIONS_STORAGE_KEY, JSON.stringify(allocs));
}

export function resetLocalData() {
  localStorage.removeItem(ASSETS_STORAGE_KEY);
  localStorage.removeItem(ALLOCATIONS_STORAGE_KEY);
}

// Drive Sync Functions
async function getDriveFileId(accessToken: string): Promise<string | null> {
  const query = encodeURIComponent(`name='${DRIVE_FILE_NAME}' and trashed = false`);
  const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&spaces=appDataFolder`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (response.status === 401) {
    throw new Error('TOKEN_EXPIRED');
  }
  if (response.status === 403) {
    throw new Error('FORBIDDEN');
  }
  if (!response.ok) {
    const errText = await response.text();
    console.error('getDriveFileId: Failed to list files:', response.status, errText);
    return null;
  }
  const data = await response.json();
  return data.files && data.files.length > 0 ? data.files[0].id : null;
}

export async function syncToDrive(): Promise<boolean> {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      console.error('syncToDrive: No access token available');
      return false;
    }

    const assets = await fetchAssets();
    const allocations = await fetchAllocations();
    const payload = JSON.stringify({ assets, allocations });

    let fileId = await getDriveFileId(accessToken);
    console.log('syncToDrive: File ID check result:', fileId);

    if (!fileId) {
      console.log('syncToDrive: Creating new file metadata in appDataFolder...');
      const createResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: DRIVE_FILE_NAME,
          parents: ['appDataFolder'],
        }),
      });

      if (createResponse.status === 401) {
        throw new Error('TOKEN_EXPIRED');
      }
      if (createResponse.status === 403) {
        throw new Error('FORBIDDEN');
      }

      if (!createResponse.ok) {
        const errText = await createResponse.text();
        console.error('syncToDrive: Failed to create metadata:', createResponse.status, errText);
        return false;
      }

      const createData = await createResponse.json();
      fileId = createData.id;
      console.log('syncToDrive: Successfully created file metadata. ID:', fileId);
    }

    if (!fileId) {
      console.error('syncToDrive: fileId is still null after creation attempt');
      return false;
    }

    console.log('syncToDrive: Uploading raw media content to file ID:', fileId);
    const uploadResponse = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: payload,
      }
    );

    if (uploadResponse.status === 401) {
      throw new Error('TOKEN_EXPIRED');
    }
    if (uploadResponse.status === 403) {
      throw new Error('FORBIDDEN');
    }

    if (!uploadResponse.ok) {
      const errText = await uploadResponse.text();
      console.error('syncToDrive: Failed to upload content:', uploadResponse.status, errText);
      return false;
    }

    console.log('syncToDrive: Backup completed successfully on Google Drive!');
    return true;
  } catch (error: any) {
    if (error.message === 'TOKEN_EXPIRED') {
      throw error;
    }
    console.error('syncToDrive: Exception during backup:', error);
    return false;
  }
}

export async function syncFromDrive(): Promise<boolean> {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      console.error('syncFromDrive: No access token available');
      return false;
    }

    const existingFileId = await getDriveFileId(accessToken);
    if (!existingFileId) {
      console.warn('syncFromDrive: No existing backup file found in appDataFolder');
      return false;
    }

    console.log('syncFromDrive: Downloading media content for file ID:', existingFileId);
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${existingFileId}?alt=media`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    
    if (response.status === 401) {
      throw new Error('TOKEN_EXPIRED');
    }
    if (response.status === 403) {
      throw new Error('FORBIDDEN');
    }

    if (!response.ok) {
      const errText = await response.text();
      console.error('syncFromDrive: Failed to download media:', response.status, errText);
      return false;
    }
    
    const data = await response.json();
    if (data.assets) localStorage.setItem(ASSETS_STORAGE_KEY, JSON.stringify(data.assets));
    if (data.allocations) localStorage.setItem(ALLOCATIONS_STORAGE_KEY, JSON.stringify(data.allocations));
    console.log('syncFromDrive: Restore completed successfully!');
    return true;
  } catch (error: any) {
    if (error.message === 'TOKEN_EXPIRED') {
      throw error;
    }
    console.error('syncFromDrive: Exception during restore:', error);
    return false;
  }
}
