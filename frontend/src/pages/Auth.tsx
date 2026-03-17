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
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4 transition-colors duration-300">
      <Card className="w-full max-w-md border-border bg-card">
        <CardHeader className="space-y-4 items-center text-center pt-8 pb-4">
          <div className="flex flex-col items-center gap-4">
            <div className="h-32 w-32 overflow-hidden rounded-2xl bg-indigo-600/5 p-1.5 shadow-xl border border-indigo-600/10 animate-in zoom-in-50 duration-500">
              <img 
                src="/veltrion-logo.png" 
                alt="VELTRION Logo" 
                className="h-full w-full object-contain"
              />
            </div>
            <div className="space-y-1">
              <span className="text-4xl font-black tracking-tighter text-foreground block">VELTRION</span>
              <p className="text-xs font-semibold text-muted-foreground/80 uppercase tracking-widest">
                Intelligent Email Automation System
              </p>
            </div>
          </div>
          <CardTitle className="text-2xl">{isLogin ? "Welcome back" : "Create an account"}</CardTitle>
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
            <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white border-none shadow-md" type="submit">
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
