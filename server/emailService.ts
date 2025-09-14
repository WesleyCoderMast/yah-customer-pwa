import nodemailer from 'nodemailer';

export interface EmailConfig {
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  };
  from: {
    name: string;
    email: string;
  };
}

// Default configuration - can be overridden with environment variables
const defaultConfig: EmailConfig = {
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
    },
  },
  from: {
    name: process.env.FROM_NAME || 'Yah Support',
    email: process.env.FROM_EMAIL || 'admin@yahapp.online',
  },
};

class EmailService {
  private transporter: nodemailer.Transporter;
  private config: EmailConfig;

  constructor(config?: Partial<EmailConfig>) {
    this.config = { ...defaultConfig, ...config };
    this.transporter = nodemailer.createTransport(this.config.smtp);
  }

  async sendConfirmationEmail(to: string, name: string, userId: string, confirmationUrl?: string): Promise<void> {
    const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
    const confirmUrl = confirmationUrl || `${baseUrl}/email-confirmed?token=${userId}&email=${encodeURIComponent(to)}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Yah - Confirm Your Email</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f8f9fa; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .email-card { background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); overflow: hidden; }
          .header { background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); color: white; padding: 40px 30px; text-align: center; }
          .logo { width: 80px; height: 80px; background: #fbbf24; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 36px; }
          .content { padding: 40px 30px; }
          .button { display: inline-block; background: #fbbf24; color: #1e3a8a; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 20px 0; }
          .footer { background: #f1f5f9; padding: 20px 30px; text-align: center; color: #64748b; font-size: 14px; }
          .divider { height: 1px; background: #e2e8f0; margin: 30px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="email-card">
            <div class="header">
              <div class="logo">👑</div>
              <h1 style="margin: 0; font-size: 28px;">Welcome to Yah!</h1>
              <p style="margin: 10px 0 0; opacity: 0.9;">Premium Ride Experience</p>
            </div>
            
            <div class="content">
              <h2 style="color: #1e3a8a; margin-bottom: 20px;">Hi ${name}!</h2>
              
              <p style="color: #374151; line-height: 1.6; margin-bottom: 20px;">
                Thank you for signing up for Yah! We're excited to provide you with premium ride experiences.
              </p>
              
              <p style="color: #374151; line-height: 1.6; margin-bottom: 30px;">
                To get started, please confirm your email address by clicking the button below:
              </p>
              
              <div style="text-align: center;">
                <a href="${confirmUrl}" class="button">Confirm Your Email</a>
              </div>
              
              <div class="divider"></div>
              
              <p style="color: #6b7280; font-size: 14px; line-height: 1.5;">
                If the button above doesn't work, you can copy and paste this link into your browser:<br>
                <a href="${confirmUrl}" style="color: #3b82f6; word-break: break-all;">${confirmUrl}</a>
              </p>
              
              <div class="divider"></div>
              
              <p style="color: #6b7280; font-size: 14px; line-height: 1.5;">
                Once confirmed, you'll be able to:
              </p>
              <ul style="color: #6b7280; font-size: 14px;">
                <li>Book premium rides instantly</li>
                <li>Track your journey in real-time</li>
                <li>Access our AI-powered customer support</li>
                <li>Enjoy luxury vehicle options</li>
              </ul>
            </div>
            
            <div class="footer">
              <p style="margin: 0;">This email was sent from Yah Customer App</p>
              <p style="margin: 5px 0 0;">If you didn't create an account, please ignore this email.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const textContent = `
      Welcome to Yah!
      
      Hi ${name},
      
      Thank you for signing up for Yah! We're excited to provide you with premium ride experiences.
      
      To get started, please confirm your email address by visiting this link:
      ${confirmUrl}
      
      Once confirmed, you'll be able to:
      • Book premium rides instantly
      • Track your journey in real-time
      • Access our AI-powered customer support
      • Enjoy luxury vehicle options
      
      If you didn't create an account, please ignore this email.
      
      Best regards,
      The Yah Team
    `;

    const mailOptions = {
      from: `${this.config.from.name} <${this.config.from.email}>`,
      to,
      subject: 'Welcome to Yah - Confirm Your Email',
      text: textContent,
      html: htmlContent,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`Confirmation email sent to ${to}`);
    } catch (error) {
      console.error('Failed to send confirmation email:', error);
      throw new Error('Failed to send confirmation email');
    }
  }

  async sendWelcomeEmail(to: string, name: string): Promise<void> {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Account Activated - Welcome to Yah!</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f8f9fa; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .email-card { background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); overflow: hidden; }
          .header { background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: white; padding: 40px 30px; text-align: center; }
          .logo { width: 80px; height: 80px; background: #fbbf24; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 36px; }
          .content { padding: 40px 30px; }
          .button { display: inline-block; background: #fbbf24; color: #1e3a8a; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 20px 0; }
          .footer { background: #f1f5f9; padding: 20px 30px; text-align: center; color: #64748b; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="email-card">
            <div class="header">
              <div class="logo">👑</div>
              <h1 style="margin: 0; font-size: 28px;">Account Activated!</h1>
              <p style="margin: 10px 0 0; opacity: 0.9;">You're all set to ride with Yah</p>
            </div>
            
            <div class="content">
              <h2 style="color: #059669; margin-bottom: 20px;">Welcome aboard, ${name}!</h2>
              
              <p style="color: #374151; line-height: 1.6; margin-bottom: 20px;">
                Your email has been successfully confirmed and your Yah account is now active! 🎉
              </p>
              
              <p style="color: #374151; line-height: 1.6; margin-bottom: 30px;">
                You now have access to all premium features including luxury rides, real-time tracking, and our AI-powered support system.
              </p>
              
              <div style="text-align: center;">
                <a href="${process.env.BASE_URL || 'http://localhost:5000'}" class="button">Start Your First Ride</a>
              </div>
            </div>
            
            <div class="footer">
              <p style="margin: 0;">Welcome to the Yah family!</p>
              <p style="margin: 5px 0 0;">For support, contact us anytime through the app.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const textContent = `
      Account Activated!
      
      Welcome aboard, ${name}!
      
      Your email has been successfully confirmed and your Yah account is now active!
      
      You now have access to all premium features including luxury rides, real-time tracking, and our AI-powered support system.
      
      Start your first ride at: ${process.env.BASE_URL || 'http://localhost:5000'}
      
      Welcome to the Yah family!
      
      Best regards,
      The Yah Team
    `;

    const mailOptions = {
      from: `${this.config.from.name} <${this.config.from.email}>`,
      to,
      subject: 'Account Activated - Welcome to Yah!',
      text: textContent,
      html: htmlContent,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`Welcome email sent to ${to}`);
    } catch (error) {
      console.error('Failed to send welcome email:', error);
      throw new Error('Failed to send welcome email');
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      console.error('Email service connection failed:', error);
      return false;
    }
  }
}

export const emailService = new EmailService();