import React, { useState, useEffect } from "react";
import { 
  Zap, 
  Plus, 
  Mail, 
  Clock, 
  GitBranch, 
  MoreVertical,
  Play,
  Pause,
  Trash2,
  ChevronRight,
  ArrowDown
} from "lucide-react";
import { cn } from "@/lib/utils";

// Mock data logic for now
const defaultSteps = [
  { id: 1, type: 'trigger', label: 'Subscriber Joins List', icon: Zap, color: 'text-amber-500' },
  { id: 2, type: 'action', label: 'Send Welcome Email', icon: Mail, color: 'text-indigo-500' },
  { id: 3, type: 'delay', label: 'Wait 2 Days', icon: Clock, color: 'text-slate-400' },
  { id: 4, type: 'condition', label: 'If Opened Email', icon: GitBranch, color: 'text-emerald-500' },
];

export default function Automations() {
  const [automations, setAutomations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);

  useEffect(() => {
    fetchAutomations();
  }, []);

  const fetchAutomations = async () => {
    try {
      const response = await fetch('/api/automations');
      const data = await response.json();
      setAutomations(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching automations:", error);
      setAutomations([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">
            Automations <span className="text-indigo-500">Builder</span>
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">Design high-converting customer journeys with visual workflows.</p>
        </div>
        <button 
          onClick={() => setIsBuilderOpen(true)}
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold text-sm shadow-xl shadow-indigo-500/20 transition-all hover:scale-105 active:scale-95"
        >
          <Plus className="h-5 w-5" />
          New Automation
        </button>
      </div>

      {!isBuilderOpen ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            Array(3).fill(0).map((_, i) => (
              <div key={i} className="h-48 rounded-3xl bg-card border border-border/50 animate-pulse" />
            ))
          ) : automations.length === 0 ? (
            <div className="col-span-full py-20 flex flex-col items-center justify-center text-center bg-card/50 rounded-3xl border border-dashed border-border/60">
              <div className="h-16 w-16 bg-muted rounded-2xl flex items-center justify-center mb-4">
                <Zap className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-bold">No active flows yet</h3>
              <p className="text-muted-foreground text-sm max-w-xs mt-2 font-medium">Create your first automated sequence to start scaling your engagement.</p>
            </div>
          ) : (
            automations.map((auto) => (
              <div key={auto.id} className="group p-6 rounded-3xl bg-card border border-border/50 hover:border-indigo-500/50 hover:shadow-2xl hover:shadow-indigo-500/10 transition-all cursor-pointer relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4">
                  <MoreVertical className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
                </div>
                <div className="flex items-center gap-4 mb-6">
                  <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
                    <Zap className="h-6 w-6 text-indigo-500" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg group-hover:text-indigo-500 transition-colors">{auto.name}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={cn(
                        "text-[10px] font-black uppercase px-2 py-0.5 rounded-md",
                        auto.status === 'active' ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground"
                      )}>{auto.status}</span>
                      <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">• {auto.steps?.length || 0} Steps</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                  <Play className="h-3 w-3" />
                  <span>3.2k Runs</span>
                  <div className="h-1 w-1 rounded-full bg-border mx-1" />
                  <Mail className="h-3 w-3" />
                  <span>85% Conv.</span>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* Visual Builder UI Mockup */
        <div className="relative p-10 bg-card rounded-[40px] border border-border/60 min-h-[600px] shadow-2xl overflow-hidden">
          <div className="absolute top-6 left-6 flex items-center gap-4">
            <button 
              onClick={() => setIsBuilderOpen(false)}
              className="p-2.5 rounded-2xl hover:bg-muted transition-colors border border-border/40"
            >
              <Trash2 className="h-5 w-5 text-muted-foreground" />
            </button>
            <h2 className="text-xl font-bold">Draft: New Customer Onboarding</h2>
          </div>

          <div className="absolute top-6 right-6 flex items-center gap-3">
             <button className="px-5 py-2.5 rounded-2xl bg-muted font-bold text-xs hover:bg-muted/80 transition-colors">Save Draft</button>
             <button className="px-5 py-2.5 rounded-2xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-500 shadow-lg shadow-indigo-500/20 transition-all">Go Live</button>
          </div>

          {/* Builder Canvas */}
          <div className="mt-16 flex flex-col items-center gap-4">
            {defaultSteps.map((step, index) => (
              <React.Fragment key={step.id}>
                <div className="group relative w-64 p-5 rounded-3xl bg-background border border-border/50 shadow-lg hover:border-indigo-500/50 hover:scale-105 transition-all cursor-grab active:cursor-grabbing">
                  <div className="flex items-center gap-4">
                    <div className={cn("h-10 w-10 rounded-xl bg-muted flex items-center justify-center", step.color)}>
                      <step.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase text-muted-foreground opacity-50 mb-0.5">{step.type}</p>
                      <h4 className="text-sm font-bold">{step.label}</h4>
                    </div>
                  </div>
                  <div className="absolute -right-12 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="h-8 w-8 rounded-lg bg-card border border-border flex items-center justify-center hover:bg-muted transition-colors">
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {index < defaultSteps.length - 1 && (
                  <div className="flex flex-col items-center gap-2 py-2">
                    <div className="h-1 pt-4 w-0.5 bg-indigo-500/50" />
                    <ArrowDown className="h-4 w-4 text-indigo-500/50" />
                  </div>
                )}
              </React.Fragment>
            ))}
            
            <button className="mt-4 h-12 w-12 rounded-full border border-dashed border-border/60 flex items-center justify-center hover:bg-muted hover:border-indigo-500/50 transition-all group">
              <Plus className="h-6 w-6 text-muted-foreground group-hover:text-indigo-500" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
