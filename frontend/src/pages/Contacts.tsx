import { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, Download, Search, Filter, Check, Eye, RefreshCw, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import * as XLSX from 'xlsx';
import { cn } from "@/lib/utils";

interface Contact {
  id: string;
  name: string;
  email: string;
  company: string;
  industry: string;
  tags: string[];
  score: number;
  status: string;
}

export default function Contacts() {
  const [searchTerm, setSearchTerm] = useState("");
  const [contactsData, setContactsData] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [segments, setSegments] = useState<any[]>([]);
  const [activeSegment, setActiveSegment] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        const [contactsRes, segmentsRes] = await Promise.all([
          fetch(`/api/contacts?${searchTerm ? `search=${encodeURIComponent(searchTerm)}&` : ''}${statusFilter !== "all" ? `status=${statusFilter}` : ''}`),
          fetch("/api/segments")
        ]);
        
        if (contactsRes.ok) setContactsData(await contactsRes.json());
        if (segmentsRes.ok) setSegments(await segmentsRes.json());
      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [searchTerm, statusFilter]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        document.getElementById("subscriber-search")?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const filteredContacts = contactsData;

  return (
    <div className="flex gap-8 animate-in fade-in duration-500">
      {/* Sidebar Segments */}
      <div className="w-64 shrink-0 space-y-6">
        <div className="space-y-4">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground ml-2">Segments</h3>
          <div className="space-y-1">
            <button 
              onClick={() => { setActiveSegment(null); setStatusFilter("all"); }}
              className={cn(
                "w-full flex items-center justify-between px-4 py-2 text-xs font-semibold rounded-xl transition-all",
                !activeSegment ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" : "text-muted-foreground hover:bg-muted"
              )}
            >
              All Subscribers
              <Badge variant={!activeSegment ? "secondary" : "outline" as any} className="ml-2 h-4 px-1 text-[8px] border-indigo-400/30">
                {contactsData.length}
              </Badge>
            </button>
            {segments.map(seg => (
              <button 
                key={seg.id}
                onClick={() => setActiveSegment(seg.id)}
                className={cn(
                  "w-full px-4 py-2 text-xs font-semibold rounded-xl transition-all text-left",
                  activeSegment === seg.id ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" : "text-muted-foreground hover:bg-muted"
                )}
              >
                {seg.name}
              </button>
            ))}
            <Button variant="ghost" size="sm" className="w-full justify-start text-[10px] font-bold uppercase tracking-wider text-indigo-600 mt-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/10">
              <Plus className="mr-2 h-3.5 w-3.5" /> New Segment
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground ml-2">Smart Filters</h3>
          <div className="space-y-1">
            {["active", "unsubscribed", "inactive"].map(status => (
              <button 
                key={status}
                onClick={() => setStatusFilter(status)}
                className={cn(
                  "w-full flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-all capitalize",
                  statusFilter === status ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50"
                )}
              >
                <div className={cn("w-1.5 h-1.5 rounded-full", status === 'active' ? 'bg-emerald-500' : status === 'unsubscribed' ? 'bg-orange-500' : 'bg-destructive')} />
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 space-y-6">
        <div className="flex items-center justify-between">
            <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3.5 top-[11px] h-4 w-4 text-muted-foreground/40" />
                <Input
                    id="subscriber-search"
                    placeholder="Search by name, email or company (Press / to focus)"
                    className="pl-10 h-11 rounded-2xl border-border bg-muted/20 focus:bg-card transition-all shadow-sm font-medium"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <div className="flex gap-2">
                <input 
                  type="file" 
                  id="contact-import" 
                  className="hidden" 
                  accept=".xlsx, .xls, .csv" 
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    
                    const reader = new FileReader();
                    reader.onload = async (event) => {
                      try {
                        const binaryStr = event.target?.result;
                        const workbook = XLSX.read(binaryStr, { type: 'binary' });
                        const firstSheetName = workbook.SheetNames[0];
                        const worksheet = workbook.Sheets[firstSheetName];
                        const jsonData = XLSX.utils.sheet_to_json(worksheet);
                        
                        if (jsonData.length === 0) throw new Error("File is empty");
                        
                        const contacts = jsonData.map((row: any) => ({
                          name: row.name || row.Name || row.email || row.Email,
                          email: row.email || row.Email,
                          company: row.company || row.Company || "",
                          industry: row.industry || row.Industry || "",
                          tags: row.tags ? String(row.tags).split(",") : []
                        })).filter(c => c.email);
                        
                        const res = await fetch("/api/contacts/import", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ contacts })
                        });
                        
                        if (res.ok) {
                          alert("Import successful!");
                          window.location.reload();
                        } else {
                          alert("Import failed: " + await res.text());
                        }
                      } catch (err) {
                          alert("Error parsing file: " + err);
                      }
                    };
                    reader.readAsBinaryString(file);
                  }} 
                />
                <Button variant="outline" onClick={() => document.getElementById('contact-import')?.click()} className="h-11 rounded-2xl px-6 font-bold shadow-sm">
                    <Upload className="mr-2 h-4 w-4" /> Import
                </Button>
                <Button className="h-11 rounded-2xl px-6 font-bold shadow-lg shadow-indigo-600/20 bg-indigo-600 hover:bg-indigo-700">
                    <Plus className="mr-2 h-4 w-4" /> Add Subscriber
                </Button>
            </div>
        </div>

        <Card className="border-border bg-card shadow-sm overflow-hidden rounded-2xl">
            <Table>
                <TableHeader className="bg-muted/30">
                <TableRow className="hover:bg-transparent border-b">
                    <TableHead className="font-bold uppercase tracking-widest text-[9px] h-12">Subscriber</TableHead>
                    <TableHead className="font-bold uppercase tracking-widest text-[9px] h-12">Status</TableHead>
                    <TableHead className="font-bold uppercase tracking-widest text-[9px] h-12">Engagement</TableHead>
                    <TableHead className="font-bold uppercase tracking-widest text-[9px] h-12">Tags</TableHead>
                    <TableHead className="font-bold uppercase tracking-widest text-[9px] h-12 text-right">Activity</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {filteredContacts.map((contact) => (
                    <TableRow 
                        key={contact.id} 
                        onClick={() => navigate(`/contacts/${contact.id}`)}
                        className="group transition-colors cursor-pointer hover:bg-muted/10 border-b border-border/50"
                    >
                        <TableCell className="py-4">
                            <div className="flex items-center gap-4">
                                <div className="h-10 w-10 rounded-2xl bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center text-indigo-700 dark:text-indigo-400 font-extrabold text-sm shadow-sm ring-1 ring-indigo-500/10">
                                    {contact.name.charAt(0)}
                                </div>
                                <div>
                                    <p className="font-bold text-sm text-foreground">{contact.name}</p>
                                    <p className="text-xs text-muted-foreground font-medium">{contact.email}</p>
                                </div>
                            </div>
                        </TableCell>
                        <TableCell>
                            <Badge variant={contact.status === "active" ? "success" : contact.status === "unsubscribed" ? "secondary" : "destructive" as any} className="text-[9px] font-bold uppercase tracking-wider rounded-lg">
                                {contact.status}
                            </Badge>
                        </TableCell>
                        <TableCell>
                            <div className="flex items-center gap-3">
                                <div className="flex-1 w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                                    <div 
                                        className={cn("h-full transition-all duration-1000", contact.score > 70 ? "bg-emerald-500" : contact.score > 30 ? "bg-indigo-500" : "bg-orange-500")} 
                                        style={{ width: `${contact.score}%` }} 
                                    />
                                </div>
                                <span className="text-[10px] font-bold text-muted-foreground w-4">{contact.score}</span>
                            </div>
                        </TableCell>
                        <TableCell>
                            <div className="flex gap-1">
                            {contact.tags.slice(0, 2).map((tag) => (
                                <Badge key={tag} variant="outline" className="text-[9px] font-bold uppercase border-border/60 text-muted-foreground/80 px-1.5 leading-3" {...{ "data-tag": tag } as any}>
                                {tag}
                                </Badge>
                            ))}
                            {contact.tags.length > 2 && (
                                <Badge variant="outline" className="text-[9px] font-bold border-border/60 text-muted-foreground/60 px-1.5">
                                +{contact.tags.length - 2}
                                </Badge>
                            )}
                            </div>
                        </TableCell>
                        <TableCell className="text-right">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-xl text-muted-foreground/40 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 opacity-0 group-hover:opacity-100 transition-all active:scale-90"
                            >
                                <Eye className="h-4 w-4" />
                            </Button>
                        </TableCell>
                    </TableRow>
                ))}
                </TableBody>
            </Table>
        </Card>
      </div>
    </div>
  );
}
