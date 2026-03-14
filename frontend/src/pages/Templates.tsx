import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Type,
  ImageIcon,
  MousePointerClick,
  Minus,
  Save,
  Eye,
  Send,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  Underline,
  Trash,
  Paperclip,
  Upload,
  Link,
  Sparkles,
  Plus,
  Library,
  ChevronRight,
  Smartphone,
  Monitor,
  Edit2,
  X,
  History,
  Check,
  RefreshCw,
  EyeOff
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";

type BlockType = 'text' | 'image' | 'button' | 'divider' | 'columns' | 'social' | 'attachment' | 'imageContent';

interface Block {
  id: string;
  type: BlockType;
  content: string;
  styles: Record<string, any>;
}

interface SavedTemplate {
  id: number;
  name: string;
  content: string;
  updated_at: string;
}

export default function Templates() {
  const [blocks, setBlocks] = useState<Block[]>([
    {
      id: "header",
      type: "image",
      content: "Header Image",
      styles: {
        height: "160px",
        backgroundColor: "hsl(var(--muted)/0.8)",
        color: "hsl(var(--foreground))",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "14px",
        border: "2px dashed hsl(var(--border))",
        fontWeight: "700",
        fontSize: "12px",
        textTransform: "uppercase",
        letterSpacing: "0.1em",
        width: "100%",
        boxSizing: "border-box"
      }
    },
    {
      id: "headline",
      type: "text",
      content: "Welcome to our service!",
      styles: { fontSize: "30px", fontWeight: "800", color: "hsl(var(--foreground))", textAlign: "left", padding: "16px", margin: "0", width: "100%", boxSizing: "border-box" }
    },
    {
      id: "paragraph",
      type: "text",
      content: "Hi there, \n\nWe are excited to have you on board. This is a sample email template that you can customize using the builder on the left.",
      styles: { fontSize: "16px", color: "hsl(var(--foreground))", lineHeight: "1.6", textAlign: "left", padding: "16px", margin: "0 auto", width: "100%", boxSizing: "border-box" }
    },
    {
      id: "cta",
      type: "button",
      content: "Get Started",
      styles: { backgroundColor: "#4f46e5", color: "#ffffff", padding: "12px 24px", borderRadius: "12px", fontSize: "16px", fontWeight: "600", textAlign: "center", display: "inline-block", margin: "16px auto" }
    },
    {
      id: "footer",
      type: "text",
      content: "© 2023 Company Name. All rights reserved.",
      styles: { fontSize: "14px", color: "hsl(var(--muted-foreground))", textAlign: "center", borderTop: "1px solid hsl(var(--border))", paddingTop: "24px", marginTop: "24px", paddingBottom: "16px", width: "100%" }
    }
  ]);

  const [templateId, setTemplateId] = useState<number | null>(null);
  const [templateName, setTemplateName] = useState("Untitled Template");
  const [isRenaming, setIsRenaming] = useState(false);
  const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>([]);
  const [showLibrary, setShowLibrary] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [isAIGenerating, setIsAIGenerating] = useState(false);
  const [aiTopic, setAiTopic] = useState("");
  const [aiTone, setAiTone] = useState("C-Executive Level");
  const [showAIModal, setShowAIModal] = useState(false);

  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const selectedBlock = blocks.find(b => b.id === selectedBlockId);

  const [saving, setSaving] = useState(false);
  const [activeInsertType, setActiveInsertType] = useState<BlockType | null>(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/templates');
      if (res.ok) setSavedTemplates(await res.json());
    } catch (e) {
      console.error("Failed to fetch templates:", e);
    }
  };

  const handleAIGenerate = async () => {
    if (!aiTopic) return;
    setIsAIGenerating(true);
    try {
      const res = await fetch("/api/templates/generate-blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: aiTopic, tone: aiTone })
      });
      if (res.ok) {
        const aiBlocks = await res.json();
        setBlocks(aiBlocks);
        setShowAIModal(false);
      }
    } catch (e) {
      console.error("AI Generation failed:", e);
    } finally {
      setIsAIGenerating(false);
    }
  };

  const loadSavedTemplate = (tpl: SavedTemplate) => {
    setTemplateId(tpl.id);
    setTemplateName(tpl.name);
    setBlocks(JSON.parse(tpl.content));
    setShowLibrary(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const url = templateId ? `/api/templates/${templateId}` : '/api/templates';
      const method = templateId ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: templateName,
          content: JSON.stringify(blocks)
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        if (!templateId) setTemplateId(data.id);
        fetchTemplates();
      }
    } catch (err) {
      console.error('Error saving template:', err);
    }
    setSaving(false);
  };

  const addBlock = (type: BlockType, atIndex?: number) => {
    const defaultStyles: Record<string, any> = { padding: "16px", margin: "0 auto", width: "100%", maxWidth: "100%", boxSizing: "border-box" };

    let newStyles = { ...defaultStyles };
    let content = "";

    if (type === 'text') {
      newStyles = { ...defaultStyles, fontSize: "16px", color: "hsl(var(--foreground))" };
      content = "New Text Block";
    } else if (type === 'button') {
      newStyles = { ...defaultStyles, backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))", padding: "12px 24px", borderRadius: "14px", fontSize: "14px", fontWeight: "600", display: "inline-block", textAlign: "center", width: "auto" };
      content = "Click Me";
    } else if (type === 'image') {
      newStyles = { ...defaultStyles, height: "auto", minHeight: "160px", backgroundColor: "hsl(var(--muted)/0.8)", color: "hsl(var(--foreground))", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "14px", border: "2px dashed hsl(var(--border))", fontWeight: "600", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.1em", overflow: 'hidden' };
      content = ""; // URL will go here
    } else if (type === 'attachment') {
      newStyles = { ...defaultStyles, backgroundColor: "hsl(var(--muted)/0.3)", borderRadius: "12px", border: "1px solid hsl(var(--border))", padding: "12px", display: "flex", alignItems: "center", gap: "10px" };
      content = "file_attachment.pdf";
    } else if (type === 'divider') {
      newStyles = { height: "2px", backgroundColor: "hsl(var(--border))", margin: "24px 0", width: "100%" };
    } else if (type === 'imageContent') {
      newStyles = { ...defaultStyles, backgroundColor: "hsl(var(--muted)/0.3)", borderRadius: "16px", border: "1px solid hsl(var(--border))", padding: "16px", display: "flex", alignItems: "center", gap: "16px" };
      content = JSON.stringify({
        title: "New Media Element",
        subtitle: "In-body layout asset",
        image: ""
      });
    }

    const newBlock: Block = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      content,
      styles: newStyles
    };

    if (typeof atIndex === 'number') {
      const newBlocks = [...blocks];
      newBlocks.splice(atIndex, 0, newBlock);
      setBlocks(newBlocks);
      setSelectedBlockId(newBlock.id);
      return;
    }

    // Insert before footer if it exists, otherwise append
    const footerIndex = blocks.findIndex(b => b.id === "footer");
    if (footerIndex !== -1) {
      const newBlocks = [...blocks];
      newBlocks.splice(footerIndex, 0, newBlock);
      setBlocks(newBlocks);
    } else {
      setBlocks([...blocks, newBlock]);
    }
    setSelectedBlockId(newBlock.id);
  };

  const updateBlockStyles = (id: string, newStyles: Record<string, any>) => {
    setBlocks(blocks.map(b => b.id === id ? { ...b, styles: { ...b.styles, ...newStyles } } : b));
  };

  const updateBlockContent = (id: string, content: string) => {
    setBlocks(blocks.map(b => b.id === id ? { ...b, content } : b));
  };

  const removeBlock = (id: string) => {
    setBlocks(blocks.filter(b => b.id !== id));
    if (selectedBlockId === id) setSelectedBlockId(null);
  }


  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Top Bar Overhaul */}
      <div className="flex items-center justify-between mb-8 pb-6 border-b border-border">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2 group">
              {isRenaming ? (
                <Input
                  className="h-8 w-64 text-xl font-bold bg-transparent border-b-2 border-indigo-500 rounded-none px-0"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  onBlur={() => setIsRenaming(false)}
                  onKeyDown={(e) => e.key === 'Enter' && setIsRenaming(false)}
                  autoFocus
                />
              ) : (
                <div className="flex items-center gap-2 cursor-pointer" onClick={() => setIsRenaming(true)}>
                  <h1 className="text-xl font-bold tracking-tight text-foreground">{templateName}</h1>
                  <Edit2 className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground font-medium flex items-center gap-2">
              <History className="h-3 w-3" />
              Last edited {new Date().toLocaleTimeString()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-muted/50 p-1 rounded-xl border border-border mr-4">
            <button
              onClick={() => setIsPreviewMode(false)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
                !isPreviewMode ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Edit2 className="h-3.5 w-3.5" />
              Design
            </button>
            <button
              onClick={() => setIsPreviewMode(true)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
                isPreviewMode ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Eye className="h-3.5 w-3.5" />
              Preview
            </button>
          </div>

          <Button
            variant="outline"
            onClick={() => setShowLibrary(!showLibrary)}
            className={cn("h-10 px-4 rounded-xl gap-2 font-semibold", showLibrary && "bg-indigo-50 border-indigo-200 text-indigo-600")}
          >
            <Library className="h-4 w-4" />
            Library
          </Button>

          <Button
            onClick={() => setShowAIModal(true)}
            variant="outline"
            className="h-10 px-4 rounded-xl gap-2 font-semibold border-indigo-200 text-indigo-600 hover:bg-indigo-50"
          >
            <Sparkles className="h-4 w-4" />
            IA Generate
          </Button>

          <div className="w-px h-6 bg-border mx-2" />

          <Button
            onClick={handleSave}
            disabled={saving}
            className="h-10 px-6 rounded-xl gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-lg shadow-indigo-600/20 border-0"
          >
            {saving ? <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving..." : templateId ? "Save Changes" : "Save Template"}
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 gap-6 overflow-hidden relative">
        {/* Blueprint Library Overlay */}
        {showLibrary && (
          <div className="absolute inset-0 z-50 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200 flex items-center justify-center p-12">
            <Card className="w-full h-full max-w-6xl flex flex-col shadow-2xl border-border rounded-3xl overflow-hidden">
              <div className="p-8 border-b border-border flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">Template Library</h2>
                  <p className="text-sm text-muted-foreground mt-1">Select a blueprint to kickstart your campaign.</p>
                </div>
                <button onClick={() => setShowLibrary(false)} className="h-10 w-10 rounded-full hover:bg-muted flex items-center justify-center transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                {savedTemplates.map((tpl) => (
                  <div
                    key={tpl.id}
                    onClick={() => loadSavedTemplate(tpl)}
                    className="group cursor-pointer flex flex-col gap-4"
                  >
                    <div className="aspect-[3/4] rounded-2xl bg-muted border-2 border-border group-hover:border-indigo-500 transition-all overflow-hidden flex items-center justify-center relative bg-gradient-to-br from-card to-muted shadow-sm group-hover:shadow-xl group-hover:-translate-y-1">
                      <div className="flex flex-col items-center gap-3 opacity-20 group-hover:opacity-100 transition-opacity">
                        <Library className="h-12 w-12 text-indigo-600" />
                        <span className="text-xs font-bold uppercase tracking-widest text-indigo-600">Select Template</span>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-bold text-foreground group-hover:text-indigo-600 transition-colors">{tpl.name}</h4>
                      <p className="text-xs text-muted-foreground">Updated {new Date(tpl.updated_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
                
                {/* New Template Card */}
                <div onClick={() => { setBlocks([]); setTemplateId(null); setTemplateName("New Template"); setShowLibrary(false); }} className="group cursor-pointer flex flex-col gap-4">
                  <div className="aspect-[3/4] rounded-2xl border-2 border-dashed border-border hover:border-indigo-400 transition-all flex items-center justify-center bg-muted/20">
                    <div className="flex flex-col items-center gap-3">
                      <Plus className="h-10 w-10 text-muted-foreground group-hover:text-indigo-500 transition-colors" />
                      <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground group-hover:text-indigo-500">New Design</span>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-bold text-foreground">Blank Slate</h4>
                    <p className="text-xs text-muted-foreground">Start from absolute scratch</p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* AI Modal Overlay */}
        {showAIModal && (
          <div className="absolute inset-0 z-50 bg-black/40 backdrop-blur-md animate-in fade-in duration-300 flex items-center justify-center p-6">
            <Card className="w-full max-w-lg p-8 rounded-3xl shadow-2xl border-indigo-500/20 bg-card">
              <div className="flex items-center gap-4 mb-8">
                <div className="h-12 w-12 rounded-2xl bg-indigo-600 flex items-center justify-center">
                  <Sparkles className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">AI Layout Generator</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Prompt your vision, we'll build the structure.</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Campaign Topic</label>
                  <textarea
                    className="w-full h-32 bg-muted/50 border border-border rounded-2xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none"
                    placeholder="e.g. A premium welcome email for our new luxury watch collection..."
                    value={aiTopic}
                    onChange={(e) => setAiTopic(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Brand Tone</label>
                  <div className="grid grid-cols-2 gap-3">
                    {["C-Executive Level", "Professional", "Friendly", "Hype / Bold"].map((tone) => (
                      <button
                        key={tone}
                        onClick={() => setAiTone(tone)}
                        className={cn(
                          "px-4 py-3 rounded-xl text-xs font-bold transition-all border",
                          aiTone === tone ? "bg-indigo-600 text-white border-transparent" : "bg-card border-border hover:bg-muted"
                        )}
                      >
                        {tone}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-4">
                  <Button variant="outline" className="flex-1 h-12 rounded-xl font-bold" onClick={() => setShowAIModal(false)}>Cancel</Button>
                  <Button
                    className="flex-[2] h-12 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-lg shadow-indigo-600/20 border-0"
                    disabled={isAIGenerating || !aiTopic}
                    onClick={handleAIGenerate}
                  >
                    {isAIGenerating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {isAIGenerating ? "Generating Magic..." : "Generate Template"}
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Builder Sidebar - Integrated into Main View */}
        {!isPreviewMode && (
          <Card className="w-[320px] shrink-0 flex flex-col border-border bg-card shadow-sm rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-border bg-muted/20 flex items-center justify-between">
              <h3 className="font-bold text-foreground flex items-center gap-2">
                <Library className="h-4 w-4 text-indigo-600" />
                Components
              </h3>
              <Badge variant="outline" className="bg-white/50 text-[10px] font-bold uppercase tracking-tight">V2.0</Badge>
            </div>
            
            <div className="flex-1 overflow-y-auto p-5 pb-20 custom-scrollbar">
              <div className="grid grid-cols-2 gap-4">
                <BlockButton icon={Type} label="Text" active={activeInsertType === 'text'} onClick={() => setActiveInsertType(activeInsertType === 'text' ? null : 'text')} />
                <BlockButton icon={ImageIcon} label="Image" active={activeInsertType === 'image'} onClick={() => setActiveInsertType(activeInsertType === 'image' ? null : 'image')} />
                <BlockButton icon={Sparkles} label="AI Media" active={activeInsertType === 'imageContent'} onClick={() => setActiveInsertType(activeInsertType === 'imageContent' ? null : 'imageContent')} />
                <BlockButton icon={MousePointerClick} label="Button" active={activeInsertType === 'button'} onClick={() => setActiveInsertType(activeInsertType === 'button' ? null : 'button')} />
                <BlockButton icon={Minus} label="Divider" active={activeInsertType === 'divider'} onClick={() => setActiveInsertType(activeInsertType === 'divider' ? null : 'divider')} />
                <BlockButton icon={Paperclip} label="Attach" active={activeInsertType === 'attachment'} onClick={() => setActiveInsertType(activeInsertType === 'attachment' ? null : 'attachment')} />
              </div>

              {activeInsertType && (
                <div className="mt-6 p-4 bg-indigo-50 border border-indigo-100 rounded-2xl animate-pulse flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-indigo-500" />
                  <p className="text-[11px] font-bold text-indigo-600 uppercase">Click canvas to insert</p>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Center - Canvas */}
        <div className={cn(
          "flex-1 flex flex-col items-center p-8 overflow-y-auto scrollbar-hide bg-muted/10 rounded-3xl border border-border/50",
          isPreviewMode && "bg-muted/30"
        )}>
          {isPreviewMode && (
            <div className="flex items-center gap-2 mb-8 bg-card border border-border p-1.5 rounded-2xl shadow-xl">
              <button
                onClick={() => setPreviewDevice('desktop')}
                className={cn("p-2 rounded-xl transition-all", previewDevice === 'desktop' ? "bg-indigo-600 text-white" : "hover:bg-muted text-muted-foreground")}
              >
                <Monitor className="h-5 w-5" />
              </button>
              <button
                onClick={() => setPreviewDevice('mobile')}
                className={cn("p-2 rounded-xl transition-all", previewDevice === 'mobile' ? "bg-indigo-600 text-white" : "hover:bg-muted text-muted-foreground")}
              >
                <Smartphone className="h-5 w-5" />
              </button>
            </div>
          )}

          <div
            onClick={(e) => {
              if (activeInsertType && e.target === e.currentTarget) {
                addBlock(activeInsertType);
                setActiveInsertType(null);
              }
            }}
            className={cn(
              "bg-card shadow-2xl rounded-3xl p-12 relative border border-border/50 transition-all duration-500 flex flex-col gap-8 mb-32",
              previewDevice === 'mobile' ? "w-[385px]" : "w-full max-w-[680px]",
              activeInsertType ? "cursor-crosshair ring-4 ring-indigo-500/10" : ""
            )}
            style={{ minHeight: '800px', height: 'fit-content', flexShrink: 0 }}
          >
            {blocks.map((block, index) => (
              <div key={block.id} className="relative group/block w-full">
                {/* Insert Zone Top */}
                <div
                  className={cn(
                    "absolute -top-4 left-0 right-0 h-8 z-10 opacity-0 group-hover/block:opacity-100 transition-opacity flex items-center justify-center pointer-events-none",
                    activeInsertType && "opacity-100"
                  )}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (activeInsertType) {
                        addBlock(activeInsertType, index);
                        setActiveInsertType(null);
                      } else {
                        addBlock("imageContent", index);
                      }
                    }}
                    className="pointer-events-auto bg-indigo-600 text-white rounded-full p-1.5 shadow-xl hover:scale-110 active:scale-90 transition-all border-4 border-card"
                    title={activeInsertType ? `Insert ${activeInsertType} here` : "Insert Media Block Here"}
                  >
                    {activeInsertType ? <Plus className="w-3.5 h-3.5" /> : <MousePointerClick className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <div
                  onClick={() => setSelectedBlockId(block.id)}
                  className={`relative group cursor-pointer border-2 transition-all w-full box-border rounded-xl ${selectedBlockId === block.id
                    ? "border-indigo-500 shadow-xl shadow-indigo-500/10 bg-indigo-500/[0.02]"
                    : "border-transparent hover:border-border/60"
                    }`}
                >
                  {selectedBlockId === block.id && (
                    <div className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-1.5 shadow-lg z-20 hover:bg-red-600 transition-colors" onClick={(e) => { e.stopPropagation(); removeBlock(block.id); }}>
                      <Trash className="w-3.5 h-3.5" />
                    </div>
                  )}

                  <div className="w-full h-full overflow-hidden rounded-lg">
                    {block.type === 'text' && (
                      <div style={{ ...block.styles, wordBreak: "break-word", width: '100%' }} onClick={(e) => e.stopPropagation()}>
                        {selectedBlockId === block.id ? (
                          <textarea
                            value={block.content}
                            onChange={e => updateBlockContent(block.id, e.target.value)}
                            className="w-full bg-transparent outline-none resize-none border-none p-0 scrollbar-hide"
                            style={{
                              minHeight: "60px",
                              color: block.styles.color,
                              fontSize: block.styles.fontSize,
                              textAlign: block.styles.textAlign,
                              fontWeight: block.styles.fontWeight,
                              fontStyle: block.styles.fontStyle,
                              textDecoration: block.styles.textDecoration
                            }}
                          />
                        ) : (
                          <div style={{ whiteSpace: "pre-wrap" }}>{block.content}</div>
                        )}
                      </div>
                    )}

                    {block.type === 'image' && (
                      <div style={{ ...block.styles, textAlign: 'center', width: '100%' }}>
                        {block.content && block.content.startsWith('http') ? (
                          <img src={block.content} alt="Block" style={{ width: '100%', borderRadius: block.styles.borderRadius || 'inherit' }} />
                        ) : (
                          <div className="flex flex-col items-center gap-2 py-8">
                            <ImageIcon className="w-8 h-8 opacity-20" />
                            <span>IMAGE PLACEHOLDER</span>
                          </div>
                        )}
                      </div>
                    )}

                    {block.type === 'imageContent' && (() => {
                      const data = JSON.parse(block.content || '{}');
                      return (
                        <div style={{ ...block.styles }} onClick={(e) => e.stopPropagation()}>
                          <div className="w-16 h-16 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0 border border-indigo-500/20 overflow-hidden group/avatar relative">
                            {data.image ? (
                              <img src={data.image} className="w-full h-full object-cover" />
                            ) : (
                              <Sparkles className="w-8 h-8 text-indigo-500" />
                            )}
                            {selectedBlockId === block.id && (
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity cursor-pointer">
                                <Upload className="w-5 h-5 text-white" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 space-y-1">
                            {selectedBlockId === block.id ? (
                              <>
                                <input
                                  className="w-full bg-transparent font-bold text-foreground text-lg leading-tight outline-none border-b border-indigo-500/20 focus:border-indigo-500"
                                  value={data.title}
                                  onChange={e => updateBlockContent(block.id, JSON.stringify({ ...data, title: e.target.value }))}
                                />
                                <input
                                  className="w-full bg-transparent text-sm text-muted-foreground italic outline-none border-b border-indigo-500/10 focus:border-indigo-500"
                                  value={data.subtitle}
                                  onChange={e => updateBlockContent(block.id, JSON.stringify({ ...data, subtitle: e.target.value }))}
                                />
                              </>
                            ) : (
                              <>
                                <h4 className="font-bold text-foreground text-lg leading-tight">{data.title || "Untitled Element"}</h4>
                                <p className="text-sm text-muted-foreground italic">{data.subtitle || "Media asset description"}</p>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {block.type === 'attachment' && (
                      <div style={{ ...block.styles }}>
                        <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-500">
                          <Paperclip className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-medium">{block.content}</span>
                        <div className="ml-auto text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Attachment</div>
                      </div>
                    )}

                    {block.type === 'button' && (
                      <div style={{
                        display: "flex",
                        justifyContent: block.styles.textAlign === "center" ? "center" : block.styles.textAlign === "right" ? "flex-end" : "flex-start",
                        margin: block.styles.margin,
                        width: "100%"
                      }}>
                        <button style={{ ...block.styles, margin: 0 }}>{block.content}</button>
                      </div>
                    )}

                    {block.type === 'divider' && (
                      <div style={{ ...block.styles, width: '100%' }} />
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Added extra space at the bottom of the card to guarantee containment */}
            <div className="h-20 w-full pointer-events-none" />
          </div>

          {/* External Spacer for outer scroll */}
          <div className="h-40 w-full shrink-0" />
        </div>

        {/* Right Sidebar - Properties */}
        <Card className="w-[300px] flex flex-col overflow-y-auto border-border bg-card">
          <div className="p-4 border-b border-border">
            <h3 className="font-semibold text-foreground">Properties</h3>
          </div>
          {selectedBlock ? (
            <div className="p-6 space-y-8 pb-32">
              <div className="space-y-4">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center justify-between">
                  {selectedBlock.type === 'image' ? 'Source URL' : selectedBlock.type === 'imageContent' ? 'Dynamic Data' : 'Block Content'}
                  <Badge variant="outline" className="text-[9px] px-1 py-0">{selectedBlock.type}</Badge>
                </label>
                
                {selectedBlock.type === 'imageContent' ? (() => {
                  const data = JSON.parse(selectedBlock.content || '{}');
                  return (
                    <div className="space-y-3">
                      <Input placeholder="Title" value={data.title} onChange={e => updateBlockContent(selectedBlock.id, JSON.stringify({ ...data, title: e.target.value }))} className="rounded-xl border-border bg-muted/30" />
                      <Input placeholder="Subtitle" value={data.subtitle} onChange={e => updateBlockContent(selectedBlock.id, JSON.stringify({ ...data, subtitle: e.target.value }))} className="rounded-xl border-border bg-muted/30" />
                      <Input placeholder="Image URL" value={data.image} onChange={e => updateBlockContent(selectedBlock.id, JSON.stringify({ ...data, image: e.target.value }))} className="rounded-xl border-border bg-muted/30" />
                    </div>
                  );
                })() : (
                  <textarea
                    value={selectedBlock.content}
                    placeholder={selectedBlock.type === 'image' ? "https://images.unsplash.com/..." : "Write something..."}
                    onChange={(e) => updateBlockContent(selectedBlock.id, e.target.value)}
                    className="w-full text-sm p-4 border border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 min-h-[120px] bg-muted/30 text-foreground transition-all resize-none font-medium"
                  />
                )}
              </div>

              <div className="space-y-4">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Typography</label>
                <div className="flex items-center gap-1.5 bg-muted/30 p-1.5 rounded-2xl border border-border">
                  <PropertyButton icon={Bold} active={selectedBlock.styles.fontWeight === 'bold'} onClick={() => updateBlockStyles(selectedBlock.id, { fontWeight: selectedBlock.styles.fontWeight === 'bold' ? 'normal' : 'bold' })} />
                  <PropertyButton icon={Italic} active={selectedBlock.styles.fontStyle === 'italic'} onClick={() => updateBlockStyles(selectedBlock.id, { fontStyle: selectedBlock.styles.fontStyle === 'italic' ? 'normal' : 'italic' })} />
                  <PropertyButton icon={Underline} active={selectedBlock.styles.textDecoration === 'underline'} onClick={() => updateBlockStyles(selectedBlock.id, { textDecoration: selectedBlock.styles.textDecoration === 'underline' ? 'none' : 'underline' })} />
                  <div className="w-px h-6 bg-border mx-1" />
                  <PropertyButton icon={AlignLeft} active={selectedBlock.styles.textAlign === 'left'} onClick={() => updateBlockStyles(selectedBlock.id, { textAlign: 'left' })} />
                  <PropertyButton icon={AlignCenter} active={selectedBlock.styles.textAlign === 'center'} onClick={() => updateBlockStyles(selectedBlock.id, { textAlign: 'center' })} />
                  <PropertyButton icon={AlignRight} active={selectedBlock.styles.textAlign === 'right'} onClick={() => updateBlockStyles(selectedBlock.id, { textAlign: 'right' })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground/60 ml-1">Size (px)</span>
                    <Input type="number" value={parseInt(selectedBlock.styles.fontSize) || 16} onChange={e => updateBlockStyles(selectedBlock.id, { fontSize: `${e.target.value}px` })} className="rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground/60 ml-1">Color</span>
                    <Input type="color" className="h-10 p-1 w-full rounded-xl cursor-pointer" value={selectedBlock.styles.color || '#000000'} onChange={e => updateBlockStyles(selectedBlock.id, { color: e.target.value })} />
                  </div>
                </div>
              </div>

              {selectedBlock.type === 'button' && (
                <div className="space-y-4">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Button Style</label>
                  <div className="space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground/60 ml-1">Background</span>
                    <Input type="color" className="h-10 p-1 w-full rounded-xl cursor-pointer" value={selectedBlock.styles.backgroundColor || '#4f46e5'} onChange={e => updateBlockStyles(selectedBlock.id, { backgroundColor: e.target.value })} />
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Layout & Space</label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground/60 ml-1">Padding</span>
                    <Input type="number" value={parseInt(selectedBlock.styles.padding) || 0} onChange={e => updateBlockStyles(selectedBlock.id, { padding: `${e.target.value}px` })} className="rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground/60 ml-1">Radius</span>
                    <Input type="number" value={parseInt(selectedBlock.styles.borderRadius) || 0} onChange={e => updateBlockStyles(selectedBlock.id, { borderRadius: `${e.target.value}px` })} className="rounded-xl" />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-muted fill-muted-foreground/20 flex items-center justify-center border border-border">
                <MousePointerClick className="w-8 h-8 text-muted-foreground/40" />
              </div>
              <p className="text-sm text-muted-foreground max-w-[200px] leading-relaxed">Click on a block in the canvas to edit its properties.</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function BlockButton({ icon: Icon, label, active, onClick }: { icon: any, label: string, active?: boolean, onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-3 p-5 rounded-2xl border transition-all group shadow-sm hover:shadow-md active:scale-95 w-full",
        active
          ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20 ring-2 ring-indigo-500/20"
          : "border-border bg-card hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20"
      )}
    >
      <div className="p-2 rounded-xl bg-muted/50 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/40 transition-colors">
        <Icon className="h-5 w-5 text-muted-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-400" />
      </div>
      <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/80 group-hover:text-indigo-700 dark:group-hover:text-indigo-300">
        {label}
      </span>
    </button>
  );
}

function PropertyButton({ icon: Icon, active, onClick }: { icon: any, active?: boolean, onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "p-2.5 rounded-lg transition-all active:scale-90",
        active
          ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function ShareIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" x2="12" y1="2" y2="15" />
    </svg>
  );
}
