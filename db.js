const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  // Falha alto e cedo — sem banco, nada aqui funciona mesmo.
  console.error("DATABASE_URL nao configurada. Configure a variavel de ambiente antes de iniciar.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Railway (e a maioria dos provedores gerenciados) exige SSL, mas com
  // certificado que o Node nao valida por padrao sem isso:
  ssl: process.env.DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false },
});

pool.on("error", (err) => {
  console.error("Erro inesperado no pool do Postgres:", err);
});

module.exports = { pool };
