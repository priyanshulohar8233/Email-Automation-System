import { useState, useEffect, ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Server, Key, Webhook, Gauge, Save, ShieldCheck, Info, ExternalLink, ChevronRight, Check } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";

interface SettingsState {
  smtpHost: string;
  smtpPort: number;
  smtpUsername: string;
  smtpPassword: string;
  webhookUrl: string;
  monthlyLimit: number;
  monthlySent: number;
  baseUrl: string;
  sendgridApiKey: string;
}

export default function Settings() {
  const [settings, setSettings] = useState<SettingsState>({
    smtpHost: "",
    smtpPort: 587,
    smtpUsername: "",
    smtpPassword: "",
    webhookUrl: "",
    monthlyLimit: 500000,
    monthlySent: 0,
    baseUrl: "",
    sendgridApiKey: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const response = await fetch("/api/settings");
        if (response.ok) {
          const data = await response.json();
          setSettings({
            smtpHost: data.smtp_host || "",
            smtpPort: data.smtp_port || 587,
            smtpUsername: data.smtp_username || "",
            smtpPassword: data.smtp_password || "",
            webhookUrl: data.webhook_url || "",
            monthlyLimit: data.monthly_limit ?? 500000,
            monthlySent: data.monthly_sent ?? 0,
            baseUrl: data.base_url || "",
            sendgridApiKey: data.sendgrid_api_key || "",
          });
        }
      } catch (error) {
        console.error("Failed to fetch settings:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          smtp_host: settings.smtpHost,
          smtp_port: settings.smtpPort,
          smtp_username: settings.smtpUsername,
          smtp_password: settings.smtpPassword,
          webhook_url: settings.webhookUrl,
          monthly_limit: settings.monthlyLimit,
          base_url: settings.baseUrl,
          sendgrid_api_key: settings.sendgridApiKey,
        }),
      });
      if (!response.ok) throw new Error("Failed to save settings");
      const updated = await response.json();
      setSettings(prev => ({
        ...prev,
        monthlySent: updated.monthly_sent ?? prev.monthlySent,
        monthlyLimit: updated.monthly_limit ?? prev.monthlyLimit,
      }));
      setSaveMessage({ type: "success", text: "Settings saved successfully!" });
    } catch (error) {
      console.error(error);
      setSaveMessage({ type: "error", text: "Error saving settings. Please try again." });
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveMessage(null), 4000);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSettings((prev) => ({
      ...prev,
      [name]: name === "smtpPort" || name === "monthlyLimit" ? Number(value) : value,
    }));
  };

  const usedPercent = settings.monthlyLimit > 0
    ? Math.min((settings.monthlySent / settings.monthlyLimit) * 100, 100)
    : 0;

  const barColor = usedPercent >= 90 ? "bg-red-500" : usedPercent >= 70 ? "bg-amber-500" : "bg-indigo-600";

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <PageHeader
        title="Settings"
        subtitle="Manage your account settings and preferences."
      />

      {saveMessage && (
        <div className={`px-4 py-3 rounded-md text-sm font-medium ${saveMessage.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {saveMessage.text}
        </div>
      )}

      <div className="space-y-6">
        {/* SMTP Configuration */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Server className="h-5 w-5 text-indigo-600" />
              <CardTitle>SMTP Configuration</CardTitle>
            </div>
            <CardDescription>Configure your outgoing mail server settings.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <p className="text-sm text-slate-500">Loading settings...</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Host</label>
                    <Input name="smtpHost" value={settings.smtpHost} onChange={handleChange} placeholder="smtp.example.com" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Port</label>
                    <Input name="smtpPort" type="number" value={settings.smtpPort} onChange={handleChange} placeholder="587" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Username</label>
                    <Input name="smtpUsername" value={settings.smtpUsername} onChange={handleChange} placeholder="user@example.com" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Password</label>
                    <Input name="smtpPassword" type="password" value={settings.smtpPassword} onChange={handleChange} placeholder="••••••••••••" />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-border">
                  <Button
                    onClick={async () => {
                      try {
                        setSaveMessage({ type: "success", text: "Testing connection..." });
                        const res = await fetch("/api/settings/test-smtp", { method: "POST" });
                        if (!res.ok) {
                          const err = await res.json().catch(() => ({ detail: "Unknown error" }));
                          throw new Error(err.detail || "Connection failed");
                        }
                        setSaveMessage({ type: "success", text: "Test email sent successfully! Please check your inbox." });
                      } catch (e: any) {
                        setSaveMessage({ type: "error", text: `Connection failed: ${e.message}` });
                      } finally {
                        setTimeout(() => setSaveMessage(null), 5000);
                      }
                    }}
                    variant="outline"
                    style={{ borderRadius: "14px" }}
                    className="h-9 px-4 text-xs font-semibold gap-2 border-indigo-500/20 text-indigo-600 hover:bg-indigo-50"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Test Connection
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={isSaving}
                    style={{ borderRadius: "14px" }}
                    className="h-9 px-4 text-xs font-semibold gap-2 bg-indigo-600 hover:bg-indigo-700 transition-all shadow-md text-white border-transparent"
                  >
                    <Save className="h-3.5 w-3.5" />
                    {isSaving ? "Saving..." : "Save Settings"}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* API Keys */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="h-5 w-5 text-indigo-600" />
                <CardTitle>API Configuration</CardTitle>
              </div>
              <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">REST API Mode</Badge>
            </div>
            <CardDescription>Configure your SendGrid API key for high-performance delivery.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">SendGrid API Key</label>
              <div className="flex gap-2">
                <Input
                  name="sendgridApiKey"
                  type="password"
                  value={settings.sendgridApiKey}
                  onChange={handleChange}
                  placeholder="SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  style={{ borderRadius: "14px" }}
                  className="h-10 border-border bg-card text-xs font-semibold focus:ring-indigo-500"
                />
              </div>
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Info className="h-3 w-3" />
                When provided, SendGrid API is used instead of SMTP.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                onClick={handleSave}
                disabled={isSaving}
                style={{ borderRadius: "14px" }}
                className="h-10 px-6 text-xs font-bold gap-2 bg-indigo-600 hover:bg-indigo-700 transition-all shadow-md text-white"
              >
                <Save className="h-3.5 w-3.5" />
                {isSaving ? "Saving..." : "Save API Settings"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tracking & Domain Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ExternalLink className="h-5 w-5 text-indigo-600" />
              <CardTitle>Tracking & Domain Settings</CardTitle>
            </div>
            <CardDescription>Configure the domain used for email tracking and pixels.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-foreground">Base Tracking URL</label>
                <Badge variant="outline" className="text-[10px] bg-indigo-50 text-indigo-700 border-indigo-200">Required for Tracking</Badge>
              </div>
              <div className="space-y-1">
                <Input
                  name="baseUrl"
                  value={settings.baseUrl}
                  onChange={handleChange}
                  placeholder="https://your-domain.vercel.app"
                  style={{ borderRadius: "14px" }}
                  className="h-10 border-border bg-card text-xs font-semibold focus:ring-indigo-500"
                />
                <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
                  <Info className="h-3 w-3" />
                  Ensure this is your live Vercel URL (with https://) for open/click tracking to work.
                </p>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <label className="text-sm font-medium text-foreground">Webhook Endpoint</label>
              <div className="flex gap-2">
                <Input
                  name="webhookUrl"
                  value={settings.webhookUrl}
                  onChange={handleChange}
                  placeholder="https://your-api.com/webhooks"
                  style={{ borderRadius: "14px" }}
                  className="h-10 border-border bg-card text-xs font-semibold"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">Receive real-time updates for email events externally.</p>
            </div>
            
            <div className="flex justify-end pt-2">
              <Button
                onClick={handleSave}
                disabled={isSaving}
                style={{ borderRadius: "14px" }}
                className="h-10 px-6 text-xs font-bold gap-2 bg-indigo-600 hover:bg-indigo-700 transition-all shadow-md text-white"
              >
                <Save className="h-3.5 w-3.5" />
                {isSaving ? "Saving..." : "Save Tracking Settings"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Deliverability & Compliance */}
        <Card className="border-indigo-500/20 shadow-lg shadow-indigo-500/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <Check className="h-24 w-24 text-indigo-600" />
          </div>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-indigo-600" />
              <CardTitle>Deliverability & Compliance</CardTitle>
            </div>
            <CardDescription>Ensuring your emails reach the primary inbox and avoid spam folders.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-muted/30 border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Auth Type</span>
                  <Badge variant="success" className="h-5 text-[9px]" {...{ className: "h-5 text-[9px]" } as any}>Verified</Badge>
                </div>
                <h4 className="font-bold text-sm text-foreground">SPF Record</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">Identifies the mail servers allowed to send email on behalf of your domain.</p>
                <div className="p-2 bg-card rounded-lg border border-border font-mono text-[9px] text-indigo-600 dark:text-indigo-400 break-all select-all">
                  v=spf1 include:{settings.smtpHost || 'mailflow.com'} ~all
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-muted/30 border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Integrity</span>
                  <Badge variant="success" className="h-5 text-[9px]" {...{ className: "h-5 text-[9px]" } as any}>Active</Badge>
                </div>
                <h4 className="font-bold text-sm text-foreground">DKIM Keys</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">Adds a cryptographic signature to your emails, proving they haven't been altered.</p>
                <div className="flex items-center gap-2 text-indigo-600 font-bold text-[10px] cursor-pointer hover:underline uppercase tracking-wider group">
                  View Public Key <ChevronRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-muted/30 border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Policy</span>
                  <Badge variant="warning" className="h-5 text-[9px]" {...{ className: "h-5 text-[9px]" } as any}>Setup Required</Badge>
                </div>
                <h4 className="font-bold text-sm text-foreground">DMARC</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">Tells receiving servers what to do if an email fails SPF or DKIM checks.</p>
                <div className="p-2 bg-card rounded-lg border border-border font-mono text-[9px] text-amber-600 dark:text-amber-400 break-all select-all">
                  v=DMARC1; p=quarantine; adkim=r; aspf=r
                </div>
              </div>
            </div>


          </CardContent>
        </Card>
      </div>
    </div>
  );
}
