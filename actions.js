const express = require("express");
const { pool } = require("../db");
const { requireApiToken } = require("../auth");
const { notifyAction } = require("../notify");

const router = express.Router();

async function getUser(id) {
  if (!id) return null;
  const { rows } = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
  return rows[0] || null;
}

router.get("/", async (req, res) => {
  const { status, responsavel_id, company } = req.query;
  const clauses = [];
  const params = [];
  if (status) { params.push(status); clauses.push(`status = $${params.length}`); }
  if (responsavel_id) { params.push(Number(responsavel_id)); clauses.push(`responsavel_id = $${params.length}`); }
  if (company) { params.push(company); clauses.push(`company = $${params.length}`); }
  const where = clauses.length ? "WHERE " + clauses.join(" AND ") : "";
  const { rows } = await pool.query(
    `SELECT * FROM actions ${where} ORDER BY due_date NULLS LAST, created_at DESC`,
    params
  );
  res.json(rows);
});

router.post("/", requireApiToken, async (req, res) => {
  const { external_card_id, company, title, observacoes, status, due_date, responsavel_id } = req.body || {};
  if (!title || !String(title).trim()) {
    return res.status(400).json({ error: "Campo 'title' é obrigatório" });
  }
  const { rows } = await pool.query(
    `INSERT INTO actions (external_card_id, company, title, observacoes, status, due_date, responsavel_id)
     VALUES ($1, $2, $3, $4, COALESCE($5, 'todo'), $6, $7)
     RETURNING *`,
    [external_card_id || null, company || null, String(title).trim(), observacoes || null, status || null, due_date || null, responsavel_id || null]
  );
  const action = rows[0];

  const user = await getUser(action.responsavel_id);
  const result = await notifyAction(action, user, "created");
  res.status(201).json({ action, notified: result });
});

router.patch("/:id", requireApiToken, async (req, res) => {
  const id = Number(req.params.id);
  const { rows: existingRows } = await pool.query("SELECT * FROM actions WHERE id = $1", [id]);
  if (!existingRows.length) return res.status(404).json({ error: "Ação não encontrada" });
  const before = existingRows[0];

  const { company, title, observacoes, status, due_date, responsavel_id } = req.body || {};
  const { rows } = await pool.query(
    `UPDATE actions SET
       company = COALESCE($2, company),
       title = COALESCE($3, title),
       observacoes = COALESCE($4, observacoes),
       status = COALESCE($5, status),
       due_date = COALESCE($6, due_date),
       responsavel_id = COALESCE($7, responsavel_id),
       updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [id, company || null, title || null, observacoes || null, status || null, due_date || null, responsavel_id || null]
  );
  const after = rows[0];
  const user = await getUser(after.responsavel_id);

  let notified = null;
  const statusChanged = status && status !== before.status;
  if (statusChanged) {
    const eventType = after.status === "done" ? "done" : "status_changed";
    notified = await notifyAction(after, user, eventType);
  }

  res.json({ action: after, notified });
});

router.delete("/:id", requireApiToken, async (req, res) => {
  const id = Number(req.params.id);
  const { rowCount } = await pool.query("DELETE FROM actions WHERE id = $1", [id]);
  if (!rowCount) return res.status(404).json({ error: "Ação não encontrada" });
  res.status(204).end();
});

module.exports = router;
