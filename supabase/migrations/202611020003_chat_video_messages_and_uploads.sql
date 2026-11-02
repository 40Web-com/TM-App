update storage.buckets
set allowed_mime_types = array[
  'image/jpeg','image/png','image/webp','image/gif',
  'audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/aac','audio/3gpp',
  'video/mp4','video/webm','video/quicktime','video/3gpp',
  'application/pdf','text/plain','application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip'
]
where id = 'tm-chat-media';

alter table public.messages drop constraint if exists messages_type_check;
alter table public.messages add constraint messages_type_check
  check (type in ('text','voice','photo','video','file'));
