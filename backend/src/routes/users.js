'use strict';
const express = require('express');
const { z } = require('zod');
const { validate } = require('../middleware/validation');
const { authenticate, requireRole } = require('../middleware/auth');
const userService = require('../services/userService');
const { HttpError } = require('../middleware/errors');

const router = express.Router();

router.use(authenticate);
router.use(requireRole('admin'));

// ── Schemas ──────────────────────────────────────────
const idParamSchema = z.object({
  id: z.string().uuid()
});
const setActiveSchema = z.object({
  isActive: z.boolean()
});
const setRoleSchema = z.object({
  role: z.enum(['admin', 'user'])
});

// ── Routes ───────────────────────────────────────────

/**
 * GET /users - list all users (admin only)
 */
router.get('/', async (req, res, next) => {
  try {
    const users = await userService.listAll();
    res.json({ users });
  } catch (err) { next(err); }
});

/**
 * GET /users/:id
 */
router.get('/:id', validate({ params: idParamSchema }), async (req, res, next) => {
  try {
    const user = await userService.getById(req.params.id);
    if (!user) throw new HttpError(404, 'User not found');
    res.json(user);
  } catch (err) { next(err); }
});

/**
 * PATCH /users/:id/active - enable/disable user
 */
router.patch('/:id/active',
  validate({ params: idParamSchema, body: setActiveSchema }),
  async (req, res, next) => {
    try {
      // Don't allow self-disable
      if (req.params.id === req.user.id && !req.body.isActive) {
        throw new HttpError(400, 'Cannot disable your own account');
      }
      await userService.setActive({ userId: req.params.id, isActive: req.body.isActive });
      res.json({ ok: true });
    } catch (err) { next(err); }
  }
);

/**
 * PATCH /users/:id/role - change role
 */
router.patch('/:id/role',
  validate({ params: idParamSchema, body: setRoleSchema }),
  async (req, res, next) => {
    try {
      // Don't allow self-demotion
      if (req.params.id === req.user.id && req.body.role !== 'admin') {
        throw new HttpError(400, 'Cannot demote yourself from admin');
      }
      await userService.setRole({ userId: req.params.id, role: req.body.role });
      res.json({ ok: true });
    } catch (err) { next(err); }
  }
);

/**
 * DELETE /users/:id
 */
router.delete('/:id', validate({ params: idParamSchema }), async (req, res, next) => {
  try {
    if (req.params.id === req.user.id) {
      throw new HttpError(400, 'Cannot delete your own account');
    }
    await userService.deleteUser(req.params.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
