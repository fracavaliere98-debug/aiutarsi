-- Cleanup legacy skills
DELETE FROM user_skills 
WHERE skill NOT IN (
  'Assistenza e Compagnia',
  'Supporto Sanitario e Soccorso',
  'Educazione e Mentoring',
  'Logistica e Distribuzione',
  'Manutenzione e Ambiente',
  'Cucina e Mensa',
  'Digital & Social Media',
  'Creatività e Grafica',
  'Scrittura e Storytelling',
  'Amministrazione e Gestione',
  'Tecnologia e IT',
  'Lingue e Traduzioni',
  'Tutela Animali',
  'Sport per il Sociale'
);

-- Cleanup legacy interests
DELETE FROM user_interests
WHERE interest NOT IN (
  'Sociale',
  'Ambiente',
  'Educazione',
  'Animali',
  'Arte & Cultura',
  'Salute'
);
;
