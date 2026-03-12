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
import { Upload, Download, Search, Filter, Check, Eye, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { RecipientActivityModal } from "@/components/dashboard/RecipientActivityModal";
import * as XLSX from 'xlsx';

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

  useEffect(() => {
    async function fetchContacts() {
      try {
        setIsLoading(true);
        let url = "/api/contacts?";
        if (searchTerm) url += `search=${encodeURIComponent(searchTerm)}&`;
        if (statusFilter !== "all") url += `status=${statusFilter}`;

        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          setContactsData(data);
        }
      } catch (error) {
        console.error("Failed to fetch contacts:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchContacts();
  }, [searchTerm, statusFilter]);

  const filteredContacts = contactsData;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <PageHeader
        title="Contacts"
        subtitle="Manage your subscribers and leads."
      >
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
                  
                  // Simple mapper
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
          <Button
            variant="outline"
            onClick={() => document.getElementById('contact-import')?.click()}
            style={{ borderRadius: "14px" }}
            className="h-9 px-4 text-xs font-semibold border-border bg-card hover:bg-muted transition-all shadow-sm"
          >
            <Upload className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
            Import
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              window.open("/api/contacts/export", "_blank");
            }}
            style={{ borderRadius: "14px" }}
            className="h-9 px-4 text-xs font-semibold border-border bg-card hover:bg-muted transition-all shadow-sm"
          >
            <Download className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
            Export CSV
          </Button>
        </div>
      </PageHeader>

      <Card className="border-border bg-card shadow-sm overflow-hidden">
        <CardHeader className="pb-4 border-b border-border/50">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-bold text-foreground">All Contacts</CardTitle>
            <div className="flex items-center gap-3">
              <div className="relative w-64">
                <Search className="absolute left-3 top-[10px] h-3.5 w-3.5 text-muted-foreground/60" />
                <Input
                  placeholder="Search contacts..."
                  style={{ borderRadius: "14px" }}
                  className="pl-9 h-9 border-border bg-muted/30 focus:bg-card transition-all shadow-sm text-xs font-semibold placeholder:text-muted-foreground/40"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="relative">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowFilterMenu(!showFilterMenu)}
                  style={{ borderRadius: "14px" }}
                  className={`h-9 w-9 border-border bg-card hover:bg-muted transition-all shadow-sm ${statusFilter !== 'all' ? 'border-indigo-500 ring-1 ring-indigo-500/50' : ''}`}
                >
                  <Filter className={`h-3.5 w-3.5 ${statusFilter !== 'all' ? 'text-indigo-600' : 'text-muted-foreground'}`} />
                </Button>

                {showFilterMenu && (
                  <div
                    style={{ borderRadius: "14px" }}
                    className="absolute right-0 mt-2 w-48 bg-card border border-border shadow-xl z-50 overflow-hidden py-1 animate-in fade-in zoom-in-95 duration-200"
                  >
                    {["all", "active", "inactive", "unsubscribed"].map((status) => (
                      <div
                        key={status}
                        onClick={() => {
                          setStatusFilter(status);
                          setShowFilterMenu(false);
                        }}
                        className={`px-4 py-2.5 text-xs font-semibold cursor-pointer transition-colors flex items-center justify-between ${statusFilter === status ? 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400' : 'text-muted-foreground hover:bg-muted'}`}
                      >
                        <span className="capitalize">{status}</span>
                        {statusFilter === status && <Check className="h-3.5 w-3.5" />}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContacts.map((contact) => (
                <TableRow key={contact.id} className="group transition-colors">
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-700 dark:text-indigo-400 font-bold text-xs">
                        {contact.name.charAt(0)}
                      </div>
                      {contact.name}
                    </div>
                  </TableCell>
                  <TableCell>{contact.email}</TableCell>
                  <TableCell className="text-muted-foreground">{contact.company}</TableCell>
                  <TableCell className="text-muted-foreground">{contact.industry}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {contact.tags.map((tag) => (
                        <Badge key={tag} variant={"outline" as any} className="text-[10px] font-medium border-border/50" {...{ className: "text-[10px] font-medium border-border/50" } as any}>
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-1 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500" style={{ width: `${contact.score}%` }} />
                      </div>
                      <span className="text-xs font-bold text-foreground">{contact.score}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={contact.status === "active" ? "success" : contact.status === "unsubscribed" ? "secondary" : "destructive" as any} className="text-[10px] font-bold uppercase tracking-wider h-5" {...{ className: "text-[10px] font-bold uppercase tracking-wider h-5" } as any}>
                      {contact.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedContact(contact)}
                      className="h-8 px-2 text-[10px] font-bold uppercase tracking-widest text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Eye className="h-3 w-3" />
                      View Activity
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selectedContact && (
        <RecipientActivityModal
          contactId={selectedContact.id}
          email={selectedContact.email}
          name={selectedContact.name}
          onClose={() => setSelectedContact(null)}
        />
      )}
    </div>
  );
}
