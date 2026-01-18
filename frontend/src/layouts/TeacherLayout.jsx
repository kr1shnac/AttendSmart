import React from "react";
import { Outlet } from "react-router-dom";
import MobileNavigation from "../components/common/MobileNavigation";
import DesktopNavigation from "../components/common/DesktopNavigation";
import "./TeacherLayout.css";

const TeacherLayout = () => {
  return (
    <div className="teacher-layout">
      {/* Desktop Navigation */}
      <DesktopNavigation userRole="teacher" />

      {/* Main Content */}
      <main className="main-content">
        <Outlet />
      </main>

      {/* Mobile Navigation (bottom bar + top bar) */}
      <MobileNavigation userRole="teacher" />
    </div>
  );
};

export default TeacherLayout;
