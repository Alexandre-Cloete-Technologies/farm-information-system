-- Three demo logins, one per role. Role switching during the pitch = logging in
-- as a different account (design decision 8). Shared password, demo-only data.

do $$
declare
  demo_password constant text := 'FisDemo2026!';
  acct record;
  new_id uuid;
begin
  for acct in
    select * from (values
      ('farmer@example.com',     'Johannes Beukes', 'farmer'::public.user_role,       'Brakwater Smallholding'),
      ('agronomist@example.com', 'Dr. Selma Nghoshi', 'agronomist'::public.user_role, 'Khomas Agri Advisory'),
      ('bank@example.com',       'Pieter van Wyk',  'bank_officer'::public.user_role, 'Agribank of Namibia')
    ) as t(email, display_name, role, organisation)
  loop
    new_id := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at
    ) values (
      '00000000-0000-0000-0000-000000000000',
      new_id, 'authenticated', 'authenticated', acct.email,
      extensions.crypt(demo_password, extensions.gen_salt('bf')),
      now(),
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
      jsonb_build_object('display_name', acct.display_name),
      now(), now()
    );

    insert into auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      new_id::text, new_id,
      jsonb_build_object('sub', new_id::text, 'email', acct.email, 'email_verified', true),
      'email', now(), now(), now()
    );

    insert into public.profiles (id, display_name, role, organisation)
    values (new_id, acct.display_name, acct.role, acct.organisation);
  end loop;
end $$;
