/*
const Joi = require('joi');
const mongoose = require('mongoose');

// Shared validation rules
const idSchema = Joi.string().custom((value, helpers) => {
  return mongoose.Types.ObjectId.isValid(value) 
    ? value 
    : helpers.error('any.invalid');
}).messages({
  'any.invalid': 'Invalid ID format',
  'string.empty': 'ID cannot be empty'
});

const dateSchema = Joi.date().iso().messages({
  'date.base': 'Must be a valid ISO date (YYYY-MM-DD)',
  'date.iso': 'Use ISO format (YYYY-MM-DD)'
});

const courseTypeSchema = Joi.string().trim().min(2).max(50).valid('robotics', 'software', 'workshop', 'certification').required().messages({
  'string.empty': 'Course type is required',
  'any.only': 'Course type must be robotics, software, workshop, or certification'
});

// --- COURSE VALIDATION ---
const validateCreateCourse = (req, res, next) => {
  const schema = Joi.object({
    name: Joi.string().trim().min(3).max(100).required().messages({
      'string.empty': 'Course name is required',
      'string.min': 'Name must be at least 3 characters',
      'string.max': 'Name cannot exceed 100 characters'
    }),
    code: Joi.string().trim().uppercase().min(2).max(20)
      .regex(/^[A-Z0-9]+[A-Z0-9-]*$/)
      .required()
      .messages({
        'string.pattern.base': 'Code must start with letter/number, allow letters, numbers, hyphens',
        'string.empty': 'Course code is required',
        'string.min': 'Code must be at least 2 characters',
        'string.max': 'Code cannot exceed 20 characters'
      }),
    description: Joi.string().trim().max(500).optional(),
    type: courseTypeSchema,
    prerequisites: Joi.array().items(idSchema).unique().max(5).optional().messages({
      'array.max': 'Maximum 5 prerequisites allowed'
    })
  }).options({ abortEarly: false });

  validateRequest(schema, req, res, next);
};

const validateUpdateCourse = (req, res, next) => {
  const schema = Joi.object({
    name: Joi.string().trim().min(3).max(100).optional(),
    description: Joi.string().trim().max(500).optional(),
    type: courseTypeSchema.optional(),
    prerequisites: Joi.array().items(idSchema).unique().max(5).optional()
  }).min(1).messages({
    'object.min': 'At least one field is required for update'
  });

  validateRequest(schema, req, res, next);
};

// --- CLASS VALIDATION ---
const validateCreateClass = (req, res, next) => {
  const schema = Joi.object({
    name: Joi.string().trim().min(3).max(100).required().messages({
      'string.empty': 'Class name is required',
      'string.min': 'Name must be at least 3 characters',
      'string.max': 'Name cannot exceed 100 characters'
    }),
    courseId: idSchema.required(),
    teacherId: idSchema.required(),
    studentIds: Joi.array().items(idSchema).unique().max(50).optional().messages({
      'array.max': 'Class cannot exceed 50 students'
    }),
    startDate: dateSchema.required().messages({
      'date.base': 'Start date must be a valid ISO date'
    }),
    endDate: dateSchema.when('startDate', {
      is: Joi.exist(),
      then: Joi.date().iso().min(Joi.ref('startDate')).messages({
        'date.min': 'End date must be after start date',
        'date.base': 'End date must be a valid ISO date'
      })
    }),
    location: Joi.string().trim().max(100).optional(),
    meetingLink: Joi.string().uri().trim().max(500).optional().messages({
      'string.uri': 'Invalid URL format'
    })
  }).options({ abortEarly: false });

  validateRequest(schema, req, res, next);
};

const validateUpdateClass = (req, res, next) => {
  const schema = Joi.object({
    name: Joi.string().trim().min(3).max(100).optional(),
    courseId: idSchema.optional(),
    teacherId: idSchema.optional(),
    studentIds: Joi.array().items(idSchema).unique().max(50).optional(),
    startDate: dateSchema.optional(),
    endDate: dateSchema.when('startDate', {
      is: Joi.exist(),
      then: Joi.date().iso().min(Joi.ref('startDate')).messages({
        'date.min': 'End date must be after start date',
        'date.base': 'End date must be a valid ISO date'
      })
    }),
    location: Joi.string().trim().max(100).optional(),
    meetingLink: Joi.string().uri().trim().max(500).optional(),
    status: Joi.string().valid('active', 'completed', 'upcoming').optional()
  }).min(1).messages({
    'object.min': 'At least one field is required for update'
  });

  validateRequest(schema, req, res, next);
};

// --- USER VALIDATION ---
const validateBulkApprove = (req, res, next) => {
  const schema = Joi.object({
    userIds: Joi.array().items(idSchema).min(1).max(100).unique().required().messages({
      'array.min': 'At least one user ID is required',
      'array.max': 'Cannot process more than 100 users at once'
    })
  });

  validateRequest(schema, req, res, next);
};

const validateDeactivateUser = (req, res, next) => {
  const schema = Joi.object({}); // No body expected
  const paramsSchema = Joi.object({
    userId: idSchema.required()
  });
  const { error: bodyError } = schema.validate(req.body);
  const { error: paramsError } = paramsSchema.validate(req.params);
  if (bodyError || paramsError) {
    const errors = [
      ...(bodyError ? bodyError.details : []),
      ...(paramsError ? paramsError.details : [])
    ].map(detail => ({
      field: detail.path.join('.'),
      message: detail.message.replace(/['"]+/g, '')
    }));
    return res.status(400).json({ 
      message: 'Validation failed',
      errors 
    });
  }
  next();
};

// --- HELPER FUNCTION ---
function validateRequest(schema, req, res, next) {
  const { error } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    const errors = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message.replace(/['"]+/g, '')
    }));
    return res.status(400).json({ 
      status: 400,
      message: 'Validation failed',
      errors 
    });
  }
  next();
}

module.exports = {
  validateCreateCourse,
  validateUpdateCourse,
  validateCreateClass,
  validateUpdateClass,
  validateBulkApprove,
  validateDeactivateUser
};
*/