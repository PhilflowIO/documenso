-- A missing organisation document language now means "use the interface language of whoever creates the
-- document" instead of a fixed English. Only the column default changes: organisations that already store a
-- language (including the old default "en") keep it, so nothing renders differently until someone unsets it.
ALTER TABLE "OrganisationGlobalSettings" ALTER COLUMN "documentLanguage" DROP NOT NULL;
ALTER TABLE "OrganisationGlobalSettings" ALTER COLUMN "documentLanguage" DROP DEFAULT;
