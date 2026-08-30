// Envio de WhatsApp via Meta WhatsApp Cloud API (oficial).
// Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages

const { statusLabel, fmtDate } = require("./email");

function graphUrl() {
  const version = process.env.WHATSAPP_API_VERSION || "v20.0";
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  return `https://graph.facebook.com/${version}/${phoneId}/messages`;
}

// Normaliza para o formato que a Cloud API espera: so' digitos, com DDI.
function normalizePhone(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return null;
  // Se a pessoa cadastrou sem DDI (ex: só DDD+número, 10 ou 11 dígitos),
  // assume Brasil (55). Ajuste aqui se a empresa operar em outro país.
  if (digits.length <= 11) return "55" + digits;
  return digits;
}

function buildMessageText(action, eventType) {
  const appUrl = process.env.KANBAN_APP_URL || "";
  const linha = (label, value) => `${label}: ${value}`;
  const base = [
    linha("Ação", action.title),
    linha("Status", statusLabel(action.status)),
    linha("Prazo", fmtDate(action.due_date)),
  ];
  if (action.observacoes) base.push(linha("Obs", action.observacoes));

  let heading;
  if (eventType === "created") heading = "🆕 Nova ação criada para você";
  else if (eventType === "status_changed") heading = "🔄 Uma ação sua mudou de status";
  else if (eventType === "overdue") heading = "⚠️ Ação com prazo vencido";
  else if (eventType === "done") heading = "✅ Ação concluída";
  else heading = "Atualização de ação";

  return [heading, "", ...base, "", "Acesse: " + appUrl].join("\n");
}

async function sendWhatsapp({ action, user, eventType }) {
  if (!process.env.WHATSAPP_TOKEN || !process.env.WHATSAPP_PHONE_NUMBER_ID) {
    return { ok: false, skipped: true, error: "WhatsApp não configurado (faltam WHATSAPP_TOKEN/WHATSAPP_PHONE_NUMBER_ID)" };
  }
  const to = normalizePhone(user && user.whatsapp);
  if (!to) {
    return { ok: false, skipped: true, error: "Usuário sem WhatsApp cadastrado" };
  }

  const text = buildMessageText(action, eventType);

  try {
    const res = await fetch(graphUrl(), {
      method: "POST",
      headers: {
        Authorization: "Bearer " + process.env.WHATSAPP_TOKEN,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: text, preview_url: false },
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: "WhatsApp Cloud API " + res.status + ": " + body.slice(0, 300) };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err && err.message ? err.message : err) };
  }
}

async function sendWhatsappSummary({ user, actions }) {
  if (!process.env.WHATSAPP_TOKEN || !process.env.WHATSAPP_PHONE_NUMBER_ID) {
    return { ok: false, skipped: true, error: "WhatsApp não configurado" };
  }
  const to = normalizePhone(user && user.whatsapp);
  if (!to) return { ok: false, skipped: true, error: "Usuário sem WhatsApp cadastrado" };

  const lines = actions.map((a) => `• ${a.title} (${statusLabel(a.status)}, prazo ${fmtDate(a.due_date)})`);
  const text = [
    `📋 Resumo diário — ${actions.length} ação(ões) pendente(s)`,
    "",
    ...lines,
    "",
    "Acesse: " + (process.env.KANBAN_APP_URL || ""),
  ].join("\n");

  try {
    const res = await fetch(graphUrl(), {
      method: "POST",
      headers: {
        Authorization: "Bearer " + process.env.WHATSAPP_TOKEN,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: text, preview_url: false },
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: "WhatsApp Cloud API " + res.status + ": " + body.slice(0, 300) };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err && err.message ? err.message : err) };
  }
}

module.exports = { sendWhatsapp, sendWhatsappSummary, normalizePhone, buildMessageText };
