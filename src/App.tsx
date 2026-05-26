import React, { useState, useEffect, useRef } from 'react';
import { Upload, Code2, Zap, Shield, Users, Loader2, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const PrometheusLogo = ({ className = "w-6 h-6", color = "#e6522c" }: { className?: string; color?: string }) => (
  <svg
    viewBox="0 0 116 114"
    className={className}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fill={color}
      d="M 56.667,0.667 C 25.372,0.667 0,26.036 0,57.332 c 0,31.295 25.372,56.666 56.667,56.666 31.295,0 56.666,-25.371 56.666,-56.666 0,-31.296 -25.372,-56.665 -56.666,-56.665 z m 0,106.055 c -8.904,0 -16.123,-5.948 -16.123,-13.283 H 72.79 c 0,7.334 -7.219,13.283 -16.123,13.283 z M 83.297,89.04 H 30.034 V 79.382 H 83.298 V 89.04 Z M 83.106,74.411 H 30.186 C 30.01,74.208 29.83,74.008 29.66,73.802 24.208,67.182 22.924,63.726 21.677,60.204 c -0.021,-0.116 6.611,1.355 11.314,2.413 0,0 2.42,0.56 5.958,1.205 -3.397,-3.982 -5.414,-9.044 -5.414,-14.218 0,-11.359 8.712,-21.285 5.569,-29.308 3.059,0.249 6.331,6.456 6.552,16.161 3.252,-4.494 4.613,-12.701 4.613,-17.733 0,-5.21 3.433,-11.262 6.867,-11.469 -3.061,5.045 0.793,9.37 4.219,20.099 1.285,4.03 1.121,10.812 2.113,15.113 C 63.797,33.534 65.333,20.5 71,16 c -2.5,5.667 0.37,12.758 2.333,16.167 3.167,5.5 5.087,9.667 5.087,17.548 0,5.284 -1.951,10.259 -5.242,14.148 3.742,-0.702 6.326,-1.335 6.326,-1.335 l 12.152,-2.371 c 10e-4,-10e-4 -1.765,7.261 -8.55,14.254 z"
    />
  </svg>
);

const PRESETS = ['Minify', 'Weak', 'Medium', 'High', 'Strong', 'Insane'];

interface SizeReductionStats {
  originalBytes: number;
  obfuscatedBytes: number;
  percentageChange: number;
  isReduction: boolean;
  fileName: string;
}

export default function App() {
  const [preset, setPreset] = useState<string>('Medium');
  const [loading, setLoading] = useState<boolean>(false);
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);
  const [sizeChange, setSizeChange] = useState<SizeReductionStats | null>(null);
  const [error, setError] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  
  const [stats, setStats] = useState({ filesProtected: 0, activeVisitors: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatBytes = (bytes: number, decimals = 1) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  useEffect(() => {
    const eventSource = new EventSource('/api/stats/stream');
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setStats(data);
    };
    return () => eventSource.close();
  }, []);

  const processFile = async (file: File) => {
    setLoading(true);
    setError('');
    setDownloadSuccess(false);
    
    try {
      const code = await file.text();
      const res = await fetch('/api/obfuscate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, preset })
      });
      const data = await res.json();
      
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to obfuscate');
      }
      
      // Calculate size difference
      const originalBytes = code.length;
      const obfuscatedBytes = data.output.length;
      const percentageChange = ((obfuscatedBytes - originalBytes) / originalBytes) * 100;
      
      setSizeChange({
        originalBytes,
        obfuscatedBytes,
        percentageChange,
        isReduction: obfuscatedBytes < originalBytes,
        fileName: file.name
      });

      // Auto-download
      const blob = new Blob([data.output], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const originalName = file.name.replace(/\.lua$/i, '');
      a.download = `${originalName}.obfuscated.lua`;
      a.click();
      URL.revokeObjectURL(url);

      // Satisyfing success microinteraction checkmark
      setDownloadSuccess(true);
      setTimeout(() => {
        setDownloadSuccess(false);
      }, 3500);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-gray-100 selection:bg-teal-500/30 font-sans p-4 md:p-8 flex flex-col">
      <div className="max-w-4xl mx-auto w-full space-y-8">
        
        {/* Header */}
        <motion.header 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-800 pb-6"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#e6522c]/10 rounded-xl">
              <PrometheusLogo className="w-6 h-6" color="#e6522c" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-white">Prometheus lua</h1>
              <p className="text-sm text-gray-400">Advanced Lua Obfuscator</p>
            </div>
          </div>
        </motion.header>

        {/* Stats Row */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4"
        >
          <div className="bg-[#111] border border-gray-800 rounded-2xl p-6 flex items-center gap-4">
            <div className="p-3 bg-teal-500/10 rounded-full">
              <Shield className="w-6 h-6 text-teal-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400 font-medium">Files Protected</p>
              <p className="text-3xl font-semibold text-white tracking-tight">{stats.filesProtected}</p>
            </div>
          </div>

          <div className="bg-[#111] border border-gray-800 rounded-2xl p-6 flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 rounded-full">
              <Users className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400 font-medium">Active Visitors</p>
              <p className="text-3xl font-semibold text-white tracking-tight">
                <span className="w-2 h-2 rounded-full bg-blue-500 inline-block mr-2 animate-pulse" />
                {stats.activeVisitors}
              </p>
            </div>
          </div>

          <div className="bg-[#111] border border-gray-800 rounded-2xl p-6 flex items-center gap-4">
            <div className={`p-3 rounded-full ${
              sizeChange 
                ? sizeChange.isReduction 
                  ? 'bg-emerald-500/10 text-emerald-400' 
                  : 'bg-[#e6522c]/10 text-[#e6522c]' 
                : 'bg-gray-850/40 text-gray-500'
            }`}>
              <Zap className="w-6 h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-gray-400 font-medium truncate">Size Optimization</p>
              {sizeChange ? (
                <div>
                  <p className={`text-2xl font-semibold tracking-tight ${sizeChange.isReduction ? 'text-emerald-400' : 'text-[#e6522c]'}`}>
                    {sizeChange.isReduction ? '-' : '+'}{Math.abs(sizeChange.percentageChange).toFixed(1)}%
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">
                    {formatBytes(sizeChange.originalBytes)} → {formatBytes(sizeChange.obfuscatedBytes)}
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-2xl font-semibold text-gray-600 tracking-tight">--</p>
                  <p className="text-xs text-gray-600 mt-0.5">No file processed</p>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Uploader */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-[#111] rounded-2xl border border-gray-800 p-8 flex flex-col items-center justify-center text-center space-y-6"
        >
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex items-center bg-gray-900 rounded-xl p-1.5 border border-gray-800">
              <span className="text-xs text-gray-400 font-medium px-4 uppercase tracking-wider">Preset</span>
              <select 
                value={preset} 
                onChange={(e) => setPreset(e.target.value)}
                className="bg-gray-800 text-sm font-medium text-gray-200 rounded-lg px-4 py-2 outline-none border border-transparent focus:border-teal-500/50 transition-colors cursor-pointer appearance-none min-w-[120px]"
              >
                {PRESETS.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>

          <label
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`w-full max-w-xl mx-auto aspect-video rounded-3xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center gap-4 ${
              isDragging ? 'border-teal-500 bg-teal-500/5' : 'border-gray-700 hover:border-gray-500 bg-[#0c0c0c]'
            } ${loading ? 'opacity-50 pointer-events-none' : ''}`}
          >
            <input 
              type="file" 
              ref={fileInputRef}
              accept=".lua,.txt" 
              className="hidden" 
              onChange={handleFileUpload} 
              disabled={loading}
            />
            <AnimatePresence mode="wait">
              {loading ? (
                <motion.div 
                  key="loading"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col items-center gap-4"
                >
                  <Loader2 className="w-10 h-10 text-teal-500 animate-spin" />
                  <p className="text-gray-300 font-medium text-lg">Obfuscating file...</p>
                </motion.div>
              ) : downloadSuccess ? (
                <motion.div 
                  key="success"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15 }}
                  className="flex flex-col items-center gap-4"
                >
                  <div className="p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 text-emerald-400">
                    <motion.div
                      initial={{ scale: 0.5, rotate: -45 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ delay: 0.1, type: "spring" }}
                    >
                      <CheckCircle2 className="w-10 h-10" />
                    </motion.div>
                  </div>
                  <div>
                    <p className="text-emerald-400 font-medium text-lg">File Processed & Downloaded!</p>
                    <p className="text-gray-500 text-sm mt-1">Check your downloads folder</p>
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  key="idle"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col items-center gap-4"
                >
                  <div className="p-4 bg-gray-800/50 rounded-2xl">
                    <Upload className="w-8 h-8 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-gray-200 font-medium text-lg">Click to upload or drag & drop</p>
                    <p className="text-gray-500 text-sm mt-1">Accepts .lua files</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </label>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-4 rounded-xl flex items-center justify-center font-medium"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

        </motion.div>
      </div>
    </div>
  );
}
