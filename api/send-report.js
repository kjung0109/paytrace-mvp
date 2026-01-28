/**
 * PayScore 리포트 발송 API (요구사항: 이메일 실제 전송)
 * Resend API 사용. Vercel 환경변수: RESEND_API_KEY 필수.
 * 선택: RESEND_FROM (예: reports@yourdomain.com), 미설정 시 Resend 기본 발신 사용.
 */
const RESEND_API = "https://api.resend.com/emails";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, reason: "METHOD_NOT_ALLOWED" });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      ok: false,
      reason: "EMAIL_NOT_CONFIGURED",
      message: "이메일 발송이 설정되지 않았습니다.",
    });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const { name, email, reportId } = body;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        ok: false,
        reason: "INVALID_EMAIL",
        message: "이메일 형식을 확인해 주세요.",
      });
    }

    const from = process.env.RESEND_FROM || "onboarding@resend.dev";
    const subject = "PayScore 리포트 전송 요청이 완료되었습니다";
    const html = `
      <p>안녕하세요${name ? ` ${name}` : ""}님,</p>
      <p>PayScore 리포트 전송을 요청해 주셔서 감사합니다.</p>
      <p>리포트 생성이 완료되면 이 이메일과 연결된 주소로 안내해 드립니다.</p>
      <p>요청 ID: ${reportId || "-"}</p>
      <hr />
      <p style="color:#6c757d;font-size:12px;">본 메일은 Paytrace 서비스에서 발송되었습니다.</p>
    `;

    const response = await fetch(RESEND_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject,
        html,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return res.status(502).json({
        ok: false,
        reason: "SEND_FAILED",
        message: "이메일 발송에 실패했습니다. 주소를 확인 후 다시 시도해 주세요.",
        detail: data.message || data,
      });
    }

    return res.status(200).json({ ok: true, id: data.id });
  } catch (err) {
    console.error("[send-report]", err);
    return res.status(500).json({
      ok: false,
      reason: "SERVER_ERROR",
      message: "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    });
  }
}
