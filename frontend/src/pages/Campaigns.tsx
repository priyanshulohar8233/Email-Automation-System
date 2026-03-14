import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
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
import { Plus, Search, Filter, MoreHorizontal, Edit, Trash, Play, ChevronRight, Sparkles, Check, BarChart3 } from "lucide-react";
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
};

export default function Campaigns() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [campaignsData, setCampaignsData] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [campaignToDelete, setCampaignToDelete] = useState<string | null>(null);
  const statusMenuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

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
      const params = new URLSearchParams();
      if (searchTerm) params.append("search", searchTerm);
      if (statusFilter && statusFilter !== "all") params.append("status", statusFilter);

      const response = await fetch(`/api/campaigns?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setCampaignsData(data);
      }
    } catch (error) {
      console.error("Failed to fetch campaigns:", error);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchCampaigns();
    
    // Poll for real-time campaign progress every 10 seconds
    const interval = setInterval(() => {
      const params = new URLSearchParams();
      if (searchTerm) params.append("search", searchTerm);
      if (statusFilter && statusFilter !== "all") params.append("status", statusFilter);

      fetch(`/api/campaigns?${params.toString()}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => { if (data) setCampaignsData(data); })
        .catch(console.error);
    }, 10000);
    
    return () => clearInterval(interval);
  }, [searchTerm, statusFilter]);

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
          className="gap-2 h-9 px-4 text-xs font-semibold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 transition-all shadow-lg shadow-indigo-500/20 text-white border-transparent"
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
                  <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${showStatusMenu ? 'rotate-90' : 'rotate-0'}`} />
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead>Delivered</TableHead>
                <TableHead>Failed</TableHead>
                <TableHead>Opens</TableHead>
                <TableHead>Scheduled</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCampaigns.map((campaign: any) => (
                <TableRow key={campaign.id}>
                  <TableCell className="font-medium">{campaign.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {campaign.status.toLowerCase() === 'running' && (
                        <div className="flex h-2 w-2 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </div>
                      )}
                      <Badge 
                        className="rounded-lg font-bold uppercase tracking-tight text-[10px]"
                        variant={statusStyles[campaign.status.toLowerCase() as keyof typeof statusStyles] as any}
                      >
                        {campaign.status}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>{campaign.sent}</TableCell>
                  <TableCell className="text-emerald-600 font-bold">{campaign.delivered}</TableCell>
                  <TableCell className="text-red-500 font-bold">{campaign.failed}</TableCell>
                  <TableCell>{campaign.opens}</TableCell>
                  <TableCell>{campaign.scheduled}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="View Analytics"
                        className="h-8 w-8 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                        onClick={() => navigate(`/analytics?campaign=${encodeURIComponent(campaign.name)}`)}
                      >
                        <BarChart3 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title={campaign.status.toLowerCase() === 'running' ? 'Pause Campaign' : 'Start Campaign'}
                        className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                        onClick={() => handleToggleCampaign(campaign.id)}
                      >
                        <Play className={`h-4 w-4 ${campaign.status.toLowerCase() === 'running' ? 'fill-emerald-600' : ''}`} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Edit Details"
                        className="h-8 w-8 text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                        onClick={() => handleEditCampaign(campaign)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Delete"
                        className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                        onClick={() => {
                          setCampaignToDelete(campaign.id);
                          setShowDeleteConfirm(true);
                        }}
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Campaign Modal */}
      {
        showEditModal && selectedCampaign && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle>Edit Campaign</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-xs font-semibold">Campaign Name</label>
                  <Input
                    value={selectedCampaign.name}
                    onChange={(e) => setSelectedCampaign({ ...selectedCampaign, name: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div className="flex gap-2 justify-end mt-6">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowEditModal(false);
                      setSelectedCampaign(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="bg-indigo-600 hover:bg-indigo-700"
                    onClick={handleSaveEdit}
                  >
                    Save Changes
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )
      }

      {/* Delete Confirmation Dialog */}
      {
        showDeleteConfirm && campaignToDelete && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle>Delete Campaign</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Are you sure you want to delete this campaign? This action cannot be undone.
                </p>
                <div className="flex gap-2 justify-end mt-6">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setCampaignToDelete(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="bg-red-600 hover:bg-red-700"
                    onClick={() => handleDeleteCampaign(campaignToDelete)}
                  >
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )
      }
    </div >
  );
}
