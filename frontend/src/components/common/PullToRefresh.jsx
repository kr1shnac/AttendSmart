/* eslint-disable */
import React, { useState, useRef, useEffect } from "react";
import PropTypes from "prop-types";
import "./PullToRefresh.css";

const PullToRefresh = ({ onRefresh, children }) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef(0);
  const containerRef = useRef(null);

  const PULL_THRESHOLD = 80; // Distance to trigger refresh

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleTouchStart = (e) => {
      if (window.scrollY === 0) {
        startY.current = e.touches[0].clientY;
      }
    };

    const handleTouchMove = (e) => {
      if (startY.current === 0 || window.scrollY > 0) return;

      const currentY = e.touches[0].clientY;
      const distance = currentY - startY.current;

      if (distance > 0 && distance < 150) {
        e.preventDefault();
        setPullDistance(distance);
      }
    };

    const handleTouchEnd = async () => {
      if (pullDistance > PULL_THRESHOLD && !isRefreshing) {
        setIsRefreshing(true);

        // Call refresh function
        if (onRefresh) {
          await onRefresh();
        }

        // Wait minimum time for visual feedback
        await new Promise((resolve) => setTimeout(resolve, 1000));

        setIsRefreshing(false);
      }

      setPullDistance(0);
      startY.current = 0;
    };

    container.addEventListener("touchstart", handleTouchStart, {
      passive: true,
    });
    container.addEventListener("touchmove", handleTouchMove, {
      passive: false,
    });
    container.addEventListener("touchend", handleTouchEnd);

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
    };
  }, [pullDistance, isRefreshing, onRefresh]);

  const getRotation = () => {
    return Math.min((pullDistance / PULL_THRESHOLD) * 360, 360);
  };

  const getOpacity = () => {
    return Math.min(pullDistance / PULL_THRESHOLD, 1);
  };

  return (
    <div ref={containerRef} className="pull-to-refresh-container">
      <div
        className={`pull-indicator ${isRefreshing ? "refreshing" : ""}`}
        style={{
          transform: `translateY(${Math.min(pullDistance - 40, 40)}px)`,
          opacity: getOpacity(),
        }}
      >
        <div
          className="refresh-icon"
          style={{
            transform: `rotate(${isRefreshing ? 0 : getRotation()}deg)`,
          }}
        >
          {isRefreshing ? <div className="spinner-refresh" /> : <span>↓</span>}
        </div>
        <span className="refresh-text">
          {isRefreshing
            ? "Refreshing..."
            : pullDistance > PULL_THRESHOLD
            ? "Release to refresh"
            : "Pull to refresh"}
        </span>
      </div>

      {children}
    </div>
  );
};

PullToRefresh.propTypes = {
  onRefresh: PropTypes.func.isRequired,
  children: PropTypes.node.isRequired,
};

export default PullToRefresh;
