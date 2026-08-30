-- Schema do banco de notificacoes do KANBAN Diretoria.
-- Roda automaticamente (idempotente) toda vez que o servidor sobe — ver src/migrate.js.

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  cargo         TEXT,
  email         TEXT,
  whatsapp      TEXT,               -- formato internacional, ex: 5521999999999
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS actions (
  id                 SERIAL PRIMARY KEY,
  external_card_id   TEXT,          -- id do card no kanban-diretoria.html, se vier de la
  company             TEXT,          -- contrato (arm, allseas, tps, ...)
  title              TEXT NOT NULL,
  observacoes        TEXT,
  status             TEXT NOT NULL DEFAULT 'todo',   -- todo | doing | done
  due_date           DATE,
  responsavel_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  overdue_alerted_on DATE,          -- ultima data em que o alerta de atraso foi enviado (evita repetir no mesmo dia)
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications_log (
  id           SERIAL PRIMARY KEY,
  action_id    INTEGER REFERENCES actions(id) ON DELETE CASCADE,
  user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  channel      TEXT NOT NULL,       -- email | whatsapp
  event_type   TEXT NOT NULL,       -- created | status_changed | overdue | daily_summary
  status       TEXT NOT NULL,       -- sent | failed | skipped
  error        TEXT,
  sent_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_actions_responsavel ON actions(responsavel_id);
CREATE INDEX IF NOT EXISTS idx_actions_status ON actions(status);
CREATE INDEX IF NOT EXISTS idx_actions_due_date ON actions(due_date);
CREATE INDEX IF NOT EXISTS idx_notifications_action ON notifications_log(action_id);
