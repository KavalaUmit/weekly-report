# 📋 Weekly Action Tracking System

> A full-stack corporate weekly reporting and action tracking application.  
> **React 18** frontend + **ASP.NET Web API 2 / .NET Framework 4.8** self-hosted REST backend + **SQL Server** database.

---

## 📸 Screenshots

### Main View – Action List
![Main View](docs/screenshots/main-view.png)

### Left Panel – Add New Action
![Add Action](docs/screenshots/add-action.png)

### Left Panel – Edit Action
![Edit Action](docs/screenshots/edit-action.png)

### Right-Click Context Menu – Status Management
![Context Menu](docs/screenshots/context-menu.png)

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         User Browser                        │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐  │
│   │          React 18 SPA  (port 3000)                  │  │
│   │  • Material UI (MUI v7)                             │  │
│   │  • Context menu status management                   │  │
│   │  • Week / type TreeView layout                      │  │
│   └──────────────────────┬──────────────────────────────┘  │
└──────────────────────────┼──────────────────────────────────┘
                           │ HTTP / REST  (JSON)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│        ASP.NET Web API 2  –  OWIN Self-Host (port 4443)     │
│                                                             │
│  • .NET Framework 4.8                                       │
│  • 10 REST Controllers  (ApiController)                     │
│  • Newtonsoft.Json – PascalCase serialization               │
│  • Configurable CORS (AllowedOrigins)                       │
│  • Global Exception Filter (stack trace suppression)        │
│  • Dapper ORM                                               │
└──────────────────────────┬──────────────────────────────────┘
                           │ ADO.NET / SqlClient
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              SQL Server  (KAVALA-L\SQLEXPRESS)              │
│              Database: WeeklyReport                         │
│                                                             │
│  tbl_weekly_report_Lines                                    │
│  tbl_weekly_report_Units                                    │
│  tbl_weekly_report_Departments                              │
│  tbl_weekly_report_Users                                    │
│  tbl_weekly_report_Weeks                                    │
│  tbl_weekly_report_ActionTypes                              │
│  tbl_weekly_report_ActionStatuses                           │
│  tbl_weekly_report_Actions                                  │
│  tbl_weekly_report_ActionItems                              │
│  tbl_weekly_report_ActionStatusHistory                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

### Frontend (`weekly-report/`)
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.2 | SPA framework |
| Material UI (MUI) | 7.x | UI components |
| Lucide React | 0.263 | Icons |
| Create React App | 5.0.1 | Build toolchain |

### Backend (`weekly-report-net-ws/`)
| Technology | Version | Purpose |
|------------|---------|---------|
| .NET Framework | 4.8 | Runtime |
| ASP.NET Web API 2 | 5.2.9 | REST framework |
| OWIN Self-Host | 5.2.9 | HTTP server |
| Microsoft.Owin.Cors | 4.2.2 | CORS handling |
| Dapper | 2.1.35 | Micro ORM |
| Microsoft.Data.SqlClient | 5.2.1 | SQL Server driver |
| Newtonsoft.Json | 13.0.3 | JSON serialization |

---

## 📁 Project Structure

```
weekly-report/                    ← React Frontend
├── src/
│   ├── App.js                    ← Main application component
│   ├── api.js                    ← Centralized API service layer
│   ├── App.css                   ← Stylesheet
│   └── data/                     ← Static data files
├── database/
│   └── schema.sql                ← SQL Server schema + seed data
├── docs/
│   └── screenshots/              ← README images
├── .env.development              ← Development environment variables
└── package.json

weekly-report-net-ws/             ← .NET Backend
├── Controllers/
│   ├── ActionsController.cs      ← Actions (CRUD + PATCH status)
│   ├── ActionItemsController.cs  ← Action sub-items
│   ├── ActionStatusesController.cs
│   ├── ActionStatusHistoryController.cs
│   ├── ActionTypesController.cs
│   ├── DepartmentsController.cs
│   ├── LinesController.cs
│   ├── UnitsController.cs
│   ├── UsersController.cs
│   ├── WeeksController.cs
│   └── HealthController.cs       ← /health endpoint
├── Data/
│   └── DbConnectionFactory.cs    ← Static SQL connection factory
├── Filters/
│   └── GlobalExceptionFilter.cs  ← Error suppression filter
├── Models/
│   └── Models.cs                 ← All entity and request models
├── Program.cs                    ← OWIN self-host entry point
├── Startup.cs                    ← OWIN pipeline configuration
├── App.config                    ← Connection string and settings
└── WeeklyReportWS.csproj
```

---

## ⚙️ Setup

### Prerequisites

- Node.js 18+
- .NET Framework 4.8 SDK (Visual Studio 2019/2022 or .NET 6+ SDK)
- SQL Server (Express or higher)

---

### 1. Database Setup

```bash
sqlcmd -S YOUR_SERVER\SQLEXPRESS -i database/schema.sql
```

> The schema file includes tables, indexes, and seed data (status types, action types, sample line/unit data).

---

### 2. Backend Setup (`weekly-report-net-ws/`)

#### Configure the connection string

**Option 1 – Environment variable (recommended):**
```powershell
$env:WEEKLY_REPORT_CONNECTION_STRING = "Server=YOUR_SERVER\SQLEXPRESS;Database=WeeklyReport;User Id=your_user;Password=your_password;Encrypt=True;TrustServerCertificate=True;"
```

**Option 2 – Edit `App.config`:**
```xml
<connectionStrings>
  <add name="DefaultConnection"
       connectionString="Server=YOUR_SERVER\SQLEXPRESS;Database=WeeklyReport;
                         User Id=your_user;Password=your_password;
                         Encrypt=True;TrustServerCertificate=True;" />
</connectionStrings>
```

#### Configure allowed CORS origins (`App.config`):
```xml
<appSettings>
  <add key="AllowedOrigins" value="http://localhost:3000" />
  <add key="Port"           value="4443" />
</appSettings>
```

#### Build and run:
```bash
cd weekly-report-net-ws
dotnet build WeeklyReportWS.csproj
dotnet run --project WeeklyReportWS.csproj
```

Backend starts at `http://localhost:4443`.  
Health check: `GET http://localhost:4443/health`

---

### 3. Frontend Setup (`weekly-report/`)

```bash
cd weekly-report
npm install
```

Verify `.env.development` (included by default):
```env
REACT_APP_API_URL=http://localhost:4443
```

```bash
npm start
```

App opens at `http://localhost:3000`.

---

## 🔌 REST API Reference

Base URL: `http://localhost:4443`

### Actions

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/actions` | List actions (filters: `weekNumber`, `year`, `userId`, `lineId`, `unitId`, `statusId`) |
| `GET` | `/api/actions/{id}` | Single action + sub-items |
| `POST` | `/api/actions` | Create new action |
| `PUT` | `/api/actions/{id}` | Update action |
| `PATCH` | `/api/actions/{id}/status` | Update status only + write history |
| `DELETE` | `/api/actions/{id}` | Soft-delete (IsDeleted=1) |

**POST /api/actions – Request body:**
```json
{
  "UserID": 1,
  "WeekID": 15,
  "TypeID": 2,
  "ActionDate": "2026-04-14",
  "StatusID": null,
  "actionItems": [
    { "type": "text",  "value": "Main action text" },
    { "type": "text",  "value": "Sub-item" },
    { "type": "image", "value": "data:image/png;base64,..." }
  ]
}
```

**PATCH /api/actions/{id}/status – Request body:**
```json
{
  "StatusID": 3,
  "ChangedBy": 1
}
```
> Sending `StatusID: null` clears the status (Remove from Report).

---

### Action Sub-Items

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/actions/{actionId}/items` | Get sub-items |
| `POST` | `/api/actions/{actionId}/items` | Add sub-item |
| `PUT` | `/api/actions/{actionId}/items/{itemId}` | Update sub-item |
| `DELETE` | `/api/actions/{actionId}/items/{itemId}` | Delete sub-item |

---

### Status History

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/actions/{actionId}/status-history` | Get status history |
| `POST` | `/api/actions/{actionId}/status-history` | Add manual history entry |
| `DELETE` | `/api/actions/{actionId}/status-history/{historyId}` | Delete history entry |

---

### Other Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/users` | User list |
| `GET` | `/api/users/{id}` | User detail |
| `GET` | `/api/users/windowname/{windowName}` | Find user by Windows identity |
| `GET` | `/user/getuserdata?windowName=` | Legacy user lookup |
| `GET` | `/api/weeks?year=` | Weeks |
| `GET` | `/api/lines` | Lines |
| `GET` | `/api/units?lineId=` | Units |
| `GET` | `/api/departments?unitId=&lineId=` | Departments |
| `GET` | `/api/action-types` | Action types |
| `GET` | `/api/action-statuses` | Action statuses |
| `GET` | `/health` | Health check |

---

## 🗄️ Database Schema (Summary)

```
Lines
  └── Units
        └── Departments
              └── Users

Weeks ──────────────────────────────────────┐
ActionTypes ─────────────────────────────── ┤
ActionStatuses ──────────────────────────── ┤
                                            ▼
                                        Actions
                                       /       \
                               ActionItems   ActionStatusHistory
```

### Action Statuses (Seed Data)

| StatusKey | Label | Color |
|-----------|-------|-------|
| `highlight` | Highlight | 🔴 #ef4444 |
| `lowlight` | LowLight | ⚫ #6b7280 |
| `waiting` | Waiting | 🟡 #f59e0b |
| `information` | Info | 🔵 #3b82f6 |
| `progress` | Progress | 🟢 #10b981 |

---

## 🔒 Security

- **No credentials in source code** – Connection string is read from the `WEEKLY_REPORT_CONNECTION_STRING` environment variable; `App.config` is used as a fallback.
- **SQL Injection protection** – All queries use Dapper parameterized queries.
- **Stack trace suppression** – `GlobalExceptionFilter` returns only `{ "error": "An internal server error occurred." }` to clients.
- **CORS restriction** – Allowed origins are configured via `App.config > AllowedOrigins`.
- **Encrypted connection** – Connection string uses `Encrypt=True` for TLS connections to SQL Server.
- **Soft-delete** – Actions are never physically deleted; they are flagged with `IsDeleted=1`.

---

## 🚀 IIS Deployment (Frontend)

Build and copy to the IIS directory:

```bash
cd weekly-report
npm run build
```

> The `postbuild` script automatically copies the `build/` output to the `iis-deploy/` folder using `robocopy`.

Publish the `iis-deploy/` folder as a static site in IIS.

---

## 🧑‍💻 Developer Notes

### Frontend API layer (`src/api.js`)

All HTTP calls are managed through the centralized `api.js`:

```js
import * as api from './api';

// Load action list
const actions = await api.getActions(weekNumber, year, lineId);

// Update status
await api.patchActionStatus(actionId, { StatusID: 3, ChangedBy: userId });

// Delete action (soft-delete)
await api.deleteAction(actionId);
```

### Backend connection factory (`Data/DbConnectionFactory.cs`)

```csharp
// Priority: environment variable → App.config → exception
var conn = DbConnectionFactory.CreateConnection();
```

---

## 📄 License

This project was developed for internal corporate use.
