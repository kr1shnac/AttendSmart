import React, { useState } from "react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import toast from "../../services/toastService";
import "./Timetable.css";

const Timetable = ({ sessions }) => {
  const [selectedEvent, setSelectedEvent] = useState(null);

  // Map sessions to FullCalendar event format
  const events = sessions.map((session) => ({
    id: session.id,
    title: session.subject,
    start: session.startTime, // should be ISO string e.g. '2025-11-19T10:00:00'
    end: session.endTime,
  }));

  const handleEventClick = (info) => {
    setSelectedEvent(info.event);
    toast.info(`Session: ${info.event.title}`);
  };

  const handleSelectTime = (info) => {
    toast.info(`Selected from ${info.startStr} to ${info.endStr}`);
  };

  return (
    <div className="timetable-container">
      <FullCalendar
        plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "timeGridWeek,dayGridMonth",
        }}
        events={events}
        eventClick={handleEventClick}
        selectable={true}
        select={handleSelectTime}
        height="auto"
      />
    </div>
  );
};

export default Timetable;
