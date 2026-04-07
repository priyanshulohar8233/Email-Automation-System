import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from 'xlsx';
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sparkles, Check, Send, Copy, RefreshCw, Wand2, Type, Mail, Library, ChevronRight, Download, Users, Link, Paperclip, Image as ImageIcon, Upload, Trash2, XCircle, Calendar, Clock, Plus, FileText, AlertCircle, CheckCircle2, ChevronDown, Trash } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/PageHeader";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { dayjs, toUTC } from "@/lib/timeUtils";

// Helper component for Image Preview
function ImagePreviewBlock({ imageUrl, localImage, imagePreview, label, width = 100, height = 300, onRemove, onWidthChange, onHeightChange }: { imageUrl: string, localImage: File | null, imagePreview: string, label: string, width?: number, height?: number, onRemove?: () => void, onWidthChange?: (newWidth: number) => void, onHeightChange?: (newHeight: number) => void }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isResizing, setIsResizing] = useState(false);

    const handleMouseDown = (e: React.MouseEvent, direction: string) => {
        if (!onWidthChange || !onHeightChange) return;
        e.preventDefault();
        e.stopPropagation();
        setIsResizing(true);

        const startX = e.clientX;
        const startY = e.clientY;
        const startWidth = width;
        const startHeight = height;
        const parentWidth = containerRef.current?.parentElement?.offsetWidth || 640;

        const handleMouseMove = (moveEvent: MouseEvent) => {
            let deltaX = moveEvent.clientX - startX;
            let deltaY = moveEvent.clientY - startY;

            if (direction.includes('e')) {
                const deltaPercent = (deltaX / parentWidth) * 100;
                onWidthChange(Math.round(Math.min(100, Math.max(10, startWidth + deltaPercent))));
            }
            if (direction.includes('w')) {
                const deltaPercent = (deltaX / parentWidth) * -100;
                onWidthChange(Math.round(Math.min(100, Math.max(10, startWidth + deltaPercent))));
            }
            if (direction.includes('s')) {
                onHeightChange(Math.max(50, startHeight + deltaY));
            }
            if (direction.includes('n')) {
                onHeightChange(Math.max(50, startHeight - deltaY));
            }
        };

        const handleMouseUp = () => {
            setIsResizing(false);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    const ResizeHandle = ({ dir, className }: { dir: string, className: string }) => (
        <div
            onMouseDown={(e) => handleMouseDown(e, dir)}
            className={cn(
                "absolute p-1 z-20 opacity-0 group-hover/image-block:opacity-100 transition-opacity",
                className
            )}
        >
            <div className="w-2 h-2 bg-indigo-500 rounded-full border-2 border-white shadow-sm ring-1 ring-indigo-500/20 active:scale-150 transition-transform" />
        </div>
    );

    return (
        <div
            ref={containerRef}
            className={cn(
                "space-y-1.5 transition-all duration-300 ease-in-out relative group/image-block select-none",
                isResizing && "transition-none"
            )}
            style={{ width: `${width}%`, marginLeft: width < 100 ? 'auto' : '0', marginRight: width < 100 ? 'auto' : '0' }}
        >
            <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">{label}</label>
                {onRemove && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onRemove(); }}
                        className="opacity-0 group-hover/image-block:opacity-100 transition-opacity p-1 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-500"
                        title="Remove from this position"
                    >
                        <Trash2 className="h-3 w-3" />
                    </button>
                )}
            </div>
            <div className={cn(
                "p-2 rounded-xl bg-muted/30 flex flex-col gap-2 overflow-visible group transition-colors relative",
                isResizing && "ring-2 ring-indigo-500/20"
            )}>
                <div
                    className="w-full rounded-lg bg-indigo-500/5 flex items-center justify-center shrink-0 overflow-hidden border border-indigo-500/10"
                    style={{ height: `${height}px` }}
                >
                    {localImage && imagePreview ? (
                        <img src={imagePreview} alt="Preview" className="w-full h-full object-cover pointer-events-none" />
                    ) : (imageUrl && imageUrl.startsWith('http')) ? (
                        <img src={imageUrl} alt="Preview" className="w-full h-full object-cover pointer-events-none" />
                    ) : (
                        <ImageIcon className="h-8 w-8 text-indigo-500/20" />
                    )}
                </div>
                <div className="flex items-center justify-between px-1">
                    <div className="flex-1 truncate">
                        <p className="text-[10px] font-medium text-foreground truncate">{localImage ? localImage.name : imageUrl || 'No image source'}</p>
                        <p className="text-[9px] text-muted-foreground tracking-tight italic">Scale: {width}% (W) x {height}px (H)</p>
                    </div>
                </div>

                {onWidthChange && (
                    <>
                        {/* Corners */}
                        <ResizeHandle dir="nw" className="-top-1.5 -left-1.5 cursor-nwse-resize" />
                        <ResizeHandle dir="ne" className="-top-1.5 -right-1.5 cursor-nesw-resize" />
                        <ResizeHandle dir="sw" className="-bottom-1.5 -left-1.5 cursor-nesw-resize" />
                        <ResizeHandle dir="se" className="-bottom-1.5 -right-1.5 cursor-nwse-resize" />

                        {/* Edges */}
                        <ResizeHandle dir="n" className="-top-1.5 left-1/2 -ml-2 cursor-ns-resize" />
                        <ResizeHandle dir="s" className="-bottom-1.5 left-1/2 -ml-2 cursor-ns-resize" />
                        <ResizeHandle dir="w" className="top-1/2 -left-1.5 -mt-2 cursor-ew-resize" />
                        <ResizeHandle dir="e" className="top-1/2 -right-1.5 -mt-2 cursor-ew-resize" />
                    </>
                )}
            </div>
        </div>
    );
}

export default function AITemplates() {
    const [topic, setTopic] = useState("");
    const [tone, setTone] = useState("C-Executive Level");
    const [generating, setGenerating] = useState(false);
    const [generatedSubject, setGeneratedSubject] = useState("");
    const [generatedBody, setGeneratedBody] = useState("");
    const [imageUrl, setImageUrl] = useState("");
    const [attachment, setAttachment] = useState("");
    const [localImage, setLocalImage] = useState<File | null>(null);
    const [localAttachment, setLocalAttachment] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string>("");
    const [imageUsage, setImageUsage] = useState<'embed' | 'attach'>('embed');
    const [imagePlacement, setImagePlacement] = useState<'top' | 'bottom' | 'anywhere'>('bottom');
    const [imageWidth, setImageWidth] = useState<number>(100);
    const [imageHeight, setImageHeight] = useState<number>(300);
    const [recipients, setRecipients] = useState<any[]>([]);
    const [showSeniorityMenu, setShowSeniorityMenu] = useState(false);
    const [activeCategory, setActiveCategory] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [sendSuccess, setSendSuccess] = useState<string | null>(null);
    const [uploadedFileName, setUploadedFileName] = useState<string>("");
    const [uploadedFileSize, setUploadedFileSize] = useState<string>("");
    const [validCount, setValidCount] = useState<number>(0);
    const [invalidCount, setInvalidCount] = useState<number>(0);
    const [uploadStatus, setUploadStatus] = useState<'idle' | 'reading' | 'success' | 'error'>('idle');
    const [uploadError, setUploadError] = useState<string | null>(null);

    const seniorityMenuRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

    useEffect(() => {
        const storedRecipients = localStorage.getItem("ai_draft_recipients");
        const storedFileName = localStorage.getItem("ai_draft_filename");
        if (storedRecipients) {
            try {
                setRecipients(JSON.parse(storedRecipients));
            } catch (e) { }
        }
        if (storedFileName) setUploadedFileName(storedFileName);
    }, []);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (seniorityMenuRef.current && !seniorityMenuRef.current.contains(event.target as Node)) {
                setShowSeniorityMenu(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleCopy = () => {
        if (!generatedBody) return;
        navigator.clipboard.writeText(`Subject: ${generatedSubject} \n\n${generatedBody} `);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleUseInCampaign = () => {
        if (!generatedBody) return;
        localStorage.setItem("ai_draft_subject", generatedSubject);
        localStorage.setItem("ai_draft_body", generatedBody);
        if (recipients.length > 0) {
            localStorage.setItem("ai_draft_recipients", JSON.stringify(recipients));
            localStorage.setItem("ai_draft_filename", uploadedFileName);
        }
        navigate("/campaigns");
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadStatus('reading');
        setUploadError(null);
        setUploadedFileName(file.name);
        setUploadedFileSize((file.size / 1024).toFixed(1) + " KB");

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                let data: any[] = [];
                const binaryStr = event.target?.result;
                const workbook = XLSX.read(binaryStr, { type: 'binary' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet);

                if (jsonData.length === 0) {
                    throw new Error("The uploaded file is empty.");
                }

                // Find email column
                const keys = Object.keys(jsonData[0] as object);
                const emailKey = keys.find(k => k.toLowerCase().includes('email'));

                if (!emailKey) {
                    throw new Error("No 'email' column detected in the file. Please check your format.");
                }

                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                let valid = 0;
                let invalid = 0;

                data = jsonData.map((row: any) => {
                    const email = String(row[emailKey]).trim();
                    const isValid = emailRegex.test(email);
                    if (isValid) valid++; else invalid++;
                    return {
                        name: row['name'] || row['Name'] || email.split('@')[0],
                        email: email,
                        isValid: isValid
                    };
                });

                const validRecipients = data.filter(r => r.isValid);
                setRecipients(validRecipients);
                setValidCount(valid);
                setInvalidCount(invalid);
                setUploadStatus('success');

                localStorage.setItem("ai_draft_recipients", JSON.stringify(validRecipients));
                localStorage.setItem("ai_draft_filename", file.name);
            } catch (err: any) {
                setUploadStatus('error');
                setUploadError(err.message || "Failed to process file.");
                setRecipients([]);
                setValidCount(0);
                setInvalidCount(0);
            }
        };
        reader.onerror = () => {
            setUploadStatus('error');
            setUploadError("Failed to read file.");
        };
        reader.readAsBinaryString(file);
    };

    const handleRemoveFile = () => {
        setRecipients([]);
        setUploadedFileName("");
        setUploadedFileSize("");
        setValidCount(0);
        setInvalidCount(0);
        setUploadStatus('idle');
        setUploadError(null);
        localStorage.removeItem("ai_draft_recipients");
        localStorage.removeItem("ai_draft_filename");
        if (document.getElementById('excel-upload')) {
            (document.getElementById('excel-upload') as HTMLInputElement).value = '';
        }
    };

    const handleQuickSend = async (scheduledTime?: string) => {
        if (!generatedBody || recipients.length === 0) {
            alert("Please upload a recipient list first!");
            return;
        }

        setIsSending(true);
        try {
            // Construct the final body with image markers handled
            let finalBody = generatedBody;
            const currentAttachments: string[] = [];

            if (imageUsage === 'embed') {
                const imgTag = `<img src="${imageUrl || imagePreview}" style="width: ${imageWidth}%; height: ${imageHeight}px; object-fit: cover;" />`;
                if (imagePlacement === 'top') finalBody = imgTag + "<br/>" + finalBody;
                else if (imagePlacement === 'bottom') finalBody = finalBody + "<br/>" + imgTag;
                else finalBody = finalBody.replace(/\[IMAGE\]/g, imgTag);
            } else if (imageUsage === 'attach') {
                if (imageUrl) currentAttachments.push(imageUrl);
                else if (imagePreview) currentAttachments.push(imagePreview);
            }

            // Handle the manual attachment
            if (localAttachment) {
                const base64 = await new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result as string);
                    reader.readAsDataURL(localAttachment);
                });
                currentAttachments.push(base64);
            } else if (attachment && attachment.startsWith('http')) {
                currentAttachments.push(attachment);
            }

            const res = await fetch("/api/send-campaign", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    campaign_id: 1, // Default AI campaign
                    subject: generatedSubject,
                    body: finalBody,
                    recipients: recipients.map(r => r.email),
                    scheduled_at: scheduledTime ? toUTC(scheduledTime) : null,
                    attachments: currentAttachments
                })
            });

            if (res.ok) {
                setSendSuccess(scheduledTime ? "Campaign scheduled successfully!" : "Emails sent successfully!");
                setTimeout(() => setSendSuccess(null), 5000);
            } else {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.detail || "Failed to send");
            }
        } catch (error: any) {
            alert(`Error sending campaign: ${error.message}`);
        } finally {
            setIsSending(false);
        }
    };

    const CAMPAIGN_CATEGORIES = [
        {
            id: "welcome",
            name: "Welcome & Onboarding",
            icon: "👋",
            desc: "A warm introduction focusing on next steps and engagement.",
            templates: [
                {
                    name: "Modern Friendly Welcome",
                    design: "Minimalist Style",
                    keywords: ["Onboarding", "Introduction", "Next Steps"],
                    themeColor: "bg-blue-100 text-blue-700 border-blue-200",
                    accent: "bg-blue-500",
                    subject: "Welcome to [Company]! We're thrilled to have you.",
                    body: "Hi [Name],\n\nWelcome aboard! We are so excited that you've decided to join us.\n\nTo get you started on the right foot, here are three quick things you can do right now to get the most out of your experience:\n\n1. Complete your profile setup\n2. Explore our community guides\n3. Say hello in the intro channel\n\nIf you have any questions at all, our team is just a reply away. Let's do great things together!\n\nBest,\nThe [Company] Team"
                },
                {
                    name: "Executive Activation",
                    design: "Corporate Standard",
                    keywords: ["Premium", "Access", "Support"],
                    themeColor: "bg-slate-100 text-slate-700 border-slate-200",
                    accent: "bg-slate-700",
                    subject: "Your Account is Active - Next Steps",
                    body: "Dear [Name],\n\nYour account has been successfully provisioned. You now have full access to our premium suite of tools.\n\nYour dedicated account manager will be reaching out shortly to schedule your personalized onboarding session. In the meantime, you can access your dashboard directly.\n\nThank you for choosing [Company].\n\nRegards,\nThe Executive Team"
                },
                {
                    name: "Vibrant Engagement",
                    design: "Creative & Bold",
                    keywords: ["Exciting", "Action", "Start"],
                    themeColor: "bg-purple-100 text-purple-700 border-purple-200",
                    accent: "bg-purple-500",
                    subject: "Let's Get This Party Started! 🎉",
                    body: "Hey [Name]!\n\nWe couldn't be more pumped to have you in the [Company] family! \n\nThe hardest part (signing up) is done. Now comes the fun part. Click below to dive in and set up your first workspace so you can start seeing results immediately.\n\nLet's go!\n\nThe [Company] Team"
                },
                {
                    name: "Soft Guide",
                    design: "Helpful & Warm",
                    keywords: ["Help", "Tips", "Value"],
                    themeColor: "bg-teal-100 text-teal-700 border-teal-200",
                    accent: "bg-teal-500",
                    subject: "3 Tips to master [Company] on day one",
                    body: "Hi [Name],\n\nGetting started with a new tool can be overwhelming. As a quick welcome gift, I wanted to share the 3 most effective strategies our top users employ on their very first day:\n\n1. [Tip 1]\n2. [Tip 2]\n3. [Tip 3]\n\nTry implementing just one of these today, and let me know how it goes! \n\nWarmly,\n[Your Name]"
                }
            ]
        },
        {
            id: "sales",
            name: "Cold Outreach / Sales",
            icon: "🚀",
            desc: "High-converting cold email with a clear value proposition.",
            templates: [
                {
                    name: "Direct Pitch",
                    design: "High-Impact",
                    keywords: ["Pain Point", "Solution", "ROI"],
                    themeColor: "bg-emerald-100 text-emerald-700 border-emerald-200",
                    accent: "bg-emerald-500",
                    subject: "A quicker way to handle [Pain Point]",
                    body: "Hi [Name],\n\nI noticed that [Company] has been scaling incredibly fast lately—huge congratulations on the recent momentum!\n\nTypically, as companies reach your stage, they start struggling with [Specific Challenge]. That's why we built our platform: to completely automate that process so your team can focus on what actually matters.\n\nOur clients usually see a 30% reduction in manual work within the first two weeks.\n\nDo you have 10 minutes next Tuesday for a quick intro chat?\n\nBest,\n[Your Name]"
                },
                {
                    name: "Curiosity Play",
                    design: "Conversational",
                    keywords: ["Question", "Intriguing", "Brief"],
                    themeColor: "bg-orange-100 text-orange-700 border-orange-200",
                    accent: "bg-orange-500",
                    subject: "Quick question about your strategy at [Company]",
                    body: "Hey [Name],\n\nI was just browsing your recent updates and loved what your team is doing with [Recent Project/Feature].\n\nI'm reaching out because we help companies similar to yours achieve [Specific Result], and based on your current trajectory, I think you'd be a perfect fit to see similar gains.\n\nAre you open to a brief email exchange to see if it makes sense?\n\nCheers,\n[Your Name]"
                },
                {
                    name: "The Soft Push",
                    design: "Consultative",
                    keywords: ["Advice", "Strategy", "Value"],
                    themeColor: "bg-indigo-100 text-indigo-700 border-indigo-200",
                    accent: "bg-indigo-500",
                    subject: "Ideas for your Q3 growth at [Company]",
                    body: "Hi [Name],\n\nI've been analyzing [Company]'s recent market moves and I'm very impressed.\n\nI put together a brief 2-minute video sharing a few thoughts on how similar companies are reducing [Cost/Pain] while scaling. No strings attached, just some insights you might find valuable.\n\nWould you be open to me sending the link over?\n\nThanks,\n[Your Name]"
                },
                {
                    name: "Aggressive Offer",
                    design: "Urgent & Direct",
                    keywords: ["Limited", "Offer", "Bottom-line"],
                    themeColor: "bg-red-100 text-red-700 border-red-200",
                    accent: "bg-red-500",
                    subject: "Guaranteed to double your [Metric] in 30 days",
                    body: "Hey [Name],\n\nI'll keep this short. We are helping companies like [Competitor 1] and [Competitor 2] double their [Metric] within 30 days.\n\nIf we can't do the same for [Company], you pay nothing. It's completely risk-free.\n\nAre you available for a 5-minute call tomorrow at 10 AM to discuss?\n\nBest,\n[Your Name]"
                }
            ]
        },
        {
            id: "winback",
            name: "Re-engagement / Win-back",
            icon: "♻️",
            desc: "Designed to bring inactive users back into the funnel.",
            templates: [
                {
                    name: "Incentive Offer",
                    design: "Special Promo",
                    keywords: ["Discount", "Come Back", "Exclusive"],
                    themeColor: "bg-rose-100 text-rose-700 border-rose-200",
                    accent: "bg-rose-500",
                    subject: "It's been a while, [Name]! Let's catch up.",
                    body: "Hi [Name],\n\nWe haven't seen you around lately, and honestly, we miss you!\n\nSince you last checked in, we've rolled out a ton of highly-requested features that make managing your workflow easier than ever. \n\nWe'd love to invite you back to see the changes. In fact, if you log in this week, we've added a special welcome-back credit to your account.\n\nClick here to claim it and explore what's new.\n\nHope to see you soon!\n\nThe [Company] Team"
                },
                {
                    name: "Product Update",
                    design: "Feature Focus",
                    keywords: ["New UI", "Improvements", "Fast"],
                    themeColor: "bg-cyan-100 text-cyan-700 border-cyan-200",
                    accent: "bg-cyan-500",
                    subject: "Look at what we've built for you!",
                    body: "Hi [Name],\n\nWe know it's been a minute, but we haven't stopped working to make [Product] the best platform out there.\n\nWe've completely overhauled the interface to be 2x faster, added [New Feature], and removed all the friction from [Task].\n\nIt's practically a whole new experience. Jump back in on us—your first month back is completely free on the new tier.\n\nBest,\n[Company]"
                },
                {
                    name: "Survey Check-in",
                    design: "Feedback Oriented",
                    keywords: ["Survey", "Honest", "Improve"],
                    themeColor: "bg-amber-100 text-amber-700 border-amber-200",
                    accent: "bg-amber-500",
                    subject: "Did we drop the ball, [Name]?",
                    body: "Hi [Name],\n\nI noticed you stopped actively using [Product] a while back. As the product manager, I take that personally (in a good way!).\n\nCould you do me a huge favor and hit reply with just one sentence on why you left? Was it pricing? Missing features? Too complicated?\n\nYour honest feedback helps us build a better platform. \n\nThanks so much for your time,\n[Your Name]"
                },
                {
                    name: "Final Warning",
                    design: "FOMO Style",
                    keywords: ["Delete", "Action Req", "Last Chance"],
                    themeColor: "bg-pink-100 text-pink-700 border-pink-200",
                    accent: "bg-pink-500",
                    subject: "Action Required: Your [Company] account will be paused",
                    body: "Hi [Name],\n\nBecause you haven't logged in for 6 months, we'll be pausing your unused workspace on [Date] to free up resources.\n\nIf you're done with us, no action is needed. But if you want to keep your data and settings, please log in before the deadline by clicking below:\n\n[Login Button]\n\nHope you decide to stay!\n\nBest,\n[Company] Support"
                }
            ]
        },
        {
            id: "birthday",
            name: "Birthday Templates",
            icon: "🎂",
            desc: "Personalized birthday wishes and special offers for your clients.",
            templates: [
                {
                    name: "Simple Birthday Wish",
                    design: "Friendly & Warm",
                    keywords: ["Birthday", "Celebrate", "Personal"],
                    themeColor: "bg-pink-100 text-pink-700 border-pink-200",
                    accent: "bg-pink-500",
                    subject: "Happy Birthday, [Name]! 🎂",
                    body: "Hi [Name],\n\nHappy Birthday! 🎈\n\nWishing you a fantastic day filled with joy, laughter, and all your favorite things. We're so glad to have you as a part of our community.\n\nEnjoy your special day!\n\nBest,\nThe [Company] Team"
                },
                {
                    name: "Birthday Offer",
                    design: "Incentive Focus",
                    keywords: ["Discount", "Gift", "Celebrate"],
                    themeColor: "bg-purple-100 text-purple-700 border-purple-200",
                    accent: "bg-purple-500",
                    subject: "A special birthday gift just for you! 🎁",
                    body: "Hi [Name],\n\nHappy Birthday! 🎉\n\nTo help you celebrate, we've added a special gift to your account: a [Amount]% discount on your next purchase! Use the code BIRTHDAY[Year] at checkout.\n\nHave a wonderful day!\n\nBest,\nThe [Company] Team"
                },
                {
                    name: "VIP Birthday Celebration",
                    design: "Premium / Exclusive",
                    keywords: ["VIP", "Exclusive", "Gift"],
                    themeColor: "bg-amber-100 text-amber-700 border-amber-200",
                    accent: "bg-amber-500",
                    subject: "Happy Birthday! Something special for our VIP... 🥂",
                    body: "Dear [Name],\n\nHappy Birthday! 🎈\n\nAs one of our most valued members, we wanted to make sure your day is extra special. We've arranged a [Special Gift/Service] for you to enjoy this month.\n\nJust hit reply to this email, or click the link below to claim your birthday surprise.\n\nWishing you the very best!\n\nWarmly,\n[Your Name]"
                }
            ]
        },
        {
            id: "events",
            name: "Events & Webinars",
            icon: "📅",
            desc: "Drive attendance to your online webinars or physical events.",
            templates: [
                {
                    name: "Webinar Invite",
                    design: "Value Pitch",
                    keywords: ["Live", "Learn", "Q&A"],
                    themeColor: "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200",
                    accent: "bg-fuchsia-500",
                    subject: "You're invited! Live Masterclass on [Topic]",
                    body: "Hi [Name],\n\nAre you struggling with [Pain Point]? \n\nNext Thursday at [Time], we're hosting an exclusive live masterclass where our CEO will walk through exactly how we solve this problem at [Company].\n\nSpots are limited, so make sure to claim your seat below. We'll also be hosting a 15-minute live Q&A at the end.\n\n[Register Now Button]\n\nSee you there!"
                },
                {
                    name: "Last Chance Reminder",
                    design: "Urgent",
                    keywords: ["Starting Soon", "Last Call", "Join"],
                    themeColor: "bg-red-100 text-red-700 border-red-200",
                    accent: "bg-red-500",
                    subject: "Starting in 1 hour: [Event Name]",
                    body: "Hi [Name],\n\nJust a quick heads-up that our highly-anticipated event, [Event Name], kicks off in exactly 1 hour! \n\nWe have over 500 people registered, and the chat is already buzzing. Make sure you have your link ready.\n\n[Join the Event Here]\n\nCan't make it live? Register anyway and we'll send you the replay.\n\nBest,\nThe [Company] Team"
                },
                {
                    name: "Post-Event Follow-up",
                    design: "Resource Sharing",
                    keywords: ["Replay", "Deck", "Notes"],
                    themeColor: "bg-violet-100 text-violet-700 border-violet-200",
                    accent: "bg-violet-500",
                    subject: "Replay inside: Thanks for joining us!",
                    body: "Hi [Name],\n\nThank you so much for attending [Event Name]! We loved having you there.\n\nIn case you missed anything or want to share the presentation with your team, I've attached the slide deck and the full video replay below.\n\n[Link to Replay]\n\nIf you have any lingering questions, hit reply! Otherwise, keep an eye out for our next event.\n\nWarmly,\n[Company] Events Team"
                }
            ]
        },

    ];

    const handleGenerate = async () => {
        if (!topic) return;
        setGenerating(true);
        console.log("Starting AI Email Generation for topic:", topic);

        try {
            const res = await fetch("/api/templates/generate", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ topic, tone })
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(`API Error: ${res.status} - ${JSON.stringify(errorData)}`);
            }

            const data = await res.json();
            console.log("AI Generation Successful:", data);

            setGeneratedSubject(data.subject || "");
            setGeneratedBody(data.body || data.content || "");
        } catch (error: any) {
            console.error("AI Generation Failed:", error);
            setGeneratedSubject("Error generating template");
            setGeneratedBody(`Error: ${error.message || "Failed to connect to the AI generation service."} \n\nPlease check your backend is running and your AI API key is properly configured in backend/.env.`);
        } finally {
            setGenerating(false);
        }
    };

    const loadTemplate = (subject: string, body: string) => {
        setGeneratedSubject(subject);
        setGeneratedBody(body);
        setActiveCategory(null);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    if (activeCategory) {
        const activeData = CAMPAIGN_CATEGORIES.find(c => c.id === activeCategory);
        return (
            <div className="flex flex-col gap-8 pb-10 animate-in fade-in duration-300">
                {/* Back Button & Header */}
                <div className="flex items-center justify-between border-b border-border pb-8 mb-4">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setActiveCategory(null)}
                            style={{ borderRadius: "14px" }}
                            className="h-9 w-9 hover:bg-muted transition-colors group flex items-center justify-center border border-border bg-card shadow-sm"
                        >
                            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground rotate-180" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-3">
                                <span style={{ borderRadius: "12px" }} className="text-2xl bg-muted p-2 border border-border shadow-sm flex items-center justify-center w-11 h-11">{activeData?.icon}</span>
                                {activeData?.name} Templates
                            </h1>
                            <p className="text-muted-foreground mt-1 text-xs font-medium">Select a full-page template to use and edit in the AI Generator.</p>
                        </div>
                    </div>
                    <ThemeToggle />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {activeData?.templates.map((tpl, i) => (
                        <div
                            key={i}
                            className="bg-card rounded-2xl border border-border hover:border-indigo-500 hover:shadow-2xl hover:shadow-indigo-500/10 hover:-translate-y-2 transition-all duration-300 cursor-pointer relative overflow-hidden group flex flex-col min-h-[380px] active:scale-95"
                            onClick={() => loadTemplate(tpl.subject, tpl.body)}
                        >
                            {/* Hover Background Accent */}
                            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/0 via-indigo-500/0 to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />

                            {/* Top Accent line */}
                            <div className={`absolute top-0 left-0 w-full h-1.5 transition-all duration-500 group-hover:h-2 ${tpl.accent}`} />

                            <div className="p-6 flex-1 flex flex-col">
                                <div className="flex justify-between items-start mb-4 mt-2">
                                    <h4 className="font-bold text-foreground text-lg leading-tight pr-2">{tpl.name}</h4>
                                    <span style={{ borderRadius: "8px" }} className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 border whitespace-nowrap ${tpl.themeColor}`}>
                                        {tpl.design}
                                    </span>
                                </div>

                                <p className="text-sm text-muted-foreground mb-6 italic border-l-2 border-border pl-3">
                                    "{tpl.subject.substring(0, 60)}..."
                                </p>

                                <div className="text-sm text-muted-foreground/60 mb-6 line-clamp-3 leading-relaxed">
                                    {tpl.body.substring(0, 120)}...
                                </div>

                                <div className="flex flex-wrap gap-2 mb-8">
                                    {tpl.keywords.map((kw, idx) => (
                                        <span key={idx} className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-lg border border-border">
                                            #{kw}
                                        </span>
                                    ))}
                                </div>

                                <div
                                    style={{ borderRadius: "14px" }}
                                    className="w-full bg-muted border border-border py-3 flex items-center justify-center gap-2 group-hover:bg-indigo-600 group-hover:text-white transition-all group-hover:border-indigo-500 text-foreground text-sm font-semibold shadow-sm mt-auto"
                                >
                                    <Sparkles className="h-4 w-4" />
                                    Use Template
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-8 pb-10">
            {/* Top Bar */}
            <PageHeader
                title="AI Templates"
                subtitle="Generate high-converting emails instantly with our AI email engine."
            >
                <div className="flex gap-3">
                    <Button
                        onClick={() => window.open('https://docs.google.com/spreadsheets/d/1-YDeAqAdh2mU4beUsrKCBYSKFWJw0ZiaHY3HncnNVv8/export?format=xlsx', '_blank')}
                        variant="outline"
                        style={{ borderRadius: "14px" }}
                        className="h-9 gap-2 border-border bg-card hover:bg-muted transition-all shadow-sm px-4 text-xs font-semibold"
                    >
                        <Download className="h-3.5 w-3.5 text-muted-foreground" />
                        Download Sample
                    </Button>
                    <input
                        type="file"
                        id="excel-upload"
                        className="hidden"
                        accept=".xlsx, .xls, .csv"
                        onChange={handleFileUpload}
                    />
                    <Button
                        onClick={() => uploadStatus === 'success' ? handleRemoveFile() : document.getElementById('excel-upload')?.click()}
                        variant={uploadStatus === 'success' ? "outline" : "default"}
                        style={{ borderRadius: "14px" }}
                        disabled={uploadStatus === 'reading'}
                        className={cn(
                            "h-9 gap-2 transition-all shadow-md px-4 text-xs font-semibold",
                            uploadStatus === 'success'
                                ? "border-amber-500/50 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                                : "bg-indigo-600 hover:bg-indigo-700 text-white border-transparent"
                        )}
                    >
                        {uploadStatus === 'reading' ? (
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        ) : uploadStatus === 'success' ? (
                            <Trash className="h-3.5 w-3.5 text-amber-500" />
                        ) : (
                            <Upload className="h-3.5 w-3.5" />
                        )}
                        {uploadStatus === 'reading'
                            ? "Processing..."
                            : uploadStatus === 'success'
                                ? `Remove ${uploadedFileName.substring(0, 15)}${uploadedFileName.length > 15 ? '...' : ''}`
                                : "Upload Excel Sheet"}
                    </Button>
                </div>
            </PageHeader>

            {/* Split Panel Section */}
            <div className="flex min-h-[500px] gap-6">
                {/* Left Side: AI Controls */}
                <div className="w-[380px] rounded-2xl bg-card border border-border p-6 flex flex-col relative shadow-sm shrink-0">
                    <div className="relative z-10 flex flex-col h-full">
                        <h2 className="text-xl font-semibold mb-6 flex items-center gap-2 text-foreground">
                            <Sparkles className="h-5 w-5 text-indigo-600" />
                            Email Generator
                        </h2>

                        <div className="space-y-6 flex-1 relative">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                    <Type className="h-4 w-4 text-indigo-500" />
                                    What is this email about?
                                </label>
                                <textarea
                                    style={{ borderRadius: "14px" }}
                                    className="w-full h-32 bg-muted/50 border border-border p-3 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-muted-foreground/50 resize-none text-foreground focus:bg-card"
                                    placeholder="e.g. A follow-up email after a sales demo highlighting our 20% discount..."
                                    value={topic}
                                    onChange={(e) => setTopic(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                    <Mail className="h-4 w-4 text-indigo-500" />
                                    Target Seniority Level
                                </label>

                                {/* Custom Dropdown to fix UI design inconsistency */}
                                <div className="relative" ref={seniorityMenuRef}>
                                    <div
                                        style={{ borderRadius: "14px" }}
                                        onClick={() => setShowSeniorityMenu(!showSeniorityMenu)}
                                        className={`w-full bg-card border cursor-pointer px-4 py-3 text-sm flex items-center gap-2 transition-all ${showSeniorityMenu ? 'border-indigo-500 ring-1 ring-indigo-500 shadow-sm' : 'border-border shadow-sm text-foreground'}`}
                                    >
                                        <Users className="h-4 w-4 text-muted-foreground/60" />
                                        <span className="text-foreground font-medium flex-1 truncate">{tone}</span>
                                        <ChevronRight className={`h-4 w-4 text-muted-foreground/60 transition-transform ${showSeniorityMenu ? 'rotate-90' : 'rotate-0'}`} />
                                    </div>

                                    {showSeniorityMenu && (
                                        <div
                                            style={{ borderRadius: "14px" }}
                                            className="absolute left-0 right-0 mt-2 bg-card border border-border shadow-xl z-50 overflow-hidden py-1 animate-in fade-in slide-in-from-top-2 duration-200"
                                        >
                                            {["C-Executive Level", "VP Level", "Director", "Manager", "Non-Manager"].map((opt) => (
                                                <div
                                                    key={opt}
                                                    onClick={() => {
                                                        setTone(opt);
                                                        setShowSeniorityMenu(false);
                                                    }}
                                                    className={`px-4 py-3 text-xs font-semibold cursor-pointer transition-colors flex items-center justify-between ${tone === opt ? 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400' : 'text-muted-foreground hover:bg-muted'}`}
                                                >
                                                    {opt}
                                                    {tone === opt && <Check className="h-3.5 w-3.5" />}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-4 pt-4 border-t border-border">
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                            <Link className="h-4 w-4 text-indigo-500" />
                                            Include Image
                                        </label>
                                        <button
                                            onClick={() => document.getElementById('local-image-upload')?.click()}
                                            className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 uppercase tracking-tighter flex items-center gap-1 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-1 rounded-md border border-indigo-100 dark:border-indigo-800 transition-colors"
                                        >
                                            <Upload className="h-3 w-3" />
                                            {localImage ? 'Change File' : 'From Device'}
                                        </button>
                                        <input
                                            type="file"
                                            id="local-image-upload"
                                            className="hidden"
                                            accept="image/*"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                    setLocalImage(file);
                                                    setImageUrl(file.name);
                                                    setImagePreview(URL.createObjectURL(file));
                                                }
                                            }}
                                        />
                                    </div>
                                    <div className="relative group">
                                        <input
                                            type="text"
                                            style={{ borderRadius: "12px" }}
                                            className="w-full bg-muted/50 border border-border pl-3 pr-10 py-2 text-xs focus:outline-none focus:border-indigo-500 focus:bg-card transition-all placeholder:text-muted-foreground/30 text-foreground"
                                            placeholder={localImage ? "Local file selected" : "https://images.unsplash.com/..."}
                                            value={localImage ? localImage.name : imageUrl}
                                            onChange={(e) => {
                                                setImageUrl(e.target.value);
                                                if (localImage) setLocalImage(null);
                                            }}
                                            disabled={!!localImage}
                                        />
                                        {(imageUrl || localImage) && (
                                            <button
                                                onClick={() => { setLocalImage(null); setImageUrl(""); setImagePreview(""); }}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-red-500 transition-colors"
                                                title="Remove Image"
                                            >
                                                <XCircle className="h-4 w-4" />
                                            </button>
                                        )}
                                    </div>

                                    {(imageUrl || localImage) && imageUsage === 'embed' && (
                                        <div className="flex flex-col gap-2 mt-2">
                                            <div className="flex p-1 bg-muted/30 rounded-xl border border-border">
                                                {['top', 'bottom', 'anywhere'].map((pos) => (
                                                    <button
                                                        key={pos}
                                                        onClick={() => setImagePlacement(pos as any)}
                                                        className={cn(
                                                            "flex-1 py-1.5 text-[9px] font-bold uppercase tracking-tighter rounded-lg transition-all capitalize",
                                                            imagePlacement === pos
                                                                ? "bg-indigo-600 text-white shadow-sm"
                                                                : "text-muted-foreground hover:text-foreground"
                                                        )}
                                                    >
                                                        {pos}
                                                    </button>
                                                ))}
                                            </div>
                                            {imagePlacement === 'anywhere' && (
                                                <button
                                                    onClick={() => {
                                                        const el = document.getElementById('ai-body-textarea') as HTMLTextAreaElement;
                                                        if (el) {
                                                            const start = el.selectionStart;
                                                            const end = el.selectionEnd;
                                                            const text = generatedBody;
                                                            const newText = text.substring(0, start) + "\n[IMAGE]\n" + text.substring(end);
                                                            setGeneratedBody(newText);
                                                        } else {
                                                            setGeneratedBody(generatedBody + "\n[IMAGE]\n");
                                                        }
                                                    }}
                                                    className="w-full py-2 border border-dashed border-indigo-400/50 rounded-xl text-[10px] font-bold text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 transition-all flex items-center justify-center gap-2"
                                                >
                                                    <Wand2 className="h-3 w-3" />
                                                    Insert [IMAGE] Tag at Cursor
                                                </button>
                                            )}

                                            <div className="space-y-2 mt-2 p-3 bg-muted/30 rounded-xl border border-border">
                                                <div className="flex items-center justify-between">
                                                    <label className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">Image Scale</label>
                                                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/40 px-2 py-0.5 rounded-full">{imageWidth}%</span>
                                                </div>
                                                <div className="flex gap-1.5">
                                                    {[25, 50, 75, 100].map((w) => (
                                                        <button
                                                            key={w}
                                                            onClick={() => setImageWidth(w)}
                                                            className={cn(
                                                                "flex-1 py-1 text-[9px] font-bold rounded-md transition-all",
                                                                imageWidth === w
                                                                    ? "bg-indigo-600 text-white shadow-sm"
                                                                    : "bg-background border border-border text-muted-foreground hover:text-foreground"
                                                            )}
                                                        >
                                                            {w}%
                                                        </button>
                                                    ))}
                                                </div>
                                                <input
                                                    type="range"
                                                    min="10"
                                                    max="100"
                                                    value={imageWidth}
                                                    onChange={(e) => setImageWidth(parseInt(e.target.value))}
                                                    className="w-full h-1 bg-muted rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <div className="flex p-1 bg-muted/30 rounded-xl border border-border mt-2">
                                        <button
                                            onClick={() => setImageUsage('embed')}
                                            className={cn(
                                                "flex-1 flex items-center justify-center gap-2 py-1.5 text-[10px] font-bold uppercase tracking-tighter rounded-lg transition-all",
                                                imageUsage === 'embed'
                                                    ? "bg-indigo-600 text-white shadow-sm"
                                                    : "text-muted-foreground hover:text-foreground"
                                            )}
                                        >
                                            <ImageIcon className="h-3 w-3" />
                                            Embed
                                        </button>
                                        <button
                                            onClick={() => setImageUsage('attach')}
                                            className={cn(
                                                "flex-1 flex items-center justify-center gap-2 py-1.5 text-[10px] font-bold uppercase tracking-tighter rounded-lg transition-all",
                                                imageUsage === 'attach'
                                                    ? "bg-indigo-600 text-white shadow-sm"
                                                    : "text-muted-foreground hover:text-foreground"
                                            )}
                                        >
                                            <Paperclip className="h-3 w-3" />
                                            Attach
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                            <Paperclip className="h-4 w-4 text-indigo-500" />
                                            Include Attachment
                                        </label>
                                        <button
                                            onClick={() => document.getElementById('local-attach-upload')?.click()}
                                            className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 uppercase tracking-tighter flex items-center gap-1 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-1 rounded-md border border-indigo-100 dark:border-indigo-800 transition-colors"
                                        >
                                            <Upload className="h-3 w-3" />
                                            {localAttachment ? 'Change File' : 'From Device'}
                                        </button>
                                        <input
                                            type="file"
                                            id="local-attach-upload"
                                            className="hidden"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                    setLocalAttachment(file);
                                                    setAttachment(file.name);
                                                }
                                            }}
                                        />
                                    </div>
                                    <div className="relative group">
                                        <input
                                            type="text"
                                            style={{ borderRadius: "12px" }}
                                            className="w-full bg-muted/50 border border-border pl-3 pr-10 py-2 text-xs focus:outline-none focus:border-indigo-500 focus:bg-card transition-all placeholder:text-muted-foreground/30 text-foreground"
                                            placeholder={localAttachment ? "Local file selected" : "e.g. Sales_Deck_2024.pdf"}
                                            value={localAttachment ? localAttachment.name : attachment}
                                            onChange={(e) => {
                                                setAttachment(e.target.value);
                                                if (localAttachment) setLocalAttachment(null);
                                            }}
                                            disabled={!!localAttachment}
                                        />
                                        {(attachment || localAttachment) && (
                                            <button
                                                onClick={() => { setLocalAttachment(null); setAttachment(""); }}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-red-500 transition-colors"
                                                title="Remove Attachment"
                                            >
                                                <XCircle className="h-4 w-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* File Status Card */}
                        {uploadStatus !== 'idle' && (
                            <div className="p-5 border border-border rounded-2xl bg-muted/20 space-y-4 animate-in fade-in slide-in-from-top-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <FileText className="h-4 w-4 text-indigo-500" />
                                        <h4 className="text-sm font-bold text-foreground">File Status</h4>
                                    </div>
                                    <Badge
                                        variant={uploadStatus === 'success' ? 'success' : uploadStatus === 'error' ? 'destructive' : 'secondary'}
                                        {...{ className: "h-5 text-[9px] uppercase tracking-wider" } as any}
                                    >
                                        {uploadStatus}
                                    </Badge>
                                </div>

                                {uploadStatus === 'error' ? (
                                    <div className="flex items-start gap-3 p-3 bg-red-500/5 border border-red-500/20 rounded-xl">
                                        <AlertCircle className="h-4 w-4 text-red-500 mt-0.5" />
                                        <p className="text-xs text-red-600 font-medium leading-relaxed">{uploadError}</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Filename</p>
                                                <p className="text-xs font-semibold text-foreground truncate">{uploadedFileName}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Size</p>
                                                <p className="text-xs font-semibold text-foreground">{uploadedFileSize}</p>
                                            </div>
                                        </div>

                                        <div className="pt-2 flex flex-col gap-2">
                                            <div className="flex justify-between items-center bg-emerald-500/5 border border-emerald-500/10 p-2.5 rounded-xl">
                                                <div className="flex items-center gap-2">
                                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                                    <span className="text-[11px] font-bold text-emerald-700">Valid Recipients</span>
                                                </div>
                                                <span className="text-xs font-bold text-emerald-700">{validCount}</span>
                                            </div>

                                            {invalidCount > 0 && (
                                                <div className="flex justify-between items-center bg-amber-500/5 border border-amber-500/10 p-2.5 rounded-xl">
                                                    <div className="flex items-center gap-2">
                                                        <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                                                        <span className="text-[11px] font-bold text-amber-700">Invalid Records</span>
                                                    </div>
                                                    <span className="text-xs font-bold text-amber-700">{invalidCount}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        <button
                            style={{ borderRadius: "14px" }}
                            className="mt-6 w-full relative overflow-hidden bg-indigo-600 px-4 py-3 text-sm font-medium text-white transition-all hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-sm hover:shadow-md active:scale-[0.98]"
                            onClick={handleGenerate}
                            disabled={generating || !topic}
                        >
                            {generating ? (
                                <span className="flex items-center justify-center gap-2">
                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                    Generating Magic...
                                </span>
                            ) : (
                                <span className="flex items-center justify-center gap-2">
                                    <Sparkles className="h-4 w-4" />
                                    Generate
                                </span>
                            )}
                        </button>
                    </div>
                </div>

                {/* Right Side: Generated Content */}
                <div className="flex-1 flex flex-col border border-border rounded-[14px] bg-card overflow-hidden shadow-sm">
                    <div className="flex items-center justify-between px-6 py-4 bg-muted/30 border-b border-border">
                        <div className="flex items-center gap-3">
                            <h3 className="text-[15px] font-semibold text-foreground">Generated Output</h3>
                            {sendSuccess && (
                                <span className="text-[11px] font-bold text-emerald-600 animate-in fade-in slide-in-from-left-2 flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/30 rounded-full border border-emerald-500/30">
                                    <Check className="h-3 w-3" />
                                    {sendSuccess}
                                </span>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Button
                                style={{ borderRadius: "10px" }}
                                variant="outline"
                                size="sm"
                                className={cn(
                                    "h-8 gap-1.5 transition-all text-xs font-semibold",
                                    copied
                                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/50 hover:bg-emerald-500/20"
                                        : "bg-muted/50 border-border text-foreground hover:bg-muted"
                                )}
                                disabled={!generatedBody}
                                onClick={handleCopy}
                            >
                                <Copy className={cn("h-3.5 w-3.5", copied && "animate-bounce")} />
                                {copied ? "Copied!" : "Copy"}
                            </Button>
                            <Button
                                style={{ borderRadius: "10px" }}
                                variant="outline"
                                size="sm"
                                className="h-8 gap-1.5 transition-all text-xs font-semibold bg-muted/50 border-border text-foreground hover:bg-muted disabled:opacity-30"
                                disabled={!generatedBody || isSending}
                                onClick={() => {
                                    const time = prompt("Enter schedule time (YYYY-MM-DDTHH:MM):", dayjs().tz('Asia/Kolkata').add(1, 'hour').format('YYYY-MM-DDTHH:mm'));
                                    if (time) handleQuickSend(time);
                                }}
                                title={validCount === 0 ? "Upload a recipient list to enable scheduling" : ""}
                            >
                                <Calendar className="h-3.5 w-3.5 text-indigo-500" />
                                {isSending ? "..." : "Schedule"}
                            </Button>
                            <Button
                                style={{ borderRadius: "10px" }}
                                variant="outline"
                                size="sm"
                                className="h-8 gap-1.5 transition-all text-xs font-semibold bg-indigo-500/5 border-indigo-500/20 text-indigo-600 hover:bg-indigo-500/10 disabled:opacity-30"
                                disabled={!generatedBody || isSending}
                                onClick={() => handleQuickSend()}
                                title={validCount === 0 ? "Upload a recipient list to send now" : ""}
                            >
                                <Clock className="h-3.5 w-3.5" />
                                {isSending ? "Sending..." : "Send Now"}
                            </Button>
                            <Button
                                style={{
                                    background: "linear-gradient(135deg, #6366f1, #a855f7)",
                                    borderRadius: "10px",
                                    border: "none"
                                }}
                                size="sm"
                                className="h-8 gap-1.5 text-white shadow-md hover:opacity-90 active:scale-95 text-xs font-semibold transition-all disabled:opacity-50"
                                disabled={!generatedBody}
                                onClick={handleUseInCampaign}
                            >
                                <ChevronDown className="h-3.5 w-3.5" />
                                Use in Campaign
                            </Button>
                        </div>
                    </div>

                    {generatedBody && !generating && validCount === 0 && (
                        <div className="px-6 py-2 bg-amber-500/5 border-b border-border flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                            <AlertCircle className="h-3 w-3 text-amber-500" />
                            <p className="text-[10px] font-medium text-amber-600">Recipient list required for 'Send Now' and 'Schedule'. You can still 'Use in Campaign' to save this draft.</p>
                        </div>
                    )}

                    <div className="flex-1 p-6 relative flex flex-col bg-card">
                        {!generatedBody && !generating && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <Wand2 className="h-10 w-10 mb-4 text-muted-foreground/30" />
                                <p className="text-sm text-muted-foreground">Describe your email on the left to generate content.</p>
                            </div>
                        )}

                        {generating && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-card/60 backdrop-blur-[2px] z-10 transition-all">
                                <div className="flex gap-2 items-center">
                                    <span className="w-2.5 h-2.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                    <span className="w-2.5 h-2.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                    <span className="w-2.5 h-2.5 bg-indigo-500 rounded-full animate-bounce"></span>
                                </div>
                                <p className="mt-4 text-sm font-semibold text-muted-foreground">AI engine is assembling your message...</p>
                            </div>
                        )}

                        {generatedBody && !generating && (
                            <div className="flex flex-col h-full gap-4 overflow-y-auto pr-2 custom-scrollbar">
                                <div className="flex flex-col space-y-1.5 shrink-0">
                                    <label className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">Subject Line</label>
                                    <input
                                        className="w-full px-4 py-3 rounded-xl outline-none text-[15px] font-medium transition-all border border-border bg-muted/30 text-foreground focus:border-indigo-400 focus:bg-card focus:shadow-sm"
                                        value={generatedSubject}
                                        onChange={(e) => setGeneratedSubject(e.target.value)}
                                        placeholder="Email Subject"
                                    />
                                </div>

                                {imageUrl && imageUsage === 'embed' && imagePlacement === 'top' && (
                                    <div className="animate-in slide-in-from-top-2 duration-300 shrink-0">
                                        <ImagePreviewBlock
                                            imageUrl={imageUrl}
                                            localImage={localImage}
                                            imagePreview={imagePreview}
                                            label="Embedded Image (Top)"
                                            width={imageWidth}
                                            height={imageHeight}
                                            onRemove={() => { setImageUrl(""); setLocalImage(null); }}
                                            onWidthChange={setImageWidth}
                                            onHeightChange={setImageHeight}
                                        />
                                    </div>
                                )}

                                <div className="flex flex-col space-y-1.5 flex-1 relative min-h-[400px]">
                                    <label className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">Email Body</label>
                                    {imagePlacement === 'anywhere' && generatedBody.includes('[IMAGE]') ? (
                                        <div className="flex-1 flex flex-col gap-4">
                                            {generatedBody.split('[IMAGE]').map((part, index, array) => (
                                                <React.Fragment key={index}>
                                                    <textarea
                                                        className="w-full p-4 rounded-xl resize-none outline-none text-[15px] leading-relaxed transition-all border border-transparent bg-muted/10 text-foreground focus:border-indigo-400/30 focus:bg-card custom-scrollbar"
                                                        style={{ height: 'auto', minHeight: '100px' }}
                                                        value={part}
                                                        onChange={(e) => {
                                                            const newParts = [...array];
                                                            newParts[index] = e.target.value;
                                                            setGeneratedBody(newParts.join('[IMAGE]'));
                                                        }}
                                                        placeholder="Continue typing..."
                                                    />
                                                    {index < array.length - 1 && (
                                                        <div className="py-2 shrink-0">
                                                            <ImagePreviewBlock
                                                                imageUrl={imageUrl}
                                                                localImage={localImage}
                                                                imagePreview={imagePreview}
                                                                label="Interactive Inline Image"
                                                                width={imageWidth}
                                                                height={imageHeight}
                                                                onRemove={() => {
                                                                    const newParts = [...array];
                                                                    // Merge the two adjacent parts, effectively removing the [IMAGE] tag between them
                                                                    const mergedPart = newParts[index] + newParts[index + 1];
                                                                    newParts.splice(index, 2, mergedPart);
                                                                    setGeneratedBody(newParts.join('[IMAGE]'));
                                                                }}
                                                                onWidthChange={setImageWidth}
                                                                onHeightChange={setImageHeight}
                                                            />
                                                        </div>
                                                    )}
                                                </React.Fragment>
                                            ))}
                                        </div>
                                    ) : (
                                        <>
                                            <textarea
                                                id="ai-body-textarea"
                                                className="w-full flex-1 rounded-xl p-4 resize-none outline-none text-[15px] leading-relaxed custom-scrollbar placeholder:text-muted-foreground/40 transition-all border border-border bg-muted/30 text-foreground focus:border-indigo-400 focus:bg-card focus:shadow-sm"
                                                value={generatedBody}
                                                onChange={(e) => setGeneratedBody(e.target.value)}
                                                placeholder="Email content..."
                                            />
                                            {imagePlacement === 'anywhere' && (imageUrl || localImage) && !generatedBody.includes('[IMAGE]') && (
                                                <div className="absolute right-4 bottom-4 px-3 py-1.5 bg-indigo-500 text-white text-[10px] font-bold rounded-lg shadow-lg flex items-center gap-2 animate-bounce">
                                                    <ImageIcon className="h-3 w-3" />
                                                    Don't forget to add [IMAGE] tag
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>

                                {imageUrl && imageUsage === 'embed' && imagePlacement === 'bottom' && (
                                    <div className="animate-in slide-in-from-bottom-2 duration-300 shrink-0">
                                        <ImagePreviewBlock
                                            imageUrl={imageUrl}
                                            localImage={localImage}
                                            imagePreview={imagePreview}
                                            label="Embedded Image (Bottom)"
                                            width={imageWidth}
                                            height={imageHeight}
                                            onRemove={() => { setImageUrl(""); setLocalImage(null); }}
                                            onWidthChange={setImageWidth}
                                            onHeightChange={setImageHeight}
                                        />
                                    </div>
                                )}

                                {imagePlacement === 'anywhere' && imageUrl && imageUsage === 'embed' && !generatedBody.includes('[IMAGE]') && (
                                    <div className="p-3 border border-dashed border-indigo-500/30 rounded-xl bg-indigo-500/5">
                                        <p className="text-[10px] font-bold text-indigo-600/60 uppercase tracking-widest mb-2">Tag Placement Preview</p>
                                        <div className="flex items-center gap-2 text-[10px] font-medium text-muted-foreground italic">
                                            <ImageIcon className="h-3 w-3" />
                                            Image will be rendered at [IMAGE] placeholder in final body.
                                        </div>
                                    </div>
                                )}

                                {((imageUrl && imageUsage === 'attach') || attachment) && (
                                    <div className="pt-4 mt-2 border-t border-border flex flex-col gap-3">
                                        <div className="space-y-1.5 animate-in slide-in-from-top-1 duration-300">
                                            <label className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">Selected Attachments</label>
                                            <div className="flex flex-col gap-2">
                                                {imageUrl && imageUsage === 'attach' && (
                                                    <div className="p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/20 flex items-center gap-3">
                                                        <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600">
                                                            <ImageIcon className="h-4 w-4" />
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-bold text-indigo-700/80">{localImage ? localImage.name : imageUrl}</p>
                                                            <p className="text-[10px] text-indigo-600/60 uppercase tracking-tighter font-extrabold italic">Image as attachment</p>
                                                        </div>
                                                    </div>
                                                )}
                                                {attachment && (
                                                    <div className="p-3 rounded-xl bg-orange-500/5 border border-orange-500/20 flex items-center gap-3">
                                                        <div className={`p-2 rounded-lg ${localAttachment ? 'bg-emerald-500/10 text-emerald-600' : 'bg-orange-500/10 text-orange-600'}`}>
                                                            <Paperclip className="h-4 w-4" />
                                                        </div>
                                                        <div>
                                                            <p className={`text-xs font-bold ${localAttachment ? 'text-emerald-700/80' : 'text-orange-700/80'}`}>{localAttachment ? localAttachment.name : attachment}</p>
                                                            <p className={`text-[10px] uppercase tracking-tighter font-extrabold italic ${localAttachment ? 'text-emerald-600/60' : 'text-orange-600/60'}`}>{localAttachment ? 'Local device upload' : 'Secured attachment'}</p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Bottom Campaign Library */}
            <div className="mt-8">
                <div className="flex items-center gap-2 mb-6">
                    <Library className="h-5 w-5 text-indigo-600" />
                    <h2 className="text-xl font-bold text-foreground">Ready-To-Use Campaigns</h2>
                    <span className="ml-2 text-[10px] font-bold uppercase tracking-widest text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 px-3 py-1.5 rounded-full border border-indigo-100 dark:border-indigo-800">Click a Category</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {CAMPAIGN_CATEGORIES.map((cat) => (
                        <div
                            key={cat.id}
                            onClick={() => setActiveCategory(cat.id)}
                            className="bg-card border rounded-2xl p-6 cursor-pointer group flex flex-col h-full transition-all border-border hover:border-indigo-500/50 hover:shadow-2xl hover:shadow-indigo-500/10 hover:-translate-y-2 duration-300 relative overflow-hidden active:scale-95"
                        >
                            {/* Hover Background Accent */}
                            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/0 via-indigo-500/0 to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />

                            <div className="flex justify-between items-start mb-6 relative z-10">
                                <span className="text-2xl bg-muted p-2.5 rounded-xl border border-border group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-500 group-hover:shadow-lg group-hover:shadow-indigo-500/20 transition-all duration-300 transform group-hover:rotate-12">{cat.icon}</span>
                                <div className="h-9 w-9 rounded-full flex items-center justify-center transition-all bg-muted text-muted-foreground group-hover:bg-indigo-600 group-hover:text-white border border-border group-hover:border-indigo-500 group-hover:shadow-lg group-hover:shadow-indigo-500/20">
                                    <ChevronRight className="h-4 w-4" />
                                </div>
                            </div>
                            <h3 className="font-bold text-foreground text-lg mb-2 relative z-10 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{cat.name}</h3>
                            <p className="text-muted-foreground text-sm flex-1 leading-relaxed relative z-10">{cat.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
