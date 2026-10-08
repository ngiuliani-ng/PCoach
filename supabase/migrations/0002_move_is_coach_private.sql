-- Sposta is_coach() fuori dallo schema esposto (public) in private, cosi' non e' piu'
-- chiamabile via /rest/v1/rpc/is_coach. Le policy RLS restano valide (riferimento per OID).
-- Da eseguire dopo 0001_enable_rls.sql. Rieseguibile senza errori.

create schema if not exists private;
grant usage on schema private to authenticated;

do $$
begin
  if to_regprocedure('public.is_coach()') is not null then
    alter function public.is_coach() set schema private;
  end if;
end $$;

alter function private.is_coach() set search_path = '';

revoke execute on function private.is_coach() from public, anon;
grant execute on function private.is_coach() to authenticated;

-- Verifica: select has_function_privilege('anon', 'private.is_coach()', 'execute');  -- false
