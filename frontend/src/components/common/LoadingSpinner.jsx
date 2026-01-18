import React from "react";
import PropTypes from "prop-types";
import "./LoadingSpinner.css";

/**
 * Loading Spinner Component
 * Used as Suspense fallback for lazy-loaded routes
 */
const LoadingSpinner = ({ message = "Loading..." }) => {
  return (
    <div className="loading-spinner-container">
      <div className="loading-spinner">
        <div className="spinner-ring"></div>
        <div className="spinner-ring"></div>
        <div className="spinner-ring"></div>
      </div>
      <p className="loading-message">{message}</p>
    </div>
  );
};

LoadingSpinner.propTypes = {
  message: PropTypes.string,
};

export default LoadingSpinner;
