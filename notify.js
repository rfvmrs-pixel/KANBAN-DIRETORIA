const { pool } = require("./db");
const { sendEmail, sendDailySummaryEmail } = require("./integrations/email");
const { sendWhatsapp, sendWhatsappSummary } = require("./integrations/whatsapp");

async function logNotification({ actionId, userId, channel, eventType, result }) {
  await pool.query(
    `INSERT INTO notifications_log (action_id, user_id, channel, event_type, status, error)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      actionId || null,
      userId || null,
      channel,
      eventType,
      result.ok ? "sent" : (result.skipped ? "skipped" : "failed"),
      result.ok ? null : result.error || null,
    ]
  );
}

// Dispara e-mail + WhatsApp para o responsavel de uma acao, e registra o resultado.
// eventType: "created" | "status_changed" | "overdue" | "done"
async function notifyAction(action, user, eventType) {
  if (!user) {
    return { email: { ok: false, skipped: true, error: "Ação sem responsável cadastrado" }, whatsapp: { ok: false, skipped: true } };
  }

  const [emailResult, whatsappResult] = await Promise.all([
    sendEmail({ action, user, eventType }),
    sendWhatsapp({ action, user, eventType }),
  ]);

  await Promise.all([
    logNotification({ actionId: action.id, userId: user.id, channel: "email", eventType, result: emailResult }),
    logNotification({ actionId: action.id, userId: user.id, channel: "whatsapp", eventType, result: whatsappResult }),
  ]);

  return { email: emailResult, whatsapp: whatsappResult };
}

async function notifyDailySummary(user, actions) {
  const [emailResult, whatsappResult] = await Promise.all([
    sendDailySummaryEmail({ user, actions }),
    sendWhatsappSummary({ user, actions }),
  ]);
  await Promise.all([
    logNotification({ actionId: null, userId: user.id, channel: "email", eventType: "daily_summary", result: emailResult }),
    logNotification({ actionId: null, userId: user.id, channel: "whatsapp", eventType: "daily_summary", result: whatsappResult }),
  ]);
  return { email: emailResult, whatsapp: whatsappResult };
}

module.exports = { notifyAction, notifyDailySummary };
