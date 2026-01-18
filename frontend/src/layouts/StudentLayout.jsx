import React from "react";
import { Outlet } from "react-router-dom";
import MobileNavigation from "../components/common/MobileNavigation";
import DesktopNavigation from "../components/common/DesktopNavigation";
import "./StudentLayout.css";

const StudentLayout = () => {
  return (
    <div className="student-layout">
      {/* Desktop Navigation */}
      <DesktopNavigation userRole="student" />

      {/* Main Content */}
      <main className="main-content">
        <Outlet />
      </main>

      {/* Mobile Navigation (bottom bar + top bar) */}
      <MobileNavigation userRole="student" />
    </div>
  );
};

export default StudentLayout;
