import { Router } from 'express';
import { requireAuth } from '../middleware/userAuth.js';
import {
    createAddress,
    deleteAddress,
    getCreditScore,
    getUserPayouts,
    getBankInfo,
    getPublicUser,
    listFavorites,
    syncOwnProfile,
    toggleFavorite,
    listAddresses,
    saveBankInfo,
    updateAddress,
    updateLocation,
} from '../controllers/userController.js';

/**
 * User account routes: credit score, payout history, location, bank info, addresses.
 */
export const usersRouter = Router();
const router = usersRouter;

router.get('/api/users/:userId/credit', getCreditScore);
router.get('/api/users/payouts', requireAuth, getUserPayouts);
router.post('/api/users/update-location', requireAuth, updateLocation);
router.get('/api/users/bank-info', requireAuth, getBankInfo);
router.post('/api/users/bank-info', requireAuth, saveBankInfo);

// Addresses
router.get('/api/users/addresses', requireAuth, listAddresses);
router.post('/api/users/addresses', requireAuth, createAddress);
router.put('/api/users/addresses/:id', requireAuth, updateAddress);
router.delete('/api/users/addresses/:id', requireAuth, deleteAddress);

// Profile mirror + favourites (replace the client's direct table access)
router.post('/api/users/me', requireAuth, syncOwnProfile);
router.get('/api/users/favorites', requireAuth, listFavorites);
router.post('/api/users/favorites/:productId/toggle', requireAuth, toggleFavorite);

// Public profile card — registered last so the literal paths above win over the :userId param
router.get('/api/users/:userId', getPublicUser);
