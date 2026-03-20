import { useState, useEffect, useRef } from "react";
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
  MoreHorizontal,
  Check,
  Mail,
  Users,
  MousePointer2,
  MessageSquare,
  Settings,
  Play,
  Pause,
  Edit,
  Trash2,
  AlertCircle,
  ShieldAlert,
  RefreshCw
} from "lucide-react";
import { CreateCampaignModal } from "@/components/dashboard/CreateCampaignModal";
import { PageHeader } from "@/components/layout/PageHeader";

interface Campaign {
  id: string;
  name: string;
  status: string;
  sent: string;
  delivered: string;
  failed: string;
  opens: string;
  unread: string;
  bounce: string;
  scheduled: string;
}

const statusStyles: Record<string, "secondary" | "warning" | "default" | "success"> = {
  draft: "secondary",
  queued: "warning",
  scheduled: "warning",
  running: "default",
  completed: "success",
  complete: "success",
  "complete with errors": "warning",
};

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
      
      if (response.ok) {
        const data = await response.json();
        setCampaignsData(data);
      } else {
        setError(`Server returned ${response.status}: ${response.statusText}`);
        if (response.status === 404) {
          setConnectionWarning(true);
        }
      }
    } catch (error) {
      console.error("Failed to fetch campaigns:", error);
      setError("Unable to connect to the backend server. Please check if the service is running on port 8001.");
      setConnectionWarning(true);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchCampaigns();
  }, [searchTerm, statusFilter]);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'running': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
      case 'scheduled': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
      case 'draft': return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
      case 'completed': 
      case 'complete': return 'text-purple-400 bg-purple-400/10 border-purple-400/20';
      default: return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
    }
  };

  // PRO GRADE: Real-time Polling for active campaigns
  useEffect(() => {
    const hasActive = campaignsData.some(c => 
      ['running', 'queued', 'scheduled'].includes(c.status.toLowerCase())
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

  async function handleDeleteCampaign(id: string) {
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

      {
        showCreateModal && (
          <CreateCampaignModal
            onClose={() => setShowCreateModal(false)}
            onSuccess={() => {
              setShowCreateModal(false);
              fetchCampaigns(); // reload list
            }}
          />
        )
      }

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
                    {statusFilter === "all" ? "All Status" : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}
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
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4"></div>
              <p className="text-slate-400 animate-pulse">Loading campaigns...</p>
            </div>
          ) : error ? (
            <div className="text-center py-16 bg-red-500/5 rounded-2xl border border-red-500/20">
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Sync Error</h3>
              <p className="text-slate-400 max-w-sm mx-auto mb-6">
                {error}
              </p>
              {connectionWarning && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 max-w-md mx-auto mb-6 text-left">
                  <div className="flex gap-3 text-amber-400">
                    <ShieldAlert className="w-5 h-5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-sm">Potential Port Conflict Detected</p>
                      <p className="text-xs text-amber-400/80 mt-1">
                        The frontend is configured to use port 8001. If another service is occupying this port, data may not sync correctly.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              <button 
                onClick={() => fetchCampaigns()}
                className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-colors inline-flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Retry Sync
              </button>
            </div>
          ) : filteredCampaigns.length > 0 ? (
            <div className="bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-800/50">
                      <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Campaign</th>
                      <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Delivery stats</th>
                      <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Engagement</th>
                      <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Scheduled</th>
                      <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {filteredCampaigns.map((campaign) => {
                      const isCompleted = ['complete', 'completed'].includes(campaign.status.toLowerCase());
                      return (
                        <tr 
                          key={campaign.id}
                          className="group hover:bg-slate-800/30 transition-colors cursor-pointer"
                          onClick={() => setSelectedCampaign(campaign)}
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                                <Mail className="w-5 h-5" />
                              </div>
                              <span className="font-medium text-slate-200 group-hover:text-white transition-colors">
                                {campaign.name}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(campaign.status)}`}>
                              {campaign.status}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="space-y-2">
                              <div className="flex justify-between text-xs text-slate-400">
                                <span>Delivered</span>
                                <span className="text-slate-300 font-medium">
                                  {campaign.delivered} / {campaign.sent}
                                </span>
                              </div>
                              <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-blue-500 rounded-full"
                                  style={{ 
                                    width: `${campaign.sent > 0 ? (campaign.delivered / campaign.sent) * 100 : 0}%` 
                                  }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-1.5 text-slate-400 hover:text-emerald-400 transition-colors">
                                <MousePointer2 className="w-4 h-4" />
                                <span className="text-sm font-medium">{campaign.opens}</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-slate-400 hover:text-orange-400 transition-colors">
                                <MessageSquare className="w-4 h-4" />
                                <span className="text-sm font-medium">{campaign.unread}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-400">
                            {campaign.scheduled}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex justify-end gap-2">
                              <button 
                                disabled={isCompleted}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleCampaign(campaign.id);
                                }}
                                className={`p-2 rounded-lg transition-all ${isCompleted ? 'opacity-30 cursor-not-allowed' : 'hover:bg-slate-700 text-slate-400 hover:text-white'}`}
                              >
                                {campaign.status.toLowerCase() === 'running' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                              </button>
                              <button 
                                disabled={isCompleted}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditCampaign(campaign);
                                }}
                                className={`p-2 rounded-lg transition-all ${isCompleted ? 'opacity-30 cursor-not-allowed' : 'hover:bg-slate-700 text-slate-400 hover:text-white'}`}
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCampaignToDelete(campaign.id);
                                  setShowDeleteConfirm(true);
                                }}
                                className="p-2 hover:bg-red-500/10 rounded-lg text-slate-400 hover:text-red-400 transition-all"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-20 bg-slate-900/50 rounded-2xl border border-dashed border-slate-700">
              <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">No campaigns found</h3>
              <p className="text-slate-400 max-w-xs mx-auto mb-6">
                {statusFilter === 'all' 
                  ? "You haven't created any campaigns yet. Start your first outreach today!"
                  : `No campaigns with status "${statusFilter}" found.`}
              </p>
              <button 
                onClick={() => setShowCreateModal(true)}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all hover:scale-105 hover:shadow-lg hover:shadow-blue-500/25 inline-flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Create Campaign
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Campaign Modal */}
      {showEditModal && selectedCampaign && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md bg-slate-900 border-slate-800 shadow-2xl">
            <CardHeader>
              <CardTitle className="text-xl font-bold text-white">Edit Campaign</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">Campaign Name</label>
                <input
                  value={selectedCampaign.name}
                  onChange={(e) => setSelectedCampaign({ ...selectedCampaign, name: e.target.value })}
                  className="w-full bg-slate-800 border-slate-700 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
              </div>
              <div className="flex gap-3 justify-end mt-8">
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedCampaign(null);
                  }}
                  className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-xl font-medium transition-all shadow-lg shadow-blue-500/20"
                  onClick={handleSaveEdit}
                >
                  Save Changes
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && campaignToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md bg-slate-900 border-red-500/20 shadow-2xl">
            <CardHeader>
              <CardTitle className="text-xl font-bold text-red-500">Delete Campaign</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4 text-center">
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8 text-red-500" />
              </div>
              <p className="text-slate-300">
                Are you sure you want to delete this campaign? This action cannot be undone.
              </p>
              <div className="flex gap-3 justify-center mt-8">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setCampaignToDelete(null);
                  }}
                  className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  className="bg-red-600 hover:bg-red-500 text-white px-8 py-2 rounded-xl font-medium transition-all shadow-lg shadow-red-500/20"
                  onClick={() => handleDeleteCampaign(campaignToDelete)}
                >
                  Delete Permanently
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
