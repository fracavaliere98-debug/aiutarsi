-- A40 (2026-10-26): chi ha fatto una segnalazione vede l'esito quando tocca la notifica
-- "Aggiornamento Segnalazione" (prima il tocco portava all'elenco notifiche: la notifica non ha l'id).
--
-- Scelta di Francesco (26/10): due esiti soli, senza dire quale sanzione.
--   dismissed                  -> 'no_violation'  ("Non abbiamo rilevato violazioni")
--   warned / banned / resolved -> 'action_taken'  ("Abbiamo preso provvedimenti")
--   pending (o nullo)          -> 'pending'
-- Coerente con A37: a terzi non si rivela la sanzione su una persona identificata.
--
-- reports resta leggibile solo dall'admin (policy reports_select_admin): questa funzione restituisce
-- a chi ha segnalato solo le proprie righe e solo colonne neutre. Niente reported_id, admin_id,
-- admin_notes, evidence_snapshot, status grezzo.

create or replace function public.get_my_reports()
returns table (
  id uuid,
  content_type text,
  reason text,
  created_at timestamptz,
  resolution_date timestamptz,
  outcome text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id,
    r.content_type,
    r.reason,
    r.created_at,
    case when coalesce(r.status, 'pending') = 'pending' then null else r.resolution_date end,
    case
      when coalesce(r.status, 'pending') = 'pending' then 'pending'
      when r.status = 'dismissed' then 'no_violation'
      else 'action_taken'
    end
  from public.reports r
  where auth.uid() is not null
    and r.reporter_id = auth.uid()
  order by r.created_at desc
  limit 100;
$$;

revoke all on function public.get_my_reports() from public, anon;
grant execute on function public.get_my_reports() to authenticated;

comment on function public.get_my_reports() is
  'A40: segnalazioni fatte dall''utente corrente con esito neutro (pending | action_taken | no_violation). Mai la sanzione esatta.';
