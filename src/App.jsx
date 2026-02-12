import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Sun, 
  Moon,
  Cloud, 
  CloudRain, 
  CloudSnow, 
  CloudLightning, 
  Wind, 
  Search, 
  Plus, 
  Trash2, 
  MapPin, 
  Thermometer, 
  RefreshCw,
  Clock,
  CloudDrizzle,
  X,
  Trees,
  Leaf,
  Info,
  Sunrise,
  Sunset
} from 'lucide-react';

// Storage Imports
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore';

// --- CLOUD STORAGE SETUP ---
const getFirebaseConfig = () => {
  try {
    return typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
  } catch (e) {
    return null;
  }
};

const firebaseConfig = getFirebaseConfig();
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

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
  <svg 
    viewBox="0 0 100 100" 
    className="w-12 h-12 shadow-lg rounded-lg"
    aria-label="B&Q Logo"
  >
    <rect width="100" height="100" fill="#ef7d00" rx="12" />
    <text 
      x="50%" 
      y="55%" 
      dominantBaseline="middle" 
      textAnchor="middle" 
      fill="white" 
      style={{ fontWeight: '900', fontSize: '38px', fontFamily: 'Arial Black, sans-serif' }}
    >
      B&Q
    </text>
  </svg>
);

const WEATHER_CODES = {
  0: { label: 'Clear Sky', icon: Sun, nightIcon: Moon, color: 'text-yellow-200', category: 'clear' },
  1: { label: 'Mainly Clear', icon: Sun, nightIcon: Moon, color: 'text-yellow-100', category: 'clear' },
  2: { label: 'Partly Cloudy', icon: Cloud, nightIcon: Cloud, color: 'text-emerald-200', category: 'cloudy' },
  3: { label: 'Overcast', icon: Cloud, nightIcon: Cloud, color: 'text-emerald-50', category: 'cloudy' },
  45: { label: 'Foggy', icon: Cloud, nightIcon: Cloud, color: 'text-slate-200', category: 'cloudy' },
  48: { label: 'Rime Fog', icon: Cloud, nightIcon: Cloud, color: 'text-slate-200', category: 'cloudy' },
  51: { label: 'Light Drizzle', icon: CloudDrizzle, nightIcon: CloudDrizzle, color: 'text-cyan-200', category: 'rainy' },
  61: { label: 'Slight Rain', icon: CloudRain, nightIcon: CloudRain, color: 'text-cyan-300', category: 'rainy' },
  63: { label: 'Moderate Rain', icon: CloudRain, nightIcon: CloudRain, color: 'text-cyan-400', category: 'rainy' },
  65: { label: 'Heavy Rain', icon: CloudRain, nightIcon: CloudRain, color: 'text-cyan-500', category: 'rainy' },
  71: { label: 'Slight Snow', icon: CloudSnow, nightIcon: CloudSnow, color: 'text-blue-100', category: 'snowy' },
  77: { label: 'Snow Grains', icon: CloudSnow, nightIcon: CloudSnow, color: 'text-blue-200', category: 'snowy' },
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
  const [error, setError] = useState(null);
  const [consensusBg, setConsensusBg] = useState(BACKGROUND_IMAGES.default);
  const [globalVibe, setGlobalVibe] = useState('syncing');
  
  const searchTimeout = useRef(null);

  // 1. Initial Authentication
  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (e) {
        console.warn("Auth failed, continuing in offline mode.");
        setLoading(false);
      }
    };
    initAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

  // 2. Real-time Cloud Sync with Auto-Seeding
  useEffect(() => {
    if (!user || !db) {
      setLoading(false);
      return;
    }

    const locationsCol = collection(db, 'artifacts', appId, 'public', 'data', 'locations');
    
    const unsubscribe = onSnapshot(locationsCol, (snapshot) => {
      const locs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // If the cloud is totally empty, seed with the B&Q defaults automatically
      if (locs.length === 0 && loading) {
        const defaults = [
          { name: 'London', lat: 51.5074, lon: -0.1278, member: 'Sarah', country: 'GB', admin: 'England' },
          { name: 'New York', lat: 40.7128, lon: -74.0060, member: 'Alex', country: 'US', admin: 'NY' },
          { name: 'Tokyo', lat: 35.6762, lon: 139.6503, member: 'Kenji', country: 'JP', admin: 'Tokyo' }
        ];
        defaults.forEach(d => {
          const newId = Math.random().toString(36).substring(7);
          setDoc(doc(locationsCol, newId), d);
        });
      } else {
        setLocations(locs);
        setLoading(false);
      }
    }, (err) => {
      console.warn("Storage sync failed.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, loading]);

  // 3. Dynamic Background Logic (Majority Rules)
  useEffect(() => {
    if (locations.length === 0) return;

    // Filter weather data for only the locations currently in our list
    const styles = locations.map(loc => {
      const data = weatherData[loc.id];
      if (!data) return null;
      const info = getWeatherInfo(data.current.weather_code);
      const suffix = data.current.is_day ? 'day' : 'night';
      return `${info.category}_${suffix}`;
    }).filter(Boolean);

    if (styles.length === 0) return;

    const counts = styles.reduce((acc, style) => {
      acc[style] = (acc[style] || 0) + 1;
      return acc;
    }, {});

    const dominantStyle = Object.keys(counts).reduce((a, b) => counts[a] >= counts[b] ? a : b);
    setConsensusBg(BACKGROUND_IMAGES[dominantStyle] || BACKGROUND_IMAGES.default);
    setGlobalVibe(dominantStyle.replace('_', ' '));
  }, [weatherData, locations]);

  // 4. Geocoding Search
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    searchTimeout.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(searchQuery)}&count=6&language=en&format=json`
        );
        const data = await response.json();
        setSearchResults(data.results || []);
      } catch (err) {
        console.error("Geocoding error:", err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(searchTimeout.current);
  }, [searchQuery]);

  // 5. Weather Data Fetcher
  const fetchWeather = useCallback(async () => {
    if (locations.length === 0) return;
    const newData = {};
    
    try {
      await Promise.all(locations.map(async (loc) => {
        const response = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&current=temperature_2m,relative_humidity_2m,is_day,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=4`
        );
        const data = await response.json();
        newData[loc.id] = data;
      }));
      setWeatherData(newData);
    } catch (err) {
      console.error("Weather error:", err);
    }
  }, [locations]);

  useEffect(() => {
    fetchWeather();
    const interval = setInterval(fetchWeather, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchWeather]);

  // 6. Action Handlers
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
      try {
        const locationsCol = collection(db, 'artifacts', appId, 'public', 'data', 'locations');
        await setDoc(doc(locationsCol, id), newLoc);
      } catch (err) {
        console.error("Firestore error:", err);
        setError("Could not save new member.");
      }
    } else {
      setLocations([...locations, { id, ...newLoc }]);
    }
    
    setSearchQuery('');
    setSearchResults([]);
  };

  const removeLocation = async (id) => {
    if (db && user) {
      const locDoc = doc(db, 'artifacts', appId, 'public', 'data', 'locations', id);
      await deleteDoc(locDoc);
    } else {
      setLocations(locations.filter(l => l.id !== id));
    }
  };

  const updateMemberName = async (id, name) => {
    if (db && user) {
      const locDoc = doc(db, 'artifacts', appId, 'public', 'data', 'locations', id);
      await setDoc(locDoc, { member: name || 'New Member' }, { merge: true });
    } else {
      setLocations(locations.map(l => l.id === id ? { ...l, member: name } : l));
    }
  };

  const convertTemp = (temp) => {
    if (unit === 'fahrenheit') return Math.round((temp * 9/5) + 32);
    return Math.round(temp);
  };

  return (
    <div className="relative min-h-screen text-emerald-50 font-sans transition-all duration-1000 overflow-x-hidden">
      {/* Dynamic Earthy Background Layer */}
      <div 
        className="fixed inset-0 z-0 transition-all duration-1000 ease-in-out scale-105"
        style={{
          backgroundImage: `url('${consensusBg}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'brightness(0.35) contrast(1.1) saturate(0.9)'
        }}
      />
      
      <div className="relative z-10 p-4 md:p-8">
        {/* Header Section */}
        <div className="max-w-7xl mx-auto mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6 animate-in fade-in duration-1000">
          <div className="flex items-center gap-5">
            <BnQLogo />
            <div>
              <h1 className="text-3xl font-extrabold text-emerald-50 tracking-tight">
                Planning & Design Daily Weather Widget
              </h1>
              <p className="text-emerald-200 mt-1 font-bold flex items-center gap-2">
                <Leaf className="w-4 h-4 text-emerald-400" />
                B&Q Team Geographical Overview {!db && "(Offline Mode)"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="bg-emerald-950/80 backdrop-blur-xl p-1 rounded-2xl border border-white/20 flex shadow-2xl">
              <button 
                onClick={() => setUnit('celsius')}
                className={`px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 ${unit === 'celsius' ? 'bg-emerald-600 text-white shadow-lg' : 'text-emerald-300 hover:bg-emerald-800/50'}`}
              >
                °C
              </button>
              <button 
                onClick={() => setUnit('fahrenheit')}
                className={`px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 ${unit === 'fahrenheit' ? 'bg-emerald-600 text-white shadow-lg' : 'text-emerald-300 hover:bg-emerald-800/50'}`}
              >
                °F
              </button>
            </div>

            <button 
              onClick={fetchWeather}
              className="p-3 bg-emerald-950/80 backdrop-blur-xl border border-white/20 rounded-2xl hover:bg-emerald-800/60 transition-all shadow-2xl active:scale-95"
              title="Refresh all data"
            >
              <RefreshCw className={`w-5 h-5 text-emerald-300 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {error && (
          <div className="max-w-7xl mx-auto mb-6 bg-red-900/80 backdrop-blur-md text-red-50 p-4 rounded-2xl border border-red-500 flex justify-between items-center">
            <span className="font-bold text-sm tracking-wide">{error}</span>
            <button onClick={() => setError(null)} className="text-red-100 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Member Grid */}
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-24">
          {locations.map((loc) => {
            const data = weatherData[loc.id];
            const isDay = data?.current?.is_day === 1;
            const weatherInfo = data ? getWeatherInfo(data.current.weather_code) : { label: 'Syncing...', color: 'text-emerald-200', icon: Cloud, nightIcon: Cloud };
            const WeatherIcon = isDay ? weatherInfo.icon : weatherInfo.nightIcon;

            return (
              <div key={loc.id} className="bg-emerald-950/70 backdrop-blur-3xl rounded-[2.5rem] border border-white/20 overflow-hidden flex flex-col group hover:shadow-2xl hover:border-emerald-400/50 transition-all duration-500 hover:-translate-y-1">
                <div className="p-8 pb-4 flex-1">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0 mr-2">
                      <input 
                        type="text" 
                        defaultValue={loc.member}
                        onBlur={(e) => updateMemberName(loc.id, e.target.value)}
                        className="bg-transparent border-none p-0 font-bold text-xl text-emerald-300 hover:bg-white/10 focus:bg-white/20 focus:ring-0 rounded-lg px-2 -ml-2 w-full transition-all truncate"
                      />
                      <div className="flex items-center text-emerald-100/80 text-xs font-black truncate mt-1 uppercase tracking-[0.15em]">
                        <MapPin className="w-4 h-4 mr-1.5 flex-shrink-0 text-emerald-500" />
                        {loc.name}, {loc.country}
                      </div>
                    </div>
                    <button 
                      onClick={() => removeLocation(loc.id)}
                      className="text-white/30 hover:text-red-400 transition-colors p-2 flex-shrink-0 opacity-0 group-hover:opacity-100 bg-white/10 rounded-xl"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between mt-10">
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                      <span className="text-6xl font-black tracking-tighter text-white">
                        {data ? `${convertTemp(data.current.temperature_2m)}°` : '--'}
                      </span>
                      <div className="flex items-center gap-2 mt-2">
                        {data && (isDay ? <Sunrise className="w-4 h-4 text-emerald-400" /> : <Sunset className="w-4 h-4 text-blue-300" />)}
                        <p className={`text-xs font-black tracking-widest uppercase ${weatherInfo.color}`}>
                          {weatherInfo.label}
                        </p>
                      </div>
                    </div>
                    <div className="relative p-5 bg-white/10 rounded-[2rem] border border-white/10 shadow-xl">
                       <WeatherIcon className={`w-14 h-14 relative z-10 drop-shadow-2xl ${weatherInfo.color}`} />
                       <div className={`absolute inset-0 blur-2xl opacity-20 rounded-full ${weatherInfo.color.replace('text', 'bg')}`}></div>
                    </div>
                  </div>
                </div>

                <div className="px-8 py-4 bg-emerald-900/40 border-y border-white/10 grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2 text-emerald-50 font-black text-[10px] uppercase tracking-widest">
                    <Wind className="w-4 h-4 text-emerald-400" />
                    {data ? `${Math.round(data.current.wind_speed_10m)} km/h` : '--'}
                  </div>
                  <div className="flex items-center gap-2 text-emerald-50 font-black text-[10px] uppercase tracking-widest">
                    <Thermometer className="w-4 h-4 text-emerald-400" />
                    RH: {data ? `${data.current.relative_humidity_2m}%` : '--'}
                  </div>
                </div>

                <div className="p-8 pt-6 bg-emerald-950/80">
                  <div className="flex items-center justify-between mb-6">
                     <p className="text-[10px] uppercase tracking-[0.25em] text-emerald-400 font-black">Next 3 Cycles</p>
                     <Clock className="w-4 h-4 text-white/20" />
                  </div>
                  <div className="space-y-5">
                    {data ? data.daily.time.slice(1, 4).map((time, idx) => {
                      const dayInfo = getWeatherInfo(data.daily.weather_code[idx + 1]);
                      const DayIcon = dayInfo.icon;
                      const dayName = new Date(time).toLocaleDateString('en-US', { weekday: 'short' });

                      return (
                        <div key={time} className="flex items-center justify-between text-sm group/row border-b border-white/5 pb-2 last:border-0 last:pb-0">
                          <span className="w-12 font-black text-emerald-50 group-hover/row:text-emerald-300 transition-colors uppercase tracking-widest">{dayName}</span>
                          <div className="flex items-center gap-3 flex-1 px-4">
                             <DayIcon className={`w-5 h-5 ${dayInfo.color}`} />
                             <span className={`text-[10px] font-bold uppercase tracking-tight ${dayInfo.color} hidden md:inline`}>{dayInfo.label}</span>
                          </div>
                          <div className="flex gap-4 w-24 justify-end items-center">
                            <span className="font-black text-white text-base">{convertTemp(data.daily.temperature_2m_max[idx + 1])}°</span>
                            <span className="text-emerald-300 font-bold text-sm">{convertTemp(data.daily.temperature_2m_min[idx + 1])}°</span>
                          </div>
                        </div>
                      );
                    }) : (
                      <div className="space-y-4">
                        {[1,2,3].map(i => <div key={i} className="h-4 bg-white/10 rounded-full w-full animate-pulse"></div>)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Add Location Card (Integrated Search Tile) */}
          <div className="bg-emerald-950/40 backdrop-blur-md border-2 border-dashed border-white/20 rounded-[2.5rem] flex flex-col p-6 min-h-[400px] transition-all group hover:border-emerald-400/50 overflow-hidden">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-white/10 rounded-xl">
                <Search className={`w-5 h-5 ${isSearching ? 'text-emerald-400 animate-pulse' : 'text-emerald-100/40'}`} />
              </div>
              <input 
                type="text" 
                placeholder="Find a city..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent border-none focus:ring-0 text-emerald-50 placeholder-emerald-100/20 font-bold py-2"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="text-emerald-100/20 hover:text-emerald-100">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {searchResults.length > 0 ? (
              <div className="flex-1 overflow-y-auto space-y-2 animate-in slide-in-from-bottom-2">
                {searchResults.map((result) => (
                  <button
                    key={`${result.latitude}-${result.longitude}-${result.id}`}
                    onClick={() => addLocation(result)}
                    className="w-full text-left p-3 rounded-2xl hover:bg-emerald-500/20 flex items-center justify-between group/btn transition-all border border-transparent hover:border-white/10"
                  >
                    <div className="flex flex-col">
                      <span className="font-bold text-emerald-100 group-hover/btn:text-white text-sm">{result.name}</span>
                      <span className="text-[10px] text-emerald-100/30 font-black uppercase tracking-widest mt-0.5">
                        {result.admin1 ? `${result.admin1}, ` : ''}{result.country_code}
                      </span>
                    </div>
                    <Plus className="w-4 h-4 text-emerald-500/40 group-hover/btn:text-emerald-400 transition-all" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-emerald-100/10 pointer-events-none">
                <Plus className="w-12 h-12 mb-4 opacity-50" />
                <p className="font-black tracking-[0.25em] uppercase text-[10px]">Add Team Member</p>
                <p className="text-[9px] mt-2 font-bold uppercase tracking-widest">Global Registry Access</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer Meta */}
        <div className="max-w-7xl mx-auto text-center pb-24 text-emerald-100/40 text-[10px] flex flex-wrap items-center justify-center gap-10 font-black uppercase tracking-[0.45em]">
          <div className="flex items-center gap-3">
            <Clock className="w-4 h-4 text-emerald-500" />
            Stand-up: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
          
          <div className="flex items-center gap-3 px-6 py-2.5 bg-emerald-950/60 rounded-full border border-white/10 shadow-lg">
            <Info className="w-4 h-4 text-emerald-400" />
            Atmosphere: <span className="text-emerald-200 ml-1 tracking-widest">{globalVibe}</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.8)]"></div>
            Feeds Active
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;