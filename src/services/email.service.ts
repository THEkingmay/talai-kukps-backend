import nodemailer from "nodemailer";

class EmailService {
    private transporter: nodemailer.Transporter;

    constructor() {
        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT),
            secure: process.env.SMTP_SECURE === "true",
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASSWORD,
            },
        });
    }

    async sendEmail(to: string, subject: string, text: string): Promise<void> {
        const mailOptions = {
            to,
            subject,
            text,
        };

        await this.transporter.sendMail(mailOptions);
    }
}
export default new EmailService();
