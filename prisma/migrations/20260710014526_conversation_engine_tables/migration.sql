-- CreateTable
CREATE TABLE "public"."conversation_graphs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "draft_document" JSONB NOT NULL,
    "active_version_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversation_graphs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."conversation_graph_versions" (
    "id" TEXT NOT NULL,
    "graph_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "document" JSONB NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_graph_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."graph_annotations" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "message_id" TEXT,
    "node_id" TEXT NOT NULL,
    "graph_version_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "resolved_by_version_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "graph_annotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."graph_scenarios" (
    "id" TEXT NOT NULL,
    "graph_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "turns" JSONB NOT NULL,
    "expected_path" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "graph_scenarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."conversation_leads" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "node_id" TEXT,
    "graph_version_id" TEXT,
    "slots" JSONB NOT NULL DEFAULT '{}',
    "fit_note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "notified_at" TIMESTAMP(3),
    "notify_channel" TEXT,
    "notify_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."node_entry_questions" (
    "id" TEXT NOT NULL,
    "node_id" TEXT NOT NULL,
    "graph_id" TEXT NOT NULL,
    "graph_version_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "embedding" vector,
    "cluster_id" TEXT,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "node_entry_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."safety_config" (
    "id" TEXT NOT NULL DEFAULT 'safety',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "word_lists" JSONB NOT NULL DEFAULT '{}',
    "investigation_policy" TEXT,
    "severity_action_map" JSONB NOT NULL DEFAULT '{}',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "safety_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."safety_investigations" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "triggered_by" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "verdict" TEXT,
    "recommended_action" TEXT,
    "rationale" TEXT,
    "acted_on" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "safety_investigations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "conversation_graphs_status_idx" ON "public"."conversation_graphs"("status");

-- CreateIndex
CREATE INDEX "conversation_graph_versions_graph_id_idx" ON "public"."conversation_graph_versions"("graph_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_graph_versions_graph_id_version_key" ON "public"."conversation_graph_versions"("graph_id", "version");

-- CreateIndex
CREATE INDEX "graph_annotations_conversation_id_idx" ON "public"."graph_annotations"("conversation_id");

-- CreateIndex
CREATE INDEX "graph_annotations_graph_version_id_idx" ON "public"."graph_annotations"("graph_version_id");

-- CreateIndex
CREATE INDEX "graph_annotations_status_idx" ON "public"."graph_annotations"("status");

-- CreateIndex
CREATE INDEX "graph_scenarios_graph_id_idx" ON "public"."graph_scenarios"("graph_id");

-- CreateIndex
CREATE INDEX "conversation_leads_conversation_id_idx" ON "public"."conversation_leads"("conversation_id");

-- CreateIndex
CREATE INDEX "conversation_leads_status_idx" ON "public"."conversation_leads"("status");

-- CreateIndex
CREATE INDEX "conversation_leads_created_at_idx" ON "public"."conversation_leads"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "node_entry_questions_message_id_key" ON "public"."node_entry_questions"("message_id");

-- CreateIndex
CREATE INDEX "node_entry_questions_node_id_idx" ON "public"."node_entry_questions"("node_id");

-- CreateIndex
CREATE INDEX "node_entry_questions_graph_id_idx" ON "public"."node_entry_questions"("graph_id");

-- CreateIndex
CREATE INDEX "node_entry_questions_cluster_id_idx" ON "public"."node_entry_questions"("cluster_id");

-- CreateIndex
CREATE INDEX "safety_investigations_conversation_id_idx" ON "public"."safety_investigations"("conversation_id");

-- CreateIndex
CREATE INDEX "safety_investigations_status_idx" ON "public"."safety_investigations"("status");

-- CreateIndex
CREATE INDEX "safety_investigations_created_at_idx" ON "public"."safety_investigations"("created_at");

-- AddForeignKey
ALTER TABLE "public"."conversation_graph_versions" ADD CONSTRAINT "conversation_graph_versions_graph_id_fkey" FOREIGN KEY ("graph_id") REFERENCES "public"."conversation_graphs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."graph_scenarios" ADD CONSTRAINT "graph_scenarios_graph_id_fkey" FOREIGN KEY ("graph_id") REFERENCES "public"."conversation_graphs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
