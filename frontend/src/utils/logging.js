export const logInfo = (message, data) => {
  console.log(`[INFO] ${message}`, data || "");
};

export const logError = (message, error) => {
  console.error(`[ERROR] ${message}`, error || "");
};

export const logWarning = (message, data) => {
  console.warn(`[WARN] ${message}`, data || "");
};

export const sendLog = async (logData) => {
  const { action, eventDescription, severity, metadata } = logData;
  const timestamp = new Date().toISOString();
  console.log(`[${severity.toUpperCase()}] ${action}: ${eventDescription}`, {
    timestamp,
    metadata,
  });
  // In a real app, you might send this to a backend logging service here
};
