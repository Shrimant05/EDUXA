"use client";

import { useState, useEffect, use } from "react";
import { motion } from "framer-motion";
import { 
  BarChart3, Users, BookMarked, AlertTriangle, 
  TrendingUp, Search, Plus, FileText, Upload, 
  ChevronLeft, Loader2, CheckCircle2, Download, Trash2 
} from "lucide-react";
import axios from "axios";
import Link from "next/link";

const API_BASE = "http://localhost:8000";

export default function ClassroomDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [stats, setStats] = useState<any>(null);
  const [heatmap, setHeatmap] = useState<any[]>([]);
  const [participants, setParticipants] = useState<any>(null);
  const [materials, setMaterials] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    fetchClassroomData();
  }, [id]);

  const fetchClassroomData = async () => {
    setIsLoading(true);
    try {
      const [resStats, resHeatmap, resParts, resMats] = await Promise.all([
        axios.get(`${API_BASE}/analytics/stats/${id}`),
        axios.get(`${API_BASE}/analytics/heatmap/${id}`),
        axios.get(`${API_BASE}/classrooms/${id}/participants`),
        axios.get(`${API_BASE}/classrooms/${id}/materials`)
      ]);
      
      setStats(resStats.data);
      setHeatmap(resHeatmap.data);
      setParticipants(resParts.data);
      setMaterials(resMats.data);
    } catch (err) {
      console.error("Failed to fetch classroom data", err);
    } finally {
      setIsLoading(false);
    }
  };
  const handleDeleteClassroom = async () => {
    if (!confirm(`Are you sure you want to delete this classroom? This will also delete all uploaded materials and analytics.`)) return;
    try {
      await axios.delete(`${API_BASE}/classrooms/${id}`);
      window.location.href = "/dashboard";
      alert("Classroom deleted successfully");
    } catch (err) {
      alert("Failed to delete classroom");
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    
    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      await axios.post(`${API_BASE}/upload?classroom_id=${id}`, formData, {
        headers: {
          "Content-Type": "multipart/form-data"
        }
      });
      setSelectedFile(null);
      alert("Material uploaded and indexed!");
      fetchClassroomData();
    } catch (err) {
      console.error("Upload failed", err);
      alert("Upload failed. Please ensure the backend is running and the file type is supported.");
    } finally {
      setIsUploading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#050510] flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050510] text-slate-200 p-8">
      <header className="max-w-7xl mx-auto flex items-center justify-between mb-12">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="p-2 hover:bg-slate-800 rounded-xl transition-colors text-slate-400">
            <ChevronLeft className="w-6 h-6" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">Classroom Details</h1>
            <p className="text-slate-500">ID: {id}</p>
          </div>
        </div>
        <button 
          onClick={handleDeleteClassroom}
          className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl text-sm font-bold transition-all flex items-center gap-2"
        >
          <Trash2 className="w-4 h-4" />
          Delete Room
        </button>
      </header>

      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Stats and Heatmap */}
        <div className="lg:col-span-2 space-y-8">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass p-6 rounded-2xl">
              <h3 className="text-slate-400 text-sm font-medium mb-2">Total Queries</h3>
              <div className="text-4xl font-bold text-white">{stats?.total_queries || 0}</div>
            </div>
            <div className="glass p-6 rounded-2xl">
              <h3 className="text-slate-400 text-sm font-medium mb-2">Confusion Points</h3>
              <div className="text-4xl font-bold text-amber-400">{stats?.confusion_points || 0}</div>
            </div>
            <div className="glass p-6 rounded-2xl">
              <h3 className="text-slate-400 text-sm font-medium mb-2">Out-of-Scope</h3>
              <div className="text-4xl font-bold text-rose-400">{stats?.out_of_scope || 0}</div>
            </div>
          </div>

          {/* Heatmap */}
          <div className="glass p-8 rounded-3xl">
            <div className="flex items-center gap-3 mb-8">
              <BarChart3 className="w-6 h-6 text-indigo-400" />
              <h2 className="text-xl font-bold">Concept Confusion Heatmap</h2>
            </div>
            <div className="space-y-6">
              {heatmap.map((item, idx) => (
                <div key={idx} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-2">
                      {item.concept}
                      {item.is_out_of_scope && (
                        <span className="text-[10px] bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded border border-rose-500/20 uppercase tracking-tighter">
                          Out of Scope
                        </span>
                      )}
                    </span>
                    <span className="text-slate-400">{item.count} queries</span>
                  </div>
                  <div className="h-3 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(item.count / (heatmap[0]?.count || 1)) * 100}%` }}
                      className={`h-full rounded-full ${item.is_out_of_scope ? 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.4)]' : 'bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.4)]'}`}
                    />
                  </div>
                </div>
              ))}
              {heatmap.length === 0 && (
                <div className="text-center py-12 text-slate-500 italic">No query data available for this classroom.</div>
              )}
            </div>
          </div>

          {/* Materials Section */}
          <div className="glass p-8 rounded-3xl">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <BookMarked className="w-6 h-6 text-emerald-400" />
                <h2 className="text-xl font-bold">Course Materials</h2>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              {materials.map((mat) => (
                <div key={mat.id} className="p-4 bg-slate-900/50 rounded-2xl border border-slate-800 flex items-center justify-between group hover:border-indigo-500/30 transition-all">
                  <div className="flex items-center gap-3">
                    <FileText className="w-8 h-8 text-slate-500" />
                    <div>
                      <div className="text-sm font-medium text-slate-200">{mat.name}</div>
                      <div className="text-[10px] text-slate-600 uppercase tracking-widest">{mat.type}</div>
                    </div>
                  </div>
                  <button 
                    onClick={() => window.open(`${API_BASE}/materials/${mat.id}/download`, '_blank')}
                    className="p-2 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-indigo-400 transition-all"
                    title="Download"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="p-6 bg-indigo-500/5 rounded-3xl border border-indigo-500/10">
              <h3 className="text-sm font-bold text-indigo-400 mb-4 flex items-center gap-2">
                <Plus className="w-4 h-4" /> Upload New Material (PDF, DOCX, TXT)
              </h3>
              <div className="space-y-4">
                <div className="relative group">
                  <input 
                    type="file"
                    id="file-upload"
                    className="hidden"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    accept=".pdf,.docx,.txt"
                  />
                  <label 
                    htmlFor="file-upload"
                    className="w-full flex items-center justify-center gap-3 px-4 py-8 border-2 border-dashed border-slate-700 rounded-2xl cursor-pointer hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all group"
                  >
                    {selectedFile ? (
                      <div className="flex flex-col items-center gap-1 text-center">
                        <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-1" />
                        <span className="text-sm font-medium text-slate-200 truncate max-w-xs">{selectedFile.name}</span>
                        <span className="text-[10px] text-slate-500 uppercase">{(selectedFile.size / 1024).toFixed(1)} KB</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-slate-500 group-hover:text-slate-400 text-center">
                        <Upload className="w-10 h-10 mb-1" />
                        <span className="text-sm font-medium">Click to select or drag & drop</span>
                        <span className="text-[10px] uppercase tracking-widest">PDF, DOCX, or TXT</span>
                      </div>
                    )}
                  </label>
                </div>
                
                <button 
                  onClick={handleUpload}
                  disabled={isUploading || !selectedFile}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:bg-slate-800 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-500/20"
                >
                  {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                  {isUploading ? "Processing..." : "Upload & Index"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Students/Participants */}
        <div className="space-y-8">
          <div className="glass p-8 rounded-3xl">
            <div className="flex items-center gap-3 mb-8">
              <Users className="w-6 h-6 text-indigo-400" />
              <h2 className="text-xl font-bold">Enrolled Students</h2>
            </div>
            <div className="space-y-4">
              {participants?.students.map((student: any) => (
                <div key={student.id} className="flex items-center justify-between p-3 bg-slate-900/30 rounded-xl border border-slate-800/50 hover:border-indigo-500/20 transition-all group">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 font-bold group-hover:bg-indigo-500/20 transition-all">
                      {student.username[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-slate-200">{student.username}</div>
                      <div className="text-[10px] text-slate-600 font-mono">{student.id.substring(0, 12)}</div>
                    </div>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500/50" />
                </div>
              ))}
              {participants?.students.length === 0 && (
                <div className="text-center py-8 text-slate-600 italic text-sm">No students enrolled yet.</div>
              )}
            </div>
          </div>
          
          <div className="glass p-8 rounded-3xl bg-indigo-500/5 border border-indigo-500/10">
            <h3 className="text-sm font-bold text-indigo-300 mb-2">Faculty</h3>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 text-xs font-bold">
                {participants?.faculty.username[0].toUpperCase()}
              </div>
              <div className="text-sm text-slate-300">{participants?.faculty.username}</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
