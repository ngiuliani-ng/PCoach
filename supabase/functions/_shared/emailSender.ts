// Interfaccia astratta per l'invio di email, cosi' il provider (Resend) resta
// sostituibile senza toccare la logica della Edge Function weekly-feedback.
export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

export type EmailSendResult = { ok: true } | { ok: false; error: string };

export interface EmailSender {
  send(message: EmailMessage): Promise<EmailSendResult>;
}
