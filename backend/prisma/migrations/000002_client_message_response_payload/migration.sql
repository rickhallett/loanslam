ALTER TABLE [dbo].[ClientMessage] ADD
    [responsePayload] NVARCHAR(MAX),
    [completedAt] DATETIME2,
    CONSTRAINT [ClientMessage_responsePayload_json]
    CHECK ([responsePayload] IS NULL OR ISJSON([responsePayload]) = 1);
