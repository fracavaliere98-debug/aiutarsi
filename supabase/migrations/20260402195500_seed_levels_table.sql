insert into public.levels (id, min_xp, name)
values
  (1, 0, 'Novizio'),
  (2, 110, 'Apprendista'),
  (3, 450, 'Sociale'),
  (4, 1000, 'Attivo'),
  (5, 2000, 'Esperto'),
  (6, 3500, 'Mentore'),
  (7, 5500, 'Pilastro'),
  (8, 8000, 'Ambasciatore'),
  (9, 11000, 'Leader'),
  (10, 15000, 'Leggenda')
on conflict (id) do update
set min_xp = excluded.min_xp,
    name = excluded.name;
