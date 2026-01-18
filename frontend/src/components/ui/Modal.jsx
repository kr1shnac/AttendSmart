/* eslint-disable */
import React from "react";
import PropTypes from "prop-types";
import { motion, AnimatePresence } from "framer-motion";
import "./Modal.css";

const Modal = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  size = "medium", // 'small', 'medium', 'large', 'fullscreen'
  showCloseButton = true,
  closeOnOverlayClick = true,
  footer,
}) => {
  const handleOverlayClick = () => {
    if (closeOnOverlayClick) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleOverlayClick}
        >
          <motion.div
            className={`modal-container glass-morphism modal-${size}`}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            {(title || showCloseButton) && (
              <div className="modal-header">
                <div className="modal-title-section">
                  {title && <h2 className="modal-title">{title}</h2>}
                  {subtitle && <p className="modal-subtitle">{subtitle}</p>}
                </div>
                {showCloseButton && (
                  <button
                    className="modal-close-btn"
                    onClick={onClose}
                    aria-label="Close modal"
                  >
                    ✕
                  </button>
                )}
              </div>
            )}

            {/* Modal Body */}
            <div className="modal-body">{children}</div>

            {/* Modal Footer (optional) */}
            {footer && <div className="modal-footer">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

Modal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  title: PropTypes.string,
  subtitle: PropTypes.string,
  children: PropTypes.node.isRequired,
  size: PropTypes.string,
  showCloseButton: PropTypes.bool,
  closeOnOverlayClick: PropTypes.bool,
  footer: PropTypes.node,
};

export default Modal;
