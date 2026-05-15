"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { BarChart3, Users, BookMarked, AlertTriangle, TrendingUp, Search, MoreVertical, Plus, Hash, Copy, ArrowRight, Trash2 } from "lucide-react";
import axios from "axios";
import Link from "next/link";

const API_BASE = "http://localhost:8000";

export default function FacultyDashboard() {
  const [classrooms, setClassrooms] = useState<any[]>([]);
  const [newClassName, setNewClassName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      const userData = JSON.parse(storedUser);
      setUser(userData);
      fetchData(userData.id);
    } else {
      window.location.href = "/";
    }
  }, []);

  const fetchData = async (userId: string) => {
    setIsLoading(true);
    try {
      const resRooms = await axios.get(`${API_BASE}/users/${userId}/classrooms`);
      setClassrooms(resRooms.data);
    } catch (err) {
      console.error("Fetch failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateClass = async () => {
    if (!newClassName.trim()) return;
    try {
      const res = await axios.post(`${API_BASE}/classrooms`, {
        name: newClassName,
        faculty_id: user.id
      });
      setNewClassName("");
      // Refresh
      const resRooms = await axios.get(`${API_BASE}/users/${user.id}/classrooms`);
      // Wait, I need an endpoint that shows join codes. 
      // I'll update the backend to include join codes in the list for creators.
      alert(`Classroom created! Join Code: ${res.data.join_code}`);
      window.location.reload(); 
    } catch (err) {
      alert("Failed to create classroom");
    }
  };

  const handleDeleteClassroom = async (classId: string, className: string) => {
    if (!confirm(`Are you sure you want to delete ${className}? This will also delete all uploaded materials and analytics.`)) return;
    try {
      await axios.delete(`${API_BASE}/classrooms/${classId}`);
      fetchData(user.id);
      alert("Classroom deleted successfully");
    } catch (err) {
      alert("Failed to delete classroom");
    }
  };

  return (
    <div className="min-h-screen bg-[#050510] text-slate-200 p-8">
      <header className="max-w-7xl mx-auto flex items-center justify-between mb-12">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Faculty Dashboard</h1>
          <p className="text-slate-500">Monitoring Student Confusion & Engagement</p>
        </div>
        <div className="flex gap-4">
          <div className="glass px-4 py-2 rounded-xl flex items-center gap-3">
            <Users className="w-5 h-5 text-indigo-400" />
            <span className="text-sm font-medium">{classrooms.length} Classrooms</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto space-y-8">
        {/* Management Area */}
        <div className="glass p-8 rounded-3xl mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Plus className="w-6 h-6 text-indigo-400" />
              Manage Classrooms
            </h2>
          </div>
          <div className="flex gap-4 mb-8">
            <input 
              type="text" 
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              placeholder="Enter Classroom Name (e.g. Advanced AI)"
              className="flex-1 bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
            />
            <button 
              onClick={handleCreateClass}
              className="gradient-bg px-8 py-3 rounded-xl font-semibold shadow-lg hover:opacity-90 transition-all"
            >
              Create New Room
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {classrooms.map((room: any) => (
              <div key={room.id} className="glass-card p-6 rounded-2xl flex flex-col gap-4 border border-slate-800 hover:border-indigo-500/30 transition-all group">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-slate-200 text-lg group-hover:text-indigo-300 transition-colors">{room.name}</h4>
                    <p className="text-xs text-slate-500">ID: {room.id.substring(0, 8)}</p>
                  </div>
                  <div className="px-2 py-1 bg-indigo-500/20 rounded border border-indigo-500/30 text-indigo-400 font-mono text-xs">
                    {room.join_code || "CODE"}
                  </div>
                </div>
                
                <div className="flex items-center gap-2 mt-2">
                  <Link 
                    href={`/dashboard/${room.id}`}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-slate-800/50 hover:bg-indigo-500/20 rounded-xl text-sm font-medium text-slate-300 hover:text-indigo-300 transition-all border border-slate-700 hover:border-indigo-500/30"
                  >
                    Enter Classroom <ArrowRight className="w-4 h-4" />
                  </Link>
                   <button 
                    onClick={() => {
                      navigator.clipboard.writeText(room.join_code);
                      alert("Join code copied!");
                    }}
                    className="p-2.5 bg-slate-800/50 hover:bg-slate-700 rounded-xl text-slate-400 border border-slate-700 transition-all"
                    title="Copy Join Code"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleDeleteClassroom(room.id, room.name)}
                    className="p-2.5 bg-slate-800/50 hover:bg-rose-500/10 rounded-xl text-slate-500 hover:text-rose-400 border border-slate-700 hover:border-rose-500/20 transition-all"
                    title="Delete Classroom"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            {classrooms.length === 0 && !isLoading && (
              <div className="col-span-full py-12 text-center glass rounded-2xl border border-dashed border-slate-700">
                <p className="text-slate-500 italic">No classrooms created yet. Create one to get started!</p>
              </div>
            )}
          </div>
        </div>
        
        {/* Placeholder for Analytics Overview (Optional) */}
        <div className="glass p-12 rounded-3xl text-center border border-dashed border-slate-800">
          <BarChart3 className="w-12 h-12 text-slate-700 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-400">Classroom Analytics</h3>
          <p className="text-slate-500 mt-2">Select a classroom above to view detailed student engagement and confusion heatmap.</p>
        </div>
      </main>
    </div>
  );
}
