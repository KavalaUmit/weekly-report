-- =============================================================
-- Create SQL Server Login & Database User for Weekly Report WS
-- Run this script on the SQL Server instance as sysadmin (sa)
-- =============================================================

-- 1. Create the login at SERVER level
--    Change the password before running in production!
CREATE LOGIN weekly_report_user
    WITH PASSWORD    = 'Wr@2026StrongPass!',
         CHECK_POLICY = ON,
         CHECK_EXPIRATION = OFF;
GO

-- 2. Switch to the target database
USE WeeklyReport;
GO

-- 3. Create the database user mapped to the login
CREATE USER weekly_report_user
    FOR LOGIN weekly_report_user
    WITH DEFAULT_SCHEMA = dbo;
GO

-- 4. Grant minimum required permissions (CRUD only, no DDL)
GRANT SELECT, INSERT, UPDATE, DELETE
    ON SCHEMA::dbo
    TO weekly_report_user;
GO

-- =============================================================
-- Optional: verify the user was created correctly
-- =============================================================
SELECT
    sp.name          AS LoginName,
    sp.type_desc     AS LoginType,
    dp.name          AS DatabaseUser,
    dp.default_schema_name,
    r.name           AS DatabaseRole
FROM sys.server_principals sp
JOIN sys.database_principals dp ON dp.sid = sp.sid
LEFT JOIN sys.database_role_members rm ON rm.member_principal_id = dp.principal_id
LEFT JOIN sys.database_principals r  ON r.principal_id = rm.role_principal_id
WHERE sp.name = 'weekly_report_user';
GO

-- =============================================================
-- To change the password later:
-- =============================================================
-- ALTER LOGIN weekly_report_user WITH PASSWORD = 'NewPassword!';

-- To drop login and user if needed:
-- USE WeeklyReport; DROP USER weekly_report_user;
-- USE master;         DROP LOGIN weekly_report_user;
