// eslint-disable-next-line @typescript-eslint/no-require-imports
import './config';
import logger from 'jet-logger';

import Env from '@src/common/Env';
import app from './server';
import { createServer as createHttpsServer } from 'node:https';
import { Server } from 'socket.io';
import { handleOnConnect, handleOnDisconnect } from './socket';
import { createClient as createRedis } from 'redis';
import fs from 'node:fs';
import path from 'node:path';
/******************************************************************************
                                  Run
******************************************************************************/

const SERVER_START_MSG = ('Express server started on port: ' + 
  Env.Port.toString());

const keyFile = fs.readFileSync(path.join(__dirname + '/../keys/cert.key'), 'utf8');
const certFile = fs.readFileSync(path.join(__dirname + '/../keys/cert.crt'), 'utf8');

export const server = createHttpsServer({
  key: keyFile,
  cert: certFile,
}, app).listen(Env.Port, '0.0.0.0',async () => {
  logger.imp(SERVER_START_MSG);
  await redis.connect();
});

export const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

export const redis = createRedis(); 
io.on('connection', handleOnConnect);
io.on('disconnect', handleOnDisconnect);
