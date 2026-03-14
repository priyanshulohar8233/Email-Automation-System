import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  ArrowLeft, Mail, Globe, MapPin, Calendar, 
  Tag as TagIcon, Plus, X, ExternalLink, 
  TrendingUp, MousePointerClick, Eye, ShieldAlert, CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ActivityTimeline } from "@/components/dashboard/ActivityTimeline";

export default function SubscriberProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [newTag, setNewTag] = useState("");

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch(`/api/contacts/${id}/profile`);
        if (res.ok) {
          const data = await res.json();
          setProfile(data);
        }
      } catch (err) {
        console.error("Failed to fetch profile:", err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchProfile();
  }, [id]);

  const handleAddTag = async () => {
    if (!newTag.trim() || !profile) return;
    const updatedTags = [...profile.tags, newTag.trim()];
    try {
        const res = await fetch(`/api/contacts/${id}/tags`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updatedTags)
        });
        if (res.ok) {
            setProfile({ ...profile, tags: updatedTags });
            setNewTag("");
        }
    } catch (err) {
        console.error("Failed to add tag:", err);
    }
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    if (!profile) return;
    const updatedTags = profile.tags.filter((t: string) => t !== tagToRemove);
    try {
        const res = await fetch(`/api/contacts/${id}/tags`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updatedTags)
        });
        if (res.ok) {
            setProfile({ ...profile, tags: updatedTags });
        }
    } catch (err) {
        console.error("Failed to remove tag:", err);
    }
  };

  if (isLoading) return <div className="p-8 text-center">Loading profile...</div>;
  if (!profile) return <div className="p-8 text-center">Subscriber not found.</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{profile.name}</h1>
          <p className="text-muted-foreground">{profile.email}</p>
        </div>
        <div className="ml-auto flex gap-2">
            {profile.status === 'suppressed' ? (
                <Badge className="bg-red-500/10 text-red-600 border-red-500/10 h-6 px-3 uppercase tracking-wider font-bold flex items-center gap-1.5">
                    <ShieldAlert className="h-3 w-3" /> Suppressed
                </Badge>
            ) : (
                <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/10 h-6 px-3 uppercase tracking-wider font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="h-3 w-3" /> Active
                </Badge>
            )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Main Activity */}
        <div className="lg:col-span-2 space-y-8">
            <Card className="border-border bg-card shadow-sm overflow-hidden">
                <CardHeader className="border-b border-border/50 pb-4">
                    <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" /> Engagement Overview
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="grid grid-cols-3 divide-x divide-border">
                        <div className="p-8 text-center">
                            <p className="text-3xl font-extrabold text-foreground mb-1">{profile.score}</p>
                            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Health Score</p>
                        </div>
                        <div className="p-8 text-center">
                            <p className="text-3xl font-extrabold text-foreground mb-1">{profile.total_opens}</p>
                            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Total Opens</p>
                        </div>
                        <div className="p-8 text-center">
                            <p className="text-3xl font-extrabold text-foreground mb-1">{profile.total_clicks}</p>
                            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Total Clicks</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="space-y-6">
                <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Calendar className="h-4 w-4" /> Activity Timeline
                </h3>
                <ActivityTimeline events={profile.activity || []} />
            </div>
        </div>

        {/* Right Column - Profile Details */}
        <div className="space-y-8">
            <Card className="border-border bg-card shadow-sm">
                <CardHeader>
                    <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Deliverability Integrity</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className={`p-3 rounded-xl border ${profile.status === 'suppressed' ? 'bg-red-500/5 border-red-500/10' : 'bg-emerald-500/5 border-emerald-500/10'}`}>
                        <div className="flex items-center gap-2 mb-1">
                            {profile.status === 'suppressed' ? <ShieldAlert className="h-3.5 w-3.5 text-red-500" /> : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                            <span className={`text-[10px] font-bold uppercase ${profile.status === 'suppressed' ? 'text-red-600' : 'text-emerald-600'}`}>
                                {profile.status === 'suppressed' ? 'High Risk / Suppressed' : 'Safe for sending'}
                            </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground leading-tight">
                            {profile.status === 'suppressed' 
                                ? "This contact has been blacklisted due to a hard bounce or spam report. Sending is currently blocked." 
                                : "This contact is verified and currently in good standing. All communications permitted."}
                        </p>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <Globe className="h-4 w-4 text-muted-foreground/60" />
                        <div>
                            <p className="text-[10px] uppercase font-bold text-muted-foreground">Company</p>
                            <p className="text-sm font-medium">{profile.company || '-'}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <MapPin className="h-4 w-4 text-muted-foreground/60" />
                        <div>
                            <p className="text-[10px] uppercase font-bold text-muted-foreground">Last Known Location</p>
                            <p className="text-sm font-medium">{profile.activity?.[0]?.metadata?.location || 'Unknown'}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Calendar className="h-4 w-4 text-muted-foreground/60" />
                        <div>
                            <p className="text-[10px] uppercase font-bold text-muted-foreground">Member Since</p>
                            <p className="text-sm font-medium">{new Date(profile.created_at).toLocaleDateString()}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-border bg-card shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <TagIcon className="h-3.5 w-3.5" /> Tags
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-1.5">
                        {profile.tags.map((tag: string) => (
                            <Badge key={tag} variant="secondary" className="group rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase transition-all hover:bg-muted-foreground/10" {...{ "data-tag": tag } as any}>
                                {tag}
                                <button onClick={() => handleRemoveTag(tag)} className="ml-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <X className="h-2 w-2" />
                                </button>
                            </Badge>
                        ))}
                    </div>
                    <div className="flex gap-2">
                        <Input 
                            placeholder="Add tag..." 
                            value={newTag}
                            onChange={e => setNewTag(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAddTag()}
                            className="h-8 text-xs rounded-xl"
                        />
                        <Button onClick={handleAddTag} size="icon" className="h-8 w-8 rounded-xl shrink-0">
                            <Plus className="h-4 w-4" />
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}
