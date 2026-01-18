/**
 * Format email for display purposes.
 * Replaces @gmail.com with @attendsmart.com.
 *
 * @param {string} email - The email to format
 * @returns {string} - The formatted email
 */
export const formatEmail = (email) => {
  if (!email) return "";
  // Check if it's a gmail address and replace
  return email.replace(/@gmail\.com$/i, "@attendsmart.com");
};

/**
 * Get original email from formatted email (reverse operation if needed)
 * Note: This is a best-effort, as we can't be 100% sure the original was gmail
 * but based on our specific requirement, we assume it is.
 *
 * @param {string} formattedEmail
 * @returns {string}
 */
export const getOriginalEmail = (formattedEmail) => {
  if (!formattedEmail) return "";
  return formattedEmail.replace(/@attendsmart\.com$/i, "@gmail.com");
};
