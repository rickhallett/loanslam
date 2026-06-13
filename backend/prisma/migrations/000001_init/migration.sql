-- Hand-authored for SQL Server because Prisma SQL Server does not support Json
-- fields. The Prisma schema stores JSON as NVARCHAR(MAX); these CHECK constraints
-- are the safety boundary that keeps audit/state payloads valid JSON objects.
CREATE TABLE [dbo].[ChatSession] (
    [id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [ChatSession_id_df] DEFAULT NEWID(),
    [conversationRef] NVARCHAR(64) NOT NULL,
    [csrfTokenHash] NVARCHAR(256) NOT NULL,
    [state] NVARCHAR(64) NOT NULL,
    [structuredState] NVARCHAR(MAX) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ChatSession_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL CONSTRAINT [ChatSession_updatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [ChatSession_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [ChatSession_conversationRef_key] UNIQUE NONCLUSTERED ([conversationRef]),
    CONSTRAINT [ChatSession_structuredState_json] CHECK (ISJSON([structuredState]) = 1)
);

CREATE TABLE [dbo].[TranscriptEntry] (
    [id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [TranscriptEntry_id_df] DEFAULT NEWID(),
    [sessionId] UNIQUEIDENTIFIER NOT NULL,
    [requestRef] NVARCHAR(64) NOT NULL,
    [direction] NVARCHAR(32) NOT NULL,
    [role] NVARCHAR(32) NOT NULL,
    [content] NVARCHAR(MAX) NOT NULL,
    [metadata] NVARCHAR(MAX) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [TranscriptEntry_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [TranscriptEntry_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [TranscriptEntry_metadata_json] CHECK (ISJSON([metadata]) = 1)
);

CREATE TABLE [dbo].[AuditEvent] (
    [id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [AuditEvent_id_df] DEFAULT NEWID(),
    [sessionId] UNIQUEIDENTIFIER NOT NULL,
    [requestRef] NVARCHAR(64) NOT NULL,
    [eventType] NVARCHAR(128) NOT NULL,
    [reasonCode] NVARCHAR(128),
    [payload] NVARCHAR(MAX) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [AuditEvent_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [AuditEvent_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [AuditEvent_payload_json] CHECK (ISJSON([payload]) = 1)
);

CREATE TABLE [dbo].[ClientMessage] (
    [id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [ClientMessage_id_df] DEFAULT NEWID(),
    [sessionId] UNIQUEIDENTIFIER NOT NULL,
    [clientMessageId] NVARCHAR(128) NOT NULL,
    [requestRef] NVARCHAR(64) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ClientMessage_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [ClientMessage_pkey] PRIMARY KEY CLUSTERED ([id])
);

CREATE TABLE [dbo].[TicketHandoff] (
    [id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [TicketHandoff_id_df] DEFAULT NEWID(),
    [sessionId] UNIQUEIDENTIFIER NOT NULL,
    [requestRef] NVARCHAR(64) NOT NULL,
    [provider] NVARCHAR(128) NOT NULL,
    [providerReference] NVARCHAR(256) NOT NULL,
    [status] NVARCHAR(64) NOT NULL,
    [payload] NVARCHAR(MAX) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [TicketHandoff_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [TicketHandoff_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [TicketHandoff_payload_json] CHECK (ISJSON([payload]) = 1)
);

CREATE NONCLUSTERED INDEX [TranscriptEntry_sessionId_requestRef_idx] ON [dbo].[TranscriptEntry]([sessionId], [requestRef]);
CREATE NONCLUSTERED INDEX [AuditEvent_sessionId_requestRef_idx] ON [dbo].[AuditEvent]([sessionId], [requestRef]);
CREATE NONCLUSTERED INDEX [AuditEvent_eventType_idx] ON [dbo].[AuditEvent]([eventType]);
CREATE UNIQUE NONCLUSTERED INDEX [ClientMessage_sessionId_clientMessageId_key] ON [dbo].[ClientMessage]([sessionId], [clientMessageId]);
CREATE NONCLUSTERED INDEX [ClientMessage_requestRef_idx] ON [dbo].[ClientMessage]([requestRef]);
CREATE NONCLUSTERED INDEX [TicketHandoff_sessionId_requestRef_idx] ON [dbo].[TicketHandoff]([sessionId], [requestRef]);
CREATE NONCLUSTERED INDEX [TicketHandoff_provider_providerReference_idx] ON [dbo].[TicketHandoff]([provider], [providerReference]);

ALTER TABLE [dbo].[TranscriptEntry] ADD CONSTRAINT [TranscriptEntry_sessionId_fkey]
    FOREIGN KEY ([sessionId]) REFERENCES [dbo].[ChatSession]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE [dbo].[AuditEvent] ADD CONSTRAINT [AuditEvent_sessionId_fkey]
    FOREIGN KEY ([sessionId]) REFERENCES [dbo].[ChatSession]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE [dbo].[ClientMessage] ADD CONSTRAINT [ClientMessage_sessionId_fkey]
    FOREIGN KEY ([sessionId]) REFERENCES [dbo].[ChatSession]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE [dbo].[TicketHandoff] ADD CONSTRAINT [TicketHandoff_sessionId_fkey]
    FOREIGN KEY ([sessionId]) REFERENCES [dbo].[ChatSession]([id]) ON DELETE CASCADE ON UPDATE CASCADE;
