import nodemailer from "nodemailer";


interface TemplateOptions {
    title: string;
    content: string; // HTML or Text content
    preheader?: string;
    actionButton?: {
        text: string;
        url: string;
    };
    codeBox?: string;
}

class EmailService {
    private transporter: nodemailer.Transporter | undefined;

    connect() {
        const port = Number(process.env.SMTP_PORT) || 587;

        const secure = process.env.SMTP_SECURE !== undefined
            ? process.env.SMTP_SECURE === "true" && port === 465
            : port === 465;

        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port,
            secure,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASSWORD,
            },
        });
    }

    private ensureConnected() {
        if (!this.transporter) {
            this.connect();
        }
    }

    async sendEmail(to: string, subject: string, text: string, html?: string): Promise<void> {
        this.ensureConnected();

        const mailOptions: nodemailer.SendMailOptions = {
            from: process.env.SMTP_FROM || `KUKPS Talai System <${process.env.SMTP_USER}>`,
            to,
            subject,
            text,
            html: html || this.createBaseTemplate({ title: subject, content: text }),
        };

        await this.transporter!.sendMail(mailOptions);
    }

    createBaseTemplate({ title, content, preheader, actionButton, codeBox }: TemplateOptions): string {
        const year = new Date().getFullYear();

        const buttonHtml = actionButton
            ? `
            <div style="margin: 30px 0; text-align: center;">
                <a href="${actionButton.url}" target="_blank" style="background-color: #059669; color: #ffffff; padding: 14px 28px; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 8px; display: inline-block; box-shadow: 0 4px 12px rgba(5, 150, 105, 0.25);">
                    ${actionButton.text}
                </a>
            </div>`
            : "";

        const codeBoxHtml = codeBox
            ? `
            <div style="background-color: #f1f5f9; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 16px; text-align: center; margin: 24px 0;">
                <span style="font-size: 13px; color: #64748b; display: block; margin-bottom: 6px; font-weight: 500;">รหัสเชิญ / OTP:</span>
                <span style="font-family: 'Courier New', Courier, monospace; font-size: 24px; font-weight: 700; color: #0f172a; letter-spacing: 4px;">${codeBox}</span>
            </div>`
            : "";

        return `<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; -webkit-font-smoothing: antialiased;">
    <div style="display: none; font-size: 1px; color: #f8fafc; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
        ${preheader || title}
    </div>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f8fafc; padding: 40px 16px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 560px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01); border: 1px solid #e2e8f0;">

                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 32px 36px; text-align: center;">
                            <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">
                                🚌 KUKPS Talai System
                            </h1>
                            <p style="margin: 6px 0 0 0; font-size: 13px; color: #d1fae5; font-weight: 400;">
                                ระบบบริหารจัดการรถตะไล มหาวิทยาลัยเกษตรศาสตร์ วิทยาเขตกำแพงแสน
                            </p>
                        </td>
                    </tr>

                    <!-- Body Content -->
                    <tr>
                        <td style="padding: 36px 36px 28px 36px;">
                            <h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #0f172a;">
                                ${title}
                            </h2>
                            <div style="font-size: 15px; line-height: 1.6; color: #334155;">
                                ${content}
                            </div>

                            ${codeBoxHtml}
                            ${buttonHtml}
                        </td>
                    </tr>

                    <!-- Divider -->
                    <tr>
                        <td style="padding: 0 36px;">
                            <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 0;">
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding: 20px 36px 28px 36px; text-align: center; font-size: 12px; color: #94a3b8; line-height: 1.5;">
                            <p style="margin: 0 0 4px 0;">
                                อีเมลนี้เป็นการแจ้งเตือนจากระบบอัตโนมัติ กรุณาอย่าตอบกลับอีเมลนี้
                            </p>
                            <p style="margin: 0;">
                                &copy; ${year} KUKPS Talai System. All rights reserved.
                            </p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
    }

    async sendAdminInviteEmail(to: string, inviteCode: string, registerUrl?: string): Promise<void> {
        const subject = "คำเชิญเข้าใช้งานระบบผู้ดูแลระบบ (Admin) - KUKPS Talai";
        const content = `
            <p>สวัสดีครับ/ค่ะ,</p>
            <p>คุณได้รับคำเชิญเข้าร่วมเป็นผู้ดูแลระบบ (Admin) สำหรับ <b>KUKPS Talai System</b></p>
            <p>กรุณานำรหัสเชิญด้านล่างนี้ไปลงทะเบียนเพื่อเข้าใช้งานระบบ</p>
        `;

        const html = this.createBaseTemplate({
            title: "คำเชิญสิทธิ์ผู้ดูแลระบบ (Admin Invite)",
            preheader: `คุณได้รับการเชิญเป็น Admin รหัสเชิญของคุณคือ ${inviteCode}`,
            content,
            codeBox: inviteCode,
            actionButton: registerUrl
                ? {
                      text: "ลงทะเบียนบัญชี Admin",
                      url: registerUrl,
                  }
                : undefined,
        });

        await this.sendEmail(to, subject, `คุณได้รับการเชิญเป็น Admin รหัสเชิญของคุณคือ: ${inviteCode}`, html);
    }

    async sendResetPasswordEmail(to: string, resetLink: string): Promise<void> {
        const subject = "คำขอกำหนดรหัสผ่านใหม่ (Reset Password) - KUKPS Talai";
        const content = `
            <p>สวัสดีครับ/ค่ะ,</p>
            <p>คุณได้ทำการร้องขอกำหนดรหัสผ่านใหม่สำหรับบัญชี <b>KUKPS Talai System</b></p>
            <p>กรุณาคลิกปุ่มด้านล่างเพื่อทำการตั้งรหัสผ่านใหม่</p>
            <p style="color: #ef4444; font-size: 13px; margin-top: 16px;">* ลิงก์นี้จะหมดอายุภายใน 15 นาที</p>
            <p style="color: #64748b; font-size: 13px;">หากคุณไม่ได้เป็นผู้ส่งคำขอนี้ สามารถละทิ้งอีเมลนี้ได้โดยปลอดภัย รหัสผ่านของคุณจะไม่ถูกเปลี่ยนแปลง</p>
        `;

        const html = this.createBaseTemplate({
            title: "ตั้งรหัสผ่านใหม่ (Reset Password)",
            preheader: "คำขอกำหนดรหัสผ่านใหม่สำหรับบัญชี KUKPS Talai System",
            content,
            actionButton: {
                text: "ตั้งรหัสผ่านใหม่",
                url: resetLink,
            },
        });

        const text = `คุณได้ทำการร้องขอกำหนดรหัสผ่านใหม่ กรุณากดที่ลิงก์นี้เพื่อตั้งรหัสผ่านใหม่: ${resetLink} (ลิงก์มีอายุ 15 นาที)`;

        await this.sendEmail(to, subject, text, html);
    }
}

export default new EmailService();

