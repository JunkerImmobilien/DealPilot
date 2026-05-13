'use strict';

/**
 * Validate request body/query/params against a Zod schema.
 * Replaces req.body etc. with the parsed (and possibly transformed) data.
 *
 * Usage:
 *   router.post('/things', validate({ body: thingSchema }), handler)
 */
function validate(schemas) {
  return (req, res, next) => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body);
      if (schemas.query) req.query = schemas.query.parse(req.query);
      if (schemas.params) req.params = schemas.params.parse(req.params);
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { validate };
