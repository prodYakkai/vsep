import { Socket } from 'socket.io';
import logger from 'jet-logger';


export const handleOnConnect = (socket: Socket) => {
  logger.info('Connected to server , socket id: ' + socket.id);
  socket.join(socket.id);
  socket.on('disconnect', () => handleOnDisconnect(socket));
};

export const handleOnDisconnect = (socket: Socket) => {
  logger.info('Disconnected from server');
  socket.leave(socket.id);
  socket.broadcast.emit('refresh');
};
