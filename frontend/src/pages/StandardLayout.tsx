import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { 
  Sparkles, Check, Send, Copy, RefreshCw, Wand2, Type, Mail, 
  ChevronRight, Download, Users, Link, Paperclip, 
  Image as ImageIcon, Upload, Trash2, Calendar, Clock, 
  Plus, FileText, AlertCircle, CheckCircle2, Layout, 
  Smartphone, Monitor, Globe, Building2, Factory, Rocket,
  Eye, TestTube2
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { toUTC } from "@/lib/timeUtils";

interface Template {
  id: string;
  name: string;
  company: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  accent: string;
  preview: string;
  logoSrc?: string;
  cardClassName?: string;
  heroClassName?: string;
  badgeClassName?: string;
}

interface GeneratedTemplateMeta {
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  signatureHtml: string;
  templateName: string;
}

const createPremiumMonogramLogo = ({
  monogram,
  innerFrom,
  innerTo,
  ringFrom,
  ringTo,
  textFrom,
  textTo,
  accent,
}: {
  monogram: string;
  innerFrom: string;
  innerTo: string;
  ringFrom: string;
  ringTo: string;
  textFrom: string;
  textTo: string;
  accent: string;
}) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg width="104" height="104" viewBox="0 0 104 104" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="shell" x1="22" y1="20" x2="82" y2="86" gradientUnits="userSpaceOnUse">
          <stop stop-color="${innerFrom}" />
          <stop offset="1" stop-color="${innerTo}" />
        </linearGradient>
        <linearGradient id="ring" x1="18" y1="16" x2="86" y2="88" gradientUnits="userSpaceOnUse">
          <stop stop-color="${ringFrom}" />
          <stop offset="0.55" stop-color="${ringTo}" />
          <stop offset="1" stop-color="${accent}" />
        </linearGradient>
        <linearGradient id="letter" x1="34" y1="30" x2="74" y2="74" gradientUnits="userSpaceOnUse">
          <stop stop-color="${textFrom}" />
          <stop offset="1" stop-color="${textTo}" />
        </linearGradient>
        <radialGradient id="coreGlow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(52 44) rotate(90) scale(30)">
          <stop stop-color="${ringFrom}" stop-opacity="0.34" />
          <stop offset="1" stop-color="${ringTo}" stop-opacity="0" />
        </radialGradient>
      </defs>

      <rect x="10" y="10" width="84" height="84" rx="24" fill="url(#coreGlow)" opacity="0.5" />
      <circle cx="52" cy="52" r="34" fill="url(#shell)" />
      <circle cx="52" cy="52" r="31" stroke="url(#ring)" stroke-width="2.8" opacity="0.96" />
      <circle cx="52" cy="52" r="24.5" stroke="url(#ring)" stroke-width="1.15" opacity="0.24" />
      <circle cx="52" cy="52" r="19.5" stroke="${ringFrom}" stroke-width="0.7" opacity="0.24" />

      <path d="M28 28H43" stroke="${ringFrom}" stroke-width="1.7" stroke-linecap="round" opacity="0.5" />
      <path d="M76 32L81 27" stroke="${ringFrom}" stroke-width="1.7" stroke-linecap="round" opacity="0.56" />
      <path d="M75 39H82" stroke="${ringFrom}" stroke-width="1.7" stroke-linecap="round" opacity="0.56" />
      <path d="M22 44H28" stroke="${ringFrom}" stroke-width="1.5" stroke-linecap="round" opacity="0.34" />

      <text
        x="52"
        y="61"
        text-anchor="middle"
        fill="url(#letter)"
        font-family="Segoe UI, Arial, sans-serif"
        font-size="${monogram.length > 2 ? 27 : 33}"
        font-weight="800"
        letter-spacing="${monogram.length > 2 ? "0.08em" : "0.03em"}"
      >
        ${monogram}
      </text>
    </svg>
  `)}`;

const LUMINA_PREMIUM_LOGO = createPremiumMonogramLogo({
  monogram: "ML",
  innerFrom: "#251B62",
  innerTo: "#5A49F5",
  ringFrom: "#E9E1FF",
  ringTo: "#A795FF",
  textFrom: "#FFFFFF",
  textTo: "#C8BAFF",
  accent: "#7B61FF",
});

const CONSULTANT_PREMIUM_LOGO = createPremiumMonogramLogo({
  monogram: "MP",
  innerFrom: "#12203D",
  innerTo: "#243A69",
  ringFrom: "#FFF4C7",
  ringTo: "#FFD54F",
  textFrom: "#FFF9E6",
  textTo: "#F6C53B",
  accent: "#C78C00",
});

const MAKING_PREMIUM_LOGO = createPremiumMonogramLogo({
  monogram: "AM",
  innerFrom: "#541D23",
  innerTo: "#C63F4D",
  ringFrom: "#FFE0CF",
  ringTo: "#FF9A72",
  textFrom: "#FFF7F2",
  textTo: "#FFB18D",
  accent: "#FF5E5B",
});

const MATKOTECH_PREMIUM_LOGO = createPremiumMonogramLogo({
  monogram: "MT",
  innerFrom: "#0E3B2A",
  innerTo: "#1F8A54",
  ringFrom: "#D8FFE8",
  ringTo: "#7CE7A9",
  textFrom: "#F4FFF8",
  textTo: "#9AF4BF",
  accent: "#22C55E",
});

const TEMPLATES: Template[] = [
  {
    id: "lumina",
    name: "MP Lumina",
    company: "Lumina Creative",
    description: "Modern, vibrant layout with indigo accents and a minimalist creative signature.",
    icon: null,
    color: "bg-[#7B61FF]",
    accent: "text-[#7B61FF]",
    preview: "Modern | Purple | Creative",
    logoSrc: LUMINA_PREMIUM_LOGO,
    cardClassName: "premium-template-card premium-template-card--lumina",
    heroClassName: "premium-template-hero",
    badgeClassName: "premium-template-badge",
  },
  {
    id: "consultant",
    name: "MP Consultant LLC",
    company: "Sterling Group",
    description: "Professional, executive-grade layout with slate tones and a corporate serif signature.",
    icon: null,
    color: "bg-[#FFC107]",
    accent: "text-[#FFC107]",
    preview: "Professional | Yellow | Executive",
    logoSrc: CONSULTANT_PREMIUM_LOGO,
    cardClassName: "premium-template-card premium-template-card--consultant",
    heroClassName: "premium-template-hero",
    badgeClassName: "premium-template-badge",
  },
  {
    id: "factory",
    name: "A Making Company",
    company: "Industrial Scale",
    description: "Bold, industrial layout with orange accents and a strong, high-contrast signature.",
    icon: null,
    color: "bg-[#FF4D4F]",
    accent: "text-[#FF4D4F]",
    preview: "Industrial | Red | Bold",
    logoSrc: MAKING_PREMIUM_LOGO,
    cardClassName: "premium-template-card premium-template-card--making",
    heroClassName: "premium-template-hero",
    badgeClassName: "premium-template-badge",
  },
  {
    id: "matkotech",
    name: "Matkotech",
    company: "Matkotech Technologies",
    description: "Green performance layout with crisp product signature tailored for modern IT outreach.",
    icon: null,
    color: "bg-[#22C55E]",
    accent: "text-[#22C55E]",
    preview: "Tech | Green | Performance",
    logoSrc: MATKOTECH_PREMIUM_LOGO,
    cardClassName: "premium-template-card premium-template-card--matkotech",
    heroClassName: "premium-template-hero",
    badgeClassName: "premium-template-badge",
  }
];

export default function StandardLayout() {
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [topic, setTopic] = useState("");
  const [seniority, setSeniority] = useState("C-Executive Level");
  const [generating, setGenerating] = useState(false);
  const [generatedHtml, setGeneratedHtml] = useState("");
  const [generatedSubject, setGeneratedSubject] = useState("");
  const [generatedBodyText, setGeneratedBodyText] = useState("");
  const [previewInGmailStyle, setPreviewInGmailStyle] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [templateMeta, setTemplateMeta] = useState<GeneratedTemplateMeta | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [localImage, setLocalImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [imageSizePreset, setImageSizePreset] = useState<"small" | "medium" | "large" | "custom">("medium");
  const [imageWidthPercent, setImageWidthPercent] = useState<number>(70);
  const [imageHeightPx, setImageHeightPx] = useState<number>(280);
  const [attachment, setAttachment] = useState("");
  const [attachmentLinks, setAttachmentLinks] = useState<string[]>([]);
  const [localAttachments, setLocalAttachments] = useState<File[]>([]);
  const [recipients, setRecipients] = useState<Array<{ name?: string; email: string }>>([]);
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [validCount, setValidCount] = useState(0);
  const [invalidCount, setInvalidCount] = useState(0);
  const [showSeniorityMenu, setShowSeniorityMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);
  const [showGenerator, setShowGenerator] = useState(false);

  const seniorityMenuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (seniorityMenuRef.current && !seniorityMenuRef.current.contains(event.target as Node)) {
        setShowSeniorityMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  const downloadSampleSheet = () => {
    const sampleRows = [
      { name: "Priyanshu", email: "priyanshu@example.com", role: "CEO" },
      { name: "Anita", email: "anita@example.com", role: "CTO" },
      { name: "Rohit", email: "rohit@example.com", role: "Manager" },
    ];
    const worksheet = XLSX.utils.json_to_sheet(sampleRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Recipients");
    XLSX.writeFile(workbook, "mailflow_standard_layout_sample.xlsx");
  };

  const handleSheetUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(e.target?.result, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<any>(sheet);

        const keys = rows.length > 0 ? Object.keys(rows[0]) : [];
        const emailKey = keys.find((k) => k.toLowerCase().includes("email"));
        if (!emailKey) {
          alert("Email column not found in sheet.");
          return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        let valid = 0;
        let invalid = 0;

        const parsed = rows
          .map((row) => {
            const email = String(row[emailKey] || "").trim();
            if (!email) return null;
            const isValid = emailRegex.test(email);
            if (isValid) valid += 1;
            else invalid += 1;
            return isValid
              ? {
                  name: row.name || row.Name || email.split("@")[0],
                  email,
                }
              : null;
          })
          .filter(Boolean) as Array<{ name?: string; email: string }>;

        setRecipients(parsed);
        setValidCount(valid);
        setInvalidCount(invalid);
      } catch (error) {
        console.error(error);
        alert("Sheet parse failed. Please use a valid Excel file.");
      }
    };
    reader.readAsBinaryString(file);
  };

  const clearSheetData = () => {
    setRecipients([]);
    setValidCount(0);
    setInvalidCount(0);
    setUploadedFileName("");
    const input = document.getElementById("standard-sheet-upload") as HTMLInputElement | null;
    if (input) input.value = "";
  };

  const handleLocalImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setLocalImage(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const setImagePreset = (preset: "small" | "medium" | "large") => {
    setImageSizePreset(preset);
    if (preset === "small") {
      setImageWidthPercent(45);
      setImageHeightPx(180);
    } else if (preset === "medium") {
      setImageWidthPercent(70);
      setImageHeightPx(280);
    } else {
      setImageWidthPercent(90);
      setImageHeightPx(360);
    }
  };

  const applyImageSizingToHtml = (html: string) => {
    return html.replace(
      /style="([^"]*max-width:\s*600px[^"]*)"/,
      `style="$1 width:${imageWidthPercent}%;max-width:${imageWidthPercent}%;height:${imageHeightPx}px;object-fit:cover;display:block;margin:20px auto;border-radius:12px;"`
    );
  };

  const addAttachmentUrl = () => {
    const value = attachment.trim();
    if (!value) return;
    if (!/^https?:\/\//i.test(value) && !/^data:/i.test(value)) {
      alert("Attachment URL should start with http(s)://");
      return;
    }
    if (attachmentLinks.includes(value)) {
      setAttachment("");
      return;
    }
    setAttachmentLinks((prev) => [...prev, value]);
    setAttachment("");
  };

  const collectAttachmentLinks = () => {
    const value = attachment.trim();
    if (!value) return attachmentLinks;
    if (!/^https?:\/\//i.test(value) && !/^data:/i.test(value)) {
      return attachmentLinks;
    }
    if (attachmentLinks.includes(value)) {
      return attachmentLinks;
    }
    return [...attachmentLinks, value];
  };

  const removeAttachmentUrl = (index: number) => {
    setAttachmentLinks((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAttachmentUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    setLocalAttachments((prev) => [...prev, ...files]);
    event.currentTarget.value = "";
  };

  const removeLocalAttachment = (index: number) => {
    setLocalAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const fileToDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        if (!result.startsWith("data:") || !result.includes(";base64,")) {
          resolve(result);
          return;
        }
        const encodedName = encodeURIComponent(file.name);
        const [header, payload] = result.split(",", 2);
        if (!payload) {
          resolve(result);
          return;
        }
        if (header.includes("name=")) {
          resolve(result);
          return;
        }
        resolve(`${header.replace(";base64", `;name=${encodedName};base64`)},${payload}`);
      };
      reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
      reader.readAsDataURL(file);
    });

  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

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

  const composedHtml = useMemo(() => {
    if (!templateMeta || !generatedBodyText.trim()) {
      return generatedHtml;
    }

    const imageSource = imagePreview || imageUrl;
    const bodyHtml = formatBodyTextToHtml(generatedBodyText);
    const imageHtml = imageSource
      ? `<div style="margin:18px 0 6px 0;"><img src="${imageSource}" alt="Email visual" style="display:block;margin:0 auto;width:${imageWidthPercent}%;max-width:${imageWidthPercent}%;height:${imageHeightPx}px;object-fit:cover;border-radius:12px;border:1px solid #e2e8f0;box-shadow:0 8px 20px rgba(15, 23, 42, 0.08);" /></div>`
      : "";

    return `
      <div style="max-width:680px;margin:0 auto;font-family:'Segoe UI',Arial,sans-serif;color:#334155;line-height:1.7;background:#ffffff;padding:28px 32px;border-radius:12px;border:1px solid #e2e8f0;">
        <div style="display:flex;align-items:center;gap:12px;padding-bottom:16px;border-bottom:1px solid #e2e8f0;margin-bottom:22px;">
          <img src="${templateMeta.logoUrl}" width="42" height="42" alt="${escapeHtml(templateMeta.templateName)}" />
          <div>
            <div style="font-size:11px;color:#64748b;letter-spacing:0.08em;text-transform:uppercase;">MailFlow Standard Layout</div>
            <div style="font-size:16px;font-weight:700;color:#0f172a;">${escapeHtml(templateMeta.templateName)}</div>
          </div>
        </div>
        <p style="margin:0 0 18px 0;font-size:15px;line-height:1.8;color:#0f172a;font-weight:600;">Dear [Recipient Name],</p>
        <div style="font-size:15px;min-height:120px;">${bodyHtml}</div>
        ${imageHtml}
        ${templateMeta.signatureHtml}
        <div style="margin-top:24px;font-size:11px;color:#64748b;text-align:center;border-top:1px solid #e2e8f0;padding-top:14px;">
          Sent via MailFlow AI Engine. To unsubscribe,
          <a href="#" style="color:${templateMeta.primaryColor};text-decoration:none;font-weight:700;">click here</a>.
        </div>
      </div>
    `;
  }, [
    templateMeta,
    generatedBodyText,
    generatedHtml,
    imagePreview,
    imageUrl,
    imageWidthPercent,
    imageHeightPx,
  ]);

  const handleSendTestEmail = async () => {
    if (!composedHtml || !generatedSubject.trim()) return;
    if (!testEmail.trim()) {
      alert("Please enter a test email address.");
      return;
    }

    setIsSendingTest(true);
    try {
      const encodedLocalAttachments = await Promise.all(localAttachments.map(fileToDataUrl));
      const urlAttachments = collectAttachmentLinks();
      const attachmentsPayload = [...urlAttachments, ...encodedLocalAttachments];
      const response = await fetch("/api/templates/test-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: testEmail.trim(),
          subject: generatedSubject.trim(),
          body: composedHtml,
          attachments: attachmentsPayload,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send test email.");
      }

      setSendSuccess(`Test email sent to ${testEmail.trim()}!`);
      setTimeout(() => setSendSuccess(null), 3000);
    } catch (error) {
      console.error(error);
      alert("Failed to send test email.");
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleGenerate = async () => {
    if (!topic || !selectedTemplate) return;
    setGenerating(true);
    try {
      const variationAngles = [
        "relationship-first tone",
        "ROI-driven pitch",
        "problem-solution structure",
        "concise executive memo style",
      ];
      const chosenAngle = variationAngles[Math.floor(Math.random() * variationAngles.length)];
      const dynamicPrompt = `${topic}\n\nCreate a fresh variant using ${chosenAngle}.`;

      const res = await fetch("/api/generate-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template: selectedTemplate.name,
          description: dynamicPrompt,
          seniority: seniority,
          image: imageUrl || imagePreview,
          attachment: collectAttachmentLinks()[0] || null
        })
      });

      if (res.ok) {
        const data = await res.json();
        setGeneratedHtml(data.html || "");
        setGeneratedSubject(data.subject || "");
        setGeneratedBodyText(data.body_text || "");
        setTemplateMeta({
          logoUrl: data.logo_url || "",
          primaryColor: data.primary_color || "#6366f1",
          secondaryColor: data.secondary_color || "#4f46e5",
          signatureHtml: data.signature_html || "",
          templateName: data.template_name || selectedTemplate.name,
        });
      } else {
        throw new Error("Failed to generate email");
      }
    } catch (error) {
      console.error("Generation failed:", error);
      setGeneratedHtml("<div style='padding: 20px; color: #ef4444;'>Failed to generate email. Please check your AI API configuration.</div>");
      setGeneratedBodyText("");
      setTemplateMeta(null);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!composedHtml) return;
    navigator.clipboard.writeText(composedHtml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUseInCampaign = async () => {
    if (!composedHtml) return;
    localStorage.setItem("ai_draft_subject", generatedSubject);
    localStorage.setItem("ai_draft_body", composedHtml);
    if (recipients.length > 0) {
      localStorage.setItem("ai_draft_recipients", JSON.stringify(recipients));
      localStorage.setItem("ai_draft_filename", uploadedFileName || "standard_layout_recipients.xlsx");
    }
    const encodedLocalAttachments = await Promise.all(localAttachments.map(fileToDataUrl));
    const urlAttachments = collectAttachmentLinks();
    const attachmentsPayload = [...urlAttachments, ...encodedLocalAttachments];
    if (attachmentsPayload.length > 0) {
      localStorage.setItem("ai_draft_attachments", JSON.stringify(attachmentsPayload));
    } else {
      localStorage.removeItem("ai_draft_attachments");
    }
    navigate("/campaigns");
  };

  const handleSendNow = async () => {
    if (!composedHtml) return;
    if (recipients.length === 0) {
      alert("Please upload recipient sheet first.");
      return;
    }
    setIsSending(true);
    try {
      const encodedLocalAttachments = await Promise.all(localAttachments.map(fileToDataUrl));
      const urlAttachments = collectAttachmentLinks();
      const attachmentsPayload = [...urlAttachments, ...encodedLocalAttachments];
      const res = await fetch("/api/send-campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaign_id: 1,
          subject: generatedSubject,
          body: composedHtml,
          recipients: recipients.map((r) => r.email),
          scheduled_at: null,
          attachments: attachmentsPayload
        })
      });
      if (res.ok) {
        setSendSuccess("Email sent successfully!");
        setTimeout(() => setSendSuccess(null), 3000);
      }
    } catch (err) {
      alert("Failed to send");
    } finally {
      setIsSending(false);
    }
  };

  const handleScheduleSend = async () => {
    if (!composedHtml) return;
    if (recipients.length === 0) {
      alert("Please upload recipient sheet first.");
      return;
    }

    const scheduledLocal = window.prompt(
      "Enter schedule time (YYYY-MM-DDTHH:MM)",
      new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16)
    );
    if (!scheduledLocal) return;

    setIsSending(true);
    try {
      const encodedLocalAttachments = await Promise.all(localAttachments.map(fileToDataUrl));
      const urlAttachments = collectAttachmentLinks();
      const attachmentsPayload = [...urlAttachments, ...encodedLocalAttachments];
      const res = await fetch("/api/send-campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaign_id: 1,
          subject: generatedSubject,
          body: composedHtml,
          recipients: recipients.map((r) => r.email),
          scheduled_at: toUTC(scheduledLocal),
          attachments: attachmentsPayload,
        }),
      });

      if (!res.ok) throw new Error("Failed to schedule campaign");
      setSendSuccess("Campaign scheduled successfully!");
      setTimeout(() => setSendSuccess(null), 3000);
    } catch (error) {
      console.error(error);
      alert("Failed to schedule campaign.");
    } finally {
      setIsSending(false);
    }
  };

  if (!showGenerator) {
    return (
      <div className="flex flex-col gap-8 pb-10 animate-in fade-in duration-500">
        <PageHeader 
          title="Standard Layout Templates" 
          subtitle="Select a pre-branded company layout to generate professional AI emails instantly."
        />

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
          {TEMPLATES.map((tpl) => (
            <Card 
              key={tpl.id} 
              className={cn(
                "group border-border hover:border-indigo-500 transition-all duration-300 hover:shadow-2xl hover:shadow-indigo-500/10 hover:-translate-y-1 overflow-hidden flex flex-col",
                tpl.cardClassName
              )}
            >
              <div className={cn("h-40 flex flex-col items-center justify-center relative overflow-hidden", tpl.color, tpl.heroClassName)}>
                <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                         {tpl.logoSrc ? (
                           <div className="premium-logo-shell">
                             <span className="premium-logo-glow" aria-hidden="true" />
                             <span className="premium-logo-shine" aria-hidden="true" />
                             <img
                               src={tpl.logoSrc}
                               alt={`${tpl.name} logo`}
                               className="premium-logo-image"
                             />
                           </div>
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white mb-3 shadow-inner">
                    {tpl.icon}
                  </div>
                )}
                <Badge
                  variant="secondary"
                  className={cn(
                    "bg-white/90 text-foreground border-none font-bold text-[10px] uppercase tracking-widest px-3",
                    tpl.badgeClassName
                  )}
                >
                  {tpl.preview}
                </Badge>
              </div>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                   <CardTitle className="text-xl font-bold">{tpl.name}</CardTitle>
                   <Building2 className={cn("h-4 w-4 opacity-40", tpl.accent)} />
                </div>
                <CardDescription className="text-xs font-medium leading-relaxed mt-2 min-h-[40px]">
                  {tpl.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 mt-auto flex flex-col gap-3">
                <Button 
                   variant="outline" 
                   style={{ borderRadius: "14px" }}
                   className="w-full h-11 text-sm font-bold border-border hover:bg-muted"
                   onClick={() => {
                        setSelectedTemplate(tpl);
                        setTopic("");
                        setGeneratedHtml("");
                        setGeneratedBodyText("");
                        setGeneratedSubject("");
                        setTemplateMeta(null);
                        setShowGenerator(true);
                   }}
                >
                  Use Template
                </Button>
                <Button 
                   style={{ borderRadius: "14px" }}
                   className="w-full h-11 text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-lg shadow-indigo-500/20"
                   onClick={() => {
                        setSelectedTemplate(tpl);
                        setTopic("");
                        setGeneratedHtml("");
                        setGeneratedBodyText("");
                        setGeneratedSubject("");
                        setTemplateMeta(null);
                        setShowGenerator(true);
                   }}
                >
                  <Sparkles className="h-4 w-4" />
                  Generate with AI
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 pb-10 animate-in slide-in-from-right duration-500">
      <div className="flex items-center justify-between border-b border-border pb-8 gap-4">
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            size="icon" 
            style={{ borderRadius: "12px" }}
            onClick={() => setShowGenerator(false)}
            className="h-10 w-10 border-border bg-card hover:bg-muted"
          >
            <ChevronRight className="h-5 w-5 rotate-180" />
          </Button>
          <div>
             <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
               <Sparkles className="h-6 w-6 text-indigo-600" />
               AI Generator: {selectedTemplate?.name}
             </h1>
             <p className="text-muted-foreground text-sm font-medium mt-1">Branded AI email creation for {selectedTemplate?.company}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            style={{ borderRadius: "12px" }}
            className="h-10 px-4 text-xs font-bold gap-2 border-border"
            onClick={downloadSampleSheet}
          >
            <Download className="h-4 w-4" />
            Download Sample
          </Button>
          <label>
            <input
              id="standard-sheet-upload"
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleSheetUpload}
            />
            <Button
              asChild
              style={{ borderRadius: "12px" }}
              className="h-10 px-4 text-xs font-bold gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <span>
                <Upload className="h-4 w-4" />
                Upload Excel Sheet
              </span>
            </Button>
          </label>
          <ThemeToggle />
        </div>
      </div>

      <div className="flex min-h-[600px] gap-6">
        {/* Left Panel: Input */}
        <div className="w-[400px] rounded-2xl bg-card border border-border p-8 flex flex-col shadow-sm shrink-0">
           <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
             <Type className="h-5 w-5 text-indigo-500" />
             Email Parameters
           </h2>

           <div className="space-y-6 flex-1">
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70">Topic & Description</label>
                <textarea 
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  style={{ borderRadius: "16px" }}
                  placeholder="e.g. A follow-up email after our product demo, focusing on the new security features..."
                  className="w-full h-40 bg-muted/30 border border-border p-4 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all resize-none text-foreground"
                />
              </div>

              <div className="space-y-3 relative" ref={seniorityMenuRef}>
                 <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70">Target Seniority</label>
                 <div 
                   onClick={() => setShowSeniorityMenu(!showSeniorityMenu)}
                   style={{ borderRadius: "14px" }}
                   className={cn(
                     "w-full bg-muted/30 border border-border px-4 py-3.5 flex items-center gap-3 cursor-pointer transition-all hover:bg-muted/50",
                     showSeniorityMenu && "border-indigo-500 ring-2 ring-indigo-500/10"
                   )}
                 >
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-semibold flex-1">{seniority}</span>
                    <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", showSeniorityMenu && "rotate-90")} />
                 </div>
                 
                 {showSeniorityMenu && (
                   <div style={{ borderRadius: "14px" }} className="absolute left-0 right-0 mt-2 bg-card border border-border shadow-2xl z-50 overflow-hidden py-1 border-t-indigo-500">
                     {["C-Executive Level", "VP Level", "Director", "Manager", "Non-Manager"].map((opt) => (
                       <div 
                         key={opt}
                         onClick={() => { setSeniority(opt); setShowSeniorityMenu(false); }}
                         className={cn(
                            "px-4 py-3 text-xs font-bold cursor-pointer transition-colors flex items-center justify-between",
                            seniority === opt ? "bg-indigo-500/10 text-indigo-600" : "text-muted-foreground hover:bg-muted"
                         )}
                       >
                         {opt}
                         {seniority === opt && <Check className="h-4 w-4" />}
                       </div>
                     ))}
                   </div>
                 )}
              </div>

              <div className="space-y-3">
                 <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70">Include Image (URL or Upload)</label>
                 <div className="relative">
                   <Input
                     value={imageUrl}
                     onChange={(e) => setImageUrl(e.target.value)}
                     style={{ borderRadius: "14px" }}
                     placeholder="https://images.unsplash.com/..."
                     className="bg-muted/30 border-border h-12 text-sm pl-10"
                   />
                   <ImageIcon className="h-4 w-4 absolute left-4 top-4 text-muted-foreground" />
                 </div>
                 <label>
                   <input
                     type="file"
                     accept="image/*"
                     className="hidden"
                     onChange={handleLocalImageUpload}
                   />
                   <Button
                     asChild
                     variant="outline"
                     style={{ borderRadius: "12px" }}
                     className="h-10 w-full text-xs font-bold gap-2 border-border"
                   >
                     <span>
                       <Upload className="h-3.5 w-3.5" />
                       Upload Image
                     </span>
                   </Button>
                 </label>
                 {(imagePreview || imageUrl) && (
                   <div className="p-2 rounded-xl bg-muted/30 border border-border">
                     <img
                       src={imagePreview || imageUrl}
                       alt="Selected media"
                       className="w-full h-28 object-cover rounded-lg"
                     />
                     <div className="mt-2 grid grid-cols-4 gap-2">
                       <Button
                         type="button"
                         variant={imageSizePreset === "small" ? "default" : "outline"}
                         className="h-8 text-[10px] font-bold"
                         onClick={() => setImagePreset("small")}
                       >
                         Small
                       </Button>
                       <Button
                         type="button"
                         variant={imageSizePreset === "medium" ? "default" : "outline"}
                         className="h-8 text-[10px] font-bold"
                         onClick={() => setImagePreset("medium")}
                       >
                         Medium
                       </Button>
                       <Button
                         type="button"
                         variant={imageSizePreset === "large" ? "default" : "outline"}
                         className="h-8 text-[10px] font-bold"
                         onClick={() => setImagePreset("large")}
                       >
                         Large
                       </Button>
                       <Button
                         type="button"
                         variant={imageSizePreset === "custom" ? "default" : "outline"}
                         className="h-8 text-[10px] font-bold"
                         onClick={() => setImageSizePreset("custom")}
                       >
                         Custom
                       </Button>
                     </div>
                     <div className="mt-2 rounded-lg border border-border/60 bg-card/40 p-2 space-y-2">
                       <div className="flex items-center justify-between gap-2">
                         <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Width</span>
                         <span className="text-[10px] font-semibold text-foreground">{imageWidthPercent}%</span>
                       </div>
                       <input
                         type="range"
                         min={30}
                         max={100}
                         value={imageWidthPercent}
                         onChange={(e) => {
                           setImageSizePreset("custom");
                           setImageWidthPercent(Number(e.target.value));
                         }}
                         className="w-full"
                       />
                       <div className="flex items-center justify-between gap-2">
                         <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Height</span>
                         <span className="text-[10px] font-semibold text-foreground">{imageHeightPx}px</span>
                       </div>
                       <input
                         type="range"
                         min={120}
                         max={520}
                         step={10}
                         value={imageHeightPx}
                         onChange={(e) => {
                           setImageSizePreset("custom");
                           setImageHeightPx(Number(e.target.value));
                         }}
                         className="w-full"
                       />
                     </div>
                     <Button
                       type="button"
                       variant="ghost"
                       className="mt-2 h-8 px-2 text-[10px] font-bold text-red-500 hover:text-red-600 hover:bg-red-500/10"
                       onClick={() => {
                         setImageUrl("");
                         setLocalImage(null);
                         if (imagePreview) URL.revokeObjectURL(imagePreview);
                         setImagePreview("");
                         setImagePreset("medium");
                       }}
                     >
                       <Trash2 className="h-3.5 w-3.5 mr-1" />
                       Remove Image
                     </Button>
                   </div>
                 )}
              </div>

              <div className="space-y-3">
                 <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70">Include Attachment</label>
                 <div className="relative">
                   <Input 
                     value={attachment}
                     onChange={(e) => setAttachment(e.target.value)}
                     style={{ borderRadius: "14px" }}
                     placeholder="https://.../Q4_Strategy_Guide.pdf"
                     className="bg-muted/30 border-border h-12 text-sm pl-10"
                   />
                   <Paperclip className="h-4 w-4 absolute left-4 top-4 text-muted-foreground" />
                 </div>
                 <div className="grid grid-cols-2 gap-2">
                   <Button
                     type="button"
                     variant="outline"
                     className="h-10 text-xs font-bold"
                     onClick={addAttachmentUrl}
                   >
                     Add URL
                   </Button>
                   <label>
                     <input
                       type="file"
                       multiple
                       accept=".pdf,.xlsx,.xls,.csv,.doc,.docx,.ppt,.pptx,.txt,.zip,.rar,.png,.jpg,.jpeg"
                       className="hidden"
                       onChange={handleAttachmentUpload}
                     />
                     <Button
                       asChild
                       variant="outline"
                       className="h-10 w-full text-xs font-bold"
                     >
                       <span>Upload File(s)</span>
                     </Button>
                   </label>
                 </div>
                 {(attachmentLinks.length > 0 || localAttachments.length > 0) && (
                   <div className="rounded-xl border border-border bg-muted/20 p-2 space-y-2">
                     {attachmentLinks.map((url, idx) => (
                       <div key={`url-${idx}`} className="flex items-center gap-2 rounded-lg bg-card/70 px-2 py-2">
                         <Paperclip className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                         <span className="text-[11px] font-medium text-foreground truncate flex-1">{url}</span>
                         <button
                           type="button"
                           onClick={() => removeAttachmentUrl(idx)}
                           className="p-1 rounded hover:bg-red-500/10 text-red-500"
                           title="Delete"
                         >
                           <Trash2 className="h-3.5 w-3.5" />
                         </button>
                       </div>
                     ))}
                     {localAttachments.map((file, idx) => (
                       <div key={`file-${idx}`} className="flex items-center gap-2 rounded-lg bg-card/70 px-2 py-2">
                         <FileText className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                         <span className="text-[11px] font-medium text-foreground truncate flex-1">
                           {file.name}
                         </span>
                         <span className="text-[10px] text-muted-foreground shrink-0">
                           {(file.size / 1024).toFixed(1)} KB
                         </span>
                         <button
                           type="button"
                           onClick={() => removeLocalAttachment(idx)}
                           className="p-1 rounded hover:bg-red-500/10 text-red-500"
                           title="Delete"
                         >
                           <Trash2 className="h-3.5 w-3.5" />
                         </button>
                       </div>
                     ))}
                   </div>
                 )}
              </div>

              <div className="space-y-2 rounded-2xl border border-border bg-muted/20 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Recipient Sheet</p>
                  {uploadedFileName ? (
                    <Badge variant="outline" className="text-[10px] border-emerald-500/20 bg-emerald-500/10 text-emerald-600">
                      Ready
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">Pending</Badge>
                  )}
                </div>
                {uploadedFileName ? (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-foreground truncate">{uploadedFileName}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {validCount} valid emails {invalidCount > 0 ? `| ${invalidCount} invalid skipped` : ""}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-8 px-2 text-[10px] font-bold text-red-500 hover:text-red-600 hover:bg-red-500/10"
                      onClick={clearSheetData}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      Clear Sheet
                    </Button>
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    Upload an Excel sheet to enable Send Now and Campaign handoff.
                  </p>
                )}
              </div>
           </div>

           <Button 
             disabled={generating || !topic}
             onClick={handleGenerate}
             style={{ borderRadius: "16px" }}
             className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white text-base font-bold gap-3 mt-8 shadow-xl shadow-indigo-500/20 active:scale-95 transition-all"
           >
             {generating ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
             {generating ? "Generating Masterpiece..." : "Generate Email"}
           </Button>
        </div>

        {/* Right Panel: Output */}
        <div className="flex-1 flex flex-col gap-6">
           <Card className="flex-1 border-border bg-card shadow-sm overflow-hidden flex flex-col">
              <CardHeader className="border-b border-border bg-muted/10 py-5">
                 <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg font-bold">Generated Output</CardTitle>
                      <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1">Branded HTML Preview</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPreviewInGmailStyle((prev) => !prev)}
                        disabled={!composedHtml}
                        style={{ borderRadius: "10px" }}
                        className="h-9 gap-2 text-xs font-bold border-border"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        {previewInGmailStyle ? "Close Preview" : "Preview"}
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleCopy}
                        disabled={!composedHtml}
                        style={{ borderRadius: "10px" }}
                        className="h-9 gap-2 text-xs font-bold border-border"
                      >
                        {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                        {copied ? "Copied" : "Copy"}
                      </Button>
                      <Button 
                        onClick={handleUseInCampaign}
                        disabled={!composedHtml}
                        style={{ borderRadius: "10px" }}
                        className="h-9 gap-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white border-transparent"
                      >
                        Campaign
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                 </div>
              </CardHeader>
              <CardContent className="p-0 flex-1 overflow-y-auto bg-muted/50 scrollbar-hide">
                 {composedHtml ? (
                   <div className="p-6 md:p-8 space-y-6">
                      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,340px)_minmax(0,1fr)] gap-6 items-start">
                        <div className="rounded-2xl border border-border bg-card/90 shadow-sm p-5 space-y-4">
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Subject Line</label>
                            <Input
                              value={generatedSubject}
                              onChange={(e) => setGeneratedSubject(e.target.value)}
                              style={{ borderRadius: "12px" }}
                              placeholder="Subject line"
                              className="bg-muted/30 border-border h-11 text-sm"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Body</label>
                            <textarea
                              value={generatedBodyText}
                              onChange={(e) => setGeneratedBodyText(e.target.value)}
                              style={{ borderRadius: "14px" }}
                              className="w-full min-h-[250px] bg-muted/30 border border-border p-4 text-sm leading-7 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-y text-foreground"
                              placeholder="Generated email body"
                            />
                          </div>
                          <div className="space-y-2 rounded-2xl border border-border bg-muted/20 p-4">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Send Test Email</label>
                            <Input
                              type="email"
                              value={testEmail}
                              onChange={(e) => setTestEmail(e.target.value)}
                              style={{ borderRadius: "12px" }}
                              placeholder="yourname@example.com"
                              className="bg-background border-border h-11 text-sm"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              onClick={handleSendTestEmail}
                              disabled={!composedHtml || isSendingTest}
                              className="w-full h-10 text-xs font-bold gap-2"
                              style={{ borderRadius: "12px" }}
                            >
                              {isSendingTest ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <TestTube2 className="h-3.5 w-3.5" />}
                              {isSendingTest ? "Sending Test..." : "Send Test Email"}
                            </Button>
                          </div>
                        </div>
                        {previewInGmailStyle && (
                          <div className="space-y-3">
                            <div className="rounded-[28px] border border-border bg-[#f6f8fc] p-4 md:p-6 shadow-inner transition-all duration-300">
                              <div className="mb-4 rounded-2xl border border-[#d7dce5] bg-white px-4 py-3 shadow-sm">
                                <div className="flex items-center justify-between gap-3 text-[#5f6368]">
                                  <div>
                                    <p className="text-base font-semibold text-[#202124]">{generatedSubject || "Professional Email Preview"}</p>
                                    <p className="text-xs">to me</p>
                                  </div>
                                  <Badge variant="outline" className="border-[#d7dce5] bg-[#f8f9fa] text-[#5f6368]">
                                    Preview
                                  </Badge>
                                </div>
                              </div>
                              <div className="flex justify-center">
                                <div
                                  className="w-full max-w-[760px] overflow-hidden rounded-none border-0 bg-white shadow-none"
                                  dangerouslySetInnerHTML={{ __html: composedHtml }}
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                   </div>
                 ) : (
                   <div className="h-full flex flex-col items-center justify-center text-center p-12 space-y-4">
                      <div className="w-20 h-20 rounded-3xl bg-muted border border-dashed border-border flex items-center justify-center">
                        <Wand2 className="h-10 w-10 text-muted-foreground/30" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-foreground">Waiting for your creativity</h3>
                        <p className="text-muted-foreground text-sm font-medium mt-1 max-w-[300px]">Describe your email on the left and choose a seniority level to generate content.</p>
                      </div>
                   </div>
                 )}
              </CardContent>
           </Card>
           
           {sendSuccess && (
             <div className="animate-in fade-in slide-in-from-bottom-4 fixed bottom-8 right-8 z-[100]">
                <div className="bg-emerald-500 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 font-bold">
                  <CheckCircle2 className="h-6 w-6" />
                  {sendSuccess}
                </div>
             </div>
           )}
        </div>
      </div>
    </div>
  );
}
