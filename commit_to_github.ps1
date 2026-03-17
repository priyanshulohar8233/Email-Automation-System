$env:Path += ";C:\Users\User\AppData\Local\GitHubDesktop\bin"
cd "d:\Email-Automation-System_2.0"
git add .
git commit -m "REBRAND: VELTRION platform rebranding & dashboard sync fix.
- Updated branding across the system (Name, Logo, Tagline).
- Refined sidebar header layout and spacing.
- Fixed SQL aggregation error in dashboard stats services.
- Standardized DashboardStats schema for Pydantic validation.
- Updated CORS and TrustedHosts for Vercel production domains."
git push origin main
