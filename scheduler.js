const cron = require("node-cron");
const { pool } = require("./db");
const { notifyAction, notifyDailySummary } = require("./notify");

function todayStr() {
  // Data local no fuso configurado (TZ), formato YYYY-MM-DD.
  return new Date().toLocaleDateString("sv-SE", { timeZone: process.env.TZ || "America/Sao_Paulo" });
}

// Roda a cada hora: qualquer ação com prazo vencido, ainda não concluída,
// que não recebeu alerta de atraso HOJE, dispara um alerta (uma vez por dia
// por ação, para não virar spam).
async function checkOverdueActions() {
  const today = todayStr();
  const { rows: overdue } = await pool.query(
    `SELECT * FROM actions
     WHERE status != 'done'
       AND due_date IS NOT NULL
       AND due_date < $1
       AND (overdue_alerted_on IS NULL OR overdue_alerted_on != $1)`,
    [today]
  );

  for (const action of overdue) {
    let user = null;
    if (action.responsavel_id) {
      const { rows } = await pool.query("SELECT * FROM users WHERE id = $1", [action.responsavel_id]);
      user = rows[0] || null;
    }
    await notifyAction(action, user, "overdue");
    await pool.query("UPDATE actions SET overdue_alerted_on = $2 WHERE id = $1", [action.id, today]);
  }

  if (overdue.length) {
    console.log(`[scheduler] ${overdue.length} ação(ões) atrasada(s) notificada(s).`);
  }
}

// Roda uma vez por dia: para cada usuário com ações pendentes (todo/doing),
// manda um resumo consolidado.
async function sendDailySummaries() {
  const { rows: users } = await pool.query("SELECT * FROM users WHERE active = true");
  for (const user of users) {
    const { rows: pending } = await pool.query(
      `SELECT * FROM actions WHERE responsavel_id = $1 AND status != 'done'
       ORDER BY due_date NULLS LAST`,
      [user.id]
    );
    if (!pending.length) continue;
    await notifyDailySummary(user, pending);
  }
  console.log(`[scheduler] Resumo diário enviado para usuários com pendências.`);
}

function start() {
  // A cada hora, no minuto 5.
  cron.schedule("5 * * * *", () => {
    checkOverdueActions().catch((err) => console.error("[scheduler] Erro ao checar atrasos:", err));
  }, { timezone: process.env.TZ || "America/Sao_Paulo" });

  // Todo dia, na hora configurada (padrão 8h).
  const hour = Number(process.env.DAILY_SUMMARY_HOUR || 8);
  cron.schedule(`0 ${hour} * * *`, () => {
    sendDailySummaries().catch((err) => console.error("[scheduler] Erro no resumo diário:", err));
  }, { timezone: process.env.TZ || "America/Sao_Paulo" });

  console.log(`[scheduler] Agendador iniciado (verificação de atraso a cada hora; resumo diário às ${hour}h ${process.env.TZ || "America/Sao_Paulo"}).`);
}

module.exports = { start, checkOverdueActions, sendDailySummaries };
