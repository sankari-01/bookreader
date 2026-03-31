import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error("ErrorBoundary caught an error", error, errorInfo);
        this.setState({ error, errorInfo });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ 
                    padding: '40px', 
                    textAlign: 'center', 
                    background: '#fffaf0', 
                    minHeight: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: "'Alice', serif",
                    color: '#4a342e'
                }}>
                    <h1 style={{ fontSize: '2rem', color: '#e74c3c' }}>Oops! Something went wrong.</h1>
                    <p style={{ maxWidth: '600px', margin: '20px 0', lineHeight: '1.6' }}>
                        The magical ink encountered an unexpected blot. We've caught the error and reported it.
                    </p>
                    {this.state.error && (
                        <div style={{ 
                            background: 'white', 
                            padding: '20px', 
                            borderRadius: '12px', 
                            boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                            textAlign: 'left',
                            width: '90%',
                            maxWidth: '800px',
                            overflow: 'auto',
                            maxHeight: '400px',
                            border: '1px solid #d4a373'
                        }}>
                            <p style={{ fontWeight: 'bold', color: '#e74c3c' }}>Error: {this.state.error.toString()}</p>
                            <pre style={{ fontSize: '0.8rem', color: '#6d4c41', whiteSpace: 'pre-wrap' }}>
                                {this.state.errorInfo?.componentStack}
                            </pre>
                        </div>
                    )}
                    <button 
                        onClick={() => window.location.reload()} 
                        style={{ 
                            marginTop: '30px',
                            padding: '12px 30px',
                            background: '#e07a5f',
                            color: 'white',
                            border: 'none',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                        }}
                    >
                        Try Reloading
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
