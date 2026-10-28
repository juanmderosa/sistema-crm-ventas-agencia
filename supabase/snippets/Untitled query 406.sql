update public.platform_admins set is_active = true
where user_id = (select id from auth.users where email = 'qa-plataforma@example.test');