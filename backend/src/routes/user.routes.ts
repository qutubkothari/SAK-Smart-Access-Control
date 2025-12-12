import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  getUsers,
  createUser,
  getUserById,
  updateUser,
  deleteUser,
  searchHosts
} from '../controllers/user.controller';

const router = Router();

router.use(authenticate);

router.get('/search-hosts', searchHosts);

router.use(authorize('admin'));

router.get('/', getUsers);
router.post('/', createUser);
router.get('/:id', getUserById);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

export default router;
