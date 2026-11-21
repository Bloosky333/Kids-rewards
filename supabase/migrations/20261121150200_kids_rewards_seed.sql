-- Kids Rewards: starter data (edit or delete freely from parent mode).
insert into kids_rewards.categories (kind, name, emoji, color, sort_order) values
  ('task',   'Maison',      '🏠', 'blue',     0),
  ('task',   'École',       '🎒', 'yellow',   1),
  ('task',   'Hygiène',     '🧼', 'mint',     2),
  ('task',   'Gentillesse', '💛', 'pink',     3),
  ('reward', 'Écran',       '📺', 'lavender', 0),
  ('reward', 'Friandise',   '🍭', 'peach',    1),
  ('reward', 'Sortie',      '🎡', 'mint',     2),
  ('reward', 'Jouet',       '🧸', 'yellow',   3);

insert into kids_rewards.tasks (name, emoji, points, frequency, category_id)
select t.name, t.emoji, t.points, t.freq::kids_rewards.task_frequency, c.id
from (values
  ('Faire son lit',        '🛏️', 2, 'daily',   'Maison'),
  ('Mettre la table',      '🍽️', 3, 'anytime', 'Maison'),
  ('Lire 15 minutes',      '📚', 3, 'daily',   'École'),
  ('Se brosser les dents', '🦷', 1, 'daily',   'Hygiène'),
  ('Aider sans qu''on demande', '🤝', 2, 'anytime', 'Gentillesse')
) as t(name, emoji, points, freq, cat)
join kids_rewards.categories c on c.kind = 'task' and c.name = t.cat;

insert into kids_rewards.rewards (name, emoji, cost, category_id)
select r.name, r.emoji, r.cost, c.id
from (values
  ('30 min de tablette',            '📱', 10,  'Écran'),
  ('Choisir le film du soir',       '🎬', 20,  'Écran'),
  ('Une glace',                     '🍦', 15,  'Friandise'),
  ('Sortie au parc d''attractions', '🎠', 200, 'Sortie'),
  ('Petit jouet surprise',          '🎁', 50,  'Jouet')
) as r(name, emoji, cost, cat)
join kids_rewards.categories c on c.kind = 'reward' and c.name = r.cat;
