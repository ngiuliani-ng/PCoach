// Implementazione di EmailSender basata su Resend (https://resend.com/docs/api-reference/emails/send-email).
// La API key Resend vive solo come secret della Edge Function (RESEND_API_KEY), mai nel DB/client.
import type { EmailMessage, EmailSender, EmailSendResult } from "./emailSender.ts";

const RESEND_API_URL = "https://api.resend.com/emails";

export class ResendEmailSender implements EmailSender {
  constructor(private apiKey: string, private fromAddress: string) {}

  async send(message: EmailMessage): Promise<EmailSendResult> {
    try {
      const res = await fetch(RESEND_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: this.fromAddress,
          to: [message.to],
          subject: message.subject,
          text: message.text
        })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        return { ok: false, error: data?.message || `Errore Resend (${res.status}).` };
      }
      return { ok: true };
    } catch {
      return { ok: false, error: "Impossibile contattare Resend (rete)." };
    }
  }
}
