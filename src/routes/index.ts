import { Router, Request, Response } from 'express';
import { redis,io } from '@src/index';
import { safeAwait } from '@src/util/safe-await';
import { MediaDeviceInfo, ProjectionState } from '@src/models/Projection';
import HttpStatusCodes from '@src/common/HttpStatusCodes';
import logger from 'jet-logger';
import { ProjectionAction } from '@src/common/constants';

/******************************************************************************
                                Variables
******************************************************************************/

const apiRouter = Router();

apiRouter.get('/projections', 
  async (req: Request, res: Response): Promise<void> => {
    const [error, data] = await safeAwait(redis.keys('projection:*'));
    if (error) {
      res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).send('Error retrieving data');
      return;
    }
    if (!data) {
      res.status(HttpStatusCodes.NOT_FOUND).send('No projections found');
      return;
    }
    const projections = data.map(async (key) => {
      const id = key.split(':')[1];
      const [err, projection] = await safeAwait(redis.get(`projection:${id}`));
      if (err) {
        logger.err(err);
        return null;
      }
      if (!projection) {
        return null;
      }
      return JSON.parse(projection) as ProjectionState;
    });
    const projectionResults = await Promise.all(projections);
    res.send(projectionResults);
});


apiRouter.get('/projection/:id', 
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { socketId, type } = req.query as { socketId?: string, type: string };
    if (type !== 'whep' && type !== 'flv') {
      res.status(HttpStatusCodes.BAD_REQUEST).send('Invalid type');
      return;
    }
    const [error, data] = await safeAwait(redis.get(`projection:${id}`));
    if (error) {
      res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).send('Error retrieving data');
      return;
    }
    
    if (socketId) {
      const [errId, _id] =
      await safeAwait(
        redis.set(`socketId:${id}`, socketId));
      if (errId) {
        res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).send('Error creating new projection');
        return;
      }
    }

    if (!data) {
      logger.info(`Projection ${id} not found, creating new projection`);
      if (!socketId || socketId === '') {
        logger.err(error);
        res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).send('Error retrieving data');
        return;
      }
      // no data found, then create a new projection
      const newProjection: ProjectionState = {
        id,
        url: '',
        type,
        activeDevice: {
          deviceId: 'default',
          label: 'default',
        }
      };
      const [err, _p] = 
        await safeAwait(
          redis.set(`projection:${id}`, JSON.stringify(newProjection)));
      if (err) {
        res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).send('Error creating new projection');
        return;
      }
      res.status(201).send(newProjection);
      io.sockets.emit('refresh');
      return;
    }
    res.send(JSON.parse(data) as ProjectionState);
});

apiRouter.post('/projection/:id/action',
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { action } = req.body as { action: string };
    if (!ProjectionAction.includes(action)) {
      res.status(HttpStatusCodes.BAD_REQUEST).send('Invalid action');
      return;
    }
    const [error, data] = await safeAwait(
      redis.get(`socketId:${id}`));
    if (error) {
      res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).send('Error retrieving data');
      return;
    }
    if (!data) {
      res.status(HttpStatusCodes.NOT_FOUND).send('Projection not found');
      return;
    }
    io.to(data).emit('action', {
      action,
    });
    res.json({
      action,
    });
});

apiRouter.post('/projection/:id/devices',
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { devices, activeDevice } = req.body as 
    { devices: MediaDeviceInfo[], activeDevice: MediaDeviceInfo };
    
    if (!devices) {
      res.status(HttpStatusCodes.BAD_REQUEST).send('Invalid devices');
      return;
    }

    const [error, data] = await safeAwait(
      redis.get(`projection:${id}`));
    if (error) {
      res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).send('Error retrieving data');
      return;
    }
    if (!data) {
      res.status(HttpStatusCodes.NOT_FOUND).send('Projection not found');
      return;
    }

    // mark active device
    const projection = JSON.parse(data) as ProjectionState;
    let deviceCandidate = devices.find((device) => device.deviceId === activeDevice.deviceId);
    if (!deviceCandidate) {
      deviceCandidate = devices.find((device) => device.label === activeDevice.label);
    }
    if (deviceCandidate) {
      projection.activeDevice = deviceCandidate;
    }
  
    const [err, _p] =
      await safeAwait(
        redis.set(`devices:${id}`, JSON.stringify(devices)));
    if (err) {
      res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).send('Error updating projection');
      return;
    }

    const [errState, _state] =
      await safeAwait(
        redis.set(`projection:${id}`, JSON.stringify(projection)));
    if (errState) {
      res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).send('Error updating projection');
      return;
    }
    
    io.sockets.emit('refresh', {
      projectionId: id,
    });
    res.json({
      activeDevice
    })
});

apiRouter.get('/projection/:id/devices',
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const [error, data] = await safeAwait(
      redis.get(`devices:${id}`));
    if (error) {
      res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).send('Error retrieving data');
      return;
    }
    if (!data) {
      res.status(HttpStatusCodes.NOT_FOUND).send('Projection not found');
      return;
    }
    const devices = JSON.parse(data) as MediaDeviceInfo[];
    res.send(devices);
});

apiRouter.post('/projection/:id/device',
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { device } = req.body as { device: MediaDeviceInfo };
    if (!device) {
      res.status(HttpStatusCodes.BAD_REQUEST).send('Invalid device');
      return;
    }
    const [error, socketId] = await safeAwait(
      redis.get(`socketId:${id}`));
    if (error) {
      res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).send('Error retrieving data');
      return;
    }
    if (!socketId) {
      res.status(HttpStatusCodes.NOT_FOUND).send('Projection not found');
      return;
    }
    // lookup projection
    const [err, projection] = await safeAwait(
      redis.get(`projection:${id}`));
    if (err) {
      res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).send('Error retrieving data');
      return;
    }
    if (!projection) {
      res.status(HttpStatusCodes.NOT_FOUND).send('Projection not found');
      return;
    }
    const proj = JSON.parse(projection) as ProjectionState;
    proj.activeDevice = device;
    const [errState, _state] =
      await safeAwait(
        redis.set(`projection:${id}`, JSON.stringify(proj)));
    if (errState) {
      res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).send('Error updating projection');
      return;
    }
    io.to(socketId).emit('audioDevice', device);
    res.json({
      device,
    });
});

apiRouter.post('/projection/:id/job',
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { job } = req.body as { job: ProjectionState };
    if (!job) {
      res.status(HttpStatusCodes.BAD_REQUEST).send('Invalid job');
      return;
    }
    const [error, socketId] = await safeAwait(
      redis.get(`socketId:${id}`));
    if (error) {
      res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).send('Error retrieving data');
      return;
    }
    if (!socketId) {
      res.status(HttpStatusCodes.NOT_FOUND).send('Projection not found');
      return;
    }

    const [err, projState] =
      await safeAwait(
        redis.get(`projection:${id}`));
    if (err) {
      res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).send('Error reading projection');
      return;
    }
    if (!projState) {
      res.status(HttpStatusCodes.NOT_FOUND).send('Projection not found');
      return;
    }

    const state = JSON.parse(projState) as ProjectionState;
    state.url = job.url;
    state.type = job.type;
    const [errState, _state] =
      await safeAwait(
        redis.set(`projection:${id}`, JSON.stringify(state)));
    if (errState) {
      res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).send('Error updating projection');
      return;
    }

    io.to(socketId).emit('job', {
      job,
    });
    res.json({
      job,
    });
});



/******************************************************************************
                                Export default
******************************************************************************/

export default apiRouter;
