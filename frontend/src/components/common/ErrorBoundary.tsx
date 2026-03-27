import * as React from "react";
import { AlertCircle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = "/";
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
          <div className="max-w-md w-full bg-card border border-border rounded-3xl p-8 shadow-2xl text-center space-y-6 animate-in fade-in zoom-in duration-300">
            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-2">
              <AlertCircle className="h-10 w-10 text-red-500" />
            </div>
            
            <div className="space-y-2">
              <h1 className="text-2xl font-black tracking-tight text-foreground">Something went wrong</h1>
              <p className="text-muted-foreground text-sm font-medium">
                The application encountered an unexpected runtime error. We've logged the issue.
              </p>
            </div>

            {process.env.NODE_ENV === "development" && (
              <div className="text-left bg-muted/50 p-4 rounded-xl border border-border/50 max-h-40 overflow-y-auto">
                <p className="text-[10px] font-mono text-red-400 break-all leading-relaxed">
                  {this.state.error?.toString()}
                </p>
              </div>
            )}

            <div className="flex flex-col gap-3 pt-4">
              <Button 
                onClick={() => window.location.reload()}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-12 font-bold shadow-lg shadow-indigo-500/20 gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Try Refreshing
              </Button>
              
              <Button 
                variant="outline"
                onClick={this.handleReset}
                className="w-full border-border bg-transparent hover:bg-muted text-foreground rounded-xl h-12 font-bold gap-2"
              >
                <Home className="h-4 w-4" />
                Return Home
              </Button>
            </div>
            
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 pt-4">
              Error ID: {Math.random().toString(36).substring(7).toUpperCase()}
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
