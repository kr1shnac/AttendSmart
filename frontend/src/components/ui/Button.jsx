/* eslint-disable */
import React from "react";
import "./Button.css";

const Button = ({
  children,
  variant = "primary",
  size = "medium",
  icon,
  iconPosition = "left",
  loading = false,
  disabled = false,
  fullWidth = false,
  onClick,
  type = "button",
  className = "",
}) => {
  const buttonClasses = [
    "btn",
    `btn-${variant}`,
    `btn-${size}`,
    fullWidth && "btn-full-width",
    loading && "btn-loading",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type={type}
      className={buttonClasses}
      onClick={onClick}
      disabled={disabled || loading}
    >
      {loading && <span className="button-spinner"></span>}

      {!loading && icon && iconPosition === "left" && (
        <span className="btn-icon">{icon}</span>
      )}

      <span className="btn-text">{children}</span>

      {!loading && icon && iconPosition === "right" && (
        <span className="btn-icon">{icon}</span>
      )}
    </button>
  );
};

export default Button;
