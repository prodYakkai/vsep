# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VSEP (Very Simple Embedded Player) is a web-based media projection system that allows streaming and control of audio/video content through different protocols (WHEP/WebRTC and FLV). The system uses Express.js with Socket.IO for real-time communication and Redis for state management.

## Development Commands

### Universal Launcher (Recommended)
- `node launcher.js` - Cross-platform launcher that handles everything automatically
- `node launcher.js --help` - Show all launcher options
- `node launcher.js --env production` - Launch in production mode
- `node launcher.js --skip-git --skip-npm --no-kiosk` - Skip setup steps and disable kiosk mode

The universal launcher automatically:
- Checks Redis availability on port 6379
- Pulls latest git changes (unless --skip-git)
- Installs npm dependencies in root and src/static (unless --skip-npm)
- Builds the project (unless --skip-build)
- Starts the Node.js server
- Launches Chromium windows on all detected monitors
- Handles graceful shutdown and cleanup

### Core Commands (Manual)
- `npm run dev` - Start development server (uses SWC for performance, no TypeScript checking)
- `npm run dev:hot` - Start development server with hot reloading via nodemon
- `npm run build` - Build the project for production using custom build script
- `npm start` - Run the production build (requires building first)
- `npm run type-check` - Run TypeScript type checking (essential since dev mode doesn't check types)
- `npm run lint` - Run ESLint with TypeScript support

### Static Frontend Dependencies
The project has a separate frontend package in `src/static/` that needs its dependencies installed:
- Navigate to `src/static/` and run `npm install` to install frontend dependencies
- The universal launcher handles this automatically

### Development Notes
- Development mode uses SWC for performance and does not check TypeScript errors
- Always run `npm run type-check` before committing to catch type issues
- The server runs on HTTPS with certificates from `keys/` directory
- Use the universal launcher for the complete setup experience across platforms

## Architecture Overview

### Core Components
- **Server Entry Point**: `src/index.ts` - Sets up HTTPS server, Socket.IO, and Redis connection
- **Express App**: `src/server.ts` - Configures middleware, routes, and static file serving
- **API Routes**: `src/routes/index.ts` - REST API for projection management
- **Socket Handlers**: `src/socket.ts` - WebSocket connection/disconnection handling
- **Environment Config**: `src/common/Env.ts` - Environment variable configuration using jet-env

### Key Patterns
- **Error Handling**: Uses `safeAwait` utility for async error handling without try/catch
- **Redis Storage**: Stores projection state as JSON strings with keys like `projection:${id}`
- **Socket.IO Integration**: Real-time communication for projection control and updates
- **Path Aliases**: Uses `@src/*` TypeScript path mapping for clean imports

### Data Models
- **ProjectionState**: Core model for projection sessions with id, url, type (whep/flv), and device info
- **MediaDeviceInfo**: Represents audio/video devices with deviceId and label

### API Endpoints
- `GET /api/projections` - List all projections
- `GET /api/projection/:id` - Get/create projection by ID
- `POST /api/projection/:id/action` - Send control actions to projection
- `POST /api/projection/:id/devices` - Update available devices
- `POST /api/projection/:id/device` - Set active device
- `POST /api/projection/:id/job` - Update projection job (URL/type)
- `GET /api/reset_all` - Reset all projections

### Frontend Structure
- Static files served from `src/static/`
- HTML projection interfaces: `projection-whep.html`, `projection-flv.html`, `control.html`
- **Modular JavaScript Architecture**: Uses ES6 modules with inheritance-based framework
  - `js/framework/BaseProjection.js` - Base class for all projection types
  - `js/framework/WHEPProjection.js` - WebRTC/WHEP streaming implementation
  - `js/framework/FLVProjection.js` - FLV streaming implementation
  - `js/framework/ControlPanel.js` - Control panel management
  - `js/utils.js` - Shared utility functions (safeAwait, media device handling)
  - `js/api.js` - API service layer for server communication

### Dependencies
- **Runtime**: Express.js, Socket.IO, Redis client, HTTPS server
- **Development**: TypeScript, SWC, ESLint, Nodemon
- **Frontend**: jQuery, Bootstrap, WebRTC libraries, mpegts.js

## Redis Keys Pattern
- `projection:${id}` - Projection state storage
- `devices:${id}` - Available devices for projection
- `socketId:${id}` - Socket ID mapping for projection control

## Universal Launcher Features
The `launcher.js` provides cross-platform automation:

### Platform Support
- **Windows**: PowerShell commands, Chrome/Chromium detection, multi-monitor via Windows.Forms
- **Linux**: bash commands, xrandr for multi-monitor, standard Chrome/Chromium paths
- **macOS**: system_profiler for display info, standard application paths

### Environment Detection
- Automatically detects platform and adjusts commands accordingly
- Finds Chrome/Chromium installations in standard locations
- Falls back to PATH-based command lookup if installation not found

### Process Management
- Tracks all spawned processes (Node.js server, Chromium windows)
- Graceful shutdown on SIGINT/SIGTERM with proper cleanup
- Automatic process termination if parent launcher exits

### Multi-Monitor Support
- Detects all connected displays and their geometry
- Launches separate Chromium windows for each monitor
- Creates isolated user profiles per monitor
- Configures window positioning and sizing automatically