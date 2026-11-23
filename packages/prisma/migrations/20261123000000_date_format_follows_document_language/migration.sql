-- A missing date format now means "derive it from the document language" instead of the fixed
-- American "yyyy-MM-dd hh:mm a". Only the column defaults change: rows that already store a format
-- (including that one) keep it, so existing documents and organisations render exactly as before.
ALTER TABLE "OrganisationGlobalSettings" ALTER COLUMN "documentDateFormat" DROP NOT NULL;
ALTER TABLE "OrganisationGlobalSettings" ALTER COLUMN "documentDateFormat" DROP DEFAULT;

ALTER TABLE "DocumentMeta" ALTER COLUMN "dateFormat" DROP DEFAULT;
