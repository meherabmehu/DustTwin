export type ContactPayload = {
  name: string;
  organization: string;
  email: string;
  subject: string;
  message: string;
};

/**
 * Demo adapter: validates and accepts submissions locally. Replace this function with
 * a secured API/email provider integration when a backend is available.
 */
export async function submitContactMessage(payload: ContactPayload): Promise<{ ok: boolean; message: string }> {
  await new Promise((resolve) => window.setTimeout(resolve, 450));
  if (!payload.name.trim() || !payload.email.trim() || !payload.subject || !payload.message.trim()) {
    return { ok: false, message: 'Please complete all required fields before sending.' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
    return { ok: false, message: 'Please enter a valid email address.' };
  }
  return { ok: true, message: 'Thanks — your message is ready. This demo form is not connected to an email service yet.' };
}
