# kanban-notificacoes

API de notificações (e-mail + WhatsApp) para o KANBAN Diretoria de Operações
da Triunfo Logística. Serviço isolado — não altera o `KANBAN-DIRETORIA`
(index.html estático) nem o `triunfo-portal`.

## O que faz

- Mantém um cadastro de usuários (nome, cargo, e-mail, WhatsApp).
- Mantém as ações (cards do Kanban) num banco Postgres próprio.
- Sempre que uma ação é criada, muda de status, ou fica atrasada, envia
  e-mail (via Resend) e WhatsApp (via Meta WhatsApp Cloud API) para o
  responsável.
- Roda um agendador interno: a cada hora verifica prazos vencidos; uma vez
  por dia (hora configurável) envia um resumo de pendências por usuário.

## Rodando localmente

```bash
npm install
cp .env.example .env   # preencha DATABASE_URL, API_TOKEN, RESEND_API_KEY, etc.
npm start
```

O `npm start` já roda a migração do banco (`src/schema.sql`) automaticamente
antes de subir o servidor — não precisa rodar nada manualmente.

## Variáveis de ambiente

Veja `.env.example` para a lista completa e comentada. As essenciais:

| Variável | Obrigatória | Descrição |
|---|---|---|
| `DATABASE_URL` | sim | Postgres. No Railway, criada automaticamente ao adicionar o plugin Postgres. |
| `API_TOKEN` | sim | Token que o `kanban-diretoria.html` envia no header `x-api-token` para criar/editar. |
| `RESEND_API_KEY` | para e-mail | Mesma chave já usada no `triunfo-portal`. |
| `WHATSAPP_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` | para WhatsApp | Da conta Meta Business / WhatsApp Cloud API. |
| `KANBAN_APP_URL` | não | Link incluído nas notificações. |
| `DAILY_SUMMARY_HOUR` | não | Hora (0-23) do resumo diário. Padrão 8. |

Sem `RESEND_API_KEY` ou `WHATSAPP_TOKEN`/`WHATSAPP_PHONE_NUMBER_ID`, o
respectivo canal é simplesmente pulado (`skipped`) — o resto do sistema
continua funcionando normalmente.

## Endpoints

Leitura (`GET`) é pública. Escrita (`POST`/`PATCH`/`DELETE`) exige o header
`x-api-token: <API_TOKEN>`.

- `GET /api/users` — lista usuários ativos.
- `POST /api/users` — `{ name, cargo, email, whatsapp }`.
- `PATCH /api/users/:id` — atualiza campos (parciais).
- `DELETE /api/users/:id` — desativa (soft delete).
- `GET /api/actions?status=&responsavel_id=&company=` — lista ações.
- `POST /api/actions` — `{ title, company, observacoes, status, due_date, responsavel_id, external_card_id }`. Dispara notificação de "ação criada".
- `PATCH /api/actions/:id` — atualiza campos; se `status` mudar, dispara notificação (`status_changed` ou `done`).
- `DELETE /api/actions/:id` — remove a ação.
- `GET /health` — healthcheck.

## Deploy no Railway

1. Criar um novo serviço no mesmo projeto do `triunfo-portal`, apontando
   para este repositório (branch `main`).
2. Adicionar um plugin Postgres (pode ser o mesmo projeto — ele já cria a
   variável `DATABASE_URL` automaticamente).
3. Configurar as variáveis de ambiente (ver tabela acima). O `RESEND_API_KEY`
   pode ser referenciado do serviço `triunfo-portal` existente
   (`${{triunfo-portal.RESEND_API_KEY}}`) em vez de duplicar o valor.
4. Deploy. O Railpack detecta o `package.json` e roda `npm start` automaticamente.

## Notas de segurança

- O `API_TOKEN` fica embutido no `kanban-diretoria.html` (visível a quem
  inspecionar o código-fonte da página) — mesmo nível de proteção que o
  restante do sistema hoje (senhas de grupo também ficam no cliente). Não é
  uma autenticação forte; serve para evitar escrita casual/acidental, não
  um ataque deliberado.
- Nenhuma credencial (Resend, WhatsApp) fica no código — tudo vem de
  variável de ambiente.
