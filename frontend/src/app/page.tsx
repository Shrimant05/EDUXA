"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { LogIn, UserPlus, BookOpen, ShieldCheck, Database } from "lucide-react";
import axios from "axios";

const API_BASE = "http://localhost:8000";

export default function Home() {
  const [role, setRole] = useState("STUDENT");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mongoUri, setMongoUri] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState("");

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    try {
      if (isRegistering) {
        await axios.post(`${API_BASE}/register`, {
          username: email.split("@")[0],
          email,
          password,
          role
        });
        setIsRegistering(false);
        alert("Account created! Please sign in.");
      } else {
        const formData = new FormData();
        formData.append("username", email);
        formData.append("password", password);
        
        const res = await axios.post(`${API_BASE}/token`, formData);
        localStorage.setItem("token", res.data.access_token);
        localStorage.setItem("user", JSON.stringify(res.data.user));
        
        window.location.href = role === "STUDENT" ? "/chat" : "/dashboard";
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || "Authentication failed");
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900 via-slate-900 to-black">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-12">
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            className="inline-flex items-center justify-center p-3 mb-4 rounded-2xl bg-indigo-500/20 border border-indigo-500/30"
          >
            <BookOpen className="w-10 h-10 text-indigo-400" />
          </motion.div>
          <h1 className="text-5xl font-bold tracking-tight mb-2">
            <span className="gradient-text">EDUXA</span>
          </h1>
          <p className="text-slate-400 text-lg">Your Socratic AI Teaching Assistant</p>
        </div>

        <div className="glass p-8 rounded-3xl shadow-2xl">
          <div className="flex bg-slate-800/50 p-1 rounded-xl mb-8">
            {["STUDENT", "FACULTY", "HOD"].map((r) => (
              <button
                key={r}
                onClick={() => setRole(r)}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                  role === r ? "bg-indigo-600 text-white shadow-lg" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          <form className="space-y-6" onSubmit={handleAuth}>
            {error && <div className="text-rose-400 text-xs bg-rose-400/10 p-3 rounded-lg border border-rose-400/20">{error}</div>}
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2 ml-1">Email Address</label>
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@university.edu"
                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2 ml-1">Password</label>
              <input 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
              />
            </div>

            <button type="submit" className="w-full gradient-bg hover:opacity-90 text-white font-semibold py-4 rounded-xl shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 group">
              <LogIn className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              {isRegistering ? "Create Account" : "Sign In to EDUXA"}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-800 text-center">
            <button 
              onClick={() => setIsRegistering(!isRegistering)}
              className="text-indigo-400 hover:text-indigo-300 text-sm font-medium flex items-center justify-center gap-2 mx-auto"
            >
              <UserPlus className="w-4 h-4" />
              {isRegistering ? "Already have an account? Sign In" : "New here? Create an account"}
            </button>
          </div>
        </div>


        <div className="mt-12 flex items-center justify-center gap-8 text-slate-500">
          <div className="flex items-center gap-2 text-xs">
            <ShieldCheck className="w-4 h-4" />
            Isolated Spaces
          </div>
          <div className="flex items-center gap-2 text-xs">
            <BookOpen className="w-4 h-4" />
            RAG Powered
          </div>
        </div>
      </motion.div>
    </main>
  );
}
