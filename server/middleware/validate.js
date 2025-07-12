const Joi = require('joi');

const validateRegister = (req, res, next) => {
  const schema = Joi.object({
    fullName: Joi.string().required().messages({
      'string.empty': 'Full name is required',
    }),
    email: Joi.string().email().required().messages({
      'string.email': 'Invalid email format',
      'string.empty': 'Email is required',
    }),
    password: Joi.string().min(6).required().messages({
      'string.min': 'Password must be at least 6 characters',
      'string.empty': 'Password is required',
    }),
    role: Joi.string().valid('student', 'teacher', 'admin').required().messages({
      'any.only': 'Role must be student, teacher, or admin',
      'string.empty': 'Role is required',
    }),
    contactInfo: Joi.object({
      phone: Joi.string().pattern(/^\+2519\d{8}$/).optional().messages({
        'string.pattern.base': 'Phone number must be in the format +2519xxxxxxxxx',
      }),
    }).optional(),
  });
  const { error } = schema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });
  next();
};

const validateLogin = (req, res, next) => {
  const schema = Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Invalid email format',
      'string.empty': 'Email is required',
    }),
    password: Joi.string().required().messages({
      'string.empty': 'Password is required',
    }),
  });
  const { error } = schema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });
  next();
};

module.exports = { validateRegister, validateLogin };