-- A22 (2026-10-25): limiti di dimensione e tipo sui bucket che non ne avevano.
-- Dati staging al 25/10: avatars max 0,54 MB, activities max 0,43 MB, solo image/jpeg;
-- verification_docs max 0,88 MB, solo application/pdf. L'app carica sempre JPEG ritagliati
-- (quality 0.5-0.8). Soglie scelte larghe (10 MB come community_media) per non bloccare upload reali.
-- NON ANCORA APPLICATA: richiede ok di Francesco (cambio di comportamento sugli upload).
update storage.buckets
   set file_size_limit = 10485760,
       allowed_mime_types = array['image/jpeg','image/png','image/webp']
 where id in ('avatars','activities');

update storage.buckets
   set file_size_limit = 10485760,
       allowed_mime_types = array['application/pdf','image/jpeg','image/png']
 where id = 'verification_docs';
