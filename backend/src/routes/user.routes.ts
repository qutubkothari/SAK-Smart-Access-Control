import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  getUsers,
  createUser,
  getUserById,
  updateUser,
  deleteUser,
  searchHosts,
  lookupUserByITS,
  getMyEmployees
} from '../controllers/user.controller';

const router = Router();

router.use(authenticate);

router.get('/search-hosts', searchHosts);
router.get('/lookup/:its_id', lookupUserByITS); // ITS lookup for internal meetings
router.get('/my-employees', authorize('secretary'), getMyEmployees); // Secretary's assigned employees

router.use(authorize('admin'));

router.get('/', getUsers);
router.post('/', createUser);
router.get('/:id', getUserById);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

export default router;
