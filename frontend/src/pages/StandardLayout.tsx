import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  Sparkles, Check, Send, Copy, RefreshCw, Wand2, Type, Mail, 
  ChevronRight, Download, Users, Link, Paperclip, 
  Image as ImageIcon, Upload, Trash2, Calendar, Clock, 
  Plus, FileText, AlertCircle, CheckCircle2, Layout, 
  Smartphone, Monitor, Globe, Building2, Briefcase, Factory
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { toUTC } from "@/lib/timeUtils";

interface Template {
  id: string;
  name: string;
  company: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  accent: string;
  preview: string;
}

const TEMPLATES: Template[] = [
  {
    id: "lumina",
    name: "MP Lumina",
    company: "Lumina Creative",
    description: "Modern, vibrant layout with indigo accents and a minimalist creative signature.",
    icon: <Sparkles className="h-5 w-5" />,
    color: "bg-indigo-500",
    accent: "text-indigo-600",
    preview: "Modern | Indigo | Creative"
  },
  {
    id: "consultant",
    name: "MP Consultant",
    company: "Sterling Group",
    description: "Professional, executive-grade layout with slate tones and a corporate serif signature.",
    icon: <Briefcase className="h-5 w-5" />,
    color: "bg-slate-800",
    accent: "text-slate-900",
    preview: "Professional | Slate | Executive"
  },
  {
    id: "factory",
    name: "A Making Company",
    company: "Industrial Scale",
    description: "Bold, industrial layout with orange accents and a strong, high-contrast signature.",
    icon: <Factory className="h-5 w-5" />,
    color: "bg-orange-500",
    accent: "text-orange-600",
    preview: "Industrial | Orange | Bold"
  }
];

export default function StandardLayout() {
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [topic, setTopic] = useState("");
  const [seniority, setSeniority] = useState("C-Executive Level");
  const [generating, setGenerating] = useState(false);
  const [generatedHtml, setGeneratedHtml] = useState("");
  const [generatedSubject, setGeneratedSubject] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [attachment, setAttachment] = useState("");
  const [showSeniorityMenu, setShowSeniorityMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);
  const [showGenerator, setShowGenerator] = useState(false);

  const seniorityMenuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (seniorityMenuRef.current && !seniorityMenuRef.current.contains(event.target as Node)) {
        setShowSeniorityMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleGenerate = async () => {
    if (!topic || !selectedTemplate) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/generate-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template: selectedTemplate.name,
          description: topic,
          seniority: seniority,
          image: imageUrl,
          attachment: attachment
        })
      });

      if (res.ok) {
        const data = await res.json();
        setGeneratedHtml(data.html);
        setGeneratedSubject(data.subject);
      } else {
        throw new Error("Failed to generate email");
      }
    } catch (error) {
      console.error("Generation failed:", error);
      setGeneratedHtml("<div style='padding: 20px; color: #ef4444;'>Failed to generate email. Please check your AI API configuration.</div>");
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!generatedHtml) return;
    navigator.clipboard.writeText(generatedHtml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUseInCampaign = () => {
    if (!generatedHtml) return;
    localStorage.setItem("ai_draft_subject", generatedSubject);
    localStorage.setItem("ai_draft_body", generatedHtml); // We pass the HTML now
    navigate("/campaigns");
  };

  const handleSendNow = async () => {
    if (!generatedHtml) return;
    setIsSending(true);
    try {
      const res = await fetch("/api/send-campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaign_id: 1,
          subject: generatedSubject,
          body: generatedHtml,
          recipients: ["test@example.com"], // Fallback for quick send
          scheduled_at: null
        })
      });
      if (res.ok) {
        setSendSuccess("Email sent successfully!");
        setTimeout(() => setSendSuccess(null), 3000);
      }
    } catch (err) {
      alert("Failed to send");
    } finally {
      setIsSending(false);
    }
  };

  if (!showGenerator) {
    return (
      <div className="flex flex-col gap-8 pb-10 animate-in fade-in duration-500">
        <PageHeader 
          title="Standard Layout Templates" 
          subtitle="Select a pre-branded company layout to generate professional AI emails instantly."
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {TEMPLATES.map((tpl) => (
            <Card 
              key={tpl.id} 
              className="group border-border hover:border-indigo-500 transition-all duration-300 hover:shadow-2xl hover:shadow-indigo-500/10 hover:-translate-y-1 overflow-hidden flex flex-col"
            >
              <div className={cn("h-40 flex flex-col items-center justify-center relative overflow-hidden", tpl.color)}>
                <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white mb-3 shadow-inner">
                  {tpl.icon}
                </div>
                <Badge variant="secondary" className="bg-white/90 text-foreground border-none font-bold text-[10px] uppercase tracking-widest px-3">
                  {tpl.preview}
                </Badge>
              </div>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                   <CardTitle className="text-xl font-bold">{tpl.name}</CardTitle>
                   <Building2 className={cn("h-4 w-4 opacity-40", tpl.accent)} />
                </div>
                <CardDescription className="text-xs font-medium leading-relaxed mt-2 min-h-[40px]">
                  {tpl.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 mt-auto flex flex-col gap-3">
                <Button 
                   variant="outline" 
                   style={{ borderRadius: "14px" }}
                   className="w-full h-11 text-sm font-bold border-border hover:bg-muted"
                   onClick={() => {
                        setSelectedTemplate(tpl);
                        setTopic("");
                        setGeneratedHtml("");
                        setShowGenerator(true);
                   }}
                >
                  Use Template
                </Button>
                <Button 
                   style={{ borderRadius: "14px" }}
                   className="w-full h-11 text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-lg shadow-indigo-500/20"
                   onClick={() => {
                        setSelectedTemplate(tpl);
                        setTopic("");
                        setGeneratedHtml("");
                        setShowGenerator(true);
                   }}
                >
                  <Sparkles className="h-4 w-4" />
                  Generate with AI
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 pb-10 animate-in slide-in-from-right duration-500">
      <div className="flex items-center justify-between border-b border-border pb-8">
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            size="icon" 
            style={{ borderRadius: "12px" }}
            onClick={() => setShowGenerator(false)}
            className="h-10 w-10 border-border bg-card hover:bg-muted"
          >
            <ChevronRight className="h-5 w-5 rotate-180" />
          </Button>
          <div>
             <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
               <Sparkles className="h-6 w-6 text-indigo-600" />
               AI Generator: {selectedTemplate?.name}
             </h1>
             <p className="text-muted-foreground text-sm font-medium mt-1">Branded AI email creation for {selectedTemplate?.company}</p>
          </div>
        </div>
        <ThemeToggle />
      </div>

      <div className="flex min-h-[600px] gap-6">
        {/* Left Panel: Input */}
        <div className="w-[400px] rounded-2xl bg-card border border-border p-8 flex flex-col shadow-sm shrink-0">
           <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
             <Type className="h-5 w-5 text-indigo-500" />
             Email Parameters
           </h2>

           <div className="space-y-6 flex-1">
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70">Topic & Description</label>
                <textarea 
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  style={{ borderRadius: "16px" }}
                  placeholder="e.g. A follow-up email after our product demo, focusing on the new security features..."
                  className="w-full h-40 bg-muted/30 border border-border p-4 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all resize-none text-foreground"
                />
              </div>

              <div className="space-y-3 relative" ref={seniorityMenuRef}>
                 <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70">Target Seniority</label>
                 <div 
                   onClick={() => setShowSeniorityMenu(!showSeniorityMenu)}
                   style={{ borderRadius: "14px" }}
                   className={cn(
                     "w-full bg-muted/30 border border-border px-4 py-3.5 flex items-center gap-3 cursor-pointer transition-all hover:bg-muted/50",
                     showSeniorityMenu && "border-indigo-500 ring-2 ring-indigo-500/10"
                   )}
                 >
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-semibold flex-1">{seniority}</span>
                    <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", showSeniorityMenu && "rotate-90")} />
                 </div>
                 
                 {showSeniorityMenu && (
                   <div style={{ borderRadius: "14px" }} className="absolute left-0 right-0 mt-2 bg-card border border-border shadow-2xl z-50 overflow-hidden py-1 border-t-indigo-500">
                     {["C-Executive Level", "VP Level", "Director", "Manager", "Non-Manager"].map((opt) => (
                       <div 
                         key={opt}
                         onClick={() => { setSeniority(opt); setShowSeniorityMenu(false); }}
                         className={cn(
                            "px-4 py-3 text-xs font-bold cursor-pointer transition-colors flex items-center justify-between",
                            seniority === opt ? "bg-indigo-500/10 text-indigo-600" : "text-muted-foreground hover:bg-muted"
                         )}
                       >
                         {opt}
                         {seniority === opt && <Check className="h-4 w-4" />}
                       </div>
                     ))}
                   </div>
                 )}
              </div>

              <div className="space-y-3">
                 <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70">Include Image (URL)</label>
                 <div className="relative">
                   <Input 
                     value={imageUrl}
                     onChange={(e) => setImageUrl(e.target.value)}
                     style={{ borderRadius: "14px" }}
                     placeholder="https://images.unsplash.com/..."
                     className="bg-muted/30 border-border h-12 text-sm pl-10"
                   />
                   <ImageIcon className="h-4 w-4 absolute left-4 top-4 text-muted-foreground" />
                 </div>
              </div>

              <div className="space-y-3">
                 <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70">Include Attachment</label>
                 <div className="relative">
                   <Input 
                     value={attachment}
                     onChange={(e) => setAttachment(e.target.value)}
                     style={{ borderRadius: "14px" }}
                     placeholder="e.g. Q4_Strategy_Guide.pdf"
                     className="bg-muted/30 border-border h-12 text-sm pl-10"
                   />
                   <Paperclip className="h-4 w-4 absolute left-4 top-4 text-muted-foreground" />
                 </div>
              </div>
           </div>

           <Button 
             disabled={generating || !topic}
             onClick={handleGenerate}
             style={{ borderRadius: "16px" }}
             className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white text-base font-bold gap-3 mt-8 shadow-xl shadow-indigo-500/20 active:scale-95 transition-all"
           >
             {generating ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
             {generating ? "Generating Masterpiece..." : "Generate Email"}
           </Button>
        </div>

        {/* Right Panel: Output */}
        <div className="flex-1 flex flex-col gap-6">
           <Card className="flex-1 border-border bg-card shadow-sm overflow-hidden flex flex-col">
              <CardHeader className="border-b border-border bg-muted/10 py-5">
                 <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg font-bold">Generated Output</CardTitle>
                      <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1">Branded HTML Preview</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleCopy}
                        disabled={!generatedHtml}
                        style={{ borderRadius: "10px" }}
                        className="h-9 gap-2 text-xs font-bold border-border"
                      >
                        {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                        {copied ? "Copied" : "Copy HTML"}
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => alert("Schedule modal coming soon!")}
                        disabled={!generatedHtml}
                        style={{ borderRadius: "10px" }}
                        className="h-9 gap-2 text-xs font-bold border-border"
                      >
                        <Calendar className="h-3.5 w-3.5" />
                        Schedule
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleSendNow}
                        disabled={!generatedHtml || isSending}
                        style={{ borderRadius: "10px" }}
                        className="h-9 gap-2 text-xs font-bold border-border"
                      >
                        {isSending ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                        Send Now
                      </Button>
                      <Button 
                        onClick={handleUseInCampaign}
                        disabled={!generatedHtml}
                        style={{ borderRadius: "10px" }}
                        className="h-9 gap-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white border-transparent"
                      >
                        Use in Campaign
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                 </div>
              </CardHeader>
              <CardContent className="p-0 flex-1 overflow-y-auto bg-muted/50 scrollbar-hide">
                 {generatedHtml ? (
                   <div className="p-8 flex justify-center">
                      <div 
                        className="bg-white rounded-xl shadow-2xl overflow-hidden border border-border"
                        style={{ width: '100%', maxWidth: '650px' }}
                        dangerouslySetInnerHTML={{ __html: generatedHtml }} 
                      />
                   </div>
                 ) : (
                   <div className="h-full flex flex-col items-center justify-center text-center p-12 space-y-4">
                      <div className="w-20 h-20 rounded-3xl bg-muted border border-dashed border-border flex items-center justify-center">
                        <Wand2 className="h-10 w-10 text-muted-foreground/30" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-foreground">Waiting for your creativity</h3>
                        <p className="text-muted-foreground text-sm font-medium mt-1 max-w-[300px]">Describe your email on the left and choose a seniority level to generate content.</p>
                      </div>
                   </div>
                 )}
              </CardContent>
           </Card>
           
           {sendSuccess && (
             <div className="animate-in fade-in slide-in-from-bottom-4 fixed bottom-8 right-8 z-[100]">
                <div className="bg-emerald-500 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 font-bold">
                  <CheckCircle2 className="h-6 w-6" />
                  {sendSuccess}
                </div>
             </div>
           )}
        </div>
      </div>
    </div>
  );
}
