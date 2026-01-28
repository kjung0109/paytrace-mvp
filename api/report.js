const nodemailer = require("nodemailer");

// Vercel Serverless Function for /api/report
module.exports = async (req, res) => {
    // 1. method check
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed', reason_code: 'METHOD_NOT_ALLOWED' });
    }

    // 2. Setup transporter
    // Note: Environment variables must be set in Vercel Project Settings
    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });

    try {
        const { email, name, payscore, credit_min, credit_max } = req.body;

        // 3. Construct email content
        const mailOptions = {
            from: process.env.SMTP_USER,
            to: email,
            subject: `[PayScore] ${name}님의 신용 분석 리포트가 도착했습니다.`,
            html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e9ecef; border-radius: 12px; overflow: hidden;">
          <div style="background: #4263eb; padding: 24px; text-align: center; color: #fff;">
            <h1 style="margin: 0; font-size: 24px;">PayScore 리포트</h1>
          </div>
          <div style="padding: 24px;">
            <p style="font-size: 16px; color: #212529;">안녕하세요, <strong>${name}</strong>님.</p>
            <p style="font-size: 16px; color: #495057; line-height: 1.5;">
              요청하신 PayScore 분석이 완료되었습니다.<br/>
              귀하의 성실 납부 내역을 바탕으로 산출된 결과입니다.
            </p>
            
            <div style="margin: 32px 0; padding: 24px; background: #f8f9fa; border-radius: 12px; text-align: center;">
              <p style="margin: 0 0 8px; font-size: 14px; color: #868e96;">예상 PayScore</p>
              <strong style="display: block; font-size: 48px; color: #4263eb; margin-bottom: 24px;">${payscore}점</strong>
              
              <div style="border-top: 1px solid #dee2e6; padding-top: 16px;">
                <p style="margin: 0; font-size: 14px; color: #495057;">
                  신용점수 향상 예상 구간<br/>
                  <strong style="color: #2b8a3e; font-size: 18px;">+${credit_min} ~ +${credit_max}점</strong>
                </p>
              </div>
            </div>

            <p style="font-size: 14px; color: #868e96; text-align: center;">
              본 리포트는 참고용이며, 실제 금융사의 심사 기준과는 다를 수 있습니다.
            </p>
          </div>
          <div style="background: #f1f3f5; padding: 16px; text-align: center;">
            <p style="margin: 0; font-size: 12px; color: #868e96;">&copy; 2026 PayScore Team. All rights reserved.</p>
          </div>
        </div>
      `,
        };

        // 4. Send email
        await transporter.sendMail(mailOptions);
        console.log(`[Vercel] Email sent to ${email}`);
        return res.status(200).json({ message: "Report sent successfully" });

    } catch (error) {
        console.error("Email sending failed:", error);

        let reasonCode = "SERVER_FAIL";
        if (error.responseCode === 550) {
            reasonCode = "INVALID_EMAIL";
        } else if (error.code === 'EAUTH') {
            reasonCode = "AUTH_FAIL";
        }

        return res.status(500).json({
            error: "Failed to send email",
            reason_code: reasonCode,
            details: error.message
        });
    }
};
