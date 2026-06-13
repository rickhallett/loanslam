ALTER TABLE [dbo].[ClientMessage] ADD [responsePayload] NVARCHAR(MAX);
ALTER TABLE [dbo].[ClientMessage] ADD [completedAt] DATETIME2;
ALTER TABLE [dbo].[ClientMessage] ADD CONSTRAINT [ClientMessage_responsePayload_json]
    CHECK ([responsePayload] IS NULL OR ISJSON([responsePayload]) = 1);
