const express = require("express");
const { pool } = require("../db");
const { requireApiToken } = require("../auth");

const router = express.Router();

// Leitura é pública (o Kanban precisa listar usuários para o seletor de
// responsável sem exigir token de escrita); escrita exige x-api-token.
router.get("/", async (req, res) => {
  const { rows } = await pool.query(
    "SELECT id, name, cargo, email, whatsapp, active FROM users WHERE active = true ORDER BY name ASC"
  );
  res.json(rows);
});

router.post("/", requireApiToken, async (req, res) => {
  const { name, cargo, email, whatsapp } = req.body || {};
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: "Campo 'name' é obrigatório" });
  }
  const { rows } = await pool.query(
    `INSERT INTO users (name, cargo, email, whatsapp)
     VALUES ($1, $2, $3, $4) RETURNING id, name, cargo, email, whatsapp, active`,
    [String(name).trim(), cargo || null, email || null, whatsapp || null]
  );
  res.status(201).json(rows[0]);
});

router.patch("/:id", requireApiToken, async (req, res) => {
  const id = Number(req.params.id);
  const { name, cargo, email, whatsapp, active } = req.body || {};
  const { rows } = await pool.query(
    `UPDATE users SET
       name = COALESCE($2, name),
       cargo = COALESCE($3, cargo),
       email = COALESCE($4, email),
       whatsapp = COALESCE($5, whatsapp),
       active = COALESCE($6, active),
       updated_at = now()
     WHERE id = $1
     RETURNING id, name, cargo, email, whatsapp, active`,
    [id, name || null, cargo || null, email || null, whatsapp || null, typeof active === "boolean" ? active : null]
  );
  if (!rows.length) return res.status(404).json({ error: "Usuário não encontrado" });
  res.json(rows[0]);
});

router.delete("/:id", requireApiToken, async (req, res) => {
  const id = Number(req.params.id);
  // Soft delete: mantém o histórico de ações/notificações intacto.
  const { rows } = await pool.query(
    "UPDATE users SET active = false, updated_at = now() WHERE id = $1 RETURNING id",
    [id]
  );
  if (!rows.length) return res.status(404).json({ error: "Usuário não encontrado" });
  res.status(204).end();
});

module.exports = router;
