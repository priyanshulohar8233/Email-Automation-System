import { useState } from "react";
import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const navigate = useNavigate();

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate auth
    navigate("/");
  };

  return (
    <div className="apple-app-shell min-h-screen flex items-center justify-center bg-background p-4 transition-colors duration-300">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.12),transparent_24%)] pointer-events-none" />
      <Card className="relative w-full max-w-md border-border/70 bg-card/85">
        <CardHeader className="space-y-1 items-center text-center">
          <div className="mb-3 flex items-center gap-3 text-indigo-600">
            <div className="apple-icon-chip flex h-14 w-14 items-center justify-center rounded-[20px] border border-white/10 text-indigo-500">
              <Zap className="h-7 w-7 fill-current" />
            </div>
            <div className="text-left">
              <span className="block text-2xl font-semibold tracking-[-0.04em] text-foreground">MailFlow</span>
              <span className="block text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Apple-grade outreach OS</span>
            </div>
          </div>
          <CardTitle className="text-[2rem]">{isLogin ? "Welcome back" : "Create an account"}</CardTitle>
          <CardDescription className="text-muted-foreground">
            {isLogin ? "Enter your email to sign in to your account" : "Enter your email below to create your account"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none text-foreground">Name</label>
                <Input placeholder="John Doe" required className="bg-muted/50 border-border focus:bg-card" />
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none text-foreground">Email</label>
              <Input type="email" placeholder="m@example.com" required className="bg-muted/50 border-border focus:bg-card" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium leading-none text-foreground">Password</label>
                {isLogin && <a href="#" className="text-sm text-indigo-600 hover:underline">Forgot password?</a>}
              </div>
              <Input type="password" required className="bg-muted/50 border-border focus:bg-card" />
            </div>
            {!isLogin && (
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none text-foreground">Confirm Password</label>
                <Input type="password" required className="bg-muted/50 border-border focus:bg-card" />
              </div>
            )}
            <Button className="w-full" type="submit">
              {isLogin ? "Sign In" : "Create Account"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <div className="relative w-full">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 w-full">
            <Button variant="outline">Github</Button>
            <Button variant="outline">Google</Button>
          </div>
          <div className="text-center text-sm text-muted-foreground mt-2">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button
              className="text-indigo-600 hover:underline font-medium"
              onClick={() => setIsLogin(!isLogin)}
            >
              {isLogin ? "Sign up" : "Sign in"}
            </button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
