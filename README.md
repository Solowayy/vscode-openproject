# OpenProject VS Code Extension

Manage your OpenProject tasks directly from Visual Studio Code. This extension allows you to view projects, create tasks (including child tasks), and edit work packages without leaving your editor.

## Features

### 1. Project Explorer 🗂️
- View all your projects and their hierarchies in the Activity Bar.
- Browse work packages (tasks, bugs, features, etc.) grouped by project.
- **Hierarchical View**: See sub-projects and sub-tasks structured naturally.

### 2. Create Tasks & Sub-tasks ➕
- **Create Work Package**: Easily create new tasks in any project.
- **Create Child Task**: specific command to add sub-tasks to existing "Summary Tasks".
- **Dynamic Selection**: The extension fetches available **Types**, **Statuses**, and **Priorities** dynamically from your specific project configuration, preventing API errors.
- **Smart Assignee**: Select an assignee from a searchable list of project members (no more guessing User IDs!).

### 3. Edit Work Packages ✏️
- Click on any task to open the **Detail View**.
- Edit subject, description (Markdown supported!), status, priority, type, and assignee.
- Save changes instantly to your OpenProject server.

## Installation & Configuration

1. Install the extension.
2. Open the **OpenProject** view in the sidebar.
3. Click **Configure Connection** (or run `OpenProject: Configure Connection`).
4. Enter your OpenProject settings:
   - **URL**: Your instance URL (e.g., `https://community.openproject.org`).
   - **API Key**: Generate an API key in your User Account > Access Tokens.

## Usage

### Commands
- `OpenProject: Configure Connection`: Setup your credentials.
- `OpenProject: Refresh Data`: Reload the project tree.
- `OpenProject: Create Work Package`: Start creating a new task.
- `OpenProject: Create Child Task`: (Context menu only) Create a sub-task under a Summary Task.

### Context Menus
- Right-click on a **Project** to create a new task in it.
- Right-click on a **Summary Task** to add a child task.

## Requirements
- An active OpenProject instance (v12+ recommended).
- API Key with sufficient permissions (view/create/edit work packages).

## Known Issues
- Currently supports basic authentication via API Key.
- Ensure your user has permissions to see the projects you are trying to access.

---
**Enjoy managing your projects efficiently!** 🚀
