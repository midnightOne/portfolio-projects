-- CreateTable
CREATE TABLE "homepage_config" (
    "id" TEXT NOT NULL,
    "sections" JSONB NOT NULL,
    "globalTheme" TEXT NOT NULL DEFAULT 'default',
    "layout" TEXT NOT NULL DEFAULT 'standard',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "homepage_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "section_configs" (
    "id" TEXT NOT NULL,
    "homepageConfigId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL,
    "config" JSONB NOT NULL,
    "className" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "section_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "section_configs_homepageConfigId_idx" ON "section_configs"("homepageConfigId");

-- CreateIndex
CREATE INDEX "section_configs_order_idx" ON "section_configs"("order");

-- CreateIndex
CREATE UNIQUE INDEX "section_configs_homepageConfigId_sectionId_key" ON "section_configs"("homepageConfigId", "sectionId");

-- AddForeignKey
ALTER TABLE "section_configs" ADD CONSTRAINT "section_configs_homepageConfigId_fkey" FOREIGN KEY ("homepageConfigId") REFERENCES "homepage_config"("id") ON DELETE CASCADE ON UPDATE CASCADE;