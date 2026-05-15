"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Book, User, Bot, ChevronLeft, Link as LinkIcon, AlertCircle, Plus, Hash, Download, FileText } from "lucide-react";
import axios from "axios";

const API_BASE = "http://localhost:8000";

export default function ChatPage() {
  const [messages, setMessages] = useState([
    { role: "bot", content: "Hello! I'm your EDUXA tutor. Please select or join a classroom to start learning.", citations: [] }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [classrooms, setClassrooms] = useState<any[]>([]);
  const [selectedClassroom, setSelectedClassroom] = useState<any>(null);
  const [joinCode, setJoinCode] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [activeTab, setActiveTab] = useState("CHAT"); // CHAT, MATERIALS, PEOPLE
  const [materials, setMaterials] = useState<any[]>([]);
  const [participants, setParticipants] = useState<any>({ faculty: null, students: [] });
  const [user, setUser] = useState<any>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      const userData = JSON.parse(storedUser);
      setUser(userData);
      fetchClassrooms(userData.id);
    } else {
      window.location.href = "/";
    }
  }, []);

  const fetchClassrooms = async (userId: string) => {
    try {
      const res = await axios.get(`${API_BASE}/users/${userId}/classrooms`);
      setClassrooms(res.data);
      // We no longer auto-select the first one to comply with the "no chat interface until enters" rule
    } catch (err) {
      console.error("Failed to fetch classrooms");
    }
  };

  const fetchClassroomDetails = async (classId: string) => {
    try {
      const [matRes, partRes] = await Promise.all([
        axios.get(`${API_BASE}/classrooms/${classId}/materials`),
        axios.get(`${API_BASE}/classrooms/${classId}/participants`)
      ]);
      setMaterials(matRes.data);
      setParticipants(partRes.data);
    } catch (err) {
      console.error("Failed to fetch details");
    }
  };

  const handleJoinClassroom = async () => {
    if (!joinCode.trim() || isJoining) return;
    setIsJoining(true);
    try {
      await axios.post(`${API_BASE}/classrooms/join?student_id=${user.id}&code=${joinCode}`);
      setJoinCode("");
      fetchClassrooms(user.id);
      alert("Joined successfully!");
    } catch (err) {
      alert("Invalid join code");
    } finally {
      setIsJoining(false);
    }
  };

  const handleExitClassroom = async () => {
    if (!selectedClassroom || !confirm(`Are you sure you want to exit ${selectedClassroom.name}?`)) return;
    try {
      await axios.post(`${API_BASE}/classrooms/${selectedClassroom.id}/exit?student_id=${user.id}`);
      setSelectedClassroom(null);
      fetchClassrooms(user.id);
      alert("Exited successfully");
    } catch (err) {
      alert("Failed to exit classroom");
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userQuery = input;
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userQuery, citations: [] }]);
    setIsLoading(true);

    try {
      const res = await axios.post(`${API_BASE}/chat`, {
        student_id: user.id,
        classroom_id: selectedClassroom.id,
        query: userQuery
      });

      const data = res.data;
      setMessages(prev => [...prev, { 
        role: "bot", 
        content: data.answer, 
        citations: data.citations,
        is_out_of_scope: data.is_out_of_scope 
      }]);
    } catch (err) {
      setMessages(prev => [...prev, { 
        role: "bot", 
        content: "I'm having trouble connecting to the knowledge base right now. Please try again later.", 
        citations: [] 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#050510] text-slate-200">
      {/* Sidebar */}
      <aside className="w-80 border-r border-slate-800/50 bg-[#0a0a1a] p-6 hidden md:flex flex-col">
        <div className="flex items-center gap-3 mb-10">
          <div className="p-2 bg-indigo-500/20 rounded-lg">
            <Book className="w-6 h-6 text-indigo-400" />
          </div>
          <h2 className="text-xl font-bold gradient-text">EDUXA</h2>
        </div>

        <nav className="space-y-2 flex-1 overflow-y-auto">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 ml-2">My Classrooms</div>
          
          {classrooms.map((cls) => (
            <button
              key={cls.id}
              onClick={() => {
                setSelectedClassroom(cls);
                fetchClassroomDetails(cls.id);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                selectedClassroom?.id === cls.id 
                  ? "bg-indigo-500/10 border border-indigo-500/20 text-indigo-300" 
                  : "hover:bg-slate-800/50 text-slate-400"
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${selectedClassroom?.id === cls.id ? "bg-indigo-500" : "bg-slate-700"}`} />
              {cls.name}
            </button>
          ))}

          <div className="mt-8 pt-6 border-t border-slate-800/50">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 ml-2">Join New</div>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="6-digit code"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
              />
              <button 
                onClick={handleJoinClassroom}
                disabled={isJoining}
                className="p-2 bg-indigo-600 rounded-lg hover:bg-indigo-500 transition-colors disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </nav>

        <div className="mt-auto pt-6 border-t border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
              <User className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-medium">{user?.username || "Loading..."}</div>
              <div className="text-xs text-slate-500 capitalize">{user?.role}</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Area */}
      <main className="flex-1 flex flex-col relative">
        {!selectedClassroom ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="max-w-md space-y-6"
            >
              <div className="w-20 h-20 bg-indigo-500/10 rounded-3xl flex items-center justify-center mx-auto border border-indigo-500/20">
                <Book className="w-10 h-10 text-indigo-400" />
              </div>
              <h1 className="text-3xl font-bold">Welcome to <span className="gradient-text">EDUXA</span></h1>
              <p className="text-slate-400 leading-relaxed">
                Select a classroom from the sidebar to start your Socratic learning journey, or join a new one using a code.
              </p>
              <div className="pt-8 flex flex-col gap-3">
                <div className="flex items-center gap-2 text-xs text-slate-500 justify-center">
                  <Hash className="w-4 h-4" />
                  Join using 6-digit classroom codes
                </div>
              </div>
            </motion.div>
          </div>
        ) : (
          <>
            <header className="h-16 border-b border-slate-800/50 flex items-center justify-between px-6 bg-[#0a0a1a]/50 backdrop-blur-md sticky top-0 z-10">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setSelectedClassroom(null)}
                  className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 flex items-center gap-2"
                >
                  <ChevronLeft className="w-5 h-5" />
                  <span className="text-sm font-medium hidden md:inline">Back</span>
                </button>
                <h1 className="font-semibold truncate max-w-[200px]">{selectedClassroom.name}</h1>
              </div>

              <div className="flex bg-slate-900/50 p-1 rounded-xl">
                {["CHAT", "MATERIALS", "PEOPLE"].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-all ${
                      activeTab === tab ? "bg-indigo-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    {tab.charAt(0) + tab.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </header>

        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-6 scroll-smooth"
        >
          {activeTab === "CHAT" && (
            <div className="space-y-8">
              <AnimatePresence initial={false}>
                {messages.map((msg, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex gap-4 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      msg.role === "user" ? "bg-indigo-600" : "bg-slate-800 border border-slate-700"
                    }`}>
                      {msg.role === "user" ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5 text-indigo-400" />}
                    </div>
                    
                    <div className={`max-w-[80%] space-y-3 ${msg.role === "user" ? "items-end" : ""}`}>
                      <div className={`p-4 rounded-2xl ${
                        msg.role === "user" 
                          ? "bg-indigo-600 text-white rounded-tr-none" 
                          : "glass-card rounded-tl-none"
                      }`}>
                        <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                        
                        {msg.role === "bot" && (msg as any).is_out_of_scope && (
                          <div className="mt-3 flex items-center gap-2 text-amber-400 text-xs bg-amber-400/10 p-2 rounded-lg border border-amber-400/20">
                            <AlertCircle className="w-3 h-3" />
                            Note: This is outside the course material.
                          </div>
                        )}
                      </div>

                      {msg.citations && msg.citations.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {msg.citations.map((cite: any, cidx: number) => (
                            <div key={cidx} className="text-[10px] flex items-center gap-1 px-2 py-1 bg-slate-800/50 rounded-full border border-slate-700 text-slate-400">
                              <LinkIcon className="w-3 h-3" />
                              {cite.file} (p. {cite.page})
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {isLoading && (
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center">
                    <Bot className="w-5 h-5 text-indigo-400 animate-pulse" />
                  </div>
                  <div className="p-4 rounded-2xl glass-card rounded-tl-none w-16 flex justify-center">
                    <div className="flex gap-1">
                      <div className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                      <div className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                      <div className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "MATERIALS" && (
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Course Materials</h2>
                <div className="text-xs text-slate-500 uppercase tracking-widest">{materials.length} Items</div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {materials.map((mat) => (
                  <div key={mat.id} className="glass-card p-6 rounded-2xl flex items-center gap-4 hover:border-indigo-500/30 group">
                    <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center group-hover:bg-indigo-500/20 transition-all">
                      <FileText className="w-6 h-6 text-indigo-400" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-slate-200">{mat.name}</h4>
                      <p className="text-xs text-slate-500 uppercase mt-1">{mat.type}</p>
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
            </div>
          )}

          {activeTab === "PEOPLE" && (
            <div className="max-w-4xl mx-auto space-y-12">
              <section>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-6 ml-2">Faculty</h3>
                <div className="glass-card p-4 rounded-2xl flex items-center gap-4 border-l-4 border-l-indigo-500">
                  <div className="w-12 h-12 rounded-full bg-indigo-500/20 flex items-center justify-center">
                    <User className="w-6 h-6 text-indigo-400" />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg text-white">{participants.faculty?.username}</h4>
                    <p className="text-xs text-indigo-400 font-medium">Instructor</p>
                  </div>
                </div>
              </section>

              <section>
                <div className="flex items-center justify-between mb-6 px-2">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Students</h3>
                  <div className="text-xs text-slate-600 uppercase tracking-widest">{participants.students.length} Enrolled</div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {participants.students.map((student: any) => (
                    <div key={student.id} className="glass-card p-4 rounded-xl flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center">
                        <User className="w-4 h-4 text-slate-500" />
                      </div>
                      <span className="text-sm font-medium">{student.username}</span>
                    </div>
                  ))}
                </div>
              </section>

              <div className="pt-12 flex justify-center">
                <button 
                  onClick={handleExitClassroom}
                  className="px-6 py-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-2xl text-sm font-bold transition-all flex items-center gap-2"
                >
                  <AlertCircle className="w-4 h-4" />
                  Exit Classroom
                </button>
              </div>
            </div>
          )}
        </div>

        {activeTab === "CHAT" && (
          <div className="p-6">
            <div className="max-w-4xl mx-auto relative">
              <textarea
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSend())}
                placeholder="Ask a question about the course material..."
                className="w-full bg-[#0a0a1a] border border-slate-700 rounded-2xl py-4 pl-6 pr-14 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none transition-all shadow-2xl"
              />
              <button 
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl gradient-bg disabled:opacity-50 disabled:grayscale transition-all"
              >
                <Send className="w-5 h-5 text-white" />
              </button>
            </div>
            <p className="text-[10px] text-center text-slate-600 mt-4 uppercase tracking-[0.2em]">
              EDUXA RAG-Powered Socratic Tutor • Zero External Hallucinations
            </p>
          </div>
        )}
        </>
        )}
      </main>
    </div>
  );
}
