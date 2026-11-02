insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tm-chat-media','tm-chat-media',false,26214400,array['image/jpeg','image/png','image/webp','image/gif','audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/aac','audio/3gpp','application/pdf','text/plain','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation','application/zip'])
on conflict (id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
alter table public.messages drop constraint if exists messages_type_check;
alter table public.messages add constraint messages_type_check check (type in ('text','voice','photo','video','file'));
