import React, { useState, useMemo, useEffect } from 'react';
import { 
  Leaf, 
  Zap, 
  Droplets, 
  Cpu, 
  Globe, 
  Clock, 
  BarChart3, 
  Info, 
  AlertTriangle,
  RefreshCw,
  Server,
  Sun,
  Moon,
  Layers,
  Activity,
  ArrowRight,
  Database,
  Play,
  Square,
  History,
  LayoutDashboard,
  ExternalLink,
  CheckCircle2,
  Search,
  ChevronRight,
  FileText,
  ShieldCheck
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie,
  Legend,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import { WorkloadInput, FootprintResult, WorkloadType, Run, Metric } from './types';
import { HARDWARE_PROFILES, REGION_PROFILES } from './constants';
import { calculateFootprint, getInsights } from './services/footprintCalculator';

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

type ViewMode = 'Calculator' | 'Dashboard';

export default function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('Calculator');
  const [calcTab, setCalcTab] = useState<'Metrics' | 'Validation'>('Metrics');
  const [runs, setRuns] = useState<Run[]>([]);
  const [selectedRun, setSelectedRun] = useState<Run | null>(null);
  const [selectedRunMetrics, setSelectedRunMetrics] = useState<Metric[]>([]);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [liveMetrics, setLiveMetrics] = useState<Metric[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [aiValidation, setAiValidation] = useState<{ report: string; loading: boolean }>({ report: '', loading: false });

  const [input, setInput] = useState<WorkloadInput>({
    type: 'Training',
    modelName: 'Llama-3-70B',
    hardware: 'NVIDIA H100',
    count: 8,
    durationHours: 72,
    region: 'India (Average)',
    utilization: 0.85,
    timeOfDay: 'Day',
    epochs: 3,
    parametersBillion: 70,
    tokensMillion: 100,
    batchSize: 32
  });

  const result = useMemo(() => calculateFootprint(input), [input]);
  const insights = useMemo(() => getInsights(result, input), [result, input]);

  const fetchRuns = async () => {
    try {
      const res = await fetch('/api/runs');
      const data = await res.json();
      setRuns(data);
    } catch (e) {
      console.error('Failed to fetch runs', e);
    }
  };

  const fetchRunDetails = async (run: Run) => {
    setSelectedRun(run);
    setAiValidation({ report: '', loading: false });
    try {
      const res = await fetch(`/api/runs/${run.id}/metrics`);
      const data = await res.json();
      setSelectedRunMetrics(data);
    } catch (e) {
      console.error('Failed to fetch metrics', e);
    }
  };

  const validateWithAI = async (run: Run) => {
    setAiValidation({ report: '', loading: true });
    try {
      const model = "gemini-3-flash-preview";
      const prompt = `
        As an environmental AI auditor, validate the following carbon footprint estimation:
        
        WORKLOAD DETAILS:
        - Model: ${run.model_name}
        - Hardware: ${run.hardware}
        - Region: ${run.region}
        - Type: ${run.type}
        - Total Energy: ${run.total_energy_kwh.toFixed(4)} kWh
        - Total Carbon: ${run.total_carbon_kg.toFixed(4)} kg CO2e
        - Total Water: ${run.total_water_l.toFixed(4)} L
        
        Please provide a concise validation report (max 200 words) that:
        1. Confirms if these values are realistic for the given hardware and workload.
        2. Identifies potential sources of error or uncertainty.
        3. Suggests one specific technical optimization to reduce this footprint.
        
        Format the output in clean Markdown.
      `;

      const response = await genAI.models.generateContent({
        model,
        contents: [{ parts: [{ text: prompt }] }],
      });

      setAiValidation({ report: response.text || 'No report generated.', loading: false });
    } catch (e) {
      console.error('AI Validation failed', e);
      setAiValidation({ report: 'Failed to generate AI validation report.', loading: false });
    }
  };

  useEffect(() => {
    if (viewMode === 'Dashboard') {
      fetchRuns();
    }
  }, [viewMode]);

  const startTracking = async () => {
    const runId = `run_${Date.now()}`;
    setIsLoading(true);
    try {
      await fetch('/api/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: runId,
          modelName: input.modelName,
          hardware: input.hardware,
          region: input.region,
          type: input.type
        })
      });
      setActiveRunId(runId);
      setLiveMetrics([]);
      
      // Simulate SDK sending metrics every 2 seconds
      const interval = setInterval(async () => {
        const gpuPower = HARDWARE_PROFILES.find(h => h.name === input.hardware)!.powerW * (0.5 + Math.random() * 0.5);
        const cpuPower = 50 + Math.random() * 50;
        
        await fetch('/api/metrics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ runId, gpuPower, cpuPower })
        });

        setLiveMetrics(prev => [...prev, { 
          id: Date.now(), 
          run_id: runId, 
          timestamp: new Date().toISOString(), 
          gpu_power_w: gpuPower, 
          cpu_power_w: cpuPower 
        }]);
      }, 2000);

      (window as any)._trackingInterval = interval;
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const stopTracking = async () => {
    if (!activeRunId) return;
    clearInterval((window as any)._trackingInterval);
    
    const region = REGION_PROFILES.find(r => r.name === input.region)!;
    
    try {
      await fetch(`/api/runs/${activeRunId}/finish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          carbonIntensity: region.carbonIntensity,
          pue: region.pue,
          waterIntensity: region.waterIntensity
        })
      });
      setActiveRunId(null);
      fetchRuns();
      setViewMode('Dashboard');
    } catch (e) {
      console.error(e);
    }
  };

  const carbonBreakdown = [
    { name: 'Operational', value: result.operationalCarbonKg, color: '#3b82f6' },
    { name: 'Embodied', value: result.embodiedCarbonKg, color: '#94a3b8' },
  ];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setInput(prev => ({
      ...prev,
      [name]: ['count', 'durationHours', 'utilization', 'epochs', 'parametersBillion', 'tokensMillion', 'batchSize'].includes(name)
        ? parseFloat(value) || 0
        : value
    }));
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans selection:bg-emerald-100 pb-20">
      {/* Header */}
      <header className="border-b border-black/5 bg-white sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white">
              <Leaf size={18} />
            </div>
            <h1 className="text-lg font-semibold tracking-tight">EcoAI Tracker <span className="text-emerald-600 font-normal ml-1">Pro</span></h1>
          </div>
          
          <div className="flex bg-[#F3F4F6] p-1 rounded-lg">
            <button
              onClick={() => setViewMode('Calculator')}
              className={`px-4 py-1.5 text-[10px] font-bold uppercase rounded-md transition-all flex items-center gap-2 ${
                viewMode === 'Calculator' ? 'bg-white text-emerald-600 shadow-sm' : 'text-black/40 hover:text-black/60'
              }`}
            >
              <RefreshCw size={12} />
              Calculator
            </button>
            <button
              onClick={() => setViewMode('Dashboard')}
              className={`px-4 py-1.5 text-[10px] font-bold uppercase rounded-md transition-all flex items-center gap-2 ${
                viewMode === 'Dashboard' ? 'bg-white text-emerald-600 shadow-sm' : 'text-black/40 hover:text-black/60'
              }`}
            >
              <LayoutDashboard size={12} />
              Dashboard
            </button>
          </div>

          <div className="hidden md:flex items-center gap-6 text-[10px] font-bold uppercase tracking-[0.1em] text-black/40">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Real-time Grid Data</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span>LCA Amortization</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        {viewMode === 'Calculator' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left Column: Inputs */}
            <div className="lg:col-span-4 space-y-6">
              <section className="bg-white rounded-2xl border border-black/5 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-sm font-semibold flex items-center gap-2 text-black/60">
                    <Activity size={16} />
                    Workload Attribution
                  </h2>
                  <div className="flex bg-[#F3F4F6] p-1 rounded-lg">
                    {(['Training', 'Inference'] as WorkloadType[]).map(t => (
                      <button
                        key={t}
                        onClick={() => setInput(prev => ({ ...prev, type: t }))}
                        className={`px-3 py-1 text-[10px] font-bold uppercase rounded-md transition-all ${
                          input.type === t ? 'bg-white text-emerald-600 shadow-sm' : 'text-black/40 hover:text-black/60'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="space-y-5">
                  <div>
                    <label className="block text-[10px] font-bold text-black/40 uppercase mb-2">Model Identifier</label>
                    <input 
                      type="text"
                      name="modelName"
                      value={input.modelName}
                      onChange={handleInputChange}
                      placeholder="e.g. GPT-4, Llama-3"
                      className="w-full bg-[#F3F4F6] border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500/20 transition-all outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-black/40 uppercase mb-2">Hardware</label>
                      <select 
                        name="hardware"
                        value={input.hardware}
                        onChange={handleInputChange}
                        className="w-full bg-[#F3F4F6] border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500/20 transition-all outline-none"
                      >
                        {HARDWARE_PROFILES.map(h => <option key={h.name} value={h.name}>{h.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-black/40 uppercase mb-2">Region</label>
                      <select 
                        name="region"
                        value={input.region}
                        onChange={handleInputChange}
                        className="w-full bg-[#F3F4F6] border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500/20 transition-all outline-none"
                      >
                        {REGION_PROFILES.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-black/40 uppercase mb-2">Instance Count</label>
                      <input 
                        type="number"
                        name="count"
                        value={input.count}
                        onChange={handleInputChange}
                        className="w-full bg-[#F3F4F6] border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500/20 transition-all outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-black/40 uppercase mb-2">Total Hours</label>
                      <input 
                        type="number"
                        name="durationHours"
                        value={input.durationHours}
                        onChange={handleInputChange}
                        className="w-full bg-[#F3F4F6] border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500/20 transition-all outline-none"
                      />
                    </div>
                  </div>

                  {input.type === 'Training' ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-black/40 uppercase mb-2">Epochs</label>
                        <input 
                          type="number"
                          name="epochs"
                          value={input.epochs}
                          onChange={handleInputChange}
                          className="w-full bg-[#F3F4F6] border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500/20 transition-all outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-black/40 uppercase mb-2">Params (B)</label>
                        <input 
                          type="number"
                          name="parametersBillion"
                          value={input.parametersBillion}
                          onChange={handleInputChange}
                          className="w-full bg-[#F3F4F6] border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500/20 transition-all outline-none"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-black/40 uppercase mb-2">Tokens (M)</label>
                        <input 
                          type="number"
                          name="tokensMillion"
                          value={input.tokensMillion}
                          onChange={handleInputChange}
                          className="w-full bg-[#F3F4F6] border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500/20 transition-all outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-black/40 uppercase mb-2">Batch Size</label>
                        <input 
                          type="number"
                          name="batchSize"
                          value={input.batchSize}
                          onChange={handleInputChange}
                          className="w-full bg-[#F3F4F6] border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500/20 transition-all outline-none"
                        />
                      </div>
                    </div>
                  )}

                  <div className="pt-2">
                    <label className="block text-[10px] font-bold text-black/40 uppercase mb-3">Schedule Preference</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setInput(prev => ({ ...prev, timeOfDay: 'Day' }))}
                        className={`flex items-center justify-center gap-2 py-3 rounded-xl border transition-all ${
                          input.timeOfDay === 'Day' 
                            ? 'bg-amber-50 border-amber-200 text-amber-700' 
                            : 'bg-white border-black/5 text-black/40 hover:bg-gray-50'
                        }`}
                      >
                        <Sun size={14} />
                        <span className="text-xs font-bold">Day</span>
                      </button>
                      <button
                        onClick={() => setInput(prev => ({ ...prev, timeOfDay: 'Night' }))}
                        className={`flex items-center justify-center gap-2 py-3 rounded-xl border transition-all ${
                          input.timeOfDay === 'Night' 
                            ? 'bg-indigo-50 border-indigo-200 text-indigo-700' 
                            : 'bg-white border-black/5 text-black/40 hover:bg-gray-50'
                        }`}
                      >
                        <Moon size={14} />
                        <span className="text-xs font-bold">Night</span>
                      </button>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-black/5">
                    <button
                      onClick={activeRunId ? stopTracking : startTracking}
                      disabled={isLoading}
                      className={`w-full py-4 rounded-xl font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all ${
                        activeRunId 
                          ? 'bg-red-50 text-red-600 hover:bg-red-100' 
                          : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-600/20'
                      }`}
                    >
                      {activeRunId ? (
                        <>
                          <Square size={14} fill="currentColor" />
                          Stop Live Tracking
                        </>
                      ) : (
                        <>
                          <Play size={14} fill="currentColor" />
                          Start Live Tracking
                        </>
                      )}
                    </button>
                    <p className="text-[9px] text-center text-black/30 mt-3 font-bold uppercase tracking-tighter">
                      {activeRunId ? 'Tracking real-time GPU/CPU power metrics...' : 'Simulate SDK-based tracking for this workload'}
                    </p>
                  </div>
                </div>
              </section>

              <section className="bg-white rounded-2xl border border-black/5 p-6 shadow-sm">
                <h3 className="text-sm font-semibold mb-4 flex items-center gap-2 text-black/60">
                  <Leaf size={16} className="text-emerald-600" />
                  Green Suggestions
                </h3>
                <div className="space-y-3">
                  {insights.map((insight, idx) => (
                    <div key={idx} className="group p-3 rounded-xl bg-[#F9FAFB] border border-black/5 hover:border-emerald-200 hover:bg-emerald-50/30 transition-all cursor-default">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="text-[11px] font-bold text-black/80">{insight.title}</h4>
                        <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                          insight.impact === 'High' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {insight.impact}
                        </span>
                      </div>
                      <p className="text-[10px] text-black/50 leading-relaxed group-hover:text-black/70">{insight.description}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {/* Right Column: Results */}
            <div className="lg:col-span-8 space-y-8">
              
              {activeRunId && (
                <motion.div 
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-emerald-900 text-white p-6 rounded-2xl shadow-xl overflow-hidden relative"
                >
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Activity size={120} />
                  </div>
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-emerald-400 rounded-full animate-pulse" />
                      <h3 className="text-sm font-bold uppercase tracking-widest">Live SDK Tracking Active</h3>
                    </div>
                    <div className="text-[10px] font-mono opacity-60">ID: {activeRunId}</div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-6">
                    <div>
                      <div className="text-[10px] font-bold opacity-40 uppercase mb-1">GPU Power</div>
                      <div className="text-2xl font-black">{liveMetrics[liveMetrics.length - 1]?.gpu_power_w.toFixed(1) || '0.0'} <span className="text-xs font-bold opacity-40">W</span></div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold opacity-40 uppercase mb-1">CPU Power</div>
                      <div className="text-2xl font-black">{liveMetrics[liveMetrics.length - 1]?.cpu_power_w.toFixed(1) || '0.0'} <span className="text-xs font-bold opacity-40">W</span></div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold opacity-40 uppercase mb-1">Data Points</div>
                      <div className="text-2xl font-black">{liveMetrics.length}</div>
                    </div>
                  </div>

                  <div className="mt-6 h-32 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={liveMetrics.slice(-20)}>
                        <Line type="monotone" dataKey="gpu_power_w" stroke="#10b981" strokeWidth={3} dot={false} isAnimationActive={false} />
                        <Line type="monotone" dataKey="cpu_power_w" stroke="#3b82f6" strokeWidth={2} dot={false} isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </motion.div>
              )}

              {/* Attribution Summary */}
              <div className="bg-white p-8 rounded-2xl border border-black/5 shadow-sm overflow-hidden relative">
                <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
                  <Globe size={200} />
                </div>
                
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-black uppercase rounded">Estimated</span>
                      <h2 className="text-2xl font-bold tracking-tight">{input.modelName}</h2>
                    </div>
                    <p className="text-xs text-black/40 font-medium">Lifecycle footprint for {input.type.toLowerCase()} workload</p>
                  </div>
                  <div className="text-right">
                    <div className="text-4xl font-black tracking-tighter text-emerald-600">
                      {result.totalCarbonKg.toFixed(2)}
                      <span className="text-lg ml-1 font-bold text-black/20">kg CO₂e</span>
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-black/30 mt-1">Total Lifecycle Emissions</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl bg-[#F9FAFB] border border-black/5">
                    <div className="text-[10px] font-bold text-black/30 uppercase mb-1">Operational</div>
                    <div className="text-lg font-bold">{result.operationalCarbonKg.toFixed(1)} <span className="text-xs font-normal opacity-40">kg</span></div>
                  </div>
                  <div className="p-4 rounded-xl bg-[#F9FAFB] border border-black/5">
                    <div className="text-[10px] font-bold text-black/30 uppercase mb-1">Embodied</div>
                    <div className="text-lg font-bold">{result.embodiedCarbonKg.toFixed(1)} <span className="text-xs font-normal opacity-40">kg</span></div>
                  </div>
                  <div className="p-4 rounded-xl bg-[#F9FAFB] border border-black/5">
                    <div className="text-[10px] font-bold text-black/30 uppercase mb-1">Energy</div>
                    <div className="text-lg font-bold">{result.operationalEnergyKWh.toFixed(1)} <span className="text-xs font-normal opacity-40">kWh</span></div>
                  </div>
                  <div className="p-4 rounded-xl bg-[#F9FAFB] border border-black/5">
                    <div className="text-[10px] font-bold text-black/30 uppercase mb-1">Water</div>
                    <div className="text-lg font-bold">{result.waterLiters.toFixed(1)} <span className="text-xs font-normal opacity-40">L</span></div>
                  </div>
                </div>
              </div>

              {/* Detailed Metrics & Validation Tabs */}
              <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
                <div className="flex border-b border-black/5">
                  <button
                    onClick={() => setCalcTab('Metrics')}
                    className={`px-6 py-4 text-[10px] font-bold uppercase tracking-widest transition-all ${
                      calcTab === 'Metrics' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-black/30 hover:text-black/50'
                    }`}
                  >
                    Detailed Metrics
                  </button>
                  <button
                    onClick={() => setCalcTab('Validation')}
                    className={`px-6 py-4 text-[10px] font-bold uppercase tracking-widest transition-all ${
                      calcTab === 'Validation' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-black/30 hover:text-black/50'
                    }`}
                  >
                    Validation Logic
                  </button>
                </div>

                <div className="p-6">
                  {calcTab === 'Metrics' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Attribution Metrics */}
                      <div className="space-y-6">
                        <h3 className="text-xs font-bold text-black/30 uppercase tracking-widest flex items-center gap-2">
                          <Layers size={14} />
                          Unit Attribution
                        </h3>
                        <div className="space-y-6">
                          {input.type === 'Training' ? (
                            <div className="flex items-center justify-between p-4 bg-emerald-50/50 rounded-xl border border-emerald-100">
                              <div>
                                <div className="text-[10px] font-bold text-emerald-800/50 uppercase">Per Epoch</div>
                                <div className="text-xl font-black text-emerald-900">{(result.metrics.perEpoch || 0).toFixed(3)} <span className="text-xs font-bold opacity-40">kg CO₂e</span></div>
                              </div>
                              <ArrowRight className="text-emerald-300" size={20} />
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center justify-between p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                                <div>
                                  <div className="text-[10px] font-bold text-blue-800/50 uppercase">Per 1M Tokens</div>
                                  <div className="text-xl font-black text-blue-900">{(result.metrics.perMillionTokens || 0).toFixed(4)} <span className="text-xs font-bold opacity-40">kg CO₂e</span></div>
                                </div>
                                <ArrowRight className="text-blue-300" size={20} />
                              </div>
                              <div className="flex items-center justify-between p-4 bg-cyan-50/50 rounded-xl border border-cyan-100">
                                <div>
                                  <div className="text-[10px] font-bold text-cyan-800/50 uppercase">Per Inference</div>
                                  <div className="text-xl font-black text-cyan-900">{(result.metrics.perInference || 0).toFixed(6)} <span className="text-xs font-bold opacity-40">kg CO₂e</span></div>
                                </div>
                                <ArrowRight className="text-cyan-300" size={20} />
                              </div>
                            </>
                          )}
                          
                          <div className="pt-4 border-t border-black/5">
                            <div className="flex items-center justify-between text-[11px] font-medium text-black/40">
                              <span>Grid Intensity</span>
                              <span className="font-bold text-black/60">{REGION_PROFILES.find(r => r.name === input.region)?.carbonIntensity.toFixed(3)} kg/kWh</span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] font-medium text-black/40 mt-2">
                              <span>PUE Factor</span>
                              <span className="font-bold text-black/60">{REGION_PROFILES.find(r => r.name === input.region)?.pue}x</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Carbon Composition */}
                      <div>
                        <h3 className="text-xs font-bold text-black/30 uppercase tracking-widest mb-6 flex items-center gap-2">
                          <Database size={14} />
                          Carbon Composition
                        </h3>
                        <div className="h-[180px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={carbonBreakdown}
                                cx="50%"
                                cy="50%"
                                innerRadius={50}
                                outerRadius={70}
                                paddingAngle={8}
                                dataKey="value"
                              >
                                {carbonBreakdown.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip 
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '10px' }}
                              />
                              <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <p className="text-[10px] text-center text-black/30 font-medium px-4 mt-2">
                          Embodied carbon accounts for the manufacturing footprint of {input.count}x {input.hardware} units.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-6">
                        <h3 className="text-xs font-bold text-black/30 uppercase tracking-widest flex items-center gap-2">
                          <ShieldCheck size={14} />
                          Estimation Formula
                        </h3>
                        <div className="space-y-4">
                          <div className="p-4 rounded-xl bg-[#F9FAFB] border border-black/5 font-mono text-[11px] space-y-3">
                            <div>
                              <div className="text-black/40 mb-1">1. Operational Energy (kWh)</div>
                              <div className="text-emerald-700">({HARDWARE_PROFILES.find(h => h.name === input.hardware)?.powerW}W × {input.count} × {input.durationHours}h × {REGION_PROFILES.find(r => r.name === input.region)?.pue} PUE × {input.utilization} Util) / 1000</div>
                              <div className="text-black/60 mt-1">= {result.operationalEnergyKWh.toFixed(2)} kWh</div>
                            </div>
                            <div>
                              <div className="text-black/40 mb-1">2. Operational Carbon (kg)</div>
                              <div className="text-emerald-700">{result.operationalEnergyKWh.toFixed(2)} kWh × {REGION_PROFILES.find(r => r.name === input.region)?.carbonIntensity} kg/kWh</div>
                              <div className="text-black/60 mt-1">= {result.operationalCarbonKg.toFixed(2)} kg</div>
                            </div>
                            <div>
                              <div className="text-black/40 mb-1">3. Embodied Carbon (kg)</div>
                              <div className="text-emerald-700">({HARDWARE_PROFILES.find(h => h.name === input.hardware)?.embodiedCarbonKg}kg × {input.count} / 26280h) × {input.durationHours}h</div>
                              <div className="text-black/60 mt-1">= {result.embodiedCarbonKg.toFixed(2)} kg</div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <h3 className="text-xs font-bold text-black/30 uppercase tracking-widest flex items-center gap-2">
                          <Info size={14} />
                          Validation Sources
                        </h3>
                        <div className="space-y-3">
                          <div className="p-3 rounded-xl bg-[#F9FAFB] border border-black/5">
                            <h4 className="text-[10px] font-bold text-black/80 uppercase mb-1">Carbon Intensity</h4>
                            <p className="text-[10px] text-black/50">Sourced from Ember (2024 Yearly Average) and ElectricityMap real-time regional averages.</p>
                          </div>
                          <div className="p-3 rounded-xl bg-[#F9FAFB] border border-black/5">
                            <h4 className="text-[10px] font-bold text-black/80 uppercase mb-1">PUE (Power Usage Effectiveness)</h4>
                            <p className="text-[10px] text-black/50">Based on Uptime Institute Global Data Center Survey and Cloud Provider CSR reports.</p>
                          </div>
                          <div className="p-3 rounded-xl bg-[#F9FAFB] border border-black/5">
                            <h4 className="text-[10px] font-bold text-black/80 uppercase mb-1">Embodied Carbon</h4>
                            <p className="text-[10px] text-black/50">Derived from LCA (Life Cycle Assessment) studies of NVIDIA H100/A100 and generic server hardware.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Comparison Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-5 rounded-2xl border border-black/5 shadow-sm text-center">
                  <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3 text-gray-400">
                    <RefreshCw size={18} />
                  </div>
                  <div className="text-xl font-black">{result.equivalents.smartphoneCharges.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                  <div className="text-[9px] font-bold uppercase text-black/30 tracking-wider">Phone Charges</div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-black/5 shadow-sm text-center">
                  <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3 text-gray-400">
                    <Globe size={18} />
                  </div>
                  <div className="text-xl font-black">{result.equivalents.carMiles.toFixed(1)}</div>
                  <div className="text-[9px] font-bold uppercase text-black/30 tracking-wider">Miles Driven</div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-black/5 shadow-sm text-center">
                  <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3 text-gray-400">
                    <Leaf size={18} />
                  </div>
                  <div className="text-xl font-black">{result.equivalents.treeYears.toFixed(2)}</div>
                  <div className="text-[9px] font-bold uppercase text-black/30 tracking-wider">Tree-Years</div>
                </div>
              </div>

            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Tracking Dashboard</h2>
                <p className="text-sm text-black/40">Historical runs and real-time metrics from the EcoAI SDK</p>
              </div>
              <div className="flex gap-3">
                {selectedRun && (
                  <button 
                    onClick={() => setSelectedRun(null)}
                    className="px-4 py-2 bg-white border border-black/5 rounded-xl text-xs font-bold uppercase text-black/60 hover:text-black transition-all"
                  >
                    Back to List
                  </button>
                )}
                <button 
                  onClick={fetchRuns}
                  className="p-2 bg-white border border-black/5 rounded-xl text-black/40 hover:text-black transition-all"
                >
                  <RefreshCw size={18} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-8">
                {!selectedRun ? (
                  <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[#F9FAFB] border-b border-black/5">
                          <th className="px-6 py-4 text-[10px] font-bold uppercase text-black/30">Model / Run ID</th>
                          <th className="px-6 py-4 text-[10px] font-bold uppercase text-black/30">Hardware</th>
                          <th className="px-6 py-4 text-[10px] font-bold uppercase text-black/30">Status</th>
                          <th className="px-6 py-4 text-[10px] font-bold uppercase text-black/30 text-right">Carbon (kg)</th>
                          <th className="px-6 py-4 text-[10px] font-bold uppercase text-black/30 text-right">Energy (kWh)</th>
                          <th className="px-6 py-4 text-[10px] font-bold uppercase text-black/30 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/5">
                        {runs.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-6 py-20 text-center text-black/20 font-medium">
                              No runs recorded yet. Start a live tracking session in the Calculator.
                            </td>
                          </tr>
                        ) : (
                          runs.map(run => (
                            <tr 
                              key={run.id} 
                              onClick={() => fetchRunDetails(run)}
                              className="hover:bg-gray-50/50 transition-all group cursor-pointer"
                            >
                              <td className="px-6 py-4">
                                <div className="font-bold text-sm group-hover:text-emerald-600 transition-colors">{run.model_name}</div>
                                <div className="text-[10px] font-mono text-black/30">{run.id}</div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="text-xs font-medium">{run.hardware}</div>
                                <div className="text-[10px] text-black/30">{run.region}</div>
                              </td>
                              <td className="px-6 py-4">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                                  run.status === 'finished' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700 animate-pulse'
                                }`}>
                                  {run.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right font-bold text-sm">
                                {run.total_carbon_kg.toFixed(3)}
                              </td>
                              <td className="px-6 py-4 text-right font-bold text-sm">
                                {run.total_energy_kwh.toFixed(2)}
                              </td>
                              <td className="px-6 py-4 text-center">
                                <ChevronRight size={16} className="mx-auto text-black/20 group-hover:text-emerald-500 transition-all" />
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-6"
                  >
                    <div className="bg-white p-8 rounded-2xl border border-black/5 shadow-sm">
                      <div className="flex items-center justify-between mb-8">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-xl font-bold">{selectedRun.model_name}</h3>
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-black uppercase rounded">Verified Run</span>
                          </div>
                          <p className="text-xs text-black/40 font-mono">{selectedRun.id} • {new Date(selectedRun.start_time).toLocaleString()}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-3xl font-black text-emerald-600">{selectedRun.total_carbon_kg.toFixed(4)} <span className="text-sm font-bold text-black/20">kg CO₂e</span></div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-6 mb-8">
                        <div className="p-4 rounded-xl bg-[#F9FAFB] border border-black/5">
                          <div className="text-[10px] font-bold text-black/30 uppercase mb-1">Hardware</div>
                          <div className="text-sm font-bold">{selectedRun.hardware}</div>
                        </div>
                        <div className="p-4 rounded-xl bg-[#F9FAFB] border border-black/5">
                          <div className="text-[10px] font-bold text-black/30 uppercase mb-1">Region</div>
                          <div className="text-sm font-bold">{selectedRun.region}</div>
                        </div>
                        <div className="p-4 rounded-xl bg-[#F9FAFB] border border-black/5">
                          <div className="text-[10px] font-bold text-black/30 uppercase mb-1">Energy</div>
                          <div className="text-sm font-bold">{selectedRun.total_energy_kwh.toFixed(3)} kWh</div>
                        </div>
                      </div>

                      <div className="h-64 w-full">
                        <h4 className="text-[10px] font-bold text-black/30 uppercase mb-4 flex items-center gap-2">
                          <Activity size={12} />
                          Power Consumption Profile (W)
                        </h4>
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={selectedRunMetrics}>
                            <defs>
                              <linearGradient id="colorGpu" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                              </linearGradient>
                              <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f1" />
                            <XAxis 
                              dataKey="timestamp" 
                              hide 
                            />
                            <YAxis 
                              axisLine={false}
                              tickLine={false}
                              tick={{ fontSize: 10, fill: '#94a3b8' }}
                            />
                            <Tooltip 
                              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                            />
                            <Area type="monotone" dataKey="gpu_power_w" name="GPU Power" stroke="#10b981" fillOpacity={1} fill="url(#colorGpu)" strokeWidth={2} />
                            <Area type="monotone" dataKey="cpu_power_w" name="CPU Power" stroke="#3b82f6" fillOpacity={1} fill="url(#colorCpu)" strokeWidth={2} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="bg-white p-8 rounded-2xl border border-black/5 shadow-sm">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                          <ShieldCheck size={16} className="text-emerald-600" />
                          Validation & Methodology
                        </h3>
                        <button 
                          onClick={() => validateWithAI(selectedRun)}
                          disabled={aiValidation.loading}
                          className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold uppercase flex items-center gap-2 hover:bg-emerald-700 transition-all disabled:opacity-50"
                        >
                          {aiValidation.loading ? <RefreshCw size={14} className="animate-spin" /> : <Zap size={14} />}
                          Verify with AI
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                          <h4 className="text-[10px] font-bold text-black/30 uppercase">Calculation Logic</h4>
                          <div className="p-4 rounded-xl bg-[#F9FAFB] border border-black/5 font-mono text-[11px] space-y-2">
                            <div className="flex justify-between">
                              <span className="text-black/40">Energy (E)</span>
                              <span>∫ P(t) dt</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-black/40">Carbon (C)</span>
                              <span>E × PUE × Intensity</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-black/40">Water (W)</span>
                              <span>E × PUE × WaterIntensity</span>
                            </div>
                          </div>
                          <div className="text-[10px] text-black/40 leading-relaxed">
                            Our estimation engine uses trapezoidal integration over time-series power data collected at 2s intervals. PUE and Carbon Intensity are sourced from regional grid data (2024 updates).
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h4 className="text-[10px] font-bold text-black/30 uppercase">AI Validation Report</h4>
                          {aiValidation.loading ? (
                            <div className="h-32 flex flex-col items-center justify-center gap-3 text-black/20">
                              <RefreshCw size={24} className="animate-spin" />
                              <span className="text-[10px] font-bold uppercase">Analyzing workload parameters...</span>
                            </div>
                          ) : aiValidation.report ? (
                            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100 text-[11px] text-emerald-900 leading-relaxed prose prose-sm max-w-none">
                              {aiValidation.report}
                            </div>
                          ) : (
                            <div className="h-32 flex flex-col items-center justify-center gap-3 border-2 border-dashed border-black/5 rounded-xl text-black/20">
                              <Search size={24} />
                              <span className="text-[10px] font-bold uppercase">No validation report yet</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>

              <div className="lg:col-span-4 space-y-6">
                <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm">
                  <h3 className="text-xs font-bold text-black/30 uppercase tracking-widest mb-6 flex items-center gap-2">
                    <ExternalLink size={14} />
                    SDK Integration
                  </h3>
                  <div className="bg-black rounded-xl p-4 font-mono text-[10px] text-emerald-400 overflow-x-auto">
                    <div className="opacity-40 mb-2"># Install the SDK</div>
                    <div>pip install ecoai-sdk</div>
                    <div className="opacity-40 my-2"># Usage in train.py</div>
                    <div>from ecoai import Tracker</div>
                    <div className="text-white">tracker = Tracker(model="Llama-3")</div>
                    <div className="text-white">tracker.start()</div>
                    <div className="opacity-40 my-2"># Your training loop</div>
                    <div className="text-white">train_model()</div>
                    <div className="text-white">tracker.stop()</div>
                  </div>
                  <p className="text-[10px] text-black/40 mt-4 leading-relaxed">
                    The SDK automatically collects GPU/CPU power metrics and sends them to this local collector for lifecycle attribution.
                  </p>
                </div>

                <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100">
                  <h3 className="text-xs font-bold text-emerald-800/50 uppercase tracking-widest mb-4">Architecture Validation</h3>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-3">
                      <div className="w-4 h-4 rounded-full bg-emerald-200 flex items-center justify-center text-emerald-700 text-[8px] font-bold mt-0.5">1</div>
                      <p className="text-[10px] text-emerald-900/70 font-medium">Metrics are collected locally via the SDK from hardware sensors.</p>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="w-4 h-4 rounded-full bg-emerald-200 flex items-center justify-center text-emerald-700 text-[8px] font-bold mt-0.5">2</div>
                      <p className="text-[10px] text-emerald-900/70 font-medium">The Estimation Engine converts raw power (W) to energy (kWh) using time-series integration.</p>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="w-4 h-4 rounded-full bg-emerald-200 flex items-center justify-center text-emerald-700 text-[8px] font-bold mt-0.5">3</div>
                      <p className="text-[10px] text-emerald-900/70 font-medium">Carbon and water footprints are calculated using regional intensity factors.</p>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="max-w-7xl mx-auto px-6 py-12 border-t border-black/5 mt-12">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 opacity-40">
            <Leaf size={16} />
            <span className="text-xs font-medium uppercase tracking-widest">EcoAI Framework v2.0</span>
          </div>
          <div className="flex gap-8">
            <a href="#" className="text-[10px] font-bold uppercase text-black/40 hover:text-black transition-colors">LCA Methodology</a>
            <a href="#" className="text-[10px] font-bold uppercase text-black/40 hover:text-black transition-colors">Grid Data Sources</a>
            <a href="#" className="text-[10px] font-bold uppercase text-black/40 hover:text-black transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
