import React from "react";
import PropTypes from "prop-types";
import { FiAlertTriangle, FiRefreshCw, FiHome } from "react-icons/fi";
import "./ErrorBoundary.css";

/**
 * Global Error Boundary Component
 * Catches JavaScript errors anywhere in the child component tree,
 * logs errors, and displays a fallback UI instead of crashing.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render shows the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log error details for debugging
    console.error("ErrorBoundary caught an error:", error);
    console.error("Component stack:", errorInfo.componentStack);

    this.setState({ errorInfo });

    // In production, you would send this to an error monitoring service
    if (process.env.NODE_ENV === "production") {
      // TODO: Send to error monitoring service (e.g., Sentry)
      console.error("Production error logged:", {
        error: error.toString(),
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
      });
    }
  }

  handleReload = () => {
    // Clear error state and reload
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  handleGoHome = () => {
    // Clear error state and navigate home
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-boundary-content glass-morphism">
            <div className="error-icon-wrapper">
              <FiAlertTriangle className="error-icon" />
            </div>
            <h1 className="error-title">Something went wrong</h1>
            <p className="error-message">
              We encountered an unexpected error. Don&apos;t worry, your data is
              safe.
            </p>

            {process.env.NODE_ENV !== "production" && this.state.error && (
              <details className="error-details">
                <summary>▶ Error Details (Development Only)</summary>
                <pre>{this.state.error.toString()}</pre>
                {this.state.errorInfo && (
                  <pre>{this.state.errorInfo.componentStack}</pre>
                )}
              </details>
            )}

            <div className="error-actions">
              <button className="btn-primary" onClick={this.handleReload}>
                <FiRefreshCw /> Reload Page
              </button>
              <button className="btn-secondary" onClick={this.handleGoHome}>
                <FiHome /> Go to Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

ErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired,
};

export default ErrorBoundary;
