insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('chichi-website-assets','chichi-website-assets',false,5242880,array['image/jpeg','image/png','image/webp','image/gif','image/svg+xml'])
on conflict(id) do update set public=false,file_size_limit=5242880,allowed_mime_types=excluded.allowed_mime_types;
create policy "Chichi users read own assets" on storage.objects for select to authenticated using(bucket_id='chichi-website-assets' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "Chichi users upload own assets" on storage.objects for insert to authenticated with check(bucket_id='chichi-website-assets' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "Chichi users update own assets" on storage.objects for update to authenticated using(bucket_id='chichi-website-assets' and (storage.foldername(name))[1]=(select auth.uid())::text) with check(bucket_id='chichi-website-assets' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "Chichi users delete own assets" on storage.objects for delete to authenticated using(bucket_id='chichi-website-assets' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "Sellers can view their own listings" on public.chichi_listings for select to authenticated using((select auth.uid())=seller_id);
