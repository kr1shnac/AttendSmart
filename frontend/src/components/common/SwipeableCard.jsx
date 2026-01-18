/* eslint-disable */
import React, { useState } from "react";
import PropTypes from "prop-types";
import { motion, useMotionValue, useTransform } from "framer-motion";
import "./SwipeableCard.css";

const SwipeableCard = ({ children, onSwipeLeft, onSwipeRight, onTap }) => {
  const [isDragging, setIsDragging] = useState(false);
  const x = useMotionValue(0);

  const leftOpacity = useTransform(x, [-150, -50, 0], [1, 0.5, 0]);
  const rightOpacity = useTransform(x, [0, 50, 150], [0, 0.5, 1]);

  const handleDragEnd = (event, info) => {
    setIsDragging(false);

    const threshold = 100;

    if (info.offset.x > threshold && onSwipeRight) {
      onSwipeRight();
    } else if (info.offset.x < -threshold && onSwipeLeft) {
      onSwipeLeft();
    }
  };

  return (
    <motion.div
      className="swipeable-card"
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.7}
      onDragStart={() => setIsDragging(true)}
      onDragEnd={handleDragEnd}
      onTap={() => !isDragging && onTap && onTap()}
      style={{ x }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Left Swipe Indicator */}
      <motion.div
        className="swipe-indicator left"
        style={{ opacity: leftOpacity }}
      >
        <span>📋 Details</span>
      </motion.div>

      {/* Right Swipe Indicator */}
      <motion.div
        className="swipe-indicator right"
        style={{ opacity: rightOpacity }}
      >
        <span>✓ Check In</span>
      </motion.div>

      {children}
    </motion.div>
  );
};

SwipeableCard.propTypes = {
  children: PropTypes.node.isRequired,
  onSwipeLeft: PropTypes.func,
  onSwipeRight: PropTypes.func,
  onTap: PropTypes.func,
};

export default SwipeableCard;
