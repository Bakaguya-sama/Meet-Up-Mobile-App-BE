# Chat contracts

- [`chat_api.md`](chat_api.md): API, authorization, idempotency, unified database model, attachment storage and realtime recovery contract for meetup and direct chat.

The chat context supports exactly two conversation types in the current scope: `meetup` and `direct`. Generic user-created group conversations, edit/delete, retention and antivirus/quarantine are not part of this version.
