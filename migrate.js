// Aplica src/schema.sql no banco configurado em DATABASE_URL.
// E' seguro rodar varias vezes: tudo usa CREATE TABLE IF NOT EXISTS.
const fs = require("fs");
const path = require("path");
const { pool } = require("./db");

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  await pool.query(sql);
  console.log("Migração aplicada com sucesso.");
}

if (require.main === module) {
  migrate()
    .then(() => pool.end())
    .catch((err) => {
      console.error("Falha ao migrar:", err);
      process.exit(1);
    });
}

module.exports = { migrate };
