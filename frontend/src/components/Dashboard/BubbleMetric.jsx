import React from "react";
import { motion } from "framer-motion";
import "./BubbleMetric.css";

const BubbleMetric = ({ metric, delay = 0 }) => {
  const { label, value, total, icon, color } = metric;

  // Calculate percentage for circular progress
  const percentage = total > 0 ? (value / total) * 100 : value;
  const circumference = 2 * Math.PI * 45; // radius = 45
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <motion.div
      className="bubble-metric"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, type: "spring", stiffness: 100 }}
      whileHover={{ scale: 1.05 }}
    >
      <div className="bubble-content glass-morphism">
        {/* Circular Progress */}
        <div className="bubble-circle">
          <svg width="120" height="120" viewBox="0 0 120 120">
            {/* Background circle */}
            <circle
              cx="60"
              cy="60"
              r="45"
              fill="none"
              stroke="rgba(255, 255, 255, 0.05)"
              strokeWidth="8"
            />

            {/* Progress circle */}
            <motion.circle
              cx="60"
              cy="60"
              r="45"
              fill="none"
              stroke={color}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference}
              animate={{ strokeDashoffset }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              style={{
                transform: "rotate(-90deg)",
                transformOrigin: "60px 60px",
              }}
            />
          </svg>

          {/* Center content */}
          <div className="bubble-center">
            <span className="bubble-icon">{icon}</span>
            <motion.span
              className="bubble-value"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: delay + 0.5 }}
            >
              {value}
              {total === 100 && "%"}
            </motion.span>
          </div>
        </div>

        {/* Label */}
        <p className="bubble-label">{label}</p>

        {/* Additional info */}
        {total !== 100 && total > 0 && (
          <p className="bubble-info">of {total} total</p>
        )}
      </div>

      {/* Glow effect */}
      <div className="bubble-glow" style={{ backgroundColor: color }}></div>
    </motion.div>
  );
};

export default BubbleMetric;
