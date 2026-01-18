/* eslint-disable */
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiCheckCircle,
  FiAlertCircle,
  FiAlertTriangle,
  FiInfo,
  FiLoader,
  FiX,
  FiBell,
} from "react-icons/fi";
import toast from "../../services/toastService";
import "./ToastContainer.css";

/**
 * Premium Toast Container
 * Aurora theme with glassmorphism design
 */
const ToastContainer = () => {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const unsubscribe = toast.subscribe((notification) => {
      if (notification.type === "dismiss") {
        setToasts((prev) => prev.filter((t) => t.id !== notification.id));
      } else if (notification.type === "clearAll") {
        setToasts([]);
      } else {
        setToasts((prev) => [...prev, notification]);

        if (notification.duration > 0) {
          setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== notification.id));
          }, notification.duration);
        }
      }
    });

    return unsubscribe;
  }, []);

  const handleDismiss = (toastId) => {
    setToasts((prev) => prev.filter((t) => t.id !== toastId));
  };

  return (
    <div className="toast-container">
      <AnimatePresence>
        {toasts.map((notification) => (
          <Toast
            key={notification.id}
            notification={notification}
            onDismiss={() => handleDismiss(notification.id)}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

/**
 * Premium Toast Component with Aurora Theme
 */
const Toast = ({ notification, onDismiss }) => {
  const getIcon = (type) => {
    const iconProps = { className: "toast-icon-svg" };
    switch (type) {
      case "error":
        return <FiAlertCircle {...iconProps} />;
      case "success":
        return <FiCheckCircle {...iconProps} />;
      case "warning":
        return <FiAlertTriangle {...iconProps} />;
      case "info":
        return <FiInfo {...iconProps} />;
      case "loading":
        return <FiLoader {...iconProps} className="toast-icon-svg spinning" />;
      default:
        return <FiBell {...iconProps} />;
    }
  };

  const getTitle = (type) => {
    switch (type) {
      case "error":
        return "Error";
      case "success":
        return "Success";
      case "warning":
        return "Warning";
      case "info":
        return "Information";
      case "loading":
        return "Loading";
      default:
        return "Notification";
    }
  };

  return (
    <motion.div
      className={`toast toast-${notification.type}`}
      initial={{ opacity: 0, x: 100, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.9, transition: { duration: 0.2 } }}
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 30,
        mass: 0.8,
      }}
      layout
    >
      {/* Icon with Glow Background */}
      <div className="toast-icon-wrapper">{getIcon(notification.type)}</div>

      {/* Content */}
      <div className="toast-content">
        <div className="toast-title">{getTitle(notification.type)}</div>
        <div className="toast-message">{notification.message}</div>
      </div>

      {/* Close Button */}
      <button
        className="toast-close"
        onClick={onDismiss}
        aria-label="Dismiss notification"
      >
        <FiX size={14} />
      </button>

      {/* Progress Bar */}
      {notification.duration > 0 && (
        <motion.div
          className="toast-progress"
          initial={{ width: "100%" }}
          animate={{ width: "0%" }}
          transition={{
            duration: notification.duration / 1000,
            ease: "linear",
          }}
        />
      )}
    </motion.div>
  );
};

export default ToastContainer;
