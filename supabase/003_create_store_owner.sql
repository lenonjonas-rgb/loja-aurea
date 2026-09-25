-- First create the user in Supabase Dashboard > Authentication > Users > Add user.
-- Use lenonjonas@gmail.com and choose a strong password there.

insert into public.profiles (id, full_name, role)
select id, 'Lenon Jonas', 'admin'
from auth.users
where email = 'lenonjonas@gmail.com'
on conflict (id) do update set full_name = excluded.full_name, role = excluded.role;