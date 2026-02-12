import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Sun, Moon, Cloud, CloudRain, CloudSnow, CloudLightning, 
  Wind, Search, Plus, Trash2, MapPin, Thermometer, 
  RefreshCw, Clock, CloudDrizzle, X, Leaf, Info, 
  Sunrise, Sunset
} from 'lucide-react';

// Storage Imports
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore';

// --- PRODUCTION CLOUD CONFIG ---
// These are the keys you just generated in the Firebase Console
const productionConfig = {
  apiKey: "AIzaSyCOKO8NGvPAaiUlMHHrT8rxqzawvtJGwE8",
  authDomain: "bnq-weather.firebaseapp.com",
  projectId: "bnq-weather",
  storageBucket: "bnq-weather.firebasestorage.app",
  messagingSenderId: "351576985762",
  appId: "1:351576985762:web:d6ba1833fa1fc1ccfbc7fb",
  measurementId: "G-8ME2TJB5YG"
};

const getFirebaseConfig = () => {
  // 1. Priority: Use your hardcoded keys
  if (productionConfig.apiKey && productionConfig.apiKey !== "YOUR_API_KEY") {
    return productionConfig;
  }
  // 2. Fallback: For the AI preview environment
  try {
    return typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
  } catch (e) {
    return null;
  }
};

const firebaseConfig = getFirebaseConfig();
// We use a specific ID for your production database
const currentAppId = typeof __app_id !== 'undefined' ? __app_id : 'bnq-weather-prod';

let firebaseApp, auth, db;

if (firebaseConfig) {
  try {
    firebaseApp = initializeApp(firebaseConfig);
    auth = getAuth(firebaseApp);
    db = getFirestore(firebaseApp);
  } catch (e) {
    console.error("Firebase initialization failed:", e);
  }
}

// B&Q Logo Component
const BnQLogo = () => (
  <svg viewBox="0 0 100 100" className="w-12 h-12 shadow-lg rounded-lg" aria-label="B&Q Logo">
    <rect width="100" height="100" fill="#ef7d00" rx="12" />
    <text x="50%" y="55%" dominantBaseline="middle" textAnchor="middle" fill="white" style={{ fontWeight: '900', fontSize: '38px', fontFamily: 'Arial Black, sans-serif' }}>B&Q</text>
  </svg>
);

const WEATHER_CODES = {
  0: { label: 'Clear Sky', icon: Sun, nightIcon: Moon, color: 'text-yellow-200', category: 'clear' },
  1: { label: 'Mainly Clear', icon: Sun, nightIcon: Moon, color: 'text-yellow-100', category: 'clear' },
  2: { label: 'Partly Cloudy', icon: Cloud, nightIcon: Cloud, color: 'text-emerald-200', category: 'cloudy' },
  3: { label: 'Overcast', icon: Cloud, nightIcon: Cloud, color: 'text-emerald-50', category: 'cloudy' },
  45: { label: 'Foggy', icon: Cloud, nightIcon: Cloud, color: 'text-slate-200', category: 'cloudy' },
  51: { label: 'Light Drizzle', icon: CloudDrizzle, nightIcon: CloudDrizzle, color: 'text-cyan-200', category: 'rainy' },
  61: { label: 'Slight Rain', icon: CloudRain, nightIcon: CloudRain, color: 'text-cyan-300', category: 'rainy' },
  63: { label: 'Moderate Rain', icon: CloudRain, nightIcon: CloudRain, color: 'text-cyan-400', category: 'rainy' },
  65: { label: 'Heavy Rain', icon: CloudRain, nightIcon: CloudRain, color: 'text-cyan-500', category: 'rainy' },
  71: { label: 'Slight Snow', icon: CloudSnow, nightIcon: CloudSnow, color: 'text-blue-100', category: 'snowy' },
  80: { label: 'Rain Showers', icon: CloudRain, nightIcon: CloudRain, color: 'text-cyan-400', category: 'rainy' },
  95: { label: 'Thunderstorm', icon: CloudLightning, nightIcon: CloudLightning, color: 'text-amber-400', category: 'stormy' },
};

const BACKGROUND_IMAGES = {
  clear_day: "https://images.unsplash.com/photo-1502082553048-f009c37129b9?auto=format&fit=crop&q=80&w=2560", 
  clear_night: "https://images.unsplash.com/photo-1502134249126-9f3755a50d78?auto=format&fit=crop&q=80&w=2560", 
  cloudy_day: "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?auto=format&fit=crop&q=80&w=2560", 
  cloudy_night: "https://images.unsplash.com/photo-1494548162494-384bba4ab999?auto=format&fit=crop&q=80&w=2560", 
  rainy_day: "https://images.unsplash.com/photo-1511497584788-876760111969?auto=format&fit=crop&q=80&w=2560", 
  rainy_night: "https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?auto=format&fit=crop&q=80&w=2560", 
  snowy_day: "https://images.unsplash.com/photo-1483921020237-2ff51e8e4b22?auto=format&fit=crop&q=80&w=2560", 
  snowy_night: "https://images.unsplash.com/photo-1478720568477-151d9b16ef1e?auto=format&fit=crop&q=80&w=2560", 
  stormy_day: "https://images.unsplash.com/photo-1534088568595-a066f710b721?auto=format&fit=crop&q=80&w=2560", 
  stormy_night: "https://images.unsplash.com/photo-1472141521881-95d0e87e2e39?auto=format&fit=crop&q=80&w=2560", 
  default: "https://images.unsplash.com/photo-1542273917363-3b1817f69a2d?auto=format&fit=crop&q=80&w=2560" 
};

const getWeatherInfo = (code) => WEATHER_CODES[code] || { label: 'Unknown', icon: Cloud, nightIcon: Cloud, color: 'text-slate-400', category: 'default' };

const App = () => {
  const [user, setUser] = useState(null);
  const [locations, setLocations] = useState([]);
  const [weatherData, setWeatherData] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [unit, setUnit] = useState('celsius');
  const [consensusBg, setConsensusBg] = useState(BACKGROUND_IMAGES.default);
  const [globalVibe, setGlobalVibe] = useState('syncing');
  const searchTimeout = useRef(null);

  useEffect(() => {
    if (!auth) { setLoading(false); return; }
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (e) { setLoading(false); }
    };
    initAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!user || !db) {
      setLocations([
        { id: '1', name: 'London', lat: 51.5074, lon: -0.1278, member: 'Sarah', country: 'GB', admin: 'England' },
        { id: '2', name: 'New York', lat: 40.7128, lon: -74.0060, member: 'Alex', country: 'US', admin: 'NY' },
        { id: '3', name: 'Tokyo', lat: 35.6762, lon: 139.6503, member: 'Kenji', country: 'JP', admin: 'Tokyo' }
      ]);
      setLoading(false);
      return;
    }

    const locationsCol = collection(db, 'artifacts', currentAppId, 'public', 'data', 'locations');
    
    const unsubscribe = onSnapshot(locationsCol, (snapshot) => {
      const locs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      if (locs.length === 0 && loading) {
        const defaults = [
          { name: 'London', lat: 51.5074, lon: -0.1278, member: 'Sarah', country: 'GB', admin: 'England' },
          { name: 'New York', lat: 40.7128, lon: -74.0060, member: 'Alex', country: 'US', admin: 'NY' },
          { name: 'Tokyo', lat: 35.6762, lon: 139.6503, member: 'Kenji', country: 'JP', admin: 'Tokyo' }
        ];
        defaults.forEach(d => setDoc(doc(locationsCol, Math.random().toString(36).substring(7)), d));
      } else {
        setLocations(locs);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [user, loading]);

  useEffect(() => {
    if (locations.length === 0) return;
    const styles = locations.map(loc => {
      const data = weatherData[loc.id];
      if (!data) return null;
      const info = getWeatherInfo(data.current.weather_code);
      return `${info.category}_${data.current.is_day ? 'day' : 'night'}`;
    }).filter(Boolean);
    if (styles.length === 0) return;
    const counts = styles.reduce((acc, s) => ({ ...acc, [s]: (acc[s] || 0) + 1 }), {});
    const dominant = Object.keys(counts).reduce((a, b) => counts[a] >= counts[b] ? a : b);
    setConsensusBg(BACKGROUND_IMAGES[dominant] || BACKGROUND_IMAGES.default);
    setGlobalVibe(dominant.replace('_', ' '));
  }, [weatherData, locations]);

  const fetchWeather = useCallback(async () => {
    if (locations.length === 0) return;
    const newData = {};
    try {
      await Promise.all(locations.map(async (loc) => {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&current=temperature_2m,relative_humidity_2m,is_day,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=4`);
        newData[loc.id] = await res.json();
      }));
      setWeatherData(newData);
    } catch (e) { console.error(e); }
  }, [locations]);

  useEffect(() => {
    fetchWeather();
    const interval = setInterval(fetchWeather, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchWeather]);

  const addLocation = async (result) => {
    const id = Date.now().toString();
    const newLoc = { 
      name: result.name || 'Unknown', 
      lat: result.latitude, 
      lon: result.longitude, 
      member: 'New Member', 
      country: result.country_code || '', 
      admin: result.admin1 || '' 
    };
    if (db && user) {
      await setDoc(doc(collection(db, 'artifacts', currentAppId, 'public', 'data', 'locations'), id), newLoc);
    } else {
      setLocations([...locations, { id, ...newLoc }]);
    }
  };

  const removeLocation = async (id) => {
    if (db && user) {
      await deleteDoc(doc(db, 'artifacts', currentAppId, 'public', 'data', 'locations', id));
    } else {
      setLocations(locations.filter(l => l.id !== id));
    }
  };

  const updateMemberName = async (id, name) => {
    if (db && user) {
      await setDoc(doc(db, 'artifacts', currentAppId, 'public', 'data', 'locations', id), { member: name || 'New Member' }, { merge: true });
    } else {
      setLocations(locations.map(l => l.id === id ? { ...l, member: name } : l));
    }
  };

  useEffect(() => {
    if (searchQuery.length < 2) { setSearchResults([]); return; }
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(searchQuery)}&count=5&language=en&format=json`);
        const data = await res.json();
        setSearchResults(data.results || []);
      } catch (e) { console.error(e); } finally { setIsSearching(false); }
    }, 300);
  }, [searchQuery]);

  const convertTemp = (temp) => unit === 'fahrenheit' ? Math.round((temp * 9/5) + 32) : Math.round(temp);

  return (
    <div className="relative min-h-screen text-emerald-50 font-sans transition-all duration-1000 overflow-x-hidden">
      <div className="fixed inset-0 z-0 transition-all duration-1000 scale-105" style={{ backgroundImage: `url('${consensusBg}')`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'brightness(0.35) contrast(1.1)' }} />
      <div className="relative z-10 p-4 md:p-8 max-w-7xl mx-auto">
        <header className="flex flex-col md:flex-row items-center justify-between gap-6 mb-10">
          <div className="flex items-center gap-5">
            <BnQLogo />
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight">Planning & Design Weather</h1>
              <p className="text-emerald-200 mt-1 font-bold flex items-center gap-2"><Leaf className="w-4 h-4 text-emerald-400" /> B&Q Team Geographical Overview</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="bg-emerald-950/80 p-1 rounded-2xl border border-white/20 flex shadow-2xl">
              <button onClick={() => setUnit('celsius')} className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all ${unit === 'celsius' ? 'bg-emerald-600 text-white' : 'text-emerald-300'}`}>°C</button>
              <button onClick={() => setUnit('fahrenheit')} className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all ${unit === 'fahrenheit' ? 'bg-emerald-600 text-white' : 'text-emerald-300'}`}>°F</button>
            </div>
            <button onClick={fetchWeather} className="p-3 bg-emerald-950/80 border border-white/20 rounded-2xl hover:bg-emerald-800/60 transition-all shadow-2xl"><RefreshCw className={`w-5 h-5 text-emerald-300 ${loading ? 'animate-spin' : ''}`} /></button>
          </div>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-24">
          {locations.map((loc) => {
            const data = weatherData[loc.id];
            const info = data ? getWeatherInfo(data.current.weather_code) : { label: 'Syncing...', icon: Cloud, nightIcon: Cloud, color: 'text-white' };
            const Icon = data?.current?.is_day ? info.icon : info.nightIcon;
            return (
              <div key={loc.id} className="bg-emerald-950/70 backdrop-blur-3xl rounded-[2.5rem] border border-white/20 overflow-hidden flex flex-col group transition-all hover:-translate-y-1">
                <div className="p-8 pb-4 flex-1">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0 mr-2">
                      <input type="text" defaultValue={loc.member} onBlur={(e) => updateMemberName(loc.id, e.target.value)} className="bg-transparent border-none p-0 font-bold text-xl text-emerald-300 focus:ring-0 w-full truncate" />
                      <div className="flex items-center text-emerald-100/80 text-xs font-black truncate mt-1 uppercase tracking-widest"><MapPin className="w-4 h-4 mr-1.5 text-emerald-500" />{loc.name}, {loc.country}</div>
                    </div>
                    <button onClick={() => removeLocation(loc.id)} className="text-white/30 hover:text-red-400 p-2 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  <div className="flex items-center justify-between mt-10">
                    <div>
                      <span className="text-6xl font-black text-white">{data ? `${convertTemp(data.current.temperature_2m)}°` : '--'}</span>
                      <p className={`text-xs font-black uppercase tracking-widest mt-2 ${info.color}`}>{info.label}</p>
                    </div>
                    <div className="p-5 bg-white/10 rounded-[2rem] border border-white/10"><Icon className={`w-14 h-14 ${info.color}`} /></div>
                  </div>
                </div>
                <div className="p-8 pt-4 bg-emerald-950/80 border-t border-white/5 space-y-4">
                  {data?.daily.time.slice(1, 4).map((time, idx) => (
                    <div key={time} className="flex items-center justify-between text-sm">
                      <span className="w-12 font-black text-white/40 uppercase">{new Date(time).toLocaleDateString('en-US', { weekday: 'short' })}</span>
                      <span className="font-black text-white">{convertTemp(data.daily.temperature_2m_max[idx+1])}°</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          <div className="bg-emerald-950/40 border-2 border-dashed border-white/20 rounded-[2.5rem] p-6 min-h-[400px] flex flex-col">
            <div className="flex items-center gap-3 mb-4">
              <Search className={`w-5 h-5 ${isSearching ? 'text-emerald-400 animate-pulse' : 'text-emerald-100/40'}`} />
              <input type="text" placeholder="Find a city..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="flex-1 bg-transparent border-none focus:ring-0 text-emerald-50 font-bold" />
            </div>
            <div className="flex-1 overflow-y-auto space-y-2">
              {searchResults.map((r) => (
                <button key={r.id} onClick={() => addLocation(r)} className="w-full text-left p-3 rounded-2xl hover:bg-emerald-500/20 flex items-center justify-between group transition-all">
                  <div><span className="font-bold text-white text-sm">{r.name}</span><span className="block text-[10px] text-white/30 font-black uppercase">{r.admin1}, {r.country_code}</span></div>
                  <Plus className="w-4 h-4 text-emerald-500 opacity-0 group-hover:opacity-100" />
                </button>
              ))}
              {!searchQuery && <div className="h-full flex flex-col items-center justify-center opacity-10"><Plus className="w-12 h-12 mb-2" /><p className="font-black uppercase tracking-widest text-[10px]">Add Team Member</p></div>}
            </div>
          </div>
        </div>
        <footer className="text-center pb-12 text-emerald-100/40 text-[10px] flex flex-wrap justify-center gap-10 font-black uppercase tracking-[0.45em]">
          <div className="flex items-center gap-3"><Clock className="w-4 h-4" /> Stand-up: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
          <div className="flex items-center gap-3 px-6 py-2.5 bg-emerald-950/60 rounded-full border border-white/10 shadow-lg"><Info className="w-4 h-4" /> Atmosphere: <span className="text-emerald-200">{globalVibe}</span></div>
          <div className="flex items-center gap-3"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div> Feeds Active</div>
        </footer>
      </div>
    </div>
  );
};

export default App;