import { useState, useEffect, useRef } from "react";
import { format, parseISO, isValid } from "date-fns";
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
import {
  Plus,
  Search,
  Filter,
  ChevronDown,
  Check,
  Mail,
  Users,
  MousePointer2,
  MessageSquare,
  Play,
  Pause,
  Edit2,
  Trash2,
  AlertCircle,
  ShieldAlert,
  RefreshCw,
  Layout
} from "lucide-react";
import { CreateCampaignModal } from "@/components/dashboard/CreateCampaignModal";
import { PageHeader } from "@/components/layout/PageHeader";

interface Campaign {
  id: string;
  name: string;
  status: string;
  sent: number;
  delivered: number;
  failed: number;
  opens: string;
  unread: string;
  bounce: string;
  scheduled: string;
  company: string;
}

export default function Campaigns() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [campaignsData, setCampaignsData] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionWarning, setConnectionWarning] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [campaignToDelete, setCampaignToDelete] = useState<string | null>(null);
  const statusMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (statusMenuRef.current && !statusMenuRef.current.contains(event.target as Node)) {
        setShowStatusMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);

    // Auto-open modal if redirected from AI Generator
    const aiSubject = localStorage.getItem("ai_draft_subject");
    const aiBody = localStorage.getItem("ai_draft_body");
    if (aiSubject || aiBody) {
      setShowCreateModal(true);
    }

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function fetchCampaigns() {
    try {
      setIsLoading(true);
      setError(null);
      setConnectionWarning(false);
      
      const params = new URLSearchParams();
      if (searchTerm) params.append("search", searchTerm);
      if (statusFilter && statusFilter !== "all") params.append("status", statusFilter);

      const response = await fetch(`/api/campaigns?${params.toString()}`);
      const data = await response.json();
      
      if (response.ok && data.success) {
        setCampaignsData(data.data || []);
      } else {
        const errorMsg = data.error || `Server returned ${response.status}: ${response.statusText}`;
        setError(errorMsg);
        if (response.status === 404) {
          setConnectionWarning(true);
        }
      }
    } catch (error) {
      console.error("Failed to fetch campaigns:", error);
      setError("Unable to connect to the backend server. Please ensure the backend service is running and accessible.");
      setConnectionWarning(true);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchCampaigns();
  }, [searchTerm, statusFilter]);

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase() || "") {
      case 'running': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
      case 'queued':
      case 'scheduled': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
      case 'draft': return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
      case 'completed': 
      case 'complete': return 'text-purple-400 bg-purple-400/10 border-purple-400/20';
      default: return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
    }
  };

  const getCompanyColor = (company: string) => {
    switch (company) {
      case 'A Making Company': return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
      case 'MP Lumina': return 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20';
      case 'MP Consultant LLC': return 'text-indigo-400 bg-indigo-400/10 border-indigo-400/20';
      default: return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
    }
  };

  // PRO GRADE: Real-time Polling for active campaigns
  useEffect(() => {
    const hasActive = campaignsData.some(c => 
      ['running', 'queued', 'scheduled'].includes(c.status?.toLowerCase() || "")
    );

    if (hasActive) {
      const interval = setInterval(() => {
        fetchCampaigns();
      }, 10000); // Poll every 10s
      return () => clearInterval(interval);
    }
  }, [campaignsData]);

  async function handleEditCampaign(campaign: Campaign) {
    setSelectedCampaign(campaign);
    setShowEditModal(true);
  }

  async function handleSaveEdit() {
    if (!selectedCampaign) return;
    try {
      const response = await fetch(`/api/campaigns/${selectedCampaign.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: selectedCampaign.name,
          subject: selectedCampaign.name,
          body: selectedCampaign.name,
        }),
      });
      if (response.ok) {
        setShowEditModal(false);
        setSelectedCampaign(null);
        fetchCampaigns();
      }
    } catch (error) {
      console.error("Failed to update campaign:", error);
    }
  }

  async function handleToggleCampaign(id: string) {
    try {
      const response = await fetch(`/api/campaigns/${id}/toggle`, {
        method: "POST",
      });
      if (response.ok) {
        fetchCampaigns();
      }
    } catch (error) {
      console.error("Failed to toggle campaign:", error);
    }
  }

  async function handleDeleteCampaign(id: string | null) {
    if (!id) return;
    try {
      const response = await fetch(`/api/campaigns/${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setShowDeleteConfirm(false);
        setCampaignToDelete(null);
        fetchCampaigns();
      }
    } catch (error) {
      console.error("Failed to delete campaign:", error);
    }
  }

  // Filtering is now handled by the backend
  const filteredCampaigns = campaignsData;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Campaigns"
        subtitle="Manage and track your email outreach campaigns."
      >
        <Button
          onClick={() => setShowCreateModal(true)}
          style={{ borderRadius: "14px" }}
          className="gap-2 h-9 px-4 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 transition-all shadow-md text-white border-transparent"
        >
          <Plus className="h-3.5 w-3.5" />
          Create Campaign
        </Button>
      </PageHeader>

      {showCreateModal && (
        <CreateCampaignModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchCampaigns();
          }}
        />
      )}

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle>All Campaigns</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative w-72">
                <Search className="absolute left-3 top-[10px] h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search campaigns..."
                  style={{ borderRadius: "14px" }}
                  className="pl-9 h-9 border-border bg-card focus:bg-muted transition-all shadow-sm text-xs font-semibold"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="relative w-44" ref={statusMenuRef}>
                <div
                  style={{ borderRadius: "14px" }}
                  onClick={() => setShowStatusMenu(!showStatusMenu)}
                  className={`flex items-center gap-2 h-9 px-4 border cursor-pointer transition-all bg-card hover:bg-muted text-xs font-semibold w-full ${showStatusMenu ? 'border-indigo-500 ring-1 ring-indigo-500 shadow-sm' : 'border-border shadow-sm'}`}
                >
                  <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-foreground flex-1 truncate">
                    {statusFilter === "all" ? "All Status" : statusFilter?.charAt(0)?.toUpperCase() + statusFilter?.slice(1)}
                  </span>
                  <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${showStatusMenu ? 'rotate-180' : 'rotate-0'}`} />
                </div>

                {showStatusMenu && (
                  <div
                    style={{ borderRadius: "14px" }}
                    className="absolute left-0 right-0 mt-2 bg-card border border-border shadow-xl z-50 overflow-hidden py-1 animate-in fade-in slide-in-from-top-2 duration-200"
                  >
                    {[
                      { val: "all", label: "All Status" },
                      { val: "draft", label: "Draft" },
                      { val: "scheduled", label: "Scheduled" },
                      { val: "running", label: "Running" },
                      { val: "completed", label: "Completed" }
                    ].map((opt) => (
                      <div
                        key={opt.val}
                        onClick={() => {
                          setStatusFilter(opt.val);
                          setShowStatusMenu(false);
                        }}
                        className={`px-4 py-2.5 text-xs font-semibold cursor-pointer transition-colors flex items-center justify-between ${statusFilter === opt.val ? 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400' : 'text-muted-foreground hover:bg-muted'}`}
                      >
                        {opt.label}
                        {statusFilter === opt.val && <Check className="h-3.5 w-3.5" />}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24">
              <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
              <p className="text-muted-foreground font-medium animate-pulse">Syncing campaigns...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4 transition-transform hover:scale-110 duration-300">
                <AlertCircle className="h-8 w-8 text-red-500" />
              </div>
              <p className="text-foreground font-bold text-lg mb-1">Sync Error</p>
              <p className="text-muted-foreground text-sm max-w-xs mb-6 px-4">
                {error}
              </p>
              {connectionWarning && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 max-w-md mx-auto mb-6 text-left">
                  <div className="flex gap-3 text-amber-400">
                    <ShieldAlert className="w-5 h-5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-sm">Potential Port Conflict Detected</p>
                      <p className="text-xs text-amber-400/80 mt-1">
                        The frontend is having trouble reaching the API. If you're on a custom network, ensure the backend domain is allowed.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              <Button 
                onClick={() => fetchCampaigns()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-6"
              >
                Retry Sync
              </Button>
            </div>
          ) : filteredCampaigns.length > 0 ? (
            <div className="overflow-hidden border border-border rounded-2xl shadow-sm">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="w-12"></TableHead>
                    <TableHead className="text-xs font-black uppercase tracking-widest text-foreground py-4">Campaign</TableHead>
                    <TableHead className="text-xs font-black uppercase tracking-widest text-foreground">Company</TableHead>
                    <TableHead className="text-xs font-black uppercase tracking-widest text-foreground">Status</TableHead>
                    <TableHead className="text-xs font-black uppercase tracking-widest text-foreground">Schedule Time</TableHead>
                    <TableHead className="text-xs font-black uppercase tracking-widest text-foreground">Sent</TableHead>
                    <TableHead className="text-xs font-black uppercase tracking-widest text-foreground">Delivered</TableHead>
                    <TableHead className="text-xs font-black uppercase tracking-widest text-foreground">Bounced</TableHead>
                    <TableHead className="text-right text-xs font-black uppercase tracking-widest text-foreground py-4 pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCampaigns.map((campaign) => (
                    <TableRow key={campaign.id} className="border-border hover:bg-muted/30 transition-colors group">
                      <TableCell className="py-4">
                        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500 font-bold text-xs group-hover:bg-indigo-500 group-hover:text-white transition-all duration-300">
                          {campaign.name?.charAt(0)?.toUpperCase() || "C"}
                        </div>
                      </TableCell>
                      <TableCell className="font-bold text-foreground py-4">
                        {campaign.name}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline" 
                          className={`rounded-full px-3 py-0.5 text-[10px] font-bold border ${getCompanyColor(campaign.company)}`}
                        >
                          {campaign.company}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline" 
                          className={`rounded-full px-3 py-0.5 text-[10px] font-bold border ${getStatusColor(campaign.status)}`}
                        >
                          {campaign.status?.toLowerCase() === 'running' && campaign.scheduled && campaign.scheduled !== "-"
                            ? `Running at ${(() => {
                                try {
                                  const d = parseISO(campaign.scheduled);
                                  return isValid(d) ? format(d, 'h:mm a') : '...';
                                } catch { return '...'; }
                              })()}` 
                            : campaign.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-[10px] font-bold text-muted-foreground whitespace-nowrap">
                        {campaign.scheduled && campaign.scheduled !== "-" ? (
                          (() => {
                            try {
                              const d = parseISO(campaign.scheduled);
                              return isValid(d) ? format(d, 'dd/MM/yy (h:mm a)') : "-";
                            } catch {
                              return "-";
                            }
                          })()
                        ) : (
                          <span className="opacity-50">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs font-medium text-muted-foreground">
                        {campaign.sent}
                      </TableCell>
                      <TableCell className="text-xs font-medium text-muted-foreground">
                        {campaign.delivered}
                      </TableCell>
                      <TableCell className="text-xs font-medium text-muted-foreground">
                        {campaign.bounce}
                      </TableCell>
                      <TableCell className="text-right py-4 pr-6">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleToggleCampaign(campaign.id)}
                            className="p-2 text-muted-foreground hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-all"
                            title={campaign.status?.toLowerCase() === 'running' ? 'Pause' : 'Start'}
                          >
                            {campaign.status?.toLowerCase() === 'running' ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                          </button>
                          <button
                            onClick={() => handleEditCampaign(campaign)}
                            className="p-2 text-muted-foreground hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-all"
                            title="Edit"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                             onClick={() => {
                              setCampaignToDelete(campaign.id);
                              setShowDeleteConfirm(true);
                            }}
                            className="p-2 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center bg-card/50 rounded-2xl border border-dashed border-border/50">
              <div className="w-16 h-16 bg-indigo-500/10 rounded-full flex items-center justify-center mb-4 text-indigo-500">
                <Layout className="h-8 w-8" />
              </div>
              <p className="text-foreground font-bold text-lg mb-1">No Campaigns Found</p>
              <p className="text-muted-foreground text-sm max-w-xs mb-6 px-4">
                {searchTerm || statusFilter !== "all" 
                  ? "No results matching your filters. Try adjusting your search." 
                  : "You haven't created any campaigns yet. Start by creating a new outreach campaign."}
              </p>
              {!searchTerm && statusFilter === "all" && (
                <Button 
                  onClick={() => setShowCreateModal(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-6"
                >
                  Create Your First Campaign
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Campaign Modal */}
      {showEditModal && selectedCampaign && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md bg-card border-border shadow-2xl">
            <CardHeader>
              <CardTitle className="text-xl font-bold text-foreground">Edit Campaign</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Campaign Name</label>
                <Input
                  value={selectedCampaign.name}
                  onChange={(e) => setSelectedCampaign({ ...selectedCampaign, name: e.target.value })}
                  className="w-full bg-muted border-border rounded-xl px-4 py-2.5 text-foreground focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>
              <div className="flex gap-3 justify-end mt-8">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedCampaign(null);
                  }}
                  className="px-4 py-2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </Button>
                <Button
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl font-medium transition-all shadow-lg"
                  onClick={handleSaveEdit}
                >
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && campaignToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md bg-card border-red-500/20 shadow-2xl">
            <CardHeader>
              <CardTitle className="text-xl font-bold text-red-500">Delete Campaign</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4 text-center">
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8 text-red-500" />
              </div>
              <p className="text-muted-foreground">
                Are you sure you want to delete this campaign? This action cannot be undone.
              </p>
              <div className="flex gap-3 justify-center mt-8">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setCampaignToDelete(null);
                  }}
                  className="px-4 py-2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </Button>
                <Button
                  className="bg-red-600 hover:bg-red-700 text-white px-8 py-2 rounded-xl font-medium transition-all shadow-lg"
                  onClick={() => handleDeleteCampaign(campaignToDelete)}
                >
                  Delete Permanently
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
