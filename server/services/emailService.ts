import { createTransport } from 'nodemailer'
import { config } from '../config'

// Singleton: created ONCE at module load. Avoids 200-800ms TLS handshake per request.
const transporter = createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // STARTTLS — must be false for port 587
  auth: {
    user: config.gmailUser,
    pass: config.gmailAppPassword, // CRITICAL: "pass" not "password"
  },
})

export interface SendResult {
  success: boolean
  messageId?: string
  error?: string
}

export async function send(to: string): Promise<SendResult> {
  try {
    const info = await transporter.sendMail({
      from: config.gmailUser,
      to,
      subject: config.emailSubject,
      text: config.emailBody,
      attachments: config.attachments,
    })
    return { success: true, messageId: info.messageId }
  } catch (err: any) {
    const errorCode = err.responseCode ?? err.code ?? 'UNKNOWN'
    console.error(`[emailService] Send failed to ${to}:`, errorCode, err.message)
    return { success: false, error: `${errorCode}: ${err.message}` }
  }
}
