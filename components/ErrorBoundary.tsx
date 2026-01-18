import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
                    <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
                        <h1 className="text-2xl font-bold text-gray-900 mb-4">Something went wrong</h1>
                        <p className="text-gray-600 mb-6">We're sorry, but an unexpected error occurred.</p>
                        <button
                            onClick={() => window.location.reload()}
                            className="bg-brand-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-brand-700 transition-colors w-full"
                        >
                            Reload Application
                        </button>
                        {process.env.NODE_ENV === 'development' && this.state.error && (
                            <div className="mt-8 text-left bg-gray-100 p-4 rounded-lg overflow-auto max-h-48 text-xs text-red-600 font-mono">
                                {this.state.error.toString()}
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
