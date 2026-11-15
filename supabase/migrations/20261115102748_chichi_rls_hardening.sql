grant select on public.chichi_admin_audit to authenticated;
create policy "Administrators can read audit history" on public.chichi_admin_audit for select to authenticated using ((auth.jwt()->'app_metadata'->>'role')='admin');
revoke execute on function public.chichi_handle_new_user() from public,anon,authenticated;
drop policy if exists "Developers manage own profile" on public.chichi_developer_profiles;
create policy "Developers manage own pending profile" on public.chichi_developer_profiles for all to authenticated using ((select auth.uid())=id and status='pending') with check ((select auth.uid())=id and status='pending');
