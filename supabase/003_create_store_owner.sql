-- First create the user in Supabase Dashboard > Authentication > Users > Add user.
-- Use lenonjonas@gmail.com and choose a strong password there.

insert into public.profiles (id, full_name, role, admin_level)
select id, 'Lenon Jonas', 'admin', 3
from auth.users
where email = 'lenonjonas@gmail.com'
on conflict (id) do update set full_name = excluded.full_name, role = excluded.role, admin_level = excluded.admin_level;