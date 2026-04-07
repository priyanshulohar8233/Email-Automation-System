import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { X, Sparkles, MessageSquare, Plus, Check } from "lucide-react";
import { toUTC } from "@/lib/timeUtils";

interface CreateCampaignModalProps {
    onClose: () => void;
    onSuccess: () => void;
}

interface DraftTemplateMeta {
    logoUrl: string;
    primaryColor: string;
    secondaryColor: string;
    signatureHtml: string;
    templateName: string;
}

const escapeHtml = (value: string) =>
    value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

const stripHtmlToText = (value: string) =>
    value
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n\n")
        .replace(/<[^>]+>/g, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

const formatBodyTextToHtml = (rawText: string) => {
    const lines = rawText.split(/\r?\n/).map((line) => line.trim());
    const paragraphs: string[] = [];
    let current: string[] = [];

    lines.forEach((line) => {
        if (line) {
            current.push(line);
        } else if (current.length) {
            paragraphs.push(current.join(" "));
            current = [];
        }
    });

    if (current.length) {
        paragraphs.push(current.join(" "));
    }

    return paragraphs
        .map(
            (paragraph) =>
                `<p style="margin:0 0 14px 0; font-size:15px; line-height:1.82; color:#334155;">${escapeHtml(paragraph)}</p>`
        )
        .join("");
};

const normalizeCampaignBody = (rawText: string) =>
    rawText
        .split(/\r?\n/)
        .filter((line) => {
            const trimmed = line.trim();
            if (!trimmed) return true;
            return !/^(dear\b|best regards\b|regards\b|cheers\b|\[?your name\]?|email:|phone:|p\.?s\.)/i.test(trimmed);
        })
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

export function CreateCampaignModal({ onClose, onSuccess }: CreateCampaignModalProps) {
    const [name, setName] = useState("");
    const [company, setCompany] = useState(() => localStorage.getItem("last_used_company") || "MP Consultant LLC");
    const [subject, setSubject] = useState("");
    const [body, setBody] = useState("");
    const [draftTemplateMeta, setDraftTemplateMeta] = useState<DraftTemplateMeta | null>(null);
    const [draftBodyBaseline, setDraftBodyBaseline] = useState("");
    const [draftImageSource, setDraftImageSource] = useState("");
    const [draftImagePlacement, setDraftImagePlacement] = useState<"top" | "bottom">("bottom");
    const [draftImageWidth, setDraftImageWidth] = useState(70);
    const [draftImageHeight, setDraftImageHeight] = useState(280);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fileName, setFileName] = useState<string>("");
    const [hasAIDraft, setHasAIDraft] = useState(false);
    const [isScheduled, setIsScheduled] = useState(false);
    const [scheduledAt, setScheduledAt] = useState("");
    const [attachments, setAttachments] = useState<string[]>([]);

    const [recipients, setRecipients] = useState<string[]>([]);

    const COMPANIES = [
        "A Making Company",
        "MP Consultant LLC",
        "MP Lumina",
        "Matkotech"
    ];

    const buildBrandedDraftHtml = (bodyText: string) => {
        if (!draftTemplateMeta) return bodyText.trim();

        const safeBodyHtml = formatBodyTextToHtml(normalizeCampaignBody(bodyText));
        const imageHtml = draftImageSource
            ? `<div style="margin:18px 0 6px 0;"><img src="${draftImageSource}" alt="Email visual" style="display:block;margin:0 auto;width:${draftImageWidth}%;max-width:${draftImageWidth}%;height:${draftImageHeight}px;object-fit:cover;border-radius:12px;border:1px solid #e2e8f0;box-shadow:0 8px 20px rgba(15, 23, 42, 0.08);" /></div>`
            : "";
        const contentHtml = draftImagePlacement === "top" ? `${imageHtml}${safeBodyHtml}` : `${safeBodyHtml}${imageHtml}`;

        return `
      <div style="max-width:680px;margin:0 auto;font-family:'Segoe UI',Arial,sans-serif;color:#334155;line-height:1.7;background:#ffffff;padding:28px 32px;border-radius:12px;border:1px solid #e2e8f0;">
        <div style="display:flex;align-items:center;gap:12px;padding-bottom:16px;border-bottom:1px solid #e2e8f0;margin-bottom:22px;">
          <img src="${draftTemplateMeta.logoUrl}" width="42" height="42" alt="${escapeHtml(draftTemplateMeta.templateName)}" />
          <div>
            <div style="font-size:11px;color:#64748b;letter-spacing:0.08em;text-transform:uppercase;">MailFlow Standard Layout</div>
            <div style="font-size:16px;font-weight:700;color:#0f172a;">${escapeHtml(draftTemplateMeta.templateName)}</div>
          </div>
        </div>
        <p style="margin:0 0 18px 0;font-size:15px;line-height:1.8;color:#0f172a;font-weight:600;">Dear [Recipient Name],</p>
        <div style="font-size:15px;min-height:120px;">${contentHtml}</div>
        ${draftTemplateMeta.signatureHtml}
        <div style="margin-top:24px;font-size:11px;color:#64748b;text-align:center;border-top:1px solid #e2e8f0;padding-top:14px;">
          Sent via MailFlow AI Engine. To unsubscribe,
          <a href="#" style="color:${draftTemplateMeta.primaryColor};text-decoration:none;font-weight:700;">click here</a>.
        </div>
      </div>
    `.trim();
    };

    useEffect(() => {
        const aiSubject = localStorage.getItem("ai_draft_subject");
        const aiBody = localStorage.getItem("ai_draft_body");
        const aiBodyText = localStorage.getItem("ai_draft_body_text");
        const aiHtml = localStorage.getItem("ai_draft_html");
        const aiRecipients = localStorage.getItem("ai_draft_recipients");
        const aiFileName = localStorage.getItem("ai_draft_filename");
        const aiAttachments = localStorage.getItem("ai_draft_attachments");
        const aiTemplateMeta = localStorage.getItem("ai_draft_template_meta");
        const aiImageSource = localStorage.getItem("ai_draft_image_source");
        const aiImagePlacement = localStorage.getItem("ai_draft_image_placement");
        const aiImageWidth = localStorage.getItem("ai_draft_image_width");
        const aiImageHeight = localStorage.getItem("ai_draft_image_height");

        if (aiSubject || aiBody || aiBodyText || aiHtml) {
            const initialBody = normalizeCampaignBody(aiBodyText || (aiBody ? stripHtmlToText(aiBody) : ""));
            setSubject(aiSubject || "");
            setBody(initialBody);
            setHasAIDraft(true);
            setDraftBodyBaseline(initialBody);
            if (aiFileName) setFileName(aiFileName);

            if (aiTemplateMeta) {
                try {
                    const parsedMeta = JSON.parse(aiTemplateMeta);
                    setDraftTemplateMeta(parsedMeta);
                } catch (e) {
                    console.error("Failed to parse AI template meta", e);
                }
            }
            if (aiImageSource) setDraftImageSource(aiImageSource);
            if (aiImagePlacement === "top" || aiImagePlacement === "bottom") setDraftImagePlacement(aiImagePlacement);
            if (aiImageWidth) setDraftImageWidth(Number(aiImageWidth) || 70);
            if (aiImageHeight) setDraftImageHeight(Number(aiImageHeight) || 280);

            if (aiRecipients) {
                try {
                    const parsed = JSON.parse(aiRecipients);
                    const emails = parsed.map((r: any) => r.email).filter(Boolean);
                    setRecipients(emails);
                } catch (e) {
                    console.error("Failed to parse AI recipients", e);
                }
            }

            if (aiAttachments) {
                try {
                    const parsed = JSON.parse(aiAttachments);
                    if (Array.isArray(parsed)) {
                        setAttachments(parsed.filter((item) => typeof item === "string"));
                    }
                } catch (e) {
                    console.error("Failed to parse AI attachments", e);
                }
            }
        }
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        setIsSubmitting(true);
        setError(null);

        try {
            if (isScheduled && !scheduledAt) {
                throw new Error("Please choose a schedule date and time.");
            }

            const finalBody = normalizeCampaignBody(body);
            const bodyForSend =
                draftTemplateMeta && finalBody
                    ? buildBrandedDraftHtml(finalBody)
                    : finalBody;

            // 1. Create the campaign
            const createResponse = await fetch("/api/campaigns", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: name.trim(),
                    company: company,
                    subject: subject.trim(),
                    body: finalBody
                }),
            });

            if (!createResponse.ok) {
                const errorData = await createResponse.json().catch(() => ({}));
                throw new Error(errorData.detail || "Failed to create campaign");
            }

            const campaignData = await createResponse.json();

            // 2. If launching now (or scheduled), queue the emails
            let finalRecipients = recipients;
            if (finalRecipients.length === 0) {
                const contactsRes = await fetch("/api/contacts");
                const contacts = await contactsRes.json();
                finalRecipients = contacts.map((c: any) => c.email);
            }

            if (finalRecipients.length > 0) {
                const sendRes = await fetch("/api/send-campaign", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        campaign_id: parseInt(campaignData.id),
                        company: company,
                        subject: subject.trim(),
                        body: bodyForSend,
                        recipients: finalRecipients,
                        scheduled_at: isScheduled && scheduledAt ? toUTC(scheduledAt) : null,
                        attachments: attachments
                    }),
                });
                if (!sendRes.ok) {
                    const errorDetails = await sendRes.json().catch(() => ({}));
                    throw new Error(errorDetails.detail || "Failed to send campaign");
                }
            } else {
                setError("No recipients found for this campaign.");
                setIsSubmitting(false);
                return;
            }

            // Success! Clear drafts
            localStorage.setItem("last_used_company", company);
            localStorage.removeItem("ai_draft_subject");
            localStorage.removeItem("ai_draft_body");
            localStorage.removeItem("ai_draft_body_text");
            localStorage.removeItem("ai_draft_html");
            localStorage.removeItem("ai_draft_recipients");
            localStorage.removeItem("ai_draft_attachments");
            localStorage.removeItem("ai_draft_template_meta");
            localStorage.removeItem("ai_draft_image_source");
            localStorage.removeItem("ai_draft_image_placement");
            localStorage.removeItem("ai_draft_image_width");
            localStorage.removeItem("ai_draft_image_height");
            onSuccess();
        } catch (err: any) {
            setError(err.message || "An error occurred. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
            <Card className="w-full max-w-2xl relative animate-in fade-in zoom-in duration-300 shadow-2xl overflow-hidden border-border bg-card">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600" />

                <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-4 top-4 hover:bg-muted rounded-full"
                    onClick={onClose}
                >
                    <X className="h-4 w-4" />
                </Button>

                <CardHeader className="pb-4">
                    <div className="flex items-center gap-3 mb-1">
                        {hasAIDraft ? (
                            <Sparkles className="h-5 w-5 text-indigo-600 animate-pulse" />
                        ) : (
                            <MessageSquare className="h-5 w-5 text-indigo-600" />
                        )}
                        <CardTitle className="text-xl font-bold text-foreground">Launch New Campaign</CardTitle>
                        {recipients.length > 0 && (
                            <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 border-indigo-100 flex items-center gap-1.5 py-1">
                                <Plus className="h-3 w-3" />
                                {recipients.length} AI Recipients {fileName ? `(${fileName})` : ''}
                            </Badge>
                        )}
                    </div>
                    <Badge variant="success" className="h-5 text-[9px]">Verified</Badge>
                    <CardDescription className="text-muted-foreground">
                        {hasAIDraft
                            ? "AI content is ready. Review your compliance settings and launch."
                            : "Define your message and schedule your outreach."}
                    </CardDescription>
                </CardHeader>

                <CardContent className="max-h-[70vh] overflow-y-auto custom-scrollbar">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                             <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Select Company</label>
                             <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                 {COMPANIES.map((c) => (
                                     <button
                                         key={c}
                                         type="button"
                                         onClick={() => setCompany(c)}
                                         className={`h-10 rounded-xl text-[11px] font-bold transition-all border ${company === c ? 'bg-indigo-600 text-white border-transparent shadow-lg shadow-indigo-500/20' : 'bg-muted/30 text-muted-foreground border-border hover:bg-muted hover:text-foreground'}`}
                                     >
                                         {c}
                                     </button>
                                 ))}
                             </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Campaign Name</label>
                                <Input
                                    placeholder="e.g. Q4 Growth Sequence"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="bg-muted/30 border-border focus:bg-card transition-all text-foreground h-10 rounded-xl"
                                    autoFocus
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Subject Line</label>
                                <Input
                                    placeholder="The first thing they see..."
                                    value={subject}
                                    onChange={(e) => setSubject(e.target.value)}
                                    className="bg-muted/30 border-border focus:bg-card transition-all text-foreground h-10 rounded-xl"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Email Content</label>
                                <span className="text-[10px] uppercase font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded border border-indigo-100 dark:border-indigo-800">
                                    {body.length} / 2000 chars
                                </span>
                            </div>
                            <textarea
                                style={{ borderRadius: "14px" }}
                                className="w-full h-44 bg-muted/30 border border-border p-4 text-[15px] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 focus:bg-card transition-all placeholder:text-muted-foreground/30 resize-none text-foreground leading-relaxed custom-scrollbar"
                                placeholder="Draft your professional message here..."
                                value={body}
                                onChange={(e) => setBody(e.target.value)}
                            />
                        </div>

                        {/* Scheduling Section */}
                        <div className="p-4 bg-muted/20 border border-border rounded-2xl space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                                        <Plus className="h-4 w-4 text-indigo-600" />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold text-foreground">Schedule for Later</h4>
                                        <p className="text-[11px] text-muted-foreground leading-none">Pick a perfect time for higher open rates</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsScheduled(!isScheduled)}
                                    className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none ${isScheduled ? 'bg-indigo-600' : 'bg-muted'}`}
                                >
                                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${isScheduled ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>

                            {isScheduled && (
                                <Input
                                    type="datetime-local"
                                    value={scheduledAt}
                                    onChange={(e) => setScheduledAt(e.target.value)}
                                    className="bg-card border-indigo-500/30 focus:border-indigo-500 transition-all text-foreground h-11 rounded-xl animate-in slide-in-from-top-2 duration-300"
                                />
                            )}
                        </div>

                        {/* Compliance Section */}
                        <div className="flex items-start gap-3 p-4 bg-green-50/50 dark:bg-green-950/10 border border-green-100/50 dark:border-green-900/20 rounded-2xl">
                            <div className="p-1.5 bg-green-500 text-white rounded-full mt-0.5">
                                <Check className="h-3 w-3" />
                            </div>
                            <div className="space-y-1">
                                <h4 className="text-[11px] font-bold text-green-700 dark:text-green-500 uppercase tracking-widest">Compliance Guaranteed</h4>
                                <p className="text-[11px] text-green-700/70 dark:text-green-500/60 leading-normal">
                                    Our system automatically appends a 1-click **Unsubscribe link** and handles List-Unsubscribe headers compliant with **Google & Yahoo 2024 Sender Policies**.
                                </p>
                            </div>
                        </div>

                        {error && (
                            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-xs text-destructive font-semibold flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
                                {error}
                            </div>
                        )}

                        <div className="flex justify-end gap-3 pt-4 border-t border-border mt-2">
                            <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting} className="rounded-xl h-11 px-6 font-semibold">
                                Save as Draft
                            </Button>
                            <Button
                                type="submit"
                                className="bg-indigo-600 hover:bg-indigo-700 h-11 px-10 rounded-xl font-bold transition-all shadow-lg shadow-indigo-500/20 active:scale-95 text-white"
                                disabled={!name.trim() || isSubmitting}
                            >
                                {isSubmitting ? "Processing..." : isScheduled ? "Schedule Campaign" : "Launch Now"}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
