// Envio de e-mail via Resend (https://resend.com/docs/api-reference/emails/send-email).
// Reaproveita a mesma RESEND_API_KEY ja usada pelo triunfo-portal.

const RESEND_URL = "https://api.resend.com/emails";

function statusLabel(status) {
  if (status === "todo") return "A Fazer";
  if (status === "doing") return "Em Andamento";
  if (status === "done") return "Concluído";
  return status;
}

function fmtDate(d) {
  if (!d) return "Sem prazo definido";
  try {
    return new Date(d + "T00:00:00").toLocaleDateString("pt-BR");
  } catch (e) {
    return d;
  }
}

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

// eventType: "created" | "status_changed" | "overdue" | "done"
function buildEmail(action, user, eventType) {
  const appUrl = process.env.KANBAN_APP_URL || "#";
  const titles = {
    created: "Nova ação atribuída a você",
    status_changed: "Uma ação sua mudou de status",
    overdue: "Ação com prazo vencido",
    done: "Ação concluída",
  };
  const subjectPrefix = titles[eventType] || "Atualização de ação";
  const subject = subjectPrefix + ": " + action.title;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #211c14;">
      <h2 style="margin-bottom: 4px;">${escapeHtml(subjectPrefix)}</h2>
      <p style="color:#756a58; margin-top:0;">KANBAN Diretoria de Operações — Triunfo Logística</p>
      <table style="width:100%; border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding:6px 0; color:#756a58; width:140px;">Ação</td><td style="padding:6px 0;"><b>${escapeHtml(action.title)}</b></td></tr>
        <tr><td style="padding:6px 0; color:#756a58;">Responsável</td><td style="padding:6px 0;">${escapeHtml(user.name)}</td></tr>
        <tr><td style="padding:6px 0; color:#756a58;">Status atual</td><td style="padding:6px 0;">${escapeHtml(statusLabel(action.status))}</td></tr>
        <tr><td style="padding:6px 0; color:#756a58;">Prazo</td><td style="padding:6px 0;">${escapeHtml(fmtDate(action.due_date))}</td></tr>
        <tr><td style="padding:6px 0; color:#756a58; vertical-align: top;">Observações</td><td style="padding:6px 0;">${escapeHtml(action.observacoes) || "—"}</td></tr>
      </table>
      <p><a href="${appUrl}" style="display:inline-block; background:#b8500f; color:#fff; padding:10px 16px; border-radius:8px; text-decoration:none;">Abrir o Kanban</a></p>
      <p style="font-size:12px; color:#a49a86; margin-top:24px;">Esta é uma notificação automática. Não responda este e-mail.</p>
    </div>
  `.trim();

  return { subject, html };
}

async function sendEmail({ action, user, eventType }) {
  if (!process.env.RESEND_API_KEY) {
    return { ok: false, skipped: true, error: "RESEND_API_KEY não configurada" };
  }
  if (!user || !user.email) {
    return { ok: false, skipped: true, error: "Usuário sem e-mail cadastrado" };
  }

  const { subject, html } = buildEmail(action, user, eventType);
  const from = process.env.RESEND_FROM || "Kanban Diretoria <onboarding@resend.dev>";

  try {
    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + process.env.RESEND_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [user.email],
        subject,
        html,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: "Resend " + res.status + ": " + body.slice(0, 300) };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err && err.message ? err.message : err) };
  }
}

// Resumo diario: uma unica mensagem contendo varias acoes pendentes.
async function sendDailySummaryEmail({ user, actions }) {
  if (!process.env.RESEND_API_KEY) {
    return { ok: false, skipped: true, error: "RESEND_API_KEY não configurada" };
  }
  if (!user || !user.email) {
    return { ok: false, skipped: true, error: "Usuário sem e-mail cadastrado" };
  }
  const appUrl = process.env.KANBAN_APP_URL || "#";
  const rows = actions.map((a) => `
    <tr>
      <td style="padding:6px 8px; border-bottom:1px solid #eee;">${escapeHtml(a.title)}</td>
      <td style="padding:6px 8px; border-bottom:1px solid #eee;">${escapeHtml(statusLabel(a.status))}</td>
      <td style="padding:6px 8px; border-bottom:1px solid #eee;">${escapeHtml(fmtDate(a.due_date))}</td>
    </tr>
  `).join("");

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #211c14;">
      <h2 style="margin-bottom: 4px;">Resumo diário de pendências</h2>
      <p style="color:#756a58; margin-top:0;">Olá, ${escapeHtml(user.name)}. Você tem ${actions.length} ação(ões) em aberto:</p>
      <table style="width:100%; border-collapse: collapse; margin: 16px 0; font-size: 13px;">
        <tr style="text-align:left; color:#756a58;"><th style="padding:6px 8px;">Ação</th><th style="padding:6px 8px;">Status</th><th style="padding:6px 8px;">Prazo</th></tr>
        ${rows}
      </table>
      <p><a href="${appUrl}" style="display:inline-block; background:#b8500f; color:#fff; padding:10px 16px; border-radius:8px; text-decoration:none;">Abrir o Kanban</a></p>
    </div>
  `.trim();

  try {
    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + process.env.RESEND_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || "Kanban Diretoria <onboarding@resend.dev>",
        to: [user.email],
        subject: `Resumo diário — ${actions.length} ação(ões) pendente(s)`,
        html,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: "Resend " + res.status + ": " + body.slice(0, 300) };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err && err.message ? err.message : err) };
  }
}

module.exports = { sendEmail, sendDailySummaryEmail, buildEmail, statusLabel, fmtDate };
