-- CreateTable
CREATE TABLE "voice_provider_configs" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "config_json" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voice_provider_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "voice_provider_configs_provider_idx" ON "voice_provider_configs"("provider");

-- CreateIndex
CREATE INDEX "voice_provider_configs_is_default_idx" ON "voice_provider_configs"("is_default");

-- CreateIndex
CREATE UNIQUE INDEX "voice_provider_configs_provider_is_default_key" ON "voice_provider_configs"("provider", "is_default") WHERE "is_default" = true;

-- CreateIndex
CREATE UNIQUE INDEX "voice_provider_configs_provider_name_key" ON "voice_provider_configs"("provider", "name");