insert into public.profiles (id, full_name, phone)
select
  users.id,
  coalesce(
    nullif(btrim(users.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(coalesce(users.email, ''), '@', 1), ''),
    'Cliente'
  ),
  users.raw_user_meta_data ->> 'phone'
from auth.users as users
on conflict (id) do nothing;