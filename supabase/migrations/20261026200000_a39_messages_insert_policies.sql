-- A39 (2026-10-26): chiusura del buco sull'inserimento dei messaggi. Ok di Francesco 26/10.
-- Prima: tre policy INSERT permissive (in OR). messages_no_send_if_blocked era vera per chiunque non
-- fosse bloccato e da sola autorizzava qualunque messaggio, in qualunque conversazione, con qualunque
-- sender_id. Anche anon aveva INSERT.
-- Dopo: resta una sola policy permissiva ("Participants can insert messages": mittente = se stessi,
-- partecipante, non bannato) e il blocco tra utenti diventa RESTRICTIVE (vale sempre, in AND).
-- L'app invia con la RPC send_chat_message (security definer), che fa gli stessi controlli.

drop policy if exists "messages_insert_participants" on public.messages;

drop policy if exists "messages_no_send_if_blocked" on public.messages;
create policy "messages_no_send_if_blocked" on public.messages
  as restrictive for insert to authenticated
  with check (
    not exists (
      select 1
      from public.blocked_users bu
      join public.conversation_participants cp
        on cp.conversation_id = messages.conversation_id
       and cp.user_id <> auth.uid()
      where bu.blocker_id = cp.user_id
        and bu.blocked_id = auth.uid()
    )
  );

revoke insert, update, delete on table public.messages from anon;
