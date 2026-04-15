-- =============================================================
-- Weekly Report – Relational Data Model (SQL Server / T-SQL)
-- =============================================================

-- =============================================================
-- 1. TABLES
-- =============================================================

-- -------------------------------------------------------------
-- 1.1 tbl_weekly_report_Lines  (each EVP owns one line)
-- -------------------------------------------------------------
CREATE TABLE tbl_weekly_report_Lines (
    LineID      INT             IDENTITY(1,1) PRIMARY KEY,
    LineName    NVARCHAR(256)   NOT NULL UNIQUE,
    CreatedAt   DATETIME2       NOT NULL DEFAULT GETDATE()
);

-- -------------------------------------------------------------
-- 1.2 tbl_weekly_report_Units  (each Unit Manager owns one unit inside a line)
-- -------------------------------------------------------------
CREATE TABLE tbl_weekly_report_Units (
    UnitID      INT             IDENTITY(1,1) PRIMARY KEY,
    LineID      INT             NOT NULL REFERENCES tbl_weekly_report_Lines(LineID),
    UnitName    NVARCHAR(256)   NOT NULL,
    CreatedAt   DATETIME2       NOT NULL DEFAULT GETDATE(),
    CONSTRAINT UQ_Units_Line_Name UNIQUE (LineID, UnitName)
);

-- -------------------------------------------------------------
-- 1.3 tbl_weekly_report_Departments  (team-level groups inside a unit)
-- -------------------------------------------------------------
CREATE TABLE tbl_weekly_report_Departments (
    DepartmentID    INT             IDENTITY(1,1) PRIMARY KEY,
    UnitID          INT             NOT NULL REFERENCES tbl_weekly_report_Units(UnitID),
    DepartmentName  NVARCHAR(256)   NOT NULL,
    CreatedAt       DATETIME2       NOT NULL DEFAULT GETDATE(),
    CONSTRAINT UQ_Departments_Unit_Name UNIQUE (UnitID, DepartmentName)
);

-- -------------------------------------------------------------
-- 1.4 Users
--     Populated via REST service: /api/users/windowname/
-- -------------------------------------------------------------
CREATE TABLE tbl_weekly_report_Users (
    UserID          INT             IDENTITY(1,1) PRIMARY KEY,
    WindowsName      NVARCHAR(256)   NOT NULL UNIQUE,
    FullName        NVARCHAR(256)   NOT NULL,
    DepartmentID    INT             NULL REFERENCES tbl_weekly_report_Departments(DepartmentID),
    LineID          INT             NULL REFERENCES tbl_weekly_report_Lines(LineID),
    UnitID          INT             NULL REFERENCES tbl_weekly_report_Units(UnitID),
    Title           NVARCHAR(128)   NULL,
    PositionNumber  TINYINT         NULL,   -- 1=TeamMember | 2=Manager | 3=UnitManager | 4=EVP | 5=GeneralManager
    CreatedAt       DATETIME2       NOT NULL DEFAULT GETDATE(),
    UpdatedAt       DATETIME2       NOT NULL DEFAULT GETDATE()
);

-- -------------------------------------------------------------
-- 1.2 tbl_weekly_report_ActionTypes  (Aktarım, Geliştirme, Test …)
-- -------------------------------------------------------------
CREATE TABLE tbl_weekly_report_ActionTypes (
    TypeID      INT             IDENTITY(1,1) PRIMARY KEY,
    TypeName    NVARCHAR(128)   NOT NULL UNIQUE,
    SortOrder   INT             NOT NULL DEFAULT 0,
    IsActive    BIT             NOT NULL DEFAULT 1
);

-- -------------------------------------------------------------
-- 1.3 Weeks
-- -------------------------------------------------------------
CREATE TABLE tbl_weekly_report_Weeks (
    WeekID      INT     IDENTITY(1,1) PRIMARY KEY,
    WeekNumber  TINYINT NOT NULL,          -- 1 – 52
    Year        SMALLINT NOT NULL,
    CONSTRAINT UQ_Weeks_Number_Year UNIQUE (WeekNumber, Year)
);

-- -------------------------------------------------------------
-- 1.4 tbl_weekly_report_ActionStatuses  (highlight, lowlight, waiting, info, progress)
-- -------------------------------------------------------------
CREATE TABLE tbl_weekly_report_ActionStatuses (
    StatusID        INT             IDENTITY(1,1) PRIMARY KEY,
    StatusKey       VARCHAR(32)     NOT NULL UNIQUE,  -- 'highlight' | 'lowlight' | 'waiting' | 'information' | 'progress'
    StatusLabel     NVARCHAR(64)    NOT NULL,
    ColorHex        CHAR(7)         NOT NULL,          -- e.g. '#ef4445'
    BgColorHex      CHAR(7)         NOT NULL
);

-- -------------------------------------------------------------
-- 1.5 tbl_weekly_report_Actions
-- -------------------------------------------------------------
CREATE TABLE tbl_weekly_report_Actions (
    ActionID    BIGINT          IDENTITY(1,1) PRIMARY KEY,
    UserID      INT             NOT NULL REFERENCES tbl_weekly_report_Users(UserID),
    WeekID      INT             NOT NULL REFERENCES tbl_weekly_report_Weeks(WeekID),
    TypeID      INT             NOT NULL REFERENCES tbl_weekly_report_ActionTypes(TypeID),
    ActionDate  DATE            NOT NULL,
    StatusID    INT             NULL     REFERENCES tbl_weekly_report_ActionStatuses(StatusID),  -- current status (nullable = no status)
    CreatedAt   DATETIME2       NOT NULL DEFAULT GETDATE(),
    UpdatedAt   DATETIME2       NOT NULL DEFAULT GETDATE(),
    IsDeleted   BIT             NOT NULL DEFAULT 0
);

-- -------------------------------------------------------------
-- 1.6 tbl_weekly_report_ActionItems  (ordered sub-entries: text or image)
-- -------------------------------------------------------------
CREATE TABLE tbl_weekly_report_ActionItems (
    ItemID      BIGINT          IDENTITY(1,1) PRIMARY KEY,
    ActionID    BIGINT          NOT NULL REFERENCES tbl_weekly_report_Actions(ActionID) ON DELETE CASCADE,
    SortOrder   TINYINT         NOT NULL DEFAULT 0,    -- 0 = main entry, 1+ = sub-entries
    ItemType    VARCHAR(8)      NOT NULL CHECK (ItemType IN ('text', 'image')),
    ItemValue   NVARCHAR(MAX)   NOT NULL               -- text content OR base64 data-URL for images
);

-- -------------------------------------------------------------
-- 1.7 tbl_weekly_report_ActionStatusHistory  (audit trail of status changes)
-- -------------------------------------------------------------
CREATE TABLE tbl_weekly_report_ActionStatusHistory (
    HistoryID   BIGINT      IDENTITY(1,1) PRIMARY KEY,
    ActionID    BIGINT      NOT NULL REFERENCES tbl_weekly_report_Actions(ActionID),
    StatusID    INT         NULL     REFERENCES tbl_weekly_report_ActionStatuses(StatusID),  -- NULL = status removed
    ChangedBy   INT         NOT NULL REFERENCES tbl_weekly_report_Users(UserID),
    ChangedAt   DATETIME2   NOT NULL DEFAULT GETDATE()
);


-- =============================================================
-- 2. INDEXES
-- =============================================================

CREATE INDEX IX_tbl_weekly_report_Actions_UserID         ON tbl_weekly_report_Actions(UserID);
CREATE INDEX IX_tbl_weekly_report_Actions_WeekID         ON tbl_weekly_report_Actions(WeekID);
CREATE INDEX IX_tbl_weekly_report_Actions_TypeID         ON tbl_weekly_report_Actions(TypeID);
CREATE INDEX IX_tbl_weekly_report_Actions_StatusID       ON tbl_weekly_report_Actions(StatusID);
CREATE INDEX IX_tbl_weekly_report_Actions_IsDeleted      ON tbl_weekly_report_Actions(IsDeleted);
CREATE INDEX IX_tbl_weekly_report_ActionItems_ActionID   ON tbl_weekly_report_ActionItems(ActionID, SortOrder);
CREATE INDEX IX_StatusHistory_ActionID ON tbl_weekly_report_ActionStatusHistory(ActionID);


-- =============================================================
-- 3. SEED DATA
-- =============================================================

-- tbl_weekly_report_Lines
INSERT INTO tbl_weekly_report_Lines (LineName) VALUES
    (N'Mimari ve Teknoloji Platformları'),
    (N'Uygulama Geliştirme'),
    (N'Veri ve Analitik'),
    (N'Dijital Kanallar'),
    (N'Altyapı ve Güvenlik');

-- tbl_weekly_report_Units
INSERT INTO tbl_weekly_report_Units (LineID, UnitName)
SELECT l.LineID, u.UnitName
FROM (VALUES
    (N'Mimari ve Teknoloji Platformları', N'İş Süreç Platformları'),
    (N'Mimari ve Teknoloji Platformları', N'Doküman Platformları'),
    (N'Uygulama Geliştirme',              N'Backend Geliştirme'),
    (N'Uygulama Geliştirme',              N'Frontend Geliştirme'),
    (N'Veri ve Analitik',                 N'Veri Ambarı'),
    (N'Veri ve Analitik',                 N'Raporlama')
) AS u(LineName, UnitName)
JOIN tbl_weekly_report_Lines l ON l.LineName = u.LineName;

-- tbl_weekly_report_Departments
INSERT INTO tbl_weekly_report_Departments (UnitID, DepartmentName)
SELECT un.UnitID, d.DepartmentName
FROM (VALUES
    (N'İş Süreç Platformları', N'Workflow Takımı'),
    (N'İş Süreç Platformları', N'Entegrasyon Takımı'),
    (N'Backend Geliştirme',    N'API Takımı'),
    (N'Backend Geliştirme',    N'Servis Takımı'),
    (N'Frontend Geliştirme',   N'UI Takımı')
) AS d(UnitName, DepartmentName)
JOIN tbl_weekly_report_Units un ON un.UnitName = d.UnitName;

-- tbl_weekly_report_ActionTypes
INSERT INTO tbl_weekly_report_ActionTypes (TypeName, SortOrder) VALUES
    (N'Aktarım',          1),
    (N'Geliştirme',       2),
    (N'Test',             3),
    (N'Analiz',           4),
    (N'Tasarım',          5),
    (N'Toplantı',         6),
    (N'Destek',           7),
    (N'Dokümantasyon',    8);

-- tbl_weekly_report_ActionStatuses
INSERT INTO tbl_weekly_report_ActionStatuses (StatusKey, StatusLabel, ColorHex, BgColorHex) VALUES
    ('highlight',   N'Highlight', '#ef4444', '#fef2f2'),
    ('lowlight',    N'LowLight',  '#6b7280', '#f9fafb'),
    ('waiting',     N'Waiting',   '#f59e0b', '#fffbeb'),
    ('information', N'Info',      '#3b82f6', '#eff6ff'),
    ('progress',    N'Progress',  '#10b981', '#ecfdf5');

-- Weeks for current year (adjust @Year as needed)
DECLARE @Year SMALLINT = YEAR(GETDATE());
DECLARE @n   TINYINT   = 1;
WHILE @n <= 52
BEGIN
    INSERT INTO tbl_weekly_report_Weeks (WeekNumber, Year) VALUES (@n, @Year);
    SET @n = @n + 1;
END;


-- =============================================================
-- 4. MIGRATION (run on existing databases only)
-- =============================================================
-- ALTER TABLE tbl_weekly_report_Users ADD LineID        INT NULL REFERENCES tbl_weekly_report_Lines(LineID);
-- ALTER TABLE tbl_weekly_report_Users ADD UnitID        INT NULL REFERENCES tbl_weekly_report_Units(UnitID);
-- ALTER TABLE tbl_weekly_report_Users ADD DepartmentID  INT NULL REFERENCES tbl_weekly_report_Departments(DepartmentID);
-- ALTER TABLE tbl_weekly_report_Users DROP COLUMN LineName;
-- ALTER TABLE tbl_weekly_report_Users DROP COLUMN UnitName;
-- ALTER TABLE tbl_weekly_report_Users DROP COLUMN DepartmentName;

-- =============================================================
-- 5. QUERIES
-- =============================================================

-- -------------------------------------------------------------
-- 4.1  Get all actions for a specific week (with items & status)
-- -------------------------------------------------------------
SELECT
    a.ActionID,
    u.FullName,
    u.DepartmentName,
    w.WeekNumber,
    at.TypeName      AS ActionType,
    a.ActionDate,
    st.StatusLabel   AS Status,
    st.ColorHex,
    ai.SortOrder,
    ai.ItemType,
    ai.ItemValue,
    a.CreatedAt
FROM tbl_weekly_report_Actions a
JOIN tbl_weekly_report_Users u  ON u.UserID   = a.UserID
JOIN tbl_weekly_report_Weeks w  ON w.WeekID   = a.WeekID
JOIN tbl_weekly_report_ActionTypes    at ON at.TypeID  = a.TypeID
LEFT JOIN tbl_weekly_report_ActionStatuses st ON st.StatusID = a.StatusID
JOIN tbl_weekly_report_ActionItems    ai ON ai.ActionID = a.ActionID
WHERE w.WeekNumber = 14              -- replace with target week
  AND w.Year       = YEAR(GETDATE())
  AND a.IsDeleted  = 0
ORDER BY a.ActionDate, a.ActionID, ai.SortOrder;

-- -------------------------------------------------------------
-- 4.2  Action count by type for a given week
-- -------------------------------------------------------------
SELECT
    at.TypeName,
    COUNT(DISTINCT a.ActionID) AS ActionCount
FROM tbl_weekly_report_Actions a
JOIN tbl_weekly_report_Weeks w ON w.WeekID = a.WeekID
JOIN tbl_weekly_report_ActionTypes at ON at.TypeID = a.TypeID
WHERE w.WeekNumber = 14
  AND w.Year       = YEAR(GETDATE())
  AND a.IsDeleted  = 0
GROUP BY at.TypeName
ORDER BY ActionCount DESC;

-- -------------------------------------------------------------
-- 4.3  Status distribution for a given week
-- -------------------------------------------------------------
SELECT
    ISNULL(st.StatusLabel, 'No Status') AS Status,
    COUNT(*)                             AS ActionCount
FROM tbl_weekly_report_Actions a
JOIN tbl_weekly_report_Weeks w ON w.WeekID = a.WeekID
LEFT JOIN tbl_weekly_report_ActionStatuses st ON st.StatusID = a.StatusID
WHERE w.WeekNumber = 14
  AND w.Year       = YEAR(GETDATE())
  AND a.IsDeleted  = 0
GROUP BY st.StatusLabel
ORDER BY ActionCount DESC;

-- -------------------------------------------------------------
-- 4.4  All actions for a user grouped by week (summary)
-- -------------------------------------------------------------
SELECT
    w.WeekNumber,
    w.Year,
    COUNT(DISTINCT a.ActionID)                              AS TotalActions,
    SUM(CASE WHEN a.StatusID IS NOT NULL THEN 1 ELSE 0 END) AS ActionsWithStatus
FROM tbl_weekly_report_Actions a
JOIN tbl_weekly_report_Weeks w ON w.WeekID = a.WeekID
JOIN tbl_weekly_report_Users u ON u.UserID = a.UserID
WHERE u.WindowsName = 'HaftalikRapor'   -- replace with actual windowName
  AND a.IsDeleted  = 0
GROUP BY w.WeekNumber, w.Year
ORDER BY w.Year, w.WeekNumber;

-- -------------------------------------------------------------
-- 4.5  tbl_weekly_report_Actions filtered by a specific status
-- -------------------------------------------------------------
SELECT
    a.ActionID,
    w.WeekNumber,
    at.TypeName,
    a.ActionDate,
    st.StatusLabel,
    ai.ItemValue    AS MainAction
FROM tbl_weekly_report_Actions a
JOIN tbl_weekly_report_Weeks w  ON w.WeekID   = a.WeekID
JOIN tbl_weekly_report_ActionTypes    at ON at.TypeID  = a.TypeID
JOIN tbl_weekly_report_ActionStatuses st ON st.StatusID = a.StatusID
JOIN tbl_weekly_report_ActionItems    ai ON ai.ActionID  = a.ActionID AND ai.SortOrder = 0
WHERE st.StatusKey  = 'highlight'      -- replace with desired status key
  AND a.IsDeleted   = 0
ORDER BY w.WeekNumber, a.ActionDate;

-- -------------------------------------------------------------
-- 4.6  INSERT new action with items (use in a transaction)
-- -------------------------------------------------------------
BEGIN TRANSACTION;
BEGIN TRY

    DECLARE @UserID  INT  = 1;   -- resolved from windowName lookup
    DECLARE @WeekID  INT  = (SELECT WeekID FROM tbl_weekly_report_Weeks WHERE WeekNumber = 14 AND Year = 2026);
    DECLARE @TypeID  INT  = (SELECT TypeID FROM tbl_weekly_report_ActionTypes WHERE TypeName = N'Geliştirme');
    DECLARE @ActionID BIGINT;

    INSERT INTO tbl_weekly_report_Actions (UserID, WeekID, TypeID, ActionDate)
    VALUES (@UserID, @WeekID, @TypeID, '2026-04-08');

    SET @ActionID = SCOPE_IDENTITY();

    -- Main action item (SortOrder = 0)
    INSERT INTO tbl_weekly_report_ActionItems (ActionID, SortOrder, ItemType, ItemValue)
    VALUES (@ActionID, 0, 'text', N'API entegrasyon geliştirmesi tamamlandı.');

    -- Sub-entry (SortOrder = 1)
    INSERT INTO tbl_weekly_report_ActionItems (ActionID, SortOrder, ItemType, ItemValue)
    VALUES (@ActionID, 1, 'text', N'Unit testler yazıldı ve geçti.');

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    ROLLBACK TRANSACTION;
    THROW;
END CATCH;

-- -------------------------------------------------------------
-- 4.7  Update action status + write history
-- -------------------------------------------------------------
BEGIN TRANSACTION;
BEGIN TRY

    DECLARE @ActionID2  BIGINT = 1001;
    DECLARE @NewStatus  INT    = (SELECT StatusID FROM tbl_weekly_report_ActionStatuses WHERE StatusKey = 'progress');
    DECLARE @ChangedBy  INT    = 1;

    -- Update current status on action
    UPDATE tbl_weekly_report_Actions
    SET StatusID  = @NewStatus,
        UpdatedAt = GETDATE()
    WHERE ActionID = @ActionID2;

    -- Record in history
    INSERT INTO tbl_weekly_report_ActionStatusHistory (ActionID, StatusID, ChangedBy)
    VALUES (@ActionID2, @NewStatus, @ChangedBy);

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    ROLLBACK TRANSACTION;
    THROW;
END CATCH;

-- -------------------------------------------------------------
-- 4.8  Soft-delete an action
-- -------------------------------------------------------------
UPDATE tbl_weekly_report_Actions
SET IsDeleted = 1,
    UpdatedAt = GETDATE()
WHERE ActionID = 1001;

-- -------------------------------------------------------------
-- 4.9  Full-text search across action items
-- -------------------------------------------------------------
SELECT
    a.ActionID,
    w.WeekNumber,
    at.TypeName,
    a.ActionDate,
    ai.ItemValue
FROM tbl_weekly_report_ActionItems ai
JOIN tbl_weekly_report_Actions     a  ON a.ActionID = ai.ActionID
JOIN tbl_weekly_report_Weeks w  ON w.WeekID   = a.WeekID
JOIN tbl_weekly_report_ActionTypes at ON at.TypeID  = a.TypeID
WHERE ai.ItemValue LIKE N'%entegrasyon%'   -- replace with search term
  AND a.IsDeleted  = 0
ORDER BY a.ActionDate DESC;

-- -------------------------------------------------------------
-- 4.10  Weekly report summary view (all types × statuses)
-- -------------------------------------------------------------
SELECT
    w.WeekNumber,
    at.TypeName,
    ISNULL(st.StatusLabel, 'No Status') AS Status,
    COUNT(*)                             AS Count
FROM tbl_weekly_report_Actions a
JOIN tbl_weekly_report_Weeks w  ON w.WeekID   = a.WeekID
JOIN tbl_weekly_report_ActionTypes    at ON at.TypeID  = a.TypeID
LEFT JOIN tbl_weekly_report_ActionStatuses st ON st.StatusID = a.StatusID
WHERE w.Year      = YEAR(GETDATE())
  AND a.IsDeleted = 0
GROUP BY w.WeekNumber, at.TypeName, st.StatusLabel
ORDER BY w.WeekNumber, at.TypeName, st.StatusLabel;
