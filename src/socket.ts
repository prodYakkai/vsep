import { Socket } from 'socket.io';
import { redis } from '@src/index';
import { safeAwait } from '@src/util/safe-await';
import logger from 'jet-logger';

interface SocketProjectionMap {
  [socketId: string]: string; // socketId -> projectionId
}

interface ProjectionStatus {
  projectionId: string;
  socketId: string;
  type: string;
  isOnline: boolean;
  lastHeartbeat: number;
  health?: any;
  playerStatus?: any;
  connectedAt: number;
}

interface ProjectionStatusMap {
  [projectionId: string]: ProjectionStatus;
}

const socketProjectionMap: SocketProjectionMap = {};
const projectionStatusMap: ProjectionStatusMap = {};

export const handleOnConnect = (socket: Socket) => {
  logger.info('Connected to server, socket id: ' + socket.id);
  socket.join(socket.id);
  
  // Track projection association when a projection connects
  trackProjectionAssociation(socket);
  
  // Set up projection-specific event handlers
  setupProjectionHandlers(socket);
  
  socket.on('disconnect', () => handleOnDisconnect(socket));
};

export const handleOnDisconnect = (socket: Socket) => {
  logger.info('Disconnected from server');
  
  // Get projection ID associated with this socket
  const projectionId = socketProjectionMap[socket.id];
  
  if (projectionId) {
    // Update projection status
    if (projectionStatusMap[projectionId]) {
      projectionStatusMap[projectionId].isOnline = false;
      projectionStatusMap[projectionId].lastHeartbeat = Date.now();
    }
    
    // Notify control panel that this projection went offline
    socket.broadcast.emit('client_disconnected', { 
      projectionId,
      socketId: socket.id 
    });
    
    // Broadcast updated projection status
    socket.broadcast.emit('projection_status_update', {
      projectionId,
      status: projectionStatusMap[projectionId] || { isOnline: false }
    });
    
    // Remove from tracking
    delete socketProjectionMap[socket.id];
    
    logger.info(`Projection ${projectionId} went offline`);
  }
  
  socket.leave(socket.id);
  socket.broadcast.emit('refresh');
};

function setupProjectionHandlers(socket: Socket) {
  // Handle projection registration
  socket.on('projection_register', (data) => {
    const { projectionId, type } = data;
    logger.info(`Received projection registration: ${projectionId} (${type}) from socket ${socket.id}`);
    
    // Track this projection
    socketProjectionMap[socket.id] = projectionId;
    projectionStatusMap[projectionId] = {
      projectionId,
      socketId: socket.id,
      type,
      isOnline: true,
      lastHeartbeat: Date.now(),
      connectedAt: Date.now()
    };
    
    // Notify control panel
    socket.broadcast.emit('client_connected', { 
      projectionId,
      socketId: socket.id 
    });
    
    socket.broadcast.emit('projection_status_update', {
      projectionId,
      status: projectionStatusMap[projectionId]
    });
    
    logger.info(`Projection ${projectionId} registered and came online`);
  });

  // Handle projection heartbeat
  socket.on('projection_heartbeat', (data) => {
    const { projectionId, status } = data;
    logger.info(`Received heartbeat from projection ${projectionId} with status:`, status);
    
    if (projectionStatusMap[projectionId]) {
      projectionStatusMap[projectionId].lastHeartbeat = Date.now();
      projectionStatusMap[projectionId].health = status;
      projectionStatusMap[projectionId].isOnline = true;
      
      // Broadcast health update to control panels
      socket.broadcast.emit('projection_health_update', {
        projectionId,
        health: status,
        timestamp: Date.now()
      });
      
      logger.info(`Updated health for projection ${projectionId}`);
    } else {
      logger.warn(`Received heartbeat for unknown projection: ${projectionId}`);
    }
  });

  // Handle heartbeat response
  socket.on('projection_heartbeat_response', (data) => {
    const { projectionId, status } = data;
    
    if (projectionStatusMap[projectionId]) {
      projectionStatusMap[projectionId].lastHeartbeat = Date.now();
      projectionStatusMap[projectionId].health = status;
      projectionStatusMap[projectionId].isOnline = true;
    }
  });

  // Handle projection unregistration
  socket.on('projection_unregister', (data) => {
    const { projectionId } = data;
    
    if (projectionStatusMap[projectionId]) {
      projectionStatusMap[projectionId].isOnline = false;
      projectionStatusMap[projectionId].lastHeartbeat = Date.now();
      
      socket.broadcast.emit('projection_status_update', {
        projectionId,
        status: projectionStatusMap[projectionId]
      });
    }
    
    delete socketProjectionMap[socket.id];
    
    logger.info(`Projection ${projectionId} unregistered`);
  });

  // Handle player status updates from projections
  socket.on('player_status_update', (data) => {
    const { projectionId, playerStatus } = data;
    logger.info(`Received player status update from projection ${projectionId}:`, playerStatus);
    
    if (projectionStatusMap[projectionId]) {
      projectionStatusMap[projectionId].playerStatus = playerStatus;
      projectionStatusMap[projectionId].lastHeartbeat = Date.now();
      
      // Broadcast player status update to control panels
      socket.broadcast.emit('projection_player_status_update', {
        projectionId,
        playerStatus,
        timestamp: Date.now()
      });
      
      logger.info(`Broadcasting player status update for projection ${projectionId}`);
    } else {
      logger.warn(`Received player status update for unknown projection: ${projectionId}`);
    }
  });

  // Handle requests for projection status
  socket.on('get_projection_status', (data, callback) => {
    const { projectionId } = data || {};
    
    if (projectionId && projectionStatusMap[projectionId]) {
      callback(projectionStatusMap[projectionId]);
    } else if (!projectionId) {
      // Return all projection statuses
      callback(Object.values(projectionStatusMap));
    } else {
      callback(null);
    }
  });
}

async function trackProjectionAssociation(socket: Socket) {
  // Check if this socket is associated with a projection
  const [error, keys] = await safeAwait(redis.keys('socketId:*'));
  if (error || !keys) return;
  
  for (const key of keys) {
    const [err, storedSocketId] = await safeAwait(redis.get(key));
    if (err || storedSocketId !== socket.id) continue;
    
    // Extract projection ID from key (socketId:projectionId)
    const projectionId = key.split(':')[1];
    if (projectionId) {
      // Track this association
      socketProjectionMap[socket.id] = projectionId;
      
      // Create or update projection status
      if (!projectionStatusMap[projectionId]) {
        projectionStatusMap[projectionId] = {
          projectionId,
          socketId: socket.id,
          type: 'unknown',
          isOnline: true,
          lastHeartbeat: Date.now(),
          connectedAt: Date.now()
        };
      } else {
        projectionStatusMap[projectionId].isOnline = true;
        projectionStatusMap[projectionId].socketId = socket.id;
        projectionStatusMap[projectionId].lastHeartbeat = Date.now();
      }
      
      // Notify control panel that this projection came online
      socket.broadcast.emit('client_connected', { 
        projectionId,
        socketId: socket.id 
      });
      
      socket.broadcast.emit('projection_status_update', {
        projectionId,
        status: projectionStatusMap[projectionId]
      });
      
      logger.info(`Projection ${projectionId} came online`);
      break;
    }
  }
}

// Cleanup stale projections periodically
setInterval(() => {
  const now = Date.now();
  const staleThreshold = 2 * 60 * 1000; // 2 minutes
  
  Object.keys(projectionStatusMap).forEach(projectionId => {
    const status = projectionStatusMap[projectionId];
    if (status.isOnline && (now - status.lastHeartbeat > staleThreshold)) {
      status.isOnline = false;
      logger.warn(`Projection ${projectionId} marked as offline due to stale heartbeat`);
    }
  });
}, 60000); // Check every minute
