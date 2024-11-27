import express, { Request, Response } from 'express';
import { ProposalLogic } from '../logic/ProposalLogic';
import { EndUserError } from '../Errors';
import logger from '../logging';

const router = express.Router();

router.get('/projects/:id', async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.id);
    if (isNaN(projectId)) {
      throw new EndUserError('Invalid project ID');
    }
    const projectInfo = await ProposalLogic.getFullProjectInformation(projectId);
    res.json(projectInfo);
  } catch (error) {
    if (error instanceof EndUserError) {
      res.status(404).json({ error: error.message });
    } else {
      logger.error('Error fetching project information:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

export default router;
