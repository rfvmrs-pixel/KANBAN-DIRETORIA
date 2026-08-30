require("dotenv").config();
const express = require("express");
const cors = require("cors");

const { migrate } = require("./src/migrate");
const usersRouter = require("./src/routes/users");
const actionsRouter = require("./src/routes/actions");
const scheduler = require("./src/scheduler");

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/health", (req, res) => res.json({ ok: true }));

app.use("/api/users", usersRouter);
app.use("/api/actions", actionsRouter);

// Erros não tratados de handlers async não devem derrubar o processo nem
// vazar stack trace para o cliente.
app.use((err, req, res, next) => {
  console.error("Erro não tratado:", err);
  res.status(500).json({ error: "Erro interno" });
});

const PORT = process.env.PORT || 8080;

async function main() {
  await migrate();
  scheduler.start();
  app.listen(PORT, () => {
    console.log(`kanban-notificacoes rodando na porta ${PORT}`);
  });
}

main().catch((err) => {
  console.error("Falha ao iniciar o servidor:", err);
  process.exit(1);
});
