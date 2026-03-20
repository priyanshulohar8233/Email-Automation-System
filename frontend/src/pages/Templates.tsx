import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Type,
  Image as ImageIcon,
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
  Layers,
  Check,
  Pencil
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";

type BlockType = 'text' | 'image' | 'button' | 'divider' | 'columns' | 'social' | 'attachment' | 'imageContent';

interface Block {
  id: string;
  type: BlockType;
  content: string;
  styles: Record<string, any>;
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

  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const selectedBlock = blocks.find(b => b.id === selectedBlockId);

  const [saving, setSaving] = useState(false);
  const [activeInsertType, setActiveInsertType] = useState<BlockType | null>(null);

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

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch('/api/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: "My Custom Template",
          content: JSON.stringify(blocks)
        })
      });
      alert('Template saved successfully!');
    } catch (err) {
      alert('Error saving template');
    }
    setSaving(false);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Top Bar */}
      <PageHeader
        title="Template Builder"
        subtitle="Design your email templates visually."
      >
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => alert("Preview feature is ready to be hooked up!")}
            style={{ borderRadius: "14px" }}
            className="h-9 px-4 text-xs font-semibold gap-2"
          >
            <Eye className="h-3.5 w-3.5" />
            Preview
          </Button>
          <Button
            variant="outline"
            onClick={() => alert("Test send triggered!")}
            style={{ borderRadius: "14px" }}
            className="h-9 px-4 text-xs font-semibold gap-2"
          >
            <Send className="h-3.5 w-3.5" />
            Test Send
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            style={{ borderRadius: "14px" }}
            className="h-9 px-4 text-xs font-semibold gap-2 bg-indigo-600 hover:bg-indigo-700 transition-all shadow-md text-white border-transparent"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? "Saving..." : "Save Template"}
          </Button>
        </div>
      </PageHeader>

      {/* Builder Area */}
      <div className="flex flex-1 gap-6 overflow-hidden">
        {/* Left Sidebar - Templates & Blocks */}
        <Card className="w-[300px] flex flex-col overflow-y-auto border-border bg-card shadow-sm scrollbar-hide">
          <div className="p-4 border-b border-border bg-muted/10">
            <h3 className="font-bold text-foreground flex items-center gap-2">
              <Layers className="h-4 w-4 text-indigo-500" />
              Templates
            </h3>
          </div>

          {/* Default Section */}
          <div className="p-5 border-b border-border">
            <h4 className="text-[10px] font-bold uppercase text-muted-foreground mb-4 tracking-widest flex items-center gap-2">
              <Check className="h-3 w-3 text-emerald-500" />
              Default Templates
            </h4>
            <div className="space-y-2">
              <button 
                onClick={() => alert("Pre-built templates are being synthesized...")}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-dashed border-border hover:border-indigo-500/50 hover:bg-indigo-500/[0.02] text-left transition-all group"
              >
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                   <Plus className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">Standard Layout</p>
                  <p className="text-[10px] text-muted-foreground font-medium">Coming soon</p>
                </div>
              </button>
            </div>
          </div>

          {/* Custom Builder Section */}
          <div className="p-5 border-b border-border">
            <h4 className="text-[10px] font-bold uppercase text-muted-foreground mb-4 tracking-widest flex items-center gap-2">
              <Pencil className="h-3 w-3 text-indigo-500" />
              Custom Builder
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <BlockButton
                icon={Type}
                label="Text"
                active={activeInsertType === 'text'}
                onClick={() => setActiveInsertType(activeInsertType === 'text' ? null : 'text')}
              />
              <BlockButton
                icon={ImageIcon}
                label="Image"
                active={activeInsertType === 'image'}
                onClick={() => setActiveInsertType(activeInsertType === 'image' ? null : 'image')}
              />
              <BlockButton
                icon={Sparkles}
                label="AI Media"
                active={activeInsertType === 'imageContent'}
                onClick={() => setActiveInsertType(activeInsertType === 'imageContent' ? null : 'imageContent')}
              />
              <BlockButton
                icon={MousePointerClick}
                label="Button"
                active={activeInsertType === 'button'}
                onClick={() => setActiveInsertType(activeInsertType === 'button' ? null : 'button')}
              />
              <BlockButton
                icon={Minus}
                label="Divider"
                active={activeInsertType === 'divider'}
                onClick={() => setActiveInsertType(activeInsertType === 'divider' ? null : 'divider')}
              />
              <BlockButton
                icon={Paperclip}
                label="Attach"
                active={activeInsertType === 'attachment'}
                onClick={() => setActiveInsertType(activeInsertType === 'attachment' ? null : 'attachment')}
              />
              <BlockButton icon={AlignLeft} label="Columns" onClick={() => addBlock("columns")} />
              <BlockButton icon={ShareIcon} label="Social" onClick={() => addBlock("social")} />
            </div>
          </div>

          {/* AI Templates Section */}
          <div className="p-5">
            <h4 className="text-[10px] font-bold uppercase text-muted-foreground mb-4 tracking-widest flex items-center gap-2">
              <Sparkles className="h-3 w-3 text-amber-500" />
              AI Templates
            </h4>
            <Button 
               variant="outline" 
               className="w-full justify-start text-[11px] font-bold h-10 border-indigo-500/20 hover:bg-indigo-500/5 text-indigo-600 dark:text-indigo-400 rounded-xl"
               onClick={() => alert("AI synthesis engine initializing...")}
            >
               <Sparkles className="w-3.5 h-3.5 mr-2 animate-pulse" />
               Generate with AI
            </Button>
          </div>

          {activeInsertType && (
            <div className="p-3 m-4 mt-2 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl animate-pulse">
              <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase text-center">Click in body to insert {activeInsertType}</p>
            </div>
          )}
        </Card>

        {/* Center - Canvas */}
        <div className="flex-1 bg-background/50 dark:bg-black/20 rounded-xl border border-border flex flex-col items-center p-8 overflow-y-auto scrollbar-hide">
          <div
            onClick={(e) => {
              if (activeInsertType) {
                // If clicking directly on a block insert zone, it will be handled by the zone's onClick
                // But for general click in gaps or at the end:
                if (e.target === e.currentTarget) {
                  addBlock(activeInsertType);
                  setActiveInsertType(null);
                }
              }
            }}
            className={cn(
              "w-full max-w-[640px] bg-card shadow-2xl rounded-2xl p-12 relative border border-border/50 transition-all duration-300 flex flex-col gap-8 mb-32",
              activeInsertType ? "cursor-crosshair ring-2 ring-indigo-500/20" : ""
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
            <div className="p-4 space-y-6">

              <div className="space-y-3">
                <label className="text-sm font-medium text-muted-foreground">
                  {selectedBlock.type === 'image' ? 'Image Source URL' : selectedBlock.type === 'imageContent' ? 'Media Data' : 'Content'}
                </label>
                <div className="relative group/input">
                  {selectedBlock.type === 'imageContent' ? (() => {
                    const data = JSON.parse(selectedBlock.content || '{}');
                    return (
                      <div className="space-y-3">
                        <Input
                          placeholder="Title"
                          value={data.title}
                          onChange={e => updateBlockContent(selectedBlock.id, JSON.stringify({ ...data, title: e.target.value }))}
                          className="bg-muted/50 border-border"
                        />
                        <Input
                          placeholder="Subtitle"
                          value={data.subtitle}
                          onChange={e => updateBlockContent(selectedBlock.id, JSON.stringify({ ...data, subtitle: e.target.value }))}
                          className="bg-muted/50 border-border"
                        />
                        <Input
                          placeholder="Image URL"
                          value={data.image}
                          onChange={e => updateBlockContent(selectedBlock.id, JSON.stringify({ ...data, image: e.target.value }))}
                          className="bg-muted/50 border-border"
                        />
                      </div>
                    );
                  })() : (
                    <textarea
                      value={selectedBlock.content}
                      placeholder={selectedBlock.type === 'image' ? "https://example.com/image.jpg" : "Enter text content..."}
                      onChange={(e) => updateBlockContent(selectedBlock.id, e.target.value)}
                      className="w-full text-sm p-3 border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[80px] bg-muted/50 text-foreground transition-all focus:bg-card"
                    />
                  )}
                  {selectedBlock.type === 'image' && (
                    <div className="absolute right-3 top-3 pointer-events-none opacity-20">
                      <Link className="w-4 h-4" />
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium text-muted-foreground">Typography</label>
                <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-xl border border-border">
                  <PropertyButton icon={Bold} active={selectedBlock.styles.fontWeight === 'bold'} onClick={() => updateBlockStyles(selectedBlock.id, { fontWeight: selectedBlock.styles.fontWeight === 'bold' ? 'normal' : 'bold' })} />
                  <PropertyButton icon={Italic} active={selectedBlock.styles.fontStyle === 'italic'} onClick={() => updateBlockStyles(selectedBlock.id, { fontStyle: selectedBlock.styles.fontStyle === 'italic' ? 'normal' : 'italic' })} />
                  <PropertyButton icon={Underline} active={selectedBlock.styles.textDecoration === 'underline'} onClick={() => updateBlockStyles(selectedBlock.id, { textDecoration: selectedBlock.styles.textDecoration === 'underline' ? 'none' : 'underline' })} />
                  <div className="w-px h-4 bg-border mx-1" />
                  <PropertyButton icon={AlignLeft} active={selectedBlock.styles.textAlign === 'left'} onClick={() => updateBlockStyles(selectedBlock.id, { textAlign: 'left' })} />
                  <PropertyButton icon={AlignCenter} active={selectedBlock.styles.textAlign === 'center'} onClick={() => updateBlockStyles(selectedBlock.id, { textAlign: 'center' })} />
                  <PropertyButton icon={AlignRight} active={selectedBlock.styles.textAlign === 'right'} onClick={() => updateBlockStyles(selectedBlock.id, { textAlign: 'right' })} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="number"
                    placeholder="Size"
                    value={parseInt(selectedBlock.styles.fontSize) || 16}
                    onChange={e => updateBlockStyles(selectedBlock.id, { fontSize: `${e.target.value}px` })}
                  />
                  <Input
                    type="color"
                    className="h-10 p-1 w-full"
                    value={selectedBlock.styles.color || '#000000'}
                    onChange={e => updateBlockStyles(selectedBlock.id, { color: e.target.value })}
                  />
                </div>
              </div>

              {selectedBlock.type === 'button' && (
                <div className="space-y-3">
                  <label className="text-sm font-medium text-muted-foreground">Background Color</label>
                  <Input
                    type="color"
                    className="h-10 p-1 w-full bg-muted/50 border-border"
                    value={selectedBlock.styles.backgroundColor || '#4f46e5'}
                    onChange={e => updateBlockStyles(selectedBlock.id, { backgroundColor: e.target.value })}
                  />
                </div>
              )}

              <div className="space-y-3">
                <label className="text-sm font-medium text-muted-foreground">Spacing</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground/60 mb-1 block">Padding (px)</span>
                    <Input
                      type="number"
                      className="bg-muted/50 border-border"
                      value={parseInt(selectedBlock.styles.padding) || 0}
                      onChange={e => updateBlockStyles(selectedBlock.id, { padding: `${e.target.value}px` })}
                    />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground/60 mb-1 block">Margin (px)</span>
                    <Input
                      type="number"
                      className="bg-muted/50 border-border"
                      value={parseInt(selectedBlock.styles.margin) || 0}
                      onChange={e => updateBlockStyles(selectedBlock.id, { margin: `${e.target.value}px auto` })} // For button centering mainly
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium text-muted-foreground">Border</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground/60 mb-1 block">Radius</span>
                    <Input
                      type="number"
                      className="bg-muted/50 border-border"
                      value={parseInt(selectedBlock.styles.borderRadius) || 0}
                      onChange={e => updateBlockStyles(selectedBlock.id, { borderRadius: `${e.target.value}px` })}
                    />
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
      <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/80 group-hover:text-indigo-700 dark:group-hover:text-indigo-300">{label}</span>
    </button >
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
  )
}
