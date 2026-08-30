// Autenticação simples por token compartilhado, no mesmo espírito do resto
// do sistema (que hoje usa senha por grupo direto no cliente, sem login
// "de verdade"). Todo POST/PATCH/DELETE precisa do header x-api-token.
function requireApiToken(req, res, next) {
  const expected = process.env.API_TOKEN;
  if (!expected) {
    // Sem token configurado, a API fica fechada por padrão (falha segura).
    return res.status(500).json({ error: "API_TOKEN não configurado no servidor" });
  }
  const got = req.header("x-api-token");
  if (got !== expected) {
    return res.status(401).json({ error: "Token inválido ou ausente" });
  }
  next();
}

module.exports = { requireApiToken };
