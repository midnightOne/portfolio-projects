-- CreateTable
CREATE TABLE "public"."conversation_memory_config" (
    "id" TEXT NOT NULL DEFAULT 'memory',
    "memory_enabled" BOOLEAN NOT NULL DEFAULT true,
    "graphless_tool_allowlist" JSONB,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversation_memory_config_pkey" PRIMARY KEY ("id")
);
